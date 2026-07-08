# Contract — corrected published error surface (A21 / FR-210)

The single error schema is the existing camelCase **`ErrorEnvelope`** (`{ code: ErrorCode, message,
correlationId }`) — unchanged. What changes is **which statuses each operation publishes**: only reachable
ones, all reachable ones.

## Per-operation status map (target state)

| Operation | Publishes | Removed as phantom | Newly published (was undocumented) |
|---|---|---|---|
| `GET /api/v1/health` | `200` | — | — |
| `GET /api/v1/me` | `200`, **`401 ErrorEnvelope`** (`UNAUTHENTICATED` \| `TOKEN_EXPIRED`) | `422 HTTPValidationError` (its only param is an optional header — unreachable) · NO `403` added (no authz logic exists; publishing it would be a fresh phantom) | `401` |
| `GET /api/v1/fee-catalog` | `200`, `304` (ETag) | `422 HTTPValidationError` (same reason) | — |

Component schemas `HTTPValidationError` / `ValidationError` become unreferenced and MUST disappear from
`contracts/openapi.json` and from the regenerated Orval client (SC-205 "zero phantom validation schemas").

## Mechanism (research §4.1, Option C — ratified)

1. Shared constants in `backend/app/errors.py` (e.g. `AUTH_ERRORS = {401: {"model": ErrorEnvelope}}`),
   applied per-route via `responses=` — positive declarations live next to the code, type-checked.
2. Minimal `app.openapi()` post-step strips any auto-injected `422` whose `$ref` ends in
   `HTTPValidationError` (per-route `responses=` alone cannot remove FastAPI's default 422).

## Conformance obligation (FR-211)

`backend/tests/test_conformance.py` — Schemathesis v4 as pytest over ASGI, all operations:

- Fails on any **undocumented status** (MUST fail first against today's contract: `/me` returns 401 while the
  contract omits it — that failing run is the Constitution-III evidence) and on any **response-shape
  mismatch**.
- Deterministic: Hypothesis CI profile (`deadline=None`, fixed `max_examples`, `derandomize=True`) + the
  existing token-verify stub pattern so fuzzed `Authorization` headers yield a stable 401, never a live
  Firebase call.
- Runs inside `pytest` ⇒ inside `gate:be` ⇒ inside `gate:all` ⇒ pre-push AND CI (no local↔CI gap).

## Ripple (same drift-guard commit)

`contracts/openapi.json` regenerated → Orval client regenerated (`apps/web/src/shared/api/generated.ts`) →
`use-identity` migrates to the generated client (retires TD-019) → contract drift-guard stays green.
