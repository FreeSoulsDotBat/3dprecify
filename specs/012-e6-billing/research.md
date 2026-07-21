# E6 — Phase 0 research (consolidated from the 2026-07-20 two-specialist round + ADR-0023)

> Method: the architecture round ran as 2 parallel opus specialists (arquiteto → `arquiteto-round.md` +
> ADR-0023 draft; seguranca → `seguranca-round.md`), the E4/E5 rite. This file consolidates the DECISIONS;
> rationale + ≥3 options + confidence live in ADR-0023 and the round docs (not duplicated here —
> Constitution VI).

## D1 — MP integration shape → `preapproval` + 2 `preapproval_plan`s, hosted `init_point` (82%)

- Recurring in Brazil = the preapproval family; a pending `preapproval` returns `init_point` (MP-hosted
  checkout; Pix + card + account money are MP's surface). Card data never touches the backend (SC-706).
- Two plans: monthly R$ 15,99 · annual **one charge** R$ 155,88/yr (clarified 2026-07-20) — plan-linked so a
  price change is one plan edit + one product constant, never per-checkout risk.
- Persisted PSP references only: `mp_preapproval_id`, `status`, `plan_period`, `current_period_end`,
  `payer_ref`, `provider`.
- Verified sources: MP official docs (subscriptions overview · webhooks · x-signature), listed in ADR-0023
  §Sources, fetched 2026-07-20.

## D2 — Confirmation = verify-then-lookup, never trust-the-body (Constitution IV)

- A webhook (or the poll) yields only a resource id; the server then `GET /preapproval/{id}` /
  `GET /authorized_payments/{id}` and acts on the **looked-up** state. A forged/replayed body is inert.
- Webhook authenticity: MP `x-signature` (`ts=…,v1=<hmac-sha256>` over the `id:<data.id>;request-id:…;ts:…;`
  manifest, with the `data.id` lowercase quirk) — constant-time compare, per-env secret, freshness window.
  Details + testable invariants: `seguranca-round.md` SEC-101..106.

## D3 — Idempotency = ADR-0018's PRINCIPLE, a new server-side inbox as the mechanism

- Not the ADR-0018 machinery (client-side IndexedDB outbox — wrong layer). Its load-bearing principle stands:
  durable idempotency key + **DB UNIQUE** + on-conflict-no-op.
- The unifying key = MP `authorized_payment.id`; webhook and poll both resolve to it by lookup and both
  `INSERT ... ON CONFLICT DO NOTHING` into `billing_events` → structurally exactly-once, no double-grant
  (SC-703). Status mirroring (authorized/paused/cancelled) is an idempotent UPSERT, no inbox row needed.

## D4 — Reconciliation poll = same processing function as the webhook, invokable runner

- `app.scripts.reconcile_subscriptions` (the `grant_premium.py` CLI pattern): manual in dev (no scheduler),
  Cloud Scheduler → Cloud Run job at the v1 deploy (owner Q3 — deploy deferral intact). Cadence ~6–12 h +
  on-demand; exact value set with MP's retry cadence in hand.
- A missed webhook (tunnel down, MP outage) heals on the next poll; the shared key makes heal-vs-duplicate
  collapse to one grant (US3.5).

## D5 — The webhook route: the codebase's FIRST public signature-authenticated route (explicit exception)

- `POST /api/v1/billing/webhook/mercadopago` — no `current_claims` (MP carries no Firebase token). The
  uniform "every product route authenticates via Firebase" invariant gains ONE explicit, ADR-recorded
  exception (seguranca D1) — signature verification runs BEFORE any DB touch, then lookup, then write.
- Sandbox↔prod isolation, two independent guards: per-env HMAC secret + access token (sandbox signature
  fails against prod's secret) AND `live_mode`↔`app_env` assert (reject on mismatch).

## D6 — Grace = an APPEND-ONLY grace grant (resolves the seguranca D7 tension)

- FR-708 requires premium active past the paid period while MP retries; the ledger derivation
  (`active = ¬revoked ∧ (expiry null ∨ now<expiry)`) must not change (SC-709).
- Mechanism: on a verified failed renewal, the writer appends ONE grace grant (`source=payment`,
  `subscription_id` set, `expires_at = period_end + max(MP retry cadence, 7 days)`) and marks the
  subscription grace/pending. Recovery writes the real period grant; exhaustion = natural expiry-driven
  lapse. Zero mutation, zero derivation change — ADR-0012 verbatim.
- **Flagged unknown**: MP's actual retry cadence — confirmed at implementation start; the `max()` floor (7d)
  is the owner-clarified guarantee either way.

## D7 — Refund/chargeback = inbox row + ledger REVOKE on the active payment grant

- Immediate lapse, append-only (`revoked_at`), idempotent, auditable (SC-710); courtesy grants untouched.

## D8 — Client surface: 4 authenticated routes + entitlement reuse

- `POST /billing/checkout {period}` → `{initPoint}` · `GET /billing/subscription` (NEW — Conta detail;
  extending `/entitlement` rejected: keeps the hot gate answer lean) · `POST /billing/subscription/cancel`
  (period-end semantics) · `GET /api/v1/entitlement` REUSED unchanged for the premium flip (SC-701).
- Conta calls both; subscription state wins the display when present (2026-07-20 clarification); active
  while ANY valid grant exists; subscribing never revokes a courtesy grant.

## D9 — Play Billing flag-readiness: shared `grant_writer`, server-side flag OFF

- `P3D_PLAY_BILLING_ENABLED=False` (settings, env-driven — never a client flag). The `PaymentProvider` seam
  normalises a verified event `(subscription, event_key, period_end, kind)`; MP and Play both terminate in
  the ONE `grant_writer`. Play's routes are flag-gated (404/disabled when OFF) — OFF asserted server-side in
  E6 (SC-711); a Play internal-testing purchase reaching the shared writer is the recorded E7-gate evidence.
- E7 turn-on needs: flag flip + packaged app + live RTDN endpoint + Play's own seguranca review (its own ADR).

## D10 — Unresolved-by-design (flagged, routed, never defaulted)

| Item | Routed to | Nature |
|---|---|---|
| MP retry cadence (grace `max()` implementation) | implementation start (verify against MP docs/sandbox) | fact to fetch |
| MP server SDK vs httpx + exact version PIN | implementation start (ADR-0020 pinned-not-assumed lesson) | fact to fetch |
| Q9 fiscal-receipt sufficiency | owner + accountant/compliance | LAUNCH blocker, not code blocker |
| Poll exact cadence | set with MP cadence in hand | tuning |
