import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { type CatalogSlice, aplicarFatia } from "./slice.ts";

// O ARTEFATO REAL, não uma fixture parecida: a folha que este teste protege (`freightSubsidyInfo`)
// só existe porque o hotfix 016/A2 a criou, e um teste escrito sobre uma cópia à mão perderia a
// próxima folha que a curadoria acrescentar (foi assim que o A2 nasceu — `BAND_VOUCHER` descontando
// R$ 20 do líquido do vendedor sem um campo que o declarasse).
const base = JSON.parse(
  readFileSync(new URL("../../../backend/app/data/catalog.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const secaoDe = (cat: Record<string, unknown>, mk: string) =>
  (cat.marketplaces as Record<string, unknown>[]).find((m) => m.marketplace === mk)!;

describe("aplicarFatia — a REGRA DA FOLHA LIDA (ADR-0028 §3)", () => {
  // ── O caso central do data-model §7: o teste ANTI-REVERSÃO do hotfix A2 ───────────────────────
  //
  // O PNG do art. 26839 contém a tabela de comissão e NADA MAIS. Um coletor Shopee que regenerasse o
  // marketplace inteiro apagaria `freight`, `freightSubsidyInfo` e `optionalSurcharges` — devolvendo
  // ao líquido do vendedor o desconto de R$ 20 que o hotfix acabou de remover, em silêncio, na
  // primeira execução real do laço.
  const fatiaSoComissao: CatalogSlice = {
    marketplace: "SHOPEE",
    collectedAt: "2026-09-01",
    sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
    exhaustive: [],
    leaves: [
      {
        level: "ENTRY",
        determinants: null,
        field: "priceBands",
        value: [
          { minPrice: 0, maxPrice: 8, commissionPct: 20, fixedFee: 0 },
          { minPrice: 8, maxPrice: null, commissionPct: 21, fixedFee: 4 },
        ],
      },
      { level: "ENTRY", determinants: null, field: "lastReviewed", value: "2026-09-01" },
    ],
  };

  const aplicada = aplicarFatia(base, fatiaSoComissao);

  it("aplica a folha que o coletor DECLAROU ter lido", () => {
    expect(aplicada.ok).toBe(true);
    const shopee = secaoDe(aplicada.ok ? aplicada.catalog : base, "SHOPEE");
    const catchAll = (shopee.entries as Record<string, unknown>[]).find(
      (e) => e.determinants === null,
    )!;
    expect((catchAll.priceBands as unknown[]).length).toBe(2);
    expect(catchAll.lastReviewed).toBe("2026-09-01");
  });

  it("o `freightSubsidyInfo` do marketplace fica BYTE-IDÊNTICO — a reversão do A2 é impossível", () => {
    const antes = secaoDe(base, "SHOPEE").freightSubsidyInfo;
    const depois = secaoDe(aplicada.ok ? aplicada.catalog : base, "SHOPEE").freightSubsidyInfo;
    expect(JSON.stringify(depois)).toBe(JSON.stringify(antes));
    // e ele existe de verdade — senão as duas comparações acima seriam `undefined === undefined`
    expect(antes).toBeDefined();
  });

  it("`optionalSurcharges` e `freight: NONE` também ficam byte-idênticos", () => {
    const antes = secaoDe(base, "SHOPEE");
    const depois = secaoDe(aplicada.ok ? aplicada.catalog : base, "SHOPEE");
    expect(JSON.stringify(depois.optionalSurcharges)).toBe(
      JSON.stringify(antes.optionalSurcharges),
    );
    expect(antes.optionalSurcharges).toBeDefined();
    const catchAllAntes = (antes.entries as Record<string, unknown>[])[0]!;
    const catchAllDepois = (depois.entries as Record<string, unknown>[])[0]!;
    expect(JSON.stringify(catchAllDepois.freight)).toBe(JSON.stringify(catchAllAntes.freight));
    expect(catchAllAntes.freight).toEqual({ kind: "NONE" });
  });

  it("os OUTROS marketplaces não são tocados", () => {
    const depois = aplicada.ok ? aplicada.catalog : base;
    for (const mk of ["AMAZON", "MERCADO_LIVRE"]) {
      expect(JSON.stringify(secaoDe(depois, mk))).toBe(JSON.stringify(secaoDe(base, mk)));
    }
  });

  it("a entrada IRMÃ (CPF_ALTO_VOLUME), que a fatia não endereçou, fica byte-idêntica", () => {
    const irmaAntes = (secaoDe(base, "SHOPEE").entries as Record<string, unknown>[])[1]!;
    const irmaDepois = (
      secaoDe(aplicada.ok ? aplicada.catalog : base, "SHOPEE").entries as Record<string, unknown>[]
    )[1]!;
    expect(JSON.stringify(irmaDepois)).toBe(JSON.stringify(irmaAntes));
  });
});

describe("aplicarFatia — PONTO FIXO (I9 estendido a cada fonte nova)", () => {
  it("fatia VAZIA ⇒ artefato byte-idêntico", () => {
    const r = aplicarFatia(base, {
      marketplace: "SHOPEE",
      collectedAt: "2026-09-01",
      sourceUrl: "https://exemplo",
      exhaustive: [],
      leaves: [],
    });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.ok ? r.catalog : null)).toBe(JSON.stringify(base));
  });

  it("fatia que reescreve os MESMOS valores ⇒ artefato byte-idêntico (fonte inalterada)", () => {
    const shopee = secaoDe(base, "SHOPEE");
    const catchAll = (shopee.entries as Record<string, unknown>[])[0]!;
    const r = aplicarFatia(base, {
      marketplace: "SHOPEE",
      collectedAt: "2026-08-06",
      sourceUrl: "https://exemplo",
      exhaustive: [],
      leaves: [
        { level: "ENTRY", determinants: null, field: "priceBands", value: catchAll.priceBands },
        {
          level: "ENTRY",
          determinants: null,
          field: "commissionPct",
          value: catchAll.commissionPct,
        },
        { level: "MARKETPLACE", field: "feeAxes", value: shopee.feeAxes },
      ],
    });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r.ok ? r.catalog : null)).toBe(JSON.stringify(base));
  });

  it("não muta a base — o chamador que a reusar não vê a escrita do vizinho", () => {
    const antes = JSON.stringify(base);
    aplicarFatia(base, {
      marketplace: "SHOPEE",
      collectedAt: "2026-09-01",
      sourceUrl: "https://exemplo",
      exhaustive: [],
      leaves: [{ level: "ENTRY", determinants: null, field: "commissionPct", value: 99 }],
    });
    expect(JSON.stringify(base)).toBe(antes);
  });
});

describe("aplicarFatia — folhas de nível de MARKETPLACE e entradas NOVAS", () => {
  it("uma folha de marketplace substitui só ela", () => {
    const r = aplicarFatia(base, {
      marketplace: "AMAZON",
      collectedAt: "2026-09-01",
      sourceUrl: "https://exemplo",
      exhaustive: [],
      leaves: [{ level: "MARKETPLACE", field: "feeAxes", value: ["commissionPct"] }],
    });
    expect(r.ok).toBe(true);
    const amazon = secaoDe(r.ok ? r.catalog : base, "AMAZON");
    expect(amazon.feeAxes).toEqual(["commissionPct"]);
    expect((amazon.entries as unknown[]).length).toBe(78);
  });

  it("determinantes que a base não tem viram entrada NOVA no fim da lista", () => {
    const r = aplicarFatia(base, {
      marketplace: "SHOPEE",
      collectedAt: "2026-09-01",
      sourceUrl: "https://exemplo",
      exhaustive: [],
      leaves: [
        {
          level: "ENTRY",
          determinants: { sellerProfile: "NOVO" },
          field: "commissionPct",
          value: 9,
        },
        { level: "ENTRY", determinants: { sellerProfile: "NOVO" }, field: "fixedFee", value: 1 },
      ],
    });
    expect(r.ok).toBe(true);
    const entries = secaoDe(r.ok ? r.catalog : base, "SHOPEE").entries as Record<string, unknown>[];
    expect(entries.length).toBe(3);
    expect(entries[2]).toEqual({
      determinants: { sellerProfile: "NOVO" },
      commissionPct: 9,
      fixedFee: 1,
    });
  });

  it("determinantes casam por CONTEÚDO, não por ordem de chave nem por identidade", () => {
    const r = aplicarFatia(
      {
        marketplaces: [
          {
            marketplace: "AMAZON",
            entries: [{ determinants: { plan: "PRO", category: "x" }, commissionPct: 1 }],
          },
        ],
      },
      {
        marketplace: "AMAZON",
        collectedAt: "2026-09-01",
        sourceUrl: "https://exemplo",
        exhaustive: [],
        leaves: [
          {
            level: "ENTRY",
            determinants: { category: "x", plan: "PRO" },
            field: "commissionPct",
            value: 2,
          },
        ],
      },
    );
    expect(r.ok).toBe(true);
    const entries = secaoDe(r.ok ? r.catalog : {}, "AMAZON").entries as Record<string, unknown>[];
    expect(entries.length).toBe(1);
    expect(entries[0]!.commissionPct).toBe(2);
  });
});

describe("aplicarFatia — falha FECHADO (uma fatia que não se aplica não vira meia escrita)", () => {
  it("marketplace ausente da base ⇒ recusa nomeando o caso, sem inventar seção", () => {
    const r = aplicarFatia(base, {
      marketplace: "AMERICANAS",
      collectedAt: "2026-09-01",
      sourceUrl: "https://exemplo",
      exhaustive: [],
      leaves: [{ level: "MARKETPLACE", field: "feeAxes", value: [] }],
    });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/AMERICANAS/);
  });

  it("artefato sem `marketplaces` ⇒ recusa em vez de estourar", () => {
    const r = aplicarFatia(
      {},
      {
        marketplace: "SHOPEE",
        collectedAt: "2026-09-01",
        sourceUrl: "https://exemplo",
        exhaustive: [],
        leaves: [],
      },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/marketplaces/);
  });

  it("uma seção cujo `entries` não é lista ⇒ recusa (forma quebrada não é dado)", () => {
    const r = aplicarFatia(
      { marketplaces: [{ marketplace: "SHOPEE", entries: "nada disso" }] },
      {
        marketplace: "SHOPEE",
        collectedAt: "2026-09-01",
        sourceUrl: "https://exemplo",
        exhaustive: [],
        leaves: [{ level: "ENTRY", determinants: null, field: "commissionPct", value: 1 }],
      },
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/entries/);
  });
});
