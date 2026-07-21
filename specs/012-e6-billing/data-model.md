# E6 — data model (migration `0005`, ADR-0023 §2 — the opus-escalated schema)

> **ADR-0022 NON-NEGOTIABLE**: this schema touches the money/entitlement domain → the
> `dev-estrutura-de-dados` executor for migration `0005` runs on **opus**.
> Authority: ADR-0023 (Proposed → Accepted at the PR-A owner gate) · ADR-0012 (the ledger it extends) ·
> ADR-0013 (persistence stack). Wire shapes: `contracts/api-surface.md`.

## §1 `subscriptions` — the PSP mirror (references only; NO money column)

| Column | Type | Constraint | Note |
|---|---|---|---|
| `id` | uuid v7 | PK | house pattern |
| `owner_uid` | text | FK → `accounts.uid`, NOT NULL, indexed | the ONLY account link (isolation) |
| `provider` | text | CHECK `IN ('mercadopago','google_play')`, NOT NULL | Play rows exist only ≥E7 |
| `mp_preapproval_id` | text | **UNIQUE**, nullable | nullable for the future Play row |
| `plan_period` | text | CHECK `IN ('monthly','annual')`, NOT NULL | the two decided plans |
| `status` | text | CHECK `IN ('pending','authorized','grace','paused','cancelled')`, NOT NULL | mirrored from lookup; `grace` marks FR-708 |
| `payer_ref` | text | nullable | MP's minimum payer identifier — the LGPD-mapped field (SEC-5xx) |
| `current_period_end` | timestamptz | nullable | from the authoritative lookup |
| `created_at` / `updated_at` | timestamptz | NOT NULL | house pattern |
| `deleted_at` | timestamptz | nullable | soft-delete only; never physical |

- **At most one active subscription per account** (SEC-604 double-subscribe guard): partial UNIQUE index on
  `owner_uid` WHERE `status IN ('pending','authorized','grace','paused') AND deleted_at IS NULL`.
- No card/PAN/CVV column exists or ever will (SC-706); `raw` payloads live in `billing_events`, not here.

## §2 `billing_events` — the exactly-once inbox (ADR-0018 principle, server-side mechanism)

| Column | Type | Constraint | Note |
|---|---|---|---|
| `id` | uuid v7 | PK | |
| `subscription_id` | uuid | FK → `subscriptions.id`, NOT NULL, indexed | event→account resolution is server-side ONLY (SEC-204) |
| `event_key` | text | **UNIQUE** NOT NULL | the idempotency key = MP `authorized_payment.id` (or provider-scoped equivalent); webhook + poll converge here |
| `kind` | text | CHECK `IN ('payment','payment_failed','refund','chargeback','cancel')`, NOT NULL | |
| `mp_status` | text | NOT NULL | the looked-up authoritative status |
| `raw` | JSONB | NOT NULL | the LOOKED-UP resource (never the raw webhook body alone) — audit trail |
| `processed_at` | timestamptz | NOT NULL | |

- Grant-writing events insert here **in the same transaction** as the ledger grant; `ON CONFLICT DO NOTHING`
  on `event_key` = the exactly-once guarantee (SC-703). Status mirroring is a plain idempotent UPSERT on
  `subscriptions` and takes no inbox row.

## §3 `entitlement_grants` — ADDITIVE extension only (ADR-0012 evaluation code unchanged)

- `source` CHECK widens: `('beta','comp')` → `('beta','comp','payment')`.
- New nullable `subscription_id` FK → `subscriptions.id` (audit linkage; NULL for beta/comp).
- **Nothing else changes**: append-only discipline, `revoked_at`, `expires_at`, the
  `read_entitlement_state` derivation, `require_entitlement` / `require_catalog_read` — all verbatim.
- The operator CLI (`grant_premium.py`) is deliberately NOT widened to `payment` (only the verified-event
  writer creates payment grants — Constitution IV).

## §4 Grant-writing rules (the ONE `grant_writer`, MP + Play shared)

| Verified event | Ledger effect (append-only) | Subscription effect |
|---|---|---|
| First/renewal payment (`payment`) | +1 grant: `source=payment`, `expires_at = current_period_end`, `subscription_id` set | status → `authorized`, `current_period_end` updated |
| Failed renewal (`payment_failed`) | **+1 GRACE grant**: `expires_at = period_end + max(MP retry cadence, 7 days)` | status → `grace` |
| Recovery within grace (`payment`) | +1 real period grant (normal rule above) | status → `authorized` |
| Grace exhaustion | **no write** — the grace grant expires naturally → expiry-driven lapse (ADR-0012 verbatim) | status → `paused` (mirrored) |
| Cancel | **no ledger write** — existing grant's `expires_at` stands; natural lapse at period end (FR-707/Q10) | status → `cancelled` (at MP), period preserved |
| Refund / chargeback | `revoked_at` set on the active **payment** grant (append-only revoke) → immediate lapse | status mirrored; courtesy grants untouched |

> **The grace mechanism is the D7 resolution** (seguranca round): FR-708's "active past period end" is an
> append-only grace grant, never a mutation, never a derivation change — SC-709 holds by construction.

## §5 State machine — `subscriptions.status` (mirrored from authoritative lookups)

```
pending ──authorized_payment──► authorized ──payment_failed──► grace ──recovery──► authorized
   │                                │                            │
   │ (abandoned: stays pending,     │ cancel (MP, period end)    │ grace exhaustion
   │  no grant ever written)        ▼                            ▼
   └──────────────────────────► cancelled                     paused
```

- `pending` with no grant = abandoned checkout — indistinguishable from never-started (US2.2); reaped by
  reconciliation marking stale pendings `deleted_at` (tuning at implementation).
- Every transition is driven by a **looked-up** state, never by the webhook body and never by the client.

## §6 Invariants the suite pins (the failing-first spine)

- VR-701: no route, model, or migration ever stores card/PAN/CVV (schema-level: the columns do not exist;
  test greps the wire fixtures too).
- VR-702: same `event_key` N times → 1 grant, 1 inbox row (SC-703).
- VR-703: an event for subscription X can never write a grant for account Y (join is server-side by
  `subscription_id` → `owner_uid`, request-supplied uids ignored).
- VR-704: replay of an OLD valid payment event never extends entitlement (its `event_key` is already inbox'd).
- VR-705: sandbox-signed / `live_mode`-mismatched events are rejected before any DB touch (SEC-402).
- VR-706: cancel writes nothing to the ledger; expiry does the lapse; 0 rows deleted (SC-704).
- VR-707: grace grant present ⇒ active; exhaustion ⇒ lapse via expiry only (FR-708/SC-709).
- VR-708: refund/chargeback revoke is idempotent + never touches `beta|comp` grants (SC-710).
- VR-709: with `P3D_PLAY_BILLING_ENABLED=False`, every Play route is unreachable server-side (SC-711).
- VR-710: the operator CLI still rejects `source=payment` (writer separation, Constitution IV).
