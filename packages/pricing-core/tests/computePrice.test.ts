import { describe, it, expect } from "vitest";
import { computePrice, ValidationError } from "../src/index";

// Contract: specs/001-walking-skeleton/contracts/pricing-core.md
describe("computePrice — material + markup (canonical, offline)", () => {
  it("base case: R$100/kg roll, 20 g, 50% markup → 2.00 / 3.00", () => {
    const r = computePrice({ costPerRoll: 100, rollWeightKg: 1, grams: 20, markupPct: 50 });
    expect(r.materialCost).toBeCloseTo(2.0, 2);
    expect(r.suggestedPrice).toBeCloseTo(3.0, 2);
  });

  it("grams = 0 → 0.00 / 0.00", () => {
    const r = computePrice({ costPerRoll: 100, rollWeightKg: 1, grams: 0, markupPct: 50 });
    expect(r.materialCost).toBeCloseTo(0, 2);
    expect(r.suggestedPrice).toBeCloseTo(0, 2);
  });

  it("markup = 0 → price equals material cost", () => {
    const r = computePrice({ costPerRoll: 100, rollWeightKg: 1, grams: 20, markupPct: 0 });
    expect(r.materialCost).toBeCloseTo(2.0, 2);
    expect(r.suggestedPrice).toBeCloseTo(2.0, 2);
  });

  it("real catalog case: PETG R$201.11/2kg, 158 g, 30% → ~15.89 / ~20.65", () => {
    const r = computePrice({ costPerRoll: 201.11, rollWeightKg: 2, grams: 158, markupPct: 30 });
    expect(r.materialCost).toBeCloseTo(15.89, 2);
    expect(r.suggestedPrice).toBeCloseTo(20.65, 2);
  });

  it("rollWeightKg = 0 → throws ValidationError (no division by zero)", () => {
    expect(() => computePrice({ costPerRoll: 100, rollWeightKg: 0, grams: 20, markupPct: 50 })).toThrow(
      ValidationError,
    );
  });

  it("negative input → throws ValidationError", () => {
    expect(() => computePrice({ costPerRoll: -1, rollWeightKg: 1, grams: 20, markupPct: 50 })).toThrow(
      ValidationError,
    );
  });

  it("NaN input → throws ValidationError", () => {
    expect(() => computePrice({ costPerRoll: NaN, rollWeightKg: 1, grams: 20, markupPct: 50 })).toThrow(
      ValidationError,
    );
  });
});
