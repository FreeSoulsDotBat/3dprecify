# ADR-0008: pricing-core version registry & rounding policy

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: Jonatan (owner) + planning round (arquiteto), 2026-07-05

## Context

`packages/pricing-core` is the **sole** source of the pricing formula; the backend never recomputes
(`CLAUDE.md`), so any saved price must be **reproducible offline** from the stored inputs + the formula that
produced it. Two coupled sub-decisions are now on the **E1 critical path** (A42, and the follow-up in
`docs/decisions/audit-findings-r2.md` §5 "E1 scope frozen"):

1. **Version identifier.** A25 moves the markup base from `material` → `custo_total` — a **semantic** change,
   not a bug-fix. Saved-calc snapshots (E2 / TD-009 / A13) must record **which formula produced this price** so
   a quote can later be labelled or diffed (A29 "calculado com a fórmula vN"). Today the package is `0.0.0` with
   no exported version.
2. **Rounding policy.** A42 requires **per-line rounding so the breakdown sums to the shown total** (as the
   homologated prototype v2+ does), a **decimal-vs-float** call, and a definition of **what freezes in
   snapshots** — all deterministic and offline.

**Prior constraint to stay consistent with.** ADR-0004 already ratified, for the E2 DB layer: money as
`Decimal`, `Numeric(18,6)` for unit rates / `Numeric(12,2)` for settled values, ISO-4217, **ROUND_HALF_UP**.
The pricing-core policy should match this so there is **one** money truth front-to-back, not a second
conflicting one.

**Verified facts (not assumed).** `decimal.js` exposes `toDecimalPlaces(dp, rm)` with modes including
`ROUND_HALF_UP` (mode 4, the default) and `ROUND_HALF_EVEN` (mode 6); a smaller same-author variant
`decimal.js-light` exists for bundle-sensitive offline use. `dinero.js` v2 reached **stable on 2026-03-02**
(functional, tree-shakeable, integer minor-units). Sources in Consequences.

---

## Part 1 — Version identifier

### Option 1A — package semver + exported `PRICING_MODEL_VERSION` constant — CHOSEN
Bump `package.json` to the new major and export a string constant (e.g. `PRICING_MODEL_VERSION = "2.0.0"`);
a saved calc stores this string. A gate test asserts the constant equals the package major (no silent drift).
- **Pros:** minimal; single source (package.json) + one exported constant; trivially snapshot-able; matches
  ADR-0004 semver discipline; fully offline.
- **Cons:** a bare string doesn't capture *which lines/inputs existed* at that version, so A29 diffs need extra
  scaffolding later; relies on bump discipline (mitigated by the gate test).
- **Scalability impact:** medium-high — enough to label a quote and freeze a snapshot; thin for rich auditing.
- **Confidence:** 74%

### Option 1B — richer model registry (`MODEL_REGISTRY`: id + semver + line schema + changelog) — rejected (deferred to E2)
An exported map `version → { semver, introducedAt, lines[], notes }`. Snapshots store the id; the registry
lets the app re-derive labels/diffs (A29) and validate old snapshots.
- **Pros:** strongest reproducibility + audit; directly powers A29 "labelled / recalculate-with-diff";
  future-proof across many model versions.
- **Cons:** more surface/ceremony now for a **single** live version — gold-plating risk pre-E2 (Principle VI);
  another artefact to maintain.
- **Scalability impact:** high.
- **Confidence:** 66%

### Option 1C — content hash of the formula (hash of ordered line-keys + constants) — rejected
Stamp = a deterministic hash; snapshot stores the hash.
- **Pros:** changes automatically when the math changes; no manual bump discipline.
- **Cons:** opaque — a hash is not a human label, so A29 still needs a registry to translate it; unstable
  across no-op refactors; hard to communicate; overkill offline.
- **Scalability impact:** medium.
- **Confidence:** 40%

---

## Part 2 — Rounding policy

The crux is A42's "**breakdown must sum to the shown total**." A rounded breakdown ties to a rounded total only
one of two ways: **(receipt model)** round each line, then define aggregates as the **sum of the already-rounded
lines** — they add up by construction; or **(round-at-end)** keep full precision and round only the final, then
displayed lines can be a penny off and need largest-remainder reconciliation. The homologated prototype already
does the **receipt model**, so that is the intended behaviour.

### Option 2A — native JS `number`; round only the final price; intermediates full float — rejected
- **Pros:** zero deps; simplest; fast.
- **Cons:** binary float can't represent `0.01` exactly → sporadic 1-cent surprises and a breakdown that does
  **not** sum to the shown total (violates A42); risks drifting from the E2 `Decimal` DB values; the
  money-correctness debt grows as lines multiply (E1 already has ~7 lines).
- **Scalability impact:** low-medium.
- **Confidence:** 45%

### Option 2B — `decimal.js-light`; per-line round to 2dp `ROUND_HALF_UP`; aggregates = sum of rounded lines; intermediates full-precision `Decimal` — CHOSEN
- Quantize **at each named money line** (material, energy, machine, failure, finishing, labor, admin) and at
  **each aggregate/price** (`custo_producao`, `custo_total`, `preço_atacado`, `preço_varejo`, marketplace
  gross-up). Aggregates are the **sum of already-rounded children**, so the breakdown ties. **Rates** (R$/g,
  R$/h, R$/kWh) stay full-precision `Decimal` and are only quantized when they emit a money line.
- **Pros:** deterministic + offline + exact decimal; breakdown sums **by construction**; `ROUND_HALF_UP` @ 2dp
  matches ADR-0004's settled money (`Numeric(12,2)`, HALF_UP) → one money story end-to-end; small same-author
  dep with a verified `toDecimalPlaces(dp, rm)`.
- **Cons:** adds a runtime dep to a currently dep-free pure package (pin in the pnpm catalog); requires a
  documented **order of operations** (where each round happens) to stay canonical; "aggregate = sum of rounded
  lines" can differ by 1 cent from a naive `round(sum of raw)` — standard and acceptable, but must be stated.
- **Scalability impact:** high — the correct money primitive as lines multiply across E1→E7.
- **Confidence:** 76%

### Option 2C — integer minor units (centavos) via `dinero.js` v2 (or hand-rolled cents) — rejected
- **Pros:** exact by construction (integers); no rounding drift; explicit `allocate()` for splitting; strong
  money semantics; v2 is stable, functional, tree-shakeable.
- **Cons:** our engine is **rate-heavy** — unit costs are R$/g and R$/h, which are **not** whole centavos, so a
  decimal step is still needed **before** quantizing to cents; dinero therefore doesn't remove the
  decimal-rounding decision, it only moves it downstream, while adding a heavier money model over mixed
  real/money math (grams, hours, kW, %); overkill for a single-currency (BRL) offline calc in v1.
- **Scalability impact:** high for pure-money apps, mismatched to a rate-heavy formula.
- **Confidence:** 58%

## Decision

**Part 1 = Option 1A** and **Part 2 = Option 2B**. Jonatan approved both in the 2026-07-05 planning round.

**Version identifier.** `packages/pricing-core` exports a constant and bumps `package.json` to match; a gate
test binds the constant to the package major (no silent drift). The E1 model is stamped:

```
PRICING_MODEL_VERSION = "2.0.0"
```

This treats the `001` `material + markup` model as the implicit **v1** baseline and marks E1's `custo_total`
markup-base change (A25) as the **major** bump. Persisted saves begin at **E2** (none exist before E1 ships), so
the registry starts clean — no legacy snapshot to migrate. The richer `MODEL_REGISTRY` (Option 1B) is deferred
to E2/E4, upgraded in place when a **second** live version actually exists (A29).

**Rounding contract (canonical, deterministic, offline):**
> Every displayed R$ cost line rounds to **2 decimal places** using **`ROUND_HALF_UP`** (via `decimal.js-light`);
> each aggregate (`custo_producao`, `custo_total`, `preço_atacado`, `preço_varejo`, marketplace gross-up) is the
> **sum of the already-rounded lines**; intermediates and rates (R$/g, R$/h, R$/kWh) stay **full-precision
> `Decimal`** and are quantized only when they emit a money field; **markup (A25)** and the marketplace gross-up
> `(base + fixa) / (1 − pct)` operate on the **displayed (rounded) `custo_total`** (WYSIWYG), then round the
> result.

Rationale (one line): 2B is the only option satisfying **all four** A42 constraints at once — deterministic,
offline, breakdown-sums-to-total, snapshot-freezable — while keeping **one** money truth consistent with the
already-ratified E2 DB rules (`Decimal`, `ROUND_HALF_UP`, 2dp settled). `ROUND_HALF_EVEN` (banker's) was
considered and rejected only to match that ratified DB policy; revisit jointly if ADR-0004 ever changes.
(`decimal.js` is an acceptable fallback if the full API is wanted — both verified, same author.)

**What freezes in a snapshot (ties Part 1 + Part 2):** `PRICING_MODEL_VERSION` + the **inputs** + the **rounded
line values**. Because rounding is deterministic and the version is stamped, the price reproduces offline with no
backend recompute — satisfying TD-009 / A13 reproducibility and the "backend never recomputes" invariant.

## Consequences

- **Positive:** every saved price is reproducible offline and self-consistent (breakdown provably sums to the
  total); one money policy end-to-end (pricing-core ↔ E2 DB, both `Decimal` + `ROUND_HALF_UP` @ 2dp); the
  version stamp `2.0.0` unblocks E2/TD-009 snapshots and future A29 formula-version UX with minimal ceremony now.
- **Negative / trade-offs accepted:** `pricing-core` gains its first runtime dependency (`decimal.js-light`) —
  must be pinned in the pnpm catalog and re-verified at implementation; WYSIWYG rounding sacrifices a hair of
  precision vs raw multiplication (deliberate, for reproducibility); 1A defers rich per-version diffing to E2.
- **Follow-ups / new ADRs triggered:**
  - E1 implementation adds `decimal.js-light` to the catalog, bumps `package.json` to `2.0.0`, exports
    `PRICING_MODEL_VERSION = "2.0.0"`, and adds the constant↔package gate test; **re-verify the exact package +
    version pin at that point** (do not assume this ADR's version facts remain current).
  - The `001` contract tests use `toBeCloseTo(..., 2)` (±0.01 tolerance) — E1 tightens the pricing-core numeric
    tests to **exact** rounded equality once 2B lands.
  - A29 (formula-version UX for saved quotes, E4) consumes `PRICING_MODEL_VERSION`; upgrade 1A→1B when the
    second live model version exists.
  - Coordinates with **ADR-0009** (machine-hour line) and A25 (markup base = `custo_total`) — the lines this
    policy rounds.

### Sources verified (2026-07-05)
- decimal.js API — rounding modes + `toDecimalPlaces(dp, rm)`: <https://mikemcl.github.io/decimal.js/>
- decimal.js-light (smaller same-author variant): <https://mikemcl.github.io/decimal.js-light/>
- dinero.js v2 stable (2026-03-02), integer minor-units, tree-shakeable: <https://www.sarahdayan.com/blog/dinerojs-v2-is-out> · <https://www.npmjs.com/package/dinero.js>
