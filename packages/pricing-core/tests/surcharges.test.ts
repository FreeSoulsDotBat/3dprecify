import { describe, it, expect } from "vitest";

import { computeCalculator, grossUp } from "../src/index";
import type { ChannelFees, PriceBand, PriceInput } from "../src/index";

// 016/PR-F · T059 (US16 / FR-923 / ADR-0027 §3.2) — sobretaxa opcional por item declarada pelo
// vendedor (Shopee: manuseio de item volumoso, R$ 50,00 POR PEDIDO, art. 3305).
//
// A ARMADILHA que decide a forma (013/F1, ADR-0027 §2.3): sobre uma entrada BANDADA, o `fixedFee`
// de canal é INERTE — na banda o motor toma comissão E fixo da banda que contém o anúncio. Somar
// R$ 50 no `fixedFee` da Shopee não faria absolutamente nada, e R$ 50 sumiriam em silêncio sob um
// selo dizendo que as taxas foram ajustadas. Por isso a sobretaxa é campo PRÓPRIO e ATRAVESSA a
// banda:
//     fixoEfetivo(banda, L) = bandFixedFee(banda, L) + Σ surcharges.value
//
// Este arquivo prova as duas metades: que a soma ACONTECE em todos os regimes, e que a alternativa
// rejeitada (somar no fixo) seria de fato inerte — a prova de que a decisão não é decorativa.

/** A tabela Shopee catch-all (pós-partição de PR-F). */
const SHOPEE_BANDS: PriceBand[] = [
    {
        minPrice: 0,
        maxPrice: 8,
        commissionPct: 20,
        fixedFee: 0,
        fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
    },
    { minPrice: 8, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
    { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 16 },
    { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
    { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
];

const VOLUMOSO = { label: "Manuseio de item volumoso", value: 50 };

const SC001: PriceInput = {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 100,
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
};
// O vetor canônico 4.0.0: custo 27,55 · varejo 41,33 · atacado 35,82.

describe("regime CONSTANTE (sem bandas) — a sobretaxa soma por cima do fixo", () => {
    it("Shopee 20% + R$ 4 + R$ 50 de volumoso: base 41,33 → anúncio 119,16", () => {
        // L = (41,33 + 4 + 50) / 0,80 = 95,33 / 0,80 = 119,1625 → 119,16 (HALF_UP)
        // comissão = 20% × 119,16 = 23,832
        // líquido  = 119,16 − 23,832 − 4 − 50 = 41,328 → 41,33 ✓ nets a base
        const r = computeCalculator({
            ...SC001,
            channels: [
                { marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4, surcharges: [VOLUMOSO] },
            ],
        });
        expect(r.channels[0]!.precoAnuncioVarejo).toBe(119.16);
        expect(r.channels[0]!.recebidoLiquidoVarejo).toBe(41.33);
    });

    it("a MESMA base sem sobretaxa continua em 56,66 (ausência = byte-idêntico)", () => {
        // (41,33 + 4) / 0,80 = 56,6625 → 56,66 — o número que `channels.test.ts` (SC-101) já crava.
        const semChave = computeCalculator({
            ...SC001,
            channels: [{ marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4 }],
        });
        const listaVazia = computeCalculator({
            ...SC001,
            channels: [{ marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4, surcharges: [] }],
        });
        expect(semChave.channels[0]!.precoAnuncioVarejo).toBe(56.66);
        expect(semChave.channels[0]!.recebidoLiquidoVarejo).toBe(41.33);
        expect(listaVazia.channels[0]).toEqual(semChave.channels[0]);
    });

    it("o piso por item (minPerItem) convive com a sobretaxa", () => {
        // regime %: L = (20 + 5) / 0,95 = 26,3157… → comissão 5% × 26,32 = 1,32 < 10 ⇒ o piso obriga
        // regime piso: L = 20 + 10 + 0 + 5 = 35,00 · cobrado = max(1,75; 10) = 10
        // líquido = 35,00 − 10 − 0 − 5 = 20,00 ✓
        const r = grossUp(20, {
            commissionPct: 5,
            minPerItem: 10,
            surcharges: [{ label: "taxa declarada", value: 5 }],
        });
        expect(r.anuncio).toBe(35);
        expect(r.liquido).toBe(20);
    });
});

describe("regime BANDADO (SELECTION) — e a prova de que somar no fixedFee seria INERTE", () => {
    const comSobretaxa = grossUp(41.33, {
        commissionPct: 0,
        priceBands: SHOPEE_BANDS,
        surcharges: [VOLUMOSO],
    });
    const semSobretaxa = grossUp(41.33, { commissionPct: 0, priceBands: SHOPEE_BANDS });
    /** A ALTERNATIVA REJEITADA: os R$ 50 digitados no `fixedFee` do canal, com bandas presentes. */
    const somadoNoFixo = grossUp(41.33, {
        commissionPct: 0,
        fixedFee: 54,
        priceBands: SHOPEE_BANDS,
    });

    it("a sobretaxa muda o preço e o nível sobe de banda (41,33 → 129,45)", () => {
        // A banda que se auto-consiste é [100,200) — 14% + R$ 20:
        // L = (41,33 + 20 + 50) / 0,86 = 111,33 / 0,86 = 129,4534… → 129,45
        // comissão = 14% × 129,45 = 18,123
        // líquido  = 129,45 − 18,123 − 20 − 50 = 41,327 → 41,33 ✓
        expect(comSobretaxa.anuncio).toBe(129.45);
        expect(comSobretaxa.liquido).toBe(41.33);
        expect(comSobretaxa.appliedBand).toEqual([100, 200]);
    });

    it("sem sobretaxa: 56,66 na banda [8,80) — o resultado de hoje, intocado", () => {
        // L = (41,33 + 4) / 0,80 = 56,6625 → 56,66
        expect(semSobretaxa.anuncio).toBe(56.66);
        expect(semSobretaxa.appliedBand).toEqual([8, 80]);
    });

    // ESTE é o teste que justifica o campo existir.
    it("os R$ 50 somados no `fixedFee` do canal são INERTES sobre entrada bandada (013/F1)", () => {
        expect(somadoNoFixo).toEqual(semSobretaxa);
        expect(somadoNoFixo.anuncio).not.toBe(comSobretaxa.anuncio);
    });

    it("mutar o valor da sobretaxa muda o preço (não-vacuidade)", () => {
        const outro = grossUp(41.33, {
            commissionPct: 0,
            priceBands: SHOPEE_BANDS,
            surcharges: [{ ...VOLUMOSO, value: 51 }],
        });
        expect(outro.anuncio).not.toBe(comSobretaxa.anuncio);
    });

    it("várias sobretaxas somam (Σ), não a primeira", () => {
        const soma = grossUp(41.33, {
            commissionPct: 0,
            priceBands: SHOPEE_BANDS,
            surcharges: [
                { label: "a", value: 30 },
                { label: "b", value: 20 },
            ],
        });
        expect(soma).toEqual(comSobretaxa);
    });
});

describe("regime BANDADO com fixedFeeRule — a sobretaxa atravessa também a REGRA", () => {
    const fees = (surcharges?: { label: string; value: number }[]): ChannelFees => ({
        commissionPct: 0,
        priceBands: SHOPEE_BANDS,
        ...(surcharges ? { surcharges } : {}),
    });

    it("base 1,50 + R$ 0,30 declarados → anúncio 6,00 (a regra forma o fixo, a sobretaxa soma)", () => {
        // L = (1,50 + 0,30) / (1 − 0,20 − 0,50) = 1,80 / 0,30 = 6,00
        // comissão = 20% × 6,00 = 1,20 · adicional (regra) = 50% × 6,00 = 3,00 · sobretaxa = 0,30
        // líquido = 6,00 − 1,20 − 3,00 − 0,30 = 1,50 ✓
        const r = grossUp(1.5, fees([{ label: "etiqueta especial", value: 0.3 }]));
        expect(r.anuncio).toBe(6);
        expect(r.liquido).toBe(1.5);
        expect(r.appliedBand).toEqual([0, 8]);
    });

    it("sem a declaração, a mesma base fica em 5,00", () => {
        expect(grossUp(1.5, fees()).anuncio).toBe(5);
    });

    // Na banda com REGRA a constante `fixedFee` é ignorada por construção — então somar ali seria
    // inerte DUAS vezes. A sobretaxa é o único caminho que chega ao preço.
    it("mexer no `fixedFee` da banda-com-regra não muda nada", () => {
        const comConstanteMexida = SHOPEE_BANDS.map((b) =>
            b.fixedFeeRule ? { ...b, fixedFee: 0.3 } : b,
        );
        expect(grossUp(1.5, { commissionPct: 0, priceBands: comConstanteMexida }).anuncio).toBe(5);
    });
});

describe("regime PROGRESSIVE — a sobretaxa também atravessa (ADR-0024 + ADR-0027)", () => {
    const bands: PriceBand[] = [
        { minPrice: 0, maxPrice: 200, commissionPct: 15, fixedFee: 0 },
        { minPrice: 200, maxPrice: null, commissionPct: 10, fixedFee: 0 },
    ];

    it("base 100 + R$ 10 → anúncio 129,41 (segmento [0,200), 15%)", () => {
        // L = (100 + 0 + 10) / (1 − 0,15) = 110 / 0,85 = 129,4117… → 129,41
        // comissão progressiva = 15% × 129,41 = 19,4115
        // líquido = 129,41 − 19,4115 − 0 − 10 = 99,9985 → 100,00 ✓
        const r = grossUp(100, {
            commissionPct: 0,
            bandMode: "PROGRESSIVE",
            priceBands: bands,
            surcharges: [{ label: "declarada", value: 10 }],
        });
        expect(r.anuncio).toBe(129.41);
        expect(r.liquido).toBe(100);
    });

    it("sem sobretaxa: 117,65 — o resultado de hoje", () => {
        // L = 100 / 0,85 = 117,6470… → 117,65
        const r = grossUp(100, { commissionPct: 0, bandMode: "PROGRESSIVE", priceBands: bands });
        expect(r.anuncio).toBe(117.65);
    });

    it("o piso por item no regime progressivo também soma a sobretaxa", () => {
        // regime %: L = (10 + 4)/0,85 = 16,47 → comissão 15% × 16,47 = 2,47 < 5 ⇒ piso obriga
        // regime piso: L = 10 + 5 + 0 + 4 = 19,00 · cobrado = max(2,85; 5) = 5
        // líquido = 19,00 − 5 − 0 − 4 = 10,00 ✓
        const r = grossUp(10, {
            commissionPct: 0,
            minPerItem: 5,
            bandMode: "PROGRESSIVE",
            priceBands: bands,
            surcharges: [{ label: "declarada", value: 4 }],
        });
        expect(r.anuncio).toBe(19);
        expect(r.liquido).toBe(10);
    });
});

describe("a sobretaxa é ECOADA no resultado (a legenda e o PDF se nomeiam)", () => {
    it("`ChannelResult.surcharges` devolve rótulo e valor, na ordem de entrada", () => {
        const r = computeCalculator({
            ...SC001,
            channels: [
                { marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4, surcharges: [VOLUMOSO] },
            ],
        });
        expect(r.channels[0]!.surcharges).toEqual([VOLUMOSO]);
    });

    it("sem sobretaxa o eco é uma lista VAZIA, nunca null (uma forma só para o consumidor)", () => {
        const r = computeCalculator({
            ...SC001,
            channels: [{ marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4 }],
        });
        expect(r.channels[0]!.surcharges).toEqual([]);
    });
});

describe("recusas por SLOT — uma sobretaxa malformada não vira preço", () => {
    const withSurcharge = (s: { label: string; value: number }) =>
        computeCalculator({
            ...SC001,
            channels: [{ marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4, surcharges: [s] }],
        }).channels[0]!;

    it("valor negativo é recusado pelo nome do campo", () => {
        const c = withSurcharge({ label: "x", value: -1 });
        expect(c.error).toMatch(/surcharges/);
        expect(c.precoAnuncioVarejo).toBeNull();
    });

    it("valor não-finito é recusado", () => {
        expect(withSurcharge({ label: "x", value: Number.POSITIVE_INFINITY }).error).toMatch(
            /surcharges/,
        );
    });

    it("rótulo vazio é recusado — uma linha sem nome é uma taxa sem procedência", () => {
        expect(withSurcharge({ label: "   ", value: 50 }).error).toMatch(/surcharges/);
    });
});
