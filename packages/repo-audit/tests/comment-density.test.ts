import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RAIZ, arquivosDeCodigo, ler, medir } from "./scan.ts";

// A catraca do `docs/PADRAO_DE_COMENTARIOS.md` §8 — o que impede a recaída sem exigir big-bang.
//
// Prende duas coisas, e cada uma por um motivo diferente:
//
//   • `maiorBloco` POR ARQUIVO, estrito. É a métrica de "parágrafo dentro do código", que é o
//     problema que o padrão existe para resolver. Nenhum arquivo pode piorar; descer é sempre
//     permitido. Arquivo NOVO nasce sob o teto do padrão (3 linhas, o limite da armadilha `⚠`),
//     sem precisar entrar na linha de base primeiro.
//
//   • A densidade TOTAL do repositório, um número só. Ela existe para dar folga local: acrescentar
//     uma âncora de uma linha num arquivo não pode deixar o portão vermelho, mas uma volta geral
//     da explicação para dentro das linhas, sim.
//
// Para reescrever a linha de base depois de uma rodada de migração:
//   ATUALIZAR_BASELINE=1 pnpm --filter @3dprecify/repo-audit test

const CAMINHO = "packages/repo-audit/comment-density.baseline.json";
// O teto do arquivo NOVO não é o tamanho da âncora (1 linha, 3 quando armadilha) — é a fronteira
// entre CONTRATO e DECISÃO. Um JSDoc de até 6 linhas descrevendo o que a função recebe, devolve e
// recusa é contrato, e contrato pertence ao cursor. Passou disso, é explicação: vai para o
// documento. Medido em 2026-09-01, depois da migração dos maiores blocos: 365 blocos de 4–5 linhas
// no repositório são exatamente esse contrato legítimo, e reprová-los ensinaria a driblar o guarda.
const TETO_ARQUIVO_NOVO = 6;

interface LinhaDeBase {
    gerado: string;
    totalComentarios: number;
    totalLinhas: number;
    arquivos: Record<string, number>;
}

const atual = (() => {
    const arquivos: Record<string, number> = {};
    let totalComentarios = 0;
    let totalLinhas = 0;
    for (const arquivo of arquivosDeCodigo()) {
        const m = medir(ler(arquivo));
        arquivos[arquivo] = m.maiorBloco;
        totalComentarios += m.comentarios;
        totalLinhas += m.linhas;
    }
    return { arquivos, totalComentarios, totalLinhas };
})();

if (process.env["ATUALIZAR_BASELINE"] === "1") {
    const nova: LinhaDeBase = {
        gerado: new Date().toISOString().slice(0, 10),
        totalComentarios: atual.totalComentarios,
        totalLinhas: atual.totalLinhas,
        arquivos: atual.arquivos,
    };
    writeFileSync(`${RAIZ}${CAMINHO}`, `${JSON.stringify(nova, null, 4)}\n`, "utf8");
}

const base = JSON.parse(ler(CAMINHO)) as LinhaDeBase;

describe("catraca de densidade — a explicação não volta para dentro da linha", () => {
    it("há arquivos na linha de base (senão as asserções passariam por vacuidade)", () => {
        expect(Object.keys(base.arquivos).length).toBeGreaterThan(100);
        expect(base.totalLinhas).toBeGreaterThan(0);
    });

    it("nenhum arquivo cresceu em bloco de comentário", () => {
        const piores: string[] = [];
        for (const [arquivo, bloco] of Object.entries(atual.arquivos)) {
            const teto = base.arquivos[arquivo] ?? TETO_ARQUIVO_NOVO;
            if (bloco > teto) {
                piores.push(
                    `${arquivo}: maior bloco ${String(bloco)} linhas — o teto dele é ${String(teto)}`,
                );
            }
        }
        expect(piores).toEqual([]);
    });

    it("a densidade total do repositório não subiu", () => {
        const antes = base.totalComentarios / base.totalLinhas;
        const agora = atual.totalComentarios / atual.totalLinhas;
        expect(agora).toBeLessThanOrEqual(antes);
    });
});
