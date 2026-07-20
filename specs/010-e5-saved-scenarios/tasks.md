# Tasks: E5 — saved marketplace scenarios (the fourth object)

**Input**: Design documents from `specs/010-e5-saved-scenarios/` (spec.md · plan.md · research.md · data-model.md ·
contracts/api-surface.md) + **ADR-0021** (scenario persistence & the live-reference model — Proposed) +
ADR-0012/0013/0015/0017 (reused). Roadmap line: `docs/product/business-rules.md:56`.

**Prerequisites**: plan.md ✅ (Constitution Check 8/8 — VIII resolved, ADR-0021 Proposed, one recorded idiom-break) ·
`/speckit-clarify` ✅ (Q2/Q3/Q4 resolved) · E4 (009) shipped to `develop`. Docker required for DB-backed dev/tests.

**Tests**: MANDATORY per Constitution III — every story starts with tests observed **FAILING**. Load-bearing suites
that MUST precede their implementation: the **config intent-document** validator (decimal strings · structural not
shape-pinning · runs on INSERT *and* UPDATE), **D3 live-reflect / D6 last-known** on a referenced basis (VR-605/606),
**duplicate independence** (VR-608), **isolation** (VR-609), and **lapse read-only** (VR-610). **SC-612 in every PR**:
all E1/E2/E3/E4 guards pass UNCHANGED.

**Organization**: by user story, grouped into the owner-authorized **3-PR delivery** (spec §8). Every push/merge is
**OWNER-GATED** (ADR-0006); the graph refreshes on each merge into `develop` (ADR-0014).

> **PR-A is the server slice — a scenario has no standalone value before persistence (like E4, unlike E3).** But E5
> is **lighter** than E4: **no immutability trigger** (a scenario is mutable), **no offline outbox** (online-only
> writes, Q4), **no idempotency key**, **no money column**. It reuses the shipped stack almost entirely.

## Standing rules for every task in this feature

- **`pricing-core` does NOT change** (stays `3.1.0` — verified against source, R-A 92%). **No task may touch it.**
  Reopen re-runs the shipped 005 path (`fee-prefill.ts` re-resolves non-overridden slots + `computeCalculator` /
  `computeBom`); the scenario feature **orchestrates** existing code, it re-implements no pricing.
- **A scenario stores INTENT, never a resolved price** (VR-604/VR-611). A **non-overridden** fee slot stores **no
  fee number** — an **absent `feeOverrides` key** that re-resolves from today's catalog on reopen; a present leaf
  keeps the seller's override + the "ajustado por você" seal. That absence *is* the live-vs-frozen boundary.
- **Money in the `config` JSONB is a decimal STRING, never a float.** Postgres keeps `numeric`; `json.loads` /
  `JSON.parse` hand back floats — the loss is app-side and silent. The validator runs on **INSERT *and* UPDATE**
  (the row is mutable, the one operational difference from E4).
- **`config` validation is STRUCTURAL, not shape-pinning** (VR-603 / the E4 §9.6 lesson): validate the flat
  envelope + generic leaves; do **NOT** mirror `PriceInput`/`BomResult` field-by-field, or a pricing-core bump makes
  the backend reject its own configs.
- **Cost basis = soft reference, NO foreign key** (ADR-0021 N2 / data-model N2). D3/D6 resolved **read-time**
  (owner + `deleted_at IS NULL`, reusing the E3 `_resolve_views` seam); `lastKnown` re-snapshotted on **every** save
  (the `_snapshot_line` rule) so D6 is lossless. **Never claim "removido"** when a ref just doesn't resolve.
- **The scenarios list is (server list) ∪ (uid-keyed offline READ cache), purged on sign-out.** The **server holds
  NO queue state** (no outbox) — a row exists only once accepted; an offline save **fails honestly**.
- **qa-produto visual homologation before done in every slice**, with **adversarial DATA and SIZE** (the E4 lesson,
  twice): long scenario names, many channels, a deleted referenced basis, a kit basis — not benign "Cenário 1".
- **ADR-0021 is homologated by the owner at the PR-A gate** (T002); it stays Proposed until then.

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — The saved shelf: save · consult · offline read · honest teaser (US1 + US2 + US5) ══

## Phase 1: Setup

- [x] T001 [P] designer-ux → Claude Design handoff (NON-BLOCKING, parallel with all PR-A work): the scenarios
      surface (IA per Q11 — **inside Calcular** the working default), the "Salvar cenário" affordance + the name/note
      sheet, the scenarios list (name · note · last-updated — **ordering per data-model §7**, an owner+designer
      call), the **reopen → live** view (today's numbers, no frozen date; the "ajustado por você" seal; the offline
      staleness seal), and the US5 teaser. Write to `specs/010-e5-saved-scenarios/ux-scenarios.md`. Not a merge blocker.
- [x] T002 **Owner homologation checkpoint (BLOCKING the PR-A merge, Principle VIII).** Flip **ADR-0021**
      Proposed → Accepted and record the owner's calls in `spec.md` §Clarifications: the data-model §7 points (**Q6**
      name≤120/note≤500 caps · **list ordering** newest-saved vs recently-edited vs alphabetical · **`config` size
      cap** 256 KB → honest 422 · accent-sensitive search accept/defer · **§7.3** `config_schema_version` only, no
      advisory model-version column) + **Q12** kit-basis channel composition (uniform channelSet on every kit line →
      `computeBom` rollup, 70% — consumed by T024) + **Q13** save-to-deleted-id (accept-and-degrade, 75%) + the
      **`PUT` full-config-edit vs collapse-into-rename** call. Write `quickstart.md` (the validation walk) from the
      decided answers at this same checkpoint. No code merges past this without it. *(Sequencing: answer BEFORE
      starting T006/T007 — the caps, list ordering and size cap are baked into the migration's CHECKs, the §5 index
      and the validator; deciding first costs nothing, reversing later reworks them.)*
      **→ DECISIONS RECORDED 2026-07-19** (spec §Clarifications session 2026-07-19; data-model §7 marked DECIDED;
      ADR-0021 §Decision annotated; `quickstart.md` written): all defaults confirmed — ordering `created_at DESC` ·
      `PUT`+`PATCH` separate · Q12 uniform channelSet → `computeBom` rollup · Q13 accept-and-degrade · caps 120/500 ·
      256 KB → 422 · accent-sensitive accepted · no model-version column. **Remaining in T002: flip ADR-0021 →
      Accepted at the PR-A merge homologation.**
      **→ CLOSED 2026-07-20**: owner homologated + merged PR #24 (`8386972`); ADR-0021 flipped → Accepted.

## Phase 2: Foundational (blocking) — the intent document + the table

- [x] T003 Write FAILING vitest first — `apps/web/src/entities/scenario/config-document.test.ts`: the config
      serializer emits **decimal STRINGS** for every money/rate/qty/percent leaf and integer JSON numbers only for
      counts; a **non-overridden** slot serializes with **no `feeOverrides` key** (absent = re-resolve live), an
      overridden slot keeps its string leaf; a round-trip preserves exact strings (no float); the envelope is the
      **flat** shape of `data-model.md` §3 and is **structurally independent** of `PriceInput`/`BomResult` (a
      type-level pin). Observe failing.
- [x] T004 Implement the config intent-document contract in `apps/web/src/entities/scenario/config-document.ts` —
      the flat envelope (`schemaVersion`, `includeMarketplace`, `costBasis {kind, ref|null, lastKnown}`, `channels[]`
      with per-slot `feeOverrides` = explicit overrides only, `otherCosts[]`) + serialize from the live calculator /
      bom state (reuse the 005 `fee-prefill.ts` `edited` state to decide which slots are overridden). Tests green.
- [x] T005 Write FAILING pytest first — `backend/tests/test_scenarios.py` (PR-A subset): **VR-601** entitlement gate
      (free/signed-out/faked-premium → `403 ENTITLEMENT_REQUIRED`, nothing written/read); **VR-602/603** config
      validation (a float leaf → `422`; **structural, not shape-pinning**; runs on INSERT); **VR-607** materializes
      nothing (filaments/printers/products/boms counts unchanged); **VR-609** isolation (account B → `404`, no
      existence oracle, incl. a guessed id); **VR-611** no `Numeric` column / no price on the row; **VR-613**
      envelope↔column binding; **VR-614** name/note well-formedness. Observe failing.
- [x] T006 Alembic **migration `0004`** (`down_revision = "0003"` — never amend a shipped migration) + SQLAlchemy 2.0
      `Scenario` model per `data-model.md` §2/§4/§5: the columns, the named `CHECK`s, **`owner_uid → accounts` as the
      ONLY FK**, the partial index `ix_scenarios_owner_active (owner_uid, created_at, id) WHERE deleted_at IS NULL`;
      **NO trigger, NO idempotency key, NO money column, NO catalog FK** (each a documented non-mistake). Nothing in
      the existing four tables is touched (FR-620). `uv run alembic upgrade head` green against the compose DB;
      `downgrade()` reverses exactly.
- [x] T007 Implement `backend/app/api/scenarios.py` — **POST** create · **GET** list (keyset `(created_at, id)`,
      never OFFSET; `?q=` owner-scoped `ILIKE`) · **GET /{id}** — per `contracts/api-surface.md`; the recursive
      **config validator** (VR-602/603, on write) as a reusable dependency; `require_entitlement` (ACTIVE) on writes,
      `require_catalog_read` (active|lapsed) on reads; `owner_uid` injected from the verified token; **materializes
      nothing**; the server holds **no** queue state. PR-A pytest subset green.
- [x] T008 Contract ripple (same commit): regen `contracts/openapi.json` + the Orval client (RAW output from root);
      prove the **drift-guard is idempotent** (a second regen yields 0 diff — the docstring-in-OpenAPI trap).

## Phase 3: User Story 1 — Save a scenario (Priority: P1) 🎯 MVP

**Goal**: a premium seller saves a configured multi-channel calculation as a named scenario. **Independent test**:
save with a name; on a fresh session/device it appears in the list and reopens with config restored + recomputed
live; a free/signed-out caller is denied server-side and nothing persists.

- [x] T009 [US1] Write FAILING vitest — `features/scenarios`: the save action maps the live calculator/bom state →
      the config document (only explicit overrides persisted; ad-hoc vs a Product/Kit `ref` captured with its
      `lastKnown`); **materializes nothing** client-side. Observe failing.
      **→ DONE 2026-07-19 (FE wave) with two dated deviations, accepted by the main loop:** (a) the mapping lives in
      `features/calculator/scenario-bridge.ts` — FSD-Lite forbids feature→sibling-feature imports, so the bridge sits
      with the owner of `CalcFormValues` (the `RecordSource.freeze()` precedent); `features/scenarios` only handles a
      built `ScenarioConfig`. (b) **PR-A captures an AD_HOC basis only** — the Calcular page holds no persistent
      product/kit binding to capture a `ref` from; PRODUCT/KIT ref capture at save moves to **T021b** (PR-B, with the
      D3/D6 lifecycle). The backend ref path (T011 re-snapshot) is live and pytest-covered regardless.
- [x] T010 [US1] Implement the save action + the "Salvar cenário" affordance + name/note sheet in
      `apps/web/src/features/scenarios/` wired to `POST /api/v1/scenarios`; a **premium client route-guard** (honest,
      over the server gate — ADR-0015; the UI must not imply the recompute is server-enforced). Tests green.
      **NOTE (T004 finding, 2026-07-19 — the cross-domain half, assigned HERE):** the shipped 005 form tracks manual
      fee input per-SLOT (`hasManualInput` boolean); the config document needs per-FIELD `feeOverrides` — T010 adds
      per-field edited tracking at the form layer AND maps the feature's live state into the entity's parameter
      shapes (`ScenarioCostBasis`/`ScenarioChannelSlotState` — the serializer deliberately imports no feature types).
- [x] T011 [US1] Backend: on a save carrying a `costBasis.ref`, **re-snapshot `lastKnown` from the live
      reference** (reuse the E3 `_snapshot_line` rule) so D6 is lossless (VR-606 groundwork). Tests green.

## Phase 4: User Story 2 — Consult (list, open, offline read) (Priority: P1)

**Goal**: the scenarios surface lists saved scenarios and reopens one to a live recompute; reading works offline
after one online load; sign-out purges the cache.

- [x] T012 [US2] Write FAILING vitest — `entities/scenario/use-scenarios.test.ts`: the selector = server list +
      uid-keyed offline **READ** cache; **purge-on-signout**; **no** outbox / no queue state; an offline **save**
      fails honestly (no silent drop, no fake success) (**VR-612**). Observe failing.
- [x] T013 [US2] Implement `apps/web/src/entities/scenario/use-scenarios.ts` + the list UI (name · note ·
      last-updated; **ordering per the T002 decision**) + reopen restores the config into the calculator. Tests green.
- [x] T014 [US2] Reopen → **live recompute** orchestration in `features/scenarios`: reuse the 005 `fee-prefill.ts`
      (re-resolve each non-overridden slot from **today's** catalog by determinants; keep overrides + seal) →
      `computeCalculator` (ad-hoc/product basis) or `computeBom` (kit basis). **No pricing re-implemented** (R-A).
      Today's numbers, no frozen date; the offline staleness seal when the cached reference is stale. The 005 honesty
      cases hold **inside a reopened scenario** (FR-609, spec §Edge Cases) with FAILING-first assertions: a slot the
      catalog cannot resolve → the "sem referência" manual-entry fallback (no fabricated pre-fill); a saved override
      ≥100% commission → the same inline per-slot error, other slots keep computing, no NaN/Infinity. Tests green.

## Phase 5: User Story 5 — Honest teaser (Priority: P2)

**Goal**: every free/signed-out save affordance opens an honest premium notice; the free 005 calculator is untouched.

- [x] T015 [US5] Write FAILING vitest — free/signed-out: the scenarios surface / "Duplicar" open the honest teaser;
      **nothing persists**, no price, no date, no fake "salvo!", no pre-E6 CTA. **Per the 2026-07-19 SC-109
      ratification: the FREE calculator has NO inline "Salvar cenário" button** (SC-109 + its e2e stand) — the free
      door is the "Meus cenários" entry; assert the button's ABSENCE for free/signed-out too. Observe failing.
- [x] T016 [US5] Implement the teaser (E2 US7 / E3 US5 / E4 US5 lineage) in `features/scenarios`; the free 005
      multi-channel calculator remains fully free, offline, unchanged. Tests green.

## Phase 6: PR-A hardening & delivery

- [x] T017 e2e (Playwright, `apps/web/tests/e2e/`): save online → reopen-live → list; offline read from cache;
      honest offline-save failure; sign-out purges the cache; teaser for free/signed-out. **Reach detail via
      client-nav, never `page.goto` a 2-segment deep link** (the `base:'./'` blank-route trap).
- [x] T018 qa-produto visual homologation (390px + desktop) — the **save → reopen-live** walk, the teaser, offline
      read + honest offline-save failure. **Adversarial DATA + SIZE**: a long scenario name, many channels, an
      ad-hoc basis (a **product basis via the UI lands in PR-B — T021b**; its server path is pytest-covered by T011).
      Screenshots.
      **→ DONE 2026-07-19, PASS-WITH-NITS 88% (3rd attempt).** Attempt 1 (haiku, 011 routing) FAILED the mandate
      (0 screenshots, 6/8 deferred, rounded-up verdict — the pilot's first negative datum); attempt 2 (opus lift)
      honestly BLOCKED (mcp playwright tools never register in this harness session); attempt 3 (same opus agent,
      authorized alternative: scratchpad capture script + verdict from READING the PNGs) delivered 8/8 judged by
      image, 19 PNGs in `evidence/t018/`. Nits (cosmetic, → PR-B follow-up): note line-clamp without ellipsis on a
      spaceless 500-char token; context-bar name cut without ellipsis; teaser signed-out dialog shows only the
      tailored body (PO ratification). qa-produto ROUTING DECISION → owner at the PR-A gate (ADR-0022 rollback).
- [x] T019 `pnpm gate:all` green (fe format/lint+boundaries/depcruise/typecheck/coverage AND be
      ruff/basedpyright/pytest/import-linter) + drift-guard idempotent + **SC-612** (all E1/E2/E3/E4 guards pass
      UNCHANGED). Record evidence in `specs/010-e5-saved-scenarios/dod-evidence.md`.
- [x] T020 **Owner-gated PR-A → `develop`** (squash). On merge: `graphify update .` (ADR-0014 freshness).
      **→ DONE 2026-07-20**: owner squash-merged PR #24 → `develop` (`8386972`); graph refreshed via the
      post-merge/post-checkout hooks on the local ff-pull.

---

## ══ PR-B — The live contract · duplicate-to-tweak · lifecycle (US3 + US4 + US6) ══

## Phase 7: User Story 3 — The LIVE contract (Priority: P1)

**Goal**: a scenario reflects catalog churn (the opposite of a snapshot). **Independent test**: edit a referenced
product → reopen reflects it (D3); delete it → reopen degrades to last-known honestly (D6, never "removido"); a
fee-catalog refresh re-resolves non-overridden slots while overrides stick.

- [x] T021 [US3] Write FAILING pytest — `test_scenarios.py`: **VR-605** D3 live-reflect (referenced product edit →
      reopen resolves the **live** row) + **VR-606** D6 last-known (referenced product soft-deleted / cross-tenant /
      never-existed → degrade to `config.costBasis.lastKnown`, editable + re-saveable, honest caption, **0** breaks) +
      **VR-604** (a non-overridden slot re-resolves to a mutated catalog fee; an overridden slot keeps its value).
      Observe failing.
- [x] T022 [US3] Implement the **read-time resolver** in `scenarios.py` — resolve `costBasis.ref` **owner +
      `deleted_at IS NULL`** (reuse the E3 `_resolve_views` seam) → D3 live / D6 last-known + a `degraded` flag;
      `GET /{id}` (and every write response) returns the resolved-or-degraded basis. Tests green.
- [x] T023 [US3] Frontend: the reopen recompute reflects D3/D6; the honest **degraded caption** (reuse the E2/E3
      last-known copy — never "removido"; "Abrir origem" offered only if the ref resolves); the "ajustado por você"
      seal on overridden slots; the 005 staleness seal offline. Tests green.
- [x] T021b [US3] FE: capture a **PRODUCT/KIT `costBasis.ref` (+ `lastKnown`) at save** when the calculator was
      prefilled from the catalog — the PR-A wave saved AD_HOC only (T009 dated note); this closes FR-606a on the UI
      side and lets the qa D3/D6 walk run end-to-end from the app. Tests first.
      **→ PARTIAL 2026-07-20 (`ab9441a`)**: PRODUCT half DONE (produto-page "Salvar cenário" → `costBasis`
      PRODUCT ref + lastKnown, test-first). **KIT half = Principle VIII stop, NOT inferred**: the kit composer
      has per-LINE channels and no kit-level channel picker; `ux-scenarios.md` specifies no such UI. Owner
      options: (a) derive from a kit line's channelSet · (b) new kit-level picker (new UI) · (c) KIT-basis
      scenarios originate elsewhere (defer). T024 (reopen/compute side) is DONE independently.
      **→ OWNER DECIDED 2026-07-20: (c) defer KIT-basis creation** (spec §Clarifications session 2026-07-20;
      KIT-creation UI → designer-ux, PR-C candidate or post-E5). T021b CLOSED at the decided scope.
- [x] T024 [US3] **Kit-basis channel composition (Q12, owner-decided at T002)**: apply the scenario's channelSet
      uniformly to every kit line → `computeBom` → per-marketplace rollup. **No `pricing-core` change** (both engines
      exist). Tests green.

> **BE wave DONE 2026-07-20** (commit `2e31b8d`, dev-backend sonnet + main-loop KIT redirect): T021/T022 +
> T025/T026 + T027/T028 — resolver D3/D6 covers **PRODUCT + KIT** (contract §99–102; the KIT half was a
> main-loop catch against the contract), 55/55 in-file + 319 full suite re-measured, regen idempotent 2×.
> VR-604's live re-resolution is CLIENT-side (fees never resolved server-side) → pre-assigned to T023.

## Phase 8: User Story 4 — Duplicate-to-tweak (Priority: P1)

**Goal**: clone a scenario, change one thing, compare — the headline value. **Independent test**: duplicate, tweak
the copy, confirm the original is byte-for-byte unchanged and vice versa.

- [x] T025 [US4] Write FAILING pytest — **VR-608** duplicate independence: `POST /{id}/duplicate` **deep-copies**
      `config` into a new row (new `id`, own `name`); editing the copy changes **0%** of the original, and vice
      versa. Observe failing.
- [x] T026 [US4] Implement `POST /api/v1/scenarios/{id}/duplicate` (deep copy) + the "Duplicar" affordance in
      `features/scenarios`. Tests green.

## Phase 9: User Story 6 — Manage + lapse (Priority: P2)

**Goal**: rename, edit-the-whole-config, search, delete; on lapse everything stays readable + recomputable, all
writes denied, nothing auto-deleted.

- [x] T027 [US6] Write FAILING pytest — **PUT** full-config edit (VR-602/603 re-run on **UPDATE**) + **PATCH**
      rename (`name`/`note` only, `extra="forbid"` → smuggled field `422`) + **DELETE** soft + name search (owner-
      scoped `ILIKE`, VR-611-adjacent) + **VR-610** lapse (reads `200`, all writes `403`, **0** rows deleted/modified,
      re-grant restores writes with data intact). Observe failing.
- [x] T028 [US6] Implement `PUT /{id}` (full-config replace) · `PATCH /{id}` (rename) · `DELETE /{id}` (soft) + the
      `?q=` name search, per contract; `require_entitlement` (ACTIVE) on writes, reads survive lapse. Tests green.
- [x] T029 [US6] Frontend: rename, **edit-config** (reopen → edit → `PUT`), search, delete; the **lapse read-only**
      surface (reuse the E2/E3/E4 authorization-freeze pattern — readable/recomputable, writes disabled with reason).
      Tests green.

## Phase 10: PR-B hardening & delivery

- [ ] T030 e2e: save referencing a product → **edit the product → reopen reflects** (D3); **delete it → reopen
      degrades honestly** (D6, no "removido"); **duplicate → tweak → compare**; rename/edit/search/delete; the lapse
      read-only surface. Client-nav for detail.
- [x] T030b [P] Cosmetic T018 nits (owner-decided 2026-07-19 → PR-B follow-up): ellipsis truncation for the
      spaceless-note line-clamp on the list card; ellipsis on the context-bar scenario name (actions already never
      displaced).
- [ ] T031 qa-produto visual homologation (390px + desktop) — the **D3/D6 degradation** walk + **duplicate-to-tweak**
      + manage + lapse. **Adversarial DATA**: a deleted referenced basis, a kit basis, long names. Guard the honesty
      class (F1: never "removido/excluído" when the ref merely didn't resolve; never present stale as live).
      Screenshots.
- [ ] T032 `pnpm gate:all` + drift-guard idempotent + **SC-612**. Evidence in `dod-evidence.md`.
- [ ] T033 **Owner-gated PR-B → `develop`** (squash). On merge: `graphify update .`.

---

## ══ PR-C — The E4 bridge: record a snapshot from a scenario (US7, P3 — DROPPABLE) ══

> P3 = explicitly droppable if the epic runs long. **Cut US7 before cutting US4.** A scenario tool that saves,
> reopens-live and duplicates is already shippable value.

## Phase 11: User Story 7 — Record a snapshot from a scenario (Priority: P3)

- [ ] T034 [US7] **Checkpoint (owner + E4 owner)**: US7 adds `"SCENARIO"` to the E4 `snapshots.payload.provenance.kind`
      enum (data-model §7.6) — **a snapshot-payload change, NOT a `scenarios`-table change**; confirm it does not
      touch snapshot immutability (ADR-0019).
- [ ] T035 [US7] Write FAILING pytest/vitest — recording from a scenario's live result = a frozen E4 snapshot
      **byte-identical** to the displayed computation; provenance ("originou-se do cenário X") **informational only**;
      the snapshot **never recomputes** and a later catalog/fee change alters **0%** of it; the scenario is unchanged
      (SC-611). Observe failing.
- [ ] T036 [US7] Implement the record-from-scenario path — **reuse the E4 US1 record path** (`features/history`) with
      the scenario added as an informational provenance source; no new snapshot machinery. Tests green.
- [ ] T037 [US7] qa-produto homologation of the record-from-scenario bridge + `pnpm gate:all` + drift-guard +
      SC-612. Evidence.
- [ ] T038 [US7] **Owner-gated PR-C → `develop`** (squash). On merge: `graphify update .`.

---

## Phase 12: Polish & cross-cutting (at epic close-out)

- [ ] T039 [P] Update `CLAUDE.md` ground line + `docs/product/business-rules.md:56` (E5 → BUILT/SHIPPED) + the E5
      `dod-evidence.md` cross-slice homologation; flip **ADR-0021** to Accepted if not already; final `graphify
      update .`.

---

## Dependencies & execution order

- **Setup (T001–T002)** → **Foundational (T003–T008)** block everything. **T002 (owner homologation of ADR-0021 +
  §7 points) BLOCKS the PR-A merge**, not the early coding — but nothing merges without it.
- **PR-A (US1 → US2 → US5)**: T009–T011 (US1) → T012–T014 (US2, needs the config contract T004 + the API T007) →
  T015–T016 (US5) → hardening T017–T020.
- **PR-B (US3 · US4 · US6)** depends on PR-A merged (persistence + the save/reopen path). US3/US4/US6 are largely
  independent of each other and can proceed in parallel once T021/T025/T027 tests are red.
- **PR-C (US7)** depends on PR-A (the scenario exists) + the shipped E4 record path; **droppable**.
- **`pricing-core` is never touched** by any task.

## Parallel opportunities

- **T001 (designer-ux handoff)** runs parallel to all PR-A work (non-blocking).
- Foundational: **T003/T004 (FE config contract)** ∥ **T005/T006 (BE table + tests)** — different dirs.
- Within PR-B: **US3 (T021–T024)** ∥ **US4 (T025–T026)** ∥ **US6 (T027–T029)** once their red tests are written —
  distinct endpoints/surfaces.
- Every "Write FAILING test" task [P] with its sibling in another dir.

## Implementation strategy (MVP first)

- **MVP = PR-A (US1 + US2 + US5)**: a premium seller saves a multi-channel comparison and reopens it computing
  today's numbers; a free user sees an honest door. Independently shippable and demoable.
- **PR-B** proves the four-object taxonomy (the live contract) and delivers the headline value (duplicate-to-tweak) +
  lifecycle. **PR-C** (the E4 bridge) is the natural cut if the epic runs long.
