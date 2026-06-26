# Phase 1 Data Model — Walking Skeleton

No persistence in this slice. These are in-memory/transport shapes only.

## User (identity, not stored)
Derived from the verified Firebase ID token on the backend.
| Field | Type | Notes |
|-------|------|-------|
| uid   | string | Firebase stable user id (token `sub`) |
| email | string | from token claims; may be absent if the provider withholds it |

## PriceInput (client-side)
| Field | Type | Unit | Validation |
|-------|------|------|------------|
| cost_per_roll  | number | BRL | ≥ 0 |
| roll_weight_kg | number | kg  | > 0 (strictly; guards division by zero) |
| grams          | number | g   | ≥ 0 |
| markup_pct     | number | %   | ≥ 0 (e.g. 50 means +50%) |

## PriceResult (client-side, derived — never an input)
| Field | Type | Formula |
|-------|------|---------|
| material_cost   | number (BRL) | cost_per_roll ÷ (roll_weight_kg × 1000) × grams |
| suggested_price | number (BRL) | material_cost × (1 + markup_pct ÷ 100) |

### Rules
- Invalid input (roll_weight_kg ≤ 0, or any negative) → no result; a pt-BR validation message is shown.
- All money values displayed as BRL (e.g. `R$ 2,00`).
- Worked example (from spec): cost_per_roll=100, roll_weight_kg=1, grams=20, markup_pct=50
  → material_cost = 100 / 1000 × 20 = **2.00** → suggested_price = 2.00 × 1.5 = **3.00**.
