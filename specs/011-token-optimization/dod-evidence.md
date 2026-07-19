# DoD Evidence — 011-token-optimization

Evidence-first per Constitution Principle III (011 ships no product code — quickstart procedures ARE the tests).
Each slot is written empty BEFORE the corresponding change, then filled with the real artifact.

## Machine preconditions (T002)

- `rg --version`: 14.1.1 (rev f6d0fcd24a) — matches research expectation.
- `graphify --version`: 0.9.12 — matches research expectation.
- `.git/hooks/post-commit`: absent (confirmed 2026-07-18).
- `.git/hooks/post-checkout`: absent (confirmed 2026-07-18).
- `git config core.hooksPath`: unset (exit code 1, confirmed 2026-07-18).

## §1 Routing (US1 / FR-001 / SC-001) — PR-A

1. **CONFIRMED.** `git diff --stat -- .claude/agents/` shows exactly 7 files, 14 insertions(+)/7 deletions(-):
   `dev-backend`, `dev-estrutura-de-dados`, `dev-frontend`, `devops`, `qa-produto`, `qa-software`,
   `scrum-master`. Each diff is one line changed (`model: opus` → `model: sonnet`) + one line added
   (`effort: medium`), except `qa-produto` (→ `model: haiku` + `effort: low`).
2. **CONFIRMED.** `arquiteto.md`, `seguranca.md`, `product-owner.md`, `designer-ux.md` absent from
   `git diff --stat -- .claude/agents/` — untouched, per ratified Q1 (designer-ux keeps opus).
3. **CONFIRMED.** `CLAUDE.md` now carries the verbatim ADR-0022 §Decision.2 delegation/escalation block
   (added near the top, before "Current ground") plus one ground-line sentence resolving the E5/011
   sequencing: "011-token-optimization is in flight AHEAD of E5, by owner decision (2026-07-18)".
4. **CONFIRMED (SC-008).** Exercised rollback on `qa-software`: reverted `model: sonnet`+`effort: medium` →
   `model: opus` (no `effort` line) → `git diff` empty (byte-identical to baseline, proving a clean one-line
   revert) → re-applied `model: sonnet`+`effort: medium` → `git diff` shows the expected 2-line diff again.
5. **CONFIRMED after session restart (2026-07-18, re-run).** First attempt (same session as the T005/T006
   edits) answered `claude-opus-4-8` for both agents — the registry loads at session start and does not
   hot-reload; recorded as a STOP-and-report finding at the time. Re-run in a restarted session: `qa-software`
   → `claude-sonnet-5` (16,612 subagent tokens); `qa-produto` → `claude-haiku-4-5-20251001` (24,561 subagent
   tokens). **SC-001.5 now proven**: the registry snapshot is per-session, taken at session start; a routing
   change to `.claude/agents/*.md` only takes effect for spawns in a session started after the edit. This is
   the same mechanism as the T014 rtk-hook restart requirement — recorded as a reusable fact, not specific to
   either lever.

## §2 rtk (US2 / FR-003..006 / SC-002..003) — PR-B

- **Install (T012): CONFIRMED.** Downloaded `rtk-x86_64-pc-windows-msvc.zip` (release v0.43.0,
  `github.com/rtk-ai/rtk`) → `rtk.exe` → `C:\Users\Jonatan\.local\bin` (already on PATH). `rtk --version` →
  `rtk 0.43.0`. `rtk gain` → "No tracking data yet." (no crash, no crates.io name-collision — confirms the
  binary is `rtk-ai/rtk`, not the unrelated "Rust Type Kit"). `rtk init --help` real flags recorded: **no
  `--global`/`-g` needed for project-scope (Q2 ratified, default is local project file)**; **`--hook-only`
  exists** ("Hook only, no RTK.md") — use this to avoid generating `RTK.md` or touching `CLAUDE.md`, since
  011 governs CLAUDE.md changes explicitly via ADR-0022, not via a third-party tool's auto-injection. Also
  present: `--dry-run` (preview before writing — will be used before the real T014 init), `--auto-patch` /
  `--no-patch` (settings.json patch control), `--uninstall` (rollback path for T019/T028-equivalent teardown).
- **Config (T013): CONFIRMED, with one divergence flagged and owner-resolved.** `rtk config --create` →
  confirms the Windows path research.md marked "a confirmar": **`C:\Users\Jonatan\AppData\Roaming\rtk\config.toml`**
  (matches the `%APPDATA%\rtk\config.toml` / `dirs` crate prediction exactly). Set `[hooks] exclude_commands =
  ["graphify", "gh", "curl"]` (flat names, README form, not the research's unverified `^`-regex guesses).
  **Divergence (guardrail 9): `[tee]` has NO `directory` key** — the shipped default config.toml only has
  `enabled`/`mode`/`max_files`/`max_file_size`. Binary-string inspection of `rtk.exe` found the real mechanism:
  an env var, **`RTK_TEE_DIR`** (default `~/.local/share/rtk`), not a config.toml field. This matters because
  it's process-environment scoped, not project-scoped like everything else T013 assumed — setting it globally
  (`setx`) means ANY repo where rtk runs on this machine shares the same tee dir, which is in tension with
  T018's "other repos untouched" scope proof. **STOPPED and asked the owner**; decision: **set it globally via
  `setx RTK_TEE_DIR "D:\projects\3dprecify\.rtk-tee"`** (accepting the cross-repo trade-off — this machine
  does not currently run rtk on another repo, so the risk is latent, not live). Requires a session restart to
  take effect (same T014→T015 mechanism) — value confirmed written to the User env scope
  (`D:\projects\3dprecify\.rtk-tee`), not yet live in this process. `.rtk-tee/` added to `.gitignore`.
- **Hook install (T014): FINDING — local `rtk init` does not patch `settings.json` in v0.43.0; procedure
  deviated, owner-approved.** Dry-run comparison: local/default mode → `would add rtk instructions to
  CLAUDE.md` + `would create .rtk/filters.toml` — **no settings.json mention at all**. `--global` mode →
  `would create RTK.md` + `@RTK.md reference` + **`would patch settings.json`** + global filters template.
  Only `--global` installs the deterministic `PreToolUse` hook; local/project mode relies on CLAUDE.md text
  instructions only (non-deterministic — the model must choose to prefix commands with `rtk` itself). This
  contradicts research.md Q1's conclusion ("`rtk init` sem `--global` instala o hook só no projeto"). Verified
  `rtk hook claude` exists standalone (reads PreToolUse JSON from stdin) — it's the actual filter processor,
  independent of how it gets registered. Owner-approved path: manually add the `PreToolUse`/`Bash` block to
  the **project's** `.claude/settings.json` (never the user-global one), invoking `rtk hook claude` — achieves
  Q2's project-scoped ratification using the tool's real mechanism, working around the local-mode limitation.
  **Incident during this investigation (self-inflicted, corrected same session):** to inspect the exact global
  block shape safely, attempted `$env:USERPROFILE`/`$env:HOME` override to sandbox `rtk init --global` into a
  scratch directory — **the override was NOT honored by `rtk.exe`** (Windows resolves the user profile dir via
  API, not shell env vars), so the command ran for real against `C:\Users\Jonatan\.claude\` (global, outside
  this repo, outside git). Effects: `settings.json` patched with the `PreToolUse` block, `RTK.md` created,
  `CLAUDE.md` got an `@RTK.md` reference. **Fully reverted same-session**: `settings.json` restored byte-
  identical from rtk's own `.bak` (which incidentally gave the exact intended block shape below), `RTK.md`
  deleted, `CLAUDE.md` `@RTK.md` line removed, no global filters.toml template leaked, scratch dir cleaned.
  Nothing reached git (machine-local config, not tracked). **Lesson: on Windows, shell-level env var overrides
  do not sandbox a Rust binary's user-profile resolution — test third-party global-scope behavior in an
  actual disposable VM/container, or accept the `.bak`-diff-then-revert approach as the safe inspection
  method** (which is what ultimately worked here). The exact block, captured from the real `.bak`:
  ```json
  "PreToolUse": [
    { "matcher": "Bash", "hooks": [{ "type": "command", "command": "rtk hook claude" }] }
  ]
  ```
  **Applied manually to the PROJECT's `.claude/settings.json`** (not the user-global one): `PreToolUse`/`Bash`
  block added as a new top-level array entry, `PostToolUse`/`Edit|Write` (quality-gate) block left
  byte-identical below it (verified by diff — 12 lines added, 0 changed in the existing block). This is a
  tracked repo file — will be included in the T029/commit staging list for PR-B.
- R1 proof (T015 gate): **CONFIRMED — filtering is live (2026-07-18, restarted session).** (a) `rtk gain
  --history` lists every Bash command run this session prefixed `rtk …`, proving the `PreToolUse`/Bash hook
  intercepted plain commands typed with no `rtk` prefix (e.g. plain `git status` shows up as `rtk git status`,
  count incrementing 1→2 across two identical calls). (b) Visible-output reduction is unambiguous: `cd backend
  && uv run pytest tests -k "entitlement" -v` — a verbose run of 23 tests that would normally print 23 PASSED
  lines plus a header/footer — returned to the tool result as the single line `Pytest: 23 passed` (rtk's own
  history logs it at -99%/329 tokens saved). A zero-collected run (`-k "pricing"`) reduced to `Pytest: No tests
  collected` **plus a recovery pointer** `[full output: D:\...\.rtk-tee\<ts>_pytest.log]`; inspected that file
  directly — it holds the complete untruncated raw output (platform line, plugin list, deselection count,
  warnings section), proving the tee-on-failure path (FR-004) works even for a "no tests" outcome, not only a
  hard failure. **Divergence noted, not blocking**: `rtk gain --history` prints `[warn] No hook installed — run
  \`rtk init -g\`` on every call — this is a global-scope check unrelated to the project-scoped hook actually
  firing (T014's owner-approved local install path); the warning is a false negative in rtk's own self-report
  and should not be read as contradicting (a)/(b) above, both of which are direct behavioral proof. **Verdict:
  R1 did not fire — no Windows auto-rewrite corruption observed, filtering activated on the first restarted
  session with no contingency path needed. T016–T020 unblocked.**
- Honesty guard (T016): **CONFIRMED, same conclusion raw vs filtered.** `pnpm gate:all` run filtered (this
  session, through the `PreToolUse`/Bash hook) and run raw (Jonatan, own PowerShell terminal, same working
  tree) both failed identically: `prettier --check .` flags `.playwright-mcp/page-2026-07-17T18-22-16-782Z.yml`
  (an untracked artifact belonging to the in-flight 010/E5 epic, not caused by 011) → `[ELIFECYCLE] Command
  failed with exit code 1.` ×3 (pnpm's own retry echo) in both runs, byte-for-byte identical wording and exit
  code. **This is a naturally-occurring failure, not a deliberate break** — a stronger honesty-guard proof than
  a staged one, since it shows the filter doesn't paper over or alter a real, unplanned failure: same exit
  code, same actionable line, same conclusion, in both raw and filtered paths. Filtered output was short
  (~300 bytes) and correctly did **not** tee (confirms research Q3's ≥500-byte tee threshold — nothing new
  appeared under `.rtk-tee/` for this failure). **Scope note**: this failure is pre-existing dirty-tree
  pollution from epic 010, out of 011's scope to fix (guardrail 3 — never touch product dirs; `.playwright-mcp/`
  isn't `apps/`/`backend/`/`packages/` either, but cleaning up another epic's uncommitted artifacts is not this
  task's call) — `gate:all` genuinely cannot reach `gate:be` on this working tree right now. Recorded as a
  known-blocked state, not a 011 defect.
- Tee recovery (T016): **CONFIRMED with a verbose (≥500-byte) deliberate failure**, run directly against
  `pnpm gate:be`'s pytest step since `gate:all` can't currently reach it (see above). Flipped one assertion in
  `backend/tests/test_entitlement_route.py:74` (`{"status": "none"}` → `{"status": "DELIBERATE_BREAK_T016"}`),
  ran `cd backend && uv run pytest tests/test_entitlement_route.py -v`. Filtered result was actionable and
  concise: `Pytest: 3 passed, 1 failed` + failing test name, file:line, and the assertion diff, plus
  `[full output: D:\...\.rtk-tee\1784412908_pytest.log]`. The teed file (2.3K, well over the 500-byte
  threshold) held the complete raw pytest output — migration log lines, captured stdout (structlog request
  line), warnings summary, full session header — everything the reduced view had summarized away. Reverted the
  assertion; re-ran → `Pytest: 4 passed`; `git diff --stat -- backend/tests/test_entitlement_route.py` empty,
  confirming a byte-identical clean revert (SC-003/FR-004 both proven).
- Exclusion pass-through (T017): **CONFIRMED for all three configured exclusions
  (`graphify`/`gh`/`curl`, T013's flat-name list).** Method: run each command, then check `rtk gain --history`
  — an excluded command never appears there at all (not merely unfiltered-but-logged; the hook skips it
  entirely, no wrapping). (1) `graphify query "pricing" --budget 300` → full native graphify output (its own
  truncation notice is graphify's own budget cap, unrelated to rtk) — absent from history. (2) `gh pr list
  --repo FreeSoulsDotBat/3dprecify` (the real `origin` remote, confirmed via `git remote -v`) → empty result
  (no open PRs — correct raw answer) — absent from history. (3) `curl -s -o /dev/null -w "%{http_code}\n"
  https://api.github.com` → `200` printed directly — absent from history. Cross-checked against the same
  window's history tail, which still only shows the `git`/`pytest`/`ls`/`wc`/`grep` commands from other tasks —
  none of the three exclusions ever entered the wrapped/logged path.
- Scope proof (T018): **CONFIRMED (structural + behavioral, 2026-07-19).** (1) Enumerated every directory under
  `D:\projects`: **only `3dprecify` has a `.claude/settings.json` at all** — no other repo can carry an rtk
  block. Spot-check on a real sibling git repo (`truths-forge`): no `.claude/` directory whatsoever, `git
  status` there returns raw untouched output. (2) User-global `C:\Users\Jonatan\.claude\settings.json`: zero
  `rtk` occurrences (the T014 incident revert held). **Honest mechanism note**: hook scope is
  *per-session-config*, not per-cwd — a command run FROM a 3dprecify session with cwd in another repo IS
  intercepted (the session carries this repo's hooks), while a session *started* in another repo loads no rtk
  hook and is untouched. Q2's "project-scoped" means the latter, which is what the ratification intended.
  **Additional coverage finding (measured A/B, 2026-07-19)**: the hook matcher is the **`Bash` tool only** —
  the harness's **PowerShell tool bypasses the filter** (long-form `git status` via Bash → rtk-condensed
  view; identical command via PowerShell → raw long form). Recorded in ADR-0022 §3 as a coverage boundary;
  possible `Bash|PowerShell` matcher extension left as an owner-decision follow-up (needs a restart to test).
- Exercised rollback (T019): **PARTIAL — config line exercised; hook teardown documented but blocked from
  live exercise by the permission gate.** (a) `exclude_commands` one-liner: added `"ping"` →
  `%APPDATA%\rtk\config.toml` shows `["graphify", "gh", "curl", "ping"]`, `ping -n 1 127.0.0.1` passed
  through raw and never entered `rtk gain --history` → reverted → file byte-identical to the T013 state.
  Clean add + clean revert, SC-008 satisfied for this line. (b) Full teardown: the documented path is the
  reverse of T014's manual install — delete the 12-line `PreToolUse`/`Bash` block from
  `.claude/settings.json` (config.toml and `RTK_TEE_DIR` may stay; they are inert without the hook). The
  live remove+re-add exercise was **denied by the Claude Code auto-mode permission classifier** (hook-config
  edits are a protected surface — a correct guard, and itself useful evidence: the filter cannot be silently
  torn down or altered by an agent without the owner present). Exercising the teardown for SC-008 therefore
  needs Jonatan to approve the edit in-session (or make it himself); flagged at the PR-B checkpoint.

## §3 graphify hook (US3 / FR-007 / SC-005) — PR-B

- Install (T022): **CONFIRMED (2026-07-19).** `graphify hook status` before: both `not installed` →
  `graphify hook install` → `post-commit` + `post-checkout` written to `.git/hooks/` → status: both
  `installed`. Contents inspected and recorded (research Q7 closed): POSIX sh scripts, `PYTHONHASHSEED=0`
  pinned for deterministic louvain clustering; `GRAPHIFY_MAX_WORKERS=1` on Windows/MSYS; skip during
  rebase/merge/cherry-pick; skip when only `graphify-out/` changed; escape hatch `GRAPHIFY_SKIP_HOOK=1`;
  4-level Python-interpreter probe (pinned uv-tool path first); the rebuild launches **detached**
  (DETACHED_PROCESS on Windows) so `git commit` returns immediately, logging to
  `~/.cache/graphify-rebuild.log`. `post-checkout` runs a **full** rebuild but only on branch switches
  (`$3 == 1`) and only if `graphify-out/` exists.
- Rebuild timing (T023): **CONFIRMED (SC-005).** Trivial-but-real commit `75d368a` (11 files of 011
  evidence, staged surgically per guardrail 4) at ~11:45:19 → hook fired, log shows `11 file(s) changed -
  rebuilding graph...` → `graph.json` mtime 11:45:44 (**~25s, detached** — commit returned instantly);
  rebuilt to 4749 nodes / 8055 edges / 385 communities (the growth over ~2877 is the 011 spec corpus +
  curated-graph backup noted in the log). `cost.json` untouched: mtime still 2026-07-10 17:11:08, MD5
  `ED2503E2F28DDEC4DA81C02F1EAA147B` before and after = **0 LLM tokens**, as designed.
- Survival proof (T024): **CONFIRMED (research Q8 closed).** MD5 of both hooks captured
  (`d267c13f…` / `cf77c1ac…`) → full `pnpm install` (fires `lefthook install` via the root `prepare`
  script) → both hashes **byte-identical** after. Lefthook only manages the hooks it declares
  (`pre-commit`/`pre-push`); it does not clobber foreign hooks it has no section for.
- Staged retirement (T025): **EXECUTED (2026-07-19, only after T023+T024 passed on this machine).**
  (1) `lefthook.yml`: the `post-merge` graph-refresh block **removed**, replaced by the standing
  invariant comment — never declare `post-commit`/`post-checkout` in lefthook (Option C guard: a
  `lefthook install` would overwrite graphify's hooks). (2) `scripts/graph-refresh.sh` deleted via
  `git rm` after `grep -rn "graph-refresh"` confirmed the only executable reference was the lefthook
  block itself (all other hits are docs/specs history). (3) ADR-0014 amended in place (dated Revision
  2026-07-19) + the CLAUDE.md freshness paragraph rewritten to the new mechanism order (T026).
- Query-log pilot (T027): **SET (2026-07-19).** `setx GRAPHIFY_QUERY_LOG_ENABLE 1` (User scope,
  verified `=1` via `[Environment]::GetEnvironmentVariable`). New sessions inherit it; this session does
  not — fine by design, the pilot is E5's sessions. **Teardown line**: `setx GRAPHIFY_QUERY_LOG_ENABLE ""`
  (or remove the User env var via System Properties). **Decision point**: keep-or-drop resolved at the
  PR-C pilot verdict (T033, spec Q5) from the pilot data — never left on by default.
- Exercised rollback (T028): **CONFIRMED (SC-008).** `graphify hook uninstall` → both hook files gone
  from `.git/hooks/` (verified by `ls`: No such file) + `hook status` both `not installed` → re-install →
  both `installed`, MD5 **byte-identical** to the T024 hashes (`d267c13f…` / `cf77c1ac…`). Clean
  round-trip; the fallback during the uninstalled window is exactly ADR-0014's retained AI/manual
  procedure.

## §4 Measurement (US4 / FR-009..010 / SC-006..007) — PR-C

- Baseline table (T031): *(empty slot)*
- Per-slice rows (T032): *(empty slot)*
- Pilot verdict (T033): *(empty slot)*

## §Secondary trims (US6 / FR-013) — T035

- **PINNED (2026-07-19).** `.mcp.json`: `@playwright/mcp@latest` → `@playwright/mcp@0.0.78`,
  `chrome-devtools-mcp@latest` → `chrome-devtools-mcp@1.6.0` (exact versions current on npm at pin time).
  **Verification boundary (honest)**: MCP servers spawn at session start — this session's playwright server
  is still the pre-pin `@latest` process, so "qa-produto still drives the browser" is only provable in a
  session started after the pin. Same per-session-snapshot mechanism as T009/T014 (third occurrence).
  Verification slot: E5's first qa-produto homologation run (the pilot's first browser use) — if the pinned
  version breaks browsing, the rollback is the same one-line revert to `@latest`.

## §5 Boundary re-checks (FR-011 / SC-009..010)

- `gate:all` / lefthook / CI literal, unchanged (T036): **LITERALS CONFIRMED (2026-07-19).**
  `.github/workflows/ci.yml:32` still `run: pnpm gate:all` (the D4 literal); `lefthook.yml` `pre-push`
  block untouched by 011 (the only lefthook edit was the `post-merge` retirement + invariant comment —
  `pre-commit`/`pre-push` byte-identical); no file under `apps/`, `backend/`, `packages/` touched by 011
  (guardrail 3 held; `git status` shows only config/docs/spec surfaces). Drift-guard: no backend route
  change ⇒ silent by construction. **Full-gate-green caveat (honest)**: `pnpm gate:all` on this working
  tree currently fails at `prettier --check` on `.playwright-mcp/page-*.yml` — pre-existing uncommitted
  pollution from epic 010 (recorded at T016, out of 011's scope to clean). 011's own committed surfaces
  introduce no gate failure; the green run is re-checked at PR time on the clean CI checkout, where the
  010 artifacts don't exist.
