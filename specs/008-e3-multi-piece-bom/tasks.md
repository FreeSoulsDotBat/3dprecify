# Tasks: E3 — Multi-piece BOM (montagem multi-peça)

**Input**: Design documents from `specs/008-e3-multi-piece-bom/` (spec.md · plan.md · research.md ·
data-model.md · contracts/{api-surface,pricing-core-bom}.md · quickstart.md) + ADR-0015 (enforcement) +
ADR-0016 (pricing-core 3.1.0) + ADR-0013 (persistence pattern, extended by migration `0002`).

**Prerequisites**: plan.md ✅ (Constitution Check 8/8) · owner decisions Q1/Q2/Q3 + D-A/D-B/D-B.1/D-C recorded
(spec Clarifications + ADR-0015/0016). Docker required for DB-backed dev/tests (visible skip without it,
ADR-0013). E2 (007) shipped to `develop` (catalog + entitlement + migration `0001`) — reused, not rebuilt.

**Tests**: MANDATORY per Constitution III — every story starts with tests observed FAILING. The `computeBom`
numeric suite (SC-402 byte-identity, FR-412 no-double-rounding, per-slot isolation) precedes the engine; the
US2 gate/round-trip/isolation/lapse pytest precede the router; the US5 teaser tests precede the teaser. **SC-409
in every PR**: the E1 single-piece calculator + E2 catalog/entitlement e2e guards pass UNCHANGED.

**Organization**: by user story, grouped into the plan's **3-PR delivery** (research R6). Every push/merge is
**OWNER-GATED** (ADR-0006). After each PR lands on `develop`, the knowledge graph refreshes (ADR-0014).

**Q2 reconciliation (explicit):** the owner chose *both* line sources from the first increment. So **composing**
a catalog-referenced line (resolve a live E2 product → `PriceInput` for `computeBom`) lands in **PR-A** (US1).
What PR-C (US3) adds is the **persisted-reference degradation lifecycle** (D3 live-reflect + D6 last-known on
product delete), which requires the `boms`/`bom_lines` persistence delivered in PR-B.

**K-amendment (2026-07-11 — spec K1–K4, research R8, ADR-0017 Proposed):** user-facing name is **Kits**.
**K1 (rename + route `/kits` + 5th nav tab + icon) folds into the unpushed PR-A** (T008b/T008c below).
**K2–K4 (catalog Kits tab + atomic save-time materialization of ad-hoc pieces as manual products with name
dedup + attention indicator) land in PR-B** (T010/T012/T015 amended; T015c/T015d added; US6). "BOM" stays the
internal/technical term (code modules, tables, wire routes).

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — Free-standing premium compute: composer + `computeBom` + honest guard ══

## Phase 1: Setup

- [X] T001 [P] designer-ux → Claude Design handoff (NON-BLOCKING, parallel with all PR-A work): BOM composer
      (line list; add ad-hoc line; add catalog-ref line; quantity; per-line breakdown; assembly total; **per-
      channel rollup**; empty/loading/degraded states) + the US5 teaser. Output feeds T005/T008; not a merge
      blocker.

## Phase 2: Foundational (blocking) — canonical assembly engine (ADR-0016)

- [X] T002 Write FAILING vitest first — `packages/pricing-core/src/*.test.ts`: `computeBom` numeric suite —
      **SC-402** (single line ×1 total byte-identical to `computeCalculator`), **FR-412** (aggregate =
      `sumMoney(perLine×qty)`, anchored fixtures, no double-rounding), qty×line via `Decimal`, `quantity: 0`
      contributes zero (honest empty), **per-channel rollup** grouping by `marketplace`, **per-slot isolation**
      (a `ChannelResult` in `error` contributes zero + increments `skippedLines`, never throws/NaNs a sibling),
      `modelVersion === "3.1.0"`, and the version↔major gate-test updated. Observe failing.
- [X] T003 Implement `computeBom` + types (`BomLineInput`/`BomLineResult`/`BomChannelRollup`/`BomResult`) in
      `packages/pricing-core/src/index.ts` composing `computeCalculator` per line; **export** `toMoney`/
      `sumMoney`/`Decimal` from the entry (the MINOR public surface); bump `PRICING_MODEL_VERSION → "3.1.0"`.
      Contract: `contracts/pricing-core-bom.md`. Tests green.

**Checkpoint**: the canonical assembly engine exists, tested — US1/US2/US3 recompute through it.

## Phase 3: US1 — compose and price a multi-piece order (Premium) (P1) [FOUNDATIONAL STORY]

**Goal**: a premium user composes ad-hoc + catalog-ref lines with quantities and sees a transparent combined
breakdown + per-channel rollup, free-standing (no save). **Independent Test**: quickstart §2.

- [X] T004 [US1] Write FAILING tests first — `apps/web/src/features/bom/*`: the line→`PriceInput` adapter
      (ad-hoc inputs vs resolve a live E2 product via `entities/catalog`) + composer component (add lines,
      quantity, live per-line + assembly + per-channel rollup, remove-line updates) + e2e (premium composes a
      3-line BOM incl. a catalog-ref line). Observe failing.
- [X] T005 [US1] Implement `apps/web/src/features/bom/` composer + `bom-compute.ts` adapter (resolve line →
      `PriceInput`, call `computeBom`). **FSD-Lite**: `feature/bom` MUST NOT import `feature/calculator`
      internals or `pages` — share via `pricing-core` + `entities/catalog` (eslint-boundaries + depcruise
      clean). Tests green.
- [X] T006 [US1] Server-informed route-guard + BOM route in `apps/web/src/pages/bom/` and `app/router.tsx`:
      gate feature access on `GET /api/v1/entitlement` (`status === active`) — free/lapsed/signed-out → teaser
      (US5), NEVER a local flag (ADR-0015). Guarded like the E2 product routes.
- [X] T006b [US1] Visual test: qa-produto homologates the composer at 390px + desktop (compose, per-channel
      rollup, remove-line, guard→teaser boundary). PASS-with-nits — `homologation-t006b.md` + `evidence/t006b/`.

## Phase 4: US5 — honest Premium teaser for the BOM feature (P2)

**Goal**: free/signed-out sees an honest teaser; the free single-piece calculator is untouched.
**Independent Test**: quickstart §2 (teaser half).

- [X] T007 [US5] Write FAILING tests first — teaser component (crown, no price/date, no pre-E6 purchase CTA;
      signed-out adds Entrar → `/sign-in?redirect=/bom`) + e2e (signed-out/free at `/bom` sees teaser; the
      single-piece calculator stays fully usable, SC-408/SC-409). Observe failing.
- [X] T008 [US5] Implement the BOM teaser (reuse the E2 `premium-teaser` pattern) wired into the T006 guard.
      Tests green.

## Phase 4b: K1 — Kits vocabulary + /kits route + 5th nav tab (folds into PR-A; R8 D-K1)

- [ ] T008b [K1] Write FAILING tests first — router guards (`/kits` matches; anonymous never bounced),
      app-nav (5 tabs, "Kits" entry, roving tabindex over 5), bom-page/teaser copy tests updated to the Kit
      vocabulary ("Monte seus kits" + approved subtitle), e2e `bom.spec.ts` → `/kits` + a11y-overflow 5-tab
      390px. Observe failing.
- [ ] T008c [K1] Implement: route path `/kits` (module stays `pages/bom/`); 5th `NAV_ITEMS` entry "Kits"
      (`boxes` glyph inlined in `shared/ui/icon.tsx` from lucide-static; nav grid CSS 4→5); i18n `bom.*`
      reworded to Kit vocabulary (title "Monte seus kits"; subtitle "Aqui você pode montar Kits para anúncios
      únicos de acordo com seus produtos cadastrados ou peças avulsas"; teaser/empty follow; `nav.kits`);
      sign-in redirect target becomes `/kits`. Tests green; `pnpm gate:all` + `pnpm e2e` re-run.

## PR-A ship (STRICTLY ORDERED)

- [ ] T009 [US1][US5][K1] **OWNER-GATED** PR-A: `pnpm gate:all` + `pnpm e2e` (SC-402/FR-412/SC-408/SC-410
      nav-half/**SC-409**: E1 + E2 guards unchanged) → push `feature/008-e3-multi-piece-bom` → PR to `develop`
      (evidence-rich: T006b homologation + nit fixes + K1 rename) → CI green (incl. contract drift-guard) →
      owner squash-merge. Owner walk covers the Kit vocabulary + 5-tab nav. Graph refresh on merge (ADR-0014).
      **Checkpoint: a premium user composes + prices a kit at /kits from the nav; everyone else sees an honest
      teaser.**

---

## ══ PR-B — Persistence: save + manage, server-gated (MVP durable value) ══

## Phase 5: US2 — save a BOM (Premium, server-gated persistence) (P1)

**Goal**: premium save/list/reload, per-account, no stored price. **Independent Test**: quickstart §3–§4.

- [ ] T010 [US2][US6] Write FAILING pytest first — `backend/tests/test_boms.py`: entitlement gate (free/none
      write `403 ENTITLEMENT_REQUIRED`; signed-out `401`; faked client premium denied; nothing persisted on
      deny); CRUD round-trip (create→reload identical on a fresh `TestClient`, decimal-string money, **no
      price stored**); per-field validation (rejected NEVER stored); per-account isolation (account B →
      `404`, no existence oracle, SC-308/406); ad-hoc line without `pieceName` → `422`. **Materialization
      suite (K3/K4, ADR-0017)**: atomic (a failing line materializes NOTHING); ad-hoc line → manual product
      created (refs NULL + snapshot, `action: "created"`), line born WITH `product_id`; name dedup (`btrim`
      exact, live rows only; soft-deleted never matches) → `action: "referenced"`, values superseded; denied
      save (free) materializes nothing (SC-411); public `POST /products` still requires refs (FR-310
      untouched). Observe failing.
- [ ] T011 [US2] Alembic **migration `0002`** (`down_revision = "0001"` — never amend `0001`) + SQLAlchemy 2.0
      models `Bom`/`BomLine` per `data-model.md` (typed link-or-snapshot columns, value CHECKs, `boms`/`bom_
      lines` indices, FK `bom_id` ON DELETE CASCADE, FK `product_id` ON DELETE SET NULL). `uv run alembic
      upgrade head` green against the compose DB.
- [ ] T012 [US2][US6] Implement CRUD router `backend/app/api/boms.py` behind `require_entitlement` (writes) /
      `require_catalog_read` (reads) per `contracts/api-surface.md`; pydantic wire schemas (camelCase, money-
      as-string; **reuse** `PieceInputs`/`ChannelSlot`/`OtherCost` from `products.py`; `BomLineIn.pieceName` +
      ProductIn value-set); **`_materialize` step INSIDE the same transaction** (ADR-0017: dedup → insert
      manual products → kit + lines, one commit; `BomOut.materializations[]` on writes; FR-310 relaxation
      lives ONLY here); `_apply` re-snapshot + `_to_out` live/last-known resolution + `_unresolvable` `422`
      (no oracle). Extend `[tool.importlinter]` layering (`app.api → app.entitlement → app.db`). Tests green.
- [ ] T013 [US2] Contract ripple (same commit): regen `contracts/openapi.json` + Orval client (RAW output —
      `.prettierignore` exempt); drift-guard `git diff --exit-code` green. No new `ErrorCode`
      (`ENTITLEMENT_REQUIRED` + `VALIDATION_ERROR` already exist).
- [ ] T014 [US2] Web `apps/web/src/entities/bom/`: uid-keyed offline read cache + `useBoms`/`useCreateBom`/
      `useUpdateBom`/`useDeleteBom` hooks mirroring `entities/catalog`; purge-on-signout; "boms" added to the
      cache resource sweep.
- [ ] T015 [US2][US6] Web kit save UI: kit name + a name `Field` PER AD-HOC PIECE (pre-filled "Peça {n} ·
      {kit name}", K4) → Save → real-2xx toast; the response's `materializations[]` is surfaced honestly
      ("criado no catálogo" vs "já existia — referenciado", values-superseded warning on reference) → lands
      on the kit list. Failing-first component test (save round-trip + materialization messaging) then green.
- [ ] T015b [US2] Visual test: qa-produto homologates save → reload round-trip (recomputes via `computeBom`,
      no stored price).
- [ ] T015c [US6/K2] Catalog **Kits tab**: failing-first component test (4th tab lists saved kits,
      per-account, empty state) → implement in `features/catalog` reading the `entities/bom` cache/hooks.
      Tests green.
- [ ] T015d [US6/K3] Manual-product **attention indicator** (unified with the degraded state): failing-first
      tests (Produtos list + product page show the calm indicator when `filamentId`/`printerId` is null;
      linking both clears it, SC-412) → implement. Tests green.

## Phase 6: US4 — manage saved BOMs + honest lapse policy (P2)

**Goal**: list/rename/edit/duplicate/delete, per-account; lapse = read-only freeze, nothing deleted.
**Independent Test**: quickstart §6.

- [ ] T016 [US4] Write FAILING pytest first — manage (list/edit/delete/duplicate) per-account isolated; **lapse**
      (revoked/expired: reads `200`, writes `403`, **zero rows deleted**, SC-407); re-grant → writable, data
      intact. Observe failing.
- [ ] T017 [US4] Implement manage behaviors (edit/delete/duplicate; voluntary soft-delete only) + web manage
      UI (list/rename/delete, lapse read-only state). Tests green.
- [ ] T017b [US4] Visual test: qa-produto homologates the manage screen + the lapse read-only state.

## PR-B ship (STRICTLY ORDERED)

- [ ] T018 [US2][US4][US6] **OWNER-GATED** PR-B: `pnpm gate:all` + `pnpm e2e` (gate/isolation/lapse +
      materialization SC-411/412 + **SC-409**) → PR to `develop` → CI green → owner squash-merge. **Owner
      accepts ADR-0017 at this gate** (incl. the flagged dedup case-rule, exact vs case-insensitive, ~75%).
      Graph refresh on merge.
      **Checkpoint: premium sellers save, reload, and manage kits; saved kits + materialized products appear
      in the catalog; the gate is server-authoritative.**

---

## ══ PR-C — Catalog-referenced lines: degradation lifecycle (US3) ══

## Phase 7: US3 — live reference + last-known degradation (P2)

**Goal**: a saved BOM line referencing a product reflects live edits (D3) and degrades to editable last-known
values when the product is deleted (D6). **Independent Test**: quickstart §5.

- [ ] T019 [US3] Write FAILING pytest first (`backend/tests/test_boms.py` additions): **D3** live-reflect (edit
      product → saved BOM reload recomputes with new values); **D6** degradation (delete referenced product →
      `bom_lines.product_id` set NULL AND last-known captured in the SAME txn → degraded reopen editable, still
      priceable, SC-405); `422` no-oracle for an unresolvable/cross-account `productId`. Observe failing.
- [ ] T020 [US3] Implement D6 delete-capture: the product DELETE path updates referencing `bom_lines` (set
      `product_id` NULL + persist last-known snapshot columns) in the SAME txn — mirror the E2 filament/printer
      D6 delete pattern; `_to_out` sets `degraded: true`. Tests green.
- [ ] T021 [US3] Web: catalog-ref degraded line UI (— Manual — indicator, editable last-known values, calm
      info alert), mirroring the E2 product degradation surface; failing-first component test then green.
- [ ] T021b [US3] Visual test: qa-produto homologates a degraded reopen (delete a referenced product → BOM
      still priceable with last-known, honest indicator).

## PR-C ship (STRICTLY ORDERED)

- [ ] T022 [US3] **OWNER-GATED** PR-C: `pnpm gate:all` + `pnpm e2e` (D3/D6/SC-405 + **SC-409**) → PR to
      `develop` → CI green → owner squash-merge. **E3 closes.** Graph refresh on merge.

---

## Phase 8: Polish & cross-cutting

- [ ] T023 [P] `specs/008-e3-multi-piece-bom/dod-evidence.md` — SC-401..409 map + gate/e2e results; PR-A/B/C
      homologation records (owner + qa-produto).
- [ ] T024 [P] Docs: roadmap E3 row (`docs/product/business-rules.md`) → BUILT/SHIPPED with the **Kits**
      user-facing name; ADR-0015/0016 stay Accepted; **ADR-0017 Proposed → Accepted at the PR-B gate**;
      CLAUDE.md ground line → E3 shipped (after PR-C merges).
- [ ] T025 Run `quickstart.md` §1..§7 end-to-end as the final validation before E3 close-out.

---

## Dependencies

- **Phase 1 ∥**; **Phase 2 (T002→T003) blocks all stories** (shared engine). Test-first pair T002→T003.
- **PR-A**: T004→T005 (test-first); T006 after T005 (guard wraps the composer); T006 needs `GET /entitlement`
  (already shipped, E2 T014); T007→T008 (test-first); T008b→T008c (K1 test-first, after T008); T009 after
  T003/T005/T006/T008/T008c.
- **PR-B needs PR-A merged** (composer exists to save from). Inside: T010→T011→T012 (test-first → migration →
  router incl. `_materialize`); T013 after T012 (contract ripple); T014 ∥ backend (different surface); T015
  after T012+T014; T015c after T014 (kits list reads the cache); T015d ∥ (products surface); T016→T017
  (test-first) after T012.
- **PR-C needs PR-B** (persistence + `product_id` FK exist to degrade). T019→T020→T021 (test-first → D6
  capture → degraded UI).
- Test-first pairs throughout: T002→T003, T004→T005, T007→T008, T010→…→T012, T016→T017, T019→T020.

## Parallel opportunities

- T001 (design handoff) runs alongside ALL of PR-A.
- Within PR-B: T014 (web cache/hooks) ∥ T010–T012 (backend CRUD) — disjoint surfaces.
- T023/T024 (docs) [P] at close-out.

## Implementation Strategy — honest MVP note

**PR-A alone is already user-visible value**: a premium seller composes and prices a real multi-piece order
(ad-hoc + catalog-ref lines, per-channel rollup) — the first paywalled compute, behind an honest guard/teaser.
**PR-B** makes it durable (save/manage, server-gated). **PR-C** completes the catalog-reference lifecycle
(live-reflect + graceful degradation). Each PR ships only with full `gate:all` + e2e + **SC-409 untouched** +
owner authorization; UI stories carry qa-produto visual homologation plus the owner's own premium walk.

## Notes

- Money stays **decimal strings** on the wire, camelCase; `pricing-core` is the ONLY money-arithmetic home
  (ADR-0016) — the feature layer never sums money.
- `generated.ts` stays RAW Orval output (prettier/eslint-exempt); the drift-guard compares raw.
- Enforcement is honest (ADR-0015): the offline compute is a soft boundary (server-informed route-guard); the
  hard boundary is persistence (`require_entitlement`). No affordance implies the compute is server-enforced.
- Commit after each task or logical group; verify tests fail before implementing; stop at each checkpoint to
  validate the story independently.
