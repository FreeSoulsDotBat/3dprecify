import { readFileSync } from "node:fs";

import { grossUp } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import {
  type FeeCatalog,
  feeCatalogSchema,
  feeEntrySchema,
  parseFeeCatalog,
  resolveEntry,
  STALENESS_DAYS,
} from "@/shared/fee-catalog";

import {
  appliedBandFees,
  entryToChannelFees,
  feeSealState,
  resolveShopeeSellerProfile,
  resolveSlot,
  resolveSlotEntry,
  resolveSurcharges,
  slotDeterminants,
} from "./fee-prefill";
import type { MarketplaceId } from "./calculator-schema";

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
      viaCatchAll: r.viaCatchAll,
    });
    expect(s.kind).toBe("catchAll");
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

  // Exposição que a T095 abriu ao tornar o catch-all REAL, e que o `!category` do `viaCatchAll`
  // deixaria passar: uma categoria que não resolve (id de um cenário salvo, de um catálogo que
  // perdeu o nó, ou o resíduo da troca de marketplace da T097) cai no catch-all pela cadeia de
  // ancestrais — e, com o `!category`, o selo diria "Referência" como se aquele 15% fosse a
  // alíquota da categoria que o vendedor escolheu. A pergunta certa não é "escolheu categoria?",
  // é "a entrada que estamos usando tem categoria?".
  it("categoria que NÃO resolve cai no catch-all, e o selo diz isso — nunca 'Referência'", () => {
    const r = resolveSlot(artefato, "AMAZON", "PROFISSIONAL", "categoria-que-nao-existe");
    expect(r.entry?.commissionPct).toBe(15); // caiu no "Outros"
    expect(r.originCategoryId).toBeNull();
    expect(r.viaCatchAll).toBe(true);
    const s = feeSealState({
      entry: r.entry,
      source: "catalog",
      now: Date.parse("2026-07-28"),
      edited: false,
      viaCatchAll: r.viaCatchAll,
    });
    expect(s.kind).toBe("catchAll");
  });

  it("o ML NÃO ganha catch-all por tabela: sem categoria, sem referência (SC-804)", () => {
    // A assimetria cai do dado, não de um `if`: o ML publica uma FAIXA (14–19%) e nenhum catch-all,
    // e derivar um dela seria fabricar número.
    const r = resolveSlot(artefato, "MERCADO_LIVRE", "gold_pro");
    expect(r.entry).toBeNull();
    expect(r.viaCatchAll).toBe(false);
  });
});

// 014/T013c (SC-808) — NÃO-REGRESSÃO de quem NÃO escolhe categoria.
//
// É o estado de 100% dos usuários no dia do merge, e continua sendo o de quem nunca tocar no seletor:
// a categoria é OPCIONAL como portão (nada bloqueia um cálculo sem ela). O 014 acrescentou um eixo à
// busca do catálogo, e o risco que este bloco existe para prender é o eixo novo mudar o caminho ANTIGO
// — que ninguém pediu para mudar.
//
// A distinção que o bloco NÃO pode borrar: onde o marketplace NÃO tem eixo de categoria, o caminho sem
// categoria tem de ser idêntico ao de antes do 014. Onde ele TEM eixo (Amazon), um slot sem categoria
// passar a receber o catch-all publicado é mudança DELIBERADA (Q5/T094), não regressão — e por isso
// ela é asserida como diferença esperada, não escondida.
describe("T013c — quem não escolhe categoria não é afetado pelo eixo novo (SC-808)", () => {
  it("a chave `category` é OMITIDA, nunca enviada vazia — o resolvedor casa conjuntos exatos", () => {
    expect(slotDeterminants("MERCADO_LIVRE", "CLASSICO")).toEqual({ listingType: "CLASSICO" });
    expect(slotDeterminants("MERCADO_LIVRE", "CLASSICO", "")).toEqual({ listingType: "CLASSICO" });
    expect(slotDeterminants("AMAZON", "PROFISSIONAL")).toEqual({ plan: "PROFISSIONAL" });
    // Uma chave `category: ""` casaria com NADA, e o slot cairia em "sem referência" sem motivo.
    expect(slotDeterminants("AMAZON", "PROFISSIONAL")).not.toHaveProperty("category");
  });

  // Shopee: nenhum eixo de categoria, `determinants: null`. É o caso onde qualquer desvio seria
  // regressão pura, porque não há decisão nova a tomar.
  it("marketplace SEM eixo de categoria: mesma entrada, mesmo selo, sem sinal de catch-all", () => {
    const semCat = resolveSlot(catalog, "SHOPEE", "PADRAO");
    expect(semCat.entry?.source).toBe("Central do Vendedor Shopee");
    expect(semCat.viaCatchAll).toBe(false);
    expect(semCat.originCategoryId).toBeNull();

    const selo = feeSealState({
      entry: semCat.entry,
      source: "catalog",
      now: reviewedMs,
      edited: false,
      viaCatchAll: semCat.viaCatchAll,
    });
    expect(selo.kind).toBe("reference");
    // "categoria não informada" aqui inventaria uma escolha que o vendedor nunca recebeu.
    expect(selo).not.toHaveProperty("originCategoryName");
  });

  it("ML sem categoria continua resolvendo pela modalidade, exatamente como antes do 014", () => {
    const antes = resolveSlot(catalog, "MERCADO_LIVRE", "CLASSICO");
    expect(antes.entry?.commissionPct).toBe(12);
    expect(antes.entry?.fixedFee).toBe(6.75);
    expect(antes.viaCatchAll).toBe(false);
    // E as taxas chegam ao motor iguais — o pré-fill é o que o vendedor vê no campo.
    expect(entryToChannelFees(antes.entry!)).toMatchObject({ commissionPct: 12, fixedFee: 6.75 });
  });

  // O contraste, dito em vez de escondido: com eixo, o slot sem categoria MUDA — e a mudança é a
  // decisão Q5, com selo próprio que se recusa a passar por "a taxa da sua categoria".
  it("marketplace COM eixo: o slot sem categoria muda de propósito, e o selo diz que mudou", () => {
    const semCat = resolveSlot(catalog014, "AMAZON", "PROFISSIONAL");
    expect(semCat.viaCatchAll).toBe(true);
    const selo = feeSealState({
      entry: semCat.entry,
      source: "catalog",
      now: Date.parse("2026-07-28"),
      edited: false,
      viaCatchAll: semCat.viaCatchAll,
    });
    expect(selo.kind).toBe("catchAll");
  });

  // Offline é o mesmo caminho: a origem do valor muda o SELO, nunca a resolução.
  it("offline (semente) sem categoria resolve a MESMA entrada — só a origem do selo muda", () => {
    const online = resolveSlot(catalog, "SHOPEE", "PADRAO");
    const selo = (source: "seed" | "catalog") =>
      feeSealState({
        entry: online.entry,
        source,
        now: reviewedMs,
        edited: false,
        viaCatchAll: online.viaCatchAll,
      });
    expect(selo("seed")).toMatchObject({ kind: "reference", embedded: true });
    expect(selo("catalog")).toMatchObject({ kind: "reference", embedded: false });
  });
});

// 016/PR-F (T060/T063/T065/T067) — o efeito no PREÇO da curadoria desta fatia, medido contra o
// ARTEFATO REAL e passando pelo mapeamento que o app usa (`entryToChannelFees` → `grossUp`).
//
// Por que aqui e não no `fee-catalog.test.ts`: aquele prova o DADO (valores e forma). Este prova que
// o dado ATRAVESSA — e ADR-0027 §5 nomeia o trajeto perder um campo como O risco da mudança, não a
// aritmética. Um teste que só lê o JSON seria cego a um `entryToChannelFees` que descarta a regra.
describe("016/PR-F — a curadoria chega ao PREÇO (artefato real → motor)", () => {
  const artefato = parseFeeCatalog(
    JSON.parse(
      readFileSync(
        new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  const feesDe = (marketplace: MarketplaceId, modality: string, category?: string) =>
    entryToChannelFees(resolveSlot(artefato, marketplace, modality, category).entry!);

  describe("Amazon US14 — o plano Individual sobe EXATAMENTE R$ 2,00 antes do markup", () => {
    it("catch-all: a diferença entre os planos é o gross-up de R$ 2,00, e nada mais", () => {
      const prof = feesDe("AMAZON", "PROFISSIONAL");
      const ind = feesDe("AMAZON", "INDIVIDUAL");
      // Mesma comissão (a tabela não varia por plano) — é isso que isola a variável.
      expect(ind.commissionPct).toBe(prof.commissionPct);
      expect(ind.fixedFee - prof.fixedFee).toBe(2);
      // base 41,33 · 15% · o fixo entra ANTES do gross-up: (41,33 + 2) / 0,85 − 41,33 / 0,85.
      const a = grossUp(41.33, prof);
      const b = grossUp(41.33, ind);
      expect(a.anuncio).toBe(48.62);
      expect(b.anuncio).toBe(50.98);
      // O líquido continua entregando a base: o R$ 2,00 é custo, não margem.
      expect(b.liquido).toBe(41.33);
      // A subida é o valor grossed-up, não os R$ 2,00 crus — e é por isso que o teste crava a
      // divisão e não a subtração: 2,00 / 0,85 = 2,3529… → o par 48,62 → 50,98 acima.
      expect(Number((b.anuncio! - a.anuncio!).toFixed(2))).toBe(2.36);
    });

    it("categoria BANDADA (progressiva): os R$ 2,00 cobram UMA vez, não uma por banda", () => {
      const ind = feesDe("AMAZON", "INDIVIDUAL", "acessorios-eletronicos");
      const prof = feesDe("AMAZON", "PROFISSIONAL", "acessorios-eletronicos");
      expect(ind.bandMode).toBe("PROGRESSIVE");
      expect(ind.priceBands?.every((b) => b.fixedFee === 2)).toBe(true);
      const semFixo = grossUp(300, prof);
      const comFixo = grossUp(300, ind);
      // Uma cobrança só: a diferença é 2,00 grossed-up pela alíquota da banda que contém o anúncio
      // (10% no excedente ⇒ 2 / 0,90 = 2,22), NÃO 4,00 nem 2 × nº de bandas.
      expect(Number((comFixo.anuncio! - semFixo.anuncio!).toFixed(2))).toBe(2.22);
      expect(comFixo.liquido).toBe(300);
    });

    it("o Profissional não se mexeu — nenhum fixo, em entrada plana ou bandada", () => {
      expect(feesDe("AMAZON", "PROFISSIONAL").fixedFee).toBe(0);
      expect(
        feesDe("AMAZON", "PROFISSIONAL", "acessorios-eletronicos").priceBands?.every(
          (b) => b.fixedFee === 0,
        ),
      ).toBe(true);
    });
  });

  describe("Shopee US18 — a partição em R$ 8 atravessa o catálogo servido", () => {
    const shopee = feesDe("SHOPEE", "PADRAO");

    it("a REGRA sobreviveu ao mapeamento (o campo não se perdeu no trajeto)", () => {
      expect(shopee.priceBands?.[0]?.fixedFeeRule).toEqual({ kind: "PCT_OF_PRICE", pct: 50 });
    });

    it("abaixo de R$ 8 o adicional é metade do anúncio: base 1,50 → 5,00 (frete à parte)", () => {
      // L = 1,50 / (1 − 0,20 − 0,50) = 5,00. O voucher de frete co-financiado é deduzido DEPOIS,
      // então o líquido aqui vem abaixo da base — de propósito, e é o comportamento de hoje.
      const r = grossUp(1.5, shopee);
      expect(r.anuncio).toBe(5);
      expect(r.appliedBand).toEqual([0, 8]);
    });

    it("varredura do limiar: o anúncio é contínuo e a banda SEMPRE contém o anúncio", () => {
      let anterior = 0;
      const fora: number[] = [];
      for (let c = 30; c <= 2000; c += 1) {
        const base = c / 100;
        const r = grossUp(base, shopee);
        expect(r.anuncio).not.toBeNull();
        if (r.anuncio! < anterior) fora.push(base);
        anterior = r.anuncio!;
        const [min, max] = r.appliedBand!;
        expect(r.anuncio!).toBeGreaterThanOrEqual(min);
        if (max !== null) expect(r.anuncio!).toBeLessThan(max);
      }
      expect(fora).toEqual([]);
    });

    it("acima do limiar nada mudou: base 41,33 continua em R$ 56,66 na banda [8,80)", () => {
      const r = grossUp(41.33, shopee);
      expect(r.anuncio).toBe(56.66);
      expect(r.appliedBand).toEqual([8, 80]);
    });
  });

  describe("Shopee US17 — o perfil CPF de alto volume, e o I9 abaixo de R$ 12", () => {
    // O slot de HOJE: sem perfil respondido ele resolve o catch-all, e é isso que a US17 preserva.
    const semPerfil = feesDe("SHOPEE", "PADRAO");

    it("o determinante do perfil resolve a OUTRA entrada, com os R$ 3,00 somados", () => {
      const entrada = resolveEntry(artefato, "SHOPEE", { sellerProfile: "CPF_ALTO_VOLUME" })!;
      expect(entrada.priceBands?.[0]?.fixedFee).toBe(7);
      // E a entrada de hoje (sem perfil respondido) segue sendo a catch-all, intocada: é isso que
      // mantém byte-idêntico todo documento salvo (FR-926, última cláusula).
      expect(semPerfil.priceBands?.[0]?.fixedFee).toBe(0);
      expect(resolveEntry(artefato, "SHOPEE", null)?.determinants).toBeNull();
    });

    it("uma base que não alcança R$ 12 fica SEM referência — nunca empurrada até o piso", () => {
      const fees = entryToChannelFees(
        resolveEntry(artefato, "SHOPEE", { sellerProfile: "CPF_ALTO_VOLUME" })!,
      );
      const r = grossUp(1.5, fees);
      expect(r.anuncio).toBeNull();
      expect(r.liquido).toBeNull();
      expect(r.appliedBand).toBeNull();
      // E uma base que alcança precifica normalmente: (10 + 7) / 0,80 = 21,25.
      expect(grossUp(10, fees).anuncio).toBe(21.25);
    });
  });

  // 016/PR-F homologação (A1) — a entrada BANDADA passa a ter um placeholder que diz a verdade: a
  // banda que o motor REALMENTE aplicou, lida de volta do MESMO array `priceBands` (nunca um segundo
  // preço calculado aqui).
  describe("appliedBandFees — a banda aplicada por trás do placeholder (A1)", () => {
    it("Shopee catch-all: banda [8,80) → 20% e R$ 4,00 (base 41,33 → anúncio 56,66)", () => {
      const fees = feesDe("SHOPEE", "PADRAO");
      const applied = appliedBandFees(fees, 41.33);
      expect(applied).toEqual({ commissionPct: 20, fixedFee: 4, fixedFeeRulePct: null });
    });

    it("Shopee CPF_ALTO_VOLUME: banda [12,80) → 20% e R$ 7,00 (base 10 → anúncio 21,25)", () => {
      const fees = entryToChannelFees(
        resolveEntry(artefato, "SHOPEE", { sellerProfile: "CPF_ALTO_VOLUME" })!,
      );
      const applied = appliedBandFees(fees, 10);
      expect(applied).toEqual({ commissionPct: 20, fixedFee: 7, fixedFeeRulePct: null });
    });

    it("abaixo de R$ 8: o fixo RESOLVIDO é metade do anúncio, não a regra crua (base 1,50 → anúncio 5,00 → fixo 2,50)", () => {
      const fees = feesDe("SHOPEE", "PADRAO");
      const applied = appliedBandFees(fees, 1.5);
      expect(applied).toEqual({ commissionPct: 20, fixedFee: 2.5, fixedFeeRulePct: 50 });
    });

    it("Amazon INDIVIDUAL sem categoria (entrada de valor único, não bandada) → null, o caminho antigo continua", () => {
      const fees = feesDe("AMAZON", "INDIVIDUAL");
      expect(fees.priceBands).toBeUndefined();
      expect(appliedBandFees(fees, 41.33)).toBeNull();
      // O caminho de hoje (015/A8) continua respondendo por este caso: 15% / R$ 2,00 / R$ 1,00.
      expect(fees.commissionPct).toBe(15);
      expect(fees.fixedFee).toBe(2);
      expect(fees.minPerItem).toBe(1);
    });

    it("uma base SEM referência (fora da tabela) devolve null — nunca um preço inventado", () => {
      const fees = entryToChannelFees(
        resolveEntry(artefato, "SHOPEE", { sellerProfile: "CPF_ALTO_VOLUME" })!,
      );
      expect(appliedBandFees(fees, 1.5)).toBeNull();
    });
  });
});

// 016/PR-F (T061/T064-UI/T065-UI) — o SEAM do formulário: as DUAS perguntas da tela viram o
// determinante ÚNICO que a fee-prefill.ts:slotDeterminants já sabia ler (RA5 — um mapeamento só).
describe("resolveShopeeSellerProfile — o mapeamento das DUAS perguntas (US17, FR-926, T057)", () => {
  it("CPF + mais de 450 pedidos/90 dias → CPF_ALTO_VOLUME", () => {
    expect(resolveShopeeSellerProfile("CPF", "SIM")).toBe("CPF_ALTO_VOLUME");
  });

  it.each([
    ["CNPJ", "SIM"],
    ["CNPJ", "NAO"],
    ["CNPJ", ""],
    ["CPF", "NAO"],
    ["CPF", ""],
    ["", "SIM"],
    ["", ""],
    [undefined, undefined],
  ] as const)("%s + %s → catch-all (null), byte-idêntico", (sellerType, highVolume) => {
    expect(resolveShopeeSellerProfile(sellerType, highVolume)).toBeNull();
  });
});

describe("slotDeterminants — o perfil Shopee (US17, RA5)", () => {
  it("Shopee sem perfil respondido continua null — o slot de hoje, intocado", () => {
    expect(slotDeterminants("SHOPEE", "", undefined, null)).toBeNull();
    expect(slotDeterminants("SHOPEE", "")).toBeNull();
  });

  it("Shopee com sellerProfile resolvido vira o determinante — e SÓ ele (Shopee não tem modalidade)", () => {
    expect(slotDeterminants("SHOPEE", "", undefined, "CPF_ALTO_VOLUME")).toEqual({
      sellerProfile: "CPF_ALTO_VOLUME",
    });
  });

  it("um sellerProfile passado para outro marketplace é ignorado — o eixo é da Shopee", () => {
    expect(slotDeterminants("MERCADO_LIVRE", "CLASSICO", undefined, "CPF_ALTO_VOLUME")).toEqual({
      listingType: "CLASSICO",
    });
  });
});

describe("resolveSlot — sellerType/highVolume chegam ao resolvedor (US17)", () => {
  const artefato = parseFeeCatalog(
    JSON.parse(
      readFileSync(
        new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
        "utf8",
      ),
    ),
  );

  it("CPF + SIM resolve a entrada CPF_ALTO_VOLUME (bandas em R$ 7 de fixo)", () => {
    const r = resolveSlot(artefato, "SHOPEE", "", undefined, "CPF", "SIM");
    expect(r.entry?.determinants).toEqual({ sellerProfile: "CPF_ALTO_VOLUME" });
    expect(r.entry?.priceBands?.[0]?.fixedFee).toBe(7);
  });

  it("CNPJ + SIM (o eixo não existe para CNPJ) resolve o catch-all — byte-idêntico", () => {
    const r = resolveSlot(artefato, "SHOPEE", "", undefined, "CNPJ", "SIM");
    expect(r.entry?.determinants).toBeNull();
  });

  it("CPF + NAO resolve o catch-all — a fonte publica que o adicional NÃO se aplica sem volume", () => {
    const r = resolveSlot(artefato, "SHOPEE", "", undefined, "CPF", "NAO");
    expect(r.entry?.determinants).toBeNull();
  });

  it("nenhuma resposta (documento salvo antes do campo existir) resolve o catch-all", () => {
    const r = resolveSlot(artefato, "SHOPEE", "");
    expect(r.entry?.determinants).toBeNull();
  });
});

describe("resolveSurcharges — os ids marcados viram {label, value} do catálogo (US16, FR-923)", () => {
  const artefato = parseFeeCatalog(
    JSON.parse(
      readFileSync(
        new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
        "utf8",
      ),
    ),
  );

  it("MANUSEIO_VOLUMOSO marcado resolve R$ 50,00, com o rótulo do catálogo", () => {
    const out = resolveSurcharges(artefato, "SHOPEE", ["MANUSEIO_VOLUMOSO"]);
    expect(out).toEqual([{ label: "Manuseio de item volumoso", value: 50 }]);
  });

  it("ids vazios/ausentes resolvem lista vazia — byte-idêntico (US16-AC2)", () => {
    expect(resolveSurcharges(artefato, "SHOPEE", [])).toEqual([]);
    expect(resolveSurcharges(artefato, "SHOPEE", undefined)).toEqual([]);
  });

  it("um id que o catálogo não publica (mais) é DROPADO, nunca inventado", () => {
    expect(resolveSurcharges(artefato, "SHOPEE", ["ID_QUE_NAO_EXISTE"])).toEqual([]);
  });

  it("um marketplace sem optionalSurcharges (Amazon) resolve lista vazia para qualquer id", () => {
    expect(resolveSurcharges(artefato, "AMAZON", ["MANUSEIO_VOLUMOSO"])).toEqual([]);
  });
});
