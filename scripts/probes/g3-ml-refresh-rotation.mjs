// G3 PROBE (014 / seguranca-ci-first.md §8.3) — measurement, NOT feature code.
//
// QUESTION: does Mercado Livre rotate the refresh token on use, and does the OLD one survive?
// ADR-0010 has asserted "rotation-on-use" since 2026-07-06 without ever measuring it, and the
// credential-custody decision (QA2) is explicitly gated on the answer:
//
//   OLD DIES  => the CI job must WRITE BACK the new refresh token every run. GitHub Secrets alone
//                is not enough (a failed write-back bricks the loop until a human re-authorises).
//   OLD LIVES => option (c) — GitHub Secrets, no write-back — is viable, which is the cheap path.
//
// Destructive by nature: it spends the refresh token. That is the point, and it is why it runs
// against .env.probe.local and not against anything in CI.
//
// Tokens are read and written, NEVER printed. Delete once the result is recorded.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = resolve(ROOT, ".env.probe.local");
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

if (!existsSync(ENV_FILE)) {
  console.error("No .env.probe.local — run ml-oauth.mjs first.");
  process.exit(2);
}
const raw = readFileSync(ENV_FILE, "utf8");
const env = Object.fromEntries(
  raw
    .split(/\r?\n/)
    .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, "")]),
);

for (const k of ["ML_APP_ID", "ML_APP_SECRET", "ML_REFRESH_TOKEN"]) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env.probe.local`);
    process.exit(2);
  }
}

async function refresh(token) {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ML_APP_ID,
      client_secret: env.ML_APP_SECRET,
      refresh_token: token,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, body };
}

const R0 = env.ML_REFRESH_TOKEN;
console.log(`start: refresh token present (len=${R0.length})\n`);

console.log("1) spend the refresh token once");
const first = await refresh(R0);
if (!first.ok) {
  console.log(`  HTTP ${first.status} — ${first.body?.error}: ${first.body?.message}`);
  console.log("\nG3 RESULT: INCONCLUSIVE — the refresh grant itself failed.");
  process.exit(1);
}
const R1 = first.body.refresh_token;
const rotated = R1 !== undefined && R1 !== R0;
console.log(`  HTTP 200, new access token (~${Math.round((first.body.expires_in ?? 0) / 3600)}h)`);
console.log(`  refresh token returned: ${R1 ? `yes (len=${R1.length})` : "NO"}`);
console.log(`  ROTATED (new !== old): ${rotated}`);

console.log("\n2) try the OLD refresh token again — the question custody hinges on");
const replay = await refresh(R0);
const oldSurvives = replay.ok;
console.log(
  oldSurvives
    ? "  HTTP 200 — the OLD token STILL WORKS"
    : `  HTTP ${replay.status} — the OLD token is DEAD (${replay.body?.error ?? "?"}: ${replay.body?.message ?? ""})`,
);

// Persist whichever refresh token is actually alive, so the file is never left holding a dead one.
const alive = replay.ok ? (replay.body.refresh_token ?? R1 ?? R0) : (R1 ?? R0);
const aliveAccess = replay.ok ? replay.body.access_token : first.body.access_token;
writeFileSync(
  ENV_FILE,
  raw
    .replace(/^\s*ML_REFRESH_TOKEN\s*=.*$/m, `ML_REFRESH_TOKEN=${alive}`)
    .replace(/^\s*ML_ACCESS_TOKEN\s*=.*$/m, `ML_ACCESS_TOKEN=${aliveAccess}`),
);
console.log("  (.env.probe.local updated with the surviving token — not printed)");

console.log(`\nG3 RESULT: rotated=${rotated} oldSurvives=${oldSurvives}`);
console.log(
  oldSurvives
    ? "=> QA2 option (c) VIABLE: GitHub Secrets without write-back does not brick the monthly loop."
    : "=> QA2 option (c) NOT viable as-is: rotation is single-use, so the CI job MUST write the new refresh token back, or the loop dies after one run.",
);
