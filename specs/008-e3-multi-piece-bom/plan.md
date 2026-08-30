# Implementation Plan: E3 — Multi-piece BOM

**Branch**: `feature/008-e3-multi-piece-bom` | **Date**: 2026-07-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-e3-multi-piece-bom/spec.md`

## Summary

E3 lets a **premium** seller price a real order — a **BOM** of several lines (each an ad-hoc piece or a live
catalog-product reference, with a quantity) — and save/manage those assemblies. Owner decisions (spec
Clarifications + plan): the assembly total is the **independent per-piece sum** with a **per-marketplace-channel
rollup** (ADR-0016, `computeBom`, pricing-core **3.1.0**); the **whole BOM feature is Premium** — the first
paywalled compute — enforced by a **server-informed client route-guard** + **server-authoritative persistence**
(ADR-0015, reusing the E2 seam); persistence adds tables `boms`/`bom_lines` via a new migration **`0002`**,
mirroring the E2 `products` link-or-snapshot + last-known degradation (ADR-0013 pattern). The free single-piece
calculator and all E1/E2 guarantees stay unchanged.

**K-amendment (2026-07-11, spec K1–K4 + research R8 + ADR-0017 Proposed):** the user-facing name is **Kits**
— route **`/kits`**, a **5th nav tab "Kits"** (icon `boxes`), title "Monte seus kits" + approved subtitle
(all folded into the unpushed PR-A); saved kits list in a **4th catalog tab**; and every kit WRITE is an
**atomic kit-save + materialization** transaction — ad-hoc lines become **manual products** (refs NULL +
value snapshot, attention indicator derived, FR-310 relaxed ONLY on this service path) with **name dedup**
(`btrim` exact, live rows) — all PR-B scope. "BOM" stays the internal/technical term (code, tables, wire).

## Technical Context

**Language/Version**: TypeScript (React 19 / Vite / pricing-core, Node 24) + Python 3.12 (FastAPI, uv).

**Primary Dependencies**: pricing-core (offline TS engine — extended to 3.1.0), TanStack Router/Query, Zustand,
RHF+Zod, `tf-*` DS; FastAPI, SQLAlchemy 2.0 typed, Alembic, psycopg3, pydantic-settings.

**Storage**: PostgreSQL — new `boms` + `bom_lines` (migration `0002`, `down_revision = "0001"`).

**Testing**: vitest (pricing-core numeric + component), Playwright e2e (Auth emulator + real backend +
Postgres), pytest (CRUD/gate/isolation/lapse), import-linter, basedpyright, ruff.

**Target Platform**: mobile-first responsive web + desktop web (Android later); offline-capable compute.

**Project Type**: web (pnpm monorepo — `apps/web`, `backend`, `packages/pricing-core`).

**Performance Goals**: instant client-side recompute (no server round-trip for pricing); standard web app
responsiveness.

**Constraints**: camelCase wire, money-as-decimal-strings (never floats); `pnpm gate:all` parity (lefthook
pre-push == CI gate job); contract drift-guard 0 diff, `generated.ts` raw Orval; FSD-Lite boundaries
(eslint-boundaries + dependency-cruiser); failing-first tests; integration branch `develop`, owner-gated PRs;
deploy deferred to v1 (E1–E6); exact R$ prices deferred to E6.

**Scale/Scope**: 5 user stories; 2 new tables; 1 new pricing-core function (MINOR); ~5 REST routes; a new
BOM feature module + composer UI; delivery in 3 owner-gated PR slices (research R6).

## Constitution Check

*GATE: evaluated pre-Phase 0 and re-affirmed post-Phase 1. All pass (with the noted ADRs).*

- [x] **I. Scalability & Quality First** — assembly math is canonical in the shared `pricing-core` (web +
      future Android from one core); the shared-plate mode can extend it additively later. No scalability
      traded for convenience.
- [x] **II. Truth Over Approval** — the honesty seam is explicit: the offline BOM compute is **not**
      hard-paywalled and ADR-0015 + FR-406 say so; the teaser is honest (no fake success). Confidence carried
      on each decision (D-A 82%, D-B 76%).
- [x] **III. Test-First** — `computeBom` numeric invariants (SC-402 byte-identity, FR-412 no-double-rounding,
      per-slot isolation) written failing-first; pytest CRUD/gate/isolation/lapse failing-first; Playwright +
      qa-produto visual homologation before done. Pricing has explicit numeric cases.
- [x] **IV. Server-Side Entitlements (NON-NEGOTIABLE)** — satisfied via **ADR-0015**: every *protected
      operation* (all BOM persistence) passes the server-authoritative E2 seam (`require_entitlement` /
      `require_catalog_read`); feature access is a **server-informed** route-guard (derives from
      `GET /api/v1/entitlement`, never a client flag — the banned anti-pattern). The offline compute has no
      server operation to gate; this is recorded and stated honestly, not inferred.
- [x] **V. Clean Architecture Integrity** — reuses the E2 products link-or-snapshot + degradation machinery,
      the entitlement seam, the domain types, and `computeCalculator`; no fork, no duplication. Deviations
      captured as ADR-0015/0016; migration lineage honored (new `0002`, never amend `0001`).
- [x] **VI. Lean Living Documentation** — spec amended (business-rules dated amendment for the first paywalled
      compute); ADRs added; plan artifacts minimal and cross-linked; no superseded rules left behind.
- [x] **VII. Spec-Driven Flow** — specify → clarify (owner Q1/Q2/Q3) → plan (this) with Constitution Check;
      spec is source of truth; `/speckit-tasks` next; analyze gate available.
- [x] **VIII. Architecture Decided Before Implementation (NON-NEGOTIABLE)** — all structural/architectural
      choices trace to owner decisions + ADRs: D-A→ADR-0015 (enforcement), D-B/D-B.1→ADR-0016 (pricing-core
      3.1.0 + per-channel rollup), D-C→ADR-0013 (migration `0002` + typed-column snapshot, owner-confirmed).
      Nothing in these areas inferred; each surfaced ≥3 options with confidence for the owner.

**Result: GATE PASS.** No unjustified violations; Complexity Tracking empty.

**Re-evaluated 2026-07-11 (K-amendment): GATE PASS holds.**
- **II (Truth)** — materialization outcomes are surfaced honestly (`materializations[].action`
  "created"/"referenced"; the reference-wins collision is visible, never silent); the manual-product
  attention indicator states plainly that filament+printer should be linked.
- **IV (Server entitlements)** — unchanged; materialization rides INSIDE the already-gated kit write.
- **V (Clean architecture)** — the FR-310 relaxation is **path-scoped to the kit-save service**; the public
  products API contract is untouched; "manual product" REUSES the existing refs-null degraded row shape
  (zero products migration); the dedup is service logic, not a new constraint that could break E2 accounts.
- **VI (Lean docs)** — recorded as dated spec Clarifications (K1–K4), research R8, and **ADR-0017
  (Proposed** — owner accepts at the PR-B gate; the dedup case-rule, exact vs case-insensitive, is the
  explicitly flagged low-confidence item ~75%).
- **VIII (Architecture first)** — all K decisions went through the arquiteto (R8) BEFORE implementation.

## Project Structure

### Documentation (this feature)

```text
specs/008-e3-multi-piece-bom/
├── plan.md              # this file
├── spec.md              # feature spec (owner decisions in Clarifications)
├── research.md          # Phase 0 — decisions R1..R6
├── data-model.md        # boms + bom_lines schema (typed link-or-snapshot)
├── contracts/
│   ├── api-surface.md        # /api/v1/boms REST surface (server-gated persistence)
│   └── pricing-core-bom.md   # computeBom 3.1.0 TS contract + invariants
├── quickstart.md        # §1..§7 validation scenarios
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
packages/pricing-core/src/
├── index.ts             # + computeBom, BomLineInput, BomLineResult, BomChannelRollup, BomResult; VERSION 3.1.0
├── rounding.ts          # export toMoney / sumMoney / Decimal (now public — the MINOR surface)
└── *.test.ts            # + bom compute numeric suite (SC-402, FR-412, isolation)

backend/
├── app/
│   ├── models/__init__.py       # + Bom, BomLine (typed link-or-snapshot, CHECKs, indices)
│   ├── api/boms.py              # + CRUD router (require_entitlement / require_catalog_read)
│   └── ...
├── alembic/versions/0002_e3_bom.py   # boms + bom_lines (down_revision = "0001")
└── tests/test_boms.py           # failing-first: CRUD round-trip, gate, isolation, lapse, degradation, 422

apps/web/src/
├── features/bom/                # composer (compose lines, quantities, live breakdown + per-channel rollup)
│   └── bom-compute.ts           # thin adapter: line → PriceInput (live vs last-known) → computeBom
├── entities/bom/                # uid-keyed cache + hooks (mirror entities/catalog)
├── pages/bom/                   # BOM route(s) — server-informed guard; teaser for free/signed-out
└── shared/api/generated.ts      # regenerated (raw Orval) with the /boms client + types
```

**Structure Decision**: extend the existing pnpm-monorepo web layout (Option 2) — reuse `pricing-core`,
`backend/app`, and `apps/web` FSD-Lite layers. A new `feature/bom` module composes the calculator; it MUST NOT
import from `feature/calculator` internals or `pages` (E2's boundary lesson — share via `pricing-core` +
`entities`). BOM feature routes are guarded like E2 product routes but gate on the server entitlement status.

**K-amendment structure deltas (R8):**
- `apps/web/src/app/router.tsx` — route path becomes **`/kits`** (module stays `pages/bom/`; no redirect —
  nothing was ever published at /bom).
- `apps/web/src/widgets/app-nav/` — 5th `NAV_ITEMS` entry "Kits" (roving tabindex self-adapts; grid CSS +
  nav tests + 390px overflow e2e go 4→5); `shared/ui/icon.tsx` inlines the `boxes` glyph (lucide-static).
- `apps/web/src/features/catalog/` — a 4th catalog tab "Kits" listing saved kits (PR-B, reads the new
  `entities/bom` cache).
- `backend/app/api/boms.py` + a **kit-save service** (`_materialize` step inside the SAME transaction):
  dedup → insert manual products (refs NULL + snapshot) → kit + lines; public `products.py` untouched.
- Slicing: **K1 (vocabulary + /kits + 5th tab + icon) folds into the unpushed PR-A**; K2–K4 land with PR-B;
  PR-C unchanged (degradation lifecycle).

## Complexity Tracking

> No Constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
