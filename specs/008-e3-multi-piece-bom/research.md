# Phase 0 Research — E3 Multi-piece BOM

Consolidates the architecture decisions (arquiteto brief + owner decisions 2026-07-10). Every NEEDS
CLARIFICATION from the spec/plan is resolved here. Format: Decision · Rationale · Alternatives.

## R1 — Entitlement enforcement for a client-side premium compute (D-A → ADR-0015)

- **Decision**: Server-informed **client route-guard** for BOM feature access (gates on the authoritative
  `GET /api/v1/entitlement`, never a local flag) + **server-authoritative persistence** through the existing
  E2 seam (`require_entitlement` writes, `require_catalog_read` active|lapsed reads). The offline compute is
  **not** hard-paywalled; the design says so honestly.
- **Rationale**: Principle IV (NON-NEGOTIABLE) binds *protected operations* = every server effect = all BOM
  persistence, which is gated verbatim by the E2 seam. A purely offline computation has no server operation to
  gate; pretending otherwise would fork the canonical engine (ADR-0008 "backend never recomputes"). The banned
  anti-pattern is a client-flag-driven guard ("client never trusted for feature-gating").
- **Alternatives**: server-mediated compute (rejected — forks the formula, breaks offline, risks SC-402);
  pure client hybrid (folded into the chosen option).

## R2 — pricing-core contract for the assembly total (D-B → ADR-0016)

- **Decision**: A canonical `computeBom(lines: {input: PriceInput; quantity}[]): BomResult` in `pricing-core`,
  version **3.1.0** (MINOR, additive). Assembly headline totals `= sumMoney(perLineRounded × qty)`; the
  feature layer does **no** money arithmetic. `computeCalculator` is unchanged and reused per line.
- **Rationale**: keeps one canonical money truth (ADR-0008), unit-tests FR-402 byte-identity and FR-412
  no-double-rounding **in the core**, and cleanly splits "resolve line → PriceInput" (feature) from "compute +
  aggregate" (core). `toMoney/sumMoney/Decimal` already exist in `rounding.ts` (currently unexported) and
  encode the receipt-rounding property one level up.
- **Alternatives**: pure client orchestration (would duplicate money-math or export utils = still MINOR, and
  leaves FR-412 untested in core); hybrid sum-util (leaves per-channel rollup ambiguous).

## R3 — Per-channel marketplace rollup scope (D-B.1)

- **Decision**: **In scope for E3.** `BomResult.channels` groups by `marketplace` key and sums
  `precoAnuncio*/recebidoLiquido*/freightCost*` × qty across contributing lines, with **per-slot isolation** —
  a line whose channel slot is in `error` contributes zero to that marketplace's rollup and the rollup honestly
  surfaces that a line was skipped (never silent).
- **Rationale**: owner chose the richer assembly view. Because it is non-trivial (alignment + isolation) it
  MUST be canonical inside `computeBom` and covered by explicit numeric tests (extends SC-107 to the assembly).
- **Alternatives**: defer per-channel rollup, show only the direct price total (arquiteto's lean recommendation
  — not chosen).

## R4 — Persistence: migration lineage + schema shape (D-C → extends ADR-0013)

- **Decision (bound)**: A **new Alembic migration `0002`** (`down_revision = "0001"`) creating `boms` +
  `bom_lines`. Never amend the shipped `0001` (replay lineage — ADR-0013). Not an open decision.
- **Decision (owner sub-choice)**: BOM-line last-known snapshot = **typed NUMERIC columns**, mirroring the E2
  `products` link-or-snapshot pattern (DB-level `>= 0` / `<> 'NaN'` CHECKs), with `channels`/`other_costs` as
  JSONB exactly as `products` does today.
- **Rationale**: maximum consistency with the E2 pattern (`bom_line : product :: product : filament/printer`),
  reuses the domain types (`MONEY_SETTLED`, `MONEY_RATE`, `QTY_*`, `PERCENT`), and keeps invariants in the DB.
- **Alternatives**: a single `piece_snapshot` JSONB (leaner, ~25 fewer columns, but no DB-level NUMERIC CHECKs —
  not chosen).

## R5 — Reference + degradation semantics (from spec Q2, reused from E2)

- **Decision**: A `bom_lines.product_id` FK `ON DELETE SET NULL` + typed last-known snapshot columns + a
  link-or-snapshot CHECK — the exact E2 `products` degradation (D3/D6). Write logic mirrors `products._apply`:
  `product_id` present ⇒ re-snapshot from the live resolved product each write; NULL (degraded) ⇒ persist the
  editable overrides. A reference that does not resolve to an owned/live product ⇒ **422, no existence oracle**
  (reuse the E2 `_unresolvable` pattern, SC-308). Ad-hoc and referenced lines may coexist in one BOM.
- **Rationale**: reuse, don't reinvent — E2 already ships and homologated this machinery.

## R6 — Delivery shape (owner-gated PR slices, mirroring E2)

- **Decision**: Slice the epic into owner-gated PRs on `develop`, each failing-first and demoable where
  possible: **PR-A** the free-standing compute + composer behind the server-informed guard (US1 + US5 teaser +
  `computeBom` 3.1.0 + per-channel rollup); **PR-B** persistence (US2 + US4 — `boms`/`bom_lines` migration
  `0002`, CRUD behind the E2 gate, per-account isolation, lapse freeze); **PR-C** catalog-referenced lines +
  degradation (US3). Exact task breakdown is `/speckit-tasks`.
- **Rationale**: mirrors the E2 three-PR cadence that worked; keeps each PR reviewable and homologable.

## Resolved unknowns

| Unknown (spec/plan) | Resolution |
|---|---|
| BOM pricing model (Q1) | Independent per-piece sum (ADR-0016) |
| Line sources (Q2) | Both ad-hoc + catalog-ref, live + last-known (R5) |
| Free/premium boundary (Q3) | Whole feature Premium; enforcement per ADR-0015 |
| Principle IV vs offline compute | Server-informed guard + server-gated persistence (ADR-0015) |
| pricing-core contract + semver | `computeBom`, 3.1.0 MINOR (ADR-0016) |
| Per-channel rollup scope | In scope (R3) |
| Migration lineage | New `0002`, never amend `0001` (R4) |
| Snapshot shape | Typed columns mirroring `products` (R4) |

## R7 — C1: shared piece-form home (2026-07-11, arquiteto)

**Decision context (Principle VIII gate, pre-T005).** The BOM composer's expanded line must host the E1
calculator piece form *verbatim* (ux §1.3): `FieldGroup`/`SectionTitle`/`OtherCostsSection`/`MarketplaceSection`/
`PriceResults` (`calculator-form.tsx`), `CalcFormValues`/`calculatorResolver`/`defaultCalcValues` + field metas
(`calculator-schema.ts`), and `computeFromForm` (`calculator-model.ts`). All live in `features/calculator/` and
form a tight cluster (`calculator-form → calculator-model → fee-prefill/fee-seal → calculator-schema`).
eslint-boundaries + dependency-cruiser forbid **any** feature→feature import, so `features/bom` may reach none of
it (nor a new `features/piece-input/` — still feature→feature). Pages→feature IS allowed; `pages/catalogo/
produto-page.tsx` already composes these exact sections + schema + `computeFromForm` at the page layer (shipped,
owner-homologated, gates green).

| Option | Pros | Cons | Scalability | Conf. |
|---|---|---|---|---|
| **A — Page/widget-hosted composition** (produto-page precedent; `features/bom` owns only what it CAN — `bom-compute` + boundary-clean presentational shells) | zero moves of shipped E1/E2 code → SC-402/409 by construction; smallest reviewable diff for the owner-gated PR; exact shipped precedent; no FSD bending; piece form reused not duplicated (V); honors the plan's binding Structure Decision | the per-line section-threading editor lives at page/widget layer, not literally inside `features/bom` (a refinement of the plan *sketch*, not its Structure Decision) | high — shells + adapter stay reusable for PR-B/PR-C; a widget host keeps the page thin | **85%** |
| B — Relocate the form body to `entities/piece` | cleanest long-term direction if ≥4 surfaces consume it; lets `features/bom` literally own the composer | must move ~1000+ lines of SHIPPED code (form+model+schema+fee-seal+fee-prefill move as one cluster) inside an E3 PR → large SC-402/409 risk + heavy review; a multi-section RHF form + `computeFromForm` orchestration is feature-grade, so it bends FSD (entities = an entity's data/UI, not a form feature); splits calculator across two homes | high (eventually) but wrong time/cost | **45%** |
| C — Whole composer at page layer; `features/bom` = `bom-compute` only | simplest wiring | deviates most from the plan sketch; very large page file; rollup/summary/LineCard shells are NOT reusable for PR-B/PR-C (pages can't import pages) — dominated by A at no saving | medium (shell reuse lost) | **30%** |

**Decision: Option A (85%).** It is the exact shipped, owner-homologated produto-page idiom one level up; it
touches **no** shipped calculator code (SC-402/SC-409 hold by construction), yields the leanest owner-gated diff,
duplicates nothing (Principle V), and satisfies the plan's binding Structure Decision (`features/bom` never
imports `features/calculator` — it is the **page** that imports the calculator, which FSD permits). Option B is
recorded as the sanctioned **future** evolution *iff* a 4th consumer emerges (then a dedicated ADR + its own PR,
Principle VI) — not an E3 PR-A cost. This refines the plan's structure *sketch* ("composer in `features/bom`")
without contradicting its Structure Decision; plan.md/tasks.md are NOT edited (the refinement lives here).

**Wiring shape the implementer follows (T005/T006):**
- `features/bom/` (feature — imports only `pricing-core` + `entities` + `shared/ui`; NEVER `features/calculator`):
  - `bom-compute.ts` — thin wrapper `composeBom(lines: { input: PriceInput; quantity }[]): BomResult` over
    pricing-core `computeBom`. (The "live vs last-known" wire→`PriceInput` resolution named in the plan is a
    **PR-B/PR-C** concern over persisted `BomLineOut`; PR-A lines are all in-memory forms, so PR-A `bom-compute`
    is just the wrapper.)
  - Presentational shells: `BomLineCard` (collapsed summary row + chevron + qty stepper + remove, with a
    **`children` slot** for the expanded editor), `AssemblySummaryBar` (pinned total), `ChannelRollup` (renders
    one `BomChannelRollup`, honest `skippedLines`/`contributingLines===0` captions). These read `BomResult`/
    `BomLineResult` money and render via `shared/ui` `BreakdownRow`/`PriceHero` — they do **no** arithmetic (§0.2).
- **Piece-form editor = page-or-widget layer** (MAY import `features/calculator`). Recommend `widgets/bom-line-editor/`
  (canonical FSD home for a cross-feature composite; keeps the page thin; a page-local `pages/bom/` file is an
  acceptable lighter variant mirroring produto-page). It hosts ONE line's `useForm<CalcFormValues>` (+
  `useFieldArray` for channels/otherCosts) and mounts the calculator sections verbatim; the in-line "Usar produto
  salvo" picker prefills via **reuse** of `product-mapping.productToForm(product).values` (E2 mapping, not a
  fork) and shows the `seals.adjusted` provenance on edit.
- `pages/bom/bom-page.tsx` (page) — the T006 server-informed guard (`useEntitlement` → `active`, else teaser),
  owns `lines[]` + expand state, and orchestrates: renders each `BomLineCard` with the `bom-line-editor` in its
  slot; collects each line's built `PriceInput` + quantity → `features/bom` `composeBom` → `BomResult` → feeds
  `AssemblySummaryBar` + `ChannelRollup`.
- **Compute seam (no duplication).** `features/bom` cannot reach the `CalcFormValues → PriceInput` parse either
  (it lives in `calculator-model`/`calculator-schema`). So the calculator **exposes the per-line built
  `PriceInput`** — either an additive `input: PriceInput | null` on `CalcOutcome` or a small extracted
  `formToPriceInput` that `computeFromForm` delegates to. This is a pure, byte-identity-preserving change *inside*
  `features/calculator` (no boundary crossed; pinned by the T002 SC-402 fixtures + existing calculator tests).
  Each line editor calls `computeFromForm` once for its sections + per-unit `PriceResults`, and the page passes
  the same call's `PriceInput` to `composeBom`; because both derive from the identical `PriceInput`,
  `BomResult.lines[i].line` is byte-identical to the line's `computeFromForm` result (SC-402 anchor). Line-total
  rows read `BomLineResult` (per-unit × qty from the core), never re-multiplied in JSX (§1.6/§0.2).

## R8 — K-amendment structural decisions (2026-07-11, arquiteto)

**Decision context (Principle VIII gate, spec Clarifications 2026-07-11 K1–K4; PR-A code-complete/homologated,
NOT pushed).** Four structural questions the "Kits" rename + catalog-materialization amendment opens, decided
before PR-B code. **Premises verified in the code (they de-risk every decision below):**
- Routing is **code-based** (`app/router.tsx`, explicit `path: "/bom"`), NOT file-based ⇒ a URL rename is a
  one-line `path` edit; the page module may keep its `pages/bom/` name (BOM = technical term, K1).
- The `products` table CHECKs already **admit a manual row**: `ck_products_filament_link_or_snapshot` =
  `filament_id IS NOT NULL OR (filament_cost_per_roll IS NOT NULL AND filament_roll_weight_kg IS NOT NULL)`
  (printer mirror). A row with `filament_id=NULL`, `printer_id=NULL` + full resolved snapshot **passes** ⇒
  **migration 0002 needs ZERO `products` change** (degraded products already have this shape).
- `products.py::create_product` enforces `filamentId`/`printerId` required at create (FR-310) — this is the
  **public** path; the relaxation must live in a **separate kit-save service**, never here.
- **No unique index on `products(owner_uid, name)`** exists (migration 0001 indexes only owner/filament/printer
  ids) ⇒ E2 currently ALLOWS duplicate-named products; a new unique constraint would change shipped E2 create
  semantics and could fail on accounts that already hold dup names → **dedup stays a service concern**.

### D-K1 — Route naming + PR slicing

| Route option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — rename URL to `/kits`** (keep `pages/bom` code) | URL matches K1 user vocab (URLs are user-visible); one-line `path` edit; nothing deployed → no external URL to preserve | touches the built PR-A route + nav + a11y e2e | **82%** |
| B — keep `/bom` | zero PR-A change | user-visible URL leaks the banned "bom" term (contradicts K1); permanent UI(Kits)↔URL(bom) mismatch | 20% |
| C — both, `/bom`→`/kits` redirect | safety net | nothing is shipped/linked (unpushed) → the alias is speculative dead code (Principle V) | 25% |

| Slicing option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — fold K1 (Kits copy + 5th tab + icon + title/subtitle) into unpushed PR-A** | composer is only demoable via its nav tab → the tab belongs with it; the 5-tab a11y/390px e2e lands atomically with the tab it tests; unpushed → cheapest moment, one homologation of the coherent whole; no throwaway "/bom + BOM copy" interim | grows PR-A's reviewed diff; re-homologate the nav | **80%** |
| B — K1 as its own slice (PR-A′) | freezes PR-A's reviewed diff | PR-A alone ships a composer with banned "BOM/Montagem" copy and no reachable entry → incoherent interim that violates K1 on merge, then immediate rename = churn + two homologations | 35% |
| C — copy+icon in PR-A, 5th tab split out | isolates the IA/e2e risk | composer needs the tab to be reachable → split leaves it on a throwaway entry (dead code); dominated by A | 25% |

**Decision: `/kits` URL, keep `pages/bom`+`features/bom` code names (82%); fold K1 into the unpushed PR-A (80%).**
K2–K4 stay in PR-B per the amendment. Revised slicing: **PR-A** = US1+US5 composer/teaser **+ K1** (Kits vocab,
5th nav tab, icon, `/kits`, "Monte seus kits" title/subtitle); **PR-B** = US2+US4+US6 persistence **+ K2** (catalog
Kits tab) **+ K3/K4** (materialization); **PR-C** = US3 catalog-ref lines + degradation. Implementer: edit
`router.tsx` `path:"/bom"`→`"/kits"`; add `{ to:"/kits", label: messages.nav.kits, icon:"boxes" }` to `NAV_ITEMS`
(app-nav auto-roves on `NAV_ITEMS.length` — only the CSS grid + `app-nav.test.tsx`/390px e2e need the 4→5 update);
move `messages.bom.*` copy to the Kit vocabulary (title/subtitle/teaser/empty). "BOM" stays in code/tables/spec.

### D-K2 — Atomic kit-save + materialization architecture

**Decision (84%): one server transaction on POST/PUT `/api/v1/boms`, in a dedicated kit-save service** — for each
ad-hoc line: dedup-SELECT (owned+live+trim-exact name) → hit ⇒ reuse id (`referenced`); miss ⇒ build a `Product`
row (`filament_id=NULL`, `printer_id=NULL`, full snapshot from the line's value-set) + `session.add` (`created`);
then create the `Bom` + `bom_lines` linking the resolved product ids; **single `session.commit()`** ⇒ all-or-nothing
(FR-415; a denial/failure at `require_entitlement` or any validation persists nothing — SC-411). Intra-save
same-name ad-hoc lines dedup against an in-txn `{trimName→id}` map seeded from the SELECTs (zero dups within a save
too). *Alternatives:* client two-phase POST /products then POST /boms (rejected — not atomic → orphan products on
partial failure, and forces relaxing the PUBLIC FR-310); DB `ON CONFLICT` unique index (rejected — see premises).

**Consequence — the persistence model tightens (flag for data-model/contracts deltas the parent applies):** because
every ad-hoc line materializes/dedups to a product FIRST, **every persisted `bom_line` is born with a
`product_id`** (the `product : filament/printer` fractal one level up — products are likewise born ref-linked per
FR-310). The `bom_lines` snapshot columns + link-or-snapshot CHECK stay **unchanged**, but the snapshot-only branch
is now reachable ONLY via degradation (D6 `ON DELETE SET NULL`), never at create. Re-snapshot-on-write (R5) is
unchanged.

**Wire shape (camelCase, money = decimal strings):**
- `BomLineIn` gains, for the ad-hoc branch, the `ProductIn` value-set + a name: `pieceName` (required per ad-hoc
  line — client pre-fills `"Peça {n} · {kit name}"`), `pieceInputs`, `filamentValues`, `printerValues`,
  `tariffPerKwh`, `includeMarketplace`, `channels`, `otherCosts`. A `@model_validator` enforces **exactly one of**
  `{productId}` XOR `{ad-hoc value-set + pieceName}` (mirror `products._link_or_snapshot`; else 422, no oracle).
  Reuse the E2 `PieceInputs`/`FilamentValues`/`PrinterValues`/`ChannelSlot`/`OtherCost` pydantic models verbatim.
- `BomLineOut` stays **pure** (same for GET + write): `{ id, position, quantity, productId, degraded, pieceInputs,
  channels, otherCosts }`. The "created vs referenced" signal is a **write-only envelope** on the POST/PUT response:
  `BomOut.materializations: [{ position, productId, action: "created" | "referenced" }]` (absent/empty on GET). This
  keeps the durable resource shape clean and lets the client honestly message "peça vinculada a produto existente —
  valores do produto usados" (`referenced`, values superseded) vs "peça criada no catálogo" (`created`). *Alt:* a
  flat `materialization?` per line (rejected — pollutes the GET shape).

### D-K3 — WHERE the FR-310 relaxation lives + manual-product state (88%)

Relaxation lives ONLY in the kit-save service (it constructs `Product` rows directly, bypassing `create_product`);
the **public** POST /products keeps requiring refs (FR-310 untouched). No `products` migration (CHECKs already
admit the row — verified). **Attention indicator = DERIVED** (`filament_id IS NULL OR printer_id IS NULL`), **no new
column**. Decision: **UNIFY** born-manual and degraded-by-deletion into ONE honest state — the remedy is identical
("vincule um filamento e uma impressora salvos"), and distinguishing them would require the column K3 says to
avoid. This also surfaces the indicator on pre-existing E2 degraded products (an honest improvement, not a
regression — they genuinely need re-linking; consistent with E2's editable-last-known form).

### D-K4 — Name-dedup semantics (80%; case-rule 75%)

Per-account, **trim + EXACT (case-sensitive)** match on `btrim(name)` — consistent with E2 (`ProductIn` already
`.strip()`s; E2 has no case-folding anywhere), deterministic, and satisfies SC-411 because the pre-fill is
deterministic so re-saves recur byte-identically. *Alt considered:* case-insensitive (friendlier but a NEW semantic
E2 lacks, and could reference an unintended differently-cased product). **Live only** — the dedup SELECT filters
`deleted_at IS NULL` (mirror `_owned`/`_resolve_filament`); a name that matches ONLY a soft-deleted product →
materialize a NEW product (never reference a dead row, which would perpetually degrade). **Collision with different
values:** reference wins, typed values superseded — surfaced via `action:"referenced"` (never silent, spec edge).
**Race:** single-user account ⇒ SELECT-then-insert in the same txn is sufficient; **no unique index** (would regress
E2 dup-name allowance + risk a migration failing on existing dup rows). A hard DB dedup, if ever wanted, is a
separate E2-touching ADR.

### Minor

- **5th-tab icon:** recommend **`boxes`** (a kit = a bundle of multiple product-boxes; distinct from the single
  `package` used for Produtos) — inline the exact `lucide-static@0.487.0` markup into `icon.tsx` ICONS + drop
  `boxes.svg` into `public/brand/icons/lucide` for provenance parity:
  `boxes: `<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"></path><path d="m7 16.5-4.74-2.85"></path><path d="m7 16.5 5-3"></path><path d="M7 16.5v5.17"></path><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"></path><path d="m17 16.5-5-3"></path><path d="m17 16.5 4.74-2.85"></path><path d="M17 16.5v5.17"></path><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"></path><path d="M12 8 7.26 5.15"></path><path d="m12 8 4.74-2.85"></path><path d="M12 13.5V8"></path>``
  (cleaner-at-22px alt `layers`: `<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"></path><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"></path><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"></path>` — designer picks at homologation).
- **Migration 0002 table names:** keep **`boms` / `bom_lines`** (K1: BOM = technical term); create only those two
  tables, `down_revision="0001"`; NO `products` change. Confidence **92%**.

Full materialization architecture recorded in **ADR-0017** (Proposed — owner accepts at the PR-B gate).
