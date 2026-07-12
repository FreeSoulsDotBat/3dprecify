# ADR-0017: Kit-save materialization — atomic transaction, path-scoped FR-310 relaxation, name-dedup

- **Status**: Accepted (owner, at the PR-B gate — 2026-07-12)
- **Date**: 2026-07-11 (accepted 2026-07-12)
- **Deciders**: Jonatan (owner) + arquiteto + Claude
- **Extends**: ADR-0013 (persistence stack) · relates ADR-0012 (entitlement) · ADR-0015 (BOM enforcement) · ADR-0016 (compose contract)

## Context

The E3 spec's **2026-07-11 amendment (K3/K4, FR-415/FR-416, US6)** decides that when a premium seller **saves a
kit** (the user-facing name for a persisted BOM), every **ad-hoc** line MUST **materialize** as a catalog **manual
product** — the line's values, **no** filament/printer references at creation, an **attention indicator** until a
saved filament AND printer are linked — and MUST **dedup by name** within the account (an existing product with
that name is *referenced*, not duplicated). After a successful save every kit line therefore corresponds to a
catalog product, and a denied/failed save MUST materialize **nothing** (all-or-nothing).

This is the first place the product mutates **two** catalog surfaces (`boms` + `products`) in one user action, so
the transaction boundary, the FR-310 relaxation location, and the dedup rule are decisions worth recording.

**Constraints / verified ground truth (`backend/app/`):**
- `create_product` (public POST /products) **requires** `filamentId`+`printerId` at create (FR-310) — a shipped
  guarantee that MUST hold unchanged.
- The `products` table CHECKs are **link-OR-snapshot** (`ck_products_filament_link_or_snapshot` /
  `..._printer_...`): a row with `filament_id=NULL`, `printer_id=NULL` **and** full resolved snapshot values
  already **passes** (degraded products live in this exact shape). ⇒ a materialized manual row needs **no schema
  change**.
- There is **no unique index** on `products(owner_uid, name)` (migration 0001) — E2 currently allows duplicate
  names; the "attention" state must be **derived**, not a new column (K3).
- Persistence is server-authoritative (ADR-0015): writes pass `require_entitlement`; a single SQLAlchemy session
  commit is already the E2 write idiom (`create_product`).

## Options considered (≥3, per Constitution)

### Option A — Server-side single-transaction materialization in a dedicated kit-save service (CHOSEN)
POST/PUT `/api/v1/boms` runs one transaction: per ad-hoc line → dedup-SELECT (owned + live + trim-exact name); a
hit reuses the id (`referenced`), a miss builds a `Product` row directly (`filament_id=NULL`, `printer_id=NULL`,
full snapshot from the line's value-set) and `session.add`s it (`created`); then the `Bom` + `bom_lines` link the
resolved product ids; **one `session.commit()`**. The FR-310 relaxation is **path-scoped by construction** — this
service builds `Product` rows itself and never calls `create_product`.
- Pros: genuinely all-or-nothing (FR-415/SC-411 by construction — a rollback undoes materialized products too);
  reuses the E2 single-commit idiom + the existing link-or-snapshot CHECKs (**zero** `products` migration); the
  public FR-310 stays untouched; dedup is a plain owner+live SELECT (mirrors `_resolve_filament`); scales as the
  `product : filament/printer` reference fractal one level up.
- Cons: the kit-save service is a new, slightly heavier write path than `create_product` (multi-row, in-txn dedup
  map for intra-save same-name lines); an "adjusted bound line" convention (edit-after-bind) must be defined in
  the composer (unbind → ad-hoc → materialize; a referenced line stays live) — a PR-B UI detail.
- Scalability impact: high — same server boundary as all of E2+; a future async/bulk materialization can replace
  the loop without contract change.
- Confidence: 84%.

### Option B — Client two-phase (client POSTs each ad-hoc piece to /products, then POSTs the kit with ids)
- Pros: no new server service; reuses the existing product-create endpoint.
- Cons: **not atomic** — a failure between the two phases leaves orphan manual products in the catalog (violates
  FR-415); **forces relaxing the PUBLIC FR-310** (the endpoint would have to accept ref-less products for
  everyone, regressing E2); extra round-trips; a client-driven multi-write races and cannot be server-guaranteed.
- Scalability impact: negative (atomicity pushed onto an untrusted client).
- Confidence: 30%.

### Option C — DB-enforced dedup: partial unique index on `products(owner_uid, name) WHERE deleted_at IS NULL` + `ON CONFLICT`
- Pros: dedup guaranteed at the storage layer; race-proof.
- Cons: **changes shipped E2 semantics** (direct product creation would now reject a duplicate name — a behavior
  the owner never authorized); the creating migration can **FAIL** on any account that already holds duplicate
  names (E2 allowed them); couples an E3 feature to a schema-wide constraint on the E2 catalog. Service-level
  dedup (A) achieves the same *for the kit-save path* without any of this.
- Scalability impact: mixed — robust dedup, but at the cost of E2 regression risk and a fragile migration.
- Confidence: 40%.

## Decision

**Option A**, with these sub-rules:

1. **Atomic boundary.** The entire POST/PUT `/api/v1/boms` handler is **one transaction** behind
   `require_entitlement`; materialize + dedup + create/replace kit + lines, then a single commit. Any denial or
   validation error persists **nothing** (SC-411). Intra-save same-name ad-hoc lines dedup against an in-txn
   `{trimmedName → productId}` map seeded from the SELECTs (no duplicate within a save either).

2. **Path-scoped FR-310 relaxation.** Only the kit-save service constructs ref-less manual `Product` rows
   (`filament_id=NULL`, `printer_id=NULL`, full snapshot from the line's `pieceInputs`+`filamentValues`+
   `printerValues`+`tariffPerKwh`+`channels`+`otherCosts`). The existing table CHECKs admit this — **no `products`
   migration**. The public `create_product` keeps requiring both references (FR-310 untouched).

3. **Name-dedup rule.** Per-account, **trim + exact (case-sensitive)** match on `btrim(name)` (consistent with
   E2's `.strip()`; E2 has no case-folding), filtered to **live** rows (`deleted_at IS NULL` — a name matching
   only a soft-deleted product materializes a NEW product, never references a dead row). A collision with
   **different** values → the reference wins and the typed values are **superseded**, surfaced honestly (never
   silent). **No unique index** is added (avoids regressing E2 and a failure-prone migration).

4. **Manual-product state (attention indicator).** **Derived** from `filament_id IS NULL OR printer_id IS NULL`,
   **no new column**. Born-manual and degraded-by-deletion are **unified** into one honest state — the remedy is
   identical ("vincule um filamento e uma impressora salvos") and clears once both are linked (SC-412).

5. **Wire shape (camelCase, money = decimal strings).** `BomLineIn` gains, for ad-hoc lines, a required
   `pieceName` (client pre-fills `"Peça {n} · {kit name}"`) plus the `ProductIn` value-set; a `@model_validator`
   enforces exactly one of `{productId}` XOR `{ad-hoc value-set + pieceName}` (else 422, no existence oracle).
   `BomLineOut` stays pure; the POST/PUT response carries a **write-only** envelope
   `BomOut.materializations: [{ position, productId, action: "created" | "referenced" }]` so the client can
   honestly message created-vs-referenced (absent on GET).

Jonatan approves this ADR at the PR-B gate (Proposed until then).

**Accepted 2026-07-12 at the PR-B gate**, as built and as specified. Two notes from the implementation:

- The **case-sensitivity flag** in sub-rule 3 (exact vs case-insensitive, ~75% confidence) held: dedup is
  trim + exact, consistent with E2, and is pinned by a test asserting that `"suporte l"` and `"Suporte L"` are
  two different pieces. If sellers report this as surprising, case-folding is a contained follow-up (one SELECT
  and one test) — it was not guessed at now.
- Sub-rule 5's **edit-after-bind** case (left to "a PR-B UI detail") was settled in the composer: a bound line
  the seller EDITS unbinds and materializes as its own piece. Saving it as a reference would let the live
  product's values supersede the adjustment they just typed — silent data loss, the exact failure this ADR
  exists to prevent.

## Consequences

- **Positive:** FR-415 atomicity and SC-411 zero-duplicate hold by construction; the E2 catalog, its CHECKs, and
  the public FR-310 create path are all untouched (no regression); reuses the E2 single-commit + owner-scoped
  SELECT idioms and the link-or-snapshot fractal; the attention state adds zero schema footprint.
- **Negative / trade-offs accepted:** every persisted `bom_line` is now born with a `product_id` (ad-hoc lines
  materialize first) — the snapshot-only branch of the `bom_lines` CHECK is reachable only via degradation, a
  tightening the data-model/contracts deltas must reflect; the derived indicator also appears on pre-existing E2
  degraded products (accepted as an honest improvement); a two-device concurrent double-save could, in the
  pathological single-user case, create a duplicate product (self-healing, never a money error) — the price of
  not adding a unique index.
- **Follow-ups / triggered work:** data-model.md + contracts/api-surface.md deltas (BomLineIn `pieceName`+value-set,
  BomOut `materializations`, "born product_id" note) — applied by the parent from R8; tasks add the kit-save
  service, the derived-indicator UI, and the intra-save dedup test. A hard DB-level dedup, if ever desired, is a
  separate ADR that must first reconcile existing E2 duplicate names.

---

## Addendum — 2026-07-12 (PR-B review gate): §6 — D6 kit-line degradation is READ-TIME, not delete-capture

- **Status**: Accepted (owner, at the PR-B gate — 2026-07-12), same gate as the body above.
- **Deciders**: Jonatan (owner) + arquiteto + Claude.

### Context
A PR-B pre-merge review found a BLOCKER in the kit read path: soft-deleting a product a kit
referenced left the read serving the dead product as `degraded: false` (an honesty lie) AND made the
kit unsaveable (a PUT re-sent the stale `productId` → 422). The plan (T020, data-model §D6, quickstart
§5) documented D6 as an `ON DELETE SET NULL` event and/or "delete-capture" mirroring the E2
filament/printer → product delete. Two verified facts make that unreachable as written: (a)
`delete_product` is a **soft delete** (`deleted_at = now`, unchanged since E2) — `ON DELETE SET NULL`
never fires on a soft delete; (b) the kit read resolver did not filter `deleted_at`, so it disagreed
with the write resolver (`_resolve_product`, owner + live).

### Options considered
- **Option R — read-time degrade in the kit resolver (CHOSEN, 88%).** `delete_product` stays a plain
  soft-delete. `_resolve_views` resolves owner-scoped AND live-only (`deleted_at IS NULL`) — the SAME
  filter as the write path — so a soft-deleted/cross-tenant product is absent from the map and its line
  serves `degraded: true` + the last-known snapshot. `_snapshot_line` re-writes the FULL value-set on
  EVERY kit save, so the snapshot is always current and degradation is lossless without delete-time
  capture. The `product_id` FK keeps `ON DELETE SET NULL` purely as defense for a hypothetical HARD
  purge. Pros: read path self-defends (can't serve a dead product as live however it died); NO
  `products` → `bom_lines` coupling; zero change to the shipped E2 delete path (SC-409 by construction);
  write and read resolvers share one live+owner filter (closes the 422-on-re-save bug). Cons: the stored
  `product_id` keeps pointing at the soft-deleted (still-present) row — a dangling-but-harmless reference
  (FK intact, read-filtered, safe under hard purge); a deliberate inconsistency with E2's eager-unlink.
- **Option C — eager delete-capture (the planned T020, mirror E2), 55%.** `delete_product` UPDATEs every
  referencing `bom_line` (snapshot + `product_id` NULL) in the same txn. Cons: couples the `products`
  aggregate to `bom_lines` (inverts the clean dependency direction); modifies a shipped, homologated E2
  handler (SC-409 risk); duplicates the snapshot policy; makes the FK redundant; a read that trusts
  "FK ⇒ live" is fragile to any future delete path that forgets to unlink.
- **Option H — hard delete so `ON DELETE SET NULL` fires (literal plan text), 20%.** Requires making
  `delete_product` a hard delete — destroys the soft-delete/lapse-freeze guarantee (FR-409/Q3) and the
  E2 catalog's own D6. Non-starter.

### Decision
**Option R.** D6 for kit lines is read-time degradation, not delete-capture. The `product_id` FK retains
`ON DELETE SET NULL` as defense for a hard purge only.

### On the deliberate E2 inconsistency (why it is acceptable)
The two subsystems degrade at DIFFERENT layers because their read paths differ: `products._live_links`
does NOT filter the linked filament/printer's `deleted_at` (so E2 MUST eager-unlink to keep "a present
link ⇒ a live row" true); the kit read (`_resolve_views`) DOES filter the linked product's `deleted_at`
(so it degrades at read). Both honor the same D6 contract — a deleted reference ⇒ degraded, lossless,
editable, re-saveable. R is the stronger mechanism. If uniformity is ever wanted, the correct direction
is to migrate E2 toward R under its own ADR — never to drag E3 back to eager-capture.

### Consequences
- Positive: SC-405 (degraded line priceable + re-saveable) and the D6 honesty fix hold by construction;
  SC-409 untouched (no E2 delete change); the link-or-snapshot CHECK holds in every state.
- Accepted: a non-null `product_id` to a soft-deleted row (harmless, documented); D6 differs from E2;
  `_snapshot_line` running on every save is load-bearing (skipping it for product-linked lines would
  break the hard-purge CHECK safety) — pinned by test.
