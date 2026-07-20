# E5 — Scope brief: saved marketplace scenarios (the fourth object)

**Status**: product scope draft (input to `/speckit-specify`) · **Author**: product-owner · **Date**: 2026-07-17
**Roadmap line being expanded**: `docs/product/business-rules.md:56` — *"E5 | Marketplace simulator — live
multi-channel compute pulled forward into E1 (spec 005, 2026-07-08); E5 keeps what's left: saved scenarios +
per-account live fee auth (Shopee OAuth, AliExpress) | saved scenarios = premium"*.

> This brief specifies **behavior**, not architecture. Schema, migration numbers, whether a write reuses the E4
> offline outbox, and any per-account OAuth mechanism are the arquiteto's call (Principle VIII). Where a product
> decision depends on a technical unknown, it is **flagged** (§9), not decided here. No fee value is fabricated
> anywhere in this document (Constitution II).

## 0. Owner decisions

The headline scope call is **settled**; the remaining §10 questions carry their recommendation as the working
default into `/speckit-specify` + `/speckit-clarify` (the E4 pattern — E4's §0 grew as the owner ruled).

| # | Decision | vs. recommendation |
|---|---|---|
| **Q1** | **(a) E5 = saved scenarios ONLY.** Per-account live fee auth (Shopee OAuth, AliExpress) is **deferred to its own future integration increment** — not in E5. The epic is a clean, self-contained persistence feature that reuses the E2 entitlement machinery and extends the shipped 005 compute, with **zero new external dependency and zero new security/LGPD domain**. **OWNER DECIDED 2026-07-17.** | = rec (a), 85% |

The remaining ten questions (Q2–Q11) carry the product-owner's recommendation as the working default; the owner
may still put any of them (Q3 the frozen-vs-live crux, Q4 offline writes, Q2 cost basis) to `/speckit-clarify`.

---

## 1. Epic vision (the seller's problem)

*"Eu vendo o mesmo vaso no Mercado Livre, na Shopee e na Amazon. Toda vez que quero comparar onde sobra mais, eu
monto os três canais de novo na calculadora, olho o resultado, e quando fecho o app perdi tudo. Semana que vem a
Shopee muda a taxa e eu tenho que refazer na mão pra saber se ainda compensa vender lá."*

E1/005 gave the seller a **live multi-channel calculator** — price the same product across ML / Amazon / Shopee at
once, with fees pre-filled from the dated catalog. But it is **ephemeral**: close the app and the comparison is
gone; a fee change next week means rebuilding the whole grid by hand. E5 lets the seller **save that comparison as
a named, reusable scenario** — the channel set, the per-channel fee overrides, the include/exclude framing, the
cost basis — that on reopen **re-computes against today's fees and formula** (LIVE), so *"a taxa nova da Shopee
ainda me deixa margem?"* is one tap, not a rebuild. And its killer move is **duplicate-to-tweak**: clone
*"ML Clássico × Shopee"*, bump one fee, compare the two side by side. The pitch in one line: **o Histórico prova o
que você cobrou (E4, congelado); o Cenário mostra onde vale a pena vender — e continua vivo.**

---

## 2. The four-object map (the centerpiece — a scenario is the mirror of a snapshot)

E5 introduces the product's **fourth** persistent object. The risk of the whole epic is letting it **collide** with
the three that exist. This table draws the boundary as sharply as E4 drew the two-shelf rule:

| | **Product (E2)** | **Kit (E3)** | **Snapshot (E4)** | **Scenario (E5)** |
|---|---|---|---|---|
| Answers | "quanto custa este **item** hoje?" | "quanto custa esta **montagem** hoje?" | "quanto eu **cobrei** em 03/07?" | "**onde** e por **quanto** vender — hoje?" |
| Models | the **thing** sold (template) | the multi-piece **thing** (assembly) | a recorded **event** (frozen) | the **selling strategy** (channels · fees · framing) |
| On reopen | **recomputes** (live) | **recomputes** (live) | **never recomputes** (frozen) | **recomputes** (live) |
| Reference edited | D3 live-reflect | D3 live-reflect | **nothing changes** | **D3 live-reflect** |
| Reference deleted | D6 last-known caption | D6 last-known caption | **nothing changes** (no dependency) | **D6 last-known caption** |
| Carries a date | no | no | **always** — the date is the claim | **no** — it is a live view of *today* |
| Editable | yes | yes | **contents never**; label only | **yes** — name + whole config |
| Its subject | piece inputs | piece set + quantities | the **frozen** numbers | the **channel set · fee overrides · framing · basis** |

**A scenario is LIVE where a snapshot is FROZEN — the two are mirror images.** A snapshot answers *"o que eu
cobrei"*; a scenario answers *"onde eu deveria vender"*. Both are correct; they resolve opposite questions. That
mirror is the cleanest way to hold the taxonomy: whenever a rule for a snapshot says "frozen / never changes / has
a date", the scenario rule is the exact inverse ("live / reflects today / has no date").

**The collision guard — a scenario sits a LAYER ABOVE the catalog, so it cannot BE a Product/Kit.** A Product/Kit
model the **thing** being sold. A scenario models the **strategy** and can take a Product/Kit **as its cost basis**
(Q2). You cannot make a scenario a product, because a scenario can *contain a product-reference* — they live at
different levels. (Note the real overlap I will not paper over: an E2 Product *already carries a channel set*, per
E2 FR-310. The difference is purpose and level — a Product's channel set is incidental to pricing that **one named
item** for reuse; a scenario is a **standalone, duplicate-to-tweak analysis** whose subject **is** the
channel/fee/framing axis, and whose basis may itself be a Product. §3 states this crisply so the two do not merge.)

**Two integration points — defined relationships, never merged objects:**
1. **Cost basis** = ad-hoc piece inputs **or** a Product/Kit reference (Q2). A reference **live-reflects** (D3) and
   **degrades to last-known** (D6) exactly like a kit line — because a scenario is LIVE. A scenario **materializes
   nothing** (unlike E3 K3): it references the catalog, it never mutates it (Q7 / SC-606).
2. **Record a snapshot FROM a scenario** (Q5 / US7): a scenario is live, so freezing its current computation is
   precisely the E4 US1 record path, with the scenario added as a new **provenance** source ("originou-se do
   cenário X"). Provenance is informational only — it can never alter or degrade the resulting snapshot (E4's
   immutability rule holds verbatim).

**What is frozen vs live INSIDE a scenario (the crux — Q3).** A scenario freezes the seller's **intent** (the
channel set, the determinant choices, the *explicit* per-slot fee overrides, the framing toggle, the cost basis)
and resolves the **values** live (today's fee catalog + today's catalog references + today's formula). That split
is exactly what makes it live, not frozen: a fee-catalog refresh between save and reopen **is** reflected on every
non-overridden slot; an overridden slot keeps the seller's number (it is a deliberate strategy choice, shown with
005's "ajustado por você" seal). Getting this line wrong is how a scenario would accidentally become a snapshot
(freeze everything) or lose its strategy (discard overrides) — hence Q3 is an owner decision.

**Honesty rules inherited (`docs/product/ux-decisions.md` + E2 US7 / E3 D6 / E4 US5 lineage):**
- **Never present stale as live.** A reopened scenario shows **today's** numbers and carries no frozen date. If it
  cannot refresh the fee catalog (offline), it computes from the cached reference and shows the **same 005
  staleness seal** ("pode estar desatualizada") — never a stale fee dressed as fresh.
- **Never claim removed when it wasn't.** A referenced Product/Kit that was deleted degrades via the E2/E3 D6
  last-known caption reused verbatim — a calm honest caption, never a "removido" claim, never a broken/blank
  scenario.
- **Never invent data.** No fabricated fee ever pre-fills; 005's `sem referência` / `ajustado por você` /
  `estimativa` seals carry into a saved scenario unchanged.
- **A duplicate is a NEW object, never a mutation** (the mirror of E4's "recalcular hoje is a new event"): cloning
  a scenario leaves the original untouched (SC-605).

---

## 3. What a scenario IS (crisp, so E5 does not collide with E2/E3/E4)

A **scenario** is: a premium seller's **explicitly saved, named, re-runnable configuration** of the multi-channel
calculator — the seller's assertion *"esta é uma estratégia de venda que eu quero guardar e comparar"* — carrying:
- the **channel set** (which marketplaces + their determinants — ML listing type/category, Amazon category/plan,
  Shopee band),
- the **per-channel fee overrides** (the seller's explicit adjustments; non-overridden fees re-resolve live),
- the **include/exclude framing** toggle ("Incluir marketplaces no preço", 005 FR-113),
- the **cost basis** — ad-hoc piece inputs **or** a Product/Kit reference (Q2),
- the **"Outros custos"** list,
- a **name** (required — it is the identity for duplicate-to-tweak) + optional note (Q6).

On reopen it **re-computes** against today's catalog + today's fee catalog + the current formula (LIVE — SC-602).

**It is NOT**:
- a **frozen record** — that is a Snapshot (E4). A scenario is its mirror: LIVE, dateless, always "hoje".
- a **catalog item you sell** — that is a Product/Kit (E2/E3). A scenario is an **analysis**, not merchandise; it
  is not in the catalog IA and it **materializes nothing** (the explicit contrast with E3 K3 — protects the
  catalog from being polluted with strategy variants).
- an **autosave of every keystroke** — saving is an explicit, intentional act (the E4 discipline: a saved object is
  an *assertion*, and assertions need intent). This also keeps zero-free-persistence trivially true.
- a **per-account marketplace integration** — a scenario uses the SAME curated 005 fee catalog (ADR-0010), never
  the seller's own marketplace account. Live per-account fees are the **deferred** increment (Q1), not this object.

**Saving a scenario materializes nothing** (SC-606). A scenario references the catalog; it never mutates it. If a
seller wants to promote an ad-hoc basis into a real Product, that is a separate explicit action, never an automatic
side effect of saving a scenario.

---

## 4. Freemium boundary (settled — not reopened here)

`business-rules.md` §PREMIUM already lists **"Saved marketplace-simulation scenarios"** on the Premium side, with
**zero free persistence** (R3, 2026-06-29). E5 therefore introduces **no new gate**: it reuses the E2
server-authoritative entitlement (ADR-0012, Constitution IV) **verbatim**, exactly as E4 did. The roadmap's *"saved
scenarios = premium"* is the whole story — **save / list / open / duplicate / rename / delete are all premium**.
The free/signed-out user keeps the **fully free, offline** multi-channel calculator (005): they compute across
every channel for free; they simply **cannot save** a scenario. Every free-facing "salvar cenário" affordance gets
the honest teaser (E2 US7 / E3 US5 / E4 US5 lineage): no price, no date, no fake "salvo!", no pre-E6 purchase CTA.

One conversion tension is **flagged, not decided by me** (Q10): a free seller who just built a three-channel
comparison and wants to keep it — the comparison **evaporates on reload**. This is a genuine upgrade moment.
Weakening the split is an owner decision and a dated business-rules amendment — not mine to make.

**Enforcement honesty (Principle IV, ADR-0012/0015 precedent).** Persistence of scenarios is
**server-authoritative** — that boundary is real. The **live recompute** on reopen runs **client-side** in
`pricing-core` (like the E2 product recompute and the E3 kit compute). So opening a saved scenario is a client
compute over **server-gated saved config**; the spec/plan MUST say this honestly and MUST NOT imply the recompute
itself is server-enforced. This is exactly the ADR-0015 shape (a client feature-guard over a client-side compute,
with the persistence boundary as the real server gate). It also settles Q9's read/write line: **recompute is a
read** (a lapsed account may still open + recompute a saved scenario), while **save / duplicate / rename / delete
are writes** (server-gated, denied on lapse).

---

## 5. User stories

### US1 — Save a multi-channel what-if as a reusable scenario (Premium) — **P1 [FOUNDATIONAL]**
A premium seller, having configured the multi-channel calculator (channel set + fee overrides + framing + cost
basis + Outros custos), explicitly **saves it as a named scenario**, server-side. The scenario stores the seller's
*intent* (choices + overrides), not resolved values.

**Acceptance scenarios**
1. **Given** a premium user with a configured multi-channel calculator, **When** they save it with a name, **Then**
   the scenario persists and appears in the scenarios list on a fresh session/device, showing its name.
2. **Given** a saved scenario, **When** it is reopened, **Then** its configuration (channels, determinants,
   overrides, framing, cost basis, Outros custos) is **restored exactly** and the prices are **recomputed live**
   against today's catalog + fee catalog + formula (see US3 for the live contract).
3. **Given** a free or signed-out caller, **When** any save/list/read scenario operation is called, **Then** the
   server denies with `ENTITLEMENT_REQUIRED`, nothing is written or read, and the client's local state is never
   trusted.
4. **Given** a saved scenario, **When** the account's catalog is inspected, **Then** **nothing was materialized** —
   saving a scenario creates no product, no kit, no filament, no printer (SC-606).

### US2 — Consult the scenarios (list, open, offline read) — **P1**
The scenarios surface (IA placement = Q11): entries listed newest-first (or by name), each opening into the live
multi-channel view.

**Acceptance scenarios**
1. **Given** several saved scenarios, **When** the list is opened, **Then** they list with name (and, if kept,
   note/last-updated); opening one restores its config and recomputes live.
2. **Given** a premium account that loaded the scenarios list online once, **When** the device goes offline,
   **Then** scenarios remain **readable and re-openable** from the local cache (mirrors E2/E3/E4 offline read); the
   live recompute uses the **cached** catalog + fee reference and shows the honest staleness seal; **saving** a
   scenario behaves per Q4 (honest offline failure, or an offline outbox — flagged, not decided here).
3. **Given** account A's scenario, **When** account B is signed in, **Then** B can neither read nor modify it, and
   it is indistinguishable from non-existent (no existence oracle).
4. **Given** a sign-out, **When** it completes, **Then** the local scenarios cache is purged (existing uid-keyed
   purge-on-signout pattern).

### US3 — A scenario always shows today; the LIVE contract made visible — **P1**
The mirror of E4 US3. Where a snapshot is inert to catalog churn, a scenario **reflects** it — that is the feature.

**Acceptance scenarios**
1. **Given** a scenario whose cost basis references product P, **When** P's filament cost is edited, **Then** on
   reopen the scenario's cost basis and prices **reflect the new cost** (D3 live-reflect — the opposite of a
   snapshot).
2. **Given** a scenario whose cost basis references product P, **When** P is deleted, **Then** on reopen the
   scenario **degrades to last-known editable values** with the E2/E3 honest caption — never a broken/blank
   scenario, never a "removido" claim (D6 last-known).
3. **Given** a saved scenario with a non-overridden ML slot, **When** the fee catalog is refreshed to a new ML
   commission, **Then** on reopen that slot **re-resolves to the new fee** (live); an **overridden** slot keeps the
   seller's number with the "ajustado por você" seal (Q3 — intent frozen, values live).
4. **Given** a reopened scenario, **When** its numbers render, **Then** they are presented as **today's** result
   with no frozen date; if computed offline from a stale cache, the 005 staleness seal is shown (never stale-as-live).

### US4 — Duplicate-to-tweak (the comparison feature) — **P1**
The scenario tool's killer move: **clone a scenario, change one thing, compare.** A duplicate is an independent new
object; the original is untouched.

**Acceptance scenarios**
1. **Given** a saved scenario, **When** the seller duplicates it, **Then** a new independent scenario is created
   (own name), and editing the copy changes **0%** of the original — and vice versa (SC-605).
2. **Given** a duplicated scenario, **When** the seller changes one channel / one fee override / the framing,
   **Then** it recomputes independently, so the two variants can be compared.
3. **Given** a free or signed-out user, **When** they meet the "duplicar" affordance, **Then** they get the honest
   teaser (US5) — nothing persists, no fake success.

### US5 — Honest teaser for save-scenario (free / signed-out) — **P2**
Every free-facing affordance ("Salvar cenário", the scenarios surface, "Duplicar") is **visible** and opens an
honest Premium notice: no price, no date, no fake "salvo!", no pre-E6 purchase CTA. The free multi-channel
calculator (005) remains fully free, offline and untouched.

**Acceptance scenarios**
1. **Given** free/signed-out, **When** the scenarios surface is opened, **Then** it explains the premium value
   honestly (never a broken list, never a fabricated sample scenario).
2. **Given** free/signed-out, **When** any "salvar cenário" / "duplicar" affordance is tapped, **Then** the honest
   teaser appears, nothing persists, nothing is generated, no success is faked.
3. **Given** the teaser copy, **When** reviewed, **Then** it promises no price and no availability date.

### US6 — Manage the scenarios + lapse policy — **P2**
Rename, search/filter (by name), delete — per-account, isolated. On premium lapse: **read-only freeze**, exactly
like E2/E3/E4 — scenarios stay readable **and re-openable/recomputable** (recompute is a read, §4), nothing is
auto-deleted, all writes (save/rename/duplicate/delete) are denied. Re-grant restores writes with data intact.

**Acceptance scenarios**
1. **Given** saved scenarios, **When** the owner renames or deletes one, **Then** the change persists per-account.
2. **Given** a lapsed account, **When** it opens the scenarios surface, **Then** scenarios are readable and can be
   opened + recomputed (read), **zero** writes succeed, and none is deleted by the lapse; re-grant restores writes
   with data intact (SC-608).
3. **Given** many scenarios, **When** the seller searches by name, **Then** the matching scenarios are found
   without the list becoming unusable.

### US7 — Record a snapshot from a scenario (the E4 bridge) — **P3 (droppable)**
A scenario is live; the seller can **freeze its current computation into the Histórico** (E4) — turning a live
strategy into a proof of what was quoted. Reuses the E4 US1 record path with the scenario added as a provenance
source.

**Acceptance scenario**: **Given** a premium seller viewing a scenario's live result, **When** they record it,
**Then** an immutable E4 snapshot is created **byte-identical** to the scenario's current computation, carrying
informational provenance ("originou-se do cenário X"); the snapshot never recomputes and a later catalog/fee change
cannot alter it (E4 immutability holds); the scenario itself is unchanged.

> P3 = explicitly droppable if it endangers the epic. Recommend cutting US7 before cutting US4 (duplicate-to-tweak
> is the epic's headline value; US7 is a nice bridge to an already-shipped E4 surface).

---

## 6. Success criteria (measurable, technology-agnostic)

- **SC-601**: A premium user saves a configured multi-channel scenario and, on a fresh session/device, reopens it
  with its **full configuration restored** (channels, determinants, overrides, framing, cost basis, Outros custos).
- **SC-602**: On reopen, a scenario **re-computes** with the current formula + current fee catalog + current
  catalog references (LIVE); it **never** renders a frozen value, and a fee-catalog or reference change since save
  **is** reflected on every non-overridden field.
- **SC-603**: Editing a catalog entity referenced by a scenario's cost basis is **reflected** on reopen (D3), and
  deleting one **degrades to last-known editable values** with the E2/E3 honest caption (D6) — the exact
  live-object behavior, the opposite of an E4 snapshot; **0** scenarios break or blank on a dangling reference.
- **SC-604**: 100% of scenario persistence operations are authorized server-side; a free/signed-out or
  locally-faked-premium caller is denied (`ENTITLEMENT_REQUIRED`) and persists/reads nothing.
- **SC-605**: Duplicating a scenario yields an **independent** copy — editing the copy changes **0%** of the
  original (and vice versa); the original is never mutated by a clone.
- **SC-606**: Saving (or duplicating) a scenario creates **zero** catalog objects (no product, no kit, no filament,
  no printer) — a scenario materializes nothing.
- **SC-607**: Every free/signed-out save-scenario/duplicate affordance is honest on the rendered UI (no price, no
  date, no fake success, no pre-E6 purchase CTA); the 005 free multi-channel calculator's guarantees hold
  unchanged.
- **SC-608**: On lapse, 100% of scenarios stay readable **and re-openable/recomputable** and **0%** writable
  (save/rename/duplicate/delete) or deleted; re-grant restores writes with data intact.
- **SC-609**: Zero cross-account reads or writes of scenarios under any manipulation; another account's scenario is
  indistinguishable from non-existent.
- **SC-610**: After one online load, 100% of the account's scenarios are readable + re-openable offline (from the
  cached catalog/fee reference, with the honest staleness seal); a save attempted offline behaves per Q4 (honest
  failure or outbox — no silent drop, no fake success either way).
- **SC-611** *(if US7 ships)*: Recording a snapshot from a scenario produces a frozen E4 snapshot **byte-identical**
  to the scenario's current computation, carrying informational provenance only; a later catalog/fee change alters
  **0%** of that snapshot (E4 immutability holds).
- **SC-612**: All E1/E2/E3/E4 acceptance guarantees pass unchanged (free calculator, catalog live-recompute, kit
  D3/D6, snapshot immutability, entitlement gate) — E5 adds a fourth object, it does not alter the existing three.

---

## 7. Scope boundaries

### IN
- Explicit **save** of a configured multi-channel calculation as a **named, reusable scenario** (Premium).
- **Reopen → live recompute** against today's formula + fee catalog + catalog references, with **D3 live-reflect /
  D6 last-known** degradation on a referenced cost basis (the live-object contract).
- The scenarios surface: **list, open, rename, duplicate, delete, search, offline read**.
- Honest **teaser** for every free/signed-out save-scenario affordance.
- **Lapse** read-only freeze (read + recompute survive; writes denied; nothing auto-deleted).
- **Record a snapshot from a scenario** (US7, P3 droppable) — the E4 bridge.

### OUT (guarding the boundary)
- **Per-account live fee auth** (Shopee per-shop OAuth, ML per-seller, **AliExpress**) → **its own future
  integration increment** (my recommendation, Q1). It is per-SELLER OAuth into the seller's own marketplace
  account — a different mechanism from 005's curated catalog and from the house-account ML ingestion — and it drags
  in external-auth + credential/token storage + a `seguranca` review + an LGPD domain + its own ADR, and it is
  **dependency-blocked** (no validated per-account fee source; **AliExpress has no reliable public source at all**,
  005 §4). 005 §4 already deferred it "if/when validated"; validation has not happened. If the owner overrides Q1,
  it becomes IN with its own ADR + `seguranca` review (§9.5).
- **New marketplaces beyond the three curated** (ML / Amazon / Shopee) — **AliExpress, Magalu, Casas Bahia** stay
  OUT (005 §4 — no validated public fee source; Elo7 shut down). Revisit only when a validated source appears.
- **Billing / purchase / self-service upgrade / prices in R$** → **E6**. Grants stay out-of-band; teasers carry no
  price and no date.
- **Goal-seek (target net → price), break-even/price-floor per channel, competitor alerts, quantity-discount
  curves** → improvement backlog (deferred from 005 §4). E5 saves a what-if; it does not add new solvers.
- **Quote status / pipeline (enviado · aceito · recusado · produzido) / CRM** → OUT (E4 Q11 flagged this as an
  "E5+" backlog candidate, but it is a **sales-pipeline** domain, not a what-if scenario — a scenario is a strategy
  comparison, not a deal tracker). Still OUT; a strong candidate for a later increment.
- **Public shareable scenario links** (a server-hosted URL a customer opens without auth) → OUT (new public
  surface: LGPD + expiry + abuse — the same reasoning that kept public quote links out of E4).
- **A user-editable fee catalog / admin UI** → unchanged; the catalog stays curated in-repo (005 / ADR-0010).
  Sellers override per-slot inside a scenario; they do not manage the catalog.
- **Changing snapshot behavior** → unchanged; E4 snapshots stay frozen. US7 only *creates* a snapshot from a
  scenario; it does not alter what a snapshot is.
- **Full LGPD program** (consent management, self-service data portability/erasure) → still deferred; scenarios
  follow the E2 retention posture (never auto-deleted; user-initiated delete).
- **Taxes** → still out (A24).
- **Public deploy** → still deferred to v1 = E1–E6 (owner rule, revisitable).

---

## 8. Recommended PR slicing (owner-authorized, slice by slice — E2/E3/E4 pattern)

- **PR-A — The saved shelf (US1 + US2 + US5).** Save a configured multi-channel scenario, server-gated persistence,
  the scenarios list + reopen with **live recompute**, offline read cache + purge-on-signout, and the honest
  free/signed-out teaser. *Demoable alone: a premium seller saves a three-channel comparison and reopens it
  computing today's numbers; a free user sees an honest door.* (Like E4, PR-A **is** the server slice — a scenario
  is worthless without persistence.)
- **PR-B — The live contract + comparison + lifecycle (US3 + US4 + US6).** The LIVE-vs-frozen rule proven (D3
  live-reflect + D6 last-known on a referenced basis + fee-refresh reflection + override persistence),
  **duplicate-to-tweak**, and manage (rename/search/delete) + lapse read-only freeze. *This is the slice that
  proves the four-object taxonomy and delivers the epic's headline value; it is where the E5 risk lives.*
- **PR-C — The E4 bridge (US7, if it survives).** Record a snapshot from a scenario's live computation, with
  informational provenance; a scenario's frozen result then rides the existing E4 export path. *Independently
  homologable; the natural place to cut scope if the epic runs long.*

Rationale for the order (the E4 rationale, adapted): PR-A must carry persistence + the live-recompute contract
because a scenario has no standalone value without them. PR-B is where the taxonomy is proven and the killer
feature lands. PR-C is the only part that can be deferred without leaving the product incoherent — a scenario tool
that saves, reopens-live and duplicates is already shippable value.

---

## 9. Technical unknowns to route to the arquiteto (not product calls)

1. **Persistence + schema + migration number.** A `scenarios` table (per-account, soft-delete, name + config
   payload + optional basis reference) and its migration number (next after `0003` e4 snapshots — **likely `0004`,
   inference**; confirm). The config payload's shape (how the channel set / determinants / overrides / framing /
   Outros custos / basis are stored) is an arquiteto call.
2. **Offline write policy (feeds Q4).** Whether a scenario **save** reuses the E4 offline outbox (ADR-0018,
   uid-keyed, exactly-once) or is **online-only** like E2/E3. The offline **read** cache is reused either way.
3. **Live-recompute vs catalog/fee degradation reconciliation.** How the reopen recompute reconciles with (a) E2/E3
   catalog degradation (D3 live-reflect / D6 last-known) when the cost basis references a **changed or deleted**
   catalog entity, and (b) the fee-catalog refresh + seller overrides (what re-resolves vs what stays sticky — the
   Q3 intent-frozen/values-live rule). This is the deepest engineering seam in E5.
4. **`pricing-core` impact — likely NONE (inference, ~85%).** 005's **3.0.0** result already carries `resolvedFee`
   + `catalogVersion` (ADR-0011 Part 4), and reopen just re-runs the current engine on the saved config. Confirm
   before assuming any version bump — E5 is expected to be a **persistence** epic, not a formula epic.
5. **Only if Q1 flips per-account fee auth IN:** it is its **own ADR** + a mandatory `seguranca` review
   (credential/token storage, per-seller OAuth, token refresh, LGPD for storing marketplace access) — a materially
   heavier, security-laden integration than the rest of E5. Do not fold it into a scenarios ADR.

---

## 10. Open questions — owner decisions (→ `/speckit-clarify`)

| # | Decision | Options | Recommendation (confidence) |
|---|---|---|---|
| **Q1** | **THE scope call — is per-account live fee auth (Shopee OAuth, AliExpress) in E5, or its own increment?** | (a) **E5 = saved scenarios only**; per-account fee auth = a **separate future integration increment** · (b) **both** in E5 · (c) scenarios + a thin **validation spike** (one marketplace's OAuth) to de-risk the future increment without shipping it | **(a)** (**85%**). Saved scenarios is a coherent, self-contained, shippable premium increment that directly extends the shipped 005 compute and reuses the E2 entitlement machinery — **zero new external dependency, zero new security domain**. Per-account fee auth is heavier and **dependency-blocked**: new external-auth + credential/token storage + `seguranca` + LGPD + its own ADR, and **AliExpress has no reliable per-account fee source** (005 §4), Shopee per-shop OAuth is gated, and the precedent (D1–D4 ML ingestion) is already blocked on the house account (Q-D). Bundling it would block the whole increment on an external/security dependency and mix a clean persistence feature with a heavy integration. **This is the single biggest question in the brief.** |
| **Q2** | **Cost basis of a scenario** — ad-hoc inputs, a catalog reference, or both? | (a) **ad-hoc only** (scenario captures whatever's in the calculator) · (b) **Product/Kit reference only** · (c) **both** | **(c) both** (70%). Ad-hoc covers sellers not using the catalog; a Product/Kit **reference** is the differentiator that makes a scenario a *layer above* the catalog (change the product → every scenario reflects it, D3/D6). Cost: (c) drags D3/D6 degradation into E5 (§9.3). If PR-A must stay small, ship **ad-hoc in PR-A** and **catalog-reference in PR-B**. |
| **Q3** | **What is frozen vs live inside a scenario on reopen?** (the crux of the four-object map) | (a) **freeze intent, resolve values live** — the channel set + determinant choices + *explicit* overrides persist; non-overridden fees + references re-resolve from today's catalog · (b) **freeze nothing** — re-resolve all fees from today's catalog, **discarding** overrides · (c) **freeze everything** (= effectively a snapshot) | **(a)** (75%). It is what makes a scenario LIVE without losing the seller's strategy. (b) throws away the seller's deliberate adjustments; (c) collapses the scenario into a snapshot and breaks the whole taxonomy. |
| **Q4** | **Offline scenario writes** | (a) **online-only writes**, honest failure offline (mirrors E2/E3) · (b) **offline outbox** (reuse E4 ADR-0018) | **(a)** (65% — genuinely close, routed to `/speckit-clarify` like E4's Q8). A scenario is a **desk activity** (analyzing/comparing strategy), not the fair-booth quoting that justified E4's outbox — so online-only is the consistent, cheaper default. But E4 **flipped** the analogous question, so this is explicitly an owner/clarify call, not a settled fact. The offline **read** cache is reused either way. |
| **Q5** | **Record a snapshot FROM a scenario** (the E4 bridge, US7) | (a) **Yes** — reuse the E4 record path with the scenario as a new provenance source · (b) **No** — out of E5 | **(a)** (80%). A scenario is live; freezing its current computation is exactly E4 US1. Cheap, coherent, and it makes the live→frozen relationship concrete. It is P3/droppable if the epic runs long. |
| **Q6** | **Scenario metadata** — what does a scenario carry besides the config? | (a) **name only** (required) · (b) name + optional **free-text note** · (c) name + note + tags/labels | **(b)** (70%). A name is the identity for duplicate-to-tweak; one optional note ("comparação pré-Black Friday") is cheap and useful. Tags (c) grow the surface — defer unless the owner wants them. |
| **Q7** | **Does saving a scenario materialize anything** (à la E3 K3)? | (a) **No** — a scenario references or holds ad-hoc, materializes nothing · (b) yes, materialize the ad-hoc basis into the catalog (mirror K3) | **(a) No** (85%). A scenario is an **analysis**, not a catalog asset; materializing would pollute the catalog with strategy variants and violate the "scenario models the strategy, not the thing" line. Also protects SC-606. Promoting an ad-hoc basis to a Product stays a separate explicit action. |
| **Q8** | **Does export apply to a (live) scenario, or only to a (frozen) snapshot?** | (a) **Only snapshots** — to export a scenario's numbers, record a snapshot from it (US7) then use the E4 export · (b) **Yes**, a live scenario comparison export (PDF/CSV) directly | **(a)** (70%). Keeps E4's clean coupling "export = a frozen artifact" and avoids a **stale-vs-live honesty risk** (a live comparison exported to a file becomes stale the moment a fee changes). The natural path is scenario → record snapshot → export the snapshot. |
| **Q9** | **Lapse read/write line for a scenario** — does opening + recomputing a saved scenario survive a lapse? | (a) **Yes** — open + recompute is a **read** (like opening a saved product on lapse in E2); only save/duplicate/rename/delete are writes and are denied · (b) **No** — any scenario access requires active premium | **(a)** (80%). Recompute is a client-side compute over saved config the lapsed seller legitimately holds; denying them a *view* of their own saved strategy is hostile and inconsistent with the E2/E3/E4 read-only freeze. Writes stay gated. (Mirror of E4 Q6, but note E4 **overrode** its PO rec for export specifically because export was E4's headline premium value — here the headline is *save/duplicate*, which stays gated regardless, so the read-survives rule is cleaner.) |
| **Q10** | **Free ephemeral scenario as a conversion device** — may a free user keep the comparison they just built (without a real save)? | (a) **No** — saving is Premium, full stop (current `business-rules.md`) · (b) **Yes**, limited (e.g. one un-named local draft, nothing server-side) | **(a) Keep it Premium** (85%). It is the standing R3 rule and I will not weaken the split. Flagged honestly: a free user who just built a three-channel comparison and loses it on reload is a **real upgrade moment** — but changing it = a dated business-rules amendment, exactly like E3's Q3, not mine to make. |
| **Q11** | **IA placement of the scenarios surface** — where does the fourth object live? | (a) **Inside Calcular** (a "salvar / carregar cenário" affordance in the multi-channel calculator + a scenarios list) · (b) a **new "Cenários" tab** (a 6th bottom tab — nav is already Calcular · Catálogo · Histórico · Conta + Kits) · (c) under **Catálogo** | **(a)** (65%). A scenario **is** the saved calculator, so it belongs where the seller builds it; a 6th mobile tab is crowded. **Flag:** final IA/flow is `designer-ux`'s domain (ux-decisions UX1) — I state the behavioral requirement (save/load/list must be reachable from the multi-channel calculator) and route the placement to the designer + owner. |

---

## 11. Dependencies

- **E1 (004/005)**: the **live multi-channel compute** + the **fee catalog** (ADR-0010, served + cached + seeded) +
  the **`pricing-core` 3.0.0 result contract** (`resolvedFee` + `catalogVersion` already frozen per ADR-0011 Part
  4) — E5 **persists** this exact compute; it is the direct extension of 005. The 005 fee seals
  (`referência do catálogo` / `embutida` / `pode estar desatualizada` / `ajustado por você` / `estimativa`) carry
  into a saved scenario unchanged.
- **E2 (007)**: entitlement gate (ADR-0012), per-account isolation, offline read cache + purge-on-signout,
  `ENTITLEMENT_REQUIRED` vocabulary, lapse read-only freeze — all reused verbatim. The **Product** entity is a
  cost-basis reference candidate (Q2).
- **E3 (008)**: the **Kit** entity is a cost-basis reference candidate (Q2); the **D3 live-reflect / D6 last-known**
  degradation semantics (ADR-0017 §6) are reused for a scenario's referenced basis; ADR-0015's "client
  feature-guard over a client-side compute, server-authoritative persistence" is the enforcement precedent (§4).
- **E4 (009)**: the **Snapshot** object is the target of the US7 record-from-scenario bridge (Q5); **ADR-0018**
  (offline outbox) is the candidate for scenario writes (Q4); the E4 spec §OUT ("*a reusable, re-runnable scenario
  object is E5*") and E4 Q11 (quote status → "E5+") are the roadmap hand-offs this brief picks up.
- **005 §4 deferrals**: this brief takes up the **first** ("Saved marketplace scenarios") and **recommends deferring
  the second** ("Live, per-seller-account marketplace APIs") to its own increment (Q1).
- **Nav/IA**: the multi-channel calculator lives in **Calcular** (ux-decisions UX1); where the scenarios surface
  lands is Q11 / `designer-ux`.
