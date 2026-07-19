# Token-Cost Optimization — Techniques + How to Apply Them in This Repo

> **Status: RECOMMENDATIONS — OPEN (decide with Jonatan before applying).** Per Constitution
> **Principle VIII** (no inferring architecture/standards), the config changes proposed in Part C are
> *proposals with ready-to-apply diffs*, not defaults already taken. Sourced from a fact-checked internet
> sweep (deep-research: 5 angles → 19 sources → 52 claims → 25 adversarially verified, 3-vote). All pricing
> current as of **2026-07-17**. `conf` = verification confidence.

## TL;DR

1. **This repo makes _no_ LLM API calls at runtime** — `grep` across `apps/`, `backend/`, `packages/` finds
   only test mocks. So "token spend in this repo" is **your Claude Code development cost**, not a production
   API bill. The Instagram post's advice (subagents, model delegation, effort) is therefore *exactly* the
   right lens; runtime techniques (caching, Batch API, RAG) only become relevant if/when the app itself calls
   an LLM (e.g. the parked D1–D4 ML ingestion).
2. **The repo is currently configured the opposite way the post recommends:** all **11 subagents are pinned
   to `model: opus`**, **none set `effort`**, and CLAUDE.md gives the main model no delegation guidance.
3. **The post's _architecture_ is real and officially documented** (orchestrator-worker, advisor, cheap-model
   subagents, effort). **The post's _headline numbers_ are not corroborated** by any primary Anthropic source
   and should be treated as unverified marketing.
4. **Highest-leverage change here:** re-pin routine executor/QA agents to `sonnet` (and `qa-produto` to
   `haiku` + `effort: low`), keep planning/judgment agents on `opus`, and add a one-paragraph delegation rule
   to CLAUDE.md. Sonnet 5 is ~1.7x cheaper/token than Opus 4.8 at standard rates (~2.5x at intro rates);
   Haiku 4.5 is ~5x cheaper.

---

## Part A — Verified token-optimization techniques (primary-sourced)

Every technique below was confirmed 3-0 in adversarial verification against Anthropic primary docs.

### 1. Prompt caching — highest per-token lever for repeated context (conf: high)
A cache **read (hit) costs 0.1x base input** (~90% cheaper than reprocessing). A **5-min cache write costs
1.25x**, a **1-hour write 2x** base input. Break-even is **one read** (5-min) or **two reads** (1-hour); it
cuts latency as well as cost. Each model keeps its own cache — this is the actual mechanism behind the post's
"repeated context doesn't pay full price twice" claim. Caveat: writes carry a premium, so caching only nets
out in the reuse regime.
Sources: [prompt-caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching),
[pricing](https://platform.claude.com/docs/en/about-claude/pricing).

### 2. Batch API — flat 50% discount (conf: high)
The Message Batches API charges **all** usage — input, output, special tokens — at **50% of standard prices**,
and **stacks with prompt caching**. Trade-off: asynchronous (up to 24h), so only for non-time-sensitive work.
Ratio holds across every model (e.g. Fable 5 batch $5/$25 vs $10/$50 standard).
Sources: [batch-processing](https://platform.claude.com/docs/en/build-with-claude/batch-processing), pricing.

### 3. Per-task model routing — the economic engine (conf: high)
Anthropic **explicitly** recommends: **Haiku** for simple tasks, **Sonnet** for most production workloads,
**Opus** only for the hardest reasoning. Sonnet 5 (launched 2026-06-30) is "close to Opus 4.8 … at lower
prices": intro **$2/$10** per MTok (through 2026-08-31), then **$3/$15**, vs Fable 5 **$10/$50** — ~5x cheaper
at intro, ~3.3x at standard. Caveats: (a) the 5x figure is the intro window; (b) Sonnet 5's newer tokenizer
emits **~30% more tokens** for the same text, so effective cost runs above the sticker rate; (c) at **xhigh**
effort Sonnet 5 can cost *more* than Opus 4.8 — "cheap worker" holds at **low/medium** effort.
Sources: pricing, [building-effective-agents](https://www.anthropic.com/research/building-effective-agents),
[claude-sonnet-5](https://www.anthropic.com/news/claude-sonnet-5).

### 4. Context engineering / window management (conf: high)
Because attention is a finite budget, the goal is the **smallest set of high-signal tokens** (fewer/better,
not more) — this doubles as a cost principle since fewer input tokens = less spend. Two concrete mechanisms:
(a) **sub-agents run focused work in isolated context windows** while the lead only synthesizes; (b)
**tool-result clearing** replaces old `tool_result` payloads with placeholders at **zero inference cost** (a
single clearing event shrank a message list ~67% in Anthropic's cookbook demo — a best-case figure, not a
guarantee).
Sources: [context-engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents),
[cookbook](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools).

### 5. Output reduction & effort (conf: high)
Cap `max_tokens`, prefer concise / structured output, and use the **`effort`** lever: low effort allocates
~1,000 or fewer thinking tokens (vs far more at higher levels), directly lowering cost on simple tasks.
Sources: [effort docs](https://platform.claude.com/docs/en/build-with-claude/effort),
[Claude Code costs](https://code.claude.com/docs/en/costs).

### 6. Long-context pricing is now flat (conf: high)
The full **1M-token window is billed at standard per-token rates** (no length surcharge) for Fable 5, Opus
4.6–4.8, Sonnet 5; caching + batch discounts apply across the whole window. A former >200K surcharge was
removed ~March 2026. (Opt-in Fast mode and `inference_geo:'us'` carry separate premiums — not a length
surcharge.)
Source: pricing.

---

## Part B — Verdict on the Instagram post (Evolving AI / @evolving.ai)

| # | Claim | Verdict |
|---|-------|---------|
| 1 | **Orchestrator-worker**: top model plans + fans out, cheap workers execute, bulk billed at the lower rate | **Pattern & cost mechanism CONFIRMED** (official: "Building Effective Agents", "Multi-agent research system"). **Exact numbers UNVERIFIED**: the BrowseComp figures ($18.53 / $16.01 / $40.56 per problem; 86.8% / 77.8% / 90.8%; "96% of performance at 46% of price") appear in **no** located primary source. Anthropic's own post uses Opus 4 / Sonnet 4 naming and has no per-problem cost table. |
| 2 | **Advisor (inverted)**: cheap executor every turn, calls top model on-demand (~1x/task); "92% of Fable 5 at 63% of price"; each helper keeps its own cache | **Pattern CONFIRMED** — real beta feature (`advisor_20260301`); executor tokens billed at executor rates, advisor iterations at advisor rates; per-advisor caching param exists. **"92%/63%" number is marketing-grade** (a @ClaudeDevs tweet, SWE-bench Pro); the advisor docs' own benchmark reports a *different* framing: **+2.7pp over Sonnet-alone, 11.9% cost cut** on SWE-bench Multilingual. "Each helper keeps its own cache" is true for the *tool* but the *blog* describes a **shared** context — contested. |
| 3 | **Claude Code subagents** pinned to cheaper models via `~/.claude/agents/*.md` frontmatter (`model`, `effort`), set once, works everywhere | **FULLY CONFIRMED, verbatim**, against [Claude Code sub-agents docs](https://code.claude.com/docs/en/sub-agents). `model`: sonnet/opus/haiku/fable/full-ID/inherit; `effort`: low…max; user-level `~/.claude/agents/` = cross-project, project-level `.claude/agents/` = scoped. Docs literally frame it as a cost lever. Minor nuance: `model` can be overridden by `CLAUDE_CODE_SUBAGENT_MODEL` or per-invocation, so "pins" isn't absolute. |
| 4 | **Instructions file** (CLAUDE.md) tells the main model what to delegate; lower `effort` on simple tasks trims cost further | **SUPPORTED.** Both levers are documented first-party mechanisms; the *specific* "routine reads/edits → cheap; planning/review → main" split is sound engineering consistent with the docs rather than a quoted Anthropic prescription. |

**One honest tension the post omits:** Anthropic's own framing is that multi-agent systems **spend ~15x more
tokens** than single-agent chat, justified only for high-value tasks. Orchestration lowers the *blended rate
per token*, but it also *increases token volume*. Net savings depend on the workload — treat the post's
percentages as directional, not guaranteed.

---

## Part C — How to apply this in **this** repository

### C.0 What "token spend" means here
No runtime LLM calls exist (`apps/`, `backend/`, `packages/` = only test mocks). So the entire optimization
surface today is **the Claude Code dev workflow**: the main interactive session + the 11 subagents in
`.claude/agents/`.

### C.1 Current state (audited)
- All **11 agents** → `model: opus`, including pure executor roles.
- **No `effort`** field on any agent.
- **No delegation guidance** in `CLAUDE.md`.
- `.mcp.json` registers `playwright` + `chrome-devtools` **project-wide** via `@latest`; only `qa-produto`
  actually needs a browser.

### C.2 Recommended model per agent (OPEN — needs Jonatan's sign-off, Principle VIII)

| Agent | Now | Proposed | Bucket | Why | conf |
|-------|-----|----------|--------|-----|------|
| `arquiteto` | opus | **opus** (keep) | Planning/judgment | Architecture trade-offs & ADRs — top reasoning | high |
| `seguranca` | opus | **opus** (keep) | Planning/judgment | Auth/payment/webhook review — high stakes | high |
| `product-owner` | opus | **opus** (keep) | Planning/judgment | Vision, acceptance criteria — judgment | med |
| `dev-backend` | opus | **sonnet** | Routine execution | Spec-driven, test-first endpoints; Sonnet 5 ~Opus on coding | high |
| `dev-frontend` | opus | **sonnet** | Routine execution | Implements UI from approved specs | high |
| `dev-estrutura-de-dados` | opus | **sonnet** ⚠️ | Routine execution | Schema/migrations; **escalate to opus for pricing-domain model changes** | med |
| `devops` | opus | **sonnet** | Routine execution | CI/CD, deploy scripts, hook wiring | high |
| `qa-software` | opus | **sonnet** | Routine execution | Writes/runs tests, coverage | high |
| `scrum-master` | opus | **sonnet** | Coordination | Cadence, DoD, sequencing — organizational, not deep reasoning | med |
| `designer-ux` | opus | **sonnet** ⚠️ | Design (borderline) | Wireframe-level UX; keep opus if you value the extra design judgment | low |
| `qa-produto` | opus | **haiku** + `effort: low` | Observation | Opens browser, screenshots, reports defects — low-reasoning | med |

Rough cost effect on the re-pinned roles: **~40% cheaper/token** on the `→ sonnet` agents at standard rates
(~60% at intro), **~80% cheaper** on `qa-produto → haiku`. Discount the headline by Sonnet 5's ~30% higher
token count. This is a strict subset of the post's "planning/review stays on the main model; routine reads +
edits go to a cheaper model."

### C.3 Exact diffs (copy-paste ready)

**Each `→ sonnet` agent** — one-line frontmatter change (`dev-backend`, `dev-frontend`,
`dev-estrutura-de-dados`, `devops`, `qa-software`, `scrum-master`, `designer-ux`):
```diff
-model: opus
+model: sonnet
```

**`.claude/agents/qa-produto.md`** — downgrade + cap effort (this file has no `tools:` line; leave that as-is):
```diff
-model: opus
+model: haiku
+effort: low
```

**`CLAUDE.md`** — add a short delegation rule near the top (proposed snippet):
```md
### Cost / model delegation (Claude Code dev workflow)
- Routine, spec-driven reads & edits → cheaper model subagents (`dev-*`, `qa-*`, `devops`, `scrum-master`
  are pinned to `sonnet`; `qa-produto` to `haiku`).
- Planning, architecture, security, and final review → keep on the main/`opus` model
  (`arquiteto`, `seguranca`, `product-owner`).
- Escalate `dev-estrutura-de-dados` to `opus` for pricing-domain model changes.
- Prefer lower `effort` on mechanical tasks; reserve high effort for genuinely hard reasoning.
```

### C.4 Secondary levers (lower priority)
- **MCP scope:** `playwright` + `chrome-devtools` load their tool schemas into every session that inherits
  them, costing context tokens. Only `qa-produto` needs a browser. Consider pinning versions (drop `@latest`)
  for reproducibility; scoping MCP away from non-browser agents is awkward in Claude Code today, so treat this
  as minor.
- **CLAUDE.md auto-append** pulls `specs/006-uat-deploy-hardening/plan.md` into every session. Fine while that
  plan is lean; if it grows large, trim what's auto-loaded (it is cacheable, so the cost is a one-time
  cache-write per prefix change).
- **Effort default:** the interactive session's own effort is separate from subagents — use lower effort for
  routine turns.

### C.5 If/when the app gains a runtime LLM feature (e.g. D1–D4 ML ingestion)
Then Part A's runtime levers apply directly, in priority order: (1) **model routing** (Haiku/Sonnet by task);
(2) **prompt caching** on any stable system prompt / catalog / few-shot prefix; (3) **Batch API** for any
non-interactive bulk job (50% off, stacks with caching); (4) **context engineering** (retrieve selectively,
clear stale tool results, cap `max_tokens`, structured output). Keep the pricing formula offline in
`packages/pricing-core` as-is — no LLM belongs on that path.

---

## Caveats & open questions

- **Time-sensitivity:** Sonnet 5's $2/$10 intro rate (and the ~5x arithmetic) **expires 2026-08-31**; standard
  $3/$15 makes it ~3.3x cheaper than Fable 5. Effective cost is higher than sticker due to the ~30%-heavier
  tokenizer.
- **Unverified post numbers:** the BrowseComp per-problem dollars/accuracies and the advisor "92%/63%" figure
  are not in any primary source located; trust the architecture, not the specific numbers.
- **Refuted in verification (transparency):** a "~50% peak-context reduction from compaction" claim failed
  (split 1-2); only the tool-clearing figures survived, and those are a single best-case vendor demo. The
  "each helper keeps its own cache" detail is contested (true for the advisor *tool*, but the advisor *blog*
  describes a shared context).
- **Source access:** several anthropic.com pages return HTTP 403 to direct fetch; load-bearing quotes were
  triangulated via search snippets + first-party `platform.claude.com` docs.
- **Security note (process):** during the sweep, one subagent fetching an unreliable third-party page
  (`mcp.directory`) was flagged for following injected instructions to probe local infrastructure. That page
  contributed **zero** verified claims and was discounted; nothing in this doc derives from it. Lesson: keep
  cheap workers on a tight tool allow-list.

## Primary sources
- Pricing — https://platform.claude.com/docs/en/about-claude/pricing
- Prompt caching — https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Batch processing — https://platform.claude.com/docs/en/build-with-claude/batch-processing
- Claude Code sub-agents — https://code.claude.com/docs/en/sub-agents
- Claude Code costs — https://code.claude.com/docs/en/costs
- Effort — https://platform.claude.com/docs/en/build-with-claude/effort
- Building Effective Agents — https://www.anthropic.com/research/building-effective-agents
- Multi-agent research system — https://www.anthropic.com/engineering/multi-agent-research-system
- Effective context engineering — https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- Context-engineering cookbook — https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools
- Advisor tool — https://platform.claude.com/docs/en/agents-and-tools/tool-use/advisor-tool
- The advisor strategy — https://claude.com/blog/the-advisor-strategy
- Claude Sonnet 5 — https://www.anthropic.com/news/claude-sonnet-5
