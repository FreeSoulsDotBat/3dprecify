# Data Model — E4 Histórico + snapshots reproduzíveis + export

**Feature**: `009-e4-history-snapshots-export` · **Artifact**: Phase-0 data model · **Status**: DRAFT —
proposed for owner sign-off (Principle VIII; never finalized unilaterally).

Extends the E2+E3 schema (`backend/app/models/__init__.py`; migrations `0001`, `0002`) with **ONE new table**
via Alembic **`0003`** (`down_revision = "0002"`; `0001`/`0002` are shipped and are never amended — ADR-0013 R4).
Reuses the E2 domain types verbatim (`MONEY_SETTLED` = `Numeric(12,2)`, `NAMING_CONVENTION`, `uuid7` PK default,
the `<> 'NaN'::numeric` value guard) and the `CamelModel` wire layer (money = **decimal strings**, never floats).

> **The two-shelf rule, expressed in the schema (the one sentence that governs this document):**
> **`snapshots` has exactly ONE foreign key — `owner_uid → accounts`. It has NO edge to `filaments`,
> `printers`, `products` or `boms`.** A snapshot cannot degrade because, at the data layer, there is nothing
> for it to degrade *from*. Every E2/E3 reflex — nullable FK + `ON DELETE SET NULL` + typed last-known columns —
> is **deliberately absent here**, and §D1/§D3 say why copying it would be a bug, not consistency.

---

## 1. Decisions (options, rejections, confidence)

### D1 — The frozen payload shape · **CHOSEN: hybrid — typed columns for query/identity + ONE JSONB `payload` document** · **85%**

The crux of the epic. Compared honestly against the house idiom:

**Option A — full JSONB document, no typed metadata (payload only).** Pros: nothing can drift. Cons: kills
FR-520 (search by label / filter by date) and FR-523 (newest-first) — every list query would parse every
document. **Rejected. 20%.**

**Option B — typed columns + a `snapshot_lines` table (the E2/E3 house pattern).** Pros: house idiom; DB
`CHECK`s on money; SQL-queryable. Cons, and they are decisive here:
1. **It is not actually "typed".** A recorded line already contains `otherCosts[]` (0..N named sub-costs) and
   `channels[]` (0..N `ChannelResult`, 8 money fields each); a kit adds N pieces × a full `PriceResult` **plus**
   the per-marketplace rollup (`BomChannelRollup[]`, Q2). Modeling that relationally is **4–5 tables**
   (`snapshots` → `snapshot_lines` → `snapshot_line_channels` / `snapshot_line_other_costs` →
   `snapshot_channel_rollups`) — or it degenerates into typed columns **plus JSONB anyway**, exactly as
   `products.channels` already does. The "typed is stricter" argument collapses at the first sub-list.
2. **FR-507 costs a migration, forever.** When pricing-core grows a breakdown line, the typed schema needs
   `ALTER TABLE ADD COLUMN … NULL` and every historical row carries a new NULL. It *is* renderable (NULL ≠ 0),
   but the shape of an **immutable document** would then be coupled to the **live** schema — one migration per
   formula change, in perpetuity, on rows that must never be touched.
3. **Nothing needs it.** No requirement queries a snapshot line, aggregates over it, updates it, or joins it.
   The document is written once, read whole, exported whole.
**Rejected. 35%** — the house pattern is right for `products`/`boms` (live, mutable, partially queried,
recomputed) and wrong for a frozen document. Copying it here would be habit, not consistency.

**Option C (CHOSEN) — hybrid.** Typed columns for exactly what the DB must **query, order, constrain or
index** (owner, label, device date, kind, model version, headline total, idempotency key, soft-delete) + **one
`payload JSONB NOT NULL`** holding the frozen document (inputs + results + provenance). Pros: FR-507 is native
(**a line the formula did not have then is simply an absent key** — no migration, no NULL column, no fabricated
zero); the document survives every future pricing-core version with **zero schema change**; the query surface
is fully typed and indexable; money exactness is preserved by the rule below. Cons: the DB cannot `CHECK` money
inside the document (mitigated: §VR-501/502 + two JSONB↔column `CHECK`s in §4); the payload is opaque to SQL
(deliberate — see §5, *no GIN index on `payload`*). **85%.**

> **Money in JSONB — how decimals are preserved (FR-525).** Postgres `jsonb` stores JSON numbers as `numeric`,
> so the **database** would not lose precision. The loss happens at the **serializer boundaries**: Python's
> `json.loads` (psycopg's JSONB decoder) maps a JSON number to `float`, and JS `JSON.parse` does the same — so a
> JSON number would arrive as **binary64 in both runtimes** even though the DB kept it exact. That is the worst
> kind of drift: silent and app-side. Hence the invariant, identical to the one `products.channels` already
> obeys:
>
> **Every money / rate / quantity / percent leaf in `payload` is a JSON *string* in canonical decimal form
> (`"187.35"`). The only JSON numbers permitted are true integer counts (`schemaVersion`, `quantity`,
> `contributingLines`, `skippedLines`).** A recursive write-time validator rejects any float leaf (§VR-502).
> Export (FR-513) emits the stored **string** — no float ever enters the CSV/PDF path.

### D2 — Immutability at the DB boundary (FR-504 / SC-504) · **CHOSEN: BEFORE-UPDATE trigger + no service update-path** · **78%** · ⚠ owner/arquiteto sign-off

A `CHECK` constraint **cannot** express this (a CHECK sees only the new row, never the old one) — so anyone
proposing one is mistaken; the honest options are:

- **Option A — service-only: no content-update endpoint, one `UPDATE … SET label`, one soft-delete.** Pros:
  leanest; matches the E2 "freeze lives in authorization, zero schema footprint" posture. Cons: the epic's
  headline promise ("**0** write paths can alter recorded values") would be guaranteed by *"we did not write the
  code that breaks it"*. One future careless `PATCH`, one `session.merge()` of a mutated entity, one repair
  script — and history is rewritten silently. **55%.**
- **Option B (CHOSEN) — a `BEFORE UPDATE … FOR EACH ROW` trigger that raises unless the changed columns are a
  subset of `{label, deleted_at, updated_at}`**, *plus* Option A's service discipline. Pros: SC-504 becomes
  **provable at the DB**, not asserted; identical in spirit to E2's ratified "BOTH layers" validation strategy
  (app-layer primary, DB constraint as defense-in-depth so a bad write is impossible **even from a non-UI
  writer**). Cons: the **first PL/pgSQL in the project** — E2 §0 committed to "plain tables/indexes/CHECK/
  partial-unique/RLS only". A trigger is plain PostgreSQL and fully supported on Cloud SQL (**portability is
  not at risk**), but it is a new mechanism class ⇒ **owner + arquiteto must approve**. **78%.**
- **Option C — revoke `UPDATE` on the table for the app role; move `label` to a 1:1 side table.** Pros: purest
  (the table becomes INSERT/DELETE-only). Cons: two tables for one entity; no DB role separation exists in this
  project yet; soft-delete is itself an `UPDATE`, so purity only holds with hard delete — which §D2/soft-delete
  below rejects for a load-bearing reason. **30%.**

**Soft-delete: YES — and *not* out of habit.** `deleted_at` is kept for a reason specific to E4: it is the
**tombstone that makes exactly-once sync survive a delete-then-retry race** (SC-513). If a snapshot were
hard-deleted while its offline-queue entry still had a pending retry, the retried `INSERT` would find no
conflicting row and **resurrect a deleted snapshot**. With a tombstone plus an **unconditional** unique index on
`(owner_uid, client_snapshot_id)` (**not** partial on `deleted_at`, unlike E2's optional partial-unique name
index), the retry dedups onto the deleted row and nothing resurrects. It also gives FR-517/FR-518 for free
(lapse deletes nothing; nothing is ever auto-deleted). Accepted trade-off, stated openly: the seller's "delete"
does not erase bytes — the same posture E2/E3 already carry, with full LGPD erasure still deferred.

### D3 — The provenance link · **CHOSEN: captured id + captured name, NO foreign key at all** · **88%**

The spec: provenance ONLY, never a value source, "may dangle harmlessly". E3's lesson: the FK-based degradation
path was never even reachable, because `delete_product` is a soft-delete.

- **Option A (CHOSEN) — no FK. Capture `{kind, id, name}` in the payload** (root, and per kit line). Pros: a
  dangling link is *structurally* incapable of altering the snapshot — no cascade, no `SET NULL`, no
  degradation, nothing to resolve. The captured **name** displays forever (US3-2); "abrir produto" is offered
  only if the id still resolves to an **owned, live** product at read time (owner-scoped + `deleted_at IS NULL`,
  the E3 `_resolve_views` filter) — otherwise the affordance is simply **absent**: no broken link, no "produto
  excluído" claim, no caption. Cons: no referential integrity — **by design**. **88%.**
- **Option B — nullable FK `ON DELETE SET NULL` (the house pattern).** **Rejected, and it is not close:** on a
  hard purge the FK would **NULL the column — the database actively erasing part of an immutable record**.
  `SET NULL` *is* an alteration, which FR-503/FR-504 forbid. Worse, it is **mechanically incompatible with D2**:
  `SET NULL` fires as an `UPDATE`, the immutability trigger would raise, and the product hard-delete would fail.
  Two independent reasons, either one fatal. **10%.**
- **Option C — FK `ON DELETE RESTRICT`.** Rejected: history would hold the catalog hostage — the seller could
  not delete a product because he once quoted it. **5%.**
- **Option D — FK `ON DELETE CASCADE`.** Rejected outright: deleting a product would delete the proof of what
  he charged. **1%.**

### D4 — Query surface · **CHOSEN: one partial composite index + keyset pagination; owner-scoped `ILIKE` for label search** · **80%**

- **Newest-first (FR-523)** orders by the **device date** (`device_quoted_at DESC`), because the date *is* the
  claim (the spec's own edge case accepts that ordering therefore inherits the device clock). Tie-break `id DESC`
  (server-minted uuid7 ⇒ deterministic total order ⇒ a correct cursor).
- **Index** `(owner_uid, device_quoted_at, id) WHERE deleted_at IS NULL` — a *plain ascending* composite is
  enough: with `owner_uid` as an equality predicate, PostgreSQL scans the remaining keys **backwards** for
  `ORDER BY device_quoted_at DESC, id DESC`, and the same index serves the FR-520 date-range filter. Partial on
  `deleted_at IS NULL` (the active list is the only listing) — the E2 §7 idiom.
- **Pagination: keyset/cursor `(device_quoted_at, id) < (:cursor)`**, never `OFFSET` (unbounded volume per
  premium account ⇒ `OFFSET` degrades linearly). **A page size is not a cap**: every entry stays reachable by
  paging; there is **no limit on the number of snapshots** and none may ever be introduced silently (that would
  be a business-rules amendment). The API cursor shape is the arquiteto's.
- **Label search (FR-520):** owner-scoped, case-insensitive **substring** `label ILIKE '%term%'`. Within one
  account's rows this is a filter on an already-index-narrowed set — correct now, no extension. If volume ever
  proves it slow, a **GIN `pg_trgm`** index on `lower(label)` is a one-line **additive** migration (pg_trgm is
  supported on Cloud SQL; it does break E2's "zero extensions" posture ⇒ owner call at that time). Full-text
  `tsvector` is the wrong tool (labels are short proper nouns; sellers expect "Mari" to find "Mariana", which
  stemming does not give). **⚠ Owner question:** should searching `joao` find `João`? With the chosen option,
  **no** (accent-sensitive). Accent-insensitivity needs the `unaccent` extension — surfaced, not decided.
- **No GIN index on `payload`.** The document is never queried. Stating it so the next reader does not "help".
- **FR-518 (never auto-deleted):** zero TTL, zero cron, no `expires_at`. `quote_validity_days` (Q9) is the
  **quote's** validity for the customer and is named so it can never be mistaken for a record TTL; nothing in
  the system reads it as an expiry (§VR-509 tests exactly that).

### D5 — The device-stamped date (FR-528) · **CHOSEN: `device_quoted_at` + `device_utc_offset_minutes`; `created_at` kept but never surfaced** · **75%** · ⚠ owner confirmation

The date is the **device clock at record time**; the server stores a timestamp it **cannot verify** — an
owner-accepted integrity limitation, **not** to be "fixed" with a server clock.

- **Naming is the deliverable here.** The column is **`device_quoted_at`** (wire: `deviceQuotedAt`, UI: *"Cotado
  em"*) — not `quoted_at`, not `recorded_at`, not `created_at`. The word **`device_`** is load-bearing: it tells
  every future reader, in the column name itself, that this timestamp is **client-supplied and unverified**.
- **`device_utc_offset_minutes smallint NOT NULL`** (CHECK `BETWEEN -840 AND 840`) captures the device's UTC
  offset at record time, so the app and the exported quote can render **the calendar date the seller actually
  saw**, forever. Without it, a `timestamptz` rendered in a different zone can show a different **day** than the
  seller quoted (recorded 23:30 BRT → rendered as the next day elsewhere) — which would corrupt the claim. Cheap
  (one `smallint`), immutable content, closes the spec's "Clock / timezone" edge case. **70%.**
- **`created_at` (server `now()`, row insert = when the sync landed).** ⚠ **Tension with the spec, surfaced, not
  papered over.** FR-528 / Out-of-Scope say *"no server-side received-at is stored to audit it"*. A `created_at`
  **is** a received-at. Two honest facts: (1) every other table has it, and it is the only way to debug a sync;
  (2) **a server-minted uuid7 PK already embeds a millisecond server timestamp** — so "zero server-side
  received-at" is **not achievable** unless the PK is client-minted (which §D6 rejects for a security reason).
  What the owner actually decided is a **product** decision: *no second date is ever shown, and the date is never
  presented as verified*. **Recommendation (80%): keep `created_at`, bound by three written rules** — it is (a)
  **never exposed on the wire or in any export**, (b) **never used for ordering or filtering** (FR-520/523 use
  `device_quoted_at` only), (c) documented in the model as *"row insert time (sync landing) — an operational
  timestamp, NOT the snapshot's date and NOT a verified record time; the owner declined a dual-date product
  surface (FR-528)"*. **Alternative (35%): omit `created_at` entirely** so the dual date cannot leak even by
  accident — at the cost of the only operational timestamp, and still without achieving the literal property
  (uuid7). **Owner: confirm which.**
- **No clock sanity-CHECK.** A "reject dates > 1 year in the future" constraint would be exactly the silent fix
  FR-528 forbids. The only guard is non-finiteness: `CHECK (device_quoted_at > '-infinity' AND device_quoted_at
  < 'infinity')` — Postgres `timestamptz` accepts `'infinity'`, the temporal twin of the `<> 'NaN'` numeric hole
  E2 already closes (VR-02).

### D6 — Offline-queue support in the schema (idempotency) · **CHOSEN: device-minted `client_snapshot_id`, UNIQUE per account** · **88%**

- **Option A (CHOSEN) — `client_snapshot_id UUID NOT NULL` on the row; `UNIQUE (owner_uid, client_snapshot_id)`,
  unconditional.** The device mints a UUIDv4 **at record time** (not at send time) and persists it with the
  queued document; every retry carries the same key. Server: `INSERT … ON CONFLICT DO NOTHING` + read-back ⇒ a
  retry is an **idempotent success**, never a duplicate and never an error the queue would mistake for failure.
  Content-independent, so the spec's edge case holds: *two snapshots recorded seconds apart from identical
  inputs are two different keys ⇒ two rows*. Scoped **per account** ⇒ a collision with another account's key is
  impossible to observe (**no existence oracle**, FR-511). **88%.**
- **Option B — an `Idempotency-Key` header + a generic `idempotency_keys` table (key → stored response).**
  Rejected: a whole subsystem for one endpoint, and its TTL is **fatal here** — an offline seller can be offline
  for **weeks**; a key expiring before the device reconnects would produce exactly the duplicate SC-513 forbids.
  A column on the row has no TTL. **45%.**
- **Option C — content-hash dedup (hash of payload + date).** Rejected: it violates the spec's explicit edge case
  ("two snapshots recorded seconds apart from the same inputs — **both exist independently**"); a record is an
  assertion, not a deduplicated cache. **15%.**
- **The PK stays a server-minted `uuid7` (`id`), distinct from `client_snapshot_id`.** A client-chosen *global*
  identifier used as the PK would leak cross-account existence through a conflict error. The client id is
  **never** the resource id.
- **The server has NO "pending"/"queued"/"rejected" state.** A snapshot row exists **only once the server has
  accepted it** (FR-529: the entitlement gate still governs persistence at sync time; a denied sync writes
  **nothing**). The visibly-pending state lives **only** on the device queue (the arquiteto's). No queue column
  belongs in Postgres. **90%.**

---

## 2. Entity: `snapshots` (the only new table)

A recorded price event — the seller's assertion *"this is what I quoted"*. Immutable contents; label editable;
soft-deletable by its owner. **No FK to any catalog table.**

| Column | Type | Constraints / Default | Notes (FR) |
|---|---|---|---|
| `id` | `uuid` | **PK**, default `uuid7` (server) | resource id; time-sortable ⇒ deterministic tie-break (D4/D6) |
| `owner_uid` | `text` | `NOT NULL`, **FK → accounts(account_uid)**, indexed | the ONLY FK on this table (FR-511) |
| `client_snapshot_id` | `uuid` | `NOT NULL`; **UNIQUE (owner_uid, client_snapshot_id)** — *not partial* | device-minted idempotency key (FR-527, SC-513) |
| `kind` | `text` | `NOT NULL`, `CHECK (kind IN ('SINGLE','KIT'))` | single piece or kit (FR-509 / Q2) |
| `label` | `text` | nullable; `CHECK (label IS NULL OR (length(btrim(label)) > 0 AND length(label) <= 120))` | client/order reference (FR-519). **The ONLY mutable field** (FR-504). Blank ⇒ NULL, unrepresentable as `''` |
| `quote_validity_days` | `integer` | nullable; `CHECK (… IS NULL OR (… > 0 AND … <= 3650))` | Q9 "validade: 15 dias". **NOT a TTL** — nothing expires the record (FR-518) |
| `device_quoted_at` | `timestamptz` | `NOT NULL`; `CHECK (> '-infinity' AND < 'infinity')` | **device clock, unverified** (FR-528). The snapshot's date; the sort key |
| `device_utc_offset_minutes` | `smallint` | `NOT NULL`; `CHECK (BETWEEN -840 AND 840)` | renders the seller's local date forever (D5) |
| `model_version` | `text` | `NOT NULL`, `CHECK (length(btrim(model_version)) > 0)` | `PRICING_MODEL_VERSION` at record time (FR-502/506, ADR-0008) |
| `payload_schema_version` | `smallint` | `NOT NULL`, `server_default '1'`, `CHECK (>= 1)` | **our envelope** version — distinct from `model_version` |
| `payload` | `jsonb` | `NOT NULL`, `CHECK (jsonb_typeof(payload) = 'object')` | the frozen document (§3) |
| `headline_total` | `MONEY_SETTLED` `Numeric(12,2)` | `NOT NULL`, `CHECK (>= 0 AND <> 'NaN'::numeric)` | the number on the list card + the quote (FR-523/512) |
| `headline_basis` | `text` | `NOT NULL`, `server_default 'PRECO_VAREJO'`, `CHECK (headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO'))` | **which** price that number is — an unlabelled total is an ambiguous claim. ⚠ owner (§7) |
| `created_at` | `timestamptz` | `NOT NULL`, `server_default now()` | **row insert = sync landing.** NEVER on the wire, NEVER an order/filter key (D5) |
| `updated_at` | `timestamptz` | `NOT NULL`, `server_default now()`, `onupdate now()` | moves **only** on a label edit or a soft-delete |
| `deleted_at` | `timestamptz` | nullable | voluntary soft-delete by the owner; the **idempotency tombstone** (D2). A lapse never deletes (FR-517) |

**Denormalization is safe here *because* the row is immutable.** `kind`, `model_version` and `headline_total`
also live inside `payload`. In E2/E3 that would invite drift; here **nothing can ever update them** (D2's
trigger), and two DB `CHECK`s bind them to the document at write time (§4). Both `payload->>'kind'` and
`payload->>'modelVersion'` are immutable expressions, so this is a plain `CHECK` — no trigger needed for it.

**`owner_uid` is the tenant key** — same three-layer isolation posture as E2/E3 (repository always injects
`owner_uid = :current_uid` from the verified token; FK to `accounts`; RLS remains the same project-wide deferred
backstop — E4 introduces no divergence).

---

## 3. The frozen document (`payload`, `payload_schema_version = 1`)

The envelope is **FLAT** (I2 / Option A, owner-decided 2026-07-13): `catalogVersion`, `inputs`/`lines`,
`breakdown`, `totals` and `channels` all sit at the **ROOT** — there is **no nested `result` wrapper**. This is
the exact shape `entities/history/frozen-payload.ts` serialises (`FrozenSnapshotPayload`).

```jsonc
{
  "schemaVersion": 1,                       // int — mirrors `payload_schema_version` (CHECK, §4)
  "kind": "SINGLE",                         // "SINGLE" | "KIT"  (bound to the column by CHECK)
  "modelVersion": "3.1.0",                  // PRICING_MODEL_VERSION (bound to the column by CHECK)
  "catalogVersion": "2026-07-05" | null,    // ROOT field — fee-catalog provenance echoed by pricing-core
                                            //   (ADR-0010); null when every channel used manual fees
  "provenance": {                           // D3 — PROVENANCE ONLY, no FK, may dangle; whole obj null = ad-hoc
    "kind": "PRODUCT" | "KIT",
    "id":   "0192f0…",                      // captured id; never resolved for VALUES
    "name": "Vaso G"                        // captured NAME — displays forever (US3-2)
  },

  // --- SINGLE only ---
  "inputs":    { /* the fully-RESOLVED PriceInput (filament/printer values inlined); every numeric leaf
                    a decimal STRING, RECURSIVELY (channel bands included, I1) */ },
  "breakdown": { /* material?, energy?, machine?, falha?, finishing?, labor?, admin?, otherCosts[]  */ },

  // --- KIT only ---
  "lines": [ { "name": "Vaso G", "quantity": 3,        // quantity is an int count
               "input":     { …resolved PriceInput… },
               "breakdown": { …per-UNIT…          },
               "totals":    { …quantity-SCALED money… } } ],

  // --- both ---
  "totals":   { "custoTotal": "14.60", "precoVarejo": "21.90", "precoAtacado": "18.98" },
  "channels": [ { "marketplace": "shopee", "precoAnuncioVarejo": "…", "recebidoLiquidoVarejo": "…",
                  "contributingLines": 3, "skippedLines": 0 /* kit ROLLUP counts only */ } ]
}
```

**Three invariants that make this document a snapshot and not a cache:**

1. **Money/quantity leaves are decimal STRINGS** (`"187.35"`, `"0.00"`); the only JSON numbers are true integer
   counts (`schemaVersion`, `quantity`, `contributingLines`, `skippedLines`). See the D1 box for why (float at
   the serializer boundary, not in the DB). FR-525.
2. **Absence ≠ zero (FR-507).** The renderer iterates the keys **present** in `breakdown`/`totals`; an absent key
   renders **nothing**. When a future pricing-core adds a breakdown line, **no stored document changes and no migration
   runs** — the old document simply lacks the key, and a UI that knows the new line must show *N* lines, not
   *N+1* with a fabricated `R$ 0,00`. A `null` leaf means "recorded as not applicable" and renders as absent
   too — never as `0`.
3. **The document is written once and read whole.** No partial update, no relational query, no GIN index. If a
   future feature needs to *query inside* it, that is a signal to project the needed field into a **new typed
   column** (additive migration), never to start mutating documents.

---

## 4. Constraints (exact)

Table `snapshots` (all `CHECK`s named via `NAMING_CONVENTION` ⇒ `ck_snapshots_*`):

These are the constraint names as ACTUALLY shipped in `0003` (the migration is the source of truth; the ORM
`__table_args__` mirrors them via `NAMING_CONVENTION`):

```
ck_snapshots_kind_enum                 kind IN ('SINGLE','KIT')
ck_snapshots_headline_basis_enum       headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO')
ck_snapshots_label_not_blank           label IS NULL OR length(btrim(label)) > 0
ck_snapshots_quote_validity_days_range quote_validity_days IS NULL
                                         OR (quote_validity_days > 0 AND quote_validity_days <= 3650)
ck_snapshots_device_quoted_at_finite   device_quoted_at > '-infinity' AND device_quoted_at < 'infinity'
ck_snapshots_device_utc_offset_range   device_utc_offset_minutes BETWEEN -840 AND 840
ck_snapshots_payload_is_object         jsonb_typeof(payload) = 'object'
ck_snapshots_model_version_set         length(btrim(model_version)) > 0
ck_snapshots_payload_schema_valid      payload_schema_version >= 1
ck_snapshots_headline_total_valid      headline_total >= 0 AND headline_total <> 'NaN'::numeric
-- the document↔column bindings (immutable expressions ⇒ plain CHECKs, no trigger needed):
ck_snapshots_payload_kind_matches      (payload->>'kind') = kind
ck_snapshots_payload_version_matches   (payload->>'modelVersion') = model_version
ck_snapshots_payload_schema_matches    (payload->>'schemaVersion')::int = payload_schema_version
-- the MONEY binding = the DB BACKSTOP for VR-503 (the app-layer validator is primary).
--   map = {PRECO_VAREJO -> precoVarejo, PRECO_ATACADO -> precoAtacado}:
ck_snapshots_headline_matches_totals   headline_total =
                                         ((payload->'totals') ->> (CASE headline_basis
                                           WHEN 'PRECO_VAREJO' THEN 'precoVarejo'
                                           WHEN 'PRECO_ATACADO' THEN 'precoAtacado' END))::numeric
```

> Why the last three were added late (review PR-A §2b): the DB already bound `kind` and `modelVersion` to the
> document for free — the two fields that are **not** money — but bound **neither** field that **is** money.
> `ck_snapshots_headline_matches_totals` (the card total ↔ the detail's basis total) and
> `ck_snapshots_headline_total_valid` (the ADR-0008 finite-non-negative guard, previously the only money column
> in the schema without it) close that gap. Both are cheap now and **impossible** to add after the first
> immutable row.

**Immutability trigger (D2 — pending owner/arquiteto approval):**

```sql
CREATE FUNCTION snapshots_reject_content_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF  NEW.id                       IS DISTINCT FROM OLD.id
   OR NEW.owner_uid                IS DISTINCT FROM OLD.owner_uid
   OR NEW.client_snapshot_id       IS DISTINCT FROM OLD.client_snapshot_id
   OR NEW.kind                     IS DISTINCT FROM OLD.kind
   OR NEW.quote_validity_days      IS DISTINCT FROM OLD.quote_validity_days
   OR NEW.device_quoted_at         IS DISTINCT FROM OLD.device_quoted_at
   OR NEW.device_utc_offset_minutes IS DISTINCT FROM OLD.device_utc_offset_minutes
   OR NEW.model_version            IS DISTINCT FROM OLD.model_version
   OR NEW.payload_schema_version   IS DISTINCT FROM OLD.payload_schema_version
   OR NEW.payload                  IS DISTINCT FROM OLD.payload
   OR NEW.headline_total           IS DISTINCT FROM OLD.headline_total
   OR NEW.headline_basis           IS DISTINCT FROM OLD.headline_basis
   OR NEW.created_at               IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'snapshot contents are immutable (FR-504); only label/deleted_at may change'
      USING ERRCODE = '23514';   -- check_violation ⇒ the app maps it like any constraint violation
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_snapshots_immutable BEFORE UPDATE ON snapshots
  FOR EACH ROW EXECUTE FUNCTION snapshots_reject_content_update();
-- ENABLE ALWAYS, not the default origin mode (review PR-A, C7): an origin-mode trigger does NOT fire
-- under `session_replication_role='replica'` (logical-replication apply, pg_restore --disable-triggers,
-- some DMS), which would silently void SC-504 in the DATABASE — the one thing the trigger exists to make
-- true. As SHIPPED, the function is named `snapshots_forbid_content_update()`.
ALTER TABLE snapshots ENABLE ALWAYS TRIGGER trg_snapshots_immutable;
```

The trigger covers **13 frozen columns** — the 16 table columns MINUS the 3 mutable below. Allowed to change:
**`label`, `deleted_at`, `updated_at`** — nothing else, from any writer, ever. (Note the `quote_validity_days`
line: per FR-504 *"only its label is editable"*, the validity period is **frozen content** — ⚠ §7.)

---

## 5. Indices

| Index | Definition | Serves |
|---|---|---|
| `ix_snapshots_owner_uid` | `(owner_uid)` | the FK / tenant key (house symmetry with `boms`) |
| `ix_snapshots_owner_active` | `(owner_uid, device_quoted_at, id) WHERE deleted_at IS NULL` | FR-511 isolation + FR-523 newest-first (backward scan) + FR-520 date range + the keyset cursor |
| `uq_snapshots_owner_client_snapshot` | **UNIQUE** `(owner_uid, client_snapshot_id)` — **unconditional** (includes tombstones) | SC-513 exactly-once; delete-then-retry cannot resurrect (D2/D6) |
| *(none on `payload`)* | — | deliberate: the document is never queried (§3.3) |
| *(future, additive)* | GIN `pg_trgm` on `lower(label)` | only if label search ever proves slow (D4) — needs the `pg_trgm` extension ⇒ owner call **then**, not now |

---

## 6. Migration `0003` outline

`backend/alembic/versions/0003_e4_snapshots.py` — `revision = "0003"`, `down_revision = "0002"`. **Additive
only**: `0001`/`0002` are shipped and are never amended (ADR-0013 R4). Nothing in `products`, `boms`,
`bom_lines`, `filaments`, `printers`, `accounts` or `entitlement_grants` is touched — **E4 adds a shelf, it does
not alter the existing ones** (FR-526).

**`upgrade()`**
1. `op.create_table("snapshots", …)` — the columns of §2, the `CHECK`s of §4, `ForeignKeyConstraint(["owner_uid"],
   ["accounts.account_uid"], name=op.f("fk_snapshots_owner_uid_accounts"))` (**the only FK**),
   `PrimaryKeyConstraint("id", name=op.f("pk_snapshots"))`, and
   `UniqueConstraint("owner_uid", "client_snapshot_id", name="uq_snapshots_owner_client_snapshot")` (explicitly
   named — the `uq_%(table_name)s_%(column_0_name)s` convention would yield the ambiguous `uq_snapshots_owner_uid`).
2. `op.create_index(op.f("ix_snapshots_owner_uid"), …)`.
3. `op.create_index("ix_snapshots_owner_active", "snapshots", ["owner_uid", "device_quoted_at", "id"],
   postgresql_where=sa.text("deleted_at IS NULL"))`.
4. `op.execute(CREATE FUNCTION snapshots_reject_content_update …)` then `op.execute(CREATE TRIGGER
   trg_snapshots_immutable …)` — **only if D2/Option B is approved**.

**`downgrade()`** (reversible, exact reverse): `DROP TRIGGER` → `DROP FUNCTION` → drop the two indices → drop the
table. No data migration exists in either direction (the table is new; nothing pre-exists).

**No extension is required** (no `pg_trgm`, no `uuid-ossp`, no `pgcrypto`) — `uuid7` is app-minted, as in
`0001`/`0002`. Cloud-SQL-portable (A41) including the PL/pgSQL trigger.

---

## 7. Open points — owner confirmation required (Principle VIII)

1. **`headline_total` / `headline_basis` (§2).** The list card and the quote show *"the total"* — but E1 computes
   `custoTotal`, `precoVarejo`, `precoAtacado` **and** per-channel announce prices. Which number is *the price
   the seller quoted*? Recommended: `precoVarejo`, stored in `headline_total` with `headline_basis =
   'PRECO_VAREJO'` so the number is **never ambiguous** and an atacado quote is representable later at zero cost.
   Alternative: let the seller *choose* at record time ("qual preço você está cotando?") — more honest to "a
   snapshot is the seller's assertion", but it is new UX. **Owner decides.** (Confidence in the recommendation:
   70% — this is a product question the spec did not answer.)
2. **Is `quote_validity_days` editable after recording?** FR-504 says *only the label* is editable ⇒ modeled as
   **frozen content** (the trigger blocks it); changing the validity means recording a new snapshot. Confirm.
3. **`created_at` (D5).** Keeping it contradicts the literal spec sentence *"no server-side received-at is
   stored"* — while a server-minted uuid7 PK **already** embeds a server timestamp, so the literal property is
   unachievable anyway. Recommendation: keep it, never surface it, never sort by it. **Owner: confirm or omit.**
4. **The immutability trigger (D2).** First PL/pgSQL in the project (E2 §0 said "plain tables/CHECK/RLS only" —
   portability is unaffected; it is the *mechanism class* that is new). Approve, or accept the weaker
   service-only guarantee and say so honestly in SC-504 ("0 write paths **in our code**").
5. **Accent-sensitive label search (D4).** `joao` will **not** find `João`. Accept, or add `unaccent` later.
6. **Payload size guard.** One document must have a maximum size (abuse/DoS). A byte cap is, indirectly, a cap on
   **kit size** — and E3 caps no number of lines. Proposal: **512 KB** (hundreds of kit lines), rejected with an
   **honest, visible 422** and **never a silent truncation**. The number must be owner-visible, not a silent
   limit. Confirm the number.

---

## 8. Validation rules (test-first; traced to FRs)

| VR | Rule | Traces |
|---|---|---|
| **VR-501** | Every money/quantity leaf in `payload` parses as a **finite** `Decimal`. ⚠ `Decimal("NaN")` **is valid Python** — the validator must assert `d.is_finite()` (the in-JSON twin of the `<> 'NaN'::numeric` CHECK, which cannot reach inside JSONB). Magnitude ceilings mirror `app/api/products.py::_CEIL_*`. | FR-502, FR-525 |
| **VR-502** | **No JSON float anywhere in `payload`** — a recursive write-time scan rejects any `float` leaf; a stored-document test re-scans after a round-trip (psycopg would silently decode a JSON number to `float`). | FR-525 |
| **VR-503** | The denormalized columns agree with the document at write: `payload->>'kind' = kind`, `payload->>'modelVersion' = model_version` and `(payload->>'schemaVersion')::int = payload_schema_version` (**DB CHECKs**, §4); and the money binding `headline_total == Decimal(payload.totals[map(headline_basis)])`, where `map = {PRECO_VAREJO -> precoVarejo, PRECO_ATACADO -> precoAtacado}` — the app-layer validator is **primary**, the DB CHECK `ck_snapshots_headline_matches_totals` is the backstop. (The FLAT envelope has `totals` at the ROOT — there is no `payload.result`.) Immutability then makes drift impossible forever. | FR-502 |
| **VR-504** | **Absence ≠ zero.** Golden-fixture test: a `3.1.0` document rendered by a UI that knows a *later* line shows **only the recorded lines** — never a fabricated `R$ 0,00`. | FR-507 |
| **VR-505** | Immutability: `UPDATE snapshots SET payload/device_quoted_at/model_version/headline_total …` **raises**; `UPDATE … SET label` succeeds; `UPDATE … SET deleted_at` succeeds. | FR-504, SC-504 |
| **VR-506** | **Zero catalog FKs**: a schema assertion that `snapshots` has **exactly one** foreign key, to `accounts` — the two-shelf rule as an executable guard. Plus: hard-delete a `products` row → the snapshot row is **byte-identical** (payload, total, date, version). | FR-503, SC-502 |
| **VR-507** | Exactly-once: the same `(owner_uid, client_snapshot_id)` inserted twice ⇒ **one** row; **delete → retry** ⇒ still one row, **still deleted** (no resurrection); two records with identical content but different client ids ⇒ **two** rows. | FR-527, SC-513 |
| **VR-508** | `device_quoted_at` is stored **verbatim** — a test asserts the server does **not** substitute `now()` even when the supplied date is in the future or the past; `'infinity'` is rejected. | FR-528 |
| **VR-509** | No TTL: a snapshot whose `quote_validity_days` has elapsed still **lists and reads** unchanged; no job deletes anything, ever. | FR-518 |
| **VR-510** | Recording materializes **nothing**: catalog row counts (`filaments`/`printers`/`products`/`boms`/`bom_lines`) are identical before and after every record path — the explicit contrast with E3's K3. | FR-508, SC-505 |
| **VR-511** | Isolation: account B cannot read, label, delete or export A's snapshot; the response is **indistinguishable from non-existent** (no existence oracle) — including a guessed `client_snapshot_id`. | FR-511, SC-509 |
| **VR-512** | Lapse: every snapshot stays **readable**, **0** writes succeed, **0** rows are deleted or modified; re-grant restores writes with data intact (zero schema footprint — the E2 authorization freeze, unchanged). | FR-517, SC-508 |

---

## 9. What the arquiteto must bind to (cross-agent contract)

1. **Idempotency key — `client_snapshot_id`.** A `uuid` **minted on the device at RECORD time** (not at send
   time — a key minted at send time regenerates after an app restart and **duplicates**), persisted with the
   queued document, and replayed unchanged on every retry. **Recommended transport: a required body field
   `clientSnapshotId`** (it is part of the record's identity and must survive an app restart *inside* the queued
   document; an HTTP header is easier for a retry wrapper to drop). A header would work identically at the DB —
   the transport is the arquiteto's call, the **DB contract is fixed**: `UNIQUE (owner_uid, client_snapshot_id)`,
   unconditional, and dedup via `INSERT … ON CONFLICT DO NOTHING` + read-back ⇒ **a retry returns the original
   row, never a duplicate and never a failure-shaped error**.
2. **The server has no queue state.** No `pending`/`syncing`/`rejected` column exists or may be added. A row
   exists only when the server has accepted it (FR-529); a denied sync writes **nothing**. The visible pending
   state is device-local.
3. **`device_quoted_at` + `device_utc_offset_minutes` are stored verbatim.** The service must never substitute a
   server clock, and must never expose `created_at` (FR-528).
4. **The immutability trigger (if approved) is a DB-level backstop, not a substitute** for a service that simply
   has **no content-update path**: only `PATCH label` and `DELETE` (soft) exist. A trigger violation surfaces as
   `ERRCODE 23514` (check_violation).
5. **Provenance never resolves for values.** The "abrir origem" affordance is a **read-time** resolution
   (owner-scoped + `deleted_at IS NULL`); when it misses, the affordance is **absent** — no degraded caption, no
   "produto excluído", no warning (that would be the E3 reflex misfiring, and FR-503 forbids it).
6. **Payload validation is structural, not shape-pinning (80%).** Validate the **flat envelope**
   (`schemaVersion`, `kind`, `modelVersion`, `catalogVersion`, `provenance`, and `totals` present — plus
   `inputs`/`breakdown` for SINGLE or `lines` for KIT; there is **no `result` wrapper**) and the **leaves**
   generically (finite decimal strings, no floats, magnitude + size caps) — do **not** mirror
   `PriceResult`/`BomResult` field-by-field in pydantic. Pinning the inner shape would make a pricing-core
   version bump **reject its own payloads** until the backend redeploys — which destroys the one property JSONB
   was chosen for.
7. **Export (FR-513) reads the stored decimal strings.** No parse-to-float, no re-derivation, no recompute — the
   exported cell **is** the stored character sequence.
8. **`pricing-core` needs no change for recording** (recording freezes existing outputs). "Recalcular hoje"
   (FR-505) runs the **current** engine on the stored `payload.inputs` and **inserts a new row** — it is a
   create, never an update. The stored inputs must therefore be complete enough to re-run `computeCalculator` /
   `computeBom` without touching the catalog: that is why `payload.inputs` holds the **fully resolved**
   `PriceInput` (filament/printer values inlined), not references.
