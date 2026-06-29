import { defineConfig } from "vitest/config";

// Root Vitest config (V8 coverage). apps/web is added to `projects` in Phase 5.
// The coverage ratchet enforcer (baseline + fail-on-drop) is wired in CI (T112/T136).
export default defineConfig({
  test: {
    projects: ["packages/*"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["packages/*/src/**"],
      exclude: ["**/dist/**", "apps/web/src/shared/api/**"],
      // Coverage ratchet for the pure-logic core (packages/*). pricing-core stays ~100%.
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
