# Contract — packages/pricing-core

Pure, framework-free, deterministic, offline. The CANONICAL pricing formula (this slice = material + markup).

## API
```ts
export interface PriceInput {
  costPerRoll: number;    // BRL, >= 0
  rollWeightKg: number;   // kg, > 0
  grams: number;          // g, >= 0
  markupPct: number;      // %, >= 0  (50 => +50%)
}

export interface PriceResult {
  materialCost: number;   // BRL
  suggestedPrice: number; // BRL
}

// Throws ValidationError if rollWeightKg <= 0 or any field is negative/NaN.
export function computePrice(input: PriceInput): PriceResult;
```

## Semantics
- `materialCost = costPerRoll / (rollWeightKg * 1000) * grams`
- `suggestedPrice = materialCost * (1 + markupPct / 100)`

## Required test cases (Vitest, written first, must fail before impl)
| costPerRoll | rollWeightKg | grams | markupPct | materialCost | suggestedPrice |
|---|---|---|---|---|---|
| 100 | 1 | 20 | 50 | 2.00 | 3.00 |
| 100 | 1 | 0  | 50 | 0.00 | 0.00 |
| 100 | 1 | 20 | 0  | 2.00 | 2.00 |
| 201.11 | 2 | 158 | 30 | 15.89 (±0.01) | 20.65 (±0.01) |
| any | 0 | any | any | → throws ValidationError | — |
| negative any | — | — | — | → throws ValidationError | — |
