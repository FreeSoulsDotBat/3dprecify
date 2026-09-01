import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ROOT, sourceFiles, exists, read } from "./scan.ts";

// O guarda do `docs/PADRAO_DE_COMENTARIOS.md`. Sem ele, aquele documento é uma convenção, e
// convenção é lembrança: a explicação volta para dentro da linha no primeiro dia corrido.
//
// Ele afirma uma propriedade do REPOSITÓRIO — que os dois lados do link são verdade ao mesmo
// tempo — e por isso lê do disco com `fs` em vez de importar (mesmo molde do `workflow-audit`).

/**
 * `// @doc ADR-0031 §3 — resumo` · `# ⚠ @doc DEC-003 — resumo` · também dentro de JSDoc.
 *
 * `#:` entra junto: é a convenção Sphinx que o `backend/app/validation.py` usa para documentar
 * constante de módulo, e estender a gramática custa menos do que mudar a convenção de um arquivo
 * para caber num guarda. `{/*` idem, pelo JSX — e a falta dele era a mesma cegueira que o scanner
 * de densidade tinha: em JSX o comentário abre com `{` e o guarda não o via.
 */
const ANCHOR_GRAMMAR =
    /^\s*(?:\/\/|#:?|\{?\/\*+|\*)\s*(?:⚠\s*)?@doc\s+([A-Za-z0-9/-]+)(?:\s+§(.+?))?\s+—\s+(\S.*?)(?:\s*\*\/\}?)?\s*$/u;

const DEC_REGISTRY = "docs/decisoes-de-codigo.md";
const SOURCE_REGISTRY = "docs/fontes-verbatim.md";
const MAX_COLUMNS = 100; // o `printWidth` do prettier neste repositório

interface Anchor {
    file: string;
    line: number;
    text: string;
    id: string;
    section: string | undefined;
    gist: string;
}

const files = sourceFiles();

const anchors: Anchor[] = [];
const malformed: { file: string; line: number; text: string; reason: string }[] = [];

for (const file of files) {
    const lines = read(file).split("\n");
    lines.forEach((text, i) => {
        if (!text.includes("@doc")) return;
        const m = ANCHOR_GRAMMAR.exec(text);
        if (!m) {
            malformed.push({
                file,
                line: i + 1,
                text: text.trim(),
                reason: "não casa com `@doc <ID>[ §seção] — <gist>`",
            });
            return;
        }
        if (text.length > MAX_COLUMNS) {
            malformed.push({
                file,
                line: i + 1,
                text: text.trim(),
                reason: `${String(text.length)} colunas — o ceiling é ${String(MAX_COLUMNS)}`,
            });
            return;
        }
        anchors.push({
            file,
            line: i + 1,
            text,
            id: m[1] ?? "",
            section: m[2],
            gist: m[3] ?? "",
        });
    });
}

const adrFiles = readdirSync(`${ROOT}docs/adr`)
    .filter((f) => f.endsWith(".md"))
    .sort();

const decRegistry = exists(DEC_REGISTRY) ? read(DEC_REGISTRY) : "";
const sourceRegistry = exists(SOURCE_REGISTRY) ? read(SOURCE_REGISTRY) : "";

/** Resolve o ID de uma âncora para o texto do documento que ele endereça — ou `null` se não existe. */
function resolveId(id: string): { doc: string; text: string } | null {
    const adr = /^ADR-(\d{4})$/.exec(id);
    if (adr) {
        const name = adrFiles.find((f) => f.startsWith(`${adr[1] ?? ""}-`));
        return name ? { doc: `docs/adr/${name}`, text: read(`docs/adr/${name}`) } : null;
    }
    const dec = /^DEC-(\d{3})$/.exec(id);
    if (dec) {
        return decRegistry.includes(`## DEC-${dec[1] ?? ""}`)
            ? { doc: DEC_REGISTRY, text: decRegistry }
            : null;
    }
    const source = /^FONTE-(\d{3})$/.exec(id);
    if (source) {
        return sourceRegistry.includes(`## FONTE-${source[1] ?? ""}`)
            ? { doc: SOURCE_REGISTRY, text: sourceRegistry }
            : null;
    }
    // ID de spec: `013/FA-01`, `016/A3`, `009/T034` — resolve para o diretório do incremento.
    const spec = /^(\d{3})\//.exec(id);
    if (spec) {
        const dirs = readdirSync(`${ROOT}specs`);
        const dir = dirs.find((d) => d.startsWith(`${spec[1] ?? ""}-`));
        return dir ? { doc: `specs/${dir}`, text: "" } : null;
    }
    return null;
}

describe("âncoras `@doc` — os dois lados do link são verdade ao mesmo tempo", () => {
    it("há âncoras para auditar (senão tudo abaixo passaria por vacuidade)", () => {
        expect(files.length).toBeGreaterThan(100);
        expect(anchors.length).toBeGreaterThan(0);
    });

    it("1. toda âncora obedece à gramática e cabe em 100 colunas", () => {
        // É esta asserção que impede a âncora de voltar a virar parágrafo: quem escrever a segunda
        // linha de explicação não tem onde pendurar o `@doc`, e o teto de colunas recusa o resumo
        // que vira frase. O padrão volta a ser respeitado por construção, não por revisão.
        expect(malformed).toEqual([]);
    });

    it("2. nenhuma âncora morta — todo ID resolve para um documento existente", () => {
        const dead = anchors
            .filter((a) => resolveId(a.id) === null)
            .map((a) => `${a.file}:${String(a.line)} → ${a.id}`);
        expect(dead).toEqual([]);
    });

    it("2b. nenhuma seção morta — `§x` existe dentro do documento apontado", () => {
        const dead: string[] = [];
        for (const a of anchors) {
            if (a.section === undefined) continue;
            const target = resolveId(a.id);
            // Specs não têm text único (o ID endereça um diretório) — só ADR e DEC são conferidos.
            if (!target || target.text === "") continue;
            if (!target.text.includes(a.section)) {
                dead.push(`${a.file}:${String(a.line)} → ${a.id} §${a.section}`);
            }
        }
        expect(dead).toEqual([]);
    });

    it("3. nenhum DEC/FONTE órfão — todo verbete do registro é citado por algum ponto do código", () => {
        // Um verbete que ninguém cita documenta código que não existe mais. Ele sai do registro; não
        // fica como documentação de um lugar que o leitor vai procurar e não achar.
        const declared = [
            ...[...decRegistry.matchAll(/^## (DEC-\d{3})\b/gm)].map((m) => m[1] ?? ""),
            ...[...sourceRegistry.matchAll(/^## (FONTE-\d{3})\b/gm)].map((m) => m[1] ?? ""),
        ];
        expect(declared.length).toBeGreaterThan(0);
        const cited = new Set(anchors.map((a) => a.id));
        expect(declared.filter((d) => !cited.has(d))).toEqual([]);
    });
});

describe("ponteiros de volta — `## Onde isso vive no código`", () => {
    /** `- \`caminho/arquivo.ts\` → \`simbolo\`, \`outro\`` */
    const POINTER_LINE = /^-\s+`([^`]+)`\s*→\s*(.+)$/;

    const backPointers: { doc: string; file: string; symbols: string[] }[] = [];
    for (const doc of [...adrFiles.map((f) => `docs/adr/${f}`), DEC_REGISTRY, SOURCE_REGISTRY]) {
        if (!exists(doc)) continue;
        const lines = read(doc).split("\n");
        let inside = false;
        for (const line of lines) {
            if (/^#{2,3}\s/.test(line)) {
                inside = line.includes("Onde isso vive no código");
                continue;
            }
            if (!inside) continue;
            const m = POINTER_LINE.exec(line.trim());
            if (!m) continue;
            backPointers.push({
                doc,
                file: m[1] ?? "",
                symbols: [...(m[2] ?? "").matchAll(/`([^`]+)`/g)].map((s) => s[1] ?? ""),
            });
        }
    }

    it("há ponteiros para auditar", () => {
        expect(backPointers.length).toBeGreaterThan(0);
    });

    it("4. todo `arquivo → símbolo` ainda existe (por símbolo, nunca por linha)", () => {
        // Por que símbolo e não linha: a refatoração de legibilidade de 2026-08/09 moveu milhares de
        // linhas de lugar. Um número de linha teria morrido no primeiro commit; um símbolo sobrevive
        // a mudar de arquivo — e quando não sobrevive, é exatamente isso que este teste diz.
        const rotten: string[] = [];
        for (const p of backPointers) {
            if (!exists(p.file)) {
                rotten.push(`${p.doc}: o file \`${p.file}\` não exists mais`);
                continue;
            }
            const text = read(p.file);
            for (const s of p.symbols) {
                if (!text.includes(s)) {
                    rotten.push(`${p.doc}: \`${s}\` não exists mais em \`${p.file}\``);
                }
            }
        }
        expect(rotten).toEqual([]);
    });
});
