# Feature Specification: Token-Cost Optimization of the Dev Workflow (011)

**Feature Branch**: `011-token-optimization`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "Token-cost optimization do workflow de desenvolvimento (feature 011-token-optimization), a ser implementada ANTES do E5. Integra três alavancas ortogonais de custo mais um medidor: (1) roteamento de modelos por subagente; (2) rtk filtrando output de Bash antes do contexto do modelo; (3) graphify hook install (rebuild determinístico do grafo no commit); (4) medição via token-ledger com baseline E4 e piloto E5. Produz ADR-0022 (emendando ADR-0014). Fora de escopo: prompt caching/Batch API/advisor, graphify strict mode, mudanças no gate literal pnpm gate:all."

**Primary scope source**: `docs/product/011-token-optimization-scope-brief.md` (product-owner, 2026-07-18) ·
research: `C:\Users\Jonatan\Downloads\tokenoptimization.md` (fact-checked sweep, primary-sourced)

> **Nature**: internal **development-infrastructure** increment. It ships **zero** end-user behavior — no story
> touches `apps/`, `backend/`, `packages/`, any spec's FRs, or the freemium split. What changes is the **cost of
> producing** software: which model each subagent role runs on, what a Bash tool-call is allowed to feed into the
> model's context, when the knowledge graph rebuilds, and how each E5 slice's cost is measured. The governing
> identity (the epic's centerpiece): **custo = (preço/token) × (tokens/chamada) × (nº de chamadas)** — three
> orthogonal levers that compose multiplicatively, plus the ledger as the meter that keeps them honest.

## Clarifications

### Session 2026-07-19

- Q: US3's "honest boundary" premise — does a fast-forward `git pull` on `develop` really fire no local
  hook? → A: **Measured FALSE on this machine** (git 2.45.1, `pull.rebase=false`): `post-merge` DOES fire
  on a ff pull (scratch-repo proof with a marker hook, dod-evidence §3) — the "may not fire" line was a
  never-tested hedge inherited from the old script. **Owner decision (2026-07-19): Option A** — re-declare
  the lefthook `post-merge` net (block + resurrected `scripts/graph-refresh.sh`, guarded to `develop`,
  non-fatal) as the deterministic merge-path complement to the graphify hooks; ADR-0022 §Amendment
  addendum + ADR-0014 Revision correction carry it. Boundary: `git pull --rebase` fires no `post-merge`
  (config today is `pull.rebase=false`; adopting pull-rebase is the re-open trigger).

### Session 2026-07-18

- Q: Pilot acceptance threshold (SC-007) — ≥30%, ≥20%, or no fixed %? → A: **≥30% as the target, with the
  measured-effective figure always reported** (an honest shortfall is a data point, not a hidden failure; no
  automatic rollback on a miss — the owner judges with the caveats disclosed).
- Q: Does 011 ship before E5, with E5 as the measurement pilot (D0/Q4)? → A: **Yes** — settled by the owner's
  original directive ("implementar essas alterações antes da próxima feature", 2026-07-18).
- Q: Filter-hook scope — global (`-g`) or project-scoped? → A: **Project-scoped (this repo only)** — owner chose
  against the global recommendation: no silent filtering of other projects; the plan phase must verify the
  per-project install mechanics on Windows (flagged as a technical unknown, brief §9.1).
- Q: `designer-ux` — re-pin to the mid-tier model or keep the top model (Q1, the borderline row)? → A: **Keep
  `opus`** — the owner values the design judgment (E4's sync-state vocabulary, E5's four-object IA were
  designer-ux handoffs); the re-pin set is therefore the 6 executors + `qa-produto`, and `designer-ux` joins the
  judgment roles as a stakeholder of the quality guardrail.
- Q: Effort cap on the mid-tier executors (Q7 — the research warns the mid-tier model at xhigh effort can cost
  MORE than the top model)? → A: **Cap `effort: medium` from the start on all 6 re-pinned executors** — the
  cheap-worker regime is guaranteed from slice 1; if a genuinely hard executor task is throttled, the remedy is
  the documented one-line revert (remove the cap or escalate that invocation), and the pilot's ledger rows will
  show whether the cap ever bites.

## User Scenarios & Testing *(mandatory)*

*Personas are internal operators of the dev workflow: **o dono** (Jonatan — pays the token bill, authorizes every
merge), **o orquestrador** (the main interactive session that plans and fans out), **os subagentes executores**
(`dev-*`, `devops`, `qa-software`, `scrum-master`), **os agentes de QA** (`qa-produto`). Judgment roles
(`arquiteto`, `seguranca`, `product-owner`) are stakeholders of the quality guardrail, not targets of any
downgrade.*

### User Story 1 - Route each agent to the cheapest model that does its job (Priority: P1) [FOUNDATIONAL]

As the dono paying the bill, I want each subagent pinned to the cheapest model that does its role's work — so
routine, spec-driven execution stops billing at top-model rates while judgment work keeps its full reasoning.
Executors (`dev-backend`, `dev-frontend`, `dev-estrutura-de-dados`, `devops`, `qa-software`, `scrum-master`)
re-pin to the mid-tier model **with a medium effort cap** (ratified, see Clarifications); the observation-only agent (`qa-produto`) re-pins to the smallest model with low
effort; judgment roles (`arquiteto`, `seguranca`, `product-owner`) **and `designer-ux`** (ratified, see
Clarifications) stay on the top model.
The main session gains a written delegation rule, plus an escalation rule sending pricing-domain data-model work
back to the top model.

**Why this priority**: It is the cheapest, most reversible lever (one-line frontmatter diffs) and the largest
single price cut; landing it first means every subsequent 011/E5 operation already runs at the new price/token.

**Independent Test**: Inspect the 11 agent definitions and the workflow instructions file; every `model`/`effort`
value matches the ratified routing table, the delegation + escalation rules are present, and reverting any single
agent is demonstrably a one-line change.

**Acceptance Scenarios**:

1. **Given** the 11 agent frontmatters, **When** 011 lands, **Then** each agent's `model` (and `effort`, where
   ratified) matches the routing table exactly, and every downgrade is a reviewable one-line diff.
2. **Given** the main session about to delegate routine, spec-driven reads/edits, **When** it consults the
   workflow instructions, **Then** a delegation rule routes them to a cheaper worker and keeps
   planning/architecture/security/final-review on the top model.
3. **Given** a task touching the **pricing domain** model, **When** it would fall to `dev-estrutura-de-dados`,
   **Then** the escalation rule sends it to the top model (the one place a schema change carries pricing risk).
4. **Given** any re-pinned agent, **When** the dono wants it back on the top model, **Then** the revert is a
   single frontmatter line — no code, no migration, no ADR rewrite.
5. **Given** the pilot's quality guardrail, **When** a re-pinned agent produces an E5 slice, **Then** homologation
   verdict + `gate:all` are the quality gate — a downgrade causing a real regression is a rollback signal, not an
   accepted cost.

---

### User Story 2 - Filter command output before it reaches the model (Priority: P1)

As the orquestrador, I want a command-output filter (rtk) between Bash execution and my context window — so a
passing 200-line test run costs a one-line summary, while a failure keeps its full output recoverable on disk.
The filter operates strictly downstream of execution: exit codes, generated artifacts, and what CI runs are
untouched. Structured/load-bearing commands (graphify, gh, curl) are excluded by design.

**Why this priority**: Tokens-per-call is the second-largest leak (gate/test/diff output lands integrally today),
and it multiplies across every subagent's Bash calls. Carries the epic's main risk (filtered view hiding a
signal), so it needs its own homologation slice.

**Independent Test**: Run a filterable command with the hook active and compare raw vs filtered views — the
pass/fail conclusion and actionable errors must be preserved; force a failure and recover the integral output
from the on-disk store; run an excluded command and observe pass-through.

**Acceptance Scenarios**:

1. **Given** the filter hook installed for this Windows environment, **When** a subagent runs a filterable Bash
   command, **Then** the model receives a reduced view while the command's exit code, generated files, and what
   CI executes are unchanged.
2. **Given** failure-preservation mode (`tee: failures`), **When** a command fails, **Then** its integral output
   is preserved on disk so no debugging signal is lost to filtering.
3. **Given** the exclusion list, **When** a subagent runs graphify, gh, or curl, **Then** their output passes
   through untouched.
4. **Given** a command whose filtered view proves too aggressive, **When** the dono wants it spared, **Then**
   sparing it is a one-line exclusion add, and removing the filter entirely is a hook teardown.
5. **Given** a filtered `gate:all` run compared against a raw run (including a deliberately failing run),
   **When** the reduced view is inspected, **Then** the pass/fail conclusion and every actionable error are
   preserved — the filter never turns a real failure into an apparent pass (the honesty guard).

---

### User Story 3 - Keep the knowledge graph fresh automatically (Priority: P2)

As the orquestrador and the executors relying on graph-first navigation (ADR-0014), I want the graph to rebuild
deterministically on every local commit — so structural search stays accurate without depending on the
best-effort `post-merge` hook that guards freshness today. (Honest boundary, settled at plan: a remote
squash-merge arriving via fast-forward pull fires no local hook — that path stays with the documented AI
close-out procedure, unchanged from today.)

**Why this priority**: The number-of-calls lever is already mostly captured by ADR-0014; this closes its known
freshness gap. Valuable but not foundational — the manual/AI refresh procedure remains a working fallback.

**Independent Test**: Land a commit and observe the graph rebuild without manual action (AST-only, ~20s, 0 LLM
tokens); uninstall the hook and confirm the documented fallback procedure still governs.

**Acceptance Scenarios**:

1. **Given** the graph auto-rebuild hook installed, **When** a commit lands, **Then** the graph rebuilds
   deterministically, replacing the best-effort `post-merge` net as the primary freshness mechanism.
2. **Given** ADR-0014's refresh clause, **When** ADR-0022 lands, **Then** ADR-0014 is amended (not silently
   superseded) to name the new hook as the refresh mechanism, with the AI close-out procedure documented as the
   fallback net.
3. **Given** an optional query-log enabled for the pilot only, **When** the pilot ends, **Then** the log's value
   (did graph-first actually cut Grep/Read calls?) is reported and keep-vs-drop is a conscious decision (Q5).
4. **Given** the hook, **When** the dono wants it gone, **Then** uninstalling falls back to the ADR-0014
   manual/AI-procedure refresh.

---

### User Story 4 - Prove the saving on E5, per slice, against the E4 baseline (Priority: P1)

As the dono, I want each E5 slice's cost measured in the ledger and compared to its E4 comparable — so the
epic's success is a measured ≥30% (Q3) effective cost-per-slice reduction with no quality regression, never a
sticker claim or a marketing number. The ledger stays authoritative; the filter's own savings telemetry is
auxiliary and labeled as such.

**Why this priority**: Without the meter, the other three levers are folklore. The owner's standing ledger rule
(2026-07-10) already mandates estimate → actual → lesson; this story extends it into a controlled comparison.

**Independent Test**: After the pilot, the ledger contains one labeled baseline (E4 comparables) plus one row per
E5 slice with estimate → actual + telemetry snapshot, and a slice verdict computed from measured effective cost
— reproducible by anyone reading the ledger alone.

**Acceptance Scenarios**:

1. **Given** the E4 slices already recorded in the ledger, **When** the pilot starts, **Then** a baseline is
   fixed from the comparable E4 rows and labeled as the comparison basis.
2. **Given** each E5 slice, **When** it completes, **Then** the ledger gains one row with estimate → actual and a
   savings-telemetry snapshot, per the owner's 2026-07-10 rule.
3. **Given** the acceptance threshold, **When** a slice's measured effective cost is compared to its E4
   comparable, **Then** the criterion is cost/slice ≥30% lower (Q3) with no quality regression (homologation
   PASS + `gate:all` green + no new honesty defect).
4. **Given** the mid-tier model's ~30%-heavier tokenizer and the 2026-08-31 intro-rate expiry, **When** the
   saving is reported, **Then** it is the measured effective saving with those caveats disclosed — never the
   sticker ratio.
5. **Given** a slice that regresses quality or misses the threshold, **When** the pilot reviews it, **Then** the
   per-layer rollback triggers (US1/US2/US3) are the documented remedy — the epic degrades one lever at a time,
   and a shortfall is reported honestly, never rounded up to a pass.

---

### User Story 5 - Govern every change with ADR-0022 + a rollback playbook (Priority: P2)

As the dono under the Constitution (Principle VIII — nothing inferred), I want every standing-standard change —
per-agent model, delegation rule, output filter, graph hook — captured in ADR-0022 (≥3 options with
pros/cons/scalability/confidence), amending ADR-0014's refresh clause, with a one-line-per-layer rollback
playbook, so any lever can be reversed without archaeology.

**Why this priority**: Governance is mandatory (constitutional), but it rides the substantive slices rather than
standing alone; drafted with US1, finalized with US2/US3.

**Independent Test**: ADR-0022 exists in the ADR index with the E-pattern lifecycle (Proposed → owner homologates
→ Accepted), presents ≥3 options, links the ADR-0014 amendment, and each rollback line has been exercised once.

**Acceptance Scenarios**:

1. **Given** the standards 011 changes, **When** ADR-0022 is written, **Then** it presents ≥3 options with
   pros/cons/scalability/confidence and is linked from the plan's Constitution Check; ADR-0014 is amended, not
   silently superseded.
2. **Given** the rollback playbook, **When** any lever misbehaves, **Then** the playbook states the exact
   one-line reversal (re-pin frontmatter · exclusion add · hook uninstall) and each has been verified to work.
3. **Given** the ADR index, **When** 011 lands, **Then** ADR-0022 appears with its status consistent with the
   E5/ADR-0021 pattern.

---

### User Story 6 - Secondary context-leak trims (Priority: P3, droppable)

As the orquestrador, I might trim the secondary leaks the research flagged: pinning the two browser-automation
MCP servers off `@latest` (reproducibility; only `qa-produto` needs a browser), and watching the instructions
file's auto-load footprint. Minor and awkward in the current tooling; droppable without leaving the epic
incoherent.

**Why this priority**: The three primary levers carry the value; these are hygiene.

**Independent Test**: Either the version pins land (and sessions still drive the browser normally), or the item
is explicitly deferred to the backlog with a note.

**Acceptance Scenarios**:

1. **Given** the secondary levers, **When** the epic has budget after US1–US5, **Then** MCP version pinning and
   the auto-load trim are evaluated; **otherwise** they are explicitly deferred with a note.

---

### Edge Cases

- **Filtered view hides the debugging signal on a *passing* command** (failure-preservation only covers
  failures): the honesty guard (US2.5) requires the reduced view to preserve actionable content; a command where
  it doesn't is spared via the one-line exclusion.
- **A "flaky-looking" e2e failure under filtering**: the repo's known orphan-server trap (stale `:4173` preview)
  must remain diagnosable — the integral output on disk is the escape hatch; the ADR documents where to find it.
- **The mid-tier model at high effort costing *more* than the top model** (the research's warning): closed by
  the ratified `effort: medium` cap on all 6 executors; the residual edge is a genuinely hard task being
  throttled — remedied per-invocation (escalate or lift the cap), visible in the pilot's ledger rows.
- **A pricing-domain schema task slipping to a cheap executor**: the escalation rule (US1.3) is the guard; a slip
  discovered in review is treated as a routing defect, not a model defect.
- **Graph rebuild hook slowing or blocking commits**: rollback is hook uninstall; the fallback refresh procedure
  (ADR-0014) resumes as primary.
- **E4-vs-E5 comparability is confounded** (different epic shapes): the baseline must name which E4 rows are the
  fair comparable per slice shape (kickoff / implementation / review fan-out / homologation) — a mismatched
  comparison is reported as such, not forced into the threshold.
- **Two sources of cost truth diverge** (ledger vs filter telemetry): the ledger wins by rule; telemetry is
  labeled auxiliary.
- **The filter hook leaking beyond this project**: scope is ratified as project-only (Clarifications) — an
  install that turns out to filter other projects' sessions is a defect against that decision, not a variant.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The 11 subagent definitions MUST carry the ratified per-role model routing: the 6 executors on the
  mid-tier model **with `effort: medium`**, the observation-only QA agent on the smallest model with low effort,
  judgment roles **and `designer-ux`** unchanged on the top model — each change a one-line-per-field,
  individually revertible diff.
- **FR-002**: The workflow instructions MUST carry (a) a delegation rule routing routine, spec-driven work to
  cheaper workers and keeping planning/architecture/security/final-review on the top model, and (b) an
  escalation rule sending pricing-domain data-model work to the top model.
- **FR-003**: A command-output filter MUST reduce filterable Bash output before it enters the model's context,
  operating strictly downstream of execution: exit codes, generated artifacts, and what CI executes are
  byte-identical with and without the filter.
- **FR-004**: On command failure, the filter MUST preserve the integral output on disk, discoverable by agents
  (path documented in the governance record).
- **FR-005**: The filter MUST honor an exclusion list (at minimum: graphify, gh, curl) whose entries pass
  through unfiltered; adding an exclusion MUST be a one-line change.
- **FR-006**: The filter's reduced view MUST preserve the pass/fail conclusion and actionable errors of every
  filtered command — demonstrated by a raw-vs-filtered comparison including a deliberately failing `gate:all`
  constituent (the honesty guard).
- **FR-007**: The knowledge graph MUST rebuild deterministically on commit via the upstream hook (0 LLM tokens),
  with the previous best-effort mechanism retired from primary duty and the manual/AI refresh procedure retained
  as the documented fallback.
- **FR-008**: ADR-0014 MUST be amended (not silently superseded) to name the new refresh mechanism; ADR-0022
  MUST record all 011 standard changes with ≥3 options and a per-layer rollback playbook, each rollback verified
  as a one-line (or single-command) reversal.
- **FR-009**: The ledger MUST gain a labeled E4 baseline before the pilot and one row per E5 slice
  (estimate → actual + savings-telemetry snapshot); the ledger remains the authoritative cost record, filter
  telemetry auxiliary.
- **FR-010**: The pilot verdict MUST be computed from measured effective cost against the E4 comparable at the
  ratified threshold (≥30%, Q3), with tokenizer (~+30%) and intro-rate-expiry (2026-08-31) caveats disclosed; a
  shortfall is reported honestly with the responsible lever identified.
- **FR-011**: The literal `pnpm gate:all` command MUST remain byte-identical in lefthook pre-push and the CI gate
  job (zero local↔CI drift); nothing in 011 changes what the gate executes.
- **FR-012**: An optional graph query-log MAY run during the pilot only; its keep-vs-drop is decided from pilot
  data (Q5), never left on by default.
- **FR-013** *(P3, droppable)*: The two browser-automation MCP registrations MAY be version-pinned off `@latest`;
  if dropped, the deferral is recorded with a note.

### Key Entities

- **Routing table**: the per-agent model/effort assignment (11 rows) — the ratified form of the research's
  Part-C.2 table; lives in the agent definitions, governed by ADR-0022.
- **Delegation + escalation rules**: the workflow-instructions clauses telling the main session what to send
  where, and when to send pricing-domain work back up.
- **Output-filter policy**: the filter's exclusion list + failure-preservation mode + the honesty guard; the
  boundary between "what the model sees" and "what actually ran".
- **Graph refresh hook**: the deterministic on-commit rebuild replacing the best-effort net; amends ADR-0014.
- **Ledger baseline & slice rows**: the labeled E4 comparables + one measurement row per E5 slice — the meter.
- **Rollback playbook**: the per-layer one-line reversals (re-pin · exclusion add · hook uninstall) in ADR-0022.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the 11 agents match the ratified routing table; every downgrade is a one-line diff; the
  delegation + escalation rules are present in the workflow instructions.
- **SC-002**: With the filter active, 0 changes to {exit codes, generated artifacts, what CI executes} — verified
  by a before/after `gate:all` whose conclusion and actionable errors are identical.
- **SC-003**: On a failed command, 100% of the integral output is recoverable from the failure store; excluded
  commands (graphify/gh/curl) pass through unfiltered.
- **SC-004**: Zero quality regressions attributable to a model downgrade across the E5 pilot — every slice's
  homologation is PASS (or PASS-with-nits with no honesty defect) and `gate:all` green; a genuine regression
  triggers that layer's documented rollback.
- **SC-005**: The graph rebuilds on commit with 0 LLM tokens; ADR-0014 is amended accordingly; the fallback
  refresh procedure survives in the documentation.
- **SC-006**: Each E5 slice has exactly one ledger row (estimate → actual + telemetry snapshot); every reported
  saving is the measured effective figure with the tokenizer and intro-rate caveats disclosed.
- **SC-007**: Measured effective cost/slice on the E5 pilot is ≥30% (Q3) lower than its E4 comparable with no
  quality regression — or the shortfall is reported honestly with the responsible lever identified.
- **SC-008**: ADR-0022 exists with ≥3 options + confidences and a per-layer rollback playbook, each rollback
  verified as a one-line reversal.
- **SC-009**: `pnpm gate:all` stays byte-identical in lefthook and CI; the ledger remains the authoritative cost
  record with filter telemetry as labeled auxiliary.
- **SC-010**: All E1–E4 shipped guarantees and E5's acceptance criteria pass unchanged — 011 alters the cost of
  producing software, never the software.

## Assumptions

Working defaults carried from the product-owner brief (§10) pending `/speckit-clarify` — each is the brief's
recommendation, not an inference (Principle VIII: the clarify step puts them to the owner as dated decisions):

- ~~Q1~~ **ratified 2026-07-18**: `designer-ux` **keeps the top model** (owner values the design judgment); the
  re-pin set is the 6 executors + `qa-produto`.
- ~~Q2~~ **ratified 2026-07-18**: the filter hook is **project-scoped** (this repo only); other projects stay
  unfiltered by owner choice; per-project install mechanics on Windows are a plan-phase verification item.
- ~~Q3~~ **ratified 2026-07-18**: ≥30% is the target; the reporting discipline always states the measured
  effective figure (see Clarifications).
- ~~Q4~~ **ratified 2026-07-18**: 011 ships before E5, and E5's slices are the measurement pilot (see
  Clarifications).
- **Q5 default**: graph query-log is pilot-only.
- **Q6 default**: the governance ADR is numbered ADR-0022 (0021 is E5's).
- ~~Q7~~ **ratified 2026-07-18**: `effort: medium` cap on all 6 mid-tier executors from the start; the pilot
  watches for throttling of genuinely hard tasks.
- The E4 ledger rows are rich enough to name a fair comparable per E5 slice shape; where they are not, the
  comparison is labeled partial rather than forced.
- The upstream tools (rtk ≥ v0.37.2 native Windows hook; graphify upstream hook) work as documented on this
  Windows 11 + PowerShell environment; verifying this is the plan phase's job, not assumed shipped.
- No runtime LLM exists in the product today (audited); all runtime levers (caching, batch, advisor) stay parked
  with D1–D4 (Q-D) and are out of scope.
