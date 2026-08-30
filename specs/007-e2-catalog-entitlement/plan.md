# Implementation Plan: E2 — catalog + persistence + entitlement scaffolding

**Branch**: `feature/007-e2-catalog-entitlement` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

**Input**: spec.md (owner clarifications Q1/Q2/Q3/Q5 folded; Q4 resolved via ADR-0012) +
[research.md](./research.md) (arquiteto, Phase 0) + [data-model.md](./data-model.md)
(dev-estrutura-de-dados, Phase 1 — **ratified by this plan**) + **ADR-0012** (entitlement ledger) +
**ADR-0013** (persistence stack), both owner-accepted 2026-07-09.

## Summary

E2 delivers the project's first database, the first live Constitution-IV enforcement, and the catalog domain.
Backend: Postgres (local Docker in dev/CI — ADR-0013/deploy posture) with Alembic migration 0001 carrying the
full ratified schema (`accounts`, `entitlement_grants` ledger, `filaments`, `printers`, `products` with
reference+fallback); a `require_entitlement` FastAPI dependency (ADR-0012) denying `ENTITLEMENT_REQUIRED`
(403) on 100% of persistence routes with the Q3 freeze expressed at authorization time (write-binary,
lapsed=read-only); an operator **CLI grant script** (no admin route); REST CRUD
`/api/v1/filaments|printers|products` + `GET /api/v1/entitlement` — all honest-contract from day 1 (the 006
Schemathesis suite auto-fuzzes every new route). Frontend: real Catálogo screens (CRUD forms), calculator
pre-fill pickers (byte-identical math — pricing-core untouched), the uid-keyed offline READ cache (fee-catalog
pattern, purge-on-signout), and the honest free-tier teaser. **Largest increment yet — deliberately shipped
as MULTIPLE PRs to `develop`** (foundational DB+gate first, then story slices), not one giant PR.

## Technical Context

**Language/Version**: Python 3.12 (uv) + TypeScript (Node 24, pnpm) — existing stack (ADR-0004)

**Primary Dependencies**: NEW backend: SQLAlchemy 2.0 typed + Alembic + psycopg3 (async engine) — ADR-0013;
testcontainers (dev-dep, DB-backed tests); NEW infra: Docker Postgres (compose service dev / service
container CI). Frontend: NO new runtime dependency (TanStack Query + idb-keyval reused for the uid-keyed read
cache; RHF+Zod for CRUD forms; tf-* DS primitives)

**Storage**: PostgreSQL — schema per [data-model.md](./data-model.md) (ratified): `accounts` (uid PK, JIT),
`entitlement_grants` (append-only ledger — audit + truth, ADR-0012), `filaments`, `printers`, `products`
(FK `ON DELETE SET NULL` + typed resolved-value columns + CHECK "link OR full snapshot" for US6-4);
`NUMERIC(12,2)` settled / `NUMERIC(18,6)` unit-rate money (ADR-0008-consistent); `channels[]`/`otherCosts[]`
as validated JSONB with money-as-string; text+CHECK enums; soft-delete for voluntary deletion; **zero schema
footprint for the Q3 freeze** (authorization-time decision, data untouched)

**Testing**: pytest + testcontainers with a **VISIBLE Docker-availability skip guard** (`gate:be` without
Docker SKIPS DB tests loudly; CI ubuntu runners always have Docker → authoritative there) — ADR-0013;
Schemathesis conformance auto-covers every new route (token stub stays invalid → 401 never hits the DB);
vitest component tests (CRUD forms, pickers, teaser); Playwright e2e (catalog flows + SC-310 E1 no-regression
— the existing free/offline/signed-out guards must keep passing untouched)

**Target Platform**: unchanged (Cloud Run-shaped backend, SPA) — but E2 runs local-only per the deploy
posture; Cloud SQL provisioning is v1-launch (A41), "provision = replay the same Alembic migrations"

**Project Type**: web monorepo + first persistence layer

**Performance Goals**: entitlement check = 1 indexed PK lookup per protected op (cache seam documented,
deferred — ADR-0012); catalog lists unpaginated (small personal data — research R4); pre-fill from local
cache = instant/offline

**Constraints**: client NEVER trusted for entitlement (IV); free calculator path NEVER touches the DB
(FR-313); per-account isolation absolute (FR-307 — owner-scoped queries + defense-in-depth indices); no
secrets in repo (DB creds = local compose defaults/env); wire stays camelCase (ADR-0002) with snake_case DB
(mapping table in data-model §8); `ENTITLEMENT_REQUIRED` is the ONLY new ErrorCode (no quota/conflict —
phantom codes)

**Scale/Scope**: 5 tables · 4 new API resource groups (~14 operations) · 1 CLI script · ~6 new frontend
surfaces (catalogo pages, 2 CRUD form sets, 2 pickers, teaser, entitlement state) · 2 new backend layers
(`app/db`, `app/entitlement`) · MVP = US1–US5, then US6/US7

## Constitution Check

- [x] **I. Scalability & Quality First** — schema is Cloud-SQL-portable by construction (no exotic
      extensions; migrations are the provisioning path); entitlement ledger append-only (auditable at scale);
      per-account indices from day 1; cache seam documented instead of premature caching.
- [x] **II. Truth Over Approval** — no phantom error codes (ENTITLEMENT_REQUIRED only); write routes declare
      their REAL 422; conformance fuzzing from day 1; the teaser promises no price/date; DB-test skip is
      VISIBLE, never silently green; data-model §11 tensions were surfaced and reconciled into the spec
      (write-binary/3-tier precision; tariff placement) rather than papered over.
- [x] **III. Test-First** — every story starts with failing tests: the US1 gate gets failing pytest
      (deny/isolation/forge) BEFORE `require_entitlement` exists; CRUD stories get failing round-trip pytest +
      component tests; US5 gets the byte-identity test (catalog-pick vs manual — the SC-305 anchor) before the
      picker; US7 gets failing teaser component/e2e. No pricing formula is touched (SC-305/SC-310 prove it).
- [x] **IV. Server-Side Entitlements** — the feature IS this principle going live: `require_entitlement` on
      100% of persistence routes (US1 scenario 4 audits it), ledger authoritative (ADR-0012), client state
      never consulted, grant path operator-only by construction (CLI, no route).
- [x] **V. Clean Architecture Integrity** — read cache REUSES the fee-catalog pattern (Query+IndexedDB) with
      the uid-key + purge-on-signout hardening (identity-leak lesson); pydantic validation MIRRORS the E1
      rules (single vocabulary, no second rule set); ORM/wire layers deliberately separate (ADR-0013);
      `app.db`/`app.entitlement` join import-linter contracts; no dead surface (admin endpoint NOT built).
- [x] **VI. Lean Living Documentation** — ADR-0012/0013 recorded once, referenced here; data-model is the
      single schema source; TD-004/TD-005 retired in the registry, not duplicated.
- [x] **VII. Spec-Driven Flow** — clarifications resolved pre-plan (owner 2026-07-09); analyze gate before
      tasks; spec remains source of truth (with the two dated reconciliations).
- [x] **VIII. Architecture Decided Before Implementation** — every structural choice traces: entitlement
      mechanism → ADR-0012 (owner-chosen); data layer/migrations/test-DB strategy → ADR-0013 (owner-chosen);
      grant path → owner-chosen (CLI); schema shapes → data-model.md D1–D6 recommendations ratified by this
      plan under those ADRs; FSD placement → research R6 (content-level convention); deploy/DB posture →
      owner rule 2026-07-09. Nothing inferred.

**Post-design re-check**: no new violations — contracts/quickstart add no scope beyond the spec.

## Project Structure

### Documentation (this feature)

```text
specs/007-e2-catalog-entitlement/
├── spec.md                  # FR-301..313, SC-301..310 (+2 dated reconciliations)
├── research.md              # Phase 0 (arquiteto) — R1..R7, ADR skeletons, sources
├── data-model.md            # Phase 1 (estrutura-de-dados) — RATIFIED: D1..D6 + entities + rules
├── contracts/
│   └── api-surface.md       # Phase 1 — E2 wire surface (operations × statuses × schemas)
├── quickstart.md            # Phase 1 — validation guide per US
├── checklists/requirements.md
└── tasks.md                 # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── db/                        # NEW — async engine/session factory (ADR-0013), settings-driven URL
│   ├── models/                    # NEW — SQLAlchemy 2.0 typed models (accounts, entitlement_grants,
│   │                              #        filaments, printers, products) per data-model.md
│   ├── entitlement/               # NEW — require_entitlement dependency (ADR-0012) + grant/revoke core
│   ├── api/
│   │   ├── filaments.py           # NEW — CRUD, responses honest (401/403/422 ErrorEnvelope)
│   │   ├── printers.py            # NEW — CRUD (same shape)
│   │   ├── products.py            # NEW — CRUD + reference/fallback semantics (US6)
│   │   └── entitlement.py         # NEW — GET /api/v1/entitlement {status, source, expiresAt}
│   ├── errors.py                  # + ENTITLEMENT_REQUIRED in ErrorCode; + ENTITLEMENT_ERRORS responses=
│   └── scripts/grant_premium.py   # NEW — operator CLI (uv entry point): grant/revoke/list, ledger-direct
├── alembic/ + alembic.ini         # NEW — migration 0001 = full data-model schema
├── tests/                         # failing-first: gate/isolation/forge, CRUD round-trips, freeze, CLI,
│                                  #   conformance (auto-extends), testcontainers + visible skip guard
└── pyproject.toml                 # + sqlalchemy, alembic, psycopg[binary], testcontainers (dev)

docker-compose.yml                 # NEW — local Postgres service (dev); CI gate job gains a postgres
.github/workflows/ci.yml           #   service container (ubuntu runners ship Docker — verified in research)

contracts/openapi.json             # regenerated (all new operations) — drift-guard same-commit
apps/web/src/shared/api/generated.ts  # regenerated Orval client + ENTITLEMENT_REQUIRED in the union

apps/web/src/
├── entities/catalog/              # NEW — uid-KEYED read cache (fee-catalog pattern: Query+idb-keyval),
│                                  #   purge-on-signout (identity-leak lesson), honest staleness
├── entities/user/                 # + entitlement state (GET /api/v1/entitlement) for Conta honesty
├── features/catalog/              # NEW — filament/printer/product CRUD forms (RHF+Zod, E1 validation rules)
├── features/calculator/           # + pre-fill pickers (filament/printer) — fields populate, stay editable
├── pages/catalogo/                # REPLACES the placeholder — real list/create/edit screens + teaser state
├── pages/conta/                   # + honest plan line (status/source/expiry; ≤1-refresh UX)
└── shared/i18n/messages.pt-br.ts  # + catalog/teaser/entitlement copy (pt-BR)
apps/web/tests/e2e/                # + catalog CRUD/pre-fill/teaser specs; SC-310 = existing guards untouched
```

**Structure Decision**: existing monorepo; new backend layers `app/db`, `app/models`, `app/entitlement`
enter the import-linter contracts (settings stays a leaf; api → entitlement → db direction enforced).
Frontend follows research R6: `entities/catalog` (data), `features/catalog` (forms), real `pages/catalogo`.

## Phase 0 — Research (complete)

[research.md](./research.md): R1 TD-005 options → **owner chose the ledger (ADR-0012)** + CLI grant (R1a,
owner) + dedicated `GET /api/v1/entitlement` (R1b, ratified); R2 data layer → **owner chose SQLAlchemy 2
typed + Alembic + psycopg3 async (ADR-0013)**; R3 dev/CI DB → testcontainers + visible skip guard (ratified
in ADR-0013); R4 API surface (no pagination; ENTITLEMENT_REQUIRED only; declared 422 on writes); R5 uid-keyed
read cache; R6 FSD placement; R7 risks (grant propagation, Cloud SQL replay, freeze/LGPD posture). Library
claims verified against current sources (appendix).

## Phase 1 — Design artifacts

- [data-model.md](./data-model.md) — **ratified as-is** (D1 accounts-table B; D2 append-only ledger; D3
  FK-SET-NULL + typed fallback columns + link-or-snapshot CHECK; D4 JSONB with money-as-string; D5
  NUMERIC money; D6 soft-delete voluntary deletion; freeze = zero schema footprint; §11 tensions already
  reconciled into the spec).
- [contracts/api-surface.md](./contracts/api-surface.md) — every E2 operation × published statuses ×
  schemas (the conformance suite enforces it from day 1).
- [quickstart.md](./quickstart.md) — runnable validation per US, incl. the SC-305 byte-identity check, the
  lapse-freeze walk, and the skip-guard visibility check.
- Agent context — after_plan hook points CLAUDE.md at this plan.

## Delivery strategy (honest — multiple PRs, not one giant)

1. **PR-A (foundational)**: compose + `app/db` + models + migration 0001 + entitlement dependency/CLI +
   `ENTITLEMENT_REQUIRED` pipeline + gate/isolation failing-first tests + CI service container + testcontainers
   guard. Independently valuable: Constitution IV is live and audited.
2. **PR-B (US3+US4+US5 MVP)**: filament/printer CRUD (API+UI) + read cache + calculator pickers +
   byte-identity tests + e2e. The demoable premium loop.
3. **PR-C (US6+US7)**: products (reference/fallback) + honest teaser + Conta plan line + polish/dod-evidence.
Each PR: full `gate:all` + e2e + owner authorization (ADR-0006). Visual homologation per UI story
(qa-produto), 005-style.

## Complexity Tracking

No constitution violations to justify — table intentionally empty.
