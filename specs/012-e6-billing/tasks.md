# Tasks: E6 — Billing: the purchase turnstile (MP recurring end-to-end + Play flag-ready)

**Input**: Design documents from `specs/012-e6-billing/` (spec.md · plan.md · research.md · data-model.md ·
contracts/api-surface.md · quickstart.md · arquiteto-round.md · seguranca-round.md) + **ADR-0023** (payments —
Proposed) + ADR-0012/0018 (reused). Roadmap line: `docs/product/business-rules.md` E6 row.

**Prerequisites**: plan.md ✅ (Constitution Check 8/8) · `/speckit-clarify` ✅ (3 Qs, 2026-07-20) · E5 (010)
shipped. Docker required for DB-backed dev/tests; an **MP sandbox application** (owner-provisioned, T002) +
a dev tunnel required for the webhook path.

**Tests**: MANDATORY per Constitution III — every story starts with tests observed **FAILING**. The
load-bearing suites that MUST precede their implementation: the **SEC-invariant suite**
(`seguranca-round.md` SEC-1xx..7xx → pytest), **VR-701..710** (data-model §6), idempotency/exactly-once
(VR-702/704), env isolation (VR-705), and the grace/lapse mechanics (VR-707). **SC-709 in every PR**: all
E1–E5 guards pass UNCHANGED.

**Organization**: by user story, grouped into the **3-PR delivery** (spec §8 via the brief). Every push/merge
is **OWNER-GATED** (ADR-0006); the graph refreshes on each merge (ADR-0014). Ledger discipline per wave
(estimate BEFORE, harness-actual AFTER).

> **PR-A is the spine — a checkout without a verified-grant terminus is a security liability, not an MVP.**
> `seguranca` review is **BLOCKING pre-merge on PR-A** (the webhook + writer + no-client-trust). ADR-0023
> flips Proposed → **Accepted at the PR-A owner gate** (the ADR-0021 precedent).

## Standing rules for every task in this feature

- **The grant is the terminus.** The ADR-0012 ledger evaluation code (`entitlement/__init__.py`) does NOT
  change; E6 adds ONE writer (`grant_writer`) fed only by server-verified events. The operator CLI is never
  widened to `source=payment` (VR-710).
- **Verify-then-lookup, never trust-the-body** (SEC-104): a webhook body is a trigger; only the
  authoritative MP lookup writes state. Signature verification runs BEFORE any DB touch.
- **Exactly-once via the inbox**: every grant-writing event goes through `billing_events.event_key` UNIQUE
  (`ON CONFLICT DO NOTHING`), same key for webhook AND reconciliation (VR-702/704).
- **Two independent sandbox↔prod guards** (VR-705): per-env HMAC secret/token AND `live_mode`↔`app_env`
  assert. A sandbox event can never write a prod grant.
- **No money column, no card data, ever** (VR-701/SC-706): the backend persists PSP references only; prices
  live in the MP plans + ONE FE product constant (mismatch = release blocker, e2e-checked).
- **Grace = an append-only grace grant** (`expires_at = period_end + max(MP cadence, 7 days)`) — never a
  mutation, never a derivation change (VR-707/SC-709). Lapse is always expiry-driven or revoke-driven.
- **Honest states everywhere** (Constitution II): real prices only (15,99 / 155,88 "equivalente a 12,99/mês");
  "pagamento pendente" during grace, never "tudo certo"; no fake urgency; no client-inferred billing state.
- **Play flag OFF is server-side and asserted** (VR-709/SC-711): flag-gated routes 404 in every E6 env.
- **qa-produto visual homologation before done in every slice** with **adversarial DATA** (E4/E5 lesson):
  spoofed webhooks, replayed events, abandoned checkouts, a beta-granted subscriber, sandbox rejection cards.
- **ADR-0023 is homologated by the owner at the PR-A gate**; it stays Proposed until then.
- **Pin-not-assume** (ADR-0020 lesson): the MP SDK-vs-httpx choice + exact version, and MP's real retry
  cadence, are VERIFIED at T003 before any dependent code.

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — The turnstile: price → checkout → verified grant (US1 + US2 + US3) ══

> **OWNER RE-SEQUENCING 2026-07-21 (spec §Clarifications): build-first, provision-later.** All
> provisioning-independent tasks run FIRST across all three PRs (MP mocked in pytest; a LOCAL MP STUB —
> T011b — powers e2e + visual homologation); the owner then runs an intensive point-by-point homologation
> of the whole platform; ONLY then: T002 (MP sandbox), real-sandbox e2e (T016b), payment homologation, and
> GCP provisioning. T002 therefore moves to the post-homologation phase and no longer blocks the waves —
> the ONLY tasks it still gates are T016b/T018b (real-sandbox validation) and beyond.
> **UX decisions (F1–F9) recorded 2026-07-21**: F4 cancel = Conta-only + explicit label + confirm modal +
> "vigente a partir da próxima cobrança"; F6 = no status-code jargon ever reaches the seller; the rest as
> recommended (incl. F9: the DS gains an owner-ratified `caution` tone).

## Phase 1: Setup

- [x] T001 [P] designer-ux → handoff (NON-BLOCKING, parallel with all PR-A work): the plan/price surface
      (Q11: inside Conta + reachable from every teaser), the checkout hand-off states (pending/return/
      abandoned), the Conta plan panel states (active/grace/pending/cancelled/lapsed — honest copy per
      FR-708/709), and the teaser CTA. Write to `specs/012-e6-billing/ux-billing.md`. Not a merge blocker.
      **→ DONE 2026-07-20**: `ux-billing.md` (6 areas + 9 owner flags §10). Load-bearing findings: DS gap —
      no `caution` tone for grace (flag F9) · the pending≠grace copy firewall (§0.3) · **the MP `back_url`
      must be a 1-SEGMENT route** (the measured `base:'./'` cold-load trap applied to the external return —
      a T013 constraint) · the courtesy-outlives-cancel honesty line (§4.3).
- [ ] T002 **Owner setup checkpoint (RE-SEQUENCED 2026-07-21 → post-homologation phase; gates only T016b/T018b+)**: provision the **MP sandbox application** (access
      token + webhook secret), create the two `preapproval_plan`s (monthly R$ 15,99 · annual R$ 155,88/yr)
      in the sandbox, choose the dev tunnel tool, and hand the values to `.env` (NEVER committed — the
      `P3D_MP_*` SecretStr pattern). Record plan ids in the env, not in code.
- [x] T003 Verify-and-pin (Constitution II / ADR-0020 lesson): confirm MP server access shape (official SDK
      vs httpx) + EXACT version pin in `backend/pyproject.toml`; fetch and record MP's REAL renewal retry
      cadence (feeds the grace `max()`); record both in `research.md` §D10 as RESOLVED with sources. If the
      cadence cannot be confirmed, STOP and surface — never default silently.
      **→ DONE 2026-07-21 (main loop, sources in research §D10)**: MP recycling = **4 reattempts / ~10-day
      window / auto-cancel after 3 rejections** ⇒ grace covers `period_end + max(10d, 7d floor)`; access =
      **httpx (house dep, async)**, SDK `mercadopago==3.3.0` rejected (sync/requests, thin surface);
      reconciliation poll: 6 h.

## Phase 2: Foundational (blocking) — settings, schema, the SEC suite

- [x] T004 Write FAILING pytest first — `backend/tests/test_billing_schema.py`: migration `0005` shape per
      `data-model.md` §1–§3 (tables exist, CHECKs named, `event_key` UNIQUE, `mp_preapproval_id` UNIQUE,
      the one-active-subscription partial index, `entitlement_grants` source CHECK includes `payment` +
      nullable `subscription_id` FK; NO money/card column anywhere — VR-701). Observe failing.
- [x] T005 **[ESCALATED → opus per ADR-0022 — money/entitlement domain]** Implement migration
      `backend/alembic/versions/0005_e6_billing.py` (`down_revision="0004"`) + models `Subscription`,
      `BillingEvent` + the additive `EntitlementGrant` extension in `backend/app/models/__init__.py`.
      Upgrade→downgrade→upgrade proven on the compose DB. `ruff format` + `ruff check` both. Tests green.
- [x] T006 [P] Settings + env plumbing in `backend/app/settings.py`: `P3D_MP_ACCESS_TOKEN`,
      `P3D_MP_WEBHOOK_SECRET`, `P3D_MP_PLAN_ID_MONTHLY`, `P3D_MP_PLAN_ID_ANNUAL` (SecretStr, per-env) +
      `P3D_PLAY_BILLING_ENABLED: bool = False`. Fail-closed pytest: missing secret ⇒ the webhook route
      refuses (SEC-403), flag default OFF (VR-709 half).
- [x] T007 Write FAILING pytest first — `backend/tests/test_billing_security.py`, the **SEC-invariant
      suite** (seguranca-round SEC-1xx..7xx as the spec): bad/absent/garbage `x-signature` → 401 + zero DB
      writes; stale `ts` outside freshness window → reject; constant-time compare; `live_mode`↔`app_env`
      mismatch → reject (VR-705); unknown subscription → no grant; cross-account event isolation (VR-703);
      old-event replay never extends entitlement (VR-704); operator CLI still rejects `payment` (VR-710);
      Play routes 404 when flag OFF (VR-709). Observe ALL failing (routes absent).

> **Foundational wave DONE 2026-07-21 (`7885f1b`, dev-estrutura OPUS)**: 19/19 schema red→green · migration
> `0005` up→down→up proven · settings fail-closed 6/6 · SEC suite authored: **14 red-by-design + 2
> green-by-design (VR-709/VR-710 absence guards)** — 27 passed/14 failed re-measured by the main loop. ADR
> prose reconciled to the implemented contract (plan-id env naming; `grace` in the status enum). Play route
> path stays a placeholder until T036.

## Phase 3: User Story 3 — The verified terminus (Priority: P1, FOUNDATIONAL — build FIRST)

**Goal**: a verified payment event → exactly one `source=payment` grant → premium live without re-login.
**Independent test**: quickstart steps 3–5 (sandbox payment → flip; replay → one grant; spoof → reject).

- [x] T008 [US3] Write FAILING pytest — `backend/tests/test_billing_terminus.py`: verified payment event →
      exactly one grant (`expires_at = current_period_end`, `subscription_id` set) + one inbox row in ONE
      transaction (VR-702); N replays → still one (SC-703); webhook path and reconcile path converge on the
      same `event_key` without double-grant; `GET /api/v1/entitlement` flips to active with `source=payment`
      (SC-701); **clock-skew rule: the grant's `expires_at` is never earlier than MP's authoritative
      `current_period_end`** (spec §Edge Cases — the boundary favors the paying seller). Observe failing.
- [x] T009 [US3] Implement `backend/app/billing/` core: `providers/mercadopago.py` (lookup: preapproval +
      authorized_payments → the normalised verified event), `grant_writer.py` (the ONE shared terminus:
      inbox insert + ledger grant, same transaction, on-conflict-no-op), per ADR-0023 §2–§3. Tests green.
- [x] T010 [US3] Implement the webhook route `POST /api/v1/billing/webhook/mercadopago` in
      `backend/app/api/billing.py`: signature dependency (HMAC manifest per SEC-101..106, BEFORE any DB
      touch) → lookup → `grant_writer`; 200-fast semantics; the SEC suite (T007) goes green here. Wire the
      router in `main.py`; `app.billing` joins import-linter contracts.
- [x] T011 [US3] Implement the reconciliation runner `backend/app/billing/reconcile.py` +
      `backend/app/scripts/reconcile_subscriptions.py` (CLI pattern of `grant_premium.py`): same processing
      function as the webhook post-lookup; heals a missed webhook to the SAME single grant (T008 case).
      Tests green.
- [x] T011b [US3] **Local MP stub** (the build-first enabler, owner 2026-07-21): a small dev-only fake MP
      server (preapproval create/get + authorized_payments + a webhook-firing trigger, signed with the LOCAL
      test secret) usable by e2e and the owner homologation stack — full purchase/renewal/failure/refund
      loops WITHOUT credentials. Lives outside the app (`backend/tests/mp_stub/` or e2e fixture), never
      ships. Tests: the stub round-trip drives the SAME grant_writer path as real MP.

> **US3 spine DONE 2026-07-21 (`ca151a9`, dev-backend sonnet)**: terminus suite failing-first → 5/5; 12/14
> SEC reds green (2 remain, T013-bound: checkout auth); full suite 366 passed re-measured; regen idempotent
> by sha256. Deviations for T017/seguranca: freshness window 300s (MP publishes no default — one constant);
> conftest billing-table isolation fixture; the stub's documented T007-compat fallback (never in the real
> provider); a route-ordering bug self-caught in the stub (the export.csv house lesson re-paid).

## Phase 4: User Story 2 — Checkout (Priority: P1)

**Goal**: signed-in seller → MP hosted checkout; abandoned = never-started; client can't fake paid.
**Independent test**: quickstart step 2.

- [x] T012 [US2] Write FAILING pytest — `backend/tests/test_billing_checkout.py`: `POST /billing/checkout`
      requires auth (401 signed-out — FR-702); creates pending preapproval + `pending` subscription row,
      returns `initPoint`; NO grant written; second checkout while one is active/grace/paused → 409
      (SEC-604); abandoned checkout leaves no entitlement effect (US2.2); MP unreachable → honest 503
      `BILLING_UNAVAILABLE`. Observe failing.
- [x] T013 [US2] Implement `backend/app/billing/checkout.py` + the route; contract ripple: regen OpenAPI +
      Orval from the ROOT, idempotence proven 2×. Tests green.

> **Checkout wave DONE 2026-07-21 (`ed29a6d`, dev-backend sonnet)**: 5/5 failing-first → green; SEC-301/302
> flipped — **the whole SEC suite (16/16) is now green**; full suite 374/0 re-measured; regen idempotent by
> hash. Dated deviations: 409 double-subscribe = `VALIDATION_ERROR` + status 409 (FE branches on status —
> the honest copy is the FE wave's job); stub extended additively with POST /preapproval.

## Phase 5: User Story 1 — The offer surface (Priority: P1)

**Goal**: real prices, honest discount, working Assinar; signed-out routes through sign-in.
**Independent test**: quickstart step 1.

- [x] T014 [US1] Write FAILING vitest — `apps/web/src/features/billing/`: the plan surface renders EXACTLY
      R$ 15,99/mês and R$ 155,88/ano ("equivalente a R$ 12,99/mês") from the ONE product constant; honest
      delta copy (no "de/por" anchor); Assinar → checkout initiation for the chosen period; signed-out →
      sign-in first. Observe failing.
- [x] T015 [US1] Implement `apps/web/src/features/billing/` (plan surface + Assinar CTA + checkout hand-off
      via the generated client; design source `ux-billing.md` if T001 landed, else the shipped teaser/Conta
      conventions). FSD-Lite boundaries hold. Tests green.

> **US1 FE wave DONE 2026-07-21 (`4e161bc`, dev-frontend sonnet)**: 19 failing-first tests → 673/673 vitest
> + tsc clean (re-measured). Offer = Sheet in Conta (Q11 Option A); return takeover on `/conta?checkout=
> retorno` polling entitlement (~45s patience) gated strictly on `active`+`source=payment`; F2/F3/F6/F8
> applied; copy-honesty invariant scoped to non-billing (dated exception — E6 legitimizes price copy);
> caught+fixed the backend wave's BILLING_UNAVAILABLE tsc gap.

## Phase 6: PR-A hardening & delivery

- [x] T016 e2e against the **local MP stub** (T011b): the quickstart 1→5 walk — offer → checkout hand-off →
      webhook flip without re-login → replay=one-grant → spoof=reject → abandoned=no-state. Client-nav
      rules; kill orphan :4173 first. New spec `apps/web/tests/e2e/billing.spec.ts`.
- [ ] T016b **[post-provisioning phase]** the same walk against the REAL MP sandbox + tunnel (T002),
      including a real hosted-checkout payment with a test card — the sandbox truth-check of T016.
> **T016 DONE 2026-07-21** (2 legs): 7/7 chromium flows vs the stub + the HIGH cold-return defect found →
> fixed (`951d714`: redirect carries search · boot gates on authStateReady · Conta wrap) → flip PASSED at
> browser level (strengthened: honest pending pre-confirmation → success on the mounted panel's own poll);
> auth-boundary 6/6 both runs; a11y-overflow fixed; full suite green minus the pre-existing scenarios-manage
> contention flake (passes isolated). Stub recipe + 4 gotchas in the ledger.
- [ ] T017 **`seguranca` review — BLOCKING pre-merge** (the spec mandates it): the SEC checklist from
      `seguranca-round.md` §8 against the real diff (signature impl, no-client-trust, env isolation, secret
      handling, LGPD data map — SC-706). Findings fixed before the gate.
- [ ] T018 qa-produto visual homologation (390px + desktop, **local-stub stack** — the owner's intensive
      manual homologation follows this same stack; real-sandbox re-check rides T016b): the offer honesty (prices,
      delta, no fake urgency), checkout hand-off states, the flip (premium on without re-login), adversarial
      walks (spoofed webhook attempt visible as nothing, abandoned checkout leaves clean state). Screenshots.
- [ ] T019 `pnpm gate:all` + drift-guard idempotent + **SC-709** (all E1–E5 guards UNCHANGED). Evidence in
      `dod-evidence.md`.
- [ ] T020 **Owner-gated PR-A → `develop`** (squash). At this gate: **ADR-0023 flips Proposed → Accepted**.
      On merge: graph refresh (hooks).

---

## ══ PR-B — The reverse lifecycle: cancel · grace · Conta truth (US4 + US5 + US6) ══

## Phase 7: User Story 4 — Cancel at period end (Priority: P1)

- [ ] T021 [US4] Write FAILING pytest — cancel: MP preapproval cancelled, ledger NOT written, grant expiry
      stands, natural lapse to the freeze at period end (VR-706/SC-704); cancel is idempotent; re-subscribe
      restores writes with data intact (reuse the E2/E5 lapse-test fixtures). Observe failing.
- [ ] T022 [US4] Implement `POST /billing/subscription/cancel` + status mirroring; `GET /billing/subscription`
      returns `cancelAtPeriodEnd` truth. Tests green.

## Phase 8: User Story 5 — Grace & dunning (Priority: P2)

- [ ] T023 [US5] Write FAILING pytest — `payment_failed` verified event → ONE append-only grace grant
      (`expires_at = period_end + max(cadence, 7d)` with T003's confirmed cadence) + status `grace`
      (VR-707); recovery → real period grant, continuous active; exhaustion → expiry-driven lapse, nothing
      deleted; grace grant replay-idempotent; **late recovery AFTER lapse (MP retry succeeds post-grace) →
      honest reactivation via a new period grant** (spec §Edge Cases; data-model §4 row); `graceUntil` in
      the contract is DERIVED from the grace grant's `expires_at`, never a new column (analyze U1).
      Observe failing.
- [ ] T024 [US5] Implement the grace path in `grant_writer.py` + reconcile coverage (a missed failure event
      heals). Tests green.

## Phase 9: User Story 6 — Conta: the billing home (Priority: P2)

- [ ] T025 [US6] Write FAILING pytest + vitest — `GET /billing/subscription` per contract (null for
      no-subscription accounts; grace shows `graceUntil`); the dual-grant display rule (subscription state
      wins when present; courtesy grant otherwise; active while ANY valid grant — 2026-07-20 clarification);
      FE Conta plan panel renders every state with the honest copy ("pagamento pendente — regularize até
      {data}"; "ativo até {data}, não renova"), NO client-inferred state (SC-708). Observe failing.
- [ ] T026 [US6] Implement the endpoint + `features/billing` Conta panel + cancel/manage affordances
      routing to the MP-managed flow. Contract ripple regen idempotent 2×. Tests green.

## Phase 10: PR-B hardening & delivery

- [ ] T027 e2e: cancel → "não renova" → forced expiry → freeze → re-subscribe → data intact; failed renewal
      (sandbox rejection card) → grace visible → recovery/exhaustion both paths; dual-grant walk (beta
      account subscribes, cancels, stays active on courtesy).
- [ ] T028 qa-produto homologation: every billing state's honest copy at 390px + desktop; the freeze
      reached through REAL billing (first time in the product's life); adversarial: grace + courtesy
      combinations, long period dates. Screenshots.
- [ ] T029 `pnpm gate:all` + drift-guard + SC-709. Evidence.
- [ ] T030 **Owner-gated PR-B → `develop`** (squash). Graph refresh on merge.

---

## ══ PR-C — Teaser light-up · refund mechanics · Play flag-readiness (US7 + US8 + Q2 cross-cut) ══

> US8 is P3-droppable **to the mechanics floor only** (the silent-premium hole must not ship). The Play
> flag-readiness is an OWNER Q2 DECISION — it is NOT droppable; if the epic runs long it slips to its own
> follow-up PR, never silently cut.

## Phase 11: User Story 7 — Teaser light-up (Priority: P2)

- [ ] T031 [US7] Write FAILING vitest — the four teasers (`features/{catalog/premium-teaser,bom/bom-teaser,
      history/history-teaser,scenarios/scenario-teaser}.tsx`) render the real price + the shared Assinar CTA
      (FR-710); honesty regex (no fabricated number, no urgency copy); the price constant matches the plan
      surface (one source). Observe failing.
- [ ] T032 [US7] Implement: point the four teasers at the shared `features/billing` CTA. Tests green.

## Phase 12: User Story 8 — Refund/chargeback mechanics (Priority: P3, mechanics-floor kept)

- [ ] T033 [US8] Write FAILING pytest — verified refund/chargeback → `revoked_at` on the active payment
      grant (append-only revoke) → immediate lapse; idempotent replay; `beta|comp` grants untouched
      (VR-708/SC-710); post-lapse chargeback = audit-only no-op. Observe failing.
- [ ] T034 [US8] Implement in `grant_writer.py` + the event kinds in the MP provider. Tests green.

## Phase 13: Play Billing flag-readiness (owner Q2 — NOT droppable)

- [ ] T035 Write FAILING pytest — with `P3D_PLAY_BILLING_ENABLED=False`: both Play routes 404 server-side
      (VR-709/SC-711); with the flag ON in a test env: the Play provider's verified sandbox purchase event
      reaches the SAME `grant_writer` and writes a `provider=google_play` subscription + `source=payment`
      grant. Observe failing.
- [ ] T036 Implement `backend/app/billing/providers/google_play.py` (purchase-token verify against the Play
      Developer API → normalised event) + the two flag-gated routes; validate against **Play internal
      testing**; record the sandbox-purchase evidence in `specs/012-e6-billing/evidence/play-flag/` — the
      E7 turn-on gate artifact. Tests green; flag stays OFF everywhere.

## Phase 14: PR-C hardening & delivery

- [ ] T037 e2e: teaser walk (all four show price + working CTA); refund flow in sandbox; the two Play-route
      404 asserts.
- [ ] T038 qa-produto homologation: the four teasers' honesty at 390px, refund lapse copy, and the
      quickstart step-10/11 sweep. Screenshots.
- [ ] T039 `pnpm gate:all` + drift-guard + SC-709 + the full quickstart walk end-to-end (the owner
      homologation script) + the FR-713 absence sweep (no proration/trial/coupon/fiscal surface exists
      anywhere — grep + UI walk). Evidence.
- [ ] T040 **Owner-gated PR-C → `develop`** (squash). Graph refresh on merge.

---

## Phase 15: Polish & cross-cutting (at epic close-out)

- [ ] T041 [P] Update `CLAUDE.md` ground line + `docs/product/business-rules.md` E6 row (BUILT/SHIPPED, the
      premium-gate line from the brief §10) + cross-slice dod-evidence; confirm ADR-0023 Accepted; final
      graph refresh. **v1 = E1–E6 complete → surface the DEPLOY decision to the owner** (the standing
      2026-07-09 rule's trigger has fired; the live-webhook validation from Q3 waits there).
- [ ] T042 [P] Q9 fiscal check handoff: a dated note to the owner listing exactly what the accountant must
      confirm (MP receipt sufficiency for the owner's tax regime) — LAUNCH blocker tracking, not code.

---

## Dependencies & execution order

- **Setup (T001–T003)**: T002 (owner MP sandbox) BLOCKS T007+ (nothing that talks to MP runs without creds);
  T003 (pin + cadence) BLOCKS T009/T023. T001 is non-blocking parallel.
- **Foundational (T004–T007) block all stories.** T005 is the opus-escalated schema; T007 (SEC suite) is
  the failing-first spine the webhook implementation turns green.
- **US3 BEFORE US2/US1** (the terminus is foundational — a checkout that can't grant is a liability);
  within PR-A: T008–T011 → T012–T013 → T014–T015 → hardening T016–T020.
- **PR-B needs PR-A merged** (cancel/grace act on real subscriptions+grants). US4 ∥ US5 ∥ US6 once their
  red tests exist.
- **PR-C needs PR-A** (the CTA needs a working checkout); US7 ∥ US8 ∥ Play-flag phases are independent.
- **`pricing-core` is never touched** by any task (~97% — any need to touch it STOPS the task, ADR-0016).

## Parallel opportunities

- T001 (designer-ux) runs beside everything. T004 ∥ T006 (different files). T007 ∥ T004 (different suites).
- Within PR-B: T021/T023/T025 (three red suites, distinct endpoints) then T022 ∥ T024 ∥ T026.
- Within PR-C: T031 ∥ T033 ∥ T035 (three red suites), then T032 ∥ T034 ∥ T036.

## Implementation strategy (MVP first)

- **MVP = PR-A**: a seller sees the real price, pays in sandbox, and premium turns on by itself — verified,
  exactly-once, spoof-proof. That alone replaces the operator CLI as the door.
- PR-B makes the reverse honest (the freeze reachable by real billing). PR-C converts every wall into a
  door sign + refund mechanics + the Play evidence for E7.
- Ledger rows per wave (estimate → harness actual); routing per ADR-0022 (executors sonnet; migration 0005
  opus; qa-produto opus; seguranca opus).
