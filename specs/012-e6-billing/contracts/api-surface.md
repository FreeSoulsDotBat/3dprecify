# E6 — API surface (contracts; camelCase wire per the house alias_generator)

> Authority: ADR-0023 + `data-model.md`. Reconciled BEFORE implementation (the E5 lesson: contracts join the
> consistency mesh). Errors use the house `ErrorCode` envelope; at most one new code (`BILLING_UNAVAILABLE`)
> and only if truly returnable.

## Authenticated routes (Firebase bearer via `current_claims`)

### `POST /api/v1/billing/checkout`
- **In**: `{ "period": "monthly" | "annual" }`
- **Out 200**: `{ "initPoint": "<MP hosted checkout URL>" }`
- Auth: signed-in required (FR-702). Free/lapsed/courtesy accounts all may subscribe (dual-grant rule).
- Effects: creates the pending `preapproval` (plan-linked) + the `pending` subscription row. No grant.
- 409 (`ErrorCode` mapped) when an active/grace/paused subscription already exists (SEC-604 guard).
- 503 `BILLING_UNAVAILABLE` when MP is unreachable (honest failure; no fake success).

### `GET /api/v1/billing/subscription`
- **Out 200**: `{ "plan": "monthly"|"annual", "status": "pending"|"authorized"|"grace"|"paused"|"cancelled",
  "currentPeriodEnd": iso8601|null, "cancelAtPeriodEnd": bool, "graceUntil": iso8601|null } | null`
- `null` when the account has no subscription (courtesy/free accounts) — Conta then falls back to the
  entitlement answer (2026-07-20 dual-grant display rule).
- `graceUntil` is **derived** server-side from the active grace grant's `expires_at` (data-model §4) —
  never a stored column.
- Display↔storage naming note (analyze T1): the spec's US6 display states "active/grace/pending/canceled/
  lapsed" map to `status` + entitlement as: active↔`authorized`, canceled↔`cancelled` (period running),
  lapsed↔(`paused`|`cancelled` past period with no valid grant). The FE maps; the wire uses the storage
  vocabulary above.
- Server + PSP truth only (SC-708); never a client-computed state.

### `POST /api/v1/billing/subscription/cancel`
- **Out 200**: the updated subscription object (above).
- Semantics: cancels the MP preapproval; premium persists to `currentPeriodEnd` (FR-707/Q10); the ledger is
  NOT written; the existing grant lapses naturally. Idempotent (cancelling a cancelled sub = no-op 200).

### `GET /api/v1/entitlement` — EXISTING, UNCHANGED
- The premium flip surface (SC-701). E6 adds no field; `source` may now read `"payment"`.

## Public route (signature-authenticated — the ADR-0023 explicit exception)

### `POST /api/v1/billing/webhook/mercadopago`
- **Auth**: MP `x-signature` HMAC (`ts`,`v1` over the `id;request-id;ts` manifest, per-env secret,
  constant-time compare, freshness window) — verified BEFORE any DB touch. No Firebase.
- **Behavior**: body is a TRIGGER only — the server looks the resource up against MP and acts on the
  authoritative state (verify-then-lookup, SEC-104). `live_mode` must match `app_env` (reject on mismatch).
- **Out**: `200` fast on accepted-or-duplicate (idempotent; MP retries non-2xx); `401` on failed
  verification; `422` on a verified-but-malformed notification.
- Grants: only via the shared `grant_writer` after lookup; exactly-once via `billing_events.event_key`.

## Flag-gated routes (OFF in E6 — server-side 404 when `P3D_PLAY_BILLING_ENABLED=false`)

- `POST /api/v1/billing/checkout/play` + `POST /api/v1/billing/webhook/play-rtdn` — implemented against Play
  internal testing, unreachable in every E6 environment (SC-711 asserts the 404s). Contract finalized in the
  Play ADR at E7.

## Wire invariants

- No money value crosses the wire from our backend except the two decided plan prices rendered by the FE
  from a product constant (the backend never computes/serves a price — prices live in MP plans + one FE
  constant; a mismatch is a release blocker checked in e2e).
- No card/PAN/CVV field exists in any request/response schema (VR-701 greps the generated client).
- Timestamps iso8601 UTC; ids are PSP references or uuid7 strings; decimal-money never appears (billing has
  no money column — the ONE domain rule that differs from E1–E5's decimal-string discipline, because the
  price is MP's record, not ours).
