# ADR-0018: Offline snapshot outbox — device-durable queue, exactly-once sync, entitlement at sync

- **Status**: Proposed (owner accepts at the E4 PR-A gate)
- **Date**: 2026-07-12
- **Deciders**: Jonatan (owner) + arquiteto, 2026-07-12
- **Extends**: ADR-0012 (entitlement) · ADR-0013 (persistence) · ADR-0015 (enforcement honesty)

## Context

E4's owner decision Q8 (2026-07-12) **flipped** the product-owner's online-only default: recording a price
snapshot MUST work offline — the seller quoting at a fair, without connectivity — queued locally and synced when
connectivity returns (FR-527/528/529, SC-513/514). **This is the product's first offline write.**

Verified ground truth: every write in E2/E3 is online-only and says so (`entities/bom/use-bom.ts`: *"Writes are
ONLINE-ONLY — the server is the entitlement boundary (ADR-0015), so there is no optimistic fake to roll back"*),
and the only offline substrate that exists is a uid-keyed **read** cache (`idb-keyval` + TanStack Query, purged
on sign-out). Nothing can be reused wholesale.

Four constraints bind the mechanism: (1) the queue must survive an app restart/crash; (2) a queued entry must
sync **exactly once** — no duplicate across retry, reconnect, restart or two tabs; (3) it must be **visibly
pending** and never claim to be saved before it is, nor be silently dropped (Principle II); (4) an offline client
**cannot verify entitlement** — the server stays the authority (Principle IV), so a queued entry may be **denied
at sync**.

## Options considered

### Option A — App-owned uid-keyed IndexedDB outbox + app-layer sync engine + server-side dedup — CHOSEN
A dedicated `idb-keyval` store `history:outbox:{uid}` holds complete, self-contained POST bodies. The device
mints `clientSnapshotId = crypto.randomUUID()` at **record** time; the server dedupes on
`UNIQUE (owner_uid, client_snapshot_id)` and returns the existing row (200) on conflict.
- **Pros:** reuses the shipped substrate, uid-keying and purge pattern with **zero new dependencies**; a pending
  entry is ordinary data ⇒ renderable, testable, honest; token freshness is free (the app-layer transport mints
  a fresh Firebase ID token per request); exactly-once is guaranteed where it CAN be — in the database; behaves
  identically on web, desktop and the future Capacitor Android WebView.
- **Cons:** ~150 lines of machinery we own (store + engine + merge selector); we write the backoff ourselves.
- **Scalability impact:** high — the same outbox generalises to any future offline write (E5 scenarios).
- **Confidence:** 85%

### Option B — TanStack Query persisted paused mutations — rejected
- **Pros:** first-class pause/resume; less bespoke retry code.
- **Cons:** 2 new deps + a **global** query-client persister in an app that deliberately has none (everything
  persisted is uid-keyed — the identity-leak lesson); documented caveats (TanStack docs, verified 2026-07-12):
  only mutation *state* persists, *"the order in which mutations are fulfilled may differ"*, and paused-mutation
  callbacks *"won't run if your component unmounts"*; and it offers **no exactly-once guarantee** ⇒ the
  idempotency key + DB constraint are needed anyway; rendering "pending" means reading the mutation cache — an
  awkward source for a user-facing list.
- **Confidence:** 55%

### Option C — Service-Worker Background Sync (workbox-background-sync) — rejected
- **Pros:** OS-level replay even with the app closed (Chromium).
- **Cons:** it replays a **stored `Request`** whose `Authorization` header carries a Firebase ID token that
  **expires in ~1 hour** — a queue that drains "tomorrow" replays an expired token (401), and the SW cannot mint
  a fresh one (the transport mints per request from `auth.currentUser`, which lives in the window); Background
  Sync is **Chromium-only**; the queue is **opaque to the app**, so the "visibly pending" requirement — the whole
  point — would need a SW↔app channel.
- **Confidence:** 25%

### Option D — `localStorage` outbox — rejected
- **Cons:** synchronous, ~5 MB, string-only; no advantage over an IndexedDB substrate we already ship.
- **Confidence:** 20%

## Decision

**Option A.** Sub-rules, all normative:

1. **Durability.** `idb-keyval` store `history:outbox:{uid}` — the substrate is reused, the **semantics are
   not**: the read-cache helpers swallow write failures by design (*"the cache is a convenience, never
   authoritative"*); the **outbox must not** — a failed enqueue throws and the record action reports failure. At
   first enqueue the app requests `navigator.storage.persist()` (best-effort; verify the API at implementation).
2. **The entry is a complete POST body**, frozen at record time (payload + `deviceQuotedAt` + `clientSnapshotId`).
   Never re-derived, never recomputed, never patched at send time.
3. **Exactly-once *effect*** (the honest name — exactly-once *delivery* does not exist): the key is minted at
   **record** time (minting at send time regenerates after an app restart and **duplicates**), carried in the
   **body** (durable data, not a header), enforced by `UNIQUE (owner_uid, client_snapshot_id)`. Conflict ⇒ the
   server returns the existing row (**200**); a fresh create ⇒ **201**. The client treats both identically.
4. **Ambiguous failure** (request sent, response lost): the entry stays pending; retry uses the **same** key; the
   server returns what it already created. A no-response error renders **"pendente"** — never "falhou", never
   "salvo". *No answer is not the same as not saved.*
5. **Two tabs**: single-flight via `navigator.locks.request("history-outbox:" + uid, …)` (Web Locks — Baseline
   since March 2022). **Correctness does not depend on the lock** — the DB unique key does; the lock only avoids
   wasted duplicate requests.
6. **Drain triggers**: app boot (after session + entitlement resolve), the `online` event, focus /
   `visibilitychange`, and post-sign-in. Exponential backoff, capped. Entries are **independent** — a failing
   entry never blocks the queue.
7. **Honest pending state.** The Histórico list is ONE selector merging *(server list) ∪ (outbox)*, each item
   tagged `syncState: synced | pending | blocked | failed`, **deduped on `clientSnapshotId` with server-wins** —
   so no interleaving of drain and invalidation can render an entry twice or show a synced entry as pending.
   Post-sync order: delete the outbox entry → write the server entity into the read cache → invalidate the query
   key. *(The E3 PR-C lesson — a correct component starved of correct data still lies — is answered
   structurally: no component may read the server query alone; the pending union IS the list.)*
8. **Entitlement at sync (FR-529).** A 403 `ENTITLEMENT_REQUIRED` ⇒ the entry becomes **blocked**: retained in
   the outbox, auto-retry stopped, rendered honestly ("não foi registrado — precisa de Premium ativo") with
   **Tentar novamente** and **Descartar** (destructive, confirmed). On the next `active` entitlement, blocked
   entries retry automatically. **Never silently discarded; never left claiming to be saved.** Recording is only
   OFFERED when the **last-known server** entitlement was `active` (ADR-0015's nuance: a cached server response,
   never a client-held flag).
9. **Sign-out with a non-empty queue.** A **blocking, honest guard** at the sign-out action: a dialog stating how
   many entries are unsynced, offering **[Sincronizar agora]** (online only) · **[Sair e descartar]** (explicit
   destructive confirm) · **[Cancelar]**. Discard purges the outbox key with the uid-keyed sweep. Entries never
   vanish silently and never leak into the next account. *Alternatives weighed: retain-across-sign-out (60% —
   zero data loss, but it contradicts the shipped purge-on-signout privacy guarantee: unsynced quotes with client
   names and prices left on a shared device); block-sign-out-until-drained (35% — offline, the user could never
   sign out); discard-with-a-toast (25% — that IS a silent drop, with a receipt).*

## Consequences

- **Positive:** the product's first offline write lands with **0 new dependencies**; duplicates are impossible at
  the storage layer (not by client cleverness), so the guarantee survives restarts and tabs; the pending state is
  data, so it can be rendered, tested and audited; Principle IV is untouched — the queue is a client convenience,
  the server remains the authority.
- **Negative / accepted:** a queued snapshot is durable *in practice*, not *in guarantee* — IndexedDB may be
  evicted under storage pressure if `navigator.storage.persist()` is not granted; the UI must therefore say
  "pendente **neste dispositivo**", not "guardado". We own the retry/backoff code. Sign-out gains one dialog on a
  path that is currently one click.
- **Follow-ups:** the data model supplies `UNIQUE (owner_uid, client_snapshot_id)` (ADR-0019 / `data-model.md`)
  and a POST that resolves a conflict by returning the existing row; **ADR-0020 makes a pending snapshot
  non-exportable until it syncs** — an honest coupling, stated in the UI.

### Sources verified (2026-07-12)
- Web Locks API (cross-tab exclusive locks; Baseline since March 2022): <https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API>
- TanStack Query v5 — mutations/offline caveats: <https://tanstack.com/query/latest/docs/framework/react/guides/mutations>
