import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/**
 * 015/A5 ([F03a-001]) — o `pricing-core` CARREGA sob `node` puro.
 *
 * Por que este teste existe, e por que ele executa em vez de inspecionar: o `fee-ingest` teve
 * exatamente esta doença e ela custou um blocker CRÍTICO na US4 — três imports relativos sem
 * extensão, e o pacote não bootava sob `node`. **Mais de mil testes eram cegos a isso**, porque o
 * vitest é o resolvedor TOLERANTE: ele resolve `./rounding` sem extensão, e o Node não.
 *
 * A cura foi aplicada lá e NÃO foi herdada aqui — o `pricing-core` ficou com os mesmos imports
 * extensionless. É a quinta instância do padrão que a auditoria mais mediu: a cura existe no
 * módulo ao lado.
 *
 * A lição literal da US4: **uma suíte que passa não prova nada sobre um programa que não RODA.**
 * Então este teste não lê imports com regex (um regex aprovaria `./x` e reprovaria `./x.js`
 * conforme a moda do dia) — ele manda o Node importar o módulo e usar o que importou.
 */
describe("o pacote boota sob node puro", () => {
  it("importa o entry point e calcula, sem passar por bundler nenhum", () => {
    // A URL `file://`, e nao o caminho do SO: no Windows o `import()` do Node recusa `D:\...`
    // com ERR_UNSUPPORTED_ESM_URL_SCHEME. Errei isto na primeira versao deste proprio teste.
    const entry = new URL("../src/index.ts", import.meta.url).href;
    const script = `
      const { computeCalculator, PRICING_MODEL_VERSION } = await import(${JSON.stringify(entry)});
      const r = computeCalculator({
        costPerRoll: 120, rollWeightKg: 1, printGrams: 250, printTimeHours: 8,
        avgPowerKw: 0.15, tariffPerKwh: 0.92, machineValue: 3500, machineLifetimeHours: 5000,
        markupVarejoPct: 120, markupAtacadoPct: 60,
      });
      // Imprime para o teste ler: importar sem usar não provaria que o grafo inteiro resolveu.
      console.log(JSON.stringify({ versao: PRICING_MODEL_VERSION, varejo: r.precoVarejo }));
    `;

    // `--input-type=module` + stdin: nenhum arquivo temporário, e o `node` é o do ambiente —
    // o mesmo binário que rodaria o script de ingestão em produção.
    const saida = execFileSync(process.execPath, ["--input-type=module", "--eval", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    const resultado = JSON.parse(saida.trim()) as { versao: string; varejo: number };
    expect(resultado.versao).toMatch(/^\d+\.\d+\.\d+$/);
    // Guarda de não-vacuidade: um `undefined` aqui significaria que o módulo carregou pela metade.
    expect(resultado.varejo).toBeGreaterThan(0);
  });
});
