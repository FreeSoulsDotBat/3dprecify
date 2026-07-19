# ADR-0022: Token-cost engineering of the dev workflow — per-role model routing + command-output filter + graphify auto-rebuild (amends ADR-0014)

- **Status**: Accepted (2026-07-19 — owner homologation via squash-merge of PR #22, `bcbdfe2`)
- **Date**: 2026-07-18
- **Deciders**: Jonatan (owner) + arquiteto + Claude
- **Amends**: ADR-0014 (knowledge-graph maintenance — the refresh-hook clause)
- **Relates**: ADR-0003 (no inference) · ADR-0001/0006 (dev process, branching) · the owner's token-ledger
  rule (2026-07-10, `docs/token-ledger.md`)
- **Governs the spec**: `specs/011-token-optimization/spec.md` (FR-001..FR-013, SC-001..SC-010)
- **Primary source**: `C:\Users\Jonatan\Downloads\tokenoptimization.md` (fact-checked sweep — Part C.2 routing
  table, C.3 ready diffs, Part A caveats), reconciled with the ratified Clarifications (spec §Clarifications
  2026-07-18)

## Context

This repo makes **zero runtime LLM calls** — an audited grep across `apps/`, `backend/`, `packages/` finds only
test mocks (`tokenoptimization.md` §TL;DR/§C.0). Therefore **100% of the project's token spend is the Claude Code
*development workflow***: the main interactive session plus the 11 subagents in `.claude/agents/`. There is no
production API bill to optimize; the object of optimization is the *cost of producing the software*, not the
software. This is the load-bearing framing of the whole increment — nothing here touches an FR, the freemium
split, or `pnpm gate:all`.

The token-ledger (E1–E4) has already priced what this workflow costs, and it is not small: a single review
fan-out hit **4,867,561 tokens** (E4 PR-A, 2026-07-13), the capped diff reviews run **1.1M–2.1M**, and even a
routine slice-implementation fan-out costs **~687k**. Against that, the repo is configured the *opposite* of what
the workflow needs (audited, `tokenoptimization.md` §C.1): **all 11 subagents pinned to `model: opus`**, **none
carry `effort`**, and there is **no delegation rule** telling the main session what to send to a cheaper worker.

The spend leaks on **three orthogonal factors** of one cost identity — the epic's centerpiece:

> **custo = (preço / token) × (tokens / chamada) × (nº de chamadas)**

1. **preço / token** — a pure executor (`dev-*`, `qa-*`, `devops`, `scrum-master`) reasons at Opus rates when a
   cheaper model does the same spec-driven work. *Lever: model routing.*
2. **tokens / chamada** — the full output of `pnpm gate:all`, pytest, tsc, eslint, `git diff`, e2e lands
   **integrally** in context whether it passed or failed. *Lever: a command-output filter (rtk) upstream of the
   context window, downstream of execution.*
3. **nº de chamadas** — structural navigation is already mitigated by graphify (ADR-0014), but the upstream
   auto-rebuild-on-commit hook is not adopted, so a fast-forward `git pull` skips the best-effort lefthook
   `post-merge` net and the graph goes silently stale, sending agents back to blind Grep sweeps. *Lever: the
   graphify hook.*

The three levers are **independent** (fixing one does not fix the others) and **compose multiplicatively**. A
fourth element — the **ledger** — is not a factor but the **meter** that keeps the other three honest. Two
standing ledger lessons drive the honesty discipline: (a) the true cost of a review fan-out is
`achados × refutadores`, not the finders alone; (b) **the operator cannot estimate their own spend** (T034's
self-estimate ran ~2× the harness number). 011 turns these into standing configuration + a measured loop.

Every change here is a change to a **standing standard** (per-agent model, a `CLAUDE.md` delegation rule, an
output filter, a graph-refresh mechanism) and therefore requires a recorded decision under Constitution
Principle VIII / ADR-0003 — hence this ADR, which also **amends ADR-0014** (§Amendment below).

**Honesty caveats that constrain every reported number** (`tokenoptimization.md` Part A/§caveats, primary-sourced):
Sonnet 5's newer tokenizer emits **~30% more tokens** for the same text, so a "40%-cheaper/token" agent nets
**less** than 40%; at **xhigh** effort Sonnet 5 can cost *more* than Opus (the cheap-worker property holds only
at **low/medium** effort); and the intro `$2/$10` rate **expires 2026-08-31**, after which the ratio is ~3.3×,
not ~5×. **011 reports the measured effective saving, never the sticker.**

## Options considered (≥3, per Constitution)

### Option 1 — Model routing only (re-pin the frontmatter, nothing else)
Re-pin the 6 executors → `sonnet` + `effort: medium`, `qa-produto` → `haiku` + `effort: low`, keep the judgment
roles + `designer-ux` on `opus`; add the `CLAUDE.md` delegation + escalation rules. Leave `tokens/chamada` and
`nº de chamadas` untouched.

- **Pros:** the single largest and most reversible price cut (one-line frontmatter diffs, instantly revertible);
  zero new tooling, zero Windows-install risk, zero CI-boundary surface; lands in an afternoon and starts saving
  on every subsequent operation.
- **Cons:** leaves the second-largest leak (integral gate/test/diff output) and the freshness gap fully open;
  captures maybe one of three multiplicative factors; the ~30% tokenizer haircut alone can eat much of the
  price-only saving, so a routing-only epic risks *missing* the ≥30% target on effective cost.
- **Scalability impact:** positive but capped — the price factor is a one-time step; `tokens/chamada` keeps
  growing with test-suite and diff size, so the untouched leak grows as the repo does.
- **Confidence:** 60% that this alone clears the ratified ≥30%-effective bar.

### Option 2 — Model routing + rtk output filter + graphify auto-rebuild hook, governed + measured (CHOSEN)
All three levers, each attacking one factor, each with a one-line rollback, plus the ledger as the meter and this
ADR as governance. Routing as in Option 1; rtk filters filterable Bash output upstream of the context window
(exit codes, artifacts, and what CI runs are byte-identical — `tee: failures` keeps integral output on disk;
graphify/gh/curl excluded); `graphify hook install` rebuilds the AST graph deterministically on commit; the E4
ledger rows fix a baseline and each E5 slice gets one measurement row.

- **Pros:** attacks all three multiplicative factors, so the effective saving compounds (a price cut on a call
  whose output rtk also shrinks saves on two axes at once) — the credible path to a *measured* ≥30% effective;
  each lever is independently reversible (degrade one at a time, never all-or-nothing); the CI-boundary risk is
  isolated to its own homologation slice (PR-B) with a raw-vs-filtered honesty proof; the graph hook closes the
  exact ff-pull gap ADR-0014 flagged as best-effort; the ledger keeps every claim honest by rule.
- **Cons:** two upstream tools (rtk, graphify hook) must be verified on Windows 11 + PowerShell (a plan-phase
  unknown, flagged to devops); the filter carries the epic's main risk (a reduced view hiding a signal) —
  mitigated by `tee: failures` + the honesty guard + the exclusion list; three levers is more moving parts than
  one.
- **Scalability impact:** high and compounding — routing cuts the blended rate once; rtk's saving grows with
  test-suite/diff size; the graph hook keeps navigation cheap sub-linearly as the codebase grows. The bigger the
  repo and the noisier the tool output, the larger the saving.
- **Confidence:** 82%.

### Option 3 — Orchestration with per-invocation model selection, no standing pins
Leave every agent on `inherit`/opus and instead choose the model *per invocation* from the main session (or via
`CLAUDE_CODE_SUBAGENT_MODEL`), plus optionally the advisor pattern (cheap executor calling a top model on demand).

- **Pros:** maximal flexibility (each task gets exactly the model it needs); no frontmatter to maintain; matches
  the research's "orchestrator-worker / advisor" architecture most literally.
- **Cons:** **violates Principle VIII's spirit** — the routing becomes an unrecorded per-call judgment instead of
  a reviewable standing standard, so there is no one-line diff to audit or revert and no stable baseline to
  measure against; the advisor is a beta feature whose headline numbers the sweep **dismantled as
  uncorroborated** (`tokenoptimization.md` §B); per-invocation discipline is exactly the human-in-the-loop cost
  the standing pins remove; nothing here filters output or refreshes the graph.
- **Scalability impact:** negative on governance — cost control depends on remembering to route every call; drift
  is the default.
- **Confidence:** 25% as the right mechanism now (revisit if/when subagent orchestration outgrows static pins).

### Option 4 — Defer all token-cost work until a runtime LLM exists
Do nothing to the dev workflow; park every lever with D1–D4 (the runtime-LLM ingestion, blocked on the house
account, Q-D) and optimize only when the *app* calls an LLM.

- **Pros:** zero effort now; the runtime levers (caching, Batch API) are genuinely higher-leverage *per token*
  when they apply.
- **Cons:** **misreads the cost surface** — there is no runtime LLM and none is scheduled before v1, so deferring
  optimizes a bill that does not exist while the *real* bill (the dev workflow, millions of tokens per epic) runs
  unoptimized; E5 is the last large measurable epic before E6 and deferring wastes it as a pilot; the runtime
  levers do not touch dev-workflow spend at all (different surface).
- **Scalability impact:** negative — the workflow bill compounds every epic while the lever sits parked.
- **Confidence:** 8% this is right; the runtime levers stay correctly parked (§7 OUT), but that is orthogonal to
  the dev-workflow spend this epic attacks.

## Decision

Adopt **Option 2**, with the Clarifications ratified 2026-07-18 (spec §Clarifications) as the binding form. The
runtime levers (Option 4's parked set) remain OUT until a runtime LLM exists; per-invocation routing (Option 3)
stays available as a *manual override on top of* the standing pins, not as the mechanism.

### 1. Final routing table (FR-001) — the ratified form of the research's Part-C.2 table

| # | Agent | `model` | `effort` | Bucket | Change from today |
|---|-------|---------|----------|--------|-------------------|
| 1 | `dev-backend` | `sonnet` | `medium` | Executor | re-pin + cap |
| 2 | `dev-frontend` | `sonnet` | `medium` | Executor | re-pin + cap |
| 3 | `dev-estrutura-de-dados` | `sonnet` | `medium` | Executor | re-pin + cap · **escalates to `opus` for pricing-domain changes** |
| 4 | `devops` | `sonnet` | `medium` | Executor | re-pin + cap |
| 5 | `qa-software` | `sonnet` | `medium` | Executor | re-pin + cap |
| 6 | `scrum-master` | `sonnet` | `medium` | Coordination | re-pin + cap |
| 7 | `qa-produto` | `haiku` | `low` | Observation | re-pin + cap |
| 8 | `arquiteto` | `opus` | *(none)* | Judgment | **unchanged** |
| 9 | `seguranca` | `opus` | *(none)* | Judgment | **unchanged** |
| 10 | `product-owner` | `opus` | *(none)* | Judgment | **unchanged** |
| 11 | `designer-ux` | `opus` | *(none)* | Design (judgment) | **unchanged — ratified Q1** |

**Ratifications that bind the table (spec §Clarifications 2026-07-18):**
- **Q1 — `designer-ux` keeps `opus`.** This *reverses* the research's §C.2/§C.3 recommendation (`→ sonnet`). The
  owner values the design judgment (E4's sync-state vocabulary, E5's four-object IA were designer-ux handoffs);
  the re-pin set is therefore **the 6 executors + `qa-produto`**, and `designer-ux` joins the judgment roles as a
  stakeholder of the quality guardrail, not a downgrade target.
- **Q7 — `effort: medium` cap on all 6 executors from the start.** Closes the research's warning that Sonnet at
  **xhigh** can cost *more* than Opus; the cheap-worker regime is guaranteed from slice 1. If a genuinely hard
  executor task is throttled, the remedy is the documented one-line revert (lift the cap or escalate that
  invocation); the pilot's ledger rows show whether the cap ever bites.

Each change is a **one-line-per-field, individually revertible** frontmatter diff.

### 2. Delegation + escalation rules (FR-002) — the exact `CLAUDE.md` snippet

The following block is added near the top of `CLAUDE.md` (verbatim; it is the standing standard, not a summary):

```md
### Cost / model delegation (Claude Code dev workflow — ADR-0022)
- **Routing (per-agent, in `.claude/agents/*.md` frontmatter):** the 6 executors — `dev-backend`,
  `dev-frontend`, `dev-estrutura-de-dados`, `devops`, `qa-software`, `scrum-master` — run `model: sonnet`
  + `effort: medium`; `qa-produto` runs `model: haiku` + `effort: low`; the judgment roles
  (`arquiteto`, `seguranca`, `product-owner`) **and `designer-ux`** stay on `model: opus`.
- **Delegation:** routine, spec-driven reads & edits → a cheaper worker subagent; planning, architecture,
  security review, and final pre-merge review → keep on the main / `opus` model.
- **Escalation (pricing domain — NON-NEGOTIABLE):** any data-model / schema change that touches the pricing
  domain — `packages/pricing-core`, the marketplace fee catalog, any money/rate/percent leaf, or the
  snapshot/kit/scenario payloads — is escalated from `dev-estrutura-de-dados` (sonnet) **to `opus`**. A
  pricing-domain schema change is the one place a cheap executor carries real financial risk.
- **Effort:** prefer lower `effort` on mechanical tasks; the executor `medium` cap is the default — lift it
  per-invocation ONLY for a genuinely hard task, and record the lift in that operation's ledger row.
- **Rollback:** every routing choice is a one-line frontmatter revert (ADR-0022 §Rollback playbook).
```

### 3. Command-output filter (rtk) — FR-003..FR-006
The filter (rtk) reduces filterable Bash output **before it enters the model's context, strictly downstream of
execution**: exit codes, generated artifacts, and what CI runs are **byte-identical** with and without it (the
sacred `gate:all` boundary, ADR/D4 — FR-011). `tee: failures` preserves the **integral** output of a failed
command on disk (FR-004); the **exclusion list** passes `graphify`, `gh`, `curl` through untouched (FR-005); and
the **honesty guard** requires a raw-vs-filtered comparison — including a deliberately failing `gate:all`
constituent — to prove the reduced view preserves the pass/fail conclusion and every actionable error (FR-006).
**The filter is project-scoped (ratified Q2, 2026-07-18): the hook is installed for THIS repository only
(`rtk init` without `--global`) — no other project's sessions are filtered; a leak beyond this repo is a defect
against the ratified decision, not a variant.** The exact `config.toml` keys, the hook-interception mechanics,
the `exclude_commands` entries, and the `tee` store path/rotation are **devops' call, verified against installed
rtk on Windows** — not decided here (spec §9.1; §Assumptions below).

**Verified on this machine (rtk 0.43.0, Windows 11, 2026-07-18/19 — T013/T014/T015/T019/T020):**
- **R1 outcome (the epic's highest pre-identified risk): did NOT fire.** Filtering activated on the first
  restarted session (2026-07-18) with no Windows auto-rewrite corruption and no contingency path needed —
  proven behaviorally (plain `git status` intercepted and condensed; verbose pytest 23-pass run reduced to
  one line; tee recovery pointer on failure). Detail: dod-evidence §2 (T015).
- **Config** lives at `C:\Users\Jonatan\AppData\Roaming\rtk\config.toml` (the `%APPDATA%` prediction held);
  `[hooks] exclude_commands = ["graphify", "gh", "curl"]` (flat names, README form) + `[tee] enabled=true,
  mode="failures", max_files=20, max_file_size=1048576`.
- **Tee store path (FR-004)**: `[tee]` has **no** `directory` key in 0.43.0 — the path is the env var
  **`RTK_TEE_DIR`**, set per owner decision (2026-07-18) to `D:\projects\3dprecify\.rtk-tee` via `setx`
  (User scope; gitignored). Recovery: the reduced view of a failed command prints
  `[full output: …\.rtk-tee\<ts>_<cmd>.log]` — the integral output is in that file.
- **Hook registration reality (deviates from the §3 sentence above, owner-approved)**: v0.43.0's *local*
  `rtk init` does **not** patch `settings.json` (only `--global` does). Project scoping is achieved by the
  `PreToolUse`/`Bash` → `rtk hook claude` block added **manually to this repo's `.claude/settings.json`** —
  the ratified Q2 outcome (project-scoped filtering) via the tool's real mechanism.
- **R2 note (excludes are per-user, inert elsewhere)**: `exclude_commands` lives in the per-user Roaming
  config, but it only ever takes effect where the hook is registered — and the hook exists solely in this
  repo's `.claude/settings.json` (verified 2026-07-19: no other repo under `D:\projects` has any
  `.claude/settings.json`, and the user-global one carries no rtk block). Outside this repo the excludes are
  inert configuration, not behavior.
- **Coverage boundary (measured 2026-07-19)**: the hook matcher is the **`Bash` tool**; commands run through
  the harness's **PowerShell tool bypass the filter entirely** (verified A/B: long-form `git status` via Bash
  → rtk-condensed; via PowerShell → raw). The filter's saving therefore applies to Bash-tool traffic only.
  **Owner decision (2026-07-19): the matcher stays Bash-only**, paired with a Bash-preference discipline —
  during the E5 pilot the agent deliberately routes shell work through the Bash tool. The `Bash|PowerShell`
  extension was considered and declined: rtk rewrites Bash syntax, and PowerShell cmdlets/pipes risk a
  corrupting rewrite for a saving the discipline captures without config risk. Revisit trigger: pilot data
  showing material unfiltered PowerShell traffic despite the discipline.

### 4. Graphify auto-rebuild — FR-007 (this is the ADR-0014 amendment, §Amendment below)
`graphify hook install` becomes the **primary** freshness mechanism (deterministic AST rebuild on commit, ~20s,
0 LLM tokens); the AI close-out `graphify update .` procedure is retained as the **documented fallback**; the
best-effort lefthook `post-merge` net is **retired from primary duty** (staged — see §Amendment). An optional
query-log runs **pilot-only** (FR-012, Q5); keep-vs-drop is decided from pilot data, never left on by default.

### 5. The meter — FR-009/FR-010 (see §Baseline design, delivered to `plan.md`)
The ledger fixes a labeled E4 baseline *by operation shape* before the pilot, then gains one row per E5 slice
(estimate → actual + a filter-telemetry snapshot). The **ledger is authoritative**; the filter's own savings
telemetry is **auxiliary and labeled as such**. The pilot verdict is the **measured effective** cost/slice vs its
E4 comparable at the ratified **≥30%** target (Q3), with the tokenizer (~+30%) and intro-rate (2026-08-31)
caveats disclosed; a shortfall is reported honestly with the responsible lever named — never rounded up to a pass.

### Two points routed to devops, not inferred here (Principle VIII)
The **install mechanics** of both tools on Windows 11 + PowerShell (rtk per-project hook wiring + the `config.toml`
shape; the graphify hook's commit stage + its interaction with the existing lefthook) are **devops' domain**,
verified against the installed tools. Where those mechanics change an architectural choice, this ADR states the
premise and marks it **"verify with devops"** (§Assumptions).

Jonatan approves this ADR at the PR-A gate (Proposed until then; finalized across PR-B/PR-C per the spec's US5).

## Amendment to ADR-0014 (refresh-hook clause)

ADR-0014 §Decision, "Maintenance rule", enumerated a three-level refresh with the **AI procedure as primary** and
the **lefthook `post-merge` hook as a best-effort safety net** (explicitly "a fast-forward `git pull` may not fire
`post-merge`"). That best-effort gap is precisely the freshness leak 011 closes. This ADR **amends** (does not
silently supersede — Principle VIII) that clause. The new order of mechanisms, strongest first:

1. **`graphify hook install` — deterministic on-commit rebuild (PRIMARY).** AST-only, ~20s, 0 LLM tokens. Fires
   on every **local** commit (and on branch checkout via `post-checkout`), so everything committed on this
   machine keeps the graph fresh deterministically. **Honest boundary:** a squash-merge commit created
   **remotely** (the GitHub PR merge) arrives via `git pull` on `develop`, and a fast-forward pull fires
   *neither* `post-commit` *nor* `post-checkout` — that path is covered by mechanism 2 below, exactly as it is
   today. The commit hook's gain is local freshness (every commit, every branch), not the remote-merge path.
2. **AI close-out `graphify update .` (DOCUMENTED FALLBACK, still load-bearing).** The assistant's post-merge
   bookkeeping step remains in `CLAUDE.md`. It is the net when the hook is absent (a machine without graphify, a
   `hook uninstall` rollback) and is **the only path** for the doc/paper/image semantic route (`/graphify
   --update`), which the CLI `update` / the commit hook do **not** cover (code-only).
3. **`pnpm graph:update` (MANUAL).** Unchanged; the owner-facing one-shot refresh.

**Amendment status: EXECUTED 2026-07-19.** The devops verification the staging waited on ran on this
machine: hook install T022, ~25s detached on-commit rebuild with `cost.json` untouched T023, byte-identical
survival across `pnpm install`/`lefthook install` T024 — after which the `post-merge` block and
`scripts/graph-refresh.sh` were removed together (T025) and ADR-0014 carries the dated Revision 2026-07-19.
Evidence: `specs/011-token-optimization/dod-evidence.md` §3.

**Retirement of the lefthook `post-merge` net — staged, and here is the justification.** Keeping *both* the
graphify commit hook and the lefthook `post-merge` trigger means a `develop` merge fires **two** independent
rebuilds of the same graph (~20s wasted + "which fired?" log noise), and the reason the `post-merge` net existed
— keeping the graph fresh — is better served by the commit hook for every local path, while the remote-merge
path was **never** covered by `post-merge` on a ff-pull anyway (its own comment admits it). So the `post-merge`
trigger is **retired from primary duty**. But retirement is **staged, not immediate**: the lefthook `post-merge`
net **stays wired until devops has verified the graphify commit hook installs and fires cleanly on Windows 11 +
PowerShell**; only then are the `post-merge` block **and `scripts/graph-refresh.sh` removed together** —
verified fact (2026-07-18): `pnpm graph:update` runs `graphify update .` **directly** (`package.json` line 23),
so after retirement the script is referenced by nothing and keeping it would be dead machinery (Constitution V).
Rationale: never remove the only working net before its replacement is proven on this environment. This staging is the one place the amendment depends on a devops verification (§Assumptions,
"verify with devops"). ADR-0014's §Consequences line "the `post-merge` hook is best-effort … so the AI procedure
is the load-bearing enforcement" is superseded by: *the graphify commit hook is the primary enforcement; the AI
procedure is the documented fallback.*

**Addendum 2026-07-19 (owner decision, same PR) — the ff-pull premise was measured FALSE; the
`post-merge` net returns as the deterministic merge-path complement.** The retirement paragraph above
(and mechanism 1's "honest boundary") rests on the claim that a fast-forward `git pull` fires no
`post-merge` — inherited from the old script's own hedge ("may not fire") and **never tested**.
Measured on this machine 2026-07-19 (git 2.45.1, `pull.rebase=false`, scratch-repo ff-pull with a
marker hook — dod-evidence §3): **`post-merge` DOES fire on a fast-forward pull.** Per guardrail 8
(a result contradicting the premise is a finding), the owner ratified **Option A** the same day:
re-declare a lefthook `post-merge` block running `scripts/graph-refresh.sh` (resurrected) — guarded
to `develop`, non-fatal, skip-if-no-graphify — as the **deterministic net for the remote squash-merge
path**, complementing (not replacing) mechanism 1. The mechanism order becomes: **1.** graphify
`post-commit`/`post-checkout` (local paths, PRIMARY) · **1b.** lefthook `post-merge` → graph refresh
on `develop` pulls (remote-merge path) · **2.** AI close-out procedure (fallback net + the only
doc/paper semantic route) · **3.** `pnpm graph:update` (manual). The double-rebuild waste the
retirement feared does not occur: on a develop ff-pull only `post-merge` fires (no local commit is
created); on local commits only graphify's hooks fire (no merge). The lefthook invariant is
unchanged — `post-merge` is not a graphify-owned hook, so declaring it is safe (verified: graphify's
hooks byte-identical across `lefthook install`, dod-evidence §3). **Known boundary:** `git pull
--rebase` fires no `post-merge`; the repo runs `pull.rebase=false` — adopting pull-rebase is the
dated re-open trigger for this addendum.

## Rollback playbook (per layer — each a one-line / single-command reversal, FR-008)

| Layer | Trigger (the signal to roll back) | Reversal (one line / one command) |
|-------|-----------------------------------|-----------------------------------|
| **Model routing** | An E5 slice regresses quality traceably to a downgraded agent — homologation FAIL or `gate:all` red attributable to the model (not the code); or the `effort: medium` cap throttles a genuinely hard executor task. | Flip that agent's frontmatter: `model: sonnet` → `model: opus` (and/or remove the `effort:` line). One line, one agent, no code / migration / ADR rewrite. **Exercised 2026-07-18** (qa-software: revert → `git diff` empty → re-apply, dod-evidence §1.4). |
| **rtk filter** | A filtered command's reduced view hides an actionable signal on a *passing* command (the honesty guard fails for that command), or the filter is unhelpful for a specific command. | Add the command to `exclude_commands` (one line in `%APPDATA%\rtk\config.toml` — exercised 2026-07-19, add+revert clean). To remove the filter wholesale: delete the 12-line `PreToolUse`/`Bash` block from `.claude/settings.json` (the install was manual, so the teardown is the same edit in reverse; documented dry-run 2026-07-19 — exercising it live requires the owner present, the hook surface is permission-gated) → all Bash output passes through raw next session. |
| **graphify hook** | The commit hook slows or blocks commits, or the rebuild corrupts / stales the graph. | `graphify hook uninstall` (single command) → falls back to the ADR-0014 AI/manual refresh procedure (which the staged retirement kept intact). **Exercised 2026-07-19** (uninstall → status clean → reinstall byte-identical, dod-evidence §3). |
| **post-merge net (lefthook)** | The develop-pull refresh misbehaves (slow pull, wrong-branch fire, graph corruption on merge). | Remove the `post-merge` block from `lefthook.yml` + `lefthook install`; optionally `rm .git/hooks/post-merge` (measured 2026-07-19: `lefthook install` does NOT delete the now-undeclared runner — the orphan is **inert**, exit 0, runs nothing, so leaving it is harmless; the `rm` makes the teardown total). The AI close-out procedure resumes as the merge-path net. **Exercised 2026-07-19** (block removed → install → orphan-runner inertness measured → block re-added → reinstalled, lefthook.yml MD5 round-trip identical, dod-evidence §3). |

Each rollback line MUST be **exercised once** during the epic (FR-008/SC-008) so the playbook is proven, not
theoretical.

## The honesty rule (governs every reported number)

- **The ledger is authoritative for cost; rtk's `gain` telemetry is auxiliary and labeled as such.** When the two
  diverge, the ledger wins by rule (spec §Edge Cases). A ledger row is the record; a filter-telemetry snapshot
  *feeds* it, never replaces it.
- **Always report the measured *effective* saving, never the sticker ratio**, with the two standing caveats
  disclosed inline: Sonnet's **~30%-heavier tokenizer** and the **2026-08-31** intro-rate expiry (after which the
  arithmetic is ~3.3×, not ~5×). A vendor "~70–90% per command" for rtk is a **projection until measured on our
  commands** and is labeled so.
- **A shortfall is a data point, not a hidden failure** (ratified Q3). An honest 25% is reported as 25% with the
  responsible lever named; it is **never rounded up to a pass**, and there is no automatic rollback on a
  threshold miss — the owner judges with the caveats disclosed.

## Consequences

- **Positive:** attacks all three multiplicative cost factors with per-layer one-line reversibility; captures the
  largest price cut immediately (routing lands PR-A, so every following E5 operation runs at the new price/token);
  closes ADR-0014's ff-pull freshness gap with a deterministic 0-token rebuild; isolates the CI-boundary risk to
  PR-B behind a raw-vs-filtered honesty proof; keeps `pnpm gate:all` byte-identical (D4 untouched); and binds
  every claim to the measured ledger, so the saving is provable rather than folklore.
- **Negative / trade-offs accepted:** two upstream tools carry a Windows-install unknown (flagged to devops, not
  assumed shipped); the filter carries a residual risk of hiding a signal on a *passing* command (bounded by the
  honesty guard + `tee: failures` + the exclusion list, reversible per-command); measuring on a single pilot epic
  is noisy and E4↔E5 comparability is confounded by different epic shapes (mitigated by the per-shape baseline
  design + the "label partial, never force" rule); Sonnet's tokenizer haircut means the effective saving runs
  below the sticker, and after 2026-08-31 the price advantage narrows (both disclosed by rule).
- **Follow-ups / triggered work:** devops verifies the rtk + graphify hook mechanics on Windows (spec §9.1/§9.3)
  and executes the staged `post-merge` retirement once the graphify hook is proven; `plan.md` carries the
  per-shape E4↔E5 baseline (§Baseline design) and the Constitution Check linking this ADR; the pilot's ledger
  rows decide the query-log keep-vs-drop (Q5) and whether the `effort: medium` cap ever bites (Q7); the P3
  secondary levers (MCP version pins, `CLAUDE.md` auto-load trim — FR-013) ride whichever PR has budget or are
  deferred with a note. The runtime-LLM levers (caching, Batch API, advisor) stay parked with D1–D4 and are
  revived only if/when the app calls an LLM (`tokenoptimization.md` §C.5).
