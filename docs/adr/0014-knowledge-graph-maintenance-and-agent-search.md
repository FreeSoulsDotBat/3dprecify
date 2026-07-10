# ADR-0014: Knowledge-graph maintenance & agent-facing code search (graphify)

- **Status**: Accepted
- **Date**: 2026-07-10
- **Deciders**: Jonatan (owner) + Claude (assistant)

## Context

The repo carries a **graphify** knowledge graph in `graphify-out/` (gitignored): 2858 nodes ·
4446 edges · 232 communities over the code (`apps`, `backend`, `packages`, `.specify`, root
config), 97% EXTRACTED. It is built structurally from ASTs — **no LLM, 0 tokens** — so building
and updating it is essentially free; only docs/papers/images would cost semantic-extraction
tokens, and those are a negligible slice of this corpus.

Two problems were found (2026-07-10 audit):

1. **The graph goes stale silently.** It was built at 10:58; E2 (007 catalog/entitlement) merged
   into `develop` at 14:13 and nothing refreshed it, so the graph knew nothing of the products
   subsystem until a manual `graphify update .` (20s, 0 tokens) rebuilt it to 2858 nodes. There
   was no trigger tying graph freshness to the integration branch.
2. **No AI actually uses the graph.** None of the 11 `.claude/agents/*.md` and neither the project
   `CLAUDE.md` mentioned graphify; the installed CLI has no `--mcp` server. So every search — main
   loop and subagents — went through Grep/Glob/Read/Explore, sweeping and reading many files. The
   graph's `query`/`explain`/`path` primitives (which answer structural questions cheaply and
   **save** tokens versus reading N files) were never invoked. The tool was manual-only, fired
   solely when the owner typed `/graphify`.

We want the graph (a) always fresh at the integration branch and (b) actually consulted by the
AIs for the kind of search it is good at — without inventing infrastructure the CLI doesn't have.

## Options considered (≥3, per Constitution)

### Option A — Manual-only (status quo)
- Pros: nothing to build; no new hooks or process.
- Cons: graph drifts out of date the moment code lands; agents never use it; the token-saving and
  navigation value is 100% unrealized. Both audit problems remain.
- Scalability impact: negative — the larger the codebase grows, the more the unused graph and the
  more expensive blind Grep/Read sweeps become.
- Confidence: 95% this is the wrong baseline.

### Option B — Incremental `update` on merge-to-`develop` + graph-first agent search policy (CHOSEN)
- Pros: `graphify update .` is AST-only (0 tokens, ~20s) so keeping the graph fresh is nearly free;
  ties freshness to the same integration branch our PRs land on; agents get an explicit, cheap
  first stop for structural questions (`query`/`explain`/`path` via Bash) before token-heavy
  sweeps. Uses only primitives the installed CLI actually has.
- Cons: relies on a documented procedure + best-effort git hook (a fast-forward pull may not fire
  `post-merge`); agents must be told the policy in `CLAUDE.md` + configs.
- Scalability impact: positive — token cost of search grows sub-linearly as the graph absorbs new
  code for free; the bigger the repo, the bigger the saving.
- Confidence: 80%.

### Option C — Full rebuild in CI + committed graph artifact
- Pros: deterministic, server-side, visible in PRs.
- Cons: `graphify-out/` is local + gitignored; committing a ~1.5 MB `graph.json` churns the repo
  and conflicts constantly; CI-built graphs don't reach a dev's machine where the agents run.
  Over-engineered for a 0-token local artifact.
- Scalability impact: neutral-to-negative (merge noise).
- Confidence: 70% this is not worth it now.

### Option D — `graphify watch` continuous rebuild
- Pros: always fresh during active dev, on every file save, no LLM.
- Cons: different trigger (on-save, not on-merge); needs a long-lived process per dev session;
  doesn't by itself tie freshness to `develop`. Useful as an *optional* complement, not the spine.
- Scalability impact: positive but operationally heavier.
- Confidence: 60% as a primary mechanism.

## Decision

Adopt **Option B**, with **D available as an opt-in** for active sessions.

**Maintenance rule (explicit):** *Every merge into `develop` requires the graph to be refreshed.*
The refresh is `graphify update .` — AST-only, 0 LLM tokens, ~20s. It is enforced on three levels,
strongest first:

1. **AI procedure (primary):** whenever the assistant lands anything on `develop` (the post-merge
   bookkeeping step), it runs `graphify update .` as part of close-out. Recorded in `CLAUDE.md`.
2. **`pnpm graph:update` (owner-facing):** one command to refresh manually; `pnpm graph:query "…"`
   to ask the graph a question.
3. **lefthook `post-merge` hook (safety net):** `scripts/graph-refresh.sh` runs the update, guarded
   to `develop`, non-fatal, skipped if graphify is absent. Best-effort only — a fast-forward `git
   pull` may not fire `post-merge`, so levels 1–2 are the real guarantee.

**Agent search policy (explicit):** for **structural / navigational** questions — "where is X",
"what calls Y", "how does subsystem Z connect", "what's in this community" — agents consult
`graphify query "…"` / `graphify explain "X"` / `graphify path "A" "B"` **first**, then use
Grep/Read for the exact lines to edit and to verify. Grep/Glob/Read remain correct for exact-string
lookups, single known files, and any edit/verification. This is a policy in `CLAUDE.md` plus a
one-line pointer in the code-searching agent configs; there is no MCP server in the installed CLI,
so the integration is the CLI over Bash.

Jonatan approved both the maintenance rule (with the `post-merge` hook) and the graph-first search
policy on 2026-07-10.

## Consequences

- **Positive:** graph stays current with `develop` at ~0 token cost; agents have a cheap first stop
  that avoids blind multi-file sweeps (token saving grows with the codebase); freshness is tied to
  the branch our owner-authorized PRs already target.
- **Negative / trade-offs accepted:** the `post-merge` hook is best-effort (ff-pulls may skip it),
  so the AI procedure is the load-bearing enforcement; a graphify install is assumed on the dev
  machine (hook and script no-op cleanly if absent); doc/paper/image changes still need the skill's
  LLM path (`/graphify --update` in-session) — the CLI `update` covers **code only**.
- **Follow-ups:** revisit `--directed` / `--mode deep` for richer edges; revisit an MCP server if a
  future graphify version ships one (would let subagents query the graph as a tool, not via Bash).
  If the corpus gains substantial docs, set `GEMINI_API_KEY` to keep semantic extraction off the
  Claude token budget.

## Revision 2026-07-10 — amendment after pattern audit (owner-approved)

A same-day audit against the canonical graphify usage patterns (P1–P10) confirmed the decision and
its wiring (graph fresh past the last `develop` merge; health check clean: 0 dangling/missing/
collapsed edges on 2877 nodes), and produced one factual correction plus four 0-token extensions:

1. **Factual correction — MCP exists.** The claim above that "there is no MCP server in the
   installed CLI" is outdated: graphify 0.9.12 ships `graphify.serve` (MCP stdio server), though
   `graphify --help` does not list it. Decision: **defer MCP adoption** — every code-searching
   agent with Bash is already served by the CLI, and agents without Bash get `GRAPH_REPORT.md`
   (item 2). Revisit if subagent orchestration outgrows Bash. A generated wiki (`--wiki`) is
   likewise available and likewise deferred.
2. **Pointer coverage widened.** The graph-first block now also lives in `devops.md` and
   `qa-produto.md` (Bash-capable, previously missing). Agents WITHOUT Bash — `arquiteto`,
   `designer-ux`, `product-owner`, `scrum-master` — cannot execute the CLI at all; their configs
   now direct them to Read `graphify-out/GRAPH_REPORT.md` (§Community Hubs) as the graph surface.
3. **Query discipline in every pointer.** The query matcher is literal substring (no stemming, no
   synonyms): use terms that exist in the graph's labels, cap output with `--budget 1500`, and
   fall back to Grep when no vocabulary matches. Prevents noise answers from agents that only read
   the one-line pointer.
4. **Work-memory loop adopted.** At the start of graph work: `graphify reflect --if-stale` + read
   `graphify-out/reflections/LESSONS.md`; after a graph-based answer: `graphify save-result
   --question "…" --answer "…" --type query --nodes … --outcome useful|dead_end|corrected`. Both
   deterministic, 0 LLM tokens (verified against the installed 0.9.12). Recorded in `CLAUDE.md`.

Still open (owner decision — the only path that costs real tokens): semantic ingestion of the 008
spec docs (~7.8k words ≈ 10–15k tokens one-time in-session, or off-budget via `GEMINI_API_KEY`);
until then the graph does not know the multi-piece BOM vocabulary during E3 implementation.
