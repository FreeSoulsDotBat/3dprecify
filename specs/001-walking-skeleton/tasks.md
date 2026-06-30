# Tasks: Walking Skeleton — minimal authenticated price

> **✅ RECONCILED 2026-06-30 — 001 implemented on the 002 foundation; deploy is the only blocker.**
> Setup/tooling (T001–T008) was delivered by **`specs/002-foundation/`** (pnpm/uv, full gates, FastAPI
> skeleton, Firebase emulator, CI) — boxes checked here as done-by-002. Product slices landed in these commits:
> - **US1 auth gate** (T009–T013): `/api/v1/me` (`backend/app/api/me.py`, 5/5 pytest) + Google sign-in & route
>   guard (`apps/web/src/shared/session`, `app/router.tsx`, `features/auth`). Commit `2cc0a37`/`af8a10f`.
> - **Design tokens** (semantic graph in `apps/web/src/styles/`). Commit `097738c`.
> - **US2 calculator** (T016/T018/T019): pure `features/calculator/calculator-model.ts` (over pricing-core) +
>   thin `calculator-screen.tsx` using typed-TSX primitives in `shared/ui`. Commit `e171a37`.
> - **Auth-emulator e2e** (real homologation of the guarded calculator): commit `8784ddb` (`pnpm e2e`).
> - **PWA offline + icons** (T021): commit `14fa96f` (offline e2e proves FR-008).
>
> Paths drifted from the original task text (e.g. `features/pricing`→`features/calculator`,
> `tests/pricing.spec.ts`→`tests/e2e/calculator.spec.ts`); the commits above are the source of truth.
> **Still open:** T014/T020 visual homologation by `qa-produto` (MCP screenshots — behaviour & ≤414px render
> are already covered by e2e); **T022 deploy** (Cloud Run + Firebase Hosting), blocked on the manual cloud
> prerequisites in `specs/002-foundation/dod-evidence.md`.

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
- [x] T002 [P] Configure lint/format/type-check at root (ESLint + Prettier + tsc). _Done by 002 (`pnpm gate`)._
- [x] T003 [P] Initialize backend Python project in `backend/`. _Done by 002 (uv + `pyproject.toml`)._
- [x] T004 Wire the PostToolUse quality-gate to real commands. _Done by 002 (lefthook + `pnpm gate`)._

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ Must complete before user stories.**

- [x] T005 [P] Scaffold `packages/pricing-core` (package.json, tsconfig, Vitest) — module + tests.
- [x] T006 [P] Scaffold `apps/web` (Vite + React + TS, `vite-plugin-pwa`, Vitest, Playwright). _Done by 002._
- [x] T007 [P] Scaffold `backend/app` (FastAPI, `GET /health`, pytest). _Done by 002._
- [x] T008 Firebase wiring (env-driven, no secrets). _Web `apps/web/src/shared/lib/firebase.ts`; backend admin
      verification in `backend/app` (Firebase emulator in dev)._

---

## Phase 3: User Story 1 — Sign in and reach the calculator (Priority: P1) 🎯 MVP

**Goal**: Authenticated users reach the calculator; signed-out users are sent to sign in; the server verifies the token.
**Independent Test**: Signed out → calculator blocked, sign-in offered. Sign in with Google → calculator shows.

### Tests for User Story 1 (MANDATORY — write first, must FAIL) ⚠️
- [x] T009 [P] [US1] pytest token cases for `GET /api/v1/me` (no header→401, malformed→401, valid→200+uid).
      _`backend/app` — 5/5 green._
- [x] T010 [P] [US1] Playwright spec: signed-out user can't reach the calculator, sign-in offered.
      _`apps/web/tests/e2e/shell.spec.ts`._

### Implementation for User Story 1
- [x] T011 [US1] Implement protected `GET /api/v1/me` with token verification (401 on missing/invalid).
      _`backend/app/api/me.py`._
- [x] T012 [US1] Implement Google sign-in (`GoogleAuthProvider`, `signInWithPopup`, session).
      _`apps/web/src/shared/session/session-store.ts` + `features/auth/sign-in-screen.tsx`._
- [x] T013 [US1] Route guard redirecting signed-out users to sign-in. _`apps/web/src/app/router.tsx`
      (TanStack `beforeLoad` + context)._
- [ ] T014 [US1] Visual homologation by `qa-produto` (auth gate) via MCP screenshots. _PENDING (behaviour
      covered by shell.spec e2e)._

**Checkpoint**: US1 independently testable — auth boundary works end-to-end.

---

## Phase 4: User Story 2 — Compute a minimal price (Priority: P2)

**Goal**: User enters inputs and sees material cost + suggested price; calculation works offline.
**Independent Test**: Inputs → results match the formula; offline recompute still works.

### Tests for User Story 2 (MANDATORY — write first, must FAIL) ⚠️
- [x] T015 [P] [US2] Vitest numeric cases for `computePrice` (full table incl. R$2,00/R$3,00 and edge cases:
      grams=0, markup=0, rollWeight=0→throws, negatives→throws, NaN→throws) in
      `packages/pricing-core/tests/computePrice.test.ts`. ✅ 7/7 green.
- [x] T016 [P] [US2] Playwright spec: sample inputs → `R$ 2,00` / `R$ 3,00`; rollWeight=0 → friendly pt-BR
      message. _`apps/web/tests/e2e/calculator.spec.ts` (authenticated via Auth emulator)._

### Implementation for User Story 2
- [x] T017 [US2] Implement `computePrice` (formula + `ValidationError`) in
      `packages/pricing-core/src/index.ts` per `contracts/pricing-core.md`. ✅ test-first (red→green).
- [x] T018 [US2] Build the calculator screen (4 inputs, 2 results, pt-BR, BRL) consuming `pricing-core`.
      _`apps/web/src/features/calculator/` (pure `calculator-model.ts` + thin `calculator-screen.tsx`,
      typed-TSX primitives in `shared/ui`)._
- [x] T019 [US2] Place the calculator behind the auth guard. _Index route `beforeLoad` in `app/router.tsx`._
- [ ] T020 [US2] Visual homologation by `qa-produto` (calculator + ≤414px, SC-005) via MCP. _PENDING (≤414px
      render + offline recompute already covered by calculator.spec on the mobile project)._

**Checkpoint**: US1 + US2 both work independently → demoable MVP.

---

## Phase 5: Polish & Deploy (Cross-Cutting)

- [x] T021 PWA offline: `vite-plugin-pwa` + `navigateFallback`; app shell + calc run offline. _Proven by the
      offline e2e in calculator.spec (commit `14fa96f`)._
- [ ] T022 [P] Deploy: SPA → Firebase Hosting + FastAPI → Cloud Run (southamerica-east1, WIF); record URL.
      _PENDING — blocked on manual cloud prerequisites (`specs/002-foundation/dod-evidence.md`)._
- [x] T023 [P] Run the `quickstart.md` validation scenarios. _Scenarios 1–5 covered by green automated tests
      (shell + calculator e2e, backend pytest, pricing-core vitest); #6 public-URL render awaits T022._
- [x] T024 DoD/Constitution check: gate green (format/lint/depcruise/typecheck + 22 unit, 12 e2e, 5 backend);
      formula only in `pricing-core` (Principle V); server boundary enforced (Principle IV); this reconciliation
      keeps the spec current. _Only T014/T020 (visual MCP) + T022 (deploy) remain._

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
