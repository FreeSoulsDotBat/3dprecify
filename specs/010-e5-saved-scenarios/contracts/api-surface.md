# Contract — `/api/v1/scenarios` (E5)

Server-authoritative persistence for **saved marketplace scenarios** (ADR-0012 entitlement seam reused verbatim,
no new gate). Mirrors the E3 `/api/v1/boms` surface (`backend/app/api/boms.py`). Wire is **camelCase**; **all
money is a decimal STRING**, never a float (the `products.channels`/`snapshots.payload` invariant). `ErrorCode`
envelopes + correlation header as everywhere. **Status: DRAFT — proposed for owner sign-off (Principle VIII).**

> **A scenario stores INTENT, not resolved values (Q3).** The server persists the channel set + determinants +
> explicit per-slot overrides + framing + Outros custos + cost basis. It **stores no resolved fee and no price**
> (mirrors E2/E3: *"stores its INPUTS/STRUCTURE and never a price"*). The **live recompute runs client-side** in
> `pricing-core` on reopen (FR-619, ADR-0015). **The backend never recomputes any price** (ADR-0008).
>
> **A scenario materializes nothing (FR-604).** Unlike an E3 kit-save (ADR-0017), a scenario write creates **no**
> product, kit, filament or printer — it *references* the catalog, it never mutates it. There is no
> `materializations` envelope.

## Endpoints

| Method | Path | Auth | Entitlement | Success | Notes |
|---|---|---|---|---|---|
| `POST` | `/api/v1/scenarios` | required | `require_entitlement` (ACTIVE) | `201 ScenarioOut` | create; stores intent; materializes nothing |
| `GET` | `/api/v1/scenarios` | required | `require_catalog_read` (active\|lapsed) | `200 ScenarioList` | keyset paginated; `?q=` name search; readable on lapse (FR-612) |
| `GET` | `/api/v1/scenarios/{id}` | required | `require_catalog_read` (active\|lapsed) | `200 ScenarioOut` | own only; the cost basis is **resolved server-side** (D3/D6) |
| `PUT` | `/api/v1/scenarios/{id}` | required | `require_entitlement` (ACTIVE) | `200 ScenarioOut` | **full-config replace (edit)** — the four-object-map "whole config editable" path ⚠ |
| `PATCH` | `/api/v1/scenarios/{id}` | required | `require_entitlement` (ACTIVE) | `200 ScenarioOut` | **rename** — `name`/`note` only (`extra="forbid"`); anything else ⇒ 422 |
| `POST` | `/api/v1/scenarios/{id}/duplicate` | required | `require_entitlement` (ACTIVE) | `201 ScenarioOut` | independent copy (new id, new name); original untouched (FR-610) |
| `DELETE` | `/api/v1/scenarios/{id}` | required | `require_entitlement` (ACTIVE) | `204` | soft-delete (voluntary; a lapse never deletes, FR-612) |

**Denials (honest):** free/none write → `403 ENTITLEMENT_REQUIRED`, nothing persisted (SC-604); signed-out →
`401` before any entitlement check; another account's scenario → `404` (**indistinguishable from non-existent**,
no existence oracle — SC-609/FR-605); **lapsed** write → `403`, lapsed **read/reopen** → `200` (recompute is a
read, FR-612/SC-608). A free/signed-out/locally-faked-premium caller on **any** endpoint persists/reads nothing.

> ⚠ **`PUT` is added to resolve a spec/task-list tension (Principle VIII surface, flagged in `research.md`).** The
> spec's four-object map says a scenario is *"Editable: yes — name + whole config"* (like E2 products / E3 kits,
> which have `PUT` full-replace), but the brief's enumerated op-list was create·list·get·rename·duplicate·delete.
> `PUT` is the full-config-edit path (mirrors `PUT /boms/{id}`); `PATCH` is the lightweight rename (no need to
> re-send the whole config just to relabel from the list). **Owner-decided 2026-07-19: BOTH confirmed as separate
> routes.**

## Schemas (camelCase; money = decimal strings)

```jsonc
// ── WRITE body (POST create, PUT full-replace edit) ────────────────────────────────────────────────
ScenarioIn:
  name: string (non-blank, <= 120)          // required (FR-602; cap owner-decided 2026-07-19)
  note?: string | null (<= 500)              // optional (Q6 / FR-602; cap owner-decided 2026-07-19)
  config: ScenarioConfig                      // the seller's INTENT — never resolved values

ScenarioConfig:                               // the data-model §3 envelope, mirrored FIELD-FOR-FIELD (the §9.2
                                              // binding — reconciled 2026-07-19); stored whole, edited whole
  schemaVersion: 1                            // int — mirrors config_schema_version (the VR-613 DB CHECK)
  includeMarketplace: boolean                 // "Incluir marketplaces no preço" (005 FR-113)
  costBasis: CostBasis                        // discriminated — ad-hoc OR a soft Product/Kit reference (Q2)
  channels: ChannelIntent[]                   // 0..N channel slots — determinants + EXPLICIT overrides only
  otherCosts: OtherCost[]                     // itemized "Outros custos" ({ name, value: decimal-string })

ChannelIntent:                                // stores INTENT; an ABSENT override = "re-resolve live"
  marketplace: string                         // MarketplaceId (005): "MERCADO_LIVRE" | "AMAZON" | "SHOPEE" | "OUTRO"
  modality: string                            // the determinant (ML listingType / Amazon plan; Shopee/Outro "")
  feeOverrides?: {                            // PARTIAL map — ONLY the seller's explicit per-slot adjustments
    commissionPct?: decimal-string            //   (FR-607). A PRESENT leaf keeps the seller's number + the
    fixedFee?: decimal-string                 //   "ajustado por você" seal; an ABSENT leaf (or the whole key
    minPerItem?: decimal-string               //   absent) re-resolves from today's fee catalog by determinants
    freightCost?: decimal-string              //   on reopen. NEVER a stored resolved fee.
  }

CostBasis:                                    // exactly one valid shape (a @model_validator enforces it; else 422)
  kind: "AD_HOC" | "PRODUCT" | "KIT"
  ref:  { id: uuid, name: string } | null     // SOFT reference (no FK, N2); null ⇒ pure ad-hoc
  lastKnown:                                  // the D6 fallback — re-captured from the live ref on EVERY save
    # AD_HOC | PRODUCT → one fully-resolved PriceInput (piece inputs + filament/printer values + tariff
    #   + markups — the products/bom_lines resolved shape; every numeric leaf a decimal STRING)
    # KIT → { lines: [ { name: string, quantity: int, input: <resolved PriceInput> }, … ] }
```

The `PriceInput` sub-shapes inside `lastKnown` (`pieceInputs`, filament/printer values) and `OtherCost` are
**reused verbatim** from the E2/E3 products contract (`products.py`) — same names, same validation (finite ≥ 0,
`rollWeightKg` > 0, decimal-string money); the KIT `lines[]` mirror the resolved shape the E3 read path already
produces (`BomLineOut`) — captured so a deleted reference degrades losslessly.

```jsonc
// ── READ body (GET/{id}, POST, PUT, PATCH, duplicate responses) ─────────────────────────────────────
ScenarioOut:
  id: uuid
  name: string
  note: string | null
  config: ResolvedScenarioConfig              // same as ScenarioConfig, but the costBasis is RESOLVED
  createdAt, updatedAt: string (ISO)          // createdAt is the list sort key (owner-decided 2026-07-19);
                                              // a scenario carries NO user-facing date (the four-object map)

ResolvedScenarioConfig:                       // channels/otherCosts/includeMarketplace echoed back verbatim
  ...                                          // (INTENT); only the costBasis is resolved for the live recompute
  costBasis: ResolvedCostBasis

ResolvedCostBasis:                            // the server's single live-vs-degraded decision (owner + live filter)
  # AD_HOC: the stored lastKnown, echoed verbatim
  { kind: "AD_HOC", ref: null, degraded: false, lastKnown: <as stored> }
  # PRODUCT/KIT, reference resolves (D3): the LIVE values (a since-save edit is reflected on this reopen)
  { kind: "PRODUCT"|"KIT", ref, degraded: false, lastKnown: <re-resolved from the live row> }
  # PRODUCT/KIT, reference gone (D6): the captured last-known snapshot, still editable + re-saveable
  { kind: "PRODUCT"|"KIT", ref, degraded: true, lastKnown: <as stored at last save> }
```

```jsonc
// ── RENAME body (PATCH) — name/note ONLY (extra="forbid"): a smuggled config field ⇒ 422 ────────────
RenameIn:
  name?: string (non-blank, <= 120)
  note?: string | null
```

```jsonc
// ── LIST response (GET) — keyset paginated, unbounded per account ────────────────────────────────────
ScenarioList:
  items: ScenarioOut[]                        // newest-saved first (createdAt DESC, id DESC — owner 2026-07-19)
  nextCursor: string | null                   // opaque keyset cursor; null when the last page was returned
```

## List, search, pagination (mirrors E4 R5)

- **Keyset/cursor pagination**, never `OFFSET` (the list is **unbounded** per premium account — FR-611 "without
  the list becoming unusable at volume"). Cursor = `(createdAt, id)` descending; page size ~25. **A page size is
  not a cap** — every scenario stays reachable by paging; no silent limit may be introduced (that would be a
  business-rules amendment).
- **Newest-saved first** (`createdAt DESC, id DESC` — **owner-decided 2026-07-19**: a stable keyset cursor,
  matching the data-model §5 partial index). A scenario carries **no user-facing date** (the four-object map);
  the list still shows `updatedAt` as the "last-updated" label.
- **Name search** `?q=`: owner-scoped, case-insensitive substring `name ILIKE '%term%'` (FR-611). Accent
  sensitivity inherits the E4 §D4 posture (accent-sensitive unless the owner later adds `unaccent`).

## The resolved cost basis (D3/D6 — reused from E3, not reinvented)

`GET /scenarios/{id}` (and every write response) resolves `config.costBasis` **server-side**, the single
live-vs-degraded decision, reusing the E3 `_resolve_views` owner + `deleted_at IS NULL` seam:

- **AD_HOC** ⇒ the stored inputs, echoed verbatim (`degraded: false`).
- **PRODUCT / KIT that resolves (D3 live-reflect)** ⇒ the **live** value-set (a product/kit edited since save is
  reflected on this reopen — the opposite of an E4 snapshot). `degraded: false`.
- **PRODUCT / KIT that no longer resolves (D6 last-known)** ⇒ the **captured last-known snapshot** (re-captured on
  every scenario save, lossless), `degraded: true`, the captured `refName` still shown — **never blank, never a
  "removido" claim**, still priceable-as-loaded and re-saveable.

The **"abrir origem"** affordance is resolved at read time (offered only if `refId` resolves owned + live);
absent ⇒ the affordance is simply not offered (no broken link) — the E3/E4 posture.

## Duplicate (`POST /scenarios/{id}/duplicate`)

- Copies the stored `config` verbatim (intent, including the captured basis snapshot + `refId`) into a **new
  row** with a new id and a fresh name (e.g. `"Cópia de {name}"`). Editing the copy changes **0%** of the
  original and vice versa (FR-610/SC-605) — guaranteed by construction (separate rows). Materializes **nothing**
  (FR-604/SC-606). The copy references the same product/kit and re-resolves live on its own reopen.

## Validation (server, mirrors products/boms)

- Rejected input is **never** stored. `config` money/rate/quantity/percent leaves are **finite decimal strings**;
  a JSON **float** leaf ⇒ `422` (the recursive validator + a stored round-trip re-scan). Magnitude ceilings mirror
  `products.py::_CEIL_*`. A `config` over the size cap ⇒ **honest 422**, never a silent truncation.
- `costBasis` must be exactly one valid kind (`@model_validator`), else `422`. A `PRODUCT`/`KIT` `refId` that does
  **not** resolve to an owned item at **save** time is **not** an error — the scenario saves with the reference +
  the current snapshot, and degrades honestly on reopen (D6). *(Distinct from E3 kit-save, which 422s a dangling
  `productId` because it materializes; E5 materializes nothing and stores intent.)* **Owner-decided 2026-07-19
  (Q13): accept-and-degrade.**
- `PATCH` (rename) with any field other than `name`/`note` ⇒ `422` (`extra="forbid"`) — never a silent ignore.
- Per-account isolation on every path: a wrong-owner/soft-deleted/malformed id ⇒ `404` (no existence oracle).

## Error codes (all reused — E5 introduces none)

| Code | Status | When |
|---|---|---|
| `ENTITLEMENT_REQUIRED` | 403 | free / signed-out / lapsed **write** / locally-faked-premium — nothing persisted or read |
| `VALIDATION_ERROR` | 422 | malformed `config` (float leaf, over size cap, bad basis kind), smuggled `PATCH` field |
| `NOT_FOUND` | 404 | wrong owner / soft-deleted / malformed id (no existence oracle) |
| *(401)* | 401 | no/invalid bearer — before any entitlement or resolution |

## Contract drift-guard (the standing rule)

New routes ripple: `export_openapi.py` → `contracts/openapi.json` → Orval regen → `git diff --exit-code`.
`generated.ts` stays RAW Orval output (prettier/eslint-exempt via the ROOT `.prettierignore`). Regenerate from
the **repo root** and prove idempotence after **any** route or docstring change — the drift-guard fires on a
route docstring edit too (a FastAPI docstring becomes the OpenAPI `description`). No new `ErrorCode` is needed.

## Offline (Q4 — online-only writes; the read cache is reused)

- **Writes are online-only.** A save/rename/duplicate/delete attempted offline **fails honestly** (no silent
  drop, no fake "salvo!") — the E2/E3 posture; the E4 outbox (ADR-0018) is deliberately **not** reused (FR-613).
- **Reads are cached.** After one online load, the account's scenarios are readable + re-openable offline from the
  uid-keyed `idb-keyval` cache (the last `GET` response, incl. the last-resolved basis); the live recompute uses
  the cached catalog + fee reference and shows the 005 staleness seal if stale (FR-608/FR-614). **Sign-out purges
  the uid-keyed scenarios cache** (the shipped purge-on-signout sweep).
