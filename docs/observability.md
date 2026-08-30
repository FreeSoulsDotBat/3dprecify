# Observability — debug runbook (correlation-first, O1)

Goal: give a human or an AI agent **full context from a single `correlationId`**. Every request emits one
structured log line; the same id appears in the error envelope, the response header, and the Sentry event.

## The structured log schema (backend)
Emitted once per request by the lifecycle middleware (`backend/app/observability.py`), JSON via structlog:

```json
{ "ts": "...", "level": "info", "correlationId": "...", "service": "precifica3d-backend",
  "route": "GET /api/v1/...", "userUid": null, "status": 200, "latencyMs": 12.3,
  "errorCode": null, "releaseSha": "..." }
```

- `correlationId` — from `asgi-correlation-id`, header **`X-Correlation-Id`** (A9). Generated server-side if
  the client sent none; echoed back in the response header (CORS exposes it).
- `errorCode` — the wire `ErrorCode` when the request failed (mirrors the error envelope `code`).
- `releaseSha` — the deployed git SHA; also the Sentry release tag (A11).

## The error envelope (what the client/AI sees on failure)
```json
{ "error": { "code": "INTERNAL", "message": "...", "details": null, "correlationId": "..." } }
```
Same `correlationId` as the log line and the `X-Correlation-Id` header. camelCase (A9), never snake.

## Runbook: from a correlationId to root cause
1. Grab the `correlationId` from the failing response (body `error.correlationId` or `X-Correlation-Id` header),
   or from the user's report / Sentry issue.
2. **Cloud Logging** (Cloud Run, region southamerica-east1): filter
   `jsonPayload.correlationId="<id>"` → the request log line (route, status, latencyMs, errorCode, releaseSha).
3. **Sentry**: search the issue by `correlationId` tag (and `release:<sha>`) → stacktrace with source maps
   (readable, A11) + breadcrumbs.
4. Cross-check `releaseSha` to confirm which deploy produced the error.

## Frontend
- Sentry **breadcrumbs** (console / network / clicks) are enabled to reconstruct what the user did before the
  error. The Orval error wrapper attaches `correlationId` to the typed `ApiError` and tags Sentry (A9; wrapper
  lands with the first real endpoint).
- **Session Replay** is deferred (TD-013: LGPD + cost; likely premium-gated).

## Status in the foundation
The backend middleware + envelope + `X-Correlation-Id` are live and tested (SC-4). Cloud Logging/Sentry wiring
activates on deploy (Phase 8 / A11). FE breadcrumbs activate when `VITE_SENTRY_DSN` is set.
