import { readFileSync } from "node:fs";

import { grossUp } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import {
  type FeeCatalog,
  feeCatalogSchema,
  feeEntrySchema,
  parseFeeCatalog,
  STALENESS_DAYS,
} from "@/shared/fee-catalog";

import {
  entryToChannelFees,
  feeSealState,
  resolveSlot,
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
  it("carries a price-band entry's bands + the co-funded voucher through (Shopee, FR-111a)", () => {
    const shopee = resolveSlotEntry(catalog, "SHOPEE", "");
    const fees = entryToChannelFees(shopee!);
    expect(fees.priceBands).toEqual([
      { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
    ]);
    // The BAND_VOUCHER is carried to the engine (resolved by announce) — never dropped to a flat 0,
    // which used to overstate the líquido under an authoritative seal.
    expect(fees.freightVoucherBands).toEqual([{ minPrice: 0, maxPrice: null, voucherCeiling: 20 }]);
    expect(fees.freightCost).toBe(0); // not a flat cost — the voucher lives in freightVoucherBands
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
    expect(noFreight.liquido! - withSubsidy.liquido!).toBeCloseTo(20, 2);
    expect(withSubsidy.anuncio).toBe(noFreight.anuncio); // freight is a post-deduction, not grossed up
  });
});

// ---------------------------------------------------------------------------------------------
// 014 US2 — the lookup actually USES the category. Before this, `slotDeterminants` sent only
// listingType/plan, so a category-keyed entry could never resolve and the whole feature would look
// broken. Rates below are MEASURED on the live APIs 2026-07-28.
// ---------------------------------------------------------------------------------------------

const prov = {
  freight: { kind: "NONE" as const },
  source: "Tabela de comissões Amazon",
  sourceUrl: "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920",
  effectiveDate: "2026-07-28",
  lastReviewed: "2026-07-28",
};

const catalog014: FeeCatalog = feeCatalogSchema.parse({
  catalogVersion: "2026-07-28.t",
  schemaVersion: "1",
  generatedAt: "2026-07-28T00:00:00.000Z",
  marketplaces: [
    {
      // Amazon PUBLISHES a catch-all ("Outros", 15%) — so Q5 says use it when no category is chosen.
      marketplace: "AMAZON",
      categorySpine: [
        { id: "casa", name: "Casa e Cozinha", parentId: null },
        { id: "casa-vasos", name: "Vasos e Cachepôs", parentId: "casa" },
      ],
      entries: [
        { ...prov, determinants: { plan: "PROFISSIONAL" }, commissionPct: 15, fixedFee: 0 },
        {
          ...prov,
          determinants: { plan: "PROFISSIONAL", category: "casa" },
          commissionPct: 12,
          fixedFee: 0,
        },
      ],
    },
    {
      // ML publishes NO catch-all — the rate varies 14–19% by category and there is no "Outros".
      // Q5 therefore says "sem referência" here; deriving one from the published range is forbidden.
      marketplace: "MERCADO_LIVRE",
      categorySpine: [
        { id: "MLB1051", name: "Celulares e Telefones", parentId: null },
        { id: "MLB1055", name: "Celulares e Smartphones", parentId: "MLB1051" },
        { id: "MLB439224", name: "Apoio para Celulares", parentId: "MLB1051" },
      ],
      entries: [
        {
          ...prov,
          determinants: { listingType: "gold_pro", category: "MLB1051" },
          commissionPct: 18,
          fixedFee: 0,
        },
        {
          ...prov,
          determinants: { listingType: "gold_pro", category: "MLB1055" },
          commissionPct: 16,
          fixedFee: 0,
        },
      ],
    },
  ],
});

describe("slotDeterminants — the category axis (US2)", () => {
  it("carries the category when the seller chose one", () => {
    expect(slotDeterminants("MERCADO_LIVRE", "gold_pro", "MLB1055")).toEqual({
      listingType: "gold_pro",
      category: "MLB1055",
    });
    expect(slotDeterminants("AMAZON", "PROFISSIONAL", "casa")).toEqual({
      plan: "PROFISSIONAL",
      category: "casa",
    });
  });

  it("omits it entirely when there is none — never an empty string", () => {
    expect(slotDeterminants("MERCADO_LIVRE", "gold_pro")).toEqual({ listingType: "gold_pro" });
    expect(slotDeterminants("MERCADO_LIVRE", "gold_pro", "")).toEqual({ listingType: "gold_pro" });
  });

  it("marketplaces with no category axis stay unaffected", () => {
    expect(slotDeterminants("SHOPEE", "", "casa")).toBeNull();
  });
});

describe("resolveSlot — Q5: catch-all only where the marketplace publishes one", () => {
  it("a chosen category resolves its own rate", () => {
    const r = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL", "casa");
    expect(r.entry?.commissionPct).toBe(12);
    expect(r.viaCatchAll).toBe(false);
    expect(r.originCategoryId).toBe("casa");
  });

  it("a category with no entry inherits, and the ORIGIN is the ancestor that had one", () => {
    const r = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL", "casa-vasos");
    expect(r.entry?.commissionPct).toBe(12);
    expect(r.originCategoryId).toBe("casa"); // the number is the PARENT's — the seal must say so
    expect(r.viaCatchAll).toBe(false);
  });

  it("NO category on a marketplace WITH a published catch-all → uses it, flagged as catch-all", () => {
    const r = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL");
    expect(r.entry?.commissionPct).toBe(15);
    expect(r.viaCatchAll).toBe(true);
    expect(r.originCategoryId).toBeNull();
  });

  // The other half of Q5, and the one that is easy to get wrong: ML publishes a RANGE (14–19%), not a
  // catch-all. Deriving one would violate SC-804 — a hole in the source stays a hole.
  it("NO category on a marketplace WITHOUT a catch-all → nothing, never a derived one", () => {
    const r = resolveSlot(catalog014, "MERCADO_LIVRE", "gold_pro");
    expect(r.entry).toBeNull();
    expect(r.viaCatchAll).toBe(false);
  });
});

describe("feeSealState — names the category, and distinguishes catch-all from no reference", () => {
  const now = Date.parse("2026-07-28") + day;

  it("a category-resolved slot names the category the number is FOR", () => {
    const r = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL", "casa-vasos");
    const s = feeSealState({
      entry: r.entry,
      source: "catalog",
      now,
      edited: false,
      originCategoryName: "Casa e Cozinha",
      viaCatchAll: r.viaCatchAll,
    });
    expect(s).toMatchObject({ kind: "reference", originCategoryName: "Casa e Cozinha" });
  });

  it("a catch-all slot reads as catch-all, NOT as a plain reference", () => {
    const r = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL");
    const s = feeSealState({
      entry: r.entry,
      source: "catalog",
      now,
      edited: false,
      catchAllName: "Outros",
      viaCatchAll: r.viaCatchAll,
    });
    expect(s.kind).toBe("catchAll");
    expect(s).toMatchObject({ catchAllName: "Outros" });
  });

  it("no entry at all still reads 'sem referência' — the two are never conflated", () => {
    const r = resolveSlot(catalog014, "MERCADO_LIVRE", "gold_pro");
    const s = feeSealState({ entry: r.entry, source: "catalog", now, edited: false });
    expect(s.kind).toBe("none");
  });

  it("an edited value still wins over everything, catch-all included", () => {
    const r = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL");
    const s = feeSealState({
      entry: r.entry,
      source: "catalog",
      now,
      edited: true,
      viaCatchAll: r.viaCatchAll,
    });
    expect(s.kind).toBe("adjusted");
  });
});

// 014/T096 (Q5/T094) — o truth-gate do catch-all, contra o ARTEFATO REAL.
//
// Os testes acima provam o comportamento sobre um `catalog014` escrito à mão, e por isso passavam
// verdes enquanto o artefato publicado não tinha catch-all nenhum: o fixture inventou a entrada que
// o gerador não emitia. A decisão T094 é sobre o que o VENDEDOR recebe, e quem entrega isso é o
// arquivo commitado — então a asserção tem de ser feita nele.
describe("T094/T096 — quem não escolhe categoria recebe o catch-all PUBLICADO da Amazon", () => {
  const artefato = parseFeeCatalog(
    JSON.parse(
      readFileSync(
        new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
        "utf8",
      ),
    ),
  );

  it("um slot Amazon sem categoria resolve — e resolve PELO catch-all, não por uma categoria", () => {
    const r = resolveSlot(artefato, "AMAZON", "PROFISSIONAL");
    expect(r.entry).not.toBeNull();
    expect(r.viaCatchAll).toBe(true);
    expect(r.originCategoryId).toBeNull();
  });

  it("o valor é o da linha 'Outros' — 15%, o TETO da tabela (erro sempre a favor do vendedor)", () => {
    const r = resolveSlot(artefato, "AMAZON", "PROFISSIONAL");
    expect(r.entry?.commissionPct).toBe(15);
    // A procedência nomeia a linha que foi usada: o catch-all é citação, não invenção (FR-011a).
    expect(r.entry?.source).toContain("Outros");
  });

  it("o selo diz que a categoria não foi informada — nunca 'Referência' seca", () => {
    const r = resolveSlot(artefato, "AMAZON", "PROFISSIONAL");
    const s = feeSealState({
      entry: r.entry,
      source: "catalog",
      now: Date.parse("2026-07-28"),
      edited: false,
      viaCatchAll: r.viaCatchAll,
    });
    expect(s.kind).toBe("catchAll");
  });

  it("vale para os dois planos — a tabela não varia por plano, e o catch-all também não", () => {
    for (const plan of ["PROFISSIONAL", "INDIVIDUAL"]) {
      expect(resolveSlot(artefato, "AMAZON", plan).entry?.commissionPct).toBe(15);
    }
  });

  it("escolher categoria continua vencendo o catch-all", () => {
    const r = resolveSlot(artefato, "AMAZON", "PROFISSIONAL", "relogios");
    expect(r.viaCatchAll).toBe(false);
    expect(r.originCategoryId).toBe("relogios");
    expect(r.entry?.commissionPct).toBe(13);
  });

  it("o ML NÃO ganha catch-all por tabela: sem categoria, sem referência (SC-804)", () => {
    // A assimetria cai do dado, não de um `if`: o ML publica uma FAIXA (14–19%) e nenhum catch-all,
    // e derivar um dela seria fabricar número.
    const r = resolveSlot(artefato, "MERCADO_LIVRE", "gold_pro");
    expect(r.entry).toBeNull();
    expect(r.viaCatchAll).toBe(false);
  });
});
