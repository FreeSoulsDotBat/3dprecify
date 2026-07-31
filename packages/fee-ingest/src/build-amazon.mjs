// Regenerate the AMAZON half of the committed catalog artifact (014/US3 · T041).
//
//   node src/build-amazon.mjs                 # read the live page
//   node src/build-amazon.mjs --from <file>   # read a captured table (offline / test)
//
// Writes ONLY the AMAZON marketplace; every other marketplace in the artifact is carried through
// untouched, so regenerating Amazon can never quietly drop Shopee's curation.
//
// FAIL-SAFE (SC-806/FR-018a): the artifact is written only if the parse yields a plausible table.
// An empty parse, a shrunk one, or a canary that stopped matching means the SOURCE SHAPE CHANGED —
// which is a failure, not a fee change. That is the dangerous case: a parser reading the wrong
// column returns plausible numbers and sails through review.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CANARIES, parseAmazonTable } from "./amazon-parse.ts";
import {
  checkBandCoverage,
  checkCategoryIdCollisions,
  checkParseSanity,
  nextCatalogVersion,
} from "./guardrails.ts";
import {
  AMAZON_SOURCE_URL,
  amazonEntries,
  amazonSpine,
  effectiveDatesOf,
} from "./amazon-to-catalog.ts";
import { decideRefresh } from "./refresh.ts";

const ARTIFACT = fileURLToPath(new URL("../../../backend/app/data/catalog.json", import.meta.url));
const PAGE =
  "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR";

/** Minimum plausible row count. The 2026-07-28 reading had 38; a table that lost a quarter of its
 *  rows is a shape change, not Amazon deleting ten categories overnight. */
const MIN_ROWS = 28;

async function fetchRows() {
  // The page is JS-rendered — curl returns an empty shell (measured, gate G2), so a real browser is
  // required. Imported lazily so `--from` needs no browser at all.
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

const fromArg = process.argv.indexOf("--from");
const rows =
  fromArg > -1
    ? JSON.parse(readFileSync(process.argv[fromArg + 1], "utf8"))[0].rows
    : await fetchRows();

const categories = parseAmazonTable(rows);

const verdict = checkParseSanity(categories, { minRows: MIN_ROWS, canaries: CANARIES });
if (!verdict.ok) {
  console.error(`ABORT: ${verdict.reason}. The artifact is left untouched.`);
  process.exit(1);
}

// 014/T114 (SC-817) — a banded cell must be publishable as bands. A published GAP is fine and stays
// a gap (FR-014a); what aborts here is a set the engine could not read unambiguously — overlapping
// bands (the applied rate would depend on the row order of a scraped table) or a bound that cannot
// contain a price. Those are parse errors wearing the shape of data, and they reach the seller as a
// commission under a "Referência" seal.
for (const c of categories) {
  if (!c.bands) continue;
  const coverage = checkBandCoverage(c.bands);
  if (!coverage.ok) {
    console.error(`ABORT: "${c.name}" — ${coverage.reason}. The artifact is left untouched.`);
    process.exit(1);
  }
}

// T106 — o gerador confere o PRÓPRIO output antes de escrever. Dois nomes que colapsam no mesmo
// `categoryId` (acentos e caixa são dobrados) produziam um artefato com ids duplicados, e o cliente
// responde descartando o marketplace INTEIRO — um par de acentos apaga a Amazon. Isso saía com exit
// 0 e "sucesso" impresso. O truth-gate do `gate:all` pegaria o artefato, mas não fala com quem rodou
// o script; esta guarda fala, e nomeia os colidentes.
const collision = checkCategoryIdCollisions(categories);
if (!collision.ok) {
  console.error(`ABORT: ${collision.reason}. The artifact is left untouched.`);
  process.exit(1);
}

const collectedAt = process.env.COLLECTED_AT ?? new Date().toISOString().slice(0, 10);
const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
const amazon = artifact.marketplaces.find((m) => m.marketplace === "AMAZON");
// 014/T091 — this used to end in `?? { marketplace: "AMAZON", entries: [] }`, and that default was
// worse than dead code: the map below only REPLACES an existing AMAZON marketplace, so the fabricated
// object could never be used. It just made the script LOOK like it handled a missing Amazon, while a
// real absence would have written the artifact unchanged and then died on the log line below.
// Refusing is the honest answer: this script regenerates a marketplace, it does not create one.
if (!amazon) {
  console.error("ABORT: the artifact carries no AMAZON marketplace to regenerate. Left untouched.");
  process.exit(1);
}

// Keep the original marketplace ORDER so the monthly diff stays readable, and carry every other
// marketplace through untouched — regenerating Amazon must never quietly drop Shopee's curation.
// T101 — a MEMÓRIA da vigência anterior. Sem ela a regeração carimbava a data da execução em toda
// entrada, e como `effectiveDate` não é inerte no comparador, duas execuções sobre a mesma tabela
// marcavam TODAS como alteradas: o laço mensal nascia incapaz de dizer "nada mudou". A fonte da
// Amazon não publica vigência, então o valor honesto é o que a entrada já tinha — só uma entrada
// nova estreia com a data desta coleta.
const entries = amazonEntries(categories, {
  collectedAt,
  effectiveDate: collectedAt,
  previousEffectiveDates: effectiveDatesOf(amazon.entries),
});
const marketplaces = artifact.marketplaces.map((m) =>
  m.marketplace === "AMAZON" ? { ...amazon, categorySpine: amazonSpine(categories), entries } : m,
);
// A sequência de `catalogVersion` era `.0` CRAVADO, e regerar na mesma data de coleta reescrevia
// conteúdo diferente sob rótulo idêntico. Foi o que aconteceu na 014: 77 → 79 entradas com
// `2026-07-28.0` dos dois lados. O rótulo viaja congelado dentro de um snapshot que o ADR-0019
// torna imutável, então um registro ambíguo fica ambíguo para sempre. `nextCatalogVersion` mora em
// `guardrails.ts` e não aqui pelo mesmo motivo do fail-safe da FR-018a: este arquivo é isento de
// cobertura, e a regra que decide o rótulo do dinheiro não pode morar num lugar isento.
const changed = JSON.stringify(marketplaces) !== JSON.stringify(artifact.marketplaces);
const next = {
  ...artifact,
  catalogVersion: nextCatalogVersion(artifact.catalogVersion, collectedAt, changed),
  generatedAt: `${collectedAt}T00:00:00.000Z`,
  marketplaces,
};

// 014/T047+T048 — a DECISÃO do laço mensal, antes de qualquer escrita. Ela mora em `refresh.ts`
// porque este arquivo é isento de cobertura, e a regra que decide se dinheiro vai para o artefato não
// pode morar num lugar isento. Dois desfechos, e escrever não é um deles sem passar por aqui:
//
//   ABORT → o artefato fica INTOCADO e `lastReviewed` não avança para valor nenhum. Uma leitura que
//           falhou não é "as taxas caíram" (SC-806), e publicar meia leitura é pior do que não
//           publicar. É também onde o teto de linhas alteradas pega a mudança em bloco que as
//           canárias deixariam passar.
//   PR    → escreve o artefato e emite o corpo do PR. O job NUNCA mergeia (FR-020a): `mayAutoMerge`
//           decide apenas se AQUELE PR pode dispensar revisão, e só quando o diff for exclusivamente
//           `lastReviewed`.
const outcome = decideRefresh({
  marketplace: "AMAZON",
  collectedAt,
  sourceUrl: AMAZON_SOURCE_URL,
  sanity: { ok: true },
  before: artifact,
  after: next,
});
if (outcome.kind === "ABORT") {
  console.error(`ABORT: ${outcome.reason}. The artifact is left untouched.`);
  process.exit(1);
}

// The write is the LAST step, and everything it reports was computed BEFORE it. The old order wrote
// the file and only then went looking for the marketplace it had just written — so a shape it could
// not find produced a half-done run: artifact on disk, TypeError on stdout, exit code non-zero.
writeFileSync(ARTIFACT, JSON.stringify(next, null, 2) + "\n");
// O corpo do PR ao lado do artefato, para o workflow (T049, ainda por vir) consumir sem recalcular
// nada. `PR_BODY_OUT` deixa o destino explícito em vez de escondê-lo num caminho convencionado.
const bodyOut = process.env.PR_BODY_OUT;
if (bodyOut) writeFileSync(bodyOut, outcome.body);
console.log(
  `PR: ${outcome.title} — dispensa de revisão: ${outcome.mayAutoMerge ? "SIM (só lastReviewed)" : "NÃO"}`,
);
console.log(
  `AMAZON: ${categories.length} categories → ${entries.length} entries (2 plans). catalogVersion=${next.catalogVersion}`,
);
