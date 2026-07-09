# Quickstart — Walking Skeleton (validation guide)

Proves the slice end-to-end. See [data-model.md](./data-model.md) and [contracts/](./contracts/) for shapes.

## Run locally for homologation (no cloud, Firebase Auth emulator)

Requires Node 24 + `pnpm install` done, and Java (for the emulator — already present).

1. From the repo root: **`pnpm dev`** — this starts the Firebase Auth emulator and the Vite
   dev server together (env comes from `apps/web/.env.development`, copied from `.env.example`).
2. Open the printed local URL (Vite, e.g. `http://localhost:5173`). On a phone-sized viewport
   (DevTools device toolbar) to homologate the mobile-first layout.
3. Click **"Entrar com Google"** → the emulator's sign-in popup opens → **"Add new account"**
   (any fake name/email) → you land on the calculator. Toggle light/dark with **"Alternar tema"**.
4. The calculator computes live (try costPerRoll=100, rollWeightKg=1, grams=20, markup=50 →
   **R$ 2,00 / R$ 3,00**; set rollWeight=0 → friendly error). The backend is **not** needed for
   the UI flow (the calc is client-side); the Auth emulator UI is at `http://localhost:4000`.

Full automated run (build + emulator + Playwright, incl. authenticated + offline): **`pnpm e2e`**.

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
