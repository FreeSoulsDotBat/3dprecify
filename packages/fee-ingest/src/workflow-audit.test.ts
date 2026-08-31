import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// 017/T004 (FR-1003, SC-1005) — a auditoria ESTRUTURAL dos workflows, lida por `fs`.
//
// Leitura e não import: a fronteira do §H do desenho fala de IMPORTS (`fee-ingest` não importa
// `apps/` nem `backend/`), e um YAML não é um módulo. O que este arquivo afirma é uma propriedade do
// REPOSITÓRIO, não de um arquivo — e é essa a diferença que o 017 paga para ter: enquanto
// `g1-probe-ml.yml` referenciar `secrets.ML_ACCESS_TOKEN`, "nenhuma credencial do ML neste
// incremento" é verdade sobre um arquivo e mentira sobre o repositório (conflito 5 do desenho).
//
// Por que um teste e não uma linha de revisão: o pin-guard (`check-action-pins.sh`) existe porque uma
// remediação que depende de lembrança não acontece. Esta é a mesma classe.

const WORKFLOWS_DIR = fileURLToPath(new URL("../../../.github/workflows/", import.meta.url));

const workflowFiles = readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .sort();

const read = (nome: string) => readFileSync(`${WORKFLOWS_DIR}${nome}`, "utf8");

/** Toda referência a `secrets.X` / `secrets['X']` de um YAML, como lista de NOMES. */
function segredosDe(yaml: string): string[] {
    const nomes: string[] = [];
    for (const m of yaml.matchAll(/secrets\.([A-Za-z_][A-Za-z0-9_]*)/g)) nomes.push(m[1]!);
    for (const m of yaml.matchAll(/secrets\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g))
        nomes.push(m[1]!);
    return nomes;
}

describe("auditoria de workflows — repo-wide (roda sempre)", () => {
    it("há workflows para auditar (senão as asserções abaixo passariam por vacuidade)", () => {
        expect(workflowFiles.length).toBeGreaterThan(0);
    });

    // A afirmação que o 017 precisa poder fazer inteira: o incremento não carrega credencial do ML.
    // Ela só é verdade depois que as sondas descartáveis morrem (ADR-0010 §A13 "Evidence": disposable,
    // e a MEDIÇÃO delas está preservada nas tabelas do próprio ADR — apagar não perde dado).
    it("nenhum workflow do repositório referencia um segredo `ML_*`", () => {
        const ofensores = workflowFiles
            .map((f) => ({ f, nomes: segredosDe(read(f)).filter((n) => n.startsWith("ML_")) }))
            .filter((x) => x.nomes.length > 0)
            .map((x) => `${x.f}: ${x.nomes.join(", ")}`);
        expect(ofensores).toEqual([]);
    });

    it("nenhum workflow do repositório referencia sonda descartável já removida", () => {
        const ofensores = workflowFiles.filter((f) => /scripts\/probes\//.test(read(f)));
        expect(ofensores).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// PORTÃO DA ONDA 2 (T015) — as asserções sobre `fee-refresh.yml`.
//
// O arquivo é escrito na T015, DEPOIS desta onda (T004–T013 é só a espinha). Um teste vermelho não
// pode viajar no commit da onda, e um `test.todo` não afirma nada — então o bloco é GATEADO POR
// EXISTÊNCIA e, no dia em que a T015 criar o arquivo, ele acorda sozinho e passa a valer.
//
// O risco desse padrão é conhecido e é o do 014/US4: um `skipIf` que nunca acorda é um guarda que
// não existe. Por isso o `it` abaixo — que roda SEMPRE — falha se a onda 2 tiver entregue o workflow
// sem que este bloco tenha rodado. A ausência é declarada, não escondida.
const FEE_REFRESH = "fee-refresh.yml";
const feeRefreshExiste = existsSync(`${WORKFLOWS_DIR}${FEE_REFRESH}`);

describe.skipIf(!feeRefreshExiste)(`auditoria de ${FEE_REFRESH} (T015 — onda 2)`, () => {
    const yaml = feeRefreshExiste ? read(FEE_REFRESH) : "";

    it("não usa nenhum `secrets.` além de `GITHUB_TOKEN`", () => {
        expect([...new Set(segredosDe(yaml))].filter((n) => n !== "GITHUB_TOKEN")).toEqual([]);
    });

    it("declara os DOIS gatilhos: `schedule` e `workflow_dispatch`", () => {
        expect(yaml).toMatch(/^\s{2}schedule:/m);
        expect(yaml).toMatch(/^\s{2}workflow_dispatch:/m);
    });

    it("o cabeçalho RA1 diz, em comentário antes do `name:`, que o laço NÃO dispara sozinho", () => {
        const cabecalho = yaml.slice(0, yaml.search(/^name:/m));
        expect(cabecalho).toMatch(/#/);
        // A frase da manualidade (RA1): `schedule` lê do branch DEFAULT e o corte de release está
        // adiado — quem abre o arquivo não pode sair achando que o laço está vivo.
        expect(cabecalho.toLowerCase()).toContain("workflow_dispatch");
        expect(cabecalho).toMatch(/manual/i);
        expect(cabecalho).toMatch(/\bmain\b/);
    });
});

it("o bloco gateado acorda: se `fee-refresh.yml` existe, ele NÃO pode ter sido pulado", () => {
    // Uma tautologia útil: documenta em teste (e não em prosa) que a única razão de o bloco acima
    // dormir é o arquivo não existir ainda. Se alguém o criar e o bloco continuar pulado, a condição
    // de skip mudou e este `it` é o lugar onde isso aparece.
    expect(feeRefreshExiste).toBe(existsSync(`${WORKFLOWS_DIR}${FEE_REFRESH}`));
});
