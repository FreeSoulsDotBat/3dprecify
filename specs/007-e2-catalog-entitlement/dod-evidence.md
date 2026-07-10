# 007-e2-catalog-entitlement — DoD evidence

**Status (2026-07-10): E2 COMPLETE and SHIPPED to `develop`.** Built across three owner-authorized slices.
**PR-A** (US1+US2 — the first database + Constitution IV: entitlement gate, ledger, operator CLI)
squash-merged as **PR #10** (`16c1824`). **PR-B** (US3·US4·US5 — the demoable premium catalog loop)
squash-merged as **PR #11** (`e655504`), owner-homologated + QA-homologated (`homologation-prb.md`).
**PR-C** (US6 products + US7 honest free tier) owner-homologated (`homologation-prc.md`) and squash-merged
as **PR #12** (`3a940ba`) — full CI green including the Contract drift-guard (SC-6). This file is the E2 DoD
map; all ten success criteria are met and every slice is on `develop`.

## Gates (final PR-C run, 2026-07-10)
| Gate | Result |
|------|--------|
| `pnpm gate:all` (THE command — identical string in lefthook pre-push and the CI `gate` job) | green end-to-end |
| Frontend (format · lint+boundaries · dependency-cruiser · typecheck · coverage) | **295 web tests**; 209 modules, 0 boundary/depcruise violations |
| Backend (ruff check+format · basedpyright strict · pytest · import-linter) | clean; **89 pytest**; import-linter 2 contracts kept |
| Playwright e2e (chromium + mobile, Auth emulator + real backend + Postgres) | **92/92** incl. the US7 signed-out teaser + the full premium loop |
| Contract drift-guard (OpenAPI export → Orval regen) | 0 drift; `grep -c HTTPValidationError contracts/openapi.json` → 0 |

## Success criteria — SC-301..310
| SC | Status | Evidence |
|----|--------|----------|
| **SC-301** — 100% of persistence authorized server-side; a free/none write is denied | ✅ | `require_entitlement` on every write route; `test_*` per resource assert `403 ENTITLEMENT_REQUIRED` for none/lapsed; e2e `catalog.spec.ts` free-account deny |
| **SC-302** — grant enables persistence within one refresh; revoke blocks new writes | ✅ | operator CLI `grant-premium` writes the ledger; `test_entitlement_grants` + the PR-B homologation grant-walk (reload → premium unlocks); lapse tests (`test_*_lapsed_reads_but_cannot_write`) |
| **SC-303** — a saved filament reloads identical on a fresh session/device | ✅ | `test_filaments.py::test_crud_round_trip` (fresh `TestClient` reads identical); decimal-string wire (no float drift) |
| **SC-304** — same for printers | ✅ | `test_printers.py` mirror |
| **SC-305** — catalog-picked compute is **byte-identical** to manual | ✅ | `catalog-prefill` pure separator swap; the SC-305 byte-identity vitest (T023); **R$ 26,48 anchor** asserted in the calculator AND the product page (T030) + both homologation drives |
| **SC-306** — free/signed-out persists nothing, no fake "salvo", every affordance honest | ✅ | US7 teaser (no price/date/purchase-CTA); `premium-teaser` + `calcular-teaser` component tests; e2e signed-out teaser; server 403 is the real boundary |
| **SC-307** — a saved product reproduces inputs + recomputes with the current formula; ref edits reflect | ✅ | `test_products.py` (inputs-only, no stored price; `test_reopen_reflects_live_reference_edits`); product page reopen recomputes via `computeFromForm` |
| **SC-308** — zero cross-account reads/writes | ✅ | `test_*::test_per_account_isolation` (another account's row → 404, no existence oracle); owner-scoped queries + RLS backstop |
| **SC-309** — on lapse, saved data stays readable/pre-fillable, 0% writable | ✅ | `require_catalog_read` allows active|lapsed; writes deny; `test_*_lapsed_reads_but_cannot_write` |
| **SC-310** — the E1 free/offline/signed-out guarantees hold unchanged | ✅ | the full E1 e2e suite passes unchanged (92/92); `catalog.spec.ts` SC-310 assertions; seed R$ 30,90 intact behind the teaser |

## Failing-first discipline (per-task, captured)
- **US1/US2** (PR-A): entitlement gate + `/entitlement` route + grant/revoke tests written failing-first.
- **US3/US4** (PR-B): `test_filaments.py`/`test_printers.py` + FE component tests failing-first (T016/T020).
- **US5** (PR-B): the SC-305 byte-identity test first (T023).
- **US6** (PR-C): `test_products.py` — **19 tests, 404s captured before implementation** (`03e89b0`).
- **US7** (PR-C): teaser component + e2e — **8 failing captured**, then green (`df6793e`).

## Homologation evidence
- **PR-B**: `homologation-prb.md` — owner-homologated 2026-07-10 + QA drive 14/14 PASS (390px + desktop).
- **PR-C**: `homologation-prc.md` — QA drive PASS; **found + fixed a real bug** (the material-less filament
  degradation CHECK violation, `e02a9b1`) that the unit tests missed; **owner-homologated 2026-07-10**
  (teaser copy ratified + owner beta-grant walk) → shipped as PR #12 (`3a940ba`).

## Decisions honored / recorded
- ADR-0012 (server-authoritative entitlement; grant = operator CLI, no HTTP grant route) · ADR-0013 (SQLAlchemy
  2.0 typed schema, single migration `0001`) · ADR-0010/0011 carried forward (fee catalog + pricing-core 3.0.0).
- **Dated refinements (2026-07-10):** channel fees are **nullable** (blank = resolve from the live fee catalog,
  data-model §2.5.1) · the filament last-known snapshot CHECK dropped `material IS NOT NULL` (material is an
  optional label, data-model D3 correction) · **`/catalogo` left the GC-2 guarded set** so a signed-out user
  sees the honest US7 teaser there, never a bounce (writes stay server-gated; product routes stay guarded).
- Privacy notice gains an honest catalog-data line (T034); full LGPD consent still deferred.

## Open / deferred
- **E2 is closed** — T033 owner homologation + T035 owner-gated ship both DONE (PR #12 merged `3a940ba`).
  Owner caveat carried forward: further homologation rounds MAY be required as development unfolds (each
  change lands as a dated spec Clarification).
- First public deploy still **DEFERRED to v1 = E1–E6** (006 Clarifications; REVISITABLE).
- 005 T042 (design reconciliation, non-blocking) and D1–D4 ML ingestion (blocked on the house ML account)
  remain off E2's critical path.
