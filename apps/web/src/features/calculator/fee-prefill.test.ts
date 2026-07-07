import { grossUp } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import {
  type FeeCatalog,
  feeCatalogSchema,
  feeEntrySchema,
  STALENESS_DAYS,
} from "@/shared/fee-catalog";

import {
  entryToChannelFees,
  feeSealState,
  resolveSlotEntry,
  slotDeterminants,
} from "./fee-prefill";

// SC-103 (US2, test-first): selecting a covered marketplace+modality pre-fills from the catalog with
// a dated seal; overriding flips it to "ajustado por você"; an uncovered combo resolves to nothing →
// manual + "sem referência" (never a fabricated number). Uses a fixture catalog (real curation is T022).

const catalog: FeeCatalog = feeCatalogSchema.parse({
  catalogVersion: "2026-07-07.t",
  schemaVersion: "1",
  generatedAt: "2026-07-07T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "MERCADO_LIVRE",
      entries: [
        {
          determinants: { listingType: "CLASSICO" },
          commissionPct: 12,
          fixedFee: 6.75,
          freight: { kind: "NONE" },
          source: "Ajuda Mercado Livre",
          sourceUrl: "https://www.mercadolivre.com.br/ajuda/",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-07-06",
        },
      ],
    },
    {
      marketplace: "SHOPEE",
      entries: [
        {
          determinants: null,
          commissionPct: null,
          fixedFee: null,
          priceBands: [{ minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 }],
          freight: {
            kind: "BAND_VOUCHER",
            bands: [{ minPrice: 0, maxPrice: null, voucherCeiling: 20 }],
          },
          source: "Central do Vendedor Shopee",
          sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-07-06",
        },
      ],
    },
  ],
});

const reviewedMs = Date.parse("2026-07-06");
const day = 24 * 60 * 60 * 1000;

describe("slotDeterminants — modality maps to the marketplace's key (A6)", () => {
  it("ML modality → listingType; Amazon → plan; Shopee/Outro → none", () => {
    expect(slotDeterminants("MERCADO_LIVRE", "CLASSICO")).toEqual({ listingType: "CLASSICO" });
    expect(slotDeterminants("AMAZON", "INDIVIDUAL")).toEqual({ plan: "INDIVIDUAL" });
    expect(slotDeterminants("SHOPEE", "")).toBeNull();
    expect(slotDeterminants("OUTRO", "")).toBeNull();
  });
});

describe("resolveSlotEntry — covered vs uncovered (SC-103)", () => {
  it("a covered ML Clássico slot resolves its sourced entry", () => {
    const e = resolveSlotEntry(catalog, "MERCADO_LIVRE", "CLASSICO");
    expect(e?.commissionPct).toBe(12);
    expect(e?.fixedFee).toBe(6.75);
  });

  it("Shopee (no modality) resolves the price-band entry", () => {
    const e = resolveSlotEntry(catalog, "SHOPEE", "");
    expect(e?.priceBands?.[0].commissionPct).toBe(20);
  });

  it("an uncovered combo (ML Premium) resolves to null → manual, no fabrication", () => {
    expect(resolveSlotEntry(catalog, "MERCADO_LIVRE", "PREMIUM")).toBeNull();
  });

  it("OUTRO is never in the catalog → always manual", () => {
    expect(resolveSlotEntry(catalog, "OUTRO", "")).toBeNull();
  });
});

describe("feeSealState — the honesty seal per slot (SC-103 / FR-107)", () => {
  const entry = resolveSlotEntry(catalog, "MERCADO_LIVRE", "CLASSICO");

  it("a covered slot from the served catalog → a fresh dated reference", () => {
    const s = feeSealState({ entry, source: "catalog", now: reviewedMs + day, edited: false });
    expect(s).toEqual({
      kind: "reference",
      source: "Ajuda Mercado Livre",
      reviewedOn: "2026-07-06",
      embedded: false,
      stale: false,
    });
  });

  it("the same slot from the bundled seed is marked embutida (offline)", () => {
    const s = feeSealState({ entry, source: "seed", now: reviewedMs + day, edited: false });
    expect(s).toMatchObject({ kind: "reference", embedded: true });
  });

  it("past the 30-day window the reference is flagged stale", () => {
    const s = feeSealState({
      entry,
      source: "catalog",
      now: reviewedMs + (STALENESS_DAYS + 1) * day,
      edited: false,
    });
    expect(s).toMatchObject({ kind: "reference", stale: true });
  });

  it("editing a pre-filled value flips the seal to 'ajustado por você'", () => {
    expect(feeSealState({ entry, source: "catalog", now: reviewedMs, edited: true })).toEqual({
      kind: "adjusted",
    });
  });

  it("an uncovered slot reads 'sem referência' — never a fabricated number", () => {
    expect(
      feeSealState({ entry: null, source: "catalog", now: reviewedMs, edited: false }),
    ).toEqual({ kind: "none" });
  });
});

describe("entryToChannelFees — map a resolved entry to the engine (SC-111)", () => {
  it("carries a price-band entry's bands through (Shopee)", () => {
    const shopee = resolveSlotEntry(catalog, "SHOPEE", "");
    const fees = entryToChannelFees(shopee!);
    expect(fees.priceBands).toEqual([
      { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
    ]);
    expect(fees.freightIsEstimate).toBe(false);
  });

  it("the ML free-shipping ESTIMATE becomes an editable freightCost sealed 'estimativa'", () => {
    const mlEstimate = feeEntrySchema.parse({
      determinants: { listingType: "CLASSICO" },
      commissionPct: 12,
      fixedFee: 6.75,
      freight: { kind: "ESTIMATE", thresholdPrice: 79, defaultSubsidy: 20 },
      source: "Ajuda Mercado Livre",
      sourceUrl: "https://www.mercadolivre.com.br/ajuda/",
      effectiveDate: "2026-03-01",
      lastReviewed: "2026-07-06",
    });
    const fees = entryToChannelFees(mlEstimate);
    expect(fees.freightCost).toBe(20);
    expect(fees.freightIsEstimate).toBe(true);

    // SC-111: the subsidy lowers the líquido by exactly that amount vs. the no-freight gross-up.
    const withSubsidy = grossUp(42.98, { commissionPct: 12, fixedFee: 6.75, freightCost: 20 });
    const noFreight = grossUp(42.98, { commissionPct: 12, fixedFee: 6.75, freightCost: 0 });
    expect(noFreight.liquido - withSubsidy.liquido).toBeCloseTo(20, 2);
    expect(withSubsidy.anuncio).toBe(noFreight.anuncio); // freight is a post-deduction, not grossed up
  });
});
