# E6 — Architecture round (012-e6-billing)

**Author**: arquiteto · **Date**: 2026-07-20 · **Feeds**: `docs/adr/0023-payments-mercado-pago-recurring.md`
(Proposed) → plan.md → tasks. **Ground truth read**: `spec.md` (FR-701..714, SC-701..711 + the 2026-07-20
decisions), scope brief §9, ADR-0012 (terminus), ADR-0018 (exactly-once precedent), ADR-0013 (persistence), the live
backend seams (`entitlement/__init__.py`, `models/__init__.py`, `api/entitlement.py`, `scripts/grant_premium.py`,
`main.py`, `settings.py`, `auth.py`, `errors.py`, `alembic/versions/0004_*`), and the Constitution.

> **The one-sentence architecture.** E6 attaches a *verified payment event* to the **front** of the ADR-0012
> entitlement machine as a new **writer** (`source=payment`) — it invents no new gate, no new propagation, no new
> lapse. Everything below is plumbing in service of that single seam staying honest (Constitution IV) and
> exactly-once (SC-703). Full decision + ≥3 options with confidence live in **ADR-0023**; this document is the
> seam-by-seam map, the risks table, and the Constitution check.

---

## Verified code seams (what E6 attaches to — read, not inferred)

| Seam | File | What E6 does to it |
|------|------|--------------------|
| Ledger evaluation | `backend/app/entitlement/__init__.py:55` `read_entitlement_state` — `active = grant(revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now))` | **Unchanged.** A `payment` grant is just another row it already evaluates. |
| Write/read gates | same file — `require_entitlement` (binary active) · `require_catalog_read` (active∨lapsed) | **Unchanged.** Lapse-by-expiry already routes to the freeze. |
| Grant model | `backend/app/models/__init__.py:89` `EntitlementGrant`, CHECK `source IN ('beta','comp')` | Extend CHECK → `+ 'payment'`; add nullable `subscription_id` FK. Additive only. |
| Plan surface | `backend/app/api/entitlement.py` `GET /api/v1/entitlement` → `{status,source,expiresAt}` | **Reused verbatim** for the premium-on flip (SC-701). Billing detail goes to a new endpoint. |
| Operator writer | `backend/app/scripts/grant_premium.py` (`source not in ('beta','comp')`) | **Not widened.** Payment grants are written only by the verified-event writer, never by hand. |
| Route mounting | `backend/app/main.py:101` `/api/v1` router | Add `billing_router` (checkout + Conta) + the public `webhook` route. |
| Env/secrets | `backend/app/settings.py` (`app_env`, SecretStr pattern) | Add per-env MP creds: access token, webhook secret, the two plan ids, the Play flag. |
| Auth boundary | `backend/app/auth.py` `current_claims` (Firebase bearer) | Checkout/Conta use it; the **webhook cannot** (MP carries no Firebase token) → signature-auth route. |
| Error model | `backend/app/errors.py` `ErrorCode` enum → Orval union | At most one new code (`BILLING_UNAVAILABLE`) and only if a route can truly return it (no phantoms). |
| Migration head | `backend/alembic/versions/0004_e5_scenarios.py` (`revision="0004"`) | Next = **`0005`**, `down_revision="0004"`. |
| FE entitlement | `apps/web/src/entities/user/{use-entitlement,entitlement-cache}.ts` | Reused. New `features/billing` slice; teasers point at its Assinar CTA. |

---

## 1. Mercado Pago integration shape

**Recommendation (ADR-0023 Option A, 82%): `preapproval` (hosted `init_point`) linked to two `preapproval_plan`s
(monthly R$ 15,99 · annual R$ 155,88/yr), server-verified confirmation by lookup.**

- **Primitive (verified, official docs):** recurring in Brazil is the **preapproval** family. `preapproval_plan` =
  a reusable plan template (frequency + amount + currency); `preapproval` = a payer's subscription (optionally linked
  to a plan). Creating a `preapproval` with `status:"pending"` returns **`init_point`** — MP's **hosted** checkout —
  and supported methods include **Pix + credit/debit card + account money** (Pix-for-recurring is live). This
  satisfies "Pix+card, hosted, card never touches our backend" directly.
- **Why plan-linked over inline-amount (Option B):** the price is centralised in a plan the owner can inspect/edit in
  MP's dashboard instead of scattered across every subscription request; MP gives plan-level subscriber reporting;
  an owner price change is one plan edit + one product constant, never per-checkout risk.
- **Confirmation is verify-by-lookup, never trust-the-body (Option C rejected on Constitution IV):** a webhook (or the
  poll) gives us a resource id; we **`GET /preapproval/{id}` / `GET /authorized_payments/{id}`** and act on the
  authoritative state. A forged/replayed webhook body is inert.
- **PSP references we persist (SC-706, minimisation):** `mp_preapproval_id`, `status`, `plan_period`,
  `current_period_end`, `payer_ref` (MP's minimum payer id), `provider`. **Never** card/PAN/CVV. The LGPD basis for the
  payer identifier is seguranca's data-map item.
- **Flagged unknown (Constitution II, not fabricated):** MP's exact **retry cadence** on a failed renewal (feeds the
  grace `max(cadence, 7d)`) and the **MP SDK + version** for HMAC verification are confirmed at the plan round against
  the installed tool — the ADR-0020 `reportlab`-pinned-not-assumed lesson.

## 2. Subscription ↔ ledger schema (migration `0005`)

> **ADR-0022 escalation flag: migration `0005` and the `subscriptions`/`billing_events`/`entitlement_grants` changes
> touch the money/entitlement domain → the `dev-estrutura-de-dados` executor is escalated to `opus` for this schema.**

- **`subscriptions`** (PSP mirror; no money column — references only): `id` uuid7 PK · `owner_uid` FK→`accounts`
  (**only** account link) · `provider` (`mercadopago|google_play`, CHECK) · `mp_preapproval_id` **UNIQUE** (nullable
  for the Play row) · `plan_period` (`monthly|annual`, CHECK) · `status` (`pending|authorized|paused|cancelled`,
  CHECK) · `payer_ref` · `current_period_end` timestamptz · timestamps · `deleted_at`.
- **`billing_events`** (server-side inbox = the idempotency ledger): `id` · `subscription_id` FK · `event_key`
  **UNIQUE** (the idempotency key — see §3) · `kind` (`payment|payment_failed|refund|chargeback|cancel`) · `mp_status`
  · `raw` JSONB (the looked-up authoritative resource, audit) · `processed_at`.
- **`entitlement_grants`** additive extension: source CHECK `+ 'payment'`; new nullable `subscription_id` FK. Ledger
  **evaluation code unchanged**.
- **Renewal → next period's grant:** a verified `subscription_authorized_payment` writes **one** append-only grant
  (`source=payment`, `expires_at = current_period_end`, `subscription_id` set) **in the same transaction** as the
  `billing_events` insert. Append-only per ADR-0012; the newest active grant keeps premium continuous.

## 3. Idempotent event processing — reuse the ADR-0018 *principle*, new inbox for the *mechanism*

**Decision:** do **not** reuse ADR-0018's *machinery* (that outbox is a client-side, device-durable IndexedDB queue
for the seller's own writes — the wrong layer for server-originated MP events). **Reuse its principle** (the load-bearing
sentence of ADR-0018 §3/§6: *"correctness does not depend on the lock — the DB unique key does"*): an idempotency key
carried in durable data + a **DB UNIQUE constraint** + "on conflict, return the existing effect (no-op)".

- **The key that unifies webhook + poll = the MP `authorized_payment.id`** (stable per charge). Both paths resolve to
  it by lookup, both `INSERT ... ON CONFLICT DO NOTHING` into `billing_events`; a conflict means the grant already
  exists → no-op. This is *why* §4's poll can't double-grant.
- **Grant-writing events** (payments, refunds/chargebacks) go through the inbox (exactly-once). **Subscription status
  mirroring** (authorized/paused/cancelled) is a naturally-idempotent UPSERT keyed on `mp_preapproval_id` — mirroring
  the latest looked-up status has no double-effect, so it needs no inbox row.
- **Rejected alternative** — key the UNIQUE on the *ledger grant* directly (no inbox): insufficient, because non-grant
  events (cancel/refund) also need idempotency + an audit trail, and the ledger must stay the generic ADR-0012 shape
  (beta|comp|payment) without an MP-payment-id column polluting it.

## 4. Reconciliation poll

- **What it queries:** for each non-terminal subscription, `GET /preapproval/{id}` (status) + recent
  `authorized_payments`, feeding each into **the same processing function the webhook calls** (one code path past the
  lookup). Convergence is structural, not coordinated: shared key (§3) ⇒ a healed miss and a duplicate both collapse to
  one grant.
- **Cadence:** recommend ~every 6–12 h + an on-demand trigger; confirmed at plan with MP's retry cadence.
- **Dev vs deploy posture (owner Q3, deploy-deferral intact):** built as an invokable runner
  `app.scripts.reconcile_subscriptions` (the `grant_premium.py` CLI pattern) — run by hand in dev (no scheduler);
  wired to Cloud Scheduler → a Cloud Run job at the v1 deploy. This is the resilience layer that makes a missed
  webhook (tunnel down, MP outage) never strand a paid seller (US3.5) without requiring a live prod endpoint during E6.

## 5. Webhook endpoint design

- **Route:** `POST /api/v1/billing/webhook/mercadopago` — **public** (no `current_claims`; MP carries no Firebase
  token). It is the codebase's **first signature-authenticated route** — a genuinely new route class (today every
  product route is Firebase-gated; only `/health` + `fee_catalog` are open, and those are read-only reference data).
- **Verification seam (I own placement; crypto → seguranca's round):** a dependency that runs **before any DB touch**
  → verify `x-signature` HMAC (`ts=…,v1=…`) with the **environment's** `P3D_MP_WEBHOOK_SECRET` → then **look the
  resource up** against MP → only the looked-up state may write. Bad/absent signature ⇒ reject, grant nothing
  (SC-702, US3.4). Return 200 fast; process idempotently (MP retries non-2xx).
- **Env separation — a sandbox event can NEVER write a prod grant (defence in depth):**
  1. per-environment webhook secret + access token (Settings SecretStr) — a sandbox-signed notification fails HMAC
     against prod's secret;
  2. **and** assert the notification's `live_mode` matches `app_env` (`prod ⇒ true`, sandbox ⇒ `false`) — reject on
     mismatch. Two independent guards; either alone would suffice, both together are the SC-711-adjacent guarantee.
- **Dev/tunnel:** the dev tunnel exposes the route to MP **sandbox**; the **live** webhook is validated **at** the v1
  deploy (owner Q3). Reconciliation (§4) covers any interval the tunnel is down.

## 6. Play-Billing flag architecture

- **Where the flag lives:** **server-side config** — `P3D_PLAY_BILLING_ENABLED: bool = False` in `settings.py`
  (env-driven, never a client flag — Constitution IV). OFF in every E6 environment; the OFF state is itself
  acceptance-tested (SC-711).
- **Shared writer seam:** a thin `PaymentProvider` abstraction whose sole output is a *normalised verified payment
  event* `(subscription, event_key, period_end, kind)`. MP and Play are two implementations; **both terminate in one
  `grant_writer`** (writes the `source=payment` grant + the inbox row). `subscriptions.provider` records the store; the
  grant is provider-agnostic (`source=payment` for both). This is what makes "Play shares the grant writer with MP"
  concrete rather than aspirational.
- **What "sandbox-validated behind OFF flag" means structurally in E6:** the Play provider (purchase-token verify vs
  the Google Play Developer API → normalised event → same writer) is **implemented and tested against Play internal
  testing**, but its checkout-initiation + RTDN routes are **flag-gated** (disabled/404 when OFF); E6 asserts no Play
  surface is reachable. A sandbox Play purchase reaching the shared writer is **evidence recorded for the E7 gate**.
- **What the E7 turn-on gate needs:** flip the flag + the packaged Android app (E7) + a live RTDN endpoint + Play's own
  seguranca review. Play is **not** folded into MP's verify path — separate provider, separate review, same terminus.

## 7. Client surface

| Concern | Endpoint | Auth | Note |
|---------|----------|------|------|
| Checkout initiation | `POST /api/v1/billing/checkout {period}` → `{initPoint}` | `current_claims` only (free seller subscribes) | FR-702 sign-in required; no anonymous subscription |
| Premium-on refresh | `GET /api/v1/entitlement` (**existing, unchanged**) | `current_claims` | SC-701 flip within ≤1 refresh; no re-login |
| Conta plan-state | `GET /api/v1/billing/subscription` (**new**) → `{plan,status,currentPeriodEnd,cancelAtPeriodEnd,graceUntil?}` | `current_claims` | server+PSP truth (SC-708) |
| Cancel | `POST /api/v1/billing/subscription/cancel` | `current_claims` | at paid-period end (Q10); grant expiry untouched → natural lapse |

**Extend `/entitlement` vs new endpoint — decision: new endpoint** (three options weighed). (a) *extend
`/entitlement`* — keeps one call but bloats the hot, generic gate answer with PSP detail that beta/comp accounts don't
have; (b) *new `GET /billing/subscription`* ✅ — clean separation, entitlement stays lean, billing detail is a distinct
PSP-sourced concern; (c) *both merged into one billing endpoint* — would duplicate the entitlement status already
served. Conta calls **both** and prioritises the subscription state when one exists (2026-07-20 clarification / FR-709);
active while ANY valid grant exists; a courtesy grant is never revoked by subscribing.

- **Grace (FR-708):** on a verified failed renewal, cover `max(MP retry cadence, 7d)` (keep the account active) + mark
  the subscription grace/pending; Conta shows the honest "pagamento pendente — regularize até {data}". Lapse only on
  grace exhaustion (an expiry-driven lapse — ADR-0012 verbatim). MP's cadence confirmed at plan.
- **Refund/chargeback (FR-711):** verified event → inbox row + ledger **revoke** on the active payment grant →
  immediate lapse; idempotent, auditable, append-only (no physical delete).

## 8. `pricing-core` untouched · FSD-Lite placement

- **`pricing-core` NOT touched (~97%).** Billing is orthogonal to the pricing formula; no billing path calls
  `computeCalculator`/`computeBom`; no version bump (stays `3.1.0`). Confirm at plan, expect no change (brief §9.6).
- **FE:** new `apps/web/src/features/billing/` (plan/price surface, checkout initiation, Conta plan-panel data, the
  shared **Assinar** CTA). Entitlement state stays in `entities/user`. The four teasers
  (`features/{catalog/premium-teaser,bom/bom-teaser,history/history-teaser,scenarios/scenario-teaser}.tsx`) import the
  shared CTA (FR-710) — real price, working path, no false urgency, no fabricated number. FSD-Lite boundaries hold
  (features → entities → shared).
- **BE:** new `app.billing` package (`checkout` service · `providers/` MP + flag-gated Play · shared `grant_writer` ·
  `webhook` route · `reconcile` runner) + `app.api.billing`. `app.billing` joins the import-linter contracts.

## 9. Constitution check + risks/trade-offs

**Constitution.**
- **IV (server-authoritative) — PASS.** A grant is written **only** by a server-verified event (signature + lookup);
  the client never asserts entitlement (checkout only starts; the webhook is verify-by-lookup; Option C's trust-the-body
  was rejected on this principle). The Play flag is server-side config, not a client flag.
- **II (honesty) — PASS.** Real prices only (15,99 / 155,88), no fake anchor; honest pending/grace/canceled copy; no
  fake-active, no silent lapse; MP-cadence + SDK-version + Q9-fiscal are **flagged, not fabricated** (confidence marked
  throughout; ADR-0023 §Sources verified against official MP docs).
- **VIII (no inference) — PASS.** The integration shape, schema, idempotency mechanism, webhook seam, env isolation,
  Play-flag architecture, and client surface are **decided** in ADR-0023 (≥3 options each, confidence), owner-ratified
  at the PR-A gate — not inferred. The two genuinely undecided points (MP retry cadence for the grace `max()`; the
  fiscal-receipt sufficiency Q9) are surfaced and routed, never defaulted.
- **V (clean architecture) — PASS.** Reuses the ADR-0012 ledger verbatim as a new writer; the shared `grant_writer`
  prevents an MP/Play duplication; no dead code (the operator CLI is deliberately not widened; no phantom ErrorCode).
- **I (scalability) — PASS.** One writer, one ledger, one idempotency key across both confirmation paths; Play slots in
  behind the same seam; Cloud SQL/Cloud Run portable (ADR-0013).

**Risks / trade-offs.**

| # | Risk | Severity | Mitigation | Confidence |
|---|------|----------|------------|------------|
| R1 | Webhook body spoof/replay grants premium (Constitution IV breach) | Critical | Verify-by-lookup (never trust body) + `x-signature` HMAC + inbox idempotency; seguranca mandatory on PR-A | 88% mitigated |
| R2 | Sandbox event writes a prod grant | High | Per-env secret+token **and** `live_mode`↔`app_env` assert (two independent guards) | 90% |
| R3 | Missed/duplicated webhook strands or double-grants a paid seller | High | Reconciliation poll unified with webhook on the shared `authorized_payment.id` key; DB UNIQUE = exactly-once | 85% |
| R4 | Grace `max(cadence,7d)` mis-set → premature lapse of a good payer | Medium | Confirm MP's real retry cadence at plan; expiry favours the paying seller on clock skew (spec edge case) | 70% |
| R5 | Cancel cuts premium early or deletes data | Medium | Cancel = MP preapproval cancel only; grant expiry untouched → natural lapse; 0 rows deleted (SC-704) | 90% |
| R6 | Money/entitlement schema error by a cheap executor | High | ADR-0022 opus-escalation on migration `0005`; append-only + CHECK-guarded | 85% |
| R7 | Fiscal receipt (Q9) legally insufficient at launch | Medium | Provisional (MP receipt) + routed to accountant/compliance — **launch** blocker, not code blocker | flagged (~55%) |
| R8 | Play flag leaks a surface in E6 | Medium | Server-side flag OFF, routes flag-gated, OFF state acceptance-tested (SC-711) | 85% |
| R9 | New MP SDK version drift / unpinned dependency | Low-Med | Pin-not-assume (ADR-0020 lesson); verify SDK version at implementation | 80% |

**Routed onward:** seguranca's round owns the `x-signature` HMAC manifest, secret storage/rotation, the LGPD
payer-data map, deny-by-default tests; the plan round owns MP retry cadence (grace), poll cadence, MP SDK-vs-httpx +
version pin, and the `subscriptions`/`billing_events` DDL in `data-model.md` (migration `0005`, opus-escalated); the
Play provider gets its own ADR + review at E7.
