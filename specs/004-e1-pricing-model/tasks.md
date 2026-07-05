---
description: "Task list — E1 full corrected pricing calculator"
---

# Tasks: E1 — Full corrected pricing calculator

**Input**: Design documents from `specs/004-e1-pricing-model/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/pricing-core.md, quickstart.md (all committed)

**Tests**: MANDATORY per Constitution Principle III (Test-First). Every `pricing-core` behavior is a numeric case written and observed FAILING before implementation; UI stories get a QA visual homologation. SC-001..SC-012 are the acceptance anchors.

**Organization**: grouped by user story (spec.md). MVP = Setup + Foundational + US1 + US2 (the two P1 stories: a correct price and a transparent breakdown).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on an incomplete task)
- **[Story]**: US1..US6 (setup/foundational/polish carry no story label)
- All computation lives in `packages/pricing-core` (FR-036); the FE only parses/validates/formats. **No backend change.**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: prepare the `pricing-core` v2 package surface.

- [ ] T001 Bump `packages/pricing-core/package.json` version `0.0.0 → 2.0.0` (major, A25) and add `decimal.js-light` dependency (ADR-0008)
- [ ] T002 [P] Scaffold `packages/pricing-core/src/index.ts` type surface per `contracts/pricing-core.md` (`PriceInput`, `PriceResult`, `MarketplaceResult`, `ValidationError`, `PRICING_MODEL_VERSION`) — types + signatures only, bodies `throw new Error("not implemented")`
- [ ] T003 [P] Create `packages/pricing-core/src/rounding.ts` module stub (money quantize helper signature) per ADR-0008

**Checkpoint**: package builds/typechecks with stubbed bodies.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the money primitive, version stamp, and input validation that EVERY story's compute depends on.

**⚠️ CRITICAL**: no user story compute can begin until this phase is complete.

- [ ] T004 Write FAILING tests for the rounding policy (2dp `ROUND_HALF_UP`; sum-of-rounded-lines == rounded-aggregate; full-precision intermediates) in `packages/pricing-core/src/rounding.test.ts`
- [ ] T005 Implement `rounding.ts` with `decimal.js-light` (quantize to 2dp HALF_UP; `sumRounded` helper) — makes T004 pass (ADR-0008)
- [ ] T006 [P] Write FAILING test: `PRICING_MODEL_VERSION === "2.0.0"` AND it tracks `package.json` major, in `packages/pricing-core/src/version.test.ts`
- [ ] T007 [P] Implement `PRICING_MODEL_VERSION` constant + the version↔major gate — makes T006 pass
- [ ] T008 Write FAILING validation tests (SC-008): non-finite, `rollWeightKg ≤ 0`, `machineLifetimeHours ≤ 0`, `marketplaceCommissionPct ∉ [0,100)`, any negative → `ValidationError{field}`, in `packages/pricing-core/src/index.test.ts`
- [ ] T009 Implement input validation + optional-field default-0 normalization in `computeCalculator` skeleton (returns a typed shell; no line math yet) — makes T008 pass

**Checkpoint**: rounding + version + validation are green; the engine refuses bad numbers and defaults optionals.

---

## Phase 3: User Story 1 — Correct retail + wholesale price (Priority: P1) 🎯 MVP

**Goal**: from real inputs, produce one `custo_total` and both suggested prices via the full corrected cost pipeline.

**Independent Test**: enter the SC-001 vector → `custo_total` R$ 28,65, varejo R$ 42,98, atacado R$ 37,25; both prices always shown.

### Tests for User Story 1 (write FIRST, observe FAILING) ⚠️

- [ ] T010 [P] [US1] Canonical worked-example test (full SC-001 vector → exact material 11,00 / energy 0,50 / machine 10,00 / falha 2,15 / finishing 5,00 / custo_total 28,65 / varejo 42,98 / atacado 37,25) in `packages/pricing-core/src/index.test.ts`
- [ ] T011 [P] [US1] Test: both prices returned and `precoVarejo ≥ precoAtacado` when markupVarejo ≥ markupAtacado (SC-010 core); AND `printTimeHours = 0` → energy and machine lines = 0, coherent material-only `custoTotal`, no crash (spec Edge, analyze A2) — in `packages/pricing-core/src/index.test.ts`

### Implementation for User Story 1

- [ ] T012 [US1] Implement the production lines in `computeCalculator` (`packages/pricing-core/src/index.ts`): `material = (costPerRoll/(rollWeightKg*1000))*(printGrams+wasteGrams)`, `energy = printTimeHours*avgPowerKw*tariffPerKwh`, `machine = (machineValue/machineLifetimeHours + maintenanceReservePerHour)*printTimeHours` (ADR-0009 A) — FR-024/025/026
- [ ] T013 [US1] Implement `falha = (material+energy+machine)*failurePct/100`, `finishing = finishTimeHours*finishRatePerHour`, and `custoTotal` = sum of the (rounded) lines in `packages/pricing-core/src/index.ts` — FR-027/028/029
- [ ] T014 [US1] Implement `precoVarejo/precoAtacado = custoTotal*(1+markup/100)` over the rounded `custoTotal` in `packages/pricing-core/src/index.ts` — FR-030 (T010/T011 now pass)
- [ ] T015 [P] [US1] Create `apps/web/src/features/calculator/calculator-schema.ts` — RHF + Zod schema for ALL US1 fields: the mandatory ones (FR-001..003,005..009,017,018) AND the optional-but-core ones the model + SC-001 exercise — `wasteGrams` (FR-004), `maintenanceReservePerHour` (FR-010), `failurePct` (FR-011), `finishTimeHours`/`finishRatePerHour` (FR-012/013), each **optional, default 0** — with pt-BR/BRL parsing + per-field messages. (labor/admin → US4; marketplace → US5.) Resolves analyze finding C1.
- [ ] T016 [US1] Rewrite `apps/web/src/features/calculator/calculator-model.ts` as the thin adapter (pt-BR parse → validate → `computeCalculator` → format); delete the 001 `parseDecimal` lenient coercion (closes TD-020) — update `calculator-model.test.ts`
- [ ] T017 [US1] Update `apps/web/src/pages/calcular/calcular-page.tsx` to render the US1 inputs — mandatory + the optional-core `wasteGrams`/`maintenanceReservePerHour`/`failurePct`/`finishTimeHours`/`finishRatePerHour` (de-emphasized at their 0 default; reuse `Field`/`NumberField`) + retail/wholesale via `PriceHero`; wire recompute on change
- [ ] T018 [US1] Visual test — QA homologates the rendered calculator: SC-001 inputs → shown values match; both prices together; pt-BR/BRL formatting

**Checkpoint**: US1 fully functional — a correct retail + wholesale price from the full model. **MVP candidate.**

---

## Phase 4: User Story 2 — Transparent per-line breakdown (Priority: P1)

**Goal**: show each cost line in R$, summing exactly to `custo_total`, plus the markup derivation.

**Independent Test**: for SC-001, each breakdown line renders in R$, the visible lines sum to `custo_total` (0 residual), and retail/wholesale = custo_total × markup is visible.

### Tests for User Story 2 (write FIRST, observe FAILING) ⚠️

- [ ] T019 [P] [US2] Test: breakdown lines sum to `custoTotal` with 0 residual under HALF_UP, for SC-001 AND randomized valid inputs (SC-002) in `packages/pricing-core/src/index.test.ts`

### Implementation for User Story 2

- [ ] T020 [US2] Confirm `PriceResult` exposes all seven lines + `custoTotal` + the markup-derivation values (already produced in US1) — adjust `packages/pricing-core/src/index.ts` shape if needed (T019 passes)
- [ ] T021 [US2] Update `apps/web/src/pages/calcular/calcular-page.tsx` to render a `BreakdownRow` per line and show how varejo/atacado derive from `custo_total` (the applied markup); zero optional lines de-emphasized/omitted without breaking the sum — FR-032/033/034
- [ ] T022 [US2] Visual test — QA homologates the breakdown: labelled pt-BR lines, visible sum == `custo_total`, markup derivation shown

**Checkpoint**: US1 + US2 = the P1 MVP (a correct, transparent price).

---

## Phase 5: User Story 3 — Trust the corrected math (Priority: P2)

**Goal**: pin the corrected computations (effective-draw energy, single machine-hour, failure over all production inputs) as their own regression surface.

**Independent Test**: vary one engine input; only the correct line responds, per the corrected formulas.

### Tests for User Story 3 (write FIRST, observe FAILING) ⚠️

- [ ] T023 [P] [US3] SC-005 test: changing `avgPowerKw` p1→p2 scales only the energy line by p2/p1; no nameplate/duty input exists — `packages/pricing-core/src/index.test.ts`
- [ ] T024 [P] [US3] SC-006 test: `falha == failurePct%*(material+energy+machine)` = R$ 2,15 for SC-001, NOT R$ 1,10 (material-only) — `packages/pricing-core/src/index.test.ts`
- [ ] T025 [P] [US3] SC-007 test: `machineHourRate = machineValue/machineLifetimeHours + reserve` (4.000/2.000 = R$ 2,00/h → machine R$ 10,00); no separate maintenance/ROI/depreciation lines — `packages/pricing-core/src/index.test.ts`

### Implementation for User Story 3

- [ ] T026 [US3] Reconcile the US1 engine so T023–T025 pass (fix any line that regressed to a legacy shortcut); add code comments citing A16.2/A16.4/ADR-0009 at each corrected line in `packages/pricing-core/src/index.ts`

**Checkpoint**: the defect-fixes are locked by tests and cannot silently drift.

---

## Phase 6: User Story 4 — Optional labor + admin (Priority: P2)

**Goal**: optional labor (h × R$/h) and a single "outros custos" admin total, default 0, folding into `custo_total`.

**Independent Test**: optionals untouched → price identical to mandatory-only; labor 2 h × R$ 25 → `custo_total` +R$ 50,00, only the labor line moves.

### Tests for User Story 4 (write FIRST, observe FAILING) ⚠️

- [ ] T027 [P] [US4] SC-004 test: labor+admin at 0 ≡ mandatory-only; `laborHours 2 × laborRatePerHour 25` → custoTotal +R$ 50,00 (→ 78,65), only labor line changes — `packages/pricing-core/src/index.test.ts`

### Implementation for User Story 4

- [ ] T028 [US4] Implement `labor = laborHours*laborRatePerHour` and `admin = adminTotal` folded into `custoTotal` (outside the failure base) in `packages/pricing-core/src/index.ts` — FR-029 (T027 passes)
- [ ] T029 [US4] Add optional labor/admin fields (FR-014/015/016, default 0) to `apps/web/src/features/calculator/calculator-schema.ts`
- [ ] T030 [US4] Render optional labor/admin inputs + their breakdown lines in `apps/web/src/pages/calcular/calcular-page.tsx` (de-emphasized at 0)
- [ ] T031 [US4] Visual test — QA homologates: untouched → price unchanged; entered → folds into total and both prices

**Checkpoint**: a serious seller can reach true `custo_total`.

---

## Phase 7: User Story 5 — Basic marketplace fee, gross-up on both prices (Priority: P2)

**Goal**: one channel's commission % + fixed fee → correct gross-up price-to-list + net-received for BOTH varejo and atacado.

**Independent Test**: for each base, `preço para anunciar = (base+fixedFee)/(1−commissionPct/100)` and `recebido líquido` nets back to the base; commission 100 refused.

### Tests for User Story 5 (write FIRST, observe FAILING) ⚠️

- [ ] T032 [P] [US5] SC-003 test: gross-up + net round-trip for varejo AND atacado (SC-001 → anúncio 59,98/52,81, líquido 42,98/37,25); commission=100 → `ValidationError`; both fees 0 → `marketplace === null` — `packages/pricing-core/src/index.test.ts`

### Implementation for User Story 5

- [ ] T033 [US5] Implement the marketplace block in `computeCalculator` (`packages/pricing-core/src/index.ts`): for each of precoVarejo/precoAtacado compute `precoAnuncio` + `recebidoLiquido`; return `MarketplaceResult | null` — FR-031 (T032 passes)
- [ ] T034 [US5] Add optional `marketplaceCommissionPct`/`marketplaceFixedFee` fields (FR-019/020, default 0, commission in [0,100)) to `apps/web/src/features/calculator/calculator-schema.ts`
- [ ] T035 [US5] Render marketplace inputs + `preço para anunciar` and `recebido líquido` for both prices in `apps/web/src/pages/calcular/calcular-page.tsx`; hide when both fees 0 — FR-033
- [ ] T036 [US5] Visual test — QA homologates: both prices grossed up, net lines correct, marketplace lines appear/disappear with the fee inputs

**Checkpoint**: the seller sees the price to list on ML/Shopee and what actually lands.

---

## Phase 8: User Story 6 — Free & offline, saving nothing (Priority: P3)

**Goal**: the whole calculator works signed-out + offline, with no persistence and no paywall.

**Independent Test**: offline + signed out → retail, wholesale, full breakdown compute; no save/export/history affordance; no premium prompt.

### Tests for User Story 6 (write FIRST, observe FAILING) ⚠️

- [ ] T037 [US6] e2e (SC-009): signed-out + offline full compute + breakdown; assert NO save/export/history affordance and NO paywall, in `apps/web/tests/e2e/calculator.spec.ts`

### Implementation for User Story 6

- [ ] T038 [US6] Confirm `apps/web/src/pages/calcular/calcular-page.tsx` presents no persistence/premium affordance (assert absence; inherits 003 public `/calcular`) — FR-035

**Checkpoint**: the freemium boundary is encoded onto E1.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T039 [P] Determinism test (SC-012): identical `PriceInput` → byte-identical `PriceResult` across runs/locales, in `packages/pricing-core/src/index.test.ts`
- [ ] T040 [P] Single-source + version-stamp test (SC-011): no server round-trip for any price; `result.modelVersion === "2.0.0"`, in `packages/pricing-core/src/index.test.ts`
- [ ] T041 [P] Extend `apps/web/tests/e2e/calculator.spec.ts`: full-model happy path, SC-008 bad-number validation messages rendered, **assert no `imposto`/tax field is present (FR-021, analyze A1)**, and no horizontal scroll at 390 px (inherits 003 FR-010)
- [ ] T042 Retire TD-020 in `docs/tech-debt.md` (per-field validation now replaces the `parseDecimal` coercion) and note the `pricing-core` 2.0.0 bump
- [ ] T043 Run quickstart.md validation (`pnpm --filter @3dprecify/pricing-core test` · `pnpm gate` · `pnpm e2e`); record results in `specs/004-e1-pricing-model/dod-evidence.md`
- [ ] T044 Update `docs/product/business-rules.md` roadmap (E1 status → built) and the decision log (`audit-findings-r2.md` §5) with the E1-built entry

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (P1)** → **Foundational (P2)** blocks everything (rounding + version + validation).
- **US1 (P3)** is the engine core; **US2** depends on US1's `PriceResult` shape; **US3** validates US1's engine; **US4/US5** extend the engine + form; **US6** asserts the inherited free/offline boundary.
- **Polish (P9)** after the target stories.

### User story dependencies

- **US1 (P1)** — after Foundational. The engine + mandatory form. No dependency on other stories.
- **US2 (P1)** — after US1 (consumes the line-level `PriceResult`). UI-only + the sum invariant.
- **US3 (P2)** — after US1 (tests its engine). Independently testable via single-input variation.
- **US4 (P2)** — after US1 (adds optional lines + fields). Isolated by SC-004.
- **US5 (P2)** — after US1 (adds the marketplace block over the two prices). Isolated by SC-003.
- **US6 (P3)** — after the UI exists (US1); mostly inherited from 003.

### Within each story

- Tests written and FAILING before implementation (NON-NEGOTIABLE).
- `pricing-core` engine before FE adapter before page UI before visual homologation.
- Same-file impl tasks (all `index.ts` lines) run sequentially; different-file tasks marked [P].

### Parallel opportunities

- Setup: T002 ∥ T003.
- Foundational: T006/T007 (version) ∥ the rounding pair; validation after.
- Per story, the [P] test tasks run together; US3's T023/T024/T025 are fully parallel (all read-only assertions on the built engine).
- US4 and US5 engine blocks touch `index.ts` (sequential), but their schema/page/test tasks can interleave once US1 lands.

---

## Parallel Example: User Story 1

```bash
# Tests first (different-file [P] or independent cases), observe FAILING:
Task: "T010 canonical SC-001 numeric case in packages/pricing-core/src/index.test.ts"
Task: "T011 both-prices / retail≥wholesale case in packages/pricing-core/src/index.test.ts"

# Then engine (sequential — same index.ts), then FE in parallel with page skeleton:
Task: "T015 calculator-schema.ts (RHF+Zod, mandatory fields)"   # [P] different file
```

---

## Implementation Strategy

### MVP first (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational (rounding + version + validation).
2. US1 (engine + mandatory form + prices) → **STOP & VALIDATE** against SC-001.
3. US2 (transparent breakdown) → owner homologates the P1 MVP.

### Incremental delivery

US3 (lock the corrected math) → US4 (optional labor/admin) → US5 (marketplace) → US6 (free/offline assertion) → Polish. Each story adds value and stays independently testable; commit after each task or logical group.

---

## Notes

- All money math and rounding live once in `pricing-core` (FR-036/037); the FE never recomputes and the **backend is untouched**.
- SC-001 is the anchoring numeric guard — if any composition is wrong, T010 fails before UI work starts.
- Every UI story ends in a QA visual homologation (Constitution III); owner sign-off gates the increment.
- Verify each test FAILS before implementing it.
