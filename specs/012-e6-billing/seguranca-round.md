# E6 — Security round: requirements + threat model (billing / Mercado Pago)

**Feature**: 012-e6-billing · **Author**: seguranca · **Date**: 2026-07-20 · **Status**: input to plan + ADR-0023
**Audience**: arquiteto (drafting `docs/adr/0023-*` in parallel) + the plan round + every PR carrying checkout/webhook.
**Working language**: English (technical source of truth, Constitution front-matter); seller-facing copy stays pt-BR.

> **Scope of this document.** This is the set of **testable security invariants** the payments ADR (0023) and the
> plan MUST satisfy, plus the threat model behind them. It states *what must be true and provable*, not *how to
> build it*. Mechanism choices (transport, table shape, scheduler runtime, idempotency store, flag plumbing) are
> the arquiteto's call (Principle VIII) — where such a choice is a **precondition** for a security invariant to be
> testable, it is tagged **[ARCH-OWED]** and listed in §10, not resolved here. This document does not decide
> architecture; §10 lists conflicts/decisions I surfaced for the arquiteto/owner to resolve.
>
> **Verification labels** (Constitution II): each MP-mechanism claim is tagged **[knowledge]** (verified against
> MP's official docs, sources §11) or **[inference]** with a confidence %. Every invariant is written so it can be
> asserted in **pytest** (unit/integration) or **e2e** (Playwright), matching the house test-first style (III).

---

## 0. Threat model — what E6 changes about the attack surface

Every E1–E5 write sits behind ONE seam: `current_claims` (a verified Firebase ID token) → `require_entitlement`
(a live ledger read). The client is never trusted for entitlement (ADR-0012, Principle IV). **E6 punches the first
holes in that uniform seam**, and each hole is a new class of risk the codebase has never carried:

| # | New surface E6 introduces | Why it is new/dangerous | Guarded by |
|---|---------------------------|--------------------------|------------|
| T1 | **An unauthenticated public write-adjacent endpoint** (the MP webhook). No Firebase token — MP cannot hold one. | Every prior route authenticated via `current_claims`. The webhook's ONLY authenticity proof is MP's signature. A forged POST here mints premium for free. | §1 |
| T2 | **A machine event that writes the entitlement ledger** (`source=payment`). The first non-operator writer. | A replayed/duplicated/stale event could extend entitlement without payment. | §2 |
| T3 | **A cross-party identity join** (MP subscription id ↔ our account_uid). | An event for subscription X must never grant account Y. Confused-deputy / IDOR. | §2, §3 |
| T4 | **A client-initiated money action** (checkout start). | Client could try to self-grant, or start checkout for another account. | §3 |
| T5 | **A new secret class** (MP access token + webhook secret, sandbox AND prod). | A leaked/misused secret, or a sandbox event writing a prod grant. | §4 |
| T6 | **A new personal/financial data touchpoint** (payer identity, PSP refs). | Over-collection, card-data leakage, LGPD exposure. | §5 |
| T7 | **A second, flagged-OFF PSP path** (Play Billing). | A flag that hides UI but leaves the server path reachable. | §7 |
| T8 | **A dev tunnel exposing localhost to the public internet.** | The tunnel could expose more than the webhook (emulator, DB, admin). | §4 |

The invariants below close each. **Deny-by-default is the spine**: on any doubt (bad signature, unknown
subscription, unverifiable lookup, flag off, missing secret) the outcome is **grant nothing / reject**, never
"grant tentatively".

---

## 1. Webhook authenticity — verify, THEN look up (never trust the body)

**House rule (normative).** The raw webhook body is an **untrusted trigger, not evidence**. The pipeline is:
**(a) verify the signature → (b) look the resource up against MP as source of truth → (c) only then act.** The
grant's facts (status, period end, payer, account binding) come from step (b) — the MP API response — **never**
from the POST body's fields. A valid signature over a body proves *MP sent this notification*, not *the body's
numbers are the truth*; the authoritative numbers are fetched server-side by `data.id`.

**MP's actual mechanism** [knowledge, ~90%, sources §11]:
- Signature arrives in the `x-signature` header as `ts=<unix-ts>,v1=<hmac-sha256-hex>`; the `x-request-id` header
  carries the request id.
- The signed **manifest template** is `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` — HMAC-SHA256 over that
  string, keyed by the **application webhook secret**, compared to `v1`.
- **`data.id` must be lowercased** in the manifest when alphanumeric — a known MP quirk that silently breaks
  validation if missed [knowledge, ~85%]. **[ARCH-OWED]** the exact canonicalization is arquiteto's to pin and unit-test.
- After a 200/201 ack, the server fetches the resource (`/v1/payments/{id}` or the preapproval endpoint) to read
  authoritative state.

### Invariants
- **SEC-101 (bad signature rejected)** — *protects FR-704, SC-702.* A webhook whose `v1` does not equal the
  server-computed HMAC over the exact manifest is rejected (HTTP 4xx, no lookup, no ledger write). *pytest*: POST a
  well-formed body with a wrong `v1` → response is a rejection code, `entitlement_grants` row count unchanged, no
  outbound MP lookup issued (mock asserts zero calls).
- **SEC-102 (absent signature rejected)** — *FR-704, SC-702.* A webhook with no `x-signature` (or no
  `x-request-id`) is rejected before any lookup. *pytest*: omit the header → rejected, zero grants.
- **SEC-103 (verify-before-lookup ordering)** — *FR-704.* No outbound call to MP and no DB write occurs for a
  request that fails signature verification. *pytest*: signature-fail path asserts the MP client mock and the
  ledger writer were never invoked (ordering, not just outcome).
- **SEC-104 (grant facts come from the MP lookup, not the body)** — *FR-704, SC-702.* Given a **validly signed**
  body whose JSON claims `status:"authorized"` but whose server-side lookup returns `status:"cancelled"`, **no
  grant is written**. *pytest*: sign a body honestly, stub the MP lookup to disagree → the lookup wins, zero grant.
  This is the single most important test in the epic: it proves the body is a trigger, not evidence.
- **SEC-105 (unknown subscription rejected)** — *FR-704, SC-702, US3.4.* A signed event whose `data.id` resolves
  to no subscription **we created** (no local subscription↔account mapping) grants nothing. *pytest*: signed event
  for a random id with no local row → rejected/ignored, zero grants. **[ARCH-OWED]** requires the local
  subscription registry (§2/§10-D2).
- **SEC-106 (stale-timestamp / replay window)** — *FR-704, FR-705, SC-703.* A signed event whose `ts` is older
  than a bounded freshness window (e.g. ±N minutes — **[ARCH-OWED]**, value is arquiteto's, MP docs give no
  default so we set one) is rejected as stale, defending signature-capture replay independently of idempotency
  (§2). *pytest*: valid signature but `ts` far in the past → rejected. NOTE: freshness is defence-in-depth **on
  top of** idempotency (§2), not a substitute — a captured-and-instantly-replayed event is caught by SEC-201.
- **SEC-107 (constant-time compare)** — *FR-704.* The signature comparison uses a constant-time equality
  (`hmac.compare_digest`), not `==`, to deny a timing oracle. *pytest*: assert the code path uses the
  constant-time primitive (inspection-level test acceptable; the value is that it is reviewed).

---

## 2. Idempotency & replay — same event N times = one state change

**Precedent.** ADR-0018 established exactly-once *effect* (not delivery) via a durable idempotency key + a DB
`UNIQUE` constraint, the client treating 200-conflict and 201-created identically. **E6 inverts the key's
origin**: there the client minted it; here **MP mints the event identity** and the server owns the dedup store (a
server-side *inbox*, not the client outbox). **[ARCH-OWED]** whether E6 reuses/extends the outbox machinery or
adds a processed-events table is the arquiteto's call (§10-D3); the invariant below binds whatever is chosen.

### Invariants
- **SEC-201 (idempotent processing)** — *protects FR-705, SC-703, US3.3.* The same MP event delivered N times
  produces **exactly one** grant/state change. *pytest*: deliver an identical signed event 5× → exactly one
  `source=payment` row; entitlement state identical after 1 and after 5. **[ARCH-OWED]** the idempotency key is
  the MP **event identity** (event id and/or `(resource_id, status, period)`), enforced by a DB `UNIQUE`
  constraint — correctness lives in the constraint, not in application cleverness (the ADR-0018 lesson).
- **SEC-202 (webhook↔reconciliation converge to one)** — *FR-706, SC-703, US3.5, Edge "webhook never arrives".*
  A grant healed by the reconciliation poll and the same grant delivered by a (late) webhook resolve to **one**
  grant, never two. *pytest*: run the poll to create the grant, then deliver the webhook for the same period →
  still one row. The reconciliation path shares the same idempotency key as the webhook path.
- **SEC-203 (old-event replay does not extend entitlement)** — *FR-705, SC-703.* Re-delivering an OLD valid
  event (e.g. January's `payment.created`, replayed in March) MUST NOT extend `expires_at` or re-activate a
  lapsed account. *pytest*: process January's event (expiry = Feb), advance clock to March (account lapsed),
  replay the exact January event → account stays lapsed, `expires_at` unchanged, no new active grant. This is
  distinct from SEC-201: it is replay of a *genuine past* event, and the period boundary — not just the event id
  — must gate the effect. **[ARCH-OWED]** the grant's `expires_at` derives from the **MP-reported period end of
  that specific charge**, so an old charge's period end is already in the past and cannot extend anything.
- **SEC-204 (cross-account event isolation)** — *FR-704, SC-702, T3, Edge "sandbox↔prod".* An event for
  subscription X MUST only ever touch account X's owner. The account is resolved **only** by the server-side
  subscription↔account mapping created at checkout (§3), **never** by any account/uid field in the webhook body.
  *pytest*: craft a signed event whose body carries `account_uid = Y` but whose subscription id maps locally to X
  → the grant lands on X, never Y (or, if MP does not echo a uid, assert the resolver ignores body-supplied
  identity entirely). *e2e*: two sandbox accounts, pay on one, assert the other's entitlement is unchanged.

---

## 3. Client-trust boundary — no client state writes a grant

Principle IV at its sharpest: the client may **start** checkout and **display** server truth; it may never
**assert** entitlement or **read across** accounts.

### Invariants
- **SEC-301 (no client-write path to a grant)** — *protects FR-704, SC-702, US2.3.* There exists **no** HTTP
  route by which an authenticated client can cause a `source=payment` grant to be written from client-supplied
  data. The only writers are (a) the signature-verified webhook handler and (b) the server-initiated
  reconciliation poll — both driven by MP-side truth. *pytest*: contract/route audit — enumerate routes; assert no
  route body/param feeds the grant writer except the webhook (which takes no auth-bearing client). *e2e*: a
  manipulated client POSTing a "paid" claim to every plausible endpoint grants nothing.
- **SEC-302 (checkout-initiation is authenticated + self-only)** — *FR-702, US1.2, US2.1.* The checkout-start
  endpoint requires `current_claims` (401 if unauthenticated) and binds the created MP subscription to the
  **caller's own uid** taken from the verified token — it MUST NOT accept a target account/uid from the request
  body. *pytest*: unauthenticated → 401; authenticated request that tries to pass another uid → the binding uses
  the token's uid, the body field is ignored. The subscription↔account mapping (MP `external_reference` =
  our uid, plus a persisted local row) is written here. **[ARCH-OWED]** the mapping's shape (§10-D2).
- **SEC-303 (no enumeration / IDOR on subscription references)** — *FR-709, SC-708, T4.* No endpoint returns
  another account's billing state, and no endpoint accepts a client-supplied subscription/preapproval id to look
  up state — the billing-state read (Conta) is scoped to the token uid only, exactly like `GET
  /api/v1/entitlement` today. *pytest*: account A cannot read account B's plan/subscription by any id in path,
  query, or body → 401/403/404 with no cross-account leak. PSP references (preapproval id) are never returned to a
  client that is not their owner, and are never guessable-into another account's data.
- **SEC-304 (entitlement refresh path unchanged)** — *FR-714, SC-709, SC-708.* `GET /api/v1/entitlement`,
  `require_entitlement`, `require_catalog_read`, and the lapse read-only freeze behave **identically** to E2–E5;
  E6 adds a writer, not a new evaluation rule. The grantor/`granted_by` is still never leaked (ADR-0012;
  `EntitlementView` excludes it). *pytest*: the existing entitlement/gate suites pass unchanged; a
  `source=payment` grant flows through the SAME evaluation (`active = ¬revoked ∧ (expiry null ∨ now<expiry)`) and
  the SAME propagation window; the entitlement view for a payment grant exposes `source`/`expiresAt` but never
  `granted_by`.
- **SEC-305 (abandoned checkout leaves no state)** — *US2.2.* A started-but-abandoned checkout writes no grant
  and no "pending premium" that the entitlement evaluation could read as active. *pytest/e2e*: start checkout,
  never complete → `read_entitlement_state` returns the pre-checkout status; an abandoned checkout is
  indistinguishable from never having started (a local subscription row in a non-active PSP status is acceptable,
  but it MUST NOT satisfy the entitlement check).

---

## 4. Secrets & environment separation

**House pattern.** `pydantic-settings`, `env_prefix="P3D_"`, secrets typed `SecretStr`, never hard-coded, never
logged (`app/settings.py`). E6 adds MP secrets to that same pattern — **no new secret mechanism**.

### Invariants
- **SEC-401 (secrets typed + never logged)** — *protects SC-706, general.* The MP access token and webhook
  signing secret are `SecretStr` under the `P3D_` prefix; they never appear in the structlog line, in an error
  body, in Sentry, or in the OpenAPI contract. *pytest*: assert the settings fields are `SecretStr`; assert the
  correlation log schema (`app/observability.py`) carries no secret/token/payer field; a handler exception does
  not serialize the secret. **[ARCH-OWED]** the exact field names/settings shape is arquiteto's.
- **SEC-402 (sandbox event can NEVER write a production grant)** — *protects Edge "sandbox↔prod credential
  separation", T5.* The webhook verification uses the secret bound to the **running `app_env`** (`dev`/`uat` →
  sandbox secret; `prod` → prod secret). A sandbox-signed event presented to a prod-configured server FAILS
  signature verification (different secret) → grants nothing. *pytest*: sign with the sandbox secret, verify under
  a prod-configured settings object → rejected. This is the load-bearing environment-isolation test; it must be
  explicit, not implied.
- **SEC-403 (fail-closed on missing secret)** — *FR-704, SC-702.* If the webhook secret is unset, the webhook
  endpoint rejects ALL events (never "skip verification because no secret") — mirroring auth.py's *fail closed
  when unconfigured* precedent (verification fails if the SDK is uninitialised). *pytest*: unset secret → every
  webhook rejected; assert there is no code branch that treats "no secret" as "accept".
- **SEC-404 (dev tunnel exposes ONLY the webhook path)** — *protects T8, FR-706, owner Q3.* The dev tunnel used
  for sandbox webhooks (owner Q3: sandbox + dev tunnel) MUST expose **only** the single webhook route — never the
  Auth emulator (`:9099`), Postgres (`:5433`), the app's authenticated API surface for lateral reach, or any
  admin/CLI. **[ARCH-OWED + devops]** this is a runbook + tunnel-config requirement, not app code; the review gate
  (§8) checks the tunnel config binds one path. Document it in the E6 runbook. The tunnel carries the **sandbox**
  secret only; no prod secret ever transits a dev tunnel.
- **SEC-405 (live webhook validated at deploy, reconciliation covers the gap)** — *FR-706.* Until the v1 deploy
  (the 2026-07-09 deferral stands, owner Q3), the LIVE prod webhook is unproven; the reconciliation poll is the
  resilience layer so no paid seller is stranded meanwhile. Security note: the reconciliation poll is a
  **server→MP** authenticated pull (MP access token), carrying no inbound-trust risk — it is the *safer* of the
  two paths and must share the idempotency store (SEC-202). **[ARCH-OWED]** the poll's scheduler runtime (§10-D4).

---

## 5. LGPD / billing-data minimisation (SC-706)

**Data map (the normative minimum).**

| MP sends / exposes | We persist? | Rule |
|---|---|---|
| Card number / PAN | **NEVER** | Card data lives only on MP's hosted surface (PCI stays with the PSP). |
| CVV / expiry / cardholder | **NEVER** | Same. |
| Full card token | **NEVER** | We hold no payment instrument. |
| Preapproval/subscription id (PSP ref) | **YES** | Needed to reconcile + manage; not sensitive alone. |
| Payment/charge id, status, period boundaries | **YES** | The authoritative facts for the grant. |
| Payer identifier (minimum: MP payer id and/or the email already on the account) | **MINIMUM only** | Bind subscription↔account; prefer the MP payer id over storing new PII. Do NOT store payer name/CPF/address unless a named later requirement demands it. |

### Invariants
- **SEC-501 (no card/PAN/CVV on any billing path)** — *protects SC-706, FR-703, US2.1.* No column, log, cache,
  export, or error body ever contains card/PAN/CVV/expiry/cardholder data. *pytest*: schema audit — no billing
  column matches a card/PAN pattern; a persisted subscription row and the correlation log contain only
  refs+status+period+payer-id. A property/regex sweep over the billing payloads asserts no 13–19-digit PAN-shaped
  field is stored. *e2e*: complete a sandbox checkout → DB inspection shows zero card data.
- **SEC-502 (minimum payer identifier only)** — *SC-706, FR-703.* The persisted payer identity is the MINIMUM to
  bind the subscription to the account (PSP payer id and/or the existing account email) — no new PII class
  (CPF/name/address) is introduced without a named requirement. *pytest*: assert the subscription model's payer
  field set is the agreed minimum; a field-inventory test fails if an unlisted PII column appears.
- **SEC-503 (append-only audit sufficiency)** — *FR-704, FR-711, US8.* The append-only entitlement ledger
  (ADR-0012) already gives an immutable audit of every grant. **Confirmed sufficient** for the *entitlement* audit
  trail: every `source=payment` grant, and every payment-driven revoke (chargeback/refund), is a durable,
  attributable, non-deletable record. Two conditions (**[ARCH-OWED]**): (i) a payment grant records enough linkage
  (which subscription/event caused it) to reconstruct *why* it exists — a `granted_by`/note or a FK to the
  subscription/event — without duplicating PSP truth; (ii) a payment-driven **revoke** for a chargeback is an
  append-only/attributable state change, not a silent physical delete (the ledger's revoke-is-UPDATE model
  preserves history — confirm it satisfies FR-711's "never a physical delete"). *pytest*: after a
  grant→chargeback cycle the ledger retains BOTH the grant and the revoke, attributable and time-ordered.
- **SEC-504 (retention posture)** — *SC-706.* Retention is stated, not implicit: PSP refs + payer id are retained
  as long as the account exists (they ARE the billing history); no separate card-data retention exists because no
  card data is stored. Broader LGPD erasure/portability stays deferred (brief §3.1) — E6 adds only the
  minimisation rule. *This is a documentation invariant*: the ADR/runbook states the retention rule; no orphaned,
  undocumented billing PII store may exist.

---

## 6. Financial-state honesty (no silent-active, no fake-active)

The honesty principle (II) with money attached: a lapsed/refunded/pending account must never *look* premium, and
a pending account must never claim "tudo certo".

### Invariants
- **SEC-601 (chargeback/refund never leaves premium silently active)** — *protects SC-710, FR-711, US8.* A
  verified refund/chargeback event resolves the affected account to the correct non-active state (revoke/expire
  the payment grant) idempotently; premium is never left silently on. *pytest*: active `source=payment` account →
  deliver a signed refund event → entitlement resolves to lapsed/none, `require_entitlement` now 403s;
  re-delivering the refund is a no-op (idempotent). *Edge "chargeback for an already-lapsed period"*: idempotent
  no-op beyond the audit record.
- **SEC-602 (grace/pending never renders "tudo certo")** — *protects FR-708, SC-705, SC-708, US5.1.* During a
  grace/pending state the server-sourced billing view returns an honest pending status; no code path renders an
  optimistic "active/tudo certo" for a pending account. *pytest*: an account in grace → the billing-state read
  returns `pending`/`grace` with the honest expiry, never a bare `active`. *e2e*: the Conta surface shows the
  pending copy, not a green "tudo certo". NOTE: entitlement stays *functionally* active during grace (the seller
  keeps premium, FR-708) — the honesty invariant is that the **displayed status** is truthful, distinguishing
  "active-paid" from "active-but-in-grace".
- **SEC-603 (no client-inferred billing state)** — *SC-708, FR-709, US6.2.* Every rendered billing state is
  server-sourced (ledger + PSP truth); the client never infers active/grace/canceled from local heuristics.
  *e2e*: with the network/entitlement forced to a given server state, the UI matches it exactly across all five
  states (active/grace/pending/canceled/lapsed); *pytest*: the state enum originates in a server response.
- **SEC-604 (at-most-one active subscription per account — double-subscribe protection)** — *protects Edge
  "same seller starts checkout twice", FR-702.* An account has at most one active subscription; a second
  concurrent checkout (double-click, two tabs) does not create a second active subscription or a double-grant.
  *pytest*: two near-simultaneous checkout-starts for the same uid → at most one active subscription results (the
  second is rejected or returns the existing one). **[ARCH-OWED]** the mechanism (a partial-unique index on active
  subscription per uid, or a check at initiation) is the arquiteto's call (§10-D5); this invariant binds it.
  Note the E6 boundary: this protects against the *product* creating a duplicate; it cannot prevent a seller
  paying twice on MP's own surface out-of-band — that resolves via reconciliation to one grant (SEC-202).
- **SEC-605 (courtesy + paid coexistence stays honest)** — *FR-709, Clarification 2026-07-20, Edge "operator
  grant + subscribe".* When a `comp`/`beta` grant and a `payment` grant coexist, the account is active while ANY
  valid grant exists (ledger semantics unchanged), Conta prioritizes the subscription state, and subscribing never
  revokes the courtesy grant. *pytest*: an account with a live `comp` grant that subscribes has BOTH grants in the
  ledger; a later payment lapse with the `comp` still valid keeps the account active (SC-709 semantics preserved).

---

## 7. Play Billing flag (OFF in E6) — prove OFF is unreachable server-side

Owner Q2: Play Billing is BUILT and sandbox-validated behind a flag that stays **OFF** in E6, turning ON at E7. A
flag that only hides UI is a security hole — a hidden-but-reachable server path is reachable.

### Invariants
- **SEC-701 (flag OFF ⇒ server path unreachable, not just hidden)** — *protects FR-712, SC-711.* With the Play
  flag OFF, the Play purchase-verification/grant route rejects (404 or an explicit disabled-403) **server-side** —
  hiding the UI is insufficient. *pytest*: with the flag OFF, a direct POST to the Play verify/grant route grants
  nothing and returns a not-enabled response; **no** grant can be written via the Play path while OFF.
- **SEC-702 (flag fails closed / defaults OFF)** — *FR-712, SC-711.* The flag's default and its unset/unknown
  value are OFF; there is no configuration under which an unset flag reads as ON. *pytest*: unset the flag → Play
  path disabled; assert the default literal is OFF.
- **SEC-703 (Play terminates in the SAME verified-grant machinery)** — *FR-712.* When ON (E7), the Play path must
  reuse the same verify-then-grant terminus (Play receipt verification against Google as source of truth → append
  a grant), never a client-trusted purchase claim. *pytest (sandbox/internal-testing evidence for the E7 gate)*: a
  Play sandbox purchase, verified server-side, writes exactly one grant; a client-asserted Play purchase without
  server verification grants nothing. **E7 turn-on precondition list (security angle):** (1) a **distinct** Play
  signing/verification secret in the `P3D_` settings, separate from MP's; (2) sandbox↔prod separation for Play
  proven by an analogue of SEC-402; (3) Play receipt verification is server→Google (source of truth), never the
  packaged app's word; (4) the Play grant path carries its own idempotency key (SEC-201 analogue); (5) a seguranca
  review of the Play PR at E7, same gate as §8.

---

## 8. Review gates — seguranca sign-off is MANDATORY pre-merge

The spec (Assumptions; brief §8 PR-A, §9.2) makes seguranca review **mandatory on the PR carrying
checkout/confirmation** — payments is the epic this role exists for. This is a **blocking DoD gate** (Constitution
Governance + workflow "always heavy on payments/entitlements"): a real finding BLOCKS the increment until resolved
or waived by an approved ADR.

**The review of the checkout/webhook PR (PR-A) MUST verify, with evidence:**
1. **Signature verification present and correct** — SEC-101..107; the constant-time compare; the manifest
   canonicalization (incl. `data.id` lowercasing) unit-tested against a known-good MP vector.
2. **Verify-then-lookup** — SEC-103/104; the grant's facts come from the MP lookup, never the body.
3. **Idempotency at the DB layer** — SEC-201..203; a `UNIQUE` constraint, not application-level dedup; old-event
   replay proven inert.
4. **Cross-account isolation** — SEC-204; subscription↔account resolved only by the server-side mapping.
5. **No client-write-to-grant path** — SEC-301; route audit.
6. **Checkout authz** — SEC-302/303; authenticated, self-only, no IDOR/enumeration.
7. **Secrets + env separation** — SEC-401/402/403; sandbox-can't-write-prod proven; fail-closed on missing secret.
8. **Data minimisation** — SEC-501/502; a schema/log audit showing zero card data.
9. **Deny-by-default** — every ambiguous input (bad sig, unknown sub, stale ts, missing secret, flag off) proven
   to grant nothing.
10. **The existing E1–E5 gate/lapse suites still green** — SEC-304, SC-709.

**The review of PR-B (reverse lifecycle)** additionally verifies SEC-601/602/603/604/605 (refund/chargeback,
grace honesty, no client-inferred state, double-subscribe, courtesy coexistence). **PR-C** verifies SEC-701/702
(Play flag OFF) and that the teaser CTAs leak no billing state cross-account.

**Gate outcome format**: findings ranked by severity, each with a minimal remediation; any real finding blocks
merge until fixed or waived by an approved ADR (0023 or a follow-up).

---

## 9. Invariant → FR/SC traceability (coverage matrix)

| Requirement | Invariants covering it |
|---|---|
| FR-702 (auth before payment) | SEC-302, SEC-604 |
| FR-703 (no card data; PSP refs only) | SEC-501, SEC-502 |
| FR-704 (only server-verified event grants) | SEC-101..107, SEC-201, SEC-204, SEC-301, SEC-403 |
| FR-705 (idempotent processing) | SEC-201, SEC-202, SEC-203 |
| FR-706 (reconciliation resilience) | SEC-202, SEC-404, SEC-405 |
| FR-708 (grace honest pending) | SEC-602 |
| FR-709 (server-sourced billing state) | SEC-303, SEC-603, SEC-605 |
| FR-711 (refund/chargeback mechanics) | SEC-503, SEC-601 |
| FR-712 (Play flag OFF) | SEC-701, SEC-702, SEC-703 |
| FR-714 / SC-709 (E1–E5 unchanged) | SEC-304, SEC-605 |
| SC-702 (100% grants server-verified) | SEC-101..105, SEC-204, SEC-301, SEC-402, SEC-403 |
| SC-703 (idempotent exactly-once) | SEC-201, SEC-202, SEC-203 |
| SC-706 (data minimisation) | SEC-401, SEC-501, SEC-502, SEC-504 |
| SC-708 (no client-inferred state) | SEC-303, SEC-603 |
| SC-710 (refund never silently active) | SEC-601 |
| SC-711 (Play unreachable OFF) | SEC-701, SEC-702 |

---

## 10. [ARCH-OWED] — decisions the plan/ADR-0023 must make for these invariants to be testable

> Surfaced for arquiteto/owner (Principle VIII). I do **not** resolve these; each blocks a specific invariant.

- **D1 — Webhook endpoint auth model.** The webhook is the first UNAUTHENTICATED public route (no `current_claims`).
  Its authenticity is the signature ALONE. The ADR must state this explicitly and the route must sit OUTSIDE the
  `current_claims` dependency. *(Blocks SEC-101..107.)* **Flag:** this breaks the codebase's uniform "every route
  authenticates via Firebase" invariant — a deliberate, ADR-recorded exception, not a drift.
- **D2 — Subscription↔account registry (schema).** The local mapping (uid ↔ preapproval id ↔ status ↔ period ↔
  payer id) written at checkout-start and read at webhook/reconciliation. *(Blocks SEC-105, SEC-204, SEC-302,
  SEC-303, SEC-502.)* Money/entitlement domain ⇒ **escalates dev-estrutura-de-dados → opus** (CLAUDE.md ADR-0022).
- **D3 — Idempotency store.** Reuse/extend the ADR-0018 outbox pattern as a server-side **inbox**, or a new
  processed-events table; the key is MP's event identity, enforced by a DB `UNIQUE`. *(Blocks SEC-201, SEC-202.)*
- **D4 — Reconciliation scheduler runtime.** The server→MP poll needs a scheduler (Cloud Scheduler / cron / task).
  Note the deploy deferral (owner Q3): before v1 there is no live scheduler — the poll must be runnable/testable
  in dev+sandbox. *(Blocks SEC-202, SEC-405.)*
- **D5 — Double-subscribe guard.** Partial-unique index on active subscription per uid, or a check-at-initiation.
  *(Blocks SEC-604.)*
- **D6 — Timestamp freshness window (N) + `data.id` canonicalization.** MP publishes no default freshness window;
  we must set a bounded replay window and pin the `data.id` lowercasing. *(Blocks SEC-106, SEC-101.)*
- **D7 — Grace state representation.** How "grace/pending" is modelled so entitlement stays functionally active
  (FR-708) while the displayed status reads honestly pending (SEC-602) — a status field distinct from the raw
  active/lapsed derivation, OR a derived view. *(Blocks SEC-602, SEC-603.)* Potential tension with ADR-0012's
  pure `active = ¬revoked ∧ (expiry null ∨ now<expiry)` derivation — the arquiteto must reconcile grace with the
  ledger's grant-shape without changing the lapse rule (SC-709).
- **D8 — Chargeback revoke shape.** ADR-0012 revoke is an UPDATE (`revoked_at`), preserving history. Confirm this
  satisfies FR-711's "never a physical delete" for a payment-driven revoke, and that the revoked row remains
  attributable to the causing event. *(Blocks SEC-503, SEC-601.)*

**No conflict found** between this security round and the spec's stated architecture *assumptions* — the spec
explicitly reuses ADR-0012 verbatim and adds a writer, which is exactly the security-preferred shape (one seam,
one evaluation rule). The single structural novelty that carries real risk is **D1 (the unauthenticated webhook
seam)**; it is unavoidable (MP holds no token) and must be an explicit ADR decision, not an inferred exception.

---

## 11. Sources (MP mechanism verified 2026-07-20)

- MP Webhooks (signature `x-signature` ts+v1, manifest `id:...;request-id:...;ts:...;`, secret retrieval,
  post-ack resource lookup): <https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks>
- MP Webhooks Notifications — Secret Signature (2024 announcement):
  <https://www.mercadopago.com.pe/developers/en/news/2024/01/11/Webhooks-Notifications-Simulator-and-Secret-Signature>
- Payment notifications (topic/payload structure, `data.id` lookup):
  <https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications>
