// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
