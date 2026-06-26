// Canonical 3D-print pricing core (this slice = material + markup). Pure, deterministic, offline.
// Contract: specs/001-walking-skeleton/contracts/pricing-core.md
export interface PriceInput {
  costPerRoll: number;
  rollWeightKg: number;
  grams: number;
  markupPct: number;
}

export interface PriceResult {
  materialCost: number;
  suggestedPrice: number;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} must be a finite number >= 0`);
  }
}

export function computePrice(input: PriceInput): PriceResult {
  const { costPerRoll, rollWeightKg, grams, markupPct } = input;
  assertFiniteNonNegative(costPerRoll, "costPerRoll");
  assertFiniteNonNegative(grams, "grams");
  assertFiniteNonNegative(markupPct, "markupPct");
  if (!Number.isFinite(rollWeightKg) || rollWeightKg <= 0) {
    throw new ValidationError("rollWeightKg must be a finite number > 0");
  }

  const materialCost = (costPerRoll / (rollWeightKg * 1000)) * grams;
  const suggestedPrice = materialCost * (1 + markupPct / 100);
  return { materialCost, suggestedPrice };
}
