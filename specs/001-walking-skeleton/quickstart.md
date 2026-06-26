# Quickstart — Walking Skeleton (validation guide)

Proves the slice end-to-end. See [data-model.md](./data-model.md) and [contracts/](./contracts/) for shapes.

## Prerequisites
- Node 20+ and Python 3.12 (both present on the dev machine).
- A Firebase project: a Web App registered, **Google** sign-in provider enabled, and a **service-account**
  credential for the backend.
- Env: web gets the Firebase web config; backend gets `GOOGLE_APPLICATION_CREDENTIALS` (service account).

## Setup
- Install deps for `packages/pricing-core`, `apps/web`, and `backend` (per each package's manifest).
- Provide the env values above (never commit secrets — `.env` is git-ignored).

## Run
- Backend: start FastAPI (uvicorn) → `GET /health` returns `{ "status": "ok" }`.
- Web: start Vite dev server → open the app on a mobile viewport.

## Validate (acceptance)
1. **Auth gate (US1)**: open the app signed out → calculator is not shown, sign-in is offered. Sign in with
   Google → the calculator screen appears.
2. **Server boundary (FR-003)**: call `GET /api/v1/me` with no token → **401**; with the signed-in user's token
   → **200** + `uid`.
3. **Calculation (US2)**: enter costPerRoll=100, rollWeightKg=1, grams=20, markupPct=50 → screen shows
   material cost **R$ 2,00** and suggested price **R$ 3,00**.
4. **Offline (FR-008)**: load the app once, go offline, recompute → a correct result is still shown.
5. **Validation (FR-011)**: set rollWeightKg=0 → a friendly pt-BR message; no crash, no `Infinity`.
6. **Deploy (FR-010)**: the app is reachable at its public URL and renders without breakage at ≤ 414 px.

## Automated tests
- `pricing-core`: Vitest numeric cases from [contracts/pricing-core.md](./contracts/pricing-core.md) (must fail first).
- `backend`: pytest token cases from [contracts/api.md](./contracts/api.md).
- `web`: Playwright visual homologation of the calculator screen (run by `qa-produto`).
