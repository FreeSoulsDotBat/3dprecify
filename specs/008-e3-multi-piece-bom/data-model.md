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
| **resolved filament/printer values** (what a product resolves to) | | |
| `filament_cost_per_roll` | `MONEY_SETTLED` | CHECK `>= 0 AND <> 'NaN'` |
| `filament_roll_weight_kg` | `QTY_KG` | CHECK `> 0 AND <> 'NaN'` (denominator) |
| `printer_machine_value` | `MONEY_SETTLED` | CHECK `>= 0 AND <> 'NaN'` |
| `printer_machine_lifetime_hours` | `QTY_H` | CHECK `> 0 AND <> 'NaN'` (denominator) |
| `printer_avg_power_kw` | `QTY_KW` | CHECK `>= 0 AND <> 'NaN'` |
| `printer_maintenance_reserve_per_hour` | `MONEY_RATE` | CHECK `>= 0 AND <> 'NaN'` |
| `channels` | JSONB | 0..N `ChannelInput`, decimal-string money — as `products.channels` |
| `other_costs` | JSONB | 0..N named sub-costs — as `products.other_costs` |

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

## Write logic (mirrors `products._apply` + `_to_out`)

- **`product_id` present** ⇒ re-snapshot the resolved live product on every write (the product itself resolves
  its filament/printer); the snapshot columns are refreshed so a later delete degrades to *these* values.
- **`product_id` NULL** (ad-hoc or degraded) ⇒ persist the submitted editable overrides into the snapshot
  columns.
- A `product_id` that does not resolve to an **owned, live** product ⇒ **422, no existence oracle** (reuse the
  E2 `_unresolvable`; SC-308).
- **Degradation (D6)**: deleting a referenced product fires `ON DELETE SET NULL` on `bom_lines.product_id`;
  the row keeps its last-known snapshot columns and stays priceable/editable (SC-405). No pre-delete snapshot
  write is required here because E3 keeps the snapshot **continuously refreshed on each BOM write** — but if a
  product can be deleted between BOM writes, the delete path SHOULD capture last-known into referencing
  `bom_lines` in the same txn (mirror the E2 filament/printer delete D6 pattern). Resolve in tasks.

## `owner_uid` on `bom_lines`?

Not denormalized — the owner comes from `boms`; every read is owner-scoped through `boms` (single source of
truth). Optional defense-in-depth (a redundant `owner_uid` + RLS) may be added in tasks if desired.

## Wire (contract summary — full surface in `contracts/api-surface.md`)

- `BomLineIn`: `{ quantity, productId? , pieceInputs? , channels?, otherCosts? }` — camelCase, money as decimal
  strings; either `productId` or a full `pieceInputs` (link-or-snapshot enforced server-side, 422 otherwise).
- `BomIn`: `{ name, lines: BomLineIn[] }`.
- `BomOut`: `{ id, name, lines: BomLineOut[], createdAt, updatedAt }` — **no price** (recomputed client-side
  via `computeBom`, ADR-0016). Each `BomLineOut` resolves live vs last-known and flags `degraded: boolean`.

## Indices

- `boms(owner_uid)`, `boms(owner_uid, deleted_at)` for active listing.
- `bom_lines(bom_id, position)`, `bom_lines(product_id)`.
