/** dependency-cruiser (ADR-0004). Complements ESLint boundaries with graph-wide rules:
 *  no circular deps, the canonical-core direction (pricing-core must never depend on
 *  the app), and the FSD-Lite layer direction (no upward imports). */

// FSD-Lite layers, top → bottom. A layer may import only from layers strictly
// below it; importing a layer at or above itself is forbidden (upward import).
const LAYER = {
  app: "^apps/web/src/(app|main\\.tsx)",
  pages: "^apps/web/src/pages",
  widgets: "^apps/web/src/widgets",
  features: "^apps/web/src/features",
  entities: "^apps/web/src/entities",
  shared: "^apps/web/src/shared",
};

// For each layer, the set of layers it must NOT import (itself excluded — sibling
// isolation is enforced by eslint-plugin-boundaries; here we guard the direction).
const upwardRules = [
  { from: "pages", above: ["app"] },
  { from: "widgets", above: ["app", "pages"] },
  { from: "features", above: ["app", "pages", "widgets"] },
  { from: "entities", above: ["app", "pages", "widgets", "features"] },
  { from: "shared", above: ["app", "pages", "widgets", "features", "entities"] },
].map(({ from, above }) => ({
  name: `no-upward-${from}`,
  severity: "error",
  comment: `${from} must not import from a higher FSD-Lite layer (upward import).`,
  from: { path: LAYER[from] },
  to: { path: `(${above.map((l) => LAYER[l]).join("|")})` },
}));

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
    {
      // 014/T007 — a fronteira do pacote de ingestão, que até aqui era só disciplina minha.
      //
      // Ela foi EXERCITADA de verdade na T106: validar o artefato montado contra o schema Zod exigiria
      // `packages/fee-ingest` importar `apps/web/src/shared/fee-catalog`, e a alternativa seria
      // duplicar o contrato. Parei ali por decisão estrutural (Princípio VIII) — mas nada no
      // repositório me impedia. Agora impede, e a próxima pessoa recebe a recusa em vez de precisar
      // conhecer a conversa.
      //
      // O pacote roda em CI, sem app e sem banco: importar de `apps/` o acoplaria a um bundle de
      // browser, e de `backend/` a um runtime Python que ele nunca terá.
      name: "fee-ingest-is-standalone",
      severity: "error",
      comment:
        "packages/fee-ingest runs in CI with no app and no database; it must not import apps/ or backend/.",
      from: { path: "^packages/fee-ingest" },
      to: { path: "^(apps|backend)/" },
    },
    ...upwardRules,
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    // Generated client (A8) and build artifacts are out of scope.
    exclude: { path: "(node_modules|dist|coverage|apps/web/src/shared/api)" },
  },
};
