# ADR-0005: Environments and promotion model

**Status**: Accepted (2026-06-29) · **Deciders**: Jonatan + main thread

## Context
We need separated environments without paying for production prematurely. Cloud Run scales to zero and Firebase
has a free tier, so a low-traffic UAT is ~R$0; the real reason to defer prod is not exposing an unfinished
product, not money. Decision taken with the owner (Principle VIII).

## Decision
Three tiers, but at most **two cloud projects**:

| Tier | Where | Firebase | Backend | Provisioned |
|------|-------|----------|---------|-------------|
| **local (dev)** | localhost | **Auth emulator** (demo project, no real project) | local uvicorn | now (done) |
| **uat (homologação)** | cloud | `precifica3d-uat` | Cloud Run (scale-to-zero) | **now** |
| **prod** | cloud | `precifica3d-prod` | Cloud Run | **at launch** (config templated now) |

**Promotion:**
- Every branch → local (emulator).
- Merge to `main` → **auto-deploy to UAT** (homologation URL).
- Git **tag/release `v*`** → **manual-trigger deploy to prod** (gated by GitHub Environment `production`).

**Mechanics:**
- Per-tier config via `pydantic-settings` (backend `P3D_*`) + `VITE_*` (web) + separate Firebase projects.
- **GitHub Environments** `uat` and `production` hold tier-scoped secrets/vars (same names, different values):
  `GCP_PROJECT`, `GCP_REGION` (southamerica-east1), `FIREBASE_PROJECT`, `WIF_PROVIDER`,
  `WIF_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT`, Sentry auth-token.
- Repo-level vars `UAT_ENABLED` / `PROD_ENABLED` gate the deploy jobs (inert until set `true`).
- WIF keyless auth (no JSON keys).

**Android/Play (E7, later):** Play tracks mirror this — internal/closed testing = UAT-equivalent, production
track = prod. Out of scope until the app is packaged.

## Consequences
- UAT gives real homologation (CORS, Cloud Run cold start, real Firebase) at ~zero cost.
- Prod stays unprovisioned until launch; `deploy.yml` already supports it (flip `PROD_ENABLED` + set env secrets).
- Two Firebase projects to manage; acceptable for a 3-tier flow.

## Alternatives rejected
- **All-local until MVP**: cheapest, but localhost homologation isn't a real UAT (no shareable URL, no
  env-specific issues caught). Rejected — owner wants real UAT.
- **UAT + prod both now**: more setup and contradicts deferring prod. Rejected for now.
