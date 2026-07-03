---
description: "Task list for 003-app-shell-and-ds implementation"
---

# Tasks: App shell & design system (4-tab product frame)

**Input**: Design documents from `specs/003-app-shell-and-ds/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (all present)

**Tests**: MANDATORY per Constitution Principle III (Test-First). Every user story has logical tests
(integration/unit) AND a visual test homologated by `qa-produto`. Tests are written and observed FAILING
before implementation. The `001` regression suites (`calculator-model.test.ts`, `decimal-ptbr.test.ts`,
`packages/pricing-core`) MUST stay green throughout — this is a refactor, not a rewrite.

**Organization**: grouped by user story for independent implementation and testing. All paths are under
`apps/web/` unless noted (backend and `packages/*` are untouched by this slice).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no incomplete-task dependency)
- **[Story]**: US1..US5 (setup/foundational/polish have no story label)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: tokens, assets, fonts, deps, and copy the shell needs before any layer/component work.

- [ ] T001 Add batch-1 Radix runtime deps (`@radix-ui/react-tabs` → T028, `-dialog` → T073, `-switch` → T059) to `apps/web/package.json` and record the shadcn-CLI scaffold-then-reskin convention (ADR-0007) in a short comment; run `pnpm install`. *(All three deps are consumed — `-dialog` kept per decision C1 = build now.)*
- [ ] T002 [P] Copy the 43 homologated SVGs into `apps/web/public/brand/{logo,grafismos,icons/lucide}/` (static-serve placement per research R10).
- [ ] T003 [P] Self-host brand fonts under `apps/web/public/brand/fonts/` with `@font-face` in `apps/web/src/styles/base.css`; keep the display-face fallback for the absent `.woff2` (owner-accepted, do not block).
- [ ] T004 [P] Add semantic status-text tokens `--danger-text` / `--success-text` / `--info-text` for BOTH themes in `apps/web/src/styles/tokens/colors.css` (measured ≥4.5:1).
- [ ] T005 Add the pre-paint theme-resolution inline script (saved pref → OS `prefers-color-scheme` → dark, per decision **A34** / research R4 as corrected) to `apps/web/index.html` so first paint never flashes the wrong theme; add `persist` to `theme-store`.
- [ ] T006 [P] Extend `apps/web/src/shared/i18n/messages.pt-br.ts` with `nav.*`, `conta.*`, `catalogo.*`, `historico.*`, and `state/notFound/error/*` keys per `contracts/copy.pt-br.md` (honest copy: no provider, price, or cancellation).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the FSD-Lite layers, boundary gates, DS batch-1 primitives, shell scaffold, and route skeleton
that ALL user stories build on.

**⚠️ CRITICAL**: no user-story work begins until this phase is complete.

- [ ] T007 Create the FSD-Lite layer folders `apps/web/src/{pages,widgets,entities}/` with per-domain subfolders and minimal placeholder modules (materializes ADR-0004/0007 layers).
- [ ] T008 Extend `eslint.config.mjs` boundaries: add `pages`/`widgets`/`entities` element types and the canonical FSD import-direction rules (`app → pages → widgets → features → entities → shared`; no upward/sideways-sibling imports).
- [ ] T009 Extend `.dependency-cruiser.cjs`: add a forbidden layer-direction rule (upward imports) alongside the existing `no-circular` + `pricing-core-is-canonical` rules.
- [ ] T010 [P] Write the token-parity snapshot test in `apps/web` asserting the app token set (incl. the new status-text tokens) matches the homologated DS graph — **write FIRST, observe FAILING** (ADR-0007 follow-up).
- [ ] T011 Refactor the 5 existing `tf-*` primitives to typed prop contracts (no visual rewrite): `shared/ui/{card,field,number-field,price-hero,breakdown-row}.{tsx,css}` per `contracts/ui-components.md`.
- [ ] T012 [P] Build `Button` primitive (variants/size/loading, ≥44×44px) in `shared/ui/button.{tsx,css}`.
- [ ] T013 [P] Build `Icon` primitive (typed `name` from the 43-SVG set; `currentColor` inline) in `shared/ui/icon.{tsx,css}`.
- [ ] T014 [P] Build `Logo` primitive (full/mark, theme-aware) in `shared/ui/logo.{tsx,css}`.
- [ ] T015 [P] Build `Grafismo` primitive (decorative, reduced-motion safe) in `shared/ui/grafismo.{tsx,css}`.
- [ ] T016 [P] Build `Spinner` primitive (`role="status"` + SR label) in `shared/ui/spinner.{tsx,css}`.
- [ ] T017 [P] Build `Badge` primitive (tones via semantic tokens) in `shared/ui/badge.{tsx,css}`.
- [ ] T018 [P] Build `Alert` primitive (`role="alert"` for danger; semantic-token tones) in `shared/ui/alert.{tsx,css}`.
- [ ] T019 [P] Build `EmptyState` primitive (icon/title/body/action) in `shared/ui/empty-state.{tsx,css}`.
- [ ] T020 Build `Toast` primitive and mount the `Toaster` provider in `app/providers.tsx` (`shared/ui/toast.{tsx,css}`).
- [ ] T021 Update the single permitted barrel `shared/ui/index.ts` to export all batch-1 components (no internal barrels).
- [ ] T022 Create the `entities/user` identity view-model (read-only, fed by the **`/api/v1/me` response** — server-confirmed identity per decision **A23**, NOT the client session object; no `plan` field) in `apps/web/src/entities/user/`. Depends on T067.
- [ ] T023 Build the `app-shell` scaffold (hosts `<Outlet/>`; slots for app-nav, top-bar, offline-banner) in `apps/web/src/app/app-shell.tsx`, replacing the inline `RootLayout` chrome in `router.tsx`.
- [ ] T024 Rebuild the router route-tree skeleton in `apps/web/src/app/router.tsx`: wire all 7 surfaces (`/`→`/calcular`, `/calcular`, `/catalogo`, `/historico`, `/conta`, `/sign-in`, 404 catch-all, error boundary) to minimal page stubs — **no auth guards yet** (guards land in US2).
- [ ] T072 [P] Component test (write FIRST, observe FAILING) for the `Dialog`/`Sheet` primitive: focus is trapped while open, Escape closes, and focus returns to the opener (FR-016) — in `apps/web/src/shared/ui/dialog.test.tsx`. *(Decision C1 = build now — Jonatan 2026-07-02.)*
- [ ] T073 [P] Build the Radix-skinned `Dialog`/`Sheet` primitive (`@radix-ui/react-dialog`; focus-trap + Escape + focus-return; ≥44×44px close control; `tf-*` skin) in `apps/web/src/shared/ui/dialog.{tsx,css}` and export from the `shared/ui/index.ts` barrel (T021). Satisfies FR-016 as delivered DS batch-1 library surface; **no shell surface consumes it in 003** (first product consumer at E2 catálogo) — the T072 component test proves the a11y contract. *(Decision C1 = build now; ADR-0007 Radix-skinned.)*

**Checkpoint**: layers + gates + DS (incl. `Dialog`/`Sheet`) + shell + routes exist; `pnpm gate` passes with the extended boundaries; user stories can start.

---

## Phase 3: User Story 1 - 4-tab frame (Priority: P1) 🎯 MVP

**Goal**: the branded 4-tab shell (TabBar mobile / Sidebar desktop) with the calculator producing the canonical result.

**Independent Test**: on ≤414px and desktop the four sections are present, reachable, and one is active; `/calcular` shows material R$ 2,00 / preço R$ 3,00 for R$100·1kg·20g·50%.

### Tests for User Story 1 (write FIRST, observe FAILING) ⚠️

- [ ] T025 [P] [US1] Integration test: app-nav renders 4 tabs on mobile (bottom) and desktop (sidebar), exactly one active, switching updates it — in `apps/web/src/widgets/app-nav/app-nav.test.tsx`.
- [ ] T026 [P] [US1] Integration test: `/calcular` renders canonical R$ 2,00 / R$ 3,00 (guards the `001` calc through the refactor) — in `apps/web/src/pages/calcular/calcular.test.tsx`.
- [ ] T027 [US1] Visual test: `qa-produto` homologates the 4-tab shell at 390×844 + desktop, dark + light (renders real UI, screenshots, console/network).

### Implementation for User Story 1

- [ ] T028 [P] [US1] Build `widgets/app-nav` — Radix-skinned TabBar (mobile bottom) + Sidebar (desktop), active from current route, each item ≥44×44px, links to routes — in `apps/web/src/widgets/app-nav/`.
- [ ] T029 [P] [US1] Build `widgets/top-bar` — `Logo` + theme toggle + account-chrome slot — in `apps/web/src/widgets/top-bar/`.
- [ ] T030 [P] [US1] Build `widgets/page-header` — section title element, focusable (`tabindex="-1"`) — in `apps/web/src/widgets/page-header/`.
- [ ] T031 [US1] Build `pages/calcular` — move `features/calculator/calculator-screen` into the page, re-skin with DS primitives, keep model/logic unchanged — in `apps/web/src/pages/calcular/`.
- [ ] T032 [US1] Build `pages/catalogo` and `pages/historico` as on-brand `EmptyState` placeholders (no CRUD/list) — in `apps/web/src/pages/{catalogo,historico}/`.
- [ ] T033 [US1] Wire the responsive breakpoint in `app-shell` so app-nav renders TabBar ≤414px and Sidebar on desktop, hosting pages via `<Outlet/>`.

**Checkpoint**: the 4-tab shell is navigable on both viewports and the calculator matches `001`.

---

## Phase 4: User Story 2 - Auth boundary preserved (Priority: P1)

**Goal**: Calcular is public/offline; Catálogo/Histórico/Conta are auth-guarded with return-to-intent; the server stays the boundary.

**Independent Test**: signed out → Calcular works (online+offline); selecting a guarded tab → `/sign-in`; after sign-in → land on intended section; a protected server request without auth is rejected.

### Tests for User Story 2 (write FIRST, observe FAILING) ⚠️

- [ ] T034 [P] [US2] Integration test: guarded routes redirect unauthenticated users to `/sign-in?redirect=<path>`; `/calcular` renders without auth — in `apps/web/src/app/router.guards.test.tsx`.
- [ ] T035 [P] [US2] E2E test (Playwright): select a guarded tab signed-out → sign in via emulator → land on the originally requested section — in `apps/web/e2e/auth-boundary.spec.ts`.
- [ ] T036 [P] [US2] Integration test: a protected server request without valid auth is rejected (regression of existing `/me` 401 behavior) — in `apps/web/src/app/router.guards.test.tsx` or existing suite.
- [ ] T070 [US2] Visual test: `qa-produto` homologates the re-skinned `/sign-in` (DS primitives, offline sign-in message per A33 Phase 1), dark + light, ≤414px + desktop. *(Reconciliation addition — analyze G1; Constitution III per-story visual homologation.)*

### Implementation for User Story 2

- [ ] T037 [US2] Add `beforeLoad` auth guards to `/catalogo`, `/historico`, `/conta` (redirect to `/sign-in` with `search.redirect`) in `apps/web/src/app/router.tsx`.
- [ ] T038 [US2] Make `/calcular` public and `/`→`/calcular` (remove the `001` auth guard that gated `/`) in `apps/web/src/app/router.tsx`.
- [ ] T039 [US2] Implement `/sign-in` return-to-intent + already-authenticated redirect (honor `search.redirect`, else `/calcular`) in `apps/web/src/app/router.tsx`.
- [ ] T040 [US2] Build `pages/sign-in` re-skinned over `features/auth/sign-in-screen` (DS primitives) in `apps/web/src/pages/sign-in/`.

**Checkpoint**: freemium boundary holds; US1 still passes.

---

## Phase 5: User Story 3 - Accessible, on-brand, light+dark (Priority: P2)

**Goal**: harden the shell for a11y and theming — no 390px overflow, ≥4.5:1 status contrast both themes, ≥44px targets, focus-to-title, no theme flash, reduced-motion.

**Independent Test**: at 390px + desktop, both themes: no horizontal scroll; status text meets contrast; targets ≥44px; theme respected on first paint; switching section moves focus to the new title.

### Tests for User Story 3 (write FIRST, observe FAILING) ⚠️

- [ ] T041 [P] [US3] Automated a11y test: 0px horizontal overflow at 390px on all 7 surfaces, both themes — in `apps/web/e2e/a11y-overflow.spec.ts`.
- [ ] T042 [P] [US3] Test: interactive targets ≥44×44px and status-text contrast ≥4.5:1 both themes — in `apps/web/e2e/a11y-targets-contrast.spec.ts`.
- [ ] T043 [P] [US3] Keyboard test: section change moves focus to the destination `page-header` title — in `apps/web/e2e/focus-to-title.spec.ts`.
- [ ] T044 [US3] Visual test: `qa-produto` homologates a11y + brand fidelity across all surfaces, dark + light, ≤414px + desktop.

### Implementation for User Story 3

- [ ] T045 [US3] Implement focus-to-title on navigation (move focus to `page-header` after route change) in `app-shell`/router integration.
- [ ] T046 [P] [US3] Honor `prefers-reduced-motion` (suppress splash/shimmer/decorative motion) across `Grafismo`/splash/skeletons.
- [ ] T047 [P] [US3] Verify dark-default + no-flash first paint end-to-end (theme-store ↔ pre-paint script) and fix any mismatch.
- [ ] T048 [US3] Resolve any contrast/target/overflow defects surfaced by T041–T044 using semantic tokens (no raw hues; INV-1..5).

**Checkpoint**: shell meets SC-004/005/006 and FR-007 in both themes.

---

## Phase 6: User Story 4 - Graceful system states, honest copy (Priority: P2)

**Goal**: offline banner, branded 404, on-brand generic error with support code; all pt-BR and honest.

**Independent Test**: offline → banner within 1s + Calcular keeps working; unknown route → branded 404; generic error → on-brand screen with reload + "Código de suporte: <id>"; no undecided commercial copy.

### Tests for User Story 4 (write FIRST, observe FAILING) ⚠️

- [ ] T049 [P] [US4] E2E test: going offline shows the `role="status"` banner within 1s and Calcular still computes; also verify the PWA SPA fallback serves `/calcular` offline after the `/`→`/calcular` route move (analyze I1) — in `apps/web/e2e/offline-banner.spec.ts`.
- [ ] T050 [P] [US4] Test: unknown route renders the branded 404 with a way back; error boundary renders reload + `Código de suporte: <id>` — in `apps/web/src/pages/{not-found,error}/*.test.tsx`.
- [ ] T051 [P] [US4] Copy-honesty test: shell/state copy contains no payment-provider name, no cancellation policy, no price — in `apps/web/src/shared/i18n/copy-honesty.test.ts`.
- [ ] T071 [US4] Visual test: `qa-produto` homologates the offline banner, 404, and generic-error screen (support code visible), dark + light, ≤414px + desktop. *(Reconciliation addition — analyze G1; Constitution III per-story visual homologation.)*

### Implementation for User Story 4

- [ ] T052 [P] [US4] Build `widgets/offline-banner` (`role="status"` `aria-live="polite"`, `navigator.onLine` + online/offline events) in `apps/web/src/widgets/offline-banner/`.
- [ ] T053 [P] [US4] Build `pages/not-found` (branded 404 + "Voltar para Calcular") in `apps/web/src/pages/not-found/`.
- [ ] T054 [US4] Build `pages/error` (router error boundary; reload action; `Código de suporte: {correlationId}` read from the typed `ApiError` surfaced by the **T067** transport wrapper — `X-Correlation-Id` header/envelope per A20 — or a local fallback) in `apps/web/src/pages/error/`.
- [ ] T055 [US4] Add the `ErrorCode` → friendly pt-BR map (consumed by Toast/Alert from the T067 `ApiError.code`) in `apps/web/src/shared/api/` per `contracts/copy.pt-br.md`; include a unit assertion that **every** `ErrorCode` union member maps to a non-empty pt-BR phrase (closes analyze D1).

**Checkpoint**: SC-007 states demonstrable; copy honest (FR-014).

---

## Phase 7: User Story 5 - Conta reflects server-confirmed identity (Priority: P3)

**Goal**: a real Conta page — server-confirmed identity, static `Gratuito` plan indicator, theme Switch, sign-out; no upsell/billing.

**Independent Test**: signed in → Conta shows server identity (not hardcoded); toggle theme persists; sign-out returns to signed-out and re-guards the saving tabs.

### Tests for User Story 5 (write FIRST, observe FAILING) ⚠️

- [ ] T056 [P] [US5] Integration test: Conta renders identity from the **`/api/v1/me` response** (server-confirmed per A23 — not hardcoded, not the client session) and a static `Gratuito` label — in `apps/web/src/pages/conta/conta.test.tsx`.
- [ ] T057 [P] [US5] Test: theme Switch toggles + persists; sign-out returns to signed-out state and re-guards `/catalogo`/`/historico`/`/conta` — in `apps/web/src/pages/conta/conta.test.tsx`.
- [ ] T058 [US5] Visual test: `qa-produto` homologates Conta, dark + light, ≤414px + desktop.

### Implementation for User Story 5

- [ ] T059 [P] [US5] Build the Radix-skinned `Switch` primitive (labelled, ≥44px hit area) in `shared/ui/switch.{tsx,css}` and export from the barrel.
- [ ] T067 [US5] Build the HTTP transport wrapper per decision **A20** (R2-G2; closes D1): custom Orval fetch mutator in `apps/web/src/shared/api/` — `user.getIdToken()` per request, `baseURL` from `VITE_API_BASE_URL` (typed env), throw typed `ApiError` on 4xx/5xx reading `code` + `correlationId` from the error envelope / `X-Correlation-Id` header, Sentry-tag hook point. *(Reconciliation addition — prerequisite of T022/T060/T068.)*
- [ ] T068 [US5] Wire the post-login `/api/v1/me` call through the T067 wrapper; failures route through the T055 `ErrorCode`→pt-BR map (401 → re-login message). This satisfies **A23** (FR-003/SC-004 proven in the real app, not only pytest). *(Reconciliation addition.)*
- [ ] T060 [US5] Build `pages/conta` — `entities/user` identity, static `conta.planFree` indicator (display-only, gates nothing), theme `Switch`, sign-out — in `apps/web/src/pages/conta/`.

**Checkpoint**: all five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: validate the whole slice and remove refactor debt.

- [ ] T061 Run `quickstart.md` V1–V10 and record outcomes; fix any gaps.
- [ ] T062 Confirm the token-parity snapshot (T010) is green and reflects final tokens.
- [ ] T063 Remove dead code from the `001` shell (old inline `RootLayout`/`AccountChrome` now superseded by `app-shell`/`top-bar`); no orphan imports (Principle V).
- [ ] T064 Run `pnpm gate` (format/lint+boundaries/depcruise/typecheck/coverage) and the Playwright suite green; keep `001`/`pricing-core` tests green.
- [ ] T065 Final full `qa-produto` visual homologation of the shell (both themes, ≤414px + desktop) — zero high-severity defects (SC-008).
- [ ] T066 [P] Update `docs/adr/0007-design-system-layer.md` follow-up status (FSD-Lite layers + token-parity now materialized) and log any residual tech-debt.
- [ ] T069 [P] FE observability per decision **D2** (R2-G3): `@sentry/react` init with breadcrumbs (console/network/clicks), `VITE_SENTRY_DSN` in the typed env schema (optional in dev), and the `pages/error` boundary logging `code` + `correlationId` to Sentry — makes the 002 DoD claim true. *(Reconciliation addition.)*

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)**: no dependencies — start immediately (T002/T003/T004/T006 parallel).
- **Foundational (P2)**: depends on Setup — **BLOCKS all user stories**. Within it: T007→T008/T009 (folders before boundary rules); T011–T021 primitives can run parallel after T007; T023/T024 depend on the shell/DS existing.
- **User Stories (P3–P7)**: all depend on Foundational. US1 (MVP) first; US2–US5 can then proceed in parallel or priority order.
- **Polish (P8)**: after the desired stories are complete.

### User-story dependencies

- **US1 (P1)**: after Foundational. No dependency on other stories.
- **US2 (P1)**: after Foundational. Independently testable; reuses the route tree from T024.
- **US3 (P2)**: after Foundational; validates components from US1/foundational (page-header from T030). Independently testable.
- **US4 (P2)**: after Foundational. Independent (offline-banner/404/error).
- **US5 (P3)**: after Foundational. Independent (adds `Switch` + Conta).

### Within each story

- Tests written and FAILING before implementation (NON-NEGOTIABLE).
- Widgets/primitives before pages that compose them; core before integration.

---

## Parallel Opportunities

- Setup: T002, T003, T004, T006 in parallel.
- Foundational: after T007, the primitive tasks T012–T019 (plus T010 test) run in parallel (distinct files).
- Per story: the `[P]` test tasks run together; then the `[P]` widget/primitive tasks.
- Across stories: once Foundational is done, US2/US3/US4/US5 can be staffed in parallel with US1.

### Parallel example — Foundational primitives

```text
Task: T012 Button in shared/ui/button.{tsx,css}
Task: T013 Icon in shared/ui/icon.{tsx,css}
Task: T014 Logo in shared/ui/logo.{tsx,css}
Task: T016 Spinner in shared/ui/spinner.{tsx,css}
Task: T017 Badge in shared/ui/badge.{tsx,css}
Task: T018 Alert in shared/ui/alert.{tsx,css}
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → 4. **STOP & VALIDATE** the 4-tab
   shell + canonical calc on mobile+desktop → demo.

### Incremental delivery

Foundation → US1 (MVP: 4-tab shell + calc) → US2 (freemium boundary) → US3 (a11y/theming hardening) →
US4 (system states) → US5 (Conta). Each adds value without breaking the previous.

---

## Notes

- This is a **refactor**: reuse the 5 `tf-*` primitives (contract-only), the session/theme stores, and the
  route context pattern; do not rewrite the pricing engine or touch the backend.
- The one behavioral change (Calcular becomes public) is US2/T038 — spec'd (US2), not drift.
- Conta's plan indicator is a static honest `Gratuito` (no entitlement field yet; Principle IV preserved).
- **FR-016 / decision C1 = build now**: the `Dialog`/`Sheet` primitive (T072/T073) ships as tested DS batch-1
  library surface with no product consumer inside 003. This is intentional DS-library delivery, not dead code
  (it is exported and covered by the T072 a11y test); its first shell/product consumer arrives at E2. If a live
  consumer inside 003 is preferred, the natural minimal surface is a sign-out confirmation dialog on Conta (US5).
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
