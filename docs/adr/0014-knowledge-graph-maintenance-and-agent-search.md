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

**Executed 2026-07-10 (owner-approved):** the 008 spec docs plus the changed policy docs (26 files,
curated against git ground truth — the stale manifest falsely reported 233 changed files) were
semantically ingested in-session: 99 new nodes / 277 new edges; `bom`/`piece` vocabulary queries now
start at the E3 entities (BomResult, bom_lines, PieceInputs). Actual cost: 216,831 aggregate
subagent tokens — well above the ~10–15k naive word-count estimate, because subagent read+reason
overhead dominates; recorded in `graphify-out/cost.json` (file created — it did not exist before).
The semantic cache is now persisted for all 26 files, so a future full rebuild will not re-pay this.

## Revision 2026-07-19 — refresh clause amended by ADR-0022 (011-token-optimization)

ADR-0022 **amends** the Maintenance rule above (it does not supersede this ADR). The three-level
enumeration in §Decision is replaced by the following order of mechanisms, strongest first —
adopted after `graphify hook install` was proven on this machine (Windows 11, graphify 0.9.12:
install T022, ~25s detached rebuild on commit T023, survival across `pnpm install`/`lefthook
install` T024; evidence in `specs/011-token-optimization/dod-evidence.md` §3):

1. **`graphify hook install` — deterministic on-commit rebuild (PRIMARY).** `post-commit` +
   `post-checkout` written directly to `.git/hooks/` (outside lefthook's management), AST-only,
   0 LLM tokens, detached (~25s measured; log: `~/.cache/graphify-rebuild.log`; escape hatch
   `GRAPHIFY_SKIP_HOOK=1`). Covers every **local** commit and branch switch. **Honest boundary:**
   a squash-merge created remotely arrives via fast-forward `git pull` on `develop`, which fires
   *neither* hook — that path stays covered by mechanism 2, exactly as it was before.
2. **AI close-out `graphify update .` (DOCUMENTED FALLBACK, still load-bearing).** The assistant's
   post-merge bookkeeping step remains in `CLAUDE.md` — it is the net for the remote-merge path,
   for a machine without the hook (or after a `graphify hook uninstall` rollback), and the **only**
   path for doc/paper/image semantic ingestion (`/graphify --update`), which the commit hook does
   not cover (code-only).
3. **`pnpm graph:update` (MANUAL).** Unchanged; the owner-facing one-shot refresh.

The lefthook `post-merge` net (`scripts/graph-refresh.sh`) is **retired** (block + script removed
2026-07-19, same PR): its purpose is served by mechanism 1 for local paths, and the ff-pull gap it
admittedly never covered stays with mechanism 2. `lefthook.yml` now carries the standing invariant:
**never declare `post-commit`/`post-checkout` there** — `lefthook install` would overwrite
graphify's hooks. The §Consequences line "the `post-merge` hook is best-effort … so the AI
procedure is the load-bearing enforcement" is superseded by: *the graphify commit hook is the
primary enforcement; the AI procedure is the documented fallback.* Rollback: `graphify hook
uninstall` (one command) returns the repo to the pre-amendment mechanism set.

**Correction, same day (2026-07-19, owner decision — ADR-0022 §Amendment addendum):** the "ff-pull
gap it admittedly never covered" premise was **measured false** on this machine (git 2.45.1,
`pull.rebase=false`): `post-merge` **does** fire on a fast-forward `git pull` (scratch-repo proof,
`specs/011-token-optimization/dod-evidence.md` §3). The `post-merge` net therefore **returns** —
`lefthook.yml` block + resurrected `scripts/graph-refresh.sh`, guarded to `develop`, non-fatal — as
mechanism **1b**, the deterministic net for the remote squash-merge path; mechanism 2 stays as the
fallback and the only doc/paper semantic route. Boundary: `git pull --rebase` fires no `post-merge`
(the repo runs `pull.rebase=false`; adopting pull-rebase re-opens this). Rollback: remove the
`post-merge` block + `lefthook install`.
