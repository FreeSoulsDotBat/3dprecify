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

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — Free-standing premium compute: composer + `computeBom` + honest guard ══

## Phase 1: Setup

- [ ] T001 [P] designer-ux → Claude Design handoff (NON-BLOCKING, parallel with all PR-A work): BOM composer
      (line list; add ad-hoc line; add catalog-ref line; quantity; per-line breakdown; assembly total; **per-
      channel rollup**; empty/loading/degraded states) + the US5 teaser. Output feeds T005/T008; not a merge
      blocker.

## Phase 2: Foundational (blocking) — canonical assembly engine (ADR-0016)

- [ ] T002 Write FAILING vitest first — `packages/pricing-core/src/*.test.ts`: `computeBom` numeric suite —
      **SC-402** (single line ×1 total byte-identical to `computeCalculator`), **FR-412** (aggregate =
      `sumMoney(perLine×qty)`, anchored fixtures, no double-rounding), qty×line via `Decimal`, `quantity: 0`
      contributes zero (honest empty), **per-channel rollup** grouping by `marketplace`, **per-slot isolation**
      (a `ChannelResult` in `error` contributes zero + increments `skippedLines`, never throws/NaNs a sibling),
      `modelVersion === "3.1.0"`, and the version↔major gate-test updated. Observe failing.
- [ ] T003 Implement `computeBom` + types (`BomLineInput`/`BomLineResult`/`BomChannelRollup`/`BomResult`) in
      `packages/pricing-core/src/index.ts` composing `computeCalculator` per line; **export** `toMoney`/
      `sumMoney`/`Decimal` from the entry (the MINOR public surface); bump `PRICING_MODEL_VERSION → "3.1.0"`.
      Contract: `contracts/pricing-core-bom.md`. Tests green.

**Checkpoint**: the canonical assembly engine exists, tested — US1/US2/US3 recompute through it.

## Phase 3: US1 — compose and price a multi-piece order (Premium) (P1) [FOUNDATIONAL STORY]

**Goal**: a premium user composes ad-hoc + catalog-ref lines with quantities and sees a transparent combined
breakdown + per-channel rollup, free-standing (no save). **Independent Test**: quickstart §2.

- [ ] T004 [US1] Write FAILING tests first — `apps/web/src/features/bom/*`: the line→`PriceInput` adapter
      (ad-hoc inputs vs resolve a live E2 product via `entities/catalog`) + composer component (add lines,
      quantity, live per-line + assembly + per-channel rollup, remove-line updates) + e2e (premium composes a
      3-line BOM incl. a catalog-ref line). Observe failing.
- [ ] T005 [US1] Implement `apps/web/src/features/bom/` composer + `bom-compute.ts` adapter (resolve line →
      `PriceInput`, call `computeBom`). **FSD-Lite**: `feature/bom` MUST NOT import `feature/calculator`
      internals or `pages` — share via `pricing-core` + `entities/catalog` (eslint-boundaries + depcruise
      clean). Tests green.
- [ ] T006 [US1] Server-informed route-guard + BOM route in `apps/web/src/pages/bom/` and `app/router.tsx`:
      gate feature access on `GET /api/v1/entitlement` (`status === active`) — free/lapsed/signed-out → teaser
      (US5), NEVER a local flag (ADR-0015). Guarded like the E2 product routes.
- [ ] T006b [US1] Visual test: qa-produto homologates the composer at 390px + desktop (compose, per-channel
      rollup, remove-line, guard→teaser boundary).

## Phase 4: US5 — honest Premium teaser for the BOM feature (P2)

**Goal**: free/signed-out sees an honest teaser; the free single-piece calculator is untouched.
**Independent Test**: quickstart §2 (teaser half).

- [ ] T007 [US5] Write FAILING tests first — teaser component (crown, no price/date, no pre-E6 purchase CTA;
      signed-out adds Entrar → `/sign-in?redirect=/bom`) + e2e (signed-out/free at `/bom` sees teaser; the
      single-piece calculator stays fully usable, SC-408/SC-409). Observe failing.
- [ ] T008 [US5] Implement the BOM teaser (reuse the E2 `premium-teaser` pattern) wired into the T006 guard.
      Tests green.

## PR-A ship (STRICTLY ORDERED)

- [ ] T009 [US1][US5] **OWNER-GATED** PR-A: `pnpm gate:all` + `pnpm e2e` (SC-402/FR-412/SC-408/**SC-409**:
      E1 + E2 guards unchanged) → push `feature/008-e3-multi-piece-bom` → PR to `develop` (evidence-rich) → CI
      green (incl. contract drift-guard) → owner squash-merge. Graph refresh on merge (ADR-0014).
      **Checkpoint: a premium user can compose + price a multi-piece BOM; everyone else sees an honest teaser.**

---

## ══ PR-B — Persistence: save + manage, server-gated (MVP durable value) ══

## Phase 5: US2 — save a BOM (Premium, server-gated persistence) (P1)

**Goal**: premium save/list/reload, per-account, no stored price. **Independent Test**: quickstart §3–§4.

- [ ] T010 [US2] Write FAILING pytest first — `backend/tests/test_boms.py`: entitlement gate (free/none write
      `403 ENTITLEMENT_REQUIRED`; signed-out `401`; faked client premium denied; nothing persisted on deny);
      CRUD round-trip (create→reload identical on a fresh `TestClient`, decimal-string money, **no price
      stored**); per-field validation (rejected NEVER stored); per-account isolation (account B → `404`, no
      existence oracle, SC-308/406); link-or-snapshot `422`. Observe failing.
- [ ] T011 [US2] Alembic **migration `0002`** (`down_revision = "0001"` — never amend `0001`) + SQLAlchemy 2.0
      models `Bom`/`BomLine` per `data-model.md` (typed link-or-snapshot columns, value CHECKs, `boms`/`bom_
      lines` indices, FK `bom_id` ON DELETE CASCADE, FK `product_id` ON DELETE SET NULL). `uv run alembic
      upgrade head` green against the compose DB.
- [ ] T012 [US2] Implement CRUD router `backend/app/api/boms.py` behind `require_entitlement` (writes) /
      `require_catalog_read` (reads) per `contracts/api-surface.md`; pydantic wire schemas (camelCase, money-
      as-string; **reuse** `PieceInputs`/`ChannelSlot`/`OtherCost` from `products.py`); `_apply` re-snapshot +
      `_to_out` live/last-known resolution + `_unresolvable` `422` (no oracle). Extend `[tool.importlinter]`
      layering (`app.api → app.entitlement → app.db`). Tests green.
- [ ] T013 [US2] Contract ripple (same commit): regen `contracts/openapi.json` + Orval client (RAW output —
      `.prettierignore` exempt); drift-guard `git diff --exit-code` green. No new `ErrorCode`
      (`ENTITLEMENT_REQUIRED` + `VALIDATION_ERROR` already exist).
- [ ] T014 [US2] Web `apps/web/src/entities/bom/`: uid-keyed offline read cache + `useBoms`/`useCreateBom`/
      `useUpdateBom`/`useDeleteBom` hooks mirroring `entities/catalog`; purge-on-signout; "boms" added to the
      cache resource sweep.
- [ ] T015 [US2] Web BOM save UI: name + Save → toast → lands on the BOM list; failing-first component test
      (save round-trip) then green.
- [ ] T015b [US2] Visual test: qa-produto homologates save → reload round-trip (recomputes via `computeBom`,
      no stored price).

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

- [ ] T018 [US2][US4] **OWNER-GATED** PR-B: `pnpm gate:all` + `pnpm e2e` (gate/isolation/lapse + **SC-409**) →
      PR to `develop` → CI green → owner squash-merge. Graph refresh on merge.
      **Checkpoint: premium sellers save, reload, and manage BOMs; the gate is server-authoritative.**

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
- [ ] T024 [P] Docs: roadmap E3 row (`docs/product/business-rules.md`) → BUILT/SHIPPED; ADR-0015/0016 stay
      Accepted; CLAUDE.md ground line → E3 shipped (after PR-C merges).
- [ ] T025 Run `quickstart.md` §1..§7 end-to-end as the final validation before E3 close-out.

---

## Dependencies

- **Phase 1 ∥**; **Phase 2 (T002→T003) blocks all stories** (shared engine). Test-first pair T002→T003.
- **PR-A**: T004→T005 (test-first); T006 after T005 (guard wraps the composer); T006 needs `GET /entitlement`
  (already shipped, E2 T014); T007→T008 (test-first); T009 after T003/T005/T006/T008.
- **PR-B needs PR-A merged** (composer exists to save from). Inside: T010→T011→T012 (test-first → migration →
  router); T013 after T012 (contract ripple); T014 ∥ backend (different surface); T015 after T012+T014;
  T016→T017 (test-first) after T012.
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
