# Quickstart / Validation Guide: App shell & design system

**Feature**: `003-app-shell-and-ds` · Run these to prove the slice end-to-end. This is a validation guide, not
implementation — details live in `contracts/` and `tasks.md`.

## Prerequisites

- Node 24 + pnpm; repo bootstrapped (`pnpm install`).
- Firebase Auth emulator for the auth-guard scenarios (the repo's `pnpm dev` wraps it).

## Setup / run

```bash
pnpm dev                 # web dev server behind the Firebase Auth emulator (from root)
# gates (must stay green):
pnpm gate                # format:check + lint (incl. extended FSD boundaries) + depcruise + typecheck + test:coverage
pnpm --filter @3dprecify/web test:e2e   # Playwright (offline + auth-guard + focus-to-title)
```

## Validation scenarios (map to Success Criteria)

### V1 — 4-tab shell renders on mobile and desktop (SC-001)
1. Open the app at 390×844 → bottom TabBar shows Calcular · Catálogo · Histórico · Conta, one active.
2. Resize to ~1280×800 → the same four appear as a sidebar, one active.
3. **Expect**: exactly one active item per view; switching updates it immediately.

### V2 — Calcular is free, offline, and matches `001` (SC-002)
1. Signed out, open `/calcular`. Enter cost/roll `100`, roll weight `1`, grams `20`, markup `50`.
2. **Expect**: Material `R$ 2,00`, Preço sugerido `R$ 3,00`.
3. In DevTools set network Offline, repeat → same result; offline banner (`role=status`) is announced.

### V3 — Auth boundary preserved (SC-003)
1. Signed out, select Catálogo (or Histórico/Conta) → redirected to `/sign-in?redirect=/catalogo`.
2. Sign in with the emulator → land on the originally intended section.
3. Confirm a protected server request without valid auth is rejected (existing `/me` 401 behavior).

### V4 — No 390px overflow, both themes (SC-004)
1. At 390px width, visit all four tabs + sign-in + 404 in dark and light.
2. **Expect**: `document.scrollingElement.scrollWidth === clientWidth` (0px horizontal overflow) on each.

### V5 — Contrast + target size (SC-005)
1. Trigger an error toast/alert and a success state in both themes.
2. **Expect**: status text contrast ≥ 4.5:1 (semantic tokens); every tab item/button/switch measures ≥ 44×44px.

### V6 — Focus-to-title (SC-006)
1. Using the keyboard only, activate a nav item.
2. **Expect**: focus lands on the destination page's title (`page-header`, `tabindex=-1`).

### V7 — System states + honest copy (SC-007, FR-014)
1. Go offline → banner within 1s; Calcular still computes.
2. Visit an unknown route → branded 404 with "Voltar para Calcular".
3. Force a generic error → error screen with "Recarregar" and "Código de suporte: <id>".
4. Review all shell copy → no payment-provider name, no cancellation policy, no price.

### V8 — Theme resolves without flash (FR-007)
1. Set light, reload → first paint is light (no dark flash), and vice-versa.

### V9 — Token parity (ADR-0007 follow-up)
1. `pnpm --filter @3dprecify/web test` → the token-parity snapshot passes (app tokens match DS graph, incl.
   `--danger/success/info-text`).

### V10 — Visual homologation (SC-008)
- `qa-produto` renders the shell in a real browser (both themes, ≤414px + desktop) and finds zero
  high-severity design-fidelity or a11y defects.

## Done signals
- `pnpm gate` green (including the extended boundary rules) · Playwright green · token-parity green ·
  `qa-produto` visual sign-off · `001` pricing tests still green (frozen).

## Execution record 2026-07-03 (T061)

Ran under the Phase-8 polish. Gate + suites executed from a clean tree; ports 5173/9099/8000 free.
Automatable scenarios are proven by the committed unit/e2e suites; the eyeball-only steps are marked
"covered by homologation T0xx VALIDATED" (per-story `qa-produto` owner sign-offs already recorded in
`tasks.md`). Numbers this run: web unit **68/68** (13 files), pricing-core **7/7**, Playwright **54/54**
(chromium + mobile), token-parity **4/4**, `pnpm lint` / `depcruise` / `typecheck` clean.

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| V1 | 4-tab shell on mobile + desktop, exactly one active | PASS (auto) | `widgets/app-nav/app-nav.test.tsx`; `tests/e2e/shell.spec.ts`; homologation **T027 VALIDATED** |
| V2 | Calcular free + offline, R$ 2,00 / R$ 3,00 | PASS (auto) | `pages/calcular/calcular.test.tsx`; `tests/e2e/calculator.spec.ts` (R$ 2,00 / R$ 3,00 + offline compute); `tests/e2e/offline-banner.spec.ts` |
| V3 | Auth boundary + return-to-intent; server rejects unauth | PASS (auto) | `app/router.guards.test.tsx`; `tests/e2e/auth-boundary.spec.ts`; 401→ApiError guard test |
| V4 | 0px horizontal overflow at 390px, both themes | PASS (auto) | `tests/e2e/a11y-overflow.spec.ts` (public + guarded, dark + light) |
| V5 | Status-text contrast ≥4.5:1 + targets ≥44×44px, both themes | PASS (auto) | `tests/e2e/a11y-targets-contrast.spec.ts` (incl. real calculator validation error uses `--danger-text`) |
| V6 | Focus-to-title on nav | PASS (auto) | `tests/e2e/focus-to-title.spec.ts` (first load does NOT move focus; tab switch does) |
| V7 | System states + honest copy | PASS (auto) | `tests/e2e/offline-banner.spec.ts`; `pages/not-found/not-found.test.tsx`; `pages/error/error.test.tsx` (support code); `shared/i18n/copy-honesty.test.ts` |
| V8 | Theme resolves without flash | PASS (auto toggle + homolog) | `tests/e2e/shell.spec.ts` flips `data-theme`; pre-paint no-flash first paint covered by homologation **T044 VALIDATED** (light first-class + persistence) |
| V9 | Token parity (incl. `--danger/success/info-text`) | PASS (auto) | `styles/token-parity.test.ts` 4/4 |
| V10 | Full-shell visual homologation, both themes, ≤414px + desktop | Per-story VALIDATED; final **T065** pending owner | T027/T044/T058/T070/T071 all **VALIDATED** in `tasks.md`; T065 is the owner's final full-shell pass (out of this polish) |

No gaps surfaced — every automatable scenario passed on first run; no fixes required. The one behavioural
note carried forward (top-bar shows the client-session e-mail, not the server-confirmed `/me` identity which
lives only on Conta) is logged as tech-debt, not a V-scenario failure (see `docs/tech-debt.md` TD-018).
