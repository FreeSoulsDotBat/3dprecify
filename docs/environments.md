# Environments (ADR-0005)

Three tiers, at most two cloud projects. Production is provisioned only at launch.

| Tier | How to run | Firebase | Backend | Cost |
|------|-----------|----------|---------|------|
| **local** | `pnpm --filter @3dprecify/web dev` + `cd backend && uv run uvicorn app.main:app --reload` + `firebase emulators:start` | Auth **emulator** (`P3D_FIREBASE_AUTH_EMULATOR_HOST`, `VITE_USE_AUTH_EMULATOR=true`) | local uvicorn | R$0 |
| **uat** | manual `Deploy` workflow → `uat` (source: `develop`) | `precifica3d-uat` | Cloud Run (scale-to-zero) | ~R$0 |
| **prod** | manual `Deploy` workflow → `prod` (source: `release`, at launch) | `precifica3d-prod` | Cloud Run | pay-per-use |

## Config per tier
- Backend: `P3D_*` env (see `backend/app/settings.py`) — `P3D_APP_ENV`, `P3D_CORS_ORIGINS`, `P3D_FIREBASE_*`,
  `P3D_SENTRY_DSN`, `P3D_REGION`.
- Web: `VITE_*` (see `apps/web/src/shared/lib/env.ts`) — `VITE_FIREBASE_*`, `VITE_USE_AUTH_EMULATOR`,
  `VITE_API_BASE_URL`, `VITE_SENTRY_DSN`.
- CI/CD: **GitHub Environments** `uat` and `prod` hold tier-scoped secrets/vars (same names, different
  values). The `Deploy` workflow (`.github/workflows/deploy.yml`) consumes them — a tier is inert until
  its `DEPLOY_ENABLED` var is `true`:
  - **vars**: `DEPLOY_ENABLED`, `GCP_PROJECT`, `GCP_REGION`, `FIREBASE_PROJECT`, and optional
    `SPA_ORIGINS` (JSON array of allowed browser origins for backend CORS — e.g.
    `["https://app.precifica3d.com"]`; defaults to the project's `*.web.app` / `*.firebaseapp.com` URLs).
  - **secrets**: `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT`,
    `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_APP_ID`, and optional `SENTRY_DSN` (backend) /
    `SENTRY_DSN_WEB` (web).
  - The backend `VITE_API_BASE_URL` is captured automatically from the Cloud Run deploy output — not a var.

## Promotion (ADR-0006)
Branch flow: `feature/* → develop → main → release` (convention-only; do not merge on red CI).
- On green CI, the next promotion PR is **auto-opened** (`develop→main`, `main→release`) — never auto-merged.
- **Deploys are manual**: run the `Deploy` workflow (`workflow_dispatch`) and pick `uat` or `prod`. `develop`
  is the UAT source, `release` the prod source. Each target is inert until its GitHub Environment sets
  `DEPLOY_ENABLED=true`. Prod ships only at launch.

## Local `.env` (not committed)
Create `apps/web/.env.local` and `backend/.env` from the field lists above. For pure-local work the Firebase
fields can be left unset (auth shows `not-configured`) or pointed at the emulator.
