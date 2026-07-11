# Quickstart — E3 Multi-piece BOM validation

Runnable validation scenarios that prove E3 works end-to-end. Prereqs mirror E2: Docker Postgres, backend via
`scripts/run_e2e_server.py`, Firebase Auth emulator, vite preview. Gates: `pnpm gate:all` + `pnpm e2e`.
Implementation lives in tasks; this is the run/verify guide.

## §1 — `computeBom` canonical compute (ADR-0016)

- Unit (pricing-core, failing-first): `computeBom([{ input: A, quantity: 1 }])` totals **byte-identical** to
  `computeCalculator(A)` (SC-402). Multi-line: `sumMoney` aggregate matches an anchored fixture; a
  `quantity: 0` line contributes zero; a line with a channel in `error` is skipped honestly (rollup reports
  `skippedLines`), siblings compute (SC-107 extended). `modelVersion === "3.1.0"`; version↔major gate-test green.

## §2 — Compose free-standing (premium), signed-out sees teaser (US1 + US5, ADR-0015)

- Premium account: open the BOM composer, add 3 lines (ad-hoc + catalog-ref) with quantities → transparent
  per-line + assembly breakdown + per-channel rollup; remove a line → total updates live. Nothing persisted
  until save.
- Signed-out / free: navigating to BOM shows the **honest teaser** (no fake success, no price/date, no pre-E6
  CTA); the free **single-piece calculator is untouched** (SC-408, SC-409). The route-guard decision derives
  from `GET /api/v1/entitlement` (never a local flag).

## §3 — Persistence gated server-side (US2, SC-403)

- Free/none identity → every BOM write (`POST/PUT/DELETE /api/v1/boms`) returns `403 ENTITLEMENT_REQUIRED`,
  nothing persisted; signed-out → `401`. Premium identity → same calls succeed. A client faking local premium
  unlocks nothing.
- Route-audit test: 100% of `/api/v1/boms` write routes carry `require_entitlement`; reads carry
  `require_catalog_read` (no bypass).

## §4 — Save / reload round-trip, no stored price (US2, SC-404/FR-407)

- Premium: save a composed BOM with a name → appears on a fresh `TestClient`/session, reloads identical
  (inputs/structure reproduced, decimal-string money, no drift); the client recomputes the price via
  `computeBom` (server returns no price).

## §5 — Catalog reference: live + last-known degradation (US3, SC-405)

- Add product P as a line ×N → assembly uses P's live values. Edit P → BOM total reflects it on reopen. Delete
  P → the line's `product_id` goes NULL (`ON DELETE SET NULL`), `degraded: true`, editable last-known values
  remain, BOM stays priceable (no crash, no silent wrong number). A `productId` that isn't an owned/live
  product → `422` (no existence oracle, SC-308/SC-406).

## §6 — Per-account isolation + lapse freeze (US4, SC-406/SC-407)

- Account B sees zero of account A's BOMs; A's BOM id from B → `404`. Revoke A's premium → A reads/re-prices
  existing BOMs (`200`) but every write is `403`; **no BOM deleted**. Re-grant → writes succeed, data intact.

## §7 — Regression: E1/E2 unchanged (SC-409)

- The full E1 + E2 e2e suite passes **unchanged**; the free single-piece calculator, offline behavior, and the
  E2 catalog/entitlement guarantees are not regressed. `pnpm gate:all` green (frontend + backend); contract
  drift-guard 0 diff; `generated.ts` raw Orval.

## §8 — Kits vocabulary + catalog materialization (K1–K4, US6 — added 2026-07-11)

- **K1 (with PR-A)**: the bottom nav shows the 5th tab **"Kits"** → `/kits`; the page reads "Monte seus kits"
  + the approved subtitle; teaser/empty copy uses Kit vocabulary; 5-tab nav has NO 390px overflow (SC-410).
- **K2–K4 (with PR-B)**: premium saves a kit with 1 catalog-ref + 2 ad-hoc lines, naming each ad-hoc piece →
  the kit appears in the catalog's **Kits** tab on a fresh session; the 2 pieces appear in Produtos as manual
  products with the attention indicator (SC-411/412). Re-save with the same names → ZERO duplicates (the
  response says "referenced"). Link filament+printer to a materialized product → indicator clears. A free
  caller's save is denied AND materializes nothing (atomicity). Deleting a materialized product later →
  the kit line degrades (D6, §5).
