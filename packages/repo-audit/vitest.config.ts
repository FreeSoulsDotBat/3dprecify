import { defineConfig } from "vitest/config";

// Config local para que `vitest run` dentro do pacote não herde o `projects` da raiz — mesmo molde
// do pricing-core. Este pacote é só `tests/`: não tem `src/`, então não entra na cobertura (o
// `include` da raiz é `packages/*/src/**`) e a catraca de 100% não se aplica a ele.
export default defineConfig({
    test: { include: ["tests/**/*.test.ts"] },
});
