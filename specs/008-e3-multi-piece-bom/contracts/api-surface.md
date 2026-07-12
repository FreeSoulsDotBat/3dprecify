# API Surface — E3 BOM persistence

Mirrors the E2 catalog surface (`backend/app/api/products.py`). All routes are under `/api/v1/boms`,
per-account, camelCase wire, **money as decimal strings** (never floats), `ErrorCode` envelopes, correlation
header. Persistence is the **server-authoritative** boundary (ADR-0015): writes pass `require_entitlement`
(active only); reads pass `require_catalog_read` (active | lapsed).

> Compute is **not** an endpoint — `computeBom` runs client-side (ADR-0016). The backend stores/serves BOM
> **inputs/structure**, never a price (FR-407).

> **K-amendment (2026-07-11, R8/ADR-0017):** every kit WRITE is an **atomic kit-save + materialization**
> transaction — ad-hoc lines become manual catalog products (name-dedup'd) and the kit's lines reference
> them, all-or-nothing. "BOM" stays the technical wire/route term; the user-facing name is **Kit** (K1).

## Routes

| Method | Path | Auth | Entitlement | Success | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/v1/boms` | required | `require_entitlement` | `201 BomOut` | create; link-or-snapshot per line |
| `GET` | `/api/v1/boms` | required | `require_catalog_read` | `200 BomOut[]` | list own, active (non-deleted) |
| `GET` | `/api/v1/boms/{id}` | required | `require_catalog_read` | `200 BomOut` | own only; else `404` (no oracle) |
| `PUT` | `/api/v1/boms/{id}` | required | `require_entitlement` | `200 BomOut` | replace name + lines |
| `DELETE` | `/api/v1/boms/{id}` | required | `require_entitlement` | `204` | soft-delete (voluntary) |

**Denials (honest):** free/none write → `403 ENTITLEMENT_REQUIRED`; signed-out → `401`; another account's BOM
→ `404` (indistinguishable from non-existent, SC-406/FR-408); lapsed write → `403`, lapsed read → `200`
(FR-409).

## Schemas (camelCase; money = decimal strings)

```
BomLineIn:
  quantity: integer >= 0
  productId?: uuid                # live catalog reference (E2 product)
  # ── ad-hoc piece (MATERIALIZED on save — ADR-0017, K3/K4): the ProductIn value-set ──
  pieceName?: string (non-blank)  # REQUIRED for ad-hoc lines (K4) — the manual product's name
  pieceInputs?: PieceInputs       # the E1 single-piece fields
  filamentValues?: FilamentValues # resolved filament snapshot (costPerRoll, rollWeightKg, material?)
  printerValues?: PrinterValues   # resolved printer snapshot (machineValue, lifetime, avgPowerKw, reserve?)
  tariffPerKwh?: decimal-string
  includeMarketplace?: boolean
  channels?: ChannelSlot[]        # optional per-line marketplace slots (nullable fees = live catalog)
  otherCosts?: OtherCost[]
  # exactly one of {productId} OR {pieceName + full ad-hoc value-set} must resolve; else 422 (no oracle)

BomIn:
  name: string (non-blank)
  lines: BomLineIn[]              # 0..N

BomLineOut:                      # amended 2026-07-11 (T012): the FULL resolved value-set
  id: uuid
  position: integer
  quantity: integer
  productId: uuid | null
  pieceName: string | null       # the live product's name; null once degraded (UI: "(avulsa)" + a calm
                                 #   "valores mantidos" caption — never a removal claim, F1/K3; ux §1.2-D)
  degraded: boolean              # true when productId is null but a reference existed (last-known in use)
  # Resolved (live product → resolved, else last-known snapshot). The line is SELF-SUFFICIENT for
  # computeBom (ADR-0016) — the client never needs a second round-trip to price it.
  pieceInputs: PieceInputs
  filamentValues: FilamentValues
  printerValues: PrinterValues
  tariffPerKwh: decimal-string
  includeMarketplace: boolean
  channels: ChannelSlot[]
  otherCosts: OtherCost[]

BomOut:
  id: uuid
  name: string
  lines: BomLineOut[]
  createdAt, updatedAt: string (ISO)
  # WRITE responses only (POST/PUT) — what the save did per ad-hoc line, so the client can message
  # "criado no catálogo" vs "referenciou o existente" honestly (K4):
  materializations?: [{ position: integer, productId: uuid, action: "created" | "referenced" }]
  # NO price field — the client recomputes via computeBom (ADR-0016)
```

`PieceInputs`, `ChannelSlot` (nullable fees), `OtherCost` are **reused verbatim** from the E2 products contract
(`products.py`) — same names, same validation (finite ≥ 0, `rollWeightKg` > 0, decimal-string money).

## Atomic materialization on write (ADR-0017 — K3/K4, R8)

- ONE server transaction per POST/PUT: for each ad-hoc line, **dedup** then **materialize** then create the
  kit + lines — a denied or failed save materializes NOTHING (spec edge; all-or-nothing).
- **Dedup (K4)**: per-account, `btrim(name)` **exact** (case-sensitive) match against **live** products only
  (`deleted_at IS NULL`). Hit → the line references the existing product (`action: "referenced"`; the typed
  values are superseded — surfaced honestly by the client). Miss → a **manual product** is created
  (`action: "created"`): refs NULL + the full value snapshot (the existing products CHECKs already admit this
  row shape — NO products migration).
- The **FR-310 relaxation lives ONLY here** (service-level construction). The public `POST /api/v1/products`
  keeps requiring saved filament+printer references — its contract is unchanged.
- Consequence: **every persisted `bom_line` is born with `product_id`**; the snapshot-only branch of the
  `bom_lines` CHECK is reachable only via D6 degradation (product deleted later), never at create.
- No `products(owner_uid, name)` unique index (E2 allows duplicate names today; a constraint could fail
  existing accounts). Dedup is service logic inside the transaction.

## Validation (server, mirrors products)

- Rejected input is NEVER stored (FR-306 lineage); per-field finite ≥ 0; denominators > 0.
- `productId` must resolve to an **owned, live** product, else `422` `VALIDATION_ERROR` (no existence oracle).
- An ad-hoc line without `pieceName` (or with a blank one) → `422` (K4 — the manual product needs a name).
- Link-or-snapshot enforced by the DB CHECK + a pydantic `@model_validator` (mirror `products` `_link_or_snapshot`).

## Contract drift-guard

New routes ripple: `export_openapi.py` → `contracts/openapi.json` → Orval regen → `git diff --exit-code`.
`generated.ts` stays RAW Orval output (prettier/eslint-exempt via `.prettierignore`). No new `ErrorCode`
needed — `ENTITLEMENT_REQUIRED` + `VALIDATION_ERROR` already exist (E2).
