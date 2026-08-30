# ADR-0021: Scenario persistence & the live-reference model — hybrid JSONB config, store-intent/resolve-live, no-FK Product-or-Kit basis

- **Status**: Accepted (2026-07-20 — owner homologation = merge of PR #24, `8386972`; decisions recorded in
  spec §Clarifications session 2026-07-19)
- **Date**: 2026-07-17
- **Deciders**: Jonatan (owner) + arquiteto + dev-estrutura-de-dados + Claude
- **Extends**: ADR-0013 (persistence stack) · ADR-0017 (kit-save + §6 read-time reference degradation)
- **Relates**: ADR-0011 (pricing-core 3.x multi-channel result contract) · ADR-0012 (entitlement) ·
  ADR-0015 (client-guard over server-gated data) · ADR-0008 (backend never recomputes) · ADR-0010 (fee catalog)

## Context

E5 (`010-e5-saved-scenarios`) adds the product's **fourth** persistent object: a **saved marketplace scenario**
— the **live mirror of a frozen E4 snapshot**. Where an E4 snapshot **contains** its values and can never change
(ADR-0019), a scenario **references** the catalog and **re-resolves live** on reopen. It is the deliberate
opposite, and it must reuse E2/E3's live-reflect (D3) + read-time last-known degradation (D6, ADR-0017 §6)
**verbatim**, not reinvent them.

Three clarifications (spec §Clarifications 2026-07-17) fix the forces:

- **Q3 — freeze intent, resolve values live.** A scenario stores the channel set + determinant choices + the
  seller's **explicit** per-slot fee overrides; **non-overridden** fees and catalog references **re-resolve** from
  today's catalog on reopen.
- **Q2 — cost basis = both.** An ad-hoc piece-input set **or** a Product/Kit reference; a reference live-reflects
  (D3) and degrades to last-known (D6).
- **Q4 — online-only writes.** No offline outbox (ADR-0018 deliberately not reused); the offline **read** cache is
  reused.

Two structural choices are E5-new and are **not** settled by the existing ADRs — hence this record (Constitution
Principle VIII + Principle V "deviate only with recorded justification"):

- **N1** — how the scenario config is stored. A scenario is **MUTABLE/editable**, so E4's "JSONB because the row
  is immutable, no `ALTER` on frozen rows" argument does **not** transfer; the choice must be re-derived.
- **N2** — how a Product **or** Kit reference basis is modeled and how D3/D6 reconcile, given the config is JSONB
  and the basis is polymorphic.

**Verified ground truth** (repo, 2026-07-17; full detail in `specs/010-e5-saved-scenarios/research.md`):
`pricing-core` is `3.1.0` and needs **no change** (R-A, 92%) — fee resolution + the override model already run
client-side in `apps/web/src/features/calculator/{fee-prefill,calculator-model}.ts`, and `computeCalculator`/
`computeBom` already take **already-resolved** channels. The E3 reference-degradation seam
(`backend/app/api/boms.py`: `_resolve_views` owner+live filter → D3/D6; `_snapshot_line` re-captures on every
write → lossless D6; `PUT /boms/{id}` full-replace) is shipped and is what E5 reuses. The E4 `snapshots` table is
the no-FK-provenance + JSONB-document + money-as-decimal-string precedent (ADR-0019 §5). Entitlement
(ADR-0012), the persistence stack (ADR-0013), and the client-guard model (ADR-0015) are reused verbatim — **E5
introduces no new gate.**

## Options considered (≥3, per Constitution)

The decision has two coupled axes (N1 config shape · N2 reference model). The options below are the coherent
*combinations* (a shape that cannot express the polymorphic basis is not a real option).

### Option A — Hybrid JSONB config (typed metadata + one `config` document) + no-FK Product-or-Kit basis, read-time server resolve/degrade (CHOSEN)

Typed columns for what the DB queries/orders/constrains (owner, `name`, `note`, timestamps, soft-delete) + one
`config JSONB NOT NULL` holding `{ framingIncluded, markup, channelSet, otherCosts, costBasis }`, money leaves as
decimal strings. The **cost basis lives inside `config`** as a discriminated shape
(`ADHOC` | `PRODUCT` + captured snapshot | `KIT` + captured line snapshots) carrying `{ kind, refId, refName,
snapshot }` and **no foreign key**. D3/D6 are resolved **server-side at read time** by reusing the E3
`_resolve_views` owner + `deleted_at IS NULL` seam; the snapshot is re-captured on every scenario save (lossless
D6). The client recomputes live (`computeCalculator`/`computeBom`) with the resolved-or-degraded basis + the
scenario's channel intent (non-overridden fees re-resolved from today's catalog, overrides kept).

- **Pros:** the query surface (name/owner/timestamps/soft-delete) is fully typed + indexable while the strategy +
  the **polymorphic basis** live in one document that edits as a whole (matches the full-replace edit model, `PUT`);
  reuses ADR-0017 §6 degradation + ADR-0019 §5 no-FK provenance + the 005 fee resolver + the E4 money invariant —
  **invents nothing**; a future determinant/channel-field addition needs **no `ALTER`** (intent is re-fed to
  today's engine, so the stored intent is version-independent); no FK ⇒ no `SET NULL`-writes-a-row problem, no
  undeletable catalog, no cascade-deletes-your-scenario, and the Product-OR-Kit polymorphism is expressed by one
  discriminator instead of two nullable FKs.
- **Cons:** the DB cannot `CHECK` money inside the document (mitigated by an app-layer recursive decimal-string
  validator + a stored round-trip re-scan, the E4 rule); the stored `refId` may point at a soft-deleted row
  (harmless — read-filtered; the documented E3 §6 trade-off); the config is opaque to SQL (deliberate — nothing
  queries inside it).
- **Scalability impact:** high — one table, one document, one reused degradation seam; a future "query inside the
  config" need is a signal to project one field into a new typed column (additive), never to mutate documents.
- **Confidence:** 80%.

### Option B — Fully relational (`scenarios` + `scenario_channels` + `scenario_other_costs` + `scenario_basis_lines`) + nullable basis FK(s) `ON DELETE SET NULL`

The E2/E3 `products`/`boms` idiom taken literally: typed columns + child tables + a nullable `basis_product_id` /
`basis_bom_id` FK.

- **Pros:** DB CHECKs on every money leaf; the config is SQL-queryable; it is the "house pattern" for a mutable
  entity.
- **Cons:** re-implements the entire `bom_lines` link-or-snapshot machinery inside a scenario sub-table for the
  **polymorphic** basis (Product OR Kit, and a Kit is itself multi-line); **two** nullable FKs whose `ON DELETE
  SET NULL` **never fires** because `products`/`boms` are **soft**-deleted (the verified ADR-0017 §6 finding — dead
  machinery); every future channel/determinant field is an `ALTER` on a mutable table; and **nothing needs the
  queryability** — no requirement queries inside a scenario config (habit, not a requirement).
- **Scalability impact:** medium — more joins per read/write; the edit becomes a multi-table replace.
- **Confidence:** 40%.

### Option C — Freeze the basis inputs at save + re-resolve fees only (basis frozen, fees live)

Store the resolved basis values at save and never re-resolve the reference; only the channel fees re-resolve live.

- **Pros:** the simplest recompute (the basis never moves); no reference resolution at read time.
- **Cons:** **directly contradicts FR-607a** — D3 live-reflect is *required* for a referenced basis. Freezing the
  basis turns it into a snapshot, discarding the "live mirror" that defines a scenario (a filament-cost rise on
  the referenced product would never show up, which is exactly the thing a scenario is meant to surface). It would
  need an owner amendment to Q2 to be viable.
- **Scalability impact:** low — a narrower, less honest "live".
- **Confidence:** 12%.

## Decision

**Option A**, with these sub-rules (proposed; owner accepts at the PR-A gate):

1. **Hybrid config (N1).** One `scenarios` table: typed metadata columns (`id` uuid7 PK, `owner_uid` FK →
   `accounts`, `name`, `note`, `created_at`, `updated_at`, `deleted_at`) + one `config JSONB NOT NULL`. **The
   `owner_uid → accounts` FK is the ONLY foreign key on the table.** Money/rate/quantity/percent leaves inside
   `config` are **decimal strings**; a recursive write-time validator rejects a float leaf; the DDL, CHECKs, and a
   payload size cap are the data-model agent's (`data-model.md`). This is a **conscious deviation** from the
   "mutable ⇒ relational" idiom, justified by: the config edits as a whole (not partially queried), the basis is
   polymorphic, and the stored intent is version-independent.

2. **No-FK Product-or-Kit basis (N2).** The cost basis is stored inside `config.costBasis` as a discriminated
   shape (`ADHOC` | `PRODUCT` + snapshot | `KIT` + line snapshots), carrying `{ kind, refId, refName, snapshot }`
   with **no foreign key**. Two independent reasons: the basis is polymorphic (one column cannot FK two tables),
   and `ON DELETE SET NULL` is dead machinery under soft-delete while also unable to reach inside JSONB.

3. **Store intent, resolve values live (Q3).** The scenario persists determinants + explicit overrides; a
   **blank** per-slot fee re-resolves from today's fee catalog on reopen (`resolveSlotEntry`/`entryToChannelFees`,
   feature layer, unchanged), an **overridden** fee sticks with the *"ajustado por você"* seal. The backend stores
   **no resolved fee and no price**; the recompute is client-side (FR-619, ADR-0015). **`pricing-core` does not
   change** (R-A).

4. **D3/D6 via the shipped seam.** `GET /scenarios/{id}` (and every write response) resolves the reference
   **server-side, owner + `deleted_at IS NULL`** (reusing `_resolve_views`): resolves ⇒ live values +
   `degraded: false` (D3); absent ⇒ the captured snapshot + `degraded: true` + the captured name (D6) — never
   blank, never *"removido"*, still priceable + re-saveable. The snapshot is **re-captured on every scenario save**
   (the `_snapshot_line` discipline — lossless D6). "Abrir origem" is a read-time affordance (offered only if the
   id resolves owned + live).

5. **Full-config edit is `PUT /scenarios/{id}`** (full-replace, mirroring `PUT /boms/{id}`); **rename is
   `PATCH`** (`name`/`note` only, `extra="forbid"`). This resolves the spec four-object-map "whole config editable"
   requirement that the brief's op-list did not enumerate — flagged for owner confirmation.

6. **Materializes nothing (FR-604).** A scenario write creates no product/kit/filament/printer — no
   `materializations` envelope (the explicit contrast with E3 K3/ADR-0017).

**Two points are routed to the owner, not inferred (Principle VIII):**

- **Kit-basis composition.** How a scenario's *single* channel set + Outros custos + framing compose with a
  multi-line kit basis (which in E3 carries per-line channels + a per-marketplace rollup) is under-specified.
  Recommendation (70%): apply the scenario's channelSet uniformly to every kit line, then `computeBom` → rollup.
  **No `pricing-core` impact either way** (both engines exist).
- **Saving a reference to an already-deleted id.** Recommendation (75%): accept-and-degrade (consistent with
  "stores intent"), not a 422 (that E3 behavior exists because a kit-save *materializes*; E5 does not).

**Owner decisions recorded 2026-07-19** (T002 checkpoint, spec §Clarifications session): kit-basis composition =
**uniform channelSet on every kit line → `computeBom` → rollup**; save-to-deleted-id = **accept-and-degrade**;
sub-rule 5 (**`PUT` full-replace + `PATCH` rename as separate routes**) confirmed; plus the data-model §7 points
(name ≤120 / note ≤500 · list ordering `created_at DESC` · `config` cap 256 KB → honest 422 · accent-sensitive
search accepted · no model-version column). The ADR flips **Accepted at the PR-A merge homologation** (the E3
ADR-0017 / 011 ADR-0022 precedent: homologation = merge).

## Consequences

- **Positive:** reuses the shipped stack almost entirely (entitlement ADR-0012, persistence ADR-0013, degradation
  ADR-0017 §6, no-FK provenance ADR-0019 §5, the 005 fee resolver, the E4 money invariant, the uid-keyed offline
  **read** cache + purge-on-signout); `pricing-core` and the free 005 calculator are untouched (FR-620); the
  polymorphic basis and the full-config edit are expressed with **one** table and no dead FK machinery; a future
  formula change needs no scenario migration (the stored intent is re-fed to today's engine).
- **Negative / trade-offs accepted:** money inside `config` is guarded app-side, not by a DB CHECK (the E4 JSONB
  trade-off, re-accepted for a mutable entity); the stored `refId` can point at a soft-deleted row (harmless,
  read-filtered); the config is opaque to SQL; a scenario is the seller's own intent about their own strategy,
  readable only by them (no third-party-evidence claim — the E4 "honest limits" lineage).
- **Follow-ups / triggered work:** `data-model.md` owns the `scenarios` DDL, the `config` CHECKs, the size cap,
  and migration `0004` (`down_revision = "0003"`); `contracts/api-surface.md` owns the `/api/v1/scenarios` surface
  (delivered this round); `/speckit-tasks` adds the scenario CRUD + the client-side reopen recompute + the D3/D6
  reconciliation tests. Two owner questions (kit-basis composition, save-to-deleted-id) resolve at the plan/PR-A
  gate. The version-label drift ("3.0.0" → `3.1.0`) and the imprecise "result already carries `resolvedFee`"
  premise are flagged to the parent for spec/plan reconciliation (they do not change the R-A conclusion).
