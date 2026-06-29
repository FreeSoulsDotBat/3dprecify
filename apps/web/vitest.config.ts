import { defineConfig } from "vitest/config";

// Unit tests live in src/**.test.ts(x); Playwright e2e specs (tests/e2e/**.spec.ts) are NOT vitest.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    environment: "node",
  },
});
