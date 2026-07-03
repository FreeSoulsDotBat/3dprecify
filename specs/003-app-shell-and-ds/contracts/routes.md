# Contract: Routes, guards & navigation behavior

**Feature**: `003-app-shell-and-ds` · Router: TanStack Router (ADR-0004). Guards via `beforeLoad` + router
context fed from the session store (the existing `001` pattern, extended).

## Route table

| Path         | Section    | Auth        | Component (page)        | Behavior                                                             |
|--------------|------------|-------------|-------------------------|---------------------------------------------------------------------|
| `/`          | —          | public      | redirect                | Redirects to `/calcular`.                                            |
| `/calcular`  | Calcular   | **public**  | `pages/calcular`        | Usable signed-out **and offline**; reproduces `001` result.         |
| `/catalogo`  | Catálogo   | guarded     | `pages/catalogo`        | Placeholder shell; unauth → `/sign-in?redirect=/catalogo`.          |
| `/historico` | Histórico  | guarded     | `pages/historico`       | Placeholder shell; unauth → `/sign-in?redirect=/historico`.         |
| `/conta`     | Conta      | guarded     | `pages/conta`           | Server-confirmed identity + theme toggle + sign-out + `Gratuito`.   |
| `/sign-in`   | —          | public      | `pages/sign-in`         | Already-authenticated → redirect to `redirect` param or `/calcular`.|
| `*` (404)    | —          | public      | `pages/not-found`       | Branded "página não encontrada" + link back to `/calcular`.         |
| (error)      | —          | public      | `pages/error`           | Router error boundary; reload action + `Código de suporte: {id}`.   |

## Guard contract

- **GC-1 (public calc)**: `/calcular` has **no** `beforeLoad` auth check. It renders for `anonymous`,
  `not-configured`, and `authenticated`, online or offline.
- **GC-2 (guarded tabs)**: `/catalogo`, `/historico`, `/conta` `beforeLoad`: if `context.status !==
  "authenticated"`, `throw redirect({ to: "/sign-in", search: { redirect: <currentPath> } })`.
- **GC-3 (return-to-intent)**: `/sign-in` after successful auth navigates to `search.redirect` when present and
  same-origin/known, else `/calcular`.
- **GC-4 (already-authed)**: `/sign-in` `beforeLoad`: if authenticated, redirect to `search.redirect` or
  `/calcular`.
- **GC-5 (server is the boundary)**: client guards are UX only; a protected server request without valid auth
  is still rejected by the backend (Principle IV). This slice adds no new protected endpoint, so GC-5 is
  satisfied by the existing `/me` behavior.

## Navigation & focus contract

- **NAV-1**: the app-nav widget marks exactly one item active, derived from the current route.
- **NAV-2 (focus-to-title)**: on any section change, keyboard/AT focus moves to the destination page's title
  element (`page-header`), which is focusable (`tabindex="-1"`) and receives focus after navigation (FR-002,
  SC-006).
- **NAV-3**: guarded-tab selection while unauthenticated routes through `/sign-in` (GC-2) and lands on the
  intended section after auth (GC-3).
- **NAV-4**: no route renders a blank frame; unknown paths resolve to `/` → `/calcular` or the 404 as
  appropriate.

## System-state contract

- **SS-1 (offline)**: offline-banner (`role="status"`, `aria-live="polite"`) appears within 1s of losing
  connectivity; `/calcular` keeps computing (SC-007).
- **SS-2 (404)**: unknown route → branded not-found page with a way back.
- **SS-3 (error)**: unhandled error → error page with reload + `Código de suporte: {correlationId}` (from the
  failed response `X-Correlation-Id` or a local fallback).
- **SS-4 (copy)**: all state copy is pt-BR and contains no payment-provider name, no cancellation policy, no
  price (FR-014).
