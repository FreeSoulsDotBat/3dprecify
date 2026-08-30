# Implementation Plan: E6 — Billing: the purchase turnstile (MP recurring end-to-end + Play flag-ready)

**Branch**: `feature/012-e6-billing` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-e6-billing/spec.md` (clarified 2026-07-20) + the architecture
round (`arquiteto-round.md` + `seguranca-round.md`, 2 specialists in parallel — the E4/E5 rite) + **ADR-0023**
(payments — Mercado Pago recurring; Proposed, flips Accepted at the PR-A owner gate, the ADR-0021 precedent).

## Summary

E6 attaches a **verified payment event** to the front of the ADR-0012 entitlement machine as a new **writer**
(`source=payment`) — no new gate, no new propagation, no new lapse. Mercado Pago recurring (`preapproval` +
two `preapproval_plan`s: monthly R$ 15,99 · annual R$ 155,88/yr) with hosted checkout; confirmation is
**verify-by-lookup** (signature-checked webhook OR reconciliation poll → authoritative `GET` against MP →
exactly-once grant via a DB-UNIQUE inbox). The reverse loop (cancel at period end, grace = max(MP cadence,
7 days) via an append-only grace grant, refund/chargeback → revoke) lands in the **existing** read-only
freeze. Play Billing is built to the shared `grant_writer` seam behind a server-side flag that stays OFF
(asserted) until E7. Full decisions with options + confidence: **ADR-0023**.

## Technical Context

**Language/Version**: TypeScript (React 19 + Vite 8 PWA) · Python 3.12 (FastAPI, uv) — the decided stack
(ADR-0001..0014), unchanged.

**Primary Dependencies**: Mercado Pago **preapproval / preapproval_plan / authorized_payments** APIs (hosted
`init_point` checkout; Pix + card are MP's surface). **MP server access: SDK-vs-httpx + exact version PIN
resolved at implementation start against the installed tool** (the ADR-0020 `reportlab` pinned-not-assumed
lesson — flagged, not fabricated). Google Play Developer API (Play provider, flag-gated OFF in E6).

**Storage**: PostgreSQL via SQLAlchemy 2.0 (ADR-0013). Migration **`0005`** (`down_revision="0004"`): new
`subscriptions` (PSP mirror, references only — no money column) + new `billing_events` (the idempotency
inbox, `event_key` UNIQUE) + additive `entitlement_grants` extension (source CHECK `+ 'payment'`, nullable
`subscription_id` FK). **ADR-0022 NON-NEGOTIABLE escalation: the migration-`0005` executor runs on opus**
(money/entitlement domain).

**Testing**: pytest (webhook verification, idempotency, grace/lapse, env isolation — seguranca-round SEC-1xx..7xx
as the test spec) · vitest (billing feature, teaser CTA honesty) · Playwright e2e against MP **sandbox**
(dev tunnel; the LIVE webhook is validated at the v1 deploy — owner Q3, deploy deferral intact).

**Target Platform**: web PWA (Android packaging stays E7); backend Cloud-Run-portable (reconciliation runner
= invokable script in dev, Cloud Scheduler at the v1 deploy).

**Project Type**: web application (pnpm monorepo: `apps/web` + `backend` + `packages/pricing-core`).

**Performance Goals**: premium flip within ≤1 entitlement refresh of the verified event (SC-701); webhook
responds 2xx fast and defers processing to the idempotent path (MP retries non-2xx).

**Constraints**: card/PAN/CVV never touch the backend (SC-706, PSP-hosted); a sandbox event can never write a
prod grant (two independent guards: per-env HMAC secret AND `live_mode`↔`app_env` assert); `pricing-core`
untouched (stays 3.1.0, ~97%); ledger evaluation code (`entitlement/__init__.py`) unchanged.

**Scale/Scope**: 8 user stories + the Play flag cross-cut; 3 owner-gated PR slices; 3 new authenticated
routes + 2 flag-gated Play routes (404 in E6) + 1 public signature-authenticated webhook route (the
codebase's first — an explicit ADR-0023 exception to the "every product route authenticates via Firebase"
invariant, per the seguranca D1 flag).

## Constitution Check

- [x] **I. Scalability & Quality First** — one `grant_writer`, one ledger, one idempotency key across both
      confirmation paths; the Play provider slots behind the same seam at E7; Cloud SQL/Run portable.
- [x] **II. Truth Over Approval** — MP primitives verified against official docs (ADR-0023 §Sources, dated);
      the three honest unknowns are FLAGGED not fabricated: MP retry cadence (feeds grace `max()`), MP
      SDK+version pin, Q9 fiscal sufficiency (accountant — launch blocker, not code blocker).
- [x] **III. Test-First** — every story starts failing-first; the seguranca round's SEC-invariants are
      written as the pytest spec BEFORE the webhook/writer implementation (see tasks phase).
- [x] **IV. Server-Side Entitlements** — grants written ONLY by the server-verified path (signature +
      authoritative lookup; trust-the-body rejected in ADR-0023); the Play flag is server-side config;
      the operator CLI is deliberately NOT widened to `payment`.
- [x] **V. Clean Architecture Integrity** — ADR-0012 reused verbatim (a writer, not a mechanism); ADR-0018's
      *principle* reused, its client-side machinery correctly NOT reused; no phantom error codes.
- [x] **VI. Lean Living Documentation** — this plan + ADR-0023 supersede nothing silently; the §Pending
      payments-ADR entry in `docs/adr/README.md` resolves to 0023.
- [x] **VII. Spec-Driven Flow** — specify → clarify (3 Qs) → this plan → tasks; spec stays source of truth.
- [x] **VIII. No Inference (NON-NEGOTIABLE)** — integration shape, schema, idempotency, webhook seam, env
      isolation, Play-flag architecture, client surface: all DECIDED in ADR-0023 (≥3 options + confidence
      each), owner-ratified at the PR-A gate. The public-route exception (D1) is explicit in the ADR. The
      grace mechanism is pinned in `data-model.md` (append-only grace grant — resolves the seguranca D7
      tension with zero change to the ledger derivation).

## Project Structure

### Documentation (this feature)

```text
specs/012-e6-billing/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions consolidated from the 2-specialist round + ADR-0023
├── data-model.md        # Phase 1 — migration 0005 DDL shape + grace-grant mechanics + state machines
├── quickstart.md        # Phase 1 — the sandbox validation walk
├── contracts/
│   └── api-surface.md   # Phase 1 — the 5 routes + webhook contract + wire shapes
├── arquiteto-round.md   # architecture round input (2026-07-20)
├── seguranca-round.md   # security round input (2026-07-20) — SEC-invariants = the security test spec
└── tasks.md             # /speckit-tasks output (NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── billing/                    # NEW package (joins import-linter contracts)
│   │   ├── providers/              # mercadopago.py · google_play.py (flag-gated OFF)
│   │   ├── grant_writer.py         # the ONE shared terminus: verified event → ledger grant + inbox row
│   │   ├── checkout.py             # preapproval creation → init_point
│   │   └── reconcile.py            # the poll (same processing fn as the webhook, post-lookup)
│   ├── api/billing.py              # checkout · subscription state · cancel · the PUBLIC webhook route
│   ├── models/__init__.py          # + Subscription, BillingEvent; EntitlementGrant additive extension
│   ├── scripts/reconcile_subscriptions.py   # invokable runner (grant_premium.py pattern)
│   └── settings.py                 # + P3D_MP_* per-env secrets · P3D_PLAY_BILLING_ENABLED=False
├── alembic/versions/0005_e6_billing.py      # opus-escalated executor (ADR-0022)
└── tests/test_billing*.py          # the SEC-invariant suite + story suites

apps/web/src/
├── features/billing/               # NEW slice: plan/price surface · Assinar CTA · checkout hand-off ·
│   └── …                           #   Conta plan panel data · grace/pending honest states
├── features/{catalog,bom,history,scenarios}/*teaser*.tsx   # point at the shared Assinar CTA (FR-710)
└── entities/user/                  # entitlement entities REUSED unchanged
```

**Structure Decision**: web-app monorepo (existing). New `app.billing` BE package + `features/billing` FE
slice; everything else is seam-reuse (the table in `arquiteto-round.md` §Verified code seams maps each).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| First public (non-Firebase) route: `POST /api/v1/billing/webhook/mercadopago` | MP cannot carry a Firebase bearer; webhooks are how a PSP talks | Polling-only (no webhook) was weighed in ADR-0023/Q3 — kept as the resilience layer, but webhook+lookup gives the ≤1-refresh premium flip; the route is signature-authenticated + verify-by-lookup + seguranca-gated (explicit ADR exception, not drift) |
| Second table pair (`subscriptions` + `billing_events`) beyond the ledger | PSP mirror + exactly-once inbox need durable server state; the ledger must stay the generic ADR-0012 shape | Keying idempotency on the ledger grant directly — rejected in ADR-0023 §3 (non-grant events need idempotency + audit too; an MP-payment-id column would pollute the ledger) |
