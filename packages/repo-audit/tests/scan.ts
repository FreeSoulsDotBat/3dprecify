import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** A raiz do repositório, a partir deste arquivo (`packages/repo-audit/tests/`). */
export const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));

/** As árvores de código de produção auditadas. Testes e código gerado ficam de fora. */
const ARVORES = [
    "apps/web/src",
    "packages/pricing-core/src",
    "packages/fee-ingest/src",
    "backend/app",
];

const EXTENSOES = [".ts", ".tsx", ".py"];

function ehTeste(caminho: string): boolean {
    const arquivo = caminho.split("/").pop() ?? "";
    return (
        arquivo.includes(".test.") ||
        arquivo.startsWith("test_") ||
        arquivo.endsWith(".test-helper.ts") ||
        // Cliente Orval: gerado, nunca escrito à mão (mesma isenção da cobertura na raiz).
        caminho.endsWith("shared/api/generated.ts")
    );
}

function caminhar(dirAbs: string, prefixo: string, saida: string[]): void {
    for (const entrada of readdirSync(dirAbs)) {
        if (entrada === "__pycache__" || entrada === "node_modules") continue;
        const abs = `${dirAbs}/${entrada}`;
        const rel = `${prefixo}/${entrada}`;
        if (statSync(abs).isDirectory()) caminhar(abs, rel, saida);
        else if (EXTENSOES.some((e) => entrada.endsWith(e)) && !ehTeste(rel)) saida.push(rel);
    }
}

/** Todo arquivo de código de produção do repositório, em caminho relativo à raiz, ordenado. */
export function arquivosDeCodigo(): string[] {
    const saida: string[] = [];
    for (const arvore of ARVORES) caminhar(`${RAIZ}${arvore}`, arvore, saida);
    return saida.sort();
}

export function ler(rel: string): string {
    return readFileSync(`${RAIZ}${rel}`, "utf8");
}

export function existe(rel: string): boolean {
    try {
        statSync(`${RAIZ}${rel}`);
        return true;
    } catch {
        return false;
    }
}

/** Uma linha é comentário quando começa por `//`, `#`, `/*` ou a continuação `*` de um bloco. */
export function ehComentario(linha: string): boolean {
    return /^\s*(?:\/\/|#|\/\*|\*(?!\/)|\*\/)/.test(linha);
}

/** Linha de comentário que só carrega o delimitador de bloco, sem prosa nenhuma dentro dela. */
function ehDelimitador(linha: string): boolean {
    return /^\s*(?:\/\*+|\*\/|\*|\/\/)\s*$/.test(linha);
}

export interface MetricaDeArquivo {
    /** Linhas de comentário, delimitadores incluídos — a métrica de densidade. */
    comentarios: number;
    /** Linhas totais. */
    linhas: number;
    /**
     * O maior bloco de linhas CONSECUTIVAS de prosa comentada — é o que mede "parágrafo no código".
     * Delimitadores e linhas em branco de JSDoc não contam: o que se quer limitar é a explicação,
     * não a moldura dela.
     */
    maiorBloco: number;
    /**
     * Quantos blocos de 3+ linhas de prosa o arquivo tem. Esta é a métrica que FALTAVA, e a falta
     * custou caro: prender só o `maiorBloco` deixou passar um arquivo com DEZESSETE blocos de 3 a 7
     * linhas (`calcular-page.tsx`, apontado pelo dono em 2026-09-01) enquanto a varredura o dava por
     * limpo. Explicação não se mede pelo pico; mede-se pela quantidade.
     */
    blocosDeTres: number;
}

export function medir(conteudo: string): MetricaDeArquivo {
    const linhas = conteudo.split("\n");
    let comentarios = 0;
    let maiorBloco = 0;
    let blocosDeTres = 0;
    let corrente = 0;
    const fecharBloco = () => {
        if (corrente >= 3) blocosDeTres++;
        corrente = 0;
    };
    for (const linha of linhas) {
        if (!ehComentario(linha)) {
            fecharBloco();
            continue;
        }
        comentarios++;
        if (ehDelimitador(linha)) continue;
        corrente++;
        if (corrente > maiorBloco) maiorBloco = corrente;
    }
    fecharBloco();
    return { comentarios, linhas: linhas.length, maiorBloco, blocosDeTres };
}
