# ADR-0019: Snapshot immutability — enforcement in depth + provenance without a foreign key

- **Status**: Accepted (owner, at the E4 PR-A gate — 2026-07-16, PR #18 `b1fbd80`)
- **Date**: 2026-07-12 (accepted 2026-07-16)
- **Deciders**: Jonatan (owner) + arquiteto + dev-estrutura-de-dados, 2026-07-12
- **Relates**: ADR-0008 (what freezes) · ADR-0013 (persistence) · ADR-0017 §6 (read-time degradation)

## Context

FR-504 / SC-504: a snapshot's **contents are immutable** — no write path may alter its recorded inputs, values,
formula version or timestamp; only the **label** is editable; the whole entry is deletable by its owner. This is
the epic's headline promise (*"o Histórico prova o que você cobrou"*), and E4 must deliver it while E2/E3 trained
the codebase to expect the opposite (live-reflect + degradation).

SC-504 is phrased as an invariant — *"**0** write paths can alter…"* — which is a claim about **all future code**,
not just today's. E5 and E6 will add writers near this table.

Verified ground truth: E2/E3 use soft deletes (`deleted_at`) and link products via FKs with `ON DELETE SET NULL`.
Snapshots must **not** copy that idiom — see the decision.

## Options considered

### Option A — Defence in depth: API shape + ORM guard + DB trigger — CHOSEN
- **Pros:** the promise survives *future* code, not just current code; each layer is independently test-pinnable;
  costs no schema compromise; the API-shape layer is the idiom ADR-0012 already uses ("operator-only holds by
  absence of a path").
- **Cons:** three small places to keep coherent; the DB trigger is the project's **first PL/pgSQL** (E2 §0 had
  promised "tables / CHECK / RLS only").
- **Scalability impact:** high.
- **Confidence:** 85%

### Option B — API shape only ("no path, no problem") — rejected
- **Pros:** zero extra machinery; already true of the code we are about to write.
- **Cons:** one careless service function in a later epic silently breaks the epic's central promise and nothing
  catches it; SC-504 would degrade to an assertion about *today's* code.
- **Confidence:** 60%

### Option C — Fully append-only storage (immutable events table; label in a side table) — rejected
- **Cons:** a whole indirection (a join on every read) to accommodate one mutable field; contradicts the shipped
  soft-delete/label idiom; more weight on the data model for no product gain.
- **Confidence:** 45%

### Option D — DB trigger only — rejected
- **Cons:** a trigger exception is an ugly, untyped way to answer a caller; the API would still *offer* a path it
  cannot honour.
- **Confidence:** 40%

## Decision

**Option A** — and the owner **explicitly approved the DB trigger** (2026-07-12), accepting the project's first
PL/pgSQL, because it is what makes SC-504 demonstrable **in the database** instead of "we did not write the code
that breaks it".

1. **API shape (primary).** **No PUT.** The surface is exactly `POST /api/v1/history` (the ONLY writer of frozen
   fields) · `GET` (list) · `GET /{id}` · `PATCH /{id}` whose body model carries **`label` and nothing else**,
   with `extra="forbid"` so a smuggled value/date/version is a **422**, never a silent ignore · `DELETE /{id}`
   (soft delete, owner-scoped).
2. **ORM guard (defence against future code).** A SQLAlchemy `before_update` mapper event inspects the dirty
   attribute set and **raises** unless it is a subset of `{label, deleted_at, updated_at}`. Unit-testable
   directly ("assign a frozen attribute, flush, expect a raise"). Verify the exact `inspect(obj).attrs[…].history`
   API at implementation.
3. **DB trigger (approved).** `BEFORE UPDATE` on `snapshots`, raising unless the changed columns are a subset of
   `{label, deleted_at, updated_at}`. Portable on Cloud SQL. It surfaces as `ERRCODE 23514`.
4. **"Recalcular hoje" is a POST, never an UPDATE** — a new row with a new `clientSnapshotId`; the original is
   never read-modify-written (FR-505).
5. **Provenance carries NO foreign key.** A captured origin **id + name**, inside the frozen payload. This is the
   non-obvious one, and it **inverts the E3 instinct** — *both the arquiteto and the data-model specialist reached
   it independently*:
   - `ON DELETE SET NULL` would **write to the immutable row** on a hard purge — an immutability violation *and*
     an erasure of provenance — and, because `SET NULL` fires as an `UPDATE`, it would hit the trigger above and
     **make the product delete fail**.
   - `ON DELETE RESTRICT` would let history **hold the catalog hostage** (products become undeletable).
   - `ON DELETE CASCADE` would **delete the proof**.

   The "abrir origem" affordance is resolved **at read time** (owned + live lookup — the ADR-0017 §6 reasoning):
   absent ⇒ the affordance is simply not offered. **No broken link, no "produto excluído" claim, no degraded
   caption** — a snapshot has no degraded state because it depends on nothing (FR-503, the two-shelf rule).

## Consequences

- **Positive:** SC-504 becomes an invariant enforced by three independent layers; catalog churn cannot reach a
  snapshot **at any layer, including the DB**; the label/delete affordances stay conventional (E2/E3 idiom).
- **Negative / accepted:** the project gains PL/pgSQL (one trigger, one migration artifact); provenance ids can
  dangle (by design, harmlessly — informational, never a value source); a future developer who genuinely needs a
  new mutable field must **amend this ADR** — which is exactly the point.
- **Follow-ups:** the contract drift-guard already snapshots the OpenAPI surface, so "no PUT exists" is
  machine-checked; **E5 (scenarios) must not add a writer to this table without amending this ADR.**
