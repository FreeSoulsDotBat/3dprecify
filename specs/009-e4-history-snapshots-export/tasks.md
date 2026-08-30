# Tasks: E4 — Histórico + snapshots reproduzíveis + export

**Input**: Design documents from `specs/009-e4-history-snapshots-export/` (spec.md · plan.md · research.md ·
data-model.md · contracts/api-surface.md · quickstart.md) + **ADR-0018** (offline outbox) + **ADR-0019**
(immutability + provenance without FK) + **ADR-0020** (server-rendered export) + ADR-0012/0013 (reused).

**Prerequisites**: plan.md ✅ (Constitution Check 8/8, one recorded deviation) · owner decisions across **three**
dated sessions (spec §Clarifications) · E3 (008) shipped to `develop`. Docker required for DB-backed dev/tests.

**Tests**: MANDATORY per Constitution III — every story starts with tests observed **FAILING**. Four suites are
load-bearing and must precede their implementation: **exactly-once** (retry · restart · two tabs ·
delete-then-retry must NOT resurrect), the **DB immutability trigger**, **catalog-churn inertness** (SC-502), and
the **export content rules**. **SC-512 in every PR**: all E1/E2/E3 guards pass UNCHANGED.

**Organization**: by user story, grouped into the owner-authorized **3-PR delivery**. Every push/merge is
**OWNER-GATED** (ADR-0006); the graph refreshes on each merge into `develop` (ADR-0014).

> **PR-A is the big slice — do not underestimate it.** Both owner calls in `/speckit-clarify` landed here: the
> **offline queue** (the product's first offline write) and **kits recordable from day one** (a bigger frozen
> payload). E4 inverts E3's shape: there is no free-standing value before persistence, so **PR-A *is* the server
> slice**.

## Standing rules for every task in this feature

- **`pricing-core` does NOT change** (stays 3.1.0 — verified, research R4). **No task may touch it.**
- **Money in the JSONB payload is a decimal STRING, never a float.** Postgres keeps `numeric`; **`json.loads` /
  `JSON.parse` hand back floats** — the loss is in the serializer, app-side, and silent.
- **The frozen payload MUST NOT be typed with the live `PriceResult`.** If it is, a future version makes
  TypeScript *assert* a line exists in a 2026 snapshot and the renderer prints `?? 0` — **the fabricated zero,
  produced by the type system** (FR-507). The payload gets its own frozen, version-tolerant types.
- **The Histórico list is ONE selector: (server list) ∪ (outbox), deduped on `clientSnapshotId`, server-wins.**
  **No component may read the server query alone** — the E3 PR-C lesson: *a correct component starved of correct
  data still lies.*
- **qa-produto visual homologation before done in every slice.** In PR-A the offline → sync → reopen walk is the
  one that matters.

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — The frozen shelf: record (online + offline) · consult · honest teaser ══

## Phase 1: Setup

- [x] T001 [P] designer-ux → Claude Design handoff (NON-BLOCKING, parallel with all PR-A work): the Histórico
      list (label · total · **date** on every card), the snapshot detail (renders STORED values), the **pending /
      blocked** sync states ("pendente **neste dispositivo**" — never "guardado"), the sign-out-with-queue dialog,
      and the US5 teaser. Output feeds T010/T013/T015; not a merge blocker. Write to
      `specs/009-e4-history-snapshots-export/ux-history.md`.

## Phase 2: Foundational (blocking) — the frozen document + the immutable table

- [x] T002 Write FAILING vitest first — `apps/web/src/entities/history/frozen-payload.test.ts`: the payload
      serializer emits **decimal STRINGS** for every money/quantity/percentage leaf and integer JSON numbers only
      for counts; a round-trip preserves the exact strings (**no float anywhere**, FR-525); a payload missing a
      breakdown line renders **without it** and **never as `0,00`** (FR-507); the frozen types are **structurally
      independent of `PriceResult`** (a type-level test pinning that a pricing-core field addition cannot make the
      renderer assert an old snapshot has it). Observe failing.
- [x] T003 Implement the frozen payload contract in `apps/web/src/entities/history/frozen-payload.ts` — its own
      version-tolerant types (per `data-model.md` D1) + the serializer from a `PriceResult`/`BomResult` into the
      frozen document (kit lines **with quantity-scaled money** + the per-channel rollup — required so the export
      can *print* instead of *calculate*, ADR-0020 §1) + the captured provenance `{kind, id, name}`. Tests green.
- [x] T004 Write FAILING pytest first — `backend/tests/test_history.py`: **idempotency** (POST → `201`; replay
      with the same `clientSnapshotId` → `200` **and the same row**, never a duplicate; **delete-then-retry does
      NOT resurrect** — the tombstone is inside the unique key); **immutability at the DB** (raw `UPDATE snapshots
      SET headline_total = …` → the trigger **raises**; only `label`/`deleted_at`/`updated_at` may move);
      **PATCH is label-only** (a smuggled value/date/version → `422`, never a silent ignore); **no PUT exists**;
      the **entitlement gate** (free/signed-out → `403 ENTITLEMENT_REQUIRED`, nothing written/read; a faked client
      premium denied); **isolation** (account B → `404`, no existence oracle); **lapse** (reads `200`, writes
      `403`, zero rows deleted). Observe failing.
- [x] T005 Alembic **migration `0003`** (`down_revision = "0002"` — never amend an existing migration) +
      SQLAlchemy 2.0 `Snapshot` model per `data-model.md`: typed columns + `payload` JSONB; `UNIQUE (owner_uid,
      client_snapshot_id)` **unconditional** (includes tombstones — this is what makes exactly-once survive a
      delete-then-retry); `device_quoted_at` + `device_utc_offset_minutes` (**the `device_` prefix is
      load-bearing** — it warns, in the column name, that the timestamp is client-supplied and unverifiable);
      **NO foreign key to products/kits** (ADR-0019 §5: `SET NULL` would *write to the immutable row* and would
      make the product delete fail against the trigger); the `BEFORE UPDATE` **immutability trigger** (the
      project's first PL/pgSQL, owner-approved); the partial index `(owner_uid, device_quoted_at, id) WHERE
      deleted_at IS NULL`; **`headline_basis`** — the seller **chooses the quoted basis at record time** (varejo
      pre-selected) and every surface **labels** it (design round F1: a seller quoting a shopkeeper quoted
      *atacado*; forcing varejo would record a number they never said to the customer). `uv run alembic upgrade
      head` green against the compose DB.
- [x] T006 Implement `backend/app/api/history.py` per `contracts/api-surface.md`: `POST` (the ONLY writer of
      frozen fields — `INSERT … ON CONFLICT DO NOTHING` + read-back ⇒ a retry is an **idempotent success**, never
      a duplicate and never an error the outbox would misread as failure) · `GET` list (keyset pagination, never
      `OFFSET`) · `GET /{id}` · `PATCH` (`label` only, `extra="forbid"`) · `DELETE` (soft). Plus the SQLAlchemy
      `before_update` **ORM guard** (raises unless the dirty set ⊆ `{label, deleted_at, updated_at}`) — defence
      against *future* code (ADR-0019 §2). **The server holds no queue state**: no `pending`/`rejected` column
      exists or may be added. Tests green.
- [x] T007 Contract ripple (same commit): regen `contracts/openapi.json` + the Orval client (RAW output);
      drift-guard `git diff --exit-code` green. No new `ErrorCode` (`ENTITLEMENT_REQUIRED` + `VALIDATION_ERROR`
      already exist).

**Checkpoint**: the immutable table exists and is provably immutable **in the database**; a replayed POST cannot
duplicate.

## Phase 3: US1 — record a price as a frozen snapshot, online AND offline (P1) [FOUNDATIONAL STORY]

**Goal**: a premium seller records a single piece **or a kit** (Q2), online or offline. **Independent Test**:
quickstart §1 + §3 + §4.

- [x] T008 [US1] Write FAILING vitest first — `apps/web/src/entities/history/*`: the **outbox** (`idb-keyval`
      store `history:outbox:{uid}`; a failed enqueue **throws** — unlike the read cache, which swallows write
      failures by design; the entry survives an app restart); the **sync engine** (drain on boot/`online`/focus/
      post-sign-in; capped backoff; entries independent — a failing entry never blocks the queue; **two tabs**
      single-flighted via Web Locks, with correctness resting on the DB unique key, not the lock); **exactly-once**
      (a lost response ⇒ retry with the **same** key ⇒ the server returns the row it already created ⇒ **0
      duplicates**); the **blocked** state on `403` (retained, visible, auto-retry stopped, retried on the next
      `active` entitlement); the **merge selector** (server ∪ outbox, deduped on `clientSnapshotId`,
      **server-wins**, `syncState: synced | pending | blocked | failed`). Observe failing.
- [x] T009 [US1] Implement `apps/web/src/entities/history/{outbox,sync-engine,use-history}.ts` (ADR-0018).
      `clientSnapshotId = crypto.randomUUID()` is minted at **RECORD** time — *minting at send time regenerates
      after an app restart and duplicates*. The queued entry is a **complete, self-contained POST body**, frozen
      at record time; never re-derived, never patched at send time. A no-response error renders **"pendente"** —
      never "falhou", never "salvo" (*no answer is not the same as not saved*). Best-effort
      `navigator.storage.persist()` at first enqueue (**verify the API at implementation**). Tests green.
- [x] T010 [US1] Write FAILING tests then implement the **record action** in `apps/web/src/features/history/`:
      from the calculator **and from a kit** (Q2 — both from this slice), optional label + validity period (Q9),
      honest pending feedback. Recording is only OFFERED when the **last-known server** entitlement was `active`
      (ADR-0015's nuance: a cached server response, **never** a client-held flag). Tests green.
- [x] T011 [US1] Sign-out with a **non-empty queue** (ADR-0018 §10): a blocking, honest dialog at the sign-out
      action — *"N registros ainda não sincronizados"* → **[Sincronizar agora]** (online only) · **[Sair e
      descartar]** (explicit destructive confirm) · **[Cancelar]**. Discard purges the outbox with the uid-keyed
      sweep. Entries **never vanish silently** and **never leak into the next account**.
      ⚠️ **The guard MUST cover BOTH entry points** (design round C1, verified): `signOutUser()` is called from
      `widgets/top-bar` **and** `pages/conta` — guarding one leaves a silent hole. FSD-Lite blocks the shortcut
      (`shared` may not import `entities/history`), so: a `requestSignOut()` seam in `shared/session` + the guard
      mounted in the **app shell**. Failing-first test (**both** entry points), then implement.
- [x] T011b [US1] **Persist the last-known SERVER entitlement** (owner decision Q14, 2026-07-13 — found while
      implementing T010/T011, spec §Clarifications + ADR-0018 §9 addendum). The in-memory cache is **empty on a
      cold boot**, so a premium seller opening the app **already offline** met the free teaser and **could not
      reach the outbox in the one scenario it exists for**. Failing-first tests, then:
      `apps/web/src/entities/user/entitlement-cache.ts` (uid-keyed idb-keyval, strict shape guard — a corrupt or
      forged value resolves to *no answer*, **never** to premium) + `use-entitlement.ts` pre-fill/persist +
      the sign-out sweep. The gate does not move: the value is the **server's own last word**, it is **labelled
      `stale`** wherever it is shown, and the server still refuses a write on a stale `active` (403 ⇒ `blocked`).

## Phase 4: US2 — consult the Histórico (list · open · offline read) (P1)

**Goal**: the ledger, readable offline, purged on sign-out. **Independent Test**: quickstart §1 + §2 (read half).

- [x] T012 [US2] Write FAILING tests first — list newest-first with **a date on every card** (never a live-looking
      price, FR-523); the detail renders the **stored** breakdown with **zero recomputation** (SC-501); offline
      read from cache; purge-on-signout; cross-account invisibility (no existence oracle). Observe failing.
- [x] T013 [US2] Implement `apps/web/src/pages/historico/` — **fills the existing honest "em breve" placeholder;
      the IA does not change and NO new nav tab is added** (FR-524). The list reads the **merged selector only**
      (never the server query alone). "history" joins the cache-resource sweep. Tests green.

## Phase 5: US5 — honest teaser for Histórico + Export (P2)

**Goal**: an honest door for everyone else. **Independent Test**: quickstart §8.

- [x] T014 [US5] Write FAILING tests first — the Histórico tab, signed-out/free, **explains** (never a broken
      list, never a **fabricated sample entry**); "salvar no histórico" / "exportar" → the honest teaser (no fake
      "salvo!", no price, no availability date, no pre-E6 purchase CTA); the free calculator stays fully usable
      (SC-507/512). Observe failing.
- [x] T015 [US5] Implement the history teaser (reuse the E2/E3 `premium-teaser` pattern). Tests green.

## PR-A ship (STRICTLY ORDERED)

- [x] T016 [US1][US2][US5] Visual test: **qa-produto homologates the offline → sync → reopen walk** at 390px +
      desktop (record offline → visibly pending → restart the app still offline → still pending → go online →
      syncs exactly once → reopen byte-identical), plus the blocked-on-lapse state, the sign-out-with-queue dialog,
      and the teaser. **This is the walk that matters in E4** — the honesty class of bug lives here.
      ⚠️ Kill any orphaned `vite preview` on `:4173` **before** diagnosing any "flaky" e2e.
- [x] T017 [US1][US2][US5] **OWNER-GATED** PR-A: `pnpm gate:all` + `pnpm e2e` (idempotency · trigger · gate ·
      isolation · lapse · **SC-512**) → push → PR to `develop` → CI green (incl. contract drift-guard) → owner
      squash-merge. **Owner accepts ADR-0018 + ADR-0019 at this gate** (incl. the project's first PL/pgSQL).
      Graph refresh on merge. **Checkpoint: a premium seller records a quote — at a fair, offline — and reopens it
      identical; a free user sees an honest door.** *(Shipped as PR #18, `b1fbd80`, 2026-07-15, after a full
      multi-agent review-fix cycle; envelope Option A frozen; owner-homologated.)*

---

## ══ PR-B — The two-shelf rule made visible + lifecycle honesty ══

## Phase 6: US3 — a snapshot never changes; recalculating creates a new one (P1)

**Goal**: catalog churn is **inert** against history. **This is the slice that proves the epic — the risk lives
here.** **Independent Test**: quickstart §2 + §7.

- [x] T018 [US3] Write FAILING tests first — **SC-502**: edit the origin product's filament cost → the snapshot's
      values/total are **unchanged**; **delete** the origin → the snapshot is **fully intact**, with **no degraded
      state, no last-known caption, no warning, and no "produto excluído" claim** (the captured name still shows;
      "abrir produto" is simply **not offered**); a **hard purge** of the origin must **not fail** and must **not
      touch** the snapshot (there is no FK — ADR-0019 §5); FR-507 (an older payload missing a line renders without
      it, **never a fabricated zero**). Plus the honesty guard: the word "removido/excluído/deletado" appears
      **nowhere** on a snapshot surface. Observe failing. *(SC-502 + the no-degrade/no-"removed"-lie honesty guards
      in `snapshot-detail.test.tsx`; read-time origin resolution in `origin.test.ts`; e2e SC-502 in
      `history-manage.spec.ts` via UI soft-delete + client-nav.)*
- [x] T019 [US3] Implement the snapshot detail surface: the **record date** + the **formula version** shown
      honestly (Q3/A29 — *this closes A29*, open since 2026-07-02); the "abrir origem" affordance resolved **at
      read time** and simply **absent** when the origin no longer resolves. Tests green.
      ⚠️ **Carried from T016 (2026-07-13):** PR-A ships **no entry point that produces `provenance.kind = PRODUCT`**.
      The calculator is not bound to a saved product (its pickers bind filament/printer, not products), so a
      calculator snapshot is genuinely **ad-hoc** and `provenance: null` is the honest answer — but it means US3's
      whole origin story is currently unreachable from a **product**. T019 therefore also has to add the record
      action to `pages/catalogo/produto-page` (capturing `{kind: "PRODUCT", id, name}`); without it, SC-502 can only
      be exercised through a **kit** line. Only kits carry provenance today. *(`snapshot-detail-page.tsx` +
      `origin.ts` read-time resolution against the live catalog/kits; the technical sheet shows the formula version
      — **A29 closed**; the product record action lands the PRODUCT provenance path.)*
- [x] T020 [US3] **"Recalcular hoje"** (FR-505, semantics settled in the plan round): a **new** snapshot (a POST
      with a new `clientSnapshotId`), never an update. It **re-resolves the origin** — repricing with **today's
      catalog values**, not merely the frozen inputs under a newer formula. **The test that pins it**: raise the
      filament price, recalculate, assert the new entry is **higher** — *repricing frozen inputs could never
      answer "sim" to a price rise, which would leave US7 structurally unable to do its job*. Where the origin no
      longer resolves, the recalculation is offered from the frozen inputs and **says so** — never silently
      presented as catalog-current. Failing-first, then implement. *(`recalc-today.tsx`: the price-rise pin +
      provenance-carry-forward tests in `recalc-today.test.tsx`; the review-fix hardened honesty — dialog copy and
      the recorded document both derive from the actual `fromFrozen` outcome, and KIT recompute is all-or-nothing.)*

## Phase 7: US6 — manage the Histórico + lapse policy (P2)

**Goal**: a growing ledger stays usable; lapse freezes it honestly. **Independent Test**: quickstart §5 + §6.4.

- [x] T021 [US6] Write FAILING tests first — label edit persists while **contents stay non-editable**; search by
      label; filter by date range; delete; **lapse** (entries readable, **zero** writes succeed, **export denied**,
      **nothing auto-deleted**); re-grant restores writes **and** export with data intact (SC-508). Observe
      failing. *(Manage-write lapse denial + read-open proven server-side in `test_history.py::test_a_lapse_freezes_writes_but_keeps_the_ledger_readable`; label edit + delete in `snapshot-manage.test.tsx`; search/período/[Carregar mais] in `historico.test.tsx`. The **export** clause of SC-508 lands with US4 in PR-C — export does not yet exist.)*
- [x] T022 [US6] Implement manage (label/search/filter/delete) + keyset pagination over an unbounded history —
      **a product cap is FORBIDDEN**: any limit would be a business-rules amendment, never a silent truncation.
      Tests green. *(Backend `q`/`from`/`to` + keyset `cursor` on `GET /history`; `useHistory` refactored to a lazy `useInfiniteQuery`; `useSnapshot`/`useUpdateLabel`/`useDeleteSnapshot`; `snapshot-manage.tsx` on the detail; the search + período + [Carregar mais] bar on the list. No cap.)*
- [x] T023 [US3][US6] Visual test: homologated the **two-shelf side-by-side** — deleted a product that BOTH a
      snapshot and a kit reference; the **kit degrades** ("Peça 1 · (avulsa)" + "valores mantidos", still priced)
      and the **snapshot does not change at all** (byte-identical value, origin link silently gone, captured name
      retained, no "removed" lie). Homologated at **390px + desktop** via deterministic capture through the real
      preview+backend+Postgres stack (`_homolog-twoshelf` capture, since removed). *(Done directly rather than via
      the qa-produto subagent — real production build, both viewports; a formal qa-produto pass can still be run on request.)*
- [x] T024 [US3][US6] **OWNER-GATED** PR-B: `pnpm gate:all` + `pnpm e2e` (SC-502/504/508 + **SC-512**) → PR to
      `develop` → CI green → owner squash-merge. Graph refresh on merge.
      **Checkpoint: catalog churn provably cannot rewrite history; A29 is closed.** *(Shipped as PR #19, `bd9d95e`,
      2026-07-16, after a capped multi-agent pre-merge review + review-fix cycle — 2 honesty majors + 3 minors
      applied, all confirmed findings tested, contract drift-guard realigned; all 9 CI checks green; graph refreshed
      on merge. Owner-homologated.)*

---

## ══ PR-C — Export (ADR-0020) ══

## Phase 8: US4 — export a snapshot as a quote the customer can read (P1)

**Goal**: the quote leaves the app and reaches a customer. **Independent Test**: quickstart §6.

- [x] T025 [US4] **VERIFY and PIN the PDF library — do NOT assume one** (ADR-0020 §5; ADR-0008's own precedent:
      *"re-verify the exact package + version pin at that point"*). Judge on: **no native deps > DS fidelity >
      licence**. Candidates: WeasyPrint (native Pango deps), ReportLab (no native deps, more layout code), fpdf2
      (pure Python — **check the licence**). Record the pick + pin in ADR-0020 Consequences. *(Deploy is deferred
      to v1, so a backend image change is cheap now and expensive later.)* *(**PINNED `reportlab==5.0.0`**,
      owner-ratified 2026-07-16 — verified current facts: pure-Python `py3-none-any` wheel installs on
      `python:3.12-slim` with no compiler/`apt` (the C accel is now the optional `rl_accel` extra), deps
      pillow+charset-normalizer, **BSD** licence. WeasyPrint rejected on native Pango/cairo/GDK-PixBuf; fpdf2 2.8.7
      kept as fallback (no native deps but LGPL-3.0 + thinner layout). Base install only — no cairo/harfbuzz extras.
      Recorded in ADR-0020 §5.)*
- [x] T026 [US4] Write FAILING pytest first — `backend/tests/test_export.py`: **zero internal cost lines**
      (material/energy/machine/failure/margin) unless `includeCostBreakdown=true` (SC-506); a **kit** quote
      **itemizes every piece** (name + quantity) + total, still with zero cost lines (SC-515); the quote carries
      the **device record date** + validity period + seller identity from the **verified ID-token claims** (no
      display-name column exists; e-mail only when the claim is absent — Q13); **CSV rows equal the stored
      snapshots exactly** (no re-derivation, no drift — FR-513); **lapse ⇒ denied with NO partial artifact**
      (FR-515); free/signed-out ⇒ **no artifact produced** (Q7). Observe failing.
- [x] T027 [US4] Implement `backend/app/services/quote_render.py` + the export endpoints behind
      `require_entitlement` (**ACTIVE**). The renderer **prints stored, already-rounded values and performs ZERO
      arithmetic** — no formula, no markup, no gross-up. *"The backend never recomputes" (ADR-0008) stands,
      untouched — a document renderer forks nothing, which is exactly why the ADR-0015 precedent does not
      transfer.* Tests green.
- [x] T028 [US4] Web export UI: the opt-in "incluir detalhamento de custos" toggle (**off by default** — leaking
      margin to the seller's client is a product-level harm); **offline ⇒ the affordance is disabled WITH ITS
      REASON** ("exportar precisa de conexão"), never a fake success; a **pending** snapshot ⇒ **not exportable**
      until it syncs ("sincronize para exportar") — *you cannot export a record the record-keeper has never seen*.
      Failing-first, then implement.
      *Done 2026-07-16 (failing-first: 15 red → green).* `features/history/export-sheet.tsx` (`ExportButton` +
      Sheet, copy = ux §6/§8) mounted on the snapshot detail beside `RecalcTodayButton`;
      `entities/history/use-export.ts` (mutations, not queries — an export is an action with a device side
      effect, and a query would refetch on focus and re-download a file nobody asked for);
      `shared/lib/save-file.ts`. **`shared/api/transport.ts` gained `apiFetchFile`** — the generated Orval
      hooks are `useQuery`, and an export is an ACTION with a device side effect (a query would refetch on
      focus and re-download the file); only `apiFetchFile` reads `Content-Disposition`. The generated **url
      builders** stay the contract's source of truth, and the error path still parses the JSON envelope so a
      403 keeps `ENTITLEMENT_REQUIRED`.
      **Three copy strings are NEW** (ux §8 has no CSV-state button, no radio legend, no failure line) —
      `exportGenerateCsv` · `exportFormatField` · `exportFailed`, plus `exportCsvNote` (the CSV is rendered from
      the ACCOUNT, so a queued record is not in it — silence there would be a ledger that omits a quote the
      seller knows they made). **Ratify at T030** (ux §8 is "owner-ratified at homologation").
      **⚠ DEVIATION for T030:** ux §6 says lapsed ⇒ *"visible → reactivation panel"*; implemented as
      **visible + disabled + `exportLapsed`**, matching the offline/pending reason-pattern beside it and the
      shipped PR-B siblings (rename/delete/recalc are simply absent, explained by the page's lapse banner). A
      panel would open a dialog whose only content is the sentence already on screen, and there is no
      reactivation FLOW to offer before E6 (billing) — it would promise a door that does not exist.
- [x] T029 [P] [US7] **DROPPABLE (P3)** — snapshot vs today's cost, side by side ("cotado em {data}" vs "hoje"),
      purely informational; the frozen entry stays unmodified. **Cut this before cutting anything in US4.**
      *Done 2026-07-16 — **owner decision: BUILT, not dropped** (US4 landed whole, so nothing forced the cut).*
      `pages/historico/compare-today.tsx` (page layer, same reason as `recalc-today`: the recompute needs
      `features/calculator`, and FSD-Lite forbids a feature importing a feature) + 7 failing-first tests.
      It **reuses `recalcToday`**, which already carries the honesty flag this surface depends on: it renders
      "Hoje" **only when `fromFrozen === false`**. Under an unchanged formula a frozen fallback reprices to the
      frozen values exactly — so labelling those "Hoje" would answer *"seu custo não mudou"* with July's own
      number. The render keys off the ACTUAL outcome, never `!!product` (the trap the PR-A review caught in
      `RecalcDialog`). Compares **like with like** (an atacado quote vs today's atacado — pairing it with varejo
      would manufacture an increase that never happened) and **computes no delta**: money arithmetic lives in
      `pricing-core` (ADR-0008), and two labelled numbers answer the question without inventing a third.
      Origin unresolvable ⇒ the affordance is **silently absent** (FR-503 precedent: same as "abrir origem").
      **NEW copy** (ux never drew this surface) — `compareAction` · `compareToday` · `compareNote` ·
      `compareUnavailable`. **Ratify at T030.**
- [x] T030 [US4] Visual test: qa-produto homologates the export walk — quote content (zero cost lines by default;
      kit itemized), the opt-in breakdown, the **lapse denial**, the offline disabled-with-reason, and the pending
      "sincronize para exportar".
      *Done 2026-07-16 — **PASS-WITH-NITS** (168k tokens / 93 tool uses; ledger row filed).* Verified ON THE REAL
      RENDERED ARTIFACT (downloaded through the running app, not asserted from a 200): SC-506 default quote has
      **zero** cost lines · opt-in reveals them · the switch is **OFF again on reopen even after an opt-in export**
      · SC-515 kit itemizes · **FR-515 the server genuinely refuses on lapse** (403 ENTITLEMENT_REQUIRED, no bytes,
      real token) · offline/pending reasons · the midnight trap (01:30Z, offset −180 → PDF prints "13/07/2026") ·
      pt-BR money · regression 3/3 · zero pageerror at 390px + desktop.
      **DEFECT FOUND + FIXED (the one a green gate could not see):** `build_history_csv` emitted the stored **UTC**
      instant and **discarded the offset** — a 22:30 BRT quote is stored as 01:30Z, so card/detail/PDF said 13/07
      and the **CSV said 14/07**, with the local day *unrecoverable* from the file (FR-513 "the same dates",
      SC-511). It survived because `TestHistoryCsv` asserted label/total/basis/kind and **never the
      `deviceQuotedAt` value**. This is the **same defect class** ("the date is a day off") the backend
      homologation already caught in the PDF — it came back on the sibling surface nobody had rendered. Fixed
      failing-first (red proved "14/07/2026") by re-anchoring the stored offset: same instant, correct local day,
      and the offset now travels so a reader can recover the day themselves — **more** faithful to the stored row,
      no re-derivation (ADR-0008 intact).
      **NOT fixed, reported as ratification notes:** N1 `exportIncludeCostsWarn` says the customer would see
      "margem" though no margin LINE prints (it is derivable from costs+price); N2 `exportContents` says "nome e
      e-mail" though an account without a display name prints e-mail only. Both **over-warn** — they disclose more
      exposure than occurs, which is the safe direction for a privacy/margin notice — and both are ux §8 copy the
      owner already ratified; rewording ratified copy on a specialist's note is exactly what the 008 designer-ux
      lesson forbids. N3 (`Falhas R$ 0,00` under opt-in) is NOT a defect: those are **stored** zeros, not
      fabricated (FR-507).
      **Owner ratifications carried to T031:** all 8 new strings approved (`compareUnavailable` approved *with a
      tone caveat* — correct but long/technical); the **lapse deviation approved** — the page banner already says
      the sentence a "reactivation panel" would open, and the visible-disabled/absent asymmetry is defensible
      because export has three distinct unavailability causes while rename/delete have one. Optional trim offered:
      drop the 2nd sentence of `exportLapsed` (it echoes the banner).
      **RE-VERIFICATION 2026-07-16 (same agent via SendMessage) — verdict raised to PASS (confidence 85%→92%).**
      Both open items closed on real artifacts:
      · **The CSV fix, re-read on the downloaded file** under a REAL straddle (browser context in `Asia/Dubai`,
        UTC+4: UTC still 16/07 21:18Z while the device was already 17/07 01:18). Card, detail, **PDF and CSV all
        four agree on 17/07**, and `+04:00` travels in the file — the local day is recoverable, which was the half
        of the defect nobody could see. The old code would have emitted 16/07. (The −03:00 direction was not
        forcible on the real clock, but is covered by the new pytest and by the T027 direct render at −180 → 13/07;
        both directions go through the same `astimezone`.)
      · **US7 IS reachable, and is now proven in the browser — the earlier "no lever" finding was WRONG.** It was
        a bad generalization from a true fact: a product materialized from a KIT is born `filament_id=None`
        (`boms.py:157`), but a product **created in the Catálogo requires the links** (`produto-page.tsx:173`) ⇒ D3
        live-reflect ⇒ the lever exists. Walk: filament `PLA Azul` 110 → **220** ⇒ `Cotado em 16/07/2026 R$ 26,48`
        vs `Hoje R$ 43,80` (matches the predicted arithmetic), and **the frozen record did not move** — the detail
        still shows `Material R$ 11,55` from the old roll. The Ficha Técnica's promise ("não muda quando você edita
        o catálogo") is now **demonstrated, not asserted**. No blocker: "Hoje" never wore the frozen number — the
        `fromFrozen` gate holds. Judged readable as an ANSWER, not a riddle; `compareNote` does its job.
      *Known and correct:* a kit-materialized product (unlinked) will always show `Hoje == frozen` — it genuinely
      is not linked, exactly as its "Vincule um filamento e uma impressora" notice says. Not a defect; it just
      means the US7 lever depends on the link.
- [x] T031 [US4] **OWNER-GATED** PR-C: `pnpm gate:all` + `pnpm e2e` (SC-506/515 + lapse denial + **SC-512**) → PR
      to `develop` → CI green → owner squash-merge. **Owner accepts ADR-0020 at this gate** (incl. the accepted
      asymmetry: **recording works offline; exporting does not**). Graph refresh on merge.
      **PR #20 aberto** (`feature/009-e4-pr-c-export`); 9/9 checks verdes no commit pré-revisão.
      **Ciclo de revisão multi-agente (2026-07-16, ~2,13M tokens — ver `docs/token-ledger.md`):** 6 lentes
      sobre o diff → 21 achados, **zero refutados**, **4 BLOCKERs reais**, todos corrigidos test-first:
      (1) markup do ReportLab (`Paragraph` parseia o conteúdo — `label`/nome/e-mail crus sumiam, corrompiam
      ou davam 500; achado por 3 lentes independentes), (2) dinheiro contado 2× (`admin` **É** Σ otherCosts,
      pricing-core `index.ts:77/93`), (3) `int(0 or 1) == 1` (quantidade 0 é estado legal, Q1), (4) célula
      "item" em branco numa peça sem nome. Commit `c8977da`.
      **Depois, o restante dos achados** (MAJORs + os 5 sem veredicto + MINORs) — commit desta leva:
      `Content-Disposition` exposto via CORS (não é safelisted ⇒ `filenameFrom()` era código morto), o
      contrato passa a declarar os bytes (`format: "binary"` ⇒ Orval tipa `data: Blob`) e o `request()`
      devolve Blob real num 2xx não-JSON (o `res.text()` corrompia o PDF — o tipo prometia o que o mutator
      quebrava), `load_only` na query do CSV (a query puxava todo o JSONB para imprimir 6 escalares),
      `owned_snapshot` **compartilhado** em vez de copiado (2 cópias de um predicado de posse derivam, e o
      que deriva é o isolamento entre contas), contrato import-linter `api -> services -> models`, e a
      correção de copy (o aviso do opt-in nomeava "margem" — que nunca é linha impressa — e omitia
      acabamento/mão de obra/outros custos; kit tem aviso próprio; `exportContents` passa a nomear a
      "Referência", que é a nota privada do vendedor viajando até o cliente).
      **A lição, registrada:** as duas homologações **abriram o artefato** e passaram — com dados
      **benignos**. Os 4 blockers são todos dependentes de dado. Olhar o artefato é necessário e **não é
      suficiente**: é preciso olhar com dado **adversarial**. Os fixtures novos (`TestReviewBlockers`,
      `TestReviewCoverage`) são esse dado, e cada teste de `TestReviewCoverage` foi escrito contra uma
      mutação que o revisor rodou e viu passar verde.
      **Achado de processo (segurança do próprio review):** um refutador com Bash+escrita **editou
      `export.py` removendo o check de posse** para testar se algum teste pegava (nenhum pegava — esse era
      o achado) e reverteu. A árvore foi verificada antes de seguir. Próxima revisão: refutadores em
      `isolation: 'worktree'` ou sem ferramenta de escrita.
      **MERGED 2026-07-17** — owner squash-merged PR #20 into `develop` as **`e10b49f`**, CI green
      end-to-end. **ADR-0020 accepted at this gate**, incl. the accepted asymmetry it names explicitly:
      **recording works offline; exporting does not** — an export is a server-rendered artifact, and the
      server is exactly what an offline device does not have. Graph refreshed on merge (`post-merge` hook,
      AST-only, 0 tokens). With PR-A (#18 `b1fbd80`) and PR-B (#19 `bd9d95e`), all three E4 slices are on
      `develop`.

---

## Phase 9: Polish & cross-cutting

- [x] T032 [P] `specs/009-e4-history-snapshots-export/dod-evidence.md` — SC-501..515 map + gate/e2e evidence +
      the three homologation records + PR SHAs + owner sign-off.
      *Done 2026-07-17.* Written with **real** CI numbers (run `29548507245`): 253→**257** pytest (86.58%, floor
      82) after the T034 follow-up tests, 626 FE / 78 files, 120/120 e2e, import-linter 3 kept. Full SC-501..515
      map, all three homologation records, the review lesson, ADR-0018/0019/0020 statuses, and the T034 verdict.
- [x] T033 [P] Docs at close-out: the roadmap E4 row (`docs/product/business-rules.md`) → SHIPPED with the three
      PR SHAs; the `CLAUDE.md` ground line; **ADR-0018/0019/0020 → Accepted**; **A29 flipped to CLOSED** in
      `docs/decisions/audit-findings-r2.md` (open since 2026-07-02, closed by this epic).
      *Done 2026-07-17 at the close-out merge (PR #21 `55f49b6`).* Roadmap E4 row → **SHIPPED** with all four SHAs
      (#18 `b1fbd80` · #19 `bd9d95e` · #20 `e10b49f` · close-out #21 `55f49b6`); `CLAUDE.md` ground line → **E4
      COMPLETE** + E5 named UNSTARTED (spec-kit flow required, do NOT infer); ADR-0018/0019/0020 all **Accepted** at
      their gates; **A29 struck through** in `audit-findings-r2.md` with its actual answer (labeled + "Recalcular
      hoje", not the diff candidate). Graph refreshed on the merge (post-merge hook, AST-only, 0 tokens).
      **E4 CLOSED — all 34 tasks done.**
- [x] T034 Run `quickstart.md` §1..§9 end-to-end as the final validation before E4 close-out.
      *Done 2026-07-17 — **PASS-WITH-NITS** (qa-produto, the only cross-slice walk: record offline → sync → churn
      → export). §1–§5, §7, §9 PASS; §6/§8 PASS-WITH-NITS. Real stack, adversarial data, DB trigger proven by
      direct UPDATE, revoke/re-grant cycles. **One real defect** (PDF item-name overflowed the Qtd./Total columns
      — raw str in a Table cell, no length bound anywhere; text extraction was blind to the glyph collision) —
      **fixed** (name **and** the twin cost-label the `seguranca` review caught → `Paragraph(_xml(...))` + `VALIGN
      TOP`) with **geometry-based, mutation-proven** regression tests (`TestQuoteLayout`). Two recorded decisions
      (quickstart §8 doc corrected to Q15; CSV formula injection → consciously accepted in ADR-0020 §Consequences
      with 4 re-open triggers + the RFC4180 round-trip now pinned) and one open product question (recalc writes
      `label: null` — owner to decide). Full verdict in `dod-evidence.md`.)*

---

## Dependencies

- **Phase 2 blocks everything** (the frozen document + the immutable table). Test-first pairs: T002→T003,
  T004→T005→T006, T007 after T006 (contract ripple).
- **PR-A**: T008→T009 (outbox test-first); T010 after T009 (the record action enqueues); T011 after T009 (the
  sign-out guard reads the queue); T012→T013; T014→T015; T016 after all; T017 last.
- **PR-B needs PR-A merged** (snapshots must exist to be inert against churn). Inside: T018→T019→T020 (test-first
  → detail surface → recalculate); T021→T022; T023 after T020+T022.
- **PR-C needs PR-A** (server rows to render) — it does **not** need PR-B, so it could in principle move earlier;
  it stays last because it is the only slice that can be **cut** without leaving the product incoherent.
- Test-first pairs throughout: T002→T003, T004→T005, T008→T009, T012→T013, T014→T015, T018→T019, T021→T022,
  T026→T027.

## Parallel opportunities

- T001 (design handoff) runs alongside **all** of PR-A.
- Within Phase 2: the web frozen-payload pair (T002/T003) ∥ the backend table/router (T004–T006) — disjoint
  surfaces.
- T025 (PDF library verification) can start during PR-B — it is research, not code.
- T029 (US7) is [P] and droppable; T032/T033 (docs) are [P] at close-out.

## Implementation Strategy — honest MVP note

**E4 inverts E3's shape.** In E3 the composer had standalone value before persistence; here a Histórico with
nothing in it is worthless, so **PR-A *is* the server slice** — and it also carries the offline queue and the
immutability machinery. It is the biggest slice of the epic, and pretending otherwise is how it slips.

**PR-B** is where the epic's promise is actually *proved* (catalog churn inert), and **PR-C** is the only slice
that can be deferred without leaving the product incoherent — a Histórico that records and reproduces honestly is
already shippable value.

Each PR ships only with full `gate:all` + e2e + **SC-512 untouched** + qa-produto homologation + owner
authorization.
