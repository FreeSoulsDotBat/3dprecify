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
