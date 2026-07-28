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
import { amazonEntries, amazonSpine } from "./amazon-to-catalog.ts";

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

if (categories.length < MIN_ROWS) {
  console.error(
    `ABORT: parsed ${categories.length} categories, below the ${MIN_ROWS} floor. Treating as a source-shape failure, not a fee change — the artifact is left untouched.`,
  );
  process.exit(1);
}
for (const [name, pct] of CANARIES) {
  const hit = categories.find((c) => c.name === name);
  if (!hit || hit.commissionPct !== pct) {
    console.error(
      `ABORT: canary "${name}" expected ${pct}%, got ${hit ? hit.commissionPct : "MISSING"}. The parser is likely reading the wrong column.`,
    );
    process.exit(1);
  }
}

const collectedAt = process.env.COLLECTED_AT ?? new Date().toISOString().slice(0, 10);
const artifact = JSON.parse(readFileSync(ARTIFACT, "utf8"));
const amazon = artifact.marketplaces.find((m) => m.marketplace === "AMAZON") ?? {
  marketplace: "AMAZON",
  determinantsSchema: { category: [], plan: ["INDIVIDUAL", "PROFISSIONAL"] },
  entries: [],
};

// Keep the original marketplace ORDER so the monthly diff stays readable, and carry every other
// marketplace through untouched — regenerating Amazon must never quietly drop Shopee's curation.
const next = {
  ...artifact,
  catalogVersion: `${collectedAt}.0`,
  generatedAt: `${collectedAt}T00:00:00.000Z`,
  marketplaces: artifact.marketplaces.map((m) =>
    m.marketplace === "AMAZON"
      ? {
          ...amazon,
          categorySpine: amazonSpine(categories),
          entries: amazonEntries(categories, { collectedAt, effectiveDate: collectedAt }),
        }
      : m,
  ),
};

writeFileSync(ARTIFACT, JSON.stringify(next, null, 2) + "\n");
console.log(
  `AMAZON: ${categories.length} categories → ${next.marketplaces.find((m) => m.marketplace === "AMAZON").entries.length} entries (2 plans). catalogVersion=${next.catalogVersion}`,
);
