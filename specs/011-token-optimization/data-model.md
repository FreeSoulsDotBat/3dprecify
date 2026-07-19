# Data Model — 011-token-optimization

No database entities. 011's "data model" is six **governance/config objects**, each with fields, invariants,
and a rollback transition. Authority: spec.md (Clarifications 2026-07-18) + ADR-0022 (Proposed).

## 1. Routing table (lives in `.claude/agents/*.md` frontmatter)

| Agent | model | effort | Bucket | 011 change |
|---|---|---|---|---|
| dev-backend | sonnet | medium | Executor | re-pin + cap |
| dev-frontend | sonnet | medium | Executor | re-pin + cap |
| dev-estrutura-de-dados | sonnet | medium | Executor (escalates) | re-pin + cap |
| devops | sonnet | medium | Executor | re-pin + cap |
| qa-software | sonnet | medium | Executor | re-pin + cap |
| scrum-master | sonnet | medium | Coordination | re-pin + cap |
| qa-produto | haiku | low | Observation | re-pin + cap |
| arquiteto | opus | — | Judgment | untouched |
| seguranca | opus | — | Judgment | untouched |
| product-owner | opus | — | Judgment | untouched |
| designer-ux | opus | — | Design/judgment | **untouched — Q1 ratified against the research's §C.2 row** |

**Invariants**: exactly 7 files change; each change is one line per field; the research's §C.3 ready-diffs
list `designer-ux → sonnet` — following them blindly is a defect (ADR-0022 flags it).
**Rollback transition**: any row → previous value by reverting its frontmatter line(s).

## 2. Delegation + escalation rules (live in CLAUDE.md)

**Fields**: (a) routine, spec-driven reads/edits → cheaper pinned workers; (b) planning / architecture /
security / final review → main/`opus`; (c) `dev-estrutura-de-dados` escalates to `opus` when the task touches
the **pricing domain** model; (d) prefer lower effort on mechanical tasks.
**Invariant**: the rule references buckets, not hardcoded per-task model IDs (the pins live in object 1).
**Rollback**: delete the block.

## 3. Output-filter policy (rtk — lives in project `.claude/settings.json` + per-user `config.toml`)

**Fields**: hook = PreToolUse/Bash, project-scoped (`rtk init` without `--global`); `exclude_commands =
["graphify", "^gh", "^curl"]`; `tee.mode = "failures"`, tee directory **pinned** (`RTK_TEE_DIR` or
`[tee].directory`) to a known gitignored repo path; binary = release zip v0.43.0.
**Invariants**: (i) downstream-of-execution only — exit codes, artifacts, CI byte-identical (FR-011/SC-002);
(ii) honesty guard — reduced view preserves pass/fail + actionable errors, proven raw-vs-filtered including a
deliberate failure (FR-006); (iii) the existing PostToolUse quality-gate block survives the settings merge
byte-identical; (iv) no filtering outside this repo (Q2 — a leak is a defect).
**State transitions**: unfiltered → filtered (install); per-command spare (one-line exclusion add); full
teardown (`rtk init` uninstall path). **R1 gate**: if Windows auto-rewrite falls back to CLAUDE.md-injection,
the object stays in state "not adopted" and Q2/US2 reopen with the owner.

## 4. Graph refresh hook (graphify — lives in `.git/hooks/` + lefthook invariant)

**Fields**: `graphify hook install` → `post-commit` + `post-checkout` (AST-only, ~20s, 0 LLM tokens);
invariant guard: `lefthook.yml` must never declare `post-commit`/`post-checkout` (comment + ADR-0022);
staged retirement: the lefthook `post-merge` graph-refresh block **and `scripts/graph-refresh.sh`** (dead after
retirement — `pnpm graph:update` calls graphify directly) are removed only in the PR that proves the new hook on
this machine; ADR-0014 refresh clause amended; AI close-out procedure (`pnpm graph:update`) retained as
documented fallback **and remains the path for remote squash-merges arriving via ff-pull** (no local hook fires
there); optional query-log **pilot-only** (Q5).
**Rollback**: `graphify hook uninstall` → ADR-0014 fallback resumes as primary.

## 5. Ledger baseline + slice rows (live in `docs/token-ledger.md`)

**Baseline (fixed before the pilot's first treatment operation)** — normalize **by operation shape**, never by
whole epic; keep methodology constant within a shape (caps, mandate style, lens count):

| E5 operation shape | Fair E4 comparable (ledger row) | 011 levers that apply | Role |
|---|---|---|---|
| Slice implementation (executor fan-out) | E4 PR-A review-fix impl 687,153 (by domain sub-line: DADOS 168,862 · FE 327,993 · BE 190,298) | routing + rtk | **Treatment** |
| Review fan-out (capped) | E4 PR-B 1,114,003 · PR-C 2,133,240 — **never** the uncapped PR-A 4.87M | rtk (+ routing only on executor-style lenses; judgment lenses stay opus) | **Treatment** (compare cost/lens or cost/finding) |
| Visual homologation (qa-produto) | E4 T030 168,094 (enumerated single-slice mandate); secondaries T016 251k / T034 257k | routing (haiku) + rtk | **Treatment** (match mandate style — cost is governed by mandate, not feature size) |
| Architecture round | E4 Phase-0 283,969 | none (opus) — rtk only if Bash | **Control** (E5's 354,392 already ran pre-011) |
| Kickoff (PO) | E4 kickoff 91,786 | none (opus) | **Control** (E5's 100,766 already ran pre-011) |

**Slice row fields** (per E5 slice, owner's 2026-07-10 rule): date · operation · estimate (before) · actual
(harness tokens, never agent self-estimate) · rtk-gain snapshot (auxiliary, labeled) · lesson.
**Verdict fields**: measured effective Δ% vs comparable · quality outcome (homologation verdict + gate) ·
caveats disclosed (tokenizer ~+30%, intro-rate expiry 2026-08-31) · responsible lever if shortfall.
**Invariants**: ledger authoritative, rtk gain auxiliary; treatment vs control never averaged together; missing
comparable ⇒ labeled partial, never forced (SC-006/SC-007).

## 6. Rollback playbook (lives in ADR-0022)

| Layer | Trigger | One-line reversal |
|---|---|---|
| Routing | systematic rework / regression attributable to the downgrade | revert that agent's frontmatter line(s) |
| Filter | filtered view hid a needed signal (beyond tee) | add the command to `exclude_commands` · full: hook teardown |
| Refresh hook | commit latency unacceptable / hook misfires | `graphify hook uninstall` (fallback resumes) |

**Invariant**: each reversal is exercised once during implementation (SC-008) — a playbook line that was never
run is a claim, not a control.
