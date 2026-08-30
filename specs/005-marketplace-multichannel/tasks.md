# Tasks: E1 expansion — multi-channel marketplace pricing + itemized other-costs

**Input**: `specs/005-marketplace-multichannel/` — spec.md (US1–US6, FR-101…FR-119, SC-101…SC-112) + plan.md + ADR-0010 (fee-catalog: **served endpoint + persisted client cache + bundled seed** — delivery amended 2026-07-06; ML PR-ingestion; freight union; 30-day seal) + ADR-0011 (pricing-core 3.0.0 result contract, band/floor fixed-point, snapshot).

**Prerequisites**: plan.md ✅ · ADR-0010 (delivery amended) / ADR-0011 Accepted. **Spec delivery re-flip APPLIED 2026-07-06** (FR-105/107/108/117, US2/US3/US6, SC-104, §model/§5/Assumptions now read "fetch when online → persist to store → offline uses store → seed covers first-run"; spec↔ADR agree, verified by grep). **Artifact placement `backend/app/data/catalog.json` + ADR-0010 R6=(a)** are the adopted defaults (the earlier repo-root `fee-catalog/` placement of 2026-07-06 was superseded 2026-07-07 — a repo-root artifact fell outside the `./backend` Docker build context; ADR-0010 amendment). Ready to re-run `/speckit-analyze` for a clean pass.

**Tests**: MANDATORY (Constitution III, test-first). `pricing-core` numeric cases (SC-101…SC-112) written and observed FAILING before implementation; the endpoint gets a contract test; UI stories get a Playwright e2e + a QA visual homologation.

**Branch/PR**: `feature/004-e1-pricing-model` — ships in the **same E1 PR as 004**. **One small public backend endpoint** (`GET /api/v1/fee-catalog`, data only) is added; the **price math stays fully offline** in pricing-core. The ML ingestion Job (D1–D4) is a separate, optional deployable.

**Analyze findings baked in**: A1 (T005/T006 migration + dead-code) · A2 (T012/T013 `minPerItem` floor; T022 catalog keeps floor R$1 vs Individual R$2/item distinct) · A3 (T022 ML custo-fixo band encoding) · A4 (T009 truth-gate estimate exemption) · A6 (T008/T013 resolve split) · A7 (T003 test-path convention) · **F3** (T012 R$12,50 boundary vector) · **F7** (T017 freight override UI). **Delivery reversal replanned** (endpoint + persisted store + seed).

## Format: `[ID] [P?] [Story] Description`
- **[P]** = parallelizable (different files, no incomplete-task dependency). **[USn]** = user-story tasks only.

---

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 [P] Bump `packages/pricing-core/package.json` version `2.0.0` → `3.0.0` (ADR-0011); update the version-constant gate expectation to `3.0.0`.
- [x] T002 [P] Scaffold the catalog surface: **`backend/app/data/catalog.json`** (the committed, PR-gated source of truth — bundled into the image via `COPY app`; originally scaffolded at repo-root `fee-catalog/`, moved 2026-07-07 per the ADR-0010 amendment) + `apps/web/src/shared/fee-catalog/` stubs (`fee-catalog.ts` schema/resolver, `seed.ts`, `use-fee-catalog.ts`) + barrel export. FSD-Lite `shared` layer.
- [x] T003 Standardize the pricing-core test convention on `packages/pricing-core/tests/*.test.ts` (A7 — no new `src/*.test.ts`); note it in the package's test README.

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: no user story starts until this phase is green. Here land the 3.0.0 contract break (A1), the catalog schema/resolver/truth-gate, the **backend endpoint**, and the **fetch→persist→seed store**.

- [x] T004 pricing-core 3.0.0 type surface in `packages/pricing-core/src/index.ts`: extend `PriceInput` with `otherCosts: {name,value}[]` and `channels: ChannelInput[]`; extend `PriceResult` with `channels: ChannelResult[]` and `catalogVersion`; keep the 004 breakdown/`custo_total`. `PRICING_MODEL_VERSION = "3.0.0"`. (types + constant only)
- [x] T005 **A1 migration**: migrate the 004 SC-001…SC-012 numeric tests in `packages/pricing-core/tests/` to the 3.0.0 shape (`marketplace: null` → `channels: []`; `adminTotal` → `otherCosts`) and re-run them **GREEN** — the 004 cost model must not regress.
- [x] T006 **A1 dead-code (Constitution V)**: remove the dead single-channel surface subsumed by `channels[]` — `MarketplaceResult` + `marketplaceCommissionPct`/`marketplaceFixedFee` inputs — from `pricing-core` and any `apps/web` references. Confirm the version-constant gate asserts `3.0.0`.
- [x] T007 [P] Fee-catalog schema + types in `apps/web/src/shared/fee-catalog/fee-catalog.ts`: `FeeCatalog`/`FeeEntry` = `{ marketplace, feeDeterminants, commissionPct, fixedFee, minPerItem?, priceBands?, freight:{kind:'ESTIMATE'|'BAND_VOUCHER'|'NONE',…}, source, sourceUrl, effectiveDate, lastReviewed }` + top-level `catalogVersion`/`schemaVersion`. **One shape** shared by the served artifact, the persisted store and the seed.
- [x] T008 [P] Pure resolver in `fee-catalog.ts` (A6): `resolveEntry(catalog, marketplace, feeDeterminants)` (keyed by **determinants**) + `staleness(entry, now)` (30 d vs `lastReviewed`). The **band/floor fixed-point stays in pricing-core** (keyed by price) — no price-keyed resolver here.
- [x] T009 **Truth-gate** test in `fee-catalog.test.ts`: **both the served `backend/app/data/catalog.json` and the bundled seed** parse under `schemaVersion`, and **every curated entry carries `sourceUrl`+`effectiveDate`+`lastReviewed`** — a fabricated/missing-provenance entry FAILS the build (Constitution II). **A4 exemption**: the ML `freight.kind='ESTIMATE'` subsidy magnitude is a labelled estimate (its `thresholdPrice` IS sourced) and is **exempt** — no false-positive.
- [x] T009b **[dev-backend] Fee-catalog endpoint** in `backend/` (the real backend location — plan said `apps/api`): `GET /api/v1/fee-catalog` serving `backend/app/data/catalog.json` (bundled into the image via `COPY app`; the artifact was moved here from repo-root `fee-catalog/` on 2026-07-07 precisely so it lands inside the `./backend` build context — see remediation B2) — **camelCase** via Pydantic `alias_generator`, `ETag` + `If-None-Match → 304`, **public/unauthenticated, never a gate** (FR-117/Const IV), **serves data only, computes no price** (FR-118). Regenerated the Orval client (ADR-0002 pipeline) → typed hook. Contract test: a **thorough hand-written TestClient contract test** (public/camelCase/ETag+304/serves-committed-artifact/no-price) in place of Schemathesis — a zero-input static GET has no space to fuzz; schemathesis stays available. (R6=(a): serves the committed artifact, not a datastore.)
- [x] T009c **[dev-frontend] Fetch→persist→seed store** in `apps/web/src/shared/fee-catalog/use-fee-catalog.ts`: TanStack Query fetches `GET /api/v1/fee-catalog` on first `Calcular` load and **persists it to IndexedDB** (`@tanstack/query-*-persist-client` + `idb-keyval`, or `experimental_createQueryPersister` — **pin + re-verify, it is `experimental_`**); resolution order **store (freshest) → seed (`seed.ts`, first-run offline) → refresh from endpoint when online**. **R2:** the cache MUST be persisted (not in-memory) so an offline reload keeps the catalog. **R1:** `seed.ts` (built from `backend/app/data/catalog.json`) guarantees first-ever-offline pre-fills. Non-blocking: a fetch failure falls back to store→seed, never blocks the calculator.

**Checkpoint**: 3.0.0 types + 004 regression green + dead code gone + catalog schema/resolver/truth-gate + endpoint + persisted store/seed ready.

---

## Phase 3: User Story 1 — Price across several channels at once (P1) 🎯 MVP

**Goal**: one product priced across ML/Amazon/Shopee at once; each channel's anúncio + líquido for varejo+atacado, shown together ("Preços por canal").
**Independent Test**: SC-101 canonical vector renders for two channels; add/remove isolates rows; commission 100% errors one slot without breaking others.

### Tests (write FAILING first) ⚠️
- [x] T010 [P] [US1] SC-101 canonical multi-channel test in `packages/pricing-core/tests/channels.test.ts` (ML Clássico 12%+R$6,75 → 56,51/50,00; Shopee 20%+R$4 → 58,73/51,56 on 42,98/37,25; líquido nets to base).
- [x] T011 [P] [US1] SC-102 (add/remove isolation + stable ordering), SC-107 (commission ≥100% → per-slot error, others compute), SC-110 (determinism at scale) in `tests/channels.test.ts`.
- [x] T012 [P] [US1] SC-108 (price-band fixed-point determinism, no oscillation) + SC-112 (Amazon `minPerItem` floor `max(%×list, minPerItem)`, gross-up net==base, deterministic) in `packages/pricing-core/tests/band-floor.test.ts`. **F3 boundary vector**: the steep ML "50% do valor" band (`< R$12,50`) whose gross-up can push `list` across R$12,50 — prove the terminal tie-rule converges deterministically at the boundary (ADR-0011 announce-price regime selection).

### Implementation
- [x] T013 [US1] `packages/pricing-core/src/channels.ts`: per-channel gross-up on varejo+atacado via ONE deterministic bounded **fixed-point** resolving BOTH the price-band `fixedFee` (Shopee/ML custo fixo) AND the commission floor `minPerItem` (Amazon) by the resulting listing price (FR-110/111), minus generic `freightCost` (FR-111a). **Pure** — receives resolved `(commissionPct, fixedFee, minPerItem, freight)`; MUST NOT import the catalog (A6).
- [x] T014 [US1] Wire `channels[]` (+`otherCosts[]`) through `computeCalculator` in `src/index.ts` → `PriceResult.channels[]` + `catalogVersion`; make T010–T012 GREEN.
- [x] T015 [P] [US1] `apps/web/src/features/calculator/calculator-schema.ts`: channel-slot schema (marketplace, modality determinant, commissionPct, fixedFee, minPerItem, freightCost) + option constants (`MARKETPLACE_OPTIONS`/`MODALITY_OPTIONS`) + `defaultChannelSlot`. Per-field pt-BR validation lives in the model (per-slot isolation), NOT the blocking Zod object (see T016). Dead 004 single-marketplace fields removed (Const V).
- [x] T016 [US1] `apps/web/src/features/calculator/calculator-model.ts`: `parseChannelSlot` adapts each UI slot → pricing-core `ChannelInput` and gross-ups in isolation — a bad slot (commission ≥ 100%, non-numeric, negative) carries inline pt-BR errors + null result while siblings compute (SC-107); `hasFee` gates the price rows. Covered by new adapter tests in `calculator-model.test.ts`.
- [x] T017 [US1] `apps/web/src/pages/calcular/calcular-page.tsx`: channel-slot management (starts with 1 ML slot; `useFieldArray` add/remove), marketplace + modality selectors (new zero-dep `tf-Select` on a native `<select>`; ML Clássico/Premium · Amazon Profissional/Individual · Shopee/Outro none), manual fee grid incl. an editable `freightCost` field (FR-111b, F7), "Preços por canal" list (anúncio+líquido, varejo+atacado, per channel). Reuses 003 DS. *(The "estimativa" seal on the ML subsidy `freightCost` arrives with T024/US2.)*
- [x] T018 [P] [US1] pt-BR strings (channels, marketplace/modality names, "Preços por canal", no-fee/error hints) in `apps/web/src/shared/i18n/messages.pt-br.ts`.
- [x] T019 [US1] e2e in `apps/web/tests/e2e/calculator.spec.ts`: add a 2nd channel → both channels' anúncio+líquido varejo+atacado; remove drops only its rows; commission 100% → inline per-slot error, no NaN/Infinity, others compute. **GREEN on the 390 px mobile project** (also migrated the 004 US5 overflow test to the channel slot).
- [x] T019b [US1] **Visual homologation (QA)**: qa-produto drove the rendered `/calcular` at 390 px (light+dark, all 6 flows) → **PASS-WITH-NITS (93%)**: console clean, no NaN/Infinity, tf-Select height/caret/focus-ring fidelity confirmed, no 390 px overflow, ✕ target ≥44 px. **All 4 nits fixed + re-verified by screenshot (light+dark)**: (#1) standalone-select label reserved 2 lines → `Field tightLabel`; (#2) subtle select caret → `--fs-sm`/`--text-strong`; (#3, owner-authorized DS fix) `.tf-inputwrap--error:focus-within` now keeps the `--danger` red border over the focus-ring purple app-wide; (#4, owner-authorized) "Preços por canal" hierarchy — muted modality + a divider between stacked channels.

**Checkpoint**: multi-channel pricing works end-to-end from resolved/manual fees.

---

## Phase 4: User Story 2 — Fees pre-filled from a dated reference + honesty seal (P1) 🎯 MVP

**Goal**: selecting a marketplace+determinants pre-fills fees from the catalog (served → persisted store → seed), with a source/freshness seal; editable; uncovered → manual + "sem referência".
**Independent Test**: SC-103 — covered combo pre-fills + seal with date; override → "ajustado por você"; uncovered → manual, no fabricated number.

### Tests (write FAILING first) ⚠️
- [x] T020 [P] [US2] SC-103 resolve+seal logic + test — `features/calculator/fee-prefill.ts` (`slotDeterminants` A6 mapping, `resolveSlotEntry`, pure `feeSealState`) + `fee-prefill.test.ts` (10 tests): covered → dated reference; seed source → "embutida"; >30 d → stale; override → "ajustado por você"; uncovered/OUTRO → null → "sem referência" (no fabrication). Fixture catalog (real curation = T022).
- [x] T021 [P] [US2] SC-111 — `entryToChannelFees` (in `fee-prefill.ts`) maps a resolved entry → engine fees: price-band entries carry `priceBands` through; the ML free-shipping `ESTIMATE.defaultSubsidy` becomes an editable `freightCost` that lowers the líquido by exactly that amount (`grossUp` verified) and is flagged `freightIsEstimate` for the "estimativa" seal (A4). **The Shopee `BAND_VOUCHER` is carried through as `freightVoucherBands` and DEDUCTED in pricing-core by the resulting announce band (FR-111a) — pre-merge remediation 2026-07-07 (see below); no longer dropped to 0.** Tests in `fee-prefill.test.ts` + `band-floor.test.ts` + `calculator-model.test.ts`.

### Implementation
- [~] T022 [US2] Curate **`backend/app/data/catalog.json`** (+ mirror in `seed.ts`), each entry carrying `sourceUrl`/`effectiveDate`/`lastReviewed`. **Owner decision 2026-07-07: add a `category` determinant to ML/Amazon slots** (their commission is category-specific), alongside Shopee. **Sourcing** (owner-directed): prefer a deterministic fetch script over WebSearch — but the ML `listing_prices` API is 403 (house-account OAuth + BR geo-gate, the Q-D infra), so WebSearch-sourced + owner-approved for the MVP; the ML ingestion script (D1–D3) lands when the house account exists. **DONE: Shopee** (price-band based, category-independent — 4 bands 20%+R$4 / 14%+R$16 / 14%+R$20 / 14%+R$26, freight BAND_VOUCHER R$20/30/40; sourced from the official 2026 commission policy; truth-gate green). **PENDING: ML + Amazon** — need the exact per-category % (JS-gated official tables not scrapeable here; awaiting owner-provided rates) + the category selector.
  - **ML**: Clássico 10–14% / Premium 15–19% by category; **A3** — custo fixo bands: `< R$12,50` encodes "50% do valor" as that band's **`commissionPct`** (NOT flat `fixedFee`), `≥ R$79` zeroes fixed fee; free-shipping `freight: ESTIMATE` (thresholdPrice sourced, `defaultSubsidy` labelled estimate).
  - **Amazon** (**A2, kept distinct**): referral % by category + **`minPerItem`** commission floor = **R$1 verified** (per-category R$2 floor reported but **unconfirmed** — curate R$1 unless verified; T009 gate blocks unsourced values); plan Individual → **`fixedFee` R$2/item**, Profissional → `fixedFee` 0. Do NOT re-conflate the R$1 floor with the R$2 Individual fee.
  - **Shopee**: price-band 20%+R$4 / 14%+R$16–26; `freight: BAND_VOUCHER` (R$20/30/40 by band).
  - Curate ONLY verifiable values; unverifiable/uncovered → omit (→ manual + "sem referência").
- [x] T023 [US2] Wire `resolveEntry` (reading the catalog from the **store/seed** via `use-fee-catalog`) into `calculator-model.ts`: pre-fill slot fees by (marketplace, feeDeterminants); override flips the seal; uncovered → manual. **DONE**: `computeFromForm(values, ctx?: CatalogContext)` resolves each slot's entry (blank fees → `entryToChannelFees` pre-fill + reference seal; any typed fee → manual override, "ajustado por você" over a covered combo else "sem referência"); `calcular-page.tsx` feeds `{ catalog, source, now }` from `useFeeCatalog()` and renders `<FeeSeal>` + the "estimativa" seal per slot. Stateless (no fragile `setValue` effects). 138 web tests green (calcular.test.tsx now wraps in `QueryClientProvider`; fetch fails in jsdom → seed fallback).
- [x] T024 [US2] Honesty-seal component — built as `apps/web/src/features/calculator/fee-seal.tsx` (FSD-Lite: fee-reference domain copy belongs in the feature, on the generic shared `Badge` — a considered deviation from the plan's `shared/ui/` path, same rationale as the `backend/` correction). States (FR-107): reference (source + `lastReviewed`), possibly-stale (>30 d), seed/embutida, manually-adjusted, no-reference, ML freight "estimativa". 6 render tests green.
- [x] T025 [P] [US2] pt-BR strings for seals + freight/subsidy labels in `messages.pt-br.ts` (`calculator.seals`).
- [x] T026 [US2] e2e in `apps/web/tests/e2e/calculator.spec.ts`: default ML slot (uncovered) → "sem referência"; switch to Shopee (curated) → pre-fill + reference seal ("referência embutida (offline)" — no backend in e2e, store falls back to seed) + per-channel prices with NO manual entry; edit commission → "ajustado por você"; no NaN/Infinity. **GREEN on chromium + mobile (Pixel 7)**.
- [x] T026b [US2] **Visual homologation (QA)**: qa-produto drove the rendered `/calcular` at 390 px (light + dark), all 5 US2 flows → **PASS-WITH-NITS (92%)**: honesty guarantee intact (no fabricated numbers on uncovered slots, pt-BR seal strings correct, per-slot independent seals; offline → seed → "referência embutida"). **Both nits fixed feature-local in `FeeSeal` (DS Badge untouched), re-verified by screenshot**: (#1) neutral seal lost its pill in dark (`--bg-muted` == `--surface-card`) → added a `1px solid var(--border-default)` hairline on `.tf-badge.fee-seal`; (#2, latent FR-010 overflow) the long ONLINE reference seal (~850 px) forced 390 px overflow via `.tf-badge { white-space: nowrap }` → `.tf-badge.fee-seal { white-space: normal; text-align: left; line-height: 1.3 }` wraps it. Added a permanent e2e regression (route-fulfills the served catalog → online seal → asserts no 390 px overflow), which also pre-covers US3's online-seal path. `fee-seal.css` created.

**Checkpoint (🎯 MVP boundary)**: Setup + Foundational + US1 + US2 = multi-channel pricing with dated, honest pre-fills (served + cached + seed). STOP & homologate (SC-101 anchor).

---

## Phase 5: User Story 3 — Fetch online, cache, fall back to seed/manual; offline-safe (P2)

**Goal**: the catalog is **fetched on first load and persisted to a store**; a **bundled seed** covers the first-ever offline load; **manual entry** for uncovered/override; the seal warns when the active data is stale (>30 d). A fetch failure is non-blocking (store→seed). *(Reverted from bundle-only: there IS a network fetch, so loading/error/retry states apply — but the calculator never blocks because seed/store always answer.)*
**Independent Test**: SC-104.

- [x] T027 [P] [US3] SC-104 test (FAILING first, then green): the retry-state wiring is proven in `calcular-catalog-retry.test.tsx` (fetch error → non-blocking retry notice + the calculator still computes from the seed; retry calls `refetch`; healthy → no notice). Seed-parse + fresher-wins + persist-fallback were already covered in `use-fee-catalog.test.ts`; the >30 d **possibly-stale seal** in the US2 seal tests; **manual/uncovered** in the calculator-model catalog tests.
- [x] T028 [US3] The fetch→persist→seed flow already shipped in `use-fee-catalog` (T009c, MVP): first-load fetch → persist to IndexedDB → store thereafter, seed fallback, staleness from `lastReviewed` vs the device clock. **This slice wired the remaining UI**: `calcular-page.tsx` consumes `refreshFailed`/`refreshing`/`refetch` and renders a **non-blocking retry** (`Alert` tone "info", role="status" + a "Tentar novamente" button) in the Marketplace section — the seed/store keep every price live, never a blocking error.
- [x] T029 [US3] e2e (`calculator.spec.ts`): the offline cold-load → seed pre-fills + computes flow is covered by the signed-out offline test; the new **SC-104 retry** test routes `GET /api/v1/fee-catalog` to fail → asserts the non-blocking notice + a computed price from the seed → a successful retry clears the notice. *(Design reconciliation of the loading/error/retry states with the prototype stays as T042.)*
- [x] T029b [US3] **Visual homologation (QA)**: qa-produto drove the rendered `/calcular` (390 px, no backend) → **ISSUE found + fixed**. The non-blocking notice was gated on the raw `query.isError`; a `refetch()` of a no-data errored query re-enters TanStack's `'pending'`, so `isError` dropped to false mid-retry → the whole notice (and its button) **unmounted for ~2 s** and the button spinner never showed (the `loading={refreshing}` was effectively dead — contradicting SC-104's "notice persists + button loads"). **Fix**: `useFeeCatalog` now exposes a **sticky** `refreshFailed` (raise on settled error, lower only on success) + `refreshing` (isFetching); the page gates the notice on the sticky flag. Guarded by a deterministic hook test (`use-fee-catalog-latch.test.tsx`, drives error→pending→success) + the page retry-in-flight test, and re-verified in the real browser (notice never blinks out, button shows loading). The mocked unit tests missed it because they never exercised the real `isError→pending→isError` transition.

**Checkpoint**: online freshness + offline resilience (seed/store) proven; the price math never blocks on the network.

---

## Phase 6: User Story 4 — Include/exclude marketplace toggle (P2)

**Goal**: "Incluir marketplaces no preço" (default on) shows the whole marketplace section; off → the section is hidden and no channel is computed. The direct 004 cost×markup varejo/atacado headline is byte-identical either way.
**Independent Test**: SC-105.

> **Owner clarification (2026-07-07)** — this toggle is pure **UI visibility**: it shows/hides the marketplace
> section, it does NOT reframe which price is the headline. So `includeInHeadline` on `PriceResult` was NOT added
> (it stays DEFERRED to E4 per ADR-0011). The toggle lives in `CalcFormValues.includeMarketplace` (FE-only); when
> off, the model passes an empty `channels[]` so nothing is computed and no catalog version is stamped — the
> headline never changes because a marketplace fee is a gross-up ON TOP of the price, never folded into custo_total.

- [x] T030 [P] [US4] SC-105 test — model (`calculator-model.test.ts`): `includeMarketplace:false` → 0 channel outcomes + byte-identical custoTotal/precoVarejo/precoAtacado + null catalogVersion; component (`calcular.test.tsx`): default on shows section, off hides "Adicionar canal"/"Preços por canal" while the headline stays. Written FAILING first.
- [x] T031 [US4] `includeMarketplace: boolean` in `calculator-schema.ts` (default `true`); model gates channel compute in `calculator-model.ts`; `calcular-page.tsx` renders a DS `Switch` (labelled `channels.includeToggle`) in the MarketplaceSection header (outside the collapsible body so it stays re-enableable) + conditional body render. **Deviation**: no `includeInHeadline` on `PriceResult` (owner clarification above).
- [x] T032 [US4] e2e (`calculator.spec.ts`): toggle off → channel slots + "Preços por canal" hidden, direct varejo headline stays, no NaN; toggle back on → section returns. Green on chromium + mobile.
- [x] T032b [US4] **Visual homologation (QA)**: qa-produto drove the rendered `/calcular` (390 px, ON/OFF/reON) → **PASS (97%)**: pure UI visibility confirmed (headline byte-identical in both states, R$ 30,90 / R$ 26,78), switch stays reachable when off, 44×44 px touch target (INV-2), no overflow. Label-wrap nit fixed in `85118ba` (toggle on its own full-width row). Owner homologated 2026-07-08.

---

## Phase 7: User Story 5 — Outros custos slot (named sub-costs) (P2)

**Goal**: "Outros custos" becomes 0..N named sub-costs summing into `custo_total` exactly as 004's single admin; each named line in the breakdown.
**Independent Test**: SC-106.

- [x] T033 [P] [US5] SC-106 test (sub-costs sum ≡ single admin; each named line echoed on the result; remove lowers exactly; empty ≡ 004 byte-for-byte) in `packages/pricing-core/tests/computeCalculator.test.ts` — plus per-row FE mapping tests in `calculator-model.test.ts`. Written FAILING first.
- [x] T034 [US5] `admin = Σ otherCosts.value` in `computeCalculator` (uses T004 `otherCosts[]`); each named sub-cost **echoed onto `PriceResult.otherCosts[]`** (rounded, in order) so it renders as its own breakdown line (FR-114/115); breakdown still sums to `custo_total` (0 residual, HALF_UP). Additive to the 3.0.0 result contract (still unreleased) — no version bump.
- [x] T035 [US5] `calcular-page.tsx`: "Outros custos" slot (`OtherCostsSection`/`OtherCostRow`) — add/remove named sub-costs via `useFieldArray`, per-row pt-BR validation (finite ≥0, isolated so a bad row errors only itself), blank name → neutral placeholder + `outrosCustos.lineFallback` in the breakdown. Schema: `adminTotal` scalar removed, `otherCosts: OtherCostForm[]` added (Constitution V — no dead field left behind).
- [x] T036 [US5] e2e (`calculator.spec.ts`): Embalagem R$3 + Etiqueta R$2 → each a named breakdown line; remove Etiqueta → its line drops, Embalagem stays, no NaN. Green on chromium + mobile. (Also migrated the 390px-overflow test off the removed `adminTotal` field onto the slot.)
- [x] T036b [US5] **Visual homologation (QA)**: qa-produto drove the rendered `/calcular` (390 px) → **PASS (~97%)**, 25/25 checks: exact sums in the breakdown (20,60 → 23,60 → 25,60), removal lowers exactly, per-row negative error without breaking the price, blank name → neutral label, no overflow with 1/2/3 rows. Verbose-labels + narrow-name nits fixed in `85118ba` (labels → aria-label/placeholder; name column 3:2). Owner homologated 2026-07-08.

---

## Phase 8: User Story 6 — Free, signed-out, offline; no gate (P3)

**Goal**: the whole expansion stays free/offline/signed-out; no save/export/history; no paywall; the fee endpoint is public read-only reference data, never a gate; the price math never depends on the network.
**Independent Test**: SC-109.

- [x] T037 [P] [US6] SC-109 e2e (`calculator.spec.ts`): the FULL 005 surface signed-out — manual 95%-commission channel + Shopee seed-prefilled channel + toggle off/on (state survives) + named & blank-named sub-costs (HALF_UP 1,005→1,01) → no NaN/Infinity/#DIV, no save/export/history/paywall button, freemium note stays. The `PRICING_MODEL_VERSION === "3.0.0"` half is pinned at the source in `pricing-core/tests/version.test.ts` (single source; T039 consolidates); "backend does no price compute" is proven behaviorally by T038 (prices render with NO backend/network) + statically by `test_fee_catalog.py` (data-only endpoint).
- [x] T038 [US6] e2e signed-out + offline (SW precache → `setOffline` → reload): manual channel gross-up (30,90 @20% → 38,63), Shopee pre-fills from the BUNDLED SEED with the "referência embutida (offline)" seal, sub-cost folds into custo_total (20,60+3 → 23,60), toggle works, US3 notice appears non-blocking; no sign-in wall, nothing offered to save, no bad numbers. The fee endpoint's no-auth guarantee is asserted in `backend/tests/test_fee_catalog.py` (FR-117). Green chromium + mobile.

---

## Phase 9: Polish & Cross-Cutting

- [x] T039 [P] Determinism/version consolidated in `determinism.test.ts`: SC-110 **at scale** — 5 channels covering every fee shape (plain %, %+fixed, `minPerItem` floor, price bands + voucher bands, an ERRORING slot) in deliberate non-alphabetical order + 3 sub-costs (HALF_UP boundary, blank name, long name) → byte-identical across runs, input-order echo (never sorted), deterministic per-slot error, 3.0.0 stamp (SC-109). Locale independence rides on byte-identity (numbers-in → numbers-out, no Intl).
- [x] T040 [P] The 390px overflow e2e extended to the FULL US1–US5 model: labor + 2 sub-costs (long name + inline per-row error) + manual-fee channel + Shopee seed-prefilled channel (long embedded seal) + all 4 gross-up rows → `scrollWidth === clientWidth`. Green chromium + mobile.
- [x] T041 Docs: `business-rules.md` E1 row EXPANDED (005 supersedes the E5 multi-channel deferral; E5 keeps saved scenarios + per-account auth); `specs/005-marketplace-multichannel/dod-evidence.md` written (gates + SC-101..112 map + homologation record); "005 BUILT" logged in `docs/decisions/audit-findings-r2.md`.
- [ ] T042 Design reconciliation (non-blocking): confirm with Claude Design the **catalog fetch loading / refresh / error+retry** states (now IN scope — there is a network fetch) plus the **seed "referência embutida"** + stale seals.

---

## OFF the calculator critical path — ML ingestion (devops + seguranca; separate deployable, later)

> Never blocks the E1 ship: the calculator runs on the curated seed/store; the endpoint serves the last-merged artifact. Blocked ONLY on the owner creating the dedicated house ML account (Q-D).

- [ ] D1 [devops] Cloud Run Job + Cloud Scheduler (southamerica-east1) calling ML `GET /sites/MLB/listing_prices`; VPC + Cloud NAT **static BR egress** (the endpoint geo-gates non-BR IPs).
- [ ] D2 [seguranca] House-account OAuth refresh token in Secret Manager + rotation runbook. **BLOCKED on owner: create the dedicated house ML account (Q-D)** before any ingestion code.
- [ ] D3 [devops] Job transforms `listing_prices` (`percentage_fee`/`fixed_fee` by category/listingType) → **edits `backend/app/data/catalog.json`** → **opens a PR** (human gate, ADR-0006); a backend deploy publishes it to the endpoint.
- [ ] D4 [seguranca] Review: credential never client-exposed; Principle IV enforced on the Job; the ingestion PR is the review gate.

---

## Dependencies & Execution Order

- **Setup (P1)** → **Foundational (P2, blocks all stories)** → **US1, US2 (P1) = MVP** → US3, US4, US5 (P2) → US6 (P3) → Polish.
- **A1 (T005/T006)** precedes all new pricing-core logic (T013+).
- **T009b (endpoint)** ∥ **T009c (store/seed)** — both Foundational; US2 pre-fill (T023) reads the store/seed; the MVP works on the **seed** even before the endpoint is deployed.
- **T013 (channels engine)** depends on T004; unblocks US1 UI (T015–T017) and the band/floor tests (T012).
- **T022 (catalog curation)** depends on T007/T008/T009; unblocks US2 pre-fill (T023) + US3 (T027).
- Within a story: tests (FAILING) → engine/core → schema/model → page/UI → e2e → visual homologation.
- **D1–D4** depend on nothing in the critical path; D2/D3 gate on the house ML account.

### Parallel opportunities
- Setup T001/T002 [P]; Foundational T007/T008 [P] alongside T005; **T009b (backend) ∥ T009c (frontend store)**.
- Within US1: T010/T011/T012 [P]; T015/T018 [P]. Within US2: T020/T021 [P], T025 [P].
- After Foundational, US3/US4/US5 can proceed in parallel once US1/US2 surfaces exist.

---

## Implementation Strategy

**MVP = Setup + Foundational + US1 + US2** — multi-channel pricing with dated, honest pre-fills (served + cached + seed). Build to T026b, **STOP and homologate** at the SC-101 anchor. The MVP is shippable on the **seed** even if the endpoint deploy lags.

**Then incrementally**: US3 (fetch/cache/offline resilience) → US4 (toggle) → US5 (outros custos) → US6 (free/offline guard) → Polish. Same E1 branch/PR.

**In parallel, off the critical path**: devops + seguranca prepare D1–D4 (ML ingestion) — lands after the calculator ships, unblocked once the house ML account exists.

---

## Notes
- All **price** math + rounding live once in `pricing-core` (FR-118, ADR-0008); the FE resolves fees from the **store/seed** and feeds the pure engine; the **backend serves fee data only, computes no price**.
- The fee endpoint is **public, unauthenticated, never a gate** (FR-117/Const IV); the calculator **never blocks on the network** (seed/store answer offline).
- `resolveFee(…, listingPrice)` (FR-110) = **`resolveEntry`** (FE) **+ band/floor fixed-point** (core) — A6.
- Every curated fee carries provenance; unverifiable → manual + "sem referência" (Constitution II); the ML `defaultSubsidy` is a labelled estimate, never asserted exact.
- Test-first is NON-NEGOTIABLE: SC-101…SC-112 FAIL before their implementation. Commit after each task/group; ships in the 004 PR (owner-authorized).

---

## Pre-merge remediation (2026-07-07) — 3 blockers from the 5-agent review, fixed before the develop PR

A 5-agent review of the E1 branch (arquiteto · pricing-core · frontend · seguranca · qa) surfaced 3 merge blockers; all fixed + tested before opening the PR (owner-directed):

- **B1 (truth / FR-111a) — Shopee co-funded voucher was dropped → overstated `recebido líquido` under an authoritative seal.** Fixed by resolving freight in **pricing-core** (ADR-0010 P4 / ADR-0011 amendment): `ChannelInput.freightVoucherBands` + `grossUp` deducts the voucher by the resulting announce band (per level). Tests: `band-floor.test.ts` (FR-111a/SC-111), `fee-prefill.test.ts`, `calculator-model.test.ts` (catalog-context end-to-end).
- **B2 (deploy) — the served endpoint would 500 in the Cloud Run image** (artifact `fee-catalog/catalog.json` outside the `./backend` build context). Fixed by moving the artifact to **`backend/app/data/catalog.json`** (bundled by the existing `COPY app ./app`; no Dockerfile/CI/deploy change) + a contract-test guard that the served path resolves inside the `app/` package. ADR-0010 amendment records the placement.
- **B3 (ADR-0011 drift) — `PriceResult.catalogVersion` was always null; `ChannelResult` lacked provenance.** Fixed by threading `catalogVersion` from the active catalog + adding `feeSource` to `ChannelResult`; the denormalized resolved-fee/`appliedBand` echo is **deferred to E4** (re-derivable from the key) — ADR-0011 amendment. Covered by `calculator-model.test.ts`.

Green after remediation: pricing-core 50 · web 140 · backend 5 · e2e US1+US2 (chromium+mobile) · lint/format/typecheck.
