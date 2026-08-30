# Phase 0 — Research: E1 pricing model

All frozen-scope questions and the four residuals were resolved by the owner (2026-07-05) and the two blocking
ADRs are **Accepted**, so this feature enters planning with **zero open NEEDS CLARIFICATION**. This document
records the resolved technical decisions (for traceability) and verifies the one new dependency (Constitution
II — dependencies verified, not assumed).

## R1 — Money type & rounding (ADR-0008, Part 2)

- **Decision**: Use **`decimal.js-light`**. Each cost line and each output is quantized to **2 decimals with
  `ROUND_HALF_UP`**; aggregates (`custo_producao`, `custo_total`, `preço_varejo/atacado`, marketplace gross-up)
  are the **sum of already-rounded lines**; intermediates and rates (R$/g, R$/h, R$/kWh) stay full-precision and
  are only quantized when emitted as a money field. Markup and the marketplace gross-up operate on the
  **displayed (rounded) `custo_total`** (WYSIWYG). Snapshots (E4) freeze `{ PRICING_MODEL_VERSION, inputs,
  rounded line values }`.
- **Rationale**: only "round-each-line, sum-the-rounded-lines" makes the visible breakdown sum to the visible
  total with **0 residual** (FR-032/FR-037) while staying deterministic and offline; native `number` floats
  cannot guarantee the cents close. Consistent with the ADR-0004 money policy (Decimal, 2dp, HALF_UP).
- **Verification**: `decimal.js-light` is the reduced build of `decimal.js` (same `Decimal` API subset:
  construction, arithmetic, `toDecimalPlaces(dp, rm)`, `Decimal.ROUND_HALF_UP`) — the exact surface ADR-0008
  requires; verified against current library docs during the ADR round (not inferred). Confidence: high.
- **Alternatives considered**: native `number`, round only at the end (rejected — breakdown fails to close,
  violates FR-032/A42); integer-cents via `dinero.js` v2 (rejected — the engine is rate-heavy R$/g, R$/h that
  are not integer cents, so a decimal step is needed anyway; overkill for a single offline BRL).

## R2 — Machine-hour capital recovery (ADR-0009, Option A)

- **Decision**: `machineHourRate = machineValue / machineLifetimeHours + maintenanceReservePerHour`
  (reserve optional, default 0); `machine = machineHourRate × printTimeHours`. Capital recovery is **one**
  line; the seller's **return** lives once in the markup over `custo_total` (A25); maintenance enters **only**
  as an explicit R$ wear reserve, never as a %-of-machine-value line.
- **Rationale**: provably eliminates the legacy triple-count (maintenance % + ROI + depreciation) and the
  dimensionally-broken depreciation; minimal, dimensionally correct, inputs a solo MEI can answer (machine
  value + expected lifetime hours ≈ years × hours/day).
- **Alternatives considered**: payback-window/hour (rejected as default — drops to R$0/h after payback,
  under-recovers long-term); blended TCO/hour (rejected — hides two concepts in one line, tension with the
  "breakdown sums to total" transparency goal). Both retained in ADR-0009 "Options considered".

## R3 — Version stamp (ADR-0008, Part 1)

- **Decision**: semver + an exported `PRICING_MODEL_VERSION` constant; **`"2.0.0"`** for E1 (the 001
  material+markup model is the implicit v1; the A25 base change `material → custo_total` is the major bump).
  `packages/pricing-core/package.json` version `0.0.0 → 2.0.0`; a gate test asserts the constant tracks the
  package major.
- **Rationale**: minimum ceremony that lets an E4 saved calc record "which formula produced this price";
  reproducible offline. A rich registry (1B) is deferred to E2/E4 when a second live version exists.

## R4 — Formula source & no server compute (FR-036)

- **Decision**: the entire E1 pipeline lives in `packages/pricing-core` (pure, deterministic, offline);
  the **backend performs no price computation**. The FE calls the core and only parses/validates/formats.
- **Rationale**: single source of truth (ADR-0004), Android/i18n reuse, and it keeps the calculator working
  fully offline and free (FR-035). No API contract change — `/api/v1/me` stays identity-only.

## R5 — FE adapter closes TD-020 (parseDecimal)

- **Decision**: moving the formula into `pricing-core` reduces `features/calculator/calculator-model.ts` to a
  thin adapter: **per-field pt-BR parse + validation** (reject + inline pt-BR message) → typed numbers →
  `computeCalculator` → format. This is the per-field validation UX that **TD-020** flagged as the proper fix
  for the silent `parseDecimal` misparse (`"1.2"`→12, `"R$ 100,00"`→NaN→0).
- **Rationale**: the 20-field surface already demands strict per-field validation (FR-038); doing it here
  retires TD-020 rather than carrying the 001 coercion forward. Validation via RHF + Zod (already in the stack).
- **Alternatives considered**: keep the 001 lenient `parseDecimal` (rejected — FR-038 forbids silent NaN→0 and
  the 10× mixed-separator error; TD-020 explicitly wants per-field UX, not a stricter regex alone).

## R6 — UI composition (reuse, no new DS)

- **Decision**: compose the existing `tf-*` primitives — `Field`, `NumberField`, `PriceHero`, `BreakdownRow`,
  `Card` (built in 001/003) — on the 003 `pages/calcular` surface; the transparent breakdown uses
  `BreakdownRow`; retail/wholesale via `PriceHero`. No new DS component is required for E1.
- **Rationale**: ADR-0007 DS is in place and homologated; E1 is a data/behavior increment, not a design one
  (UI pixels → Claude Design if any polish is needed later).

## Open risks (explicit, Constitution II)

- Formula-composition confidence **95%** (per spec) — the canonical worked example (SC-001) is the anchoring
  guard; any composition error surfaces as a failing numeric test before implementation lands.
- No open NEEDS CLARIFICATION. The four residuals (R-1..R-4) are owner-resolved (spec §5).
