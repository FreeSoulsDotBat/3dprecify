import { computeBom, computeCalculator, type PriceInput } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import { composeBom } from "./bom-compute";

// 008/T004 — the assembly adapter (research R7). The numeric formula is anchored exhaustively in
// pricing-core (SC-402/FR-412); here we pin the ONLY things the adapter adds: pure delegation to
// `computeBom` and the aligned handling of invalid lines (null input → honestly excluded from the
// compute, never a silent zero, never a crash of the siblings).

// The SC-001 canonical vector (numbers — the page hands the adapter ALREADY-PARSED PriceInputs).
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
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
    channels: [],
}; // 016/US10 — re-baseline SEM wasteGrams (pricing-core 4.0.0): custo 27,55 · varejo 41,33 · atacado 35,82

const MINIMAL: PriceInput = {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 100,
    printTimeHours: 5,
    avgPowerKw: 0.1,
    tariffPerKwh: 1,
    machineValue: 4000,
    machineLifetimeHours: 2000,
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
}; // custo 20,50 · varejo 30,75 · atacado 26,65

describe("composeBom — pure delegation to the canonical engine (ADR-0016)", () => {
    it("a valid set is byte-identical to computeBom over the same lines", () => {
        const lines = [
            { input: SC001, quantity: 3 },
            { input: MINIMAL, quantity: 2 },
        ];
        const { bom } = composeBom(lines);
        const canonical = computeBom(lines.map((l) => ({ input: l.input, quantity: l.quantity })));
        expect(JSON.stringify(bom)).toBe(JSON.stringify(canonical));
        expect(bom.custoTotal).toBe(123.65); // 27,55×3 + 20,50×2 — anchored, from the core
    });

    it("a single line ×1 reproduces the single-piece calculator (SC-402 at the adapter)", () => {
        const { bom, lineResults } = composeBom([{ input: SC001, quantity: 1 }]);
        const calc = computeCalculator(SC001);
        expect(bom.custoTotal).toBe(calc.custoTotal);
        expect(bom.precoVarejo).toBe(calc.precoVarejo);
        expect(bom.precoAtacado).toBe(calc.precoAtacado);
        expect(JSON.stringify(lineResults[0]?.line)).toBe(JSON.stringify(calc));
    });
});

describe("composeBom — invalid lines are excluded honestly, aligned to the composer", () => {
    it("a null input yields a null slot in lineResults; valid siblings still compute", () => {
        const { bom, lineResults } = composeBom([
            { input: SC001, quantity: 2 },
            { input: null, quantity: 3 }, // the line's editor is invalid — excluded, captioned in the UI
            { input: MINIMAL, quantity: 1 },
        ]);
        expect(lineResults).toHaveLength(3);
        expect(lineResults[1]).toBeNull();
        // The compute ran over the two valid lines only.
        expect(bom.lines).toHaveLength(2);
        expect(bom.custoTotal).toBe(75.6); // 27,55×2 + 20,50
        // Alignment: each non-null slot IS the corresponding engine line result.
        expect(lineResults[0]).toBe(bom.lines[0]);
        expect(lineResults[2]).toBe(bom.lines[1]);
    });

    it("an all-invalid or empty composer yields the honest empty assembly, never a throw", () => {
        const empty = composeBom([]);
        expect(empty.bom.custoTotal).toBe(0);
        expect(empty.bom.lines).toEqual([]);
        expect(empty.lineResults).toEqual([]);

        const allInvalid = composeBom([{ input: null, quantity: 5 }]);
        expect(allInvalid.bom.custoTotal).toBe(0);
        expect(allInvalid.lineResults).toEqual([null]);
    });
});
