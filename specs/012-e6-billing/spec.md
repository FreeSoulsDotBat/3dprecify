# Feature Specification: E6 — Billing: the purchase turnstile (Mercado Pago recurring end-to-end + Play Billing flag-ready)

**Feature Branch**: `feature/012-e6-billing`

**Created**: 2026-07-20

**Status**: Draft

**Input**: User description: "E6 — Billing: the purchase turnstile (Mercado Pago recurring end-to-end + Play
Billing flag-ready). Source of truth: docs/product/e6-scope-brief.md INCLUDING the §0 owner decision session
2026-07-20. The grant is the terminus: a server-verified payment event writes a source=payment row into the
ADR-0012 entitlement ledger — no new entitlement mechanism, a new WRITER only; lapse routes to the shipped
read-only freeze (E2/E4/E5)."

> **Authority chain**: `docs/product/e6-scope-brief.md` (kickoff + §0 owner decision session 2026-07-20) →
> this spec → `/speckit-clarify` → plan + the payments ADR (numbered at the plan round, not here).
> **The centerpiece**: E6 creates **no new seller-facing object**. It attaches a *verified payment event* to
> the **front** of the entitlement machine E2 already runs (append-only ledger, per-request check, instant
> propagation, lapse freeze) — a new **writer** (`source=payment`), never a new mechanism.

## Clarifications

### Session 2026-07-21 (owner decisions — the 9 UX flags + the delivery re-sequencing)

- Q: ux-billing §10 flags F1–F9 → A: **F1/F2/F3/F5/F7/F8/F9 accepted as recommended.** Two owner-shaped:
  - **F4 (cancel)**: the ONLY cancel affordance lives in the **Conta screen**; its label is EXPLICIT that
    it cancels the subscription; clicking prompts a **confirm modal** asking if the seller is sure and
    alerting that **the cancellation only takes effect from the next charge** (premium stays active until
    the paid-period end — FR-707 unchanged).
  - **F6 (abandoned-checkout linger)**: recommendation accepted WITH the constraint that **the seller never
    sees "409" or any status-code/technical jargon** — the copy is plain honest language only.
- Q: delivery sequencing vs provisioning → A: **Owner strategy 2026-07-21 — build-first, provision-later.**
  ALL provisioning-independent work ships first (PR-A/PR-B/PR-C code, mobile 390px + desktop, with the MP
  client mocked in unit tests and a **local MP stub** powering e2e + visual homologation); then the owner
  runs an **intensive manual homologation of the whole platform** (code + UX/UI, point by point); ONLY
  after it passes: MP sandbox provisioning (T002), real payment testing, and **infrastructure provisioning
  on GCP** (the v1 deploy trigger of the 2026-07-09 rule — consistent, now owner-scheduled). The live
  webhook validation stays at that phase (Q3 unchanged).

### Session 2026-07-20 (`/speckit-clarify`)

- Q: How does the ANNUAL plan charge ("R$ 12,99/mês if annual")? → A: **One MP annual subscription charging
  R$ 155,88 once per year**; the surface presents it honestly as "equivalente a R$ 12,99/mês". Renewal,
  grace and refund operate over the single yearly event.
- Q: Grace-window FLOOR on a failed renewal? → A: **7 days** — lapse only after max(MP's retry cadence,
  7 days); a legitimate payer with an expired card gets a humane window regardless of MP's schedule.
- Q: Operator grant (beta/comp) coexisting with a PAID subscription on the same account? → A: **Any valid
  grant activates (ledger semantics unchanged); Conta prioritizes showing the SUBSCRIPTION state when one
  exists** (it is what the seller manages/pays), else the courtesy grant; lapse only when NO grant is valid.
  Subscribing never revokes a courtesy grant; a courtesy account is never blocked from subscribing.

### Session 2026-07-20 (owner decisions at kickoff, reacting to the scope brief — pre-specify)

- Q: Q1 — the R$ prices → A: **Provisional anchor SET (option b)**: **R$ 15,99/mês** monthly ·
  **R$ 12,99/mês billed annually** (= R$ 155,88/yr, ~19% discount). Adjust-post-launch allowed; WTP caveat
  (~55%) stands; any change is a dated decision, never silent.
- Q: Q2 — MP-only vs +Play Billing → A: **"Both in CODE"**: MP recurring ships **end-to-end** in E6; the
  **Play Billing integration is BUILT and sandbox/internal-testing-validated behind a flag** in E6 and
  **turns ON at E7** when the packaged app publishes. E7 keeps its place; packaging does NOT enter E6.
- Q: Q3 — webhook×deploy tension → A: **(a)+(c)**: all E6 dev/test against **MP sandbox + a dev tunnel**;
  the LIVE webhook is validated **at the v1 deploy**; **polling reconciliation is built as a resilience
  layer** (missed/duplicated webhook deliveries never strand a paid seller). The 2026-07-09 deploy deferral
  stays INTACT.
- Q: Q4–Q11 → A: the 8 PO recommendations accepted as **working defaults** (re-questionable at clarify):
  mechanical chargeback handling (US8 floor stays even if policy is manual) · grace aligned to **MP's retry
  cadence** with a humane floor · **no proration** (plan change takes effect at renewal) · **no trial** ·
  **no coupons** · MP receipt **provisionally** sufficient — **Q9 stays FLAGGED for accountant/compliance
  verification, not decided** · cancel takes effect at **paid-period end** · "Assinar" lives in **Conta** and
  is reachable from **every** premium teaser (final IA/flow → designer-ux + owner).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Present the plan and the real price (Priority: P1)

A free, signed-out, or lapsed seller who hits any premium wall sees the **actual** subscription offer for the
first time in the product's life: R$ 15,99/mês monthly or R$ 12,99/mês billed annually, what premium unlocks,
and a **working** "Assinar" affordance. The annual discount is framed honestly (the real delta — never a fake
"de/por" anchor).

**Why this priority**: the offer surface is the epic's front door; without it no other story is reachable.

**Independent Test**: open any premium teaser as a free seller → the plan surface shows both real prices and a
live checkout CTA; signed-out → sign-in is required before any payment starts.

**Acceptance Scenarios**:

1. **Given** a free/lapsed seller on any premium teaser, **When** the plan surface opens, **Then** it shows
   the real monthly (R$ 15,99/mês) and annual (R$ 12,99/mês, billed yearly) prices with the discount stated
   truthfully, and a real checkout CTA.
2. **Given** a signed-out seller, **When** they choose to subscribe, **Then** sign-in is required before any
   payment is initiated (entitlement is per-account; no anonymous subscription).
3. **Given** the price pair changes later (owner decision), **When** the surface renders, **Then** it shows
   only the currently-decided prices — no stale or fabricated number, ever.

---

### User Story 2 - Check out via a Mercado Pago recurring subscription (Priority: P1)

The signed-in seller picks monthly or annual; a Mercado Pago **recurring subscription** is created for that
period and the seller completes payment on MP's hosted surface (payment methods are MP's own). The product's
backend **never sees or stores card data** — it keeps only PSP references.

**Why this priority**: the paid path itself; with US3 it forms the epic's spine.

**Independent Test**: complete a sandbox checkout → an MP subscription exists with the chosen period; abandon
a checkout → no entitlement, no ghost "pendente premium" state.

**Acceptance Scenarios**:

1. **Given** a signed-in seller choosing monthly or annual, **When** they proceed, **Then** an MP recurring
   subscription is created for that period and the seller reaches MP's hosted checkout; only PSP references
   are stored, never card/PAN/CVV data.
2. **Given** the seller abandons checkout, **When** they return, **Then** no entitlement was granted and no
   partial state remains — an abandoned checkout is indistinguishable from never having started.
3. **Given** a manipulated client asserting a "paid" state, **When** it reaches the server, **Then** nothing
   is granted — entitlement waits for a verified payment event (US3), never a client claim.

---

### User Story 3 - Verified confirmation → automatic grant → premium live, no re-login (Priority: P1) **[FOUNDATIONAL]**

The terminus. MP confirms the charge (webhook and/or reconciliation poll); the **server verifies** the event
and writes exactly one `source=payment` grant into the existing entitlement ledger with the paid period's
expiry; premium turns on within the existing propagation window — **no re-login, no operator, no reinstall**.

**Why this priority**: a checkout without a verified terminus is not just valueless — it is a security
liability. This story is why the epic exists.

**Independent Test**: complete a sandbox payment → within one entitlement refresh every E2–E5 premium surface
unlocks; replay the same event N times → exactly one grant; send an unverifiable event → rejected, nothing
granted.

**Acceptance Scenarios**:

1. **Given** a completed MP payment, **When** the server receives and verifies the event (signature/lookup),
   **Then** exactly one append-only ledger grant is written (`source=payment`, expiry = paid-period end) and
   the entitlement check returns active.
2. **Given** the grant is written, **When** the client refreshes its entitlement (≤1 session/token-refresh
   window), **Then** every E2–E5 premium surface unlocks without re-login.
3. **Given** the same MP event delivered N times, **When** processed, **Then** exactly one grant/state change
   results — processing is idempotent.
4. **Given** an event the server cannot verify (bad/absent signature, unknown subscription), **When**
   received, **Then** it is rejected and grants nothing.
5. **Given** a webhook delivery was missed entirely, **When** the reconciliation poll next runs, **Then** the
   paid seller's grant is written from the server-side lookup — a lost webhook never strands a paid seller.

---

### User Story 4 - Cancel; lapse to the read-only freeze at period end (Priority: P1)

A paying seller cancels self-service. Premium persists to the **paid-period end** (they paid for it — owner
Q10), then the ledger expiry lapses them into the **existing** E2/E4/E5 read-only freeze. Nothing is deleted;
re-subscribing restores writes with all data intact.

**Why this priority**: the reverse loop is half the honesty contract; a cancel that deletes or cuts off early
is hostile and refund-inviting.

**Independent Test**: cancel an active sandbox subscription → status shows "ativo até {data}, não renova";
force-expire → reads survive, writes 403, 0 rows deleted; re-subscribe → writes restore, data intact.

**Acceptance Scenarios**:

1. **Given** an active seller, **When** they cancel, **Then** premium remains active until the paid-period
   end and the plan surface honestly shows "ativo até {data}, não renova"; no data is touched.
2. **Given** the paid period ends after cancellation, **When** the grant expires, **Then** the account lapses
   to the existing read-only freeze (reads/recompute survive, writes denied, 0 data deleted).
3. **Given** a lapsed-by-cancellation seller, **When** they re-subscribe, **Then** writes restore with all
   prior data intact — the same re-grant path E2–E5 already exercise.

---

### User Story 5 - Payment failure, dunning, grace → honest eventual lapse (Priority: P2)

A renewal charge fails. The account enters a **grace window** (aligned to MP's retry cadence, with a humane
floor — owner Q5 default) during which premium stays active and the seller is honestly told "pagamento
pendente — regularize até {data}". Recovery keeps them continuously active; exhaustion lapses them into the
freeze with an honest explanation. No silent lapse; no fake-active.

**Why this priority**: P2 — the epic ships without it only in sandbox terms; real billing meets failed cards
immediately, so it must land in the same epic.

**Independent Test**: simulate a failed renewal in sandbox → grace state visible + honest copy; simulate
recovery → continuous active; simulate exhaustion → freeze + honest reason.

**Acceptance Scenarios**:

1. **Given** a failed renewal charge, **When** it fails, **Then** the account enters grace with premium still
   active and the plan surface shows the honest pending state — never a fake "tudo certo".
2. **Given** MP recovers the charge within grace, **When** the success event verifies, **Then** the account
   stays continuously active with no seller-visible interruption.
3. **Given** grace exhausts without recovery, **When** the window closes, **Then** the account lapses to the
   read-only freeze, nothing deleted, and the seller is told honestly why.

---

### User Story 6 - The Conta/plan surface: true billing state, server-sourced (Priority: P2)

Conta becomes the seller's billing home: current plan (monthly/annual) + period, renewal or expiry date,
manage/cancel entry, and the grace/pending state — all sourced from the server + PSP truth, never
client-guessed or optimistic.

**Why this priority**: P2 — every state US3–US5 create must be visible somewhere honest.

**Independent Test**: for each billing state (active / grace / pending / canceled / lapsed) the Conta surface
matches the ledger + PSP truth exactly.

**Acceptance Scenarios**:

1. **Given** an active seller, **When** they open Conta, **Then** they see plan, status, and the next renewal
   (or "não renova até {data}") matching server truth.
2. **Given** any billing state, **When** rendered, **Then** the copy is honest and server-sourced — no
   client-inferred billing state is ever shown.
3. **Given** the seller wants to cancel or update payment, **When** they choose it, **Then** the action
   routes to the correct MP-managed flow.

---

### User Story 7 - Every pre-E6 teaser becomes a real, accurate upgrade CTA (Priority: P2)

The honest "no price, no date" notices scattered across catalog, kits, histórico and cenários (the E2 US7 /
E3 US5 / E4 US5 / E5 US5 lineage) **light up** into real "Assinar" entry points leading to US1→US2, showing
the real price. The CTA makes no false urgency and no unverifiable claim.

**Why this priority**: P2 — conversion surface; the epic's spine works without it, but the product stays
incoherent if walls advertise a door that exists and don't point to it.

**Independent Test**: every premium teaser across E2–E5 surfaces shows the real price and a working "Assinar"
path; the honesty regex sweep (no fabricated numbers, no false urgency) passes on every teaser.

**Acceptance Scenarios**:

1. **Given** any premium teaser across E2–E5, **When** E6 ships, **Then** it shows the real price and a
   working "Assinar" CTA leading to checkout — replacing the pre-E6 dead-end.
2. **Given** the conversion CTA, **When** reviewed, **Then** it makes no false urgency and no unverifiable
   claim — honest value, real price, real availability.

---

### User Story 8 - Refund / chargeback mechanical handling (Priority: P3 — DROPPABLE, mechanics-floor kept)

When MP reports a refund or chargeback, the entitlement resolves **honestly and idempotently** to the correct
state (typically → lapse/freeze), recorded append-only and auditable. The **policy** is the owner's (Q4
default: mechanical handling + manual review, no proactive refund window in v1); this story is the mechanics
of whatever MP reports.

**Why this priority**: P3 droppable — but cut the *policy surface* before the *mechanics*: an unhandled
chargeback that silently leaves premium on is an entitlement-integrity hole.

**Independent Test**: simulate an MP refund/chargeback event in sandbox → entitlement resolves to the correct
state, ledger records it append-only, replay is idempotent.

**Acceptance Scenarios**:

1. **Given** MP reports a refund/chargeback for a subscription, **When** the server verifies the event,
   **Then** the entitlement resolves per policy (append-only revoke/expiry, never a physical delete) and
   processing is idempotent.

---

### Play Billing flag-readiness (owner Q2 shape — cross-cutting, not a seller-visible story in E6)

The Play Billing integration is **built in E6** to the extent provable without a published app: the purchase
→ verify → `source=payment` grant path implemented against Play's **sandbox/internal-testing** environment,
kept **behind a flag that stays OFF** in every E6 surface. It turns ON at E7 when the packaged app publishes.
No E6 seller ever sees a Play surface; the flag's OFF state is itself acceptance-tested.

**Acceptance Scenarios**:

1. **Given** E6 ships, **When** any seller uses the product, **Then** no Play Billing surface is reachable
   (flag OFF, asserted).
2. **Given** the internal-testing environment, **When** a sandbox Play purchase completes, **Then** the same
   verified-event → grant terminus fires (evidence recorded for the E7 turn-on gate).

---

### Edge Cases

- Webhook arrives **before** the client returns from MP checkout → grant exists on first entitlement refresh;
  no "pending" flicker into a lie.
- Webhook never arrives (tunnel down, MP outage) → the reconciliation poll writes the grant; the paid seller
  is never stranded (US3.5).
- The same seller starts checkout twice (double-click, two tabs) → at most one active subscription; no double
  charge path the product creates.
- A seller with an operator grant (`beta`/`comp`) subscribes → both grants stand (append-only, nothing
  revoked); Conta shows the subscription's state; active while any valid grant exists (clarified 2026-07-20).
- Renewal event for an already-expired grace account (late MP retry succeeds after lapse) → account
  reactivates honestly (a new period grant), no data loss either way.
- Clock skew between MP's period end and the ledger's `expires_at` → the seller never loses paid time; the
  grace/expiry boundary favors the paying seller.
- A chargeback arrives for a period already lapsed → idempotent no-op beyond audit record.
- Sandbox↔production credential separation → a sandbox event can never write a production grant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-701**: The plan surface MUST present the decided prices — R$ 15,99/mês monthly · annual as **one
  charge of R$ 155,88/ano**, presented honestly as "equivalente a R$ 12,99/mês" — with the discount stated
  truthfully; no other number may ever be shown (no placeholders, no fake anchors). A price change is a dated
  owner decision reflected everywhere at once.
- **FR-702**: Subscribing MUST require an authenticated account before any payment initiates; entitlement is
  per-account (no anonymous or transferable subscription in v1).
- **FR-703**: Checkout MUST create a Mercado Pago **recurring** subscription for the chosen period on MP's
  hosted payment surface; the product MUST NOT see, transmit, or store card/PAN/CVV data — only PSP
  references (subscription id, status) plus the minimum payer identifier.
- **FR-704**: Entitlement MUST be granted **only** by a server-verified payment event (signature verification
  and/or server-side lookup against MP); a client claim of payment grants nothing. Every grant is one
  append-only ledger row with `source=payment` and expiry at the paid-period end — the existing entitlement
  mechanism gains a new writer, nothing else.
- **FR-705**: Payment/subscription event processing MUST be idempotent: the same event delivered N times
  produces exactly one grant/state change.
- **FR-706**: A **reconciliation poll** MUST exist as a resilience layer: a missed/duplicated webhook never
  strands a paid seller and never double-grants (owner Q3). All E6 dev/test runs against MP sandbox + a dev
  tunnel; the live webhook is validated at the v1 deploy; the 2026-07-09 deploy deferral stands.
- **FR-707**: Cancellation MUST keep premium active until the paid-period end, then lapse the account into
  the existing read-only freeze (reads/recompute survive; writes denied; zero data deleted). Re-subscribing
  restores writes with all data intact. The freeze semantics themselves MUST NOT change.
- **FR-708**: A failed renewal MUST enter a grace window of **max(MP's retry cadence, 7 days)**; the seller
  MUST see the honest pending state; lapse happens only on grace exhaustion; recovery within grace is
  seamless.
- **FR-709**: The Conta surface MUST show the server-sourced billing truth for every state (active / grace /
  pending / canceled / lapsed): plan, period, renewal/expiry date, and manage/cancel entry routing to the
  MP-managed flow. No client-inferred billing state may render. When an operator grant and a paid
  subscription coexist, Conta prioritizes the subscription's state; the account is active while ANY valid
  grant exists (existing ledger semantics unchanged); subscribing never revokes a courtesy grant.
- **FR-710**: Every pre-E6 premium teaser MUST become a real upgrade CTA (real price, working "Assinar" path,
  reachable from every teaser and from Conta); the CTA copy passes the honesty bar (no false urgency, no
  unverifiable claim).
- **FR-711**: Refund/chargeback events reported by MP MUST resolve the entitlement to the correct state
  mechanically, append-only and idempotent (US8; the mechanics-floor survives even if the story's policy
  surface is cut).
- **FR-712**: The Play Billing integration MUST be built and validated against Play's sandbox/internal
  testing behind a flag that is OFF for all E6 sellers (asserted); the flag turns on at E7. Play's
  verified-purchase path terminates in the same grant machinery.
- **FR-713**: No mid-cycle plan switching in v1 (change takes effect at renewal); no trial; no coupons; no
  fiscal document issuance (MP's receipt stands **provisionally** — flagged for accountant verification, not
  decided); single premium tier unchanged.
- **FR-714**: All E1–E5 guarantees MUST hold unchanged: the free calculator, every premium gate, the lapse
  freeze, snapshot immutability, kit/scenario D3/D6 — E6 wires the purchase and alters no gated feature.

### Key Entities

- **Subscription (PSP reference)**: the product's record of an MP recurring subscription — PSP subscription
  id, plan period (monthly/annual), status, period boundaries; never card data. Links a seller account to its
  payment lifecycle.
- **Payment event**: a verified occurrence reported by the PSP (payment confirmed, renewal, failure, cancel,
  refund/chargeback) — the only thing that may write billing-sourced entitlement changes; idempotency-keyed
  by the PSP event identity.
- **Entitlement grant (existing, extended)**: the append-only ledger row of ADR-0012 — gains `source=payment`
  alongside `beta|comp`; carries expiry at paid-period end. The mechanism (per-request check, propagation,
  lapse) is reused verbatim.
- **Plan/price pair**: the single premium tier's two decided prices (monthly R$ 15,99 · annual R$ 12,99/mês);
  a product-level fact, owner-changeable by dated decision only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-701**: A free/lapsed seller completes checkout and gains premium **without re-login** within one
  entitlement-refresh window of the server-verified payment event; a `source=payment` grant exists.
- **SC-702**: 100% of `source=payment` grants originate from a server-verified payment event; any client
  spoof/replay grants nothing.
- **SC-703**: Event processing is idempotent — the same event delivered N times produces exactly one
  grant/state change; a missed webhook is healed by reconciliation with the same exactly-once outcome.
- **SC-704**: On cancellation, premium persists to the paid-period end, then lapses to the existing read-only
  freeze with **0** rows of seller data deleted; re-subscribe restores writes with all data intact.
- **SC-705**: On a failed renewal, the account enters the grace window with premium active and honest seller
  notice; lapse occurs only on grace exhaustion — no silent lapse, no fake-active, no seller-visible
  interruption on in-grace recovery.
- **SC-706**: The product never stores or transmits card/PAN/CVV data on any billing path; only PSP
  references + the minimum payer identifier are persisted (billing-data minimisation).
- **SC-707**: The plan surface and every teaser show only the real decided prices (15,99 / 12,99) — no
  fabricated, stale, or placeholder number anywhere, ever.
- **SC-708**: Every rendered billing state matches the server-authoritative ledger + PSP truth; zero
  client-inferred billing states.
- **SC-709**: All E1–E5 acceptance guarantees pass unchanged (the full existing suites stay green); E6 alters
  no gated feature and no lapse rule.
- **SC-710** *(if US8 ships)*: a refund/chargeback resolves the entitlement correctly, append-only, auditable
  and idempotent; an unhandled refund never leaves premium silently active.
- **SC-711**: No E6 seller can reach any Play Billing surface (flag OFF asserted); the Play sandbox purchase
  path is evidenced working for the E7 turn-on gate.

## Assumptions

- The existing entitlement machinery (append-only ledger, per-request check, ≤1 session/token-refresh
  propagation, lapse freeze, `GET /api/v1/entitlement`, operator CLI) is reused verbatim; E6 adds a writer.
  (Brief §2.1, inference ~90% — arquiteto confirms the source-enum extension + subscription↔ledger linkage.)
- MP's hosted checkout carries the card-data burden (PCI stays with the PSP); Pix/card availability is MP's
  surface, not the product's promise.
- The grace window is **max(MP's retry cadence, 7 days)** (clarified 2026-07-20); the plan round confirms
  MP's actual cadence to implement the max().
- Sandbox + dev tunnel suffices to prove every E6 flow except the live production webhook, which is validated
  at the v1 deploy (owner Q3); reconciliation covers the gap in both environments.
- The payments ADR (webhook verification mechanism, idempotency machinery — possibly the E4 exactly-once
  precedent —, subscription schema/migration, Play flag architecture) is numbered and decided at the plan
  round with arquiteto + seguranca; `pricing-core` is expected untouched (brief §9.6, ~95%).
- `seguranca` review is mandatory on the PR carrying checkout/confirmation (payments = the epic that role
  exists for); LGPD touchpoint limited to billing-data minimisation (SC-706), not the full program.
- Fiscal sufficiency of MP's receipt (Q9) is provisionally assumed and explicitly routed to an
  accountant/compliance check before launch — a launch blocker if it fails, not a code blocker.
