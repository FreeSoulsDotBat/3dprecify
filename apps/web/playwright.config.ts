import { defineConfig, devices } from "@playwright/test";

// E2E against the built app (vite preview) + the REAL backend (uvicorn + the compose Postgres,
// dedicated e2e database — see tests/e2e/global-setup.ts) + the Firebase Auth emulator (started
// around the run by `firebase emulators:exec`, root `pnpm e2e`). The app is built in EMULATOR
// mode; the backend verifies the same emulator's tokens (P3D_FIREBASE_AUTH_EMULATOR_HOST), so a
// throwaway sign-up drives the FULL premium loop: JIT account → operator CLI grant → catalog
// CRUD → calculator pre-fill (E2 T025).
// Same Windows trap as E2E_PREVIEW_PORT below, other port: the OS reserves whole ranges for
// dynamic use and 9099 has already fallen inside one (9011–9110, 2026-08-26) — the emulator dies
// with EACCES before anything starts, and freeing the range needs an elevated winnat restart.
// The override keeps 9099 as the only checked-in port (CI and firebase.json untouched); a local
// run passes `E2E_AUTH_EMULATOR_PORT` + a `--config` copy of firebase.json with the same port.
const AUTH_EMULATOR_PORT = process.env.E2E_AUTH_EMULATOR_PORT ?? "9099";

const emulatorEnv = {
  VITE_USE_AUTH_EMULATOR: "true",
  VITE_AUTH_EMULATOR_URL: `http://127.0.0.1:${AUTH_EMULATOR_PORT}`,
  VITE_FIREBASE_API_KEY: "demo-key",
  VITE_FIREBASE_PROJECT_ID: "demo-precifica3d",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-precifica3d.firebaseapp.com",
  VITE_FIREBASE_APP_ID: "demo-app",
  // Dedicated e2e backend port — independent of any dev server squatting on 8000.
  VITE_API_BASE_URL: "http://localhost:8100",
};

// Single source for the e2e DB URL (global-setup.ts recreates this database every run).
export const E2E_DATABASE_URL = "postgresql+psycopg://precifica3d@localhost:5433/precifica3d_e2e";

// E6/T016 — the local MP stub's dedicated port (`backend/tests/mp_stub/run_standalone.py`).
// Exported so `billing.spec.ts`/`billing-helpers.ts` never hardcode a second copy of this port.
export const MP_STUB_URL = "http://localhost:8200";
export const E2E_BACKEND_URL = "http://localhost:8100";

// The preview port is an ENVIRONMENT concern, not a product constant. 4173 stays the default (CI
// and every existing script are untouched), but a Windows host running Docker/Hyper-V periodically
// reserves whole port ranges for dynamic use — 4126–4225 among them — and a reserved port fails to
// bind with EACCES before Playwright even starts. Overriding beats hard-coding a second magic
// number: `E2E_PREVIEW_PORT=4600 pnpm e2e`.
const PREVIEW_PORT = process.env.E2E_PREVIEW_PORT ?? "4173";
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  // 013 audit remediation (T093): `fullyParallel` runs ~16 workers against ONE Postgres + ONE backend,
  // and under that load a test's setup can lose a create/provisioning race — a flaky FAIL that passes
  // on a serial (`--workers=1`) re-run. This is PRE-EXISTING (reproduced identically on `develop`,
  // where it is in fact worse) and is infra flake, not a product bug — so retries are correct here:
  // a genuine regression still fails all attempts, but a load race gets the re-run Playwright's own
  // docs prescribe. This also makes the `trace: "on-first-retry"` below meaningful (it was dead with
  // the prior implicit `retries: 0`). Local keeps 1 (fast, still absorbs a single flake); CI gets 2.
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: PREVIEW_URL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `pnpm build && pnpm exec vite preview --port ${PREVIEW_PORT}`,
      url: PREVIEW_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: emulatorEnv,
    },
    {
      // The REAL FastAPI backend on the SPA's default VITE_API_BASE_URL (localhost:8000).
      command: "uv run python scripts/run_e2e_server.py",
      cwd: "../../backend",
      url: "http://localhost:8100/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        PORT: "8100",
        P3D_DATABASE_URL: E2E_DATABASE_URL,
        P3D_FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${AUTH_EMULATOR_PORT}`,
        P3D_FIREBASE_PROJECT_ID: "demo-precifica3d",
        // The preview's origin must be in the CORS allowlist, or EVERY API call from the app is
        // blocked by the browser — and the failure is deeply indirect: the account is created
        // just-in-time on the first authenticated request, so no request means no account, and the
        // operator grant then fails with "no existing account matches …". The default allowlist
        // only knows 5173/4173, so an overridden port MUST carry its origin with it.
        P3D_CORS_ORIGINS: JSON.stringify([PREVIEW_URL, "http://localhost:4173"]),
        // E6/T016 (billing.spec.ts) — points the backend's MercadoPagoProvider at the local MP
        // stub (below) instead of the real network. No real MP credentials exist or are needed
        // (the owner's build-first phase) — these are dev-only test values, never read outside
        // this e2e run. MP_WEBHOOK_SECRET must match `billing-helpers.ts`' MP_STUB_SECRET.
        P3D_MP_BASE_URL: MP_STUB_URL,
        P3D_MP_WEBHOOK_SECRET: "e2e-mp-stub-webhook-secret",
        P3D_MP_PLAN_ID_MONTHLY: "e2e-plan-monthly",
        P3D_MP_PLAN_ID_ANNUAL: "e2e-plan-annual",
      },
    },
    {
      // E6/T016 — the local MP stub (`backend/tests/mp_stub/stub.py`) served standalone over real
      // HTTP (see `run_standalone.py`'s docstring for the cross-process db-fallback rationale).
      // Same e2e database as the backend above, so the fallback lookup sees the app's own writes.
      command: "uv run python tests/mp_stub/run_standalone.py",
      cwd: "../../backend",
      url: `${MP_STUB_URL}/openapi.json`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        MP_STUB_PORT: "8200",
        P3D_DATABASE_URL: E2E_DATABASE_URL,
      },
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile-first homologation viewport (≤414px, V1).
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
