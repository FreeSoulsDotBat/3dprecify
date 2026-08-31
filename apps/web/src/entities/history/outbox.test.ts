import { beforeEach, describe, expect, it, vi } from "vitest";

const idbGet = vi.fn();
const idbSet = vi.fn();
const idbDel = vi.fn();
vi.mock("idb-keyval", () => ({ get: idbGet, set: idbSet, del: idbDel }));

const {
    discardEntry,
    drainOutbox,
    enqueueSnapshot,
    listOutbox,
    mergeHistory,
    purgeOutbox,
    retryEntry,
    settleEntry,
} = await import("./outbox");
const { historyOutboxKey } = await import("./outbox");
import type { OutboxEntry } from "./outbox";

// 009/T008 (E4, PR-A) — the OUTBOX, written FAILING-first. This is the product's FIRST offline
// write; nothing in E2/E3 can be reused wholesale, because every write there is online-only.
//
// The four properties below are the ones that, if broken, make the app LIE to the seller:
//
//   1. A failed enqueue must THROW. The uid-keyed READ cache deliberately swallows write failures
//      ("the cache is a convenience, never authoritative"). The outbox is the OPPOSITE: it is the
//      only copy of the seller's quote, so a silent swallow would drop a record while the UI says
//      "pendente".
//
//   2. A lost response is NOT a failure. `ApiError.status === 0` (no response) leaves the entry
//      PENDING and retryable — never "falhou", never "salvo". No answer is not the same as not saved.
//
//   3. 403 at sync ⇒ BLOCKED, retained and visible (the server is the entitlement authority, and an
//      offline client cannot check it). Never silently discarded.
//
//   4. The list is ONE selector: (server) ∪ (outbox), deduped on clientSnapshotId, SERVER-WINS.
//      This is the structural answer to the E3 PR-C lesson — a correct component starved of correct
//      data still lies — so no component may read the server query alone.

const BODY = {
    clientSnapshotId: "csid-1",
    kind: "SINGLE" as const,
    label: "Cliente João",
    deviceQuotedAt: "2026-07-13T19:30:00Z",
    deviceUtcOffsetMinutes: -180,
    modelVersion: "3.1.0",
    headlineTotal: "21.90",
    headlineBasis: "PRECO_VAREJO" as const,
    payload: { schemaVersion: 1, kind: "SINGLE", modelVersion: "3.1.0" },
};

function entry(over: Partial<OutboxEntry> = {}): OutboxEntry {
    return {
        clientSnapshotId: BODY.clientSnapshotId,
        body: { ...BODY },
        syncState: "pending",
        attempts: 0,
        ...over,
    } as OutboxEntry;
}

beforeEach(() => {
    vi.clearAllMocks();
    idbGet.mockResolvedValue(undefined);
    idbSet.mockResolvedValue(undefined);
    idbDel.mockResolvedValue(undefined);
});

describe("the outbox is uid-keyed, like every persisted thing in this app", () => {
    it("scopes the store by uid so a shared device never crosses two accounts", () => {
        expect(historyOutboxKey("u1")).toBe("history:outbox:u1");
        expect(historyOutboxKey("u2")).not.toBe(historyOutboxKey("u1"));
    });

    it("purges the uid's queue on sign-out", async () => {
        await purgeOutbox("u1");
        expect(idbDel).toHaveBeenCalledWith("history:outbox:u1");
    });
});

describe("a failed enqueue THROWS — the outbox is not a convenience cache", () => {
    it("propagates the failure instead of swallowing it", async () => {
        idbSet.mockRejectedValueOnce(new Error("QuotaExceeded"));

        await expect(enqueueSnapshot("u1", BODY)).rejects.toThrow();
        // The record action must be able to tell the seller it did NOT queue. Swallowing here would
        // drop the quote while the UI cheerfully said "pendente".
    });

    it("persists the COMPLETE POST body, frozen at record time", async () => {
        await enqueueSnapshot("u1", BODY);

        const [key, value] = idbSet.mock.calls[0] as [string, OutboxEntry[]];
        expect(key).toBe("history:outbox:u1");
        expect(value[0]?.body).toEqual(BODY);
        expect(value[0]?.syncState).toBe("pending");
        // Never re-derived and never patched at send time — the device clock and the idempotency key
        // are part of the frozen body.
        expect(value[0]?.body.deviceQuotedAt).toBe("2026-07-13T19:30:00Z");
        expect(value[0]?.clientSnapshotId).toBe("csid-1");
    });
});

describe("draining: exactly-once, and honest about every failure mode", () => {
    it("removes the entry once the server accepts it", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockResolvedValue({ id: "s1" });

        await drainOutbox("u1", { post });

        expect(post).toHaveBeenCalledTimes(1);
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toEqual([]);
    });

    it("a LOST RESPONSE (status 0) leaves it PENDING — never 'failed', never 'saved'", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockRejectedValue({ status: 0 });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("pending");
        expect(value[0]?.attempts).toBe(1);
    });

    it("a REPLAY is an idempotent success — the same key never duplicates", async () => {
        idbGet.mockResolvedValue([entry({ attempts: 3 })]);
        // The server answers 200 with the row it already created (ON CONFLICT DO NOTHING + read-back).
        const post = vi.fn().mockResolvedValue({ id: "s1" });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toEqual([]); // treated exactly like a fresh 201
    });

    it("a 403 at sync ⇒ BLOCKED: retained, visible, auto-retry stopped", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockRejectedValue({ status: 403, code: "ENTITLEMENT_REQUIRED" });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("blocked");
        // It is NOT discarded — the seller's quote survives until they decide (ADR-0018 §9).
        expect(value).toHaveLength(1);
    });

    it("a blocked entry is skipped by auto-drain, and retried once premium is active again", async () => {
        idbGet.mockResolvedValue([entry({ syncState: "blocked" })]);
        const post = vi.fn().mockResolvedValue({ id: "s1" });

        await drainOutbox("u1", { post });
        expect(post).not.toHaveBeenCalled(); // auto-retry is stopped while blocked

        await drainOutbox("u1", { post, retryBlocked: true });
        expect(post).toHaveBeenCalledTimes(1);
    });

    // hotfix 016/A3 (H4, 2026-08-07) — a 401 tells a DIFFERENT truth than "no answer": the session
    // died, the connection did not. Before this it fell into `pending`, whose copy falsely promises
    // "sincroniza sozinho quando houver conexão" while the connection is fine.
    it("um 401 no envio NÃO vira `pending` — vira `unauthenticated`", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockRejectedValue({ status: 401, code: "TOKEN_EXPIRED" });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("unauthenticated");
        expect(value[0]?.syncState).not.toBe("pending");
    });

    it("um 401 NUNCA remove a entrada — é a única cópia da cotação não sincronizada", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockRejectedValue({ status: 401, code: "UNAUTHENTICATED" });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toHaveLength(1);
        expect(value[0]?.clientSnapshotId).toBe(entry().clientSnapshotId);
    });

    it("uma entrada `unauthenticated` NÃO é re-tentada sozinha, e É re-tentada quando a sessão volta", async () => {
        idbGet.mockResolvedValue([entry({ syncState: "unauthenticated" })]);
        const post = vi.fn().mockResolvedValue({ id: "s1" });

        await drainOutbox("u1", { post });
        expect(post).not.toHaveBeenCalled(); // auto-retry is stopped while unauthenticated

        await drainOutbox("u1", { post, retryUnauthenticated: true });
        expect(post).toHaveBeenCalledTimes(1); // the session came back — mirror of retryBlocked
    });

    it("a 404 (the seller DELETED it elsewhere) drops the entry quietly — not a silent data loss", async () => {
        // This only happens when the original response was lost AND the seller then deleted the
        // snapshot from another device. Resurrecting it would undo a deliberate deletion; keeping it
        // queued would nag forever. Dropping it is the seller's own later intent winning (ADR-0018 §5).
        // 014/T111: o fixture passou a EXIBIR o cenário que a prosa acima sempre descreveu. Ele dizia
        // "a resposta original se perdeu E o vendedor apagou de outro dispositivo" — isto é, um REPLAY —
        // mas montava `attempts: 0` e um 404 sem `code`, que é justamente a forma que a infraestrutura
        // produz. O teste codificava o comportamento frouxo, não o caso que narrava.
        idbGet.mockResolvedValue([entry({ attempts: 1 })]);
        const post = vi.fn().mockRejectedValue({ status: 404, code: "NOT_FOUND" });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toEqual([]);
    });

    it("a 422 is a PERMANENT rejection ⇒ failed, and never auto-retried", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockRejectedValue({ status: 422 });

        await drainOutbox("u1", { post });

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("failed");
    });

    it("entries are INDEPENDENT — one failure never blocks the queue behind it", async () => {
        idbGet.mockResolvedValue([
            entry({ clientSnapshotId: "a", body: { ...BODY, clientSnapshotId: "a" } }),
            entry({ clientSnapshotId: "b", body: { ...BODY, clientSnapshotId: "b" } }),
        ]);
        const post = vi
            .fn()
            .mockRejectedValueOnce({ status: 0 })
            .mockResolvedValueOnce({ id: "s-b" });

        await drainOutbox("u1", { post });

        expect(post).toHaveBeenCalledTimes(2); // 'b' was attempted despite 'a' failing
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value.map((e) => e.clientSnapshotId)).toEqual(["a"]); // only the failing one remains
    });
});

describe("T016/B2 regression — a drain must never DESTROY a record queued while it runs", () => {
    it("keeps a snapshot enqueued mid-flight — a false 'pendente' is the worst lie this epic can tell", async () => {
        // The bug the visual homologation caught: `drainOutbox` read the queue, posted (slow), then
        // wrote back `remaining` — computed from the list it read BEFORE the network round-trip. Any
        // record enqueued in that window was simply not in `remaining`, so the write-back ERASED it.
        //
        // The database's unique key does not save us here: it prevents DUPLICATES, not a record that is
        // never POSTed at all. And the app had already told the seller "Pendente neste dispositivo" —
        // over a record that no longer existed anywhere. Fixing the offline blocker (B1) makes this
        // MORE likely, not less: reconnection is exactly when a drain and a fresh record collide.
        const store: OutboxEntry[][] = [[entry({ clientSnapshotId: "a" })]];
        idbGet.mockImplementation(() => Promise.resolve(store[0]));
        idbSet.mockImplementation((_k: string, v: OutboxEntry[]) => {
            store[0] = v;
            return Promise.resolve();
        });

        // The POST for "a" is in flight when the seller records "b".
        let releasePost!: () => void;
        const inFlight = new Promise<void>((resolve) => {
            releasePost = resolve;
        });
        const post = vi.fn(async () => {
            await inFlight;
            return { id: "s-a" } as never;
        });

        const draining = drainOutbox("u1", { post });
        await enqueueSnapshot("u1", { ...BODY, clientSnapshotId: "b" });
        releasePost();
        await draining;

        // "a" reached the server and left. "b" is still queued — it was NEVER sent, so it must still be
        // here. Losing it would mean the seller's quote vanished while the UI said it was pending.
        expect(store[0].map((e) => e.clientSnapshotId)).toEqual(["b"]);
    });
});

describe("drainOutbox reports each entry's FINAL state (review PR-A, M1)", () => {
    it("returns the outcome keyed by clientSnapshotId — synced when accepted, kept state when skipped", async () => {
        idbGet.mockResolvedValue([
            entry({ clientSnapshotId: "ok", body: { ...BODY, clientSnapshotId: "ok" } }),
            entry({
                clientSnapshotId: "bad",
                body: { ...BODY, clientSnapshotId: "bad" },
                syncState: "failed",
            }),
        ]);
        const post = vi.fn().mockResolvedValue({ id: "s1" });

        const results = await drainOutbox("u1", { post });

        expect(results).toEqual({ ok: "synced", bad: "failed" });
        // The failed entry is NOT re-sent by an auto-drain.
        expect(post).toHaveBeenCalledTimes(1);
    });
});

describe("per-entry actions — a blocked/failed entry is never a dead end (review PR-A, B2)", () => {
    it("retryEntry re-enqueues a failed entry and re-sends it — the queue empties on a 2xx", async () => {
        idbGet.mockResolvedValue([entry({ syncState: "failed", lastStatus: 422 })]);
        const post = vi.fn().mockResolvedValue({ id: "s1" });

        const state = await retryEntry("u1", BODY.clientSnapshotId, { post });

        expect(post).toHaveBeenCalledTimes(1); // a failed entry IS retried on demand
        expect(state).toBe("synced");
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toEqual([]);
    });

    it("retryEntry on a still-rejecting entry keeps it visible, never a false synced", async () => {
        idbGet.mockResolvedValue([entry({ syncState: "failed" })]);
        const post = vi.fn().mockRejectedValue({ status: 422 });

        const state = await retryEntry("u1", BODY.clientSnapshotId, { post });

        expect(state).toBe("failed");
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("failed");
    });

    it("discardEntry removes ONLY the target entry", async () => {
        idbGet.mockResolvedValue([
            entry({ clientSnapshotId: "a", body: { ...BODY, clientSnapshotId: "a" } }),
            entry({ clientSnapshotId: "b", body: { ...BODY, clientSnapshotId: "b" } }),
        ]);

        await discardEntry("u1", "a");

        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value.map((e) => e.clientSnapshotId)).toEqual(["b"]);
    });

    it("settleEntry returns the honest state directly — status 0 is pending, never failed", async () => {
        idbGet.mockResolvedValue([entry()]);
        const post = vi.fn().mockRejectedValue({ status: 0 });

        const state = await settleEntry("u1", entry(), { post });

        expect(state).toBe("pending");
    });
});

describe("mergeHistory — the list IS the union (the E3 PR-C lesson, answered structurally)", () => {
    const server = [
        {
            id: "s1",
            clientSnapshotId: "csid-1",
            label: "Sincronizado",
            headlineTotal: "10.00",
            headlineBasis: "PRECO_VAREJO",
            deviceQuotedAt: "2026-07-10T10:00:00Z",
            kind: "SINGLE",
        },
    ];

    it("dedupes on clientSnapshotId with SERVER-WINS, so a synced entry never renders as pending", () => {
        // The race: the drain removed the outbox entry, but the query has not been invalidated yet
        // (or vice-versa). Either interleaving must be safe.
        const merged = mergeHistory(server as never, [entry()]);

        expect(merged).toHaveLength(1);
        expect(merged[0]?.syncState).toBe("synced");
        expect(merged[0]?.id).toBe("s1");
    });

    it("shows a pending entry IN the list, in its chronological place — never hidden, never a separate drawer", () => {
        const pending = entry({
            clientSnapshotId: "csid-2",
            body: { ...BODY, clientSnapshotId: "csid-2", deviceQuotedAt: "2026-07-13T19:30:00Z" },
        });

        const merged = mergeHistory(server as never, [pending]);

        expect(merged).toHaveLength(2);
        // Newest-first by the DEVICE's date — the date that IS the seller's claim.
        expect(merged[0]?.clientSnapshotId).toBe("csid-2");
        expect(merged[0]?.syncState).toBe("pending");
        expect(merged[1]?.syncState).toBe("synced");
    });

    it("a pending entry carries its own values, so the list never invents a price it does not have", () => {
        const merged = mergeHistory([] as never, [entry()]);

        expect(merged[0]?.headlineTotal).toBe("21.90");
        expect(merged[0]?.label).toBe("Cliente João");
        expect(merged[0]?.id).toBeNull(); // it has no server id yet, and must not pretend to
    });

    it("blocked and failed entries stay visible in the list", () => {
        const merged = mergeHistory([] as never, [
            entry({
                clientSnapshotId: "a",
                body: { ...BODY, clientSnapshotId: "a" },
                syncState: "blocked",
            }),
            entry({
                clientSnapshotId: "b",
                body: { ...BODY, clientSnapshotId: "b" },
                syncState: "failed",
            }),
        ]);

        expect(merged.map((m) => m.syncState).sort()).toEqual(["blocked", "failed"]);
    });
});

describe("listOutbox", () => {
    it("returns an empty queue rather than throwing when nothing is stored", async () => {
        idbGet.mockResolvedValue(undefined);
        await expect(listOutbox("u1")).resolves.toEqual([]);
    });

    it("discards a corrupt payload instead of feeding it to the UI", async () => {
        idbGet.mockResolvedValue({ not: "an array" });
        await expect(listOutbox("u1")).resolves.toEqual([]);
    });
});

// 014/T110 — SC-816. A falha de LEITURA não pode virar base de ESCRITA.
//
// `listOutbox` é deliberadamente tolerante: um payload corrompido é descartado em vez de ser servido
// à UI. Isso está certo para EXIBIR. Está errado para REESCREVER — e as três funções que reescrevem
// a fila (`enqueueSnapshot`, `removeEntry`, `updateEntry`) liam por ali, dentro do lock.
//
// O modo de falha não é hipotético: a própria `idb-keyval` documenta que o `db.onclose` do Safari
// zera a conexão em cache, de modo que o `get` seguinte REJEITA e o `set` posterior reabre o banco e
// GRAVA. Leitura falha + escrita bem-sucedida = fila rebaseada em vazio. O outbox é a única cópia da
// cotação gravada offline, então o que some não some de um cache: some do vendedor.
//
// O próprio arquivo já nomeava este perigo na docstring do `settleEntry` ("listOutbox returns [] on
// ANY read error") — o conserto foi feito no caminho do settle e nunca no de reescrita.
describe("SC-816 — uma leitura que falha ABORTA a reescrita, nunca a rebaseia em vazio", () => {
    beforeEach(() => {
        idbGet.mockReset();
        idbSet.mockReset();
    });

    it("enqueue com leitura falhando NÃO grava, e propaga — o vendedor tem de saber que não enfileirou", async () => {
        idbGet.mockRejectedValue(new Error("IndexedDB connection closed"));
        await expect(
            enqueueSnapshot("u1", { ...BODY, clientSnapshotId: "novo" }),
        ).rejects.toThrow();
        expect(idbSet).not.toHaveBeenCalled();
    });

    it("remoção com leitura falhando NÃO grava — a entrada sobrevive para o replay idempotente", async () => {
        idbGet.mockRejectedValue(new Error("IndexedDB connection closed"));
        // `settleEntry` chama `removeEntry` após um POST bem-sucedido; a remoção falha em silêncio por
        // desenho (o registro já está no servidor), mas NÃO pode reescrever a fila a partir do vazio.
        await settleEntry("u1", entry({ clientSnapshotId: "a" }), {
            post: vi.fn().mockResolvedValue({}),
        });
        expect(idbSet).not.toHaveBeenCalled();
    });

    it("atualização com leitura falhando NÃO grava — a entrada mantém o estado anterior", async () => {
        idbGet.mockRejectedValue(new Error("IndexedDB connection closed"));
        const post = vi.fn().mockRejectedValue(Object.assign(new Error("offline"), { status: 0 }));
        await settleEntry("u1", entry({ clientSnapshotId: "a" }), { post });
        expect(idbSet).not.toHaveBeenCalled();
    });

    it("a leitura de EXIBIÇÃO continua tolerante — a lista da tela nunca estoura", async () => {
        idbGet.mockRejectedValue(new Error("IndexedDB connection closed"));
        await expect(listOutbox("u1")).resolves.toEqual([]);
    });
});

// 014/T111a — SC-816. Um 404 só significa "o vendedor apagou em outro lugar" quando HÁ PROVA disso.
//
// A regra do §5 da ADR-0018 vale para um REPLAY: a resposta original se perdeu, o vendedor apagou o
// snapshot noutro dispositivo, e o reenvio encontra o vazio. O invariante que a torna segura já
// estava escrito no próprio código — "a just-minted id the server has never seen cannot 404" — mas
// só como comentário: o `if (status === 404)` não o impunha.
//
// E 404 é o status que a INFRAESTRUTURA mais produz. Um proxy mal configurado, uma rota não montada
// ou a página 404 do hosting chegam ao cliente como `ApiError{status: 404, code: "UNKNOWN"}`
// (transport.ts: `wire?.code ?? "UNKNOWN"`), indistinguíveis do NOT_FOUND da API se olharmos só o
// status. Nesse caso apagar a entrada e devolver `synced` mostra um toast verde "Salvo" sobre um
// registro que o servidor nunca recebeu — a pior mentira que este recurso pode contar, e a mesma
// classe que o M1 já corrigiu no caminho do re-read.
describe("SC-816 — 404 só apaga a entrada com PROVA de replay", () => {
    beforeEach(() => {
        idbGet.mockReset();
        idbSet.mockReset();
        idbGet.mockResolvedValue([entry({ attempts: 1 })]);
    });

    it("404 sem o code da API (proxy, hosting, rota ausente) PRESERVA a entrada", async () => {
        const post = vi.fn().mockRejectedValue({ status: 404, code: "UNKNOWN" });

        const state = await settleEntry("u1", entry({ attempts: 1 }), { post });

        expect(state).not.toBe("synced");
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toHaveLength(1);
    });

    it("404 no PRIMEIRO envio preserva a entrada — um id recém-cunhado nao pode ter sido apagado", async () => {
        idbGet.mockResolvedValue([entry({ attempts: 0 })]);
        const post = vi.fn().mockRejectedValue({ status: 404, code: "NOT_FOUND" });

        const state = await settleEntry("u1", entry({ attempts: 0 }), { post });

        expect(state).not.toBe("synced");
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toHaveLength(1);
    });

    it("404 de replay legítimo (reenvio + code da API) continua apagando — a intenção do vendedor vence", async () => {
        const post = vi.fn().mockRejectedValue({ status: 404, code: "NOT_FOUND" });

        const state = await settleEntry("u1", entry({ attempts: 1 }), { post });

        expect(state).toBe("synced");
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toEqual([]);
    });
});

// ── 019/PR-E · T135 — o ORÇAMENTO na fila ───────────────────────────────────────────────────────
//
// A decisão desta varredura, para este arquivo, é NENHUMA MUDANÇA: a fila é kind-agnóstica por
// construção (`HistoryItem.kind: string`, `body.kind` copiado sem ler), e a coisa certa a fazer
// com um `kind` novo é não ganhar ramo. O teste existe porque "não ganhou ramo" é uma AFIRMAÇÃO —
// e um `if (kind === "SINGLE")` acrescentado sem querer aqui deixaria orçamentos presos na fila
// para sempre, offline, onde ninguém olha.
const QUOTE_BODY = {
    ...BODY,
    clientSnapshotId: "csid-q",
    kind: "QUOTE" as unknown as typeof BODY.kind,
    modelVersion: "4.2.0",
    headlineTotal: "64.80",
    headlineBasis: "PRECO_ORCAMENTO" as unknown as typeof BODY.headlineBasis,
    quoteValidityDays: 15,
    payload: {
        schemaVersion: 1,
        kind: "QUOTE",
        modelVersion: "4.2.0",
        lines: [{ name: "Vaso", quantity: 2, unitPrice: "30.00", subtotal: "60.00", origin: null }],
        discount: { mode: "PCT", value: "10.00", amount: "7.20", grossTotal: "72.00" },
        costFloor: "48.00",
        totals: { precoOrcamento: "64.80" },
    },
};

function quoteEntry(over: Partial<OutboxEntry> = {}): OutboxEntry {
    return {
        clientSnapshotId: QUOTE_BODY.clientSnapshotId,
        body: { ...QUOTE_BODY },
        syncState: "pending",
        attempts: 0,
        ...over,
    } as unknown as OutboxEntry;
}

describe("019/PR-E (T135) — um QUOTE atravessa a fila como qualquer outro kind", () => {
    it("drena e sai da fila, com o corpo repassado byte a byte", async () => {
        idbGet.mockResolvedValue([quoteEntry()]);
        const post = vi.fn().mockResolvedValue({ id: "s-q" });

        await drainOutbox("u1", { post });

        expect(post).toHaveBeenCalledTimes(1);
        // O corpo vai como foi congelado — a fila não reescreve documento (ADR-0018 §1).
        expect(post.mock.calls[0]?.[0]).toEqual(QUOTE_BODY);
        const [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value).toEqual([]);
    });

    it("as mesmas falhas honestas: resposta perdida ⇒ pendente, 403 ⇒ bloqueado", async () => {
        idbGet.mockResolvedValue([quoteEntry()]);
        await drainOutbox("u1", { post: vi.fn().mockRejectedValue({ status: 0 }) });
        let [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("pending");

        idbGet.mockResolvedValue([quoteEntry()]);
        await drainOutbox("u1", {
            post: vi.fn().mockRejectedValue({ status: 403, code: "ENTITLEMENT_REQUIRED" }),
        });
        [, value] = idbSet.mock.calls.at(-1) as [string, OutboxEntry[]];
        expect(value[0]?.syncState).toBe("blocked");
    });

    it("na lista, um orçamento ainda na fila aparece como qualquer registro pendente", () => {
        const [row] = mergeHistory([], [quoteEntry()]);
        expect(row?.kind).toBe("QUOTE");
        expect(row?.headlineBasis).toBe("PRECO_ORCAMENTO");
        expect(row?.syncState).toBe("pending");
        // Sem id do servidor — e é por isso que o PDF ainda não existe (`quote.pdfWaitsSync`).
        expect(row?.id).toBeNull();
    });
});
