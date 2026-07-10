#!/usr/bin/env bash
# graph-refresh.sh — ADR-0014: refresh the graphify knowledge graph after a merge into `develop`.
#
# The graph is built structurally from ASTs (no LLM, 0 tokens), so a refresh is ~20s and free.
# This hook is a BEST-EFFORT safety net: a fast-forward `git pull` may not fire `post-merge`, so the
# load-bearing enforcement is the AI close-out procedure + `pnpm graph:update` (see CLAUDE.md).
# Always non-fatal — it must never block a merge/pull.
set -u

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "$branch" != "develop" ]; then
  exit 0 # only refresh on the integration branch (ADR-0014)
fi

if ! command -v graphify >/dev/null 2>&1; then
  echo "[graph-refresh] graphify not installed — skipping (install: uv tool install graphifyy)"
  exit 0
fi

echo "[graph-refresh] develop merged → incremental knowledge-graph update (code = AST = 0 LLM tokens)…"
graphify update . || echo "[graph-refresh] update failed (non-fatal — run 'pnpm graph:update' later)"
exit 0
