import { mkdirSync, writeFileSync } from "node:fs";

import type { RunOutcome } from "./compose.ts";

// ⚠ @doc DEC-081 — `.ts` testado e não uma linha no `.mjs`: os `.mjs` são isentos de cobertura
//   de propósito, e nenhuma decisão pode morar num lugar isento — nem um `if` deste tamanho.

export const NOME_CORPO = "pr-body.md";
export const NOME_TITULO = "pr-title.txt";

/**
 * Escreve `<dir>/pr-body.md` e `<dir>/pr-title.txt` quando o desfecho é `PR`. Um desfecho `SEM_PR`
 * não escreve nada — não há título nem corpo para publicar (FR-020a: o valor não existe fora do
 * caso `PR`, e este módulo não inventa um).
 */
export function escreverArtefatosDePr(desfecho: RunOutcome, dir: string): void {
    if (desfecho.kind !== "PR") return;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/${NOME_CORPO}`, desfecho.corpo);
    writeFileSync(`${dir}/${NOME_TITULO}`, desfecho.titulo);
}
