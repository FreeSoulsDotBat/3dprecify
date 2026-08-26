// O coletor da tabela de comissões da Amazon (014/US3 · 017/T014).
//
//   node src/build-amazon.mjs                 # lê a página ao vivo
//   node src/build-amazon.mjs --from <file>   # lê uma tabela CAPTURADA (offline / teste)
//
// 017/T014 — este arquivo era um WRITER: ele lia e escrevia `backend/app/data/catalog.json`
// diretamente, carregando os outros marketplaces intocados. Isso funciona com UM coletor serial;
// com jobs independentes em VMs isoladas (ADR-0028, decisão A) o último a escrever vence e a
// curadoria do outro some — em silêncio, sobre dinheiro.
//
// Agora ele é um EMISSOR DE FATIA e não conhece o caminho do artefato. Ele produz
// `artifacts/amazon.verdict.json`; quem compõe e escreve é o `publicar`, via `pnpm fee:build`.
//
// O que este arquivo NÃO contém, e é deliberado: nenhuma decisão de dinheiro. Canárias, piso de
// linhas, cobertura de bandas, colisão de id, a montagem da fatia e a declaração de exaustividade
// moram em `amazon-collector.ts`, sob o ratchet de 100%. Os `.mjs` são isentos de cobertura DE
// PROPÓSITO — e a lição de 015/A5 é que a regra que decide o selo do dinheiro não pode morar num
// lugar isento.
//
// FAIL-SAFE (SC-806/FR-018a/I2): uma leitura que falhou NUNCA vira "as taxas caíram". Ela vira um
// veredito ABORTADO com motivo nomeado, o artefato não é tocado por ninguém, e o corpo do PR declara
// o estado. Uma fatia que não existe também não REMOVE nada (§C.2-bis regra 3).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { veredictoAmazon, vigenciasAnteriores } from "./amazon-collector.ts";
import { parseAmazonTable } from "./amazon-parse.ts";
import { AMAZON_SOURCE_URL } from "./amazon-to-catalog.ts";
import { collectedAtFor } from "./guardrails.ts";

const PAGE = `${AMAZON_SOURCE_URL}?locale=pt-BR`;
const VEREDITO = fileURLToPath(new URL("../artifacts/amazon.verdict.json", import.meta.url));
const LINHAS = fileURLToPath(new URL("../artifacts/amazon-rows.json", import.meta.url));

/** As vigências anteriores são o único motivo de este coletor LER o artefato — e ele o lê apenas
 *  para não carimbar `effectiveDate` de hoje em toda entrada (T101). Leitura, nunca escrita. */
const ARTEFATO = fileURLToPath(new URL("../../../backend/app/data/catalog.json", import.meta.url));

async function fetchRows() {
  // A página é renderizada por JS — `curl` devolve casca (medido, gate G2), então um navegador de
  // verdade é obrigatório. Importado preguiçosamente para que `--from` não precise de browser algum.
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ locale: "pt-BR" });
    await page.goto(PAGE, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForSelector("table", { timeout: 45_000 });
    return await page.evaluate(() =>
      [...document.querySelectorAll("table tr")].map((tr) =>
        [...tr.querySelectorAll("td,th")].map((c) => c.textContent.replace(/\s+/g, " ").trim()),
      ),
    );
  } finally {
    await browser.close();
  }
}

/** Escreve o veredito e sai. É o ÚNICO efeito de disco deste arquivo — e ele nunca toca dinheiro. */
function emitir(veredito) {
  mkdirSync(fileURLToPath(new URL("../artifacts/", import.meta.url)), { recursive: true });
  writeFileSync(VEREDITO, `${JSON.stringify(veredito, null, 2)}\n`);
  if (veredito.kind === "ABORTADO") {
    // Um coletor que conclui SEM veredito é proibido (§A.4): o silêncio no disco é indistinguível de
    // um job que nunca começou. Por isso o abortado também é escrito — e o exit é 0, porque o job
    // FEZ o que devia; quem decide o desfecho do run é a composição.
    console.error(`ABORTADO: ${veredito.reason}. O artefato fica intocado.`);
    return;
  }
  const entradas = veredito.slice.leaves.filter((l) => l.level === "ENTRY").length;
  console.log(
    `LIDO: fatia da AMAZON com ${entradas} folhas de entrada, exaustiva em ` +
      `${veredito.slice.exhaustive.join("+")} — coletado em ${veredito.collectedAt}`,
  );
}

const fromArg = process.argv.indexOf("--from");

// T053 (SC-807) — `lastReviewed` só avança por RELEITURA REAL. Uma tabela capturada (`--from`) tem
// uma data de captura que só quem chama sabe; carimbar hoje faria o selo dizer "atualizada em
// <hoje>" sobre números que ninguém conferiu contra a Amazon. A regra mora em `guardrails.ts`.
const quando = collectedAtFor({
  fromFixture: fromArg > -1,
  envDate: process.env.COLLECTED_AT,
  today: new Date().toISOString().slice(0, 10),
});
if (!quando.ok) {
  // Sem data honesta não há coleta: o veredito é ABORTADO, e ele é ESCRITO (nunca omitido).
  emitir({
    kind: "ABORTADO",
    marketplace: "AMAZON",
    reason: quando.reason,
    sourceUrl: AMAZON_SOURCE_URL,
  });
  process.exit(0);
}

const rows =
  fromArg > -1
    ? JSON.parse(readFileSync(process.argv[fromArg + 1], "utf8"))[0].rows
    : await fetchRows();

// As linhas capturadas sobem como artefato da run — inclusive quando a leitura for ABORTADA
// (RA5): "consequência é parada, nunca corrupção", e a evidência do que a página devolveu é o
// que permite ao humano distinguir bloqueio de bot de mudança de layout sem reler a página.
mkdirSync(fileURLToPath(new URL("../artifacts/", import.meta.url)), { recursive: true });
writeFileSync(LINHAS, `${JSON.stringify(rows, null, 2)}\n`);

const artefato = JSON.parse(readFileSync(ARTEFATO, "utf8"));
const amazon = artefato.marketplaces.find((m) => m.marketplace === "AMAZON");
if (!amazon) {
  emitir({
    kind: "ABORTADO",
    marketplace: "AMAZON",
    reason: "o artefato não carrega a seção AMAZON — este coletor relê um marketplace, não cria um",
    sourceUrl: AMAZON_SOURCE_URL,
  });
  process.exit(0);
}

emitir(
  veredictoAmazon({
    categorias: parseAmazonTable(rows),
    collectedAt: quando.date,
    previousEffectiveDates: vigenciasAnteriores(amazon),
  }),
);
