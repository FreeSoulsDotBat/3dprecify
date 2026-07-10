# Data Model: E2 — catalog + persistence + entitlement scaffolding

**Feature**: `007-e2-catalog-entitlement` · **Artifact**: Phase-1 data model (speckit) · **Status**: DRAFT —
proposed for owner sign-off (Principle VIII; this document is never finalized unilaterally).

**Scope**: the FIRST database of the project. No schema exists today. This models the entities behind
FR-301..313 and the Key Entities: **account identity**, **entitlement grants**, **filaments**, **printers**,
**products** (live-recompute with reference + last-known fallback). The **catalog read cache** is a device-local
IndexedDB copy, NOT a server table — it is out of this server-side model (owned by the web layer, Q2).

> **This document is ORM-agnostic.** It specifies logical entities, physical SQL types, constraints, defaults,
> relationships and state transitions. The data-access library (SQLAlchemy/Alembic per ADR-0004) and the
> migration tool wiring are the arquiteto's call; nothing here depends on a specific ORM. Every structural choice
> the spec left open is presented below as **options + a recommendation + confidence %**, per Principle VIII.

---

## 0. Conventions (authoritative for this model)

| Topic | Decision | Source |
|---|---|---|
| DB casing | `snake_case` columns/tables | convention (product/UX); wire stays `camelCase` |
| Wire casing | `camelCase` via Pydantic `alias_generator=to_camel` (`cost_per_roll` ⇄ `costPerRoll`) | ADR-0002 |
| Timestamps | `timestamptz`, UTC, `created_at` / `updated_at` (default `now()`), `deleted_at` nullable | ADR-0004 |
| Catalog PK | native `uuid`, UUIDv7 (time-sortable). App-generated if the target Postgres lacks `uuidv7()` (< PG18) | ADR-0004 · flag A41 |
| Account PK | the Firebase `uid` string (external identity — NOT a uuid) | derived |
| Tenant key | `owner_uid` on every owned row; every query filters it (app-layer helper) + RLS backstop | ADR-0004 · FR-307 |
| Enums | `text` + `CHECK (col IN (...))`, NOT native Postgres `ENUM` (migration-friendly, no exotic feature) | recommend |
| No exotic features | plain tables/indexes/CHECK/partial-unique/RLS only — Cloud-SQL-portable | Q6 · A41 |

### 0.1 Type domains (reused below)

Money follows ADR-0004 / ADR-0008 (`Decimal`, `ROUND_HALF_UP`, one money truth front-to-back — see D5):

| Domain | SQL type | Used for |
|---|---|---|
| `MONEY_SETTLED` | `NUMERIC(12,2)` | BRL amounts settled to the centavo: `cost_per_roll`, `machine_value`, marketplace `fixed_fee`/`min_per_item`/`freight_cost`, other-cost `value` |
| `MONEY_RATE` | `NUMERIC(18,6)` | R$ per unit (ADR-0004 unit-rate bucket): `tariff_per_kwh`, `finish_rate_per_hour`, `labor_rate_per_hour`, `maintenance_reserve_per_hour` |
| `QTY_G` | `NUMERIC(12,3)` | grams: `print_grams`, `waste_grams`, `default_waste_grams` |
| `QTY_H` | `NUMERIC(9,3)` | hours: `print_time_hours`, `finish_time_hours`, `labor_hours`, `machine_lifetime_hours` |
| `QTY_KG` | `NUMERIC(9,3)` | kilograms: `roll_weight_kg` |
| `QTY_KW` | `NUMERIC(9,4)` | kilowatts: `avg_power_kw` |
| `PERCENT` | `NUMERIC(6,3)` | 0–100 percentages: `failure_pct`, `markup_varejo_pct`, `markup_atacado_pct`, channel `commission_pct` |

> **Byte-identical invariant (SC-305/FR-308/FR-313):** stored precision ≥ input precision for every field, so a
> catalog value round-trips losslessly to the same JS number a manual entry produces. Because catalog pre-fill
> feeds the **unmodified** `pricing-core` engine the identical numeric inputs, byte-identical prices hold **by
> construction** — the schema's only job is a lossless round-trip.

---

## 1. Modeling decisions (options + recommendation) — for owner/arquiteto sign-off

### D1 — Account identity: is there a `users`/`accounts` table? (Firebase uid as key)

- **Option A — no table; `owner_uid` string everywhere.** Catalog + entitlement rows carry the raw Firebase uid;
  no FK target. Pros: leanest; matches ADR-0004 "`owner_uid` on every owned row". Cons: no referential
  integrity; no home for email / `last_seen`; entitlement audit floats free. Scalability: medium. **Conf 45%.**
- **Option B — thin `accounts` table (uid PK), JIT-provisioned on first authenticated request; catalog +
  entitlements FK to it. — RECOMMENDED.** Pros: one home for identity/email/`last_seen`; FK integrity; clean
  entitlement subject; still keeps `owner_uid` column on catalog for the ADR-0004 tenant/RLS pattern. Cons: JIT
  provisioning step (idempotent upsert from claims, before any catalog write). Scalability: high. **Conf 72%.**
- **Option C — hybrid: `accounts` exists for entitlement + email, but catalog carries `owner_uid` with NO hard
  FK** (looser coupling; app filter + RLS only). Pros: catalog writes independent of provisioning order. Cons:
  weaker integrity; orphan rows possible. Scalability: high. **Conf 58%.**

**Recommendation: B.** JIT-provision the `accounts` row (upsert `uid`, `email` from verified claims) at the start
of every authenticated request; catalog/entitlement FK to it. **Grant-before-sign-in (email-addressed grant for
a beta seller who has not signed in yet)** is a real question the spec left implicit — see D2 and §12.

### D2 — Entitlement storage: audit ledger vs current-flag; grant-before-sign-in

- **Option A — single mutable `entitlements` row per account** (`is_premium`, `expires_at`, `revoked_at`). Pros:
  fast lookup. Cons: re-grant loses history; audit needs a separate log anyway. **Conf 40%.**
- **Option B — append-only grant ledger (`entitlement_grants`); current premium = derived query. —
  RECOMMENDED.** Each grant is a row (source/grantor/expiry); revoke annotates the active row
  (`revoked_at`/`revoked_by`); re-grant = new row. Pros: fully auditable (who/when/source/expiry — FR-303);
  re-grant "restores" naturally (FR-311); **remains the source-of-truth/audit whatever TD-005 decides** (token
  claim, per-request read, or hybrid — see D5/§13). Cons: "is this account premium now?" is a small `EXISTS`
  query, not a column read (mitigated by an index; or cached in a claim per TD-005). Scalability: high. **Conf 74%.**
- **Option C — event-sourced (separate grant + revoke event rows).** Pros: purest audit. Cons: over-ceremony for
  a binary flag pre-E6; more read logic. **Conf 48%.**

**Recommendation: B.** *Current premium* = `EXISTS(grant WHERE subject = account AND revoked_at IS NULL AND
(expires_at IS NULL OR expires_at > now()))`. **Grant-before-sign-in**: keep E2 literal (grant requires an
existing account, FR-303 "specific account"); the ledger is forward-compatible with email-addressed pending
grants via a later nullable `subject_email` + reconciliation — **do not build reconciliation now** (YAGNI); flag
it in §12.

### D3 — Product reference + last-known fallback (US6 scenario 4)

- **Option A — FK nullable + per-field typed "resolved value" columns on the product. — RECOMMENDED.**
  `filament_id`/`printer_id` are nullable links; the product also carries typed columns mirroring every
  referenced field. **Resolution rule:** link present → authoritative source is the **live** referenced row
  (reference semantics, US6-3, refresh columns as a cache); link NULL (degraded) → the columns are the
  **authoritative, editable** source (US6-4). Pros: typed + `CHECK`-constrained money/qty; a `CHECK` guarantees
  the product is never blank; no JSON money. Cons: ~7 extra columns. Scalability: high. **Conf 73%.**
- **Option B — FK nullable + a single JSONB `last_known` blob** captured at delete time. Pros: fewer columns.
  Cons: money-in-JSON (float/precision risk), no DB CHECK, opaque. **Conf 47%.**
- **Option C — copy-on-save (denormalize, no live FK).** Rejected: breaks US6-2/US6-3 live-recompute (edits to
  the filament would NOT reflect on reopen). **Conf 20%.**

**Recommendation: A.** A product **must always resolve** a full filament + printer field set: `CHECK ((filament_id
IS NOT NULL) OR (filament_material IS NOT NULL AND filament_cost_per_roll IS NOT NULL AND filament_roll_weight_kg
IS NOT NULL))` and the printer analogue — this enforces "never a broken/blank product" (US6-4) at the DB.

### D4 — `channels[]` and `otherCosts[]`: JSONB vs normalized child tables

- **Option A — JSONB columns on `products`, validated by pydantic (mirroring the calculator's per-slot Zod). —
  RECOMMENDED with a caveat.** Pros: leanest; lists are tiny + bounded, shape already validated by the SAME
  schema the calculator uses, always read/written whole, no relational query planned. Cons: **money inside JSON
  must be stored as decimal STRINGS** (not JSON floats) to preserve fidelity; no DB `CHECK`. Scalability:
  adequate. **Conf 64%.**
- **Option B — normalized child tables (`product_channels`, `product_other_costs`).** Pros: typed `NUMERIC`
  money + `CHECK` (FR-306 at DB level); relational if ever needed. Cons: 2 extra tables + joins for a list that
  is never queried relationally; over-normalization. Scalability: high but unneeded. **Conf 55%.**
- **Option C — JSONB with JSON-native numbers.** Rejected: violates "money never float" (ADR-0008). **Conf 25%.**

**Recommendation: A (JSONB, money as decimal strings, pydantic-validated on write).** This is a
structure/normalization + money-representation call — explicitly flagged for the arquiteto (§13); switch to B if
DB-level money constraints on sub-costs become required.

### D5 — Money representation in the DB

- **Option A — `NUMERIC(12,2)` settled / `NUMERIC(18,6)` unit rate, `Decimal`, `ROUND_HALF_UP`. — RECOMMENDED.**
  Pros: **one money truth** end-to-end (matches ADR-0008 pricing-core `decimal.js-light` 2dp HALF_UP and ADR-0004
  DB rule); no float; DB-native decimal arithmetic; human-readable; ISO-4217 currency column. **Conf 82%.**
- **Option B — integer centavos (`BIGINT`).** Pros: exact, no rounding drift. Cons: the engine is **rate-heavy**
  (R$/g, R$/h, R$/kWh, kW) — rates are NOT whole centavos, so a decimal step is still needed and cents only move
  the rounding downstream; ADR-0008 **already rejected this (Option 2C)** for exactly this reason. Adopting it
  here would create a SECOND, conflicting money story. **Conf 35%.**
- **Option C — `float`/`double`.** Rejected outright — money never float; violates ADR-0004/0008 + FR-306. **Conf 8%.**

**Recommendation: A**, for one money truth consistent with the ratified pricing-core policy. All BRL amounts carry
an ISO-4217 currency (`BRL`) — v1 is single-currency, so a single account/row-level `currency` default of `BRL`
(not per-money-column) is sufficient; a per-column currency is deferred (YAGNI).

### D6 — Deletion of catalog items (voluntary) — hard vs soft

- **Option A — soft-delete (`deleted_at`) + partial unique index. — RECOMMENDED.** Pros: matches ADR-0004
  ratified pattern; makes US6-4 last-known capture trivial (row still exists to copy from); reversible; audit;
  referential safety. Cons: every read must filter `deleted_at IS NULL`. Scalability: high. **Conf 70%.**
- **Option B — hard-delete + `ON DELETE SET NULL` on product FKs.** Pros: simplest; voluntary delete has no
  stated recovery requirement. Cons: diverges from ADR-0004 soft-delete; last-known must be captured in the same
  txn or it is lost. **Conf 55%.**

**Recommendation: A.** Voluntary delete = the app, in one transaction, (1) writes last-known values into every
referencing product's resolved-value columns + sets `filament_id`/`printer_id` = NULL (unlink), (2) sets the
item's `deleted_at`. Physical FK is `ON DELETE SET NULL` as a backstop for any future hard purge. **Q3 forbids
delete-by-LAPSE, not voluntary delete** — voluntary delete stays available to premium; the read-only freeze
(§4/§9) blocks it for lapsed accounts like any other write.

---

## 2. Entities

### 2.1 `accounts` — account identity (D1: Option B)

JIT-provisioned from verified Firebase claims. Home for identity + entitlement/catalog FK.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `account_uid` | `text` | **PK** | — | Firebase `uid` (external identity) |
| `email` | `text` | nullable | — | from claims; display + future email-grant reconciliation |
| `currency` | `text` | `NOT NULL`, `CHECK (currency = 'BRL')` | `'BRL'` | ISO-4217; single-currency v1 |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | first authenticated request |
| `updated_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `last_seen_at` | `timestamptz` | nullable | — | refreshed per authenticated request |

*No `is_premium` column here* — premium is derived from `entitlement_grants` (D2), so there is a single source
of truth and no drift.

### 2.2 `entitlement_grants` — premium grant ledger (D2: Option B)

The server-side authority + audit trail for every persistence decision. **Source of truth regardless of TD-005**
(if premium is mirrored into a Firebase custom claim, this table is what the claim is derived from and audited
against — see §13).

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | **PK** | UUIDv7 | |
| `account_uid` | `text` | `NOT NULL`, **FK → accounts(account_uid)**, indexed | — | grant subject (existing account, FR-303) |
| `source` | `text` | `NOT NULL`, `CHECK (source IN ('beta','comp'))` | — | US2-3 |
| `granted_by` | `text` | `NOT NULL` | — | operator identifier (uid/email); FR-303 operator-only |
| `granted_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `expires_at` | `timestamptz` | nullable | — | optional expiry; NULL = no expiry |
| `revoked_at` | `timestamptz` | nullable | — | set on revoke |
| `revoked_by` | `text` | nullable | — | operator who revoked |
| `note` | `text` | nullable | — | free-text (e.g. "beta wave 1") |
| `created_at` | `timestamptz` | `NOT NULL` | `now()` | |

- **Current premium(account)** = `EXISTS(grant WHERE account_uid = :uid AND revoked_at IS NULL AND (expires_at IS
  NULL OR expires_at > now()))`.
- **Revoke** = `UPDATE` the active grant `SET revoked_at, revoked_by` (history preserved).
- **Re-grant** = `INSERT` a new grant row (FR-311 "re-grant restores"; the same catalog data becomes writable).
- Partial index `(account_uid) WHERE revoked_at IS NULL AND expires_at IS NULL` (+ a broader `(account_uid,
  expires_at)`) makes the current-premium check cheap.

### 2.3 `filaments` (FR-305) — feeds `costPerRoll` / `rollWeightKg` / `material` / default waste

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | **PK** | UUIDv7 | |
| `owner_uid` | `text` | `NOT NULL`, **FK → accounts(account_uid)**, indexed | — | tenant key (FR-307) |
| `name` | `text` | `NOT NULL`, `CHECK (length(btrim(name)) > 0)` | — | e.g. "PLA Azul" |
| `material` | `text` | nullable | — | material label (e.g. "PLA") |
| `cost_per_roll` | `MONEY_SETTLED` | `NOT NULL`, `CHECK (cost_per_roll >= 0 AND cost_per_roll <> 'NaN')` | — | `costPerRoll` |
| `roll_weight_kg` | `QTY_KG` | `NOT NULL`, `CHECK (roll_weight_kg > 0)` | — | `rollWeightKg`; divisor ⇒ strictly > 0 |
| `default_waste_grams` | `QTY_G` | `NOT NULL`, `CHECK (default_waste_grams >= 0 AND default_waste_grams <> 'NaN')` | `0` | optional default waste |
| `created_at` / `updated_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `deleted_at` | `timestamptz` | nullable | — | soft-delete (D6) |

### 2.4 `printers` (FR-305) — feeds `machineValue` / `machineLifetimeHours` / `avgPowerKw` / maintenance

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | **PK** | UUIDv7 | |
| `owner_uid` | `text` | `NOT NULL`, **FK → accounts**, indexed | — | tenant key |
| `name` | `text` | `NOT NULL`, `CHECK (length(btrim(name)) > 0)` | — | e.g. "Ender 3" |
| `machine_value` | `MONEY_SETTLED` | `NOT NULL`, `CHECK (machine_value >= 0 AND machine_value <> 'NaN')` | — | `machineValue` |
| `machine_lifetime_hours` | `QTY_H` | `NOT NULL`, `CHECK (machine_lifetime_hours > 0)` | — | divisor ⇒ strictly > 0 |
| `avg_power_kw` | `QTY_KW` | `NOT NULL`, `CHECK (avg_power_kw >= 0 AND avg_power_kw <> 'NaN')` | — | effective average draw (A16.2) |
| `maintenance_reserve_per_hour` | `MONEY_RATE` | `NOT NULL`, `CHECK (maintenance_reserve_per_hour >= 0 AND maintenance_reserve_per_hour <> 'NaN')` | `0` | optional reserve (ADR-0009) |
| `created_at` / `updated_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `deleted_at` | `timestamptz` | nullable | — | soft-delete |

### 2.5 `products` (FR-310) — live-recompute, reference + last-known fallback (D3: Option A)

Stores the **piece inputs** that belong to neither filament nor printer, plus nullable links to one filament +
one printer, plus the resolved-value columns (cache while linked / editable when degraded), plus JSONB
`channels` + `other_costs` (D4).

**Piece inputs (product-owned):**

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | **PK** | UUIDv7 | |
| `owner_uid` | `text` | `NOT NULL`, **FK → accounts**, indexed | — | tenant key |
| `name` | `text` | `NOT NULL`, `CHECK (length(btrim(name)) > 0)` | — | e.g. "Vaso G" |
| `print_grams` | `QTY_G` | `NOT NULL`, `CHECK (print_grams >= 0 AND print_grams <> 'NaN')` | — | `printGrams` |
| `waste_grams` | `QTY_G` | `NOT NULL`, `CHECK (waste_grams >= 0 AND waste_grams <> 'NaN')` | `0` | `wasteGrams` (pre-fills from filament default, editable) |
| `print_time_hours` | `QTY_H` | `NOT NULL`, `CHECK (print_time_hours >= 0 AND print_time_hours <> 'NaN')` | — | `printTimeHours` |
| `tariff_per_kwh` | `MONEY_RATE` | `NOT NULL`, `CHECK (tariff_per_kwh >= 0 AND tariff_per_kwh <> 'NaN')` | — | `tariffPerKwh` — see §11 tension (no filament/printer home) |
| `failure_pct` | `PERCENT` | `NOT NULL`, `CHECK (failure_pct >= 0 AND failure_pct <> 'NaN')` | `0` | `failurePct` |
| `finish_time_hours` | `QTY_H` | `NOT NULL`, `CHECK (finish_time_hours >= 0 AND finish_time_hours <> 'NaN')` | `0` | `finishTimeHours` |
| `finish_rate_per_hour` | `MONEY_RATE` | `NOT NULL`, `CHECK (finish_rate_per_hour >= 0 AND finish_rate_per_hour <> 'NaN')` | `0` | `finishRatePerHour` |
| `labor_hours` | `QTY_H` | `NOT NULL`, `CHECK (labor_hours >= 0 AND labor_hours <> 'NaN')` | `0` | `laborHours` |
| `labor_rate_per_hour` | `MONEY_RATE` | `NOT NULL`, `CHECK (labor_rate_per_hour >= 0 AND labor_rate_per_hour <> 'NaN')` | `0` | `laborRatePerHour` |
| `markup_varejo_pct` | `PERCENT` | `NOT NULL`, `CHECK (markup_varejo_pct >= 0 AND markup_varejo_pct <> 'NaN')` | — | `markupVarejoPct` (UX pre-fill 50, but stored per save) |
| `markup_atacado_pct` | `PERCENT` | `NOT NULL`, `CHECK (markup_atacado_pct >= 0 AND markup_atacado_pct <> 'NaN')` | — | `markupAtacadoPct` |
| `include_marketplace` | `boolean` | `NOT NULL` | `true` | US4 show/hide toggle (pure visibility, no `includeInHeadline` — 005) |
| `channels` | `jsonb` | `NOT NULL` | `'[]'` | D4; validated per-slot on write (§2.5.1) |
| `other_costs` | `jsonb` | `NOT NULL` | `'[]'` | D4; "Outros custos" list (§2.5.2) |
| `created_at` / `updated_at` | `timestamptz` | `NOT NULL` | `now()` | |
| `deleted_at` | `timestamptz` | nullable | — | soft-delete |

**Filament reference + resolved values (D3):**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `filament_id` | `uuid` | nullable, **FK → filaments(id) ON DELETE SET NULL**, indexed | link; NULL ⇒ degraded/editable |
| `filament_material` | `text` | nullable | resolved/last-known label |
| `filament_cost_per_roll` | `MONEY_SETTLED` | nullable, `CHECK (… >= 0 AND <> 'NaN')` | resolved/last-known |
| `filament_roll_weight_kg` | `QTY_KG` | nullable, `CHECK (… > 0)` | resolved/last-known (divisor) |

**Printer reference + resolved values (D3):**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `printer_id` | `uuid` | nullable, **FK → printers(id) ON DELETE SET NULL**, indexed | link; NULL ⇒ degraded/editable |
| `printer_machine_value` | `MONEY_SETTLED` | nullable, `CHECK (… >= 0 AND <> 'NaN')` | resolved/last-known |
| `printer_machine_lifetime_hours` | `QTY_H` | nullable, `CHECK (… > 0)` | resolved/last-known (divisor) |
| `printer_avg_power_kw` | `QTY_KW` | nullable, `CHECK (… >= 0 AND <> 'NaN')` | resolved/last-known |
| `printer_maintenance_reserve_per_hour` | `MONEY_RATE` | nullable, `CHECK (… >= 0 AND <> 'NaN')` | resolved/last-known |

**Never-blank invariant (US6-4) — table-level CHECKs:**

```
CHECK (filament_id IS NOT NULL
       OR (filament_material IS NOT NULL      -- degraded ⇒ full editable snapshot present
           AND filament_cost_per_roll IS NOT NULL
           AND filament_roll_weight_kg IS NOT NULL))
CHECK (printer_id IS NOT NULL
       OR (printer_machine_value IS NOT NULL
           AND printer_machine_lifetime_hours IS NOT NULL
           AND printer_avg_power_kw IS NOT NULL
           AND printer_maintenance_reserve_per_hour IS NOT NULL))
```

**Resolution rule (read/compute):** `filament_id` present ⇒ authoritative source is the **live** `filaments` row
(US6-3 reflects edits); the resolved columns are a refreshable cache. `filament_id` NULL ⇒ resolved columns are
authoritative + editable (US6-4). Same for printer. At create, both FKs are `NOT NULL` (product references saved
items, FR-310); they become NULL only via the delete-degradation path (§5). The resolved columns MUST be written
(a) at product create/update (snapshot the current ref) and (b) in the referenced-item deletion txn (last-known).

#### 2.5.1 `channels` JSONB item shape (validated by pydantic on write; money as decimal strings)

```
{ "marketplace": "MERCADO_LIVRE|SHOPEE|AMAZON|OUTRO",
  "modality":    "CLASSICO|PREMIUM|PROFISSIONAL|INDIVIDUAL|"" ,   // ""/absent when marketplace has none
  "commissionPct": "12.5",   "fixedFee": "6.00",
  "minPerItem":    "1.00",   "freightCost": "0.00" }              // money/percent as decimal STRINGS
```
App-layer validation mirrors the calculator's per-slot rules (`commissionPct` in `[0,100)`, others `>= 0`,
finite) so one bad slot errors only itself (005 SC-107). Empty list `[]` = "sem marketplaces".

> **Refinement (2026-07-10, T029/T030):** every fee field is **nullable** (`null` = blank). In the calculator
> a BLANK fee means "resolve from the live fee catalog"; persisting a fabricated `0` would freeze today's fee
> and silently override the catalog on reopen. This follows directly from this section's own premise —
> "channels[] = the same shapes the calculator form uses" — the calculator form allows blank fees. A present
> value validates exactly as specified above.

#### 2.5.2 `other_costs` JSONB item shape

```
{ "name": "Embalagem", "value": "3.50" }   // free-text name (blank allowed ⇒ generic label FR-116); value >= 0, finite, string
```

---

## 3. Relationships

```
accounts (1) ──< (N) entitlement_grants        [account_uid]      audit/authority
accounts (1) ──< (N) filaments                 [owner_uid]        tenant-owned
accounts (1) ──< (N) printers                  [owner_uid]        tenant-owned
accounts (1) ──< (N) products                  [owner_uid]        tenant-owned
filaments (0..1) ──< (N) products              [filament_id, ON DELETE SET NULL]
printers  (0..1) ──< (N) products              [printer_id,  ON DELETE SET NULL]
products  (1) ──has── channels[] / other_costs[]  (JSONB, embedded — not FK)
```

All FKs are same-tenant by construction: a product's `filament_id` must reference a filament with the same
`owner_uid` (enforced app-side in the write path; §6 VR-08).

---

## 4. Freeze semantics (Q3 / A27 / FR-311) — how read-only expresses

- **Option A — nothing in the schema; freeze is a request-time authorization decision. — RECOMMENDED (Conf 85%).**
  On lapse (revoke or `expires_at` passed), the authorization layer denies create/edit/delete while allowing
  read/pre-fill of the account's own retained rows. **No row is touched** — no `frozen` column, no sweep, no
  auto-delete. Re-grant = a new `entitlement_grants` row instantly restores write access to the same data.
- **Option B — a `frozen`/state column per account or per row flipped on lapse.** Rejected: derivable, invites
  drift, requires a write-on-lapse sweep, and contradicts "data is never auto-modified on lapse". **Conf 20%.**

**Recommendation: A.** The freeze lives entirely in authorization (§9), not in the schema. This is why there is
**no** lapse-related column anywhere above — the correct schema footprint of Q3 is **zero**.

---

## 5. Deletion & cascade behavior

| Action | Behavior |
|---|---|
| Delete filament/printer (voluntary, premium) | Soft-delete (`deleted_at`); in the **same txn**: write last-known values into every referencing product's resolved columns + set that product's `filament_id`/`printer_id` = NULL. Warn the user first (US6-4). Item disappears from listings/pre-fill (US3). |
| Delete filament/printer (lapsed account) | **Denied** — read-only freeze (§4); `ENTITLEMENT_REQUIRED`. |
| Delete product (voluntary, premium) | Soft-delete (`deleted_at`). No cascade upward. |
| Physical FK `ON DELETE SET NULL` | Backstop for any future hard purge — never orphans/blocks a product (US6-4 "never a broken product"). |
| Cascade of an account deletion | **Out of scope** (full LGPD self-service deletion deferred, spec Out of Scope). No `ON DELETE CASCADE` from `accounts` is wired in E2. |

---

## 6. Data-level validation rules (FR-306) — mirror the calculator

**Strategy: BOTH layers.** App-layer pydantic/Zod (single source of the pt-BR per-field messages, mirroring
`calculator-schema.ts`) is the primary/user-facing validation; DB `CHECK` constraints are defense-in-depth so a
bad value can **never** be stored even by a non-UI writer (FR-306). Recommended over app-only, because this is
the first DB and the persisted contract must be self-protecting.

- **VR-01** Every numeric column is `NOT NULL` (optionals default `0`; required inputs have no default).
- **VR-02** No `NaN`/`Infinity`: `NUMERIC` cannot store `Infinity`; `'NaN'::numeric` IS accepted by Postgres and
  sorts **greater** than all numbers, so `CHECK (col >= 0)` does **not** reject it — hence every numeric CHECK
  explicitly adds `AND col <> 'NaN'` (or a bounded `BETWEEN`). This closes the "NaN into a calculation" edge.
- **VR-03** Divisors strictly positive: `roll_weight_kg > 0`, `machine_lifetime_hours > 0` (+ their resolved
  copies on `products`) — mirrors the calculator's `positive` rule.
- **VR-04** Non-negative elsewhere: costs/quantities/percents `>= 0`.
- **VR-05** Percent bounds: markups/failure `>= 0`; channel `commissionPct` in `[0,100)` (gross-up `1 − pct`
  undefined at 100%) — enforced app-side for JSONB slots (§2.5.1); DB `CHECK` if child tables are chosen (D4-B).
- **VR-06** `name` non-empty after trim.
- **VR-07** `source ∈ {beta,comp}`; `marketplace ∈ {MERCADO_LIVRE,SHOPEE,AMAZON,OUTRO}`; `modality ∈
  {CLASSICO,PREMIUM,PROFISSIONAL,INDIVIDUAL,""}` and consistent with its marketplace.
- **VR-08** Same-tenant references: on product write, `filament_id`/`printer_id` must resolve to a non-deleted row
  with the same `owner_uid` (app-layer; FR-307). A cross-tenant reference is rejected, never silently dropped.
- **VR-09** JSONB shape: `channels`/`other_costs` validated against §2.5.1/§2.5.2 before write; monetary values
  stored as decimal strings and re-parsed with the money policy (ADR-0008) — never as JSON floats.

> **Test-first (model invariants):** each VR above gets a failing-first test (pydantic + a DB-constraint probe),
> including the numeric edge cases: `NaN`, `Infinity`, `-0`, `0` divisors, `100%` commission, and the
> byte-identical round-trip (store → read → format → same number). This is the "test-first for model invariants"
> obligation.

---

## 7. Indices & isolation (FR-307 — absolute per-account isolation)

Isolation is enforced at **three** layers (defense-in-depth, ADR-0004):

1. **Query layer (mandatory):** a repository helper injects `owner_uid = :current_uid` into **every** catalog
   read/write. No path may omit it (audited like FR-301). `current_uid` comes from the verified token, never the
   client body.
2. **RLS backstop (phase 2):** `ENABLE ROW LEVEL SECURITY` + a policy `USING (owner_uid = current_setting(
   'app.current_uid'))` on `filaments`/`printers`/`products`; the request sets the GUC per connection. Standard
   Postgres — Cloud-SQL-portable. Phasing (app-layer first vs RLS-from-day-1) is a plan call (§13).
3. **Type layer:** `owner_uid` is a FK to `accounts` — a write for a non-existent account fails.

**Indices:**

| Table | Index | Purpose |
|---|---|---|
| `filaments` | `(owner_uid) WHERE deleted_at IS NULL` | list/pre-fill per account (isolation + hot path) |
| `printers` | `(owner_uid) WHERE deleted_at IS NULL` | same |
| `products` | `(owner_uid) WHERE deleted_at IS NULL` | same |
| `products` | `(filament_id) WHERE filament_id IS NOT NULL` | find referencing products at filament delete (§5) |
| `products` | `(printer_id) WHERE printer_id IS NOT NULL` | same for printer |
| `entitlement_grants` | `(account_uid, expires_at)` + partial `(account_uid) WHERE revoked_at IS NULL AND expires_at IS NULL` | current-premium check (D2) |
| all catalog | optional partial-unique `(owner_uid, lower(btrim(name))) WHERE deleted_at IS NULL` | **optional** dedupe (spec does not require unique names — enable only if the owner wants it) |

---

## 8. Wire ⇄ DB field mapping (representative)

| DB (snake_case) | Wire (camelCase) | Entity |
|---|---|---|
| `cost_per_roll` | `costPerRoll` | filament |
| `roll_weight_kg` | `rollWeightKg` | filament |
| `default_waste_grams` | `defaultWasteGrams` | filament |
| `machine_value` | `machineValue` | printer |
| `machine_lifetime_hours` | `machineLifetimeHours` | printer |
| `avg_power_kw` | `avgPowerKw` | printer |
| `maintenance_reserve_per_hour` | `maintenanceReservePerHour` | printer |
| `markup_varejo_pct` | `markupVarejoPct` | product |
| `filament_id` / `printer_id` | `filamentId` / `printerId` | product |

Same alias mechanism as the existing envelope/DTOs (ADR-0002); no runtime case-mapping.

---

## 9. Entitlement states & transitions

`ENTITLEMENT_REQUIRED` (403) is the single new wire code (join `ErrorCode` server enum → typed client → pt-BR
message, FR-302). No quota/conflict code (free = zero, premium = unlimited, R3; writes online-only, Q2).

| State | Definition | Create/Edit/Delete | Cloud read of own data | Calculator pre-fill | Data fate |
|---|---|---|---|---|---|
| **none** (free / signed-out; never granted) | no active grant, no data | ❌ `ENTITLEMENT_REQUIRED` | ❌ (nothing to read; denied) | ❌ (only honest teaser US7) | — |
| **granted** (active premium) | active `entitlement_grants` row | ✅ | ✅ | ✅ | writable |
| **frozen** (lapsed: revoked or expired, has data) | last active grant revoked/expired | ❌ `ENTITLEMENT_REQUIRED` | ✅ (read-only freeze) | ✅ | retained, never auto-deleted |
| **re-granted** | new active grant after a lapse | ✅ | ✅ | ✅ | same data, writable again |

**Transitions:** `none →(grant)→ granted →(revoke/expiry)→ frozen →(grant)→ re-granted (= granted)`; also
`granted →(revoke before any data)→ none`.

> **⚠ Tension flagged (§11):** the spec calls the flag "**binary**" (US1) yet FR-311 keeps **read** open under
> freeze. So the flag is binary **for writes**, but reads have a freeze exception — the authorization layer has
> **three effective tiers** (active RW / frozen R / none). Free-never-granted read is denied; frozen read is
> allowed on own data. This shapes authorization (not the schema) and must be explicit in the plan/TD-005.

---

## 10. Migrations

- **Strategy:** a single migration **`0001`** creating the whole E2 schema (accounts, entitlement_grants,
  filaments, printers, products + indexes + CHECKs + FKs). One coherent first cut; no incremental churn before
  the first real consumer.
- **Naming:** date-prefixed per ADR-0004 (e.g. `2026-07-xx_0001_e2_catalog_entitlement`), with an Alembic
  `naming_convention` so constraint/index names are deterministic (needed for reversible `downgrade`).
- **Reversible:** `downgrade()` drops the tables (nothing pre-exists — no legacy data to migrate; persisted saves
  begin at E2 per ADR-0008). RLS policies (if enabled in 0001) are dropped in reverse.
- **Cloud-SQL-ready (A41, v1-launch):** no exotic Postgres features — plain tables, `NUMERIC`, `jsonb`, partial
  indexes, `CHECK`, optional RLS. **UUIDv7:** if the target Postgres lacks native `uuidv7()` (< PG18), generate
  app-side and insert into the native `uuid` column — no `uuid-ossp`/`pgcrypto` extension dependency required.
  Built + verified against a **local dev DB** (Q6); cloud provisioning stays deferred.
- **Seeding (dev only):** idempotent script / polyfactory to grant a dev account premium for local homologation;
  no production seed (catalog is the user's private data).

---

## 11. Tensions found with the spec (surface, don't paper over)

1. **Read authorization is not purely "binary"** (§9): frozen accounts retain read (FR-311) while free accounts
   do not (US1) — three effective tiers. Binary holds for writes only. **Owner/plan must confirm** the
   never-granted cloud-read = `ENTITLEMENT_REQUIRED` while frozen-own-read = allowed.
2. **`tariff_per_kwh` has no filament/printer home.** It is a mandatory calculator input but is neither a filament
   nor a printer field, so it is modeled as a **product-owned** input. Key Entities list product inputs as
   "grams, times, finishing, labor, markups" without energy tariff. Confirm: tariff lives on the product (chosen
   here) vs a future account-level "energy settings" (deferred). `avg_power_kw` correctly comes from the printer.
3. **Grant-before-sign-in** (email invite for a beta seller with no uid yet): FR-303 says "specific account"
   (implies exists). Chosen: E2 grants require an existing account; the ledger is forward-compatible with a later
   `subject_email` + reconciliation. Confirm this is acceptable for beta onboarding (§12).
4. **Money inside `channels`/`other_costs` JSONB** (D4-A) has no DB `CHECK` and must be stored as decimal
   strings — a deliberate leanness-vs-DB-money-guarantee trade. Confirm A vs child tables (D4-B).
5. **Products require saved references** (FR-310): a manually-typed filament/printer product (no catalog item) is
   **not** an E2 product path. The calculator still allows fully-manual compute (free, FR-313); it just cannot be
   *saved as a product* without picking a saved filament + printer. Confirm this is the intended E2 boundary.

---

## 12. Grant-before-sign-in — forward path (not built in E2)

If beta onboarding needs email invites before first login, the minimal, reversible extension is: add
`subject_email` (nullable) + make `account_uid` nullable on `entitlement_grants`, with `CHECK (account_uid IS NOT
NULL OR subject_email IS NOT NULL)`, and reconcile `subject_email → account_uid` on first authenticated request
(JIT). **Deferred (YAGNI):** not added in the 0001 schema; a trivial additive migration when/if the owner needs
it. Flagged so the ledger design does not have to change shape later.

---

## 13. Depends on TD-005 / plan (what the arquiteto's ADR can adjust)

This model is designed to be **compatible with any TD-005 outcome**; the plan/ADR may set:

1. **Entitlement current-flag mechanism (TD-005 core):** Firebase **custom claim** (token) vs **per-request DB
   read** vs **hybrid+TTL**. Whichever wins, `entitlement_grants` (§2.2) stays the **source of truth + audit**;
   if a claim is used, a grant/revoke must sync the claim (≤ one refresh, FR-304), and the claim is derived from
   (and reconciled against) the ledger. **Marked dependency — do not remove the ledger.**
2. **Operator identity/authorization:** how "operator" is recognized for FR-303 (allowlist? a role claim?
   separate admin surface?). The ledger records `granted_by`/`revoked_by`; *how* operator status is proven is a
   plan/TD-005 decision, not a schema field.
3. **Coupling of catalog → `accounts`:** hard FK (chosen, D1-B) vs `owner_uid`-only with RLS (D1-C).
4. **RLS phasing (§7):** app-layer filter first vs RLS enabled in migration `0001`.
5. **`channels`/`other_costs` shape (D4):** JSONB (chosen) vs normalized child tables.
6. **ORM/migration tool specifics** (SQLAlchemy 2.0 + Alembic per ADR-0004) — this model is agnostic; the plan
   binds the types/constraints above to concrete ORM declarations.
7. **UUIDv7 generation site** (DB-native vs app-side) tied to the Cloud SQL Postgres version (A41).
8. **Scope confirmations** for the §11 tensions and §12 email-grant.

*Nothing here is finalized until the owner signs off (Principle VIII). All D1–D6 options remain on the table for
that review.*
