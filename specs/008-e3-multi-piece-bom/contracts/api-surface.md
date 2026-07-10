# API Surface — E3 BOM persistence

Mirrors the E2 catalog surface (`backend/app/api/products.py`). All routes are under `/api/v1/boms`,
per-account, camelCase wire, **money as decimal strings** (never floats), `ErrorCode` envelopes, correlation
header. Persistence is the **server-authoritative** boundary (ADR-0015): writes pass `require_entitlement`
(active only); reads pass `require_catalog_read` (active | lapsed).

> Compute is **not** an endpoint — `computeBom` runs client-side (ADR-0016). The backend stores/serves BOM
> **inputs/structure**, never a price (FR-407).

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
  pieceInputs?: PieceInputs       # ad-hoc / last-known override (the E1 single-piece fields)
  channels?: ChannelSlot[]        # optional per-line marketplace slots (nullable fees = live catalog)
  otherCosts?: OtherCost[]
  # exactly one of {productId, pieceInputs} must resolve — link-or-snapshot; else 422 (no existence oracle)

BomIn:
  name: string (non-blank)
  lines: BomLineIn[]              # 0..N

BomLineOut:
  id: uuid
  position: integer
  quantity: integer
  productId: uuid | null
  degraded: boolean              # true when productId is null but a reference existed (last-known in use)
  pieceInputs: PieceInputs       # resolved (live product → resolved, else last-known snapshot)
  channels: ChannelSlot[]
  otherCosts: OtherCost[]

BomOut:
  id: uuid
  name: string
  lines: BomLineOut[]
  createdAt, updatedAt: string (ISO)
  # NO price field — the client recomputes via computeBom (ADR-0016)
```

`PieceInputs`, `ChannelSlot` (nullable fees), `OtherCost` are **reused verbatim** from the E2 products contract
(`products.py`) — same names, same validation (finite ≥ 0, `rollWeightKg` > 0, decimal-string money).

## Validation (server, mirrors products)

- Rejected input is NEVER stored (FR-306 lineage); per-field finite ≥ 0; denominators > 0.
- `productId` must resolve to an **owned, live** product, else `422` `VALIDATION_ERROR` (no existence oracle).
- Link-or-snapshot enforced by the DB CHECK + a pydantic `@model_validator` (mirror `products` `_link_or_snapshot`).

## Contract drift-guard

New routes ripple: `export_openapi.py` → `contracts/openapi.json` → Orval regen → `git diff --exit-code`.
`generated.ts` stays RAW Orval output (prettier/eslint-exempt via `.prettierignore`). No new `ErrorCode`
needed — `ENTITLEMENT_REQUIRED` + `VALIDATION_ERROR` already exist (E2).
