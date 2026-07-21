# ADR-0023: Payments — Mercado Pago recurring subscription end-to-end (a new ledger writer), Play-Billing flag-ready

- **Status**: Proposed
- **Date**: 2026-07-20
- **Deciders**: Jonatan (owner) + arquiteto + seguranca (mandatory review on the checkout/confirmation PR) + dev-estrutura-de-dados (schema, **escalated to `opus`** — money/entitlement domain, CLAUDE.md ADR-0022)
- **Extends**: ADR-0012 (entitlement ledger — the terminus) · ADR-0013 (persistence stack) · ADR-0018 (exactly-once precedent — the *principle*, not the client outbox)
- **Relates**: ADR-0002 (wire contract, ErrorCode → Orval) · ADR-0005 (env separation) · ADR-0015 (client-guard over a server gate) · Constitution IV/II/VIII · `docs/product/business-rules.md` §Payments (the open PSP-vs-Play risk this ADR resolves)
- **Governs the spec**: `specs/012-e6-billing/spec.md` (FR-701..714, SC-701..711)
- **Resolves**: `docs/adr/README.md` §Pending — "Payments — Google Play Billing vs Mercado Pago recurring (blocking before any payment code; E6)".

## Context

E1–E5 built the entire premium product behind a **server-authoritative** entitlement wall (ADR-0012): an
append-only `entitlement_grants` ledger, a per-request `require_entitlement` dependency, `GET /api/v1/entitlement`,
and a lapse-to-read-only freeze. The only writer to that ledger today is an **operator CLI** (`app.scripts.grant_premium`,
`source IN ('beta','comp')`). There is no door a real seller can open.

E6 hangs the door. The load-bearing architectural claim (verified against the code, not inferred): **E6 needs no new
entitlement mechanism — only a new writer.** `read_entitlement_state` (backend/app/entitlement/__init__.py:55)
already computes `active = EXISTS grant(revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now))` live, per
request; a payment is simply a new writer of that ledger with `source=payment` and `expires_at` = paid-period end.
Instant propagation, the lapse freeze, per-account isolation, and the Conta surface are reused verbatim (SC-709).

Six forces bind the mechanism:
1. **Constitution IV (the crux).** Only a **server-verified** payment event may write a grant (SC-702). A client
   claim of "paid" grants nothing. Verification = MP signature **and/or** a server-side lookup against MP's API.
2. **Recurring, Pix + card, hosted checkout.** The product must never see card/PAN/CVV (SC-706) — MP's hosted
   surface carries the PCI burden; we persist only PSP references + a minimum payer identifier.
3. **Exactly-once (SC-703).** MP retries and duplicates deliveries; a reconciliation poll re-observes the same
   truth. The same event/charge processed N times MUST produce exactly one grant/state change.
4. **Resilience without a live prod endpoint (owner Q3).** All E6 dev/test runs on **MP sandbox + a dev tunnel**;
   the live webhook is validated **at the v1 deploy** (the 2026-07-09 deploy deferral stands). A **reconciliation
   poll** is the resilience layer so a missed webhook never strands a paid seller (US3.5).
5. **Env isolation (SC-711-adjacent).** A **sandbox** event must never write a **prod** grant.
6. **Play Billing flag-ready (owner Q2).** The Play verify→grant path is **built + sandbox-validated behind an OFF
   flag** in E6 and turns ON at E7 (packaged app). It MUST terminate in the *same* grant writer as MP.

**Verified MP surface (official docs, 2026-07-20 — see §Sources).** Recurring in Brazil is the **preapproval**
family: `preapproval_plan` (a reusable plan template: frequency + amount + currency) and `preapproval` (a payer's
subscription, optionally linked to a plan). Creating a `preapproval` with `status: "pending"` returns an
**`init_point`** — MP's **hosted** checkout URL — and supported methods include **Pix, credit/debit card, account
money** (Pix-for-recurring is live). Lifecycle is reported by three webhook topics: **`subscription_preapproval`**
(the subscription created/updated/authorized/paused/cancelled), **`subscription_authorized_payment`** (each recurring
charge — success *and* failure), and `subscription_preapproval_plan`. Each notification carries `{ type, action,
data.id, live_mode }`; the integrator **looks the resource up** (`GET /preapproval/{id}`, `GET
/authorized_payments/{id}`) — the lookup, not the webhook body, is the authority. Authenticity is an **`x-signature`**
HMAC header (`ts=…,v1=…`). Numbers unverifiable from docs alone (MP's **retry cadence** for a failed charge; the exact
SDK/version) are flagged for the plan/implementation round, never assumed (the ADR-0020 `reportlab`-pinned lesson).

## Options considered (≥3, per Constitution)

The primary axis is **the MP recurring primitive + the confirmation model**. The schema, idempotency, reconciliation,
webhook, Play-flag and client sub-decisions follow as sub-rules of the chosen option (§Decision).

### Option A — `preapproval` (hosted `init_point`) linked to a `preapproval_plan`, server-verified confirmation, poll+webhook unified on the authoritative lookup — CHOSEN

Two fixed `preapproval_plan`s (monthly R$ 15,99 · annual R$ 155,88/yr). Checkout creates a **`preapproval`** for the
chosen plan and hands the seller to MP's **`init_point`**. Confirmation is **event-driven verified**: a
`subscription_authorized_payment` webhook (or the reconciliation poll) triggers a **server-side lookup** of the
authoritative MP resource; a verified *authorized payment* writes **one** `source=payment` grant. Webhook and poll
**converge on the same idempotency key** — the MP `authorized_payment.id` — so both paths are exactly-once and neither
double-grants.

- **Pros:** the hosted `init_point` keeps every card byte off our backend (SC-706 by construction); a plan template
  centralises the price and makes an owner price change one MP-side edit + one product-side constant, never a schema
  change; the "verify by lookup, not by webhook body" rule is Constitution IV at its strongest (a forged webhook body
  is inert — we re-fetch the truth); **the reconciliation poll and the webhook are the same code past the lookup**,
  so the resilience layer costs almost nothing and can't diverge; Pix + card are MP's surface, not our promise.
- **Cons:** two MP objects to model (plan + preapproval); a plan edit does not retro-price existing subscribers
  (acceptable — no mid-cycle change in v1, FR-713); we own a small poll runner.
- **Scalability impact:** high — one writer, one ledger, one idempotency key shared by both confirmation paths; the
  Play provider slots in behind the *same* writer (§Decision 6). Portable to Cloud SQL/Cloud Run unchanged (ADR-0013).
- **Confidence:** 82%.

### Option B — `preapproval` **without** an associated plan (amount + frequency inline per subscription)

Skip `preapproval_plan`; every checkout creates a standalone `preapproval` carrying its own `auto_recurring`
(frequency + `transaction_amount`).

- **Pros:** one MP object; the price travels in the request, so a price change needs no plan pre-provisioning.
- **Cons:** the price is **scattered across every subscription** instead of centralised in a plan the owner can
  inspect in MP's dashboard; loses MP's plan-level reporting/subscriber list; a fat-fingered amount is a per-checkout
  risk instead of a one-time plan config; the confirmation/idempotency/Play machinery is otherwise identical, so B
  buys nothing A lacks while giving up centralisation.
- **Scalability impact:** medium — the confirmation spine is the same; only price governance is weaker.
- **Confidence:** 45%.

### Option C — Webhook-body-trusting fast-grant (grant from the notification payload, reconcile later)

Write the grant directly from the `subscription_authorized_payment` webhook body (status in the payload), treating a
later reconciliation poll as cleanup.

- **Pros:** lowest latency to premium-on; fewer MP round-trips.
- **Cons:** **violates Constitution IV** — the webhook body is attacker-controllable at a public endpoint; the
  signature proves *origin* but the payload's `status` must still be re-verified by lookup before it can move money's
  entitlement. Trusting the body is exactly the "client-side claim" the whole epic exists to refuse (SC-702). A
  signature-replay or a spoofed body would grant premium.
- **Scalability impact:** negative on the one axis that matters here (integrity).
- **Confidence:** 8% (rejected on principle, not cost).

### Option D — Include Play Billing as a live second PSP in E6

Ship MP **and** a live Google Play Billing integration in E6.

- **Pros:** one epic covers both stores.
- **Cons:** Play Billing **requires a packaged Android app**, which is **E7** (`business-rules.md:58`) — billing
  against Google Play with no published app cannot ship; it doubles the seguranca surface (a second receipt-verify,
  Google's RTDN, store policy). Owner Q2 already decided **flag-ready, OFF in E6, ON at E7**.
- **Scalability impact:** negative now (recommends an impossibility); positive later as a *provider behind the shared
  writer* (which Option A delivers as flag-ready).
- **Confidence:** 10% as an E6 live path; 88% as the flag-ready-now / on-at-E7 shape Option A adopts.

## Decision

**Option A**, owner to ratify at the PR-A gate (the ADR-0017/0021/0022 precedent: Proposed until the PR-A merge
homologation, then Accepted). Sub-rules, all normative:

### 1. MP integration shape (FR-703)
- Two `preapproval_plan`s (monthly · annual), provisioned once per environment; their ids live in **Settings**
  (`P3D_MP_PLAN_ID_MONTHLY` / `P3D_MP_PLAN_ID_ANNUAL` (naming reconciled 2026-07-21 to the implemented settings contract), per-env). The R$ prices are product constants shown honestly
  (15,99/mês · 155,88/ano ≡ "equivalente a R$ 12,99/mês"); no fabricated number, ever (FR-701, SC-707).
- Checkout `POST /api/v1/billing/checkout {period}` → server creates a `preapproval` for the plan + the authenticated
  payer → returns `{ initPoint }`; the client redirects. **Authenticated but NOT entitlement-gated** (a free seller is
  the caller) — it depends on `current_claims` only (FR-702; no anonymous subscription).
- **Persisted PSP references only** (SC-706): `mp_preapproval_id`, `status`, `plan_period`, `current_period_end`,
  `payer_ref` (MP's minimum payer identifier), `provider`. **Never** card/PAN/CVV. seguranca confirms the data map +
  the LGPD basis for the payer identifier.

### 2. Subscription ↔ ledger schema — migration `0005`, `down_revision = "0004"` (money/entitlement domain → **ADR-0022 opus-escalation flag for the schema executor**)
- **New `subscriptions` table** — the PSP mirror: `id` (uuid7 PK), `owner_uid` (FK → `accounts`, the only account
  link), `provider` (`mercadopago` | `google_play`), `mp_preapproval_id` (**UNIQUE**, nullable for the Play row),
  `plan_period` (`monthly` | `annual`), `status` (`pending` | `authorized` | `grace` | `paused` | `cancelled` — `grace` added per data-model §1/§5, reconciled 2026-07-21), `payer_ref`,
  `current_period_end` (timestamptz), timestamps, `deleted_at`. CHECK-guard the enums; no money column (a subscription
  stores references, never a price — the E4/E5 "no money leaf" discipline).
- **New `billing_events` inbox table** — the server-side idempotency ledger (§3): `id`, `subscription_id` (FK),
  `event_key` (**UNIQUE** — the MP `authorized_payment.id` for a grant, the refund/chargeback id for a revoke),
  `kind` (`payment` | `payment_failed` | `refund` | `chargeback` | `cancel`), `mp_status`, `raw` (JSONB, the looked-up
  authoritative resource — audit), `processed_at`. The UNIQUE on `event_key` is what makes exactly-once a **database**
  guarantee, not app cleverness (the ADR-0018 §3 lesson, restated server-side).
- **Extend `entitlement_grants`** (ADR-0012), additively: (a) the source CHECK `source IN ('beta','comp')` →
  `source IN ('beta','comp','payment')`; (b) add nullable `subscription_id` (FK → `subscriptions`) so a payment grant
  traces to its subscription; `beta`/`comp` grants leave it NULL. **The ledger's evaluation is untouched** — the
  `require_entitlement`/`read_entitlement_state` code does not change; a `payment` grant is just another row.
- **Renewal writes the next period's grant**: a verified `subscription_authorized_payment` → one new append-only grant
  (`source=payment`, `expires_at = current_period_end`), inside the **same transaction** as the `billing_events`
  insert. Append-only per ADR-0012; the newest active grant keeps the account active with zero interruption.
- The operator CLI (`grant_premium.py`) stays `beta|comp`-only (its `source not in (...)` guard is deliberately not
  widened — payment grants are written only by the verified event writer, never by hand).

### 3. Idempotent event processing (SC-703) — reuse the ADR-0018 *principle*, a new server-side inbox for the *mechanism*
- **Do not reuse the ADR-0018 outbox machinery** — that is a *client-side*, device-durable IndexedDB queue for the
  seller's own writes; MP events originate server-side. **Reuse its principle**: an idempotency key carried in durable
  data + a DB UNIQUE constraint + "on conflict, return the existing effect (no-op)".
- The `billing_events.event_key` UNIQUE is that constraint. Grant-writing (payments, refunds/chargebacks) is
  exactly-once via the inbox. **Subscription status mirroring** (authorized/paused/cancelled) is a separate,
  naturally-idempotent UPSERT keyed on `mp_preapproval_id` — mirroring the *latest looked-up* status has no
  double-effect, so it needs no inbox row.

### 4. Reconciliation poll (FR-706) — resilience, unified with the webhook on the lookup
- A server-invoked runner (`app.scripts.reconcile_subscriptions`, the `grant_premium.py` CLI pattern) that, for each
  non-terminal subscription, does `GET /preapproval/{id}` + lists recent `authorized_payments`, then feeds each into
  **the same processing function the webhook calls**. Convergence is structural: both paths look the resource up and
  key on `authorized_payment.id`, so a payment already granted is an inbox conflict = no-op; a missed webhook is healed
  (US3.5); neither double-grants.
- **Dev posture:** invokable by hand (deploy is deferred — no scheduler in dev). **Deploy posture:** wired to Cloud
  Scheduler → a Cloud Run job at the v1 deploy. Cadence is a small operational choice (recommend ~every 6–12 h + an
  on-demand trigger) confirmed at the plan round with MP's retry cadence in hand.

### 5. Webhook endpoint design — a signature-authenticated public route (crypto detail → seguranca)
- **Route:** `POST /api/v1/billing/webhook/mercadopago`, **public** (NOT behind `current_claims` — MP carries no
  Firebase token). It is the codebase's first signature-authenticated route; mounted like `fee_catalog`/`health`
  (unauthenticated by Firebase) but guarded by a **signature-verify dependency that runs before any DB touch**.
- **Verification seam (I own placement; seguranca owns the crypto in their round):** verify the `x-signature` HMAC
  with the **environment's** `P3D_MP_WEBHOOK_SECRET` (SecretStr) → then **look the resource up** against MP → only the
  looked-up authoritative state may write. A bad/absent signature ⇒ reject, grant nothing (SC-702, US3.4). Respond 200
  fast and process idempotently (MP retries on non-2xx).
- **Env separation — a sandbox event can never write a prod grant (defence in depth):** (a) the webhook secret and the
  MP access token are **per-environment** (Settings, SecretStr) — a sandbox notification signed with the sandbox
  secret fails HMAC against prod's secret; (b) additionally assert the notification's `live_mode` matches the
  environment (`prod ⇒ live_mode=true`, sandbox ⇒ `false`) and reject on mismatch. Two independent guards.
- **Dev/tunnel posture:** the dev tunnel exposes this route to MP sandbox; the live route is validated at the v1
  deploy (owner Q3). Reconciliation (§4) covers the interval the tunnel is down.

### 6. Play-Billing flag architecture (FR-712) — a provider behind the shared writer, OFF in E6
- **The flag is server-side config:** `P3D_PLAY_BILLING_ENABLED: bool = False` in Settings (env-driven, not a client
  flag — Constitution IV). OFF in every E6 environment; asserted OFF (SC-711).
- **Shared seam:** define a thin `PaymentProvider` abstraction whose only job is to produce a *normalised verified
  payment event* `(subscription, event_key, period_end, kind)`. MP and Play are two implementations; **both terminate
  in one `grant_writer`** that writes the `source=payment` grant + the `billing_events` inbox row. `subscriptions.provider`
  records which store; the grant is provider-agnostic (`source=payment` regardless).
- **"Sandbox-validated behind OFF flag" structurally means:** the Play `PaymentProvider` (purchase-token verify against
  Google Play Developer API → normalised event → same writer) is **implemented and tested against Play internal
  testing**, but its checkout-initiation + RTDN routes are **flag-gated** (return disabled/404 when OFF), and E6 asserts
  no Play surface is reachable. Evidence (a sandbox Play purchase reaching the shared writer) is recorded for the **E7
  turn-on gate**, which needs only: flip the flag + the packaged app (E7) + a live RTDN endpoint. Play is **not folded
  into MP's verify path** — it is a separate provider with its own seguranca review at E7.

### 7. Client surface
- **Checkout:** `POST /api/v1/billing/checkout` → `{ initPoint }` (§1).
- **Entitlement refresh:** the **existing** `GET /api/v1/entitlement` is reused verbatim for the premium-on flip
  (≤1 session/token-refresh window; no re-login — SC-701). Its `{status, source, expiresAt}` shape is unchanged.
- **Conta plan-state:** a **new** `GET /api/v1/billing/subscription` → `{ plan, status, currentPeriodEnd,
  cancelAtPeriodEnd, graceUntil? }`, server + PSP sourced (SC-708). Rationale for a new endpoint over extending
  `/entitlement`: entitlement is the generic gate answer (also covers beta/comp with no subscription and sits adjacent
  to every gated surface); billing detail is a distinct PSP-sourced concern. Conta calls both and, per the 2026-07-20
  clarification, **prioritises the subscription state when one exists** (else the courtesy grant). A courtesy grant is
  never revoked by subscribing; the account is active while ANY valid grant exists (ledger semantics unchanged).
- **Cancel:** `POST /api/v1/billing/subscription/cancel` → cancels the MP preapproval (takes effect at **paid-period
  end** — FR-707/Q10); the existing grant's `expires_at` is untouched, so it lapses naturally into the E2/E4/E5 freeze,
  zero rows deleted. Re-subscribe = the same re-grant path E2–E5 already exercise.
- **Grace (FR-708):** on a verified failed renewal, keep the account active by covering `max(MP retry cadence, 7 days)`
  and mark the subscription pending/grace; the Conta surface shows the honest "pagamento pendente — regularize até
  {data}". Lapse only on grace exhaustion (an expiry-driven lapse, ADR-0012 verbatim). **MP's actual retry cadence is
  confirmed at the plan round** to implement the `max()` — flagged, not assumed.
- **Refund/chargeback (FR-711):** a verified MP refund/chargeback → an inbox row + a ledger **revoke** (`revoked_at`)
  on the active payment grant → immediate lapse; append-only, idempotent, auditable.
- **Teaser light-up (FR-710):** the four existing teasers (`features/catalog/premium-teaser.tsx`,
  `features/bom/bom-teaser.tsx`, `features/history/history-teaser.tsx`, `features/scenarios/scenario-teaser.tsx`) point
  at a shared **`features/billing`** "Assinar" CTA — real price, working path, no false urgency.

### 8. `pricing-core` untouched · FSD-Lite placement
- **`pricing-core` is NOT touched** (~97%): billing is orthogonal to the pricing formula — no version bump, no new
  contract. Confirmed against the seams: no billing path calls `computeCalculator`/`computeBom`.
- **FE:** a new `apps/web/src/features/billing/` slice (plan surface, checkout initiation, Conta plan panel data, the
  shared Assinar CTA). Entitlement state stays in `entities/user` (`use-entitlement.ts`, `entitlement-cache.ts`).
  `pages/conta/conta-page.tsx`'s plan section consumes the new billing endpoint. FSD-Lite boundaries preserved
  (features → entities → shared; no upward imports).
- **BE:** a new `app.billing` package (`checkout` service, `providers/` with the MP + flag-gated Play provider, the
  shared `grant_writer`, the `webhook` route, the `reconcile` runner) + `app.api.billing`. `ENTITLEMENT_REQUIRED`
  needs no sibling: checkout is auth-only, the webhook is signature-auth. A **new `ErrorCode`** may be needed for a
  checkout-creation failure (e.g. `BILLING_UNAVAILABLE`) — decided at the plan round only if a route can actually
  return it (no phantom codes — the ADR-0002/errors.py discipline).

## Consequences

- **Positive:** the epic's centerpiece holds — a verified payment is a new *writer* of the ADR-0012 ledger, and every
  E2–E5 guarantee (propagation, lapse freeze, per-account isolation, Conta) is reused verbatim (SC-709); card data
  never touches the backend (hosted `init_point`, SC-706); webhook and reconciliation are one code path past the
  lookup, so the resilience layer can't diverge and can't double-grant (SC-703); Constitution IV is enforced by
  "verify-by-lookup" (a forged webhook body is inert); env isolation is defence-in-depth (per-env secret + `live_mode`);
  Play arrives at E7 as a provider behind the *same* writer with a one-flag turn-on.
- **Negative / trade-offs accepted:** two MP objects (plan + preapproval) and a small poll runner we own; a plan-level
  price edit does not retro-price existing subscribers (fine — no mid-cycle change, FR-713); the first
  signature-authenticated public route enters the codebase (seguranca-reviewed); the grace mechanic depends on MP's
  retry cadence (a confirmed-at-plan unknown); fiscal sufficiency of MP's receipt (Q9) is **provisionally** assumed and
  routed to an accountant/compliance check — a launch blocker if it fails, not a code blocker.
- **Follow-ups / triggered work:** `data-model.md` owns the `subscriptions` + `billing_events` DDL and migration
  `0005` (opus-escalated); `contracts/` owns the `/api/v1/billing/*` surface; **seguranca's round** owns the
  `x-signature` HMAC manifest, secret storage/rotation, the LGPD payer-data map, and the deny-by-default tests; the
  plan round confirms MP's retry cadence (grace `max()`), the poll cadence, and the MP SDK-vs-httpx + version pin
  (verified-not-assumed); the Play provider's own ADR/review lands at E7. This ADR flips **Accepted at the PR-A merge
  homologation**.

## Sources verified (2026-07-20, official Mercado Pago Developers)

- Subscriptions overview (preapproval / preapproval_plan; Pix + card + account money; hosted subscription link):
  <https://www.mercadopago.com.br/developers/en/docs/subscriptions/overview>
- Subscription without associated plan — authorized payments (`POST /preapproval`, `status: authorized`):
  <https://www.mercadopago.com.br/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/authorized-payments>
- Create subscription (`/preapproval` reference): <https://www.mercadopago.com.br/developers/en/reference/subscriptions/_preapproval/post>
- Create subscription plan (`/preapproval_plan` reference): <https://www.mercadopago.com.br/developers/en/reference/subscriptions/_preapproval_plan/post>
- Subscription webhook topics (`subscription_preapproval`, `subscription_authorized_payment`,
  `subscription_preapproval_plan`; payload `{type, action, data.id, live_mode}`; lookup endpoints):
  <https://www.mercadopago.com.co/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks>
- `x-signature` notification validation (secret signature, `ts=…,v1=…` HMAC):
  <https://www.mercadopago.com.br/developers/en/news/2024/02/27/Ensure-the-validity-of-notifications-sent-by-Mercado-Pago>

> Flagged unknowns (Constitution II — not fabricated): MP's exact **retry cadence** on a failed renewal (drives the
> grace `max()`), and the specific **MP SDK + version** for HMAC verification, are confirmed at the plan/implementation
> round against the installed tool — never assumed here.
