import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
  type FeeCatalog,
  feeCatalogSchema,
  feeEntrySchema,
  isStale,
  parseFeeCatalog,
  parseSeedResilient,
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

// ---------------------------------------------------------------------------------------------
// 014 — resolution by ancestor chain, and the two defects the adversarial review found in the
// code that already ships. Numbers below are MEASURED against the live ML API on 2026-07-28.
// ---------------------------------------------------------------------------------------------

const provenance = {
  freight: { kind: "NONE" as const },
  source: "API Mercado Livre (listing_prices)",
  sourceUrl: "https://api.mercadolibre.com/sites/MLB/listing_prices",
  effectiveDate: "2026-07-28",
  lastReviewed: "2026-07-28",
};

/** Sparse by design: an entry exists only where the rate DIVERGES from the parent (measured: ~87.5%
 *  of nodes inherit). `MLB1055` is a real divergence — ML publishes 18% at the root and 16% here. */
const mlCatalog = (entries: unknown[]) => ({
  catalogVersion: "2026-07-28.t",
  schemaVersion: SCHEMA_VERSION,
  generatedAt: "2026-07-28T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      categorySpine: [
        { id: "MLB1051", name: "Celulares e Telefones", parentId: null },
        { id: "MLB1055", name: "Celulares e Smartphones", parentId: "MLB1051" },
        { id: "MLB3813", name: "Acessórios para Celulares", parentId: "MLB1051" },
        { id: "MLB439224", name: "Apoio para Celulares", parentId: "MLB3813" },
      ],
      entries,
    },
  ],
});

const ENTRY_ROOT_18 = {
  determinants: { listingType: "gold_pro", category: "MLB1051" },
  commissionPct: 18,
  fixedFee: 0,
  ...provenance,
};
const ENTRY_DIVERGENT_16 = {
  determinants: { listingType: "gold_pro", category: "MLB1055" },
  commissionPct: 16,
  fixedFee: 0,
  ...provenance,
};
const ENTRY_CATCH_ALL = {
  determinants: { listingType: "gold_pro" },
  commissionPct: 15,
  fixedFee: 0,
  ...provenance,
};

describe("resolveEntry — nearest ancestor wins (SC-801)", () => {
  const catalog = feeCatalogSchema.parse(
    mlCatalog([ENTRY_ROOT_18, ENTRY_DIVERGENT_16, ENTRY_CATCH_ALL]),
  );
  const at = (category?: string) =>
    resolveEntry(catalog, "MERCADO_LIVRE", {
      listingType: "gold_pro",
      ...(category ? { category } : {}),
    })?.commissionPct;

  it("a category with its own entry uses it", () => {
    expect(at("MLB1051")).toBe(18);
  });

  it("a DIVERGENT child uses its own rate, not the parent's", () => {
    expect(at("MLB1055")).toBe(16);
  });

  it("a category with no entry inherits from the NEAREST ancestor that has one", () => {
    // MLB439224 → MLB3813 (no entry) → MLB1051 (18%).
    expect(at("MLB439224")).toBe(18);
  });

  it("no category falls through to the published catch-all", () => {
    expect(at()).toBe(15);
  });

  // THE property. If this can fail, every other guarantee is luck.
  it("is INDEPENDENT of the order entries appear in the artifact", () => {
    const orders = [
      [ENTRY_ROOT_18, ENTRY_DIVERGENT_16, ENTRY_CATCH_ALL],
      [ENTRY_CATCH_ALL, ENTRY_ROOT_18, ENTRY_DIVERGENT_16],
      [ENTRY_DIVERGENT_16, ENTRY_CATCH_ALL, ENTRY_ROOT_18],
      [ENTRY_CATCH_ALL, ENTRY_DIVERGENT_16, ENTRY_ROOT_18],
    ];
    for (const entries of orders) {
      const c = feeCatalogSchema.parse(mlCatalog(entries));
      const rate = (cat: string) =>
        resolveEntry(c, "MERCADO_LIVRE", { listingType: "gold_pro", category: cat })?.commissionPct;
      expect(rate("MLB1055")).toBe(16);
      expect(rate("MLB439224")).toBe(18);
      expect(rate("MLB1051")).toBe(18);
    }
  });

  it("a different listingType does NOT borrow another modality's rate", () => {
    const e = resolveEntry(catalog, "MERCADO_LIVRE", {
      listingType: "gold_special",
      category: "MLB1055",
    });
    expect(e).toBeNull();
  });
});

describe("resolveEntry — the positional fallback is gone (FR-027)", () => {
  // fee-catalog.ts:111 used to end in `?? mk.entries[0]`. A slot with no determinants (modality
  // empty — exactly what scenarios and kits saved before 014 carry) would get the FIRST entry in the
  // array: an arbitrary category's commission, under a "referência" seal.
  it("no determinants + no explicit null-keyed entry ⇒ null, never entries[0]", () => {
    const catalog = feeCatalogSchema.parse(mlCatalog([ENTRY_ROOT_18, ENTRY_DIVERGENT_16]));
    expect(resolveEntry(catalog, "MERCADO_LIVRE", null)).toBeNull();
  });

  it("still honours an EXPLICIT null-keyed entry (Shopee's shape)", () => {
    const catalog = feeCatalogSchema.parse(
      mlCatalog([ENTRY_ROOT_18, { ...ENTRY_CATCH_ALL, determinants: null, commissionPct: 11 }]),
    );
    expect(resolveEntry(catalog, "MERCADO_LIVRE", null)?.commissionPct).toBe(11);
  });
});

describe("catalog parse rejects data that would resolve ambiguously or fabricate", () => {
  it("rejects two entries with the SAME determinant set (ambiguity, not a tie-break)", () => {
    expect(() =>
      feeCatalogSchema.parse(mlCatalog([ENTRY_ROOT_18, { ...ENTRY_ROOT_18, commissionPct: 13 }])),
    ).toThrow();
  });

  it("rejects an entry whose category is absent from the spine (a ghost category)", () => {
    expect(() =>
      feeCatalogSchema.parse(
        mlCatalog([
          { ...ENTRY_ROOT_18, determinants: { listingType: "gold_pro", category: "GHOST" } },
        ]),
      ),
    ).toThrow();
  });

  // SC-802 / FR-008 — the F3 guard inherited from 013 checked only the TOP level: an entry whose
  // bands ALSO carry a null commission passed validation and prefilled 0% under a "referência" seal.
  it("rejects a banded entry whose BANDS carry a null commission (0% under reference)", () => {
    const blind = {
      ...provenance,
      determinants: { listingType: "gold_pro", category: "MLB1051" },
      commissionPct: null,
      fixedFee: null,
      priceBands: [
        { minPrice: 0, maxPrice: 79, commissionPct: null, fixedFee: 6.25 },
        { minPrice: 79, maxPrice: null, commissionPct: 18, fixedFee: 0 },
      ],
    };
    expect(() => feeEntrySchema.parse(blind)).toThrow();
  });

  it("a valid seed still parses identically through the resilient path", () => {
    const good = mlCatalog([ENTRY_ROOT_18]);
    expect(parseSeedResilient(good)).toEqual(parseFeeCatalog(good));
  });

  // FR-026 — the seed is validated at module load. Throwing was right while it was hand-written with
  // one entry; from 014 it is robot-generated, and one bad marketplace would white-screen every user
  // at boot, online and offline, until a new bundle shipped.
  it("an invalid marketplace in the seed is DROPPED, not fatal", () => {
    const withGhost = {
      ...mlCatalog([ENTRY_ROOT_18]),
      marketplaces: [
        ...mlCatalog([ENTRY_ROOT_18]).marketplaces,
        // duplicate determinant sets — invalid, and exactly what a buggy generator emits
        { marketplace: "AMAZON", entries: [ENTRY_CATCH_ALL, ENTRY_CATCH_ALL] },
      ],
    };
    expect(() => parseFeeCatalog(withGhost)).toThrow(); // generator + CI: fatal
    const salvaged = parseSeedResilient(withGhost); // client: degrade
    expect(salvaged.marketplaces.map((m) => m.marketplace)).toEqual(["MERCADO_LIVRE"]);
    // and the dropped channel resolves to nothing — "sem referência", never a fabricated price
    expect(resolveEntry(salvaged, "AMAZON", { plan: "PROFISSIONAL" })).toBeNull();
  });

  it("a seed that is unsalvageable yields an empty catalog rather than crashing the app", () => {
    const junk = { marketplaces: "not-an-array" };
    expect(parseSeedResilient(junk).marketplaces).toEqual([]);
  });

  // 014/T085 (A2) — a variante que o guard original NAO cobria: comissao de topo NAO-nula e banda com
  // comissao nula. O `.refine` era um `||`, entao um topo nao-nulo aprovava a entrada inteira sem
  // olhar as bandas. E o numero de topo e um CHAMARIZ: `entryToChannelFees` mapeia
  // `b.commissionPct ?? 0` e as bandas SUBSTITUEM o topo, entao o 12% existe, passa no guard, e nunca
  // e cobrado — o preco naquela faixa sai com 0% sob selo de "Referencia" (FR-008/SC-802).
  it("rejects a null-commission band even when the TOP-LEVEL commission is present", () => {
    const decoy = {
      ...provenance,
      determinants: { listingType: "gold_pro", category: "MLB1052" },
      commissionPct: 12,
      fixedFee: 0,
      priceBands: [
        { minPrice: 0, maxPrice: 79, commissionPct: null, fixedFee: 6.25 },
        { minPrice: 79, maxPrice: null, commissionPct: 12, fixedFee: 0 },
      ],
    };
    expect(() => feeEntrySchema.parse(decoy)).toThrow();
  });

  it("rejects it for EVERY band position — a null in the terminal band is the same trap", () => {
    const decoy = {
      ...provenance,
      determinants: { listingType: "gold_pro", category: "MLB1053" },
      commissionPct: 12,
      fixedFee: 0,
      priceBands: [
        { minPrice: 0, maxPrice: 79, commissionPct: 12, fixedFee: 6.25 },
        { minPrice: 79, maxPrice: null, commissionPct: null, fixedFee: 0 },
      ],
    };
    expect(() => feeEntrySchema.parse(decoy)).toThrow();
  });

  it("a top-level commission WITH sound bands segue valida — o guard nao alarga demais", () => {
    const sound = {
      ...provenance,
      determinants: { listingType: "gold_pro", category: "MLB1054" },
      commissionPct: 12,
      fixedFee: 0,
      priceBands: [
        { minPrice: 0, maxPrice: 79, commissionPct: 12, fixedFee: 6.25 },
        { minPrice: 79, maxPrice: null, commissionPct: 12, fixedFee: 0 },
      ],
    };
    expect(() => feeEntrySchema.parse(sound)).not.toThrow();
  });

  it("accepts a banded entry when EVERY band carries a commission", () => {
    const sound = {
      ...provenance,
      determinants: { listingType: "gold_pro", category: "MLB1051" },
      commissionPct: null,
      fixedFee: null,
      priceBands: [
        { minPrice: 0, maxPrice: 79, commissionPct: 18, fixedFee: 6.25 },
        { minPrice: 79, maxPrice: null, commissionPct: 18, fixedFee: 0 },
      ],
    };
    expect(() => feeEntrySchema.parse(sound)).not.toThrow();
  });
});
