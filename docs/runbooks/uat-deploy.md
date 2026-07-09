# Runbook — UAT deploy (Precifica3D)

> Operational guide for deploying to **uat** (Cloud Run + Firebase Hosting, `southamerica-east1`, WIF
> keyless — ADR-0005) and verifying/rolling back a deploy. Owned by feature 006; the completed FIRST run is
> recorded in `specs/006-uat-deploy-hardening/dod-evidence.md`. UAT builds from the **`develop`** ref
> (ADR-0006); production (from `main`) is a separate, future act.

## 1. Config & prerequisites

Everything lives in the **GitHub Environment `uat`** (repo → Settings → Environments) and the GCP/Firebase
projects — never in the repository (secret scans enforce). `deploy.yml` is reused as-is.

### 1.1 GitHub Environment `uat` — vars & secrets (research §1.1)

| Name | Kind | Value / meaning |
|---|---|---|
| `DEPLOY_ENABLED` | var | `true` — anything else keeps the environment inert (guard step fails, FR-207) |
| `GCP_PROJECT` | var | GCP project id (billing enabled) |
| `GCP_REGION` | var | `southamerica-east1` (ADR-0005/A10) |
| `FIREBASE_PROJECT` | var | `precifica3d-uat` (matches `.firebaserc`; drives web config, CORS default, Hosting target) |
| `SPA_ORIGINS` | var (optional) | JSON array override for backend CORS — only when the served origin ≠ `https://{FIREBASE_PROJECT}.web.app`/`.firebaseapp.com` |
| `WIF_PROVIDER` | secret | Full resource name of the Workload Identity provider (§1.2 P5) |
| `WIF_SERVICE_ACCOUNT` | secret | Deploy service-account e-mail impersonated via WIF |
| `FIREBASE_SERVICE_ACCOUNT` | secret | Firebase SA **JSON** for `action-hosting-deploy` — the one long-lived credential; rotate periodically (candidate future migration to OIDC hosting deploy) |
| `FIREBASE_WEB_API_KEY` | secret | Firebase Web App config → Vite build |
| `FIREBASE_WEB_APP_ID` | secret | Firebase Web App config → Vite build |
| `SENTRY_DSN` / `SENTRY_DSN_WEB` | secret (optional) | Backend/web observability; absence = silent no-op |

### 1.2 GCP/Firebase resources (research §1.2 — provision in this order)

| # | Resource | Notes |
|---|---|---|
| P1 | GCP project + **billing** | Owner console/billing |
| P2 | APIs: Cloud Run, Cloud Build, Artifact Registry, IAM Credentials, Firebase, Firebase Hosting | `gcloud services enable …` |
| P8–P10 | Firebase project `precifica3d-uat` linked + Hosting site (default = project id) + **Web App** (yields the two web secrets) + **Google Auth provider enabled** + Hosting domain in **authorized domains** | Owner console |
| P4/P7 | **Deploy SA** + runtime SA. Deploy-SA roles (verify exact names against live GCP IAM docs at grant time): `roles/run.admin` + `roles/iam.serviceAccountUser` (on the runtime SA) + build path (`roles/run.builder` OR `cloudbuild.builds.editor`+`artifactregistry.writer`+`storage.admin`) | Least privilege — never `roles/owner` |
| P5/P6 | **WIF pool + OIDC provider** (issuer `https://token.actions.githubusercontent.com`, attribute condition `repository == FreeSoulsDotBat/3dprecify`) + binding principalSet → deploy SA `roles/iam.workloadIdentityUser` | Scoped to this repo only |
| P3 | Artifact Registry repo `cloud-run-source-deploy` (region above) | Or let the first deploy auto-create it (needs AR-admin) |
| P11 | Firebase SA JSON for the hosting action | → `FIREBASE_SERVICE_ACCOUNT` |

## 2. Deploy

1. Confirm §1.1 is fully populated and `DEPLOY_ENABLED=true`.
2. GitHub → **Actions → Deploy → Run workflow** → environment **`uat`**, ref **`develop`**.
   (The workflow is only offered once `deploy.yml` exists on the default branch — the FR-209 release
   merge.)
3. Record: the **run URL** and the **`github.sha`** it reports (the deployed-commit stamp, FR-205 — it
   becomes `P3D_RELEASE` on Cloud Run and the Sentry release tag).
4. The job deploys the **backend first** (Cloud Run, from source) and then the **SPA** (Firebase Hosting,
   with `VITE_API_BASE_URL` captured from the Cloud Run output). A failure between the two is a
   **half-deploy** — go to §4.
5. A run against a NOT-enabled environment must stop loudly at the guard step ("environment must be
   enabled") — that is FR-207 working, not a bug.

## 3. Smoke checklist (device-executable — a failed item = a FAILED deploy, Principle II)

From a phone that never saw the project, with only the UAT URL:

1. **Shell loads** — app opens, bottom nav renders.
2. **Calculator computes** — default seed shows custo total + varejo/atacado; add a marketplace channel
   and an "Outros custos" item; prices update, never NaN.
3. **Served fee reference** — a Shopee channel's honesty seal reads the ONLINE reference ("Referência …
   atualizada em …"), NOT "referência embutida (offline)" — proves `GET /api/v1/fee-catalog` served.
4. **Google sign-in** — succeeds against real Firebase Auth; no blank screen on failure (friendly pt-BR
   error instead).
5. **Server-confirmed identity** — Conta shows the e-mail returned by `/me`.
6. **Offline compute (SC-203)** — airplane mode → calculator still computes the same numbers.
7. **Correlation id (FR-205, the one tooling-permitted step)** — signed-out, open Conta → the friendly
   `/me` error shows; confirm the `correlationId` on the Sentry event for that request (or the
   `X-Correlation-Id` response header via devtools).
8. **Cold vs warm load** — record both times honestly (Cloud Run scales to zero; the seed keeps the
   calculator non-blocking during the cold window). No target; measured and recorded.

## 4. Rollback & half-deploy triage (FR-206)

**Triage which half moved:** compare the SPA's release (Sentry web event / bundle) and the API's
`P3D_RELEASE` (Sentry backend event) against the run's `github.sha`. The Cloud Run service URL is stable
across revisions, so a stale SPA still points at a valid API — the real hazard is a NEW backend contract
under an OLD bundle (or vice-versa).

- **Backend rollback:** `gcloud run services update-traffic precifica3d-api --region southamerica-east1
  --to-revisions <PREVIOUS_REVISION>=100` (list revisions with `gcloud run revisions list`).
- **Web rollback:** `firebase hosting:rollback` (interactive, uses the Hosting release history) — or
  re-run the Deploy workflow pinned to the previous known-good ref.
- Verify the previous version serves (repeat smoke items 1–3), then re-deploy when fixed. **Time both
  directions** — the rehearsal feeds SC-204 (<10 min rollback; the timed re-deploy doubles as the
  repeat-deploy measurement, <30 min, idempotent).
