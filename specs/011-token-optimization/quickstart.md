# Quickstart — 011-token-optimization (validation walkthrough)

The end-to-end evidence script for homologation. Each § maps to spec requirements; artifacts (outputs, diffs,
screenshots of terminal output) go to the PR's dod-evidence. Machine: Windows 11, PowerShell primary, Claude
Code with Git Bash. **Prerequisite**: `rg --version` works (verified 14.1.1).

## §1 Routing (US1 / FR-001 / SC-001) — PR-A

1. `git diff` over `.claude/agents/` shows exactly 7 files changed, one line per field:
   6 × (`model: sonnet` + `effort: medium`), 1 × (`model: haiku` + `effort: low`).
2. `arquiteto|seguranca|product-owner|designer-ux` untouched (`git diff --stat` proves absence).
3. CLAUDE.md carries the delegation rule + pricing-domain escalation (FR-002).
4. **Exercised rollback**: revert one agent (e.g. `qa-software`) → confirm single-line diff → re-apply.
5. Spawn one trivial task on a re-pinned agent; confirm it runs and its harness usage reports the cheap model.

## §2 rtk (US2 / FR-003..006 / SC-002..003) — PR-B, R1 gate FIRST

1. Install: download `rtk-x86_64-pc-windows-msvc.zip` (release v0.43.0) → `rtk.exe` on PATH →
   `rtk --version` (expect 0.43.0) → `rtk gain` (sanity: wrong-package check).
2. `rtk config --create` / `rtk config` → record the real Windows config path; write `[hooks]
   exclude_commands = ["graphify", "gh", "curl"]` (**plain names** — the README's documented form; do NOT use
   `^`-regex, unverified), `[tee] enabled=true, mode="failures",
   directory="D:/projects/3dprecify/.rtk-tee"` (**forward slashes** in TOML) (+ add `.rtk-tee/` to `.gitignore`).
3. `rtk init` (NO `--global`) from repo root → diff `.claude/settings.json`: new PreToolUse/Bash block;
   PostToolUse quality-gate block **byte-identical** (research Q5 open item); any other unexpected diff = STOP.
4. **HUMAN STEP**: ask Jonatan to restart the Claude Code session (hook activation) — end the turn on this ask.
5. **R1 empirical proof (the epic's highest risk — in the restarted session, before anything else depends on
   rtk)**: run `git status` + a pytest subset via Bash; deterministic signals that filtering is live:
   (a) `rtk gain --history` lists the just-run commands; (b) the tool-result output is reduced vs the same
   command run outside the hook (compare against an explicit `rtk git status` vs `command git status`). If the
   hook did NOT intercept (empty history / integral output), **STOP** — record the finding, test contingencies
   (`rtk hook claude` delegator / Git Bash path), and reopen US2 with the owner if neither fires. No further §2
   step counts until filtering is real.
6. Honesty guard (FR-006/SC-002): run `pnpm gate:all` raw and filtered — same exit code, same generated
   artifacts (hash them), same pass/fail conclusion; then **break one test deliberately, picking one whose
   failure output is verbose (≥500 bytes — the tee skips smaller outputs)**, rerun filtered: the actionable
   error must be visible in the reduced view AND the integral output present in `.rtk-tee/` (FR-004/SC-003
   recovery proof). Revert the break.
7. Exclusion pass-through (FR-005): run `graphify query "..."`, `gh pr list`, a `curl` — outputs arrive
   unfiltered.
8. Scope proof (Q2): in another repo without the hook, confirm commands are untouched (no `.claude/settings.json`
   rtk block there; no rewrite observed).
9. **Exercised rollback**: add a command to `exclude_commands` (one line) and confirm pass-through; then dry-run
   the full teardown path (documented uninstall), and re-init.

## §3 graphify hook (US3 / FR-007 / SC-005) — PR-B

1. `graphify hook status` (before: not installed) → `graphify hook install` → inspect `.git/hooks/post-commit`
   + `post-checkout` content.
2. Make a trivial commit → graph rebuilds (observe ~20s, `graphify-out/` mtime, 0 LLM tokens via cost.json
   unchanged).
3. **Survival proof** (research Q8): `pnpm install` (triggers `lefthook install` via `prepare`) → graphify's
   `post-commit` hook file **unchanged**.
4. Invariant guard + retirement: `lefthook.yml` carries the comment (never declare post-commit/post-checkout);
   the `post-merge` graph-refresh block AND `scripts/graph-refresh.sh` are removed in this same PR (staged
   retirement — the script is referenced by nothing else, verified: `pnpm graph:update` calls `graphify
   update .` directly) and ADR-0014's amendment is merged. **Honest boundary**: the new hooks cover LOCAL
   commits + branch checkouts; a remote squash-merge arriving via ff-pull on develop fires neither — that path
   stays with the AI close-out procedure (`pnpm graph:update`), unchanged from today.
5. Pilot-only query-log: set `GRAPHIFY_QUERY_LOG_ENABLE=1` for the E5 pilot sessions; note the teardown date
   (Q5 — decided at PR-C verdict).
6. **Exercised rollback**: `graphify hook uninstall` → `hook status` clean → re-install.

## §4 Measurement (US4 / FR-009..010 / SC-006..007) — PR-C

1. Baseline table (data-model.md §5) appended to `docs/token-ledger.md` BEFORE E5's first treatment operation,
   labeling treatment vs control shapes and excluding the uncapped E4 PR-A fan-out.
2. Per E5 slice: estimate row before, actual (harness tokens) after, `rtk gain` snapshot labeled auxiliary.
3. Verdict at pilot close: measured effective Δ% per treatment shape vs comparable, quality outcome, caveats
   (tokenizer ~+30%; intro-rate expiry 2026-08-31), responsible lever on any shortfall. Controls (opus-pinned
   shapes) reported separately — never averaged into the treatment figure.

## §5 Boundary re-checks (FR-011 / SC-009..010)

1. `lefthook.yml` pre-push and CI workflow still invoke the literal `pnpm gate:all` (diff shows no change).
2. Full `pnpm gate:all` green post-011; contract drift-guard has no delta (no backend/route changes).
3. E5 acceptance criteria untouched (011 changed no spec of 010).
