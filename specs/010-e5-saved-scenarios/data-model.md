# Data Model — E5 saved marketplace scenarios (the fourth persistent object)

**Feature**: `010-e5-saved-scenarios` · **Artifact**: Phase-1 data model (the SCHEMA / SHAPE lens) ·
**Status**: DRAFT — proposed for owner sign-off (Principle VIII; never finalized unilaterally). The
**mechanism / ADR / contracts / pricing-core verification** are the **arquiteto's** parallel deliverable;
§9 states exactly what this document assumes from / needs from it.

Extends the E2+E3+E4 schema (`backend/app/models/__init__.py`; migrations `0001`, `0002`, `0003`) with
**ONE new table** via Alembic **`0004`** (`down_revision = "0003"`; `0001`/`0002`/`0003` are shipped and
are never amended — ADR-0013 R4, verified: the chain is `0001 → 0002 → 0003` head). Reuses the house
domain types verbatim (`MONEY_SETTLED = Numeric(12,2)`, `NAMING_CONVENTION`, `uuid7` PK default, the
`<> 'NaN'::numeric` value guard) and the `CamelModel` wire layer (money = **decimal strings**, never floats).

> **The one sentence that governs this document (the mirror of E4's two-shelf rule):**
> **A scenario stores the seller's INTENT, not resolved values, and it is MUTABLE.** So it is
> deliberately the *opposite* of an E4 snapshot at the data layer: **no immutability trigger** (the row
> is edited, renamed, re-saved), **no idempotency key / no offline outbox** (writes are online-only, Q4),
> and **no money column at all** on the table — every monetary leaf lives inside the `config` JSONB as a
> decimal string, and **none of them is a resolved price**: they are *inputs and explicit overrides*. The
> live price is recomputed **client-side** on reopen (FR-606/FR-619) and never stored. E5 is **lighter**
> than E4; §1 imports the E4 hybrid-JSONB decision only where it still fits and drops the machinery it
> does not.

---

## 1. Decisions (options, rejections, confidence)

### N1 — The config payload shape · **CHOSEN: hybrid — typed columns for identity/query/order + ONE JSONB `config` document** · **82%**

The crux of the epic, weighed **for a mutable row that WILL be updated** (rename, edit-config, re-save) —
not a write-once frozen document like E4. Compared honestly against the house idiom:

**Option A — fully relational** — `scenarios` + `scenario_channels` + `scenario_other_costs`
(+ `scenario_basis_lines` for a kit cost basis), the E2/E3 `products`/`boms` idiom. Pros: house pattern; DB
`CHECK`s on every money leaf; SQL-queryable. Cons, decisive here:
1. **Nothing queries inside a scenario.** No requirement aggregates over a scenario's channels, joins its
   other-costs, or filters by a fee override. List + search touch only `name`/timestamps. Four tables to
   store one mutable object that is always read whole and recomputed whole is the same over-modeling E4 D1
   rejected — habit, not consistency.
2. **The cost basis is polymorphic (ad-hoc | Product | Kit).** A Kit basis is **multi-piece**; its
   last-known snapshot (D6) is N pieces × a full resolved input set — a fourth table `scenario_basis_lines`
   mirroring `bom_lines`, coupled to an E5 feature. The "typed is stricter" argument collapses at the first
   sub-list, exactly as it did in E4 D1. **Rejected. 30%.**

**Option C — mirror `products` exactly** — typed scalar columns for the ad-hoc piece inputs + `channels`
JSONB + `other_costs` JSONB + cost-basis reference columns (the E2 `products` shape one level up). Pros:
maximal reuse — the ad-hoc basis **is** a `products`-shaped input row, and `channels`/`other_costs` are
literally the `products.channels`/`products.other_costs` JSONB already shipped; the mutable-row argument
(the plan's working-lean) genuinely favors typed columns *for the single-piece ad-hoc case*. **The
decisive weakness: it cannot represent a Kit cost basis.** A scenario's basis can be a **multi-piece Kit**
(FR-606a); typed single-piece columns hold one piece, so Option C **degenerates into Option C + a
`scenario_basis_lines` table** for the kit branch — half typed, half relational, inconsistent, and it drags
back the same sub-list collapse. It also splits one intent across ~20 columns + 2 JSONB arrays + a
discriminated basis, so an edit is a multi-surface write on a row that is read whole. **Rejected. 45%** —
right for `products` (a single-piece live template that IS partially queried), wrong for a
polymorphic-basis strategy object.

**Option B (CHOSEN) — hybrid.** Typed columns for exactly what the DB must **query, order, constrain or
index** (owner, name, note, timestamps, soft-delete, the config-envelope version) + **one
`config JSONB NOT NULL`** holding the full intent (the cost basis — ad-hoc **or** a soft reference **plus**
its last-known snapshot — the channel set, the explicit per-slot fee **overrides**, the framing flag, the
Outros custos). Pros:
- **The polymorphic, multi-piece cost basis is native** — a discriminated `costBasis.kind` with a nested
  single `PriceInput` **or** kit `lines[]`, no fourth table, no `ALTER` when the intent shape grows a
  determinant/framing option/fee field.
- **The intent shape stays uncoupled from the live formula.** Because the scenario stores **intent, not a
  resolved `PriceResult`** (Q3/FR-602), the JSONB holds the smaller, more stable "what the seller chose"
  set — and a future pricing-core version resolves values live on reopen without touching a stored row.
  (This is why N1's confidence is *slightly below* E4's 85%: the "no ALTER per formula change" leg is
  **weaker** here — the intent shape is stable either way — so the win rests mainly on the polymorphic
  basis + the read-whole access pattern, not on formula-drift immunity.)
- **The query surface is fully typed and indexable** (`name` search, keyset order — §5); money exactness is
  preserved by the string rule below.

Cons, stated openly: the DB cannot `CHECK` a money leaf inside `config` (mitigated: §8 VR-602/603 app-layer
validator + the string invariant + one JSONB↔column version `CHECK` in §4); and — **the one operational
difference from E4** — because the row is **mutable**, the money-string + structural validators must run on
**every write (INSERT *and* UPDATE)**, not once at record time. **82%.**

> **Money in JSONB — how decimals are preserved (the inherited house invariant).** Postgres `jsonb` stores
> JSON numbers as `numeric`, so the **database** would not lose precision — the loss is at the **serializer
> boundary**: Python's `json.loads` and JS `JSON.parse` both map a JSON number to **binary64**, silently,
> app-side. So the invariant `products.channels` and `snapshots.payload` already obey carries in verbatim:
>
> **Every money / rate / quantity / percent leaf in `config` is a JSON *string* in canonical decimal form
> (`"12.50"`, `"0.00"`). The only JSON numbers permitted are true integer counts (`schemaVersion`,
> `quantity`).** The house write path already does this — `products.py` dumps each slot with
> `model_dump(mode="json", by_alias=True)`, which serializes `Decimal → str`; E5 reuses that exact idiom.

### N2 — Cost-basis reference storage + the D3/D6 seam · **CHOSEN: soft reference `{kind,id,name}` in `config` + a `lastKnown` snapshot refreshed on every save; NO FK; read-time resolve/degrade** · **85%**

Q2 is resolved: cost basis = **both** ad-hoc **or** a Product/Kit reference. The reference must live-reflect
(D3) and degrade to last-known (D6). Options for storing it:

- **Option A (CHOSEN) — soft reference inside `config`, read-time resolve, re-snapshot on every save (the E3
  kit-line pattern, ADR-0017 §6 verbatim).** `config.costBasis = { kind, ref: {id,name}|null, lastKnown }`.
  On reopen the resolver reads the ref **owner-scoped + `deleted_at IS NULL`** (the E3 `_resolve_views`
  filter): a hit ⇒ **D3 live-reflect** (recompute from the live Product/Kit — the opposite of a snapshot);
  a miss (soft-deleted / cross-tenant / never-existed) ⇒ **D6** degrade to `config.costBasis.lastKnown`,
  editable + re-saveable, honest E2/E3 caption, **never blank, never "removido"**. `lastKnown` is
  **rewritten from the live reference on every scenario save** (the E3 `_snapshot_line` rule), so
  degradation is lossless without any delete-time capture. Pros: it is the **shipped** degradation seam
  (zero reinvention); it handles the **polymorphic** ref (Product *or* Kit) that a single FK column cannot;
  it sidesteps the FK tension E3/E4 already resolved. Cons: no referential integrity — **by design, and
  correct** (see Option B). **85%.**
- **Option B — nullable typed FK columns `basis_product_id` / `basis_bom_id`, `ON DELETE SET NULL`.**
  **Rejected**, two independent reasons: (1) `delete_product` / `delete_bom` are **soft deletes** — `ON
  DELETE SET NULL` **never fires** (the exact E3 blocker, ADR-0017 §6 addendum), so the FK buys illusory
  integrity while D6 must still be read-time; (2) the basis is **polymorphic** — two nullable FK columns +
  an "at most one set" CHECK to model what a discriminated `{kind,id}` expresses in one field. **20%.**
- **Option C — snapshot the basis inputs at save, re-resolve fees only (basis frozen, fees live).**
  **Rejected**: it contradicts FR-607a (a referenced basis must **live-reflect** an edit on reopen) — that
  is a *narrower* "live" the spec explicitly does not want; a scenario would silently show a stale cost
  after the seller fixed the product's filament price. **10%.**

**Ad-hoc vs reference, in one shape.** `costBasis.ref = null` ⇒ pure ad-hoc, and `lastKnown` **is** the
authoritative editable input (never degrades — there is nothing to resolve). `ref != null` ⇒ `lastKnown` is
the D6 fallback, kept current by the on-save re-snapshot. Either way the scenario is **always priceable and
always re-saveable** (FR-607b) — the `link-OR-snapshot` fractal, one level above `bom_lines`.

### N3 (sub-decision, defer to arquiteto) — new ADR-0021 or ride ADR-0013/0017?

**Recommendation (this lens): a light ADR-0021** ("scenario persistence + the live-intent / soft-reference
model"), extending ADR-0013 (stack) and ADR-0017 §6 (read-time D3/D6). Justification: the **"store intent,
re-resolve values live"** + the **`feeOverrides` partial-map re-resolution** (§3) is a genuinely new pattern
— the deliberate mirror-image of E4's frozen document — and the four-object taxonomy is worth one recorded
decision so the next reader does not "helpfully" freeze a scenario or add an FK. **N3 is the arquiteto's
call** (plan §N3); if they write ADR-0021 it should cite this §1.

### Small shape decisions (lower-stakes, still owner-confirmable)

- **No idempotency key / no `client_scenario_id`.** E4 needed one **because of the offline outbox**
  (a queued retry after an app restart). E5 writes are **online-only** (Q4/FR-613) with **no outbox**, so
  there is no retry-after-restart duplication to dedup — a scenario is created like a `products`/`boms` row
  (which also carry no idempotency key). A double-tap on a flaky online request is the same mild,
  self-evident risk E2/E3 already accept. **Stated so the next reader does not import the E4 unique index.**
- **No money column on the row.** Unlike E4's `headline_total`/`headline_basis` (a frozen list total), a
  scenario's list shows **name + note + last-updated** (US2-1) and **never a stored price** — it recomputes
  live on open (FR-606/FR-619). So the table has **zero** `Numeric` columns; VR-611 asserts it.
- **`config_schema_version smallint` kept; a pricing `model_version` column OMITTED (70%).** The
  **envelope** version is load-bearing (it tells the reader how to interpret the JSONB shape). A **pricing
  model version** is *not* — a scenario makes **no frozen claim** and always recomputes with the **current**
  engine, so recording the formula version would be advisory noise that invites someone to treat it as a
  claim. Omit; if telemetry ever wants "which engine last wrote this intent", add a nullable advisory
  `last_saved_model_version` later (additive). **⚠ §7.**
- **Soft-delete `deleted_at` kept** — voluntary delete only; a lapse never deletes (FR-612); no TTL, no
  cron, nothing auto-expires (the E2/E3/E4 posture). No idempotency tombstone role here (no outbox), so —
  unlike E4 — the active-list index *is* partial on `deleted_at IS NULL` (§5), the E2/E3 idiom.

---

## 2. Entity: `scenarios` (the only new table)

A saved marketplace strategy — the seller's **intent** ("where and for how much to sell — today"). Mutable
(name + whole config), soft-deletable by its owner. **`owner_uid → accounts` is the only FK**; the cost-basis
reference is a **soft** reference inside `config` (N2), not a foreign key.

| Column | Type | Constraints / Default | Notes (FR) |
|---|---|---|---|
| `id` | `uuid` | **PK**, default `uuid7` (server) | resource id; time-sortable ⇒ deterministic keyset tie-break (§5) |
| `owner_uid` | `text` | `NOT NULL`, **FK → accounts(account_uid)**, indexed | the ONLY FK on this table; the tenant key (FR-605) |
| `name` | `text` | `NOT NULL`; `CHECK (length(btrim(name)) > 0 AND length(name) <= 120)` | required scenario name (FR-602); searched (FR-611) |
| `note` | `text` | nullable; `CHECK (note IS NULL OR (length(btrim(note)) > 0 AND length(note) <= 500))` | optional note (Q6); blank ⇒ NULL, unrepresentable as `''` |
| `config` | `jsonb` | `NOT NULL`; `CHECK (jsonb_typeof(config) = 'object')` | the full intent document (§3) |
| `config_schema_version` | `smallint` | `NOT NULL`, `server_default '1'`; `CHECK (>= 1)` | **our envelope** version — how to read the JSONB shape |
| `created_at` | `timestamptz` | `NOT NULL`, `server_default now()` | insert time; the default list order key (§5) |
| `updated_at` | `timestamptz` | `NOT NULL`, `server_default now()`, `onupdate now()` | moves on any edit (rename / config change / soft-delete) |
| `deleted_at` | `timestamptz` | nullable | voluntary soft-delete by the owner; a lapse never sets it (FR-612) |

**No money column, no idempotency column, no immutability trigger, no catalog FK** — each absence is
deliberate and load-bearing (the governing sentence + §1 sub-decisions). `owner_uid` carries the same
three-layer isolation posture as E2/E3/E4 (repository always injects `owner_uid = :current_uid` from the
verified token; FK to `accounts`; RLS the same project-wide deferred backstop — E5 introduces no divergence).

---

## 3. The intent document (`config`, `config_schema_version = 1`)

The envelope is **FLAT** (the E4 I2 idiom): everything sits at the ROOT. **This is INTENT — not a resolved
`PriceResult`.** The single most important line: a **non-overridden** fee slot stores **no fee number** — it
is an **absent key** that re-resolves from today's catalog on reopen (Q3/FR-607). That absence, in the
schema, *is* the live-vs-frozen boundary.

```jsonc
{
  "schemaVersion": 1,                      // int — mirrors config_schema_version (CHECK, §4)
  "includeMarketplace": true,              // the 005 framing toggle (FR-113) — a JSON boolean

  "costBasis": {                           // N2 — ad-hoc OR a soft Product/Kit reference, + the D6 fallback
    "kind": "AD_HOC" | "PRODUCT" | "KIT",
    "ref":  { "id": "0192f0…", "name": "Vaso G" } | null,   // SOFT reference (no FK); null ⇒ pure ad-hoc
    "lastKnown": {
      // kind AD_HOC | PRODUCT → a single fully-RESOLVED PriceInput (piece inputs + filament/printer values
      //   + tariff + markups) — the `products`/`bom_lines` resolved shape; every numeric leaf a STRING.
      //   For a PRODUCT ref this is refreshed from the live product on EVERY save (D6 lossless, ADR-0017 §6).
      // kind KIT → { "lines": [ { "name": "Vaso G", "quantity": 3,      // quantity is an int count
      //                           "input": { …resolved PriceInput… } }, … ] }  // refreshed on every save
    }
  },

  "channels": [                            // the INTENT — channel set + determinants + EXPLICIT overrides ONLY
    {
      "marketplace": "MERCADO_LIVRE",      // MarketplaceId (005): MERCADO_LIVRE | SHOPEE | AMAZON | OUTRO
      "modality": "CLASSICO" | "",         // the determinant (ML listingType / Amazon plan; Shopee/Outro "")
      "feeOverrides": {                    // ONLY the seller's EXPLICIT per-slot adjustments; blank ⇒ ABSENT
        "commissionPct": "12.5",           //   → re-resolves from today's catalog on reopen (FR-607, "live")
        "fixedFee": "6.00"                 //   a PRESENT leaf keeps the seller's number + "ajustado por você"
        // minPerItem / freightCost absent here ⇒ re-resolved live from the catalog by determinants
      }
    }
  ],

  "otherCosts": [ { "name": "Embalagem", "value": "2.50" } ]   // 005 itemized Outros custos; value = STRING
}
```

**Four invariants that make this an intent document and not a cached result:**

1. **Money/quantity/percent leaves are decimal STRINGS** (`"12.50"`, `"0.00"`); the only JSON numbers are
   true integer counts (`schemaVersion`, `quantity`). Applies to the ad-hoc inputs, the `lastKnown`
   snapshot (incl. kit lines), every `feeOverrides` value, and every `otherCosts.value`. (FR-602; the D1 box.)
2. **`feeOverrides` is a *partial* map — absence = "re-resolve live".** Which slots are overridden is the
   **frontend's determination at save time** (the 005 `edited`/fee-seal state, `fee-prefill.ts`): only
   explicitly-adjusted slots contribute a leaf; the rest carry just `{marketplace, modality}`. On reopen the
   client re-resolves each absent fee from **today's** catalog by determinants and keeps each present leaf as
   the seller's override (the "ajustado por você" seal). **The scenario never stores a resolved fee as
   authoritative** (FR-602/FR-607).
3. **`costBasis` is `ref` OR `lastKnown`-authoritative, resolved at READ time (N2).** `ref` resolving live ⇒
   D3 live-reflect; not resolving ⇒ D6 last-known + honest caption. `lastKnown` is refreshed on every save
   so the fallback is always current (ADR-0017 §6). A **Kit** basis is the multi-piece sub-list that makes
   the whole document JSONB rather than typed columns (N1).
4. **The document is read whole and rewritten whole.** A scenario edit is a full-`config` UPDATE (the row is
   mutable) — so the string + structural validators (VR-602/603) run on **every** write, and no code path
   queries *inside* `config` (no GIN index — §5).

---

## 4. Constraints (exact)

Table `scenarios` (all `CHECK`s named via `NAMING_CONVENTION` ⇒ `ck_scenarios_*`). The migration is the
source of truth; the ORM `__table_args__` mirrors it.

```
ck_scenarios_name_not_blank        length(btrim(name)) > 0 AND length(name) <= 120
ck_scenarios_note_valid            note IS NULL OR (length(btrim(note)) > 0 AND length(note) <= 500)
ck_scenarios_config_is_object      jsonb_typeof(config) = 'object'
ck_scenarios_config_schema_valid   config_schema_version >= 1
-- envelope↔column binding (immutable-per-write expression ⇒ a plain CHECK; holds on every UPDATE too):
ck_scenarios_config_schema_matches (config->>'schemaVersion')::int = config_schema_version
```

**Deliberately ABSENT (each is a documented non-mistake):**
- **No immutability trigger** — the scenario is *mutable* (rename + edit-config are the feature). This is the
  single biggest divergence from E4; the whole PL/pgSQL apparatus of `0003` is dropped.
- **No `<> 'NaN'::numeric` column CHECK** — there is no money column to guard. The NaN/float hole is closed
  **inside `config`** by the app-layer validator (VR-602: `Decimal.is_finite()`, the in-JSON twin of the
  numeric CHECK), because a DB `CHECK` cannot reach inside JSONB.
- **No unique idempotency index** — online-only writes, no outbox (§1). A scenario is created like a
  `products` row.
- **No catalog FK** — the cost-basis reference is a **soft** reference in `config` (N2); the read-time
  resolver enforces owner + live, so there is nothing for a dangling ref to break.

---

## 5. Indices

| Index | Definition | Serves |
|---|---|---|
| `ix_scenarios_owner_uid` | `(owner_uid)` | the FK / tenant key (house symmetry with `boms`/`snapshots`) |
| `ix_scenarios_owner_active` | `(owner_uid, created_at, id) WHERE deleted_at IS NULL` | FR-605 isolation + the default newest-first list (backward scan) + the keyset cursor |
| *(none on `config`)* | — | deliberate: the document is never queried inside (§3.4) |
| *(future, additive)* | GIN `pg_trgm` on `lower(name)` | only if name search proves slow at volume (FR-611) — needs the `pg_trgm` extension ⇒ owner call **then**, not now |

- **Default list order: `created_at DESC, id DESC` (keyset).** `created_at` is **immutable**, so the cursor
  is **stable** — the E4 lesson (never sort a keyset by a field that moves under you; `updated_at` would let
  an edit mid-page skip or repeat a row). Tie-break `id DESC` (server-minted uuid7 ⇒ deterministic total
  order ⇒ a correct cursor). `(owner_uid, created_at, id)` with `owner_uid` as an equality predicate lets
  PostgreSQL walk the b-tree **backwards** for the DESC order. **⚠ the *product* ordering choice
  (newest-saved vs recently-edited vs alphabetical) is a `designer-ux` + owner call (§7); the index above
  serves newest-saved, ~70%.**
- **Pagination: keyset/cursor `(created_at, id) < (:cursor)`**, never `OFFSET` — the per-account list is
  **unbounded** (a page size is not a cap; every scenario stays reachable by paging; no silent limit may be
  introduced — that would be a business-rules amendment). The API cursor shape is the arquiteto's.
- **Name search (FR-611): owner-scoped, case-insensitive substring `name ILIKE '%term%'`** on the
  already-`owner_uid`-narrowed set — correct now, no extension (the E4 D4 idiom). If volume ever proves it
  slow, the GIN `pg_trgm` row above is a one-line additive migration. **⚠ accent-sensitivity:** `joao`
  will **not** find `João` without the `unaccent` extension — surfaced, not decided (§7), same as E4.

---

## 6. Migration `0004` outline

`backend/alembic/versions/0004_e5_scenarios.py` — `revision = "0004"`, `down_revision = "0003"` (verified
head). **Additive only**: `0001`/`0002`/`0003` are shipped and never amended (ADR-0013 R4). Nothing in
`products`, `boms`, `bom_lines`, `filaments`, `printers`, `accounts`, `entitlement_grants` or `snapshots` is
touched — **E5 adds a shelf, it does not alter the existing four** (FR-620).

**`upgrade()`**
1. `op.create_table("scenarios", …)` — the columns of §2, the `CHECK`s of §4,
   `ForeignKeyConstraint(["owner_uid"], ["accounts.account_uid"], name=op.f("fk_scenarios_owner_uid_accounts"))`
   (**the only FK**), `PrimaryKeyConstraint("id", name=op.f("pk_scenarios"))`.
2. `op.create_index(op.f("ix_scenarios_owner_uid"), "scenarios", ["owner_uid"])`.
3. `op.create_index("ix_scenarios_owner_active", "scenarios", ["owner_uid", "created_at", "id"],
   postgresql_where=sa.text("deleted_at IS NULL"))`.
4. **No `op.execute(...)`** — no trigger, no function, no extension.

**`downgrade()`** (reversible, exact reverse): drop the two indices → drop the table. No data migration in
either direction (the table is new; nothing pre-exists).

**No extension is required** (`uuid7` is app-minted, as in `0001`–`0003`; no `pg_trgm`, no `uuid-ossp`).
Cloud-SQL-portable, and — unlike `0003` — **no PL/pgSQL** (a scenario is mutable, so there is nothing to make
immutable). This is the concrete sense in which E5 is *lighter* than E4.

---

## 7. Open points — **DECIDED by the owner 2026-07-19** (T002 checkpoint; spec §Clarifications session)

1. **Scenario metadata (Q6) — DECIDED:** **`name` (required, ≤120) + `note` (optional, ≤500)** confirmed; a
   single free-text note (not tags/folders) is enough for v1.
2. **Default list ordering (§5) — DECIDED: newest-saved (`created_at DESC`)** — stable keyset cursor; the §5
   index stands as `(owner_uid, created_at, id)`.
3. **DECIDED: `config_schema_version` only — no pricing model-version column.** A scenario makes no frozen
   claim and always recomputes with the current engine; a stored formula version would be advisory noise.
4. **Accent-sensitive name search (§5) — DECIDED: accepted as-is** (`joao` will not find `João`, same as E4);
   `unaccent` deferred — adding it later breaks the "zero extensions" posture and is an owner call at that time.
5. **`config` payload size guard — DECIDED: 256 KB**, rejected with an honest, visible **422**, never a silent
   truncation. (Lower than E4's 512 KB because a scenario stores INTENT, not a full frozen result document; a
   byte cap is indirectly a cap on kit-basis size.)
6. **US7 provenance (FR-617, P3/droppable) touches the *snapshot* payload, not this table.** Recording an
   E4 snapshot *from* a scenario adds the scenario as an **informational** `provenance` source **on the
   snapshot** — i.e. the E4 `snapshots.payload.provenance.kind` enum gains a `"SCENARIO"` value. The
   `scenarios` table is **unchanged** by US7. Flag for the arquiteto + the E4 owner if US7 ships (it does not
   alter snapshot immutability).

---

## 8. Validation rules (test-first; traced to FRs)

| VR | Rule | Traces |
|---|---|---|
| **VR-601** | **Entitlement gate.** Every op — save · list · read · duplicate · rename · delete — requires **active** entitlement (ADR-0012, no new gate); a free / signed-out / locally-faked-premium caller is denied `ENTITLEMENT_REQUIRED` and persists/reads **nothing**. | FR-603, SC-604 |
| **VR-602** | **Money-as-decimal-STRING in `config`.** A recursive write-time validator rejects any JSON **float** leaf and asserts every money/qty/percent leaf parses as a **finite** `Decimal` (`d.is_finite()` — the in-JSON twin of `<> 'NaN'`, since a DB CHECK cannot reach inside JSONB). Magnitude ceilings mirror `products.py::_CEIL_*`. **Runs on INSERT *and* UPDATE** (the row is mutable); a stored-doc test re-scans after a round-trip (psycopg would decode a JSON number to `float`). Only int counts allowed as numbers: `schemaVersion`, `quantity`. | FR-602 |
| **VR-603** | **Structural, not shape-pinning.** Validate the **flat envelope** (`schemaVersion`, `includeMarketplace`(bool), `costBasis{kind, ref|null, lastKnown}`, `channels[]`, `otherCosts[]`) + leaves **generically** (finite decimal strings, ceilings, size cap). Do **NOT** mirror `PriceInput`/`BomResult` field-by-field — a pricing-core bump must not make the backend reject its own configs (the E4 §9.6 lesson). | FR-602, FR-609 |
| **VR-604** | **Intent, not resolved values.** After a save, a slot the seller did **not** override carries **no** stored fee number (an absent `feeOverrides` key); a test mutates the catalog and asserts that on reopen the non-overridden slot **re-resolves to the new fee** while an overridden slot keeps its value + the "ajustado por você" seal. | FR-602, FR-607, SC-602 |
| **VR-605** | **D3 live-reflect.** A scenario whose `costBasis.ref` resolves live (owner + `deleted_at IS NULL`) reflects an **edit** to the referenced Product/Kit on reopen — the resolver reads the **live** row, not `lastKnown`. | FR-607a, SC-603 |
| **VR-606** | **D6 last-known.** When `costBasis.ref` does **not** resolve (soft-deleted / cross-tenant / never-existed), reopen degrades to `config.costBasis.lastKnown`, **editable + re-saveable**, honest E2/E3 caption — never blank, never "removido". `lastKnown` was refreshed on the last save (ADR-0017 §6), so the degradation is lossless. **0** scenarios break on a dangling ref. | FR-607b, SC-603 |
| **VR-607** | **Materializes nothing.** Save (and duplicate) create **0** catalog rows — `filaments`/`printers`/`products`/`boms`/`bom_lines` counts are identical before and after. The explicit contrast with E3's kit-save. | FR-604, SC-606 |
| **VR-608** | **Duplicate independence.** `POST /{id}/duplicate` **deep-copies** `config` into a new row (new `id`, own `name`); editing the copy changes **0%** of the original, and vice versa (a clone is a new object, never a mutation). | FR-610, SC-605 |
| **VR-609** | **Isolation.** Account B cannot read / rename / duplicate / delete A's scenario; the response is **indistinguishable from non-existent** (no existence oracle), including a **guessed `id`**. The repository always injects `owner_uid = :current_uid`. | FR-605, SC-609 |
| **VR-610** | **Lapse read-only freeze.** Every scenario stays **readable + re-openable/recomputable** (recompute is a client read); **0** writes succeed (save/rename/duplicate/delete); **0** rows are deleted or modified by the lapse; re-grant restores writes with data intact — **zero schema footprint** (the E2 authorization freeze). | FR-612, SC-608 |
| **VR-611** | **No resolved price on the row.** A schema assertion that `scenarios` has **no** `Numeric` column and **no** stored price; a test that list/read return **no** price field — the scenario recomputes **client-side**, the backend never recomputes (the ADR-0015 client-guard-over-server-gated-data honesty). | FR-606, FR-619 |
| **VR-612** | **Offline read + purge; no server queue state.** After one online load, list/read serve from the uid-keyed cache offline; a **save** attempted offline **fails honestly** (online-only — no silent drop, no fake success); sign-out **purges** the cache. The **server has NO** `pending`/`queued` state (no outbox) — a row exists only once accepted. *(Frontend/entity + service; the data-model note is the server-state prohibition.)* | FR-613, FR-614, SC-610 |
| **VR-613** | **Envelope↔column binding.** `(config->>'schemaVersion')::int = config_schema_version` holds on **every** write (the §4 DB CHECK — defense-in-depth against a mismatched envelope). | FR-602 |
| **VR-614** | **Name/note well-formedness.** Blank `name` rejected (required); blank `note` ⇒ NULL (unrepresentable as `''`); the ≤120 / ≤500 caps enforced. | FR-602, Q6 |

---

## 9. What the arquiteto must bind to (cross-agent contract) — assumptions from / needs from

I own the `scenarios` table, migration `0004`, the `config` sub-shape and VR-6xx. The arquiteto owns the
mechanism/ADR/contracts + the pricing-core verification. For a **consistent N1/N2**:

1. **I ASSUME (R-A) `pricing-core` needs NO change** (~85%, verify against the code). The scenario reopen
   **reuses** the shipped 005 path: `fee-prefill.ts` (`resolveSlotEntry`/`entryToChannelFees`) re-resolves
   each non-overridden slot from **today's** catalog by determinants, overrides merge on top, then
   `computeCalculator` (single/ad-hoc/product basis) or `computeBom` (kit basis) runs. **The scenario
   feature orchestrates existing code; it re-implements no pricing.** If R-A finds a needed change, my §3
   `feeOverrides`-partial-map assumption must be re-examined **with me**.
2. **I NEED the wire contract to bind to my `config` keys.** The `/api/v1/scenarios` pydantic models
   (`ChannelIntentIn` = `{marketplace, modality, feeOverrides?}`, `CostBasisIn` = `{kind, ref?, lastKnown}`,
   `OtherCostIn` = `{name, value}`) should mirror §3 field-for-field, money as **decimal strings**
   (`model_dump(mode="json", by_alias=True)`, the `products.py` idiom), and follow the **structural, not
   shape-pinning** posture (VR-603 / the E4 §9.6 rule). The 7 routes (`POST` · `GET` list-keyset · `GET
   /{id}` · `PUT` full-replace edit · `PATCH` rename · `POST /{id}/duplicate` · `DELETE` — `PUT`+`PATCH`
   owner-confirmed 2026-07-19) are the arquiteto's; writes behind `require_entitlement`, reads
   `require_catalog_read`.
3. **I NEED the read-time resolver mechanism (N2) specced by the arquiteto**, reusing ADR-0017 §6 verbatim:
   resolve `costBasis.ref` **owner + `deleted_at IS NULL`** → D3 live / D6 last-known; **re-snapshot
   `lastKnown` from the live reference on every save** (the E3 `_snapshot_line` rule) so degradation is
   lossless. I define the **storage** (soft ref + `lastKnown`); they define the **resolve/degrade + on-save
   re-snapshot** service + client seam.
4. **I ASSUME online-only writes ⇒ no idempotency key / no outbox** (consistent with FR-613 and the E4-not-
   reused decision). If the arquiteto reopens Q4, a `client_scenario_id` + unconditional unique index
   returns — that is a joint change to §2/§4.
5. **I RECOMMEND (N3) a light ADR-0021**; the arquiteto decides whether N1/N2 ride ADR-0013/0017 or get their
   own ADR. Either way, keep the "store intent, re-resolve values live" + soft-reference model consistent
   with this §1.
6. **US7 (FR-617) is a *snapshot-payload* change, not a `scenarios`-table change** (§7.6): the E4
   `provenance.kind` enum gains `"SCENARIO"`. Coordinate with the E4 owner; the `scenarios` table is
   untouched and snapshot immutability is unaffected.

---

## Spec issues flagged (for the parent to reconcile — I did not edit the spec)

- **None blocking.** One consistency note: the spec's **Key Entities** block lists the Scenario fields as
  `{ name, note?, costBasis, channelSet, feeOverrides, framingIncluded, otherCosts, timestamps }` with
  `feeOverrides` as a **top-level** sibling of `channelSet`. This model nests `feeOverrides` **inside each
  channel slot** (`channels[].feeOverrides`, §3) rather than as a separate top-level map — because an
  override is per-slot (per marketplace+modality), and the 005 `ChannelSlotForm`/`fee-prefill.ts` already
  key the override to the slot. Behaviorally identical (both persist "the seller's explicit per-slot
  adjustments"); the nesting is the faithful shape. Flagging so the parent can align the spec's Key-Entities
  prose if desired — not a requirement change.
