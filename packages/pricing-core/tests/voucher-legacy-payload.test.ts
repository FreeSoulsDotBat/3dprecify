import { describe, expect, it } from "vitest";

import { grossUp, type ChannelFees, type VoucherBand } from "../src/index";

// Hotfix 016/A2 (2026-08-07) — O CONTRATO DOS CONGELADOS.
//
// O catálogo deixou de EMITIR `freight: {kind: "BAND_VOUCHER"}` (a fonte atribui o subsídio à
// Shopee, não ao vendedor). O motor NÃO mudou, e este arquivo é a razão: `freightVoucherBands`
// viaja DENTRO de payload de snapshot congelado (ADR-0019, imutável por trigger de banco) e de
// documento de cenário (ADR-0021). Redefinir — ou remover — a leitura faria um congelado, que o
// produto promete imutável, passar a afirmar OUTRO número sem uma linha dele mudar.
//
// É o mesmo argumento que os docstrings de `bandMode` (ADR-0024) e `fixedFeeRule` (ADR-0027) já
// carregam, e é por isso que `PRICING_MODEL_VERSION` NÃO foi bumpado neste hotfix: nada do que já
// foi gravado muda de valor. A capacidade fica **DEPRECATED — sem emissores, nunca removida**.
//
// Os números abaixo são o payload Shopee tal como o catálogo o emitia até 2026-08-06, e o líquido
// que ele produzia. Se um dia alguém "limpar" o campo morto, é ESTE arquivo que fica vermelho.

const LEGACY_SHOPEE_VOUCHER: VoucherBand[] = [
  { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
  { minPrice: 80, maxPrice: 200, voucherCeiling: 30 },
  { minPrice: 200, maxPrice: null, voucherCeiling: 40 },
];

/** As tarifas Shopee como um documento gravado ANTES do hotfix as carrega. */
function legacyShopee(overrides: Partial<ChannelFees> = {}): ChannelFees {
  return {
    commissionPct: 0,
    priceBands: [
      { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
      { minPrice: 80, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
      { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
    ],
    freightVoucherBands: LEGACY_SHOPEE_VOUCHER,
    ...overrides,
  };
}

describe("payload LEGADO com freightVoucherBands (DEPRECATED, honrado para sempre)", () => {
  it("a semente do T072 continua produzindo EXATAMENTE o líquido que o congelado registrou", () => {
    // varejo 24,24 → (24,24 + 4) / (1 − 0,20) = 35,30 → teto da faixa [0,80) = R$ 20 →
    // líquido 35,30 − 7,06 − 4,00 − 20,00 = 4,24. Este É o número medido no T072, e é o que um
    // Orçamento congelado daquele dia registra. Ele NÃO deve mudar: o produto não reescreve
    // história — o caminho do vendedor é "Recalcular hoje".
    const level = grossUp(24.24, legacyShopee());
    expect(level.anuncio).toBe(35.3);
    expect(level.freightCost).toBe(20);
    expect(level.liquido).toBe(4.24);
  });

  it("o teto é resolvido pelo ANÚNCIO, não pela base (base 76 → anúncio ∈ [80,200) → R$ 30)", () => {
    // Números RODADOS, não estimados: a base 76 está na faixa [0,80), mas o ponto fixo do gross-up
    // atravessa a borda — (76 + 20) / 0,86 = 111,63 ∈ [80,200) — e é o ANÚNCIO que resolve o teto.
    const level = grossUp(76, legacyShopee());
    expect(level.anuncio).toBe(111.63);
    expect(level.freightCost).toBe(30);
    expect(level.liquido).toBe(46);
  });

  it("o teto SOMA ao frete plano declarado, como sempre somou", () => {
    // 20 (teto) + 5 (plano) = 25, e o líquido 4,24 − 5 = −0,76 — negativo, que é exatamente o que
    // o T072 mediu com o volumoso ligado e o que motivou o achado A2.
    const level = grossUp(24.24, legacyShopee({ freightCost: 5 }));
    expect(level.freightCost).toBe(25);
    expect(level.liquido).toBe(-0.76);
  });

  it("uma lista VAZIA de bandas não desconta nada (a ausência sempre significou zero)", () => {
    const level = grossUp(24.24, legacyShopee({ freightVoucherBands: [] }));
    expect(level.freightCost).toBe(0);
    expect(level.liquido).toBe(24.24);
  });
});
