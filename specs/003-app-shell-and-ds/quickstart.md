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
