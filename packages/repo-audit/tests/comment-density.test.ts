import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ROOT, sourceFiles, read, measure } from "./scan.ts";

// A catraca do `docs/PADRAO_DE_COMENTARIOS.md` §8 — o que impede a recaída sem exigir big-bang.
//
// Prende três coisas, e cada uma por um motivo diferente:
//
//   • `proseBlocks` POR ARQUIVO, estrito. Quantos blocos de 3+ linhas de prosa o arquivo tem. É a
//     métrica que mede EXPLICAÇÃO, e ela entrou depois de custar caro: prender só o pico deixou o
//     `calcular-page.tsx` passar por limpo com DEZESSETE blocos de 3 a 7 linhas (achado do dono,
//     2026-09-01). Explicação não se mede pelo pico; mede-se pela quantidade.
//
//   • `longestBlock` POR ARQUIVO, estrito. O pico continua preso — ele é o que pega o parágrafo único
//     e enorme, que a contagem sozinha não distingue de três blocos curtos.
//
//   • O TOTAL de linhas de comentário do repositório — número ABSOLUTO, nunca razão. Ele dá folga
//     local (uma âncora de uma linha a mais não derruba o portão) sem permitir uma volta geral.
//
//     Era uma RAZÃO, e a razão mentia: nesta mesma frente, de-duplicar código derrubou 124 linhas
//     totais e 2 comentários — e a razão SUBIU, acusando uma recaída que não existiu. Um denominador
//     que encolhe não é explicação que cresce.
//
// Arquivo NOVO nasce sob o teto do padrão, sem precisar entrar na linha de base primeiro.
//
// Para reescrever a linha de base depois de uma rodada de migração:
//   ATUALIZAR_BASELINE=1 pnpm --filter @3dprecify/repo-audit test

const BASELINE_PATH = "packages/repo-audit/comment-density.baseline.json";

// O teto do arquivo NOVO não é o tamanho da âncora (1 linha, 3 quando é armadilha) — é a fronteira
// entre CONTRATO e DECISÃO. Um JSDoc de até 6 linhas descrevendo o que a função recebe, devolve e
// recusa é contrato, e contrato pertence ao cursor. Passou disso, é explicação: vai para o
// documento. Medido em 2026-09-01, depois da migração dos maiores blocos: 365 blocos de 4–5 linhas
// no repositório são exatamente esse contrato legítimo, e reprová-los ensinaria a driblar o guarda.
const NEW_FILE_BLOCK_CEILING = 6;

// Quantos blocos de 3+ linhas um arquivo NOVO pode ter. Quatro cabe um módulo bem documentado por
// contrato; a partir daí é explicação, e explicação tem documento.
const NEW_FILE_PROSE_CEILING = 4;

interface BaselineMetrics {
    longestBlock: number;
    proseBlocks: number;
}

interface Baseline {
    generatedAt: string;
    totalComments: number;
    totalLines: number;
    files: Record<string, BaselineMetrics>;
}

const current = (() => {
    const files: Record<string, BaselineMetrics> = {};
    let totalComments = 0;
    let totalLines = 0;
    for (const file of sourceFiles()) {
        const m = measure(read(file));
        files[file] = { longestBlock: m.longestBlock, proseBlocks: m.proseBlocks };
        totalComments += m.comments;
        totalLines += m.lines;
    }
    return { files, totalComments, totalLines };
})();

if (process.env["ATUALIZAR_BASELINE"] === "1") {
    const next: Baseline = {
        generatedAt: new Date().toISOString().slice(0, 10),
        totalComments: current.totalComments,
        totalLines: current.totalLines,
        files: current.files,
    };
    writeFileSync(`${ROOT}${BASELINE_PATH}`, `${JSON.stringify(next, null, 4)}\n`, "utf8");
}

const baseline = JSON.parse(read(BASELINE_PATH)) as Baseline;

describe("catraca de densidade — a explicação não volta para dentro da linha", () => {
    it("há arquivos na linha de base (senão as asserções passariam por vacuidade)", () => {
        expect(Object.keys(baseline.files).length).toBeGreaterThan(100);
        expect(baseline.totalLines).toBeGreaterThan(0);
    });

    it("nenhum arquivo ganhou BLOCOS de explicação", () => {
        const worse: string[] = [];
        for (const [file, m] of Object.entries(current.files)) {
            const ceiling = baseline.files[file]?.proseBlocks ?? NEW_FILE_PROSE_CEILING;
            if (m.proseBlocks > ceiling) {
                worse.push(
                    `${file}: ${String(m.proseBlocks)} blocos de 3+ linhas — o teto dele é ${String(ceiling)}`,
                );
            }
        }
        expect(worse).toEqual([]);
    });

    it("nenhum arquivo cresceu no MAIOR bloco de comentário", () => {
        const worse: string[] = [];
        for (const [file, m] of Object.entries(current.files)) {
            const ceiling = baseline.files[file]?.longestBlock ?? NEW_FILE_BLOCK_CEILING;
            if (m.longestBlock > ceiling) {
                worse.push(
                    `${file}: maior bloco ${String(m.longestBlock)} linhas — o teto dele é ${String(ceiling)}`,
                );
            }
        }
        expect(worse).toEqual([]);
    });

    it("o total de linhas de comentário do repositório não subiu", () => {
        // ABSOLUTO, não razão: encolher o código não pode ser lido como escrever explicação.
        expect(current.totalComments).toBeLessThanOrEqual(baseline.totalComments);
    });
});
