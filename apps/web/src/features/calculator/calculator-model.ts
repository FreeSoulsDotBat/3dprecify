import { computePrice } from "@3dprecify/pricing-core";

import { parseDecimal } from "@/shared/lib/decimal-ptbr";

// Pure view-model for the walking-skeleton calculator (US2). Maps the screen's
// raw pt-BR form strings onto the canonical pricing-core formula. The math lives
// in pricing-core (never re-implemented here — ADR-formula-source-of-truth); this
// only parses, coerces, validates the roll weight, and surfaces a flag for the view.
export interface CalculatorInput {
  costPerRoll: string;
  rollWeightKg: string;
  grams: string;
  markupPct: string;
}

export interface CalculatorResult {
  /** True when the roll weight is missing or ≤ 0 (the one blocking validation). */
  rollWeightError: boolean;
  materialCost: number;
  suggestedPrice: number;
}

/** Parse a non-negative numeric field; blank/NaN/negative all coerce to 0. */
function nonNeg(value: string): number {
  const v = parseDecimal(value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export function computeCalculator(input: CalculatorInput): CalculatorResult {
  const rollWeightKg = parseDecimal(input.rollWeightKg);
  if (!(rollWeightKg > 0)) {
    return { rollWeightError: true, materialCost: 0, suggestedPrice: 0 };
  }
  const { materialCost, suggestedPrice } = computePrice({
    costPerRoll: nonNeg(input.costPerRoll),
    rollWeightKg,
    grams: nonNeg(input.grams),
    markupPct: nonNeg(input.markupPct),
  });
  return { rollWeightError: false, materialCost, suggestedPrice };
}
