# ADR-0004: Technology stack & coding standards

- **Status**: Accepted
- **Date**: 2026-06-28
- **Deciders**: Jonatan (owner) + lead session, informed by an 11-agent internet research sweep (2025–2026).

## Context
Per Constitution Principle VIII (no inference) + ADR-0003, the full structural/architectural/communication/
coding-standards surface had to be decided explicitly before implementation. An 11-agent research sweep produced
option landscapes; Jonatan decided each in themed rounds (F1–F4, B1–B2, F3.1, C1, D1–D2, T1, S1, X). The detailed
record with options + confidence is `docs/decisions/tech-stack-decisions.md`; raw research is in the session
scratchpad (`research-01..11-*.md`).

## Decision — the ratified stack
**Monorepo & tooling:** pnpm workspaces (catalogs pin one React/Vite) · lefthook git hooks (gates JS+Python via
`uv run`) · no orchestrator now → Turborepo at first CI pain · Node 24 LTS · Vite `base:'./'` + single-React
dedupe (Capacitor-ready).

**Frontend:** React + Vite PWA (TS). Styling = Tailwind v4 + shadcn/ui (Radix; Base UI fallback). Tokens = CSS
custom properties now → Style Dictionary later; theming via `data-theme`. Self-hosted WOFF2 fonts. Architecture =
**FSD-Lite topology + Atomic Design as taxonomy inside `shared/ui`** (atoms/molecules = shadcn, never top-level
folders); boundaries enforced by eslint-plugin-boundaries + dependency-cruiser + TS project refs; **no internal
barrels** (public API via lint entry-point rules); kebab-case files. State = Zustand v5; server cache = TanStack
Query v5; forms = RHF v7 + Zod v4 (zod reused as pricing-core input guard); auth via `onIdTokenChanged` → Zustand;
offline writes = own IndexedDB pending-sync record + TanStack transport (E2).

**Backend:** FastAPI (Py 3.12), domain-modular → modular-monolith + import-linter; thin-selective repository;
`Depends` now → DI container later; strict Pydantic-v2 DTO ≠ SQLAlchemy ORM; `create_app()` factory + lifespan +
pydantic-settings (SecretStr); `firebase-admin` verify in `run_in_threadpool`; central exception handlers →
ADR-0002 envelope + structlog + asgi-correlation-id + Sentry. Tooling = uv (single package), Ruff (lint+format),
basedpyright (strict); pytest + pytest-asyncio + httpx; coverage ratchet (≈100% on pricing). No Python pricing
engine (formula canonical in TS; server treats results as data).

**Contracts:** server-authoritative OpenAPI → **Orval + TanStack Query v5** codegen; **camelCase wire** via
Pydantic `alias_generator` (ADR-0002 R3.2 revised A→B, zero mapping); Python `ErrorCode` enum → TS union; drift
guard = regen + `git diff`; Schemathesis contract tests; `/api/v1` from day one.

**Data (E2):** SQLAlchemy 2.0 + psycopg3 + Alembic (async template, naming_convention, date-prefixed). Money =
`Numeric(18,6)` unit / `Numeric(12,2)` settled, `Decimal`, ISO-4217 column, ROUND_HALF_UP. PK = UUIDv7 native
`uuid`. Multi-tenancy = defense-in-depth phased (app-layer `owner_uid` helper first + RLS backstop; `owner_uid`
on every owned row). Soft-delete = `deleted_at` + partial unique indexes + append-only history for money/saved
calcs. Seeding = hybrid (Alembic bulk_insert + idempotent scripts + polyfactory).

**Testing:** Vitest 4 (V8 coverage, component visual) + Playwright (page visual, e2e via Firebase emulator +
@nearform/playwright-firebase) + pytest/polyfactory; AI browser QA via Playwright MCP + Chrome DevTools MCP
(non-gating); flaky = 0 local / 2 CI + quarantine.

**Deploy & secrets:** backend = Google Cloud Run (Firebase-admin via keyless ADC); SPA = Firebase Hosting; CI auth
= Workload Identity Federation (keyless); secrets = GitHub Environments → GCP Secret Manager later; env matrix =
dev+prod with separate Firebase projects; frontend env validated with zod (VITE_* are public); leak prevention =
gitleaks + trufflehog, rotation-first.

## Options considered
Full per-decision options + confidence in `docs/decisions/tech-stack-decisions.md`; research detail in scratchpad.
Notable reversals from research: package manager npm→**pnpm** (Capacitor single-React); wire casing snake→**camel**
(no tool transforms case for free); Atomic Design used as **taxonomy-in-ui**, not top-level folders.

## Consequences
- Positive: every structural choice is explicit, owner-approved, current (2025–2026), and machine-enforceable —
  the AI-generated codebase has deterministic guardrails (boundaries lint, import-linter, strict types, CI gate).
- Trade-offs: pnpm + lefthook + basedpyright are pre-1.0/extra binaries (pin centrally); FSD-Lite + boundary lint
  add upfront ceremony (intended); Astral/tooling pre-1.0 churn mitigated by central version pinning.
- Follow-ups: build the foundation increment (pnpm workspace + tooling + boundaries + CI extension) then resume
  the 001 walking skeleton; lock data irreversibles before the E2 model; GATES before ship: Peace Sans web/app
  license, brand palette WCAG contrast on both themes. Still deferred (tech-debt): i18n lib (TD-001), entitlement
  design (TD-005, E2), payments (TD-006, E6), pricing-core pkg build (TD-008).
