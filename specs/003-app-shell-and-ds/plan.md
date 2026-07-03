# Implementation Plan: App shell & design system (4-tab product frame)

**Branch**: `feature/003-app-shell-and-ds` (active) | **Date**: 2026-07-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-app-shell-and-ds/spec.md`

## Summary

Refactor the `001` walking skeleton (Google sign-in + a single material+markup calculator) onto the
homologated product design system and the 4-tab app shell — **without expanding functional scope**. The slice
delivers: (1) the FSD-Lite `pages/` + `widgets/` + `entities/` layers and the boundary-gate extension that
every later epoch reuses; (2) the app shell (mobile TabBar / desktop sidebar, top bar, offline banner, splash,
toaster, focus-to-title on navigation); (3) the batch-1 design-system components per ADR-0007 (refactor the 5
existing `tf-*` primitives to typed contracts, add the ~13 the shell needs — Button, Icon, Logo, Grafismo,
Spinner, Badge, Alert, Toast, plus the Radix-skinned TabBar/Sidebar-nav, Switch, Dialog/Sheet); (4) tokens +
self-hosted fonts + the semantic `--danger/success/info-text` tokens + 43 brand SVGs; (5) the five pages
(re-skinned sign-in, moved calculator, real Conta, Catálogo/Histórico placeholders); (6) system states (offline
banner, 404, generic-error with `Código de suporte: {correlationId}`) with honest pt-BR copy.

Technical approach: purely a client refactor. **No backend change** — `/api/v1/me` keeps returning identity
only; no persistence; no entitlement. The one behavioral change is relocating the auth boundary so **Calcular
is public** (usable signed-out and offline, per the freemium model) while the three saving-oriented tabs are
auth-guarded via TanStack Router `beforeLoad` guards that redirect to `/sign-in` and return to intent. The
pricing engine (`packages/pricing-core`, calc-001 frozen) is untouched; existing numeric tests stay green.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on Node 24; React 19. Backend unchanged (Python 3.12, FastAPI) —
no server work in this slice.

**Primary Dependencies**: React 19 + Vite 8 (PWA) + Tailwind v4; TanStack Router + TanStack Query; Zustand;
React Hook Form + Zod; `@radix-ui/react-*` (behavior for Tabs/Dialog/Switch, skinned with `tf-*` CSS per
ADR-0007); `@3dprecify/pricing-core` (offline canonical engine). New runtime deps: the specific Radix
primitives for batch-1 widgets (scaffolded via shadcn CLI, then reskinned).

**Storage**: None new. Client-only theme preference persists in `localStorage` (existing `theme-store`). No
server-persisted data; `/me` returns identity only.

**Testing**: Vitest (unit/component + a new token-parity snapshot test) and Playwright (offline + auth-guard +
focus-to-title e2e), both already wired in `apps/web`; `qa-produto` visual homologation for SC-008. Pricing
numeric tests remain in `packages/pricing-core` (frozen).

**Target Platform**: Mobile-first responsive web + desktop web (PWA, offline-capable); Android via the same
shared client later. Themes: dark (default) + light, resolved before first paint.

**Project Type**: Web application (pnpm monorepo: `apps/web` frontend, `backend` FastAPI, `packages/*` shared
core). This slice touches `apps/web` + shared token/asset files + boundary configs only.

**Performance Goals**: No perceptible regression; offline calc result identical to `001`; offline banner within
1 s of connectivity loss (SC-007); no flash-of-wrong-theme on first paint.

**Constraints**: Offline-capable Calcular; no horizontal scroll at 390 px; status-text contrast ≥ 4.5:1 in both
themes; interactive targets ≥ 44×44 px; focus moves to section title on navigation; honest pt-BR copy (no
payment-provider name, no cancellation policy, no price). Server remains the authorization boundary.

**Scale/Scope**: 4 tabs + sign-in + 404 + generic-error = ~7 routed surfaces; ~18 batch-1 DS components (5
refactored + ~13 added); 1 boundary-gate extension; 43 brand SVGs. No new API endpoints.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design (see end of file). No violations →
Complexity Tracking is empty.*

- [x] **I. Scalability & Quality First** — the shell + DS + FSD-Lite layers are the reusable frame for web +
      Android + future i18n from one shared core; the `tf-*` token skin is WCAG-measured; no scalability
      traded for convenience. Traces to ADR-0001/0004/0007.
- [x] **II. Truth Over Approval** — open items carried with confidence, not hidden: **auth-boundary
      relocation** (Calcular becomes public — behavioral change vs `001`, called out explicitly, 95%);
      **brand `.woff2` fonts absent** → display-face fallback accepted by owner (100%); **Radix package set**
      finalized during implementation within ADR-0007 (90%). No fabricated APIs; all deps verified against the
      existing `apps/web` manifest.
- [x] **III. Test-First** — logical tests planned before code: router auth-guard redirects + return-to-intent,
      pre-paint theme resolution, error-code→pt-BR mapping, offline banner, focus-to-title, and a **token-parity
      snapshot test** (DS↔app drift, ADR-0007 follow-up). Visual: `qa-produto` homologation both themes at
      ≤414 px + desktop (SC-008). Pricing formula numeric cases stay frozen-green in `pricing-core`.
- [x] **IV. Server-Side Entitlements** — N/A and explicitly preserved: this slice adds **no** premium gating.
      Everyone is free; the Conta "plan indicator" is a static honest `Gratuito` label (display-only, gates
      nothing) — the client is never made an entitlement authority. `/me` carries no entitlement field yet
      (that is E2). The server stays the authorization boundary for the three guarded tabs.
- [x] **V. Clean Architecture Integrity** — reuses the 5 existing `tf-*` primitives (contract refactor, **no
      rewrite** per ADR-0007), the existing router/session/theme stores, and the existing boundary config
      (extended, not replaced). No duplication/dead code. The single behavioral change (auth boundary) is a
      spec'd refactor (US2), not drift.
- [x] **VI. Lean Living Documentation** — plan references ADR-0004/0007 rather than restating; spec stays
      outcome-oriented; no superseded rules introduced.
- [x] **VII. Spec-Driven Flow** — spec.md done; `checklists/requirements.md` passed on first iteration;
      `/speckit-clarify` not required (zero `[NEEDS CLARIFICATION]`); this file is the Constitution-Check gate;
      `/speckit-analyze` runs after `/speckit-tasks`.
- [x] **VIII. Architecture Decided Before Implementation (No Inference)** — every protected choice (structure,
      architecture, inter-app comms, coding standards) traces to an approved decision, **nothing inferred**:
      FSD-Lite + `pages/widgets/entities` materialization and boundary-gate extension → **ADR-0004 + ADR-0007
      follow-up** (explicitly "carried by the 003 spec"); UI system + design tokens + Radix-vs-`tf-*`
      convention → **ADR-0007**; state = Zustand, routing = TanStack, codegen = Orval, build/monorepo → **ADR-
      0004** (unchanged). Route paths, page copy, offline/404/500 UX, and static-asset placement are
      **product/UX/content conventions** (Principle VIII explicitly permits these). No unresolved protected
      item remains for 003; the pending ADR-0008 (pricing-core versioning) and entitlement ADR gate **E1/E2**,
      **not** this slice.

**Result: PASS** (0 violations). Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-app-shell-and-ds/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions consolidated from ADRs + prior specialist wave
├── data-model.md        # Phase 1 output — client-side entities (identity view-model, theme pref, nav model)
├── quickstart.md        # Phase 1 output — runnable validation guide (offline calc, auth guard, a11y, states)
├── contracts/
│   ├── ui-components.md  # Batch-1 DS component contracts (props/variants/a11y) + Radix-vs-tf-* mapping
│   ├── routes.md         # Route table, guards, redirect/return-to-intent, focus-to-title contract
│   └── copy.pt-br.md     # Honest pt-BR copy contract for shell + states (source for i18n keys)
├── checklists/
│   └── requirements.md   # Spec quality checklist (passed)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
apps/web/
├── public/
│   └── brand/                    # NEW: 43 homologated SVGs (logo/, grafismos/, icons/lucide/) served static
├── index.html                   # pre-paint theme-resolution inline script (no flash of wrong theme)
└── src/
    ├── main.tsx                 # RouterProvider + providers (unchanged wiring; new route tree)
    ├── app/
    │   ├── providers.tsx        # Query/theme/toaster providers (extend: Toaster mount)
    │   ├── router.tsx           # REWORKED: /calcular public; /catalogo /historico /conta guarded; /sign-in; 404; 500
    │   └── app-shell.tsx        # NEW (app layer): shell chrome that hosts pages via <Outlet/>
    ├── pages/                   # NEW FSD-Lite layer (route-level compositions; import widgets/features/entities/shared)
    │   ├── calcular/
    │   ├── catalogo/            # placeholder shell (no CRUD)
    │   ├── historico/           # placeholder shell (no list)
    │   ├── conta/               # real: server-confirmed identity + theme toggle + sign-out + static "Gratuito"
    │   ├── sign-in/             # re-skinned wrapper over features/auth
    │   ├── not-found/           # 404
    │   └── error/               # generic error + "Código de suporte: {correlationId}"
    ├── widgets/                 # NEW FSD-Lite layer (composite cross-feature UI; import features/entities/shared)
    │   ├── app-nav/             # TabBar (mobile) + Sidebar (desktop), active state, ≥44px targets
    │   ├── top-bar/             # brand logo + theme toggle + account chrome slot
    │   ├── offline-banner/      # role=status aria-live=polite; online/offline detection
    │   └── page-header/         # section title target for focus-to-title
    ├── features/                # EXISTING layer
    │   ├── auth/                # sign-in-screen (re-skinned with DS)
    │   └── calculator/          # calculator-screen + model (unchanged logic; DS re-skin)
    ├── entities/                # NEW FSD-Lite layer (domain view-models; import shared only)
    │   └── user/                # identity view-model derived from /me (read-only)
    └── shared/                  # EXISTING layer
        ├── ui/                  # DS batch-1: refactor 5 tf-* + add Button/Icon/Logo/Grafismo/Spinner/
        │                        #   Badge/Alert/Toast + Radix-skinned TabBar/Switch/Dialog|Sheet; barrel index.ts
        ├── api/                 # generated Orval client (unchanged) + error-code→pt-BR map
        ├── i18n/                # messages.pt-br.ts extended (nav/states/conta/errors)
        ├── session/             # session-store (unchanged)
        └── lib/                 # decimal-ptbr, env, firebase (unchanged)

apps/web/src/styles/tokens/*.css # add semantic --danger-text/--success-text/--info-text; token-parity source
eslint.config.mjs                # EXTEND boundaries: add pages/widgets/entities elements + FSD import rules
.dependency-cruiser.cjs          # EXTEND: keep no-circular + core direction; add layer-direction rule
```

**Structure Decision**: Web-application monorepo, extended in place. This slice **materializes the FSD-Lite
layer set** ratified in ADR-0004 and carried by the ADR-0007 follow-up: it adds `pages/`, `widgets/`, and
`entities/` between the existing `app` and `features`/`shared` layers, and extends `eslint-plugin-boundaries`
+ dependency-cruiser with the canonical FSD import direction (`app → pages → widgets → features → entities →
shared`; no upward or sideways-across-siblings imports; the only barrel is `shared/ui/index.ts`). Everything
else stays where `001`/`002` put it; the backend and `packages/*` are untouched.

## Complexity Tracking

> No Constitution violations — table intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |

## Post-Design Constitution Re-Check

Re-evaluated after Phase 0 (`research.md`) and Phase 1 (`data-model.md`, `contracts/*`, `quickstart.md`). The
design introduced **no new violations** and no new protected (Principle VIII) choice: every decision recorded
in `research.md` traces to ADR-0004/0007 or is a permitted product/UX/content convention (route paths, copy,
asset placement). No premium gating, no client entitlement authority, and no backend/business-logic change was
introduced (Principle IV preserved). **Result: PASS** — cleared for `/speckit-tasks`.
