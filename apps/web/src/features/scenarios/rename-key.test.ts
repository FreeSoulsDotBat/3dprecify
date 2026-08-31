// 019/PR-F — T091 (D2, ANTI-REGRESSÃO). A prancheta 30b diz: "as duas folhas de renomear leem o
// mesmo título e o mesmo rótulo… se divergirem, vão divergir em silêncio" — um dev editando a
// folha de `scenarios-list-sheet.tsx` (a lista) não tem motivo para abrir
// `scenario-context-bar.tsx` (a barra do item aberto) na mesma revisão, e vice-versa.
//
// Não há defeito hoje: medido em 2026-08-29 (e antes, em 27/08) que `scenarios-list-sheet.tsx:413`
// e `scenario-context-bar.tsx:233` leem `t.renameSheetTitle`, e `:150`/`:205` leem `t.rename`, do
// MESMO módulo `@/shared/i18n/messages.pt-br`. Este teste fixa esse fato por REFERÊNCIA DE CHAVE
// (leitura do texto-fonte, não do DOM renderizado) para que uma bifurcação futura — um dos dois
// arquivos passando a ler uma chave nova/local em vez da compartilhada — vire vermelho aqui, sem
// depender de alguém lembrar de revisar o outro arquivo.
//
// Por que readFileSync + regex, e não renderizar os dois componentes: os dois hosts têm árvores de
// dependência pesadas (TanStack Query, sheets Radix, `useEntitlement`, `useScenarios`) — montá-los
// só para comparar duas strings estáticas seria caro e frágil (qualquer mock que faltasse quebraria
// um teste que não é sobre render). A REFERÊNCIA DE CHAVE no código-fonte é a garantia mais barata
// e mais direta do que a task pede: "leem a MESMA chave", não "renderizam o mesmo texto hoje".
//
// Prova por mutação (registrada): troquei manualmente `scenario-context-bar.tsx:233` de
// `t.renameSheetTitle` para `t.rename` (uma bifurcação real — lendo uma chave DIFERENTE, mas ainda
// existente, então nenhum outro teste do arquivo detectaria isso) e rodei
// `pnpm exec vitest run src/features/scenarios/rename-key.test.ts` — RED (1 teste falhou,
// "SheetTitle usa a mesma chave t.renameSheetTitle nos dois arquivos"). Revertido antes de commitar.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const LIST_SHEET_PATH = join(__dirname, "scenarios-list-sheet.tsx");
const CONTEXT_BAR_PATH = join(__dirname, "scenario-context-bar.tsx");

const listSheetSource = readFileSync(LIST_SHEET_PATH, "utf-8");
const contextBarSource = readFileSync(CONTEXT_BAR_PATH, "utf-8");

/** Extrai a chave `t.<algo>` dentro de um `<SheetTitle>{...}</SheetTitle>` — a folha de renomear
 * de cada arquivo é o ÚNICO `SheetTitle` cujo conteúdo é uma referência de mensagem simples
 * (sem template literal), então o regex não precisa desambiguar entre vários `SheetTitle`. */
function extractSheetTitleKey(source: string): string | null {
    const match = /<SheetTitle>\{t\.(\w+)\}<\/SheetTitle>/.exec(source);
    return match ? match[1] : null;
}

/** Extrai TODAS as ocorrências de `t.rename` (sem sufixo — distingue de `t.renameSheetTitle`) que
 * aparecem como rótulo/label de ação (aria-label ou filho de texto), não a chave do título. */
function countRenameActionLabelUses(source: string): number {
    const matches = source.match(/\bt\.rename\b(?!SheetTitle)/g);
    return matches ? matches.length : 0;
}

describe("019/PR-F T091 (D2) — as duas folhas de renomear leem a MESMA chave (anti-regressão)", () => {
    it("scenarios-list-sheet.tsx importa do módulo compartilhado de i18n", () => {
        expect(listSheetSource).toContain('from "@/shared/i18n/messages.pt-br"');
    });

    it("scenario-context-bar.tsx importa do módulo compartilhado de i18n", () => {
        expect(contextBarSource).toContain('from "@/shared/i18n/messages.pt-br"');
    });

    it("SheetTitle usa a mesma chave t.renameSheetTitle nos dois arquivos", () => {
        const listSheetKey = extractSheetTitleKey(listSheetSource);
        const contextBarKey = extractSheetTitleKey(contextBarSource);

        expect(listSheetKey).toBe("renameSheetTitle");
        expect(contextBarKey).toBe("renameSheetTitle");
        // A garantia REAL do D2: não são só iguais entre si por coincidência de dois valores
        // hardcoded — são o MESMO NOME DE CHAVE do MESMO módulo (ambos importam de
        // "@/shared/i18n/messages.pt-br", provado acima), então uma edição de valor em
        // `messages.pt-br.ts` propaga para os dois automaticamente.
        expect(listSheetKey).toBe(contextBarKey);
    });

    it("o rótulo de ação 'Renomear' (t.rename) aparece nos dois arquivos, não uma chave local", () => {
        // scenarios-list-sheet.tsx:150 — aria-label do botão-lápis no card da lista.
        expect(countRenameActionLabelUses(listSheetSource)).toBeGreaterThanOrEqual(1);
        // scenario-context-bar.tsx:205 — rótulo do botão na barra do item aberto.
        expect(countRenameActionLabelUses(contextBarSource)).toBeGreaterThanOrEqual(1);
    });
});
