# ADR-0015: E3 BOM entitlement enforcement — server-informed feature guard over a client-side compute

- **Status**: Accepted
- **Date**: 2026-07-10
- **Deciders**: Jonatan (owner) + arquiteto + Claude
- **Extends**: ADR-0012 (entitlement flag mechanism)

## Context

E3 makes the **whole multi-piece BOM feature Premium** (spec 008 Q3 — the product's first paywalled
compute). But BOM pricing runs **client-side and offline** in `pricing-core` (`CLAUDE.md`: *"backend never
recomputes"*; ADR-0008). Constitution **Principle IV (NON-NEGOTIABLE)** requires premium access to be
*"validated server-side… on every protected **operation**"* and that *"the client is never trusted for
feature-gating decisions."*

The tension: a purely client-side computation has **no server operation to gate**. We must choose an honest
enforcement model that satisfies Principle IV where it actually applies (server effects) without pretending to
server-enforce an offline calculation, and without duplicating/forking the canonical pricing engine.

## Options considered (≥3, per Constitution)

### Option A — Server-informed client route-guard + server-authoritative persistence (CHOSEN)
Feature access (rendering the BOM composer) is gated in the client, but the guard's decision **derives from
the authoritative `GET /api/v1/entitlement`** (ADR-0012), never from a local flag. Every BOM **persistence**
operation passes the existing E2 seam (`require_entitlement` / `require_catalog_read`). The offline compute is
**not** hard-paywalled, and the design states this explicitly.
- Pros: satisfies the letter of Principle IV — every *protected operation* (all persistence) is server-gated;
  reuses 100% of the E2 entitlement seam with no new surface; keeps `pricing-core` canonical/offline (SC-402
  byte-identity intact, no fork); honest because the guard reads server truth, not a client flag.
- Cons: a determined user could invoke the offline engine directly (acknowledged in spec Edge Cases). The paid
  value is honestly save/manage/scale/catalog-reference, not the act of summing numbers.
- Scalability: excellent — same boundary as all of E2+, and it can adopt ADR-0012's future TTL-cached read
  without contract change.
- Confidence: 82%.

### Option B — Server-mediated BOM compute (backend endpoint checks entitlement, returns the result)
- Pros: makes compute a literal protected operation → unquestionable server gate.
- Cons: frontally violates *"backend never recomputes"* (ADR-0008); forces porting/forking the canonical TS
  formula into Python (direct risk to SC-402 byte-identity and FR-402 "engine composed, not forked"); breaks
  offline re-pricing (a premium user re-pricing a saved BOM from cache); adds per-keystroke latency. Rejected.
- Scalability: negative (two engines to keep in lockstep).
- Confidence: 15%.

### Option C — Hybrid: composer only mounts after a successful `active` `/entitlement` response
Same as A, but formalizes that the composer will not mount without a server `status = active`, and no composer
state derives from local flags.
- Pros: hardens the entry door; teaser derives from server truth.
- Cons: marginal gain over A (A already makes the guard server-informed); still cannot hard-paywall offline math.
- Confidence: 74%.

## Decision

**Option A, with C's hardening folded in**: the BOM feature route-guard is **server-informed** — it gates on
the authoritative `GET /api/v1/entitlement` response (`status = active`), never on a local/persisted premium
flag. All BOM persistence (create/list/read/update/delete) is authorized server-side through the existing E2
`require_entitlement` (writes) / `require_catalog_read` (active|lapsed reads) seam. The **explicit anti-pattern
banned** by this ADR: a feature guard driven by a client-held flag (that would violate *"client never trusted
for feature-gating"*).

**Honesty clause (required in the UI and docs):** the BOM compute is offline and **not** server-enforceable;
the real paywall is **persistence** (server-authoritative) plus **feature access** (server-informed
route-guard). Nothing may imply the account is hard-paywalled at the calculation itself. Free/lapsed/signed-out
users see the honest US5 teaser, never a fake or broken screen.

Jonatan approved Option A on 2026-07-10 (spec 008 plan phase).

## Consequences

- Positive: reuses the E2 gate verbatim (no new entitlement surface); pricing-core stays canonical/offline;
  SC-402 preserved; the free single-piece calculator is untouched (FR-411).
- Negative / accepted: the offline BOM math is not hard-paywalled — a soft boundary at the compute, a hard
  boundary at persistence. This is stated honestly rather than hidden.
- Follow-ups: the client route-guard implementation (a guarded route like E2's product routes) is a plan/tasks
  concern; `GET /api/v1/entitlement` already exists (E2 T014). Revisit if a future tier needs
  compute-level enforcement (would require moving compute server-side — reopen ADR-0008).
