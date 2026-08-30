# E6 — Scope brief: billing — the purchase flow that lights the door E2 built (v1's last epic)

**Status**: product scope draft (input to `/speckit-specify`) · **Author**: product-owner · **Date**: 2026-07-20
**Roadmap line being expanded**: `docs/product/business-rules.md:57` — *"E6 | Billing (Mercado Pago recurring /
Play Billing — PENDING unnumbered payments ADR) | actual purchase flow"*.

> This brief specifies **behavior**, not architecture. The Mercado Pago recurring API surface, the webhook
> transport, the table shape, whether event processing reuses the E4 outbox, and the numbering of the pending
> **payments ADR** are the arquiteto's / `seguranca`'s call at the plan round (Principle VIII). Where a product
> decision depends on a technical or a commercial unknown, it is **flagged** (§10), not decided here. **No R$ price,
> no fee, no MP API behavior is fabricated anywhere in this document** (Constitution II): every number the seller
> will pay is the owner's to set (§4, §10 Q1), and MP mechanics are marked knowledge/inference where I state them.

## 0. Status of decisions (this is a kickoff — nothing is settled yet)

> **→ OWNER DECISION SESSION 2026-07-20 (same-day, reacting to this brief) — Q1–Q11 ANSWERED:**
> - **Q1 PRICES (option b — provisional anchor SET, adjust post-launch allowed):** **R$ 15,99/mês** on the
>   monthly plan · **R$ 12,99/mês when billed annually** (= R$ 155,88/yr, ~19% discount). WTP caveat stands
>   (~55%); the anchor is revisitable post-launch, never silently.
> - **Q2 MP × PLAY (owner shape, decided after the sequencing consequence was made explicit):** "both in
>   CODE" — **MP recurring ships end-to-end in E6**; the **Play Billing integration is BUILT and
>   sandbox/internal-testing-validated behind a flag** in E6, and **turns ON at E7** when the packaged app
>   publishes. E7 keeps its place (no roadmap re-sequence); packaging does NOT enter E6.
> - **Q3 WEBHOOK × DEPLOY: (a)+(c)** — sandbox + dev tunnel for all E6 dev/test; the LIVE webhook is
>   validated AT the v1 deploy; **polling reconciliation as a resilience layer** (protects against missed/
>   duplicated deliveries). The 2026-07-09 deploy deferral stays INTACT.
> - **Q4–Q11: the 8 PO recommendations accepted as working defaults** for `/speckit-clarify` (mechanical
>   chargeback handling · grace aligned to MP retry cadence · no proration · no trial · no coupons · MP
>   receipt suffices *provisionally* (Q9 stays FLAGGED for accountant/compliance verification) · cancel at
>   period end · "Assinar" lives in Conta, reachable from every teaser; final IA → designer-ux).


Unlike E5 (whose headline scope call was pre-settled at kickoff), **E6 opens with its owner-decision list OPEN by
design**. This brief is the artifact the owner reacts to; the §10 questions — headed by **the R$ prices, MP-only
vs. +Play Billing, and the webhook×deploy tension** — are **unanswered** and carry only the product-owner's
recommendation as a working default into `/speckit-specify` + `/speckit-clarify`. The one thing already **settled
elsewhere and not reopened here** is the freemium *structure* (§4): a single premium tier, monthly + annual
(annual discounted), free saves nothing. E6 sets the **prices** and builds the **turnstile** — it does not
redraw the boundary.

**E6 is the epic `seguranca` exists for.** Payments is the first place a client lie has a financial consequence,
so the honesty (II) and server-side-entitlement (IV) principles stop being abstract here (§9).

---

## 1. Epic vision (the seller's problem — and the product's)

*"Eu testei a calculadora, gostei, salvei um produto… e o app disse que salvar é Premium. Beleza, quero assinar.
Cadê o botão? Quanto custa? Como eu pago? Eu uso Pix e cartão, não tenho paciência pra boleto sumido."*

E1–E5 built the entire premium product — catalog, kits, histórico, cenários — and gated all of it behind a
**real, server-authoritative** entitlement wall (ADR-0012, live since E2). But for the whole life of the product
so far, **the only way through that wall has been an operator running a CLI by hand** (a `beta`/`comp` grant,
out-of-band). There is no door a real seller can open. Every premium teaser in the product today ends the same
honest way: *"no price, no date, no purchase button"* (the E2 US7 / E3 US5 / E4 US5 / E5 US5 lineage). **E6 is
the epic that replaces every one of those honest dead-ends with a working turnstile** — the seller picks a plan,
pays through Mercado Pago, and premium turns on **by itself**, no operator, no re-login.

The pitch in one line: **E2 built the wall and the door frame; E6 hangs the door and cuts the key — a payment
becomes a grant, and the grant is a machine E2–E5 already exercise every day.** The reverse is equally the
feature: cancel, or let a card fail, and the seller falls back to the **read-only freeze** that E2/E4/E5 already
ship — E6 doesn't invent that freeze, it makes it **reachable by a real paying seller for the first time**.

This is **v1's last epic**. Its completion is the trigger the owner tied the first public deploy to
(`business-rules.md:60`, v1 = E1–E6) — which is exactly why E6 collides with a deploy tension the earlier epics
never faced (§2.3 / Q3).

---

## 2. The centerpiece — the grant is the terminus (E6 wires a machine that already runs)

The risk of most epics was a **new object colliding** with the existing ones (E4's two-shelf rule, E5's
four-object map). E6 introduces **no new persistent product object at all** — a subscription is billing plumbing,
not a fourth/fifth seller-facing thing to price. E6's centerpiece is instead a **flow that must terminate cleanly
in machinery that already exists**, and the whole epic's correctness is that termination being honest.

### 2.1 The forward loop (free/lapsed → paying premium), stated as a contract

```
  free / lapsed seller
        │  US1  price presentation (real R$ monthly + annual — Q1)
        ▼
  checkout  ──US2──►  Mercado Pago recurring subscription (PSP-hosted; we never touch the card)
        │
        ▼  MP charges + emits a payment/subscription event
  webhook / reconciliation  ──US3──►  SERVER verifies the event (signature/lookup — never the client's word)
        │
        ▼  writes ONE append-only ledger row:  source = payment  (extends ADR-0012 beta|comp)
  entitlement ledger (E2, ADR-0012)  ──►  require_entitlement now returns active
        │
        ▼  ≤ 1 session / token-refresh window (ADR-0012 propagation, the SAME one comp grants use)
  premium live, WITHOUT re-login  ──►  every E2–E5 gated surface unlocks unchanged
```

**The load-bearing claim (inference, ~90%): E6 needs no new entitlement mechanism.** ADR-0012 already stores
`source`, `granted_at`, `expires_at`, `revoked_at` and evaluates `active = granted ∧ ¬revoked ∧ (expiry null ∨
now<expiry)` **per request**; a payment event is simply a **new writer** of that ledger with `source=payment` and
an `expires_at` set to the paid period end. The instant-propagation, the lapse freeze, the `GET /api/v1/entitlement`
plan surface, the per-account isolation — all reused **verbatim**. E6's job is to attach a *verified payment
event* to the *front* of that machine, not to rebuild it. (Arquiteto confirms the source-enum extension and the
subscription↔ledger linkage — §9.1.)

### 2.2 The reverse loop (the freeze made reachable), stated as a contract

```
  active paying seller
        │
        ├─ US4  cancels (self-service)  ──►  premium persists to paid-period-end  ──►  ledger expiry lapses  ──►  read-only freeze (E2/E4/E5), 0 data deleted
        │
        └─ US5  card fails / dunning     ──►  GRACE window (length = Q5)  ──►  MP retries  ──►  recovered → stays active
                                                                                            └─► exhausted → ledger lapse → same read-only freeze
```

**The freeze is not new (this is the whole point).** E2 Q3, E4 SC-508, E5 SC-608 already define lapse as:
snapshots/scenarios/catalog stay **readable** (and, for scenarios, re-openable/recomputable — a read), **all
writes 403**, **nothing auto-deleted**, re-grant restores writes with data intact. E6 changes **nothing** about
that behavior; it only makes lapse arrive via **a real billing event** (cancellation/expiry/dunning) instead of a
CLI `revoke`. A seller who paid, then stopped paying, gets exactly the experience E2–E5 already homologated.

### 2.3 The tension E6 alone carries — webhooks need a public endpoint; deploy waits for E6 (Q3)

Mercado Pago's recurring flow confirms payments **asynchronously via webhooks** (knowledge, ~85% — MP calls these
IPN/webhook notifications; exact transport is arquiteto/seguranca ground). A webhook needs a **publicly reachable
HTTPS endpoint**. But the owner's standing rule (`business-rules.md:60`, 2026-07-09) is that **the first public
deploy waits for v1 = E1–E6 complete** — i.e. it waits for **E6 itself**. So E6 is the one epic whose core
mechanism (a live inbound webhook) cannot be fully exercised under the very deploy posture E6 is meant to unlock.
This is a genuine circular dependency, not an oversight, and it is **the owner's to break** (Q3) — the standing
rule is explicitly *"revisitable… a dated decision-log entry + spec Clarification when it changes"*
(`business-rules.md:63`; `docs/decisions-backlog.md` is the log). §10 Q3 lays out the three ways out.

---

## 3. What E6 IS (crisp, so it does not smuggle in scope)

E6 is: **the self-service purchase, confirmation, and lifecycle of the single premium subscription**, terminating
in the E2 entitlement ledger. Concretely it carries:
- a **price-presentation surface** — the real R$ **monthly** and **annual** (discounted) prices (Q1), honest, no
  fabricated anchor;
- a **checkout** that creates a **Mercado Pago recurring subscription** (Q2 — MP-only recommended for E6; Play
  Billing waits for E7 packaging);
- a **server-verified confirmation path** (webhook and/or reconciliation) that writes a `source=payment` grant to
  the ADR-0012 ledger, turning premium on **without re-login**;
- the **reverse lifecycle** — cancellation, payment failure + **dunning/grace** (Q5), expiry — each resolving to
  the **already-shipped** read-only freeze;
- a **Conta/plan surface** that shows the true billing state (plan, renewal/expiry date, manage/cancel) sourced
  from the server + PSP, never client-inferred;
- **lighting up every pre-E6 teaser**: the E2–E5 honest "no price/no date" notices become real, accurate upgrade
  CTAs (SC-707).

## 3.1 What E6 is NOT (honest cuts — enumerated so the epic can't creep)

- **NOT a new tier or a quota system.** Single premium tier stays; premium = unlimited (business-rules §Tiers).
  **No multi-tier (Pro/Business), no per-feature quotas, no metered/usage billing** — explicitly OUT unless the
  owner reopens the tier model (a business-rules amendment, not mine).
- **NOT per-account marketplace fee auth.** That was E5 Q1's deferred integration increment (Shopee OAuth,
  AliExpress) — unrelated to billing, still its own future increment.
- **NOT Play Billing** (unless owner overrides Q2). Google Play Billing requires a **packaged Android app** to
  bill against; the Capacitor packaging is **E7, which comes after E6** (`business-rules.md:58`). **Play Billing
  without a packaged app cannot ship** — recommending it into E6 would be recommending an impossibility (§10 Q2,
  ~88%).
- **NOT price experiments, coupons, promo codes, or trials** — unless the owner explicitly asks (Q8/Q1 notes). A/B
  price tests and discount codes are a growth surface with their own complexity; v1 ships one honest price pair.
- **NOT a change to the lapse/read-only freeze rule.** E6 makes the freeze *reachable*; it does not redefine what
  a lapsed account can read/write (that is E2 Q3 / E4 SC-508 / E5 SC-608, unchanged — SC-709).
- **NOT an in-app admin/grant console.** The ADR-0012 operator CLI stays for `beta`/`comp`; a remote admin
  endpoint was already deferred by ADR-0012 "to E6" — I recommend it **stays deferred** (payments does not
  require it; the CLI still grants comps). Flagged as Q11-adjacent, not assumed.
- **NOT fiscal-document issuance (NF-e / nota fiscal de serviço).** Whether the subscription must emit a Brazilian
  fiscal receipt is a real compliance question (Q10) — recommended **OUT of v1** (MP issues its own payment
  receipt; a proper NF-e pipeline is a separate compliance epic), but flagged, not silently dropped.
- **NOT taxes on the product's pricing model** — still OUT (A24), unchanged and unrelated.
- **NOT the full LGPD program.** Billing does add **specific new personal/financial data touchpoints** (payer
  identity, PSP references) that §9.4 calls out; the broader consent/portability/erasure program stays deferred as
  in E2–E5, but billing data gets a **named minimisation rule** here (SC-706), not a hand-wave.

---

## 4. Freemium boundary + pricing (structure settled; the numbers are the owner's)

The **structure** is fixed and **not reopened** here (`business-rules.md` §Tiers/§Pricing): **one** premium tier,
**two** billing periods — **monthly** and **annual (discounted** for LTV/cash) — and the free tier **saves
nothing** (Round 3, 2026-06-29). E6 introduces **no new gate and no new free capability**: it reuses the E2
entitlement wall verbatim and simply lets a seller pay to cross it.

**The prices themselves are deliberately still unset**, and setting them is a **precondition for E6, owned by
Jonatan** (`business-rules.md:44` — *"willingness-to-pay unvalidated, ~55%… set prices before E6"*). This brief
**does not** invent a number (Constitution II). Q1 (§10) is therefore not a normal recommend-a-value question —
it is a **process** recommendation: validate a monthly anchor + an annual discount with a handful of real sellers
before locking them into the price-presentation surface. Until Q1 is answered, the price surface (US1) is
**built but not populated**, and every teaser keeps promising **no price** (the honest state persists right up to
the moment the owner sets the numbers — SC-707).

**Enforcement honesty (Principle IV, non-negotiable — this is the whole epic).** The entitlement decision is, and
remains, **100% server-authoritative**. A **client claiming it paid grants nothing**: only a **server-verified**
payment event (a signature-verified webhook, or a server-initiated reconciliation lookup against MP) may write the
ledger. The client's role is limited to *starting* checkout and *displaying* server-truth; it never asserts
entitlement. This is Principle IV at its sharpest — every prior epic's client-side compute was a *soft* guard over
a *real* server gate; here the money makes the server gate the only thing that may ever be trusted (§9.2).

---

## 5. User stories

### US1 — Present the plan and price to a free/lapsed seller (real R$, honest) — **P1**
A free, signed-out, or lapsed seller who hits any premium wall sees the **actual** subscription offer: monthly and
annual (discounted) prices in R$ (Q1), what premium unlocks, and a **working** "Assinar" affordance — the first
one in the product's life. Behavior only; IA/flow is `designer-ux` + owner (Q11).

**Acceptance scenarios**
1. **Given** a free/lapsed seller on any premium teaser, **When** the plan surface opens, **Then** it shows the
   real monthly + annual prices (once Q1 is set), the annual discount framed honestly, and a real checkout CTA —
   **no fabricated price** appears before Q1 is set (until then the honest "no price yet" teaser persists).
2. **Given** the annual and monthly options, **When** presented, **Then** the discount is stated truthfully (the
   real delta), never a fake "de/por" anchor.
3. **Given** a signed-out seller, **When** they choose to subscribe, **Then** sign-in is required before any
   payment is initiated (entitlement is per-account; there is no anonymous subscription).

### US2 — Check out via a Mercado Pago recurring subscription (Premium) — **P1**
The seller starts checkout; the app creates an MP **recurring subscription** for the chosen period and hands the
seller to MP's hosted payment (Pix/card per MP's own supported methods — the payment methods are MP's surface, not
ours). **Our backend never sees or stores card/PAN data** (SC-706).

**Acceptance scenarios**
1. **Given** a signed-in seller choosing monthly or annual, **When** they proceed, **Then** an MP recurring
   subscription is created for that period and the seller reaches MP's hosted checkout; the app stores only PSP
   references, never card data.
2. **Given** the seller abandons checkout, **When** they return, **Then** no entitlement was granted and no
   partial/ghost subscription leaves them in an ambiguous state (an abandoned checkout is indistinguishable from
   never having started — no fake "pendente premium").
3. **Given** a free or signed-out caller manipulating the client, **When** they attempt to fake a "paid" state,
   **Then** the server grants **nothing** — entitlement waits for a verified payment event (US3), never a client
   claim.

### US3 — Payment confirmation → automatic grant → premium live, no re-login (Premium) — **P1 [FOUNDATIONAL]**
The terminus. MP confirms the charge; the **server verifies** the event and writes a `source=payment` grant to the
ADR-0012 ledger; premium turns on within the ADR-0012 propagation window **without the seller logging in again**.

**Acceptance scenarios**
1. **Given** a completed MP payment, **When** the server receives and **verifies** the payment/subscription event
   (signature/lookup), **Then** exactly **one** append-only ledger grant is written with `source=payment` and an
   `expires_at` at the paid-period end, and `require_entitlement` returns **active**.
2. **Given** the grant is written, **When** the seller's client refreshes its entitlement (`GET /api/v1/entitlement`,
   within ≤1 session/token-refresh), **Then** every E2–E5 premium surface unlocks — **no re-login, no operator, no
   app reinstall** (SC-701).
3. **Given** the same MP event delivered N times (retries/duplicates), **When** processed, **Then** it produces
   **exactly one** grant/state change — processing is idempotent (SC-703; the E4 exactly-once outbox precedent).
4. **Given** a webhook the server cannot verify (bad/absent signature, unknown subscription), **When** received,
   **Then** it is **rejected** and grants nothing; a verification failure never becomes an entitlement (SC-702).

### US4 — Cancel the subscription; lapse to the read-only freeze — **P1**
A paying seller cancels self-service. Premium persists to the paid-period end (they paid for it), then the ledger
expiry lapses them into the **existing** E2/E4/E5 read-only freeze — **nothing deleted**.

**Acceptance scenarios**
1. **Given** an active seller, **When** they cancel, **Then** premium remains active until the paid-period end,
   the plan surface honestly shows "ativo até {data}, não renova", and no data is touched.
2. **Given** the paid period ends after cancellation, **When** the ledger expires, **Then** the account lapses to
   the E2/E4/E5 read-only freeze (reads/recompute survive, all writes 403, **0** data deleted) — SC-704.
3. **Given** a lapsed-by-cancellation seller, **When** they re-subscribe, **Then** writes restore with **all**
   prior data intact (catalog, kits, snapshots, scenarios) — re-grant is the E2/E4/E5 re-grant, unchanged.

### US5 — Payment failure, dunning, grace period → eventual lapse (honest throughout) — **P2**
A renewal charge fails. The account enters a **grace window** (length = Q5) during which premium stays active and
MP retries; recovery keeps them active, exhaustion lapses them. The seller is **honestly informed** at every step
— no silent lapse, no premium-looking dead account.

**Acceptance scenarios**
1. **Given** a failed renewal charge, **When** it fails, **Then** the account enters the grace window with premium
   still active, and the plan surface honestly shows "pagamento pendente — regularize até {data}" (never a fake
   "tudo certo").
2. **Given** MP recovers the charge within grace, **When** the success event verifies, **Then** the account stays
   continuously active (a new period grant), with **no** interruption the seller experiences.
3. **Given** grace exhausts without recovery, **When** the window closes, **Then** the account lapses to the
   read-only freeze (US4.2 rule), **nothing deleted**, and the seller is told honestly why (SC-705).

### US6 — The Conta/plan surface (true billing state, server-sourced) — **P2**
The Conta page (today `PlanSection` shows entitlement status; ADR-0012 `GET /api/v1/entitlement`) becomes the
seller's billing home: current plan + period, renewal/expiry date, "gerenciar/cancelar", and the grace/pending
state — **all** from the server + PSP, never client-guessed.

**Acceptance scenarios**
1. **Given** an active seller, **When** they open Conta, **Then** they see plan (monthly/annual), status, and the
   next renewal or the "não renova até {data}" state — matching the ledger + PSP truth (SC-708).
2. **Given** any billing state (active/grace/pending/canceled/lapsed), **When** rendered, **Then** the copy is
   honest and matches server truth — **no** client-inferred or optimistic state is ever shown.
3. **Given** the seller wants to cancel or update payment, **When** they choose it, **Then** the action routes to
   the correct MP-managed flow (behavior only; the manage-subscription mechanism is arquiteto ground).

### US7 — Every pre-E6 teaser becomes a real, accurate upgrade CTA — **P2**
The E2 US7 / E3 US5 / E4 US5 / E5 US5 honest "no price/no date" notices — scattered across catalog, kits,
histórico, cenários — **light up** into real "Assinar" entry points that lead to US1→US2. Until Q1 sets prices,
they keep the honest no-price state; the moment prices are set, they become accurate CTAs (never before).

**Acceptance scenarios**
1. **Given** any premium teaser across E2–E5, **When** E6 ships with prices set, **Then** it shows a real price
   and a working "Assinar" CTA leading to checkout — replacing the pre-E6 dead-end.
2. **Given** prices are **not** yet set (Q1 open), **When** a teaser renders, **Then** it keeps the honest
   no-price state (never a placeholder/fabricated number) — the teaser degrades gracefully, it never lies.
3. **Given** the conversion CTA, **When** reviewed, **Then** it makes no false urgency and no unverifiable claim
   (Constitution II) — honest value, real price, real availability.

### US8 — Refund / chargeback handling surface (v1 minimal) — **P3 (droppable)**
When a payment is refunded or charged back (via MP), the account's entitlement must resolve **honestly and
idempotently** to the correct state (typically → lapse/freeze), and the event is auditable. The **policy** (do we
offer refunds, and how) is the owner's (Q4); this story is the **mechanical** handling of whatever MP reports.

**Acceptance scenario**: **Given** MP reports a refund/chargeback for a subscription, **When** the server verifies
the event, **Then** the entitlement resolves to the correct state per the owner's policy (Q4), the ledger records
it auditable + append-only (a revoke/expiry, never a physical delete), and processing is idempotent.

> P3 = droppable if E6 runs long. Recommend cutting US8's *policy surface* (Q4) before cutting the *mechanical*
> handling — an unhandled chargeback that silently leaves premium **on** is a Principle-IV hole, so the mechanics
> stay even if the policy is "manual review for v1".

---

## 6. Success criteria (measurable, technology-agnostic)

- **SC-701**: A free/lapsed seller completes MP checkout and, on the server-verified payment event, gains premium
  **without re-login** within the ADR-0012 propagation window (≤1 session/token-refresh); a `source=payment`
  ledger grant exists server-side.
- **SC-702**: 100% of `source=payment` grants originate from a **server-verified** payment event; a client
  asserting payment (any spoof/replay of client state) grants **nothing** (Principle IV).
- **SC-703**: Payment/subscription event processing is **idempotent** — the same MP event delivered N times
  produces **exactly one** grant/state change (E4 exactly-once precedent).
- **SC-704**: On cancellation, premium persists to the paid-period end, then lapses to the E2/E4/E5 read-only
  freeze with **0** rows of seller data deleted; re-subscribe restores writes with **all** data intact.
- **SC-705**: On a failed renewal, the account enters a defined grace window (Q5) with premium active, the seller
  is honestly notified, and lapse occurs **only** on grace exhaustion — **no** silent lapse, **no** fake-active.
- **SC-706**: Our backend **never** stores or transmits card/PAN/CVV data; it persists **only** PSP references
  (subscription id, status) + the minimum payer identifier — verified across every billing path (LGPD
  minimisation, §9.4).
- **SC-707**: The plan surface presents the **real** R$ monthly + annual prices (once Q1 is set) with **no**
  fabricated number ever pre-shown; every pre-E6 "no price/no date" teaser is replaced by an **accurate** CTA and
  never a placeholder price.
- **SC-708**: Every billing state shown (active/grace/pending/canceled/lapsed) **matches** the server-authoritative
  ledger + PSP truth; **no** client-inferred billing state is ever rendered.
- **SC-709**: All E1–E5 acceptance guarantees pass **unchanged** (free calculator, catalog live-recompute, kit
  D3/D6, snapshot immutability, scenario live/frozen, entitlement gate, lapse freeze) — E6 wires the purchase; it
  alters **no** gated feature and **no** lapse rule.
- **SC-710** *(if US8 ships)*: A refund/chargeback reported by MP resolves the entitlement to the correct state
  (Q4 policy), recorded append-only + auditable + idempotent; an unhandled refund **never** leaves premium
  silently active.

---

## 7. Scope boundaries

### IN
- **Price presentation** — real R$ monthly + annual (discounted), honest, populated once Q1 is set.
- **Checkout** via a **Mercado Pago recurring subscription** (Q2 — MP-only for E6, recommended).
- **Server-verified confirmation** (webhook and/or reconciliation) → **`source=payment` grant** in the ADR-0012
  ledger → premium live **without re-login**.
- **Reverse lifecycle** — cancellation, payment failure + **dunning/grace** (Q5), expiry → the **existing**
  read-only freeze (nothing deleted; re-grant restores).
- The **Conta/plan surface** showing true, server-sourced billing state (plan, renewal/expiry, manage/cancel).
- **Lighting up** every E2–E5 premium teaser into a real upgrade CTA.
- **Refund/chargeback mechanical handling** (US8, P3 droppable) — honest, idempotent state resolution.

### OUT (guarding the boundary)
- **Google Play Billing** → **E7** (requires the packaged Android app that E7 delivers; cannot ship in E6). IN
  only if the owner overrides Q2 **and** re-sequences E7 before/with E6 — a roadmap change, with its own ADR.
- **Multi-tier / Pro/Business / quotas / usage-metered billing** → OUT (single tier stays; a tier change is a
  business-rules amendment, not E6 scope).
- **Coupons / promo codes / price A/B experiments / free trials** → OUT unless the owner asks (Q1/Q8). v1 ships
  one honest price pair.
- **Per-account marketplace fee auth** (Shopee OAuth, AliExpress) → still its **own** deferred integration
  increment (E5 Q1), unrelated to billing.
- **In-app admin/grant console** → deferred (ADR-0012); the operator CLI keeps issuing `beta`/`comp` grants.
- **Fiscal document issuance (NF-e / NFS-e)** → OUT of v1 (Q10); MP's own payment receipt stands. A compliance
  epic, not billing plumbing.
- **A change to the lapse/read-only freeze semantics** → OUT; E6 makes the freeze reachable, it does not redefine
  it (SC-709).
- **Taxes on the pricing model** → still out (A24), unrelated.
- **Full LGPD program** (consent management, self-service portability/erasure) → still deferred; E6 adds only the
  **billing-data minimisation** rule (SC-706), not the whole program.
- **Public deploy timing** → **the standing "deploy at v1 = E1–E6" rule is itself in tension with E6's webhook
  need (Q3)**; whether it moves is the owner's, via a dated Clarification (`docs/decisions-backlog.md` +
  business-rules amendment). Not silently assumed either way.

---

## 8. Recommended PR slicing (owner-authorized, slice by slice — E2–E5 pattern)

- **PR-A — The turnstile (US1 + US2 + US3).** Price presentation, MP recurring checkout, and the
  **server-verified confirmation → `source=payment` grant → premium-without-re-login** terminus, idempotent. *This
  IS the epic's spine — a seller pays and premium turns on by itself.* Like E4/E5 PR-A, it **is** the server slice:
  a checkout with no verified-grant terminus is worthless (and dangerous). **Ships behind MP sandbox** until Q3
  resolves the public-webhook question. `seguranca` review is **mandatory on this PR** (webhook signature +
  idempotency + no-client-trust).
- **PR-B — The reverse lifecycle (US4 + US5 + US6).** Cancellation → paid-period-end → freeze; payment-failure →
  dunning/grace → freeze; the Conta/plan surface showing honest server-sourced state. *This proves the "freeze is
  reachable" half and closes every honesty hole (no silent lapse, no fake-active).* Where E6's real behavioural
  risk lives.
- **PR-C — Teaser light-up + refund handling (US7 + US8 if it survives).** Convert every E2–E5 teaser into a real
  CTA; mechanical refund/chargeback resolution. *Independently homologable; the natural place to cut scope — US8
  can drop to the mechanics-only floor, and the teaser light-up is a mostly-copy change over already-built
  surfaces.*

Rationale (the E4/E5 rationale, adapted): PR-A must carry confirmation+grant because a checkout without a verified
terminus is not just valueless but a **security liability**. PR-B is where every dishonest-state hole is closed.
PR-C is the only deferrable part without leaving the product incoherent — a product that can be *purchased* and
correctly *lapses* is already a shippable v1 billing story; the teaser polish and refund policy can follow.

---

## 9. Technical unknowns + security posture to route to the arquiteto / `seguranca` (not product calls)

> **The pending payments ADR gets its NUMBER at the plan/architecture round — not by me** (Principle VIII;
> `docs/adr/README.md` §Pending lists it as blocking before any payment code). This section states the *behavioral*
> requirements the ADR + `seguranca` must satisfy; it does not choose the mechanism.

1. **Ledger writer + source-enum extension.** ADR-0012's `source` (currently `beta|comp`) gains **`payment`**;
   the subscription↔grant linkage (how a ledger row references its MP subscription, and how a renewal writes the
   next period's grant/expiry) is the arquiteto's schema call — likely the next migration after `0003`
   (inference; confirm). **Escalation flag (CLAUDE.md ADR-0022): this touches the money/entitlement domain →
   `dev-estrutura-de-dados` work here escalates to `opus`.**
2. **Webhook verification (Principle IV, the crux).** Signature/authenticity verification of the MP event, and
   the rule that **only a verified event** writes the ledger (SC-702). `seguranca` owns this. Never trust the
   client's payment claim; prefer server-side reconciliation (lookup against MP) as the source of truth over a
   raw webhook body.
3. **Idempotent event processing (SC-703).** MP will retry/duplicate; processing must be exactly-once. The **E4
   offline outbox / exactly-once precedent (ADR-0018)** is the pattern to consider — an idempotency key on the MP
   event id. Whether E6 reuses that machinery or a new inbox is the arquiteto's call.
4. **LGPD + billing-data minimisation (SC-706).** **Card/PAN/CVV must never touch our backend** (PSP-hosted
   checkout). We store only PSP references + minimum payer identity. `seguranca` confirms the data map: what MP
   sends, what we persist, retention, and the LGPD basis for storing a payer identifier tied to a subscription.
   This is a **new personal/financial-data touchpoint** the earlier epics did not have.
5. **The webhook×deploy resolution (feeds Q3).** MP sandbox + a dev tunnel lets PR-A be built and tested without a
   public prod endpoint; the **live** webhook is validated **at** the v1 deploy — unless the owner pulls deploy
   forward, or a **polling/reconciliation** fallback removes the hard public-endpoint dependency. Which of the
   three (Q3) is chosen shapes the whole confirmation path — so Q3 should be answered **before** PR-A's plan.
6. **`pricing-core` impact — NONE (inference, ~95%).** Billing is orthogonal to the pricing formula; E6 touches no
   pricing-core version. Confirm, but expect no formula change.
7. **Only if Q2 flips Play Billing IN:** it is a **second PSP** with its own receipt-verification, its own store
   policy, and a dependency on the **E7 packaged app** — a materially heavier, separately-reviewed integration.
   Do not fold it into the MP payments ADR.

---

## 10. Open questions — owner decisions (→ answer one by one, then `/speckit-specify` + `/speckit-clarify`)

> These are **unanswered at kickoff** (§0). The three headline ones — **Q1 prices, Q2 MP-vs-Play, Q3
> webhook×deploy** — gate the epic's shape; the rest can carry the recommendation as a working default into
> clarify. I state a recommendation + confidence on each; **none is decided here** (esp. Q1 — the price is yours).

| # | Decision | Options | Recommendation (confidence) |
|---|---|---|---|
| **Q1** | **THE prices — the monthly R$ and the annual (discounted) R$.** Structure is decided (single tier, monthly + annual); the **numbers** are yours and are a **precondition for E6** (`business-rules.md:44`). | (a) **Validate first** — test a monthly anchor + annual discount with a handful of real sellers, then lock · (b) set a provisional anchor now and adjust post-launch · (c) launch E6 with the surface **built but unpriced**, set numbers at the deploy gate | **(a)** as the *process* (WTP is unvalidated, **~55%**) — and I will **not** fabricate a number (Constitution II). If speed matters, **(c)** lets all E6 code land while the price stays honestly "not yet set" (teasers keep the no-price state, SC-707) and you set it at the v1 deploy. **This is a commercial call only you can make; my confidence is in the *process*, not any figure.** |
| **Q2** | **MP recurring only in E6, or also Play Billing?** | (a) **Mercado Pago recurring only**; Play Billing → E7 (after packaging) · (b) **both** in E6 · (c) MP + a thin Play Billing **spike** to de-risk E7 | **(a)** (**~88%**). Play Billing **requires a packaged Android app**, which is **E7 — after E6** (`business-rules.md:58`); billing against Google Play with no published app **cannot ship**. Play also mandates its own billing for in-app digital goods on Android, so E7 will likely need it *then* — but forcing it into E6 recommends an impossibility and doubles the `seguranca` surface. (b) is IN only if you **re-sequence E7 before/with E6** (a roadmap change + its own ADR). |
| **Q3** | **The webhook×deploy tension** — MP webhooks need a **public** endpoint, but first deploy waits for **v1 = E6** (the circular dependency, §2.3). | (a) **Sandbox + dev tunnel** for all E6 dev/test; validate the **live** webhook **at** the v1 deploy (keeps the 2026-07-09 rule intact) · (b) **pull the first deploy forward** to mid-E6 so the webhook is live during E6 (a dated Clarification revisiting the deferral) · (c) **polling/reconciliation** primary (server pulls MP for status), webhook optional — removes the hard public-endpoint dependency | **(a) as the default, with (c) as a resilience layer** (**~65%**). (a) respects the standing owner rule and is the cheapest path; adding (c) as a **reconciliation safety net** protects against a webhook the sandbox path can't fully prove until deploy (and against MP's real-world missed/duplicated deliveries). (b) is legitimate but reopens the 2026-07-09 deferral — a bigger commitment (provisioning, secrets, a live public surface before v1 is fully proven). Whichever you pick, it should be answered **before** PR-A's plan (§9.5). |
| **Q4** | **Refund / chargeback policy for v1** — do we offer refunds, and how does a chargeback resolve? | (a) **No proactive refund policy** for v1; chargebacks handled **mechanically** (→ lapse) + manual review · (b) a stated refund window (e.g. 7 days) · (c) pro-rated refunds | **(a)** (**~60%**). A stated refund window (b) is consumer-friendly and CDC-adjacent (Brazil's 7-day *arrependimento* for online purchases is a real consideration — **flag, not legal advice, ~50%**), but it adds a refund-issuance flow. For v1 I recommend the **mechanical** handling stays (US8, a chargeback must never leave premium silently on) while the **customer-facing policy** starts minimal. Revisit (b) once you have real subscribers. **Consumer-law check is `seguranca`/legal, not mine.** |
| **Q5** | **Grace period length on a failed renewal** (how long premium stays active while MP retries). | (a) **~3 days** · (b) **~7 days** · (c) match MP's default retry schedule · (d) **0** (lapse immediately on first failure) | **(c) align to MP's own retry cadence** (**~60%**). Fighting the PSP's dunning schedule creates split-brain (we say lapsed, MP is still retrying). (d) is hostile to a seller whose card merely expired; a **7-day** floor (b) is a humane, common default if MP's cadence is shorter. **Not (d).** The exact value is a small commercial/UX call — bring it to clarify with MP's actual retry cadence in hand. |
| **Q6** | **Plan switching / proration** — can a seller move monthly↔annual mid-cycle, and do we pro-rate? | (a) **No mid-cycle switch** in v1 — change takes effect at renewal · (b) switch with **proration** | **(a)** (**~75%**). Proration is a well-known billing-complexity sink; "muda na próxima renovação" is honest, simple, and MP-friendly. Add (b) only if sellers actually ask. |
| **Q7** | **Free trial?** | (a) **No trial** (matches "no taste-it-first" structure, business-rules §Freemium) · (b) a **time-limited trial** (e.g. 7 days) | **(a) No trial** (**~70%**). The whole free tier is already a permanent, generous free calculator — that *is* the try-before-buy. A trial adds a trial→lapse lifecycle and a new honesty surface. It's a legitimate growth lever, but it's a **business-rules amendment**, not E6 default scope. |
| **Q8** | **Coupons / promo codes at launch?** | (a) **No** codes in v1 · (b) a simple flat/percent code | **(a) No** (**~80%**). Codes multiply the price surface, the fraud surface, and the test matrix. v1 ships one honest price pair; add promotions once there's traction to promote. |
| **Q9** | **Fiscal receipt (NF-e / NFS-e) for the subscription** — must our product emit a Brazilian fiscal document, or does MP's payment receipt suffice for v1? | (a) **MP receipt suffices** for v1; a fiscal pipeline is a later compliance epic · (b) issue NF-e/NFS-e in E6 | **(a)** (**~55%**, explicitly **flagged as a compliance question I'm not authoritative on**). A proper fiscal pipeline (municipal NFS-e for a SaaS subscription) is a heavy compliance domain that shouldn't ride inside billing plumbing. But whether MP's receipt is legally sufficient for **your** tax regime is a **`seguranca`/accountant** call — I recommend (a) *provisionally* and route the compliance verification out. |
| **Q10** | **Cancellation timing** — does cancel take effect at period-end (seller keeps what they paid for) or immediately? | (a) **End of paid period** (seller keeps premium until it expires) · (b) **immediate** lapse on cancel | **(a) End of period** (**~85%**). The seller paid for the period; cutting them off immediately on cancel is hostile and refund-inviting. (a) is the humane, standard, and MP-aligned default. |
| **Q11** | **IA placement of the purchase surface** — where does "Assinar" live? | (a) **Inside Conta** (extend `PlanSection`) + a checkout route reachable from every teaser · (b) a **dedicated upgrade screen** · (c) both | **(a)** (**~65%**) — Conta already owns entitlement state (ADR-0012 `GET /api/v1/entitlement`, `PlanSection`), so plan/price/manage belong there, reachable from every teaser. **Flag:** final flow/IA is `designer-ux`'s domain — I state the behavioral requirement (a working "Assinar" path must be reachable from every premium teaser and from Conta) and route the layout to designer + owner. |

**Roadmap premium-gate line (for the `business-rules.md` E6 row, when E6 completes):** *"purchase itself — a
server-verified payment event writes a `source=payment` grant into the ADR-0012 ledger (extending `beta|comp`);
every previously-gated premium feature (E2–E5) is unchanged, and lapse/dunning routes to the existing read-only
freeze. First public deploy resolves here (v1 = E1–E6)."*

---

## 11. Dependencies

- **E2 (007) — the terminus.** ADR-0012 entitlement ledger (`entitlement_grants`: uid, status, `source`,
  grantor, granted_at, expires_at, revoked_at), the per-request `require_entitlement` seam, `GET /api/v1/entitlement`,
  the operator grant CLI, and the **lapse read-only freeze** (Q3 freeze) — **all reused verbatim**; E6 adds
  `source=payment` as a new **writer**, nothing more. Conta's `PlanSection`/`IdentitySection` are the plan-surface
  home (US6/Q11).
- **E4 (009) — the idempotency/exactly-once precedent.** ADR-0018's device-durable, exactly-once outbox is the
  **pattern candidate** for idempotent MP event processing (§9.3, SC-703) — the closest prior art the codebase has
  to "process an at-least-once event stream exactly once".
- **E3/E4/E5 — the lapse surfaces E6 makes reachable.** The read-only freeze homologated by E2 Q3, E4 SC-508, E5
  SC-608 is the reverse-loop's destination — E6 reuses, never redefines it (SC-709).
- **E7 (Android/Play packaging) — the sequencing constraint behind Q2.** Play Billing needs E7's packaged app;
  E7 comes **after** E6, so Play Billing can't ship in E6 without a re-sequence.
- **`docs/adr/README.md` §Pending — the payments ADR** (Google Play Billing vs Mercado Pago recurring) is
  **blocking before any payment code** and is **numbered at the plan round** (Principle VIII), not here.
- **Constitution IV + `business-rules.md`** — §Payments (recurring; PSP-vs-Play is an open architectural risk an
  ADR must resolve), §Pricing (numbers deferred, set before E6), §Deploy posture (v1 = E1–E6, revisitable via a
  dated Clarification — the hook Q3 may pull). `docs/decisions-backlog.md` is the decision log for a Q3 change.
