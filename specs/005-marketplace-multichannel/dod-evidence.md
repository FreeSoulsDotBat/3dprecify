# 005-marketplace-multichannel — DoD evidence

**Status (2026-07-08):** 005 fully built on `feature/005-us3-offline-cache` (Setup + Foundational +
US1–US6 + polish T039/T040/T041), stacked on the 004 E1 base. `pnpm gate` + backend gate + `pnpm e2e`
green. US1/US2 owner-homologated 2026-07-06 (prototype + T026b); US3/US4/US5 qa-produto-homologated +
owner-homologated 2026-07-08 (incl. the T029b retry fix and the `85118ba` cosmetic nits). **Pending:**
T042 design reconciliation (non-blocking) + the owner-authorized squash-merge PR to `develop`. The
D1–D4 ML-ingestion block is OFF the critical path (blocked on the owner's house ML account, Q-D).

## Gates (final run, 2026-07-08)
| Gate | Result |
|------|--------|
| `prettier --check` / `eslint` (boundaries FSD-Lite) | clean |
| `dependency-cruiser` | 158 modules, 0 violations |
| `tsc --noEmit` (web + pricing-core) | clean |
| Unit/integration (`pnpm gate`) | **224 passed** (incl. `pricing-core` **63**) |
| Coverage (`packages/pricing-core/src`) | **100%** stmts/branches/funcs/lines |
| Backend (`ruff` / `basedpyright` / `pytest` / `import-linter`) | clean (10 pytest, incl. fee-catalog contract) |
| Playwright e2e (chromium + mobile, Auth emulator, preview build) | **26/26** (13 specs × 2 projects) |

## Success criteria (SC-101..SC-112)
| SC | Claim | Where verified |
|----|-------|----------------|
| SC-101 | multi-channel worked example over the 004 SC-001 base (28,65 / 42,98 / 37,25) — per-channel anúncio + líquido on BOTH levels | `channels.test.ts` + US1 e2e (`calculator.spec.ts`) |
| SC-102 | add/remove isolation — exact rows added/removed, siblings unchanged, stable ordering | US1 e2e (add → remove → re-add) + `channels.test.ts` |
| SC-103 | covered combo pre-fills + source/date seal; edit → "ajustado por você"; uncovered → "sem referência", never a fabricated number | `fee-prefill`/`fee-seal` tests + `calculator-model.test.ts` + US2 e2e |
| SC-104 | offline/cold-start seed pre-fills + computes; online fetch persists to store; fetch error NON-blocking with retry; >30d → possibly-stale seal | `use-fee-catalog.test.ts` + `use-fee-catalog-latch.test.tsx` + `calcular-catalog-retry.test.tsx` + US3/T038 e2e |
| SC-105 | toggle off → headline == direct 004 varejo/atacado byte-identical, 0 channels computed, no catalog stamp; on → channels are the result | `calculator-model.test.ts` + `calcular.test.tsx` + US4 e2e |
| SC-106 | Embalagem 3 + Frete 2 → custo_total +5,00 exactly (≡ single admin); each named breakdown line; remove → −2,00 exactly; empty ≡ 004 byte-for-byte | `computeCalculator.test.ts` (FR-114/115) + US5 e2e |
| SC-107 | commission ≥ 100% → inline pt-BR error on THAT slot only; siblings keep computing; never NaN | `channels.test.ts` + `calculator-model.test.ts` + US1 e2e |
| SC-108 | price-band fee matches the computed listing price, stable at boundaries (fixed-point, no oscillation) | `band-floor.test.ts` |
| SC-109 | no NaN/Infinity/#DIV across any channels+sub-costs; no save/export/history/paywall; `PRICING_MODEL_VERSION === "3.0.0"`; backend computes no price | US6 e2e (T037 full-surface + T038 offline) + `version.test.ts` + `determinism.test.ts` + `test_fee_catalog.py` (data-only, no-auth FR-117) |
| SC-110 | identical inputs → byte-identical output at scale (5 channels/every fee shape incl. an erroring slot + 3 sub-costs), stable input ordering | `determinism.test.ts` (T039 scale block) |
| SC-111 | ML freight subsidy deducted from líquido only (never in custo_total), labelled ESTIMATE seal, per-level voucher bands | `channels.test.ts` (freight/voucher) + `calculator-model.test.ts` (per-level bands) + seal tests |
| SC-112 | Amazon `minPerItem` floor binds iff `%×anúncio < min` (fixed-point shared with bands); vanishes at 0 | `band-floor.test.ts` |

## Task completion (per-task [x] in `tasks.md`)
- **Setup + Foundational**: pricing-core **3.0.0** (ADR-0011) — 004 tests migrated to the new result
  shape (A1), dead single-channel surface removed; `otherCosts[]`/`channels[]` input contract;
  catalog schema + bundled seed at `apps/web/src/shared/fee-catalog/`; served
  `GET /api/v1/fee-catalog` from `backend/app/data/catalog.json` (ADR-0010 amended).
- **US1 + US2 (MVP)**: multi-channel slots (add/remove, marketplace+modality determinants), gross-up
  per channel on both levels, per-slot error isolation; honesty seals (reference/embedded/adjusted/
  none/estimate + stale); owner-homologated (T026b) with both seal nits fixed feature-local.
- **US3**: fetch→persist(IndexedDB)→seed store + NON-blocking failed-refresh retry. Homologation
  (T029b) caught the notice unmounting mid-retry (raw `isError` drops during a refetch's transient
  `'pending'`) → fixed with the STICKY `refreshFailed` latch + deterministic latch test.
- **US4**: "Incluir marketplaces no preço" visibility toggle (owner-clarified: pure UI show/hide; NO
  `includeInHeadline` on `PriceResult` — deferred to E4 per ADR-0011). Homologated PASS.
- **US5**: itemized "Outros custos" (0..N named sub-costs; `adminTotal` scalar removed — Constitution
  V); each line echoed rounded on `PriceResult.otherCosts[]` (FR-115); per-row isolated validation.
  Homologated PASS; verbose-label + narrow-name nits fixed (`85118ba`).
- **US6**: full-surface + offline signed-out e2e guards (T037/T038) — no bad numbers, no
  save/export/history/paywall, seed computes everything with zero network.
- **Polish**: T039 determinism-at-scale; T040 full-model 390px no-overflow (incl. long seal + inline
  row error); T041 this file + `business-rules.md` + `audit-findings-r2.md` log. **T042 open**
  (design reconciliation, non-blocking).

## Decisions honored
ADR-0010 (fee catalog: served endpoint + persisted cache + bundled seed; in-repo artifact, PR-gated
writes) · ADR-0011 (3.0.0 result contract; `includeInHeadline` NOT shipped; reconciliation note Part
2) · ADR-0008/0009 carried from 004 · analyze findings A1–A7 incorporated (see tasks.md header).
Clean-room (A15) holds: fee values curated from public marketplace sources with per-entry
`sourceUrl`/`effectiveDate` provenance (truth-gate test; ML freight subsidy exempt as a labelled
estimate, A4). Taxes stay OUT (A24/FR-021). Owner authorizes each push/merge (ADR-0006).
