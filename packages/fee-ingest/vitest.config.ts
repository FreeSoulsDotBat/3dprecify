import { defineConfig } from "vitest/config";

// Local config so `vitest run` inside this package doesn't inherit the root `projects` config.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
