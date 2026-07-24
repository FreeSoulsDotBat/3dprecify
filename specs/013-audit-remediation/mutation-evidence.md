# Mutation evidence — US5 guard tests (013 audit remediation)

Per the task brief: **the audited code is correct; the tests are the deliverable.** Each guard
below was verified by actually applying the named mutation, observing the test go RED, capturing
the output, then reverting the mutation (confirmed by `git diff` showing zero remaining change).

## 1 — T050 (finding T-02): delete the purge block (`providers.tsx:48-53`)

**Mutation applied:**
```diff
-        if (prev.user?.uid) {
-          void purgeCatalogCache(prev.user.uid);
-          void purgeBomCache(prev.user.uid);
-          void purgeHistoryCache(prev.user.uid);
-          void purgeScenarioCache(prev.user.uid);
-          void purgeEntitlementCache(prev.user.uid);
+        if (false as boolean) {
+          void purgeCatalogCache(prev.user!.uid);
+          void purgeBomCache(prev.user!.uid);
+          void purgeHistoryCache(prev.user!.uid);
+          void purgeScenarioCache(prev.user!.uid);
+          void purgeEntitlementCache(prev.user!.uid);
```

**Command:** `pnpm --filter web exec vitest run src/app/providers.test.tsx`

**Red output (all 3 tests in the file fail, including the pre-existing outbox test):**
```
FAIL  src/app/providers.test.tsx > an INVOLUNTARY sign-out never destroys the only copy of a quote
FAIL  src/app/providers.test.tsx > T050 … (a) transition -> anonymous purges every idb key + query root EXCEPT the outbox
FAIL  src/app/providers.test.tsx > T050 … (b) u1 -> u2 DIRECTLY … purges u1's data via the uidChanged branch
AssertionError: idb key "bom" (boms:u1) should be purged: expected true to be false
```

Reverted; `git diff apps/web/src/app/providers.tsx` → empty.

## 2 — T050 (finding T-02): invert the sweep condition (`providers.tsx:30`)

**Mutation applied:**
```diff
-      if (wentAnonymous || uidChanged) {
+      if (wentAnonymous && uidChanged) {
```

**Command:** `pnpm --filter web exec vitest run src/app/providers.test.tsx`

**Red output (exactly test (b), the never-before-tested uidChanged branch):**
```
Test Files  1 failed (1)
     Tests  1 failed | 2 passed (3)
FAIL  src/app/providers.test.tsx > T050 … (b) u1 -> u2 DIRECTLY (no intervening anonymous) purges u1's data via the uidChanged branch
AssertionError: u1's idb key "bom" (boms:u1) should be purged: expected true to be false
```
(Test (a) still passes — `wentAnonymous` is true AND `uidChanged` is trivially true on that
transition too (`u1 !== undefined`), so `&&` still fires there; only the pure
`uidChanged`-without-`wentAnonymous` path — test (b) — is starved. That is exactly the branch the
task named as "never tested".)

Reverted; `git diff apps/web/src/app/providers.tsx` → empty.

## 3 — T051 (finding T-01): invert the DROP TRIGGER / DROP FUNCTION order in `0003_e4_snapshots.py::downgrade()`

Adaptation note: `tasks.md` says "0005" — that migration exists only on `feature/012-e6-billing`.
This branch's migration chain is `0001`-`0004`; the one genuinely order-dependent `op.execute`
pair among the 4 migrations that exist here is `0003`'s `DROP TRIGGER` / `DROP FUNCTION` (the
trigger depends on the function, so Postgres refuses the drop if the function goes first).

**Mutation applied:**
```diff
-    op.execute("DROP TRIGGER IF EXISTS trg_snapshots_immutable ON snapshots;")
-    op.execute("DROP FUNCTION IF EXISTS snapshots_forbid_content_update();")
+    op.execute("DROP FUNCTION IF EXISTS snapshots_forbid_content_update();")
+    op.execute("DROP TRIGGER IF EXISTS trg_snapshots_immutable ON snapshots;")
```

**Command:** `uv run pytest tests/test_migrations.py -x -q` (run from `backend/`)

**Red output:**
```
E   psycopg.errors.DependentObjectsStillExist: cannot drop function snapshots_forbid_content_update() because other objects depend on it
E   DETAIL:  trigger trg_snapshots_immutable on table snapshots depends on function snapshots_forbid_content_update()
E   HINT:  Use DROP ... CASCADE to drop the dependent objects too.
tests\test_migrations.py:84: in test_full_downgrade_to_base_then_reupgrade_to_head_round_trips_cleanly
    command.downgrade(cfg, "base")
```

Reverted; `git diff backend/alembic/versions/0003_e4_snapshots.py` → empty (this migration is
already merged to `develop` — the amend-guard in `scripts/check-migrations.sh` would also have
caught a real, committed edit here).

## 4 — T052 (finding P-03): a dummy migration pair with a duplicated `down_revision`

**Mutation applied:** added two throwaway files, both `down_revision = "0004"` (a fork):
`backend/alembic/versions/0098_dummy_dup_head.py` and `0099_dummy_dup_head.py`.

**Command:** `sh scripts/check-migrations.sh`

**Red output:**
```
[check-migrations] OK — no already-merged migration was amended.
ERROR: expected exactly 1 alembic head, found 2.
       A duplicated/orphaned down_revision forks the migration chain — fix before merging.
0098 (head)
0099 (head)
```
(exit code 1)

Removed both dummy files; `git status --short backend/alembic/versions/` → empty. Re-run green:
```
[check-migrations] OK — no already-merged migration was amended.
[check-migrations] OK — exactly 1 alembic head.
```

## T053 (finding E5-04) — no guard mutation performed

The task brief named a guard mutation only for T050/T051/T052 (the 4 above). T053's own
correctness is proven by the test itself exercising a previously-dead branch
(`scenarios.py::_price_input_dict_from_bom_line`, the `else` at `scenarios.py:399-408`) — mutating
`backend/app/api/scenarios.py` is out of scope for this story (explicitly on the "do not edit"
list), so no guard mutation was applied against it. The new test
(`test_E5_04_a_kit_scenario_with_one_line_soft_deleted_degrades_only_that_line`,
`backend/tests/test_scenarios.py`) passes against the current (correct) implementation; the full
`test_scenarios.py` suite (58 tests) is green with it included.

## T054 (finding T-07) — narrowing, not a guard mutation

No named mutation was requested; the exclusion narrowing in `vitest.config.ts` was verified by
confirming `transport.ts`/`error-messages.ts` now appear in the coverage report (previously
excluded outright) — see the PR/commit message for the numbers and the caveat that a clean
full-suite aggregate could not be captured this session due to concurrent WIP from other agents.
