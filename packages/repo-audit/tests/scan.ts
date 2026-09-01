import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** A raiz do repositório, a partir deste arquivo (`packages/repo-audit/tests/`). */
export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** As árvores de código de produção auditadas. Testes e código gerado ficam de fora. */
const TREES = [
    "apps/web/src",
    "packages/pricing-core/src",
    "packages/fee-ingest/src",
    "backend/app",
];

const EXTENSIONS = [".ts", ".tsx", ".py"];

function isTestFile(path: string): boolean {
    const file = path.split("/").pop() ?? "";
    return (
        file.includes(".test.") ||
        file.startsWith("test_") ||
        file.endsWith(".test-helper.ts") ||
        // Cliente Orval: gerado, nunca escrito à mão (mesma isenção da cobertura na raiz).
        path.endsWith("shared/api/generated.ts")
    );
}

function walk(absDir: string, prefix: string, out: string[]): void {
    for (const entry of readdirSync(absDir)) {
        if (entry === "__pycache__" || entry === "node_modules") continue;
        const abs = `${absDir}/${entry}`;
        const rel = `${prefix}/${entry}`;
        if (statSync(abs).isDirectory()) walk(abs, rel, out);
        else if (EXTENSIONS.some((e) => entry.endsWith(e)) && !isTestFile(rel)) out.push(rel);
    }
}

/** Todo arquivo de código de produção do repositório, em caminho relativo à raiz, ordenado. */
export function sourceFiles(): string[] {
    const out: string[] = [];
    for (const tree of TREES) walk(`${ROOT}${tree}`, tree, out);
    return out.sort();
}

export function read(rel: string): string {
    return readFileSync(`${ROOT}${rel}`, "utf8");
}

export function exists(rel: string): boolean {
    try {
        statSync(`${ROOT}${rel}`);
        return true;
    } catch {
        return false;
    }
}

/** Comentário de UMA linha: `//`, `#`, ou um bloco que abre e fecha nela mesma. */
function isLineComment(line: string): boolean {
    const t = line.trim();
    return t.startsWith("//") || t.startsWith("#") || /^\{?\/\*.*\*\/\}?$/.test(t);
}

/** Abre um comentário de bloco — inclusive o do JSX, que começa com `{` — sem fechá-lo na linha. */
function opensBlock(line: string): boolean {
    const t = line.trim();
    return (t.startsWith("/*") || t.startsWith("{/*")) && !t.includes("*/");
}

function closesBlock(line: string): boolean {
    return line.includes("*/");
}

/**
 * Linha de comentário que só carrega o delimitador, sem prosa nenhuma dentro dela.
 *
 * Os delimitadores do JSX entram na lista: lá o texto costuma começar na MESMA linha do abridor,
 * então nem sempre existe uma linha só de delimitador — mas quando existe, ela não é prosa.
 */
function isDelimiterOnly(line: string): boolean {
    return /^\s*\{?(?:\/\*+|\*\/|\*|\/\/)\}?\s*$/.test(line);
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
export function markComments(source: string): boolean[] {
    const lines = source.split("\n");
    const marks: boolean[] = [];
    let inside = false;
    for (const line of lines) {
        if (inside) {
            marks.push(true);
            if (closesBlock(line)) inside = false;
            continue;
        }
        if (opensBlock(line)) {
            marks.push(true);
            inside = true;
            continue;
        }
        marks.push(isLineComment(line));
    }
    return marks;
}

/** Compatibilidade com quem só tem UMA linha em mãos (sem contexto de bloco). */
export function isComment(line: string): boolean {
    return isLineComment(line) || opensBlock(line) || /^\s*\*/.test(line);
}

export interface FileMetrics {
    /** Linhas de comentário, delimitadores incluídos — a métrica de densidade. */
    comments: number;
    /** Linhas totais. */
    lines: number;
    /**
     * O maior bloco de linhas CONSECUTIVAS de prosa comentada — é o que mede "parágrafo no código".
     * Delimitadores e linhas em branco de JSDoc não contam: o que se quer limitar é a explicação,
     * não a moldura dela.
     */
    longestBlock: number;
    /**
     * Quantos blocos de 3+ linhas de prosa o arquivo tem. Esta é a métrica que FALTAVA, e a falta
     * custou caro: prender só o `longestBlock` deixou passar um arquivo com DEZESSETE blocos de 3 a 7
     * linhas (`calcular-page.tsx`, apontado pelo dono em 2026-09-01) enquanto a varredura o dava por
     * limpo. Explicação não se mede pelo pico; mede-se pela quantidade.
     */
    proseBlocks: number;
}

export function measure(source: string): FileMetrics {
    const lines = source.split("\n");
    const marks = markComments(source);
    let comments = 0;
    let longestBlock = 0;
    let proseBlocks = 0;
    let run = 0;
    const endRun = () => {
        if (run >= 3) proseBlocks++;
        run = 0;
    };
    lines.forEach((line, i) => {
        if (marks[i] !== true) {
            endRun();
            return;
        }
        comments++;
        if (isDelimiterOnly(line)) return;
        run++;
        if (run > longestBlock) longestBlock = run;
    });
    endRun();
    return { comments, lines: lines.length, longestBlock, proseBlocks };
}
