// Onda 4 do chore de legibilidade (2026-08-31) — TESTE DE CARACTERIZAÇÃO, escrito ANTES da
// unificação dos serializadores gêmeos (frozen-payload.ts `freezeInputValue` ≡ config-document.ts
// `stringifyLeaf`, achado da auditoria docs/RELATORIO_LEGIBILIDADE.md). Ele congela o comportamento
// ATUAL: para o MESMO `PriceInput`, o `inputs` do snapshot congelado e o `lastKnown` do cenário
// AD_HOC são byte-a-byte o mesmo documento. A unificação em shared/lib só é válida enquanto este
// teste passar sem ser editado.
//
// Mora na raiz de `pages/` (o precedente de `premium-write-absence.test.tsx`): é um guarda
// TRANSVERSAL que precisa importar duas entities irmãs, e as fronteiras FSD proíbem esse import
// dentro de qualquer camada abaixo.
import { describe, expect, it } from "vitest";

import { computeCalculator, type PriceInput } from "@3dprecify/pricing-core";

import { freezePriceResult } from "@/entities/history/frozen-payload";
import { serializeAdHocBasis } from "@/entities/scenario/config-document";

// Um input adversarial: bandas aninhadas (o array-dentro-de-objeto que o freeze raso deixava
// escapar — lição E4 PR-A I1), decimais que não sobrevivem a float ingênuo, sobretaxa rotulada,
// campo opcional presente-mas-null e nível atacado ausente.
const INPUT: PriceInput = {
    costPerRoll: 89.9,
    rollWeightKg: 1,
    printGrams: 123.456,
    printTimeHours: 7.25,
    avgPowerKw: 0.125,
    tariffPerKwh: 0.92,
    machineValue: 3500,
    machineLifetimeHours: 12000,
    maintenanceReservePerHour: 0.31,
    failurePct: 10,
    finishingCost: 2.5,
    laborRate: 25,
    laborHours: 0.5,
    markupVarejoPct: 120,
    markupAtacadoPct: 60,
    otherCosts: [{ name: "embalagem", value: 1.05 }],
    channels: [
        {
            marketplace: "SHOPEE",
            fees: {
                commissionPct: 0,
                priceBands: [
                    { minPrice: 0, maxPrice: 8, commissionPct: 14, fixedFee: 0 },
                    { minPrice: 8, maxPrice: null, commissionPct: 14, fixedFee: 4 },
                ],
                surcharges: [{ label: "volumoso", value: 50 }],
            },
        },
        { marketplace: "ML", fees: { commissionPct: 16.5, fixedFee: 6.75, freightCost: 21.9 } },
    ],
    catalogVersion: "2026-08-06.1",
};

describe("caracterização: os dois serializadores de folha decimal são o MESMO documento", () => {
    it("freezePriceResult(...).inputs ≡ serializeAdHocBasis(...).lastKnown, byte a byte", () => {
        const result = computeCalculator(INPUT);
        const frozen = freezePriceResult(INPUT, result, null).inputs;
        const scenario = serializeAdHocBasis(INPUT).lastKnown;
        expect(JSON.stringify(frozen)).toBe(JSON.stringify(scenario));
    });

    it("folhas numéricas viram string EXATA (nunca arredondada), null passa, aninhado desce", () => {
        const result = computeCalculator(INPUT);
        const inputs = freezePriceResult(INPUT, result, null).inputs!;
        expect(inputs["printGrams"]).toBe("123.456");
        expect(inputs["avgPowerKw"]).toBe("0.125");
        const channels = inputs["channels"] as Array<Record<string, unknown>>;
        const shopeeFees = channels[0]!["fees"] as Record<string, unknown>;
        const bands = shopeeFees["priceBands"] as Array<Record<string, unknown>>;
        expect(bands[0]).toEqual({
            minPrice: "0",
            maxPrice: "8",
            commissionPct: "14",
            fixedFee: "0",
        });
        expect(bands[1]!["maxPrice"]).toBeNull();
        const surcharges = shopeeFees["surcharges"] as Array<Record<string, unknown>>;
        expect(surcharges[0]).toEqual({ label: "volumoso", value: "50" });
    });
});
