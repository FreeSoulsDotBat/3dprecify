import { mkdirSync, writeFileSync } from "node:fs";

import type { RunOutcome } from "./compose.ts";

// 017/T016 (US2 · contrato `workflow-yaml.md`) — o corpo/título do PR mensal saem como ARQUIVOS.
//
// O job `publicar` não pode montar o corpo do PR em shell (§C.5/§H do desenho: "proíbe que o corpo
// do PR seja montado por echo/heredoc no YAML"). `compose.ts` já produz `titulo`/`corpo` como texto
// puro dentro do caso `PR` do `RunOutcome` — este módulo só é a PONTE de disco entre essa decisão
// (testada, TS, sob o ratchet) e o `gh pr create --body-file`/`--title` que o `.mjs` roda depois.
//
// Por que isto é um `.ts` testado e não uma linha a mais dentro de `build.mjs`: os `.mjs` são
// isentos de cobertura DE PROPÓSITO (014/US4 — a lição de que uma suíte verde não prova um programa
// que roda), e nenhuma decisão pode morar num lugar isento. Aqui a única "decisão" é "kind === PR
// escreve, SEM_PR não escreve" — pequena, mas é exatamente o tipo de `if` esquecido que a lição pede
// para não deixar sem teste.

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
