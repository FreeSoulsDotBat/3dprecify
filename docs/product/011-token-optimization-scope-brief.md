# 011 — Scope brief: token-optimization of the dev workflow (the invisible fourth cost lever)

**Status**: product scope draft (input to `/speckit-specify`) · **Author**: product-owner · **Date**: 2026-07-18
**Nature**: internal **development-infrastructure** increment — it ships **no** end-user behavior. It is sequenced
**before E5** (010) so E5's implementation slices run as its measurement pilot.

> This brief specifies **the operational behavior we want from the dev workflow** (which model runs which role,
> what the model is allowed to see, when the graph rebuilds, how we prove the saving) — **not** the config syntax,
> the exact `config.toml` keys, the hook wiring, or the ADR-0022 wording. Those are the arquiteto's / devops'
> call (Principle VIII, §9). Every standard change here needs a dated ADR + decision entry; nothing is inferred.
> No cost figure is fabricated: the token numbers cited are from `docs/token-ledger.md` (measured) and the
> per-token price ratios from the fact-checked sweep in `C:\Users\Jonatan\Downloads\tokenoptimization.md`
> (primary-sourced, `conf` attached at source). Where a saving is a projection, it is flagged as such.

## 0. Owner decisions

The headline call is **settled**; the remaining §10 questions carry their recommendation as the working default
into `/speckit-specify` + `/speckit-clarify` (the E4/E5 pattern — §0 grows as the owner rules).

| # | Decision | vs. recommendation |
|---|---|---|
| **D0** | **011 ships BEFORE E5, and E5 is its pilot.** The repo makes **zero** runtime LLM calls (`apps/`/`backend/`/`packages/` = test mocks only, audited) — so 100% of token spend is the Claude Code dev workflow. 011 attacks that spend on three composable factors; E5's PR-A/PR-B/PR-C slices run under the new regime and are measured against the E4 slices already in the ledger. **OWNER TO CONFIRM sequencing** (recommendation: yes, ship first — the pilot needs a real epic to measure, and E5 is next in line). | = rec, 85% |

The remaining questions (Q1–Q7) carry the product-owner's recommendation as the working default; the owner may
still put any of them (Q1 the `designer-ux` borderline, Q2 the global-vs-scoped hook, Q3 the acceptance
threshold) to `/speckit-clarify`.

---

## 1. Epic vision (the operator's problem)

*"Eu pago a conta de tokens do desenvolvimento inteiro. Um único fan-out de revisão já custou **4,87 milhões** de
tokens (linha do ledger, 2026-07-13), e os fan-outs de 100–280k são rotina. Todo executor — o que só edita
arquivo seguindo spec, o que só abre o navegador e tira print — roda no modelo mais caro que existe, no `opus`,
sem `effort` nenhum. O CI não fica mais barato, a qualidade não fica melhor: eu só pago preço de topo por
trabalho de rotina. Quero cortar a conta sem afrouxar o gate, sem inventar economia, e sabendo exatamente
quanto cortei."*

The repo is currently configured the **opposite** of what the workflow needs: **all 11 subagents pinned to
`model: opus`**, **none with `effort`**, and **no delegation rule** telling the main session what to send to a
cheaper worker (audited, `tokenoptimization.md` §C.1). Three distinct leaks bleed tokens, and they are
**independent** — fixing one does not fix the others:

1. **Price per token** — a pure executor (`dev-*`, `qa-*`, `devops`, `scrum-master`) reasons at `opus` rates when
   `sonnet`/`haiku` would do the same spec-driven work. *(Lever: model routing.)*
2. **Tokens per tool-call** — the full output of `pnpm gate:all`, pytest, tsc, eslint, `git diff`, e2e lands
   **integrally** in the context window, whether it passed or not. *(Lever: rtk output filtering.)*
3. **Number of tool-calls** — structural navigation is already mitigated by graphify (ADR-0014), but the upstream
   `graphify hook install` (auto-rebuild on commit) and query-log are not yet adopted. *(Lever: graphify upgrades.)*

E1–E4 taught this epic its own lesson twice, in the ledger's own words: the review fan-out's true cost is
`achados × refutadores`, not the finders alone — and **the operator cannot estimate their own spend** (T034's
self-estimate was ~2× the harness number). 011 is the increment that turns those hard-won lessons into
**standing configuration** and a **measured loop**, so the saving is real and provable rather than folklore.

The pitch in one line: **o ledger provou o que custou (E1–E4, medido); o 011 corta o que não precisava custar —
e continua medindo.**

---

## 2. The cost-factor model (the centerpiece — three levers that multiply, plus the loop that proves it)

E5's centerpiece was the four-object map. 011's centerpiece is the **cost identity** — the risk of the epic is
treating the three levers as one knob and claiming a saving nobody measured. The identity:

> **custo = (preço / token) × (tokens / chamada) × (nº de chamadas)**

Each lever attacks **one** factor; they are orthogonal, so they **compose multiplicatively** (a 40% price cut on
a call whose output rtk shrinks 80% saves on both axes at once). The fourth element is not a factor — it is the
**meter** that closes the loop and keeps the other three honest.

| Lever | Factor it cuts | Mechanism | Reversibility (the rollback trigger) | Owner-facing risk |
|---|---|---|---|---|
| **Model routing** | preço / token | Re-pin executors → `sonnet`, `qa-produto` → `haiku`+`effort: low`; keep `arquiteto`/`seguranca`/`product-owner` on `opus`; delegation rule in CLAUDE.md; `dev-estrutura-de-dados` escalates to `opus` for pricing-domain changes | **1-line frontmatter revert** per agent (`model: sonnet` → `model: opus`) | A judgment task lands on a cheap model and quality drops (§ mitigated by the escalation rule + keeping judgment roles on opus) |
| **rtk** (Rust Token Killer, [github.com/rtk-ai/rtk](https://github.com/rtk-ai/rtk)) | tokens / chamada | Proxy CLI filters Bash command output **before it reaches the model** (~70–90%/command, vendor claim — to be measured); native Windows hook since v0.37.2 (`rtk init -g --hook-only`); `exclude_commands` + `tee: failures` (full output on failure saved to disk) | **1-line `exclude_commands` add** to spare a command; **`rtk init` teardown** to remove the hook wholesale | A filtered output hides a signal the model needed to debug (§ mitigated by `tee: failures` — a failed command keeps its integral output on disk; and by excluding graphify/gh/curl) |
| **graphify hook** ([github.com/Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)) | nº de chamadas | `graphify hook install` = deterministic auto-rebuild on commit, replacing the best-effort lefthook `post-merge` (ff-pulls skip it today); optional query-log during the pilot | **hook uninstall** (falls back to the ADR-0014 manual/AI-procedure refresh) | Graph goes stale silently, sending agents on blind Grep sweeps (§ mitigated: the current AI close-out procedure remains the load-bearing net, per ADR-0014) |
| **Ledger** (the meter, `docs/token-ledger.md`) | — (measures the other three) | E4 baseline already in the ledger; one row per E5 slice (estimate → actual + `rtk gain` snapshot); `rtk gain` is **auxiliary telemetry**, the ledger row is the **authoritative** cost record | n/a — the meter has no rollback; it is how you decide whether to roll the others back | Measuring on one pilot epic is noisy; E4-vs-E5 comparison is confounded by different feature complexity (§ flagged as Risk R4) |

**The honesty rule the ledger already forces onto this epic (`tokenoptimization.md` §A.3 + §caveats):** the
sticker savings are **not** the effective savings. Sonnet 5's newer tokenizer emits **~30% more tokens** for the
same text, so a "40% cheaper/token" agent nets **less** than 40%; and at **xhigh** effort Sonnet 5 can cost
*more* than Opus — the cheap-worker property holds only at **low/medium** effort. The intro `$2/$10` rate
**expires 2026-08-31**, after which the arithmetic is ~3.3× not ~5×. **011 must report the measured effective
saving, never the sticker.** This is the same discipline the ledger already enforces on every fan-out.

---

## 3. What 011 IS / IS NOT (crisp, so the increment does not collide with the gate or the app)

**011 IS**: a **development-infrastructure** increment that changes (a) which model each subagent role runs on,
(b) what a subagent's Bash tool-calls are allowed to feed into the context window, (c) when the knowledge graph
rebuilds, and (d) how each E5 slice's cost is measured and compared to its E4 comparable — all as **standing,
version-controlled configuration** governed by an ADR (ADR-0022) and a set of one-line rollback triggers.

**It is NOT**:
- **An app feature.** It ships zero end-user behavior; no story here touches `apps/`, `backend/`, `packages/`, a
  spec's FR, or the freemium split. E5's PR-A/B/C content is unchanged by 011 — only the *cost of producing it* is.
- **A change to `pnpm gate:all`.** The gate is **sacred** (D4, zero local↔CI drift). rtk filters only **what the
  model sees**; it does **not** change what the gate executes, the exit codes, the generated artifacts, or the CI
  job. If rtk ever touched the gate's behavior, that is out of scope and a defect. *(This is the load-bearing
  boundary of the whole epic.)*
- **A runtime-LLM optimization.** Prompt caching, Batch API, and the advisor tool apply only **if/when the app
  calls an LLM** (the parked D1–D4 ML ingestion, blocked on the house account, Q-D). They are OUT (§7).
- **graphify strict mode.** Consciously deferred — too aggressive for active development (`tokenoptimization.md`
  context + owner brief). Only `hook install` + optional query-log are IN.
- **The Instagram post's marketing numbers.** The sweep dismantled the BrowseComp per-problem dollars and the
  advisor "92%/63%" figure as uncorroborated (`tokenoptimization.md` §B). 011 trusts the **architecture**
  (officially documented), never those numbers; its own success criterion is measured from **our** ledger.

---

## 4. Constitutional & gate boundary (settled — not reopened here)

- **Principle VIII (no inferring architecture/standards).** Every change 011 makes to a standing standard — the
  per-agent model, the delegation rule in CLAUDE.md, the rtk hook, the graphify hook replacing the lefthook
  `post-merge` net — is a **standards change** and therefore needs an **ADR + a dated decision entry**. 011
  produces **ADR-0022**, which **amends ADR-0014** on the refresh-hook clause (the graphify auto-rebuild
  supersedes the "best-effort lefthook `post-merge`" language). *(ADR-0021 is already taken by E5; 0022 is the
  next free number — Q6.)*
- **`pnpm gate:all` is sacred (D4).** The literal command in lefthook pre-push and the CI gate job stays
  byte-identical; no local↔CI drift is introduced. rtk operates on the **model's view** of a command, downstream
  of execution.
- **The ledger is authoritative for cost.** `docs/token-ledger.md` remains the single source of truth for spend;
  `rtk gain` is auxiliary telemetry that **feeds** a ledger row, never replaces it. The owner's 2026-07-10 ledger
  rule (estimate before, actual after, lesson on divergence) applies to 011's own operations too.
- **Truth over sticker (Constitution II, no fabricated facts).** 011 reports the **measured effective** saving
  from the ledger, with Sonnet's ~30%-heavier tokenizer and the 2026-08-31 intro-rate expiry disclosed. A
  vendor-claimed "~70–90% per command" for rtk is a **projection until measured on our commands** and must be
  labeled so.

---

## 5. User stories

*Personas are internal operators of the dev workflow: **o dono** (Jonatan — pays the token bill, authorizes each
merge), **o orquestrador** (the main interactive session that plans + fans out), **os subagentes executores**
(`dev-*`, `devops`, `qa-software`, `scrum-master` — spec-driven doers), **os agentes de QA** (`qa-produto` —
opens the browser, screenshots, reports defects). Judgment roles (`arquiteto`, `seguranca`, `product-owner`)
stay on `opus` and are stakeholders of the quality guardrail, not targets of the downgrade.*

### US1 — Route each agent to the cheapest model that does its job (price/token) — **P1 [FOUNDATIONAL]**
As **the dono paying the bill**, I want each subagent pinned to the cheapest model that does its role's work, so
routine execution stops billing at `opus` rates while judgment work keeps its reasoning. Re-pin per the audited
Part-C.2 table: `dev-backend`, `dev-frontend`, `dev-estrutura-de-dados`, `devops`, `qa-software`, `scrum-master`,
`designer-ux` (Q1) → `sonnet`; `qa-produto` → `haiku` + `effort: low`; `arquiteto`, `seguranca`,
`product-owner` → **keep `opus`**. Add the delegation rule + the pricing-domain escalation rule to CLAUDE.md.

**Acceptance scenarios**
1. **Given** the 11 agent frontmatters, **When** 011 lands, **Then** each agent's `model` matches the ratified
   Part-C.2 table exactly, and every downgrade is a reviewable one-line diff (the exact diffs are in
   `tokenoptimization.md` §C.3).
2. **Given** the main session about to delegate routine, spec-driven reads/edits, **When** it consults CLAUDE.md,
   **Then** a delegation rule tells it to route them to a cheaper worker and to keep planning/architecture/
   security/final-review on the main/`opus` model.
3. **Given** a task that touches the **pricing domain** model, **When** it would fall to `dev-estrutura-de-dados`,
   **Then** the CLAUDE.md rule escalates it to `opus` (the one place a schema change carries pricing risk).
4. **Given** any re-pinned agent, **When** the owner wants it back on `opus`, **Then** the revert is a **single
   frontmatter line** — no code, no migration, no ADR rewrite (the rollback trigger for this lever).
5. **Given** the pilot's judgment guardrail, **When** a re-pinned agent produces a slice, **Then** the E5
   homologation verdict and `gate:all` are the quality gate — a downgrade that causes a real regression is a
   rollback signal, not an accepted cost (SC-004).

### US2 — Filter command output before it reaches the model (tokens/call) — **P1**
As **the orquestrador**, I want a Bash-command proxy (rtk) to strip the noise out of `gate:all`/pytest/tsc/
eslint/`git diff`/e2e output **before it enters my context window**, so a passing 200-line test run costs a
one-line summary, while a **failure keeps its full output** on disk for debugging.

**Acceptance scenarios**
1. **Given** the native Windows hook (`rtk init -g --hook-only`, v0.37.2+), **When** a subagent runs a filterable
   Bash command, **Then** the model receives a reduced view and the command's **exit code, generated files, and
   what CI runs are unchanged** (rtk is downstream of execution — §4 boundary).
2. **Given** `tee: failures` mode, **When** a command **fails**, **Then** its **integral** output is preserved
   (to `~/.local/share/rtk/tee/`), so no debugging signal is lost to filtering.
3. **Given** the `exclude_commands` list, **When** a subagent runs **graphify**, **gh**, or **curl**, **Then**
   rtk passes their output through untouched (these are excluded by design — their output is structured/
   load-bearing).
4. **Given** any command whose filtered view proves too aggressive, **When** the owner wants it spared, **Then**
   sparing it is a **one-line `exclude_commands` add**, and removing rtk entirely is a hook teardown (the
   rollback triggers for this lever).
5. **Given** a filtered `gate:all` run, **When** its reduced view is compared to the raw run, **Then** the
   pass/fail conclusion and any actionable error are **preserved** — rtk never turns a real failure into an
   apparent pass (the honesty guard for this lever).

### US3 — Keep the knowledge graph fresh automatically (number of calls) — **P2**
As **the orquestrador and the executors** relying on graphify for structural navigation (ADR-0014), I want the
graph to rebuild **deterministically on commit** via `graphify hook install`, so the graph-first search stays
accurate and agents stop falling back to blind Grep sweeps when a ff-pull skips the best-effort `post-merge`.

**Acceptance scenarios**
1. **Given** `graphify hook install`, **When** a commit lands on `develop`, **Then** the graph auto-rebuilds
   (AST-only, ~20s, 0 LLM tokens per ADR-0014), replacing the best-effort lefthook `post-merge` net.
2. **Given** ADR-0014's refresh clause, **When** ADR-0022 lands, **Then** ADR-0014 is **amended** to point at the
   graphify hook as the refresh mechanism, and the AI close-out procedure remains documented as the fallback net
   (no silent supersession — Principle VIII).
3. **Given** an optional query-log enabled **for the pilot only**, **When** the pilot ends, **Then** the log's
   value (did graph-first actually cut Grep/Read calls?) is reported and the log is a **conscious keep-or-drop**
   decision, not a permanent default (Q5).
4. **Given** the hook, **When** the owner wants it gone, **Then** `hook uninstall` falls back to the ADR-0014
   manual/AI-procedure refresh (the rollback trigger for this lever).

### US4 — Prove the saving on E5, per slice, against the E4 baseline (the meter) — **P1**
As **the dono**, I want each E5 slice's cost measured and compared to its E4 comparable **in the ledger**, so the
epic's success is a **measured** ≥30% cost/slice reduction (Q3) with **no quality regression** — never a sticker
claim or a marketing number.

**Acceptance scenarios**
1. **Given** the E4 slices already recorded in `docs/token-ledger.md`, **When** the pilot starts, **Then** a
   **baseline** is fixed from the comparable E4 slice(s) (e.g. the E4 PR-A/PR-B/PR-C fan-outs + homologations),
   labeled as the comparison basis.
2. **Given** each E5 slice (PR-A/PR-B/PR-C), **When** it completes, **Then** the ledger gains **one row** with
   estimate → actual **and** an `rtk gain` snapshot, following the owner's 2026-07-10 rule.
3. **Given** the acceptance threshold, **When** a slice's measured **effective** cost is compared to its E4
   comparable, **Then** the criterion is **cost/slice ≥30% lower** (Q3, proposed) **with no quality regression**
   (homologation PASS + `gate:all` green + no new honesty defect).
4. **Given** the ~30%-heavier Sonnet tokenizer and the 2026-08-31 intro-rate expiry, **When** the saving is
   reported, **Then** it is the **measured effective** saving with those caveats disclosed — never the sticker
   ratio (SC-006, Constitution II).
5. **Given** a slice that regresses quality **or** fails the threshold, **When** the pilot reviews it, **Then**
   the per-layer rollback triggers (US1/US2/US3 acceptance) are the documented remedy — the epic degrades one
   lever at a time, not all-or-nothing.

### US5 — Govern every change with ADR-0022 + a rollback playbook (Principle VIII) — **P2**
As **the dono under the Constitution**, I want each standing-standard change captured in **ADR-0022** (≥3 options,
pros/cons/scalability/confidence) with the ADR-0014 amendment and a **one-line-per-layer rollback playbook**, so
nothing is inferred and any lever can be reversed without archaeology.

**Acceptance scenarios**
1. **Given** the standards 011 changes (per-agent model, CLAUDE.md delegation rule, rtk hook, graphify hook),
   **When** ADR-0022 is written, **Then** it presents ≥3 options with pros/cons/scalability/confidence and is
   linked from the plan's Constitution Check; ADR-0014 is amended (not silently superseded).
2. **Given** the rollback playbook, **When** any lever misbehaves, **Then** the playbook states the exact
   one-line reversal (re-pin frontmatter · `exclude_commands` add · hook uninstall) and it is **tested** to work.
3. **Given** the ADR index, **When** 011 lands, **Then** ADR-0022 appears with a status (Proposed → owner
   homologates → Accepted), consistent with the E5/ADR-0021 pattern.

### US6 — MCP + auto-load secondary levers (lower priority) — **P3 (droppable)**
As **the orquestrador**, I *might* trim the secondary context leaks the sweep flagged (`tokenoptimization.md`
§C.4): pinning `playwright`/`chrome-devtools` MCP off `@latest` for reproducibility (only `qa-produto` needs a
browser), and watching the CLAUDE.md auto-append size. These are **minor** and **awkward** in Claude Code today.

**Acceptance scenario**: **Given** the §C.4 levers, **When** the epic has budget after US1–US5, **Then** the MCP
version pinning and auto-load trim are evaluated; **otherwise** they are explicitly deferred to the backlog with
a note. *(P3 = droppable without leaving the epic incoherent — the three primary levers carry the value.)*

---

## 6. Success criteria (measurable, technology-agnostic)

- **SC-001**: 100% of the 11 agents' `model` frontmatter matches the ratified Part-C.2 routing table; every
  downgrade is a one-line diff and CLAUDE.md carries the delegation + pricing-domain escalation rules.
- **SC-002**: rtk filters filterable Bash command output for **every** subagent, and **0** of {exit codes,
  generated artifacts, what CI executes} change — verified by a before/after `gate:all` whose conclusion and
  actionable errors are identical.
- **SC-003**: On a **failed** command, 100% of the integral output is recoverable from the `tee: failures` store;
  graphify/gh/curl output passes through unfiltered (`exclude_commands`).
- **SC-004**: **Zero** quality regressions attributable to a model downgrade across the E5 pilot — every slice's
  homologation is PASS (or PASS-with-nits with no honesty defect) and `gate:all` is green; a genuine regression
  triggers that layer's documented rollback.
- **SC-005**: `graphify hook install` rebuilds the graph on commit (0 LLM tokens, AST-only), ADR-0014 is amended
  to reflect it, and the AI close-out procedure survives as the documented fallback net.
- **SC-006**: Each E5 slice has **one** ledger row (estimate → actual + `rtk gain`); the reported saving is the
  **measured effective** figure with the Sonnet-tokenizer (~+30%) and intro-rate-expiry (2026-08-31) caveats
  disclosed — **no** sticker or marketing number is presented as the result.
- **SC-007**: Measured **effective** cost/slice on the E5 pilot is **≥30% lower** (Q3) than its E4 comparable,
  with no quality regression (SC-004) — **or** the shortfall is reported honestly with the responsible lever
  identified, never rounded up to a pass.
- **SC-008**: ADR-0022 exists with ≥3 options + confidences, links from the plan's Constitution Check, and
  carries a per-layer rollback playbook, each rollback **verified** to be a one-line reversal.
- **SC-009**: `pnpm gate:all` stays byte-identical in lefthook and CI (zero local↔CI drift); the ledger remains
  the authoritative cost record with `rtk gain` as labeled auxiliary telemetry.
- **SC-010**: All E1–E4 shipped guarantees and the E5 acceptance criteria pass **unchanged** — 011 alters the
  **cost of producing** software, never the software.

---

## 7. Scope boundaries

### IN
- **Per-agent model routing** (re-pin per Part-C.2) + CLAUDE.md delegation rule + `dev-estrutura-de-dados`
  pricing-domain escalation.
- **rtk** Bash-output filtering: native Windows hook, `exclude_commands` (graphify/gh/curl), `tee: failures`.
- **graphify `hook install`** (auto-rebuild on commit, replacing the best-effort `post-merge`) + optional
  pilot-only query-log.
- **Measurement loop**: E4 baseline + one ledger row per E5 slice (estimate → actual + `rtk gain`) + the ≥30%
  criterion + per-layer rollback triggers.
- **ADR-0022** (amends ADR-0014's refresh clause) + the rollback playbook.
- *(P3, droppable)* MCP version-pinning + CLAUDE.md auto-load trim (§C.4 secondary levers).

### OUT (guarding the boundary)
- **Runtime-LLM optimizations** — prompt caching, Batch API, the advisor tool — apply only **if/when the app
  itself calls an LLM** (the parked D1–D4 ML ingestion, blocked on the house account, Q-D). OUT until then;
  documented for §C.5 revival, not built now.
- **graphify strict mode** — consciously deferred (too aggressive for active development). Only `hook install` +
  optional query-log are IN.
- **Any change to `pnpm gate:all`**, its exit codes, its generated artifacts, or what CI executes — the gate is
  sacred (D4). rtk touches only the model's **view**, never the run.
- **The Instagram post's headline numbers** (BrowseComp $/accuracy, advisor "92%/63%") — dismantled by the sweep;
  011's success is measured from **our** ledger, never those figures.
- **Deep MCP re-scoping** (scoping a browser MCP away from non-browser agents) — awkward in Claude Code today
  (§C.4); at most the P3 version-pin, not a re-architecture.
- **A new agent, a new workflow engine, or a rewrite of the fan-out review tooling** — 011 re-prices and
  de-noises the **existing** roles; the review-workflow lessons (cap `achados × refutadores`, worktree isolation,
  three verdict states) are already in the ledger and are **not** re-litigated here.
- **App features / freemium changes / E5 scope** — 011 ships no end-user behavior; E5's content is untouched.
- **Public deploy** — still deferred to v1 = E1–E6 (owner rule, revisitable).

---

## 8. Recommended slicing (owner-authorized, slice by slice — E2/E3/E4/E5 pattern)

- **PR-A — Routing (US1) + governance skeleton (US5 partial).** Re-pin the 11 agents, add the CLAUDE.md
  delegation + escalation rules, draft ADR-0022 (Proposed) with the routing decision + rollback playbook.
  *Demoable alone, and the cheapest, most-reversible lever — one-line diffs, instantly revertible. Lands first so
  the E5 slices that follow already run under the new price/token.* (85%)
- **PR-B — rtk (US2) + graphify hook (US3) + ADR-0022 finalized (US5).** Wire the rtk Windows hook +
  `exclude_commands` + `tee: failures`; install the graphify hook and amend ADR-0014; complete ADR-0022. *This is
  the tokens/call + number-of-calls lever, and where the CI-boundary risk lives — prove `gate:all` conclusion and
  exit codes are untouched.*
- **PR-C — Measurement + pilot verdict (US4).** Fix the E4 baseline, add the per-slice ledger rows across E5's
  PR-A/B/C, and render the ≥30%-or-honest-shortfall verdict with the effective-saving caveats. *The meter; the
  natural place the epic's honesty lives — it can only close after E5's slices have run under the new regime.*

Rationale for the order: routing is the cheapest and most reversible, so it goes first and starts saving
immediately; rtk + graphify carry the CI-boundary risk and need their own homologation; measurement is last
because it depends on E5 slices actually running under the new regime. *(P3 US6 rides whichever PR has budget, or
is deferred.)*

---

## 9. Technical unknowns to route to the arquiteto / devops (not product calls)

1. **rtk config shape + hook mechanics on Windows.** The exact `~/.config/rtk/config.toml` keys, how the native
   hook (v0.37.2+) intercepts each subagent's Bash, the precise `exclude_commands` regexes for graphify/gh/curl,
   and how `tee: failures` names/rotates its store — devops' call, verified against installed rtk, not assumed.
2. **Filter-safety proof for `gate:all`.** How to demonstrate that rtk's reduced view preserves the pass/fail
   conclusion and every actionable error (a diff of raw-vs-filtered runs, incl. a deliberately failing run) —
   the load-bearing §4 boundary evidence.
3. **graphify hook vs the lefthook `post-merge` net.** Whether `hook install` fully replaces or coexists with the
   existing best-effort hook, how ff-pulls are covered, and the exact ADR-0014 amendment wording — arquiteto +
   devops, per Principle VIII.
4. **The E5 comparability question (feeds Q3).** Which E4 ledger rows are the fair baseline for each E5 slice
   (fan-out review vs homologation vs implementation are different shapes), and how to normalize for E5 being a
   persistence epic vs E4's export/offline machinery — so the ≥30% comparison is apples-to-apples, not confounded.
5. **`effort` interaction with routing.** Whether any `sonnet` executor should also cap `effort` (the sweep warns
   Sonnet at **xhigh** can cost more than Opus), and whether the interactive session's own effort default is in
   scope — arquiteto's call, measured on the pilot.

---

## 10. Open questions — owner decisions (→ `/speckit-clarify`)

| # | Decision | Options | Recommendation (confidence) |
|---|---|---|---|
| **Q1** | **`designer-ux` — re-pin to `sonnet` or keep `opus`?** (the borderline row) | (a) **`sonnet`** (treat wireframe-level UX as routine execution) · (b) **keep `opus`** (value the extra design judgment) · (c) `sonnet` **now**, escalate to `opus` per-invocation for a high-stakes design round | **(a) with a fallback to (c)** (60%). The sweep rates this `low` confidence and explicitly says "keep opus if you value the extra design judgment". `designer-ux` produces handoffs that shape whole surfaces (E4's sync-state vocabulary, E5's four-object IA) — genuine judgment. **Recommend piloting (a) on E5 and reverting per (c) if a design round regresses** — it is a one-line rollback. Owner's aesthetic bar is the deciding input; flag to `/speckit-clarify`. |
| **Q2** | **rtk hook scope — global (`-g`) or per-project?** | (a) **global** (`rtk init -g --hook-only`) — one install, every session/project benefits · (b) **per-project** — scoped to 3dprecify only · (c) global hook, project-scoped `exclude_commands` | **(a)** (65%). The token bill is per-account across all the owner's Claude Code work, and the sweep's install command is the global one. But a global hook silently filters **other** projects' commands too, which may surprise the owner elsewhere — hence flagged. (c) is the hedge if the owner wants global reach but project-tuned excludes. |
| **Q3** | **The acceptance threshold** — is ≥30% cost/slice the right bar? | (a) **≥30%** (proposed) · (b) a **softer ≥20%** (accounts for Sonnet's ~30%-heavier tokenizer eating the sticker) · (c) **no fixed %** — report the measured effective saving + any quality delta and let the owner judge per slice | **(a) as the target, (c) as the reporting discipline** (65%). 30% is a credible net after the tokenizer haircut on a mostly-executor workload, but a **single** pilot epic is noisy (Risk R4). Recommend committing to (a) as the goal while **always** reporting per (c), so a 25% honest result is a data point, not a failure to hide. |
| **Q4** | **Does 011 ship before E5, as the pilot?** (confirms D0) | (a) **yes** — 011 first, E5 slices are the measurement · (b) **no** — run E5 on the current opus regime, apply 011 to E6 | **(a)** (85%). E5 is next in line and its slices are the natural, imminent workload to measure; deferring wastes the biggest measurable epic left before E6. The only cost of (a) is 011's own (small) spend landing before E5 — reversible per layer. |
| **Q5** | **graphify query-log — keep after the pilot?** | (a) **pilot-only**, then decide from its value · (b) **keep permanently** · (c) **skip entirely** | **(a)** (70%). The log's whole point is to prove graph-first cut Grep/Read calls **during** the pilot; keeping it permanently adds noise/overhead for a question already answered. Decide keep-vs-drop from the pilot data. |
| **Q6** | **ADR numbering for the governance record.** | (a) **ADR-0022** (next free — 0021 is E5's scenario ADR) · (b) fold into an existing ADR · (c) two ADRs (routing vs tooling) | **(a) ADR-0022** (85%). 0021 is already claimed by E5 (`docs/adr/README.md`); 0022 is the natural next. One ADR keeps the three-lever cost model + its ADR-0014 amendment coherent in one place; splitting (c) fragments the rollback playbook. Low-controversy — flag only for the owner's numbering sign-off. |
| **Q7** | **`effort` cap on the `sonnet` executors** (feeds §9.5) | (a) **no cap** — `sonnet` at default effort · (b) **cap `effort: medium`** on the executors (guard against xhigh costing more than opus) · (c) per-role tuning measured on the pilot | **(c) → (b)** (55%, low). The sweep warns Sonnet at xhigh can exceed Opus, but capping too hard can starve a genuinely hard executor task. Recommend measuring on the pilot and applying a `medium` cap only where the data shows a task drifting to high effort. Genuinely uncertain — a good `/speckit-clarify` item. |

---

## 11. Dependencies

- **The ledger (`docs/token-ledger.md`)**: supplies the **E4 baseline** (the PR-A/B/C fan-outs + homologations,
  e.g. E4 kickoff 91,786; E5 kickoff 100,766; the review fan-outs 668k–4,87M; the homologations 168k–280k) and is
  the authoritative sink for the per-E5-slice measurement rows. The owner's 2026-07-10 estimate→actual→lesson
  rule governs 011's own operations.
- **ADR-0014** (graphify maintenance): 011's US3/US5 **amend** its refresh-hook clause (best-effort `post-merge`
  → `graphify hook install`); the AI close-out procedure survives as the documented fallback net.
- **The 11 agents in `.claude/agents/`**: the audited Part-C.2 routing table is the exact re-pin target; the
  one-line diffs are ready in `tokenoptimization.md` §C.3.
- **CLAUDE.md**: gains the delegation + pricing-domain escalation rules (§C.3 proposed snippet); its auto-load
  footprint is the P3 §C.4 secondary lever.
- **`pnpm gate:all` / CI (D4)**: the sacred boundary rtk must not cross — the primary homologation evidence for
  PR-B is that the gate's conclusion, exit codes, and generated artifacts are untouched.
- **E5 (010, `feature/010-e5-saved-scenarios`)**: the **pilot workload** — its PR-A/B/C implementation slices run
  under the 011 regime and are what SC-006/SC-007 measure. 011 must land before E5's coding slices for the pilot
  to be valid (Q4/D0).
- **Primary source**: `C:\Users\Jonatan\Downloads\tokenoptimization.md` — the fact-checked sweep (Part C.2 routing
  table, C.3 ready diffs, caveats on the Sonnet tokenizer + intro-rate expiry). The rtk + graphify upstream repos
  are the tool references for devops (§9).
