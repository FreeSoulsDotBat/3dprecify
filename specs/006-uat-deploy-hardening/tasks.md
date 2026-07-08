# Tasks: R2 infra close-out — first public UAT deploy + contract hardening + gate parity

**Input**: Design documents from `specs/006-uat-deploy-hardening/` (spec.md · plan.md · research.md ·
data-model.md · contracts/error-contract.md · quickstart.md)

**Prerequisites**: plan.md ✅ · research.md ✅ (arquiteto, must-verify facts already verified in-session
2026-07-08: PRs #6/#7 merged, `main` head pre-foundation, orphan branch superseded) · owner clarifications
folded into spec (FR-209 release merge; FR-214 minimal notice).

**Tests**: MANDATORY per Constitution III where code is touched — the conformance pytest is written first and
observed FAILING (undocumented 401 on `/me`); the privacy page gets a failing component test + e2e first;
`gate:all` is verified by deliberate failure (SC-206). Provisioning/deploy tasks are process tasks verified by
the smoke checklist + rollback rehearsal (their "test" is the runbook execution, recorded as evidence).

**Organization**: by user story, BUT the execution order is research-ratified (§2): ALL code hardening (US2,
US3, US1-code, US4) lands on `develop` first → release merge `develop`→`main` → only then the deploy
trigger/smoke/rollback (US1-execution). The owner-gated provisioning track (Phase 2) has no branch dependency
and runs IN PARALLEL with the code phases.

## Format: `[ID] [P?] [Story] Description`

**OWNER-GATED** tasks require console/billing/GitHub-settings actions or an explicit owner authorization
(ADR-0006) — the Q-D pattern from 005. Nothing else proceeds past them by assumption.

---

## Phase 1: Setup

- [ ] T001 Create `docs/runbooks/` and skeleton `docs/runbooks/uat-deploy.md` with the four fixed sections
      (research §1.4): Config & prerequisites · Deploy · Smoke checklist · Rollback & half-deploy triage.

---

## Phase 2: Owner-gated provisioning track (parallel — blocks ONLY Phase 7)

**Purpose**: stand up the cloud side (research §1.1–1.3). No repo/branch dependency; guided `gcloud` where
possible, console where unavoidable. Every value lands in the GitHub `uat` Environment, never in the repo
(FR-208).

- [ ] T002 [P] **OWNER-GATED** GCP project + billing + APIs + Artifact Registry (P1–P3): create/confirm
      project, enable billing, enable Cloud Run/Cloud Build/Artifact Registry/IAM-Credentials/Firebase APIs,
      create AR repo `cloud-run-source-deploy` in `southamerica-east1` (or grant AR-admin for first-deploy
      auto-create). Record ids in `docs/runbooks/uat-deploy.md` §1.
- [ ] T003 [P] **OWNER-GATED** Service accounts + least-privilege roles (P4/P7): create deploy SA + confirm
      runtime SA; grant `run.admin` + `iam.serviceAccountUser` + build path per research §1.2 — **verify the
      exact minimal role names against live GCP IAM docs at grant time** (research confidence ~80%).
- [ ] T004 **OWNER-GATED** WIF pool + OIDC provider + binding (P5/P6): issuer
      `https://token.actions.githubusercontent.com`, attribute condition pinning
      `repository == FreeSoulsDotBat/3dprecify`, bind principalSet → deploy SA
      `roles/iam.workloadIdentityUser`. Depends on T003 (the SA must exist).
- [ ] T005 [P] **OWNER-GATED** Firebase side (P8–P11): link project `precifica3d-uat` to the GCP project,
      confirm default Hosting site, create the Web App (yields `FIREBASE_WEB_API_KEY`/`FIREBASE_WEB_APP_ID`),
      enable Google Auth provider + add the Hosting domain to authorized domains, generate the Firebase SA
      JSON for the hosting action.
- [ ] T006 **OWNER-GATED** Populate GitHub Environment `uat` (research §1.1): 5 vars (`DEPLOY_ENABLED=true`,
      `GCP_PROJECT`, `GCP_REGION=southamerica-east1`, `FIREBASE_PROJECT=precifica3d-uat`, `SPA_ORIGINS` only
      if needed) + 5 required secrets (`WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT`,
      `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_APP_ID`) + optional `SENTRY_DSN`/`SENTRY_DSN_WEB`. Depends on
      T002–T005 for the values.

---

## Phase 3: User Story 2 — one command, every gate (D4, P2)

**Goal**: `pnpm gate:all` invoked verbatim by lefthook pre-push AND one CI job — parity inspectable, not
asserted (SC-206). Retires the `local-gate-vs-ci-gap` tribal knowledge.
**Independent Test**: quickstart §1 (deliberate-failure check + parity inspection).

- [ ] T007 [US2] Add composable scripts to root `package.json`: `gate:fe` (= current `gate` chain), `gate:be`
      (`cd backend && uv run ruff check . && uv run ruff format --check . && uv run basedpyright && uv run
      pytest -q && uv run lint-imports`), `gate:all` (`pnpm gate:fe && pnpm gate:be`). Keep `gate` as an alias
      of `gate:fe` or remove it (no dead duplicate — Constitution V; check references first).
- [ ] T008 [US2] Point `lefthook.yml` pre-push at `pnpm gate:all`, REPLACING the current thin
      `typecheck`+`pnpm -r test` subset (no reduced local subset survives, FR-212).
- [ ] T009 [US2] Rewire `.github/workflows/ci.yml`: ONE job running the literal `pnpm gate:all` (runner with
      Node 24/pnpm + uv/Py 3.12, same dual setup as `contract-drift`) REPLACES the separate Frontend/Backend
      gate jobs; `e2e`, `docker`, `contract-drift`, `secret-scan` stay parallel; update the `ci-pass` roll-up
      needs list accordingly.
- [ ] T010 [US2] SC-206 deliberate-failure verification: introduce a backend lint violation + drop one
      pricing-core test → `pnpm gate:all` fails locally on both; revert; capture the two failure outputs for
      `dod-evidence.md`. Verify pre-push actually blocks (attempt a push with the violation in place, then
      revert).

**Checkpoint**: every later push in this feature is protected by the full gate.

---

## Phase 4: User Story 3 — honest error contract + conformance (A21, P3)

**Goal**: `/me` publishes 200+401 (ErrorEnvelope), phantom 422/`HTTPValidationError` gone everywhere, no
phantom 403 added; Schemathesis-as-pytest (ASGI) fails CI on any contract↔reality divergence.
**Independent Test**: quickstart §2; contracts/error-contract.md is the target state.

- [ ] T011 [US3] Write `backend/tests/test_conformance.py` FIRST: Schemathesis v4 `openapi.from_asgi("/openapi.json", create_app(...))`
      + `@schema.parametrize()` + `case.call_and_validate()` over ALL operations; deterministic Hypothesis CI
      profile (`deadline=None`, fixed `max_examples`, `derandomize=True`); token-verify stub (reuse the
      `test_me.py` monkeypatch pattern) so fuzzed `Authorization` yields a stable 401. **Run and observe it
      FAILING** against the current contract (undocumented 401 on `/me`) — record the failure for evidence.
- [ ] T012 [US3] Declare the reachable statuses: shared constants in `backend/app/errors.py`
      (`AUTH_ERRORS = {401: {"model": ErrorEnvelope}}`, optional `INTERNAL_ERRORS`) and apply
      `responses=AUTH_ERRORS` on `/me` in `backend/app/api/me.py`. NO 403 (would be a fresh phantom).
- [ ] T013 [US3] Strip the phantom: `app.openapi()` override in `backend/app/main.py` deleting any `422`
      response whose schema `$ref` ends in `HTTPValidationError` (per-route `responses=` cannot remove the
      auto-422). `test_conformance.py` now passes; `HTTPValidationError`/`ValidationError` components drop out.
- [ ] T014 [US3] Regenerate the wire artifacts in the same commit: `contracts/openapi.json` + Orval client
      (`apps/web/src/shared/api/generated.ts`); verify `grep -c HTTPValidationError contracts/openapi.json`
      → 0 and the contract drift-guard is green.
- [ ] T015 [US3] Migrate `apps/web/src/entities/user/use-identity` to the generated client now that the
      phantom-422 union is gone (**retires TD-019**); remove any now-dead hand-rolled typing; frontend gate +
      e2e stay green.
- [ ] T016 [US3] Update the substitute note in `backend/tests/test_fee_catalog.py` (the hand-written contract
      test no longer "replaces Schemathesis" — it complements it); confirm the conformance test runs inside
      `gate:be`/`gate:all` (Phase 3 wiring) and in the CI gate job.

---

## Phase 5: User Story 1 (code half) — privacy notice + runbook + optional release stamp

**Goal**: everything US1 needs IN the repo before the ship chain: the FR-214 notice, the runbook content, and
the (owner-veto-pending) release-correlation stamp.
**Independent Test**: quickstart §3; runbook review.

- [ ] T017 [P] [US1] Write the FAILING tests first: component test
      `apps/web/src/pages/privacidade/privacidade.test.tsx` (renders the pt-BR notice signed-out) + e2e
      addition in `apps/web/tests/e2e/` (open `/privacidade` signed-out → notice visible; sign-in screen
      shows the "Como tratamos seus dados" link). Observe both failing.
- [ ] T018 [US1] Implement: `apps/web/src/pages/privacidade/privacidade-page.tsx` (compose existing
      `shared/ui` — no new DS component), public route in `apps/web/src/app/router.tsx` (no guard), `privacy`
      copy keys in `apps/web/src/shared/i18n/messages.pt-br.ts` (research §5 draft — **owner ratifies the
      final wording in T027 before the URL is shared**), link in
      `apps/web/src/features/auth/sign-in-screen.tsx`. Tests from T017 pass.
- [ ] T019 [P] [US1] Fill `docs/runbooks/uat-deploy.md`: §1 config tables (research §1.1/§1.2 verbatim), §2
      deploy steps (workflow → `uat`, **ref `develop`**, record run URL + `github.sha`), §3 the ordered
      device-executable smoke checklist (data-model §3), §4 rollback per-half (`gcloud run services
      update-traffic --to-revisions <PREV>=100` · `firebase hosting:rollback`) + half-deploy triage
      (research §7).
- [ ] T020 [US1] **OWNER-GATED (veto pending)** Optional `VITE_RELEASE` stamp (research §7, recommended):
      1-line `deploy.yml` addition passing `VITE_RELEASE=${{ github.sha }}` into the SPA build + optional
      typed-env entry (`apps/web/src/shared/lib/env.ts`) + Sentry `release` wiring in
      `apps/web/src/shared/observability/sentry.ts`. If the owner vetoes: record the veto in
      `dod-evidence.md` and skip.

---

## Phase 6: User Story 4 — ground-state reconcile (P4)

**Goal**: recorded state matches reality; the orphan branch dies with its supersession evidence.
**Independent Test**: quickstart §5.

- [ ] T021 [US4] Rewrite CLAUDE.md "Current ground" (research §6): 004+005 shipped to `develop` (PRs #6/#7,
      homologated); ADR-0008..0011 Accepted; A20/A22/A23/D2 done; current increment = 006 (T022 UAT deploy +
      FR-209 release cut + A21 + D4 + privacy + reconcile). Remove every stale "pending" phrasing contradicted
      by the repo.
- [ ] T022 [US4] **OWNER-GATED** Prune `fix/deploy-env-wiring`: supersession ALREADY verified 2026-07-08
      (`deploy.yml` + `docs/environments.md` byte-identical vs `develop` — recorded in research/plan). On
      owner authorization run `git push origin --delete fix/deploy-env-wiring` and add the evidence line to
      `specs/006-uat-deploy-hardening/dod-evidence.md`.

---

## Phase 7: User Story 1 (execution half) — the ship chain (STRICTLY ORDERED)

**Goal**: hardened `develop` → release cut → first real deploy → verified live. Every step below that pushes,
merges, or deploys is **OWNER-GATED** (ADR-0006).

- [ ] T023 [US1] Full local verification then PR: `pnpm gate:all` + `pnpm e2e` green → push
      `feature/006-uat-deploy-hardening` → open PR to `develop` (evidence-rich body) → CI 8-checks green →
      **OWNER-GATED** squash-merge.
- [ ] T024 [US1] **OWNER-GATED** First release merge `develop`→`main` (FR-209): merge (no squash — a release
      snapshot), confirm `deploy.yml` now renders the "Run workflow" control and `auto-pr.yml` activates;
      append the release-cut decision-log line to `docs/decisions/audit-findings-r2.md` §5 (owner, date,
      purpose = trigger availability, accepted release-before-verified-deploy).
- [ ] T025 [US1] **OWNER-GATED** Trigger `Deploy` → environment `uat`, **ref `develop`** (requires T006 done);
      record run URL + `github.sha` in the runbook. If the run fails, triage per runbook §4 — a failed run is
      a failed deploy, no partial success.
- [ ] T026 [US1] FR-207 negative check: dispatch `Deploy` against the still-inert `prod` environment → the
      guard step MUST fail loudly at "environment must be enabled"; capture the run link as evidence.
- [ ] T027 [US1] **OWNER-GATED** Privacy copy ratification (FR-214 gate) THEN smoke checklist from a fresh
      phone (runbook §3, all items binary pass/fail): shell loads → calculator computes → **served** fee seal
      → Google sign-in → `/me` identity → airplane-mode compute (SC-203) → cold vs warm load recorded. ALL
      pass ⇒ deploy verified (SC-201/202); any fail ⇒ FAILED deploy, triage + redo.
- [ ] T028 [US1] Rollback rehearsal (FR-206/SC-204): roll back the Cloud Run revision AND the Hosting release
      per runbook §4, verify the previous version serves, re-deploy, time both directions (<10 min target).
- [ ] T029 [US1] Write `specs/006-uat-deploy-hardening/dod-evidence.md` (gates, SC-201..207 map, smoke +
      rollback record, deliberate-failure outputs, veto/ratification decisions) and mark **A21/D4/T022 done**
      in `docs/decisions/audit-findings-r2.md` (+ retire the MEMORY `local-gate-vs-ci-gap` note — parity now
      structural).

---

## Dependencies

- **Phase 2 (T002–T006)** ∥ parallel with Phases 3–6; feeds ONLY T025+ (the trigger). Internal: T004 after
  T003; T006 after T002–T005.
- **Phases 3 → 4**: loose coupling — T016 confirms conformance runs inside the Phase-3 wiring; otherwise
  US2/US3 files are disjoint. Phase 5/6 independent of 3/4 (different files) — parallelizable.
- **Phase 7 is strictly ordered**: T023 → T024 → T025 → (T026 ∥ T027) → T028 → T029. T025 additionally
  requires T006.
- Test-first inside stories: T011 before T012/T013; T017 before T018; T010 after T007–T009 (verification).

## Parallel opportunities

- The whole **owner provisioning track** (T002–T006) alongside ALL code work.
- T007 ∥ T011 ∥ T017 ∥ T019 ∥ T021 (five different surfaces: package.json / backend tests / web tests /
  runbook / CLAUDE.md).
- T026 ∥ T027 after the first deploy.

## Implementation Strategy — honest MVP note

The P1 outcome (public, smoke-verified UAT URL) is **NOT reachable as a standalone first slice**: it sits
behind the hardening PR (Phases 3–6), the owner-gated provisioning (Phase 2) and the release cut (T024) — by
design (research §2: the snapshot on `main` must be the hardened state, and the trigger only exists after the
cut). The honest increments are: **(1)** Phases 3–6 as one hardening PR to `develop` (independently valuable:
gate parity + honest contract + privacy page + true docs), **(2)** the owner chain T024–T028 (the deploy
itself), **(3)** T029 evidence. Provisioning (Phase 2) proceeds in parallel with (1) at the owner's pace.
