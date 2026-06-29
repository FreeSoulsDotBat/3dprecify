# Foundation Increment — toolchain, quality gates, app skeletons, observability

**Increment**: 002-foundation · **Type**: tooling/infrastructure (NOT a user-facing feature)
**Created**: 2026-06-28 · **Status**: authored, pending gate review
**Design source**: ADR-0001..0004 + `docs/decisions/tech-stack-decisions.md` + `docs/decisions/audit-findings.md`
(decision rounds G1–G4). The ADRs ARE the design — this increment installs them. Per the lean-SDD ruling,
no separate plan.md/research.md is produced; the ADRs + this spec + tasks.md are the full record.

## Why this increment exists
Sprint 0 produced governance (constitution, agents, spec-kit) and the 001 walking-skeleton **spec**, plus a
working `packages/pricing-core` (canonical TS formula, tests green). But the **toolchain that 001 assumes does
not exist**: the repo is still npm/Vitest-2, there are no lint/format/type/boundary gates, no backend, no web
app, no contract pipeline, no observability, no deploy path. 001 cannot be implemented on the current ground.
This increment installs the real foundation so 001 (product) and every later increment run on it.

## Actors
The "users" of this increment are **developers and CI** (and the AI agents acting as them). Capabilities below
are phrased as what a developer/CI can do once the foundation is in place.

## Out of scope (explicit)
- Any 001 product behavior (auth screen, calculator UI, `/api/v1/me`) — those stay in 001, built AFTER this.
- The full corrected pricing model (E1), persistence/DB (E2), payments (E6), Capacitor/Android (E7).
- `pricing-core` package **build/publish** step and version identifier (TD-008 / A13 — deferred to E2).
- Real production deploy execution / GCP project provisioning by Jonatan (this increment delivers the
  Dockerfile, firebase config, CI deploy job, and WIF/region decisions; the one-time GCP setup is Jonatan's).
- shadcn component build-out beyond the minimum needed to prove the design-token + theming wiring.
- Session Replay (deferred, LGPD/cost — see O1 TD).

## Developer capabilities (functional requirements)

### C1 — Reproducible monorepo
- FR-C1.1 `pnpm install` at root sets up all workspaces; npm is removed. Root declares `packageManager`
  (Corepack-pinned pnpm) and `engines.node` = 24 LTS; `.nvmrc` = 24.
- FR-C1.2 A pnpm **catalog** pins a single React 19 and single Vite across the workspace (Capacitor single-React
  requirement), consumed via `catalog:` in each package.
- FR-C1.3 Workspaces: `packages/*` (incl. existing `pricing-core`), `apps/web`, `backend` (Python, not a pnpm
  workspace — managed by uv). TS project references wire `apps/web` → `packages/pricing-core`.

### C2 — Quality gates, local and CI at parity
- FR-C2.1 **JS/TS**: ESLint (flat) + `eslint-plugin-boundaries` (FSD-Lite layers, no cross-imports, no internal
  barrels) + `dependency-cruiser`; **Prettier** + `prettier-plugin-tailwindcss` for format and class sort;
  `tsc -b` (project refs) for types; **Vitest 4** (V8 coverage).
- FR-C2.2 **Python**: **Ruff** (lint+format), **basedpyright** (strict), **import-linter** (domain-modular
  contracts), **pytest** + pytest-asyncio + httpx.
- FR-C2.3 **lefthook** runs the relevant subset pre-commit/pre-push; **CI runs the identical commands** via
  shared script targets (no drift by construction). CI also runs gitleaks + trufflehog, Orval drift-guard,
  Schemathesis, and a coverage ratchet (~100% on `pricing-core`).
- FR-C2.4 A developer can run one command per language (`pnpm gate`, `uv run gate` or equivalent) reproducing
  the CI gate locally. The existing PostToolUse `quality-gate.ps1` stops being a no-op and calls these.

### C3 — Backend skeleton (no product endpoints)
- FR-C3.1 FastAPI `create_app()` factory + lifespan; `pydantic-settings` (SecretStr) for config including the
  **per-env CORS allowlist** (A7), Firebase project, Sentry DSN, region.
- FR-C3.2 Central exception handlers → **error envelope** `{error:{code,message,details,correlationId}}`
  serialized via an **aliased Pydantic model** (camelCase, A9); `ErrorCode(str,Enum)` module (A5, Python is the
  single wire-error source); `asgi-correlation-id` pinned to header `X-Correlation-Id`.
- FR-C3.3 **structlog** emits the **correlation-first log schema** (O1): `{ts, level, correlationId, service,
  route, userUid?, status, latencyMs, errorCode?, releaseSha}` from a request-lifecycle middleware; Sentry
  initialized (backend DSN secret, release = git SHA).
- FR-C3.4 Public `GET /health` → `{status:"ok"}` (unversioned); `/api/v1` router mounted (empty of product
  routes). `camelCase` wire via `alias_generator=to_camel`.
- FR-C3.5 Firebase token verification helper exists (`run_in_threadpool`) but is wired to the **emulator** in
  dev (A6); no product route consumes it yet.

### C4 — Contract pipeline
- FR-C4.1 The backend emits OpenAPI; **Orval** generates the TS client + TanStack Query hooks + error wrapper +
  `ErrorCode` union into **`apps/web/src/shared/api/` (committed, A8)**, exempt from ESLint/boundaries/no-barrel.
- FR-C4.2 CI **drift-guard**: regenerate + `git diff --exit-code` fails on drift. The error envelope is declared
  in OpenAPI so **Schemathesis** can validate it.
- FR-C4.3 The Orval error wrapper extracts `correlationId` (header+body) into a typed `ApiError` and tags Sentry
  (A9); FE consumes, does not originate.

### C5 — Frontend skeleton (no product screens)
- FR-C5.1 `apps/web` = Vite + React 19 + TS PWA (`base:'./'`, single-React dedupe), `vite-plugin-pwa` (manifest,
  service worker, icons from the logo symbol), zod-validated env.
- FR-C5.2 Tailwind v4 + shadcn/ui (Radix); **design tokens as CSS vars** with `data-theme` light+dark; brand
  palette wired (orange `#f7931e`, purple `#7800ff`, cyan `#15bddc`, neutrals); self-hosted WOFF2 fonts.
  **Semantic role→color assignments are gated on the contrast (AA) check (TD-002)** — palette is present, final
  text/role mappings land when the design contrast gate clears.
- FR-C5.3 FSD-Lite topology with Atomic Design as taxonomy **inside `shared/ui`** (atoms/molecules = shadcn,
  never top-level folders); kebab-case files; no internal barrels (lint entry-point rules).
- FR-C5.4 **TanStack Router** (A1) + **TanStack Query v5** + **Zustand v5** (incl. an auth store fed by Firebase
  `onIdTokenChanged`) + **RHF v7 + Zod v4** (Zod reused as `pricing-core` input guard). Typed **pt-BR messages**
  module (i18n-ready string source; full i18n = TD-001).
- FR-C5.5 The skeleton renders a placeholder shell (header + theme toggle + empty route) proving routing, theming,
  tokens, fonts, PWA install, and the auth store — but NO product screen.

### C6 — Auth dev environment
- FR-C6.1 `firebase.json` + `.firebaserc` configure the **Auth emulator** (A6); a developer runs the emulator
  locally with no real credentials. Two Firebase projects (dev/prod) are referenced via settings; their real
  creation is Jonatan's manual step.
- FR-C6.2 `@nearform/playwright-firebase` wired for E2E auth against the emulator.

### C7 — Observability bundle (O1)
- FR-C7.1 The correlation-first log schema (C3.3) is documented in a short **debug runbook**
  (`docs/observability.md`): given a `correlationId`, where to look (Cloud Logging filter + linked Sentry issue,
  release-tagged). FE Sentry **breadcrumbs** (console/network/clicks) enabled.

### C8 — Assisted-testing harness (V1, V2)
- FR-C8.1 Playwright configured (Firebase emulator + playwright-firebase) + **Playwright MCP / Chrome DevTools
  MCP** available for the **qa-produto homologation loop**: drive browser → capture screenshots at defined
  viewports (mobile ≤414px + desktop) → judge vs acceptance criteria → emit a report (screenshots + preliminary
  verdict) for Jonatan to confirm/reject.
- FR-C8.2 Visual homologation is **advisory now** (DoD checklist item, human-confirmed), not a hard CI blocker
  (V2). A **DoD evidence template** captures the screenshots + Jonatan's confirmation. No pixel baselines yet (V1).

### C9 — Deploy path (delivered, not executed)
- FR-C9.1 **Dockerfile** for the FastAPI service (Cloud Run, keyless ADC); **Firebase Hosting** config for the
  SPA; region **southamerica-east1** (A10). CI deploy job authenticates via **WIF** (keyless); secrets flow
  GitHub Environments → GCP Secret Manager; Sentry auth-token secret for source-map upload (A11).
- FR-C9.2 Preview/smoke/rollback steps are scaffolded in CI (may be stubbed pending Jonatan's GCP provisioning).

### C10 — Governance reconciliation
- FR-C10.1 **Principle VIII** propagated into every `.claude/agents/*` that decides structure/schema/contracts
  (arquiteto, dev-backend, dev-frontend, dev-estrutura-de-dados, devops, seguranca): they infer NOTHING in those
  areas without owner sign-off.
- FR-C10.2 `plan-template.md` gains the **8th Constitution-Check gate** (Principle VIII).
- FR-C10.3 Stale artifacts reconciled to the decided stack: 001 `plan/tasks/data-model/contracts/api.md`,
  `decisions-backlog.md` (L9/28/36/37/40/48), `business-rules.md` ADR cross-refs, `constitution.md` L100 +
  `scrum-master.md` "orchestrates"→"advisor" (ADR-0001). `tech-debt.md` gains rows for TD-002 gates, A13
  version-id, and the deferred Session Replay / A9-FE-originates items.

## Success criteria (verifiable)
- SC-1 Fresh clone → `corepack enable && pnpm install` + `uv sync` → `pnpm gate` and the Python gate both run and
  pass on the skeleton (lint, format-check, types, tests, boundaries/import-linter).
- SC-2 CI runs the **same** commands as lefthook and is green on the skeleton; a deliberate boundary violation or
  drift makes CI **red** (gate proven, not cosmetic).
- SC-3 `packages/pricing-core` tests still green and **unchanged** (camelCase + integer percent preserved).
- SC-4 Backend serves `GET /health`; an induced error returns the **camelCase envelope** with a `correlationId`
  that also appears in the structured log line and the Sentry event.
- SC-5 `apps/web` builds, installs as a PWA, toggles light/dark via `data-theme`, and the auth store reflects the
  emulator sign-in state — with **no product screen** present.
- SC-6 Orval drift-guard: editing the OpenAPI without regenerating makes CI red.
- SC-7 Every `.claude/agents/*` listed in C10.1 contains the Principle-VIII no-inference clause; `plan-template`
  has 8 gates; no reconciled artifact still references npm/Node20/React18/Cloudflare/Render/snake-case wire/
  `{detail}` 401/`GOOGLE_APPLICATION_CREDENTIALS`.

## Definition of Done (tooling-increment variant — fills the gap audit U2 flagged)
A tooling increment has no user story to homologate, so the standard UI-visual DoD item is replaced:
- [ ] All success criteria SC-1..SC-7 met and shown (command output / screenshots in the DoD evidence block).
- [ ] Local gate == CI gate (parity demonstrated); CI green on the skeleton.
- [ ] No secret committed (gitleaks/trufflehog clean); secrets only via settings/Environments.
- [ ] No dead/placeholder config left active without a documented reason; `quality-gate.ps1` no longer a no-op.
- [ ] Constitution Check incl. Principle VIII: no architecture/standard introduced here was inferred — each
      traces to an ADR or a recorded decision round (G1–G4).
- [ ] Stale artifacts reconciled (SC-7); `audit-findings.md` items A1–A12/O1/V1–V2 marked applied.
- [ ] Jonatan's manual prerequisites listed and handed off (GCP/WIF/Firebase projects/MCP approval).

## Dependencies & assumptions
- Depends on Jonatan completing (out-of-band): approve the 2 MCPs (`claude` interactive), create dev/prod
  Firebase projects, provision GCP (Cloud Run, Secret Manager, WIF), set GitHub Environments secrets. The
  increment is authored so these are the ONLY manual external steps; everything else is code in-repo.
- Assumes brand palette from the Truth's Forge manual is final enough to wire as tokens; semantic role mapping
  waits on the contrast (AA) gate (TD-002).
- Assumes `pricing-core` stays the canonical formula source (Principle V); the backend never recomputes price.
