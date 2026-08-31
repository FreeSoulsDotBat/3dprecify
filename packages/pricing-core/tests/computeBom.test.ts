import { describe, it, expect } from "vitest";

import {
    computeBom,
    computeCalculator,
    ValidationError,
    PRICING_MODEL_VERSION,
    toMoney,
    sumMoney,
    Decimal,
} from "../src/index";
import type { PriceInput } from "../src/index";

// E3 assembly engine (ADR-0016, pricing-core 3.1.0). Contract:
// specs/008-e3-multi-piece-bom/contracts/pricing-core-bom.md. The BOM total is the INDEPENDENT
// per-piece sum: per-unit line = computeCalculator (unchanged, rounded 2dp); per-line×qty via
// Decimal + toMoney; assembly = sumMoney of the already-rounded per-line values (FR-412 — the
// aggregate equals the displayed numbers, no double-rounding); per-marketplace rollup with
// per-slot isolation (extends SC-107).

// Canonical SC-001 vector (unchanged from computeCalculator.test.ts), RE-BASELINADO em 4.0.0
// (ADR-0026 — o `wasteGrams: 10` saiu; material = gramas × custo/kg): custo_total **27,55** ·
// varejo **41,33** · atacado **35,82**. A conta completa está em computeCalculator.test.ts.
const SC001: PriceInput = {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 100,
    printTimeHours: 5,
    avgPowerKw: 0.1,
    tariffPerKwh: 1,
    machineValue: 4000,
    machineLifetimeHours: 2000,
    maintenanceReservePerHour: 0,
    failurePct: 10,
    finishTimeHours: 0.5,
    finishRatePerHour: 10,
    laborHours: 0,
    laborRatePerHour: 0,
    otherCosts: [],
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
    channels: [],
};

// Mandatory-only vector (from the "omitted optionals" case): custo_total 20,50 · varejo 30,75 ·
// atacado 26,65.
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
};

describe("computeBom — SC-402 single line ×1 is byte-identical to computeCalculator", () => {
    const input: PriceInput = {
        ...SC001,
        channels: [{ marketplace: "GENERIC", commissionPct: 20, fixedFee: 5 }],
    };
    const calc = computeCalculator(input);
    const bom = computeBom([{ input, quantity: 1 }]);

    it("headline money equals the single-piece result exactly", () => {
        expect(bom.custoTotal).toBe(calc.custoTotal); // 27,55
        expect(bom.precoVarejo).toBe(calc.precoVarejo); // 41,33
        expect(bom.precoAtacado).toBe(calc.precoAtacado); // 35,82
    });

    it("the embedded per-unit line IS the computeCalculator result, byte-for-byte", () => {
        expect(bom.lines).toHaveLength(1);
        expect(JSON.stringify(bom.lines[0].line)).toBe(JSON.stringify(calc));
        expect(bom.lines[0].quantity).toBe(1);
        // ×1 per-line money = the per-unit money, no drift
        expect(bom.lines[0].custoTotal).toBe(calc.custoTotal);
        expect(bom.lines[0].precoVarejo).toBe(calc.precoVarejo);
        expect(bom.lines[0].precoAtacado).toBe(calc.precoAtacado);
    });

    it("the single channel rollup mirrors the slot's money (×1)", () => {
        expect(bom.channels).toHaveLength(1);
        const c = bom.channels[0];
        expect(c.marketplace).toBe("GENERIC");
        expect(c.precoAnuncioVarejo).toBe(calc.channels[0].precoAnuncioVarejo); // 57,91
        expect(c.recebidoLiquidoVarejo).toBe(calc.channels[0].recebidoLiquidoVarejo); // 41,33
        expect(c.precoAnuncioAtacado).toBe(calc.channels[0].precoAnuncioAtacado); // 51,03
        expect(c.recebidoLiquidoAtacado).toBe(calc.channels[0].recebidoLiquidoAtacado); // 35,82
        expect(c.freightCostVarejo).toBe(0);
        expect(c.freightCostAtacado).toBe(0);
        expect(c.contributingLines).toBe(1);
        expect(c.skippedLines).toBe(0);
    });
});

describe("computeBom — FR-412 aggregate = sumMoney(perLine × qty), anchored", () => {
    // A: SC001 ×3 → 82,65 / 123,99 / 107,46 · B: MINIMAL ×2 → 41,00 / 61,50 / 53,30
    // (27,55×3 = 82,65 · 41,33×3 = 123,99 · 35,82×3 = 107,46 — o MINIMAL nunca teve desperdício)
    const bom = computeBom([
        { input: SC001, quantity: 3 },
        { input: MINIMAL, quantity: 2 },
    ]);

    it("per-line money is the rounded per-unit value × qty (Decimal, never float ×)", () => {
        expect(bom.lines[0].custoTotal).toBe(82.65);
        expect(bom.lines[0].precoVarejo).toBe(123.99);
        expect(bom.lines[0].precoAtacado).toBe(107.46);
        expect(bom.lines[1].custoTotal).toBe(41.0);
        expect(bom.lines[1].precoVarejo).toBe(61.5);
        expect(bom.lines[1].precoAtacado).toBe(53.3);
    });

    it("assembly totals equal the sum of the DISPLAYED per-line numbers (no double-rounding)", () => {
        expect(bom.custoTotal).toBe(123.65); // 82,65 + 41,00
        expect(bom.precoVarejo).toBe(185.49); // 123,99 + 61,50
        expect(bom.precoAtacado).toBe(160.76); // 107,46 + 53,30
        // The receipt property one level up: aggregate === sumMoney of the shown per-line values.
        expect(bom.custoTotal).toBe(sumMoney(bom.lines.map((l) => l.custoTotal)));
        expect(bom.precoVarejo).toBe(sumMoney(bom.lines.map((l) => l.precoVarejo)));
        expect(bom.precoAtacado).toBe(sumMoney(bom.lines.map((l) => l.precoAtacado)));
    });

    it("per-line ×qty matches toMoney(Decimal(perUnit).times(qty)) exactly", () => {
        const unit = computeCalculator(SC001);
        expect(bom.lines[0].custoTotal).toBe(toMoney(new Decimal(unit.custoTotal).times(3)));
        expect(bom.lines[0].precoVarejo).toBe(toMoney(new Decimal(unit.precoVarejo).times(3)));
    });

    it("is deterministic — same lines, byte-identical result", () => {
        const again = computeBom([
            { input: SC001, quantity: 3 },
            { input: MINIMAL, quantity: 2 },
        ]);
        expect(JSON.stringify(again)).toBe(JSON.stringify(bom));
    });
});

describe("computeBom — quantity semantics (honest empty, validation)", () => {
    it("a quantity: 0 line contributes zero to every total, without throwing", () => {
        const withZero = computeBom([
            { input: SC001, quantity: 2 },
            {
                input: { ...SC001, channels: [{ marketplace: "GENERIC", commissionPct: 20 }] },
                quantity: 0,
            },
        ]);
        const without = computeBom([{ input: SC001, quantity: 2 }]);
        expect(withZero.custoTotal).toBe(without.custoTotal); // 55,10 (27,55 × 2)
        expect(withZero.precoVarejo).toBe(without.precoVarejo);
        expect(withZero.precoAtacado).toBe(without.precoAtacado);
        // The zero line is still listed honestly, with zero money.
        expect(withZero.lines).toHaveLength(2);
        expect(withZero.lines[1].quantity).toBe(0);
        expect(withZero.lines[1].custoTotal).toBe(0);
        expect(withZero.lines[1].precoVarejo).toBe(0);
        expect(withZero.lines[1].precoAtacado).toBe(0);
        // Its valid channel slot rolls up an honest R$ 0,00 total — counted, not skipped.
        const rollup = withZero.channels.find((c) => c.marketplace === "GENERIC");
        expect(rollup).toBeDefined();
        expect(rollup?.precoAnuncioVarejo).toBe(0);
        expect(rollup?.recebidoLiquidoVarejo).toBe(0);
        expect(rollup?.contributingLines).toBe(1);
        expect(rollup?.skippedLines).toBe(0);
    });

    it("an empty BOM yields zero totals, no lines, no channels (honest empty)", () => {
        const bom = computeBom([]);
        expect(bom.lines).toEqual([]);
        expect(bom.custoTotal).toBe(0);
        expect(bom.precoVarejo).toBe(0);
        expect(bom.precoAtacado).toBe(0);
        expect(bom.channels).toEqual([]);
    });

    it.each([
        ["non-integer", 1.5],
        ["negative", -1],
        ["NaN", Number.NaN],
        ["Infinity", Number.POSITIVE_INFINITY],
    ])("a %s quantity throws ValidationError naming lines[i].quantity", (_label, quantity) => {
        try {
            computeBom([
                { input: SC001, quantity: 1 },
                { input: SC001, quantity },
            ]);
            expect.unreachable("should have thrown");
        } catch (e) {
            expect(e).toBeInstanceOf(ValidationError);
            expect((e as ValidationError).field).toBe("lines[1].quantity");
        }
    });

    it("an invalid line input propagates the computeCalculator ValidationError", () => {
        expect(() => computeBom([{ input: { ...SC001, rollWeightKg: 0 }, quantity: 1 }])).toThrow(
            ValidationError,
        );
    });
});

describe("computeBom — per-channel rollup (FR-403, grouped by marketplace)", () => {
    // A ×2: SHOPEE {20%, +5} → 57,91/41,33/51,03/35,82 · ML {10%} → 45,92/41,33/39,80/35,82
    //   (ML varejo = 41,33/0,9 = 45,9222… → 45,92 · ML atacado = 35,82/0,9 = 39,80 exato)
    // B ×1: SHOPEE {0%, +2} over 30,75/26,65 → 32,75/30,75/28,65/26,65 (MINIMAL, inalterado)
    const bom = computeBom([
        {
            input: {
                ...SC001,
                channels: [
                    { marketplace: "SHOPEE", commissionPct: 20, fixedFee: 5 },
                    { marketplace: "ML", commissionPct: 10 },
                ],
            },
            quantity: 2,
        },
        {
            input: {
                ...MINIMAL,
                channels: [{ marketplace: "SHOPEE", commissionPct: 0, fixedFee: 2 }],
            },
            quantity: 1,
        },
    ]);

    it("groups by marketplace in first-appearance order", () => {
        expect(bom.channels.map((c) => c.marketplace)).toEqual(["SHOPEE", "ML"]);
    });

    it("sums each money field × qty across the contributing lines (anchored)", () => {
        const shopee = bom.channels[0];
        expect(shopee.precoAnuncioVarejo).toBe(148.57); // 57,91×2 + 32,75
        expect(shopee.recebidoLiquidoVarejo).toBe(113.41); // 41,33×2 + 30,75
        expect(shopee.precoAnuncioAtacado).toBe(130.71); // 51,03×2 + 28,65
        expect(shopee.recebidoLiquidoAtacado).toBe(98.29); // 35,82×2 + 26,65
        expect(shopee.contributingLines).toBe(2);
        expect(shopee.skippedLines).toBe(0);
    });

    it("a marketplace configured on only some lines rolls up those lines alone (not skipped)", () => {
        const ml = bom.channels[1];
        expect(ml.precoAnuncioVarejo).toBe(91.84); // 45,92×2
        expect(ml.recebidoLiquidoVarejo).toBe(82.66); // 41,33×2
        expect(ml.precoAnuncioAtacado).toBe(79.6); // 39,80×2
        expect(ml.recebidoLiquidoAtacado).toBe(71.64); // 35,82×2
        expect(ml.contributingLines).toBe(1);
        expect(ml.skippedLines).toBe(0); // absent ≠ error — line B simply has no ML slot
    });

    it("rolls freight up per level × qty", () => {
        const withFreight = computeBom([
            {
                input: {
                    ...SC001,
                    channels: [{ marketplace: "F", commissionPct: 0, fixedFee: 0, freightCost: 3 }],
                },
                quantity: 2,
            },
        ]);
        const f = withFreight.channels[0];
        expect(f.freightCostVarejo).toBe(6); // 3×2
        expect(f.freightCostAtacado).toBe(6);
        expect(f.precoAnuncioVarejo).toBe(82.66); // 41,33×2 (0% commission ⇒ anúncio = base)
        expect(f.recebidoLiquidoVarejo).toBe(76.66); // (41,33 − 3)×2
    });

    it("manual channels (no marketplace) group together under null", () => {
        const bom2 = computeBom([
            { input: { ...SC001, channels: [{ commissionPct: 0, fixedFee: 2 }] }, quantity: 1 },
            { input: { ...MINIMAL, channels: [{ commissionPct: 0, fixedFee: 2 }] }, quantity: 1 },
        ]);
        expect(bom2.channels).toHaveLength(1);
        const manual = bom2.channels[0];
        expect(manual.marketplace).toBeNull();
        expect(manual.precoAnuncioVarejo).toBe(76.08); // 43,33 + 32,75
        expect(manual.recebidoLiquidoVarejo).toBe(72.08); // 41,33 + 30,75
        expect(manual.contributingLines).toBe(2);
    });
});

describe("computeBom — per-slot isolation (extends SC-107)", () => {
    it("a line whose slot errors contributes zero + increments skippedLines; siblings unharmed", () => {
        const bom = computeBom([
            {
                input: {
                    ...SC001,
                    channels: [{ marketplace: "SHOPEE", commissionPct: 20, fixedFee: 5 }],
                },
                quantity: 1,
            },
            {
                input: { ...SC001, channels: [{ marketplace: "SHOPEE", commissionPct: 100 }] }, // slot error
                quantity: 5,
            },
        ]);
        const shopee = bom.channels[0];
        expect(shopee.marketplace).toBe("SHOPEE");
        // Money = line A only — the errored slot never NaNs/corrupts the sibling sum.
        expect(shopee.precoAnuncioVarejo).toBe(57.91);
        expect(shopee.recebidoLiquidoVarejo).toBe(41.33);
        expect(shopee.precoAnuncioAtacado).toBe(51.03);
        expect(shopee.recebidoLiquidoAtacado).toBe(35.82);
        expect(shopee.contributingLines).toBe(1);
        expect(shopee.skippedLines).toBe(1); // honest, not silent
        // The headline totals still include BOTH lines' costs — a channel error is channel-local.
        expect(bom.custoTotal).toBe(165.3); // 27,55 × (1+5)
        expect(bom.precoVarejo).toBe(247.98); // 41,33 × 6
    });

    it("a rollup with zero contributing lines reports null prices honestly (never 0,00)", () => {
        const bom = computeBom([
            {
                input: { ...SC001, channels: [{ marketplace: "X", commissionPct: 100 }] },
                quantity: 2,
            },
        ]);
        expect(bom.channels).toHaveLength(1);
        const x = bom.channels[0];
        expect(x.marketplace).toBe("X");
        expect(x.precoAnuncioVarejo).toBeNull();
        expect(x.recebidoLiquidoVarejo).toBeNull();
        expect(x.precoAnuncioAtacado).toBeNull();
        expect(x.recebidoLiquidoAtacado).toBeNull();
        expect(x.freightCostVarejo).toBe(0);
        expect(x.freightCostAtacado).toBe(0);
        expect(x.contributingLines).toBe(0);
        expect(x.skippedLines).toBe(1);
        // Nothing NaN'd, nothing thrown — the headline is intact.
        expect(bom.custoTotal).toBe(55.1); // 27,55 × 2
    });
});

// The contract reads "how many LINES fed this rollup" — a line carrying several slots of the
// SAME marketplace must count once (its money still sums every slot), and it is "skipped" only
// when EVERY one of its slots for that marketplace errored (review finding, 2026-07-11).
describe("computeBom — rollup counts are LINES, not slots", () => {
    it("two same-marketplace slots on ONE line count one contributing line; money sums both", () => {
        const bom = computeBom([
            {
                input: {
                    ...SC001,
                    channels: [
                        { marketplace: "SHOPEE", commissionPct: 20, fixedFee: 5 },
                        { marketplace: "SHOPEE", commissionPct: 0, fixedFee: 2 },
                    ],
                },
                quantity: 1,
            },
        ]);
        expect(bom.channels).toHaveLength(1);
        const s = bom.channels[0];
        expect(s.contributingLines).toBe(1); // one PIECE fed the rollup, via two slots
        expect(s.skippedLines).toBe(0);
        expect(s.precoAnuncioVarejo).toBe(101.24); // 57,91 + (41,33+2)
    });

    it("one valid + one errored slot of the SAME marketplace on a line: contributes once, not skipped", () => {
        const bom = computeBom([
            {
                input: {
                    ...SC001,
                    channels: [
                        { marketplace: "SHOPEE", commissionPct: 20, fixedFee: 5 },
                        { marketplace: "SHOPEE", commissionPct: 100 }, // slot error
                    ],
                },
                quantity: 1,
            },
        ]);
        const s = bom.channels[0];
        expect(s.contributingLines).toBe(1);
        expect(s.skippedLines).toBe(0); // the piece DID sum — only its extra slot failed
        expect(s.precoAnuncioVarejo).toBe(57.91); // valid slot only
    });

    it("a line whose EVERY slot for a marketplace errors counts skipped exactly once", () => {
        const bom = computeBom([
            {
                input: {
                    ...SC001,
                    channels: [
                        { marketplace: "X", commissionPct: 100 },
                        { marketplace: "X", commissionPct: -1 },
                    ],
                },
                quantity: 2,
            },
        ]);
        const x = bom.channels[0];
        expect(x.contributingLines).toBe(0);
        expect(x.skippedLines).toBe(1); // one PIECE without a price here, not two slots
        expect(x.precoAnuncioVarejo).toBeNull();
    });
});

describe("computeBom — versioning (4.0.0 MAJOR, ADR-0026; computeBom entrou na 3.1.0/ADR-0016)", () => {
    it("stamps modelVersion (= PRICING_MODEL_VERSION — the literal pin lives in version.test.ts)", () => {
        const bom = computeBom([{ input: SC001, quantity: 1 }]);
        expect(bom.modelVersion).toBe(PRICING_MODEL_VERSION);
    });

    it("exports toMoney/sumMoney/Decimal from the package entry (the MINOR public surface)", () => {
        expect(toMoney(new Decimal("1.005"))).toBe(1.01); // ROUND_HALF_UP, 2dp
        expect(sumMoney([0.1, 0.2])).toBe(0.3); // never native float +
    });
});
