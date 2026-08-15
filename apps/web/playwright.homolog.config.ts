import { defineConfig, devices } from "@playwright/test";

import baseConfig from "./playwright.config";

// Homologação automatizada (2026-08-12) — suíte SEPARADA da `tests/e2e`, para não misturar os
// testes de regressão do produto com a bateria de estresse desta homologação. Reusa integralmente
// os mesmos webServers (preview + backend real + stub MP) e o mesmo globalSetup do e2e, porque
// homologar contra um mock não homologa nada.
//
// Viewport e tema NÃO viram `projects` aqui: cada teste declara o seu (via `aplicarSubcenario`),
// porque a matriz da Fase 2 é dirigida — um mesmo arquivo cobre V1/V2/V3 com focos diferentes.
export default defineConfig({
  ...baseConfig,
  testDir: "./tests/homologacao",
  globalSetup: "./tests/homologacao/global-setup.ts",
  fullyParallel: true,
  // Um defeito real precisa ser reprodutível: sem retry, um vermelho é um vermelho.
  retries: 0,
  timeout: 240_000, // a bateria de um subcenário faz dezenas de interações reais; 90s era do teste, não do produto
  reporter: [
    ["list"],
    ["json", { outputFile: "../../docs/homologacao/automatizada/resultados/playwright-raw.json" }],
  ],
  projects: [{ name: "homolog", use: { ...devices["Desktop Chrome"] } }],
});
