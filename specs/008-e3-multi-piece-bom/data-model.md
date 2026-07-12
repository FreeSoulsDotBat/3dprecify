# Data Model — E3 Multi-piece BOM

Extends the E2 schema (`backend/app/models/__init__.py`, migration `0001`) with **two new tables** via a new
Alembic migration **`0002`** (`down_revision = "0001"`; never amend the shipped `0001` — ADR-0013, R4).
Reuses the E2 domain types verbatim: `MONEY_SETTLED` = `Numeric(12,2)`, `MONEY_RATE` = `Numeric(18,6)`,
`QTY_G`/`QTY_H`/`QTY_KG`/`QTY_KW`, `PERCENT`, the `NAMING_CONVENTION`, `uuid7` PK default, and the
`<> 'NaN'::numeric` value guard. Money on the wire is **decimal strings**, camelCase (never floats).

**Reuse fractal**: `bom_line : product :: product : filament/printer`. The same live-reference + last-known
degradation machinery (D3/D6), one level up.

## Entity: `boms` (assembly root)

Per-account named assembly. **No stored price** — always recomputed (FR-407).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | default `uuid7` |
| `owner_uid` | Text NOT NULL, **indexed** | FK → `accounts.account_uid`; per-account isolation (FR-408) |
| `name` | Text NOT NULL | CHECK `length(btrim(name)) > 0` |
| `created_at` | timestamptz | `server_default now()` |
| `updated_at` | timestamptz | `server_default now()`, `onupdate now()` |
| `deleted_at` | timestamptz NULL | **voluntary** soft-delete only; lapse never deletes (FR-409, Q3 freeze) |

## Entity: `bom_lines`

One priced line: a quantity + a piece source that is **either** a live product reference **or** an editable
last-known snapshot (link-or-snapshot, exactly like `products`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | default `uuid7` |
| `bom_id` | UUID NOT NULL, **indexed** | FK → `boms.id` **ON DELETE CASCADE** (root governs soft-delete; lines carry no `deleted_at`) |
| `position` | Integer NOT NULL | stable order within the BOM (do not order by `created_at`) |
| `quantity` | Integer NOT NULL | CHECK `quantity >= 0` (Q1 × qty; `>= 0` tolerates the "qty 0 → honest zero" edge case) |
| `product_id` | UUID NULL, **indexed** | FK → `products.id` **ON DELETE SET NULL** — live reference; NULL = degraded (D3/D6) |
| **last-known snapshot (typed columns — the resolved `PriceInput`)** | | present so a degraded line stays priceable/editable |
| `print_grams` | `QTY_G` | CHECK `>= 0 AND <> 'NaN'` |
| `waste_grams` | `QTY_G` | CHECK `>= 0 AND <> 'NaN'` |
| `print_time_hours` | `QTY_H` | CHECK `>= 0 AND <> 'NaN'` |
| `tariff_per_kwh` | `MONEY_RATE` | CHECK `>= 0 AND <> 'NaN'` |
| `failure_pct` | `PERCENT` | CHECK `>= 0 AND <> 'NaN'` |
| `finish_time_hours` | `QTY_H` | CHECK `>= 0 AND <> 'NaN'` |
| `finish_rate_per_hour` | `MONEY_RATE` | CHECK `>= 0 AND <> 'NaN'` |
| `labor_hours` | `QTY_H` | CHECK `>= 0 AND <> 'NaN'` |
| `labor_rate_per_hour` | `MONEY_RATE` | CHECK `>= 0 AND <> 'NaN'` |
| `markup_varejo_pct` | `PERCENT` | CHECK `>= 0 AND <> 'NaN'` |
| `markup_atacado_pct` | `PERCENT` | CHECK `>= 0 AND <> 'NaN'` |
| `include_marketplace` | Boolean NOT NULL | `server_default true` — **amended 2026-07-11 (T011)** |
| **resolved filament/printer values** (what a product resolves to) | | |
| `filament_material` | Text NULL | optional display label — **amended 2026-07-11 (T011)** |
| `filament_cost_per_roll` | `MONEY_SETTLED` | CHECK `>= 0 AND <> 'NaN'` |
| `filament_roll_weight_kg` | `QTY_KG` | CHECK `> 0 AND <> 'NaN'` (denominator) |
| `printer_machine_value` | `MONEY_SETTLED` | CHECK `>= 0 AND <> 'NaN'` |
| `printer_machine_lifetime_hours` | `QTY_H` | CHECK `> 0 AND <> 'NaN'` (denominator) |
| `printer_avg_power_kw` | `QTY_KW` | CHECK `>= 0 AND <> 'NaN'` |
| `printer_maintenance_reserve_per_hour` | `MONEY_RATE` | CHECK `>= 0 AND <> 'NaN'` |
| `channels` | JSONB | 0..N `ChannelInput`, decimal-string money — as `products.channels` |
| `other_costs` | JSONB | 0..N named sub-costs — as `products.other_costs` |

> **Amendment 2026-07-11 (owner-approved at T011).** `include_marketplace` + `filament_material` were added
> to the snapshot above. Neither is a `PriceInput` field — which is why the original "resolved `PriceInput`"
> table omitted them — but BOTH exist on `products` precisely so a **degraded** row does not silently lose
> what the seller typed. Without them a kit line that degrades (D6) would drop the marketplace toggle and the
> material label while still claiming to hold a complete last-known snapshot. The snapshot is now a full
> mirror of the `products` value surface: whatever a degraded product keeps, a degraded line keeps.

**Table CHECK — link-or-snapshot** (mirrors `ck_products_filament_link_or_snapshot`, corrected form):
```
product_id IS NOT NULL
  OR (print_grams IS NOT NULL AND print_time_hours IS NOT NULL
      AND filament_cost_per_roll IS NOT NULL AND filament_roll_weight_kg IS NOT NULL
      AND printer_machine_value IS NOT NULL AND printer_machine_lifetime_hours IS NOT NULL
      AND markup_varejo_pct IS NOT NULL AND markup_atacado_pct IS NOT NULL)
```
A "blank line" is unrepresentable, exactly like `products`. (Load-bearing snapshot fields = the pricing
inputs + denominators; optional labels/reserves may be null.)

## Write logic (mirrors `products._apply` + `_to_out`; amended 2026-07-11 — K3/K4, R8/ADR-0017)

- **Atomic kit-save + materialization (ADR-0017)**: ONE transaction per write. For each **ad-hoc** line:
  dedup by `btrim(name)` exact match against the account's LIVE products → hit ⇒ the line references the
  existing product (`action: "referenced"`); miss ⇒ a **manual product** row is inserted (refs NULL + the
  full value snapshot — the existing `products` CHECKs already admit this shape, **no products migration**),
  and the line references it (`action: "created"`). Then the kit + lines commit together — a denied/failed
  save materializes nothing.
- **Consequence**: every persisted `bom_line` is **born with `product_id`**. The snapshot-only branch of the
  link-or-snapshot CHECK is reachable ONLY via D6 degradation (referenced product deleted later) — the CHECK
  and snapshot columns stay exactly as specified above.
- **`product_id` present** ⇒ re-snapshot the resolved live product on every write (the product itself resolves
  its filament/printer); the snapshot columns are refreshed so a later delete degrades to *these* values.
- A `product_id` that does not resolve to an **owned, live** product ⇒ **422, no existence oracle** (reuse the
  E2 `_unresolvable`; SC-308).
- **Degradation (D6) — read-time, not delete-capture (ADR-0017 addendum, 2026-07-12).**
  `delete_product` is a **soft delete** (`deleted_at = now`), so the `ON DELETE SET NULL` FK does **not**
  fire and `bom_lines.product_id` keeps pointing at the (still-present) soft-deleted row. Degradation
  happens on **read**: the kit read resolver (`_resolve_views`) is owner-scoped **and live-only**
  (`deleted_at IS NULL`) — the SAME filter as the write resolver (`_resolve_product`) — so a soft-deleted
  (or cross-tenant) product is simply **absent** from the resolved map and its line serves `degraded: true`
  from the last-known snapshot (SC-405), stays editable, and re-saves as an ad-hoc piece (re-materializing a
  new product; the dead row is never referenced again). The snapshot is lossless because `_snapshot_line`
  re-writes the **full** value-set on **every** kit write — no delete-time capture, and the `products`
  aggregate never learns about `bom_lines`. The `product_id` FK keeps **`ON DELETE SET NULL`** purely as
  defense for a hypothetical **hard** purge: if that runs, the FK nulls the column and the (already-current)
  snapshot columns satisfy the link-or-snapshot CHECK. **This deliberately differs from the E2
  filament/printer → product D6 (eager delete-capture)** — the two degrade at different layers because
  `products._live_links` does not filter the linked row's `deleted_at` while the kit read does; see the
  ADR-0017 addendum for why the divergence is the stronger choice.
- **Manual product state (K3)**: no new column — the attention indicator is DERIVED
  (`filament_id IS NULL OR printer_id IS NULL`), one unified honest state for "born manual" and "degraded by
  deletion"; linking a saved filament + printer through the ordinary product edit clears it (SC-412).

## `owner_uid` on `bom_lines`?

Not denormalized — the owner comes from `boms`; every read is owner-scoped through `boms` (single source of
truth). Optional defense-in-depth (a redundant `owner_uid` + RLS) may be added in tasks if desired.

## Wire (contract summary — full surface in `contracts/api-surface.md`; amended 2026-07-11)

- `BomLineIn`: `{ quantity, productId?, pieceName?, pieceInputs?, filamentValues?, printerValues?,
  tariffPerKwh?, includeMarketplace?, channels?, otherCosts? }` — camelCase, money as decimal strings; either
  `productId` OR `pieceName` + the full ad-hoc value-set (the ProductIn shape, so the manual product can be
  materialized); else 422.
- `BomIn`: `{ name, lines: BomLineIn[] }`.
- `BomOut`: `{ id, name, lines: BomLineOut[], createdAt, updatedAt, materializations? }` — **no price**
  (recomputed client-side via `computeBom`, ADR-0016). Each `BomLineOut` resolves live vs last-known and
  flags `degraded: boolean`; write responses carry `materializations[{position, productId, action}]` (K4
  honesty: "criado" vs "referenciou o existente").
- `BomLineOut` (**amended 2026-07-11, T012**) carries the **full resolved value-set** — `pieceInputs`,
  `filamentValues`, `printerValues`, `tariffPerKwh`, `includeMarketplace`, `channels`, `otherCosts`, plus
  `pieceName` (the live product's name; `null` once degraded → the UI's honest "— Manual —"). A line must be
  self-sufficient for client-side `computeBom` (ADR-0016) without a second round-trip; these are exactly the
  snapshot columns above. The earlier summary abbreviated the shape — it was never a smaller wire.

## Indices

- `boms(owner_uid)`, `boms(owner_uid, deleted_at)` for active listing.
- `bom_lines(bom_id, position)`, `bom_lines(product_id)`.
