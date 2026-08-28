// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore, postSnapshot, listHistory, patchLabel, deleteSnap } = vi.hoisted(() => ({
  idbStore: new Map<string, unknown>(),
  postSnapshot: vi.fn(),
  listHistory: vi.fn(),
  patchLabel: vi.fn(),
  deleteSnap: vi.fn(),
}));

vi.mock("idb-keyval", () => ({
  get: vi.fn(async (k: string) => idbStore.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    idbStore.set(k, v);
  }),
  del: vi.fn(async (k: string) => {
    idbStore.delete(k);
  }),
}));

vi.mock("@/shared/api/generated", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/api/generated")>();
  return {
    ...actual,
    recordSnapshotApiV1HistoryPost: postSnapshot,
    listHistoryApiV1HistoryGet: listHistory,
    relabelSnapshotApiV1HistorySnapshotIdPatch: patchLabel,
    deleteSnapshotApiV1HistorySnapshotIdDelete: deleteSnap,
  };
});

import { get as idbGet, set as idbSet } from "idb-keyval";
import type { SnapshotIn } from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import { listOutbox } from "./outbox";
import {
  useDeleteSnapshot,
  useHistory,
  useRecordSnapshot,
  useSnapshot,
  useSyncOutbox,
  useUpdateLabel,
} from "./use-history";

// 009/T010 (E4, PR-A) — RECORDING, written FAILING-first.
//
// One code path, online and offline: the snapshot is ALWAYS queued durably first, then the queue is
// drained immediately. Online, the drain completes within the same interaction and the record is
// `synced`; offline, it stays `pending`. There is no second "offline branch" that could rot — the
// difference between the two is only whether the drain got an answer.
//
// The property that matters most is the last one: if the device cannot STORE the record, recording
// FAILS LOUDLY. A swallowed failure here would show "pendente" over nothing at all.

const BODY: SnapshotIn = {
  clientSnapshotId: "csid-1",
  kind: "SINGLE",
  label: "Cliente João",
  quoteValidityDays: 15,
  deviceQuotedAt: "2026-07-13T19:30:00Z",
  deviceUtcOffsetMinutes: -180,
  modelVersion: "3.1.0",
  headlineTotal: "21.90",
  headlineBasis: "PRECO_VAREJO",
  payload: { schemaVersion: 1, kind: "SINGLE", modelVersion: "3.1.0" },
};

const SERVER_ROW = {
  id: "s1",
  clientSnapshotId: "srv-1",
  kind: "SINGLE",
  label: "Sincronizado",
  quoteValidityDays: null,
  deviceQuotedAt: "2026-07-10T10:00:00Z",
  deviceUtcOffsetMinutes: -180,
  modelVersion: "3.1.0",
  payloadSchemaVersion: 1,
  payload: {},
  headlineTotal: "10.00",
  headlineBasis: "PRECO_VAREJO",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  idbStore.clear();
  // `clearAllMocks` clears CALLS but not IMPLEMENTATIONS — a test that made get/set reject would
  // otherwise poison every test after it. Restore the store-backed defaults each time.
  vi.mocked(idbGet).mockImplementation(async (k) => idbStore.get(k as string));
  vi.mocked(idbSet).mockImplementation(async (k, v) => {
    idbStore.set(k as string, v);
  });
  // A paused mutation never settles, so a failing offline test would otherwise leave the online
  // manager off and poison every test after it.
  onlineManager.setOnline(true);
  // Default: no server (each useHistory test overrides as needed).
  listHistory.mockRejectedValue({ status: 0 });
  useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

describe("useRecordSnapshot — durable first, then send", () => {
  it("records and syncs when the server answers", async () => {
    postSnapshot.mockResolvedValue({ status: 201, data: { id: "s1" } });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    const outcome = await result.current.mutateAsync(BODY);

    expect(outcome.syncState).toBe("synced");
    // The queue is empty — the record lives in the account now, not on the device.
    await expect(listOutbox("u1")).resolves.toEqual([]);
  });

  it("posts EXACTLY the body it queued — never a re-derived one", async () => {
    postSnapshot.mockResolvedValue({ status: 201, data: { id: "s1" } });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    await result.current.mutateAsync(BODY);

    expect(postSnapshot).toHaveBeenCalledWith(BODY);
  });

  it("OFFLINE: the record is kept and reported as pending — never as saved, never as failed", async () => {
    postSnapshot.mockRejectedValue({ status: 0 });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    const outcome = await result.current.mutateAsync(BODY);

    expect(outcome.syncState).toBe("pending");
    const queued = await listOutbox("u1");
    expect(queued).toHaveLength(1);
    expect(queued[0]?.body).toEqual(BODY);
  });

  it("a 403 at sync reports BLOCKED and keeps the record on the device", async () => {
    postSnapshot.mockRejectedValue({ status: 403, code: "ENTITLEMENT_REQUIRED" });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    const outcome = await result.current.mutateAsync(BODY);

    expect(outcome.syncState).toBe("blocked");
    await expect(listOutbox("u1")).resolves.toHaveLength(1);
  });

  it("FAILS LOUDLY when the device cannot store the record — no fake 'pendente'", async () => {
    vi.mocked(idbSet).mockRejectedValueOnce(new Error("QuotaExceeded"));
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    await expect(result.current.mutateAsync(BODY)).rejects.toThrow();
    // And nothing was sent — a record that could not be kept was never claimed to exist.
    expect(postSnapshot).not.toHaveBeenCalled();
  });

  it("refuses to record without a signed-in account (the queue is uid-keyed)", async () => {
    useSessionStore.setState({ status: "anonymous", user: null });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    await expect(result.current.mutateAsync(BODY)).rejects.toThrow();
  });
});

describe("OFFLINE (T016/B1 regression — the blocker the visual homologation found)", () => {
  it("records while `navigator.onLine === false` — the whole point of the queue", async () => {
    // TanStack Query's DEFAULT `networkMode: "online"` PAUSES a mutation when the browser reports
    // offline: `mutationFn` never runs. Which means `enqueueSnapshot` never runs either — so
    // offline, the seller tapped "Salvar", nothing happened, and a reload lost the quote FOREVER.
    //
    // The durability this feature exists for is DEVICE-first (ADR-0018 §1): the record must reach
    // IndexedDB whether or not there is a network. Waiting for connectivity to even *try* is the
    // one behaviour the outbox was built to replace — and ADR-0018 explicitly REJECTED the paused-
    // mutation option, which we then inherited by omission.
    onlineManager.setOnline(false);
    postSnapshot.mockRejectedValue({ status: 0 });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    try {
      // With the default network mode this promise never settles — the mutation is PAUSED, so the
      // assertion below times out rather than failing loudly. That timeout IS the bug.
      const outcome = await result.current.mutateAsync(BODY);

      expect(outcome.syncState).toBe("pending");
      const queued = await listOutbox("u1");
      expect(queued).toHaveLength(1);
      expect(queued[0]?.body).toEqual(BODY);
    } finally {
      onlineManager.setOnline(true);
    }
  }, 3000);
});

describe("the drain is idempotent by construction", () => {
  it("a replayed body is accepted (200) and leaves no duplicate behind", async () => {
    // The server answers 200 with the row it already created (ON CONFLICT DO NOTHING + read-back).
    postSnapshot.mockResolvedValue({ status: 200, data: { id: "s1" } });
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    const first = await result.current.mutateAsync(BODY);
    const second = await result.current.mutateAsync(BODY);

    expect(first.syncState).toBe("synced");
    expect(second.syncState).toBe("synced");
    await expect(listOutbox("u1")).resolves.toEqual([]);
  });
});

describe("waitFor keeps the mutation state honest", () => {
  it("exposes the failure so the surface can say it did NOT record", async () => {
    vi.mocked(idbSet).mockRejectedValue(new Error("QuotaExceeded"));
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    result.current.mutate(BODY);

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("M1 — never a false 'salvo' when the send cannot be confirmed (review PR-A)", () => {
  it("a read glitch FAILS the record instead of reporting a pendente that does not exist", async () => {
    // EXPECTATION CHANGED BY 014/T109 (SC-816), and the change makes this guard stronger.
    //
    // Before: `enqueueSnapshot` read through `listOutbox`, which swallows a read error and answers
    // `[]`. The write then went ahead on that empty base — so THIS entry really was stored (and
    // every other pending snapshot was erased). "pending" was therefore true about this record and
    // false about the queue, and the fixture had no siblings to reveal it.
    //
    // Now the read propagates, the write is aborted, and NOTHING is stored. "pending" would be the
    // lie this time — there is nothing pending. The describe's guard ("never a false salvo") holds
    // exactly as before and now covers a false *pendente* too: the record action reports failure,
    // which is what `enqueueSnapshot` has always documented ("tell the seller it did NOT queue,
    // rather than show 'pendente' over nothing").
    postSnapshot.mockResolvedValue({ status: 201, data: { id: "s1" } });
    vi.mocked(idbGet).mockRejectedValue(new Error("read glitch"));
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    await expect(result.current.mutateAsync(BODY)).rejects.toThrow();

    // Still the original assertion: nothing was sent, so "salvo" would be a pure lie.
    expect(postSnapshot).not.toHaveBeenCalled();
    // And the new one: the queue was never rebased on an empty read.
    expect(vi.mocked(idbSet)).not.toHaveBeenCalled();
  });
});

describe("M6 — a failed refetch never walls over the list already on screen (review PR-A)", () => {
  it("serves the RETAINED rows and flags STALE, not isError", async () => {
    listHistory.mockResolvedValueOnce({ status: 200, data: { items: [SERVER_ROW] } });
    const { result } = renderHook(() => useHistory(), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    // The background refetch fails — TanStack RETAINS the last good `query.data`.
    listHistory.mockRejectedValue({ status: 500 });
    result.current.refetch();

    await waitFor(() => expect(result.current.stale).toBe(true));
    // The wall must NOT render over rows the seller already holds.
    expect(result.current.isError).toBe(false);
    expect(result.current.items).toHaveLength(1);
  });
});

describe("T022 — LAZY keyset pagination ([Carregar mais]), no silent cap", () => {
  it("loads only the first page, then fetches the next on loadMore()", async () => {
    const row = (csid: string) => ({ ...SERVER_ROW, id: csid, clientSnapshotId: csid });
    // PR-A walked every page eagerly (so the detail resolved via the list). PR-B loads lazily — one
    // page at a time — and the detail now resolves by clientSnapshotId (useSnapshot), so the eager
    // walk is no longer needed. A page size is still NOT a cap: [Carregar mais] reaches every row.
    listHistory
      .mockResolvedValueOnce({ status: 200, data: { items: [row("a")], nextCursor: "cur1" } })
      .mockResolvedValueOnce({ status: 200, data: { items: [row("b")], nextCursor: null } });

    const { result } = renderHook(() => useHistory(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1)); // FIRST page only
    expect(result.current.hasMore).toBe(true);
    expect(result.current.items[0]?.clientSnapshotId).toBe("a");

    result.current.loadMore();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false); // the tail reached the device, no cap
    expect(listHistory).toHaveBeenNthCalledWith(2, { cursor: "cur1" });
  });
});

describe("US6 — server-side filters + the outbox is NEVER filtered out (ux §2.6)", () => {
  it("passes the label search and the period straight to the server", async () => {
    listHistory.mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    renderHook(() => useHistory({ q: "João", from: "2026-07-01T00:00:00Z" }), { wrapper });

    await waitFor(() => expect(listHistory).toHaveBeenCalled());
    expect(listHistory).toHaveBeenCalledWith({ q: "João", from: "2026-07-01T00:00:00Z" });
  });

  it("a pending record still shows under an active filter — an unsynced quote never disappears", async () => {
    listHistory.mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    idbStore.set("history:outbox:u1", [
      { clientSnapshotId: "csid-off", body: BODY, syncState: "pending", attempts: 0 },
    ]);
    const { result } = renderHook(() => useHistory({ q: "nothing-matches-this" }), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]?.syncState).toBe("pending");
  });
});

describe("useSnapshot — resolve ONE record by clientSnapshotId (lazy-safe detail)", () => {
  it("fetches the row by exact clientSnapshotId — a deep link need not be on the first page", async () => {
    listHistory.mockResolvedValue({
      status: 200,
      data: { items: [{ ...SERVER_ROW, clientSnapshotId: "deep" }], nextCursor: null },
    });
    const { result } = renderHook(() => useSnapshot("deep"), { wrapper });

    await waitFor(() => expect(result.current.item).not.toBeNull());
    expect(result.current.item?.clientSnapshotId).toBe("deep");
    expect(listHistory).toHaveBeenCalledWith({ clientSnapshotId: "deep" });
  });

  it("resolves a PENDING record from the outbox even with no server row (detail opens while pending)", async () => {
    listHistory.mockResolvedValue({ status: 200, data: { items: [], nextCursor: null } });
    idbStore.set("history:outbox:u1", [
      { clientSnapshotId: "csid-1", body: BODY, syncState: "pending", attempts: 0 },
    ]);
    const { result } = renderHook(() => useSnapshot("csid-1"), { wrapper });

    await waitFor(() => expect(result.current.item?.syncState).toBe("pending"));
  });

  it("an AUTHORITATIVE server 'gone' overrides a stale device-cache row — a deleted snapshot is not shown as live", async () => {
    // The two-shelf lie in reverse (review PR-B, confirmed major, use-history.ts:320). The offline
    // cache is a fallback ONLY while the server has not answered yet; once the server settles to
    // `null` (the record was soft-deleted from another device), the cache must NOT resurrect it. We
    // hold the server answer back so the cache loads first (the row IS a live fallback while offline),
    // then let the server answer "gone" and assert the row disappears — not a stale live detail, and
    // NOT the cold-load-error wall (`isError === false`): the honest state is "não encontrado".
    let answerServer!: (v: unknown) => void;
    listHistory.mockReturnValue(
      new Promise((resolve) => {
        answerServer = resolve;
      }),
    );
    idbStore.set("history:snapshots:u1", [
      { ...SERVER_ROW, id: "cached-del", clientSnapshotId: "deleted-1" },
    ]);
    const { result } = renderHook(() => useSnapshot("deleted-1"), { wrapper });

    // 1) server unanswered ⇒ the cached row is a live fallback (offline read still opens the detail).
    await waitFor(() => expect(result.current.item?.clientSnapshotId).toBe("deleted-1"));

    // 2) the server authoritatively says the record is gone.
    answerServer({ status: 200, data: { items: [], nextCursor: null } });

    await waitFor(() => expect(result.current.item).toBeNull());
    expect(result.current.isError).toBe(false);
  });
});

describe("useSyncOutbox invalidates the detail query too (018 master-detail regression)", () => {
  it("a reconnect drain that syncs THIS entry un-sticks a detail query that had errored while offline", async () => {
    // The 018 master-detail auto-opens the first record next to the list (`historico-page.tsx`), so
    // `useSnapshot`'s own query can already be mounted, offline, and settled to a REAL network error
    // (`retry: false`) before the seller ever reconnects. `useRecordSnapshot` invalidates the detail
    // prefix on settle; the RECONNECT drain (`useSyncOutbox`, fired by `OutboxSyncer`'s `online`
    // listener) is a SEPARATE mutation that used to invalidate only the list + the outbox — never the
    // detail — so a query that errored offline stayed stuck showing "Não foi possível carregar seus
    // orçamentos." forever, even after the very record it was trying to show had synced.
    idbStore.set("history:outbox:u1", [
      { clientSnapshotId: "csid-1", body: BODY, syncState: "pending", attempts: 0 },
    ]);
    // The detail query fails for real while the entry is still only in the outbox (offline).
    listHistory.mockRejectedValue({ status: 0 });

    const { result } = renderHook(
      () => ({ snap: useSnapshot("csid-1"), outbox: useSyncOutbox() }),
      { wrapper },
    );

    // Item still resolves — from the OUTBOX — even though the server query errored.
    await waitFor(() => expect(result.current.snap.item?.syncState).toBe("pending"));
    expect(result.current.snap.isError).toBe(false);

    // Reconnect: the entry syncs, and the server can now answer for it.
    postSnapshot.mockResolvedValue({ status: 201, data: { id: "s1" } });
    listHistory.mockResolvedValue({
      status: 200,
      data: { items: [{ ...SERVER_ROW, clientSnapshotId: "csid-1" }], nextCursor: null },
    });

    await result.current.outbox.sync();
    await waitFor(async () => expect(await listOutbox("u1")).toHaveLength(0));

    // Without invalidating the detail prefix, `snap.item` stays whatever the stale query/outbox
    // union last computed (null, with `isError` still true) — a record the seller can no longer
    // reach, even though it is, by now, safely on the server.
    await waitFor(() => expect(result.current.snap.item?.syncState).toBe("synced"));
    expect(result.current.snap.isError).toBe(false);
  });
});

describe("useUpdateLabel / useDeleteSnapshot — the ONLY mutations of a synced record", () => {
  it("PATCHes the label by SERVER id (contents stay immutable — only the label moves)", async () => {
    patchLabel.mockResolvedValue({ status: 200, data: { ...SERVER_ROW, label: "Novo" } });
    const { result } = renderHook(() => useUpdateLabel(), { wrapper });

    await result.current.mutateAsync({ id: "s1", label: "Novo" });
    expect(patchLabel).toHaveBeenCalledWith("s1", { label: "Novo" });
  });

  it("DELETEs by SERVER id (soft-delete)", async () => {
    deleteSnap.mockResolvedValue({ status: 204 });
    const { result } = renderHook(() => useDeleteSnapshot(), { wrapper });

    await result.current.mutateAsync("s1");
    expect(deleteSnap).toHaveBeenCalledWith("s1");
  });
});

describe("B1 read regression — a pending record is visible OFFLINE (review PR-A)", () => {
  it("shows a queued entry while `navigator.onLine === false` — a LOCAL read never depends on the network", async () => {
    // `useOutboxQuery` reads the DEVICE's own IndexedDB. TanStack's default `networkMode: "online"`
    // PAUSES it the instant the browser goes offline: it reports its `initialData: []` and the
    // seller's own queued quote vanishes from the Histórico — the very scenario (the fair) this
    // feature exists for. A local read must run REGARDLESS of connectivity (`networkMode: "always"`).
    onlineManager.setOnline(false);
    idbStore.set("history:outbox:u1", [
      { clientSnapshotId: "csid-off", body: BODY, syncState: "pending", attempts: 0 },
    ]);
    const { result } = renderHook(() => useHistory(), { wrapper });

    try {
      // With the default network mode the outbox query is paused, so this stays 0 and times out.
      await waitFor(() => expect(result.current.items).toHaveLength(1));
      expect(result.current.items[0]?.syncState).toBe("pending");
    } finally {
      onlineManager.setOnline(true);
    }
  }, 3000);
});
