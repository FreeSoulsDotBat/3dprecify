import { describe, expect, it } from "vitest";

import type { FeeCatalog } from "@/shared/fee-catalog";

import { channelFieldPlan, feeFieldsToBlankOnMarketplaceChange } from "./channel-field-plan";

// 016/US12 (T045, arquitetura-016 §F.2) — the plan is PURE and derived only from the catalog. These
// fixtures are hand-built (not the real seed) so each rule is exercised in isolation, red before
// `channel-field-plan.ts` exists.

function catalogWith(marketplaces: FeeCatalog["marketplaces"]): FeeCatalog {
  return {
    catalogVersion: "test",
    schemaVersion: "1",
    generatedAt: "2026-08-06T00:00:00.000Z",
    marketplaces,
  };
}

describe("channelFieldPlan — rule 1 (determinants)", () => {
  it("a determinant key with a non-empty option list becomes a SELECT determinant", () => {
    const catalog = catalogWith([
      {
        marketplace: "MERCADO_LIVRE",
        determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"] },
        categorySpine: null,
        entries: [],
      },
    ]);
    const plan = channelFieldPlan(catalog, "MERCADO_LIVRE");
    expect(plan.determinants).toHaveLength(1);
    expect(plan.determinants[0]).toMatchObject({ key: "listingType", kind: "SELECT" });
    expect(plan.determinants[0].options).toEqual([
      { value: "CLASSICO", label: "Clássico" },
      { value: "PREMIUM", label: "Premium" },
    ]);
  });

  it("a determinant key declared with an EMPTY option list does not appear", () => {
    const catalog = catalogWith([
      {
        marketplace: "MERCADO_LIVRE",
        determinantsSchema: { listingType: [] },
        categorySpine: null,
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "MERCADO_LIVRE").determinants).toEqual([]);
  });

  it("no determinantsSchema at all (Shopee today) yields zero determinants", () => {
    const catalog = catalogWith([
      { marketplace: "SHOPEE", determinantsSchema: null, categorySpine: null, entries: [] },
    ]);
    expect(channelFieldPlan(catalog, "SHOPEE").determinants).toEqual([]);
  });

  it("category appears sse categorySpine is non-empty — NEVER inferred from the modality axis (the F1 defect)", () => {
    // A marketplace with a modality axis but NO category spine: category must NOT appear, even
    // though today's code (modalityOptions.length > 0) would have inferred it wrongly.
    const withoutSpine = catalogWith([
      {
        marketplace: "AMAZON",
        determinantsSchema: { plan: ["INDIVIDUAL", "PROFISSIONAL"] },
        categorySpine: null,
        entries: [],
      },
    ]);
    expect(channelFieldPlan(withoutSpine, "AMAZON").determinants.map((d) => d.key)).toEqual([
      "plan",
    ]);

    // The inverse: a category spine with NO modality axis at all still surfaces the picker.
    const spineOnly = catalogWith([
      {
        marketplace: "AMAZON",
        determinantsSchema: null,
        categorySpine: [{ id: "a", parentId: null, name: "A" }],
        entries: [],
      },
    ]);
    expect(channelFieldPlan(spineOnly, "AMAZON").determinants.map((d) => d.key)).toEqual([
      "category",
    ]);
  });

  it("category is declared last, after any SELECT determinant (matches today's UI order)", () => {
    const catalog = catalogWith([
      {
        marketplace: "AMAZON",
        determinantsSchema: { category: [], plan: ["INDIVIDUAL", "PROFISSIONAL"] },
        categorySpine: [{ id: "a", parentId: null, name: "A" }],
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "AMAZON").determinants.map((d) => d.key)).toEqual([
      "plan",
      "category",
    ]);
  });
});

describe("channelFieldPlan — rule 2 (feeAxes)", () => {
  it("feeAxes ABSENT yields all four fields, in the canonical order — a pre-016 cached catalog", () => {
    const catalog = catalogWith([
      { marketplace: "SHOPEE", determinantsSchema: null, categorySpine: null, entries: [] },
    ]);
    expect(channelFieldPlan(catalog, "SHOPEE").feeFields).toEqual([
      "commissionPct",
      "fixedFee",
      "minPerItem",
      "freightCost",
    ]);
  });

  it("feeAxes explicit filters to exactly those fields, in canonical order regardless of curation order", () => {
    const catalog = catalogWith([
      {
        marketplace: "AMAZON",
        determinantsSchema: null,
        categorySpine: null,
        // curation order deliberately scrambled — the plan must still emit canonical order
        feeAxes: ["minPerItem", "commissionPct", "fixedFee"],
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "AMAZON").feeFields).toEqual([
      "commissionPct",
      "fixedFee",
      "minPerItem",
    ]);
  });

  it("feeAxes: null (explicit) behaves exactly like absent", () => {
    const catalog = catalogWith([
      {
        marketplace: "SHOPEE",
        determinantsSchema: null,
        categorySpine: null,
        feeAxes: null,
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "SHOPEE").feeFields).toHaveLength(4);
  });
});

describe("channelFieldPlan — ML stays today's behaviour (US15 reversion)", () => {
  it("Mercado Livre with today's real shape (listingType, empty category echo, no spine) plans exactly like today", () => {
    const catalog = catalogWith([
      {
        marketplace: "MERCADO_LIVRE",
        determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"], category: [] },
        categorySpine: null,
        entries: [],
      },
    ]);
    const plan = channelFieldPlan(catalog, "MERCADO_LIVRE");
    expect(plan.determinants.map((d) => d.key)).toEqual(["listingType"]);
    expect(plan.feeFields).toHaveLength(4); // no feeAxes curated in this fixture ⇒ today's 4 fields
  });
});

// 016/PR-F (US17, FR-926) — sellerProfile composes ONE determinant from TWO form answers, so it is
// EXCLUDED from the generic SELECT loop above (rule 1) and surfaced as its own boolean instead.
describe("channelFieldPlan — sellerProfile (US17, RA5)", () => {
  it("determinantsSchema.sellerProfile with a non-empty option list turns the flag on, and does NOT become a SELECT determinant", () => {
    const catalog = catalogWith([
      {
        marketplace: "SHOPEE",
        determinantsSchema: { sellerProfile: ["CPF_ALTO_VOLUME"] },
        categorySpine: null,
        entries: [],
      },
    ]);
    const plan = channelFieldPlan(catalog, "SHOPEE");
    expect(plan.sellerProfile).toBe(true);
    expect(plan.determinants.map((d) => d.key)).not.toContain("sellerProfile");
  });

  it("no sellerProfile axis in the schema (any other marketplace) leaves the flag off", () => {
    const catalog = catalogWith([
      {
        marketplace: "AMAZON",
        determinantsSchema: { plan: ["INDIVIDUAL", "PROFISSIONAL"] },
        categorySpine: null,
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "AMAZON").sellerProfile).toBe(false);
  });

  it("an EMPTY sellerProfile option list behaves like absent (same rule as every other axis)", () => {
    const catalog = catalogWith([
      {
        marketplace: "SHOPEE",
        determinantsSchema: { sellerProfile: [] },
        categorySpine: null,
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "SHOPEE").sellerProfile).toBe(false);
  });
});

// 016/PR-F (US16, FR-923, ADR-0027 §3.2) — the marketplace's optional per-item costs, verbatim.
describe("channelFieldPlan — surcharges (US16)", () => {
  const surcharge = {
    id: "MANUSEIO_VOLUMOSO",
    label: "Manuseio de item volumoso",
    value: 50,
    appliesPer: "ORDER" as const,
    source: "Central de Educação do Vendedor Shopee",
    sourceUrl: "https://seller.shopee.com.br/edu/article/3305",
    effectiveDate: "2026-02-02",
    lastReviewed: "2026-08-06",
  };

  it("echoes optionalSurcharges verbatim when the catalog declares them", () => {
    const catalog = catalogWith([
      {
        marketplace: "SHOPEE",
        determinantsSchema: null,
        categorySpine: null,
        optionalSurcharges: [surcharge],
        entries: [],
      },
    ]);
    expect(channelFieldPlan(catalog, "SHOPEE").surcharges).toEqual([surcharge]);
  });

  it("absent/null optionalSurcharges yields an empty list — zero string/number invented", () => {
    const catalog = catalogWith([
      { marketplace: "AMAZON", determinantsSchema: null, categorySpine: null, entries: [] },
    ]);
    expect(channelFieldPlan(catalog, "AMAZON").surcharges).toEqual([]);
  });
});

describe("channelFieldPlan — marketplaces the catalog does not carry", () => {
  it("OUTRO (never in the catalog) yields zero determinants and all four fields", () => {
    const catalog = catalogWith([]);
    expect(channelFieldPlan(catalog, "OUTRO")).toEqual({
      determinants: [],
      feeFields: ["commissionPct", "fixedFee", "minPerItem", "freightCost"],
      sellerProfile: false,
      surcharges: [],
    });
  });

  it("a marketplace id absent from an older cached catalog degrades the same way", () => {
    const catalog = catalogWith([]);
    expect(channelFieldPlan(catalog, "AMAZON").determinants).toEqual([]);
  });
});

// 016/US11 (T044 homologação PR-E, bloqueador RA5) — the hidden-field-still-charges defect: a fee
// value typed while a marketplace's plan showed the field must be BLANKED when the seller switches
// to a marketplace whose plan does NOT show that field — otherwise the value keeps charging with no
// control on screen for it (measured: R$ 50 "Frete" typed on ML, switched to Amazon — freightCost
// isn't in Amazon's feeAxes, the field vanished, and the −R$ 50 kept discounting the líquido).
describe("feeFieldsToBlankOnMarketplaceChange — closes the render/value pair on the INTERACTIVE switch (RA5)", () => {
  const catalog = catalogWith([
    {
      marketplace: "MERCADO_LIVRE",
      determinantsSchema: { listingType: ["CLASSICO", "PREMIUM"] },
      categorySpine: null,
      feeAxes: ["commissionPct", "fixedFee", "freightCost"],
      entries: [],
    },
    {
      marketplace: "AMAZON",
      determinantsSchema: { plan: ["INDIVIDUAL", "PROFISSIONAL"] },
      categorySpine: null,
      feeAxes: ["commissionPct", "fixedFee", "minPerItem"],
      entries: [],
    },
  ]);

  it("blanks exactly the fields OUTSIDE the new marketplace's feeFields", () => {
    // ML → Amazon: freightCost drops out of the plan, minPerItem enters it.
    expect(feeFieldsToBlankOnMarketplaceChange(catalog, "AMAZON")).toEqual({
      freightCost: "",
    });
  });

  it("blanks nothing when every field the OLD value could have carries over into the new plan", () => {
    // Amazon → ML: commissionPct/fixedFee stay; minPerItem drops, freightCost enters — only
    // minPerItem (never rendered by ML) is blanked.
    expect(feeFieldsToBlankOnMarketplaceChange(catalog, "MERCADO_LIVRE")).toEqual({
      minPerItem: "",
    });
  });

  it("OUTRO (all four fields, ausência = hoje) blanks nothing", () => {
    expect(feeFieldsToBlankOnMarketplaceChange(catalog, "OUTRO")).toEqual({});
  });
});
