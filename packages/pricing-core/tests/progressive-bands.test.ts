import { describe, expect, it } from "vitest";

import { computeCalculator, grossUp } from "../src/index";
import type { PriceBand, PriceInput } from "../src/index";

// ADR-0024 / FR-014b / SC-814 — bandas PROGRESSIVAS: a comissão é cobrada por PARCELA do preço.
//
// A Amazon publica, para algumas categorias: "15% até R$ 200,00 e 10% para o EXCEDENTE acima de
// R$ 200,00" (venda.amazon.com.br/precos, lido 2026-07-28). A alíquota menor incide SÓ sobre a parte
// que passa do limiar — não sobre o preço inteiro.
//
// O modo SELEÇÃO (o padrão, e o único que existia) escolhe UMA banda e aplica sua alíquota ao preço
// todo. Para uma fonte que cobra por parcela isso SUBESTIMA a comissão acima do limiar, e o vendedor
// recebe menos do que a tela prometeu — sob selo "Referência".

/** Móveis / Colchões (Amazon BR, medido 2026-07-28). */
const MOVEIS: PriceBand[] = [
  { minPrice: 0, maxPrice: 200, commissionPct: 15, fixedFee: 0 },
  { minPrice: 200, maxPrice: null, commissionPct: 10, fixedFee: 0 },
];

/** Acessórios Eletrônicos (limiar R$ 100). */
const ACESSORIOS: PriceBand[] = [
  { minPrice: 0, maxPrice: 100, commissionPct: 15, fixedFee: 0 },
  { minPrice: 100, maxPrice: null, commissionPct: 10, fixedFee: 0 },
];

const progressivo = (bands: PriceBand[]) =>
  ({
    commissionPct: 0,
    fixedFee: 0,
    minPerItem: 1,
    priceBands: bands,
    bandMode: "PROGRESSIVE",
  }) as const;

describe("SC-814 — comissão por parcela bate com a fonte nos três pontos de prova", () => {
  // ABAIXO do limiar as duas semânticas COINCIDEM: 15% sobre a parcela até 200 é 15% do preço todo.
  it("abaixo do limiar: idêntico à seleção — não há excedente para tarifar diferente", () => {
    const p = grossUp(100, progressivo(MOVEIS));
    const s = grossUp(100, { commissionPct: 0, fixedFee: 0, minPerItem: 1, priceBands: MOVEIS });
    expect(p.anuncio).toBe(117.65); // 100 / 0.85
    expect(p.liquido).toBe(100.0);
    expect(p.anuncio).toBe(s.anuncio);
  });

  // NO limiar está a prova de que a função é CONTÍNUA: os dois segmentos devolvem o mesmo anúncio.
  // É isso que dispensa a iteração de ponto fixo que a seleção exige.
  it("no limiar: contínuo — R$ 170,00 de base produz anúncio de exatamente R$ 200,00", () => {
    const r = grossUp(170, progressivo(MOVEIS));
    expect(r.anuncio).toBe(200.0);
    expect(r.liquido).toBe(170.0); // 200 − (15%·200 + 10%·0) = 200 − 30
  });

  // ACIMA do limiar é onde o modo de seleção erra, e erra contra o vendedor.
  it("acima do limiar: soma por parcela, e o anúncio sobe para de fato entregar o líquido", () => {
    const r = grossUp(250, progressivo(MOVEIS));
    // L = (250 + 15%·200 − 10%·200) / (1 − 10%) = 260 / 0,9
    expect(r.anuncio).toBe(288.89);
    // comissão = 15%·200 + 10%·88,89 = 30,00 + 8,89
    expect(r.liquido).toBe(250.0);
  });

  it("o modo de seleção, no mesmo caso, entrega R$ 10,00 MENOS do que promete", () => {
    const selecao = grossUp(250, {
      commissionPct: 0,
      fixedFee: 0,
      minPerItem: 1,
      priceBands: MOVEIS,
    });
    expect(selecao.anuncio).toBe(277.78); // 250 / 0,9 — trata os primeiros R$ 200 como se fossem 10%
    // A Amazon cobraria 15%·200 + 10%·77,78 = R$ 37,78 nesse anúncio, deixando R$ 240,00 líquidos.
    // O erro é CONSTANTE acima do limiar: (15% − 10%) × 200 = R$ 10,00.
    expect(277.78 - (0.15 * 200 + 0.1 * 77.78)).toBeCloseTo(240.0, 2);
    expect(grossUp(250, progressivo(MOVEIS)).anuncio! - selecao.anuncio!).toBeCloseTo(11.11, 2);
  });

  it("vale para o outro limiar publicado (Acessórios Eletrônicos, R$ 100) — erro de R$ 5,00", () => {
    const r = grossUp(250, progressivo(ACESSORIOS));
    // L = (250 + 15%·100 − 10%·100) / 0,9 = 255 / 0,9
    expect(r.anuncio).toBe(283.33);
    expect(r.liquido).toBe(250.0);
  });

  it("a comissão cobrada é a soma por parcela, não a alíquota de uma banda só", () => {
    const r = grossUp(250, progressivo(MOVEIS));
    const comissao = r.anuncio! - r.liquido!; // sem frete nem custo fixo neste caso
    expect(comissao).toBeCloseTo(38.89, 2);
    expect(comissao).not.toBeCloseTo(0.1 * r.anuncio!, 2); // NÃO é 10% do anúncio inteiro
  });

  it("o piso por item continua valendo sobre a comissão progressiva", () => {
    // Base minúscula: 15% de um anúncio de centavos fica abaixo do piso de R$ 1,00.
    const r = grossUp(2, progressivo(MOVEIS));
    expect(r.anuncio).toBe(3.0); // regime de piso: base + minPerItem
    expect(r.liquido).toBe(2.0);
  });

  // Bandas que PARAM antes do infinito: ver `band-convergence.test.ts` (SC-817). O que respondia pelo
  // último segmento passou a ser NÃO PRECIFICADO — a alíquota do excedente acima do teto é justamente
  // o que a fonte não publicou.

  it("`appliedBand` no modo progressivo reporta a banda que CONTÉM o anúncio", () => {
    expect(grossUp(100, progressivo(MOVEIS)).appliedBand).toEqual([0, 200]);
    expect(grossUp(250, progressivo(MOVEIS)).appliedBand).toEqual([200, null]);
  });
});

// O salto que o meu primeiro teste de travessia PULOU, e que a exigência de 100% de cobertura
// denunciou: `ChannelInput.bandMode` → `ChannelFees.bandMode`, dentro do próprio motor. Testar
// `grossUp` direto prova a matemática e não prova o TRAJETO — e o ADR-0024 §5 diz que o risco real
// está no trajeto, não na matemática.
describe("SC-814 — o modo sobrevive ao ponto de entrada público (`computeCalculator`)", () => {
  const PRODUTO: PriceInput = {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 100,
    wasteGrams: 10,
    printTimeHours: 5,
    avgPowerKw: 0.1,
    tariffPerKwh: 1,
    machineValue: 4000,
    machineLifetimeHours: 2000,
    failurePct: 10,
    finishTimeHours: 0.5,
    finishRatePerHour: 10,
    otherCosts: [],
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
    channels: [],
  };
  const canal = {
    marketplace: "AMAZON",
    feeDeterminants: { plan: "PROFISSIONAL", category: "moveis" },
    commissionPct: 0,
    minPerItem: 1,
    priceBands: MOVEIS,
  };

  it("um canal progressivo anuncia MAIS que o mesmo canal sem o modo", () => {
    const base: PriceInput = { ...PRODUTO, markupVarejoPct: 900 }; // empurra o varejo acima de R$ 200
    const comModo = computeCalculator({
      ...base,
      channels: [{ ...canal, bandMode: "PROGRESSIVE" }],
    });
    const semModo = computeCalculator({ ...base, channels: [canal] });
    const a = comModo.channels[0]?.precoAnuncioVarejo ?? 0;
    const b = semModo.channels[0]?.precoAnuncioVarejo ?? 0;
    expect(a).toBeGreaterThan(200); // o cenário de fato cruza o limiar
    expect(a).toBeGreaterThan(b); // …e o modo mudou o número entregue
    expect(a - b).toBeCloseTo(10 / 0.9, 1); // o erro constante, propagado pelo gross-up
  });
});

describe("SC-815 — a ausência do discriminador preserva o passado bit a bit", () => {
  // A restrição que ditou o formato: `priceBands` atravessa frozen-payload.ts (snapshots IMUTÁVEIS,
  // ADR-0019) e config-document.ts (cenários salvos, ADR-0021). Se a ausência não significasse
  // SELEÇÃO, um snapshot já congelado passaria a valer outro número sem uma linha dele mudar.
  const SHOPEE: PriceBand[] = [
    { minPrice: 0, maxPrice: 100, commissionPct: 14, fixedFee: 0 },
    { minPrice: 100, maxPrice: null, commissionPct: 14, fixedFee: 3 },
  ];

  it("bandas sem `bandMode` resolvem por seleção, idêntico a antes desta mudança", () => {
    for (const base of [10, 50, 99, 100, 101, 250, 1000]) {
      const semModo = grossUp(base, { commissionPct: 0, priceBands: SHOPEE, minPerItem: 0 });
      const explicito = grossUp(base, {
        commissionPct: 0,
        priceBands: SHOPEE,
        minPerItem: 0,
        bandMode: "SELECTION",
      });
      expect(semModo).toEqual(explicito);
      expect(semModo.liquido).toBe(base); // a seleção continua fechando a conta
    }
  });

  it("o mesmo vale para as bandas de comissão IGUAL com custo fixo por faixa (custo fixo do ML)", () => {
    const r = grossUp(42.98, { commissionPct: 0, priceBands: SHOPEE, minPerItem: 0 });
    expect(r.appliedBand).toEqual([0, 100]);
    expect(r.liquido).toBe(42.98);
  });
});
