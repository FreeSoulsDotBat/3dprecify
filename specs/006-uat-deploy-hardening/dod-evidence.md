# 006-uat-deploy-hardening — DoD evidence (CODE HALF; execution half deferred)

**Status (2026-07-09):** the CODE half is SHIPPED — squash-merged to `develop` as **PR #8** (`2518023`,
owner-merged, CI 8/8 on the NEW layout's first run) and cut to `main` as the **first release merge**
(`0b12426`, --no-ff, owner-authorized; Deploy `workflow_dispatch` verified visible; `auto-pr.yml`
activated). **The EXECUTION half (T002–T006 provisioning, T025–T028 deploy/smoke/rollback) is DEFERRED by
owner decision 2026-07-09** (spec Clarifications): first deploy waits for **v1 complete = E1–E6**; FR-010
consciously stays open until then. This file closes what shipped; SC-201..204 measurement moves to the
v1-launch increment.

## Gates (final runs, 2026-07-09)
| Gate | Result |
|------|--------|
| `pnpm gate:all` (THE command — same literal string in lefthook pre-push and the CI `gate` job) | green end-to-end |
| Frontend (format/lint/depcruise/typecheck/coverage) | 226 tests; pricing-core coverage **100%** |
| Backend (ruff check+format · basedpyright strict · pytest · import-linter) | clean; **13 pytest** incl. conformance (3 consecutive stable runs) |
| Playwright e2e (chromium + mobile, Auth emulator) | **86/86** incl. the new `privacy.spec.ts` |
| PR #8 CI (first run of the NEW layout: `gate` + `build` + drift + e2e + docker + secret-scan → `ci-pass`) | **8/8 first-pass** |

## Success criteria — what was verified vs deferred
| SC | Status | Evidence |
|----|--------|----------|
| SC-201..204 (deploy, smoke, offline-in-prod, repeat/rollback timing) | **DEFERRED to v1-launch** | trigger visible on `main`; runbook §2–§4 ready |
| SC-205 (conformance + zero phantoms) | ✅ | T011 failing-first run: **"Undocumented HTTP status code: Received: 401"** on `GET /api/v1/me` with the real `ErrorEnvelope` body — the suite demonstrably fails on contract↔reality divergence (analyze A1). Post-fix: `/me` = 200+401, `/fee-catalog` = 200+304, `grep -c HTTPValidationError contracts/openapi.json` → **0**, drift-guard green, Orval client regenerated, `use-identity` on the generated client (**TD-019 retired**) |
| SC-206 (gate parity, deliberate failure) | ✅ | (a) backend unused-import → `gate:fe` passed, `gate:be` FAILED at ruff (the exact PR #6 gap, now caught locally) and the pre-push hook **blocked a dry-run push** ("failed to push some refs", 29 s warm); (b) pricing-core untested export → coverage 99.09% < 100% failed `gate:fe`. Both reverted; final clean run green. Parity inspectable: `lefthook.yml` and `ci.yml` carry the identical `pnpm gate:all` string |
| SC-207 (ground truth + orphan) | ✅ | CLAUDE.md reconciled (E1 shipped, `gate:all`, deferral recorded); `fix/deploy-env-wiring` DELETED from origin after byte-identical supersession proof (`deploy.yml` + `docs/environments.md` vs `develop`) |

## Owner decisions recorded
- 2026-07-08: LGPD = minimal honest notice (FR-214) · deploy-trigger mechanism = full release merge (FR-209).
- 2026-07-09: `VITE_RELEASE` stamp **accepted** (1 line in `deploy.yml`; env/Sentry/main.tsx were already
  wired) · orphan-branch deletion **authorized** · PR #8 push+merge **authorized** · release merge
  **authorized and executed** · **provisioning + first deploy DEFERRED until v1 = E1–E6**.
- Privacy-copy **ratification is deferred with the launch** (the URL is not being shared; the draft copy
  ships in `messages.pt-br.ts` and the owner ratifies the wording at the v1-launch smoke, per FR-214's
  "before the URL is shared" gate).

## Task completion
- **Done**: T001, T007–T024 (see tasks.md per-task notes) — gate parity (D4 ✅), honest contract +
  conformance (A21 ✅), `/privacidade` test-first, runbook authored, ground reconcile, `VITE_RELEASE`,
  orphan prune, PR #8, release cut + decision-log line.
- **Deferred to v1-launch** (owner decision): T002–T006 (P1–P11 provisioning + GitHub `uat` Environment),
  T025–T028 (trigger, FR-207 negative check, smoke incl. correlation-id step + privacy visual sign-off,
  rollback rehearsal). The runbook §1 tables are the hand-off.
- **Analyze remediations** C1–C3/A1/I1–I2: applied in tasks.md/runbook before implementation.

## Known minor (recorded, not silenced)
- Schemathesis' `unsupported_method` check is excluded as out of FR-210/211 scope; its finding is real but
  minor: undeclared methods (e.g. TRACE) return the framework default 405 **without** an RFC-9110 `Allow`
  header. Candidate cheap fix whenever a route surface grows.
- Hypothesis `filter_too_much` health check suppressed in the conformance suite (optional-header fuzzing
  discards many invalid header bytes); every executed case is still fully validated — verified stable ×3.

## Decisions honored
ADR-0005 (Cloud Run + Hosting + WIF, southamerica-east1) · ADR-0006 (owner authorized every push/merge; the
release cut is its first exercise — see `docs/decisions/audit-findings-r2.md` §"FIRST RELEASE CUT") ·
R2-G2/G3 decisions implemented (A21, D4) with A22/A20/D2 reused as found · Constitution III (failing-first
evidence above) · Principle II (deferral consequences stated, minors recorded).
