# Tasks: E2 — catalog + persistence + entitlement scaffolding

**Input**: Design documents from `specs/007-e2-catalog-entitlement/` (spec.md · plan.md · research.md ·
data-model.md · contracts/api-surface.md · quickstart.md) + ADR-0012/ADR-0013 (owner-accepted 2026-07-09)

**Prerequisites**: plan.md ✅ (constitution 8/8) · data-model.md RATIFIED · all owner decisions recorded
(spec Clarifications + ADRs). Docker required for DB-backed dev/tests (visible skip without it, ADR-0013).

**Tests**: MANDATORY per Constitution III — every story starts with tests observed FAILING: the US1 gate
pytest exists BEFORE `require_entitlement`; CRUD stories get failing round-trip/validation/isolation pytest
+ failing component tests; US5's SC-305 byte-identity test precedes the picker; US7's teaser tests precede
the teaser. **SC-310 in every PR**: the existing E1 e2e guards pass UNCHANGED.

**Organization**: by user story, grouped into the plan's **3-PR delivery**. HONEST MVP NOTE: **PR-A alone
delivers no user-visible value** (it is the gate + the database); the demoable premium loop is **PR-A + PR-B**.
Every push/merge is **OWNER-GATED** (ADR-0006).

## Format: `[ID] [P?] [Story] Description`

---

## ══ PR-A — Foundational: the database + Constitution IV live ══

## Phase 1: Setup

- [x] T001 Local Postgres: `docker-compose.yml` (postgres service, dev credentials via env, volume) +
      `P3D_DATABASE_URL` in `backend/app/settings.py` (settings stays an import-linter leaf) + a "local DB"
      section in `backend/README.md` (or repo README) with `docker compose up -d postgres`.
- [x] T002 Backend deps (ADR-0013): add `sqlalchemy`, `alembic`, `psycopg[binary]` (+ `testcontainers` as
      dev-dep) to `backend/pyproject.toml`; `uv sync`; lockfile committed.
- [x] T003 `backend/app/db/` — async engine + session factory (settings-driven URL, `postgresql+psycopg://`);
      extend `[tool.importlinter]` contracts in `backend/pyproject.toml`: `app.api → app.entitlement →
      app.db` layering, `app.settings` stays dependency-free.
- [x] T004 Test infrastructure: `backend/tests/conftest.py` gains a testcontainers Postgres fixture with a
      **VISIBLE Docker-availability skip guard** (skip reason printed, never silently green — quickstart §6);
      `.github/workflows/ci.yml` gate job verified to run DB tests (ubuntu runners ship Docker — research R3;
      no service container needed if testcontainers manages its own).
- [x] T005 [P] designer-ux → Claude Design handoff (NON-BLOCKING, parallel with all backend work): catalog
      list/create/edit flows + states (empty/loading/error/offline), calculator "usar do catálogo" picker
      affordance, honest free-tier teaser (US7), Conta plan line — research §7. Output feeds the US3+/US7 UI
      tasks; NOT a merge blocker for PR-A.

## Phase 2: Foundational (blocking)

- [x] T006 SQLAlchemy 2.0 typed models per data-model §2 in `backend/app/models/`: `accounts` (uid PK, JIT),
      `entitlement_grants` (append-only ledger), `filaments`, `printers`, `products` (FK `ON DELETE SET
      NULL` + typed resolved-value columns + link-or-snapshot CHECK), NUMERIC money domains, text+CHECK
      enums, soft-delete columns, owner-uid indices (§7).
- [x] T007 Alembic: `backend/alembic.ini` + `backend/alembic/` init + **migration 0001** carrying the full
      data-model schema; `uv run alembic upgrade head` green against the compose DB; migration replay is the
      future Cloud SQL provisioning path (ADR-0013).
- [x] T008 ErrorCode ripple (same commit): `ENTITLEMENT_REQUIRED` in `backend/app/errors.py` ErrorCode +
      `ENTITLEMENT_ERRORS: {403: ErrorEnvelope}` responses constant; regen `contracts/openapi.json` + Orval
      client; pt-BR message in `apps/web/src/shared/api/error-messages.ts` ("Salvar faz parte do Premium." —
      final copy ratified with US7); contract drift-guard green.

## Phase 3: US1 — server-side entitlement gate (P1) [FOUNDATIONAL STORY]

**Goal**: 100% of persistence routes deny non-active writers server-side; client never trusted.
**Independent Test**: quickstart §1.

- [x] T009 [US1] Write FAILING pytest first — `backend/tests/test_entitlement_gate.py`: free identity denied
      `403 ENTITLEMENT_REQUIRED` on every persistence route (parametrized over the route table); forged
      client premium state is a non-event; nothing persisted on deny; signed-out → 401. Observe failing
      (routes/dependency don't exist yet — the test defines the target).
- [x] T010 [US1] Implement `backend/app/entitlement/` — `require_entitlement` dependency (ADR-0012):
      `active = granted ∧ ¬revoked ∧ (expiry null ∨ now < expiry)`; write-binary + lapsed-read semantics per
      the contracts authorization table; wired as THE single seam every catalog router must pass through.
- [x] T011 [US1] Route-audit test green: a pytest asserting 100% of routes under `/api/v1/{filaments,
      printers,products}` carry the dependency (inspect the FastAPI route table — no bypass path);
      `test_conformance.py` still green (token stub stays invalid → fuzz never reaches the DB).
      **Plus the FR-313 resilience test (analyze R1)**: with the database UNREACHABLE, the free surfaces
      (`/health`, `GET /api/v1/fee-catalog`, `/me` auth path) still respond — the engine/session must be
      lazy; only entitlement/catalog routes may fail, honestly.

## Phase 4: US2 — out-of-band grant/revoke (P1)

**Goal**: operator CLI makes the gate operable; ledger auditable; freeze on lapse.
**Independent Test**: quickstart §1 grant walk.

- [x] T012 [US2] Write FAILING pytest first — `backend/tests/test_entitlement_grants.py`: grant → writes
      allowed; revoke/expiry → writes 403 + reads 200 + **zero rows deleted** (freeze, SC-309); re-grant →
      same data writable; ledger rows carry grantor/source/granted_at/expires_at; JIT account creation (D1).
- [x] T013 [US2] Implement the operator CLI `backend/app/scripts/grant_premium.py` + `[project.scripts]`
      entry (`uv run grant-premium grant|revoke|list`) writing the ledger directly — NO HTTP route
      (operator-only by construction, ADR-0012). Target = **uid or e-mail of an EXISTING account** (the
      e-mail lookup resolves `accounts.email`, populated at first sign-in; email-invite/grant-before-sign-in
      is explicitly deferred — data-model §12, analyze P1). Tests green.
- [x] T014 [US2] `GET /api/v1/entitlement` in `backend/app/api/entitlement.py` → `200 {status, source?,
      expiresAt?}` + 401 only (no grantor leak; any authenticated account may ask) — failing contract test
      first, then regen ripple (openapi + Orval + drift-guard green; conformance auto-covers it).

## PR-A ship (STRICTLY ORDERED)

- [x] T015 **OWNER-GATED** PR-A: `pnpm gate:all` (DB tests running or VISIBLY skipped) + `pnpm e2e` (SC-310:
      E1 guards unchanged) → push `feature/007-e2-catalog-entitlement` → PR to `develop` (evidence-rich) →
      all CI checks green → owner squash-merge. **Checkpoint: Constitution IV is live and audited.**
      *(DONE 2026-07-09: PR #10 squash-merged to `develop`.)*

---

## ══ PR-B — The demoable premium loop (MVP = PR-A + PR-B) ══

## Phase 5: US3 — filaments CRUD (P1)

**Goal**: save/reuse filaments, per-account, validated, offline-readable.
**Independent Test**: quickstart §2.

- [x] T016 [US3] Write FAILING pytest first — `backend/tests/test_filaments.py`: CRUD round-trip
      (create→reload identical→edit→delete), per-field validation (E1 rules: finite ≥0, rollWeightKg>0 —
      rejected NEVER stored, FR-306), per-account isolation (account B sees zero of A — SC-308),
      lapsed=read-only.
- [x] T017 [US3] Implement: pydantic wire schemas (camelCase, money-as-string per contract) + CRUD router
      `backend/app/api/filaments.py` (statuses exactly per contracts/api-surface.md; `require_entitlement`)
      → pytest green → regen ripple (openapi/Orval/drift green; conformance green).
- [x] T018 [P] [US3] Frontend read cache — FAILING vitest first in `apps/web/src/entities/catalog/`:
      uid-KEYED cache (fee-catalog pattern: TanStack Query + idb-keyval) where the IndexedDB key AND the
      query key carry the uid; **purge-on-signout** (identity-leak lesson); honest staleness. Then implement.
- [x] T019 [US3] Catalog UI — FAILING component tests first: filament form (RHF+Zod, E1 validation
      messages) in `apps/web/src/features/catalog/` + real list/create/edit screens in
      `apps/web/src/pages/catalogo/` (replaces the placeholder; premium state only — free state is US7) +
      pt-BR keys in `messages.pt-br.ts`. Then implement to green.

## Phase 6: US4 — printers CRUD (P1)

- [x] T020 [US4] Write FAILING pytest first — `backend/tests/test_printers.py`: mirror T016 with the printer
      field set (machineLifetimeHours > 0 denominator rule).
- [x] T021 [US4] Implement `backend/app/api/printers.py` + wire schemas → green → regen ripple.
- [x] T022 [US4] Printer form + screens (FAILING component tests first) — mirror T019.

## Phase 7: US5 — calculator pre-fill (P1, the payoff)

**Goal**: pick saved filament/printer → fields fill, stay editable, math byte-identical.
**Independent Test**: quickstart §3.

- [x] T023 [US5] Write the FAILING **SC-305 byte-identity test** first in
      `apps/web/src/features/calculator/`: `computeFromForm` output from catalog-picked values equals
      (JSON.stringify) the manual-entry output — pricing-core untouched.
- [x] T024 [US5] Implement the pickers in `apps/web/src/pages/calcular/calcular-page.tsx` (+
      `features/calculator/` glue): filament/printer selectors populate the six fields, remain editable;
      free/signed-out renders no usable picker (teaser slot reserved for US7); offline pick works from the
      uid-keyed cache (Q2).
- [x] T025 [US5] E2E in `apps/web/tests/e2e/catalog.spec.ts`: premium (seeded grant) CRUD round-trip →
      pre-fill → computed price matches manual; offline read after online load; **SC-310: the whole existing
      E1 suite passes unchanged**. *(DONE 2026-07-10: commit `f2bffa3`, shipped in PR #11.)*
- [x] T025b [US2] Conta plan line (moved from PR-C — analyze I1: US2's FR-304 acceptance includes the
      honest Conta surface, and the owner's beta-grant walk needs somewhere to SEE the plan): FAILING
      component test first — plan line renders none/active/lapsed from `GET /api/v1/entitlement` with the
      ≤1-refresh honest UX copy ("recarregar/entre novamente", never a fake state); then implement the
      entitlement state hook in `apps/web/src/entities/user/` + the plan line in
      `apps/web/src/pages/conta/conta-page.tsx` + pt-BR keys.
- [x] T026 [US5] **Visual homologation (QA + OWNER)**: qa-produto drives catalog screens + pickers (390px,
      states); then the **owner beta-grant homologation** — owner runs `uv run grant-premium grant <own
      account> --source beta` and exercises the full premium loop end-to-end (grant → save filament/printer
      → calculator fills itself → **Conta shows the active plan, T025b**). 005 pattern, recorded as evidence.
      *(DONE 2026-07-10: owner homologated the PR-B premium loop — declared post-merge, evidence in
      `homologation-prb.md`. NOTE (owner, 2026-07-10): further homologation rounds MAY be required as
      development unfolds — this sign-off covers the PR-B scope only, not future increments. A Claude/QA
      homologation run of the same loop is recorded in the same evidence file.)*
- [x] T027 [US5] **OWNER-GATED** PR-B ship: full `gate:all` + e2e → push → PR to `develop` → CI green →
      owner squash-merge. **Checkpoint: the demoable MVP exists.**
      *(DONE 2026-07-10: PR #11 squash-merged to `develop` — `e655504`.)*

---

## ══ PR-C — Products + honest free tier ══

## Phase 8: US6 — products, live-recomputed (P2)

**Goal**: named reusable piece; reopening recomputes with the CURRENT formula; reference+fallback semantics.
**Independent Test**: quickstart §4.

- [ ] T028 [US6] Write FAILING pytest first — `backend/tests/test_products.py`: round-trip; response carries
      INPUTS ONLY (no stored price — FR-310/FR-313); editing a referenced filament reflects on reopen;
      deleting a referenced item → FK SET NULL + fallback columns satisfy the link-or-snapshot CHECK;
      isolation + lapse.
- [ ] T029 [US6] Implement `backend/app/api/products.py` + wire schemas (channels[]/otherCosts[] validated
      JSONB shapes per data-model D4) → green → regen ripple.
- [ ] T030 [US6] Product UI — FAILING component tests first: product form + list/edit in
      `features/catalog` + `pages/catalogo`; reopen → recompute via the EXISTING `computeFromForm` (current
      `PRICING_MODEL_VERSION`); dangling-reference warn UX (delete flow warns; product shows last-known
      values as editable overrides). Then implement.

## Phase 9: US7 — honest free-tier teaser + Conta plan line (P2)

**Goal**: free users meet honest teasers, never fake saves; Conta shows the true plan.
**Independent Test**: quickstart §5.

- [ ] T031 [US7] Write FAILING tests first: teaser component test (visible affordance → tap → honest panel,
      NO price/date, nothing persists, no fake success) + e2e (signed-out Catálogo tab + calculator picker
      slot → teaser). (Conta plan line moved to T025b/PR-B — analyze I1.)
- [ ] T032 [US7] Implement: teaser (extends the shipped Catálogo empty-state; copy in `messages.pt-br.ts` —
      final wording owner-ratified at T033). Tests green. (Conta line already shipped in PR-B, T025b.)
- [ ] T033 [US7] **Visual homologation (QA + OWNER)**: qa-produto drives the teaser (free + signed-out);
      Conta plan line states (none/active/lapsed via CLI toggling) re-verified together; owner ratifies the
      teaser copy.

## Phase 10: Polish & PR-C ship

- [ ] T034 Docs + evidence: `specs/007-e2-catalog-entitlement/dod-evidence.md` (gates, SC-301..310 map incl.
      failing-first outputs, grant-walk record, homologation evidence); mark E2 progress in
      `docs/product/business-rules.md` roadmap row + `docs/decisions/audit-findings-r2.md` capture log;
      update the 006 privacy notice with a data-saving line (catalog stores user data now — spec Out of
      Scope note).
- [ ] T035 **OWNER-GATED** PR-C ship: full `gate:all` + e2e → push → PR to `develop` → CI green → owner
      squash-merge. E2 closes.

---

## Dependencies

- **Phase 1 → 2 → 3 → 4 → T015** strictly ordered (PR-A); T005 is the only [P] parallel task (non-blocking
  design handoff feeding later UI).
- **PR-B needs PR-A merged** (gate + DB + models). Inside PR-B: T016→T017 and T020→T021 (test-first);
  T018 ∥ backend tasks (different surface); T019 after T017+T018; T022 after T021+T018; US5 (T023–T024)
  after T017/T021 (needs both entities) — T023 before T024 (test-first); T025→T025b→T026→T027 ordered
  (T025b needs T014's GET /entitlement, already merged in PR-A).
- **PR-C needs PR-B** (products reference filaments/printers; teaser attaches to catalog surfaces).
  T028→T029→T030; T031→T032→T033; T034→T035.
- Test-first pairs throughout: T009→T010, T012→T013, T016→T017, T018 (failing first), T020→T021, T023→T024,
  T028→T029, T031→T032.

## Parallel opportunities

- T005 (design handoff) runs alongside ALL of PR-A/PR-B backend work.
- Within PR-B: T018 (web cache) ∥ T016/T017/T020/T021 (backend CRUD) — disjoint surfaces.
- T001/T002 parallelizable at start; T006/T007 sequential (models → migration).

## Implementation Strategy — honest MVP note

**PR-A alone delivers no user-visible value** — it is the database + the live Constitution-IV gate + the
operator CLI (an operable, audited deny/grant machine). The **demoable MVP is PR-A + PR-B**: grant a beta
seller → they save filament + printer once → the calculator fills itself, byte-identical. PR-C completes the
catalog (products) and the honest free-tier surface. Each PR ships only with full `gate:all` + e2e + SC-310
untouched + owner authorization; UI stories carry qa-produto visual homologation plus the owner's own
beta-grant walk (T026).
