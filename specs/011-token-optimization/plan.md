# Implementation Plan: Token-Cost Optimization of the Dev Workflow (011)

**Branch**: `feature/011-token-optimization` | **Date**: 2026-07-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/011-token-optimization/spec.md` (Clarifications ratified
2026-07-18) · scope brief `docs/product/011-token-optimization-scope-brief.md` · research
`C:\Users\Jonatan\Downloads\tokenoptimization.md` (fact-checked sweep) · **ADR-0022**
`docs/adr/0022-token-cost-engineering-dev-workflow.md` (Proposed, amends ADR-0014)

## Summary

011 is a development-infrastructure increment (zero end-user behavior) that attacks the cost identity
**custo = (preço/token) × (tokens/chamada) × (nº de chamadas)** with three independently-reversible levers plus
a meter: (1) **model routing** — 6 executors → `sonnet` + `effort: medium`, `qa-produto` → `haiku` +
`effort: low`, judgment roles **and `designer-ux`** stay `opus` (Q1 ratified), delegation + pricing-domain
escalation rules in CLAUDE.md; (2) **rtk** `v0.43.0` project-scoped (`rtk init` without `--global` — Q2
ratified) filtering Bash output downstream of execution, `tee: failures` + pinned tee dir, excludes
graphify/gh/curl; (3) **graphify `hook install`** (post-commit/post-checkout) replacing the best-effort lefthook
`post-merge` as primary refresh, with a lefthook invariant guard; (4) **measurement** — E4-baseline-by-operation-
shape vs the E5 pilot slices, one ledger row per slice, ≥30% target with honest effective reporting (Q3
ratified). Everything governed by ADR-0022 with a one-line-per-layer rollback playbook.

## Technical Context

**Language/Version**: No product code. Config surfaces only: Markdown frontmatter (`.claude/agents/*.md`),
JSON (`.claude/settings.json`, `.mcp.json`), TOML (rtk `config.toml`), YAML (`lefthook.yml` guard), Markdown
(CLAUDE.md, ADRs, ledger). Tooling: rtk v0.43.0 (Rust binary, prebuilt zip), graphify 0.9.12 (installed).

**Primary Dependencies**: rtk `rtk-x86_64-pc-windows-msvc.zip` (release v0.43.0 — NOT `cargo install rtk`,
crates.io name collision); graphify CLI (already installed); lefthook (existing, `prepare` on `pnpm install`);
ripgrep 14.1.1 (verified on PATH).

**Storage**: N/A (no DB). Durable records: `docs/token-ledger.md` (authoritative cost), rtk tee store (pinned,
gitignored), `graphify-out/` (gitignored).

**Testing**: The gate itself is the subject — `pnpm gate:all` stays byte-identical (FR-011/SC-009). 011's
"tests" are evidence procedures: raw-vs-filtered `gate:all` diff incl. a deliberately failing constituent
(FR-006), tee recovery proof (FR-004), hook-survival proof across `pnpm install` (research Q8), one exercised
rollback per layer (SC-008).

**Target Platform**: This dev machine — Windows 11 Pro, PowerShell primary, Claude Code with Git Bash as the
Bash tool. Not CI, not production: CI must be provably unaffected.

**Project Type**: Dev-workflow configuration + governance (no `src/` impact).

**Performance Goals**: ≥30% measured effective cost/slice reduction on E5 treatment shapes vs E4 comparables
(Q3); graph refresh ≤ ~20s/commit (AST-only, 0 LLM tokens); no commit/push flow regression.

**Constraints**: `pnpm gate:all` literal command sacred (D4, zero local↔CI drift); ledger authoritative / rtk
gain auxiliary; project-scoped rtk (no filtering outside this repo — a leak is a defect, not a variant);
Principle VIII — every standard change traces to ADR-0022 + dated Clarifications.

**Scale/Scope**: 11 agent files (7 edited, 4 untouched), 1 CLAUDE.md rule block, 1 settings.json merge, 1
config.toml, 1 git-hook pair + 1 lefthook invariant, 1 ADR + 1 ADR amendment, ~4 ledger rows + baseline table.

## Constitution Check

*Assessed by arquiteto (2026-07-18, pre-Phase-0) and re-checked post-design — no change. Full table with
one-line justifications lives in ADR-0022; summary:*

- [x] **I. Scalability & Quality First** — levers compose and scale sub-linearly; quality guarded by
      homologation + gate:all with per-layer rollback triggers, not accepted-cost degradation.
- [x] **II. Truth Over Approval** — ledger authoritative, rtk auxiliary; always the measured effective figure
      with caveats (tokenizer ~+30%, intro-rate expiry 2026-08-31); tool claims verified against primary docs
      (research.md), unverifiable ones labeled A-VERIFICAR with the empirical check scheduled first.
- [x] **III. Test-First** — evidence procedures defined before wiring (raw-vs-filtered with a deliberate
      failure; tee recovery; hook survival; exercised rollbacks); gate untouched byte-identically.
- [x] **IV. Server-Side Entitlements** — PASS (n/a): no app behavior, no entitlement surface.
- [x] **V. Clean Architecture Integrity** — ADR-0022 + explicit ADR-0014 amendment; retires the redundant
      `post-merge` net instead of leaving dead machinery; no duplication.
- [x] **VI. Lean Living Documentation** — the superseded refresh clause is amended, not stacked; query-log is
      pilot-only by conscious decision.
- [x] **VII. Spec-Driven Flow** — kickoff → specify → clarify (4 ratified) → plan+ADR → tasks; gate:all remains
      the blocking gate.
- [x] **VIII. No Inference (NON-NEGOTIABLE)** — routing/delegation/escalation/refresh/threshold all ratified
      with the owner (spec Clarifications) and recorded in ADR-0022 (Proposed → owner homologates at PR-A);
      tool mechanics verified by devops, unverifiable items carried as explicit open items, not defaults.

**Gate result: PASS** (no Complexity Tracking entries needed).

## Project Structure

### Documentation (this feature)

```text
specs/011-token-optimization/
├── plan.md              # This file
├── research.md          # Phase 0 (devops verification round, 2026-07-18 — Q1–Q9 + risks R1–R5)
├── data-model.md        # Phase 1 — the config/governance objects and their invariants
├── quickstart.md        # Phase 1 — evidence/validation walkthrough (the homologation script)
├── contracts/           # Phase 1 — consciously empty (no external interface; see contracts/README.md)
└── tasks.md             # Phase 2 (/speckit-tasks — NOT created by /speckit-plan)
```

### Configuration surfaces touched (repository + machine)

```text
.claude/agents/
├── dev-backend.md            # model: sonnet + effort: medium
├── dev-frontend.md           # model: sonnet + effort: medium
├── dev-estrutura-de-dados.md # model: sonnet + effort: medium (escalation rule → opus for pricing domain)
├── devops.md                 # model: sonnet + effort: medium
├── qa-software.md            # model: sonnet + effort: medium
├── scrum-master.md           # model: sonnet + effort: medium
├── qa-produto.md             # model: haiku + effort: low
└── (arquiteto|seguranca|product-owner|designer-ux).md  # UNTOUCHED (opus)

CLAUDE.md                     # + delegation rule + pricing-domain escalation (§C.3 snippet, adapted)
.claude/settings.json         # + PreToolUse/Bash rtk block (merged by `rtk init`; PostToolUse must survive)
lefthook.yml                  # + invariant comment (never declare post-commit/post-checkout — Option C guard)
.gitignore                    # + rtk tee dir (pinned via RTK_TEE_DIR / [tee].directory)
.mcp.json                     # (P3, droppable) pin playwright/chrome-devtools versions off @latest
docs/adr/0022-token-cost-engineering-dev-workflow.md   # Proposed → Accepted on owner homologation
docs/adr/0014-*.md            # amended refresh clause (graphify hook primary; AI procedure fallback)
docs/adr/README.md            # index row for 0022 (at PR-A bookkeeping)
docs/token-ledger.md          # baseline table + one row per E5 slice
%APPDATA%\rtk\config.toml     # (machine, path to confirm via `rtk config`) [hooks] excludes + [tee] failures
.git/hooks/post-commit|post-checkout  # (machine) written by `graphify hook install`
```

**Structure Decision**: no `src/` impact by definition (spec IS/IS-NOT). All changes are configuration,
governance docs, and machine-local tool setup; the only repo-versioned behavior change is hook/agent config.

## Phase 0 — Research (complete)

`research.md` (devops, 2026-07-18) resolved all mechanics unknowns; nothing NEEDS CLARIFICATION. Load-bearing
findings: **rtk per-project is native** (`rtk init` without `--global` → project `.claude/settings.json`,
merge-preserving); config/tee default paths on Windows unconfirmed → **pin them explicitly** (`RTK_TEE_DIR` →
gitignored repo path); `rg` present; PostToolUse quality-gate hook is event-disjoint from rtk's PreToolUse;
graphify `hook install` writes **post-commit/post-checkout** (not post-merge) and **survives `pnpm install`**
(lefthook proven non-destructive for unmanaged hook types — the orphan `prepare-commit-msg` proof). Open risks
carried into tasks: **R1 (alto)** — Windows auto-rewrite may fall back to CLAUDE.md-injection (no actual
filtering); the raw-vs-filtered proof is therefore the FIRST executable item of the rtk slice. R2 — excludes
live in per-user config (inert outside this repo, hook absent elsewhere — document in ADR). R3 — future
lefthook clobber (neutralized by the Option C invariant guard). R4 — refresh cadence moves post-merge → every
commit (~20s), consciously accepted with `hook uninstall` as the rollback.

### Decisions settled in this plan (from research options, per Principle VIII)

1. **Graphify refresh = Option C** (research Q8): `graphify hook install` as ratified in the spec (US3/FR-007)
   **plus** the lefthook invariant guard documented in ADR-0022 and as a comment in `lefthook.yml` (never
   declare `post-commit`/`post-checkout`). Option B (lefthook-managed) recorded as the fallback if the hook
   fails empirically on Windows. Confidence 85% (devops).
2. **Refresh cadence change accepted** (R4): post-merge (rare, skippable) → post-commit + post-checkout (every
   commit, ~20s AST-only). The freshness gain is **local** (every commit, every branch); the remote squash-merge
   arriving via ff-pull on develop fires neither hook — that path stays with the AI close-out procedure, as
   today (ADR-0022 §Amendment, honest boundary). The lefthook `post-merge` graph-refresh block **and
   `scripts/graph-refresh.sh`** (dead after retirement — `pnpm graph:update` calls graphify directly,
   package.json:23) are **removed in the same PR** that proves the new hook works (staged retirement —
   arquiteto premise: never remove the only working net before the replacement is proven on this machine).
3. **rtk binary via prebuilt zip** (research Q6), hook via `rtk init` (project-level), excludes
   `["graphify", "^gh", "^curl"]` in `[hooks]`, `[tee] mode="failures"` + pinned directory.
4. **Measurement design** (arquiteto round): baseline normalizes **by operation shape**, never by whole epic —
   see `data-model.md` § Baseline. Critical honesty note: E5's kickoff (100,766) and architecture round
   (354,392) already ran pre-011 at opus prices — they are **controls**, not treatment; only E5's
   implementation slices, review fan-outs, and homologations are treatment shapes. The E4 PR-A review fan-out
   (4.87M, uncapped) is excluded from baselines — compare capped-vs-capped only.

## Phase 1 — Design artifacts

- `data-model.md` — the six governance objects (routing table, delegation/escalation rules, filter policy,
  refresh hook, baseline + slice rows, rollback playbook) with fields, invariants, and state transitions.
- `contracts/README.md` — consciously empty: 011 exposes no API/CLI/UI interface; its "contract" is ADR-0022 +
  the evidence procedures in quickstart.md.
- `quickstart.md` — the end-to-end validation walkthrough (the future homologation script): routing check, rtk
  install + raw-vs-filtered proof (incl. deliberate failure + tee recovery + exclusion pass-through), graphify
  hook install + `pnpm install` survival + rebuild timing, ledger baseline + first pilot row, one exercised
  rollback per layer.

## Slicing (owner-authorized per PR, E-pattern)

- **PR-A — Routing + governance skeleton (US1 + US5 partial)**: 7 agent frontmatter edits, CLAUDE.md rules,
  ADR-0022 (Proposed) + index row, routing rollback exercised. *Starts saving immediately; every later 011/E5
  operation already runs at the new price/token.*
- **PR-B — rtk + graphify hook + ADR final (US2 + US3 + US5)**: binary install, `rtk init` (project), config +
  tee pin + gitignore, **R1 empirical proof first** (raw-vs-filtered; if auto-rewrite doesn't fire on Windows,
  stop and reopen with the owner — contingências: `rtk hook claude` delegator / Git Bash path), graphify
  `hook install` + invariant guard + staged `post-merge` retirement + ADR-0014 amendment; ADR-0022 finalized.
- **PR-C — Measurement + pilot verdict (US4)**: baseline table fixed in the ledger, per-E5-slice rows as the
  pilot runs, ≥30%-or-honest-shortfall verdict with caveats. *Closes only after E5's slices have run under the
  new regime.* (P3 US6 rides whichever PR has budget, or is explicitly deferred.)

## Agent context

CLAUDE.md's managed Spec Kit section updated to point at `specs/011-token-optimization/plan.md` (this file).
