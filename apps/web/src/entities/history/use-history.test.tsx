// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore, postSnapshot } = vi.hoisted(() => ({
  idbStore: new Map<string, unknown>(),
  postSnapshot: vi.fn(),
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
  return { ...actual, recordSnapshotApiV1HistoryPost: postSnapshot };
});

import { set as idbSet } from "idb-keyval";
import type { SnapshotIn } from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import { listOutbox } from "./outbox";
import { useRecordSnapshot } from "./use-history";

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  idbStore.clear();
  // A paused mutation never settles, so a failing offline test would otherwise leave the online
  // manager off and poison every test after it.
  onlineManager.setOnline(true);
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
