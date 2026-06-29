import { defineConfig, devices } from "@playwright/test";

// E2E against the built app (vite preview). @nearform/playwright-firebase is installed for the
// auth E2E that arrives with the product login screen (001); the foundation only smoke-tests the shell.
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
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobile-first homologation viewport (≤414px, V1).
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
