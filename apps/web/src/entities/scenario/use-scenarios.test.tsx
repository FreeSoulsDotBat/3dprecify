// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { idbStore, listScenarios, createScenario } = vi.hoisted(() => ({
  idbStore: new Map<string, unknown>(),
  listScenarios: vi.fn(),
  createScenario: vi.fn(),
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
    listScenariosApiV1ScenariosGet: listScenarios,
    createScenarioApiV1ScenariosPost: createScenario,
  };
});

import { ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import { loadCachedScenarios, purgeScenarioCache, scenarioIdbKey } from "./scenario-cache";
import { useCreateScenario, useScenarios } from "./use-scenarios";

// 010/T012 (E5, PR-A US2) — written FAILING-first (the module did not exist).
//
// The list is (server list) ∪ (uid-keyed offline READ cache), purged on sign-out — same substrate as
// the catalog/history read hooks. The ONE deliberate contrast with the history entity next door
// (VR-612/FR-613): there is NO outbox here. A create attempted offline must FAIL HONESTLY — no
// pending state, no silent drop, no fake success — never queued for a later retry.

const ROW = {
  id: "s1",
  name: "ML Clássico × Shopee",
  note: "Comparação pré-Black Friday",
  config: { schemaVersion: 1 },
  createdAt: "2026-07-19T10:00:00Z",
  updatedAt: "2026-07-19T10:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function signInAs(uid: string) {
  useSessionStore.setState({ status: "authenticated", user: { uid } as never });
}

beforeEach(() => {
  idbStore.clear();
  listScenarios.mockReset().mockResolvedValue({ status: 200, data: { items: [ROW] } });
  createScenario.mockReset();
  onlineManager.setOnline(true);
  signInAs("uidA");
});

afterEach(() => {
  cleanup(); // unmount every rendered hook — a leftover mount would keep refetching/writing idb
  vi.clearAllMocks();
  onlineManager.setOnline(true);
  useSessionStore.setState({ status: "anonymous", user: null });
});

describe("useScenarios — the union (server list ∪ uid-keyed offline cache)", () => {
  it("reads the server list and persists it under the uid key for offline reuse", async () => {
    const { result } = renderHook(() => useScenarios(), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0]?.name).toBe(ROW.name);
    await waitFor(async () => {
      expect(await loadCachedScenarios("uidA")).toEqual([ROW]);
    });
  });

  it("pre-fills from the device cache, then serves it OFFLINE with an honest `stale` flag", async () => {
    idbStore.set(scenarioIdbKey("uidA"), [ROW]);
    onlineManager.setOnline(false);
    listScenarios.mockRejectedValue(
      new ApiError({ status: 0, code: "UNKNOWN", message: "offline", correlationId: null }),
    );

    const { result } = renderHook(() => useScenarios(), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.stale).toBe(true);
    expect(result.current.isError).toBe(false); // NEVER a cold-error wall over data we already hold
  });

  it("a cold failure (nothing cached, nothing served) is an honest isError, not a broken empty list", async () => {
    // A real SERVER refusal (never a fabricated offline transition on the shared onlineManager
    // singleton, which the preceding offline test also toggles — deterministic either way).
    listScenarios.mockRejectedValue(
      new ApiError({ status: 500, code: "INTERNAL", message: "boom", correlationId: null }),
    );

    const { result } = renderHook(() => useScenarios(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(result.current.items).toEqual([]);
  });

  it("account B never reads account A's cached scenarios on a shared device", async () => {
    idbStore.set(scenarioIdbKey("uidA"), [ROW]);
    expect(await loadCachedScenarios("uidB")).toBeNull();
    expect((await loadCachedScenarios("uidA"))?.[0]?.id).toBe("s1");
  });
});

describe("purgeScenarioCache — the sign-out privacy sweep", () => {
  it("deletes the signed-out uid's cache, leaving other accounts intact", async () => {
    idbStore.set(scenarioIdbKey("uidA"), [ROW]);
    idbStore.set(scenarioIdbKey("uidB"), [{ ...ROW, id: "s2" }]);
    await purgeScenarioCache("uidA");
    expect(await loadCachedScenarios("uidA")).toBeNull();
    expect(await loadCachedScenarios("uidB")).not.toBeNull();
  });
});

describe("useCreateScenario — ONLINE-ONLY, no outbox (VR-612/FR-613)", () => {
  it("a real 2xx resolves with the server row", async () => {
    createScenario.mockResolvedValue({ status: 201, data: ROW });
    const { result } = renderHook(() => useCreateScenario(), { wrapper });
    const saved = await result.current.mutateAsync({ name: "x", config: {} });
    expect(saved).toEqual(ROW);
  });

  it("attempted OFFLINE, the write FAILS HONESTLY — no pending state, no queue, nothing persisted", async () => {
    onlineManager.setOnline(false);
    createScenario.mockRejectedValue(
      new ApiError({ status: 0, code: "UNKNOWN", message: "offline", correlationId: null }),
    );
    const { result } = renderHook(() => useCreateScenario(), { wrapper });

    await expect(result.current.mutateAsync({ name: "x", config: {} })).rejects.toThrow();
    // The mutation actually RAN (networkMode: "always") and REJECTED — it never sat "pending"
    // forever the way the default networkMode would have paused it.
    expect(createScenario).toHaveBeenCalledTimes(1);
    expect(idbStore.size).toBe(0); // nothing was queued to IndexedDB — there is no outbox to queue to
  });

  it("a denied write (e.g. a lapsed/coded 403) also surfaces honestly, never a silent success", async () => {
    createScenario.mockRejectedValue(
      new ApiError({
        status: 403,
        code: "ENTITLEMENT_REQUIRED",
        message: "denied",
        correlationId: null,
      }),
    );
    const { result } = renderHook(() => useCreateScenario(), { wrapper });
    await expect(result.current.mutateAsync({ name: "x", config: {} })).rejects.toThrow();
  });
});
