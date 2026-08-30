# Phase 1 Data Model: App shell & design system

**Feature**: `003-app-shell-and-ds` · **Date**: 2026-07-02

This slice introduces **no persisted data** and **no new server business logic**. The "entities" here are
client-side view-models and UI state only. Nothing below is written to a database; the pricing computation and
its numeric model remain in `packages/pricing-core` (calc-001, frozen) and are out of scope for changes.

## E1 — User identity view-model (read-only, server-confirmed)

Derived from the existing authenticated session / `/api/v1/me` response. Lives in `entities/user`. Consumed by
`top-bar` (account chrome) and the Conta page.

| Field         | Type              | Source                          | Notes                                              |
|---------------|-------------------|---------------------------------|----------------------------------------------------|
| `uid`         | string            | session / `/me`                 | Stable id; never displayed raw.                    |
| `displayName` | string \| null    | session / `/me`                 | Shown in Conta when present.                       |
| `email`       | string            | session / `/me`                 | Shown in account chrome + Conta; truncates safely. |
| `status`      | `SessionStatus`   | `shared/session/session-store`  | `loading` \| `authenticated` \| `anonymous` \| `not-configured`. |

- **Validation**: none new — the server is authoritative; the client only reads and formats. A `plan` value is
  **not** part of this model in this slice (no entitlement field yet); the Conta plan indicator renders a
  static `Gratuito` label independent of any server field (see research R7).
- **State transitions**: driven entirely by the existing session store (sign-in → `authenticated`; sign-out →
  `anonymous`; token expiry → `anonymous`). This slice adds no new transitions.

## E2 — Theme preference (client-only)

Owned by the existing `shared/ui/theme-store` (Zustand) + `localStorage`, resolved pre-paint (research R4).

| Field     | Type                | Persistence          | Notes                                         |
|-----------|---------------------|----------------------|-----------------------------------------------|
| `theme`   | `"dark" \| "light"` | `localStorage`       | Default `dark`; toggled in top-bar and Conta. |
| resolved  | applied to `<html>` | inline pre-paint JS  | Prevents flash-of-wrong-theme.                |

- **Not server data.** No cross-device sync in this slice.

## E3 — Navigation model (static UI config)

A static list backing the app-nav widget (TabBar/Sidebar). No persistence.

| Field       | Type      | Notes                                                            |
|-------------|-----------|-----------------------------------------------------------------|
| `id`        | string    | `calcular` \| `catalogo` \| `historico` \| `conta`.             |
| `path`      | string    | Route path (research R9).                                       |
| `labelKey`  | string    | i18n key (pt-BR copy contract).                                 |
| `icon`      | IconName  | DS `Icon` name (from the 43-SVG set).                           |
| `requiresAuth` | boolean | `false` for `calcular`; `true` for the other three.            |

- **Derived state**: the active item is derived from the current route; guarded items redirect to `/sign-in`
  when selected while unauthenticated (return-to-intent preserved).

## E4 — Transient UI state (not modeled as entities)

- **Online/offline** — read from `navigator.onLine` + events; surfaced by the offline-banner widget
  (`role="status"`). Not persisted.
- **Toasts** — ephemeral notification queue in the toaster provider; pt-BR copy mapped from `ErrorCode`
  (research R6). Not persisted.
- **Support code** — the `correlationId` shown on the generic-error screen; read from the failed response
  header or a local fallback (research R5). Not persisted.

## Contracts touched

- **No new API contract.** `/api/v1/me` is consumed unchanged; the `ErrorCode` union already generated into
  `shared/api` gains only a pt-BR copy map (not a wire change). UI contracts (components, routes, copy) are in
  `contracts/`.
