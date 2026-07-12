# 008-e3-multi-piece-bom — DoD evidence

**Status (2026-07-12): E3 code COMPLETE; PR-A + PR-B on `develop`, PR-C awaiting the owner-gated squash-merge.**
Built across three owner-authorized slices, mirroring the E2 cadence. **PR-A** (US1/US5 compose + teaser +
K1 Kits nav) squash-merged as **PR #15**. **PR-B** (US2/US4/US6 persistence + atomic materialization +
ADR-0017) squash-merged as **PR #16**. **PR-C** (US3 catalog-reference lifecycle — D3 live-reflect + D6
read-time degradation, T019–T022) is the slice this file closes: `gate:all` green, e2e 102/102, visual
homologation recorded below. This file is the E3 DoD map; PR-C's merge SHA is filled at close-out.

> **PR-C merge:** `<SHA — filled after the owner squash-merges PR-C>`.

## Gates (PR-C run, 2026-07-12)
| Gate | Result |
|------|--------|
| `pnpm gate:all` (THE command — identical string in lefthook pre-push and the CI `gate` job) | green end-to-end |
| Backend (ruff check+format · basedpyright strict · pytest --cov · import-linter) | clean; **142 pytest**, coverage **85.33%** (floor 82); import-linter **2 contracts kept** |
| Frontend (format · lint+boundaries · dependency-cruiser · typecheck · coverage) | green; coverage above the apps/web floors (stmts 82.5 / branch 78.9 / func 78.7 / lines 84.1); 0 boundary/depcruise violations |
| Playwright e2e (chromium + mobile, Auth emulator + real backend + compose Postgres) | **102/102** incl. `bom.spec.ts` (3-line compose, live totals) + `kits-save.spec.ts` (save → materialize → reopen → recompute; free-account deny; **+ the new D6/SC-405 delete→reopen degrade test**) |
| Contract drift-guard (OpenAPI export → Orval regen) | 0 drift (PR-B established the `/api/v1/boms` surface; PR-C added no routes) |

## Success criteria — SC-401..412
| SC | Status | Evidence |
|----|--------|----------|
| **SC-401** — premium composes + prices a multi-piece kit with a transparent combined breakdown; free/signed-out sees an honest teaser, zero data persisted | ✅ | `bom.spec.ts` (3-line ad-hoc + catalog-ref, live per-line + assembly + rollup); the server-informed premium gate (ADR-0015); `test_boms.py::test_free_write_is_403_and_materializes_nothing` |
| **SC-402** — a single-line kit (qty 1) totals **byte-identical** to the single-piece calculator | ✅ | `pricing-core` `computeBom`↔`computeCalculator` equality test (`modelVersion 3.1.0`, version↔major gate) |
| **SC-403** — 100% of persistence authorized server-side; free/signed-out write denied, persists nothing | ✅ | `require_entitlement` on every `/api/v1/boms` write; `test_boms.py` 401/403 + DB-direct `_count == 0` audits; route-audit |
| **SC-404** — a saved kit reloads on a fresh session with inputs/structure reproduced, price recomputed, no drift | ✅ | `test_crud_round_trip_inputs_only` (fresh `TestClient` reads identical, decimal-string wire); `kits-save.spec.ts` reopen-recompute |
| **SC-405** — editing a referenced product changes the kit price on reopen; deleting it leaves the kit priceable via last-known (no crash, no silent wrong number) | ✅ | **PR-C:** `test_editing_a_referenced_product_reflects_live_on_kit_reopen` (D3); `test_deleting_a_referenced_product_degrades_the_line_not_breaks_the_kit` + the read-time-degrade DB pins (D6); T021 visual homologation below |
| **SC-406** — zero cross-account reads/writes; another account's kit indistinguishable from non-existent | ✅ | `test_per_account_isolation` + `test_unresolvable_product_reference_is_422_with_no_existence_oracle` (no oracle across tenant/deleted/nonexistent/malformed) |
| **SC-407** — on lapse, 100% of saved kits stay readable/re-pricable, 0% writable; re-grant restores writes, data intact | ✅ | `test_lapsed_reads_everything_but_writes_nothing_and_deletes_nothing` + `test_a_re_grant_restores_writes_with_the_data_intact` |
| **SC-408** — every free/signed-out affordance honest (no fake success/price/date/pre-E6 CTA); free single-piece calculator stays free | ✅ | US5 teaser (component + `catalog.spec.ts` signed-out); `test_signed_out_is_401`; SC-409 keeps the free calculator untouched |
| **SC-409** — all E1 + E2 guarantees pass **unchanged** after E3 | ✅ | the full E1 + E2 e2e passes unchanged inside the 102/102; `test_public_product_create_still_requires_saved_refs` guards the FR-310 path-scoping |
| **SC-410** (K1/K2) — "Kits" nav tab + approved copy live; saved kit appears in the catalog Kits tab; 5-tab nav no 390px overflow | ✅ | PR-A K1 (`a389dc8`); `a11y-overflow.spec.ts`; PR-B Kits-tab homologation (`homologation-t015b.md`) |
| **SC-411** (K3/K4) — 100% of ad-hoc lines end as catalog products (materialized or name-referenced), ZERO duplicates on repeat saves, denied/failed save materializes nothing | ✅ | `test_ad_hoc_line_materializes_a_manual_product`, `test_dedup_references_the_existing_live_product…`, `test_intra_save_same_name_lines_share_one_materialized_product`, `test_a_failing_line_materializes_nothing`; `kits-save.spec.ts` |
| **SC-412** (K3) — every materialized manual product shows the attention indicator until a saved filament AND printer are linked; linking clears it | ✅ | derived indicator (`filament_id IS NULL OR printer_id IS NULL`); PR-B homologation (`homologation-t015b.md`) |

## Failing-first discipline (per-task, captured)
- **US1/US5** (PR-A): composer + teaser component/e2e written failing-first (T004→T005, T007→T008).
- **US2/US6** (PR-B): `test_boms.py` (persistence + atomic materialization) + FE save tests failing-first (T010→T012, T016→T017).
- **US3** (PR-C): `test_boms.py` D3 live-reflect + the read-time-degrade DB pins (soft-delete leaves `product_id` dangling; hard-purge FK SET NULL + CHECK holds) added test-first against the shipped read-time behavior; `bom-line-card.test.tsx` — 6 cases incl. the **F1 honesty guard** (`queryByText(/removid|excluíd|deletad/i)` is null) written before the caption wiring.

## Homologation evidence
- **PR-A** (T006b): `homologation-t006b.md` — QA drive PASS-with-nits (390px + desktop); the skippedLines-caption nit answered with a component-level contract test.
- **PR-B** (T015b/T017b): `homologation-t015b.md` — QA drive; **found 2 real honesty blockers a green gate + e2e + prior homologation all missed** (a born-manual product claiming a deletion that never happened; a second Salvar filing a duplicate kit) → fixed; owner-homologated.
- **PR-C** (T021): `homologation-t021.md` — degraded-reopen visual homologation (the calm "(avulsa)" label + valores-mantidos muted caption; the F1 guard: no "removido/excluído/deletado" copy; still-priceable + re-saveable). **Verdict: FAIL → fixed → PASS.** The first qa-produto pass caught a real honesty blocker that a green gate + e2e both missed: on reopen the deleted product rendered as a LIVE catalog reference (the inverse honesty bug — F1-guard still passed). Root cause was the PR-B freshness/hydration seam, NOT the T021 component: (a) `useDeleteProduct` invalidated only the products query, never the kits list; (b) the composer hydrated once per kit id and locked on the first stale-cache paint. Fixed by (a) `useInvalidateProductsAndKits` (product edit/delete now invalidates `["boms", uid]` too — a deliberate literal mirror of `bomQueryKey`, pinned by test) and (b) content-signature re-hydration (`kitSignature` on `[openedSig]`, not the object ref RQ structural-sharing can keep stable), with a `dirty` guard preserving in-progress edits. Reverified: backend +5 (D3 live-reflect, read-time-degrade DB pins, hard-purge FK), FE unit (`use-catalog.test.tsx` invalidation + `bom-page.test.tsx` re-hydration/clobber-guard), and the new `kits-save.spec.ts` D6/SC-405 e2e — **10/10 clean on both projects** (see the addendum for the orphaned-preview-server confound that briefly masked the fix as a false chromium "flaky").
- **Owner homologation** of PR-C: `<owner sign-off at the PR-C gate>`.

## Decisions honored / recorded
- ADR-0015 (server-authoritative kit persistence) · ADR-0016 (`computeBom` client-side, no price endpoint) — both Accepted, carried through all three slices.
- **ADR-0017** (atomic kit-save + materialization; K3/K4) — Accepted at the PR-B gate. **§6 Addendum (Accepted 2026-07-12):** D6 kit-line degradation is **read-time**, not eager delete-capture — `delete_product` is a plain soft-delete, `_resolve_views` is owner + live-only so a soft-deleted product is simply absent from the resolved map and its line degrades from the always-current snapshot; the `ON DELETE SET NULL` FK is defense for a hard purge only. This deliberately differs from the E2 filament/printer→product eager-unlink (rationale + risk-pin tests in the addendum). Reconciled across data-model §D6, quickstart §5, api-surface line 55, tasks T019/T020, ux-bom §1.2-D.
- **Degraded-line indicator (T021, owner-ratified 2026-07-12):** a calm **muted caption reusing `productForm.manualValuesKept`** — not an Alert, never a removal claim, keeps "(avulsa)". Reconciled with the F1/K3 indistinguishability lesson from PR-B; retires the planned `bom.degradedLine` copy (ux-bom §1.2-D, errata of §4/§5).

## Open / deferred
- **PR-C ships only on** the owner-gated squash-merge into `develop` + graph refresh on merge (ADR-0014). CLAUDE.md ground line flips to "E3 shipped" post-merge (T024).
- First public deploy still **DEFERRED to v1 = E1–E6** (006 Clarifications; REVISITABLE as development unfolds — each change a dated Clarification).
- 005 T042 (design reconciliation, non-blocking) and D1–D4 ML ingestion (blocked on the house ML account) remain off E3's critical path.
