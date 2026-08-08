// O vigia da `/precos` da Amazon (017/T021 · US4 · ADR-0028 §E).
//
//   node src/watch-amazon-precos.mjs                 # fetch simples da página ao vivo
//   node src/watch-amazon-precos.mjs --from <file>    # lê um recorte CAPTURADO (offline / teste)
//
// Fetch SIMPLES — sem navegador (medido: HTTP 200, sem SPA — G do brief; diferente da tabela de
// comissões G200336920, que É renderizada por JS e por isso usa Playwright em `build-amazon.mjs`).
//
// O que este arquivo NÃO contém, e é deliberado: nenhuma decisão de dinheiro, e nenhum caminho até
// `FeeEntry`/`CatalogSlice` — a decisão inteira mora em `watch/amazon-precos.ts`, sob o ratchet de
// 100%. Este `.mjs` só busca a página, lê o baseline anterior, chama o vigia e escreve o resultado
// em `artifacts/amazon-precos.vigia.json` — o `build.mjs` (via `paraComposicao`) decide o resto.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { collectedAtFor } from "./guardrails.ts";
import {
  avaliarVigiaAmazonPrecos,
  baselineFromReading,
  parseAmazonPrecos,
} from "./watch/amazon-precos.ts";

const PAGE = "https://venda.amazon.com.br/precos";
const BASELINE = fileURLToPath(new URL("../data/amazon-precos.baseline.json", import.meta.url));
const SAIDA = fileURLToPath(new URL("../artifacts/amazon-precos.vigia.json", import.meta.url));

function emitir(resultado) {
  mkdirSync(fileURLToPath(new URL("../artifacts/", import.meta.url)), { recursive: true });
  writeFileSync(SAIDA, `${JSON.stringify({ fonte: "amazon-precos", resultado }, null, 2)}\n`);
}

const fromArg = process.argv.indexOf("--from");

// A mesma disciplina do coletor da tabela (T053/SC-807): uma leitura capturada (`--from`) exige
// `COLLECTED_AT` — carimbar hoje sobre um arquivo de meses atrás faria o baseline dizer "vigiado
// hoje" sobre uma página que ninguém releu.
const quando = collectedAtFor({
  fromFixture: fromArg > -1,
  envDate: process.env.COLLECTED_AT,
  today: new Date().toISOString().slice(0, 10),
});
if (!quando.ok) {
  emitir({ kind: "ABORT", reason: quando.reason });
  process.exit(0);
}

const html =
  fromArg > -1 ? readFileSync(process.argv[fromArg + 1], "utf8") : await (await fetch(PAGE)).text();

const leitura = parseAmazonPrecos(html, { sourceUrl: PAGE, collectedAt: quando.date });
if (!leitura.ok) {
  console.error(`ABORTADO: ${leitura.reason}. O baseline fica intocado.`);
  emitir({ kind: "ABORT", reason: leitura.reason });
  process.exit(0);
}

// Primeira execução (bootstrap): sem baseline em disco, o próprio reading vira o baseline — não há
// "mês anterior" para comparar, e não escreve relato nenhum (nada mudou porque nada existia antes).
const baseline = existsSync(BASELINE)
  ? JSON.parse(readFileSync(BASELINE, "utf8"))
  : baselineFromReading(leitura.reading);

if (!existsSync(BASELINE)) {
  console.log(
    `amazon-precos: BOOTSTRAP — nenhum baseline anterior; leitura vira o primeiro baseline.`,
  );
  emitir({ kind: "SEM_NOTICIA", baselineAtualizado: baseline });
  process.exit(0);
}

const resultado = avaliarVigiaAmazonPrecos({ leitura: leitura.reading, baseline });
emitir(resultado);

switch (resultado.kind) {
  case "SEM_NOTICIA":
    console.log(
      "amazon-precos: sem notícia — a leitura bate com o baseline e com a constante servida.",
    );
    break;
  case "DIVERGENCIA":
    console.log(`amazon-precos: DIVERGÊNCIA — ${resultado.relato.resumo}`);
    break;
  case "DECISAO":
    console.log(`amazon-precos: PEDIDO DE DECISÃO DO DONO — ${resultado.decisao.titulo}`);
    break;
}
