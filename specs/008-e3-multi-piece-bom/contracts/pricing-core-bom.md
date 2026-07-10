# Contract — `pricing-core` `computeBom` (3.1.0)

Canonical, offline, deterministic assembly compute (ADR-0016). Additive to 3.0.0 — `computeCalculator`,
`PriceInput`, `PriceResult`, `ChannelResult` unchanged. `PRICING_MODEL_VERSION` → `"3.1.0"`.

## Types (new, in `packages/pricing-core/src/index.ts`)

```ts
export interface BomLineInput {
  input: PriceInput;      // the existing single-piece input (reused verbatim)
  quantity: number;       // finite integer >= 0
}

export interface BomLineResult {
  line: PriceResult;      // computeCalculator(input) — per-UNIT, rounded (2dp), unchanged
  quantity: number;
  // per-line money scaled by quantity, rounded via toMoney (Decimal.times(qty)):
  custoTotal: number;     // line.custoTotal * qty
  precoVarejo: number;    // line.precoVarejo * qty
  precoAtacado: number;   // line.precoAtacado * qty
}

export interface BomChannelRollup {
  marketplace: string | null;          // group key
  precoAnuncioVarejo: number | null;   // Σ over contributing lines (× qty)
  recebidoLiquidoVarejo: number | null;
  precoAnuncioAtacado: number | null;
  recebidoLiquidoAtacado: number | null;
  freightCostVarejo: number;
  freightCostAtacado: number;
  contributingLines: number;           // how many lines fed this rollup
  skippedLines: number;                // lines whose slot for this marketplace was in `error` (honest, not silent)
}

export interface BomResult {
  lines: BomLineResult[];
  // assembly aggregates = sumMoney(perLineRounded × qty):
  custoTotal: number;
  precoVarejo: number;
  precoAtacado: number;
  channels: BomChannelRollup[];        // grouped by marketplace, per-slot isolation
  modelVersion: string;                // "3.1.0"
}

export function computeBom(lines: BomLineInput[]): BomResult;
```

## Money & rounding rules (ADR-0008 receipt property, one level up)

- Per-unit `line = computeCalculator(input)` — already rounded 2dp (unchanged).
- Per-line×qty: `toMoney(new Decimal(line.field).times(quantity))` — **never** native `number` `*`.
- Assembly aggregate: `sumMoney([...perLineRoundedTimesQty])` = `toMoney(Σ)` — sum of already-rounded values,
  idempotent → **no double-rounding** (FR-412). No native float `+`.
- `toMoney`/`sumMoney`/`Decimal` become **exported** from the package entry (currently in `rounding.ts`,
  unexported) — this new public surface is why 3.1.0 is a MINOR bump.

## Per-channel rollup (FR-403 assembly view, D-B.1 in scope)

- Group each line's `line.channels: ChannelResult[]` by `marketplace`.
- For each marketplace group, sum each money field × the line's quantity, per level (varejo/atacado).
- **Per-slot isolation (extends SC-107)**: a `ChannelResult` with `error != null` (null prices) contributes
  **zero** and increments `skippedLines`; it never throws, never NaNs a sibling, never silently drops. A
  rollup with `contributingLines === 0` reports null prices honestly.

## Invariants (unit-tested in the core — failing-first)

- **SC-402 / FR-402**: `computeBom([{ input, quantity: 1 }])` → `custoTotal/precoVarejo/precoAtacado` and the
  single `channels` rollup are **byte-identical** to `computeCalculator(input)` for the same input.
- **FR-412**: for any lines, aggregate === `sumMoney(perLine × qty)`; no divergence vs the displayed per-line
  numbers (anchored numeric fixtures).
- **Validation**: `quantity` finite integer ≥ 0; a `quantity: 0` line contributes zero (honest empty), no throw.
- **Isolation**: one line's channel in `error` does not corrupt any marketplace rollup or the headline total.
- **Version**: the existing version↔major gate-test updated for `"3.1.0"`.
