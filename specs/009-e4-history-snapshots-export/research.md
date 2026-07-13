# Phase 0 Research — E4 Histórico + snapshots reproduzíveis + export

Architecture decisions for E4 (arquiteto round, 2026-07-12), taken BEFORE implementation per Constitution
Principle VIII. Format: **Decision · Rationale · Alternatives (with confidence) · Risks pinned · Tests that
must exist**. Every claim below is checked against the shipped code (paths cited), not inferred.

**Scope split**: the DATA MODEL (frozen-payload shape, migration `0003`, DB constraints, indices) is owned by
`dev-estrutura-de-dados` in parallel. This document states the **requirements** those structures must satisfy
(collected in §"What the data model must provide") and never designs a table.

**Verified ground truth (repo, 2026-07-12)** — the premises every decision below rests on:
- The offline substrate is **`idb-keyval` (IndexedDB)** + TanStack Query, **uid-keyed**, purged on sign-out:
  `apps/web/src/entities/catalog/catalog-cache.ts`, `entities/bom/bom-cache.ts`, wired at
  `apps/web/src/app/providers.tsx` (a `useSessionStore.subscribe` that fires **after** the session goes
  anonymous — reactive, best-effort, never blocking).
- **Every write in E2/E3 is online-only** and says so: `entities/bom/use-bom.ts` — *"Writes are ONLINE-ONLY —
  the server is the entitlement boundary (ADR-0015), so there is no optimistic fake to roll back when it
  denies."* There is no queue, no outbox, no paused-mutation machinery anywhere (confirmed in
  `graphify-out/GRAPH_REPORT.md` — the only offline community is "Catalog Offline Cache", a **read** cache).
- The transport (`shared/api/transport.ts`) mints a **fresh Firebase ID token per request** and normalises a
  network-phase failure into `ApiError{status: 0, code: "UNKNOWN"}` — i.e. *"no response"*, which is **not**
  the same as *"not saved"*. Load-bearing for R1's ambiguous-failure rule.
- The entitlement seam (`backend/app/entitlement/__init__.py`): `require_entitlement` (active-only, writes) /
  `require_catalog_read` (active|lapsed, reads), denying with `ENTITLEMENT_REQUIRED` (403). Reused verbatim.
- **E2/E3 persist INPUTS, never prices** (`backend/app/api/boms.py`: *"stores its INPUTS/STRUCTURE and never a
  price (FR-407)"*). **E4 is the first time the product stores client-computed MONEY** — see §"Honest limits".
- `packages/pricing-core/src/index.ts`: `PRICING_MODEL_VERSION = "3.1.0"`, `computeCalculator → PriceResult`
  (rounded lines + itemized `otherCosts[]` + `channels[]`), `computeBom → BomResult` (per-line result +
  quantity-scaled money + per-marketplace rollup). Everything a snapshot must freeze already exists.
- `backend/app/models/__init__.py`: `Account` has **`email` but NO display-name column**; every table carries a
  server-default `created_at`; deletes are **soft** (`deleted_at`) everywhere.
- PWA = `vite-plugin-pwa` in **generateSW** mode with no `runtimeCaching` (`apps/web/vite.config.ts`); Android is
  planned as **Capacitor** (`base: "./"`, tech-stack X.3 — `cap add android` post-MVP), i.e. the same web bundle
  in a WebView.

---

## R1 — The offline write queue (FR-527/528/529, SC-513/514) → **ADR-0018**

**The product's first offline write.** Nothing in E2/E3 can be reused wholesale: the existing offline substrate
is a *disposable projection of server truth*, while a queued snapshot is **the only copy of user data in
existence**. That asymmetry drives every sub-decision.

### Decision

An **app-owned, uid-keyed IndexedDB outbox + an app-layer sync engine**, with **exactly-once effect guaranteed
on the server** by a device-minted idempotency key:

1. **Local durability** — a dedicated IndexedDB store via the already-vendored `idb-keyval`, key
   `history:outbox:{uid}` (uid-keyed, exactly like the read caches; *separate key and separate module* from the
   `history:{uid}` read cache). It **reuses the substrate, not the semantics**: the read-cache helpers swallow
   write failures by design (*"the cache is a convenience, never authoritative"*, `catalog-cache.ts`) — the
   outbox **must not**. A failed outbox write MUST throw and the record action MUST report failure, never a
   fake "salvo". At first enqueue the app requests `navigator.storage.persist()` (best-effort protection from
   storage-pressure eviction; verify the API at implementation, do not assume the grant).
2. **The entry is a complete, self-contained POST body**, frozen at record time (payload + device
   `quotedAt` + `clientSnapshotId`). It is never re-derived, never re-computed, never patched at send time.
3. **Exactly-once (SC-513)** — the device mints `clientSnapshotId = crypto.randomUUID()` **at record time**
   (never at send time) and stores it *inside* the entry. It travels in the **request body** (not a header) so it
   is durable data with a **DB unique constraint** behind it. The server dedupes on `UNIQUE (owner_uid,
   client_snapshot_id)`: an insert that conflicts returns the **existing** row (`200`) instead of creating a
   second (a fresh create returns `201`). The client treats 200 and 201 identically.
   > Honest naming: exactly-once *delivery* does not exist. What we guarantee — and what SC-513 actually asks
   > for — is **exactly-once effect**: at-least-once delivery + an idempotent server ⇒ 0 duplicate rows and 0
   > duplicate list entries, across retry, reconnect, app restart and two tabs.
4. **Ambiguous failure (request sent, response lost)** — the entry stays `pending`; the engine retries with the
   **same** `clientSnapshotId`; the server returns the row it already created (200); the client reconciles.
   The UI MUST render `ApiError{status: 0}` as **"pendente"**, never "falhou" and never "salvo" — status 0 means
   *no answer*, which is genuinely unknown, and the honest word for unknown is pending.
5. **Two tabs** — single-flight the drain with `navigator.locks.request("history-outbox:" + uid, …)`
   (Web Locks: cross-tab, same-origin, exclusive; MDN: *Baseline widely available since March 2022*, secure
   context — our origins are HTTPS/localhost and the Capacitor Android WebView serves `https://`). **Correctness
   does not depend on the lock**: the DB unique key is the guarantee; the lock only prevents wasted duplicate
   requests. If `navigator.locks` is unavailable, the engine still behaves correctly.
6. **Drain triggers**: app boot (after the session + entitlement resolve), the `online` event, window focus /
   `visibilitychange`, and after a successful sign-in. Backoff is exponential with a cap. Entries are
   **independent** (a snapshot is an assertion, not a mutation of shared state) ⇒ a failing entry MUST NOT block
   the rest of the queue.
7. **Honest pending state (Principle II + the E3 PR-C lesson)** — the Histórico list is rendered from **one
   selector** that merges *(server list) ∪ (outbox entries for this uid)*, tagging each item
   `syncState: "synced" | "pending" | "blocked" | "failed"`. **The merge dedupes on `clientSnapshotId`,
   server-wins** — so even if an invalidation races a drain, an entry can never render twice, and a synced entry
   can never render as pending. Post-sync order is fixed: (a) delete the outbox entry, (b) write the
   server-returned entity into the uid-keyed read cache, (c) invalidate the history query key. *The E3 lesson —
   a correct component starved of correct data still lies — is answered structurally: no component may read the
   server query alone; the pending union IS the list.*
8. **Entitlement AT SYNC (FR-529, Principle IV)** — a 403 `ENTITLEMENT_REQUIRED` at sync moves the entry to
   **`blocked`**: it **stays in the outbox**, auto-retry stops (no retry storm), and it renders honestly in the
   Histórico ("não foi registrado — precisa de Premium ativo") with two explicit actions: **Tentar novamente**
   and **Descartar** (destructive, confirmed). When `GET /api/v1/entitlement` next reports `active`, blocked
   entries are re-attempted automatically. **Never silently discarded, never left claiming to be saved.**
   The record affordance itself is only offered when the **last-known server** entitlement was `active`
   (ADR-0015's guard nuance: last-known server response ≠ client-held flag); if the app has never seen an
   `active` answer, recording is not offered offline — it says so honestly instead of queueing a write that is
   certain to be denied.
9. **Sign-out with a non-empty queue (spec's open question)** — a **blocking, honest sign-out guard**: if the
   outbox for the current uid is non-empty, the sign-out action opens a dialog stating exactly how many entries
   are unsynced and offering **[Sincronizar agora]** (enabled only when online) · **[Sair e descartar]**
   (explicit destructive confirmation) · **[Cancelar]**. Discarding purges the outbox key with the rest of the
   uid-keyed sweep. So: **they never vanish silently** (the user is told and must confirm) and they **never leak
   into the next account** (uid-keyed + purged).
   *Wiring note (verified)*: `providers.tsx`'s session subscription runs **after** sign-out has happened, so it
   cannot host a confirmation — the guard belongs at the sign-out **action** (`widgets/top-bar` + the Conta
   page). The subscription keeps purging as the backstop.

### Rationale

The three candidate mechanisms are not equivalent under our constraints: the SW/Background-Sync route replays a
**stored `Request`** whose `Authorization` header carries a Firebase ID token that **expires in ~1 hour** — a
queue that syncs "when connectivity returns, maybe tomorrow" would replay expired tokens (401) and the SW cannot
mint a fresh one (`transport.ts` mints per request from `auth.currentUser`, which lives in the window). The
TanStack persisted-mutation route is real but buys retry orchestration we can write in ~100 lines while
importing a **global** query-client persister into an app that deliberately avoided one (the identity-leak
lesson: everything persisted here is uid-keyed) — and it still requires the server dedup key, because TanStack
guarantees no such thing (its own docs: *only mutation state is persisted, functions cannot be serialized*;
*"the order in which mutations are fulfilled may differ"*; paused-mutation callbacks *"won't run if your
component unmounts"*). The outbox we own is smaller, boundary-clean (FSD-Lite: `entities/history` owns the
store + the engine; the page renders), fully testable in vitest with a fake IndexedDB, and it makes the pending
state a **first-class piece of data we can render** rather than an opaque queue inside a service worker.

### Alternatives considered

| Option | Pros | Cons | Scalability | Conf. |
|---|---|---|---|---|
| **A — App-owned uid-keyed IndexedDB outbox (`idb-keyval`) + app-layer sync engine + server dedup on a device-minted key** (CHOSEN) | reuses the shipped substrate + uid-keying + purge pattern (0 new deps); the pending entry is ordinary data ⇒ renderable, testable, honest; token freshness is free (the app-layer transport mints per request); exactly-once is guaranteed where it CAN be — the DB; works identically on web, desktop and the Capacitor WebView | new machinery (~150 lines: store, engine, merge selector); we own the retry/backoff code | high — the same outbox generalises to any future offline write (E5 scenarios) without a second mechanism | **85%** |
| B — TanStack Query persisted paused mutations (`persistQueryClient` + `setMutationDefaults` + `resumePausedMutations`) | first-class library support for pause/resume; less bespoke retry code | needs 2 new deps + a **global** client persister (the app deliberately has none — every persisted thing is uid-keyed); documented caveats: only state persists (mutation fns must be re-registered at boot), **ordering may differ**, callbacks don't run if the component unmounted; **still no exactly-once** ⇒ the idempotency key + DB constraint are needed anyway; rendering "pending" means reading the mutation cache, an awkward source for a list | medium — couples our durability story to a library's persistence internals | 55% |
| C — Service-Worker Background Sync (workbox-background-sync; workbox is already in the lockfile) | OS-level replay even with the app closed (Chromium) | **replays a stored Request with a ~1h-expired ID token** → 401, and the SW cannot refresh it; Background Sync is **Chromium-only** (Safari/Firefox fall back to replay-on-SW-start) ⇒ inconsistent behaviour; the queue is **opaque to the app**, so the "visibly pending" requirement (the whole point) needs a SW↔app message channel; forces the PWA off its current `generateSW`-no-runtimeCaching config | low here — optimises for a scenario (app closed) we don't need, at the cost of the honesty requirement we do | 25% |
| D — `localStorage` outbox | trivially simple, synchronous | sync/blocking, ~5 MB, string-only (our payload is a nested object with decimal strings), no advantage over an IndexedDB substrate we already ship | low | 20% |

**Sign-out sub-decision** (the spec left it open):

| Option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — Blocking honest guard: sync-now / discard-with-confirmation / cancel** (CHOSEN) | satisfies both halves of the requirement (nothing vanishes silently; nothing leaks); keeps the shipped purge-on-signout privacy guarantee intact (FR-309/Q2, FR-521); one dialog, no new persistence rule | one blocking dialog on a path that is currently one click; the user CAN still choose to lose the entries (but knowingly — that is the point) | **78%** |
| B — Retain the outbox across sign-out (uid-keyed) and resume on the same uid's next sign-in | zero data loss; no dialog | **contradicts a shipped privacy guarantee** — unsynced quotes (client name + prices) would persist on a shared device after sign-out, the exact leak class the sweep exists to prevent; would require an owner amendment to the purge rule; and if the user never returns to that device, the data is lost anyway — silently | 60% |
| C — Block sign-out until the queue drains | strongest durability | offline ⇒ **the user cannot sign out at all** on a borrowed/shared device. Hostile. | 35% |
| D — Discard + a toast afterwards | simplest | this *is* "silently dropped" with a receipt; a toast after the fact is not consent (FR-527 violation) | 25% |

### Risks this pins

- **Duplicate history entries** (the #1 offline-sync failure): killed at the DB by `UNIQUE (owner_uid,
  client_snapshot_id)` — not by client cleverness, which is exactly why it survives app restarts and two tabs.
- **A lie at the moment of recording** ("salvo!" before the server saw it): killed by the merge selector +
  `syncState` (pending is a data property, not a UI flourish).
- **A silent drop on entitlement denial**: killed by the `blocked` terminal-but-retryable state.
- **Storage eviction** (IndexedDB may be evicted under pressure without `navigator.storage.persist()`): flagged
  openly; a queued snapshot is durable *in practice*, not *in guarantee*. The mitigation is to sync early and
  often, and to say "pendente neste dispositivo" rather than "guardado".

### Tests that must exist

- **vitest (client)**: enqueue offline → the entry is in IndexedDB with a `clientSnapshotId` + device `quotedAt`;
  a simulated app restart still finds it. Merge selector: an outbox entry and a server entry with the same
  `clientSnapshotId` render as **one** item (server-wins). Two concurrent drains issue **one** POST (lock held)
  and, with the lock stubbed away, still converge to one list entry. `status: 0` renders **pendente**, never
  "falhou"/"salvo". A 403 at sync ⇒ `blocked`, still present, honest copy, no auto-retry; `active` again ⇒
  auto-retry ⇒ `synced`. Sign-out with N pending ⇒ dialog; cancel keeps them; discard purges the uid key.
- **pytest (server)**: POST with a repeated `clientSnapshotId` for the same uid ⇒ **200**, the same entity, and
  `SELECT count(*) == 1`. The same `clientSnapshotId` under a **different** uid ⇒ a separate row (uniqueness is
  per-account). A denied POST (free/lapsed) persists **nothing** and returns `ENTITLEMENT_REQUIRED`.
- **Playwright e2e**: `context.setOffline(true)` → record → the card shows pending → `setOffline(false)` →
  exactly **one** entry appears (SC-513), with the **device** date it was recorded with (SC-511/FR-528).

---

## R2 — Where the export artifact is rendered (FR-512..516, SC-506) → **ADR-0020**

### Decision

**Server-rendered artifacts (PDF quote + CSV history), behind `require_entitlement` (ACTIVE only).** The export
endpoints return a file stream; the client never composes the document. Consequences accepted **and stated in
the UI**: (a) **export requires connectivity** — offline, the export affordance is disabled with an honest
caption ("exportar precisa de conexão"), never a fake; (b) a **still-pending (unsynced) snapshot is not
exportable** until it syncs ("sincronize para exportar") — which is honest by construction: you cannot export a
record the record-keeper has never seen.

### Rationale

This is the one decision where E4 can have a **real** server-side gate, and it is the one place the product
sells. FR-515 demands *"export denied on lapse, with no partial artifact"*. If the client renders, that denial
is a route-guard over data the lapsed user **legitimately holds** (FR-517 keeps snapshots readable on lapse, and
the read cache is on their device) — so the artifact is producible without the server's consent, and the spec
would have to say so (ADR-0015's honesty clause). With the server rendering, **the artifact cannot exist unless
the server authorised it**: FR-515 and "no partial artifact" hold by construction (200-with-file or 403-with-
nothing), and FR-513's "rows equal the stored snapshots exactly" is true because the renderer reads the stored
row and prints it.

**The ADR-0015 precedent does not transfer here — and that is the crux.** What forced the soft boundary in E3
was that a server-side *compute* would fork the canonical pricing engine and break offline pricing (ADR-0008:
*backend never recomputes*). A **document renderer forks nothing**: the server prints **stored, already-rounded
values** — it performs no formula, no markup, no gross-up, no arithmetic at all (provided the payload freezes
per-line quantity-scaled money, which `BomResult` already produces — see §"What the data model must provide").
So *"backend never recomputes"* is untouched. Refusing a real gate here would be copying E3's *conclusion*
instead of its *reasoning*.

The cost is a PDF toolchain in the backend image. Candidate Python libraries (**to be verified at
implementation — this ADR does NOT assert their current versions or licences**, ADR-0008's own precedent):
WeasyPrint (HTML/CSS → PDF; best fidelity to the DS, but native Pango deps in the image), ReportLab (no native
deps, more layout code), fpdf2 (pure-Python; check the licence against the project's posture). Deploy is
deferred to v1, so an image change is cheap now and expensive later — another reason to take it in E4.

### Alternatives considered

| Option | Pros | Cons | Scalability | Conf. |
|---|---|---|---|---|
| **A — Server-rendered PDF + CSV behind an ACTIVE-entitlement gate** (CHOSEN) | FR-515 is **really enforced** (the artifact only exists if the server made it); "no partial artifact" + "rows equal the stored snapshot" by construction; one renderer for web + desktop + Capacitor Android; zero frontend bundle cost; the numbers printed are the numbers stored, with no second formatting implementation to drift | export becomes **online-only** (no offline export); a pending snapshot can't be exported until it syncs; a PDF dependency (and possibly native libs) enters the backend image | high — one artifact, one renderer, one gate; a future e-mail/share path reuses the same endpoint | **72%** |
| B — Client-rendered (pdf-lib/jsPDF + JS CSV), server-informed route-guard | export works **offline** (fits the fair persona); no backend PDF toolchain; reuses the DS/typography of the app | the export gate is **NOT server-enforceable** — a lapsed user legitimately holds the data (FR-517) so the artifact is producible without the server; FR-515 would have to be re-worded as an honest client guard (ADR-0015 clause), which is a **weakening of an owner decision (Q6)**, not a neutral choice; bundle weight on a PWA; two renderers if a server-side share ever lands | medium | 55% |
| C — Hybrid: server **authorises** (an active-entitlement call returning the authoritative payload), client **renders** | no backend PDF deps; the gate is a real server call, so a lapsed account gets no fresh authorisation | still online-only (so it forfeits B's only real advantage) **and** still unenforceable (the cached data can be rendered without asking) — it buys the cost of A and the weakness of B | low-medium | 45% |
| D — Split: CSV client-side, PDF server-side | CSV is trivial and offline | two mechanisms, two honesty stories, one gate that is half real; no coherent rule to explain to the seller | low | 30% |

### Risks this pins

- **A gate the spec claims but the code cannot enforce** (the precise failure ADR-0015's honesty clause exists
  to prevent). Under A there is nothing to dress up.
- **Artifact/record drift** (an export whose numbers differ from the stored snapshot): impossible when the
  renderer reads the row and prints it, and the payload contains every printed value.
- **The seller's identity on the quote** (FR-514): `Account` has **no display-name column** (verified). The
  server takes the name from the **verified ID-token claims** at export time (`claims["name"]`, absent for
  password accounts ⇒ e-mail only, which FR-514 already accepts). **No schema change, no new seller data** (Q13).

### Tests that must exist

- **pytest**: export as `active` ⇒ 200 + a non-empty artifact whose bytes contain the stored values; export as
  **lapsed** ⇒ 403 `ENTITLEMENT_REQUIRED` and **zero bytes** written (no partial artifact); export as free /
  signed-out ⇒ 403; export of **another account's** snapshot id ⇒ the same answer as a nonexistent id (no
  existence oracle, FR-511/SC-509).
- **pytest (content)**: the customer quote contains item names + quantities + price + date + validity + seller
  identification and **zero** internal cost lines (material/energy/machine/falha/margem) — asserted against the
  extracted text, with a **kit** snapshot exercising SC-515 (every piece itemized, still zero cost lines); with
  `includeCostBreakdown=true`, and only then, the breakdown appears (SC-506).
- **pytest (CSV)**: exported rows equal the stored rows byte-for-byte on money + dates (FR-513) — no
  re-derivation, no re-rounding.
- **Playwright**: offline ⇒ the export button is honestly disabled with the reason shown; a pending snapshot ⇒
  export offered only after it syncs.

---

## R3 — Server-side immutability of a snapshot (FR-504, SC-504) → **ADR-0019**

### Decision

**Immutability in depth, at three layers** — API shape, ORM guard, DB constraint:

1. **API shape (the primary enforcement — the ADR-0012 "operator-only holds by absence of a path" idiom).**
   The snapshot resource has **no PUT**. The surface is exactly:
   `POST /api/v1/history` (the ONLY writer of frozen fields) · `GET /api/v1/history` · `GET /api/v1/history/{id}`
   · `PATCH /api/v1/history/{id}` whose body model carries **`label` and nothing else** (`extra="forbid"` ⇒ an
   attempt to send a value/date/version is a **422**, never a silent ignore) · `DELETE /api/v1/history/{id}`
   (soft delete, owner-scoped, mirroring E2/E3). There is no code path that can write a frozen column after
   insert.
2. **ORM guard (defence against a FUTURE careless path — E5 will touch this area).** A SQLAlchemy
   `before_update` mapper event on the snapshot model inspects the dirty attribute set and **raises** unless it
   is a subset of `{label, deleted_at, updated_at}`. This is cheap, directly unit-testable ("assign a frozen
   attribute, flush, expect a raise"), and it fails **loudly at runtime** for any future writer that forgets.
   (Verify the exact `sqlalchemy.inspect(obj).attrs[...].history` API at implementation.)
3. **DB constraint (owned by the data-model agent — the requirement is stated in §"What the data model must
   provide").** A `BEFORE UPDATE` trigger that raises when any frozen column changes. Requested, not designed
   here. If it is declined, that must be recorded plainly: *the DB does not enforce immutability; the app does.*
4. **"Recalcular hoje" is a POST, never an UPDATE** — it creates a new row with a **new** `clientSnapshotId`;
   the original is not read-modify-written at all (FR-505).
5. **Provenance must NOT be a foreign key** (non-obvious, and it contradicts the instinct to mirror E3): an FK
   with `ON DELETE SET NULL` would **write to the snapshot row** when a product is hard-purged — an
   immutability violation and an erasure of provenance; `ON DELETE RESTRICT` would make products undeletable;
   `ON DELETE CASCADE` would delete history. Therefore provenance is a **plain nullable id column + the captured
   origin name**, with **no FK**, and the "abrir produto" affordance is resolved **at read time** (owned + live
   lookup; absent ⇒ the affordance is simply not offered — no broken link, no "produto excluído" claim, FR-503).
   This is the ADR-0017 §6 read-time-degradation reasoning applied one shelf over, with the opposite outcome:
   the kit line *degrades*, the snapshot *does not move at all*.

### Rationale

FR-504 is the epic's whole promise, and the cheapest way to keep a promise is to make the machine incapable of
breaking it. The API shape alone already makes it structurally impossible **today**; the ORM guard makes it
impossible **tomorrow**, when a future epic adds a writer; the DB trigger makes it impossible for a hand-run
`UPDATE`. Each layer is independently testable, and none of them costs a schema compromise.

### Alternatives considered

| Option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — Shape + ORM guard + DB trigger (defence in depth)** (CHOSEN) | the promise survives future code, not just current code; every layer is test-pinnable; no data-model compromise | three places to keep coherent (all trivially small); the trigger is a migration artifact the DB agent must own | **85%** |
| B — API shape only ("no path, no problem") | zero extra machinery; already true of the current code | one careless service function in E5/E6 silently breaks the epic's headline promise, and nothing catches it; SC-504 ("0 write paths can alter…") would be an assertion about today's code, not an invariant | 60% |
| C — Fully append-only storage (an immutable events table; label kept in a side table) | maximal purity; the row is physically never updated | a whole indirection (join on every read) for one mutable field; contradicts the shipped soft-delete/label idiom; heavier for the data-model agent with no product gain | 45% |
| D — DB trigger only | strongest single mechanism | a 500 from a trigger is an ugly, un-typed way to tell a caller "no"; the API would still *offer* a path it cannot honour | 40% |

### Risks this pins

- **A future write path quietly rewriting history** (the failure that would make the entire epic a lie).
- **A catalog delete reaching into a snapshot** — impossible once provenance carries no FK.
- **Label edits masquerading as content edits**: PATCH's `extra="forbid"` makes a smuggled field a 422.

### Tests that must exist

- **pytest**: a PATCH carrying anything but `label` ⇒ **422** (never a silent ignore). No route accepts a full
  snapshot body (the surface has no PUT — assert against the OpenAPI schema, which the contract drift-guard
  already snapshots). A direct ORM assignment to a frozen attribute + flush ⇒ **raises** (the guard). If the
  trigger lands: a raw `UPDATE snapshots SET ... ` on a frozen column ⇒ the DB raises.
- **pytest**: edit the origin product → re-GET the snapshot ⇒ every value, total, date and version **identical**
  (SC-502). Delete the origin product → the snapshot is intact, `originName` still rendered, and the read
  response says the origin is **not openable** (no degraded flag, no warning — FR-503).
- **pytest**: "Recalcular hoje" ⇒ a **new** id, the original row's `updated_at` unchanged.

---

## R4 — Does `pricing-core` need to change? **No.** (spec inferred 85%; verified → **90%**)

### Decision

**Zero change to `packages/pricing-core`. It stays `3.1.0`. No `MODEL_REGISTRY`, no version bump, no new export.**
Verified against the code, not the ADR text:

- **Freezing (FR-502)** needs `PRICING_MODEL_VERSION` (exported, `"3.1.0"`), the inputs (`PriceInput` /
  `BomLineInput[]`) and the rounded outputs (`PriceResult` / `BomResult`). All four exist and are exported today.
  A snapshot is *serialisation of values pricing-core already returns* — the engine needs to know nothing about
  snapshots. (ADR-0008 says exactly this: *"what freezes in a snapshot: `PRICING_MODEL_VERSION` + the inputs +
  the rounded line values"*.)
- **FR-507 "render only the lines it recorded, never a fabricated zero"** is a **rendering** rule, not an engine
  rule. It has one architectural consequence, which is the trap: **the frozen payload MUST NOT be typed with
  pricing-core's live `PriceResult` type.** If it were, a future version that adds a line would make TypeScript
  *assert* that the field exists on a 2026 snapshot, and the renderer would happily print `value ?? 0` — a
  fabricated zero, produced by the type system. Rule: the snapshot payload has its **own** versioned type in the
  E4 entity layer, and the detail UI **iterates the keys present in the payload**, never a static line list with
  a `?? 0` fallback.
- **FR-505 "Recalcular hoje"** runs **today's** engine on the stored inputs, client-side (ADR-0015/ADR-0008 —
  the backend still never recomputes) and POSTs a **new** snapshot. `computeCalculator`/`computeBom` serve this
  unchanged.
- **ADR-0008 Option 1B (`MODEL_REGISTRY`) stays deferred, and the spec's reasoning is confirmed**: it is only
  needed when a **second live version** coexists with **existing old snapshots** — impossible at E4 launch,
  because no snapshot exists in the product yet. Recording a version *stamp* (1A) is sufficient for FR-506.
  **Trigger recorded**: the **first pricing-core MAJOR after E4 ships** must arrive with an ADR resolving how an
  old snapshot's stored `PriceInput` is adapted to the new input shape for "Recalcular hoje" — the options are a
  registry/adapter, or an honest refusal ("estas entradas foram registradas com a fórmula 3.x"). **We do NOT
  build a dormant guard now** (Principle V: no speculative branch that no state can reach); we record the
  trigger.

**If a change had been needed** it would have been a **MINOR** (additive) bump — but none is: every value E4
freezes, renders or recalculates is already on the public surface of 3.1.0.

### Open point routed to the owner/PO (NOT inferred, per Principle VIII)

**FR-505's "at today's values" is ambiguous** and the answer changes what "Recalcular hoje" depends on:
(i) *same frozen inputs, today's formula* — then a filament-price rise never shows up, which makes US7 ("meu
custo subiu desde que cotei?") structurally unable to ever answer "yes"; (ii) *re-resolve the provenance
product/kit to today's catalog values, then compute with today's formula* — which is what US7's own wording
implies (*"a snapshot whose inputs still resolve"*) and what a seller means by "recalcular". **Recommendation:
(ii), with an honest caption** when the origin no longer resolves ("a origem não existe mais — recalculado com
os valores registrados e a fórmula de hoje"). Confidence **70%** — worth one owner sentence, because it decides
whether the Histórico feature depends on the catalog resolver at all. **Either way, `pricing-core` does not
change** (the resolution happens in the feature layer, exactly as E2/E3 already do it).

### Alternatives considered

| Option | Pros | Cons | Conf. |
|---|---|---|---|
| **A — No pricing-core change; stays 3.1.0** (CHOSEN) | everything E4 needs is already exported; zero risk to SC-402 byte-identity and the shipped E1/E2/E3 guarantees; smallest diff | the "no fabricated zero" rule must be held by a **frontend** discipline (own payload type + iterate-present-keys) rather than by the engine | **90%** |
| B — Add `MODEL_REGISTRY` now (ADR-0008 Option 1B) | future-proofs multi-version rendering/diffing | gold-plating for a **single** live version with **zero** existing snapshots — the exact case ADR-0008 deferred it for; new surface to maintain; Principle VI | 25% |
| C — Add a `snapshotPayload`/`hydrate` helper to pricing-core | one canonical (de)serialiser | pricing-core would gain knowledge of a persistence concern it has no business knowing; and typing an OLD payload with the CURRENT engine's types is precisely the fabricated-zero trap | 30% |

### Tests that must exist

- **vitest (pricing-core)**: unchanged — the existing version↔package gate test keeps `PRICING_MODEL_VERSION`
  pinned to the package major (any future bump is caught).
- **vitest (web)**: a **synthetic "old" payload** missing a breakdown key renders **without** that line and
  **without** a `R$ 0,00` (FR-507) — the single test that makes the no-fabricated-zero rule real *before* a
  second version exists.
- **vitest (web)**: record → serialise → re-read → the rendered detail is **byte-identical** to what was
  displayed at record time (SC-501), with **zero** calls into `computeCalculator` on the read path (spy/mock
  asserted — this is what "never recomputes" means in code).

---

## R5 — List transport, search/filter and the offline read boundary (FR-520/521, SC-510)

- **Decision**: the history list is **cursor-paginated** from day one (`(quotedAt, id)` descending cursor;
  page size ~25), with **server-side** label search (`ILIKE`) and date-range filter (FR-520) — the history is
  explicitly unbounded (FR-518: no TTL, no cap), so the E2/E3 "return everything" list shape does not transfer.
- The **offline read cache stores the pages already loaded** for that uid, and the offline list is honest about
  its boundary: it shows what it has and says "há mais itens — conecte-se para carregar", never a fabricated
  empty and never a silent truncation. SC-510 ("after one online load, snapshots are readable offline") is met
  for what was loaded; the honest caption covers the rest.
- **Alternatives**: return-everything + client-side filter (simplest; degrades badly at hundreds of entries and
  puts an unbounded payload on a phone at a fair — 40%); offset pagination (simple, but drifts as new entries
  are prepended — 45%). Confidence in the cursor choice: **80%**.
- **Tests**: a seeded 60-entry account lists newest-first across pages with no duplicate and no gap; search by
  label and a date-range filter return the right entries; offline after one page ⇒ that page is readable and the
  "há mais" caption is present.

## R6 — Delivery shape (owner-gated PR slices — the E2/E3 cadence)

- **PR-A — The frozen shelf**: US1 + US2 + US5 + **the offline outbox (ADR-0018)** + immutability by
  construction (ADR-0019: POST/GET/DELETE only, no PUT, no FK provenance) + migration `0003`. This is the
  biggest first slice the project has shipped; the two owner calls in `/speckit-clarify` both landed here.
- **PR-B — Immutability + lifecycle honesty**: US3 + US6 (catalog churn proven inert, the version/date surface,
  "Recalcular hoje" → new entry, label PATCH + search/filter/delete, the lapse freeze). ADR-0019's ORM guard +
  the DB trigger test land here at the latest.
- **PR-C — Export (ADR-0020)** + US7 if it survives. Independently homologable; the natural place to cut.

---

## What the data model must provide (requirements to `dev-estrutura-de-dados`, not a design)

1. **`UNIQUE (owner_uid, client_snapshot_id)`** — non-negotiable; it is the *only* thing that makes SC-513
   (exactly-once) true across app restarts and two tabs. Unlike ADR-0017's deliberate refusal of a unique index
   on `products(owner_uid, name)`, this one has **zero regression risk**: the column is new, no rows exist, and
   correctness under concurrency is load-bearing here (it was not there). The POST path must resolve a conflict
   by **returning the existing row (200)**, not by erroring.
2. **The frozen payload must survive a formula change with no migration and no backfill.** Adding a breakdown
   line to a future pricing-core MUST NOT require touching stored snapshots, and reading an old snapshot MUST
   yield **exactly the lines it recorded** — so the storage must distinguish **"line absent"** from
   **"line = 0.00"**. (A typed-column shape would need one migration per future line *and* would still have to
   encode absent-vs-zero; that trade-off is yours to weigh — I state the requirement, not the shape.)
3. **The payload must contain every value any renderer prints** — including, for kits, the **per-line
   quantity-scaled money** that `BomResult` already computes, plus each line's **name and quantity** (FR-512's
   kit itemization). This is what lets the export renderer *print* instead of *compute*, which is what keeps
   ADR-0008's "backend never recomputes" true under a server-side export (R2).
4. **Provenance carries NO foreign key** — a plain nullable origin id + the **captured origin name** (see R3.5).
   An `ON DELETE SET NULL` FK would *write to an immutable row*; RESTRICT would block product deletion; CASCADE
   would delete history. All three are wrong.
5. **Immutability at the DB**: a `BEFORE UPDATE` trigger that raises if any frozen column changes (only `label`,
   `deleted_at`, `updated_at` may move). If you decline, say so explicitly so the plan can record *"the DB does
   not enforce immutability; the app does"* rather than implying otherwise.
6. **Dates**: `quoted_at` is the **device clock** (FR-528) — no server default, no coercion, never overwritten.
   The list orders by it (accepted: a skewed device clock mis-orders that account's own list).
   ⚠️ **Flag for the owner, not a silent choice**: every shipped table carries a server-default `created_at`
   (verified in `models/__init__.py`). Following that convention gives the snapshot row a de-facto *received-at*,
   which the spec's "no server-side received-at" line (FR-528 / Out-of-Scope) arguably forbids. **Recommendation
   (70%)**: keep `created_at` as ordinary row metadata, and bind it with a rule — it is **never displayed, never
   exported, never used to order, never used to validate `quoted_at`**. That is honest and consistent; the
   alternative (omit it) is also fine but breaks the schema convention. **Owner picks.**
7. **Money**: exact decimal semantics end-to-end (FR-525) — decimal strings on the wire, `NUMERIC` in the DB,
   consistent with ADR-0008/ADR-0004. The stored value must round-trip **byte-identical** to what was displayed.
8. **Delete = soft delete** (`deleted_at`), owner-scoped, mirroring E2/E3; nothing is ever auto-deleted (FR-518).
9. **Query shapes to index for**: `WHERE owner_uid = ? AND deleted_at IS NULL ORDER BY quoted_at DESC, id DESC`
   (cursor pagination, R5) + a label `ILIKE` filter + a `quoted_at` range filter.

## Honest limits — what E4 canNOT enforce server-side (say it plainly, do not dress it up)

1. **The snapshot's date is unverifiable** (FR-528, owner-accepted). The server stores a client timestamp it
   cannot check; a wrong/manipulated device clock yields a wrong date, and there is no received-at to audit
   against. Already recorded as an owner decision — repeated here so the security review judges a decision, not
   a bug.
2. **The snapshot's *values* are also client-authored — and this is new.** E2/E3 store **inputs** and never a
   price (`boms.py`: *"stores its INPUTS/STRUCTURE and never a price"*); **E4 is the first time client-computed
   money is persisted**, and the server **cannot verify it** — by design, it has no engine (ADR-0008: the
   backend never recomputes). A manipulated client could store a snapshot whose values do not match its inputs.
   **Bounded, and why it is acceptable today**: a snapshot is the seller's own assertion about their own quote,
   readable only by them — they can only lie to themselves. **What it constrains**: any FUTURE feature that
   would treat a snapshot as evidence *to a third party* (a tax/audit export, a marketplace integration, a
   dispute artifact) would need server-side verification, which would need a Python engine — i.e. it would
   **reopen ADR-0008**. Recorded now so it is a decision, not a discovery.
3. **The compute paywall remains soft** (ADR-0015, unchanged): a determined user can invoke the offline engine.
   E4 changes nothing here — but note that with R2's decision, **the export gate is NOT soft**: the artifact
   cannot be produced without an active server-side authorisation. If the owner prefers offline export (R2
   Option B), then the export gate becomes an honest client route-guard and **the spec's FR-515 must be reworded
   to say so** — it cannot claim a server enforcement that would not exist.
4. **A queued snapshot is a *request*, not a *save*.** The client can never authorise a write (Principle IV).
   The UI must use that vocabulary ("pendente", "aguardando sincronização") and never "salvo" until the server
   said so.

## New ADRs required (drafts delivered with this round; owner accepts at the PR gate)

| ADR | Title | Decides | Accepted at |
|---|---|---|---|
| **0018** | Offline snapshot outbox — device-durable queue, exactly-once sync, entitlement at sync | R1 | PR-A gate |
| **0019** | Snapshot immutability — enforcement in depth + no-FK provenance | R3 | PR-A gate |
| **0020** | Export artifact rendering — server-rendered, active-entitlement gated | R2 | PR-C gate |

`pricing-core` needs **no** ADR (R4: no change, no bump).

## Resolved unknowns

| Unknown (spec/brief) | Resolution |
|---|---|
| Offline queue mechanism (FR-527) | App-owned uid-keyed IndexedDB outbox + app-layer sync engine (R1 / ADR-0018) |
| Exactly-once (SC-513) | Device-minted `clientSnapshotId` + `UNIQUE(owner_uid, client_snapshot_id)`; conflict ⇒ return the existing row (R1) |
| Pending honesty (FR-527) | One merge selector (server ∪ outbox), dedup by `clientSnapshotId`, `syncState` on every item (R1) |
| Entitlement at sync (FR-529) | 403 ⇒ `blocked`, retained + visible + retryable; auto-retry on re-grant (R1) |
| Sign-out with a non-empty queue (spec: open) | Blocking honest guard: sync-now / discard-with-confirmation / cancel (R1) |
| Export rendering side (spec: routed to plan) | **Server-rendered**, active-entitlement gated; export is online-only (R2 / ADR-0020) |
| Immutability enforcement (FR-504) | No PUT + label-only PATCH (`extra="forbid"`) + ORM `before_update` guard + DB trigger; provenance carries **no FK** (R3 / ADR-0019) |
| `pricing-core` change? (spec: 85% no) | **No change, stays 3.1.0** (R4, verified against the code) — 90% |
| `MODEL_REGISTRY` (ADR-0008 1B) | Stays deferred; trigger = the first MAJOR after E4 ships (R4) |
| History list at scale (spec edge) | Cursor pagination + server-side search/filter; honest offline boundary (R5) |
| "Recalcular hoje" = which values? | **OPEN — routed to the owner/PO** (R4): recommendation is re-resolve the provenance to today's catalog values (70%) |
