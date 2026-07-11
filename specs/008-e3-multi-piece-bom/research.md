# Phase 0 Research — E3 Multi-piece BOM

Consolidates the architecture decisions (arquiteto brief + owner decisions 2026-07-10). Every NEEDS
CLARIFICATION from the spec/plan is resolved here. Format: Decision · Rationale · Alternatives.

## R1 — Entitlement enforcement for a client-side premium compute (D-A → ADR-0015)

- **Decision**: Server-informed **client route-guard** for BOM feature access (gates on the authoritative
  `GET /api/v1/entitlement`, never a local flag) + **server-authoritative persistence** through the existing
  E2 seam (`require_entitlement` writes, `require_catalog_read` active|lapsed reads). The offline compute is
  **not** hard-paywalled; the design says so honestly.
- **Rationale**: Principle IV (NON-NEGOTIABLE) binds *protected operations* = every server effect = all BOM
  persistence, which is gated verbatim by the E2 seam. A purely offline computation has no server operation to
  gate; pretending otherwise would fork the canonical engine (ADR-0008 "backend never recomputes"). The banned
  anti-pattern is a client-flag-driven guard ("client never trusted for feature-gating").
- **Alternatives**: server-mediated compute (rejected — forks the formula, breaks offline, risks SC-402);
  pure client hybrid (folded into the chosen option).

## R2 — pricing-core contract for the assembly total (D-B → ADR-0016)

- **Decision**: A canonical `computeBom(lines: {input: PriceInput; quantity}[]): BomResult` in `pricing-core`,
  version **3.1.0** (MINOR, additive). Assembly headline totals `= sumMoney(perLineRounded × qty)`; the
  feature layer does **no** money arithmetic. `computeCalculator` is unchanged and reused per line.
- **Rationale**: keeps one canonical money truth (ADR-0008), unit-tests FR-402 byte-identity and FR-412
  no-double-rounding **in the core**, and cleanly splits "resolve line → PriceInput" (feature) from "compute +
  aggregate" (core). `toMoney/sumMoney/Decimal` already exist in `rounding.ts` (currently unexported) and
  encode the receipt-rounding property one level up.
- **Alternatives**: pure client orchestration (would duplicate money-math or export utils = still MINOR, and
  leaves FR-412 untested in core); hybrid sum-util (leaves per-channel rollup ambiguous).

## R3 — Per-channel marketplace rollup scope (D-B.1)

- **Decision**: **In scope for E3.** `BomResult.channels` groups by `marketplace` key and sums
  `precoAnuncio*/recebidoLiquido*/freightCost*` × qty across contributing lines, with **per-slot isolation** —
  a line whose channel slot is in `error` contributes zero to that marketplace's rollup and the rollup honestly
  surfaces that a line was skipped (never silent).
- **Rationale**: owner chose the richer assembly view. Because it is non-trivial (alignment + isolation) it
  MUST be canonical inside `computeBom` and covered by explicit numeric tests (extends SC-107 to the assembly).
- **Alternatives**: defer per-channel rollup, show only the direct price total (arquiteto's lean recommendation
  — not chosen).

## R4 — Persistence: migration lineage + schema shape (D-C → extends ADR-0013)

- **Decision (bound)**: A **new Alembic migration `0002`** (`down_revision = "0001"`) creating `boms` +
  `bom_lines`. Never amend the shipped `0001` (replay lineage — ADR-0013). Not an open decision.
- **Decision (owner sub-choice)**: BOM-line last-known snapshot = **typed NUMERIC columns**, mirroring the E2
  `products` link-or-snapshot pattern (DB-level `>= 0` / `<> 'NaN'` CHECKs), with `channels`/`other_costs` as
  JSONB exactly as `products` does today.
- **Rationale**: maximum consistency with the E2 pattern (`bom_line : product :: product : filament/printer`),
  reuses the domain types (`MONEY_SETTLED`, `MONEY_RATE`, `QTY_*`, `PERCENT`), and keeps invariants in the DB.
- **Alternatives**: a single `piece_snapshot` JSONB (leaner, ~25 fewer columns, but no DB-level NUMERIC CHECKs —
  not chosen).

## R5 — Reference + degradation semantics (from spec Q2, reused from E2)

- **Decision**: A `bom_lines.product_id` FK `ON DELETE SET NULL` + typed last-known snapshot columns + a
  link-or-snapshot CHECK — the exact E2 `products` degradation (D3/D6). Write logic mirrors `products._apply`:
  `product_id` present ⇒ re-snapshot from the live resolved product each write; NULL (degraded) ⇒ persist the
  editable overrides. A reference that does not resolve to an owned/live product ⇒ **422, no existence oracle**
  (reuse the E2 `_unresolvable` pattern, SC-308). Ad-hoc and referenced lines may coexist in one BOM.
- **Rationale**: reuse, don't reinvent — E2 already ships and homologated this machinery.

## R6 — Delivery shape (owner-gated PR slices, mirroring E2)

- **Decision**: Slice the epic into owner-gated PRs on `develop`, each failing-first and demoable where
  possible: **PR-A** the free-standing compute + composer behind the server-informed guard (US1 + US5 teaser +
  `computeBom` 3.1.0 + per-channel rollup); **PR-B** persistence (US2 + US4 — `boms`/`bom_lines` migration
  `0002`, CRUD behind the E2 gate, per-account isolation, lapse freeze); **PR-C** catalog-referenced lines +
  degradation (US3). Exact task breakdown is `/speckit-tasks`.
- **Rationale**: mirrors the E2 three-PR cadence that worked; keeps each PR reviewable and homologable.

## Resolved unknowns

| Unknown (spec/plan) | Resolution |
|---|---|
| BOM pricing model (Q1) | Independent per-piece sum (ADR-0016) |
| Line sources (Q2) | Both ad-hoc + catalog-ref, live + last-known (R5) |
| Free/premium boundary (Q3) | Whole feature Premium; enforcement per ADR-0015 |
| Principle IV vs offline compute | Server-informed guard + server-gated persistence (ADR-0015) |
| pricing-core contract + semver | `computeBom`, 3.1.0 MINOR (ADR-0016) |
| Per-channel rollup scope | In scope (R3) |
| Migration lineage | New `0002`, never amend `0001` (R4) |
| Snapshot shape | Typed columns mirroring `products` (R4) |

## R7 — C1: shared piece-form home (2026-07-11, arquiteto)

**Decision context (Principle VIII gate, pre-T005).** The BOM composer's expanded line must host the E1
calculator piece form *verbatim* (ux §1.3): `FieldGroup`/`SectionTitle`/`OtherCostsSection`/`MarketplaceSection`/
`PriceResults` (`calculator-form.tsx`), `CalcFormValues`/`calculatorResolver`/`defaultCalcValues` + field metas
(`calculator-schema.ts`), and `computeFromForm` (`calculator-model.ts`). All live in `features/calculator/` and
form a tight cluster (`calculator-form → calculator-model → fee-prefill/fee-seal → calculator-schema`).
eslint-boundaries + dependency-cruiser forbid **any** feature→feature import, so `features/bom` may reach none of
it (nor a new `features/piece-input/` — still feature→feature). Pages→feature IS allowed; `pages/catalogo/
produto-page.tsx` already composes these exact sections + schema + `computeFromForm` at the page layer (shipped,
owner-homologated, gates green).

| Option | Pros | Cons | Scalability | Conf. |
|---|---|---|---|---|
| **A — Page/widget-hosted composition** (produto-page precedent; `features/bom` owns only what it CAN — `bom-compute` + boundary-clean presentational shells) | zero moves of shipped E1/E2 code → SC-402/409 by construction; smallest reviewable diff for the owner-gated PR; exact shipped precedent; no FSD bending; piece form reused not duplicated (V); honors the plan's binding Structure Decision | the per-line section-threading editor lives at page/widget layer, not literally inside `features/bom` (a refinement of the plan *sketch*, not its Structure Decision) | high — shells + adapter stay reusable for PR-B/PR-C; a widget host keeps the page thin | **85%** |
| **B — Relocate the form body to `entities/piece`** | cleanest long-term direction if ≥4 surfaces consume it; lets `features/bom` literally own the composer | must move ~1000+ lines of SHIPPED code (form+model+schema+fee-seal+fee-prefill move as one cluster) inside an E3 PR → large SC-402/409 risk + heavy review; a multi-section RHF form + `computeFromForm` orchestration is feature-grade, so it bends FSD (entities = an entity's data/UI, not a form feature); splits calculator across two homes | high (eventually) but wrong time/cost | **45%** |
| **C — Whole composer at page layer; `features/bom` = `bom-compute` only** | simplest wiring | deviates most from the plan sketch; very large page file; rollup/summary/LineCard shells are NOT reusable for PR-B/PR-C (pages can't import pages) — dominated by A at no saving | medium (shell reuse lost) | **30%** |

**Decision: Option A (85%).** It is the exact shipped, owner-homologated produto-page idiom one level up; it
touches **no** shipped calculator code (SC-402/SC-409 hold by construction), yields the leanest owner-gated diff,
duplicates nothing (Principle V), and satisfies the plan's binding Structure Decision (`features/bom` never
imports `features/calculator` — it is the **page** that imports the calculator, which FSD permits). Option B is
recorded as the sanctioned **future** evolution *iff* a 4th consumer emerges (then a dedicated ADR + its own PR,
Principle VI) — not an E3 PR-A cost. This refines the plan's structure *sketch* ("composer in `features/bom`")
without contradicting its Structure Decision; plan.md/tasks.md are NOT edited (the refinement lives here).

**Wiring shape the implementer follows (T005/T006):**
- `features/bom/` (feature — imports only `pricing-core` + `entities` + `shared/ui`; NEVER `features/calculator`):
  - `bom-compute.ts` — thin wrapper `composeBom(lines: { input: PriceInput; quantity }[]): BomResult` over
    pricing-core `computeBom`. (The "live vs last-known" wire→`PriceInput` resolution named in the plan is a
    **PR-B/PR-C** concern over persisted `BomLineOut`; PR-A lines are all in-memory forms, so PR-A `bom-compute`
    is just the wrapper.)
  - Presentational shells: `BomLineCard` (collapsed summary row + chevron + qty stepper + remove, with a
    **`children` slot** for the expanded editor), `AssemblySummaryBar` (pinned total), `ChannelRollup` (renders
    one `BomChannelRollup`, honest `skippedLines`/`contributingLines===0` captions). These read `BomResult`/
    `BomLineResult` money and render via `shared/ui` `BreakdownRow`/`PriceHero` — they do **no** arithmetic (§0.2).
- **Piece-form editor = page-or-widget layer** (MAY import `features/calculator`). Recommend `widgets/bom-line-editor/`
  (canonical FSD home for a cross-feature composite; keeps the page thin; a page-local `pages/bom/` file is an
  acceptable lighter variant mirroring produto-page). It hosts ONE line's `useForm<CalcFormValues>` (+
  `useFieldArray` for channels/otherCosts) and mounts the calculator sections verbatim; the in-line "Usar produto
  salvo" picker prefills via **reuse** of `product-mapping.productToForm(product).values` (E2 mapping, not a
  fork) and shows the `seals.adjusted` provenance on edit.
- `pages/bom/bom-page.tsx` (page) — the T006 server-informed guard (`useEntitlement` → `active`, else teaser),
  owns `lines[]` + expand state, and orchestrates: renders each `BomLineCard` with the `bom-line-editor` in its
  slot; collects each line's built `PriceInput` + quantity → `features/bom` `composeBom` → `BomResult` → feeds
  `AssemblySummaryBar` + `ChannelRollup`.
- **Compute seam (no duplication).** `features/bom` cannot reach the `CalcFormValues → PriceInput` parse either
  (it lives in `calculator-model`/`calculator-schema`). So the calculator **exposes the per-line built
  `PriceInput`** — either an additive `input: PriceInput | null` on `CalcOutcome` or a small extracted
  `formToPriceInput` that `computeFromForm` delegates to. This is a pure, byte-identity-preserving change *inside*
  `features/calculator` (no boundary crossed; pinned by the T002 SC-402 fixtures + existing calculator tests).
  Each line editor calls `computeFromForm` once for its sections + per-unit `PriceResults`, and the page passes
  the same call's `PriceInput` to `composeBom`; because both derive from the identical `PriceInput`,
  `BomResult.lines[i].line` is byte-identical to the line's `computeFromForm` result (SC-402 anchor). Line-total
  rows read `BomLineResult` (per-unit × qty from the core), never re-multiplied in JSX (§1.6/§0.2).
