# DoD Evidence — 002-foundation (2026-06-29)

Verified locally (Windows dev). CI execution on GitHub Actions runs the same commands; first push validates
the Actions-only bits (docker build, secret-scan, the drift-guard against the committed baseline).

## Success criteria
- **SC-1 install + gate** ✅ `corepack`/`pnpm install` + `uv sync` succeed; `pnpm gate` and the backend gate
  both pass on the skeleton.
- **SC-2 CI == lefthook; violations go red** ✅ (parity by shared commands) — proven locally that a
  `shared → feature` import makes `pnpm lint` RED (boundaries) and reverting returns GREEN. CI workflow runs the
  identical commands. *Caveat:* the GitHub Actions run itself is validated on first push.
- **SC-3 pricing-core green + unchanged** ✅ 7/7 tests, **100%** coverage (statements/branches/functions/lines);
  source untouched (camelCase + integer percent).
- **SC-4 envelope camelCase + correlationId** ✅ pytest: induced error → `{error:{code,message,correlationId}}`,
  `correlation_id` snake does NOT leak, `X-Correlation-Id` header present. Cloud Logging/Sentry wire on deploy.
- **SC-5 web builds, PWA, theme, auth store, no product screen** ✅ `vite build` + PWA (`sw.js`/manifest);
  Playwright smoke 4/4 (desktop + Pixel 7) — shell renders, theme toggle flips `data-theme`; auth store shows
  `not-configured` without creds. No product screen.
- **SC-6 contract drift-guard** ✅ pipeline works (FastAPI OpenAPI → `contracts/openapi.json` → Orval →
  `shared/api` with the `ErrorCode` union). CI job runs regen + `git diff --exit-code`. *Caveat:* full drift
  assertion needs the committed baseline (first commit).
- **SC-7 governance reconciled** ✅ Principle VIII in the 6 structural agents; plan-template has 8 gates; agent
  verbs fixed. *Caveat:* stale 001 plan/tasks/data-model/api are **bannered as superseded**, to be regenerated
  against this foundation when 001 is implemented (not rewritten now to avoid double work).

## Gates (commands, all green locally)
- Root: `pnpm gate` = `format:check` · `lint` (+boundaries) · `depcruise` · `typecheck` · `test:coverage` (100%).
- Backend (in `backend/`): `uv run ruff check .` · `ruff format --check .` · `basedpyright` (strict, 0) ·
  `pytest` (2) · `lint-imports` (1 kept). NOTE: don't pipe these to `/dev/null` on Windows Git-Bash (rich → spurious exit 1).
- E2E: `pnpm --filter @3dprecify/web test:e2e` (4 passed).
- Build: `pnpm --filter @3dprecify/web build` (PWA generated). Docker image: written, builds in CI (local daemon was down).

## Decisions applied (audit-findings)
A1–A12, O1, V1–V2 implemented. Deferred (documented tech debt): A13/A14 (E2 data), A15–A19 (E1/E2/launch
product+security), TD-008b (composite refs), TD-009/010/011/012/013.

## Jonatan's manual prerequisites (out-of-band, the ONLY non-in-repo work)
1. Approve the 2 MCPs via interactive `claude`.
2. Authorize the first git commit (nothing committed yet).
3. Create dev/prod Firebase projects → fill `apps/web` env (`VITE_FIREBASE_*`) + `.firebaserc` real ids.
4. Provision GCP: Cloud Run + Secret Manager + **WIF** (provider + service account); set repo
   `vars.DEPLOY_ENABLED=true`, `GCP_PROJECT`, `GCP_REGION=southamerica-east1`, `FIREBASE_PROJECT`, and secrets
   `WIF_PROVIDER`, `WIF_SERVICE_ACCOUNT`, `FIREBASE_SERVICE_ACCOUNT`, Sentry auth-token (A11).
5. Clear the Peace Sans font license (TD-010) and the palette AA contrast gate (TD-011/TD-002) before public UI.
