#!/usr/bin/env sh
# Migration-amend guard (review 2026-07-12). A migration already merged into `develop` is IMMUTABLE:
# editing it in place leaves every environment that already ran the OLD version silently diverged
# from the schema the file now claims — a class of drift no other gate catches. It is exactly what
# bit PR-B: the E3 `0001` edit-in-place left the local dev DB stamped `0002` but carrying the old
# CHECK constraint, so every ad-hoc kit save 500'd. New migrations (ADDED files) are always fine;
# only MODIFYING or DELETING a file that already exists on the base branch fails here.
#
# Usage: scripts/check-migrations.sh [base-ref]   (default base: origin/develop)
set -eu

BASE="${1:-origin/develop}"
DIR="backend/alembic/versions"

# Resolve the base ref: CI has it after checkout with history; locally we fetch it best-effort.
if ! git rev-parse --verify --quiet "$BASE" >/dev/null 2>&1; then
  git fetch --quiet origin develop 2>/dev/null || true
fi
if ! git rev-parse --verify --quiet "$BASE" >/dev/null 2>&1; then
  echo "[check-migrations] base ref '$BASE' not found — skipping (nothing to compare against)."
  exit 0
fi

# Three-dot diff = only what THIS branch introduces since the merge-base, so a migration that
# landed on develop independently is never mistaken for a local change. M/D/R on an existing file
# under versions/ is an amend; A (added) is a new migration and is allowed.
offenders=$(git diff --name-status "$BASE"...HEAD -- "$DIR" | awk '$1 ~ /^(M|D|R)/ { print }')

if [ -n "$offenders" ]; then
  echo "ERROR: a migration already on '$BASE' was modified or removed — merged migrations are immutable."
  echo "       Add a NEW migration (a follow-up revision) instead of editing an existing one."
  echo "Offending change(s):"
  echo "$offenders"
  exit 1
fi
echo "[check-migrations] OK — no already-merged migration was amended."

# --- Single-head guard (013 audit remediation, T052 — finding P-03) --------------------------
# `alembic heads` is metadata-only (reads the versions/ directory's revision graph; no DB
# connection — `Settings.database_url` has a default, so `get_settings()` never fails even with
# no env configured). Two or more heads means a merge introduced a fork the app cannot resolve
# (`alembic upgrade head` errors ambiguously) — an orphaned `down_revision` is the classic cause.
# CI-only (this job's own step, per D4): backend/uv is not a frontend `gate:all` dependency, and
# this script already only runs in the migration-guard CI job — never inside `gate:all` itself.
head_count=$(cd backend && uv run alembic heads 2>/dev/null | grep -c .)
if [ "$head_count" -ne 1 ]; then
  echo "ERROR: expected exactly 1 alembic head, found $head_count."
  echo "       A duplicated/orphaned down_revision forks the migration chain — fix before merging."
  (cd backend && uv run alembic heads)
  exit 1
fi
echo "[check-migrations] OK — exactly 1 alembic head."
