# ADR-0016: pricing-core 3.1.0 — BOM compose contract (`computeBom`) with per-channel rollup

- **Status**: Accepted
- **Date**: 2026-07-10
- **Deciders**: Jonatan (owner) + arquiteto + Claude
- **Extends**: ADR-0008 (versioning & rounding), ADR-0011 (3.0.0 multi-channel result contract)

## Context

E3 prices a multi-piece assembly. Owner decisions (spec 008): **Q1** the assembly total is the **independent
per-piece sum** (each line priced by the existing engine × its quantity, summed — no shared-print-job pooling);
**Q1/D-B.1** the assembly ALSO shows a **per-marketplace-channel rollup** (in scope for E3). We must decide
where the assembly-total math lives so it stays canonical and testable.

Ground truth in the repo: `packages/pricing-core/src/index.ts` exports `computeCalculator(input): PriceResult`
with `PRICING_MODEL_VERSION = "3.0.0"`, `custoTotal/precoVarejo/precoAtacado` already rounded (2dp), and
`channels: ChannelResult[]` (per-slot, with `error` isolation). `rounding.ts` has `toMoney`, `sumMoney(rounded[])`
and re-exports `Decimal` — but these are **not** exported from the package entry. ADR-0008's rounding policy is
*"every aggregate = sum of the already-rounded lines"* (the "receipt" property). The assembly total is a **new
aggregate one level above** the per-piece results.

## Options considered (≥3, per Constitution)

### Option A — Pure client orchestration, no core change, no semver bump
Feature layer calls `computeCalculator` per line and sums.
- Pros: zero core change; SC-402 trivial.
- Cons: to sum **canonically** the feature layer must either duplicate the money-math or force-export
  `sumMoney/toMoney` — and exporting new public API is itself a MINOR bump. "No bump" is only real **with
  duplication**, which violates ADR-0008 ("one money truth") + Principle V; FR-412 would not be unit-tested in
  the core; the per-channel rollup logic would live outside the canonical engine.
- Confidence: 45%.

### Option B — Canonical `computeBom(lines)` helper in the core; MINOR bump to 3.1.0 (CHOSEN)
A new `computeBom(lines: BomLineInput[]): BomResult` composes `computeCalculator` per line, multiplies each
money field by `quantity` via `Decimal`, aggregates via `sumMoney`, and defines the per-channel rollup rule.
- Pros: the assembly total (headline + per-channel) is **canonical and unit-tested where the formula already
  lives**; byte-identity by construction (a single line × qty 1 returns exactly `computeCalculator`'s result,
  SC-402/FR-402); clean separation — feature layer resolves `line → PriceInput` (live vs last-known, D3/D6),
  the core computes + aggregates; **additive** (`computeCalculator` unchanged) so a MINOR bump per ADR-0008.
- Cons: semver bump + update the version↔major gate-test + a small new public surface.
- Scalability: high — a future "shared-plate" mode (Q1 left it open) lands as another canonical function beside
  it, never a fork.
- Confidence: 76%.

### Option C — Hybrid: core exposes a sum/aggregate util; per-line compute unchanged
- Pros: moves only the canonical aggregation into the core.
- Cons: still MINOR (new exported API); the per-channel rollup rule stays ambiguous between core and feature —
  worse than B, which fixes it. Confidence: 68%.

## Decision

**Option B** — a canonical `computeBom` in `pricing-core`, version **3.1.0** (MINOR: additive). The assembly
math (headline totals AND the per-channel rollup) lives in the core; the feature layer performs **no** money
arithmetic. Per owner decision D-B.1, the **per-channel rollup is in scope for E3**.

**Contract (canonical shape; full types in `specs/008-e3-multi-piece-bom/contracts/pricing-core-bom.md`):**
- `BomLineInput = { input: PriceInput; quantity: number }` (`quantity` a finite integer ≥ 0).
- `computeBom(lines: BomLineInput[]): BomResult` where `BomResult` carries: each line's `PriceResult` with its
  quantity and quantity-scaled money; the **assembly aggregate** `custoTotal/precoVarejo/precoAtacado` =
  `sumMoney(perLineRounded × qty)`; and `channels: BomChannelRollup[]` — grouped by the `marketplace` key,
  each summing `precoAnuncioVarejo/recebidoLiquidoVarejo/precoAnuncioAtacado/recebidoLiquidoAtacado/
  freightCost*` × qty across the lines that carry that marketplace, with **per-slot isolation** (a line whose
  channel slot is in `error` contributes zero to that marketplace's rollup and the rollup surfaces that a
  contributing line was skipped — honestly, never silently); `modelVersion = "3.1.0"`.

**Invariants (unit-tested in the core):**
- **FR-402 / SC-402**: `computeBom([{input, quantity: 1}])` assembly totals === `computeCalculator(input)`
  totals, byte-identical.
- **FR-412 (no double-rounding)**: aggregates use `sumMoney` over already-rounded per-line×qty money
  (`Decimal.times(qty)` → `toMoney`), never native float `+`/`*` — the ADR-0008 receipt property, one level up.
- **Per-slot isolation**: one line's bad channel never throws and never corrupts a sibling marketplace's rollup
  (extends SC-107 to the assembly).

Jonatan approved Option B + in-scope per-channel rollup on 2026-07-10.

## Consequences

- Positive: one canonical money truth (ADR-0008 upheld); FR-402/FR-412 tested in the core; the version registry
  gains 3.1.0 with a clear additive rationale; feature layer stays pure orchestration + reference resolution.
- Negative / accepted: MINOR version churn (registry + gate-test update); the per-channel rollup adds real
  complexity (marketplace alignment + per-slot isolation) that must be covered by explicit numeric tests — a
  deliberate scope choice (D-B.1) over deferring it.
- Follow-ups: the shared-plate pricing mode (Q1 alternative) remains a future additive function; if the wire
  ever needs the assembly result server-side, the decimal-string transport rules (ADR-0008/0011) apply
  unchanged — but E3 keeps compute client-side (ADR-0015).
