# Contract — E2 API surface (wire-level, camelCase per ADR-0002)

Every operation below is **published honestly** (only reachable statuses; all reachable statuses) and is
auto-fuzzed by the 006 Schemathesis conformance suite from the day it lands (token stub stays invalid → a
fuzzed bearer yields a stable 401 and never reaches the DB). Error schema = the existing `ErrorEnvelope`.
**New `ErrorCode`: `ENTITLEMENT_REQUIRED`** (403) — the only addition (no quota/conflict codes; they would be
phantoms). DB↔wire field mapping lives in [data-model.md](../data-model.md) §8.

## Authorization model (FR-301 precision, ADR-0012)

| Account state | Reads (list/get) | Writes (create/update/delete) |
|---|---|---|
| `active` (granted, not expired/revoked) | 200 | allowed |
| `lapsed` (had a grant; expired/revoked) | 200 — **read-only freeze (Q3)** | `403 ENTITLEMENT_REQUIRED` |
| `none` (never granted) / signed-out | `403 ENTITLEMENT_REQUIRED` / `401` | `403` / `401` |

All checks server-side via the `require_entitlement` dependency; the client is never consulted.

## Resources

### Filaments — `/api/v1/filaments`
| Operation | Success | Errors (all `ErrorEnvelope`) |
|---|---|---|
| `GET /filaments` (list, unpaginated) | `200 FilamentList` | `401`, `403` |
| `POST /filaments` | `201 Filament` | `401`, `403`, `422` (validation — REAL: body has constrained fields) |
| `GET /filaments/{id}` | `200 Filament` | `401`, `403`, `404` |
| `PUT /filaments/{id}` | `200 Filament` | `401`, `403`, `404`, `422` |
| `DELETE /filaments/{id}` | `204` | `401`, `403`, `404` |

`Filament` (wire): `{ id, name, material, costPerRoll, rollWeightKg, defaultWasteGrams? , createdAt, updatedAt }`
— money/rates as pt-BR-agnostic decimal strings on the wire (JSON number precision is not trusted for money);
validation mirrors the E1 calculator rules (finite, ≥ 0; rollWeightKg > 0).

### Printers — `/api/v1/printers` (same operation × status table as filaments)

`Printer`: `{ id, name, machineValue, machineLifetimeHours, avgPowerKw, maintenanceReservePerHour?, createdAt, updatedAt }`
— `machineLifetimeHours > 0` (the E1 denominator rule).

### Products — `/api/v1/products` (same operation × status table)

`Product`: `{ id, name, filamentId?, printerId?, filamentValues, printerValues, pieceInputs, channels[],
otherCosts[], tariffPerKwh, createdAt, updatedAt }` where:
- `filamentId`/`printerId` nullable references; `filamentValues`/`printerValues` are the **resolved values**
  (live from the linked row while linked; last-known editable fallback after the reference is deleted —
  data-model D3, US6-4). The server enforces "link OR full snapshot" (CHECK).
- `pieceInputs` = the E1 piece fields (printGrams, printTimeHours, finishing, labor, markups…);
  `channels[]`/`otherCosts[]` = the same shapes the calculator form uses (validated JSONB, money-as-string).
- Reopening a product **never returns a stored price** — prices are recomputed client-side with the current
  `PRICING_MODEL_VERSION` (FR-310; the backend never computes prices, FR-313).

### Entitlement — `GET /api/v1/entitlement`
| Operation | Success | Errors |
|---|---|---|
| `GET /entitlement` | `200 { status: "none"\|"active"\|"lapsed", source?, expiresAt? }` | `401` |

Any authenticated account may ask its own status (this endpoint TELLS you your state — no 403). `grantor` is
never exposed to the client. Conta renders this honestly (FR-304) with the ≤1-refresh window UX.

## Explicitly NOT in the contract

- No pagination params (small personal catalog — research R4); revisit only with measured need.
- No admin/grant HTTP route — granting is the operator CLI (ADR-0012); "operator-only" holds by absence of a
  path.
- No bulk operations, no search/filter params, no PATCH (PUT full-update matches the small forms).

## Ripple obligations (same-commit per route group)

`ErrorCode.ENTITLEMENT_REQUIRED` → `contracts/openapi.json` regen → Orval client regen (TS union gains the
code) → pt-BR message in `shared/api/error-messages` ("Salvar faz parte do Premium." — final copy with US7)
→ contract drift-guard green → conformance suite green.
