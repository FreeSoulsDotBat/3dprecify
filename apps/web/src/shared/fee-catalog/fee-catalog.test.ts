import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  type FeeCatalog,
  feeCatalogSchema,
  feeEntrySchema,
  isStale,
  parseFeeCatalog,
  resolveEntry,
  SCHEMA_VERSION,
  STALENESS_DAYS,
} from "./fee-catalog";
import { FEE_CATALOG_SEED } from "./seed";

// Truth-gate (T009 / Constitution II): the served artifact AND the bundled seed MUST parse under the
// current schema, agree on schemaVersion, and every curated entry MUST carry provenance
// (sourceUrl/effectiveDate/lastReviewed) — a fabricated/unsourced entry fails the build. A4 carve-out:
// the ML freight ESTIMATE.defaultSubsidy is a labelled estimate (its thresholdPrice IS sourced) and is
// exempt from the per-field provenance gate; entry-level provenance still applies.

const catalogPath = fileURLToPath(
  new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
);
const servedCatalog: unknown = JSON.parse(readFileSync(catalogPath, "utf8"));

describe("fee-catalog truth-gate (served artifact + seed)", () => {
  it("the committed backend/app/data/catalog.json parses under the schema", () => {
    expect(() => parseFeeCatalog(servedCatalog)).not.toThrow();
  });

  it("the bundled seed parses under the schema", () => {
    expect(() => parseFeeCatalog(FEE_CATALOG_SEED)).not.toThrow();
  });

  it("served artifact and seed agree on schemaVersion (= SCHEMA_VERSION)", () => {
    expect(parseFeeCatalog(servedCatalog).schemaVersion).toBe(SCHEMA_VERSION);
    expect(FEE_CATALOG_SEED.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("every curated entry (both sources) carries sourceUrl + effectiveDate + lastReviewed", () => {
    const entriesOf = (c: FeeCatalog) => c.marketplaces.flatMap((m) => m.entries);
    const all = [...entriesOf(parseFeeCatalog(servedCatalog)), ...entriesOf(FEE_CATALOG_SEED)];
    for (const e of all) {
      expect(e.sourceUrl).toMatch(/^https?:\/\//);
      expect(e.effectiveDate.length).toBeGreaterThan(0);
      expect(e.lastReviewed.length).toBeGreaterThan(0);
    }
  });
});

describe("fee-catalog schema rejects fabricated / malformed entries", () => {
  const base = {
    determinants: null,
    commissionPct: 12,
    fixedFee: 5,
    freight: { kind: "NONE" },
    source: "curadoria manual",
    sourceUrl: "https://example.com/fees",
    effectiveDate: "2026-01-20",
    lastReviewed: "2026-07-06",
  };

  it("accepts a well-formed, sourced entry", () => {
    expect(() => feeEntrySchema.parse(base)).not.toThrow();
  });

  it("rejects an entry missing its sourceUrl (no provenance → not curatable)", () => {
    const noProvenance: Record<string, unknown> = { ...base };
    delete noProvenance.sourceUrl;
    expect(() => feeEntrySchema.parse(noProvenance)).toThrow();
  });

  it("rejects a non-URL sourceUrl", () => {
    expect(() => feeEntrySchema.parse({ ...base, sourceUrl: "not-a-url" })).toThrow();
  });

  it("rejects a commission >= 100", () => {
    expect(() => feeEntrySchema.parse({ ...base, commissionPct: 100 })).toThrow();
  });

  // F3 (confirmation audit): a null commissionPct is only valid WITH price bands (Shopee's shape) —
  // otherwise it prefills 0% under a "referência" seal. Guards the future 014 ML/Amazon curation.
  it("rejects a null commissionPct entry that has NO price bands (the 0%-under-reference trap)", () => {
    expect(() => feeEntrySchema.parse({ ...base, commissionPct: null })).toThrow();
  });

  it("accepts a null commissionPct entry when the commission lives in price bands", () => {
    const banded = {
      ...base,
      commissionPct: null,
      fixedFee: null,
      priceBands: [{ minPrice: 0, maxPrice: null, commissionPct: 14, fixedFee: 4 }],
    };
    expect(() => feeEntrySchema.parse(banded)).not.toThrow();
  });
});

describe("resolveEntry — keyed by determinants (A6)", () => {
  const catalog: FeeCatalog = feeCatalogSchema.parse({
    catalogVersion: "2026-07-06.t",
    schemaVersion: SCHEMA_VERSION,
    generatedAt: "2026-07-06T00:00:00.000Z",
    marketplaces: [
      {
        marketplace: "MERCADO_LIVRE",
        entries: [
          {
            determinants: { listingType: "CLASSICO", category: "casa" },
            commissionPct: 12,
            fixedFee: 6.75,
            freight: { kind: "NONE" },
            source: "API Mercado Livre (listing_prices)",
            sourceUrl: "https://developers.mercadolivre.com.br/",
            effectiveDate: "2026-07-06",
            lastReviewed: "2026-07-06",
          },
        ],
      },
      { marketplace: "SHOPEE", entries: [] },
    ],
  });

  it("returns the entry whose determinants match", () => {
    const e = resolveEntry(catalog, "MERCADO_LIVRE", { listingType: "CLASSICO", category: "casa" });
    expect(e?.commissionPct).toBe(12);
    expect(e?.fixedFee).toBe(6.75);
  });

  it("returns null for an uncovered determinant combo (→ manual, no fabrication)", () => {
    const e = resolveEntry(catalog, "MERCADO_LIVRE", { listingType: "PREMIUM", category: "casa" });
    expect(e).toBeNull();
  });

  it("returns null for a marketplace with no entries", () => {
    expect(resolveEntry(catalog, "SHOPEE", null)).toBeNull();
  });
});

describe("isStale — 30-day window vs lastReviewed (pure, injected now)", () => {
  const entry = feeEntrySchema.parse({
    determinants: null,
    commissionPct: 12,
    fixedFee: 5,
    freight: { kind: "NONE" },
    source: "x",
    sourceUrl: "https://example.com",
    effectiveDate: "2026-01-01",
    lastReviewed: "2026-06-01T00:00:00.000Z",
  });
  const reviewed = Date.parse("2026-06-01T00:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;

  it("fresh within the window", () => {
    expect(isStale(entry, reviewed + 10 * day)).toBe(false);
  });

  it("stale past the window", () => {
    expect(isStale(entry, reviewed + (STALENESS_DAYS + 1) * day)).toBe(true);
  });

  it("never cries wolf on an unparseable date", () => {
    expect(isStale({ ...entry, lastReviewed: "not-a-date" }, reviewed + 999 * day)).toBe(false);
  });
});
