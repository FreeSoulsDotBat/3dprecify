# Tasks: Walking Skeleton — minimal authenticated price

**Input**: Design documents from `specs/001-walking-skeleton/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, research.md

**Tests**: MANDATORY (Constitution Principle III). Test tasks are written and observed FAILING before
implementation. Monorepo: `packages/pricing-core` (TS), `apps/web` (React+Vite PWA), `backend` (FastAPI).

## Format: `[ID] [P?] [Story?] Description`
- **[P]**: parallelizable (different files, no incomplete dependencies)
- **[Story]**: US1 / US2

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create monorepo workspace at repo root (npm workspaces): root `package.json` with workspaces
      `["packages/*","apps/*"]`, base `tsconfig.base.json`.
- [ ] T002 [P] Configure lint/format/type-check at root (ESLint + Prettier + tsc) with scripts `lint`,
      `format:check`, `typecheck` in root `package.json`.
- [ ] T003 [P] Initialize backend Python project in `backend/` (`pyproject.toml`/`requirements.txt`:
      fastapi, uvicorn, firebase-admin, pytest, httpx).
- [ ] T004 Wire the existing PostToolUse quality-gate to real commands by defining the npm scripts from T002
      (so `.specify/scripts/quality-gate.ps1` stops being a no-op).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Must complete before user stories.**

- [x] T005 [P] Scaffold `packages/pricing-core` (package.json, tsconfig, Vitest) — module + tests.
- [ ] T006 [P] Scaffold `apps/web` (Vite + React + TS, `vite-plugin-pwa`, Vitest, Playwright config).
- [ ] T007 [P] Scaffold `backend/app` (FastAPI app, public `GET /health` → `{status:"ok"}`, pytest config).
- [ ] T008 Firebase wiring (env-driven, no secrets committed): web client init in
      `apps/web/src/lib/firebase.ts`; backend admin init in `backend/app/auth.py` (`GOOGLE_APPLICATION_CREDENTIALS`).

---

## Phase 3: User Story 1 — Sign in and reach the calculator (Priority: P1) 🎯 MVP

**Goal**: Authenticated users reach the calculator; signed-out users are sent to sign in; the server verifies the token.
**Independent Test**: Signed out → calculator blocked, sign-in offered. Sign in with Google → calculator shows.

### Tests for User Story 1 (MANDATORY — write first, must FAIL) ⚠️
- [ ] T009 [P] [US1] pytest token cases for `GET /api/v1/me` (no header→401, malformed→401, expired→401,
      valid→200+uid) in `backend/app/tests/test_me.py` (mock `verify_id_token`).
- [ ] T010 [P] [US1] Playwright spec: signed-out user cannot reach the calculator and is offered sign-in, in
      `apps/web/tests/auth.spec.ts`.

### Implementation for User Story 1
- [ ] T011 [US1] Implement protected `GET /api/v1/me` with `firebase-admin` token verification in
      `backend/app/auth.py` + route in `backend/app/main.py` (401 on missing/invalid).
- [ ] T012 [US1] Implement Google sign-in (`GoogleAuthProvider`, `signInWithPopup`, session) in
      `apps/web/src/features/auth/`.
- [ ] T013 [US1] Implement route guard redirecting signed-out users to sign-in in `apps/web/src/features/auth/`.
- [ ] T014 [US1] Visual homologation by `qa-produto` (auth gate) via Playwright/Chrome DevTools MCP; capture
      screenshots, check console/network.

**Checkpoint**: US1 independently testable — auth boundary works end-to-end.

---

## Phase 4: User Story 2 — Compute a minimal price (Priority: P2)

**Goal**: User enters inputs and sees material cost + suggested price; calculation works offline.
**Independent Test**: Inputs → results match the formula; offline recompute still works.

### Tests for User Story 2 (MANDATORY — write first, must FAIL) ⚠️
- [x] T015 [P] [US2] Vitest numeric cases for `computePrice` (full table incl. R$2,00/R$3,00 and edge cases:
      grams=0, markup=0, rollWeight=0→throws, negatives→throws, NaN→throws) in
      `packages/pricing-core/tests/computePrice.test.ts`. ✅ 7/7 green.
- [ ] T016 [P] [US2] Playwright spec: enter sample inputs → `R$ 2,00` / `R$ 3,00`; rollWeight=0 → friendly
      pt-BR message in `apps/web/tests/pricing.spec.ts`.

### Implementation for User Story 2
- [x] T017 [US2] Implement `computePrice` (formula + `ValidationError`) in
      `packages/pricing-core/src/index.ts` per `contracts/pricing-core.md`. ✅ test-first (red→green).
- [ ] T018 [US2] Build the calculator screen (4 inputs, 2 results, pt-BR copy, BRL formatting) consuming
      `pricing-core` in `apps/web/src/features/pricing/`.
- [ ] T019 [US2] Place the calculator behind the auth guard (reachable only when signed in).
- [ ] T020 [US2] Visual homologation by `qa-produto` (calculator + offline recompute + **renders without breakage at ≤414px viewport**, SC-005) via MCP.

**Checkpoint**: US1 + US2 both work independently → demoable MVP.

---

## Phase 5: Polish & Deploy (Cross-Cutting)

- [ ] T021 PWA offline: configure `vite-plugin-pwa` in `apps/web/vite.config.ts`; verify app shell loads offline
      and the calculation still runs.
- [ ] T022 [P] Deploy: web SPA to Cloudflare Pages + FastAPI to Render/Fly (per research R5); record public URL.
- [ ] T023 [P] Run the `quickstart.md` validation scenarios end-to-end; fix drift.
- [ ] T024 DoD/Constitution check: lint/format/type-check green, no dead/duplicated code, spec/plan still current.

---

## Dependencies & Execution Order
- **Setup (P1)** → **Foundational (P2)** → **US1 (P3, MVP)** → **US2 (P4)** → **Polish/Deploy (P5)**.
- US1 and US2 are independent after Foundational, but P1 priority makes US1 the MVP.
- Within each story: tests (FAIL) → implementation → visual homologation.

## Parallel Opportunities
- Setup: T002, T003 in parallel.
- Foundational: T005, T006, T007 in parallel.
- US1 tests: T009, T010 in parallel. US2 tests: T015, T016 in parallel.

## Implementation Strategy
- **MVP = US1** (auth boundary). Stop and validate before US2.
- Then US2 (the first real price). Then PWA/offline + deploy.
- Test-first throughout; `qa-produto` homologates every UI-touching story before it is marked done.

## Notes
- No DB, no payments, no Capacitor/Android in this slice (see spec Out of Scope).
- The formula lives ONLY in `packages/pricing-core` (Principle V); the backend does not recompute price.
