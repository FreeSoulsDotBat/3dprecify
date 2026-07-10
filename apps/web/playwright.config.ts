import { defineConfig, devices } from "@playwright/test";

// E2E against the built app (vite preview) + the REAL backend (uvicorn + the compose Postgres,
// dedicated e2e database — see tests/e2e/global-setup.ts) + the Firebase Auth emulator (started
// around the run by `firebase emulators:exec`, root `pnpm e2e`). The app is built in EMULATOR
// mode; the backend verifies the same emulator's tokens (P3D_FIREBASE_AUTH_EMULATOR_HOST), so a
// throwaway sign-up drives the FULL premium loop: JIT account → operator CLI grant → catalog
// CRUD → calculator pre-fill (E2 T025).
const emulatorEnv = {
  VITE_USE_AUTH_EMULATOR: "true",
  VITE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
  VITE_FIREBASE_API_KEY: "demo-key",
  VITE_FIREBASE_PROJECT_ID: "demo-precifica3d",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-precifica3d.firebaseapp.com",
  VITE_FIREBASE_APP_ID: "demo-app",
  // Dedicated e2e backend port — independent of any dev server squatting on 8000.
  VITE_API_BASE_URL: "http://localhost:8100",
};

// Single source for the e2e DB URL (global-setup.ts recreates this database every run).
export const E2E_DATABASE_URL = "postgresql+psycopg://precifica3d@localhost:5433/precifica3d_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "pnpm build && pnpm preview",
      url: "http://localhost:4173",
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
        P3D_FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
        P3D_FIREBASE_PROJECT_ID: "demo-precifica3d",
      },
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile-first homologation viewport (≤414px, V1).
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
