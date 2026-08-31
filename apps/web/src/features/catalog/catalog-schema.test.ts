import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import {
    emptyFilamentForm,
    emptyPrinterForm,
    filamentResolver,
    filamentToWire,
    printerResolver,
    printerToWire,
} from "./catalog-schema";

// 013 US1 (FB-01) — the catalog is the surface that PERSISTS the number: a silently mis-parsed
// value contaminates every future price derived from the saved item. Same grammar, same messages
// as the calculator; here we also pin what reaches the WIRE.

const v = messages.calculator.validation;

const validFilament = {
    ...emptyFilamentForm,
    name: "PLA",
    costPerRoll: "110,00",
    rollWeightKg: "1",
};
const validPrinter = {
    ...emptyPrinterForm,
    name: "Ender",
    machineValue: "4000,00",
    machineLifetimeHours: "2000",
    avgPowerKw: "0,12",
};

const ADVERSARIAL = ["1,234,56", "5x3", "10-5", "12,,5", "1.5000", "abc", "--"];

describe("filament costPerRoll — the persisted money field (FB-01)", () => {
    it.each(ADVERSARIAL)(
        "rejects %s with a field error (never a saved wrong number)",
        async (raw) => {
            const res = await filamentResolver({ ...validFilament, costPerRoll: raw }, undefined, {
                shouldUseNativeValidation: false,
                fields: {},
                criteriaMode: "firstError",
            });
            expect(res.errors.costPerRoll?.message).toBe(v.invalid);
        },
    );

    it("FB-01: '1500.00' is R$ 1500 on the wire — NOT the 150000 the audit measured", async () => {
        const form = { ...validFilament, costPerRoll: "1500.00" };
        const res = await filamentResolver(form, undefined, {
            shouldUseNativeValidation: false,
            fields: {},
            criteriaMode: "firstError",
        });
        expect(res.errors).toEqual({});
        expect(filamentToWire(form).costPerRoll).toBe("1500");
    });

    it("keeps tolerating the R$ affix and the pt-BR forms", () => {
        expect(filamentToWire({ ...validFilament, costPerRoll: "R$ 1.234,56" }).costPerRoll).toBe(
            "1234.56",
        );
    });
});

describe("printer machineValue — the persisted machine cost (FB-01)", () => {
    it.each(ADVERSARIAL)("rejects %s with a field error", async (raw) => {
        const res = await printerResolver({ ...validPrinter, machineValue: raw }, undefined, {
            shouldUseNativeValidation: false,
            fields: {},
            criteriaMode: "firstError",
        });
        expect(res.errors.machineValue?.message).toBe(v.invalid);
    });

    it("FB-01: '1500.00' persists as 1500", async () => {
        const form = { ...validPrinter, machineValue: "1500.00" };
        const res = await printerResolver(form, undefined, {
            shouldUseNativeValidation: false,
            fields: {},
            criteriaMode: "firstError",
        });
        expect(res.errors).toEqual({});
        expect(printerToWire(form).machineValue).toBe("1500");
    });

    it("'0.12' in avgPowerKw stays 0,12 on the wire (the 100× energy error, persisted)", () => {
        expect(printerToWire({ ...validPrinter, avgPowerKw: "0.12" }).avgPowerKw).toBe("0.12");
    });
});

// 013 US4 (FB-05) — `numField` had NO upper bound, so an over-ceiling value traveled to the server
// and came back as a generic 422 with no field attribution. The ceilings below MIRROR the ones in
// `backend/app/validation.py` for the SAME wire field (filaments.py / printers.py), not a number
// picked independently client-side.
describe("magnitude ceilings (FB-05) — mirror backend/app/validation.py", () => {
    it("filament costPerRoll at/over CEIL_MONEY (10**10) is rejected inline, never a bare 422", async () => {
        const res = await filamentResolver(
            { ...validFilament, costPerRoll: "10000000000" }, // 10**10 == CEIL_MONEY
            undefined,
            { shouldUseNativeValidation: false, fields: {}, criteriaMode: "firstError" },
        );
        expect(res.errors.costPerRoll?.message).toBe(v.tooHigh);
    });

    it("filament costPerRoll just under CEIL_MONEY passes", async () => {
        const res = await filamentResolver(
            { ...validFilament, costPerRoll: "9999999999" },
            undefined,
            {
                shouldUseNativeValidation: false,
                fields: {},
                criteriaMode: "firstError",
            },
        );
        expect(res.errors.costPerRoll).toBeUndefined();
    });

    it("filament rollWeightKg over CEIL_KG (10**6) is rejected inline", async () => {
        const res = await filamentResolver(
            { ...validFilament, rollWeightKg: "1000000" },
            undefined,
            {
                shouldUseNativeValidation: false,
                fields: {},
                criteriaMode: "firstError",
            },
        );
        expect(res.errors.rollWeightKg?.message).toBe(v.tooHigh);
    });

    it("printer machineValue over CEIL_MONEY (10**10) is rejected inline", async () => {
        const res = await printerResolver(
            { ...validPrinter, machineValue: "10000000000" },
            undefined,
            {
                shouldUseNativeValidation: false,
                fields: {},
                criteriaMode: "firstError",
            },
        );
        expect(res.errors.machineValue?.message).toBe(v.tooHigh);
    });

    it("printer machineLifetimeHours over CEIL_HOURS (10**6) is rejected inline", async () => {
        const res = await printerResolver(
            { ...validPrinter, machineLifetimeHours: "1000000" },
            undefined,
            { shouldUseNativeValidation: false, fields: {}, criteriaMode: "firstError" },
        );
        expect(res.errors.machineLifetimeHours?.message).toBe(v.tooHigh);
    });

    it("printer avgPowerKw over CEIL_KW (10**5) is rejected inline", async () => {
        const res = await printerResolver({ ...validPrinter, avgPowerKw: "100000" }, undefined, {
            shouldUseNativeValidation: false,
            fields: {},
            criteriaMode: "firstError",
        });
        expect(res.errors.avgPowerKw?.message).toBe(v.tooHigh);
    });

    it("printer maintenanceReservePerHour over CEIL_RATE (10**12) is rejected inline", async () => {
        const res = await printerResolver(
            { ...validPrinter, maintenanceReservePerHour: "1000000000000" },
            undefined,
            { shouldUseNativeValidation: false, fields: {}, criteriaMode: "firstError" },
        );
        expect(res.errors.maintenanceReservePerHour?.message).toBe(v.tooHigh);
    });
});
