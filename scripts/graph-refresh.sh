#!/usr/bin/env bash
# graph-refresh.sh — ADR-0022 §Amendment addendum (2026-07-19): refresh the graphify knowledge graph
# after a merge/pull into `develop` — the DETERMINISTIC net for the remote squash-merge path.
#
# PREMISE CORRECTED BY MEASUREMENT (2026-07-19, this machine — git 2.45.1, pull.rebase=false):
# `post-merge` DOES fire on a fast-forward `git pull` (scratch-repo proof, dod-evidence §3). The
# earlier "a fast-forward pull may not fire post-merge" was a never-tested hedge. Local commits and
# branch switches are covered by graphify's own post-commit/post-checkout hooks (PRIMARY, ADR-0022);
# this hook complements them on the one path they cannot see. Known boundary: `git pull --rebase`
# fires no post-merge — the repo runs pull.rebase=false today.
# Always non-fatal — it must never block a merge/pull. Code-only (AST, 0 LLM tokens, ~25s); doc/paper
# ingestion stays with the AI skill path (/graphify --update), per ADR-0014.
set -u

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
if [ "$branch" != "develop" ]; then
  exit 0 # only the integration branch receives remote squash-merges (ADR-0006/0014)
fi

if ! command -v graphify >/dev/null 2>&1; then
  echo "[graph-refresh] graphify not installed — skipping (fallback: pnpm graph:update)"
  exit 0
fi

echo "[graph-refresh] develop pull/merge → knowledge-graph update (AST-only, 0 LLM tokens, ~25s)…"
graphify update . || echo "[graph-refresh] update failed (non-fatal — run 'pnpm graph:update' later)"
exit 0
