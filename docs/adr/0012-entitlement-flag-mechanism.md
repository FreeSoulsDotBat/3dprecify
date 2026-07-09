# ADR-0012: Entitlement flag mechanism (server-authoritative premium state)

- **Status**: Accepted
- **Date**: 2026-07-09
- **Deciders**: Jonatan (owner) + arquiteto (seguranca review at implementation)

## Context

E2 turns on Constitution IV (server-side entitlements). Persistence is Premium (zero free quota, R3);
grants are out-of-band (beta/comp) until E6 delivers billing. The mechanism must: store grant metadata
(source, grantor, granted-at, optional expiry, revoked-at); be operator-only; propagate a grant/revoke
within ≤ 1 session/token refresh with honest UX; make the authorization check EVALUATE expiry and early
revocation at request time (the Q3 read-only-freeze depends on it — spec 007 Clarifications); be auditable;
and work identically under the Firebase emulator in dev/e2e. The E2 Postgres database exists regardless
(catalog data). Resolves TD-005 (recorded as blocking E2).

## Options considered (≥3, per Constitution)

### Option A — Firebase custom claim on the ID token
- Pros: zero DB read per request; rides the existing token-verify path; offline token carries it.
- Cons: the token is a ~1h snapshot — expiry/early-revoke do NOT take effect until refresh, which breaks the
  Q3 instant-freeze requirement; rich metadata (source/grantor/expiry) doesn't fit a claim, so a DB is needed
  for audit anyway; grant tooling goes through the Admin SDK.
- Scalability impact: best read path, but split-brain risk between claim and audit store.
- Confidence: ~60%.

### Option B — Authoritative Postgres entitlement row, evaluated per request ✅
- Pros: instant expiry/revoke (the check computes `active = granted ∧ ¬revoked ∧ (expiry null ∨ now<expiry)`
  live); native, append-only audit (source/grantor/expiry); single source of truth; identical under the
  emulator; textbook Principle IV.
- Cons: one indexed PK lookup per protected operation (acceptable at E2 scale; an in-process short-TTL cache
  is a documented FUTURE seam, not built now).
- Scalability impact: portable to Cloud SQL unchanged; evolves cleanly to Option C if read latency ever hurts.
- Confidence: ~90%.

### Option C — Hybrid (authoritative row + short-TTL read-through claim)
- Pros: claim-fast reads with DB truth.
- Cons: two coherent sources to maintain — unearned complexity at E2; the row alone already meets every fixed
  constraint.
- Scalability impact: the right future evolution of B, not the right start.
- Confidence: ~55% (now).

## Decision

**Option B — owner-approved 2026-07-09.** An authoritative entitlement ledger in Postgres
(`entitlement_grants`, append-only: uid, status, source beta|comp, grantor, granted_at, expires_at,
revoked_at — physical shape in `specs/007-e2-catalog-entitlement/data-model.md`). A FastAPI dependency
(`require_entitlement`) reads the verified uid's current state per request and denies with the honest wire
error `ENTITLEMENT_REQUIRED` (403) when not active; the read/pre-fill path follows the Q3 freeze (write-gate
binary; reads stay open on lapse). Sub-decisions, owner-aligned:
- **Grant path (owner-chosen)**: an operator **CLI script** in the backend (`uv run` entry point) writing the
  ledger directly — no admin HTTP route exists, so "operator-only" holds by absence of a path; a remote admin
  endpoint/console is deferred to E6.
- **Client plan surface (arquiteto recommendation, ratified)**: dedicated **`GET /api/v1/entitlement`** →
  `{status, source, expiresAt}` (grantor never leaked) so the Conta page is honest; the ≤1-refresh UX window
  applies to this fetch with a "recarregar/entre novamente" affordance, never a fake state.

## Consequences

- Positive: instant, auditable, single-source entitlement; Principle IV enforced at a single seam every
  persistence route must pass through; emulator-friendly; no client trust anywhere.
- Negative / trade-offs accepted: one DB lookup per protected op (cache seam documented, deferred); the DB
  must be reachable for premium surfaces (the catalog needs it anyway; the free calculator never touches it).
- Follow-ups: `ENTITLEMENT_REQUIRED` joins the `ErrorCode` enum → Orval union → pt-BR message; the entitlement
  schema lands via the ADR-0013 stack; seguranca signs off deny-by-default + per-account isolation tests;
  revisit toward Option C only with measured latency pain. Retires **TD-005**.
