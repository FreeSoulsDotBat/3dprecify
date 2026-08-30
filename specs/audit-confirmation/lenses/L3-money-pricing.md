# L3 — Money / Pricing Integrity Lens (post-013 confirmation audit)

Read-only. Scope: the offline pricing engine, the pt-BR parser, the 013 override seam, the
fee-catalog freshest/prefill, and the backend money-leaf validators. Method: adversarial DATA, not
the happy path. Canonical reference: `docs/pricing-model-from-spreadsheet.md`.

Verdict tags: `[VERIFICADO]` = read the code and traced the exact values; `[INFERIDO ~X%]` =
reasoned without executing.

---

## HIGH — F1. Typing a fixed fee on a Shopee slot silently zeroes the Shopee commission (overstated líquido)

`[VERIFICADO]` — `apps/web/src/features/calculator/calculator-model.ts:195-198` +
`apps/web/src/features/calculator/fee-prefill.ts:83` + `apps/web/src/shared/fee-catalog/seed.ts:30`
+ `apps/web/src/features/calculator/calculator-schema.ts:223` (field is UI-rendered for every slot,
`calculator-form.tsx:349`, no per-market conditional).

The override seam groups `fixedFee` with `commissionPct`:

```ts
const commissionOverridden = edited.commissionPct !== undefined || edited.fixedFee !== undefined;
return { ...base, priceBands: commissionOverridden ? undefined : base.priceBands,
         commissionPct: edited.commissionPct ?? base.commissionPct, ... }
```

On a **band-based Shopee entry the top-level `commissionPct` is `null`** (seed.ts:30 /
catalog.json:22), which `entryToChannelFees` maps to `?? 0`. The real commission lives ONLY in the
price bands. So when the seller types a value into "Taxa fixa" (fixedFee) and **nothing else**:

- `commissionOverridden` is true → `priceBands` is dropped,
- `commissionPct` falls back to `base.commissionPct` = **0%**,
- the gross-up now charges **zero Shopee commission** (real Shopee = 14–20%).

Exact trace, canonical inputs (precoVarejo = 42,98), Shopee slot, type `fixedFee = "4"`, no
commission typed:
- With bands (blank slot, correct): announce **58,73**, 20% commission charged.
- After typing fixedFee only: announce = (42,98+4)/(1−0) = **46,98**, commission **0**, voucher 20 →
  **líquido 22,98** — a net that omits ~R$ 9–12 of commission the seller will actually pay.

The seal reads `"ajustado por você"` (honest that *something* was adjusted) but nothing signals that
the commission collapsed to 0. This is the SAME class of silent-overstated-líquido defect that
E1-02 was opened to kill (voucher-drop) — 013 fixed the voucher path but left the commission-drop
for the `fixedFee`-typed case, because `fixedFee` is bundled into `commissionOverridden` while a
band entry has no non-zero top-level commission to fall back to.

**Not pinned by a test.** `calculator-model.test.ts` covers `freightCost`-only (bands kept, :281)
and `commissionPct`-only (bands dropped, typed value governs, :317) — there is NO test for
`fixedFee`-only on a band entry, which is exactly the hole.

Realistic trigger: a seller who knows their Shopee fixed fee types it into the blank "Taxa fixa"
field to "help", and is shown a net that is 14–20% too high → they underprice → real BRL loss.

Fix direction (owner call — one line): when an entry carries `priceBands`, a typed `fixedFee`
should NOT drop the schedule unless a `commissionPct` was also typed — i.e.
`commissionOverridden = edited.commissionPct !== undefined`, and let a typed `fixedFee` override
only the scalar (it is already inert against a live band, which is the acceptable trade the code
comments describe for commission). OR: block/annotate `fixedFee` editing on a band-based slot. Add
the missing `fixedFee`-only-on-Shopee test either way.

Secondary: the docstring at `calculator-model.ts:164-171` ("a typed commission is neutralized by
the preserved bands") **contradicts the implementation** (:195 drops the bands, the typed commission
governs). Stale comment — will mislead the next reader. Reconcile with the inline comment at :188.

---

## MEDIUM — F2. Dot-decimal with 3 fractional digits parses as a thousands group (×1000 silent error)

`[VERIFICADO]` — `apps/web/src/shared/lib/decimal-ptbr.ts:35,62-64`.

`RE_PTBR_THOUSANDS = /^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/` matches any `d{1,3}.ddd` string, so a dot
followed by exactly three digits is always read as a thousands mark:

- `"0.125"` → matches thousands → strip dots → `"0125"` → **125** (a 1000× error).
- `"0.976"` → **976** · `"1.999"` → **1999** · `"2.500"` → **2500**.

The 013 grammar closed `"0.12" → 12` (now `RE_DOT_DECIMAL`, 1–2 decimals → 0.12 correct) but the
3-decimal dot boundary is untouched — the same defect class the parser was rewritten to kill,
displaced to 3 decimals. Reachable: `avgPowerKw` (FDM avg ~0.1–0.15 kW) and `tariffPerKwh`
(~0.9xx R$/kWh) are exactly the ~0.xyz-with-3-decimals magnitudes; the default is `avgPowerKw:
"0,12"` (comma) but a user typing `0.125` with a dot gets 125 kW. The result is LOUD (an absurd
price) rather than a small silent shift, so it self-flags in most cases — hence MEDIUM not HIGH —
but it is still a finite wrong number returned with no field error. Pre-existing (the old parser
also gave 125 for "0.125"); 013 did not regress it but did not finish it.

Fix direction: a thousands match whose FIRST group is `"0"` (leading-zero group) is never a real
thousands number — reject it, or require a leading non-zero group, so `"0.125"` falls through to a
field error instead of 125. Low blast radius; add the input to the parser test matrix.

---

## LOW — F3. `commissionPct ?? 0` prefill trap: live in code, dormant in current data

`[VERIFICADO]` — `fee-prefill.ts:83,90` (`entry.commissionPct ?? 0`, band `b.commissionPct ?? 0`);
schema allows null: `fee-catalog.ts:22,53` (`commissionPct: z.number()...nullable()`); seal path
`fee-prefill.ts:105-121` returns `{kind:"reference"}` for a blank covered slot.

The US8 curation concern is real in code: a catalog entry (or price band) with `commissionPct:
null` maps to a **0% commission under a "referência" seal** — a sourced-looking free commission →
understated fee → overstated líquido. Boot validation (`use-fee-catalog.ts:14`,
`parseFeeCatalog`) does NOT catch it: the zod schema explicitly permits `null`.

Status for the CURRENT catalog (`backend/app/data/catalog.json` + `seed.ts`): the only null-commission
entry is Shopee, whose `priceBands` OVERRIDE the top-level 0 in the gross-up
(`channels.ts:101-103`), and whose bands all carry numeric commission (20/14). ML and Amazon
`entries: []`. So **the trap does not manifest on today's data**. It arms the moment any curator
adds a NON-band entry with `commissionPct: null`, or a Shopee band with `commissionPct: null`.

Fix direction: forbid `commissionPct: null` on an entry that has no `priceBands`, and forbid it at
band level, in the truth-gate (Constitution II) — a null commission that resolves to a sealed 0% is
a fabricated reference, which the seal system exists to prevent.

---

## Verified clean

- **Engine math vs. the canonical model** `[VERIFICADO]` — `packages/pricing-core/src/index.ts:161-208`.
  material = costPerRoll/(rollWeightKg·1000)·(printGrams+waste) · energy = time·avgPowerKw·tariff ·
  machine = (machineValue/lifetime + maintReserve)·time (ADR-0009 single capital-recovery, replacing
  the spreadsheet's defective triple-count) · falha = failurePct over the ROUNDED (material+energy+
  machine) subtotal (spreadsheet defect #4 corrected — no longer material-only). Markup over the
  displayed rounded custoTotal (WYSIWYG). All intermediates full-precision Decimal, quantized only at
  emit; every aggregate is `sumMoney` of already-rounded lines so the breakdown closes. No float in
  the money path.

- **Rounding / Decimal** `[VERIFICADO]` — `rounding.ts`: decimal.js-light, 2dp ROUND_HALF_UP, single
  home. `computeBom` scales per-unit×qty via `toMoney(Decimal×qty)`, never native `*`; aggregates via
  `sumMoney`. No double-rounding.

- **E1-05 regime comparison** `[VERIFICADO]` — `channels.ts:69-71` STILL uses a native-float compare
  `(commissionPct/100)*listPct.toNumber() >= minPerItem`, and the WYSIWYG recompute at :108-110 does
  too. **Harmless by construction**: at the floor/pct crossover both regimes yield the SAME announce
  (algebraically `base+fixed+minPerItem = (base+fixed)/(1−c/100)` at the boundary), so any float ε
  misclassification differs by a sub-cent. Not addressed (still float) but not a money risk.

- **Band fixed-point** `[VERIFICADO]` — half-open lower-inclusive selection, `MAX_BAND_ITERS=4`
  terminal cap, deterministic (`channels.ts:83-104`). Same input → same band/announce/líquido.

- **Freight voucher truthfully deducted** `[VERIFICADO]` — resolved per-level by the resulting
  announce band and deducted from líquido, preserved unconditionally across the override seam
  (the E1-02 fix; test at `calculator-model.test.ts:281`).

- **`freshest()` 013 string-vs-int fix** `[VERIFICADO]` — `use-fee-catalog.ts:34-53` parses
  `YYYY-MM-DD.n` and compares the sequence as an INTEGER (".10" > ".2"), lexicographic fallback only
  for a malformed version.

- **Backend ceilings applied to the right consumers** `[VERIFICADO]` — every `CEIL_*` equals its
  column's integer-digit budget (12,2→10¹⁰ money · 18,6→10¹² rate · 9,4→10⁵ kW · 12,3→10⁹ g · 9,3→10⁶
  h · 6,3→10³ %). history → `CEIL_MONEY`, scenarios → `CEIL_CONFIG_LEAF` (10¹², wider, JSONB intent
  has no column), boms tariff → `CEIL_RATE`, filaments/printers/products each name their domain
  (`validation.py:29-45`, consumers grep-verified). The 10¹⁰-vs-10¹² gap is a tested decision
  (`test_scenarios.py::test_VR602...`).

- **E4-01 int-in-money-position** `[VERIFICADO]` — `validation.py:52,111-117` rejects a JSON int under
  `{totals, breakdown}`; `reject_bad_leaves` runs (history.py:157) BEFORE the VR-503 total check. The
  quote renderer (`quote_render.py`) prints ONLY `totals.*` and `breakdown.*` (single: `_cost_lines`
  over `breakdown`; kit: `lines[].totals`, `totals.custoTotal`), both of which the walker guards, so
  the "renders blank on the customer PDF" symptom is fully covered for the artifact.
  Nuance (LOW, informational): `channels[].{precoAnuncio*,recebidoLiquido*,freightCost*}` are money
  positions in the DOCUMENT but are NOT under `totals`/`breakdown`, so a crafted body could freeze an
  INT there and escape the walker. It is never rendered on the quote and only affects the caller's own
  data, so no customer-facing blank; noted for completeness, not a defect against the stated invariant.

## Adversarial parser inputs tried (all correctly REJECTED → NaN → field error, unless noted)

`[VERIFICADO]` `decimal-ptbr.ts`:
`1.234.567,89` → 1234567.89 ✅ correct · `1.2.3` → NaN ✅ · `1e3` → NaN ✅ (old parser: 1000) ·
`０．１２` fullwidth → NaN ✅ (`\d`/`.` are ASCII-only, stripped to empty) · `"5x3"` → NaN ✅
(interior junk preserved, anchored strip) · `"10-5"` → NaN ✅ · `"12,,5"` → NaN ✅ · `"1.5000"` →
NaN ✅ · `"5,"` → NaN ✅ · `"-"`/`"--"`/`"R$"` → NaN ✅ (empty-after-strip) · `"R$ 1,50"` → 1.5 ✅ ·
`"1,50 kg"` → 1.5 ✅ · `-0` → -0 (finite, ≥0 branch, benign) · `"0.12"` → 0.12 ✅ (the 013 fix
holds). The ONLY finite-wrong is F2 (`0.125`→125). Round-trip: `ptBrToWireDecimal`/`wireToPtBr` are
pure string separator swaps (no float) so `"110,00"`↔`"110.00"` is byte-exact (SC-305);
`formatDecimal` uses `toLocaleString` (rounds to 2dp) but is DISPLAY-only, never the save path.

---

## Bottom line

The core engine math, rounding, band fixed-point, voucher deduction, `freshest()`, the backend
ceilings and the E4-01 rendered-artifact guard are correct. The 013 rewrites hold **except** the
override seam's treatment of a typed `fixedFee` on a band-based Shopee slot (F1, HIGH — silent
commission→0, overstated líquido, UI-reachable, untested). F2 (3-decimal dot → ×1000) and F3 (the
`?? 0` null-commission trap, dormant in data but live in code) are the two residuals to close.
