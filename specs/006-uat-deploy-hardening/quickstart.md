# Quickstart — validating 006 (UAT deploy + contract hardening + gate parity)

Runnable proof per user story. Prerequisites: repo toolchain (pnpm/Node 24, uv/Python 3.12); for §4, the
owner-gated provisioning (research §1.1–1.3) completed and the release merge done.

## 1. Gate parity (US2 / FR-212 / SC-206)

```bash
pnpm gate:all               # frontend gates && backend gates — the ONE command
```

- **Deliberate-failure check (SC-206, run once, then revert):** introduce a backend lint violation
  (e.g. an unused import in `backend/app/main.py`) AND drop a pricing-core test → `pnpm gate:all` fails
  locally on both. Revert → passes.
- **Parity inspection (not assertion):** `lefthook.yml` pre-push and the CI gate job in `ci.yml` both contain
  the literal string `pnpm gate:all`.

## 2. Error contract + conformance (US3 / FR-210/211 / SC-205)

```bash
cd backend && uv run pytest tests/test_conformance.py -q   # also runs inside gate:all
```

- **Test-first evidence:** on the PRE-fix contract this suite FAILS (undocumented 401 on `/me`); after the
  `errors.py` + `openapi()` change it passes.
- Phantom gone: `grep -c HTTPValidationError contracts/openapi.json` → `0` after regen; contract drift-guard
  (CI) green on the same commit.

## 3. Privacy notice (FR-214)

```bash
pnpm --filter @3dprecify/web vitest run src/pages/privacidade   # component test (written first)
pnpm e2e                                                        # includes /privacidade reachability + sign-in link
```

- Manual: open `/privacidade` signed-out → pt-BR notice renders; sign-in screen shows the link.
- **Gate:** owner ratifies the copy BEFORE the UAT URL is shared (spec FR-214).

## 4. Deploy + smoke + rollback (US1 / FR-201..207 / SC-201..204)

Follow `docs/runbooks/uat-deploy.md` (created by this feature):

1. Confirm GitHub `uat` Environment vars/secrets (runbook §1) — `DEPLOY_ENABLED=true`.
2. GitHub → Actions → **Deploy** → environment `uat`, **ref `develop`** → run; record run URL + `github.sha`.
3. Execute the smoke checklist from a fresh phone (runbook §3) — ALL items must pass (a failed item = failed
   deploy, Principle II). Record cold vs warm first-load.
4. Rollback rehearsal (runbook §4): roll the Cloud Run revision back and the Hosting release back, verify the
   previous version serves, then re-deploy. Times feed SC-204.
5. Record everything in `specs/006-uat-deploy-hardening/dod-evidence.md`.

Negative check (FR-207): trigger Deploy against an environment with `DEPLOY_ENABLED` unset → guard step fails
the run loudly.

## 5. Ground-state reconcile (US4 / FR-213)

- `CLAUDE.md` "Current ground" names 004+005 shipped (PRs #6/#7) and 006 as current — zero statements
  contradicted by the repo.
- Orphan prune (supersession already proven 2026-07-08): after owner authorization,
  `git push origin --delete fix/deploy-env-wiring`; record the evidence line in `dod-evidence.md`.
