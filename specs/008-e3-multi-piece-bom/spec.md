# Feature Specification: E3 — Multi-piece BOM (montagem multi-peça)

**Feature Branch**: `feature/008-e3-multi-piece-bom`

**Created**: 2026-07-10

**Status**: Draft

**Input**: User description: "E3 — Multi-piece BOM (premium). Build on E2's catalog + persistence and the
existing single-piece calculator. Today the calculator prices ONE piece; there is no multi-piece compute. A
BOM/assembly is a job made of several pieces; each line is either a saved catalog product (E2) or ad-hoc piece
inputs, with a quantity. E3 adds (a) multi-piece composition and (b) a combined assembly price. Owner decided
(Principle VIII) the BOM pricing model, the free/premium boundary, and the first-increment line sources
(Clarifications, 2026-07-10)."

> **Why now.** E1 shipped the free single-piece calculator; E2 shipped the persisted catalog + the
> server-authoritative premium gate (Constitution IV). E3 is the first increment where a seller prices a **real
> order** — not one piece, but a basket: "3 of product A + 5 of product B + this one ad-hoc piece, what do I
> charge?" E3 composes the existing per-piece engine into an assembly. **Owner decision 2026-07-10: the whole
> BOM feature is Premium** — this is the product's **first paywalled compute**, a deliberate, dated exception
> to the standing "computation is free" rule (a business-rules amendment, recorded below). Purchase still
> arrives at E6; premium stays out-of-band (beta/comp) until then.

## Clarifications

### Session 2026-07-10 (owner decisions — Principle VIII)

- **Q1 — BOM pricing model (how N pieces combine): INDEPENDENT PER-PIECE SUM.** Each piece is priced in
  isolation by the existing engine and multiplied by its quantity; the assembly total is the sum of line
  totals. Shared-print-job cost modelling (one machine/energy/failure window for a plate) is **not** in E3 —
  it may be added later as an optional mode. Consequence: SC-402 byte-identity with the single-piece
  calculator is direct, and `pricing-core` is composed, not forked.
- **Q2 — First-increment line sources: BOTH ad-hoc piece inputs AND saved-catalog-product references, from
  the first increment.** A catalog-referenced line is **live** (product edits reflect on the BOM price) and
  **degrades to editable last-known values** if the product is deleted — mirroring the E2 product↔filament/
  printer reference + degradation semantics (D3/D6). A point-in-time snapshot was not chosen.
- **Q3 — Free/premium boundary: THE WHOLE BOM FEATURE IS PREMIUM** (compose, price, save, manage). This
  **deviates** from `business-rules.md` ("computation is free; persistence & scale are premium") and is
  recorded as a **dated amendment** to that source-of-truth: BOM is the first compute placed behind Premium.
  - **Enforcement nuance (Principle IV, routed to plan):** BOM pricing runs client-side/offline
    (`pricing-core`), so the compute itself cannot be *server*-enforced — only **persistence** is
    server-authoritative. Premium access to the BOM composer is therefore a **client route-guard** plus an
    honest teaser for free/signed-out users; all persistence stays behind the E2 server gate. The exact,
    honest mechanism (and how it satisfies Principle IV for a client-side computation) is an architecture
    decision for `/speckit-plan` (an ADR).

### Session 2026-07-11 (owner decisions — "Kits" rename + catalog materialization; PR-A code-complete)

Recorded after PR-A (US1+US5) was code-complete and visually homologated but BEFORE any push. These
amendments extend — never replace — the 2026-07-10 decisions above.

- **K1 — User-facing name is "Kits"; 5th nav tab APPROVED.** Every user-facing surface says **Kit/Kits**
  (never "BOM"/"Montagem"): the bottom-nav gains a 5th tab **"Kits"** (this closes the ux §0.4 owner flag and
  amends the fixed 4-tab IA), the page title is **"Monte seus kits"** and the subtitle is **"Aqui você pode
  montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas"**; teaser/empty
  states follow the Kit vocabulary. "BOM" remains only as the internal/technical term (code, tables, spec
  cross-references). Route naming is a plan-level decision.
- **K2 — Saved kits surface in the catalog: a 4th "Kits" tab in the catalog screen** (Filamentos ·
  Impressoras · Produtos · **Kits**), listing the account's saved kits. The nav "Kits" tab opens the composer.
- **K3 — Ad-hoc pieces MATERIALIZE as catalog products on kit save (automatic).** When a kit is saved, every
  ad-hoc line becomes a **manual product** in the catalog: it carries the line's own values, starts with NO
  filament/printer references, is **editable later** to link a saved filament and printer, and shows an
  **attention indicator** signalling it should be linked to a printer and filament (cleared once linked).
  This is a **dated relaxation of FR-310** (E2's "products reference saved items at create") scoped ONLY to
  this materialization path; direct product creation keeps requiring references.
- **K4 — Naming + dedup at save: name-per-piece, dedup by name.** The kit save flow asks a name for each
  ad-hoc piece (pre-filled "Peça {n} · {kit name}"); within the account, if a product with that name already
  exists the line **references the existing product** instead of creating a duplicate. After a successful
  save, every kit line therefore corresponds to a catalog product (pre-existing or materialized) and reflects
  it live (D3 semantics, uniform with catalog-referenced lines).
- Materialization happens **only after save** (the free-standing composer persists nothing — unchanged), so
  the whole K2–K4 behavior belongs to the persistence slice (PR-B scope).

### Session 2026-07-23 (013 audit remediation — D4, dated Clarification only, no code in this pass)

- **D4 — Empty BOM (zero lines, E3-04 edge case above): server REJECTS, does not permit.** As shipped,
  `BomIn.lines` (`backend/app/api/boms.py`) has **no** `min_length` guard — a zero-line kit is currently
  accepted, which the E3 audit (013) flagged as unintentional permissiveness never decided one way or the
  other. **Decision: option (a)** — the server SHOULD require `min_length=1`, mirroring what the composer UI
  already promises (a kit is, by definition, at least one piece). This Clarification records the decision;
  **the `min_length=1` change itself is tracked as separate implementation work** (audit remediation batch
  C-11, not this docs-only US7 pass) — until that lands, the edge case above ("Empty BOM (zero lines)... how
  is the total presented") is answered as *"currently accepted, honestly presented as an empty/zero total;
  will become a 422 once C-11 lands"*.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compose and price a multi-piece order (Premium) (Priority: P1) [FOUNDATIONAL]

A **premium** maker assembling a real order composes a **BOM**: several lines, each a piece with its own inputs
(ad-hoc) or a reference to a saved catalog product, plus a **quantity**. The app shows a transparent combined
breakdown — per-line cost/price and the assembly total — with the same honesty as the single-piece calculator.
The assembly total is the **sum of independent per-piece results × quantity** (Q1).

**Why this priority**: This is the new capability E3 exists to deliver; every other story (save, manage,
teaser) builds on the composer. It is demoable on its own for a premium account.

**Independent Test**: A premium account composes a 3-line BOM (e.g., 3×A, 5×B, 1 ad-hoc piece) and sees a
correct combined breakdown and total; removing a line updates the total live. A free/signed-out user sees the
honest teaser instead of the composer (US5), never a broken or fake screen.

**Acceptance Scenarios**:

1. **Given** a premium user, **When** they add multiple lines (ad-hoc and/or catalog-referenced) with
   quantities, **Then** the app shows a per-line and combined transparent breakdown and the assembly total as
   the sum of independent per-piece results × quantity.
2. **Given** a composed BOM, **When** a line's inputs or quantity change, **Then** the combined total
   recomputes live and transparently.
3. **Given** a single-line BOM with quantity 1, **When** priced, **Then** the result is **byte-identical** to
   the existing single-piece calculator for the same inputs (the engine is composed, not forked).
4. **Given** a free or signed-out user, **When** they reach the BOM feature, **Then** they see the honest
   Premium teaser (US5), not the composer, and nothing about the free single-piece calculator changes.

---

### User Story 2 - Save a BOM (Premium, server-gated persistence) (Priority: P1)

A premium seller names and saves a BOM to reuse it. Saving, listing, and reloading a BOM is authorized on the
**server** against the binary premium entitlement E2 introduced; a free or signed-out caller is denied with an
honest `ENTITLEMENT_REQUIRED` and nothing is written. A saved BOM reloads and recomputes with the current
formula (no stored price), exactly like E2 products.

**Why this priority**: Persistence is the durable Premium value and the surface where Constitution IV is
actually enforceable (server-side). It is the first thing to homologate after the composer.

**Independent Test**: With a premium account, save a composed BOM → it appears on a fresh session and reloads
identical (inputs reproduced, price recomputed live). With a free account, the save call is denied server-side
and nothing persists.

**Acceptance Scenarios**:

1. **Given** a premium account with a composed BOM, **When** they save it with a name, **Then** it persists
   and is visible/reloadable on a fresh session/device.
2. **Given** a free or signed-out caller, **When** a save/list/reload BOM operation is called, **Then** the
   server denies with `ENTITLEMENT_REQUIRED` and nothing is written or read.
3. **Given** a saved BOM, **When** reopened, **Then** its inputs and structure are reproduced and the price is
   **recomputed with the current formula** (no stored/frozen total), mirroring E2 product semantics.
4. **Given** a client faking local premium state, **When** it calls a BOM persistence operation, **Then** the
   server still denies — the client is never trusted for persistence.

---

### User Story 3 - Compose BOM lines from the saved catalog, with graceful degradation (Priority: P2)

A premium seller builds BOM lines by picking **saved products** (E2 catalog) with quantities, instead of
re-typing inputs. A referenced product stays **live** (edits reflect on the BOM's price on reopen); if a
referenced product is later deleted, the BOM line degrades to editable **last-known** values and stays
priceable — mirroring E2 D3/D6. (Ad-hoc and catalog-referenced lines may coexist in one BOM — Q2.)

**Why this priority**: The "stop re-typing / catalog-scale" value that makes BOMs efficient; it depends on the
composer (US1) and shares the reference/degradation machinery with E2, so it is P2.

**Independent Test**: Save a product, add it as a BOM line ×N → the total uses the product's live values; edit
the product → the BOM total reflects it on reopen; delete the product → the line shows editable last-known
values and a calm degraded state, never a crash or a silent wrong number.

**Acceptance Scenarios**:

1. **Given** saved products, **When** a premium user adds them as BOM lines with quantities, **Then** the
   assembly total is computed from each product's current values × quantity.
2. **Given** a BOM referencing product P, **When** P is edited, **Then** the BOM total reflects the edit on
   reopen (live reference, no stale snapshot).
3. **Given** a BOM referencing product P, **When** P is deleted, **Then** the BOM line degrades to editable
   last-known values with an honest degraded indicator, and the BOM stays priceable.

---

### User Story 4 - Manage saved BOMs, with an honest lapse policy (Priority: P2)

A premium seller lists, renames, edits, duplicates and deletes their saved BOMs — per-account, isolated from
every other account. On **lapse** (premium revoked/expired) saved BOMs stay **readable and re-pricable** but
**not writable** (read-only freeze), exactly like E2's catalog lapse policy; nothing is deleted on lapse.

**Why this priority**: Management makes persistence worth paying for at catalog scale, but it is only
meaningful once BOMs can be saved (US2), and the lapse rule must match E2 for a coherent product.

**Independent Test**: A premium account creates several BOMs, edits and deletes some; account B sees none of
A's. Revoke A's premium → A can still open and re-price existing BOMs but cannot create/edit; re-grant →
writable again with data intact.

**Acceptance Scenarios**:

1. **Given** several saved BOMs, **When** the owner lists/edits/deletes them, **Then** changes are per-account
   and isolated; account B sees zero of account A's BOMs.
2. **Given** a lapsed (revoked/expired) premium account, **When** it opens a saved BOM, **Then** it can read
   and re-price it but every write is denied; no BOM is deleted by the lapse.
3. **Given** a re-granted account, **When** it edits a previously frozen BOM, **Then** writes succeed and data
   is intact.

---

### User Story 5 - Honest Premium teaser for the BOM feature (Priority: P2)

Because the whole BOM feature is Premium (Q3), a free or signed-out user who reaches BOM sees an honest Premium
teaser — no fake success, no fabricated price/date, no purchase CTA before E6 — consistent with the E2 US7
teaser. The **free single-piece calculator is completely untouched**; the teaser gates only the BOM feature.

**Why this priority**: This is the honest face of the paywall for the first paywalled compute; it must ship
with US1 (a premium-only composer needs an honest door for everyone else), so it rises to P2.

**Independent Test**: Signed-out or free, navigate to BOM → an honest teaser appears (Premium framing, sign-in
path where relevant), nothing is persisted, and the free single-piece calculator remains fully usable and
free.

**Acceptance Scenarios**:

1. **Given** a signed-out or free user, **When** they open the BOM feature, **Then** an honest teaser is shown
   (no fake "salvo", no price/date, no pre-E6 purchase CTA) and the free calculator is untouched.

---

### User Story 6 - A saved kit lives in the catalog; ad-hoc pieces materialize as products (Priority: P2)

When a premium seller **saves** a kit (K1 naming), the kit itself becomes part of their catalog — visible in
a **Kits** tab beside Filamentos/Impressoras/Produtos (K2) — and every ad-hoc piece in it **materializes** as
a catalog **manual product** (K3): named by the seller at save time (pre-filled "Peça {n} · {kit name}"),
carrying the piece's values, with an **attention indicator** that it should be linked to a saved filament and
printer (editable later to add the links). If a product with the chosen name already exists, the line
references it instead of duplicating (K4). Composing free-standing still persists nothing.

**Why this priority**: This is the owner-directed bridge between kits and the E2 catalog — it turns one-off
piece entries into reusable catalog assets and makes the kit itself a first-class saved object. It depends on
kit save (US2), so it lands with the persistence slice.

**Independent Test**: Save a kit with one catalog-referenced line and two ad-hoc lines → the kit appears in
the catalog's Kits tab; the two ad-hoc pieces appear in Produtos as manual products with the attention
indicator; re-saving with the same piece names creates zero duplicates; linking a filament+printer to a
materialized product clears its indicator.

**Acceptance Scenarios**:

1. **Given** a premium user saves a kit, **When** the save succeeds, **Then** the kit appears in the
   catalog's Kits tab on a fresh session (per-account, like every catalog entity).
2. **Given** a kit with ad-hoc lines, **When** saving, **Then** the user names each ad-hoc piece (pre-filled
   "Peça {n} · {kit name}") and each becomes a manual product in Produtos — no filament/printer references,
   values preserved, attention indicator shown.
3. **Given** an ad-hoc piece whose chosen name matches an existing product of the account, **When** saving,
   **Then** no duplicate is created — the kit line references the existing product (live, D3).
4. **Given** a materialized manual product, **When** the user edits it and links a saved filament and
   printer, **Then** the attention indicator clears and it behaves as an ordinary product.
5. **Given** a free/signed-out/lapsed-write caller, **When** a save is denied (US2 rules), **Then** NOTHING
   materializes — no kit in the catalog, no products created.

---

### Edge Cases

- Empty BOM (zero lines) or a line with quantity 0 — how is the total presented (no crash, honest zero/empty)?
- A very large BOM (many lines / high quantities) — the breakdown stays readable and the total stays correct.
- A catalog-referenced line whose product is edited to a degraded/invalid state between compose and reopen.
- Mixed lines (ad-hoc + catalog-referenced) in one BOM (in scope per Q2).
- Rounding: the assembly total (sum of line totals) must not exhibit user-visible double-rounding versus the
  honestly-rounded line results (rounding policy is an ADR-0008 concern for the plan phase).
- Offline: a premium user opens a saved BOM offline — reads from cache and re-prices; writes are unavailable
  honestly (mirrors E2 offline read-cache).
- Client-side gate honesty: a determined user could invoke the offline engine directly — the product treats
  BOM as Premium via the client route-guard + server-gated persistence; the plan must state this honestly
  rather than imply the compute is server-enforced.
- Materialization edges (K3/K4): a piece name colliding with an existing product whose VALUES differ (the
  line references the existing product — the piece's typed values are superseded; the save flow must make
  this visible, never silent); a save that materializes products must be all-or-nothing with the kit save
  (no half-materialized catalog on failure); deleting a materialized product later follows the existing D6
  degradation; the 5-tab bottom nav must stay usable at 390px (no overflow, targets ≥ 44px).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-401**: The system MUST let a **premium** user compose a BOM of multiple lines, each with a quantity and
  a source (ad-hoc piece inputs or a saved-catalog-product reference), and see a transparent per-line and
  combined breakdown and total.
- **FR-402**: A single-line BOM (quantity 1) MUST price **byte-identically** to the existing single-piece
  calculator for the same inputs — E3 composes the existing engine, it does not fork a second one.
- **FR-403**: The assembly total MUST be the **sum of independent per-piece results × quantity** (Q1); no
  shared-print-job cost pooling in E3.
- **FR-404**: A BOM line MUST support **both** ad-hoc piece inputs **and** a reference to a saved catalog
  product (Q2). A catalog reference MUST be **live** and MUST degrade to editable **last-known** values if the
  product is deleted (mirroring E2 D3/D6); ad-hoc and referenced lines may coexist in one BOM.
- **FR-405**: Saving, listing, reloading, editing and deleting a BOM MUST be authorized on the **server**
  against the binary premium entitlement (reusing the E2 seam); a free/signed-out caller MUST be denied with
  `ENTITLEMENT_REQUIRED` and nothing persisted or read.
- **FR-406**: The **whole BOM feature is Premium** (Q3): free/signed-out users MUST NOT reach the composer and
  MUST see an honest teaser instead. Because BOM compute is client-side/offline, feature access is enforced by
  a **client route-guard** while all **persistence remains server-authoritative**; the plan MUST state this
  boundary honestly (Principle IV) and MUST NOT imply the client-side compute is server-enforced.
- **FR-407**: A saved BOM MUST reproduce its inputs/structure and **recompute** the price with the current
  formula on reload (no stored/frozen total), consistent with E2 product semantics.
- **FR-408**: Saved BOMs MUST be strictly per-account and isolated — zero cross-account read or write; another
  account's BOM MUST be indistinguishable from a non-existent one (no existence oracle).
- **FR-409**: On premium lapse (revoked/expired), saved BOMs MUST remain readable and re-pricable but **not
  writable**; no BOM is deleted by the lapse; re-grant restores writes with data intact.
- **FR-410**: Every free/signed-out affordance around BOM MUST be honest — no fake success, no fabricated
  price/date, no purchase CTA before E6 (E2 US7 teaser lineage).
- **FR-411**: All prior **E1 (free single-piece calculator)** and **E2 (catalog + entitlement)** guarantees
  MUST hold **unchanged** — E3 adds a new Premium feature without regressing the free/offline/signed-out
  calculator or the existing gate. The "computation is free" rule stays true for the single-piece calculator;
  only the new BOM feature is paywalled.
- **FR-412**: Monetary values in any BOM the system persists or transmits MUST preserve exact decimal
  semantics (no precision drift) consistent with the established money handling; the assembly total MUST NOT
  exhibit user-visible double-rounding versus its honestly-rounded lines.
- **FR-413** (K1, 2026-07-11): Every user-facing surface MUST use the **Kit/Kits** vocabulary (title "Monte
  seus kits"; subtitle "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos
  cadastrados ou peças avulsas"; teaser/empty/nav copy follow). The bottom nav MUST gain a 5th tab **"Kits"**
  opening the composer; the 390px layout MUST remain overflow-free with 5 tabs.
- **FR-414** (K2, 2026-07-11): The catalog screen MUST gain a **Kits** tab listing the account's saved kits
  (per-account, recomputed prices — never stored), beside Filamentos/Impressoras/Produtos.
- **FR-415** (K3, 2026-07-11): Saving a kit MUST automatically materialize each ad-hoc line as a catalog
  **manual product**: the line's values, no filament/printer references at creation (a dated, path-scoped
  relaxation of FR-310 — direct product creation keeps requiring references), an **attention indicator**
  until a saved filament AND printer are linked, and full editability to add those links later. A denied or
  failed save MUST materialize nothing (atomic with the kit save).
- **FR-416** (K4, 2026-07-11): The save flow MUST ask a name per ad-hoc piece (pre-filled "Peça {n} · {kit
  name}") and MUST dedup by name within the account: an existing product with that name is referenced (live,
  D3) instead of duplicated — and the flow MUST surface that a reference (not a creation) happened. After a
  successful save every kit line corresponds to a catalog product.

### Key Entities *(include if feature involves data)*

- **BOM (Assembly)**: a named, per-account collection of lines representing one order/job. Attributes: name,
  owner, its lines, timestamps, soft-delete. Holds **no stored price** (always recomputed). Premium to persist.
- **BOM Line**: one entry in a BOM: a **quantity** plus a **piece source** — either ad-hoc piece inputs (the
  same fields the single-piece calculator uses) or a reference to a saved catalog **Product**, with last-known
  values captured for graceful degradation when referenced (Q2).
- **Product / Filament / Printer (E2)**: existing catalog entities a BOM line may reference; reused, not
  redefined here.
- **Entitlement (E2)**: the existing server-authoritative premium check; reused verbatim to gate BOM
  persistence (and, together with a client route-guard, to gate BOM feature access).
- **Kit (user-facing name of a saved BOM, K1)**: a saved assembly, listed in the catalog's Kits tab (K2);
  internally the BOM entity above — one concept, two vocabularies (user vs technical).
- **Manual Product (K3)**: a product materialized from an ad-hoc kit piece — own values, no filament/printer
  references at creation, attention indicator until linked; otherwise an ordinary Product (D3/D6 apply).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-401**: A premium user can compose and price a multi-piece BOM and read a transparent combined
  breakdown; a free/signed-out user reaching BOM sees an honest teaser and **zero** data is persisted for them.
- **SC-402**: A single-line BOM (qty 1) yields a total **byte-identical** to the single-piece calculator for
  the same inputs, verified by an anchored equality check.
- **SC-403**: 100% of BOM persistence operations are authorized server-side; a free/signed-out write is denied
  and persists nothing (audited across the full operation set).
- **SC-404**: A saved BOM reloads on a fresh session/device with inputs/structure reproduced and price
  recomputed — no precision drift versus the composing session.
- **SC-405**: Editing a referenced catalog product changes the BOM's price on reopen; deleting it leaves the
  BOM priceable via last-known values (no crash, no silent wrong number).
- **SC-406**: Zero cross-account BOM reads or writes; another account's BOM is indistinguishable from
  non-existent.
- **SC-407**: On lapse, 100% of saved BOMs stay readable/re-pricable and 0% writable; re-grant restores writes
  with data intact.
- **SC-408**: Every free/signed-out BOM affordance is honest (no fake success, no price/date, no pre-E6
  purchase CTA), verified on the rendered UI; the free single-piece calculator remains fully free.
- **SC-409**: All E1 + E2 acceptance guarantees pass **unchanged** after E3 (no regression of the free
  calculator, free/offline/signed-out behavior, or the entitlement gate).
- **SC-410** (K1/K2): The "Kits" nav tab and the approved title/subtitle copy are live; a saved kit appears
  in the catalog's Kits tab on a fresh session; the 5-tab nav has no 390px overflow.
- **SC-411** (K3/K4): 100% of ad-hoc lines in a successfully saved kit end as catalog products (materialized
  or name-referenced), with ZERO duplicates across repeated saves using the same names; a denied/failed save
  materializes nothing.
- **SC-412** (K3): Every materialized manual product shows the attention indicator until a saved filament AND
  printer are linked; linking clears it and the product behaves as an ordinary product.

## Assumptions

- **First paywalled compute (dated deviation)**: Q3 places the whole BOM feature behind Premium, a deliberate
  exception to `business-rules.md` "computation is free". Recorded as a **dated amendment** to business-rules
  and honored here; the single-piece calculator stays free (FR-411).
- **Client-side compute, server-gated persistence**: BOM math is offline (`pricing-core`); premium feature
  access is a client route-guard, persistence is the server-authoritative boundary (Principle IV). The exact
  mechanism is a plan-phase ADR.
- **Entitlement is reused, not rebuilt**: E3 persistence rides on the E2 server-authoritative gate (ADR-0012).
- **No frozen prices**: like E2, saved BOMs store inputs/structure and always recompute — reproducible history
  with frozen snapshots is E4, out of scope here.
- **Exact R$ prices remain deferred** to E6; **first public deploy remains deferred** to v1 = E1–E6 (both
  revisitable owner decisions).
- **Pricing-core contract** (a BOM compose helper + semver, or pure client orchestration of the existing
  per-piece engine) is an **architecture decision for the plan phase** (ADR, extends ADR-0008/0011).
- **Multi-channel marketplace pricing** (E1/005) applies per line where relevant; the sum is over line totals
  (Q1 independent-sum), refined during planning.

## Dependencies

- **E2 (007)**: catalog (products/filaments/printers), persistence, and the entitlement gate — all reused.
- **E1 (004/005)**: the single-piece pricing engine (`pricing-core`) that E3 composes; SC-402 anchors on it.
- **business-rules.md amendment** (dated 2026-07-10): BOM is the first paywalled compute — must be recorded in
  the source-of-truth freemium section and the decision log before `/speckit-plan` closes.
