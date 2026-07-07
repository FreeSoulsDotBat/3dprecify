# ADR-0011: pricing-core 3.0.0 — multi-channel result contract, band fixed-point & snapshot policy (extends ADR-0008)

- **Status**: **Accepted (owner-homologated 2026-07-06)**
- **Date**: 2026-07-06
- **Deciders**: Jonatan (owner, homologated 2026-07-06) + arquiteto; implemented with dev-estrutura-de-dados, dev-frontend
- **Extends**: ADR-0008 (version registry + rounding). Pairs with ADR-0010 (fee-catalog).

## Context

`specs/005-marketplace-multichannel/spec.md` mandates a **MAJOR bump of `packages/pricing-core` → `3.0.0`**
(FR-118) for two breaking structural changes to the **2.0.0** result contract:

1. **Itemized "outros custos"** — the single `adminTotal` scalar becomes `otherCosts: [{ name, value }]`, with
   `admin = Σ value` folded into `custo_total` exactly as before (FR-114 — an empty list is byte-identical to
   2.0.0's `adminTotal = 0`).
2. **Multi-channel** — the single implicit channel (2.0.0 `MarketplaceResult | null`) becomes a **list**
   `channels: ChannelResult[]`, each grossing up **both** `preco_varejo` and `preco_atacado`, minus a per-channel
   `freightCost` (ADR-0010 Part 4), with an include/exclude **headline framing** flag (FR-110/112/113).

ADR-0008 already set the version + rounding policy and **anticipated this**: Option 1A (semver constant + gate
test) was chosen and 1B (rich `MODEL_REGISTRY`) was *deferred to E2/E4, to be upgraded "when a second live version
actually exists."* This ADR decides how 3.0.0 evolves that policy, the new result shape, the **price-band
fixed-point** algorithm (data comes from ADR-0010; the resolution is pricing-core's), and — critically — how E4
snapshotting stays possible **now that fees are external, dated data rather than pure inputs**.

Unchanged from ADR-0008 (not re-litigated): money = `decimal.js-light`, 2-dp `ROUND_HALF_UP` per line, aggregates
= sum of already-rounded lines, WYSIWYG. The multi-channel gross-up reuses 004's per-channel formula, **generalized
with a per-channel referral-fee minimum floor** (Amazon charges `max(% × preço, R$ 1,00)`) — see Part 3.

> **Wire naming (aligned with spec + tasks):** the referral-fee minimum is the field **`minPerItem`** (matching the
> spec's "min per-item" language). It is distinct from the Individual-plan flat per-item fee, which is a `fixedFee`.

---

## Part 1 — Version registry evolution

### Option A — Keep ADR-0008 Option 1A; bump to `3.0.0`; break the result type — CHOSEN
Export `PRICING_MODEL_VERSION = "3.0.0"`, bump `package.json`, keep the constant↔package-major **gate test**;
evolve the result type in place. The only consumer today is `apps/web/features/calculator`.
- **Pros:** minimal ceremony, consistent with the accepted ADR-0008 stance; **one** live version (3.0.0 supersedes
  2.0.0 in the **same** E1 PR); no persisted 2.0.0 snapshots exist yet (persistence is E2) → **no migration** of
  stored data; the registry stays clean.
- **Cons:** the 3.0.0 TS result type breaks 2.0.0 **code** consumers (only the web calculator + the 004 test
  suite — contained; the compiler + new gate tests catch every site; see the 004-test migration follow-up).
- **Scalability impact:** medium-high — enough to stamp + snapshot; rich per-version diffing still deferred.
- **Confidence:** 80%

### Option B — Introduce the rich `MODEL_REGISTRY` now (ADR-0008 Option 1B) — rejected (still premature)
Treat 2.0.0→3.0.0 as the "second live version" trigger and build the `version → {semver, lines[], notes}` map.
- **Pros:** would power A29 (labelled/diff of saved quotes) sooner.
- **Cons:** the trigger is **two versions coexisting in stored snapshots** — which cannot happen until E2/E4 (no
  saves exist before E2; 3.0.0 *replaces* 2.0.0 in this PR). Building it now is the gold-plating ADR-0008
  explicitly deferred (Principle VI).
- **Scalability impact:** high, but unused in E1.
- **Confidence:** 55%

### Option C — Avoid the major bump; make `channels` additive/optional on 2.x — rejected
- **Cons:** the result **semantics** genuinely change (scalar admin → itemized; single implicit channel → explicit
  list); the spec **mandates 3.0.0** (FR-118); calling it non-breaking is dishonest (Constitution II) and would
  desync the version stamp from reality.
- **Confidence:** 20%

---

## Part 2 — New result shape (Option A)

```ts
export const PRICING_MODEL_VERSION = "3.0.0";

interface OtherCostItem { name: string; value: number; }        // 0..N; admin = Σ value

interface ChannelResult {                                       // one per channel slot, stable order
  marketplace: "MERCADO_LIVRE" | "AMAZON" | "SHOPEE";
  feeDeterminants: FeeDeterminants;                             // ML {listingType,category} | Amazon {category,plan} | Shopee {}
  commissionPct: number; fixedFee: number;                     // RESOLVED value used (catalog or override)
  minPerItem: number;                                          // RESOLVED referral-fee minimum per item (Amazon R$1,00; 0 elsewhere) — Part 3
  appliedBand: { minPrice: number; maxPrice: number | null } | null;   // which band selected (SC-108 transparency)
  anuncioVarejo: number;  liquidoVarejo: number;
  anuncioAtacado: number; liquidoAtacado: number;
  freightCost: number;                                         // deduction from liquido; 0 when NONE (ADR-0010 P4)
  feeSource: "CATALOG" | "CATALOG_STALE" | "MANUAL" | "NO_REFERENCE";   // drives the honesty seal (ADR-0010 P2)
  error?: { field: string; code: string };                    // e.g. commission ≥ 100 → this slot only (FR-104/SC-107)
}

interface PriceResult {                                        // 004 cost lines unchanged
  material; energy; machine; falha; finishing; labor;
  otherCosts: OtherCostItem[]; admin;                          // itemized + its sum
  custoTotal; precoVarejo; precoAtacado;
  channels: ChannelResult[];                                   // 1..N; [] ⇒ headline = direct varejo/atacado
  includeInHeadline: boolean;                                  // master toggle (FR-113); default true
  catalogVersion: string | null;                              // the served/cached catalog artifact version the fees came from (ADR-0010); null when all-manual
  modelVersion: string;                                        // "3.0.0"
}
```
- The 004 cost pipeline (`material…custoTotal…preco_varejo/atacado`) is **structurally unchanged**; `admin` is now
  `Σ otherCosts[i].value`. Each `otherCosts` line is its own rounded breakdown line and the sum still ties to
  `custo_total` under ADR-0008 (FR-115).
- **`feeSource` (ADR-0010 — served endpoint + persisted cache + seed):** `CATALOG` (served/cached reference, fresh) ·
  `CATALOG_STALE` (`now − lastReviewed > 30 days`) · `SEED` (bundled seed — first-run/offline before a fetch persists →
  "referência embutida") · `MANUAL` (seller override → "ajustado por você") · `NO_REFERENCE` (uncovered combo → "sem
  referência" + manual entry). The `SEED` state exists because delivery is fetch-on-first-load with a bundled-seed
  fallback; the resolution order is store → seed → refresh-when-online (ADR-0010).
- **Per-slot resilience:** an invalid channel (e.g. `commissionPct ≥ 100`) yields `error` on **that** channel and
  no bad number; other channels and the headline keep computing (FR-104/119, SC-107) — pricing-core does **not**
  throw for one bad slot (a departure from 2.0.0's whole-call `ValidationError`, which stands for the shared cost
  inputs). Determinism + stable ordering hold (FR-119/SC-110).

---

## Part 3 — Per-channel gross-up: price-band fixed-point + referral-fee minimum floor

The commission charged on the **announce (listed) price** is `C(anuncio) = max(pct/100 × anuncio, minPerItem)`, and
for band-priced channels `(pct, fixedFee)` themselves depend on the **band of the announce price** — a fixed point.
pricing-core owns all of this (offline, deterministic).

### Option 3-A — Bounded band fixed-point with a lower-inclusive tie-rule — CHOSEN
Select the band by the **announce price**: seed the band from the base price, compute the announce, re-select the
band for that announce; iterate until stable (monotone bands ⇒ converges in ≤ small N, cap at e.g. 4 with a
documented terminal rule). Bands are half-open `[min, max)` (lower-inclusive) so a boundary price never oscillates
(serves FR-111 / SC-108).
- **Pros:** correct against the *announce* price (what the marketplace actually charges on); deterministic; the
  tie-rule kills oscillation; `appliedBand` is returned for transparency.
- **Cons:** iteration (bounded, cheap) + a terminal-case rule to document.
- **Confidence:** 72%
- Rejected: **3-B** select the band by the base price only (near a boundary the fee is charged on the announce, so
  base-selection is subtly wrong — 45%); **3-C** server resolves the band (violates offline / "backend never
  computes"; the backend serves catalog **data** only — the band fixed-point must resolve offline in pricing-core — 15%).

### Referral-fee minimum floor (generic; Amazon R$ 1,00) — homologated 2026-07-06 (owner: "model it exactly")

Amazon's referral fee is a **percentage with a minimum** — `max(pct/100 × preço, R$ 1,00)` — so the fee is
**piecewise**, not purely linear. The gross-up (per base ∈ {varejo, atacado}, `base` = target net before freight)
selects the regime deterministically:
```
anuncioLin      = (base + fixedFee) / (1 − pct/100)          # linear-regime candidate
if pct/100 × anuncioLin ≥ minPerItem:                        # LINEAR regime — the minimum does not bind
    anuncio = anuncioLin
else:                                                        # FLOOR regime — commission is the flat minimum
    anuncio = base + minPerItem + fixedFee
commission = max(pct/100 × anuncio, minPerItem)
liquido    = anuncio − commission − fixedFee − freightCost
```
- **Exact + continuous + monotone.** The two regimes meet at `anuncio* = minPerItem/(pct/100)` with the same `base`
  (`minPerItem(1−pct/100)/(pct/100) − fixedFee`), so there is no discontinuity or oscillation.
- **Backward-compatible.** `minPerItem = 0` ⇒ always the LINEAR regime ⇒ reduces to the 004/2.0.0 formula
  **exactly**. Only **Amazon** carries `minPerItem = 1,00` at launch (Mercado Livre / Shopee = 0), so no other
  channel changes.
- **Interaction with bands.** Amazon has no bands (`minPerItem` binds only for very cheap items,
  < `minPerItem/(pct/100)` ≈ R$ 6,67–8,33 for a 12–15 % referral); band-priced channels carry `minPerItem = 0`. So
  band-selection and the floor do **not** compound for the launch data; the engine applies band-selection first (to
  get `pct,fixedFee`), then the floor. `minPerItem` is resolved from the catalog (default 0) and overridable, and it
  is frozen on `ChannelResult` for E4 (Part 4).
- **Amazon fee split (curation note, not conflated):** the Individual selling plan's **R$ 2,00/item** is a flat
  `fixedFee` (Profissional = 0); the referral **minimum R$ 1,00** is `minPerItem`. These are two distinct mechanisms
  — the spec's "min per-item R$1–2" is de-conflated here (verified: the referral minimum is **R$ 1,00**; the R$ 2,00
  is the Individual-plan per-item fee — sources in Consequences).

---

## Part 4 — E4 snapshot policy (the important nuance)

In 2.0.0 a snapshot froze `PRICING_MODEL_VERSION` + inputs + rounded lines, and the price reproduced offline
because **every input was user-supplied**. In 3.0.0 the per-channel fees are **external, dated catalog data** (a
served + cached, versioned artifact — ADR-0010) — so freezing the model version alone is **insufficient** to reproduce a
multi-channel quote.

**Decision:** a reproducible snapshot MUST additionally freeze the **resolved fee provenance per channel** — the
`(commissionPct, fixedFee, minPerItem, freightCost, appliedBand, feeSource)` actually used **plus** the
`catalogVersion` (the served/cached artifact version, ADR-0010) they came from. Because `ChannelResult` +
`PriceResult.catalogVersion` already carry these, the snapshot = `PRICING_MODEL_VERSION` + inputs + `otherCosts` +
`channels[]` (resolved) + `catalogVersion` + rounded outputs → reproducible offline with no recompute and no
re-fetch (honors TD-009/A13 and the "backend never recomputes" invariant). This closes a real gap that would
otherwise let a saved quote silently re-price against a newer served catalog after a later backend deploy. E4 builds the
storage; E1 only needs the **result to already carry** these fields (it does).

---

## Decision (homologated 2026-07-06)

Jonatan homologated **A · (result shape as Part 2) · 3-A + the referral-fee minimum floor · Part 4** (Q-E confirmed;
Amazon minimum modelled **exactly**, not deferred): keep ADR-0008's lean semver-constant policy, bump to **3.0.0**
with the gate test extended to the multi-channel shape + band determinism + the floor regime; resolve bands via a
bounded, tie-ruled fixed point and the commission via `max(pct×anuncio, minPerItem)`; and make `ChannelResult` +
`PriceResult.catalogVersion` carry the resolved fee provenance (incl. `minPerItem`) **already in E1** so E4
snapshots stay reproducible now that fees are external, served catalog data. The rich `MODEL_REGISTRY` (Option B) stays
deferred to E2/E4, exactly as ADR-0008 scheduled.

## Consequences

- **Positive:** one clean MAJOR version, minimal ceremony, consistent with ADR-0008; no stored-data migration (no
  pre-E2 saves); per-slot error isolation keeps the multi-channel view robust; band + floor are deterministic +
  offline and the floor makes Amazon **exact** (`max(%, minimum)`); E4 reproducibility is secured **before** the
  data becomes external — no retrofit.
- **Negative / trade-offs accepted:** 3.0.0 breaks the 2.0.0 TS result type (the web calculator **and** the 004
  numeric test suite must migrate to the new shape and be re-asserted green — compiler + gate tests catch it);
  pricing-core gains a per-slot error path distinct from its whole-call `ValidationError` (documented); a bounded
  band iteration + terminal rule + the piecewise floor to test.
- **Follow-ups:** at implementation — bump `package.json` to `3.0.0`, export `PRICING_MODEL_VERSION="3.0.0"`,
  extend the constant↔major gate test, **migrate the built 004 SC-001…SC-012 cases to the 3.0.0 shape and remove
  the now-dead single-channel `marketplace*` surface** (no regression), add SC-101…SC-111 **plus the floor-regime
  case SC-112** test-first **before** the engine change; the FE `features/calculator` adapter consumes the new shape
  + the ADR-0010 served/cached catalog + seed/seal; the `MODEL_REGISTRY` (ADR-0008 Option 1B) upgrades at E2/E4 when snapshots of
  two versions coexist.

### Sources verified (2026-07-06)
- Amazon Brasil — referral commission 10–15 % by category, **referral minimum R$ 1,00**, plan Individual **R$ 2,00/item** vs Profissional R$ 19/mês (1º ano grátis): <https://venda.amazon.com.br/precos> · corrob. <https://gosmarter.com.br/taxas-amazon-brasil-2026/>
