import { describe, it, expect, vi, beforeEach } from "vitest";

// jsdom has no IndexedDB and we don't want a real network call, so mock both seams. The impls are
// created via vi.hoisted (the mock factory runs before module init) and reconfigured per test.
const { idbGet, idbSet, apiFetchMock } = vi.hoisted(() => ({
  idbGet: vi.fn(),
  idbSet: vi.fn(),
  apiFetchMock: vi.fn(),
}));
vi.mock("idb-keyval", () => ({ get: idbGet, set: idbSet }));
vi.mock("@/shared/api/transport", () => ({ apiFetch: apiFetchMock }));

import type { FeeCatalog } from "./fee-catalog";
import { FEE_CATALOG_SEED } from "./seed";
import {
  FEE_CATALOG_STORE_KEY,
  fetchServedCatalog,
  freshest,
  loadPersistedCatalog,
  persistCatalog,
} from "./use-fee-catalog";

const newer: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-08-01.0" };
const store = new Map<string, unknown>();

beforeEach(() => {
  store.clear();
  idbGet.mockReset().mockImplementation(async (k: string) => store.get(k));
  idbSet.mockReset().mockImplementation(async (k: string, v: unknown) => {
    store.set(k, v);
  });
  apiFetchMock.mockReset().mockImplementation(async () => structuredClone(FEE_CATALOG_SEED));
});

describe("freshest — resolution precedence", () => {
  it("prefers the higher catalogVersion regardless of argument order", () => {
    expect(freshest(newer, FEE_CATALOG_SEED)).toBe(newer);
    expect(freshest(FEE_CATALOG_SEED, newer)).toBe(newer);
  });

  it("keeps the incoming on a version tie (idempotent refresh)", () => {
    expect(freshest(FEE_CATALOG_SEED, FEE_CATALOG_SEED)).toBe(FEE_CATALOG_SEED);
  });

  it("compares the sequence as an INTEGER, not a string — .10 beats .2 (E1-03)", () => {
    const v10: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-07.10" };
    const v2: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-07.2" };
    expect(freshest(v10, v2)).toBe(v10);
    expect(freshest(v2, v10)).toBe(v10);
  });

  // 014/T100 — uma versão que não parseia MUST valer MENOS, e o caso concreto é o sentinel
  // `"invalid-seed"` que o `parseSeedResilient` grava quando a semente empacotada é insalvável.
  //
  // Pela comparação lexicográfica anterior, "invalid-seed" > "2026-07-28.0" (o "i" vence o "2"), e o
  // sentinel é o PISO síncrono do estado. Ou seja: no dia em que a semente do bundle saísse quebrada,
  // o app passaria a recusar PERMANENTEMENTE o catálogo servido e o persistido — os dois caminhos que
  // existem justamente para consertar isso. Um erro de build viraria um app que não aceita conserto.
  it("uma versão ILEGÍVEL nunca vence uma legível — em qualquer ordem", () => {
    const quebrada: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "invalid-seed" };
    const real: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-28.0" };
    expect(freshest(real, quebrada)).toBe(real); // servido chegando por cima da semente quebrada
    expect(freshest(quebrada, real)).toBe(real); // e a quebrada não desbanca a boa que já está lá
  });

  it("vale para qualquer formato irreconhecível, não só para o sentinel", () => {
    const real: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-28.0" };
    for (const lixo of ["zzz", "9999", "2026-13-45.0", ""]) {
      const ilegivel: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: lixo };
      expect(freshest(real, ilegivel)).toBe(real);
      expect(freshest(ilegivel, real)).toBe(real);
    }
  });

  it("duas ilegíveis: mantém a que chega, para o refresh continuar idempotente", () => {
    const a: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "invalid-seed" };
    const b: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "invalid-seed" };
    expect(freshest(a, b)).toBe(a);
  });
});

describe("loadPersistedCatalog (R2 store)", () => {
  it("returns null when nothing is stored (→ the seed answers)", async () => {
    expect(await loadPersistedCatalog()).toBeNull();
  });

  it("returns the validated catalog when one is stored", async () => {
    await persistCatalog(newer);
    const loaded = await loadPersistedCatalog();
    expect(loaded?.catalogVersion).toBe("2026-08-01.0");
  });

  it("returns null (non-blocking) when the store read throws", async () => {
    idbGet.mockImplementationOnce(async () => {
      throw new Error("idb unavailable");
    });
    expect(await loadPersistedCatalog()).toBeNull();
  });

  it("returns null when the stored value fails schema validation (never a bad catalog)", async () => {
    store.set(FEE_CATALOG_STORE_KEY, { not: "a catalog" });
    expect(await loadPersistedCatalog()).toBeNull();
  });
});

describe("persistCatalog (best-effort cache write)", () => {
  it("writes the catalog to the store", async () => {
    await persistCatalog(newer);
    expect(store.get(FEE_CATALOG_STORE_KEY)).toBeTruthy();
  });

  it("swallows a write failure (the cache is not a source of truth)", async () => {
    idbSet.mockImplementationOnce(async () => {
      throw new Error("quota exceeded");
    });
    await expect(persistCatalog(newer)).resolves.toBeUndefined();
  });
});

describe("fetchServedCatalog (schema-guarded refresh)", () => {
  it("fetches and validates the served payload", async () => {
    const c = await fetchServedCatalog();
    expect(c.schemaVersion).toBe(FEE_CATALOG_SEED.schemaVersion);
  });

  it("rejects an invalid served payload (the wire is re-validated)", async () => {
    apiFetchMock.mockImplementationOnce(async () => ({ bogus: true }));
    await expect(fetchServedCatalog()).rejects.toThrow();
  });
});
