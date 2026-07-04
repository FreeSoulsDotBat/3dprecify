import { defineConfig, devices } from "@playwright/test";

// E2E against the built app (vite preview). The app is built in EMULATOR mode (dummy Firebase
// config + VITE_USE_AUTH_EMULATOR) so the authenticated calculator E2E can sign a throwaway user
// in against the Firebase Auth emulator via the app's own auth instance (see firebase.ts seam).
// The emulator itself is started around the run by `firebase emulators:exec` (root `pnpm e2e`).
const emulatorEnv = {
  VITE_USE_AUTH_EMULATOR: "true",
  VITE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
  VITE_FIREBASE_API_KEY: "demo-key",
  VITE_FIREBASE_PROJECT_ID: "demo-precifica3d",
  VITE_FIREBASE_AUTH_DOMAIN: "demo-precifica3d.firebaseapp.com",
  VITE_FIREBASE_APP_ID: "demo-app",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm build && pnpm preview",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: emulatorEnv,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile-first homologation viewport (≤414px, V1).
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
