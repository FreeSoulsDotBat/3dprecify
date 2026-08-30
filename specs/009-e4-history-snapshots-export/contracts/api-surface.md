# Contract — `/api/v1/history` (E4)

Server-authoritative persistence for snapshots (ADR-0012 entitlement seam reused verbatim) + the server-rendered
export artifacts (ADR-0020). Wire is **camelCase**; **all money is a decimal STRING**, never a float (FR-525).

> **Immutability by absence of a path (ADR-0019).** There is **no `PUT`**. `PATCH` accepts **`label` and nothing
> else** (`extra="forbid"`), so a smuggled value/date/version is a **422** — never a silent ignore. The contract
> drift-guard machine-checks that no write path appears later.

## Endpoints

| Method | Path | Gate | Notes |
|---|---|---|---|
| `POST` | `/api/v1/history` | `require_entitlement` | **The only writer of frozen fields.** Idempotent — see below. |
| `GET` | `/api/v1/history` | `require_catalog_read` | Keyset pagination, newest-first. Readable on lapse (FR-517). |
| `GET` | `/api/v1/history/{id}` | `require_catalog_read` | Returns the **stored** payload. Server performs no arithmetic. |
| `PATCH` | `/api/v1/history/{id}` | `require_entitlement` | **`label` only.** Anything else ⇒ 422. |
| `DELETE` | `/api/v1/history/{id}` | `require_entitlement` | Soft delete, owner-scoped. |
| `GET` | `/api/v1/history/{id}/quote.pdf` | `require_entitlement` (**ACTIVE**) | Customer-facing quote. Denied on lapse ⇒ **no partial artifact** (FR-515). |
| `GET` | `/api/v1/history/export.csv` | `require_entitlement` (**ACTIVE**) | Rows equal the stored snapshots **exactly** (FR-513). |

Free / signed-out on **any** of these ⇒ `403 ENTITLEMENT_REQUIRED`, nothing written, nothing read, no artifact
(SC-503, SC-507). Another account's snapshot is **indistinguishable from non-existent** — no existence oracle
(FR-511, SC-509).

## `POST /api/v1/history` — the idempotent write (ADR-0018)

The body is **self-contained and frozen at record time** on the device. It is what the outbox stores verbatim.

```jsonc
{
  "clientSnapshotId": "0192f3c1-…",   // uuid, minted on the DEVICE at RECORD time (not at send time)
  "kind": "SINGLE",                   // or "KIT"
  "label": "Cliente João — vaso G",   // optional, the ONLY mutable field later
  "quoteValidityDays": 15,            // optional (Q9)
  "deviceQuotedAt": "2026-07-12T19:30:00Z",   // the DEVICE clock — the seller's claim (FR-528)
  "deviceUtcOffsetMinutes": -180,     // so the date the seller SAW renders forever
  "modelVersion": "3.1.0",            // PRICING_MODEL_VERSION at record time
  "payload": { /* the frozen document — see data-model.md D1 */ }
}
```

**Idempotency contract (the load-bearing part — SC-513):**

- The device mints `clientSnapshotId` **at record time**. *Minting at send time regenerates after an app restart
  and duplicates.*
- The database enforces `UNIQUE (owner_uid, client_snapshot_id)` — **unconditional** (it includes soft-deleted
  tombstones, so a delete-then-retry cannot **resurrect** a snapshot).
- **Conflict ⇒ the server returns the EXISTING row with `200`.** A fresh create ⇒ `201`. **The client treats both
  identically.** A retry is therefore an idempotent success — never a duplicate, and never an error the outbox
  would misread as failure.
- **The server holds no queue state.** There is no `pending`/`rejected` column and none may be added: the row
  exists only once the server accepted it. "Pending" is **100% a device concept**.

**Responses**: `201` created · `200` already existed (idempotent replay) · `403 ENTITLEMENT_REQUIRED` (⇒ the
outbox entry becomes **blocked**, visible, retained — FR-529) · `422` invalid payload.

## Read shape

`GET` returns the stored fields verbatim. Notably it returns **`deviceQuotedAt`** — and **never** the row's
`created_at`, which exists as row metadata but is **never displayed, never exported, and never used to order or
to validate** the device date (FR-528, owner decision 2026-07-12).

Provenance is returned **from inside the payload** as a captured `{kind, id, name}` — **there is no foreign key**
(ADR-0019 §5). The client resolves the id at read time only to decide whether to offer "abrir origem"; when it no
longer resolves, **the affordance is simply absent** — no broken link, no "produto excluído" claim, no degraded
caption. A snapshot has no degraded state, because it depends on nothing.

## Export content rules (server-side, testable — ADR-0020 §4)

- **Zero internal cost lines** (material, energy, machine, failure, margin) unless `includeCostBreakdown=true` is
  explicitly passed (Q4 / FR-512 / SC-506).
- A **kit** quote **itemizes every piece** (name + quantity) with the total — and still exposes zero cost lines
  (SC-515). An opaque "Kit — R$ 500" is not acceptable.
- Every artifact carries the **device record date** and the validity period.
- Seller identity = the **verified ID-token claims** (`name` + `email`) at export time. `Account` has no
  display-name column and E4 adds **no new seller data** (Q13) — so when the claim is absent, the quote carries
  the e-mail only.
- The renderer **prints stored, already-rounded values and performs no arithmetic** — no formula, no markup, no
  gross-up. *"The backend never recomputes" (ADR-0008) stands, untouched.*
- A **pending** (unsynced) snapshot has no server row, so it **cannot be exported** until it syncs. The UI says so
  ("sincronize para exportar") — you cannot export a record the record-keeper has never seen.
