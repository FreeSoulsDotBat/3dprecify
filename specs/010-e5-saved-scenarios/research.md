# Phase 0 Research — E5 saved marketplace scenarios (the fourth object)

Architecture decisions for E5 (`arquiteto` round, 2026-07-17), taken BEFORE implementation per Constitution
Principle VIII. Format mirrors E4: **Decision · Rationale · Alternatives (with confidence) · Risks pinned ·
Tests that must exist**. Every claim is checked against the shipped code (paths cited), not inferred
(Constitution II).

**Scope split (parallel agents).** The DATA MODEL — the concrete `scenarios` DDL, columns, CHECKs, indices,
migration `0004` — is owned by `dev-estrutura-de-dados` in parallel (`data-model.md`). This document owns the
**mechanism**, the **API contract**, the **`pricing-core` verification (R-A)** and the **ADR**, and states the
requirements the schema must satisfy (§"What the data model must provide"). Where the two must agree, this
document says so explicitly (§"Cross-agent contract"). This is a DRAFT proposed for owner sign-off; nothing is
finalized unilaterally.

**Status of the decided inputs (do NOT re-litigate — spec §Clarifications 2026-07-17):** Q1 (saved scenarios
only; no per-account fee auth), Q2 (cost basis = both ad-hoc **and** a Product/Kit reference), Q3 (freeze
intent, resolve values live), Q4 (online-only writes; no offline outbox). These are settled and are the ground
this document builds on.

---

## Verified ground truth (repo, 2026-07-17) — the premises every decision rests on

- **`pricing-core` is `3.1.0`, not `3.0.0`.** `packages/pricing-core/package.json` → `"version": "3.1.0"`;
  `packages/pricing-core/src/index.ts` → `export const PRICING_MODEL_VERSION = "3.1.0"` (line 14). E3/ADR-0016
  bumped 3.0.0 → 3.1.0 (additive: `computeBom` + money primitives). **The E5 spec/plan repeatedly say "3.0.0" —
  that label is stale** (flagged in §"Spec issues"). The multi-channel *result contract* from 005 is unchanged
  between 3.0.0 and 3.1.0; only the label moved.
- **`pricing-core` never resolves fees.** `ChannelInput` (index.ts lines 29-39, and its docstring: *"the client
  passes already-resolved fees in, FR-110/A6 … it never resolves fees"*) carries `commissionPct`, `fixedFee`,
  `minPerItem`, `freightCost`, `freightVoucherBands`, `priceBands`. Fee **resolution** is a **feature-layer**
  concern.
- **Fee resolution + the override model already ship, client-side.**
  `apps/web/src/features/calculator/fee-prefill.ts` (`slotDeterminants`, `resolveSlotEntry`, `entryToChannelFees`,
  `feeSealState`) resolves a slot's fees from the served/cached fee catalog (ADR-0010) by its **determinants**
  (marketplace + modality). `calculator-model.ts::processSlot` decides
  `useCatalog = entry !== null && !manual.hasManualInput`: a **blank** fee field re-resolves live from the
  catalog; **any typed fee** is a sticky manual **override** sealed *"ajustado por você"*. **This is exactly
  Q3's "freeze intent, resolve values live," already implemented** — a slot's determinants are the intent; a
  typed value is the explicit override.
- **`ChannelResult` carries only the reproducibility KEY, not the resolved fees.** The ADR-0011 **Amendment
  (2026-07-07)** *deferred* the denormalized `commissionPct/fixedFee/minPerItem/appliedBand` echo onto
  `ChannelResult` to **E4**; the shipped `ChannelResult` (index.ts lines 46-59) carries `marketplace` +
  `feeDeterminants` + `feeSource` + per-level prices + freight + `error`, and `PriceResult.catalogVersion`
  carries the artifact version. **The plan's premise wording — "the 005 result already carries `resolvedFee`" —
  is therefore imprecise** (§"Spec issues"). It does not matter for E5 (see R-A).
- **`CalcOutcome.input` is the exact `PriceInput` the engine computed from** (`calculator-model.ts` lines 62-78)
  — the persistable "intent" object for an ad-hoc basis is already produced by the shipped calculator.
- **The E2/E3 reference-resolution + degradation seam is shipped and is what N2 reuses.**
  `backend/app/api/boms.py`: `_resolve_views` resolves references **owner-scoped AND `deleted_at IS NULL`** — a
  soft-deleted/cross-tenant reference is simply *absent from the map* (D6); `_snapshot_line` re-writes the FULL
  resolved value-set on **every write** (lossless D6 without delete-capture); `_to_out` decides `degraded` at
  serialize time. `PUT /boms/{id}` is a **full-replace** edit. This is ADR-0017 §6 (read-time degradation), live.
- **The catalog schema idiom** (`backend/app/models/__init__.py`): `products`/`bom_lines` are typed columns for
  the pricing inputs **+ `channels` JSONB + `other_costs` JSONB** + a nullable reference FK
  (`ON DELETE SET NULL`, defense-for-hard-purge only) + resolved snapshot columns + a link-or-snapshot CHECK.
- **The E4 no-FK-provenance + JSONB-document + money-as-decimal-strings precedent** (`snapshots` table, ADR-0019
  §5): a captured `{kind, id, name}` provenance carries **no FK**; the frozen document is JSONB; every money leaf
  is a decimal string because `json.loads`/`JSON.parse` hand back floats.
- **The entitlement seam** (`backend/app/entitlement/__init__.py`): `require_entitlement` (writes, ACTIVE only) /
  `require_catalog_read` (reads, active|lapsed). Error envelopes `ENTITLEMENT_REQUIRED` (403), `VALIDATION_ERROR`
  (422), `NOT_FOUND` (404) already exist — **E5 needs no new `ErrorCode`.**
- **The offline substrate** is uid-keyed `idb-keyval` + purge-on-signout, a **read** cache
  (`entities/catalog/catalog-cache.ts`, `entities/bom/bom-cache.ts`). **E5 reuses the read cache and does NOT
  reuse the E4 outbox (ADR-0018)** — Q4 is online-only writes.
- **Migration numbering**: `0001`/`0002` (E2/E3), `0003` (E4 snapshots) are shipped and never amended (ADR-0013
  R4). E5's table lands in **`0004`** (`down_revision = "0003"`). Next free ADR number, by listing `docs/adr/`:
  **0021** (0018/0019/0020 are E4; the README index is stale at 0017).

---

## R-A — Does `pricing-core` need to change? **No.** (spec inferred ~85%; verified → **92%**)

### Decision

**Zero change to `packages/pricing-core`. It stays `3.1.0`. No version bump, no new export, no new type.**
Verified against the code, not the ADR text — and E5 needs **even less** from the engine than the plan assumed.

Everything E5 does is **persistence + feature-layer orchestration** of primitives that already exist:

1. **Recording the intent.** A scenario persists the seller's **intent** (Q3): the channel set + determinants +
   explicit per-slot overrides + framing flag + Outros custos + cost basis. The shipped calculator already
   models a channel slot as *determinants + optional typed overrides* (`ChannelSlotForm` →
   `processSlot`) and already emits the exact `PriceInput` it computed from (`CalcOutcome.input`). The engine
   is untouched: it neither knows nor cares that its input was reconstructed from a saved scenario.
2. **The live recompute on reopen.** Re-resolve non-overridden fees from **today's** catalog
   (`resolveSlotEntry`/`entryToChannelFees` — feature layer, unchanged), keep overridden fees, re-resolve the
   cost-basis reference live (D3) or degrade to last-known (D6) — then call **`computeCalculator`** (single-piece
   basis) or **`computeBom`** (kit basis). Both are exported today and take **already-resolved** channels. The
   engine performs no fee resolution and no reference resolution — those are the feature layer's job, exactly as
   in 005 and E3.
3. **The honest edge cases** the spec inherits (uncovered slot → *"sem referência"* + manual entry; commission
   ≥ 100% → per-slot error; ML subsidy *"estimativa"* seal; the staleness seal) are all already implemented in
   `fee-prefill.ts` + `processSlot` + `computeChannel`. E5 changes **which inputs are persisted**, never the
   math (FR-609/FR-620).

**Why the engine's `resolvedFee` echo being deferred to E4 does NOT bite E5.** The plan's premise leaned on
`ChannelResult` "already carrying `resolvedFee`." It does not (ADR-0011 Amendment). But E5 never needs a frozen
resolved fee: Q3 stores the **determinants** (the reproducibility key) and **re-resolves live** on reopen. The
one place the resolved fee *is* frozen is an E4 snapshot — which is exactly why the echo landed in E4 and not
here. E5's "live" posture makes the engine's public surface *more* than sufficient, not less.

**If a change had been needed** it would have been a **MINOR** additive bump (ADR-0008 policy) — but none is:
every value E5 persists, re-resolves or recomputes is already on the public surface of 3.1.0.

### Alternatives considered

| Option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — No `pricing-core` change; stays 3.1.0** (CHOSEN) | everything E5 needs is already exported; zero risk to the shipped E1/E2/E3/E4 byte-identity guarantees; smallest diff; the recompute reuses `computeCalculator`/`computeBom` + the 005 fee resolver + the E3 reference resolver verbatim | the "store intent / re-resolve live" orchestration must be held by **feature-layer** discipline (as 005 already does), not by the engine | **92%** |
| B — Add a `scenarioIntent`/`hydrate` helper to `pricing-core` | one canonical (de)serialiser for a saved config | `pricing-core` would gain knowledge of a persistence concern it has no business knowing (the same trap ADR-0008/E4-R4 rejected); the intent shape is a **feature/wire** concern, not a formula concern | 20% |
| C — Bump to expose the deferred resolved-fee echo now | would let a scenario freeze resolved fees | contradicts Q3 (E5 stores *intent*, resolves *values* live — a frozen resolved fee is the E4 snapshot's job, not a live scenario's); gold-plating a field E5 must not use | 12% |

### Risks this pins

- **A silent version-label drift** ("3.0.0" in the spec/plan vs `3.1.0` in code) misleading a future reader into
  a needless bump. Pinned by the existing `PRICING_MODEL_VERSION` ↔ package-major gate test and flagged here.
- **A creeping temptation to freeze resolved fees on the scenario** (which would quietly turn a live scenario
  into a snapshot). Pinned by Q3 + the recompute tests below.

### Tests that must exist

- **vitest (web)**: reopen a saved scenario ⇒ a **blank** (non-overridden) fee slot re-resolves to **today's**
  catalog fee; an **overridden** slot keeps the seller's number with the *"ajustado por você"* seal (FR-607) —
  asserted by mutating the injected fee catalog between save and reopen.
- **vitest (web)**: the reopen recompute calls `computeCalculator`/`computeBom` with **re-resolved** inputs; a
  spy asserts the engine is fed live fees, and `PRICING_MODEL_VERSION` is unchanged (no bump).
- **vitest (pricing-core)**: unchanged — the existing version↔package gate test stays green (any future bump is
  caught elsewhere).

---

## N1 — The `scenarios` config payload shape · **CHOSEN: hybrid — typed metadata columns + ONE JSONB `config` document** · **80%**

**The decision, honestly weighed against E5's defining difference from E4: a scenario is MUTABLE.** E4 chose
JSONB partly because the row is *immutable* ("no `ALTER` per formula change on rows that must never be touched").
That specific argument is **weaker** here. So this decision re-derives the choice from E5's own forces, not by
copying E4.

**What the DB actually queries, orders, filters or constrains for a scenario:** the owner, the **name** (search,
FR-611), the timestamps (list ordering), the soft-delete flag. **Nothing else.** The strategy config — channel
set + determinants + overrides + framing + Outros custos + cost basis — is **read whole and rewritten whole** on
every edit (E5's edit model is a full-config replace, exactly like `PUT /boms/{id}`; see the contract). No
requirement queries *inside* the config, aggregates over it, or partially updates it.

**The cost basis is polymorphic** (ad-hoc single piece · a Product reference + captured snapshot · a Kit
reference + N captured line snapshots — see N2). A relational model would have to reproduce the entire
`bom_lines` link-or-snapshot machinery (17 nullable snapshot columns × possibly-many lines) inside a scenario
sub-table — heavy, and duplicative of E3. A JSONB document absorbs the polymorphism with a discriminated shape.

### Options considered

| Option | Pros | Cons | Scalability | Conf. |
|---|---|---|---|---|
| **A — Hybrid: typed columns (id, owner_uid, name, note, timestamps, deleted_at) + ONE `config JSONB NOT NULL`** (CHOSEN) | the query surface (name/owner/timestamps/soft-delete) is fully typed + indexable; the strategy + the **polymorphic basis** live in one document that edits as a whole (matches the full-replace edit model); reuses the shipped `products.channels`/`bom_lines.channels`/`snapshots.payload` money-as-decimal-string invariant; a future determinant/channel-field addition needs **no `ALTER`** (intent is re-fed to today's engine) | the DB cannot `CHECK` money inside the document (mitigated: app-layer recursive validator + the decimal-string invariant, E4's rule); the config is opaque to SQL (acceptable — nothing queries inside it) | high — one table, one document; a future "query inside" need is a signal to project one field into a new typed column (additive), never to mutate documents | **80%** |
| B — Fully relational: `scenarios` + `scenario_channels` + `scenario_other_costs` (+ a `scenario_basis_lines` for a kit basis) | DB CHECKs on every money leaf; SQL-queryable | 3–4 tables + the `bom_lines` snapshot machinery **re-implemented** for the basis; every future channel/determinant field is an `ALTER` on a mutable table; **nothing needs the queryability** — it is habit, not a requirement (the E4 D1 lesson, inverted only where it truly applies) | medium — more joins per read/write; the edit is a multi-table replace | 40% |
| C — Typed columns + JSONB **only** for the channel list (mirror `products.channels` exactly) | closest to the `products` idiom; channels get the proven JSONB treatment | the **basis is polymorphic** (ad-hoc / Product+snapshot / Kit+N-snapshots) — as typed columns that is a pile of nullable columns + a discriminator + the kit-multi-line problem it cannot express at all; so (c) collapses back toward (a) for the basis and toward (b) for otherCosts | medium | 45% |

### Decision

**Option A (hybrid).** Typed columns for exactly what the DB queries/orders/constrains (owner, name, note,
timestamps, soft-delete) + **one `config JSONB NOT NULL`** holding `{ channelSet, feeOverrides, framingIncluded,
otherCosts, costBasis }`. The **money/rate/quantity/percent leaves inside `config` are decimal STRINGS**
(`"12.50"`), never JSON numbers — the shipped house invariant (`products.channels`, `snapshots.payload`); a
recursive write-time validator rejects a float leaf. This is a **conscious, recorded deviation** from the
"mutable entity ⇒ relational" idiom (`products`/`boms`), justified by: the config is edited as a whole (not
partially queried), the basis is polymorphic, and the intent is version-independent (re-fed to today's engine).
The concrete columns-vs-document split, the CHECKs and the size cap are the **data-model agent's** to finalize;
this document fixes the *shape rationale*, not the DDL.

### Risks this pins

- **A float sneaking into `config`** (silent precision loss at the `json.loads`/`JSON.parse` boundary). Pinned by
  the recursive decimal-string validator + a stored-document round-trip re-scan (the E4 VR-502 rule).
- **A future "query inside the config" reflex** that would start mutating documents. Pinned by the rule:
  project into a new typed column (additive migration), never query the JSONB.

### Tests that must exist

- **pytest**: a `config` containing a JSON **float** leaf ⇒ **422**; after a save→read round-trip, no leaf
  decodes as `float` (re-scan). Name search (`ILIKE`) returns the right scenarios; the list orders correctly.
- **vitest (web)**: save→reopen restores the **full** config byte-for-byte (channels, determinants, overrides,
  framing, Outros custos, basis) — SC-601.

---

## N2 — Cost-basis reference model + the D3/D6 seam (the mechanism) · **CHOSEN: soft reference (no FK) + captured last-known snapshot + read-time server-side resolve/degrade** · **82%**

Q2 resolved: a scenario's cost basis is **both** an ad-hoc piece-input set **or** a Product/Kit reference; a
reference **live-reflects** (D3) and **degrades to last-known** (D6). This is not a new mechanism — it is the E3
kit-line seam (ADR-0017 §6), one shelf over, applied to a **single** basis reference instead of N lines, with the
E4 **no-FK provenance** posture (ADR-0019 §5) chosen for a specific, verified reason.

### The mechanism (how D3 and D6 actually work)

**At save (every scenario write re-captures — the `_snapshot_line` discipline, verified in `boms.py`):**
- Ad-hoc basis ⇒ store the piece-input set in `config.costBasis` (`kind: "ADHOC"`), no reference.
- Product/Kit reference ⇒ store `config.costBasis = { kind: "PRODUCT" | "KIT", refId, refName, snapshot }`:
  the **reference id** (for D3), the **captured name** (displays forever, never *"removido"*), and a **captured
  last-known snapshot** re-resolved from the live reference at this save (the fully-resolved `PriceInput` for a
  Product, or the resolved `BomLineInput[]` for a Kit). The re-capture on every save is what makes D6 **lossless**
  without delete-time capture — verbatim ADR-0017 §6.

**At reopen (`GET /scenarios/{id}` resolves server-side, the single live-vs-degraded decision):**
- The server resolves the reference **owner-scoped AND `deleted_at IS NULL`** — reusing E3's `_resolve_views`
  (Product basis) / the `boms.py` `_rendered` path (Kit basis). If it **resolves** ⇒ return the **live** values
  (**D3 live-reflect**: a product/kit edited since save is reflected on this reopen) + `degraded: false`. If it
  is **absent** (soft-deleted or cross-tenant) ⇒ return the **captured snapshot** + `degraded: true` + the
  captured name (**D6 last-known**: editable, priceable-as-loaded, re-saveable, never blank, never *"removido"*).
- The client then recomputes **live** (`computeCalculator`/`computeBom`) with the resolved-or-degraded basis +
  the scenario's channel intent (non-overridden fees re-resolved from today's catalog, overrides kept). **The
  degradation DECISION is authoritative (server), the recompute is client-side (FR-619, ADR-0015).**

**Offline reopen** reads the **cached** last `GET` response (which already carries the last-resolved basis) from
the uid-keyed read cache; the recompute uses the cached catalog/fee reference and shows the 005 staleness seal if
stale (FR-608). This is the E2/E3 offline-read behavior, unchanged.

### Why NO foreign key (the non-obvious part, and it differs from E3's kept-but-unused FK)

E3 keeps a `bom_lines.product_id` FK (`ON DELETE SET NULL`) as *defense for a hard purge only*. E5 should carry
**no FK** on the basis reference, for two independent reasons:

1. **The basis is polymorphic** — a single reference can be a **Product OR a Kit**. One column cannot FK to two
   tables; two nullable FKs (`basis_product_id` + `basis_bom_id`) double the surface for zero benefit, since
   resolution is read-time by id anyway.
2. **`ON DELETE SET NULL` writes to the row** — but the basis lives *inside the JSONB `config`*, which an FK
   cannot target, and the reference resolution is **read-time** regardless (products/boms are **soft**-deleted,
   so `SET NULL` never even fires — the exact ADR-0017 §6 finding). A captured `{kind, refId, refName}` in the
   document, resolved at read time, is the E4 ADR-0019 §5 provenance posture — correct here, and simpler.

D3 live-reflect does **not** need an FK: it works by re-querying the reference (owner + live) at read time. The FK
would only buy referential integrity on a hard purge, which E5 (like E3/E4) does not rely on.

### Options considered

| Option | Pros | Cons | Scalability | Conf. |
|---|---|---|---|---|
| **A — Soft reference (no FK) in `config` + captured last-known snapshot + read-time server-side resolve/degrade** (CHOSEN) | reuses the shipped E3 `_resolve_views` (owner+live) degradation seam **verbatim** (ADR-0017 §6); handles the **Product-OR-Kit polymorphism** with one discriminated shape; the captured snapshot makes D6 lossless (SC-603) and doubles as the offline-read basis; no FK ⇒ no `SET NULL`-writes-a-row problem, no undeletable-catalog, no cascade-deletes-your-scenario | the stored `refId` may point at a soft-deleted row (harmless, read-filtered — the documented E3 trade-off); the snapshot lags a live edit between saves (harmless — it is only the D6 fallback) | high — the same seam already serves E2 products + E3 kits; a scenario is one reference, lighter than a kit's N lines | **82%** |
| B — Nullable FK `basis_product_id` / `basis_bom_id` with `ON DELETE SET NULL` | referential integrity on hard purge; the "house FK" reflex | **two** FKs for the polymorphism; `SET NULL` **never fires** (soft-delete) so it is dead machinery (the verified E3 §6 finding); it writes to the row (can't reach into JSONB anyway); couples `products`/`boms` deletes to `scenarios` | medium | 30% |
| C — Freeze the basis inputs at save + re-resolve fees only (basis frozen, fees live) | simplest recompute (basis never moves) | **directly contradicts FR-607a** (D3 live-reflect is REQUIRED for a referenced basis) — it turns the basis into a snapshot, discarding the "live mirror" that defines a scenario; would need an owner amendment to Q2 | low | 12% |

### Decision

**Option A.** The cost basis is stored **inside `config.costBasis`** as a discriminated shape
(`ADHOC` | `PRODUCT` + snapshot | `KIT` + line snapshots), carrying the **reference id + captured name +
captured last-known snapshot**, with **no foreign key**. D3/D6 are resolved **server-side at read time** by
reusing the E3 `_resolve_views` owner+live seam (the single live-vs-degraded decision), and the snapshot is
**re-captured on every scenario save** (lossless D6, the `_snapshot_line` discipline). The client recomputes live
with the resolved-or-degraded basis. This reuses ADR-0017 §6 + ADR-0019 §5 — it invents nothing.

### An open mechanism seam routed to the owner (NOT inferred, per Principle VIII)

**How does a scenario's single channel set + Outros custos + framing compose with a KIT basis?** For a
**single-piece** basis (ad-hoc or Product) the mechanism is clean and total: the scenario's channelSet +
overrides + framing + Outros custos thread onto **one** `PriceInput.channels` → `computeCalculator`. But a **kit**
(E3) already carries **per-line** channels + per-line Outros custos and produces a **per-marketplace rollup**
(`computeBom`) — and a scenario holds **one** channel set, not per-line sets. The composition rule
("apply the scenario's channelSet uniformly to every kit line, then `computeBom` → rollup" vs "use the kit's own
per-line channels and let the scenario override only fees" vs "kit basis is single-piece-total only") is
**under-specified by the spec** and is a genuine product/mechanism decision. **Either way `pricing-core` does not
change** (both `computeCalculator` and `computeBom` exist and take resolved channels) — the rule lives in the
feature layer. **Recommendation (70%): apply the scenario's channelSet uniformly to every kit line, then
`computeBom` → per-marketplace rollup** (the least-surprising "same strategy across the whole kit"); the
scenario's Outros custos attaches to the kit as a whole is the sub-question the owner should confirm. Worth one
owner sentence at the plan gate — it decides how the recompute assembles a kit basis.

### Risks this pins

- **A scenario breaking or blanking on a deleted reference** (the #1 live-reference failure). Killed by the
  captured snapshot + read-time degrade: 0 scenarios blank (SC-603).
- **A "removido" lie or a broken "abrir origem"** when the reference is gone. Killed by the captured name +
  read-time affordance resolution (offered only if the id resolves owned+live) — the E3/E4 posture.
- **A catalog delete reaching into a scenario** — impossible with no FK.

### Tests that must exist

- **pytest**: edit a referenced product's filament cost → reopen the scenario ⇒ the basis reflects the new cost
  (D3, SC-603). Soft-delete the product → reopen ⇒ `degraded: true`, the captured name is returned, the values
  are the last-known snapshot, the scenario is priceable + re-saveable (D6). Another account's referenced id is
  never an existence oracle.
- **pytest**: hard-delete/absent reference under concurrency ⇒ the read serves the snapshot, never a 500, never a
  dead row as live (the `_resolve_views` owner+live filter).
- **vitest (web)**: a reopened scenario recomputes with the resolved (or degraded) basis + re-resolved fees; the
  degraded caption is the honest E2/E3 wording, never *"removido"*.

---

## N3 — New ADR or ride existing? · **CHOSEN: a new, LIGHT ADR-0021** · **75%**

### Decision

**Draft ADR-0021** (`docs/adr/0021-scenario-persistence-live-reference-model.md`, Status: **Proposed**),
extending **ADR-0013** (persistence) and **ADR-0017** (reference degradation) and relating **ADR-0011** (result
contract) + **ADR-0015** (client-guard-over-server-gated-data). It records **one** coherent decision: the
**scenario persistence model + the store-intent / resolve-live recompute seam + the Product-OR-Kit reference
model**. It stays deliberately light (E5 is lighter than E4 — no immutability trigger, no outbox).

### Why an ADR and not just `data-model.md`

- **N1 is a recorded *deviation*.** Choosing JSONB for a **mutable** entity runs against the house "mutable ⇒
  relational" idiom (`products`/`boms`). Constitution V ("deviate only with recorded justification") wants this
  written down, with the honest counter-argument (the E4 immutability rationale does **not** transfer) on the
  record — a `data-model.md` cell is too thin a home for a cross-cutting idiom break.
- **N2 spans layers.** The store-intent / resolve-live seam touches the fee resolver (feature) + the reference
  resolver (server) + `pricing-core` (unchanged) — it is an *architecture* decision, not a schema detail. The
  Product-OR-Kit polymorphic reference is genuinely new (E3 references only products).
- **One stable anchor for the data-model agent + `/speckit-tasks`** to bind to, instead of three ADRs threaded
  by implication.

### Alternatives considered

| Option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — One light ADR-0021 (persistence + live-reference model)** (CHOSEN) | records the idiom break (N1) + the polymorphic reference (N2) with justification; single anchor; extends the right ADRs | one more doc to keep coherent (mitigated: it is short and mostly reuse) | **75%** |
| B — No ADR; record N1/N2 in `data-model.md` under ADR-0013/0017 (the E4-D1 precedent for the payload shape) | leanest; the payload shape *was* a data-model.md call in E4 | E4's payload shape rode on the immutability ADRs (0019); E5 has no such carrier, and N1 is a *deviation* the Constitution wants recorded above a schema cell | 45% |
| C — Two ADRs (persistence shape · reference model) | maximal separation | over-ceremony for a "lighter than E4" epic; the two decisions are one story (store intent, resolve live) | 25% |

### What ADR-0021 must NOT do

It must not re-decide entitlement (ADR-0012 reused verbatim), persistence stack (ADR-0013), the degradation
semantics (ADR-0017 §6, reused), or the client-guard model (ADR-0015). It records only what is E5-new:
the hybrid JSONB-config-for-a-mutable-entity choice, the store-intent/resolve-live seam, and the no-FK
Product-OR-Kit reference.

---

## What the data model must provide (requirements to `dev-estrutura-de-dados` — not a design)

1. **One new table `scenarios`**, migration `0004` (`down_revision = "0003"`; additive only — nothing in the
   shipped tables is touched, FR-620). Per-account, **mutable**, soft-delete (`deleted_at`, voluntary only — a
   lapse never deletes, FR-612).
2. **Typed metadata columns** for the query surface: `id` (uuid7 PK), `owner_uid` (FK → `accounts`, the ONLY FK
   on the table — no FK to `products`/`boms`, N2), `name` (NOT NULL, not-blank CHECK, FR-611 search),
   `note` (nullable, Q6), `created_at`/`updated_at` (server defaults), `deleted_at` (nullable).
3. **`config JSONB NOT NULL`** holding `{ channelSet, feeOverrides, framingIncluded, otherCosts, costBasis }`
   (N1). **Every money/rate/quantity/percent leaf is a decimal STRING** (the `products.channels`/`snapshots.payload`
   invariant); the only JSON numbers are true integer counts. A recursive write-time validator rejects float
   leaves; a stored-document round-trip re-scans (E4 VR-502).
4. **The cost basis lives inside `config.costBasis`** as a discriminated shape (`ADHOC` | `PRODUCT` + snapshot |
   `KIT` + line snapshots), carrying `{ kind, refId, refName, snapshot }` — **no foreign key** (N2). The snapshot
   is re-captured on every scenario save (lossless D6).
5. **Query shapes to index for**: `WHERE owner_uid = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id DESC`
   (keyset/cursor list — most-recently-edited first; the list is **unbounded** per account, no cap that would be
   a silent business-rules change) + an owner-scoped name `ILIKE '%term%'` filter (FR-611). A partial composite
   index `(owner_uid, updated_at, id) WHERE deleted_at IS NULL` serves it (backward scan) — the E4 §D4 idiom, with
   `updated_at` as the sort key instead of a device date (a scenario carries **no date**, FR — the four-object map).
6. **No GIN index on `config`** — the document is never queried (state it so the next reader does not "help").
7. **A payload size cap on `config`** (abuse/DoS), rejected with an **honest, visible 422**, never a silent
   truncation — the number owner-visible (the E4 §7.6 posture). Confirm the number with the owner.
8. **No new `ErrorCode`**: `ENTITLEMENT_REQUIRED` / `VALIDATION_ERROR` / `NOT_FOUND` already exist.
9. **`created_at` is ordinary row metadata** — a scenario carries no user-facing date (unlike an E4 snapshot);
   `updated_at` is the list sort key and reflects the last edit.

## Cross-agent contract — what the arquiteto and the data-model agent MUST agree on

1. **The `scenarios` table has exactly ONE foreign key — `owner_uid → accounts`.** No FK to `products` or
   `boms`; the basis reference is a captured `{kind, refId, refName, snapshot}` inside `config`, resolved at read
   time (N2). *(If the data-model agent proposes a nullable basis FK, this document dissents — surface it to the
   owner; do not merge silently.)*
2. **The basis snapshot is re-captured on every scenario save** (the `_snapshot_line` discipline). The read path
   decides live-vs-degraded via the owner + `deleted_at IS NULL` filter (`_resolve_views` reused), not via an FK.
3. **Money inside `config` is decimal strings**; the DB `numeric` is not the loss point — the serializer boundary
   is. Export/read emits the stored string.
4. **The list is keyset-paginated and unbounded**; ordering is `updated_at DESC, id DESC` (a scenario has no
   date). Name search is owner-scoped `ILIKE`.
5. **The API contract is the arquiteto's** (`contracts/api-surface.md`); the DDL is the data-model agent's. The
   two meet at: the `config` document shape, the no-FK rule, and the keyset cursor.

## Spec issues flagged for the parent to reconcile (do NOT edited here)

- **Version label drift.** The spec (lines 43, 402, 454) and plan (lines 43-45, 51) repeatedly say `pricing-core`
  **"3.0.0"**; the shipped package is **`3.1.0`** (E3/ADR-0016). Cosmetic but load-bearing for a future reader
  deciding whether a bump is needed — recommend correcting "3.0.0" → "3.1.0" wherever it refers to the current
  package.
- **Imprecise premise.** The plan's "the 005 result already carries `resolvedFee`" (plan line 43, spec
  Out-of-Scope line 402) is not what shipped — the resolved-fee echo on `ChannelResult` was **deferred to E4**
  (ADR-0011 Amendment 2026-07-07); only the reproducibility key (`feeDeterminants` + `feeSource` +
  `catalogVersion`) ships. The R-A **conclusion still holds** (no change), for a stronger reason (E5 stores
  intent and re-resolves live; it never needs a frozen resolved fee). Recommend rewording the premise.
- **Config-edit endpoint gap (Principle VIII surface).** The spec's four-object map (spec line 45) states a
  scenario is *"Editable: yes — name + whole config,"* like E2 products / E3 kits (which have `PUT` full-replace).
  The plan's enumerated route list (plan line 81) and this round's brief list **create · list · get · rename ·
  duplicate · delete** — no full-config-edit route. Resolved in the contract by adding **`PUT /scenarios/{id}`**
  (full-config replace, mirroring `PUT /boms/{id}`), with `rename` as a lightweight `PATCH`. Flagged for owner
  confirmation, not silently defaulted.
- **Kit-basis composition (N2 open seam).** How a scenario's single channel set + Outros custos + framing compose
  with a multi-line kit basis is under-specified — recommendation given (uniform channelSet per line →
  `computeBom`), routed to the owner. No `pricing-core` impact either way.

## Delivery shape (owner-gated PR slices — the E2/E3/E4 cadence, echoing the brief)

- **PR-A — Save + list + teaser**: US1 (save, server-authoritative) + US2 (list + offline read) + US5 (honest
  teaser). Migration `0004`, the `scenarios` table, `POST`/`GET`/`GET{id}`, the entitlement gate, the offline
  read cache + purge-on-signout (reused). ADR-0021 accepted at this gate.
- **PR-B — Live contract + duplicate + manage/lapse**: US3 (the LIVE recompute: D3/D6 reference resolution +
  fee re-resolve vs override stickiness + staleness seal) + US4 (duplicate) + US6 (rename/search/delete +
  lapse read-only). `PUT`/`PATCH`/`POST {id}/duplicate`/`DELETE`.
- **PR-C — the E4 bridge (US7, P3/droppable)**: record a snapshot from a scenario (reuse the E4 US1 record path +
  informational provenance). The natural place to cut if the increment runs long.

## Resolved unknowns

| Unknown (spec/plan) | Resolution |
|---|---|
| `pricing-core` change? (spec ~85% no) | **No change, stays 3.1.0** (R-A, verified against the code) — 92% |
| Config payload shape (N1) | **Hybrid** — typed metadata columns + one JSONB `config` (money = decimal strings) — 80% |
| Cost-basis reference model + D3/D6 (N2) | **Soft ref (no FK) + captured snapshot + read-time server resolve/degrade**, reusing `_resolve_views` (ADR-0017 §6) — 82% |
| New ADR? (N3) | **Yes — light ADR-0021** (persistence + live-reference model), extends ADR-0013/0017 — 75% |
| Offline writes (Q4) | Online-only; **no** ADR-0018 outbox; offline **read** cache reused — settled |
| Kit-basis channel composition | **OPEN — routed to owner** (recommendation: uniform channelSet per kit line → `computeBom`) — 70% |
| Full-config edit route | `PUT /scenarios/{id}` (mirror `PUT /boms/{id}`); rename = `PATCH`; flagged for owner — 80% |
