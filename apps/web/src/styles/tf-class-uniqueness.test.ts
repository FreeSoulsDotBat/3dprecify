import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// 019/PR-A (ADR-0032 §5) — UMA classe `tf-*`, UM arquivo.
//
// O defeito que esta guarda impede já aconteceu sozinho: `tf-alert--compact` nasceu local em
// `features/calculator/shopee-warnings.css` com uma geometria, e a folha do design a redefiniu com
// outra. Duas definições do mesmo nome divergem em silêncio — nenhuma tela mostra as duas juntas,
// e a que vence depende da ordem de import. A regra do porte é "variante entra no .css do primitivo
// que já existe" (research §A), e esta guarda é o que torna a regra estrutural em vez de disciplinar.
//
// Não-vacuidade: no dia em que foi escrita (2026-08-27) ela ficou VERMELHA por um caso que ninguém
// tinha visto — `tf-grafismo` definido em `styles/base.css` (cor, pointer-events) E em
// `shared/ui/grafismo.css` (geometria, máscara): duas casas para um nome, de propósito, e por isso
// invisível. `tf-alert--compact` NÃO a acende hoje (a versão da folha ainda mora em `docs/`, não em
// `src`) — ela protege a transição da T021: subir a variante ao DS sem apagar a local fica vermelho.
// O vermelho de hoje está em dod-evidence §V0 e some na T021 (o `tf-grafismo` se junta em um arquivo).

const SRC = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p, out);
        else if (p.endsWith(".css")) out.push(p);
    }
    return out;
}

/** Extrai os nomes `tf-*` DEFINIDOS num arquivo CSS.
 *
 *  Define = o seletor é um único composto SEM combinador (`.tf-alert.tf-alert--compact`,
 *  `.tf-btn:hover`) e TODAS as classes dele são `tf-*`. Não conta:
 *  (1) override contextual — `.escopo .tf-x`, `.tf-a > .tf-b` — é uma feature estilizando o
 *      primitivo dentro do próprio escopo;
 *  (2) composto com classe NÃO-tf — `.tf-badge.fee-seal` — é a variante que a feature possui.
 *  O que sobra é exatamente a classe de defeito: a BASE de um primitivo (ou de um modificador dele)
 *  escrita de novo fora do arquivo dono. */
function definedTfClasses(css: string): Set<string> {
    const semComentario = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const found = new Set<string>();
    const re = /([^{}]+)\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(semComentario))) {
        const sel = m[1].trim();
        if (sel.startsWith("@") || sel === "") continue;
        for (const raw of sel.split(",")) {
            const part = raw.trim();
            if (/[\s>+~]/.test(part)) continue; // combinador ⇒ override contextual, não definição
            const semPseudo = part
                .replace(/::?[a-z-]+(\([^)]*\))?/gi, "")
                .replace(/\[[^\]]*\]/g, "");
            const classes = semPseudo.match(/\.[a-z0-9_-]+/gi) ?? [];
            if (classes.length === 0 || classes.some((c) => !c.startsWith(".tf-"))) continue;
            for (const c of classes) found.add(c.slice(1));
        }
    }
    return found;
}

/** Dívida CONHECIDA e datada — a única forma de uma duplicata passar. Cada entrada precisa continuar
 *  duplicada de verdade (o 2º teste falha se a lista envelhecer), e some na task que a paga. Um vermelho
 *  permanente até a T021 derrubaria o `gate:all` no pre-push e no CI, e vermelho permanente ensina "roda
 *  de novo" (lição 014/US5); a lista mantém a guarda VIVA para qualquer duplicata nova desde já. */
const DIVIDA_CONHECIDA: ReadonlyMap<string, string> = new Map([
    // vazia desde 019/T021 (tf-grafismo juntado em shared/ui/grafismo.css) — mantenha vazia.
]);

function duplicatasDeSrc(): Map<string, string[]> {
    const owners = new Map<string, string[]>();
    for (const file of walk(SRC)) {
        const rel = relative(SRC, file).replace(/\\/g, "/");
        for (const cls of definedTfClasses(readFileSync(file, "utf8"))) {
            owners.set(cls, [...(owners.get(cls) ?? []), rel]);
        }
    }
    return new Map(
        [...owners.entries()]
            .filter(([, files]) => new Set(files).size > 1)
            .map(([cls, files]) => [cls, [...new Set(files)].sort()]),
    );
}

describe("019/ADR-0032 — uma classe tf-*, um arquivo", () => {
    it("nenhum nome tf-* é definido em dois arquivos de apps/web/src (fora a dívida declarada)", () => {
        const novas = [...duplicatasDeSrc().entries()]
            .filter(([cls]) => !DIVIDA_CONHECIDA.has(cls))
            .map(([cls, files]) => `${cls} → ${files.join(" × ")}`)
            .sort();
        expect(novas, `classes tf-* definidas em mais de um arquivo:\n${novas.join("\n")}`).toEqual(
            [],
        );
    });

    it("a dívida declarada ainda existe (uma entrada paga tem de sair da lista)", () => {
        const atuais = duplicatasDeSrc();
        for (const [cls, motivo] of DIVIDA_CONHECIDA) {
            expect(
                atuais.has(cls),
                `"${cls}" não está mais duplicada — remova-a de DIVIDA_CONHECIDA (${motivo})`,
            ).toBe(true);
        }
    });

    it("o extrator conta definições, não overrides (prova de que o vermelho é o certo)", () => {
        const css = `
      .tf-alert { a: 1 }
      .tf-alert.tf-alert--compact { b: 2 }
      .tf-btn:hover, .tf-btn:focus-visible { c: 3 }
      .assembly .tf-price { d: 4 }
      .tf-catalog-head > .tf-page-header { e: 5 }
      .tf-badge.fee-seal { f: 6 }
      .tf-input[disabled] { g: 7 }
      @media (min-width: 1280px) { .tf-shell { h: 8 } }
      /* .tf-comentado { i: 9 } */
    `;
        expect([...definedTfClasses(css)].sort()).toEqual([
            "tf-alert",
            "tf-alert--compact",
            "tf-btn",
            "tf-input",
            "tf-shell",
        ]);
    });
});
