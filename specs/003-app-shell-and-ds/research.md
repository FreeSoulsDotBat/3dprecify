# Phase 0 Research: App shell & design system

**Feature**: `003-app-shell-and-ds` · **Date**: 2026-07-02

No `[NEEDS CLARIFICATION]` markers survived the spec. Every protected (Principle VIII) choice already traces to
an approved decision; this file consolidates those decisions and the few convention-level calls, each with a
confidence level and the alternatives weighed. Sources: ADR-0001/0004/0007, the constitution, the three-round
`qa-produto` homologation, and the prior specialist-agent planning wave.

## Resolved decisions

### R1 — Design-system component strategy
- **Decision**: Option C (ADR-0007) — Radix **unstyled** primitives for non-trivial-a11y widgets
  (Dialog/Sheet, Select, Switch, Tabs/TabBar, Tooltip, Collapsible, Checkbox, Radio), reskinned with the
  homologated `tf-*` token CSS; **pure `tf-*` typed-TSX + CSS** for presentational primitives.
- **Rationale**: preserves the WCAG-measured brand skin while outsourcing focus-trap/keyboard/ARIA to Radix.
- **Alternatives**: A shadcn Tailwind-utility skin (discards measured DS, 45%); B fully bespoke `tf-*` (owns
  all a11y risk, 55%). Chose C (72%). See ADR-0007.
- **Confidence**: 100% (ratified by owner).

### R2 — FSD-Lite layer materialization + boundary gates
- **Decision**: add `pages/`, `widgets/`, `entities/` between the existing `app` and `features`/`shared`
  layers; enforce the canonical FSD import direction with `eslint-plugin-boundaries` (new element types) and a
  dependency-cruiser layer-direction rule. Allowed direction: `app → pages → widgets → features → entities →
  shared`; imports never go upward and never sideways between siblings of the same layer (except within one
  folder); the only barrel remains `shared/ui/index.ts`.
- **Rationale**: ADR-0004 ratified FSD-Lite; ADR-0007's follow-up explicitly carries this materialization "by
  the 003 spec". The direction is the standard FSD contract (materialization, not inference).
- **Alternatives**: keep only `app/features/shared` (insufficient home for route compositions + cross-feature
  widgets as epochs grow); a flat `components/` tree (loses boundary enforcement). Rejected.
- **Confidence**: 95%.

### R3 — Auth boundary relocation (the one behavioral change)
- **Decision**: `Calcular` (`/calcular`, and `/` → `/calcular`) is **public** — usable signed-out and offline;
  `Catálogo`/`Histórico`/`Conta` are auth-guarded via TanStack Router `beforeLoad` guards that redirect
  unauthenticated users to `/sign-in` and, after sign-in, return them to the originally requested route. The
  server remains the authorization boundary for any protected request.
- **Rationale**: the `001` router gates `/` behind auth (walking-skeleton simplification); the product model is
  "calcular é grátis; salvar é Premium". This slice aligns the boundary with the freemium principle. It is a
  spec'd refactor (US2), not drift.
- **Alternatives**: keep everything behind auth (contradicts freemium + offline-calc requirement); make all
  four tabs public (contradicts Principle IV / the paid-access foundation). Rejected.
- **Confidence**: 95%.

### R4 — Theme resolution without flash
- **Decision**: resolve theme in a tiny inline script in `index.html` **before first paint** with the chain
  **`localStorage` → OS `prefers-color-scheme` → dark default** (per decision **A34**, R2-G4 in
  `docs/decisions/audit-findings-r2.md`), setting the theme attribute on `<html>`; the existing `theme-store`
  (Zustand, with `persist`) owns runtime toggling and persistence. `prefers-reduced-motion` suppresses
  splash/shimmer.
- **Rationale**: eliminates flash-of-wrong-theme (FR-007) deterministically; honors the OS preference on
  first visit (light is first-class); reuses the existing store.
- **Alternatives**: resolve in React after mount (visible flash); skip `prefers-color-scheme` (contradicts
  captured decision A34 — was the prototype's unfixed item 7). Rejected.
- **Confidence**: 95% (A34 is a captured owner decision).

### R5 — System states (offline / 404 / generic error)
- **Decision**: offline banner is a `role="status"` `aria-live="polite"` region driven by
  `navigator.onLine` + `online`/`offline` events; 404 is a client route catch-all; the generic-error screen is
  a router error boundary showing a reload action and a discreet `Código de suporte: {correlationId}` line. The
  `correlationId` is read from the failed response's `X-Correlation-Id` header (already emitted by the backend
  `observability` layer) or a locally generated fallback id when none is present.
- **Rationale**: reuses existing correlation-id infrastructure; no backend change; honest, actionable copy.
- **Alternatives**: a generic "algo deu errado" with no support code (harder to support); a server-rendered
  error page (out of scope, this is a SPA/PWA). Rejected.
- **Confidence**: 90%.

### R6 — Server error-code → friendly pt-BR mapping
- **Decision**: map the backend `ErrorCode` union (already generated into `shared/api`) to pt-BR phrases in a
  single `shared/api` map consumed by the toaster/alerts; users never see raw codes (FR-017).
- **Rationale**: the `ErrorCode` enum → TS union contract already exists (ADR-0004); this only adds the copy
  layer. Keeps the wire contract authoritative.
- **Alternatives**: inline strings at each call site (drifts, duplicates). Rejected.
- **Confidence**: 90%.

### R7 — Conta plan indicator (no entitlement yet)
- **Decision**: Conta shows a static, honest `Gratuito` plan label — display-only, gating nothing — because no
  entitlement field exists on `/me` in this slice. Identity (name/email) comes from the server-confirmed
  session, never a hardcoded value.
- **Rationale**: satisfies FR-013's "plan indicator" honestly without inventing premium state or making the
  client an entitlement authority (Principle IV). E2 adds the real entitlement field + gating.
- **Alternatives**: omit the indicator (fails FR-013); show "Premium"/upsell (dishonest, out of scope, and a
  Principle IV risk). Rejected.
- **Confidence**: 90%.

### R8 — Token-parity guard
- **Decision**: add a Vitest snapshot test asserting the app's `styles/tokens/*.css` semantic token set matches
  the homologated DS token graph (including the new `--danger-text`/`--success-text`/`--info-text`), so DS↔app
  drift fails CI.
- **Rationale**: ADR-0007 follow-up; cheap insurance for the "single source of the skin" rule.
- **Alternatives**: manual review (drifts silently). Rejected.
- **Confidence**: 85%.

## Convention-level calls (Principle VIII permits — product/UX/content)

### R9 — Route paths
- **Decision**: pt-BR paths `/calcular`, `/catalogo`, `/historico`, `/conta`, plus `/sign-in`, a 404 catch-all,
  and the error boundary; `/` redirects to `/calcular`.
- **Confidence**: 85% (convention; owner may rename).

### R10 — Static asset placement (43 SVGs)
- **Decision**: the 43 homologated SVGs live under `apps/web/public/brand/{logo,grafismos,icons/lucide}/` and
  are referenced by `Logo`/`Grafismo`/`Icon` DS components; icons that need theming (`currentColor`) are
  inlined as typed React components, decorative grafismos are served static.
- **Confidence**: 80% (convention; a `shared/assets` import pipeline is the alternative if tree-shaking or
  theming needs push us there).

## Out-of-scope confirmations (not researched here — gated to later epochs)
- Full pricing model, catalog CRUD/save, entitlement enforcement, history, marketplace, payments, deploy.
- `pricing-core` version registry + rounding policy → **ADR-0008 (pending)**, blocks E1, not this slice.
- Server-authoritative entitlement → **entitlement ADR (pending)**, blocks E2, not this slice.
