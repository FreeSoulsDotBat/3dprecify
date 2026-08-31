import { describe, it, expect } from "vitest";

import { computeCalculator, PRICING_MODEL_VERSION } from "../src/index";
import type { PriceInput } from "../src/index";

// Cross-cutting guarantees (spec §9 / SC-110): the engine is a pure, offline, deterministic function
// of its input — no Date/random/locale drift, no server round-trip — and every result carries the
// model version so a saved calc records which formula produced it.

const INPUT: PriceInput = {
    costPerRoll: 137.5,
    rollWeightKg: 1,
    printGrams: 83,
    printTimeHours: 6.25,
    avgPowerKw: 0.14,
    tariffPerKwh: 0.92,
    machineValue: 3200,
    machineLifetimeHours: 1800,
    maintenanceReservePerHour: 0.5,
    failurePct: 8,
    finishTimeHours: 0.75,
    finishRatePerHour: 18,
    laborHours: 1.5,
    laborRatePerHour: 30,
    otherCosts: [{ name: "Admin", value: 4 }],
    markupVarejoPct: 55,
    markupAtacadoPct: 35,
    channels: [{ marketplace: "MERCADO_LIVRE", commissionPct: 16, fixedFee: 6 }],
};

describe("computeCalculator — determinism (SC-110)", () => {
    it("identical input → deeply-equal AND byte-identical result across repeated runs", () => {
        const a = computeCalculator(INPUT);
        const b = computeCalculator(INPUT);
        expect(a).toEqual(b);
        // Stable serialization proves no Date/random/locale leaked into any field.
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("does not mutate its input (incl. nested otherCosts/channels)", () => {
        const snapshot = JSON.stringify(INPUT);
        computeCalculator(INPUT);
        expect(JSON.stringify(INPUT)).toBe(snapshot);
    });
});

describe("computeCalculator — single source + version stamp (SC-109)", () => {
    it("returns a synchronous value (no async server round-trip)", () => {
        const r = computeCalculator(INPUT);
        expect(r).not.toBeInstanceOf(Promise);
    });

    it("stamps every result with the model version", () => {
        const r = computeCalculator(INPUT);
        // The literal pin lives in version.test.ts (single source); here only the stamping matters.
        expect(r.modelVersion).toBe(PRICING_MODEL_VERSION);
    });
});

// 005 T039 — SC-110 at scale: ANY channel count (every fee shape the engine owns, including an
// erroring slot) + ANY sub-cost set must be byte-identical across runs with STABLE input ordering.
// Locale independence rides on the same byte-identity: the engine is numbers-in → numbers-out
// (no toLocaleString/Intl anywhere), so serialized output cannot vary with the host locale.
const SCALE_INPUT: PriceInput = {
    ...INPUT,
    otherCosts: [
        { name: "Embalagem", value: 3.005 }, // HALF_UP boundary
        { name: "", value: 2 }, // blank name is kept as-is (UI supplies the fallback label)
        { name: "Frete até a transportadora", value: 12.5 },
    ],
    channels: [
        // Every fee model side by side, in a deliberate NON-alphabetical order to pin ordering:
        { marketplace: "OUTRO", commissionPct: 19, fixedFee: 0 }, // plain %
        { marketplace: "MERCADO_LIVRE", commissionPct: 16, fixedFee: 6.75 }, // % + fixed
        {
            marketplace: "AMAZON",
            feeDeterminants: { modality: "INDIVIDUAL" },
            commissionPct: 15,
            minPerItem: 2, // per-item commission floor (fixed-point, SC-112)
        },
        {
            marketplace: "SHOPEE",
            commissionPct: 20,
            priceBands: [
                { minPrice: 0, maxPrice: 79, commissionPct: 20, fixedFee: 4 },
                { minPrice: 79, maxPrice: null, commissionPct: 20, fixedFee: 0 },
            ],
            freightVoucherBands: [
                { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
                { minPrice: 80, maxPrice: null, voucherCeiling: 30 },
            ],
        },
        { marketplace: "MERCADO_LIVRE", commissionPct: 100, fixedFee: 0 }, // errors — isolation stays deterministic
    ],
};

describe("computeCalculator — determinism at scale (005 SC-110)", () => {
    it("many channels (every fee shape) + many sub-costs → byte-identical across runs", () => {
        const runs = [1, 2, 3].map(() => JSON.stringify(computeCalculator(SCALE_INPUT)));
        expect(runs[1]).toBe(runs[0]);
        expect(runs[2]).toBe(runs[0]);
    });

    it("echoes channels and sub-costs in INPUT order (stable ordering, never sorted)", () => {
        const r = computeCalculator(SCALE_INPUT);
        expect(r.channels.map((c) => c.marketplace)).toEqual([
            "OUTRO",
            "MERCADO_LIVRE",
            "AMAZON",
            "SHOPEE",
            "MERCADO_LIVRE",
        ]);
        expect(r.otherCosts.map((c) => c.name)).toEqual([
            "Embalagem",
            "",
            "Frete até a transportadora",
        ]);
    });

    it("the erroring slot is deterministic too (same error, same null prices, siblings unaffected)", () => {
        const a = computeCalculator(SCALE_INPUT);
        const b = computeCalculator(SCALE_INPUT);
        expect(a.channels[4].error).toBeTruthy();
        expect(a.channels[4].error).toBe(b.channels[4].error);
        expect(a.channels[4].precoAnuncioVarejo).toBeNull();
        // Every non-erroring sibling still priced both levels — finite, never NaN.
        for (const ch of a.channels.slice(0, 4)) {
            expect(ch.error).toBeNull();
            expect(Number.isFinite(ch.precoAnuncioVarejo)).toBe(true);
            expect(Number.isFinite(ch.precoAnuncioAtacado)).toBe(true);
        }
    });

    it("the scale result still carries the 3.0.0 stamp (SC-109)", () => {
        expect(computeCalculator(SCALE_INPUT).modelVersion).toBe(PRICING_MODEL_VERSION);
    });
});
