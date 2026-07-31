// G2 PROBE (014 / ADR-0010 amendment 2026-07-24) — measurement, NOT feature code.
//
// QUESTION: does Amazon's BR referral-fee table render for a NON-BR client?
// The 014 ingestion plan puts the Amazon refresh on a GitHub-hosted runner (US/EU egress).
// If the page geo-varies or blocks, that half of the plan needs a different runner — so we
// measure instead of assuming. This is the same discipline the ML gate (G1) demands: the
// original ADR called the geo-gate "verified" while recording only 30% confidence, and this
// session already mistook a 403 PolicyAgent (missing Bearer) for a geo-block.
//
// The page is public but JS-rendered: curl returns an empty shell, so a real browser is required.
// Delete this probe once the amendment's gates are recorded.

import { chromium } from "playwright";

const URL =
  "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR";

/** Where did this actually run from? A measurement with no location is not evidence. */
async function egress() {
  try {
    const r = await fetch("https://ipinfo.io/json", { signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    return { country: j.country ?? "?", region: j.region ?? "?", org: j.org ?? "?" };
  } catch {
    return { country: "unknown", region: "unknown", org: "unknown" };
  }
}

const where = await egress();
console.log(`EGRESS: country=${where.country} region=${where.region} org=${where.org}`);

const browser = await chromium.launch();
const page = await browser.newPage({ locale: "pt-BR" });

let status = "unknown";
try {
  const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  status = String(resp?.status() ?? "no-response");
  console.log(`HTTP: ${status}  final=${page.url()}`);

  // The table is the payload. Wait for a row we know exists in the BR schedule ("Outros 15%"
  // is the catch-all) rather than a generic selector, so a rendered-but-different page is
  // visible as a MISS instead of passing on an empty table.
  await page.waitForSelector("table", { timeout: 45_000 });

  const rows = await page.evaluate(() => {
    const out = [];
    for (const tr of document.querySelectorAll("table tr")) {
      const cells = [...tr.querySelectorAll("td,th")].map((c) => c.textContent.trim());
      if (cells.length >= 3 && cells[1]?.includes("%")) out.push(cells.slice(0, 3));
    }
    return out;
  });

  console.log(`ROWS WITH A PERCENTAGE: ${rows.length}`);
  for (const r of rows.slice(0, 6)) console.log(`  ${r[0]} | ${r[1]} | ${r[2]}`);

  // Amazon renders the money cells with a NON-BREAKING space (U+00A0), so a plain-space regex
  // misses "BRL 1,00" even though the extracted rows visibly contain it. That cost this gate a
  // false FAIL; the BR control arm is what exposed it as an assertion defect rather than a
  // geo-difference. Normalise before matching.
  const NBSP = new RegExp(String.fromCharCode(0xa0), "g");
  const text = (await page.evaluate(() => document.body.innerText)).replace(NBSP, " ");
  const hasCatchAll = /Outros/.test(text) && /15%/.test(text);
  const hasMinimum = /BRL 1,00|R\$ ?1,00/.test(text);

  console.log(`CATCH-ALL ("Outros" + 15%) present: ${hasCatchAll}`);
  console.log(`MINIMUM ("BRL 1,00") present: ${hasMinimum}`);

  // G2 passes only if the BR schedule actually materialised — not merely that a page loaded.
  const pass = rows.length >= 20 && hasCatchAll && hasMinimum;
  console.log(`\nG2 RESULT: ${pass ? "PASS" : "FAIL"} (from ${where.country})`);
  if (!pass) {
    console.log(
      "G2 FAIL means the Amazon half needs a BR-located runner too — re-open the amendment's runtime choice.",
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.log(`\nG2 RESULT: FAIL — ${err?.message ?? err} (from ${where.country}, http=${status})`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
