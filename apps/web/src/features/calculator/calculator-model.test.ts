import { describe, expect, it } from "vitest";

import { computeCalculator } from "./calculator-model";

// Mirrors specs/001-walking-skeleton (US2): material + markup, pt-BR string inputs.
// The numeric formula itself is covered by @3dprecify/pricing-core tests; here we
// assert the form-string → parse → validate → result mapping the screen depends on.
describe("computeCalculator — form strings → result", () => {
  it("base case: R$100/kg roll, 20 g, 50% → 2,00 material / 3,00 price", () => {
    const r = computeCalculator({
      costPerRoll: "100",
      rollWeightKg: "1",
      grams: "20",
      markupPct: "50",
    });
    expect(r.rollWeightError).toBe(false);
    expect(r.materialCost).toBeCloseTo(2.0, 2);
    expect(r.suggestedPrice).toBeCloseTo(3.0, 2);
  });

  it("accepts pt-BR formatted strings (comma decimals)", () => {
    const r = computeCalculator({
      costPerRoll: "110,00",
      rollWeightKg: "1",
      grams: "85",
      markupPct: "50",
    });
    expect(r.rollWeightError).toBe(false);
    expect(r.materialCost).toBeCloseTo(9.35, 2);
    expect(r.suggestedPrice).toBeCloseTo(14.025, 2);
  });

  it("grams = 0 → 0,00 / 0,00", () => {
    const r = computeCalculator({
      costPerRoll: "100",
      rollWeightKg: "1",
      grams: "0",
      markupPct: "50",
    });
    expect(r.materialCost).toBeCloseTo(0, 2);
    expect(r.suggestedPrice).toBeCloseTo(0, 2);
  });

  it("markup = 0 → price equals material cost", () => {
    const r = computeCalculator({
      costPerRoll: "100",
      rollWeightKg: "1",
      grams: "20",
      markupPct: "0",
    });
    expect(r.materialCost).toBeCloseTo(2.0, 2);
    expect(r.suggestedPrice).toBeCloseTo(2.0, 2);
  });

  it("rollWeight = 0 → rollWeightError, zeroed results (no division by zero)", () => {
    const r = computeCalculator({
      costPerRoll: "100",
      rollWeightKg: "0",
      grams: "20",
      markupPct: "50",
    });
    expect(r.rollWeightError).toBe(true);
    expect(r.materialCost).toBe(0);
    expect(r.suggestedPrice).toBe(0);
  });

  it("empty rollWeight → rollWeightError", () => {
    const r = computeCalculator({
      costPerRoll: "100",
      rollWeightKg: "",
      grams: "20",
      markupPct: "50",
    });
    expect(r.rollWeightError).toBe(true);
  });

  it("blank/negative non-weight fields coerce to 0 (only weight drives the error)", () => {
    const r = computeCalculator({ costPerRoll: "", rollWeightKg: "1", grams: "-5", markupPct: "" });
    expect(r.rollWeightError).toBe(false);
    expect(r.materialCost).toBe(0);
    expect(r.suggestedPrice).toBe(0);
  });
});
