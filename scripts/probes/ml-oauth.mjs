// ML OAUTH HELPER (014 / ADR-0010 amendment 2026-07-24) — measurement support, NOT feature code.
//
// The G1/G1b/G3 gates need a Mercado Livre USER token (`/sites/MLB/listing_prices` has no app-only
// grant — ADR-0010, verified 2026-07-06). This walks the one-time authorization by hand so the
// gates can run before any pipeline code exists.
//
// SECRET DISCIPLINE — the reason this file exists instead of a couple of curl calls:
// tokens are written to `.env.probe.local` (covered by the `.env.*` gitignore rule) and are NEVER
// printed. Every line this script emits is metadata: validity, scope, user id, lengths. That keeps
// the refresh token — the real asset — out of terminal scrollback, CI logs, and any transcript.
//
// USAGE
//   node scripts/probes/ml-oauth.mjs url                 # print the authorization URL to visit
//   node scripts/probes/ml-oauth.mjs exchange <code>     # trade the ?code= for tokens
//   node scripts/probes/ml-oauth.mjs refresh             # spend the refresh token for a fresh 6h one
//   node scripts/probes/ml-oauth.mjs status              # what is in the local file, no secrets shown
//
// Delete once 014's ingestion owns the token lifecycle.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_FILE = resolve(ROOT, ".env.probe.local");

const AUTH_BASE = "https://auth.mercadolivre.com.br/authorization";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

/** Minimal KEY=VALUE reader — no dependency, and it must not choke on comments or blank lines. */
function readEnv() {
  if (!existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Upsert keys, preserving everything already in the file (including the App ID/Secret). */
function writeEnv(updates) {
  const lines = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(
    ENV_FILE,
    lines.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n") + "\n",
  );
}

/** A token is described, never shown. Length is enough to tell "present" from "truncated paste". */
const describe = (t) => (t ? `present (len=${t.length})` : "ABSENT");

function need(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    console.error(`Missing in ${ENV_FILE}: ${missing.join(", ")}`);
    console.error(
      "\nCreate the file with:\n  ML_APP_ID=...\n  ML_APP_SECRET=...\n  ML_REDIRECT_URI=https://truthsforge.com/oauth/ml/callback",
    );
    process.exit(2);
  }
}

/** ML's token endpoint is form-encoded; errors come back as JSON with a `message`. */
async function token(params) {
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams(params),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    // Print the ML error verbatim — diagnosing "invalid_grant" vs "invalid redirect_uri" is the
    // whole value here, and neither leaks a secret.
    console.error(`HTTP ${resp.status} — ${body.error ?? "?"}: ${body.message ?? "(no message)"}`);
    process.exit(1);
  }
  return body;
}

function persist(t) {
  writeEnv({
    ML_ACCESS_TOKEN: t.access_token,
    ML_REFRESH_TOKEN: t.refresh_token ?? readEnv().ML_REFRESH_TOKEN ?? "",
    ML_USER_ID: String(t.user_id ?? ""),
    ML_TOKEN_SCOPE: (t.scope ?? "").replace(/\s+/g, ","),
  });
  console.log(`saved to .env.probe.local (not printed)`);
  console.log(`  access_token:  ${describe(t.access_token)}`);
  console.log(`  refresh_token: ${describe(t.refresh_token)}`);
  console.log(`  expires_in:    ${t.expires_in}s (~${Math.round((t.expires_in ?? 0) / 3600)}h)`);
  console.log(`  user_id:       ${t.user_id ?? "?"}`);
  console.log(`  scope:         ${t.scope ?? "?"}`);
  if (!t.refresh_token) {
    console.log(
      "\nNO REFRESH TOKEN — the app's 'Refresh Token' OAuth flow is probably unchecked in the devcenter.",
    );
  }
}

const [cmd, arg] = process.argv.slice(2);
const env = readEnv();

switch (cmd) {
  case "url": {
    need(env, ["ML_APP_ID", "ML_REDIRECT_URI"]);
    const url = `${AUTH_BASE}?${new URLSearchParams({
      response_type: "code",
      client_id: env.ML_APP_ID,
      redirect_uri: env.ML_REDIRECT_URI,
    })}`;
    console.log(
      "Open this while logged in as the HOUSE account, then copy the ?code= from the bar:\n",
    );
    console.log(url);
    console.log("\nThe code expires in minutes — run `exchange <code>` right away.");
    break;
  }

  case "exchange": {
    need(env, ["ML_APP_ID", "ML_APP_SECRET", "ML_REDIRECT_URI"]);
    if (!arg) {
      console.error("Usage: node scripts/probes/ml-oauth.mjs exchange <code>");
      process.exit(2);
    }
    persist(
      await token({
        grant_type: "authorization_code",
        client_id: env.ML_APP_ID,
        client_secret: env.ML_APP_SECRET,
        code: arg,
        redirect_uri: env.ML_REDIRECT_URI, // must match the registered URI character for character
      }),
    );
    break;
  }

  case "refresh": {
    need(env, ["ML_APP_ID", "ML_APP_SECRET", "ML_REFRESH_TOKEN"]);
    // ML rotates the refresh token on use: the response carries a NEW one and the old dies. That
    // rotation is exactly what the G3 gate has to prove survives a CI run.
    persist(
      await token({
        grant_type: "refresh_token",
        client_id: env.ML_APP_ID,
        client_secret: env.ML_APP_SECRET,
        refresh_token: env.ML_REFRESH_TOKEN,
      }),
    );
    break;
  }

  case "status": {
    console.log(`${ENV_FILE}${existsSync(ENV_FILE) ? "" : "  (does not exist yet)"}`);
    console.log(`  ML_APP_ID:       ${env.ML_APP_ID ?? "ABSENT"}`); // not a secret
    console.log(`  ML_APP_SECRET:   ${describe(env.ML_APP_SECRET)}`);
    console.log(`  ML_REDIRECT_URI: ${env.ML_REDIRECT_URI ?? "ABSENT"}`);
    console.log(`  ML_ACCESS_TOKEN: ${describe(env.ML_ACCESS_TOKEN)}`);
    console.log(`  ML_REFRESH_TOKEN:${describe(env.ML_REFRESH_TOKEN)}`);
    console.log(`  ML_USER_ID:      ${env.ML_USER_ID ?? "ABSENT"}`);
    console.log(`  ML_TOKEN_SCOPE:  ${env.ML_TOKEN_SCOPE ?? "ABSENT"}`);
    break;
  }

  default:
    console.log("commands: url | exchange <code> | refresh | status");
}
