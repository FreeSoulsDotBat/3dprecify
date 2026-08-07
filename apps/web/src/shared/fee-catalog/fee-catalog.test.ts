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
  resolveFreightSubsidyCeiling,
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

// 016/PR-F — o DADO servido, lido do artefato commitado. Estas asserções são sobre o CATÁLOGO
// (valores e forma); o efeito no PREÇO é provado em `features/calculator/fee-prefill.test.ts`, onde
// o mapeamento para o motor mora.
describe("016/PR-F — a curadoria desta fatia no artefato servido", () => {
  const served = parseFeeCatalog(servedCatalog);
  const mk = (id: string) => served.marketplaces.find((m) => m.marketplace === id)!;

  it("catalogVersion bumpou UMA vez, e o seed carrega o mesmo rótulo", () => {
    // O rótulo viaja congelado dentro de um snapshot imutável (ADR-0019): dois conteúdos sob o
    // mesmo rótulo ficam ambíguos para sempre. Foi o defeito medido em 014.
    // hotfix 016/A2 (2026-08-07): re-baseline de "2026-08-06.1" — as duas entradas Shopee perderam
    // o `BAND_VOUCHER` e o marketplace ganhou `freightSubsidyInfo`. UM bump pelo hotfix inteiro,
    // decidido por `nextCatalogVersion("2026-08-06.1", "2026-08-07", true)`.
    expect(served.catalogVersion).toBe("2026-08-07.0");
    expect(FEE_CATALOG_SEED.catalogVersion).toBe(served.catalogVersion);
  });

  describe("Shopee — a banda partida em R$ 8 (US18) e o perfil (US17)", () => {
    const shopee = mk("SHOPEE");
    const catchAll = shopee.entries.find((e) => e.determinants === null)!;
    const cpf = shopee.entries.find((e) => e.determinants?.sellerProfile === "CPF_ALTO_VOLUME")!;

    it("DUAS entradas, não três — o CPF de baixo volume paga a tabela do catch-all (T057)", () => {
      expect(shopee.entries).toHaveLength(2);
      expect(shopee.determinantsSchema).toEqual({ sellerProfile: ["CPF_ALTO_VOLUME"] });
    });

    it("a banda [0,80) virou [0,8) com a regra + [8,80) com os R$ 4 constantes", () => {
      expect(catchAll.priceBands?.slice(0, 2)).toEqual([
        {
          minPrice: 0,
          maxPrice: 8,
          commissionPct: 20,
          fixedFee: 0,
          fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
        },
        { minPrice: 8, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
      ]);
      // A comissão de 20% CONTINUA incidindo abaixo de R$ 8 — é a leitura verbatim do art. 26839
      // (T057) e o oposto do que o OBTENCAO-DINAMICA §8 dizia ("50% sem fixo"), que estava errado.
      expect(catchAll.priceBands?.[0]?.commissionPct).toBe(20);
    });

    it("as bandas de cima ficaram INTOCADAS (a partição não é uma recuradoria)", () => {
      expect(catchAll.priceBands?.slice(2)).toEqual([
        { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 16 },
        { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
        { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
      ]);
    });

    it("CPF alto volume = a tabela do catch-all com +R$ 3,00 no fixo de CADA banda", () => {
      const acima8 = catchAll.priceBands!.filter((b) => b.minPrice >= 8);
      expect(cpf.priceBands).toHaveLength(acima8.length);
      cpf.priceBands!.forEach((b, i) => {
        expect(b.commissionPct).toBe(acima8[i]!.commissionPct);
        expect(b.fixedFee).toBe(acima8[i]!.fixedFee! + 3);
      });
    });

    it("as bandas do CPF começam em R$ 12 e NÃO herdam a partição de R$ 8 (§9.5)", () => {
      // A tabela + R$ 3 daria R$ 7,00 de taxa num item de R$ 9, e a fonte publica R$ 6,00 num de
      // R$ 8 — a regressiva existe e a fórmula NÃO é publicada. Precificar ali mentiria sob selo.
      expect(cpf.priceBands?.[0]?.minPrice).toBe(12);
      expect(cpf.priceBands?.some((b) => b.fixedFeeRule != null)).toBe(false);
      expect(cpf.priceBands?.some((b) => b.minPrice < 12)).toBe(false);
    });

    // hotfix 016/A2 (2026-08-07) — o subsídio migrou de ARITMÉTICA para INFORMAÇÃO.
    describe("o subsídio de frete é informação, não parcela da conta", () => {
      it("as duas entradas declaram `freight: {kind:'NONE'}` — nenhum voucher emitido", () => {
        for (const e of shopee.entries) expect(e.freight).toEqual({ kind: "NONE" });
      });

      it("o marketplace publica `freightSubsidyInfo` com os tetos e a procedência do art. 23431", () => {
        // Os números vivem no DADO e nunca no código (Constituição II): a legenda da tela lê daqui.
        expect(shopee.freightSubsidyInfo).toEqual({
          bands: [
            { minPrice: 0, maxPrice: 80, ceiling: 20 },
            { minPrice: 80, maxPrice: 200, ceiling: 30 },
            { minPrice: 200, maxPrice: null, ceiling: 40 },
          ],
          source: expect.stringContaining("Shopee") as unknown as string,
          sourceUrl: "https://seller.shopee.com.br/edu/article/23431",
          effectiveDate: "2026-03-01",
          lastReviewed: "2026-08-07",
        });
      });

      it("um catálogo SEM o campo parseia idêntico (compatibilidade retroativa)", () => {
        // A propriedade que fez do subsídio um CAMPO NOVO e não um `kind` do union `freight`: um
        // cliente antigo descarta a propriedade extra e continua lendo o catálogo inteiro. Aqui a
        // simetria: um catálogo antigo (sem o campo) continua válido para o cliente novo.
        const semCampo = structuredClone(servedCatalog) as {
          marketplaces: Record<string, unknown>[];
        };
        for (const m of semCampo.marketplaces) delete m.freightSubsidyInfo;
        const parsed = parseFeeCatalog(semCampo);
        const shopeeSemCampo = parsed.marketplaces.find((m) => m.marketplace === "SHOPEE")!;
        expect(shopeeSemCampo.freightSubsidyInfo ?? null).toBeNull();
        // E o resto do documento é IGUAL — o campo não carrega nada de que outra folha dependa.
        expect({ ...shopeeSemCampo, freightSubsidyInfo: undefined }).toEqual({
          ...shopee,
          freightSubsidyInfo: undefined,
        });
      });

      it("`null` explícito é aceito (é como o backend serializa a ausência)", () => {
        // `nullish` e não `optional`: um schema que só tolera `undefined` RECUSARIA o payload
        // servido, e a recusa aqui é SILENCIOSA (cai no seed embutido e ninguém vê erro).
        const comNull = structuredClone(servedCatalog) as {
          marketplaces: Record<string, unknown>[];
        };
        for (const m of comNull.marketplaces) m.freightSubsidyInfo = null;
        expect(() => parseFeeCatalog(comNull)).not.toThrow();
      });
    });

    // hotfix 016/A2 (H2c) — a leitura, PURA, que a legenda usa: qual teto vale para o preço da tela.
    describe("resolveFreightSubsidyCeiling — a faixa do anúncio decide o teto exibido", () => {
      it("resolve o teto certo em cada faixa publicada (half-open, lower-inclusive)", () => {
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 0)).toBe(20);
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 79.99)).toBe(20);
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 80)).toBe(30); // a virada
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 199.99)).toBe(30);
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 200)).toBe(40);
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 5000)).toBe(40); // faixa aberta
      });

      it("null quando o campo não existe — a legenda não inventa um teto", () => {
        expect(resolveFreightSubsidyCeiling(null, 50)).toBeNull();
        expect(resolveFreightSubsidyCeiling(undefined, 50)).toBeNull();
      });

      it("null para um preço fora de qualquer faixa publicada (ex.: negativo)", () => {
        expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, -1)).toBeNull();
      });
    });

    it("o volumoso é R$ 50,00 POR PEDIDO, com fonte própria (art. 3305)", () => {
      expect(shopee.optionalSurcharges).toEqual([
        {
          id: "MANUSEIO_VOLUMOSO",
          label: "Manuseio de item volumoso",
          value: 50,
          appliesPer: "ORDER",
          source: expect.stringContaining("Shopee") as unknown as string,
          sourceUrl: "https://seller.shopee.com.br/edu/article/3305",
          effectiveDate: "2026-02-02",
          lastReviewed: "2026-08-06",
        },
      ]);
    });
  });

  describe("Amazon — a cobrança por item do plano Individual (US14)", () => {
    const amazon = mk("AMAZON");
    const individual = amazon.entries.filter((e) => e.determinants?.plan === "INDIVIDUAL");
    const profissional = amazon.entries.filter((e) => e.determinants?.plan === "PROFISSIONAL");

    it("toda entrada INDIVIDUAL cobra R$ 2,00 de fixo, com procedência própria", () => {
      expect(individual.length).toBeGreaterThan(0);
      for (const e of individual) {
        expect(e.fixedFee).toBe(2);
        expect(e.fixedFeeSource?.sourceUrl).toBe("https://venda.amazon.com.br/precos");
        // A procedência é OUTRA que a da entrada de propósito: o R$ 2,00 não está na página de
        // comissões, e apontar para ela seria mandar o vendedor a um lugar sem o número dele.
        expect(e.fixedFeeSource?.sourceUrl).not.toBe(e.sourceUrl);
      }
    });

    it("a banda também carrega os R$ 2,00 — senão o fixo do topo seria INERTE (013/F1)", () => {
      const bandadas = individual.filter((e) => (e.priceBands?.length ?? 0) > 0);
      expect(bandadas.length).toBeGreaterThan(0);
      for (const e of bandadas) {
        for (const b of e.priceBands!) expect(b.fixedFee).toBe(2);
      }
    });

    it("o plano Profissional fica INTOCADO — os R$ 19/mês não são custo por item", () => {
      expect(profissional.length).toBe(individual.length);
      for (const e of profissional) {
        expect(e.fixedFee).toBe(0);
        expect(e.fixedFeeSource ?? null).toBeNull();
        for (const b of e.priceBands ?? []) expect(b.fixedFee).toBe(0);
      }
    });

    it("`minPerItem` continua R$ 1,00 uniforme (D7 não foi reaberto)", () => {
      for (const e of amazon.entries) expect(e.minPerItem).toBe(1);
    });

    // 016/PR-F homologação (A4) — o texto de `fixedFeeSource.source` não repete a vigência: o
    // `FixedFeeSourceBadge` já imprime `effectiveDate` estruturado como "vigente desde dd/mm/aaaa",
    // então um parêntese com "vigente desde…" DENTRO da string vira "vigente desde X · vigente desde
    // X" no selo — a mesma informação dita duas vezes. A data continua medida e citada, só que uma
    // vez só, no campo estruturado que já existe para isso.
    it("`fixedFeeSource.source` não repete a vigência (o campo estruturado já a diz)", () => {
      for (const e of individual) {
        expect(e.fixedFeeSource?.source ?? "").not.toMatch(/vigente desde/i);
      }
    });
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

  // 016/US12 (T053, FR-928, arquitetura §9.4) — the F3 guard mirrored onto `fixedFee`: a band whose
  // fixedFee is null resolves to R$ 0,00 under a "Referência" seal (`entryToChannelFees`'s old
  // `b.fixedFee ?? 0`), which is the exact same class of defect the commissionPct guard exists to
  // catch. No `fixedFeeRule` escape hatch exists yet (that is PR-F) — every band published TODAY
  // must carry its own numeric fixedFee.
  it("rejects a banded entry whose BAND carries a null fixedFee (R$ 0,00 under a reference seal)", () => {
    const nullFixedFeeBand = {
      ...base,
      commissionPct: null,
      fixedFee: null,
      priceBands: [{ minPrice: 0, maxPrice: null, commissionPct: 14, fixedFee: null }],
    };
    expect(() => feeEntrySchema.parse(nullFixedFeeBand)).toThrow();
  });

  // 016/PR-F (US18, FR-927, ADR-0027 §3.1) — a taxa fixa como FUNÇÃO do preço.
  describe("fixedFeeRule (ADR-0027 §3.1)", () => {
    const banded = (band: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
      ...base,
      commissionPct: null,
      fixedFee: null,
      priceBands: [band],
      ...extra,
    });
    const rule = { kind: "PCT_OF_PRICE", pct: 50 };

    it("aceita a forma que a Shopee publica: 20% + metade do preço abaixo de R$ 8", () => {
      expect(() =>
        feeEntrySchema.parse(
          banded({ minPrice: 0, maxPrice: 8, commissionPct: 20, fixedFee: 0, fixedFeeRule: rule }),
        ),
      ).not.toThrow();
    });

    it("aceita a AUSÊNCIA e o null explícito (o backend serializa ausente como null)", () => {
      const plain = { minPrice: 0, maxPrice: null, commissionPct: 20, fixedFee: 4 };
      expect(() => feeEntrySchema.parse(banded(plain))).not.toThrow();
      expect(() => feeEntrySchema.parse(banded({ ...plain, fixedFeeRule: null }))).not.toThrow();
    });

    it("recusa um pct fora de (0, 100) — 0 e 100 inclusive", () => {
      for (const pct of [0, 100, -1, 120]) {
        expect(() =>
          feeEntrySchema.parse(
            banded({
              minPrice: 0,
              maxPrice: 8,
              commissionPct: 20,
              fixedFee: 0,
              fixedFeeRule: { kind: "PCT_OF_PRICE", pct },
            }),
          ),
        ).toThrow();
      }
    });

    it("recusa commissionPct + pct >= 100 (o gross-up não teria solução)", () => {
      expect(() =>
        feeEntrySchema.parse(
          banded({
            minPrice: 0,
            maxPrice: 8,
            commissionPct: 60,
            fixedFee: 0,
            fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 40 },
          }),
        ),
      ).toThrow();
    });

    it("recusa a regra numa entrada PROGRESSIVE — 'metade do preço' não é uma fatia", () => {
      expect(() =>
        feeEntrySchema.parse(
          banded(
            { minPrice: 0, maxPrice: 8, commissionPct: 20, fixedFee: 0, fixedFeeRule: rule },
            { bandMode: "PROGRESSIVE" },
          ),
        ),
      ).toThrow();
      // E a MESMA entrada em SELECTION passa: a recusa é sobre o modo, não sobre a forma da banda.
      expect(() =>
        feeEntrySchema.parse(
          banded(
            { minPrice: 0, maxPrice: 8, commissionPct: 20, fixedFee: 0, fixedFeeRule: rule },
            { bandMode: "SELECTION" },
          ),
        ),
      ).not.toThrow();
    });

    it("um `kind` desconhecido é recusado — não existe regra que o motor não saiba cobrar", () => {
      expect(() =>
        feeEntrySchema.parse(
          banded({
            minPrice: 0,
            maxPrice: 8,
            commissionPct: 20,
            fixedFee: 0,
            fixedFeeRule: { kind: "PCT_OF_COST", pct: 50 },
          }),
        ),
      ).toThrow();
    });
  });

  // 016/US14 — procedência própria do fixo.
  describe("fixedFeeSource (US14)", () => {
    it("aceita a procedência própria do fixo, e a ausência dela", () => {
      expect(() => feeEntrySchema.parse(base)).not.toThrow();
      expect(() =>
        feeEntrySchema.parse({
          ...base,
          fixedFeeSource: {
            source: "Amazon — Preços e planos",
            sourceUrl: "https://venda.amazon.com.br/precos",
            effectiveDate: "2020-12-01",
          },
        }),
      ).not.toThrow();
    });

    it("recusa uma procedência sem URL — uma procedência que não procede é pior que nenhuma", () => {
      expect(() =>
        feeEntrySchema.parse({
          ...base,
          fixedFeeSource: { source: "de algum lugar", sourceUrl: "", effectiveDate: "2020-12-01" },
        }),
      ).toThrow();
    });
  });
});

// 016/US16 (FR-923, ADR-0027 §3.2) — a sobretaxa opcional vive no MARKETPLACE.
describe("optionalSurcharges (US16)", () => {
  const doc = (optionalSurcharges: unknown) => ({
    catalogVersion: "2026-08-06.t",
    schemaVersion: SCHEMA_VERSION,
    generatedAt: "2026-08-06T00:00:00.000Z",
    marketplaces: [{ marketplace: "SHOPEE", optionalSurcharges, entries: [] }],
  });
  const volumoso = {
    id: "MANUSEIO_VOLUMOSO",
    label: "Manuseio de item volumoso",
    value: 50,
    appliesPer: "ORDER",
    source: "Shopee art. 3305",
    sourceUrl: "https://seller.shopee.com.br/edu/article/3305",
    effectiveDate: "2026-02-02",
    lastReviewed: "2026-08-06",
  };

  it("aceita a sobretaxa publicada, e aceita ausente/null (= nenhuma, byte-idêntico)", () => {
    expect(() => feeCatalogSchema.parse(doc([volumoso]))).not.toThrow();
    expect(() => feeCatalogSchema.parse(doc(null))).not.toThrow();
    expect(() => feeCatalogSchema.parse(doc(undefined))).not.toThrow();
  });

  it("exige procedência — o valor é dinheiro e não pode existir sem fonte (Constituição II)", () => {
    for (const campo of ["sourceUrl", "source", "effectiveDate", "lastReviewed"]) {
      const semCampo: Record<string, unknown> = { ...volumoso };
      delete semCampo[campo];
      expect(() => feeCatalogSchema.parse(doc([semCampo]))).toThrow();
    }
  });

  it("recusa um `appliesPer` fora do par publicado (a legenda não pode ser inventada)", () => {
    expect(() => feeCatalogSchema.parse(doc([{ ...volumoso, appliesPer: "MES" }]))).toThrow();
  });

  it("recusa dois `id` iguais — o valor resolvido dependeria da ordem do arquivo", () => {
    expect(() => feeCatalogSchema.parse(doc([volumoso, { ...volumoso, value: 80 }]))).toThrow();
  });

  it("recusa um valor negativo", () => {
    expect(() => feeCatalogSchema.parse(doc([{ ...volumoso, value: -1 }]))).toThrow();
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
