import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { type ChannelFees, grossUp } from "@3dprecify/pricing-core";
import { describe, it, expect } from "vitest";

import { entryToChannelFees } from "./fee-prefill";

import { type FeeCatalog, parseFeeCatalog } from "@/shared/fee-catalog/fee-catalog";
import { FEE_CATALOG_SEED } from "@/shared/fee-catalog/seed";

// Hotfix 016/A2 (2026-08-07) — A GUARDA ESTRUTURAL da regra que o achado A2 comprou:
//
//   **Nenhum valor entra na conta sem um controle na tela que o nomeie.**
//
// A forma verificável dela, para frete, é uma igualdade e não uma promessa: para TODA entrada de
// TODO marketplace do catálogo SERVIDO (e do seed embutido), o frete que o motor desconta é
// EXATAMENTE o frete que o campo carrega —
//
//   grossUp(base, entryToChannelFees(entrada)).freightCost === (fees.freightCost ?? 0)
//
// O defeito que ela existe para pegar é o A2 inteiro: as duas entradas Shopee declaravam
// `freight: {kind: "BAND_VOUCHER"}`, o motor descontava R$ 20/30/40 do líquido pela banda do
// anúncio, e o campo "Frete (opcional)" — que ESTÁ nos `feeAxes` da Shopee e portanto renderiza —
// exibia R$ 0,00. Vinte reais saíam da conta sem controle nenhum que os nomeasse: violação textual
// da FR-111b do 005, escrita em 2026-07-06 e nunca cumprida para a Shopee.
//
// Ela mora em `features/calculator` e não em `shared/fee-catalog` (onde o desenho a propôs) por uma
// razão estrutural: `entryToChannelFees` é o mapeamento catálogo→motor e vive AQUI, e o
// eslint-boundaries proíbe `shared` importar de `feature`. Testar a propriedade onde o mapeamento
// mora é, aliás, o lugar certo — é o mapeamento que pode reintroduzir o desconto.
//
// A guarda é PERMANENTE, não um teste de regressão desta fatia: ela fica vermelha no instante em
// que qualquer curadoria futura reintroduzir um desconto sem campo (provado por mutação — ver o
// último `describe`).

const catalogPath = fileURLToPath(
  new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
);
const servedCatalog: FeeCatalog = parseFeeCatalog(
  JSON.parse(readFileSync(catalogPath, "utf8")) as unknown,
);

// Uma varredura que atravessa TODA banda publicada hoje (Shopee parte em 8/80/100/200; a Amazon
// tem faixas progressivas em 200) e mais alguns pontos entre elas. O ponto não é a cobertura de
// banda em si — é que o voucher se resolve pelo ANÚNCIO, então bases diferentes caem em tetos
// diferentes e um único ponto de prova poderia passar por sorte.
const BASES = [1, 3, 7.5, 9, 25, 49.9, 79, 95, 120, 199, 250, 1000];

function everyEntry(catalog: FeeCatalog) {
  return catalog.marketplaces.flatMap((m) =>
    m.entries.map((entry, i) => ({
      marketplace: m.marketplace,
      label: `${m.marketplace}[${i}] ${JSON.stringify(entry.determinants)}`,
      entry,
    })),
  );
}

/** A propriedade, aplicada a UM conjunto de tarifas já resolvido. Devolve as violações. */
function violations(label: string, fees: ChannelFees): string[] {
  const declared = fees.freightCost ?? 0;
  const out: string[] = [];
  for (const base of BASES) {
    const level = grossUp(base, fees);
    // SC-817: um nível SEM banda publicada não é um preço (anuncio null) — não há conta para
    // auditar, e o motor devolve freightCost 0 por não ter anúncio onde resolver o teto.
    if (level.anuncio === null) continue;
    if (level.freightCost !== declared) {
      out.push(
        `${label} @ base ${base}: desconto ${level.freightCost} ≠ campo ${declared} (anúncio ${level.anuncio})`,
      );
    }
  }
  return out;
}

describe("hotfix 016/A2 — nenhum frete entra na conta sem um campo que o declare", () => {
  for (const source of [
    { name: "catálogo SERVIDO (backend/app/data/catalog.json)", catalog: servedCatalog },
    { name: "seed embutido (shared/fee-catalog/seed.ts)", catalog: FEE_CATALOG_SEED },
  ]) {
    it(`${source.name}: grossUp(...).freightCost === (fees.freightCost ?? 0) para TODA entrada`, () => {
      const all = everyEntry(source.catalog);
      // Uma varredura sobre zero entradas passa vacuamente. O catálogo servido carrega entradas
      // hoje (Shopee + Amazon); se um dia não carregar, é ESTE `expect` que avisa.
      expect(all.length).toBeGreaterThan(0);
      const found = all.flatMap(({ label, entry }) => violations(label, entryToChannelFees(entry)));
      expect(found).toEqual([]);
    });
  }

  it("nenhuma entrada SERVIDA (nem do seed) declara `freight.kind === 'BAND_VOUCHER'`", () => {
    // A guarda acima é a propriedade; esta é a FORMA que a viola hoje, nomeada. As duas existem
    // porque a propriedade continuaria verdadeira com um `voucherCeiling: 0` — o R3 que o desenho
    // rejeitou (o número passaria a afirmar "o teto é zero", que também é falso).
    const kinds = [
      ...everyEntry(servedCatalog).map((e) => e.entry.freight.kind),
      ...everyEntry(FEE_CATALOG_SEED).map((e) => e.entry.freight.kind),
    ];
    expect(kinds).not.toContain("BAND_VOUCHER");
  });
});

describe("`freightSubsidyInfo` é INFORMAÇÃO — não entra em número nenhum", () => {
  it("mexer no subsídio publicado não move um centavo do resultado", () => {
    const shopee = servedCatalog.marketplaces.find((m) => m.marketplace === "SHOPEE")!;
    expect(shopee.freightSubsidyInfo).not.toBeNull();

    // A prova é ESTRUTURAL antes de ser numérica: `entryToChannelFees` recebe uma ENTRADA, e o
    // subsídio mora no nível do MARKETPLACE — ele não tem por onde chegar ao motor. O teste abaixo
    // fecha a porta numérica de qualquer forma, porque um refactor futuro poderia abrir o caminho.
    const antes = shopee.entries.map((e) => grossUp(100, entryToChannelFees(e)));

    const mutante = structuredClone(servedCatalog);
    const shopeeMutante = mutante.marketplaces.find((m) => m.marketplace === "SHOPEE")!;
    shopeeMutante.freightSubsidyInfo = {
      bands: [{ minPrice: 0, maxPrice: null, ceiling: 9999 }],
      source: "mutação de teste",
      sourceUrl: "https://example.com/mutante",
      effectiveDate: "2026-01-01",
      lastReviewed: "2026-01-01",
    };
    const depois = shopeeMutante.entries.map((e) => grossUp(100, entryToChannelFees(e)));

    expect(depois).toEqual(antes);
    for (const level of depois) expect(level.freightCost).toBe(0);
  });
});

// A prova de que a guarda NÃO é vacuosa: reintroduzir um `voucherCeiling` numa fixture a mata.
// Sem isto, uma varredura que nunca viu uma violação real é indistinguível de uma que não sabe
// enxergá-la (a lição do 014/US4: um teste que afirma PRESENÇA não prova nada sobre uma mentira).
describe("prova por mutação — a guarda mata um voucher reintroduzido", () => {
  it("um catálogo mutante com BAND_VOUCHER produz violações", () => {
    const catchAll = FEE_CATALOG_SEED.marketplaces.find((m) => m.marketplace === "SHOPEE")!
      .entries[0]!;
    const mutante = {
      ...catchAll,
      freight: {
        kind: "BAND_VOUCHER" as const,
        bands: [
          { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
          { minPrice: 80, maxPrice: 200, voucherCeiling: 30 },
          { minPrice: 200, maxPrice: null, voucherCeiling: 40 },
        ],
      },
    };
    const found = violations("MUTANTE", entryToChannelFees(mutante));
    expect(found.length).toBeGreaterThan(0);
    expect(found.join("\n")).toContain("≠ campo 0");
  });
});
