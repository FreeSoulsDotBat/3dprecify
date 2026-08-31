import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import baseGlobalSetup from "../e2e/global-setup";

/**
 * Review do PR #58 (2026-08-15) — a saída da homologação passa a ser TRUNCADA a cada rodada.
 *
 * `defeito()` e `executado()` escrevem com `appendFileSync` e nada truncava. Enquanto os arquivos
 * eram descartáveis isso não incomodava; agora que estão versionados, a próxima re-verificação
 * somaria em cima dos anteriores e **ressuscitaria defeitos já corrigidos** — um relatório que
 * cresce sozinho e nunca melhora. Era eu apagando à mão antes de cada rodada, o que só funciona
 * enquanto for eu rodando.
 *
 * Reusa o `globalSetup` do e2e (Postgres + banco dedicado + migrações): a homologação precisa da
 * mesma pilha, e ter duas provisões seria ter duas verdades sobre o ambiente.
 */
export default function homologGlobalSetup(): void {
    const resultados = fileURLToPath(
        new URL("../../../../docs/homologacao/automatizada/resultados", import.meta.url),
    );
    for (const arquivo of ["defeitos", "execucoes"]) {
        for (let worker = 0; worker < 32; worker += 1) {
            rmSync(`${resultados}/${arquivo}-w${worker}.jsonl`, { force: true });
        }
    }
    baseGlobalSetup();
}
