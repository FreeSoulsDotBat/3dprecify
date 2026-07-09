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
