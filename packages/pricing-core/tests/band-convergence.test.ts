import { describe, expect, it } from "vitest";

import { grossUp } from "../src/index";
import type { PriceBand } from "../src/index";

// SC-817 (014, Fase 6C) — a seleção de banda não pode aplicar a alíquota de uma banda que NÃO contém
// o preço anunciado, e não pode emprestar a tarifa de uma banda vizinha para um preço que a fonte
// nunca tarifou (FR-014a).
//
// Dois defeitos distintos da mesma função, medidos no batidão:
//
//  T113 — NÃO CONVERGÊNCIA. O laço de ponto fixo tinha um teto de iterações; quando as bandas
//  oscilam (o anúncio escolhe a banda e a banda escolhe o anúncio, sem ponto fixo), o laço saía
//  pelo teto e as linhas seguintes adotavam a banda que sobrou como se fosse estável.
//
//  T114 — EMPRÉSTIMO. Os fallbacks `?? bands[last]` e `?? band` faziam o motor tarifar um preço que
//  cai FORA de toda banda publicada com a tarifa da banda vizinha — preenchendo no cálculo a lacuna
//  que a FR-014a proíbe preencher no catálogo, e produzindo inversão (base maior → anúncio menor).

/** Faixa aplicável a `price` — meia-aberta, inclusiva embaixo. Reimplementada aqui de propósito: o
 *  teste não pode confiar no mesmo auxiliar que o código sob teste usa para se dizer correto. */
function bandOf(bands: PriceBand[], price: number): PriceBand | null {
  return (
    bands.find((b) => price >= b.minPrice && (b.maxPrice === null || price < b.maxPrice)) ?? null
  );
}

/** Custo fixo do ML por faixa de preço — CONTÍGUAS, o recorte de `band-floor.test.ts:71-75`. */
const ML_CONTIGUAS: PriceBand[] = [
  { minPrice: 0, maxPrice: 12.5, commissionPct: 50, fixedFee: 0 },
  { minPrice: 12.5, maxPrice: 79, commissionPct: 12, fixedFee: 5 },
  { minPrice: 79, maxPrice: null, commissionPct: 12, fixedFee: 0 },
];

/** O mesmo custo fixo COM a lacuna que a fonte deixa (FR-014a: R$ 50,01–78,99 permanece lacuna). As
 *  alíquotas reproduzem a inversão medida no batidão — base 50 → 65,70 e base 55 → 63,95. */
const ML_COM_LACUNA: PriceBand[] = [
  { minPrice: 0, maxPrice: 29.01, commissionPct: 14, fixedFee: 6.25 },
  { minPrice: 29.01, maxPrice: 50.01, commissionPct: 14, fixedFee: 6.5 },
  { minPrice: 79, maxPrice: null, commissionPct: 14, fixedFee: 0 },
];

describe("SC-817/SC-108 (T113) — a banda aplicada é sempre a banda que CONTÉM o anúncio", () => {
  it("varredura: em toda base de R$ 1,00 a R$ 150,00, `appliedBand` contém o anúncio", () => {
    const fora: { base: number; anuncio: number; applied: [number, number | null] | null }[] = [];
    for (let cents = 100; cents <= 15000; cents++) {
      const base = cents / 100;
      const r = grossUp(base, { commissionPct: 12, fixedFee: 0, priceBands: ML_CONTIGUAS });
      const real = bandOf(ML_CONTIGUAS, r.anuncio!);
      const declarada = r.appliedBand;
      const bate =
        real !== null &&
        declarada !== null &&
        declarada[0] === real.minPrice &&
        declarada[1] === real.maxPrice;
      if (!bate) fora.push({ base, anuncio: r.anuncio!, applied: declarada });
    }
    expect(fora).toEqual([]);
  });

  it("o caso medido: base 64,52 não tem ponto fixo, e o líquido mostrado é o REAL", () => {
    // Banda [12,5;79) cobra 12% + R$ 5; banda [79;∞) cobra 12% + R$ 0. Anunciando por 79,00 o
    // vendedor sai da faixa do custo fixo — é o degrau publicado do ML, não um erro de conta.
    const r = grossUp(64.52, { commissionPct: 12, fixedFee: 0, priceBands: ML_CONTIGUAS });
    expect(r.anuncio).toBe(79.0);
    expect(r.appliedBand).toEqual([79, null]); // a banda que CONTÉM 79,00
    // 79,00 − 12%·79,00 = 69,52. O motor antigo exibia 64,52: cobrava o custo fixo de uma banda que
    // não contém o anúncio, tirando R$ 5,00 do vendedor na tela.
    expect(r.liquido).toBe(69.52);
    expect(r.liquido).not.toBe(64.52);
  });

  it("o degrau vira um PLATÔ em R$ 79,00, e o platô é a verdade do custo fixo do ML", () => {
    const em = (base: number) =>
      grossUp(base, { commissionPct: 12, fixedFee: 0, priceBands: ML_CONTIGUAS });
    // Abaixo do degrau a conta fecha exata, centavo a centavo.
    expect(em(64.51).anuncio).toBe(78.99);
    expect(em(64.51).liquido).toBe(64.51);
    // De 64,52 até 69,52 NÃO existe anúncio que feche exato: qualquer preço abaixo de R$ 79,00
    // ainda paga o custo fixo de R$ 5,00 e entrega menos que a base. R$ 79,00 é o MENOR preço
    // publicado que entrega — e entrega 69,52 para todos eles. O platô é o degrau da fonte.
    for (const base of [64.52, 64.53, 66.0, 69.51, 69.52]) {
      expect(em(base).anuncio).toBe(79.0);
      expect(em(base).liquido).toBe(69.52);
      expect(em(base).appliedBand).toEqual([79, null]);
    }
    // Um centavo acima do platô a faixa de cima volta a fechar exato por conta própria.
    expect(em(69.53).anuncio).toBe(79.01);
    expect(em(69.53).liquido).toBe(69.53);
  });

  // 016/PR-F — timeout EXPLÍCITO: a varredura de 14.900 bases levava ~1,7s isolada e ~5,2s sob o
  // gate completo (instrumentação de coverage + workers paralelos), estourando os 5s default do
  // vitest de forma INTERMITENTE — a pior classe de vermelho (lição 014/US5). O 4.1.0 adicionou
  // trabalho legítimo por chamada (bandFixedFee/guarda de piso/surcharges); a varredura merece o
  // tempo dela, não um encolhimento da amostra.
  it("monotonicidade: o anúncio nunca cai quando a base sobe", { timeout: 30_000 }, () => {
    let anterior = 0;
    const quedas: { base: number; de: number; para: number }[] = [];
    for (let cents = 100; cents <= 15000; cents++) {
      const base = cents / 100;
      const { anuncio } = grossUp(base, {
        commissionPct: 12,
        fixedFee: 0,
        priceBands: ML_CONTIGUAS,
      });
      if (anuncio! < anterior) quedas.push({ base, de: anterior, para: anuncio! });
      anterior = anuncio!;
    }
    expect(quedas).toEqual([]);
  });

  it("o líquido mostrado nunca é MAIOR que o que a banda do anúncio de fato deixa", () => {
    for (let cents = 100; cents <= 15000; cents += 7) {
      const base = cents / 100;
      const r = grossUp(base, { commissionPct: 12, fixedFee: 0, priceBands: ML_CONTIGUAS });
      const real = bandOf(ML_CONTIGUAS, r.anuncio!)!;
      const cobrado = (real.commissionPct / 100) * r.anuncio! + real.fixedFee;
      expect(r.liquido!).toBeLessThanOrEqual(r.anuncio! - cobrado + 0.005);
    }
  });
});

describe("SC-817/FR-014a (T114) — preço fora de toda banda publicada é NÃO PRECIFICADO", () => {
  const feesComLacuna = { commissionPct: 14, fixedFee: 0, priceBands: ML_COM_LACUNA };

  it("um anúncio que cai na lacuna R$ 50,01–78,99 não recebe a tarifa da banda vizinha", () => {
    const r = grossUp(50, feesComLacuna);
    expect(r.anuncio).toBeNull();
    expect(r.liquido).toBeNull();
    expect(r.appliedBand).toBeNull();
    expect(r.freightCost).toBe(0);
  });

  it("a inversão medida deixa de existir: base 50 e base 55 não produzem mais preço nenhum", () => {
    // Antes: base 50 → anúncio 65,70 (tarifa emprestada da banda de baixo) e base 55 → 63,95
    // (emprestada da banda de cima). Base MAIOR, anúncio MENOR — e as duas sob selo de referência.
    const cinquenta = grossUp(50, feesComLacuna);
    const cinquentaCinco = grossUp(55, feesComLacuna);
    expect(cinquenta.anuncio).toBeNull();
    expect(cinquentaCinco.anuncio).toBeNull();
  });

  it("fora da lacuna a mesma tabela continua precificando normalmente", () => {
    const abaixo = grossUp(20, feesComLacuna);
    expect(abaixo.anuncio).toBe(30.81); // (20 + 6,50) / 0,86 — banda [29,01; 50,01)
    expect(abaixo.appliedBand).toEqual([29.01, 50.01]);
    expect(abaixo.liquido).toBe(20.0);

    const acima = grossUp(70, feesComLacuna);
    expect(acima.anuncio).toBe(81.4); // 70 / 0,86 — banda [79; ∞)
    expect(acima.appliedBand).toEqual([79, null]);
    expect(acima.liquido).toBe(70.0);
  });

  it("é determinístico — a mesma lacuna devolve a mesma recusa", () => {
    expect(grossUp(55, feesComLacuna)).toEqual(grossUp(55, feesComLacuna));
  });

  it("PROGRESSIVO: bandas que param antes do infinito não tarifam o que está acima do teto", () => {
    // Um conjunto que para em R$ 200 é dado representável — a fonte pode publicar faixas até um teto
    // e não dizer nada acima dele. Emitir um número ali seria inventar a alíquota do excedente.
    const comTeto: PriceBand[] = [
      { minPrice: 0, maxPrice: 100, commissionPct: 15, fixedFee: 0 },
      { minPrice: 100, maxPrice: 200, commissionPct: 10, fixedFee: 0 },
    ];
    const r = grossUp(500, {
      commissionPct: 0,
      fixedFee: 0,
      minPerItem: 1,
      priceBands: comTeto,
      bandMode: "PROGRESSIVE",
    });
    expect(r.anuncio).toBeNull();
    expect(r.appliedBand).toBeNull();

    // Dentro do teto o mesmo conjunto progressivo continua respondendo.
    const dentro = grossUp(100, {
      commissionPct: 0,
      fixedFee: 0,
      minPerItem: 1,
      priceBands: comTeto,
      bandMode: "PROGRESSIVE",
    });
    expect(dentro.anuncio).toBe(116.67); // (100 + 15%·100 − 10%·100) / 0,9
    expect(dentro.appliedBand).toEqual([100, 200]);
  });

  it("PROGRESSIVO: o PISO por item pode empurrar o anúncio para dentro da lacuna", () => {
    // O regime de piso levanta o preço (base + piso), então um anúncio que a soma por parcela
    // resolveu DENTRO de uma banda pode acabar fora dela. Recusar depois do piso não é zelo
    // redundante: sem essa segunda checagem o motor cobraria a soma por parcela de um preço que
    // atravessa uma janela sem alíquota publicada.
    const comLacuna: PriceBand[] = [
      { minPrice: 0, maxPrice: 10, commissionPct: 15, fixedFee: 0 },
      { minPrice: 20, maxPrice: null, commissionPct: 10, fixedFee: 0 },
    ];
    const fees = {
      commissionPct: 0,
      fixedFee: 0,
      priceBands: comLacuna,
      bandMode: "PROGRESSIVE" as const,
    };
    // Sem piso: base 3 → 3 / 0,85 = 3,53, dentro de [0; 10). Precificado.
    expect(grossUp(3, { ...fees, minPerItem: 0 }).anuncio).toBe(3.53);
    // Com piso de R$ 8,00: 3 + 8 = 11,00, que cai na lacuna [10; 20). Não precificado.
    const comPiso = grossUp(3, { ...fees, minPerItem: 8 });
    expect(comPiso.anuncio).toBeNull();
    expect(comPiso.appliedBand).toBeNull();
  });
});
