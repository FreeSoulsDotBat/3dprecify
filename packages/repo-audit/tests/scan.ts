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

/** Linha de comentário de UMA linha: `//`, `#`, ou um bloco que abre e fecha nela mesma. */
function ehComentarioDeLinha(linha: string): boolean {
    const t = linha.trim();
    return t.startsWith("//") || t.startsWith("#") || /^\{?\/\*.*\*\/\}?$/.test(t);
}

/** Abre um comentário de bloco — inclusive o do JSX, que começa com `{` — sem fechá-lo na linha. */
function abreBloco(linha: string): boolean {
    const t = linha.trim();
    return (t.startsWith("/*") || t.startsWith("{/*")) && !t.includes("*/");
}

function fechaBloco(linha: string): boolean {
    return linha.includes("*/");
}

/**
 * Linha de comentário que só carrega o delimitador, sem prosa nenhuma dentro dela.
 *
 * Os delimitadores do JSX entram na lista: lá o texto costuma começar na MESMA linha do abridor,
 * então nem sempre existe uma linha só de delimitador — mas quando existe, ela não é prosa.
 */
function ehDelimitador(linha: string): boolean {
    return /^\s*\{?(?:\/\*+|\*\/|\*|\/\/)\}?\s*$/.test(linha);
}

/**
 * Uma linha conta como comentário.
 *
 * O scanner tem ESTADO de propósito: em JSX as linhas de continuação de um comentário não carregam
 * marcador NENHUM, e um casador por prefixo é cego para elas — foi assim que 14 linhas escaparam da
 * varredura no `calcular-page.tsx` (achado do dono, 2026-09-01). Só se reconhece um bloco cujo
 * abridor está no INÍCIO da linha, nunca no meio, para não confundir o `//` de uma URL dentro de uma
 * string com um comentário.
 */
export function marcarComentarios(conteudo: string): boolean[] {
    const linhas = conteudo.split("\n");
    const marcas: boolean[] = [];
    let dentro = false;
    for (const linha of linhas) {
        if (dentro) {
            marcas.push(true);
            if (fechaBloco(linha)) dentro = false;
            continue;
        }
        if (abreBloco(linha)) {
            marcas.push(true);
            dentro = true;
            continue;
        }
        marcas.push(ehComentarioDeLinha(linha));
    }
    return marcas;
}

/** Compatibilidade com quem só tem UMA linha em mãos (sem contexto de bloco). */
export function ehComentario(linha: string): boolean {
    return ehComentarioDeLinha(linha) || abreBloco(linha) || /^\s*\*/.test(linha);
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
    const marcas = marcarComentarios(conteudo);
    let comentarios = 0;
    let maiorBloco = 0;
    let blocosDeTres = 0;
    let corrente = 0;
    const fecharBloco = () => {
        if (corrente >= 3) blocosDeTres++;
        corrente = 0;
    };
    linhas.forEach((linha, i) => {
        if (marcas[i] !== true) {
            fecharBloco();
            return;
        }
        comentarios++;
        if (ehDelimitador(linha)) return;
        corrente++;
        if (corrente > maiorBloco) maiorBloco = corrente;
    });
    fecharBloco();
    return { comentarios, linhas: linhas.length, maiorBloco, blocosDeTres };
}
