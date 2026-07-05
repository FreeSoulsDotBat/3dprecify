# Contract: `packages/pricing-core` v2 (E1)

The only interface E1 exposes is the **pure TypeScript API of `pricing-core`** — there is no HTTP surface (the
backend performs no price computation, FR-036). This is the library contract the FE consumes and the numeric
tests pin.

## Exports

```ts
export const PRICING_MODEL_VERSION: string; // "2.0.0" (ADR-0008; major bump per A25)

export interface PriceInput {
  costPerRoll: number;                 // R$, ≥ 0
  rollWeightKg: number;                // kg, > 0
  printGrams: number;                  // g, ≥ 0
  wasteGrams?: number;                 // g, ≥ 0, default 0
  printTimeHours: number;              // h, ≥ 0
  avgPowerKw: number;                  // kW, ≥ 0 (effective average draw; UI pre-fill 0.12)
  tariffPerKwh: number;                // R$/kWh, ≥ 0
  machineValue: number;                // R$, ≥ 0
  machineLifetimeHours: number;        // h, > 0
  maintenanceReservePerHour?: number;  // R$/h, ≥ 0, default 0
  failurePct?: number;                 // %, ≥ 0, default 0
  finishTimeHours?: number;            // h, ≥ 0, default 0
  finishRatePerHour?: number;          // R$/h, ≥ 0, default 0
  laborHours?: number;                 // h, ≥ 0, default 0
  laborRatePerHour?: number;           // R$/h, ≥ 0, default 0
  adminTotal?: number;                 // R$, ≥ 0, default 0
  markupVarejoPct: number;             // %, ≥ 0 (UI pre-fill 50)
  markupAtacadoPct: number;            // %, ≥ 0 (UI pre-fill 30)
  marketplaceCommissionPct?: number;   // %, in [0, 100), default 0
  marketplaceFixedFee?: number;        // R$, ≥ 0, default 0
}

export interface MarketplaceResult {
  precoAnuncioVarejo: number;   recebidoLiquidoVarejo: number;
  precoAnuncioAtacado: number;  recebidoLiquidoAtacado: number;
}

export interface PriceResult {
  material: number; energy: number; machine: number; falha: number;
  finishing: number; labor: number; admin: number;
  custoTotal: number; precoVarejo: number; precoAtacado: number;
  marketplace: MarketplaceResult | null; // null when both fee inputs are 0
  modelVersion: string;                  // === PRICING_MODEL_VERSION
}

export class ValidationError extends Error { field?: string }

export function computeCalculator(input: PriceInput): PriceResult;
```

## Behavior contract

- **Pure & deterministic**: no I/O, no `Date`/`Math.random`, no locale dependence. Same input → identical output
  (SC-011/SC-012).
- **Rounding (ADR-0008)**: every emitted money field is 2-decimal **HALF_UP** (via `decimal.js-light`);
  aggregates are the sum of already-rounded lines; the seven breakdown lines sum to `custoTotal` with 0 residual
  (SC-002). Markup and gross-up operate on the rounded `custoTotal` (WYSIWYG).
- **Validation**: invalid input (non-finite; `rollWeightKg ≤ 0`; `machineLifetimeHours ≤ 0`;
  `marketplaceCommissionPct` outside `[0, 100)`; any negative) throws `ValidationError` with the offending
  `field`; never returns a `NaN`/`Infinity` field (SC-008). Optional fields default to 0 (SC-004).
- **Marketplace**: `marketplace` is `null` unless `marketplaceCommissionPct > 0` or `marketplaceFixedFee > 0`;
  when present, gross-up + net are computed for **both** base prices (SC-003).
- **Version**: `modelVersion === PRICING_MODEL_VERSION === "2.0.0"`; a gate test asserts the constant tracks
  `package.json` major.

## Contract tests (test-first, map to SCs)

Each is a `pricing-core` unit case written **before** the implementation:

| Test | Asserts | SC |
|---|---|---|
| canonical example | the full SC-001 vector → the exact expected R$ values | SC-001 |
| breakdown closes | Σ(lines) == custoTotal, 0 residual, incl. randomized valid inputs | SC-002 |
| gross-up both | `(B+f)/(1−p)` and net round-trips to B for varejo & atacado | SC-003 |
| optional isolation | optionals at 0 ≡ mandatory-only; labor 2×25 → +R$ 50,00 | SC-004 |
| effective-draw energy | energy scales p2/p1; only energy line moves | SC-005 |
| failure base | falha == 10%×(mat+en+mac) = R$ 2,15, not R$ 1,10 | SC-006 |
| machine-hour | value/lifetime + reserve; R$ 2,00/h → machine R$ 10,00 | SC-007 |
| no bad numbers | rollWeightKg 0 / lifetime 0 / commission 100 / negatives → ValidationError | SC-008 |
| version stamp | modelVersion === "2.0.0" and tracks package major | SC-011 |
| determinism | identical inputs → byte-identical outputs across runs | SC-012 |

FE-side (adapter + e2e) covers SC-009 (free/offline) and SC-010 (both prices shown) plus per-field pt-BR
validation UX (TD-020 closure).
