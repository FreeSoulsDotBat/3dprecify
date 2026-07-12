import { defineConfig } from "vitest/config";

// Root Vitest config (V8 coverage). Runs every workspace project's unit tests so the gate
// enforces them. Two coverage regimes, by per-glob thresholds:
//   • packages/* — the pure-logic core (pricing-core) stays at a 100% ratchet.
//   • apps/web/src — a REALISTIC FLOOR (owner decision 2026-07-12, recorded in
//     docs/decisions/tech-stack-decisions.md, Round CG). This does NOT replace visual
//     homologation — it is an ADDITIONAL DoD step layered on top of it: apps/web is now
//     validated by BOTH the homologation walk AND this coverage floor. Floors sit below the
//     measured baseline (statements ~81 / branches ~77 / functions ~78 / lines ~82) to catch a
//     real coverage DROP without flaking on ordinary churn.
export default defineConfig({
  test: {
    projects: ["packages/*", "apps/web"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["packages/*/src/**", "apps/web/src/**"],
      // Generated Orval client, type decls, build output and the tests themselves never count.
      exclude: ["**/dist/**", "**/*.d.ts", "**/*.test.*", "apps/web/src/shared/api/**"],
      thresholds: {
        "packages/*/src/**": { statements: 100, branches: 100, functions: 100, lines: 100 },
        "apps/web/src/**": { statements: 77, branches: 73, functions: 74, lines: 78 },
      },
    },
  },
});
