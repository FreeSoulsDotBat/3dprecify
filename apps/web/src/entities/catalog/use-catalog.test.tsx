// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no IndexedDB and we never touch the real network, so mock BOTH seams (idb-keyval +
// the generated catalog client). The impls are created via vi.hoisted (the factory runs before
// module init) and reconfigured per test — the exact pattern the fee-catalog store test uses.
const {
  idbGet,
  idbSet,
  idbDel,
  listFilamentsMock,
  createFilamentMock,
  updateFilamentMock,
  deleteFilamentMock,
  listPrintersMock,
  listProductsMock,
  updateProductMock,
  deleteProductMock,
} = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  idbDel: vi.fn(),
  listFilamentsMock: vi.fn(),
  createFilamentMock: vi.fn(),
  updateFilamentMock: vi.fn(),
  deleteFilamentMock: vi.fn(),
  listPrintersMock: vi.fn(),
  listProductsMock: vi.fn(),
  updateProductMock: vi.fn(),
  deleteProductMock: vi.fn(),
}));
vi.mock("idb-keyval", () => ({ get: idbGet, set: idbSet, del: idbDel }));
vi.mock("@/shared/api/generated", () => ({
  listFilamentsApiV1FilamentsGet: listFilamentsMock,
  createFilamentApiV1FilamentsPost: createFilamentMock,
  updateFilamentApiV1FilamentsFilamentIdPut: updateFilamentMock,
  deleteFilamentApiV1FilamentsFilamentIdDelete: deleteFilamentMock,
  listPrintersApiV1PrintersGet: listPrintersMock,
  createPrinterApiV1PrintersPost: vi.fn(),
  updatePrinterApiV1PrintersPrinterIdPut: vi.fn(),
  deletePrinterApiV1PrintersPrinterIdDelete: vi.fn(),
  listProductsApiV1ProductsGet: listProductsMock,
  createProductApiV1ProductsPost: vi.fn(),
  updateProductApiV1ProductsProductIdPut: updateProductMock,
  deleteProductApiV1ProductsProductIdDelete: deleteProductMock,
}));

import type { FilamentOut } from "@/shared/api/generated";
import { useSessionStore } from "@/shared/session/session-store";

import {
  catalogIdbKey,
  catalogQueryKey,
  loadCachedCatalog,
  persistCachedCatalog,
  purgeCatalogCache,
} from "./catalog-cache";
import { useCreateFilament, useDeleteProduct, useFilaments, useUpdateProduct } from "./use-catalog";

function filament(over: Partial<FilamentOut> = {}): FilamentOut {
  return {
    id: "f1",
    name: "PLA Azul",
    material: "PLA",
    costPerRoll: "110.00",
    rollWeightKg: "1",
    defaultWasteGrams: "0",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
    ...over,
  };
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
  listFilamentsMock.mockReset().mockResolvedValue({ data: [], status: 200 });
  createFilamentMock.mockReset();
  updateFilamentMock.mockReset();
  deleteFilamentMock.mockReset();
  listPrintersMock.mockReset().mockResolvedValue({ data: [], status: 200 });
  listProductsMock.mockReset().mockResolvedValue({ data: [], status: 200 });
  updateProductMock.mockReset();
  deleteProductMock.mockReset();
  signInAs("uidA");
});

// Todo `QueryClient` criado no arquivo passa por aqui, e o `afterEach` os encerra.
//
// Sem isso o arquivo VAZAVA trabalho assincrono para depois do teardown: nenhum cliente era
// cancelado nem desmontado, entao uma consulta ainda em voo resolvia quando o vitest ja tinha
// derrubado o jsdom — e o efeito do React ia procurar `window` num ambiente que nao existe mais.
// Sintoma na CI: `ReferenceError: window is not defined` x3 (um por cliente vazado), com os 107
// arquivos PASSANDO e o processo saindo 1 — o vitest reprova a execucao por erro nao tratado ainda
// que nenhuma asserção tenha falhado. Nao reproduz isolado: o arquivo termina antes de a corrida
// acontecer, e foi por isso que o gate local passou duas vezes.
const clientes: QueryClient[] = [];
function novoCliente() {
  const c = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clientes.push(c);
  return c;
}

afterEach(async () => {
  // Cancelar ANTES de limpar: `clear()` descarta o cache mas nao aborta o que esta em voo.
  await Promise.all(clientes.map((c) => c.cancelQueries()));
  for (const c of clientes) {
    c.unmount();
    c.clear();
  }
  clientes.length = 0;
  cleanup();
  vi.clearAllMocks();
  useSessionStore.setState({ status: "anonymous", user: null });
});

function wrapper() {
  const client = novoCliente();
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("catalog-cache — uid-keyed keys (FR-309 identity isolation)", () => {
  it("carries the uid in BOTH the IndexedDB key and the query key", () => {
    expect(catalogIdbKey("filaments", "uidA")).toBe("catalog:filaments:uidA");
    expect(catalogIdbKey("printers", "uidB")).toBe("catalog:printers:uidB");
    expect(catalogQueryKey("filaments", "uidA")).toEqual(["catalog", "filaments", "uidA"]);
    expect(catalogQueryKey("filaments", "uidB")).not.toEqual(catalogQueryKey("filaments", "uidA"));
  });

  it("account B never reads account A's cached items on the same device", async () => {
    await persistCachedCatalog("filaments", "uidA", [filament()]);
    expect(await loadCachedCatalog("filaments", "uidB")).toBeNull();
    expect((await loadCachedCatalog<FilamentOut>("filaments", "uidA"))?.[0]?.name).toBe("PLA Azul");
  });

  it("rejects a corrupt cache payload (never a broken list)", async () => {
    store.set(catalogIdbKey("filaments", "uidA"), { not: "an array" });
    expect(await loadCachedCatalog("filaments", "uidA")).toBeNull();
  });
});

describe("purgeCatalogCache — the sign-out privacy sweep (Q2/FR-309)", () => {
  it("deletes BOTH resource caches for the signed-out uid, leaving other accounts intact", async () => {
    await persistCachedCatalog("filaments", "uidA", [filament()]);
    await persistCachedCatalog("printers", "uidA", []);
    await persistCachedCatalog("filaments", "uidB", [filament({ id: "b1", name: "B roll" })]);

    await purgeCatalogCache("uidA");

    expect(await loadCachedCatalog("filaments", "uidA")).toBeNull();
    expect(await loadCachedCatalog("printers", "uidA")).toBeNull();
    // A different account's device cache is untouched.
    expect((await loadCachedCatalog<FilamentOut>("filaments", "uidB"))?.[0]?.name).toBe("B roll");
  });
});

describe("useFilaments — uid-keyed read cache + honest staleness", () => {
  it("adopts + persists the fresh online read under the uid key", async () => {
    store.set(catalogIdbKey("filaments", "uidA"), [filament()]);
    listFilamentsMock.mockResolvedValue({
      data: [filament(), filament({ id: "f2", name: "PETG Preto", material: "PETG" })],
      status: 200,
    });

    const { result } = renderHook(() => useFilaments(), { wrapper: wrapper() });

    // The fresh online read is adopted (cache→network race resolves to the server's truth)…
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.stale).toBe(false);
    // …and persisted back under the uid key (offline read after load, R5).
    await waitFor(() =>
      expect(idbSet).toHaveBeenCalledWith(catalogIdbKey("filaments", "uidA"), expect.any(Array)),
    );
  });

  it("serves the cache and flags stale when the online read fails (offline read, Q2)", async () => {
    store.set(catalogIdbKey("filaments", "uidA"), [filament()]);
    listFilamentsMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useFilaments(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.stale).toBe(true));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.name).toBe("PLA Azul");
  });

  it("does NOT surface account A's cache after switching to account B", async () => {
    store.set(catalogIdbKey("filaments", "uidA"), [filament()]);
    // The server answers per account (the uid rides the token): A has one roll, B has none.
    listFilamentsMock.mockImplementation(async () => {
      const uid = useSessionStore.getState().user?.uid;
      return { data: uid === "uidA" ? [filament()] : [], status: 200 };
    });

    const { result, rerender } = renderHook(() => useFilaments(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    // Re-login as a DIFFERENT account with no device cache → the previous account's items vanish.
    signInAs("uidB");
    rerender();
    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(result.current.items.find((f) => f.name === "PLA Azul")).toBeUndefined();
  });
});

describe("useCreateFilament — online-only write that invalidates the query", () => {
  it("posts through the generated client and invalidates the filament query on success", async () => {
    const client = novoCliente();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    createFilamentMock.mockResolvedValue({ data: filament(), status: 201 });

    const { result } = renderHook(() => useCreateFilament(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    const created = await result.current.mutateAsync({
      name: "PLA Azul",
      material: "PLA",
      costPerRoll: "110",
      rollWeightKg: "1",
    });

    expect(created.name).toBe("PLA Azul");
    expect(createFilamentMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: catalogQueryKey("filaments", "uidA") }),
    );
  });
});

// PR-C freshness fix (homologation blocker): a product write that an existing kit could be
// resolving through MUST invalidate the KITS list too, or a reopened kit keeps serving the old
// product — stale values after an edit (D3), or a deleted product shown as LIVE after a delete
// (D6). The kits key is a deliberate literal mirror of entities/bom `bomQueryKey`; these tests pin
// BOTH invalidations against the SAME literal so the mirror can never drift.
describe("product update/delete — invalidates the kits list too (D3/D6 freshness)", () => {
  function productWrapper() {
    const client = novoCliente();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { invalidate, Wrapper };
  }

  it("useDeleteProduct invalidates BOTH the products and the kits query", async () => {
    const { invalidate, Wrapper } = productWrapper();
    deleteProductMock.mockResolvedValue({ data: undefined, status: 204 });

    const { result } = renderHook(() => useDeleteProduct(), { wrapper: Wrapper });
    await result.current.mutateAsync("p1");

    expect(deleteProductMock).toHaveBeenCalledWith("p1");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: catalogQueryKey("products", "uidA") }),
    );
    // The blocker fix: the kits list refetches so a referencing line degrades honestly.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["boms", "uidA"] });
  });

  it("useUpdateProduct invalidates BOTH the products and the kits query", async () => {
    const { invalidate, Wrapper } = productWrapper();
    updateProductMock.mockResolvedValue({ data: { id: "p1", name: "Base" }, status: 200 });

    const { result } = renderHook(() => useUpdateProduct(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: "p1", body: {} as never });

    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({ queryKey: catalogQueryKey("products", "uidA") }),
    );
    // D3 live-reflect: an edited product changes a referencing kit's resolved values on reopen.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["boms", "uidA"] });
  });
});
