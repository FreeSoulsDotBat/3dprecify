# Feature Specification: E5 — saved marketplace scenarios (the fourth persistent object)

**Feature Branch**: `feature/010-e5-saved-scenarios`

**Created**: 2026-07-17

**Status**: Planned — product scope owner-approved (`docs/product/e5-scope-brief.md`, 2026-07-17); **Q1 settled**
(saved scenarios only; per-account live fee auth deferred). `/speckit-clarify` (2026-07-17) resolved Q2/Q3/Q4;
`/speckit-plan` + the architecture round passed the Constitution VIII gate (**ADR-0021 Proposed**); tasks generated
and `/speckit-analyze` clean (2026-07-19, 0 critical). Remaining Q5–Q13 + the data-model §7 points carry the
working default → **owner decisions at the PR-A gate (tasks.md T002)**.

**Input**: On top of the shipped E1/005 **live multi-channel calculator** (price the same product across Mercado
Livre / Amazon / Shopee at once, fees pre-filled from the dated catalog — free, offline, signed-out), let a
**premium** seller **save that configuration as a named, reusable *scenario*** — the channel set, the per-channel
fee overrides, the include/exclude framing, the cost basis and the itemized "Outros custos" — that on reopen
**re-computes against today's fees + references + formula** (LIVE), can be **duplicated to tweak-and-compare**,
renamed, searched and deleted, and (optionally) **frozen into an E4 snapshot**. A scenario is the **live mirror of a
frozen E4 snapshot**: the Histórico proves *what you charged* (frozen); a Cenário shows *where it's worth selling*
(live). Everything premium reuses the E2 server-authoritative entitlement **verbatim** (no new gate); the free 005
calculator stays fully free. **Q1 is settled (owner, 2026-07-17): E5 = saved scenarios ONLY** — per-account live
fee auth (Shopee OAuth, AliExpress) is a **deferred future integration increment**, OUT of this spec. Full product
scope, taxonomy and open-question rationale: `docs/product/e5-scope-brief.md`.

> **Truth-over-approval note (Constitution II).** No fee value is fabricated in this spec. The scenario reuses the
> curated, dated 005 fee catalog (ADR-0010) unchanged; every fee seal (`referência do catálogo` / `embutida` /
> `pode estar desatualizada` / `ajustado por você` / `estimativa`) carries into a saved scenario as-is. Confidence
> in the behavioral model: **~85%** (residual is Q2–Q11, routed to `/speckit-clarify`, and the persistence /
> offline-write / degradation-reconciliation mechanics, routed to `arquiteto` at `/speckit-plan`).

---

## The four-object map (why a scenario does not collide with E2/E3/E4)

E5 adds the product's **fourth** persistent object. The risk of the whole increment is letting it collide with the
three that exist. A scenario is **LIVE where an E4 snapshot is FROZEN** — the two are mirror images.

| | **Product (E2)** | **Kit (E3)** | **Snapshot (E4)** | **Scenario (E5)** |
|---|---|---|---|---|
| Answers | "quanto custa este **item** hoje?" | "quanto custa esta **montagem** hoje?" | "quanto eu **cobrei** em 03/07?" | "**onde** e por **quanto** vender — hoje?" |
| Models | the **thing** sold (template) | the multi-piece **thing** | a recorded **event** (frozen) | the **selling strategy** (channels · fees · framing) |
| On reopen | recomputes (live) | recomputes (live) | **never recomputes** | **recomputes (live)** |
| Reference edited | D3 live-reflect | D3 live-reflect | **nothing changes** | **D3 live-reflect** |
| Reference deleted | D6 last-known | D6 last-known | **nothing changes** | **D6 last-known** |
| Carries a date | no | no | **always** (the date is the claim) | **no** — a live view of *today* |
| Editable | yes | yes | **contents never**; label only | **yes** — name + whole config |

A scenario sits a **layer above the catalog**: its cost basis may itself **be** a Product/Kit reference, so a
scenario can never *be* a Product/Kit — they live at different levels. A scenario **materializes nothing** (the
explicit contrast with E3 K3). See `docs/product/e5-scope-brief.md` §2 for the full centerpiece.

---

## User Scenarios & Testing *(mandatory)*

Persona unchanged: a **solo MEI 3D-print seller**, now a **premium** one for everything in this increment. These
stories extend the shipped E1/005 multi-channel calculator (still free/offline/signed-out) with a **saved,
re-runnable scenario** object. Each story is independently valuable and testable.

### User Story 1 — Save a multi-channel what-if as a reusable scenario (Priority: P1) [FOUNDATIONAL]

A premium seller who has configured the multi-channel calculator (channel set + fee overrides + framing + cost
basis + Outros custos) **explicitly saves it as a named scenario**, server-side. The scenario stores the seller's
**intent** (choices + explicit overrides), not resolved values.

**Why this priority**: A scenario has no standalone value without persistence — like E4's PR-A, the first slice
**is** the server slice. Saving the comparison is the whole promise of the increment.

**Independent Test**: As a premium user, configure a two-channel calculation, save it with a name; on a fresh
session/device confirm it appears in the scenarios list and reopens with its full configuration restored and prices
recomputed live. As a free/signed-out user, confirm the save is denied server-side and nothing persists.

**Acceptance Scenarios**:
1. **Given** a premium user with a configured multi-channel calculation, **When** they save it with a name, **Then**
   the scenario persists and appears in the scenarios list on a fresh session/device.
2. **Given** a saved scenario, **When** it is reopened, **Then** its configuration (channels, determinants,
   overrides, framing, cost basis, Outros custos) is **restored exactly** and prices are **recomputed live** against
   today's catalog + fee catalog + formula (US3 defines the live contract).
3. **Given** a free or signed-out caller, **When** any save/list/read scenario operation is called, **Then** the
   server denies with `ENTITLEMENT_REQUIRED`, nothing is written or read, and the client's local state is never
   trusted.
4. **Given** a saved scenario, **When** the account's catalog is inspected, **Then** **nothing was materialized** —
   no product, no kit, no filament, no printer was created.

### User Story 2 — Consult the scenarios (list, open, offline read) (Priority: P1)

The scenarios surface lists saved scenarios (name + optional note), each opening into the live multi-channel view.
Reading works offline after one online load; sign-out purges the local cache.

**Why this priority**: Saving is worthless if the seller cannot get back to it; offline read mirrors the E2/E3/E4
guarantee sellers already rely on.

**Independent Test**: With several saved scenarios, open the list and one entry (config restored, recomputed live);
go offline and confirm scenarios stay readable/re-openable from cache with the honest staleness seal; sign out and
confirm the local cache is purged.

**Acceptance Scenarios**:
1. **Given** several saved scenarios, **When** the list is opened, **Then** they list (name + optional note /
   last-updated); opening one restores its config and recomputes live.
2. **Given** a premium account that loaded the list online once, **When** the device goes offline, **Then**
   scenarios remain **readable and re-openable** from local cache; the live recompute uses the **cached** catalog +
   fee reference and shows the honest staleness seal; a **save** attempted offline behaves per FR-613 (Q4).
3. **Given** account A's scenario, **When** account B is signed in, **Then** B can neither read nor modify it, and it
   is indistinguishable from non-existent (no existence oracle).
4. **Given** a sign-out, **When** it completes, **Then** the local scenarios cache is purged (uid-keyed
   purge-on-signout pattern).

### User Story 3 — A scenario always shows today; the LIVE contract made visible (Priority: P1)

The mirror of E4 US3. Where a snapshot is **inert** to catalog churn, a scenario **reflects** it — that is the
feature. Fee-catalog refreshes and catalog edits flow through on reopen; explicit overrides stick.

**Why this priority**: The live-vs-frozen boundary is the crux of the four-object taxonomy; getting it wrong turns a
scenario into a snapshot (freeze everything) or discards the seller's strategy (drop overrides).

**Independent Test**: Save a scenario referencing a product; edit the product's filament cost → reopen and confirm
the scenario reflects the new cost; delete the product → reopen and confirm the scenario degrades to last-known with
the honest caption (never blank, never "removido"); refresh the fee catalog → confirm a non-overridden slot
re-resolves while an overridden slot keeps its value with the "ajustado por você" seal.

**Acceptance Scenarios**:
1. **Given** a scenario whose cost basis references product P, **When** P's filament cost is edited, **Then** on
   reopen the scenario's cost basis and prices **reflect the new cost** (D3 live-reflect — the opposite of a
   snapshot).
2. **Given** a scenario referencing product P, **When** P is deleted, **Then** on reopen the scenario **degrades to
   last-known editable values** with the E2/E3 honest caption — never a broken/blank scenario, never a "removido"
   claim (D6 last-known).
3. **Given** a saved scenario with a non-overridden fee slot, **When** the fee catalog is refreshed to a new
   commission/fee, **Then** on reopen that slot **re-resolves to the new fee** (live); an **overridden** slot keeps
   the seller's number with the "ajustado por você" seal.
4. **Given** a reopened scenario, **When** its numbers render, **Then** they are presented as **today's** result with
   no frozen date; if computed offline from a stale cache, the 005 staleness seal is shown (never stale-as-live).

### User Story 4 — Duplicate-to-tweak (the comparison feature) (Priority: P1)

The scenario tool's headline move: **clone a scenario, change one thing, compare.** A duplicate is an independent new
object; the original is untouched — the mirror of E4's "recalcular hoje is a new event, never a mutation".

**Why this priority**: Comparing strategy variants ("ML Clássico vs Premium", "with vs without the ML free-shipping
subsidy") is what a saved-scenario tool is *for*; without duplicate, it is just a bookmarked calculation.

**Independent Test**: Duplicate a saved scenario, change one channel/fee-override/the framing on the copy; confirm it
recomputes independently and the original is byte-for-byte unchanged (and vice versa).

**Acceptance Scenarios**:
1. **Given** a saved scenario, **When** the seller duplicates it, **Then** a new independent scenario is created
   (own name), and editing the copy changes **0%** of the original — and vice versa.
2. **Given** a duplicated scenario, **When** the seller changes one channel / one fee override / the framing,
   **Then** it recomputes independently so the two variants can be compared.
3. **Given** a free or signed-out user, **When** they meet the "duplicar" affordance, **Then** they get the honest
   teaser (US5) — nothing persists, no fake success.

### User Story 5 — Honest teaser for save-scenario (free / signed-out) (Priority: P2)

Every free-facing affordance ("Salvar cenário", the scenarios surface, "Duplicar") is **visible** and opens an
honest Premium notice: no price, no date, no fake "salvo!", no pre-E6 purchase CTA. The free 005 multi-channel
calculator remains fully free, offline and untouched.

**Why this priority**: The freemium boundary must extend honestly over the new save surface (Constitution II /
`ux-decisions.md` lineage: E2 US7 / E3 US5 / E4 US5); a free user must never be shown a fabricated saved scenario or
a fake success.

**Independent Test**: Signed out and free, tap every save/duplicate/scenarios affordance; confirm an honest teaser
appears, nothing persists, nothing is generated, no success is faked, and the copy promises no price and no date.

**Acceptance Scenarios**:
1. **Given** free/signed-out, **When** the scenarios surface is opened, **Then** it explains the premium value
   honestly (never a broken list, never a fabricated sample scenario).
2. **Given** free/signed-out, **When** any "salvar cenário" / "duplicar" affordance is tapped, **Then** the honest
   teaser appears, nothing persists, nothing is generated, no success is faked.
3. **Given** the teaser copy, **When** reviewed, **Then** it promises no price and no availability date.

### User Story 6 — Manage the scenarios + lapse policy (Priority: P2)

Rename, search/filter (by name), delete — per-account, isolated. On premium lapse: **read-only freeze**, exactly
like E2/E3/E4 — scenarios stay readable **and re-openable/recomputable** (recompute is a read), nothing is
auto-deleted, all writes are denied; re-grant restores writes with data intact.

**Why this priority**: A ledger of saved strategies needs light management; the lapse rule must match the standing
"lapsou ⇒ read-only, nothing deleted" posture so it is honest and simple to explain.

**Independent Test**: Rename and delete scenarios (changes persist per-account); revoke premium and confirm
scenarios stay readable + re-openable/recomputable while every write is denied and none is deleted; re-grant and
confirm writes work with data intact; search by name over many scenarios.

**Acceptance Scenarios**:
1. **Given** saved scenarios, **When** the owner renames or deletes one, **Then** the change persists per-account.
2. **Given** a lapsed account, **When** it opens the scenarios surface, **Then** scenarios are readable and can be
   opened + recomputed (read), **zero** writes succeed, and none is deleted by the lapse; re-grant restores writes
   with data intact.
3. **Given** many scenarios, **When** the seller searches by name, **Then** the matching scenarios are found without
   the list becoming unusable.

### User Story 7 — Record a snapshot from a scenario (the E4 bridge) (Priority: P3 — droppable)

A scenario is live; the seller can **freeze its current computation into the Histórico** (E4), turning a live
strategy into a proof of what was quoted. Reuses the E4 US1 record path with the scenario added as a **provenance**
source.

**Why this priority**: A useful, coherent bridge between the live shelf and the frozen shelf — but the increment is
already shippable value without it (save + reopen-live + duplicate). Explicitly **droppable** if the increment runs
long; cut US7 before cutting US4.

**Independent Test**: As a premium seller on a scenario's live result, record it; confirm an immutable E4 snapshot is
created byte-identical to the displayed computation, carrying informational provenance ("originou-se do cenário X"),
that a later catalog/fee change cannot alter it (E4 immutability holds), and that the scenario itself is unchanged.

**Acceptance Scenario**:
1. **Given** a premium seller viewing a scenario's live result, **When** they record it, **Then** an immutable E4
   snapshot is created **byte-identical** to the scenario's current computation, carrying informational provenance
   only; the snapshot never recomputes and a later catalog/fee change alters 0% of it; the scenario is unchanged.

### Edge Cases

- **Scenario references a catalog entity that was edited** → live-reflects on reopen (D3); the seller sees today's
  numbers, not the numbers at save time.
- **Scenario references a catalog entity that was deleted** → degrades to last-known editable values with the honest
  E2/E3 caption; never blank, never "removido", still priceable-as-loaded and re-saveable.
- **Reopen while offline** → recomputes from the cached catalog + cached fee reference; shows the 005 staleness seal
  if the cached reference is past the freshness window; never presents a stale fee as fresh.
- **Save attempted offline** → honest online-only failure per FR-613 (no silent drop, no fake success); offline
  read/reopen still works.
- **Duplicate of a scenario** → an independent object; edits do not cross between original and copy.
- **A fee slot the catalog cannot resolve** (uncovered combination) → the same 005 "sem referência" / manual-entry
  behavior applies inside a saved scenario; no fabricated pre-fill.
- **Commission ≥ 100% on a saved slot** → the same 005 inline per-slot error on reopen; other slots keep computing;
  no NaN/Infinity.
- **Sign-out with the scenarios cache populated** → the uid-keyed cache is purged; another account signing in sees
  none of the previous account's scenarios.
- **Many scenarios / many channels / many sub-costs** → list stays usable (searchable by name); recompute never
  overflows and never horizontally scrolls at 390px (inherits 003/004/005 edge cases).

---

## Requirements *(mandatory)*

E1/004/005 (multi-channel compute + fee catalog), E2/007 (entitlement + offline cache), E3/008 (D3/D6 degradation),
and E4/009 (snapshot immutability) requirements remain in force and are **reused**, not altered. New requirements:

### 2.1 Scenario persistence & isolation

- **FR-601**: A premium seller MUST be able to **explicitly save** a configured multi-channel calculation as a
  **named scenario**, persisted **server-authoritatively** and available on a fresh session/device.
- **FR-602**: A scenario MUST store the seller's **intent** — the **channel set** (marketplaces + their
  determinants), the **explicit per-channel fee overrides**, the **include/exclude framing** toggle
  ("Incluir marketplaces no preço", 005 FR-113), the **cost basis** (per FR-606a — ad-hoc **or** a Product/Kit
  reference), the **"Outros custos"** list, a **required name** and an **optional note** (Q6) — and MUST NOT store
  resolved fee values as authoritative
  (values are re-resolved live per §2.2).
- **FR-603**: All scenario operations — **save · list · read/open · duplicate · rename · delete** — MUST be gated by
  the **E2 server-authoritative entitlement** (ADR-0012, Constitution IV). A free, signed-out, or
  locally-faked-premium caller MUST be denied `ENTITLEMENT_REQUIRED` and MUST persist/read nothing. **E5 introduces
  no new gate.**
- **FR-604**: Saving (or duplicating) a scenario MUST **materialize nothing** in the catalog — it MUST create no
  product, no kit, no filament, no printer. A scenario references the catalog; it never mutates it.
- **FR-605**: Scenarios MUST be **per-account isolated**: no cross-account read or write under any manipulation;
  another account's scenario MUST be indistinguishable from non-existent (no existence oracle).

### 2.2 The LIVE recompute contract

- **FR-606**: On reopen, a scenario MUST **re-compute** its prices against the **current** pricing formula + the
  **current** fee catalog + the **current** catalog references (LIVE). It MUST NOT render a frozen/stored price
  value, and MUST present its numbers as **today's** result **without** a frozen date.
- **FR-606a**: A scenario's **cost basis** MUST support **both** an **ad-hoc set of piece inputs** and a
  **Product/Kit reference** (resolved 2026-07-17). A reference MUST behave as a live link (FR-607a/FR-607b).
- **FR-607**: On reopen, a **non-overridden** fee field MUST **re-resolve** from today's fee catalog; an
  **overridden** fee field MUST retain the seller's value and display the 005 "ajustado por você" seal. **The
  scenario freezes the seller's *intent*** (channel set + determinant choices + explicit overrides) **and resolves
  *values* live** (resolved 2026-07-17).
- **FR-607a**: When a scenario's cost basis references a catalog Product/Kit and that reference is **edited**, the
  scenario MUST **live-reflect** the change on reopen (D3, reusing E2/E3 semantics).
- **FR-607b**: When a referenced Product/Kit is **deleted**, the scenario MUST **degrade to last-known editable
  values** with the honest E2/E3 caption (D6) — never break, never blank, never claim removal — and MUST remain
  priceable-as-loaded and re-saveable.
- **FR-608**: When a scenario is recomputed **offline** from a cached catalog/fee reference, it MUST show the 005
  staleness seal if the cached reference is past the freshness window, and MUST NOT present a stale fee as fresh.
- **FR-609**: A scenario's recompute MUST reuse the existing 005 per-channel gross-up and honesty behavior verbatim
  (commission-floor, price bands, ML subsidy estimate seal, "sem referência" fallback, ≥100% commission per-slot
  error) — E5 changes **which inputs are persisted**, never the pricing math.

### 2.3 Duplicate, manage & lapse

- **FR-610**: A seller MUST be able to **duplicate** a scenario into an **independent** new object; editing the copy
  MUST change **0%** of the original, and vice versa (a clone is a new object, never a mutation).
- **FR-611**: A seller MUST be able to **rename**, **edit the whole configuration of** (full-replace), **search by
  name**, and **delete** scenarios, per-account, without the list becoming unusable at volume. *(The full-config
  edit realizes the four-object map's "editable: name + whole config"; it is a `PUT`-style full-replace — ADR-0021
  §5, surfaced for owner confirmation at PR-A.)*
- **FR-612**: On **premium lapse**, scenarios MUST stay **readable AND re-openable/recomputable** (recompute is a
  read); **all writes** (save/rename/duplicate/delete) MUST be denied; **nothing** MUST be auto-deleted; **re-grant**
  MUST restore writes with data intact.

### 2.4 Offline & the scenarios surface

- **FR-613**: **Offline scenario writes** — scenario writes MUST be **online-only, with an honest offline failure**
  (mirrors E2/E3; no silent drop, no fake success). The E4 offline outbox (ADR-0018) is deliberately **not** reused —
  a scenario is a desk analysis, not fair-booth quoting (resolved 2026-07-17). The offline **read** cache is reused
  regardless (FR-614).
- **FR-614**: After **one** online load, 100% of the account's scenarios MUST remain **readable and re-openable
  offline** from local cache; **sign-out** MUST **purge** the uid-keyed scenarios cache.
- **FR-615**: The behavioral requirement is that **save / load / list a scenario is reachable from the multi-channel
  calculator**; the surface's exact **IA placement** was Q11 — **DECIDED 2026-07-19: inside Calcular** (see
  §Clarifications; designed in `ux-scenarios.md`).

### 2.5 Teaser, the E4 bridge, and boundaries

- **FR-616**: Every free/signed-out **save-scenario / duplicate / scenarios** affordance MUST be **visible** and open
  an **honest premium teaser** — no price, no date, no fake "salvo!", no pre-E6 purchase CTA. The free 005
  multi-channel calculator MUST remain fully free, offline and **unchanged**. *(Realized per the 2026-07-19
  SC-109 ratification: the free door is the "Meus cenários" surface entry — the free calculator itself gains no
  inline save button, keeping 005's SC-109 and its e2e intact.)*
- **FR-617** *(P3, droppable)*: A premium seller MUST be able to **record an E4 snapshot from a scenario's current
  live computation** — reusing the E4 US1 record path, **byte-identical** to the displayed result, carrying
  **informational provenance** ("originou-se do cenário X") that can never alter or degrade the snapshot; the E4
  immutability contract holds verbatim and the scenario is unchanged. (Q5.)
- **FR-618**: E5 MUST **not** include **per-account live fee auth** (Shopee per-shop OAuth, ML per-seller,
  AliExpress). A scenario MUST use only the curated 005 fee catalog (ADR-0010) — never the seller's own marketplace
  account. *(Q1 settled 2026-07-17; per-account fee auth is a deferred future increment.)*
- **FR-619**: **Enforcement honesty (Principle IV).** Scenario **persistence** MUST be server-authoritative; the
  **live recompute** on reopen runs **client-side** in `pricing-core`. The spec/plan/UI MUST NOT imply the recompute
  itself is server-enforced (the ADR-0015 client-guard-over-server-gated-data precedent). The **backend MUST NOT
  recompute any price.**
- **FR-620**: All existing E1/E2/E3/E4 acceptance guarantees MUST hold **unchanged** — the free calculator, catalog
  live-recompute, kit D3/D6 degradation, snapshot immutability, and the entitlement gate. E5 **adds a fourth
  object; it does not alter the existing three.**

### Key Entities

- **Scenario (server-persisted, per-account)**: `{ name (required), note? (Q6), costBasis, channelSet,
  includeMarketplace, otherCosts, timestamps }` (`includeMarketplace` = the 005 FR-113 framing toggle, named as in
  the `config` envelope — data-model §3), soft-deletable, per-account isolated. `costBasis` = an
  **ad-hoc piece-input set** OR a **Product/Kit reference** (both supported, resolved 2026-07-17). `channelSet` = the 005 channel slots
  (marketplace + determinants); **each slot carries its own `feeOverrides`** = only the seller's **explicit** per-slot adjustments (a blank slot re-resolves live). **Stores intent,
  not resolved values**; **materializes nothing**. (Persistence shape/schema → `arquiteto`.)
- **Multi-channel price result (ephemeral, 005)**: the object a scenario **produces** on reopen — the 005
  `ChannelResult` list + framing flag + `catalogVersion` + `PRICING_MODEL_VERSION`. Not stored on the scenario; it is
  the *output* of the live recompute.
- **Product (E2) / Kit (E3)**: candidate **cost-basis references** (Q2); referenced live (D3/D6), never copied,
  never mutated by a scenario.
- **Snapshot (E4)**: the target of the US7 record-from-scenario bridge (FR-617); the scenario becomes an
  informational **provenance** source on the snapshot.

---

## Success Criteria *(mandatory)*

E1/E2/E3/E4 success criteria remain in force. New criteria (technology-agnostic, measurable):

- **SC-601**: A premium user saves a configured multi-channel scenario and, on a **fresh session/device**, reopens it
  with its **full configuration restored** (channels, determinants, overrides, framing, cost basis, Outros custos).
- **SC-602**: On reopen, a scenario **re-computes** with the current formula + current fee catalog + current catalog
  references (LIVE); it **never** renders a frozen value, and a fee-catalog or reference change since save **is**
  reflected on every non-overridden field.
- **SC-603**: Editing a catalog entity referenced by a scenario's cost basis is **reflected** on reopen (D3), and
  deleting one **degrades to last-known editable values** with the honest E2/E3 caption (D6) — the exact live-object
  behavior, the opposite of an E4 snapshot; **0** scenarios break or blank on a dangling reference.
- **SC-604**: 100% of scenario persistence operations are authorized **server-side**; a free/signed-out or
  locally-faked-premium caller is denied `ENTITLEMENT_REQUIRED` and persists/reads nothing.
- **SC-605**: Duplicating a scenario yields an **independent** copy — editing the copy changes **0%** of the original
  (and vice versa); the original is never mutated by a clone.
- **SC-606**: Saving (or duplicating) a scenario creates **zero** catalog objects (no product, kit, filament,
  printer) — a scenario materializes nothing.
- **SC-607**: Every free/signed-out save-scenario/duplicate affordance is **honest** on the rendered UI (no price, no
  date, no fake success, no pre-E6 CTA); the 005 free multi-channel calculator's guarantees hold unchanged.
- **SC-608**: On lapse, 100% of scenarios stay **readable and re-openable/recomputable** and **0%** writable
  (save/rename/duplicate/delete) or deleted; re-grant restores writes with data intact.
- **SC-609**: **Zero** cross-account reads or writes of scenarios under any manipulation; another account's scenario
  is indistinguishable from non-existent.
- **SC-610**: After **one** online load, 100% of the account's scenarios are readable + re-openable **offline** (from
  the cached catalog/fee reference, with the honest staleness seal); a save attempted offline behaves per FR-613 with
  no silent drop and no fake success.
- **SC-611** *(if US7 ships)*: Recording a snapshot from a scenario produces a **frozen** E4 snapshot **byte-identical**
  to the scenario's current computation, carrying informational provenance only; a later catalog/fee change alters
  **0%** of that snapshot (E4 immutability holds).
- **SC-612**: All E1/E2/E3/E4 acceptance guarantees pass **unchanged** — the free calculator, catalog live-recompute,
  kit D3/D6, snapshot immutability, entitlement gate — E5 adds a fourth object without altering the existing three.

---

## Out of Scope (non-goals — each with its deferral target)

- **Per-account live fee auth** (Shopee per-shop OAuth, ML per-seller, **AliExpress**) → **its own future integration
  increment** (Q1 settled). Per-SELLER OAuth into the seller's own marketplace account is a different mechanism from
  the curated 005 catalog and the house-account ML ingestion; it drags in external-auth + credential/token storage +
  a `seguranca` review + an LGPD domain + its own ADR, and it is dependency-blocked (no validated per-account fee
  source; AliExpress has no reliable public source at all, 005 §4). If the owner reverses Q1, it re-enters as its own
  ADR + mandatory `seguranca` review.
- **New marketplaces beyond the three curated** (ML / Amazon / Shopee) — AliExpress, Magalu, Casas Bahia stay OUT
  (005 §4 — no validated public fee source; Elo7 shut down). Revisit only when a validated source appears.
- **Billing / purchase / self-service upgrade / prices in R$** → **E6**. Grants stay out-of-band; teasers carry no
  price and no date.
- **Goal-seek (target net → price), break-even/price-floor per channel, competitor alerts, quantity-discount curves**
  → improvement backlog (deferred from 005 §4). E5 saves a what-if; it adds no new solver.
- **Quote status / pipeline (enviado · aceito · recusado · produzido) / CRM** → OUT (E4 Q11 flagged this as an "E5+"
  candidate, but it is a **sales-pipeline** domain, not a what-if scenario). Still OUT; a strong later-increment
  candidate.
- **Public shareable scenario links** (a server-hosted URL a customer opens without auth) → OUT (new public surface:
  LGPD + expiry + abuse — the same reasoning that kept public quote links out of E4).
- **A user-editable fee catalog / admin UI** → unchanged; the catalog stays curated in-repo (005 / ADR-0010).
  Sellers override per-slot inside a scenario; they do not manage the catalog.
- **Changing snapshot behavior** → unchanged; E4 snapshots stay frozen. FR-617 only *creates* a snapshot from a
  scenario; it does not alter what a snapshot is.
- **Full LGPD program** (consent management, self-service portability/erasure) → still deferred; scenarios follow the
  E2 retention posture (never auto-deleted; user-initiated delete).
- **Taxes** → still out (A24).
- **Public deploy** → still deferred to v1 = E1–E6 (owner rule 2026-07-09, revisitable).
- **`pricing-core` formula change** → **none** (verified against source at plan, 92%): the engine (`3.1.0`) already
  takes **already-resolved** channels, and fee resolution + the override model already ship client-side
  (`apps/web/src/features/calculator/fee-prefill.ts` — a blank slot re-resolves live, a typed fee sticks; that IS
  the Q3 rule). E5 stores determinants + explicit overrides and re-resolves live, so it never needs a frozen
  resolved fee — a **persistence** epic, not a formula epic. *(Two premise corrections from the arch round: the
  version is `3.1.0`, not "3.0.0"; `ChannelResult` does not carry `resolvedFee` — that echo was deferred to E4 per
  the ADR-0011 Amendment. Neither changes the conclusion.)*

---

## Clarifications

### Session 2026-07-17 (`/speckit-clarify`)

- Q: Q3 — On reopen, what is frozen vs re-resolved live? → A: **Freeze intent, resolve values live** — the channel
  set + determinant choices + the seller's explicit per-slot fee overrides persist; non-overridden fees + catalog
  references re-resolve from today's catalog (FR-606, FR-607).
- Q: Q4 — Can a scenario be saved while offline? → A: **No — online-only writes** with an honest offline failure (no
  silent drop, no fake success); offline **read/reopen** is still supported (FR-613, FR-614). The E4 offline outbox
  (ADR-0018) is deliberately **not** reused.
- Q: Q2 — What can a scenario's cost basis be? → A: **Both** an ad-hoc piece-input set **and** a Product/Kit
  reference; a reference **live-reflects** (D3) and **degrades to last-known** (D6) (FR-606a, FR-607a/b).

### Resolved by owner (2026-07-17, `/speckit-specify`)

- **Q1 — Scope of E5** → **(a) saved scenarios ONLY.** Per-account live fee auth (Shopee OAuth, AliExpress) is
  **deferred to its own future integration increment**, OUT of this spec. Rationale: saved scenarios is a
  self-contained premium feature that reuses the E2 entitlement machinery and extends shipped 005 compute with zero
  new external dependency and zero new security/LGPD domain; per-account fee auth is heavier, security-laden and
  dependency-blocked. *(FR-618, §Out of Scope.)*

### Session 2026-07-19 (owner decisions at the T002 checkpoint, post-`/speckit-analyze`)

- Q: Default list ordering → A: **newest-saved (`created_at DESC`)** — stable keyset cursor; the data-model §5
  index stands as `(owner_uid, created_at, id)`.
- Q: Full-config edit route (FR-611) → A: **`PUT` full-replace + `PATCH` rename kept as separate routes** (7
  routes, mirroring `PUT /boms/{id}`; renaming from the list never re-sends the whole config).
- Q: Q12 — kit-basis channel composition → A: **apply the scenario's channelSet uniformly to every kit line →
  `computeBom` → per-marketplace rollup** (no `pricing-core` change; consumed by T024).
- Q: Q13 — saving a reference to an already-deleted id → A: **accept-and-degrade** (consistent with "stores
  intent"; not a 422 — E3's 422 exists only because a kit-save materializes).
- Q: Q6 — metadata caps → A: **`name` required ≤120 · `note` optional ≤500** confirmed; a single free-text note
  (no tags/folders) is enough for v1.
- Q: `config` payload size cap → A: **256 KB**, rejected with an honest, visible **422** — never a silent
  truncation.
- Q: Accent-sensitive name search → A: **accepted as-is** (same as E4; `unaccent` deferred, revisit = owner call).
- Q: Pricing model-version column (data-model §7.3) → A: **`config_schema_version` only; no advisory
  model-version column** (a scenario makes no frozen claim).
- Q: Q11 — IA placement, final (with the designer's T001 handoff, `ux-scenarios.md`) → A: **inside Calcular** —
  a "Meus cenários" entry in the Calcular header (list as sub-route/Sheet) + "Salvar cenário" **premium-only**
  inline below "Preços por canal". *(FR-615.)*
- Q: SC-109 × FR-616 collision (T001 finding — 005's SC-109, e2e-pinned, forbids a save button on the FREE
  calculator) → A: **ratified the E4-precedent resolution** — the free calculator gets **no** inline save
  button (SC-109 + its e2e stand unchanged); FR-616's visible free door is the "Meus cenários" surface entry,
  which opens the honest teaser.
- Q: Loaded-scenario edit model (T001 F4) → A: **both routes in the context bar** — "Salvar alterações"
  (`PUT` full-replace on the loaded scenario) + "Salvar como novo" (`POST`), with an unsaved-changes badge.
- Q: Duplicate naming + list label (T001 F5/F6) → A: **"Cópia de {name}"** truncating the original with an
  ellipsis so the suffix fits ≤120; the list's last-updated label is **relative** ("Atualizado há…").
- Q: Teaser signed-out dialog copy (T018 finding) → A: **ratified as built** — the state-tailored body ("Para
  salvar seus cenários, entre e ative o Premium.") replaces the generic body of ux §7 for the signed-out
  variant; guardrails intact (no price, no date, no CTA).
- Q: The 3 cosmetic T018 nits → A: **PR-B follow-up** (tasks.md T030b), not PR-A blockers.

### Pending owner decisions (working default = product-owner recommendation)

The three architecture-shaping questions (**Q2, Q3, Q4**) were resolved in the `/speckit-clarify` session above and
written into the requirements. The remaining questions carry the recommendation from
`docs/product/e5-scope-brief.md` §10 as the working default; each is ≥80%/low-risk and can be confirmed in a later
clarify pass or at `/speckit-plan`.

- **Q5 — Record a snapshot from a scenario** (default: **yes, reuse the E4 record path**; 80%; P3/droppable).
  *(FR-617.)*
- **Q7 — Does saving materialize anything** (default: **no**; 85%). *(FR-604, SC-606.)*
- **Q8 — Export a live scenario, or only a frozen snapshot** (default: **only snapshots** — record a snapshot from
  the scenario, then use the E4 export; 70% — avoids a stale-vs-live export honesty risk).
- **Q9 — Lapse read/recompute line** (default: **open + recompute survives a lapse** as a read; writes denied; 80%).
  *(FR-612, SC-608.)*
- **Q10 — Free ephemeral scenario** (default: **keep saving Premium**, no free draft; 85% — flagged as a real
  conversion moment; weakening it is a dated business-rules amendment). *(FR-616.)*

Q6, Q11, Q12, Q13, the full-config edit route, the list ordering, the size cap, the accent-search posture, the
model-version column, the SC-109×FR-616 resolution, the loaded-scenario edit model and the duplicate-naming/list-label
defaults were **decided 2026-07-19** (session above).

---

## Assumptions

- Builds on **E1/004/005** (shipped, owner-homologated): the **live multi-channel compute** + the **served/cached/
  seeded fee catalog** (ADR-0010) + the `pricing-core` **3.1.0** engine, which takes **already-resolved** channels
  (fee resolution + the override model ship client-side, in `fee-prefill.ts`, not in the engine). E5 **persists** the
  seller's intent (determinants + overrides) and re-runs the current engine on reopen; the pricing math
  is reused unchanged (backend never recomputes — Constitution / FR-619).
- Reuses **E2/007** verbatim: the entitlement gate (ADR-0012), per-account isolation, the offline read-cache +
  uid-keyed purge-on-signout, the `ENTITLEMENT_REQUIRED` vocabulary, and the lapse read-only freeze posture. **No new
  gate.** The **Product** entity is a cost-basis reference candidate (Q2).
- Reuses **E3/008**: the **Kit** entity is a cost-basis reference candidate (Q2); the **D3 live-reflect / D6
  last-known** degradation semantics (ADR-0017 §6) apply to a scenario's referenced basis; ADR-0015 is the
  client-guard-over-server-gated-data enforcement precedent (FR-619).
- Reuses **E4/009**: the **Snapshot** object is the target of the FR-617 record-from-scenario bridge (Q5); **ADR-0018**
  (offline outbox) is the *candidate* mechanism if Q4 flips scenario writes to offline-capable.
- The freemium boundary is settled: `business-rules.md` §PREMIUM already lists "Saved marketplace-simulation
  scenarios" as premium with zero free persistence (revised Round 3, 2026-06-29). E5 adds no new gate.
- This document specifies **behavior**, not architecture (Constitution VIII). Persistence model + schema + **migration
  number** (next after `0003_e4_snapshots` — likely `0004`, to confirm), the **offline-write mechanism** (online-only
  vs the E4 outbox, feeds Q4), and the **live-recompute ↔ catalog/fee-degradation reconciliation** are routed to
  `arquiteto` at `/speckit-plan`. Copy is pt-BR, i18n-ready; UX/IA → `designer-ux`, final UI → Claude Design.
