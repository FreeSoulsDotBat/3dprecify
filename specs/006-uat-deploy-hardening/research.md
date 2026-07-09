# Phase 0 — Research: 006 UAT deploy + contract hardening + gate parity

This feature **implements decisions already taken** (A21, A22-consumed, D4, T022 mechanics — `docs/decisions/
audit-findings-r2.md` §R2-G2/G3, 2026-07-02) and **two owner clarifications** (2026-07-08: FR-214 privacy =
minimal notice; FR-209 = first release merge `develop`→`main`). None of those are reopened here. Where a real
implementation choice remains (Principle VIII), this doc surfaces options with a recommendation and marks what
still needs owner sign-off. Library/API mechanics are **verified against current sources**, not inferred
(Principle II); the two facts that need a running `git`/`gcloud` (orphan-branch supersession, `main` head,
PR #6/#7 merge state) are flagged as **must-verify-at-implement** because this environment has no VCS/cloud
access.

Repo facts verified in-place (2026-07-08): `deploy.yml` (manual `workflow_dispatch`, `DEPLOY_ENABLED` guard,
injects the full `P3D_*` runtime contract + captures `VITE_API_BASE_URL` from the Cloud Run output);
`firebase.json` + `.firebaserc` (hosting `public: apps/web/dist`, SPA rewrite; projects uat=`precifica3d-uat`,
prod=`precifica3d-prod`); `backend/Dockerfile` (Cloud Run image, keyless ADC); `ci.yml` (parallel jobs
frontend/backend/contract-drift/e2e/docker/secret-scan + `ci-pass` roll-up); `lefthook.yml` (pre-push runs only
`typecheck` + `pnpm -r test` — **less than even the frontend `gate`**); root `package.json` `gate` =
`format:check && lint && depcruise && typecheck && test:coverage` (frontend only, no backend, no build);
`schemathesis 4.21.10` present in `backend/uv.lock` but invoked nowhere; the published `contracts/openapi.json`
carries phantom `HTTPValidationError`/`ValidationError` on `/me` + `/fee-catalog` and **omits the real 401** on
`/me`.

---

## 1. T022 provisioning — first public UAT deploy (FR-201..208)

### 1.1 — What the pipeline already expects (var/secret inventory, one-by-one)

`deploy.yml` is complete and reused as-is. Everything below is **configuration the owner supplies in the
GitHub `uat` Environment + the GCP/Firebase projects** — nothing in the workflow needs rebuilding.

| Ref in `deploy.yml` | Kind | Meaning | Provisioned by |
|---|---|---|---|
| `vars.DEPLOY_ENABLED` | Env **var** | Must equal `true` or the guard step exits 1 (FR-207) | Owner (GitHub Env `uat`) |
| `vars.GCP_PROJECT` | Env **var** | GCP project id (billing owner) | Owner (console) |
| `vars.GCP_REGION` | Env **var** | `southamerica-east1` (ADR-0005/A10) | Owner |
| `vars.FIREBASE_PROJECT` | Env **var** | Firebase project id = `precifica3d-uat`; also drives web `VITE_FIREBASE_*`, the CORS default (`{project}.web.app/.firebaseapp.com`) and the Hosting target | Owner |
| `vars.SPA_ORIGINS` | Env **var** (optional) | JSON array override for backend CORS when the served origin ≠ the derived `*.web.app` default | Owner (only if needed) |
| `secrets.WIF_PROVIDER` | Env **secret** | Full resource name of the Workload Identity **provider** | Owner/guided `gcloud` (§1.2) |
| `secrets.WIF_SERVICE_ACCOUNT` | Env **secret** | Deploy service-account e-mail impersonated by WIF | Owner/guided `gcloud` |
| `secrets.FIREBASE_SERVICE_ACCOUNT` | Env **secret** | **JSON key** for `action-hosting-deploy` (the one long-lived credential — see §7 risk) | Owner (Firebase console) |
| `secrets.FIREBASE_WEB_API_KEY` | Env **secret** | Web app config → Vite build | Owner (Firebase web app) |
| `secrets.FIREBASE_WEB_APP_ID` | Env **secret** | Web app config → Vite build | Owner (Firebase web app) |
| `secrets.SENTRY_DSN` | Env **secret** (optional) | Backend Sentry DSN → `P3D_SENTRY_DSN` | Owner (optional) |
| `secrets.SENTRY_DSN_WEB` | Env **secret** (optional) | Web Sentry DSN → `VITE_SENTRY_DSN` | Owner (optional) |
| `github.sha` → `RELEASE_SHA`/`P3D_RELEASE` | Auto | Deployed-commit stamp (FR-205) — the SHA of the ref the workflow runs on | none |
| `secrets.GITHUB_TOKEN` | Auto | `repoToken` for the hosting action | none |
| `steps.backend.outputs.url` → `VITE_API_BASE_URL` | Auto | Cloud Run URL captured at deploy and inlined into the SPA build | none |

**Decision (inventory):** the pipeline needs **5 vars + 5 required secrets (+3 optional)** in the GitHub `uat`
Environment, backed by GCP/Firebase resources that do not yet exist. The workflow itself is untouched.
**Rationale:** matches `docs/environments.md` §"Config per tier" verbatim; keeps secrets out of the repo
(FR-208) since they live only in the GitHub Environment. **Alternatives considered:** repo-level secrets
(rejected — no per-tier isolation, defeats A22/ADR-0005); `.env` in the image (rejected — secret in repo,
FR-208 violation).

### 1.2 — GCP/Firebase resources still missing (the actual provisioning gap)

| # | Resource | Why the pipeline needs it | Owner-gated? |
|---|---|---|---|
| P1 | GCP project + **billing** enabled | Cloud Run/Build/AR all require an active billing account | **YES — console/billing** |
| P2 | Enable APIs: Cloud Run, Cloud Build, Artifact Registry, IAM Credentials (STS), Firebase, Firebase Hosting | `gcloud run deploy --source` drives Cloud Build → AR; WIF uses IAM Credentials | Owner/guided |
| P3 | **Artifact Registry** repo (`cloud-run-source-deploy`, region `southamerica-east1`) | `--source` deploy builds+pushes the image here (auto-created on first deploy **iff** the actor has AR-admin) | Owner/guided |
| P4 | **Deploy service account** (impersonated via WIF) | The identity `gcloud run deploy` acts as | Owner/guided |
| P5 | **WIF pool + OIDC provider** (issuer `https://token.actions.githubusercontent.com`) with an **attribute condition pinning `repository == <owner>/3dprecify`** | Keyless CI→GCP trust (ADR-0005), scoped to this repo only | **YES — `gcloud` w/ project owner** |
| P6 | IAM binding: principalSet(WIF pool) → deploy SA `roles/iam.workloadIdentityUser` | Lets the GitHub run impersonate the SA | Owner/guided |
| P7 | Cloud Run **runtime service account** (or the default compute SA) with project id passed for Admin-SDK init | `/me` token verification (`init_firebase`); no special role beyond default for ID-token verify | Owner/guided |
| P8 | Firebase project **linked to the same GCP project** + a **Hosting site** (default site = project id, matches `firebase.json`) | `action-hosting-deploy` target | **YES — Firebase console** |
| P9 | Firebase **Web App** (yields `FIREBASE_WEB_API_KEY` + `FIREBASE_WEB_APP_ID`) | Vite build config | Owner |
| P10 | Firebase **Auth → Google provider enabled**; Hosting domain added to **authorized domains** | Real Google sign-in (US1 scenario 3) | **YES — console** |
| P11 | Firebase **service-account JSON** for the hosting action | `secrets.FIREBASE_SERVICE_ACCOUNT` | Owner |

**Decision (deploy-SA role set — least privilege, verify at provision time):** grant the **deploy SA**
`roles/run.admin` (deploy the service), `roles/iam.serviceAccountUser` on the runtime SA (act-as during
deploy), plus a build path — either the modern `roles/run.builder` **or** the classic
`roles/cloudbuild.builds.editor` + `roles/artifactregistry.writer` + `roles/storage.admin` (the `_cloudbuild`
staging bucket). **Rationale/verification:** Google's current "Deploy services from source" + Cloud Build IAM
docs confirm source deploys need Cloud-Run-admin + act-as + AR-write + a build role; the newer path collapses
the build grants into `roles/run.builder` on the build/compute SA. Confidence ~80% on the exact minimal set —
**the plan MUST confirm against the live GCP IAM docs before granting** (Principle II). **Alternatives
considered:** `roles/owner` on the SA (rejected — over-privileged, violates least-privilege / Principle I);
per-resource custom role (deferred — premature for one UAT service; revisit if the surface grows).

### 1.3 — Provisioning order (recommended)

`P1 billing → P2 APIs → P8/P9/P10 Firebase (project link + web app + Google provider) → P4/P7 service accounts
→ P5/P6 WIF pool+provider+binding → P3 Artifact Registry → GitHub Env vars+secrets (§1.1) → [006 hardening
merged to develop] → release merge develop→main (§2) → trigger Deploy(uat) from develop → smoke (§1.4) →
rollback rehearsal (FR-206) → prune orphan branch (§6)`. Firebase before the web app because the web
config/keys come from it; WIF after the SA exists (the binding targets it); AR before the first deploy (or let
the first deploy auto-create it if the SA has AR-admin). GitHub Env config and GCP provisioning are independent
of branch state and can run in parallel with the code hardening; only the **trigger** depends on the release
merge.

### 1.4 — Smoke checklist + runbook structure

**Decision:** author one runbook at **`docs/runbooks/uat-deploy.md`** (new dir) with four sections —
(1) *Config & prerequisites* (the §1.1/§1.2 tables), (2) *Deploy* (run `Deploy` workflow → `uat`, **select the
`develop` ref**, record the run URL + `github.sha`), (3) *Smoke checklist* (device-executable, no tooling),
(4) *Rollback + half-deploy triage* (§7). Record the completed run as DoD evidence in
`specs/006-uat-deploy-hardening/dod-evidence.md` (SC-202). **Smoke steps (ordered, from a fresh phone):** app
shell loads → calculator computes the full multi-channel model + itemized sub-costs offline-capable → fee
reference shows the **served** honesty seal (`reference`, not `embedded`) → Google sign-in succeeds → account
page shows the **`/me` server-confirmed** identity → toggle airplane mode → calculator still computes
(byte-identical inputs → identical price, SC-203) → record **cold** vs **warm** first-load time (edge case).
**Rationale:** `docs/runbooks/` keeps operational docs out of `specs/` (lean living docs, Principle VI); a
single file is easier to keep true than a split. **Alternatives considered:** put the checklist inside the spec
(rejected — spec is the *what*, not the *runbook*); a separate `uat-smoke-checklist.md` (rejected as premature
split; fold in, extract later if it grows). Confidence 85%.

---

## 2. FR-209 — release merge `develop`→`main` sequencing

**Decision:** the release merge is a **prerequisite of the deploy *trigger*, not of the deployed *code*.**
Sequence it **after** 006's hardening (A21/D4/privacy/reconcile) lands on `develop` and **before** the first
`Deploy(uat)` run. It brings `deploy.yml` onto the repo's **default branch (`main`)**, which is what makes
GitHub render the `workflow_dispatch` "Run workflow" control at all — the trigger is currently invisible
precisely because the workflow is absent from `main`. The deploy then **builds from the `develop` ref**
(UAT source per ADR-0006 / `docs/environments.md`), so `main`'s content is a **state snapshot**, not the
deployed artifact.

**Rationale:** GitHub only surfaces a `workflow_dispatch` trigger for workflows present on the default branch;
once visible, the run can target any ref (the workflow `checkout`s and deploys the selected ref). This exactly
matches the owner's clarification ("release cut makes the trigger available as a consequence; not a production
deploy"). Landing 006's hardening on `develop` first means the snapshot on `main` is the *hardened* E1 state,
not a half-hardened one. Side effect (positive): the same default-branch requirement **activates
`auto-pr.yml`** (`workflow_run`), per ADR-0006's own activation note.

**Decision-log, not a new ADR:** record the first release cut as a **decision-log line** (append to
`docs/decisions/audit-findings-r2.md` §5 capture log, or the feature's dod-evidence) noting: owner-authorized,
date, purpose (trigger availability), and the explicit acceptance that a release is cut before a verified
deploy exists. **No new ADR** — ADR-0006 already establishes `main` = release and owner-authorized merges; a
new ADR would duplicate a decided rule (Principle VI). Confidence 90%.

**Must-verify-at-implement:** confirm `main`'s current head (whether it holds 002 only or is empty) so the plan
knows exactly what the merge brings, and confirm PR #6/#7 (004/005) are actually merged to `develop` first
(the spec asserts they are; I could not run `git` here).

**Alternatives considered:** workflows-only PR to `main` (owner explicitly rejected in the Clarifications —
chose the full release cut); cherry-pick `deploy.yml` onto `main` (rejected — bypasses ADR-0006 governance,
FR-209 forbids governance bypass); change the repo default branch to `develop` (rejected — contradicts
ADR-0006 `main`=release and would reroute every default-branch behavior).

---

## 3. D4 — single `gate:all`, local↔CI parity (FR-212)

Concrete gap: `lefthook` pre-push runs only `typecheck` + `pnpm -r test`; the root `gate` is frontend-only; CI
runs frontend + backend gates in **separate parallel jobs**. FR-212/SC-206 want **one command** invoked by
**both** pre-push and CI, **"identical target (inspectable, not asserted)."**

**Decision — Option (a), literal single target, recommended (confidence 78%).** Add composable scripts:
`gate:fe` = current `gate` (format/lint/depcruise/typecheck/`test:coverage`); `gate:be` =
`ruff check . && ruff format --check . && basedpyright && pytest -q && lint-imports` (run under `uv` in
`backend/`); `gate:all` = `gate:fe && gate:be`. Point **lefthook pre-push** at `pnpm gate:all` (replacing the
current thin subset) and add a **single CI job** that runs the *same* `pnpm gate:all` (runner set up with both
pnpm/Node 24 and uv/Python 3.12, as `contract-drift` already does). Keep **`e2e`, `docker`, `contract-drift`,
`secret-scan` as their own parallel jobs** — they are **out of FR-212's gate list** and cannot run in a
pre-push hook anyway (browsers+emulator, Docker daemon, full git history).

**Rationale:** SC-206 demands *inspectable, literal* identity — one job, one command, verifiable by reading
`lefthook.yml` + `ci.yml`, no assertion test. R2-G3's own text ("Single target … invoked by BOTH lefthook
pre-push and CI") already names this path. The parallelism "loss" is small and mostly hidden: only `gate:fe`
and `gate:be` serialize; the long pole (`e2e`) still runs in parallel, so the **critical path barely moves**
(max(gate:all, e2e, docker, drift, secret-scan) — e2e usually dominates). This also **closes the MEMORY-noted
gap** by moving `test:coverage` (100% pricing-core) into pre-push. Accepted slower local push is the
R2-G3-decided cost.

**Alternatives considered:**
- **(b) Composed sub-targets, parallel CI jobs** — `gate:all` composes `gate:fe`/`gate:be`; CI keeps two
  parallel jobs each calling one sub-target. *Pro:* preserves FE‖BE parallelism. *Con:* parity is
  "by construction of the targets," **not literal invocation** — weakens SC-206's "identical target,
  inspectable" and needs the reader to trust that `gate:all` = union of the two jobs. Confidence it satisfies
  SC-206 literally: ~45%.
- **(c) Hybrid** — Option (b) plus a tiny CI check asserting `gate:all` equals the union of the sub-targets.
  *Con:* SC-206 explicitly says **"not asserted"** — an assertion is the thing it rules out. Rejected.

**Owner note (not a reopen):** (a) is the decided R2-G3 path; choosing (b) to keep CI parallelism would be a
**deviation from D4 that needs owner sign-off** (and an ADR/decision-log per Principle VIII). Recommend (a).
Plan detail: decide whether `pnpm --filter web build` and the Docker build stay separate (they are not in the
FR-212 gate list; keep them as their own jobs).

---

## 4. A21 — honest protected-endpoint error contract + conformance (FR-210/211)

### 4.1 — Error-contract declaration

Current truth: `/me` publishes `200 + 422(HTTPValidationError)` but the **422 is a phantom** (the only param is
an *optional* header — it can never fail validation) and the **real 401** (`UNAUTHENTICATED`/`TOKEN_EXPIRED`
from `current_claims`) is **undocumented**. `/fee-catalog` likewise carries a phantom 422. FastAPI's runtime
already returns the camelCase `ErrorEnvelope` for all of these via `register_exception_handlers`.

**Decision — Option C (hybrid): per-route composable `responses=` constants for the *reachable* statuses,
plus a minimal `app.openapi()` post-step that strips the auto-injected default 422 (`HTTPValidationError`).**
Concretely: define small shared constants in `app/errors.py` (e.g. `AUTH_ERRORS = {401: {"model":
ErrorEnvelope}}`, `VALIDATION_ERRORS = {422: {"model": ErrorEnvelope}}`, `INTERNAL_ERRORS = {500: {"model":
ErrorEnvelope}}`) and apply **only what each route truly returns**: `/me` → `AUTH_ERRORS` (200 + 401), no 403
(no authz logic exists yet → declaring 403 would itself be a phantom, Principle II), no 422; `/fee-catalog` →
optionally `INTERNAL_ERRORS`. Then override `app.openapi()` to delete any `422` whose schema `$ref` ends in
`HTTPValidationError`, so the unreferenced `HTTPValidationError`/`ValidationError` components drop out.

**Rationale:** per-route `responses=` alone **cannot remove** FastAPI's auto-422 (it only *replaces* the
schema — and re-declaring a 422 that `/me` can never return is a fresh phantom); the `openapi()` override is
the documented way to remove it (FastAPI disc. #6695 / issue #3424 Method 1). Keeping the *positive*
declarations per-route keeps them next to the code, type-checked, and honest (only reachable statuses). The
**contract drift-guard** (`git diff` on `contracts/openapi.json` + `apps/web/src/shared/api`) then proves the
phantom is gone from the regenerated Orval client (FR-210, SC-205), and **`use-identity` can move to the
generated client** (retires TD-019). **Verification:** FastAPI's per-op default-422 behavior and the
`app.openapi()`-strip recipe verified against current FastAPI docs/discussions; confidence ~80% — the
drift-guard confirms empirically at implement time.

**Alternatives considered:**
- **A — per-route `responses=` only.** *Con:* leaves the auto-422/`HTTPValidationError` phantom in place →
  fails FR-210 "no phantom schemas."
- **B — pure `app.openapi()` override for everything (inject 401 + strip 422).** *Con:* detaches the error
  contract from the route definitions, more magic, must hard-code "which routes are protected," brittle to
  FastAPI internals. Retain the *strip* half only (that is Option C).

### 4.2 — Response conformance (Schemathesis)

**Decision — Option A: run Schemathesis as a **pytest** test over the **ASGI transport** (no live server),
inside the existing `uv run pytest` (thus inside `gate:be` / `gate:all` and the CI backend gate).** Load the
app's own schema and validate every operation:
```python
schema = schemathesis.openapi.from_asgi("/openapi.json", create_app(Settings(app_env="dev")))

@schema.parametrize()
def test_api_conformance(case):
    case.call_and_validate()
```
Scope = **all operations** in the published OpenAPI (`/health`, `/me`, `/fee-catalog`). `call_and_validate()`
fails on any **undocumented status code** or **response-shape mismatch**, which is exactly FR-210+FR-211
(e.g. it fails today because `/me` returns an undocumented 401) and it **retires the hand-written substitute
note** on `test_fee_catalog.py`.

**Rationale/verification:** the v4 API `schemathesis.openapi.from_asgi(...)` + `@schema.parametrize()` +
`case.call_and_validate()` is confirmed against the current Schemathesis 4.x docs (installed 4.21.10). ASGI
transport = no server lifecycle, faster, deterministic, and it rides the gate the team already runs.
**Flakiness controls (plan detail):** register a Hypothesis **CI profile** (`deadline=None`, fixed
`max_examples`, `derandomize=True`) so runs are bounded and reproducible; provide a **deterministic token-verify
stub** (reuse the `test_me.py` monkeypatch pattern) so a fuzzed `Authorization` header can't reach live
Firebase and yields a stable 401. **Alternatives considered:** separate CI step running the Schemathesis **CLI
against a live server** (rejected — server lifecycle + port flakiness, and it would *not* run under
pre-push/`gate:all`, reintroducing a local↔CI gap that D4 is closing); leave it CLI-only in CI (same drawback).
Confidence 85%.

---

## 5. FR-214 — minimal privacy notice (owner-decided Option A)

**Decision (FSD-Lite placement):** new **page** `apps/web/src/pages/privacidade/privacidade-page.tsx`
(+ colocated test), a **public route** `/privacidade` added to `app/router.tsx` `routeTree` (no `beforeLoad`
guard — reachable signed-out, like `/calcular`), copy in **`shared/i18n/messages.pt-br.ts`** under a `privacy`
key, and a **link from the sign-in screen** — add a footer line/`Link` in
`features/auth/sign-in-screen.tsx` below the `Card` (e.g. "Como tratamos seus dados"). Compose existing
`shared/ui` primitives (`Card`, typography) — **no new DS component, no consent library.**

**Copy (pt-BR, minimal + honest — draft; owner ratifies the legal wording):** "Para entrar, usamos o **Login
com Google**, que nos informa seu **e-mail** — usado apenas para **identificar sua conta**. Registramos
**erros técnicos** (Sentry) para corrigir falhas. **Não vendemos seus dados** nem fazemos rastreamento para
publicidade. A **calculadora funciona sem login** e não coleta nada."

**Rationale:** privacy *placement/structure* is UX/content, which Principle VIII lets an agent decide by
convention; the *policy substance* was decided by the owner (Option A) — so only the exact legal wording needs
owner ratification before the URL is shared (FR-214 gate: "BEFORE the UAT URL is shared beyond the owner").
A static page + one link is the leanest thing that satisfies the notice without pulling a consent-management
dependency (deferred to E2 per the Clarifications). **Alternatives considered:** inline modal/banner on
sign-in (rejected — heavier, and a notice is not consent-gating for Option A); a `shared`-layer content
component (rejected — a page is the right FSD-Lite home for a routed content surface); third-party
consent/CMP library (out of scope by the owner's E2 deferral).

**Owner sign-off needed:** ratify the final legal copy (content), before sharing the URL.

---

## 6. FR-213 — ground-state reconcile + orphan-branch prune

**Decision (CLAUDE.md "Current ground"):** rewrite it to state that **004 + 005 are shipped to `develop`**
(PRs #6/#7, homologated), the E1 scope decisions (A16/A24/A25) and ADR-0008/0009/0010/0011 are **Accepted**,
and the R2 follow-ups **A20/A22/A23/D1/D2 are done**; the **next increment is 006** (first UAT deploy T022 +
FR-209 release cut `develop`→`main` + A21 contract hardening + D4 `gate:all` + privacy notice + this
reconcile). Remove the stale "E1 … next / A16/A24/A25 pending" and "A21/A22/D4/T022" pending phrasing.
**Rationale:** the current summary is contradicted by the repo (E1 is built/merged, A22 done) → Principle VI.

**Decision (orphan branch `fix/deploy-env-wiring` @ `f6eaae4`):** prune **only after** proving supersession.
Run at implement time:
- `git log --oneline develop..f6eaae4` (commits unique to the branch — expect empty/subsumed) and
- `git diff develop...f6eaae4 -- .github/workflows/deploy.yml docs/environments.md backend/app/settings.py`
  (its substantive footprint).

**Reasoning (why supersession is very likely, ~85%):** the branch's evident purpose is D5/A22 deploy-env
wiring — and `develop`'s `deploy.yml` **already injects the full contract** (`P3D_CORS_ORIGINS`,
`P3D_FIREBASE_PROJECT_ID`, `P3D_RELEASE`, optional `P3D_SENTRY_DSN`) and `docs/environments.md` already
documents the per-tier contract (A22 marked done). If the diff shows a unique substantive change, **port it
first**; only delete when the diff is empty or fully present in `develop`. **Never delete blind** (spec US4
scenario 2). Branch deletion is a remote mutation → **owner-authorized**.

**Must-verify-at-implement:** I could not run `git` in this environment — the two commands above are the gate;
also confirm PR #6/#7 are truly merged before rewriting the ground summary. **Alternatives considered:** delete
immediately (rejected — spec forbids blind deletion); keep it indefinitely (rejected — stale orphan violates
lean-docs/Principle VI and confuses future sessions).

---

## 7. Risks & edge cases

- **Half-deploy (API moved, hosting stale — or vice-versa).** `deploy.yml` deploys backend then SPA
  **sequentially in one job**; a failure between them leaves a mixed state. Mitigant: the Cloud Run **service
  URL is stable across revisions**, so stale hosting still points at a valid URL — the real hazard is a **new
  backend contract with an old SPA bundle**. Runbook (§1.4) must triage *which half moved* and roll back
  **each half independently**: Cloud Run via `gcloud run services update-traffic --to-revisions
  <PREV>=100`; Firebase Hosting via `firebase hosting:rollback` (release history) or redeploy of the prior
  SHA. A deploy whose smoke fails is a **FAILED deploy** (Principle II) — no "shipped with caveats."
- **CORS.** `P3D_CORS_ORIGINS` defaults to `https://{FIREBASE_PROJECT}.web.app` / `.firebaseapp.com`. If the
  served origin differs, `/me` + fee-refresh are blocked but the **calculator keeps working** (fully
  client-side) — the smoke checklist explicitly exercises sign-in + fee refresh to catch this; fix by setting
  `SPA_ORIGINS`.
- **Cold start.** Cloud Run scales to zero → first request is slow (image cold + `firebase-admin` init). Only
  `/me` and `/fee-catalog` touch the backend; the calculator and the **bundled seed** cover the cold window
  non-blockingly. Smoke records **cold vs warm** honestly.
- **Release correlation (FR-205).** Backend carries `P3D_RELEASE = github.sha` (Sentry release tag); the
  authoritative "which commit shipped" is the **workflow run's `github.sha`** (of the `develop` ref) — record
  it in the runbook/DoD. **Gap noted (not a blocker):** the SPA build is **not** stamped with the release SHA
  (no `VITE_RELEASE`), so web Sentry events + any in-app version line don't carry it symmetrically. Optional
  hardening: pass `VITE_RELEASE=${{ github.sha }}` to the SPA build. This is a **one-line deploy.yml change**
  that brushes against the spec's "reuse the pipeline as-is" assumption → **flag for owner/plan** rather than
  assume.
- **WIF keyless vs. the Firebase hosting key.** The backend path is keyless (WIF), but
  `action-hosting-deploy@v0` still consumes a **long-lived `FIREBASE_SERVICE_ACCOUNT` JSON** — the only
  standing credential. Acceptable for UAT; note it as the residual secret to rotate/scope, and a candidate
  future migration to WIF/OIDC hosting deploy.
- **e2e stays local-only.** Confirmed: the spec's assumptions keep Playwright e2e on the local preview +
  emulator in CI; UAT is verified by the **manual smoke checklist**; the A21 conformance suite runs against
  the **ASGI transport** (§4.2), not the deployed UAT. **No e2e-against-UAT is required by this feature** —
  automating the smoke run is an explicit non-goal / candidate follow-up.

---

## Owner-gated actions (consolidated)

1. Create/confirm the **GCP project** + enable **billing** (P1). *(console/billing — only the owner)*
2. Enable required **APIs** (P2) and create the **Artifact Registry** repo (P3, or allow first-deploy
   auto-create). *(guided `gcloud` under the owner)*
3. Create the **deploy + runtime service accounts** (P4/P7) and grant the **least-privilege roles** (§1.2,
   verify names against live GCP docs). *(guided `gcloud`)*
4. Create the **WIF pool + provider** pinned to `repository == <owner>/3dprecify` and bind
   `workloadIdentityUser` (P5/P6). *(guided `gcloud`)*
5. Create the **Firebase project** (linked), **Hosting site**, **Web App**, enable **Google Auth** + add the
   Hosting domain to **authorized domains**, and generate the **Firebase SA JSON** (P8–P11). *(console)*
6. Populate the GitHub **`uat` Environment** with the 5 vars + 5 required secrets (+optional) from §1.1;
   set `DEPLOY_ENABLED=true`. *(GitHub settings)*
7. Authorize + perform the **release merge `develop`→`main`** (FR-209) — after 006 hardening is on `develop`.
8. **Trigger** the `Deploy` workflow → `uat`, running from the **`develop`** ref; then execute the smoke
   checklist and the **rollback rehearsal** (FR-206).
9. **Ratify the pt-BR privacy copy** (§5) before sharing the UAT URL.
10. **Authorize deletion** of `fix/deploy-env-wiring` after its supersession diff is verified empty (§6).
11. Decide the **optional `VITE_RELEASE` stamp** (§7) — accept the one-line deploy.yml change or keep
    backend-only release correlation.

## Open questions for /speckit-plan

- **None blocking.** All architectural choices above have a recommendation; the only owner sign-offs are the
  operational/legal ones listed under "Owner-gated actions" (privacy copy wording; optional `VITE_RELEASE`;
  and — only if the owner wants to keep CI FE‖BE parallelism — a deviation from D4 Option (a) to (b), which
  would need its own sign-off). Two facts are **must-verify-at-implement** (no `git`/`gcloud` here):
  PR #6/#7 merge state + `main` head (§2/§6) and the orphan-branch supersession diff (§6); and the exact
  minimal GCP role names (§1.2) confirmed against current docs at provision time.

## Sources (verified, not inferred)

- Schemathesis v4 pytest + ASGI: <https://schemathesis.readthedocs.io/en/stable/explanations/pytest/>,
  <https://schemathesis.readthedocs.io/en/stable/guides/python-apps/>,
  <https://schemathesis.readthedocs.io/en/stable/reference/python/>
- FastAPI removing the default 422 / `HTTPValidationError`:
  <https://github.com/fastapi/fastapi/discussions/6695>, <https://github.com/fastapi/fastapi/issues/3424>,
  <https://fastapi.tiangolo.com/advanced/additional-responses/>
- Cloud Run deploy-from-source IAM: <https://docs.cloud.google.com/run/docs/deploying-source-code>,
  <https://docs.cloud.google.com/build/docs/deploying-builds/deploy-cloud-run>,
  <https://docs.cloud.google.com/run/docs/reference/iam/roles>
- Workload Identity Federation for GitHub Actions: <https://github.com/google-github-actions/auth>,
  <https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines>
