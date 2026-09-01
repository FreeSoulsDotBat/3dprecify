import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { RAIZ, arquivosDeCodigo, existe, ler } from "./scan.ts";

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
const GRAMATICA =
    /^\s*(?:\/\/|#:?|\{?\/\*+|\*)\s*(?:⚠\s*)?@doc\s+([A-Za-z0-9/-]+)(?:\s+§(.+?))?\s+—\s+(\S.*?)(?:\s*\*\/\}?)?\s*$/u;

const REGISTRO_DEC = "docs/decisoes-de-codigo.md";
const REGISTRO_FONTE = "docs/fontes-verbatim.md";
const LARGURA_MAXIMA = 100; // o `printWidth` do prettier neste repositório

interface Ancora {
    arquivo: string;
    linha: number;
    texto: string;
    id: string;
    secao: string | undefined;
    resumo: string;
}

const arquivos = arquivosDeCodigo();

const ancoras: Ancora[] = [];
const malformadas: { arquivo: string; linha: number; texto: string; motivo: string }[] = [];

for (const arquivo of arquivos) {
    const linhas = ler(arquivo).split("\n");
    linhas.forEach((texto, i) => {
        if (!texto.includes("@doc")) return;
        const m = GRAMATICA.exec(texto);
        if (!m) {
            malformadas.push({
                arquivo,
                linha: i + 1,
                texto: texto.trim(),
                motivo: "não casa com `@doc <ID>[ §seção] — <resumo>`",
            });
            return;
        }
        if (texto.length > LARGURA_MAXIMA) {
            malformadas.push({
                arquivo,
                linha: i + 1,
                texto: texto.trim(),
                motivo: `${String(texto.length)} colunas — o teto é ${String(LARGURA_MAXIMA)}`,
            });
            return;
        }
        ancoras.push({
            arquivo,
            linha: i + 1,
            texto,
            id: m[1] ?? "",
            secao: m[2],
            resumo: m[3] ?? "",
        });
    });
}

const arquivosAdr = readdirSync(`${RAIZ}docs/adr`)
    .filter((f) => f.endsWith(".md"))
    .sort();

const registro = existe(REGISTRO_DEC) ? ler(REGISTRO_DEC) : "";
const registroFonte = existe(REGISTRO_FONTE) ? ler(REGISTRO_FONTE) : "";

/** Resolve o ID de uma âncora para o texto do documento que ele endereça — ou `null` se não existe. */
function resolver(id: string): { doc: string; texto: string } | null {
    const adr = /^ADR-(\d{4})$/.exec(id);
    if (adr) {
        const nome = arquivosAdr.find((f) => f.startsWith(`${adr[1] ?? ""}-`));
        return nome ? { doc: `docs/adr/${nome}`, texto: ler(`docs/adr/${nome}`) } : null;
    }
    const dec = /^DEC-(\d{3})$/.exec(id);
    if (dec) {
        return registro.includes(`## DEC-${dec[1] ?? ""}`)
            ? { doc: REGISTRO_DEC, texto: registro }
            : null;
    }
    const fonte = /^FONTE-(\d{3})$/.exec(id);
    if (fonte) {
        return registroFonte.includes(`## FONTE-${fonte[1] ?? ""}`)
            ? { doc: REGISTRO_FONTE, texto: registroFonte }
            : null;
    }
    // ID de spec: `013/FA-01`, `016/A3`, `009/T034` — resolve para o diretório do incremento.
    const spec = /^(\d{3})\//.exec(id);
    if (spec) {
        const dirs = readdirSync(`${RAIZ}specs`);
        const dir = dirs.find((d) => d.startsWith(`${spec[1] ?? ""}-`));
        return dir ? { doc: `specs/${dir}`, texto: "" } : null;
    }
    return null;
}

describe("âncoras `@doc` — os dois lados do link são verdade ao mesmo tempo", () => {
    it("há âncoras para auditar (senão tudo abaixo passaria por vacuidade)", () => {
        expect(arquivos.length).toBeGreaterThan(100);
        expect(ancoras.length).toBeGreaterThan(0);
    });

    it("1. toda âncora obedece à gramática e cabe em 100 colunas", () => {
        // É esta asserção que impede a âncora de voltar a virar parágrafo: quem escrever a segunda
        // linha de explicação não tem onde pendurar o `@doc`, e o teto de colunas recusa o resumo
        // que vira frase. O padrão volta a ser respeitado por construção, não por revisão.
        expect(malformadas).toEqual([]);
    });

    it("2. nenhuma âncora morta — todo ID resolve para um documento existente", () => {
        const mortas = ancoras
            .filter((a) => resolver(a.id) === null)
            .map((a) => `${a.arquivo}:${String(a.linha)} → ${a.id}`);
        expect(mortas).toEqual([]);
    });

    it("2b. nenhuma seção morta — `§x` existe dentro do documento apontado", () => {
        const mortas: string[] = [];
        for (const a of ancoras) {
            if (a.secao === undefined) continue;
            const alvo = resolver(a.id);
            // Specs não têm texto único (o ID endereça um diretório) — só ADR e DEC são conferidos.
            if (!alvo || alvo.texto === "") continue;
            if (!alvo.texto.includes(a.secao)) {
                mortas.push(`${a.arquivo}:${String(a.linha)} → ${a.id} §${a.secao}`);
            }
        }
        expect(mortas).toEqual([]);
    });

    it("3. nenhum DEC/FONTE órfão — todo verbete do registro é citado por algum ponto do código", () => {
        // Um verbete que ninguém cita documenta código que não existe mais. Ele some do registro; não
        // fica como documentação de um lugar que o leitor vai procurar e não achar.
        const declarados = [
            ...[...registro.matchAll(/^## (DEC-\d{3})\b/gm)].map((m) => m[1] ?? ""),
            ...[...registroFonte.matchAll(/^## (FONTE-\d{3})\b/gm)].map((m) => m[1] ?? ""),
        ];
        expect(declarados.length).toBeGreaterThan(0);
        const citados = new Set(ancoras.map((a) => a.id));
        expect(declarados.filter((d) => !citados.has(d))).toEqual([]);
    });
});

describe("ponteiros de volta — `## Onde isso vive no código`", () => {
    /** `- \`caminho/arquivo.ts\` → \`simbolo\`, \`outro\`` */
    const LINHA = /^-\s+`([^`]+)`\s*→\s*(.+)$/;

    const ponteiros: { doc: string; arquivo: string; simbolos: string[] }[] = [];
    for (const doc of [...arquivosAdr.map((f) => `docs/adr/${f}`), REGISTRO_DEC, REGISTRO_FONTE]) {
        if (!existe(doc)) continue;
        const linhas = ler(doc).split("\n");
        let dentro = false;
        for (const linha of linhas) {
            if (/^#{2,3}\s/.test(linha)) {
                dentro = linha.includes("Onde isso vive no código");
                continue;
            }
            if (!dentro) continue;
            const m = LINHA.exec(linha.trim());
            if (!m) continue;
            ponteiros.push({
                doc,
                arquivo: m[1] ?? "",
                simbolos: [...(m[2] ?? "").matchAll(/`([^`]+)`/g)].map((s) => s[1] ?? ""),
            });
        }
    }

    it("há ponteiros para auditar", () => {
        expect(ponteiros.length).toBeGreaterThan(0);
    });

    it("4. todo `arquivo → símbolo` ainda existe (por símbolo, nunca por linha)", () => {
        // Por que símbolo e não linha: a refatoração de legibilidade de 2026-08/09 moveu milhares de
        // linhas de lugar. Um número de linha teria morrido no primeiro commit; um símbolo sobrevive
        // a mudar de arquivo — e quando não sobrevive, é exatamente isso que este teste diz.
        const podres: string[] = [];
        for (const p of ponteiros) {
            if (!existe(p.arquivo)) {
                podres.push(`${p.doc}: o arquivo \`${p.arquivo}\` não existe mais`);
                continue;
            }
            const texto = ler(p.arquivo);
            for (const s of p.simbolos) {
                if (!texto.includes(s)) {
                    podres.push(`${p.doc}: \`${s}\` não existe mais em \`${p.arquivo}\``);
                }
            }
        }
        expect(podres).toEqual([]);
    });
});
