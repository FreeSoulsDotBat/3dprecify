import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

// Unit tests live in src/**.test.ts(x); Playwright e2e specs (tests/e2e/**.spec.ts) are NOT vitest.
// The `@` alias mirrors vite.config.ts so unit tests resolve the same module paths as the app.
export default defineConfig({
    resolve: {
        alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        passWithNoTests: true,
        environment: "node",
        // 2026-08-31 — teto MEDIDO (o root vitest.config.ts não propaga testTimeout para o
        // projeto; a razão completa está lá): páginas pesadas rodam 1–1,5s isoladas e passam de
        // 5s sob a suíte completa com cobertura nesta máquina — o default virava flake rotativo.
        testTimeout: 20_000,
    },
});
