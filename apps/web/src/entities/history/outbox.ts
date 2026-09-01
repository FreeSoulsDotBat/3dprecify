import { del, get, set } from "idb-keyval";

import type { SnapshotIn, SnapshotOut } from "@/shared/api/generated";

// ⚠ @doc ADR-0018 §Decision — o cache de leitura engole falha de escrita por desenho; o outbox NÃO:
//   ele é a ÚNICA cópia do orçamento do vendedor. Sem resposta ≠ não salvo (item 4).

// hotfix 016/A3 (H4, 2026-08-07) — "unauthenticated" tells the TRUE reason a 401 could not sync: the
// SESSÃO expirou, not the network. Before this it fell into `pending`, whose copy promises "sincroniza
// sozinho quando houver conexão" — false when the connection is fine and the server refuses the token.
// It behaves like `blocked` (never auto-retried — retrying without a session can never succeed) but is
// its own state so the UI can name the RIGHT cause and never suggest "check your connection".
export type SyncState = "synced" | "pending" | "blocked" | "failed" | "unauthenticated";

/** A queued record: the COMPLETE POST body, frozen at record time. Never re-derived, never
 *  recomputed, never patched at send time — the device clock and the idempotency key are part of
 *  the frozen body. */
export interface OutboxEntry {
    clientSnapshotId: string;
    body: SnapshotIn;
    syncState: Exclude<SyncState, "synced">;
    attempts: number;
    lastStatus?: number;
}

/** IndexedDB key — uid-scoped, so a device shared by two accounts never crosses them. */
export function historyOutboxKey(uid: string): string {
    return `history:outbox:${uid}`;
}

function isOutboxArray(raw: unknown): raw is OutboxEntry[] {
    return (
        Array.isArray(raw) &&
        raw.every(
            (x) =>
                typeof x === "object" &&
                x !== null &&
                typeof (x as { clientSnapshotId?: unknown }).clientSnapshotId === "string",
        )
    );
}

/**
 * Read the queue for DISPLAY. A corrupt or foreign shape is discarded rather than fed to the UI, and
 * a read failure yields an empty list rather than throwing — the history screen must render.
 *
 * **Never use this as the base of a WRITE** — that is what `readOutboxStrict` is for (SC-816).
 */
export async function listOutbox(uid: string): Promise<OutboxEntry[]> {
    try {
        return await readOutboxStrict(uid);
    } catch {
        return [];
    }
}

/**
 * Read the queue for a READ-MODIFY-WRITE. Propagates a storage failure instead of pretending the
 * queue is empty (SC-816).
 *
 * The distinction is load-bearing, not stylistic. `idb-keyval` documents that Safari's `db.onclose`
 * clears the cached connection: the next `get` REJECTS while a later `set` reopens the database and
 * SUCCEEDS. Rebasing a write on a swallowed read therefore erases every pending snapshot — and the
 * outbox is the ONLY copy of a quote recorded offline, so what disappears does not disappear from a
 * cache; it disappears from the seller. There is no error line either, because from the queue's
 * point of view nothing failed.
 *
 * This file already named the hazard — see `settleEntry`'s docstring, "`listOutbox` returns `[]` on
 * ANY read error" — and closed it on the settle path only. This closes it on the write path.
 *
 * A shape that READS FINE but is not ours is still discarded: that is knowledge, not ignorance.
 */
async function readOutboxStrict(uid: string): Promise<OutboxEntry[]> {
    const raw = await get(historyOutboxKey(uid));
    return isOutboxArray(raw) ? raw : [];
}

/** Persist the queue. Deliberately NOT wrapped in try/catch — a failure here MUST surface. */
async function writeOutbox(uid: string, entries: OutboxEntry[]): Promise<void> {
    await set(historyOutboxKey(uid), entries);
}

// EVERY read-modify-write of the queue runs under this lock (ADR-0018 §6).
//
// This is not defensive plumbing — it fixes a real record-destroying bug the T016 visual
// homologation caught. The drain used to read the queue, POST (slow), then write back the list it
// had computed BEFORE the round-trip. Anything the seller recorded in that window was not in that
// list, so the write-back ERASED it — while the UI had already said "Pendente neste dispositivo".
// A false pending is the worst lie this feature can tell, and the DB's unique key cannot catch it:
// that key prevents DUPLICATES, not a record that is never POSTed at all.
//
// `navigator.locks` serializes across TABS; the promise chain serializes within one tab and covers
// browsers (and jsdom) where the Web Locks API is absent. The critical section stays SHORT — no
// network call ever happens inside it.
let tabChain: Promise<unknown> = Promise.resolve();

async function withOutboxLock<T>(uid: string, fn: () => Promise<T>): Promise<T> {
    const locks = (navigator as { locks?: LockManager }).locks;
    const run = async (): Promise<T> =>
        locks ? ((await locks.request(historyOutboxKey(uid), fn)) as T) : fn();
    const next: Promise<T> = tabChain.then(run, run);
    tabChain = next.then(
        () => undefined,
        () => undefined,
    );
    return next;
}

/**
 * Queue a snapshot. **Throws** if the device cannot store it — the record action has to be able to
 * tell the seller it did NOT queue, rather than show "pendente" over nothing.
 */
export async function enqueueSnapshot(uid: string, body: SnapshotIn): Promise<OutboxEntry> {
    const entry: OutboxEntry = {
        clientSnapshotId: String(body.clientSnapshotId),
        body,
        syncState: "pending",
        attempts: 0,
    };
    await withOutboxLock(uid, async () => {
        const existing = await readOutboxStrict(uid);
        await writeOutbox(uid, [
            ...existing.filter((e) => e.clientSnapshotId !== entry.clientSnapshotId),
            entry,
        ]);
    });
    return entry;
}

/** Drop ONE entry, re-reading the queue inside the lock so a concurrent enqueue survives. */
async function removeEntry(uid: string, clientSnapshotId: string): Promise<void> {
    try {
        await withOutboxLock(uid, async () => {
            const current = await readOutboxStrict(uid);
            await writeOutbox(
                uid,
                current.filter((e) => e.clientSnapshotId !== clientSnapshotId),
            );
        });
    } catch {
        // The entry is already on the server; a failed write-back only means it will be replayed, and
        // the replay is idempotent. Never surface this as a recording failure.
    }
}

/** Update ONE entry in place, same re-read-inside-the-lock discipline. */
async function updateEntry(
    uid: string,
    clientSnapshotId: string,
    patch: (entry: OutboxEntry) => OutboxEntry,
): Promise<void> {
    try {
        await withOutboxLock(uid, async () => {
            const current = await readOutboxStrict(uid);
            await writeOutbox(
                uid,
                current.map((e) => (e.clientSnapshotId === clientSnapshotId ? patch(e) : e)),
            );
        });
    } catch {
        // The entry keeps its previous state and is retried later — never dropped.
    }
}

/** Part of the sign-out privacy sweep — the queue never leaks into the next account. */
export async function purgeOutbox(uid: string): Promise<void> {
    try {
        await withOutboxLock(uid, () => del(historyOutboxKey(uid)));
    } catch {
        /* a failed purge must never crash the sign-out flow */
    }
}

/** O mapa status HTTP → `SyncState` de uma tentativa que NÃO sincronizou (regras nos comentários —
 *  cada ramo é uma decisão registrada, não uma conveniência). */
function syncStateForStatus(status: number): OutboxEntry["syncState"] {
    // hotfix 016/A3 (H4): o 401 é recusa ATIVA do token, nunca "sem resposta" — não é `pending`.
    if (status === 401) return "unauthenticated";
    if (status === 403) return "blocked";
    if (status === 422) return "failed";
    // Includes status 0 (no response): the write may have landed. PENDING, never "falhou".
    return "pending";
}

export interface DrainDeps {
    /** POSTs one frozen body. Resolves on 201 (created) AND on 200 (idempotent replay) alike. */
    post: (body: SnapshotIn) => Promise<SnapshotOut>;
    /** Set when the entitlement just became `active` again: blocked entries are retried. */
    retryBlocked?: boolean;
    /** hotfix 016/A3 (H4) — set when the SESSION just became `authenticated` again (the mirror of
     *  `retryBlocked`, driven by a different signal): `unauthenticated` entries are retried. Retrying
     *  a session-dead entry without this would just mint another 401 and another wasted attempt. */
    retryUnauthenticated?: boolean;
}

/**
 * Settle ONE entry against the server and return its FINAL state — read DIRECTLY from the send
 * outcome, never re-inferred by re-reading the queue.
 *
 * That directness is the fix for the "false salvo" (review PR-A, M1): the record path used to POST,
 * then re-read the queue and treat "not there ⇒ the server has it". But `listOutbox` returns `[]` on
 * ANY read error, so a glitched re-read reported `synced` over a record the server never accepted —
 * the worst lie this feature can tell. Here `synced` is returned ONLY when `post` actually resolved;
 * an unconfirmable send stays `pending`.
 *
 * PR-B (M5): a status-0 (lost response) MUST stay `pending` and be retried — it may have landed. The
 * coming backoff/cap policy may space retries out, but it must NEVER flip a status 0 to `failed`.
 */
export async function settleEntry(
    uid: string,
    entry: OutboxEntry,
    deps: DrainDeps,
): Promise<SyncState> {
    try {
        await deps.post(entry.body);
        // Accepted — 201 (created) or 200 (the server returned the row it already had). Identical to
        // the client: the record is on the server, so the queue entry has done its job.
        await removeEntry(uid, entry.clientSnapshotId);
        return "synced";
    } catch (error) {
        const status = (error as { status?: number }).status ?? 0;
        const code = (error as { code?: string }).code;

        // ⚠ @doc DEC-031 — só é exclusão com DUAS provas (`attempts > 0` E `code NOT_FOUND`):
        //   404 é o status que a infraestrutura mais produz. Sem as duas, a entrada sobrevive —
        //   entrada retida incomoda, entrada apagada acabou.
        if (status === 404 && entry.attempts > 0 && code === "NOT_FOUND") {
            await removeEntry(uid, entry.clientSnapshotId);
            return "synced";
        }

        // hotfix 016/A3 (H4) — a 401 is NOT "no answer": the server actively refused the token. It must
        // never fall into `pending` (whose copy promises "sincroniza sozinho quando houver conexão" —
        // false with a dead connection and a live one alike) nor auto-retry blindly (retrying without a
        // session can only mint the same 401 again). It NEVER purges or signs the seller out here — this
        // function does not know about auth state at all, and that absence is the guarantee: the ONLY
        // copy of an unsynced quote survives a dead session (see `session-expiry.ts` for the non-negotiable
        // property, enforced where sign-out actually lives).
        const syncState = syncStateForStatus(status);

        await updateEntry(uid, entry.clientSnapshotId, (current) => ({
            ...current,
            syncState,
            attempts: current.attempts + 1,
            lastStatus: status,
        }));
        return syncState;
    }
}

/**
 * Drain the queue. Entries are INDEPENDENT — a failing entry never blocks the ones behind it.
 *
 * Returns each processed entry's FINAL `SyncState`, keyed by `clientSnapshotId`, so a caller (the
 * record action) can read the outcome of ITS entry without a lying re-read (M1). An entry the drain
 * never reached — because the queue read itself failed — is simply absent from the map, and the
 * caller treats "absent" as `pending`, never `synced`.
 *
 * Each entry is settled ON ITS OWN, under the lock, against the queue as it stands AT THAT MOMENT.
 * The earlier shape — read the whole list, post, write the list back — destroyed any record queued
 * during the round-trip (T016/B2): it wrote a list computed before the seller had even tapped Save.
 *
 * Correctness of the SEND does not rest on this function either: the DB's unique key is what makes a
 * retry idempotent. A caller may drain from several triggers (boot, `online`, focus, post-sign-in)
 * and even from two tabs without risking a duplicate.
 */
export async function drainOutbox(
    uid: string,
    deps: DrainDeps,
): Promise<Record<string, SyncState>> {
    const entries = await listOutbox(uid);
    const results: Record<string, SyncState> = {};

    for (const entry of entries) {
        // A permanent rejection is never auto-retried; a blocked entry waits for the seller (or for
        // premium to come back); an unauthenticated one waits for the seller (or for the session to come
        // back — 016/A3 H4). Untouched — not rewritten, not reordered — but its existing state is still
        // recorded so the caller can read the target's outcome.
        if (
            entry.syncState === "failed" ||
            (entry.syncState === "blocked" && !deps.retryBlocked) ||
            (entry.syncState === "unauthenticated" && !deps.retryUnauthenticated)
        ) {
            results[entry.clientSnapshotId] = entry.syncState;
            continue;
        }

        results[entry.clientSnapshotId] = await settleEntry(uid, entry, deps);
    }

    return results;
}

/**
 * Re-send ONE entry on demand — the [Tentar novamente] action a `blocked`/`failed` entry needs so it
 * is not a dead end (review PR-A, B2). Reset to `pending` under the lock, then settle it. Returns the
 * resulting state (or `pending` if it could not be re-read — never a fabricated `synced`).
 */
export async function retryEntry(
    uid: string,
    clientSnapshotId: string,
    deps: DrainDeps,
): Promise<SyncState> {
    await updateEntry(uid, clientSnapshotId, (current) => ({ ...current, syncState: "pending" }));
    const entry = (await listOutbox(uid)).find((e) => e.clientSnapshotId === clientSnapshotId);
    if (!entry) return "pending"; // could not re-read it — never claim it was accepted
    return settleEntry(uid, entry, deps);
}

/**
 * Discard ONE entry — the [Descartar] action. The seller's EXPLICIT choice (always confirmed at the
 * UI), never automatic: a blocked/failed record is retained until they decide (ADR-0018 §9).
 */
export async function discardEntry(uid: string, clientSnapshotId: string): Promise<void> {
    await removeEntry(uid, clientSnapshotId);
}

/** One row of the Histórico, whether it lives on the server or is still on this device. */
export interface HistoryItem {
    /** Null while pending — an unsynced entry has no server id and must not pretend to. */
    id: string | null;
    clientSnapshotId: string;
    kind: string;
    label: string | null;
    headlineTotal: string;
    headlineBasis: string;
    deviceQuotedAt: string;
    syncState: SyncState;
    /** The full server row, when synced. */
    snapshot: SnapshotOut | null;
    /** The queued entry, when not. */
    entry: OutboxEntry | null;
}

/**
 * THE LIST IS THE UNION. (server) ∪ (outbox), deduped on `clientSnapshotId`, **server-wins**.
 *
 * This is structural, not cosmetic: **no component may read the server query alone.** It is the
 * direct answer to the E3 PR-C lesson — *a correct component starved of correct data still lies* —
 * where a correct degraded-line component rendered a deleted product as live because it was fed a
 * stale cache. Here, no interleaving of "drain removed the entry" and "the query was invalidated"
 * can render a row twice or show a synced row as pending: whichever side is fresher, server wins on
 * the key, and a still-queued entry is still shown.
 *
 * Pending entries sit in their CHRONOLOGICAL place, newest-first by the DEVICE's date — the date
 * that IS the seller's claim. They are never hidden away in a separate drawer (that would read as
 * "draft") and never collapsed into a counter chip (that would be the silent drop).
 */
export function mergeHistory(server: SnapshotOut[], outbox: OutboxEntry[]): HistoryItem[] {
    const syncedKeys = new Set(server.map((s) => String(s.clientSnapshotId)));

    const fromServer: HistoryItem[] = server.map((s) => ({
        id: String(s.id),
        clientSnapshotId: String(s.clientSnapshotId),
        kind: s.kind,
        label: s.label ?? null,
        headlineTotal: String(s.headlineTotal),
        headlineBasis: s.headlineBasis,
        deviceQuotedAt: String(s.deviceQuotedAt),
        syncState: "synced",
        snapshot: s,
        entry: null,
    }));

    const fromOutbox: HistoryItem[] = outbox
        .filter((e) => !syncedKeys.has(e.clientSnapshotId))
        .map((e) => ({
            id: null,
            clientSnapshotId: e.clientSnapshotId,
            kind: e.body.kind,
            label: e.body.label ?? null,
            headlineTotal: String(e.body.headlineTotal),
            headlineBasis: e.body.headlineBasis,
            deviceQuotedAt: String(e.body.deviceQuotedAt),
            syncState: e.syncState,
            snapshot: null,
            entry: e,
        }));

    return [...fromServer, ...fromOutbox].sort((a, b) =>
        b.deviceQuotedAt.localeCompare(a.deviceQuotedAt),
    );
}
