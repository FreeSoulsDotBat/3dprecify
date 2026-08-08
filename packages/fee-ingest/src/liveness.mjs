// 017/T022 (US7 · `contracts/workflow-yaml.md`) — o job `loop-liveness` do `ci.yml`.
//
// Sem segredo, sem rede, sem `gh api` (decisão G.3): lê `backend/app/data/catalog.json` do disco
// que o checkout já trouxe, e nada mais. A DECISÃO mora em `liveness.ts`, sob o ratchet de 100% —
// este arquivo só é I/O + `console.log`/`::warning::`, como os outros `.mjs` do pacote (014/US4:
// nenhuma regra pode morar num lugar isento de cobertura).
//
//   node packages/fee-ingest/src/liveness.mjs
//
// SEMPRE sai com exit 0 — a clarify Q7 pediu não-bloqueante, e o job não entra no `needs` do
// `ci-pass` (G.3): um mês sem releitura é um AVISO ao dono, nunca um portão de merge de quem não
// tem nada a ver com tarifas.

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { LIVENESS_WARNING_DAYS, avaliarLiveness } from "./liveness.ts";

const CATALOGO = fileURLToPath(new URL("../../../backend/app/data/catalog.json", import.meta.url));
const hoje = new Date().toISOString().slice(0, 10);

function linha(mensagem) {
  console.log(mensagem);
  const arquivo = process.env.GITHUB_STEP_SUMMARY;
  if (arquivo) appendFileSync(arquivo, `${mensagem}\n`);
}

if (!existsSync(CATALOGO)) {
  linha(
    `::warning::loop-liveness — artefato ausente em ${CATALOGO}; não há como medir a idade do dado.`,
  );
  process.exit(0);
}

const catalogo = JSON.parse(readFileSync(CATALOGO, "utf8"));
const resultado = avaliarLiveness(catalogo, hoje);

switch (resultado.kind) {
  case "NUNCA_COLETADO":
    linha(
      "::warning::loop-liveness — nenhum marketplace coberto tem `lastReviewed`: o laço mensal " +
        "nunca coletou nada ainda (caso diferente de 'ficou velho' — nomeado à parte).",
    );
    break;
  case "AVISO":
    linha(
      `::warning::loop-liveness — o dado mais recente (${resultado.maisRecente}) tem ` +
        `${resultado.idadeDias} dias sem releitura, acima do limiar de ${LIVENESS_WARNING_DAYS} ` +
        "dias. Confira se o laço mensal (`fee-refresh.yml`) está rodando — até o corte de release " +
        "o gatilho real é o `workflow_dispatch` manual.",
    );
    break;
  case "OK":
    linha(
      `loop-liveness — ok: ${resultado.idadeDias} dias desde a releitura mais recente (limiar: ${LIVENESS_WARNING_DAYS}).`,
    );
    break;
}

process.exit(0);
