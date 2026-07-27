// G1 PROBE (014 / ADR-0010 §A7) — measurement, NOT feature code.
//
// QUESTION: does `GET /sites/MLB/listing_prices` answer a house-account token from NON-BR egress?
// ADR-0010 has recorded a geo-gate belief since 2026-07-06 that was never measured; this session
// already mistook an anonymous 403 PolicyAgent (missing Bearer) for a geo-block. So G1 is a
// TWO-ARM test — same token, same minute, BR egress as the control — and this ONE file runs both
// arms so the comparison is not confounded by a code difference.
//
//   PASS (hosted arm 200 with percentage_fee/fixed_fee) => Option 3D for ML, geo-gate belief retired
//   FAIL (hosted blocked while the BR control succeeds)  => Option 3E, self-hosted BR runner
//
// It also exercises the category tree, because "categoria -> preço" is the whole point of 014 and a
// working fee endpoint with an unreachable taxonomy would be a half-measurement.
//
// Token: env ML_ACCESS_TOKEN, else .env.probe.local. The token is USED, never printed.
// Delete once the gate result is recorded in the ADR amendment.

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = resolve(ROOT, ".env.probe.local");

function localToken() {
  if (!existsSync(ENV_FILE)) return undefined;
  const m = /^\s*ML_ACCESS_TOKEN\s*=\s*(.+)$/m.exec(readFileSync(ENV_FILE, "utf8"));
  return m?.[1].trim().replace(/^["']|["']$/g, "");
}

const TOKEN = process.env.ML_ACCESS_TOKEN || localToken();
if (!TOKEN) {
  console.error(
    "No ML_ACCESS_TOKEN (env or .env.probe.local). Run: node scripts/probes/ml-oauth.mjs url",
  );
  process.exit(2);
}

/** Where did this arm run from? A two-arm test with an unlabelled arm is not evidence. */
async function egress() {
  try {
    const r = await fetch("https://ipinfo.io/json", { signal: AbortSignal.timeout(10_000) });
    const j = await r.json();
    return `country=${j.country ?? "?"} region=${j.region ?? "?"} org=${j.org ?? "?"}`;
  } catch {
    return "country=unknown";
  }
}

async function call(label, url, { auth = true } = {}) {
  const started = Date.now();
  let resp, body;
  try {
    resp = await fetch(url, {
      headers: auth
        ? { authorization: `Bearer ${TOKEN}`, accept: "application/json" }
        : { accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    body = await resp.json().catch(() => null);
  } catch (err) {
    console.log(`  ${label}: NETWORK FAIL — ${err?.message ?? err}`);
    return { ok: false, status: "network", body: null };
  }
  const ms = Date.now() - started;
  console.log(`  ${label}: HTTP ${resp.status} (${ms}ms)`);
  if (!resp.ok) {
    // The message is the diagnosis: a geo-block reads differently from an expired token or a
    // missing scope, and conflating them is the specific error this probe exists to prevent.
    console.log(`    error=${body?.error ?? "?"} message=${body?.message ?? "(none)"}`);
  }
  return { ok: resp.ok, status: resp.status, body };
}

console.log(`EGRESS: ${await egress()}`);
console.log(`ARM: ${process.env.G1_ARM ?? (process.env.CI ? "hosted" : "br-control")}\n`);

console.log("1) listing_prices, unfiltered (price=100)");
const flat = await call(
  "GET /sites/MLB/listing_prices?price=100",
  "https://api.mercadolibre.com/sites/MLB/listing_prices?price=100",
);

let feeShape = false;
if (flat.ok && Array.isArray(flat.body)) {
  console.log(`    listing types returned: ${flat.body.length}`);
  for (const lt of flat.body.slice(0, 4)) {
    console.log(
      `      ${lt.listing_type_id}: percentage_fee=${lt.sale_fee_details?.percentage_fee ?? lt.percentage_fee ?? "?"} fixed_fee=${lt.sale_fee_details?.fixed_fee ?? lt.fixed_fee ?? "?"}`,
    );
  }
  feeShape = flat.body.some(
    (lt) => (lt.sale_fee_details?.percentage_fee ?? lt.percentage_fee) != null,
  );
  console.log(`    percentage_fee present: ${feeShape}`);
}

console.log("\n2) category tree (the 'categoria' half of categoria->preço)");
const cats = await call(
  "GET /sites/MLB/categories",
  "https://api.mercadolibre.com/sites/MLB/categories",
);
let sampleCategory;
if (cats.ok && Array.isArray(cats.body)) {
  console.log(`    top-level categories: ${cats.body.length}`);
  sampleCategory = cats.body[0]?.id;
  console.log(`    sample: ${sampleCategory} (${cats.body[0]?.name ?? "?"})`);
}

let childrenOk = false;
if (sampleCategory) {
  const detail = await call(
    `GET /categories/${sampleCategory}`,
    `https://api.mercadolibre.com/categories/${sampleCategory}`,
  );
  if (detail.ok) {
    const kids = detail.body?.children_categories ?? [];
    console.log(
      `    children: ${kids.length}  path_from_root depth: ${detail.body?.path_from_root?.length ?? "?"}`,
    );
    childrenOk = Array.isArray(kids);
  }
}

console.log("\n3) listing_prices filtered by category (the join 014 actually needs)");
let joinOk = false;
if (sampleCategory) {
  const byCat = await call(
    `GET /sites/MLB/listing_prices?price=100&category_id=${sampleCategory}`,
    `https://api.mercadolibre.com/sites/MLB/listing_prices?price=100&category_id=${sampleCategory}`,
  );
  joinOk = byCat.ok && Array.isArray(byCat.body) && byCat.body.length > 0;
  if (joinOk) {
    const lt = byCat.body[0];
    console.log(
      `    ${lt.listing_type_id}: percentage_fee=${lt.sale_fee_details?.percentage_fee ?? lt.percentage_fee ?? "?"} fixed_fee=${lt.sale_fee_details?.fixed_fee ?? lt.fixed_fee ?? "?"}`,
    );
  }
}

// G1 passes only if the whole categoria->preço join works from this arm — a 200 on the flat
// endpoint alone would not be enough to build the map on.
const pass = flat.ok && feeShape && cats.ok && childrenOk && joinOk;
console.log(
  `\nG1 RESULT: ${pass ? "PASS" : "FAIL"}  [fees=${flat.ok && feeShape} tree=${cats.ok && childrenOk} join=${joinOk}]`,
);
if (!pass) process.exitCode = 1;
