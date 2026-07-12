// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no IndexedDB and we never touch the network — mock both seams (idb-keyval + the
// generated kit client), the pattern the catalog/fee-catalog store tests already use.
const { idbGet, idbSet, idbDel, listBomsMock, createBomMock, updateBomMock, deleteBomMock } =
  vi.hoisted(() => ({
    idbGet: vi.fn(),
    idbSet: vi.fn(),
    idbDel: vi.fn(),
    listBomsMock: vi.fn(),
    createBomMock: vi.fn(),
    updateBomMock: vi.fn(),
    deleteBomMock: vi.fn(),
  }));
vi.mock("idb-keyval", () => ({ get: idbGet, set: idbSet, del: idbDel }));
vi.mock("@/shared/api/generated", () => ({
  listBomsApiV1BomsGet: listBomsMock,
  createBomApiV1BomsPost: createBomMock,
  updateBomApiV1BomsBomIdPut: updateBomMock,
  deleteBomApiV1BomsBomIdDelete: deleteBomMock,
}));

import type { BomOut } from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import {
  bomIdbKey,
  bomQueryKey,
  loadCachedBoms,
  persistCachedBoms,
  purgeBomCache,
} from "./bom-cache";
import { useBoms, useCreateBom, useDeleteBom } from "./use-bom";

function kit(over: Partial<BomOut> = {}): BomOut {
  return {
    id: "k1",
    name: "Kit Suporte",
    lines: [],
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    ...over,
  } as BomOut;
}

const store = new Map<string, unknown>();

function signInAs(uid: string) {
  useSessionStore.setState({ status: "authenticated", user: { uid } as never });
}

beforeEach(() => {
  store.clear();
  idbGet.mockReset().mockImplementation(async (k: string) => store.get(k));
  idbSet.mockReset().mockImplementation(async (k: string, v: unknown) => {
    store.set(k, v);
  });
  idbDel.mockReset().mockImplementation(async (k: string) => {
    store.delete(k);
  });
  listBomsMock.mockReset().mockResolvedValue({ data: [], status: 200 });
  createBomMock.mockReset();
  updateBomMock.mockReset();
  deleteBomMock.mockReset();
  signInAs("uidA");
});

afterEach(() => {
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("bom-cache — uid-keyed keys (FR-309 identity isolation)", () => {
  it("carries the uid in BOTH the IndexedDB key and the query key", () => {
    expect(bomIdbKey("uidA")).toBe("boms:uidA");
    expect(bomQueryKey("uidA")).toEqual(["boms", "uidA"]);
    expect(bomQueryKey("uidB")).not.toEqual(bomQueryKey("uidA"));
  });

  it("account B never reads account A's cached kits on the same device", async () => {
    await persistCachedBoms("uidA", [kit()]);
    expect(await loadCachedBoms("uidB")).toBeNull();
    expect((await loadCachedBoms("uidA"))?.[0]?.name).toBe("Kit Suporte");
  });

  it("rejects a corrupt cache payload (never a broken list)", async () => {
    store.set(bomIdbKey("uidA"), { not: "an array" });
    expect(await loadCachedBoms("uidA")).toBeNull();
  });

  it("purge sweeps the signed-out uid's kits, leaving other accounts intact", async () => {
    await persistCachedBoms("uidA", [kit()]);
    await persistCachedBoms("uidB", [kit({ id: "k2", name: "Kit do B" })]);

    await purgeBomCache("uidA");

    expect(await loadCachedBoms("uidA")).toBeNull();
    expect((await loadCachedBoms("uidB"))?.[0]?.name).toBe("Kit do B");
  });
});

describe("useBoms — uid-keyed read cache + honest staleness", () => {
  it("adopts + persists the fresh online read under the uid key", async () => {
    store.set(bomIdbKey("uidA"), [kit()]);
    listBomsMock.mockResolvedValue({
      data: [kit(), kit({ id: "k2", name: "Kit Prateleira" })],
      status: 200,
    });

    const { result } = renderHook(() => useBoms(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.stale).toBe(false);
    await waitFor(() => expect(idbSet).toHaveBeenCalledWith(bomIdbKey("uidA"), expect.any(Array)));
  });

  it("serves the cache and flags stale when the online read fails (offline read)", async () => {
    store.set(bomIdbKey("uidA"), [kit()]);
    listBomsMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useBoms(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.name).toBe("Kit Suporte");
  });

  it("does NOT surface account A's kits after switching to account B", async () => {
    store.set(bomIdbKey("uidA"), [kit()]);
    listBomsMock.mockImplementation(async () => {
      const uid = useSessionStore.getState().user?.uid;
      return { data: uid === "uidA" ? [kit()] : [], status: 200 };
    });

    const { result, rerender } = renderHook(() => useBoms(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    signInAs("uidB");
    rerender();
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(result.current.items.find((k) => k.name === "Kit Suporte")).toBeUndefined();
  });
});

describe("kit writes — online-only, invalidating (never optimistic)", () => {
  it("creates through the generated client and invalidates the kit query", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    createBomMock.mockResolvedValue({ data: kit(), status: 201 });

    const { result } = renderHook(() => useCreateBom(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    const created = await result.current.mutateAsync({ name: "Kit Suporte", lines: [] });

    expect(created.name).toBe("Kit Suporte");
    expect(createBomMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: bomQueryKey("uidA") }));
  });

  it("a kit save ALSO invalidates the product list — it materializes catalog products (ADR-0017)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    createBomMock.mockResolvedValue({ data: kit(), status: 201 });

    const { result } = renderHook(() => useCreateBom(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await result.current.mutateAsync({ name: "Kit Suporte", lines: [] });

    // Without this the catalog would keep showing a stale list that is missing the manual
    // products the save just created — the K4 "criado no catálogo" message would be a lie.
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ["catalog", "products", "uidA"] }),
    );
  });

  it("deletes through the generated client and invalidates", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    deleteBomMock.mockResolvedValue({ status: 204 });

    const { result } = renderHook(() => useDeleteBom(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    await result.current.mutateAsync("k1");

    expect(deleteBomMock).toHaveBeenCalledWith("k1");
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: bomQueryKey("uidA") }));
  });
});
