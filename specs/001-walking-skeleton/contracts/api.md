# Contract — backend (FastAPI)

Minimal surface for the skeleton. Establishes the server-side auth boundary (FR-003, Principle IV).

## GET /health  (public)
- 200 → `{ "status": "ok" }`
- No auth.

## GET /api/v1/me  (protected)
Proves the server verifies the Firebase ID token; the client cannot grant itself access.
- **Request header**: `Authorization: Bearer <Firebase ID token>`
- **200** → `{ "uid": "<string>", "email": "<string|null>" }` when the token is valid.
- **401** → `{ "detail": "missing or invalid token" }` when the header is absent, malformed, expired, or fails
  signature/audience/issuer verification.

## Required test cases (pytest, written first, must fail before impl)
| Case | Expected |
|------|----------|
| No Authorization header | 401 |
| Malformed token | 401 |
| Expired/invalid-signature token | 401 |
| Valid token | 200 + uid (email may be null) |

> Note: token verification uses `firebase-admin`. Tests mock `verify_id_token` to avoid live network/credentials
> in CI; one optional integration check may run against the Firebase emulator.
