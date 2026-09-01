import { describe, expect, it } from "vitest";

import { channelHasDeclaredFee } from "./channel-fee";

// B5 (2026-09-01) — a REGRA única extraída de `entities/history/frozen-payload.ts` (`feeBearing`)
// e `features/calculator/calculator-model.ts` (`hasFee`). Cobre as duas FORMAS reais que os dois
// lados alimentam: números (o vivo) e strings decimais (o congelado) — `Number()` trata as duas
// igual, então os mesmos casos valem para ambas.

describe("channelHasDeclaredFee", () => {
    it("nenhum campo presente/zerado — sem taxa", () => {
        expect(channelHasDeclaredFee({})).toBe(false);
        expect(channelHasDeclaredFee(null)).toBe(false);
        expect(channelHasDeclaredFee(undefined)).toBe(false);
        expect(
            channelHasDeclaredFee({
                commissionPct: 0,
                fixedFee: 0,
                minPerItem: 0,
                freightCost: 0,
            }),
        ).toBe(false);
        expect(
            channelHasDeclaredFee({
                commissionPct: "0.00",
                fixedFee: "0.00",
                minPerItem: "0.00",
                freightCost: "0.00",
            }),
        ).toBe(false);
    });

    it("qualquer um dos 4 escalares > 0 já basta — número OU string decimal", () => {
        expect(channelHasDeclaredFee({ commissionPct: 12 })).toBe(true);
        expect(channelHasDeclaredFee({ commissionPct: "12.00" })).toBe(true);
        expect(channelHasDeclaredFee({ fixedFee: 6 })).toBe(true);
        expect(channelHasDeclaredFee({ minPerItem: 1 })).toBe(true);
        expect(channelHasDeclaredFee({ freightCost: "19.90" })).toBe(true);
    });

    it("uma tabela progressiva não-vazia basta, mesmo com os escalares zerados", () => {
        expect(channelHasDeclaredFee({ priceBands: [{ minPrice: 0 }] })).toBe(true);
        expect(channelHasDeclaredFee({ freightVoucherBands: [{ minPrice: "0.00" }] })).toBe(true);
        expect(channelHasDeclaredFee({ priceBands: [] })).toBe(false); // vazia não conta
    });

    // B5 — o caso que a leitura congelada perdia: SÓ sobretaxa, os 4 escalares zerados.
    it("SÓ sobretaxa já basta — o caso que o congelado perdia antes do B5", () => {
        expect(
            channelHasDeclaredFee({
                commissionPct: 0,
                fixedFee: 0,
                minPerItem: 0,
                freightCost: 0,
                surcharges: [{ label: "Manuseio de item volumoso", value: 50 }],
            }),
        ).toBe(true);
        // congelado: mesmos campos como strings decimais + sobretaxa com valor decimal em string
        expect(
            channelHasDeclaredFee({
                commissionPct: "0.00",
                fixedFee: "0.00",
                minPerItem: "0.00",
                freightCost: "0.00",
                surcharges: [{ label: "Manuseio de item volumoso", value: "50.00" }],
            }),
        ).toBe(true);
        expect(channelHasDeclaredFee({ surcharges: [] })).toBe(false); // lista vazia não conta
    });
});
