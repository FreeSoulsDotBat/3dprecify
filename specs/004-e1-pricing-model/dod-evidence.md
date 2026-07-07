# 004-e1-pricing-model — DoD evidence

**Status (2026-07-06):** E1 fully built on `feature/004-e1-pricing-model` (US1–US6 + polish); `pnpm gate` +
`pnpm e2e` green. MVP (US1+US2) owner-homologated 2026-07-05. **Pending:** US4/US5 visual homologation
(T031/T036) + the owner-authorized squash-merge PR to `develop`. Not yet CLOSED.

## Gates (final run)
| Gate | Result |
|------|--------|
| `prettier --check` / `eslint` (boundaries FSD-Lite) | clean |
| `dependency-cruiser` | 136 modules, 0 violations |
| `tsc --noEmit` (web + pricing-core) | clean |
| Unit/integration (`pnpm gate`) | **118 passed** (incl. `pricing-core` **30**) |
| Coverage (`packages/pricing-core`) | **100%** stmts/branches/funcs/lines |
| Playwright e2e (chromium + mobile, Auth emulator) | **66/66** |

## Success criteria (SC-001..SC-012)
| SC | Claim | Where verified |
|----|-------|----------------|
| SC-001 | custo_total **28,65** · varejo **42,98** · atacado **37,25** (canonical vector) | `computeCalculator.test.ts` + calculator e2e |
| SC-002 | breakdown lines sum to custo_total, 0 residual (fixed + randomized) | `computeCalculator.test.ts` |
| SC-003 | marketplace gross-up on both prices — anúncio **59,98/52,81**, líquido nets to **42,98/37,25** | `computeCalculator.test.ts` (US5) |
| SC-004 | labor+admin at 0 ≡ mandatory-only; 2h×25 → +50, only labor moves | `computeCalculator.test.ts` (US4) |
| SC-005 | energy scales with effective-draw kW only; no nameplate/duty path | `computeCalculator.test.ts` (US3) |
| SC-006 | falha = %·(material+energy+machine) = **2,15**, not 1,10 | `computeCalculator.test.ts` (US3) |
| SC-007 | machine-hour = value/lifetime + reserve (4000/2000 = 2,00/h → 10,00) | `computeCalculator.test.ts` (US3) |
| SC-008 | bad numbers → per-field pt-BR message, never NaN/#DIV0 | schema + model tests + calculator/a11y e2e |
| SC-009 | signed-out + offline full compute; no save/export/history; no paywall | `calculator.spec.ts` (US6) |
| SC-010 | both prices always shown together; varejo ≥ atacado when markup ≥ | `computeCalculator.test.ts` + `calcular.test.tsx` |
| SC-011 | single source (no server round-trip); `modelVersion === "2.0.0"` | `determinism.test.ts` + `version.test.ts` |
| SC-012 | identical input → deeply-equal AND byte-identical result; no mutation | `determinism.test.ts` |

## Task completion (see `tasks.md` for the per-task [X])
- **Setup + Foundational** (T001–T009): pricing-core 2.0.0 surface, rounding (ADR-0008), version stamp, validation.
- **US1 + US2** (T010–T022): engine + mandatory/optional-core form + transparent breakdown; **owner-homologated 2026-07-05** (T018/T022) after the 8-item UI remediation + title/logo centring.
- **US3** (T023–T026): corrected-math regression guards + A16.2/A16.4/ADR-0009 citation comments.
- **US4** (T027–T030): labor+admin engine (folds into custo_total) + "Mão de obra e custos" UI section. Visual homologation **T031 pending owner**.
- **US5** (T032–T035): single-channel marketplace gross-up engine + "Marketplace" UI (fee inputs + per-channel anúncio/líquido, hidden when fees 0). Visual homologation **T036 pending owner**.
- **US6** (T037–T038): free/offline signed-out e2e; no persistence/paywall affordance.
- **Polish** (T039–T044): determinism + version-stamp tests; e2e extended (no-imposto FR-021, no-overflow-390px with full US4/US5 model) + un-broke the stale `getByLabel("Markup")`/seed/sign-in-logo e2e; **TD-020 retired**; roadmap + decision log updated (`business-rules.md:45`, `audit-findings-r2.md` §5); this evidence file.

## Quickstart execution record (`quickstart.md`)
- §1 `pnpm --filter @3dprecify/pricing-core test` → 30/30, coverage 100%, SC-001 anchor confirmed.
- §2 `pnpm gate` → clean; pricing-core `package.json` = `2.0.0`; version-constant gate green.
- §3 Calculator UI (manual) → owner-homologated the MVP; US4/US5 sections verified via Playwright screenshots (desktop + Pixel 7), pending owner visual sign-off.
- §4 `pnpm e2e` → 66/66 (chromium + mobile, Auth emulator, production preview build).

## Decisions honored
Capture log `docs/decisions/audit-findings-r2.md` §5 (E1 scope freeze + "E1 BUILT"); ADR-0008 (money/version), ADR-0009 (machine-hour). Clean-room (A15): no Amado3D formulas/constants/wording copied; taxes OUT (A24/FR-021).
