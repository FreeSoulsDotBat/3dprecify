# Implementation Plan: R2 infra close-out — first public UAT deploy + contract hardening + gate parity

**Branch**: `feature/006-uat-deploy-hardening` | **Date**: 2026-07-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-uat-deploy-hardening/spec.md` + Phase-0 research
([research.md](./research.md), arquiteto 2026-07-08)

## Summary

Take the merged, homologated E1 (004+005 on `develop`) to a **public UAT URL** for the first time (T022 /
FR-010-MUST), and land the two remaining R2 honesty gaps on the way: a **truthful protected-endpoint error
contract with automated conformance** (A21) and a **single `gate:all` command shared verbatim by pre-push and
CI** (D4). Plus the owner-decided **minimal privacy notice** (`/privacidade`) and the **ground-state
reconcile**. Approach (research-ratified): reuse the existing `deploy.yml` pipeline untouched\* — the work is
GCP/Firebase provisioning (owner-gated P1–P11), GitHub `uat` Environment config (5 vars + 5 secrets), the
**release merge `develop`→`main`** (FR-209 — makes the `workflow_dispatch` trigger visible; deploy still
builds from `develop`), a device-executable smoke checklist + rollback rehearsal captured in
`docs/runbooks/uat-deploy.md`, and three code surfaces: `app/errors.py` responses + `app.openapi()` 422-strip
+ Schemathesis-as-pytest (ASGI), `gate:fe/be/all` scripts + lefthook/CI rewiring, and the `/privacidade` page.
\*One optional 1-line pipeline change (`VITE_RELEASE` stamp) is recommended-in-scope, owner veto pending.

## Technical Context

**Language/Version**: TypeScript (Node 24, pnpm workspaces) + Python 3.12 (uv) — existing stack, ADR-0004

**Primary Dependencies**: FastAPI + Schemathesis 4.21.10 (already in `backend/uv.lock`, currently inert) ·
GitHub Actions (`deploy.yml` reused as-is, `ci.yml` gains one `gate:all` job) · gcloud/WIF keyless (ADR-0005)
· Firebase Hosting + Auth (`precifica3d-uat`) · lefthook · TanStack Router (public `/privacidade` route) —
**no new runtime dependency**

**Storage**: N/A (no data-model change; deploy state lives in GitHub Environments + GCP, never in the repo)

**Testing**: pytest (+ Schemathesis ASGI conformance, deterministic Hypothesis CI profile) · vitest (privacy
page component test) · Playwright (privacy-page/sign-in-link e2e) · the UAT smoke checklist is a **manual,
documented** verification (automating it = explicit non-goal)

**Target Platform**: Cloud Run + Firebase Hosting, `southamerica-east1` (ADR-0005/A10); CI = GitHub Actions
(ubuntu, Node 24 + uv, same dual setup the `contract-drift` job already uses)

**Project Type**: web monorepo (existing 002 structure) + CI/CD + cloud provisioning

**Performance Goals**: SC-201 first-tap→price < 60 s on a fresh phone · SC-204 repeat deploy < 30 min,
rollback < 10 min · cold-vs-warm first load recorded honestly (no target, measured)

**Constraints**: no secrets in repo (FR-208, existing scans) · keyless WIF for GCP (one residual
`FIREBASE_SERVICE_ACCOUNT` JSON accepted for UAT, noted for rotation) · backend never computes prices
(FR-203) · free/offline/signed-out guarantees hold in production · deploy targets inert-by-default (FR-207)
· ADR-0006 governance intact (owner authorizes the release merge + every push)

**Scale/Scope**: 1 environment (uat) · 3 API operations under conformance (`/health`, `/me`,
`/fee-catalog`) · ~6 repo surfaces touched (backend errors/tests, root scripts, lefthook, ci.yml, web page +
router + sign-in link + i18n, runbook + CLAUDE.md) · 11 owner-gated provisioning items (P1–P11)

## Constitution Check

- [x] **I. Scalability & Quality First** — provisioning is least-privilege (deploy-SA role set §1.2, verify
      names at grant time), WIF scoped to this repo; `gate:all` composable (`gate:fe`/`gate:be`) so future
      packages join the same target. No convenience shortcut (e.g. repo-level secrets) — rejected in research.
- [x] **II. Truth Over Approval** — every library/API mechanic verified against current sources (research
      §Sources); phantom 422 removed *and* no phantom 403 added; conformance suite fails on undocumented
      reality; a deploy whose smoke fails is a FAILED deploy; cold-start measured, not hidden; the
      release-before-verified-deploy circularity is recorded, not smoothed over. Residual risks carry
      confidence % (IAM role names ~80% — re-verify at grant).
- [x] **III. Test-First** — A21: the conformance pytest is written first and MUST fail against the current
      contract (undocumented 401 on `/me`) before the fix makes it pass; privacy page gets a failing
      component test + e2e first; `gate:all` is verified by deliberate-failure (backend lint break + frontend
      coverage drop caught locally, SC-206). No pricing formula is touched.
- [x] **IV. Server-Side Entitlements** — no entitlement surface in scope; nothing gated client-side.
- [x] **V. Clean Architecture Integrity** — `deploy.yml`, transport wrapper, env docs, Sentry reused as-is
      (verified present); the orphan branch is pruned (dead branch removal) only after proven supersession
      (already verified in-session: `deploy.yml` + `environments.md` byte-identical on `develop`); lefthook's
      thin pre-push subset is REPLACED (not duplicated) by `gate:all`; `use-identity` migrates to the
      generated client once the phantom types drop (retires TD-019).
- [x] **VI. Lean Living Documentation** — CLAUDE.md ground reconcile is in scope (FR-213); runbook lives in
      `docs/runbooks/` (operational, not spec); release cut recorded as a decision-log LINE, not a duplicate
      ADR (ADR-0006 already rules `main`=release).
- [x] **VII. Spec-Driven Flow** — clarifications resolved with the owner (2026-07-08) before planning;
      checklist passed; analyze gate available before tasks; spec remains source of truth.
- [x] **VIII. Architecture Decided Before Implementation** — every structural choice traces: deploy topology
      → ADR-0005/A10; branch/release governance → ADR-0006 + owner clarification (FR-209); gate parity →
      R2-G3 D4 decision + research Option (a); error-contract mechanics → A21 decision + research Option C;
      Schemathesis-as-pytest-ASGI → research §4.2; privacy placement → owner Option A + FSD-Lite page
      convention (content-level). Remaining owner items are OPERATIONAL/legal (provisioning, copy
      ratification, `VITE_RELEASE` veto, orphan deletion authorization) — listed, not defaulted.

**Post-design re-check (Phase 1)**: no new violations — data-model is configuration/process entities only;
the contract artifact documents the *corrected* published error surface; quickstart adds no scope.

## Project Structure

### Documentation (this feature)

```text
specs/006-uat-deploy-hardening/
├── spec.md              # Feature spec (owner clarifications 2026-07-08 folded in)
├── plan.md              # This file
├── research.md          # Phase 0 (arquiteto) — provisioning inventory, options, sources
├── data-model.md        # Phase 1 — config/process entities (environment, deploy run, checklist…)
├── contracts/
│   └── error-contract.md  # Phase 1 — corrected published error surface for /me + /fee-catalog
├── quickstart.md        # Phase 1 — validation guide (gate:all, conformance, privacy page, smoke)
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── errors.py                    # + AUTH_ERRORS/INTERNAL_ERRORS responses= constants (A21)
│   ├── main.py                      # + app.openapi() override stripping the phantom auto-422
│   └── api/me.py                    # responses=AUTH_ERRORS (200+401 only — no phantom 403/422)
└── tests/
    └── test_conformance.py          # NEW — Schemathesis-as-pytest over ASGI (all operations)

contracts/openapi.json               # regenerated (drift-guard) — phantom HTTPValidationError gone
apps/web/src/shared/api/generated.ts # regenerated Orval client (same drift-guard commit)
apps/web/src/entities/user/…         # use-identity → generated client (retires TD-019)

apps/web/src/
├── pages/privacidade/
│   ├── privacidade-page.tsx         # NEW — public minimal privacy notice (FR-214)
│   └── privacidade.test.tsx         # NEW — component test (test-first)
├── app/router.tsx                   # + public /privacidade route (no guard)
├── features/auth/sign-in-screen.tsx # + link "Como tratamos seus dados"
└── shared/i18n/messages.pt-br.ts    # + privacy copy (owner ratifies wording)
apps/web/tests/e2e/…                 # + privacy-page reachability e2e

package.json                         # gate:fe / gate:be / gate:all scripts (D4)
lefthook.yml                         # pre-push → pnpm gate:all (replaces thin subset)
.github/workflows/ci.yml             # ONE gate:all job (replaces separate FE/BE gate jobs);
                                     #   e2e/docker/contract-drift/secret-scan stay parallel
.github/workflows/deploy.yml         # untouched (*optional 1-line VITE_RELEASE stamp, owner veto)

docs/runbooks/uat-deploy.md          # NEW — config tables, deploy steps, smoke checklist, rollback
docs/decisions/audit-findings-r2.md  # + release-cut decision-log line; A21/D4/T022 marked done
CLAUDE.md                            # ground-state reconcile (FR-213)
```

**Structure Decision**: existing 002 monorepo layout, untouched. New surfaces follow their established homes:
FSD-Lite page for `/privacidade`, backend `app/errors.py` for shared response constants, `docs/runbooks/`
(new dir) for operational docs. No new package, no new deployable.

## Phase 0 — Research (complete)

[research.md](./research.md) resolves every unknown (no NEEDS CLARIFICATION was open — both spec
clarifications were owner-resolved pre-plan). Key ratified decisions: provisioning inventory §1.1–1.3 ·
sequencing hardening→release-merge→trigger §2 · D4 Option (a) literal single target §3 · A21 Option C hybrid
+ Schemathesis-as-pytest-ASGI §4 · `/privacidade` placement + draft copy §5 · reconcile + prune-after-proof
§6 · risks §7. **Research's must-verify-at-implement items already verified in-session (2026-07-08, git):**
PRs #6/#7 merged (`develop` = `2614490`); `main` head = `ad58ddc` (pre-foundation docs — the release merge is
`main`'s FIRST content merge); orphan `fix/deploy-env-wiring` fully superseded (`deploy.yml` +
`docs/environments.md` byte-identical vs `develop`). Still to verify at implement: exact minimal GCP IAM role
names against live docs at grant time (~80% confidence, research §1.2).

## Phase 1 — Design artifacts

- [data-model.md](./data-model.md) — the configuration/process entities (UAT environment, deploy run, smoke
  checklist, error contract, gate target, runbook) with fields and validation rules.
- [contracts/error-contract.md](./contracts/error-contract.md) — the corrected published error surface
  (per-operation status × schema), the phantom-removal rule, and the conformance obligation.
- [quickstart.md](./quickstart.md) — runnable validation: gate:all parity (incl. deliberate-failure check),
  conformance suite, privacy page tests, deploy smoke + rollback rehearsal pointers.
- Agent context — updated via the after_plan hook (CLAUDE.md SPECKIT block → this plan).

## Owner-gated items (from research, consolidated — will become explicit task-phase gates)

P1–P11 GCP/Firebase provisioning (console/billing/gcloud) · GitHub `uat` Environment 5 vars + 5(+3) secrets ·
release merge `develop`→`main` authorization · `Deploy(uat)` trigger + smoke + rollback rehearsal · privacy
copy ratification (before sharing the URL) · orphan-branch deletion authorization · **pending veto:** the
recommended 1-line `VITE_RELEASE` stamp in `deploy.yml` (research §7 — symmetric web release correlation).

## Complexity Tracking

No constitution violations to justify — table intentionally empty.
