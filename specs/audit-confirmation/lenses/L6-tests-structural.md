# Lens 6 — Tests + Structural Quality (post-v1 confirmation audit)

**Branch audited:** `audit/post-v1-confirmation` (everything merged: `0005_e6_billing.py`, `app/billing/*`,
`billing.spec.ts`, the 013 remediation all present). Read-only. Evidence tags: `[VERIFICADO]` = read the
code and reasoned the failure path; `[INFERIDO ~X%]` = inferred without executing.

**Verdict up front:** the merged suite does **not** carry the "auto-consistent-wrong" class the original
audit feared, in the places I checked. The privacy sweep, the pt-BR parser, the billing grant/checkout
paths, and the migration guards all genuinely bite. The one residual is **E6-01 (still present, unchanged
by the merge)** — the webhook-signature suite proves the verifier's *math* but not our *belief* about MP's
real manifest. Structural debris is clean.

---

## MEDIUM

### F6-1 — E6-01 confirmed: the webhook-signature suite is self-consistent across all three layers `[VERIFICADO]`
The signature test cannot catch a divergence between "our belief about MP's canonical manifest" and MP's
**actual** production format, because every layer that signs a fixture independently re-encodes the *same*
belief:

- **prod verifier** — `backend/app/billing/signature.py:30-32` `canonical_manifest` →
  `f"id:{data_id.lower()};request-id:{request_id};ts:{ts};"`
- **unit test** — `backend/tests/test_billing_security.py:74` `_sign` →
  `f"id:{data_id};request-id:{request_id};ts:{ts};"` (no `.lower()`, but every fixture `data_id` is numeric
  so it is moot)
- **e2e stub** — `backend/tests/mp_stub/stub.py:140` → `f"id:{payment_id.lower()};request-id:...;ts:...;"`

There is **no captured-from-real-MP fixture** anywhere in `backend/tests/` (grep for `canonical_manifest` /
golden / captured returns only unrelated E4 "captured origin" hits). The e2e "forged signature → 401"
(`billing.spec.ts:246`, SC-702) and the unit "bad v1 → 401" (`test_billing_security.py:173`) both reject
*garbage* correctly regardless of manifest correctness — so they add nothing to closing E6-01.

**Why it matters:** these are separate encodings, so the suite *does* catch a prod verifier bug (wrong
separator/order, `==` instead of `compare_digest`, freshness window) — a real value. What it can never catch:
if the shared belief is wrong (MP does **not** lowercase `data.id`, or field order/separators differ), then
in production **every real payment webhook 401s and grants nothing to every paying customer**, and no test in
the tree goes red. This is the revenue path. The `signature.py:5-7` docstring says the manifest was "verified
2026-07-20" — against MP **docs**, not a live signature.
**Fix direction:** pin ONE golden fixture captured from a real MP sandbox webhook (raw body + real
`x-signature` header + the sandbox secret) as an executable test — the only thing that binds our belief to
reality. Low effort, high leverage, do it before real credentials go live (T002).

Sub-finding `[VERIFICADO]`: the `data_id.lower()` branch (`signature.py:32`, "a documented MP quirk") has
**zero** assertion behind it — no fixture uses a data_id containing letters. If the quirk is wrong, nothing
catches it. Add one mixed-case-id case.

---

## LOW

### F6-2 — `test_migrations.py` `_OWNED_TABLES` is stale post-merge (E6 tables never added) `[VERIFICADO]`
`backend/tests/test_migrations.py:40-50` lists 9 tables (0001-0004) and its own docstring
(`:12-14`, `:38-39`) says: *"when E6 merges and `0005_e6_billing.py` lands on develop, add `subscriptions`
and `billing_events`."* **0005 has merged** (`backend/alembic/versions/0005_e6_billing.py` present), and the
follow-up was **not honored** — the downgrade round-trip never asserts the two E6 tables are created after
`upgrade head` nor dropped after `downgrade base`.

**Nuance (why LOW, not MEDIUM):** the round-trip *mechanics* still exercise `0005.downgrade()` indirectly —
`command.downgrade(cfg, "base")` runs it, so a wrong DROP order / dangling FK / syntax error still raises and
reddens the test; and because `0005.upgrade()` uses `op.create_table` with no `checkfirst`
(`0005_e6_billing.py:54,114`), a *forgotten* drop would make the re-`upgrade head` raise "table already
exists" → also red. The gap is only a silent forgotten-drop that used `IF NOT EXISTS` (not the case today).
**Fix direction:** the 30-second edit the test itself prescribes — append `"subscriptions"`, `"billing_events"`
to `_OWNED_TABLES`.

### F6-3 — e2e `retries: CI?2:1` absorbs infra flake, does **not** mask a product bug `[VERIFICADO / INFERIDO ~80%]`
`apps/web/playwright.config.ts:48` + rationale `:41-47`. The flake in `scenarios-manage.spec.ts` (the "manage"
test) is a setup/provisioning race under `fullyParallel` ~16 workers on ONE Postgres + ONE backend. The
known JIT-account-vs-grant race is **already** handled in-helper: `grantPremium`
(`tests/e2e/history-helpers.ts:41-57`) has a bounded 15s retry loop keyed on `"no existing account matches"`.
The residual is DB/connection contention — reproduced identically on `develop` (per config comment). A
deterministic *product* regression fails all 2-3 attempts, so retries can't hide it.
**Why not zero-risk:** the "correct" fix is worker/DB isolation, not retries; retries slightly raise the odds
that a *new*, genuinely-flaky product bug gets waved through as "infra" without investigation. Mitigated by
`trace: "on-first-retry"` (`:51`) now being meaningful (it was dead under the prior implicit `retries: 0`) —
a masked flake at least leaves a trace artifact. Acceptable as-is; flag any future *new* retry-only-green
test for a real-browser look before accepting it.

---

## CONFIRMED-GOOD (the valuable results — these guards genuinely bite)

### G6-1 — `providers.test.tsx` privacy sweep is toothy, not toothless `[VERIFICADO]`
Spot-check as asked: **delete the purge block** (`providers.tsx:31-53`) →
- test (a) `test_050...:118` seeds all 5 idb caches + 6 query roots, transitions → `anonymous`, then asserts
  **every idb key** (`:133-137`) and **every query root by name** (`:139-142`) is gone → `idbStore.has(key)`
  stays `true` → **RED**. Not a bulk/count assertion — a single dropped store is caught, never masked by a
  passing neighbor.
- test (b) `:147` exercises `u1 -> u2` *directly* (no intervening `anonymous`) — the `uidChanged` half of
  `providers.tsx:30`'s `||` that was dead until T050. Also asserts u2's own data **survives**, proving the idb
  purge is scoped to the previous uid, not a global wipe.
- The outbox-retention invariant (`:144`, `:174`) guards the ADR-0018 §10 rule: *adding* an outbox purge
  flips `has(...)` true→false → RED. Not auto-consistent-wrong (seed and purge share the key-derivation fn,
  which *is* the real invariant — write-key must equal purge-key).

### G6-2 — the pt-BR parser suite asserts the STRICT parser, not a comfortable old-lenient one `[VERIFICADO]`
`decimal-ptbr.test.ts` pins BOTH an accept list AND a **rejection** list (`:42-60`): `"1,234,56"`, `"5x3"`,
`"12,,5"`, `"1.5000"`, `"1.23.4"` all → `NaN`. These are exactly the forms the *old* `parseFloat`-based
lenient parser silently coerced to a finite wrong number (`"5x3"→53`, `"1,234,56"→1.234`) — the test comments
name the historical bug (`:44,:45`). `ptBrToWireDecimal` is cross-checked against `parseDecimal`
(`:140-144`, "one rule, two renderings"), so a save-side/read-side divergence can't hide.
`calculator-model.test.ts` similarly asserts per-field errors *instead of* silent-0 coercion (`:106-151`).
No test is pinned to a wrong shape the code also produces.

### G6-3 — E6 grant + checkout paths are covered by real assertions `[VERIFICADO]`
- `test_billing_security.py:266` SEC-201 fires the same signed event 5× against the **real route + real DB**
  and asserts exactly `(1, 1)` grants — the grant_writer terminus (`grant_writer.py:63-92`) is genuinely
  exercised, not mocked.
- `test_billing_checkout.py:94-197` asserts the checkout happy path (200 + `initPoint` + one `pending` row +
  1-segment back_url), the 409 double-subscribe, the 503-on-MP-unreachable-with-no-partial-row, and
  zero-payment-grant on an abandoned checkout. Strong.
- **Absence guards are meaningful:** VR-710 (`:377`) runs against the **live** `grant_premium.py` and asserts
  it raises `GrantError` on `source=payment` — a real regression fires if someone widens the CLI. VR-709
  (`:364`) binds "Play route unreachable while flag OFF" (currently 404 by absence; the assertion survives
  T036 adding a flag-gated route). Both still bite post-merge.

### G6-4 — the migration guards are real `[VERIFICADO]`
`check-migrations.sh` is a genuine dual guard: (a) 3-dot `git diff --name-status BASE...HEAD` flags any
M/D/R on an already-merged migration file (`:27-35`, the immutability rule that bit E3 PR-B), and (b) T052
`alembic heads` single-head check (`:45-52`) catches an orphaned `down_revision` fork. Metadata-only, no DB
needed.

### G6-5 — coverage honesty: reported numbers are real; no exclusion hides a critical path `[VERIFICADO]`
- **FE** (`vitest.config.ts` root `:24-28`): the floor (statements 77 / branches 73 / functions 74 /
  lines 78) is *intentionally set below* the measured baseline (~81/77/78/82, documented `:9-11`) as a
  drop-detector, an owner decision layered ON TOP of visual homologation — not a claim the app is only 77%
  tested. Reported 86.85% is the real v8 number with only `generated.ts` excluded.
- **T-07 is a genuine improvement, not a hidden exemption** (`:20-24`): the exclusion was narrowed from the
  whole `shared/api/**` folder to *only* `generated.ts`; `transport.ts` and `error-messages.ts` are
  hand-written and **do** have real tests (`transport.test.ts`, `error-messages.test.ts` both present), so
  bringing them under the floor is correct.
- **BE** (`package.json:21` `gate:be`): `--cov=app --cov-fail-under=82` is ENFORCED over the *whole* `app`
  package (no `omit`), so `app/billing/*` counts. DB-backed tests run in CI (Docker is present — e2e uses a
  real Postgres). `[INFERIDO ~85%]` Locally without Docker, `requires_db` skips the billing suite and the
  82% gate would *fail* (visible, correct) — not silently pass.

### G6-6 — structural debris: CLEAN `[VERIFICADO]`
- **FC-01 (10 dead icons):** all removed in `a669dc3` and **unreferenced** — grepped each of `banknote`,
  `check`, `chevron-right`, `circle-help`, `cog`, `download`, `eye`, `share-2`, `tag`, `zap` across
  `apps/web/src`: zero hits outside the (now-absent) definition. Current `icon.tsx` holds only the 8 used.
- **No `TODO`/`FIXME`/`XXX`/`HACK`** anywhere in `apps/web/src` or `backend/app`.
- **Route migration (`6b36dd2`, F-02):** the old 2-segment routes are kept **deliberately** as client-side
  redirects for ≥1 release (T023), documented in the commit — not orphaned debris. Minor acknowledged debt:
  `products-panel.tsx` still targets old route names → one extra client hop until the redirect is retired.
  Not a defect.

---

## The one thing the owner must know
The billing signature suite proves the verifier's math is right — it does **not** prove our *belief* about
Mercado Pago's real webhook manifest is right (unit, e2e-stub, and prod all encode the same belief, with no
captured-real-MP fixture). If that belief is wrong (the `data.id` lowercase quirk, field order, separators),
**every real payment webhook silently 401s and grants nothing to every paying customer**, and the whole green
suite stays green. Pin one golden fixture captured from an MP sandbox webhook before real credentials go live.
