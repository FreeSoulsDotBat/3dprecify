import { describe, expect, it } from "vitest";

import type { FilamentOut, PrinterOut } from "@/shared/api/generated";

import { filamentToCalcFields, printerToCalcFields } from "./catalog-prefill";
import { computeFromForm } from "./calculator-model";
import { defaultCalcValues } from "./calculator-schema";

// US5 / SC-305 — THE anchor: computing from catalog-picked values is BYTE-IDENTICAL to typing
// the same values manually. The catalog changes convenience, never the math: pricing-core is
// untouched, and the wire→form mapping must parse to the exact same numbers a human entry does
// (wire = en-US decimal strings like "110.00"; form = pt-BR strings like "110,00").

const filament: FilamentOut = {
    id: "0198f0aa-0000-7000-8000-000000000001",
    name: "PLA Azul",
    material: "PLA",
    costPerRoll: "110.00",
    rollWeightKg: "1.000",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
};

const printer: PrinterOut = {
    id: "0198f0aa-0000-7000-8000-000000000002",
    name: "Ender 3",
    machineValue: "1200.00",
    machineLifetimeHours: "2000.000",
    avgPowerKw: "0.1200",
    maintenanceReservePerHour: "0.500000",
    createdAt: "2026-07-09T00:00:00Z",
    updatedAt: "2026-07-09T00:00:00Z",
};

describe("US5 — catalog pre-fill byte-identity (SC-305)", () => {
    it("catalog-picked values compute BYTE-IDENTICAL to the same values typed manually", () => {
        const picked = {
            ...defaultCalcValues,
            ...filamentToCalcFields(filament),
            ...printerToCalcFields(printer),
        };
        const manual = {
            ...defaultCalcValues,
            costPerRoll: "110",
            rollWeightKg: "1",
            machineValue: "1200",
            machineLifetimeHours: "2000",
            avgPowerKw: "0,12",
            maintenanceReservePerHour: "0,5",
        };

        const fromCatalog = computeFromForm(picked);
        const byHand = computeFromForm(manual);

        expect(fromCatalog.ok).toBe(true);
        expect(JSON.stringify(fromCatalog)).toBe(JSON.stringify(byHand));
    });

    it("maps wire decimal strings to pt-BR form strings (fields stay editable text)", () => {
        const fields = filamentToCalcFields(filament);
        expect(fields.costPerRoll).toBe("110,00");
        expect(fields.rollWeightKg).toBe("1,000");
        const machine = printerToCalcFields(printer);
        expect(machine.machineValue).toBe("1200,00");
        expect(machine.avgPowerKw).toBe("0,1200");
    });
});
