# ADR-0002: API contract, wire casing, error model & observability

- **Status**: Accepted
- **Date**: 2026-06-27
- **Deciders**: Jonatan (R3.1, R3.2) + lead session deciding R3.3/R3.4 under Jonatan's criterion "maximize
  context quality for an AI debugging an error" + his explicit request to add observability.

## Context
The wire casing already drifts (`costPerRoll` in the canonical TS `pricing-core` vs `cost_per_roll` in API
drafts). We need one contract source of truth, one wire convention, and one error model. Bias: `pricing-core`
is canonical in TS, camelCase, offline. Jonatan also flagged that, because he uses AI to generate code, error
context must be rich enough for an AI to debug from.

## Decision
1. **Contract source of truth (R3.1 = A)** — FastAPI Pydantic models → auto-generated **OpenAPI is THE
   contract**. The web generates a typed client from it; CI guards drift (regenerate + diff fails the build).
2. **Wire casing (R3.2 = B — REVISED 2026-06-28)** — JSON wire is **camelCase**, emitted by FastAPI via Pydantic
   `alias_generator=to_camel` + `populate_by_name=True` (`model_dump(by_alias=True)`). This needs **zero** runtime
   case-mapping and matches `pricing-core`/TS directly. *Revision rationale:* the codegen research (C1 round)
   showed no tool transforms case "for free" — the original R3.2=A (snake wire) would have required a runtime
   Orval transformer; B removes that layer entirely. Codegen tool = **Orval + TanStack Query v5** (C1.1), now
   without a snake→camel transformer; wrap its client to throw on 4xx/5xx.
3. **Error model (R3.3)** — chosen for max AI-debuggability. Single envelope, identical shape everywhere:
   ```json
   {
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Human-readable, pt-BR by default",
       "details": [ { "field": "grams", "constraint": "non_negative", "received": -1 } ],
       "correlation_id": "0f9c…uuid"
     }
   }
   ```
   - `code`: stable `SCREAMING_SNAKE`, machine-readable + i18n key (satisfies FR-011 friendly messages without
     hard-coding strings). Closed enum in a shared module; new codes via PR.
   - `details`: optional structured field-level context.
   - `correlation_id`: ties the error to the server log/trace (see §5).
   - HTTP status mirrors the category. Borrows RFC 9457's stable-type idea (the `code`) without its verbosity.
   - **Seed codes** (status): `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `TOKEN_EXPIRED` (401),
     `FORBIDDEN` (403), `ENTITLEMENT_REQUIRED` (403), `QUOTA_EXCEEDED` (403), `NOT_FOUND` (404),
     `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500).
4. **pricing-core error strategy (R3.4)** — keep **typed `throw`** (preserves the stack trace, the strongest
   AI-debug signal), but **enrich errors to the same shape** as the envelope: `ValidationError` carries `code`
   and structured `details`. The web **form boundary validates input with zod** (rich field-level issues for UX
   and debugging) before calling the lean offline core; **zod stays out of the core hot path**.
5. **Observability (added on Jonatan's request — critical for AI-as-codegen debugging)**
   - **Structured JSON logging** server-side: one event per request with `correlation_id`, method, path, status,
     duration_ms, user `uid` (no PII beyond uid); on error also `code` + stack.
   - **Correlation id**: generated per request (ASGI middleware), returned in the error envelope and in an
     `X-Correlation-Id` response header, and attached to every log line of that request. Paste the id → get the
     full structured story.
   - **Error tracking**: **Sentry** (free tier) on web + backend, `correlation_id` as a tag; web source maps
     uploaded in CI for readable stacks. PII scrubbed (no tokens, no sensitive raw inputs).
   - **Frontend**: global error boundary logs `code` + `correlation_id`; console stays clean on the happy path
     (enforced by the qa-produto visual gate).

## Options considered (confidence = "best choice" likelihood)
- R3.1: **A server-authoritative 75%** (chosen) · C TS-first 60% · B hand-written OpenAPI 55%.
- R3.2: A snake wire + transformer 55% · **B camelCase wire 75% (REVISED to B 2026-06-28** after codegen-cost
  research — no tool transforms case for free; B = zero mapping) · C snake everywhere 35%.
- R3.3: **A custom envelope + codes + correlation_id** (chosen) · B RFC 9457 (too verbose) · C `{detail}` (no
  stable code → fails FR-011/debuggability).
- R3.4: **A enriched typed throw + zod at the web edge** (chosen) · C throw+zod-in-core (weight in offline path)
  · B Result<T,E> (loses stack trace).

## Consequences
- Positive: uniform error shape across core + API; every failure carries a `correlation_id` → log/trace; AI/human
  debugging gets structured, linkable context; OpenAPI single source prevents contract drift.
- Trade-offs: camelCase wire (R3.2=B) means Pydantic models carry `alias_generator`/`populate_by_name` config
  (minor) but need NO runtime case-mapping; Sentry is a third-party dep (free tier, PII-scrubbed); observability
  lands early (small cost now, large debug payoff).
- Follow-ups: correlation-id middleware + structured logger when the backend lands; orval codegen + CI drift
  check when the web consumes the API; Sentry init + CI source-map upload (devops); shared **error-code enum
  module** (seed list above) consumed by both pricing-core and the API. Align `001` `contracts/api.md` response
  fields to **camelCase** (R3.2=B) at implementation.
