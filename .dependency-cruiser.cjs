/** dependency-cruiser (ADR-0004). Complements ESLint boundaries with graph-wide rules:
 *  no circular deps, and the canonical-core direction (pricing-core must never depend on the app). */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make the graph fragile and hard to reason about.",
      from: {},
      to: { circular: true },
    },
    {
      name: "pricing-core-is-canonical",
      severity: "error",
      comment: "pricing-core is the zero-dependency canonical TS core; it must not import the app.",
      from: { path: "^packages/pricing-core" },
      to: { path: "^apps/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    // Generated client (A8) and build artifacts are out of scope.
    exclude: { path: "(node_modules|dist|coverage|apps/web/src/shared/api)" },
  },
};
