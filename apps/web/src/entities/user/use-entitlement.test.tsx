// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore, getEntitlement } = vi.hoisted(() => ({
  idbStore: new Map<string, unknown>(),
  getEntitlement: vi.fn(),
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
  return { ...actual, getEntitlementApiV1EntitlementGet: getEntitlement };
});

import { useSessionStore } from "@/shared/session/session-store";

import { useEntitlement } from "./use-entitlement";

// 009/T011b (E4, PR-A) — owner decision 2026-07-13. Written FAILING-first.
//
// The gate stays server-authoritative (Principle IV) — this only changes WHERE the server's last
// answer is kept. Persisted, it survives a cold boot, so a premium seller who opens the app already
// offline can still reach the record action and queue the quote. The server still has the final
// word at sync: a 403 there marks the entry `blocked`, never silently accepted.
//
// The line that must not be crossed: the cache may only ECHO the server. It can never CREATE a
// plan, so a corrupt or forged shape resolves to "no answer", not to premium.

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  idbStore.clear();
  useSessionStore.setState({ status: "authenticated", user: { uid: "u1" } as never });
});

describe("useEntitlement — the server's last word, kept across restarts", () => {
  it("persists the server answer so the next cold boot has one", async () => {
    getEntitlement.mockResolvedValue({ status: 200, data: { status: "active" } });
    const { result } = renderHook(() => useEntitlement(), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("active"));
    await waitFor(() => expect(idbStore.get("entitlement:u1")).toEqual({ status: "active" }));
  });

  it("OFFLINE COLD BOOT: serves the last-known server answer, flagged as stale", async () => {
    idbStore.set("entitlement:u1", { status: "active" });
    getEntitlement.mockRejectedValue({ status: 0 });
    const { result } = renderHook(() => useEntitlement(), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("active"));
    // Honest: this is the LAST answer, not a fresh one. The seller can record; the server still
    // gets the final word when the queue drains.
    await waitFor(() => expect(result.current.stale).toBe(true));
    // And it is not an error — an error would mean "we know nothing", which is not the case.
    expect(result.current.isError).toBe(false);
  });

  it("with NO cached answer and no server, it says it does not know — it never assumes premium", async () => {
    getEntitlement.mockRejectedValue({ status: 0 });
    const { result } = renderHook(() => useEntitlement(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
    expect(result.current.stale).toBe(false);
  });

  it("a fresh server answer WINS over the cache — a lapse is never hidden by a stale 'active'", async () => {
    idbStore.set("entitlement:u1", { status: "active" });
    getEntitlement.mockResolvedValue({ status: 200, data: { status: "lapsed" } });
    const { result } = renderHook(() => useEntitlement(), { wrapper });

    await waitFor(() => expect(result.current.data?.status).toBe("lapsed"));
    expect(result.current.stale).toBe(false);
    await waitFor(() => expect(idbStore.get("entitlement:u1")).toEqual({ status: "lapsed" }));
  });

  it("never reads another account's plan off a shared device", async () => {
    idbStore.set("entitlement:u2", { status: "active" });
    getEntitlement.mockRejectedValue({ status: 0 });
    const { result } = renderHook(() => useEntitlement(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
