// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore, postSnapshot, listHistory } = vi.hoisted(() => ({
  idbStore: new Map<string, unknown>(),
  postSnapshot: vi.fn(),
  listHistory: vi.fn(),
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
  };
});

import { get as idbGet, set as idbSet } from "idb-keyval";
import type { SnapshotIn } from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import { listOutbox } from "./outbox";
import { useHistory, useRecordSnapshot } from "./use-history";

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
  it("reports PENDING (not synced) when the queue read fails after enqueue — and never claims 'saved'", async () => {
    // `listOutbox` swallows read errors and returns [] (its convenience contract). The old record
    // path read "not in the queue ⇒ the server has it" and would toast "Registro salvo" for a
    // record the server NEVER saw. The drain now reports each entry's ACTUAL settle result, so an
    // entry it could not even re-read is `pending`, never a fabricated `synced`.
    postSnapshot.mockResolvedValue({ status: 201, data: { id: "s1" } });
    vi.mocked(idbGet).mockRejectedValue(new Error("read glitch"));
    const { result } = renderHook(() => useRecordSnapshot(), { wrapper });

    const outcome = await result.current.mutateAsync(BODY);

    expect(outcome.syncState).toBe("pending");
    expect(outcome.syncState).not.toBe("synced");
    // The drain never reached the entry, so nothing was even sent — "salvo" would be a pure lie.
    expect(postSnapshot).not.toHaveBeenCalled();
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

describe("M3 — the client follows the keyset cursor to exhaustion (review PR-A)", () => {
  it("walks every page so the TAIL of the history reaches the device", async () => {
    const row = (csid: string) => ({ ...SERVER_ROW, id: csid, clientSnapshotId: csid });
    // The server pages to avoid a silent cap; a single un-paged fetch would show only the first
    // page and lose the rest — and a detail opened for an unfetched record would falsely read
    // "não encontrado". The client must walk `nextCursor` until it is null.
    listHistory
      .mockResolvedValueOnce({ status: 200, data: { items: [row("a")], nextCursor: "cur1" } })
      .mockResolvedValueOnce({ status: 200, data: { items: [row("b")], nextCursor: null } });

    const { result } = renderHook(() => useHistory(), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((i) => i.clientSnapshotId).sort()).toEqual(["a", "b"]);
    // The second call carried the cursor the first page handed back.
    expect(listHistory).toHaveBeenNthCalledWith(2, { cursor: "cur1" });
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
