# Implementation Plan: E1 — Full corrected pricing calculator

**Branch**: `feature/004-e1-pricing-model` | **Date**: 2026-07-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-e1-pricing-model/spec.md`

## Summary

Replace the 001 walking-skeleton calculator (material + markup only) with the **full corrected clean-room
pricing model** on the 003 app shell. `packages/pricing-core` grows from a 2-input formula to the E1 pipeline —
material (+explicit waste) · energy (single effective-draw kW) · a **single** machine-hour capital-recovery
(`value ÷ lifetime + reserve`, ADR-0009 A, no triple-count) · failure over all three production inputs ·
finishing (time × rate) · optional labor + admin · markup over `custo_total` (base moved from `material`) ·
a basic single-channel marketplace gross-up on **both** retail and wholesale. The calculator stays **free and
offline**; the **backend performs no price computation** (FR-036). Deterministic money via ADR-0008 (each line
2-decimal HALF_UP, breakdown sums to the displayed total, `PRICING_MODEL_VERSION = "2.0.0"`).

Technical approach: a **client + shared-core refactor, no backend change**. The formula moves fully into
`pricing-core` (pure/offline, the single source of truth); the FE `features/calculator` becomes a thin
adapter (pt-BR parse → validate → call `pricing-core` → format) that also closes **TD-020** (`parseDecimal`
silent misparse) with per-field validation UX. UI reuses the existing DS primitives (`Field`, `NumberField`,
`PriceHero`, `BreakdownRow`, `Card`) and the 003 shell; the `pages/calcular` page composes the expanded form +
breakdown. Test-first: every SC (SC-001..SC-012) becomes a `pricing-core` numeric case before implementation;
e2e covers the calculator flows and the no-bad-numbers guards.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) on Node 24; React 19. No backend/server work in this slice.

**Primary Dependencies**: `packages/pricing-core` (pure TS engine, bumped `0.0.0 → 2.0.0`) · **`decimal.js-light`**
(deterministic 2dp HALF_UP money, per ADR-0008) · React 19 + Vite 8 PWA · TanStack Router/Query · RHF + Zod
(form + per-field validation) · Tailwind v4 + the `tf-*` DS primitives from 003.

**Storage**: N/A — E1 is stateless/ephemeral (input + result are client-only, never persisted; persistence is E2).

**Testing**: Vitest (unit — `pricing-core` numeric cases test-first, SC-driven; FE adapter parse/validate) ·
Playwright + Firebase Auth emulator (e2e — calculator flows, free/offline, no-bad-numbers) · coverage gate
(`packages/*` 100%).

**Target Platform**: Web PWA, mobile-first (TabBar ≤425px / sidebar >425px), offline-capable; future Android via
Capacitor (single React/Vite, ADR-0004). `Calcular` is the public, sign-in-free surface (003).

**Project Type**: Web application in a pnpm monorepo — `apps/web` (client) + `packages/pricing-core` (shared
offline engine). Backend (`apps/api`, FastAPI) is **untouched**.

**Performance Goals**: instantaneous client-side recompute on every input change (no server round-trip,
deterministic); no jank at 60 fps; no horizontal scroll at 390 px (inherits 003 FR-010).

**Constraints**: offline-capable · deterministic + locale-independent math (FR-039) · never render
`NaN`/`Infinity`/`#DIV/0!` (FR-038) · breakdown displayed lines sum to the displayed `custo_total` with 0
residual under HALF_UP 2dp (FR-032/FR-037) · pt-BR/BRL input UX (comma decimal, `R$` prefix), i18n-ready.

**Scale/Scope**: 20 input fields (§2.1) · one calculator page + its form/breakdown · ~6 breakdown lines ·
`pricing-core` grows from 1 exported compute fn to the E1 model (types + compute + rounding + version stamp).

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 (unchanged — still PASS).*

- [x] **I. Scalability & Quality First** — the formula lives once in the shared offline `pricing-core` (web +
      future Android + i18n-ready copy); no scalability trade for convenience.
- [x] **II. Truth Over Approval** — every technical choice traces to an **Accepted** ADR (0008/0009) or a
      recorded owner decision (A15/A16/A24/A25); the new dependency (`decimal.js-light`) is named and verified in
      research.md; formula-composition confidence stated (95%); residuals were resolved, not hidden.
- [x] **III. Test-First** — SC-001..SC-012 become `pricing-core` numeric cases **before** implementation; the
      canonical worked example is the anchor; e2e covers UI + guards.
- [x] **IV. Server-Side Entitlements** — N/A and honored: the E1 calculator is **free with no premium gate**
      (FR-035); no entitlement decision is made anywhere (client or server). Premium scaffolding is E2.
- [x] **V. Clean Architecture Integrity** — reuses the 003 shell, DS primitives and the `pricing-core`↔UI wiring;
      moves the formula into `pricing-core` (removes FE-side duplication, closes TD-020); FSD-Lite import
      direction preserved; no out-of-scope drift.
- [x] **VI. Lean Living Documentation** — `scope-draft.md` superseded to a banner; spec is the single source;
      no dead rules introduced.
- [x] **VII. Spec-Driven Flow** — clarify resolved (4 residuals owner-accepted 2026-07-05); spec homologated;
      analyze/checklist gates remain ahead of implement.
- [x] **VIII. Architecture Decided Before Implementation (NON-NEGOTIABLE)** — every structural/formula/money
      choice traces to ADR-0004 (stack), ADR-0007 (DS), **ADR-0008** (versioning + rounding), **ADR-0009**
      (machine-hour recovery), and the frozen decision log. **Nothing is inferred.** No unresolved
      architectural item remains → gate does not STOP the plan.

## Project Structure

### Documentation (this feature)

```text
specs/004-e1-pricing-model/
├── spec.md              # Homologated feature spec (owner 2026-07-05)
├── plan.md              # This file
├── research.md          # Phase 0 — resolved technical decisions + dependency verification
├── data-model.md        # Phase 1 — PriceInput / PriceResult entities + validation
├── quickstart.md        # Phase 1 — runnable validation (SC-001 anchor)
├── contracts/
│   └── pricing-core.md   # Phase 1 — pricing-core v2 public API contract (library contract; no HTTP)
├── scope-draft.md       # superseded banner → spec.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
packages/pricing-core/
├── src/
│   ├── index.ts             # E1 model: PriceInput/PriceResult, computeCalculator(), PRICING_MODEL_VERSION="2.0.0"
│   ├── rounding.ts          # decimal.js-light HALF_UP 2dp policy (ADR-0008); sole source of the rounding rule
│   └── index.test.ts        # SC-001..SC-012 numeric cases (test-first)
└── package.json             # version 0.0.0 → 2.0.0 (major bump, A25); gate test ties constant to major

apps/web/src/
├── features/calculator/
│   ├── calculator-model.ts       # thin adapter: pt-BR parse + per-field validation → pricing-core → format (closes TD-020)
│   ├── calculator-schema.ts      # RHF + Zod schema for the 20-field surface (§2.1), pt-BR messages
│   └── calculator-model.test.ts  # adapter parse/validate/format cases
├── pages/calcular/
│   ├── calcular-page.tsx          # composes the expanded form + transparent breakdown + prices
│   └── calcular.test.tsx          # page render/interaction
└── shared/ui/                     # REUSE: field, number-field, price-hero, breakdown-row, card (from 001/003)

apps/web/tests/e2e/
└── calculator.spec.ts            # extend: full model, retail+wholesale, marketplace, optional-0 isolation, no-bad-numbers, free/offline
```

**Structure Decision**: monorepo web app. The **formula is centralized in `packages/pricing-core`** (FR-036 —
single source, offline, backend never recomputes); the FE `features/calculator` is a presentation+adapter layer
over it. No new top-level structure; extends the FSD-Lite layers materialized in 003. Backend untouched.

## Complexity Tracking

> No Constitution Check violations — section intentionally empty.
