# Tasks: 002-foundation — install the decided toolchain & skeletons

**Input**: `specs/002-foundation/spec.md` + ADR-0001..0004 + `docs/decisions/{tech-stack-decisions,audit-findings}.md`
**Type**: tooling increment (no product behavior). Tests here = the gates proving themselves (SC-1..SC-7).
**Preserve**: `packages/pricing-core` stays as-is (camelCase + integer percent; tests green).

## Format: `[ID] [P?] Description with path`
- **[P]** parallelizable (different files, no incomplete dep).

---

## Phase 0: Governance reconciliation (do first — agents must carry Principle VIII before structural work)
- [ ] T101 [P] Add the **8th Constitution-Check gate** (Principle VIII — Architecture Decided Before
      Implementation) to `.specify/templates/plan-template.md`.
- [ ] T102 [P] Propagate the Principle-VIII no-inference clause into `.claude/agents/{arquiteto,dev-backend,
      dev-frontend,dev-estrutura-de-dados,devops,seguranca}.md` (no inferring structure/architecture/contracts/
      standards without owner sign-off; on ambiguity, STOP + ≥3 options + confidence).
- [ ] T103 [P] Fix "orchestrates/sequence/enforce" → "advisor" in `constitution.md` (~L100) and
      `.claude/agents/scrum-master.md` per ADR-0001 (scrum-master advises, main thread orchestrates).
- [ ] T104 [P] Reconcile `docs/decisions-backlog.md` stale lines: L9 (payments ADR numbering), L28 (R3.2 A→B
      camelCase), L36 (NUMERIC 12,4→18,6/12,2), L37 (owner_id→owner_uid), L40 (ORM/driver decided), L48 (§6
      router/Context/Prettier "NOW" retracted → record G1 outcomes).
- [ ] T105 [P] Fix wrong ADR cross-refs in `docs/product/business-rules.md` (payments cited as ADR-0002).
- [ ] T106 [P] Add `tech-debt.md` rows: TD-002 gates (Peace Sans license, palette AA contrast) with %/trigger;
      A13 pricing-core version-id (E2); deferred A9-FE-originates + Session Replay.

## Phase 1: Reproducible monorepo
- [ ] T107 Replace root `package.json`: remove npm `workspaces`; add `packageManager` (Corepack pnpm pin),
      `engines.node":"24"`, root scripts (`gate`, `lint`, `format:check`, `typecheck`, `test`). Add `.nvmrc`=24.
- [ ] T108 Create `pnpm-workspace.yaml` (`packages/*`, `apps/web`) + **catalog** pinning React 19 + Vite single
      versions; point `packages/pricing-core` deps at `catalog:` where applicable.
- [ ] T109 Create `tsconfig.base.json` + project references wiring `apps/web` → `packages/pricing-core`
      (`tsc -b`). Verify `pnpm install` + `pnpm -r typecheck` green (pricing-core unchanged).

## Phase 2: Quality gates (local == CI)
- [ ] T110 [P] ESLint flat config + `eslint-plugin-boundaries` (FSD-Lite layers, no internal barrels) +
      `dependency-cruiser` config at root.
- [ ] T111 [P] Prettier config + `prettier-plugin-tailwindcss`; wire `format:check`.
- [ ] T112 [P] Vitest 4 root config (V8 coverage) + coverage-ratchet tool (baseline + enforcer, ~100% pricing-core).
- [ ] T113 [P] `backend/pyproject.toml` (uv single package): fastapi, uvicorn, firebase-admin, pydantic v2,
      pydantic-settings, structlog, asgi-correlation-id, sentry-sdk, pytest(+asyncio), httpx, schemathesis,
      ruff, basedpyright(strict), import-linter. `uv sync`.
- [ ] T114 [P] import-linter contracts (domain-modular) in `backend/`; Ruff + basedpyright config.
- [ ] T115 `lefthook.yml` running the JS+Py gate subsets pre-commit/pre-push via **shared script targets**;
      rewrite `.specify/scripts/quality-gate.ps1` to call the real `gate` targets (no longer a no-op).

## Phase 3: Backend skeleton (no product routes)
- [ ] T116 `backend/app/main.py` `create_app()` factory + lifespan; mount `/api/v1` (empty) + `GET /health`.
- [ ] T117 [P] `backend/app/settings.py` pydantic-settings (SecretStr): CORS allowlist per env (A7), Firebase
      project, Sentry DSN, region, emulator host.
- [ ] T118 [P] `backend/app/errors.py`: `ErrorCode(str,Enum)` (single wire-error source, A5) + aliased Pydantic
      envelope model (camelCase, A9) + central exception handlers.
- [ ] T119 [P] `backend/app/observability.py`: `asgi-correlation-id` pinned to `X-Correlation-Id`; structlog
      correlation-first schema middleware (O1); Sentry init (release = git SHA).
- [ ] T120 [P] `backend/app/auth.py`: firebase-admin verify helper in `run_in_threadpool`, wired to the **Auth
      emulator** in dev (A6). No product route consumes it yet.
- [ ] T121 CORS middleware from settings allowlist; expose `X-Correlation-Id`. pytest: induced error → camelCase
      envelope + correlationId present (SC-4).

## Phase 4: Contract pipeline
- [ ] T122 Export OpenAPI from the app (with the envelope declared as a component). `orval.config.ts` generating
      client + TanStack Query hooks + error wrapper + `ErrorCode` union into `apps/web/src/shared/api/` (A8).
- [ ] T123 Commit generated `shared/api`; ESLint/boundaries/no-barrel **override** exempts it. Orval error
      wrapper → typed `ApiError` (extract correlationId, tag Sentry) (A9/C4.3).
- [ ] T124 CI drift-guard (regen + `git diff --exit-code`) + Schemathesis run against `/health` + envelope (SC-6).

## Phase 5: Frontend skeleton (no product screens)
- [ ] T125 `apps/web` Vite + React 19 + TS PWA: `base:'./'`, single-React dedupe, zod-validated env,
      `vite-plugin-pwa` (manifest, SW, icons from logo symbol).
- [ ] T126 [P] Tailwind v4 + shadcn/ui init; `shared/ui` with Atomic taxonomy (atoms/molecules = shadcn).
- [ ] T127 [P] Design-token CSS-var file (`data-theme` light+dark) with brand palette wired; self-host WOFF2
      fonts. **Semantic role→color mapping left as TODO pending the AA contrast gate (TD-002).**
- [ ] T128 [P] TanStack Router (A1) + TanStack Query v5 provider + Zustand v5 auth store (Firebase
      `onIdTokenChanged`) + RHF v7 + Zod v4 (Zod reused as pricing-core input guard).
- [ ] T129 [P] Typed pt-BR messages module (string source; full i18n = TD-001).
- [ ] T130 Placeholder shell: header + theme toggle + empty route; proves routing/theming/tokens/fonts/PWA/auth
      store with NO product screen (SC-5).

## Phase 6: Auth dev environment
- [ ] T131 [P] `firebase.json` + `.firebaserc`: Auth emulator config (A6); dev/prod project aliases.
- [ ] T132 [P] `@nearform/playwright-firebase` wired; Playwright config (emulator) in `apps/web`.

## Phase 7: Observability + assisted-testing harness
- [ ] T133 [P] `docs/observability.md`: correlation-first debug runbook (correlationId → Cloud Logging filter +
      Sentry issue) (O1); enable FE Sentry breadcrumbs.
- [ ] T134 [P] Document the **qa-produto homologation loop** (V1) + advisory gating (V2) and add a **DoD evidence
      template** (`docs/templates/dod-evidence.md`: screenshots at ≤414px + desktop + Jonatan's confirmation).

## Phase 8: Deploy path (delivered, not executed)
- [ ] T135 [P] `backend/Dockerfile` (Cloud Run, ADC). Firebase Hosting config for the SPA. Region
      southamerica-east1 (A10).
- [ ] T136 Rewrite `.github/workflows/ci.yml`: pnpm/Corepack + uv; full gate (ESLint/boundaries/dep-cruiser/
      Vitest-V8 + Ruff/basedpyright/import-linter/pytest) + emulator + Orval drift-guard + Schemathesis +
      gitleaks/trufflehog + coverage ratchet; roll-up gate job. CI == lefthook (SC-1/SC-2).
- [ ] T137 [P] CI deploy job via **WIF** (keyless) + secrets GitHub Environments → Secret Manager + Sentry
      auth-token (A11); preview/smoke/rollback steps (stubbed pending Jonatan's GCP provisioning). PR template +
      CODEOWNERS.

## Phase 9: Reconcile 001 + verify
- [ ] T138 Reconcile `specs/001-walking-skeleton/{plan,tasks,data-model,quickstart}.md` + `contracts/api.md` to
      the decided stack (pnpm/Node24/React19/FSD-Lite/CloudRun+Firebase/camelCase/envelope+X-Correlation-Id/ADC/
      emulator). Re-map T001 to "redone under 002"; keep T015/T017 (pricing-core) as-is.
- [ ] T139 Verify SC-1..SC-7 (induce a boundary violation + a drift to prove CI goes red); fill the DoD evidence
      block; mark `audit-findings.md` A1–A12/O1/V1–V2 as applied; list Jonatan's manual prerequisites.

---

## Dependencies & order
Phase 0 (governance) ∥ Phase 1 → Phase 2 → (Phase 3 ∥ Phase 5 skeletons) → Phase 4 (needs backend OpenAPI +
web) → Phase 6/7 → Phase 8 (CI needs all gates) → Phase 9 (verify). pricing-core is never modified.

## Notes
- This increment introduces NO architecture/standard that isn't already in an ADR or recorded decision round
  (Principle VIII). Any newly-surfaced fork STOPS work and goes to Jonatan with ≥3 options + confidence.
- Jonatan's external manual steps (MCP approval, Firebase projects, GCP/WIF) are the only non-in-repo work.
