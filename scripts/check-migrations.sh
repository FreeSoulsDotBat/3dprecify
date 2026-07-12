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
