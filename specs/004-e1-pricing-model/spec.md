# Feature Specification: E1 — Full corrected pricing calculator

**Feature Branch**: `feature/004-e1-pricing-model`

**Created**: 2026-07-05

**Status**: Draft (owner decisions 2026-07-05 applied; minor residuals flagged for `/speckit-clarify`)

**Input**: On the 003 app shell, build the full corrected clean-room pricing model whose scope was **frozen
2026-07-05** (`docs/decisions/audit-findings-r2.md` §5 — A16 / A24 / A25 + marketplace-basic-in-E1). Owner
(Jonatan) resolved every open question on 2026-07-05; this spec bakes those decisions in. Feeds
`/speckit-specify`; hands off to `arquiteto` for technical shaping.

> **Decisions applied (owner, 2026-07-05).** Markup pre-fills +50% varejo / +30% atacado (editable UX
> starting values, not formula constants) · energy = one "consumo médio efetivo (kW)" field (effective average
> draw, pre-fill ~0,12 kW, tooltip) — no nameplate/duty-factor · marketplace gross-up on **both** varejo and
> atacado, each showing price-to-list **and** "recebido líquido" · admin = single "outros custos" total
> (itemization → E2) · failure base = material + energy + machine only (finishing/labor/admin excluded) ·
> machine-hour = **ADR-0009 A** (`value ÷ lifetime_hours + reserve`) · rounding/version = **ADR-0008** (per
> line 2 decimals HALF_UP, breakdown sums to the displayed total, `PRICING_MODEL_VERSION = "2.0.0"`).
> Supersedes `specs/004-e1-pricing-model/scope-draft.md`.

> **Truth-over-approval note (Constitution II).** Cost lines and all listed decisions are frozen. Residuals
> are minor and explicitly listed in §5 (waste granularity, failure/finishing pre-fill, whether to surface the
> marketplace fee delta as its own line, exact avgPowerKw pre-fill). Formula-composition confidence: **95%**.

---

## The E1 cost model (the computed pipeline)

All amounts BRL. This is the shape `packages/pricing-core` implements (major semver bump → `2.0.0`).

```
# production inputs (the three lines the failure factor covers)
material   = (costPerRoll / (rollWeightKg * 1000)) * (printGrams + wasteGrams)
energy     = printTimeHours * avgPowerKw * tariffPerKwh        # single effective-draw field; no nameplate/duty
machine    = machineHourRate * printTimeHours
             machineHourRate = machineValue / machineLifetimeHours + maintenanceReservePerHour   # ADR-0009 A

producao   = material + energy + machine
falha      = producao * (failurePct / 100)                     # failure over ALL production inputs (A16.4)

# cost lines OUTSIDE the failure base (OQ-8 confirmed)
finishing  = finishTimeHours * finishRatePerHour               # explicit time x rate (A16.5)
labor      = laborHours * laborRatePerHour                     # OPTIONAL, default 0 (A25)
admin      = adminTotal                                        # OPTIONAL single "outros custos" total, default 0 (A25)

custo_total = producao + falha + finishing + labor + admin

# markup OVER custo_total (base changed material -> custo_total at E1 — A25)
preco_varejo  = custo_total * (1 + markupVarejoPct  / 100)     # markup pre-fill 50
preco_atacado = custo_total * (1 + markupAtacadoPct / 100)     # markup pre-fill 30

# basic single-channel marketplace fee — correct gross-up on BOTH prices (fixes defect #5)
# for base in { preco_varejo, preco_atacado }:
preco_anuncio    = (base + marketplaceFixedFee) / (1 - marketplaceCommissionPct / 100)   # price to list
recebido_liquido = preco_anuncio * (1 - marketplaceCommissionPct / 100) - marketplaceFixedFee   # == base by construction
```

Rounding (ADR-0008): each cost line and each output is 2-decimal **HALF_UP**; the breakdown's displayed lines
sum to the displayed `custo_total`.

---

## 1. User Scenarios & Testing

Persona: a **solo MEI 3D-print seller** pricing one printed piece from real, self-entered costs. Every story
is independently valuable and testable; the whole calculator is **free and offline** (no sign-in, no save).

### User Story 1 — Get a correct suggested price, retail and wholesale (Priority: P1)

The seller enters the print's real inputs (filament cost/roll and its weight, printed grams plus waste, print
time, effective power draw, energy tariff, machine value + lifetime, failure %, finishing time and rate) and
immediately sees a **suggested retail price** and a **suggested wholesale price**, both derived from a single
`custo_total`. This is the E1 MVP.

**Why this priority**: Producing a *correct* suggested price from the full corrected model is the epic's entire
promise. Without it there is nothing to explain, toggle, or apply a fee to.

**Independent Test**: Enter the canonical inputs (SC-001); confirm `custo_total`, `preço varejo` and
`preço atacado` render in BRL and match the expected values; confirm both prices are always shown together.

**Acceptance Scenarios**:
1. **Given** valid inputs for one piece, **When** the seller finishes entering them, **Then** the calculator
   shows one `custo_total`, one retail price and one wholesale price, all in R$ (pt-BR).
2. **Given** any change to a mandatory cost input (e.g. print time), **When** it changes, **Then** the prices
   recompute deterministically with no page reload and no server round-trip.
3. **Given** markup varejo ≥ markup atacado, **When** both prices show, **Then** retail ≥ wholesale.

### User Story 2 — Understand *why* the price is what it is (transparent breakdown) (Priority: P1)

The seller sees a **per-line cost breakdown** — material, energy, machine, failure, finishing (and labor /
admin when used) — each in R$, that **sums exactly to `custo_total`**, plus how each sale price derives from
`custo_total` via markup. Transparency is the product's core differentiator over an opaque "magic number".

**Why this priority**: "Show why" is a first-class E1 requirement, not a nice-to-have. A seller who cannot see
the composition cannot trust or adjust the price. It is the differentiator against the legacy black-box sheet.

**Independent Test**: For the canonical inputs, confirm each breakdown line is shown in R$, the visible lines
add up to the shown `custo_total` (0 discrepancy after HALF_UP rounding), and the retail/wholesale derivation
(custo_total × markup) is visible.

**Acceptance Scenarios**:
1. **Given** a computed price, **When** the breakdown renders, **Then** each cost line is labelled in pt-BR
   with its R$ value and the lines sum to `custo_total`.
2. **Given** the breakdown, **When** the seller reads it, **Then** it shows how retail and wholesale come from
   `custo_total` (the applied markup), not just a final number.
3. **Given** an optional line at R$ 0,00, **When** the breakdown renders, **Then** that line is de-emphasized
   or omitted without breaking the sum.

### User Story 3 — Trust that each cost is computed the corrected way (Priority: P2)

The seller relies on the model computing each line the *right* way: energy uses the **real effective average
draw** (a single kW field, not the nameplate), the machine is a **single capital-recovery per hour**
(`value ÷ lifetime + reserve` — no triple-count of maintenance + ROI + depreciation), **failure covers
material + energy + machine** (not material alone), **finishing is time × rate** (not a % of material), and
**waste is explicit grams** (not a flat %). These are the frozen defect-fixes A16.1–A16.5.

**Why this priority**: The corrected math *is* the epic. If the numbers regressed to the legacy shortcuts the
price would be wrong; encoding the fixes as their own acceptance surface protects them from silent drift.

**Independent Test**: Vary one engine input at a time and confirm the correct line responds: the effective-draw
kW scales only energy; machine value ÷ lifetime (+ reserve) drives only the machine line; the failure line
equals failure% × (material+energy+machine), not failure% × material; finishing equals time × rate; waste
grams add to the material line.

**Acceptance Scenarios**:
1. **Given** fixed inputs, **When** `avgPowerKw` changes from p1 to p2, **Then** the energy line scales by
   p2/p1 and no other line changes.
2. **Given** fixed inputs, **When** failure % > 0, **Then** the failure line equals failure% ×
   (material + energy + machine) — verifiably larger than failure% × material alone.
3. **Given** fixed print time, **When** `machineValue` or `machineLifetimeHours` changes, **Then** only the
   machine line changes, per `value ÷ lifetime + reserve`.

### User Story 4 — Add my optional labor and admin costs (Priority: P2)

The seller can *optionally* add **labor** (hours × R$/h) and a single **"outros custos"** admin total
(packaging, freight, domain, supplies, internet — one field in v1). All default to **0** and, while untouched,
change nothing. When entered they fold into `custo_total` and therefore into both prices.

**Why this priority**: Labor + admin let a serious seller reach true `custo_total`, but keeping them optional
(default 0) keeps the calculator approachable for a first-time user. Valuable, but the price is already
correct without them.

**Independent Test**: With labor and admin untouched, confirm the price equals the no-optional case exactly;
set labor to 2 h × R$ 25/h and confirm `custo_total` rises by exactly R$ 50,00 and only the labor line moves.

**Acceptance Scenarios**:
1. **Given** labor and admin at their 0 defaults, **When** the price computes, **Then** it is identical to the
   price with those inputs absent.
2. **Given** labor hours × rate > 0, **When** entered, **Then** `custo_total` and both prices increase by
   exactly the labor amount (and the labor line appears in the breakdown).
3. **Given** an "outros custos" value > 0, **When** entered, **Then** `custo_total` increases by exactly that
   amount.

### User Story 5 — Apply a basic marketplace fee to get the price to list (Priority: P2)

The seller can add **one** marketplace channel's fee — a commission % and a fixed fee — and see, for **both**
retail and wholesale, the **grossed-up price to list** (`preço para anunciar`) so that after the channel's cut
they still net their intended sale price, plus a **"recebido líquido"** line confirming what actually lands.
The gross-up is `(base + fixedFee) / (1 − commissionPct/100)` (fixes the legacy under-recovery, defect #5).

**Why this priority**: Selling on Mercado Livre / Shopee is the seller's reality, but a single correct
gross-up on both prices is enough for E1; the multi-channel comparator and saved scenarios are E5.

**Independent Test**: For each base price, commission % and fixed fee, confirm `preço para anunciar =
(base + fixedFee)/(1 − commissionPct/100)` and that `recebido líquido` nets back to the base (within rounding).

**Acceptance Scenarios**:
1. **Given** commission % and fixed fee both 0, **When** computed, **Then** no marketplace uplift is applied
   (list price = base) and no marketplace line is forced onto the seller.
2. **Given** commission % and fixed fee > 0, **When** computed, **Then** for both varejo and atacado the
   calculator shows `preço para anunciar = (base + fixedFee)/(1 − commissionPct/100)` and a `recebido líquido`
   that nets back to that base.
3. **Given** a commission of 100% (degenerate), **When** entered, **Then** the calculator refuses it with a
   clear pt-BR message rather than dividing by zero.

### User Story 6 — Use the full calculator free, offline, saving nothing (Priority: P3)

The seller uses the entire E1 calculator **without signing in, without a network connection, and without
saving anything**. Persistence, history and export are Premium and belong to later epics; the calculator
itself is permanently free.

**Why this priority**: This encodes the freemium boundary (`docs/product/business-rules.md`: computation is
free) directly onto E1 so no later increment accidentally paywalls the math. Behaviorally inherited from 003,
restated here so it is an E1 acceptance surface.

**Independent Test**: With no network and while signed out, enter inputs and confirm retail, wholesale and the
full breakdown all compute; confirm nothing is offered to be saved and no premium prompt appears.

**Acceptance Scenarios**:
1. **Given** a signed-out visitor offline, **When** they use the calculator, **Then** all outputs compute
   locally with no error.
2. **Given** any calculator state, **When** the seller looks for a save/export/history affordance, **Then**
   none is present in E1 (those are E2/E4) and no paywall gates the calculation.

### Edge Cases
- **rollWeightKg = 0** or blank, or **machineLifetimeHours = 0** → validation message; never render
  NaN/Infinity/`#DIV/0!` (fixes the legacy unguarded divisions).
- **commissionPct ≥ 100** → refused with a pt-BR message (gross-up denominator ≤ 0).
- **avgPowerKw** unusually high (nameplate mistaken for average) → still computes; the field tooltip warns it
  is the real average draw, not the nameplate (~0,12 kW typical).
- **Huge values** (e.g. 100 kg, 9999 h) → compute without overflow and without horizontal scroll at 390 px
  (inherits 003 FR-010).
- **All-zero optional inputs** → price identical to the mandatory-only computation.
- **Print time = 0** → energy and machine lines are 0; the calculator still returns a coherent material-only
  cost (no crash).

---

## 2. Requirements

### Functional Requirements

#### 2.1 Input surface

Two default kinds: **"optional, default 0"** (contributes nothing until touched) vs **"required, pre-filled
starting value"** (an editable UX default that *does* affect the price — a starting value, not a formula
constant).

| # | Field (wire name) | Unit | Required? / default | Validation intent |
|---|---|---|---|---|
| **FR-001** | `costPerRoll` | R$ | required | finite, ≥ 0 |
| **FR-002** | `rollWeightKg` | kg | required | finite, **> 0** |
| **FR-003** | `printGrams` | g | required | finite, ≥ 0 |
| **FR-004** | `wasteGrams` (desperdício: purga/brim/suporte/refugo) | g | optional, **default 0** | finite, ≥ 0 (single field in v1 — R-1) |
| **FR-005** | `printTimeHours` | h | required | finite, ≥ 0 |
| **FR-006** | `avgPowerKw` (consumo médio efetivo) | kW | required, **pre-fill 0,12** | finite, ≥ 0; tooltip = "média real, não a potência de placa" |
| **FR-007** | `tariffPerKwh` | R$/kWh | required | finite, ≥ 0 |
| **FR-008** | `machineValue` | R$ | required | finite, ≥ 0 |
| **FR-009** | `machineLifetimeHours` | h | required | finite, **> 0** |
| **FR-010** | `maintenanceReservePerHour` | R$/h | optional, **default 0** | finite, ≥ 0 |
| **FR-011** | `failurePct` | % | optional, **default 0** | finite, ≥ 0 |
| **FR-012** | `finishTimeHours` | h | optional, **default 0** | finite, ≥ 0 |
| **FR-013** | `finishRatePerHour` | R$/h | optional, **default 0** | finite, ≥ 0 |
| **FR-014** | `laborHours` | h | optional, **default 0** | finite, ≥ 0 |
| **FR-015** | `laborRatePerHour` | R$/h | optional, **default 0** | finite, ≥ 0 |
| **FR-016** | `adminTotal` (outros custos) | R$ | optional, **default 0** | finite, ≥ 0 (single field in v1; itemization → E2) |
| **FR-017** | `markupVarejoPct` | % | required, **pre-fill 50** | finite, ≥ 0 |
| **FR-018** | `markupAtacadoPct` | % | required, **pre-fill 30** | finite, ≥ 0 |
| **FR-019** | `marketplaceCommissionPct` | % | optional, **default 0** | finite, in [0, 100) |
| **FR-020** | `marketplaceFixedFee` | R$ | optional, **default 0** | finite, ≥ 0 |

- **FR-021**: The calculator MUST NOT present any tax / `imposto %` input or per-unit tax line (A24 — the MEI
  DAS is a fixed monthly amount, not a per-piece percentage; modelling it per unit would be wrong).
- **FR-022**: Every input MUST display its unit (g, kg, h, kW, kWh, R$, %), accept **pt-BR/BRL** locale (comma
  decimal, `R$` prefix), be i18n-ready, and `avgPowerKw` MUST carry a tooltip explaining it is the real average
  draw, not the nameplate power.
- **FR-023**: "Optional, default 0" inputs (FR-004, FR-010..FR-016, FR-019, FR-020) MUST contribute **0** to
  `custo_total`/price while untouched. "Required, pre-filled" inputs (FR-006, FR-017, FR-018) MUST ship with
  their editable starting value and MUST be freely changeable (they are UX defaults, not constants).

#### 2.2 Computed outputs

- **FR-024**: `material = (costPerRoll / (rollWeightKg × 1000)) × (printGrams + wasteGrams)`.
- **FR-025**: `energy = printTimeHours × avgPowerKw × tariffPerKwh` — a single effective-draw kW field; there
  is no nameplate-power or duty-factor input (A16.2, owner 2026-07-05).
- **FR-026**: `machineHourRate = machineValue / machineLifetimeHours + maintenanceReservePerHour` and
  `machine = machineHourRate × printTimeHours` (ADR-0009 A — one coherent capital-recovery; no separate
  maintenance/ROI/depreciation lines, A16.3).
- **FR-027**: `falha = (material + energy + machine) × failurePct/100` — the failure factor MUST cover **all
  three production inputs**, never material alone (A16.4).
- **FR-028**: `finishing = finishTimeHours × finishRatePerHour` (explicit time × rate — A16.5).
- **FR-029**: `custo_total = material + energy + machine + falha + finishing + labor + admin`, where
  `labor = laborHours × laborRatePerHour` and `admin = adminTotal`. Finishing, labor and admin are **outside**
  the failure base (OQ-8 confirmed 2026-07-05).
- **FR-030**: `preco_varejo = custo_total × (1 + markupVarejoPct/100)` and
  `preco_atacado = custo_total × (1 + markupAtacadoPct/100)`; **both MUST be shown together**.
- **FR-031**: When a marketplace fee is set (commission % > 0 or fixed fee > 0), for **each** of `preco_varejo`
  and `preco_atacado` the calculator MUST compute and show `preço para anunciar =
  (base + marketplaceFixedFee) / (1 − marketplaceCommissionPct/100)` and `recebido líquido =
  preço_anuncio × (1 − commission/100) − fixedFee` (which equals the base by construction). When both fee
  inputs are 0, no uplift is applied and no marketplace values are shown.

#### 2.3 Breakdown & transparency

- **FR-032**: The calculator MUST render a per-line cost breakdown (material, energy, machine, failure,
  finishing, labor, admin) in R$, and the visible lines MUST **sum to `custo_total`** with no residual after
  the rounding policy (FR-037).
- **FR-033**: The breakdown MUST show how each sale price derives from `custo_total` (the applied markup) and,
  when a marketplace fee is set, MUST show for both varejo and atacado the `preço para anunciar` **and** the
  `recebido líquido` (so the fee's bite is transparent).
- **FR-034**: Zero-value optional lines MAY be de-emphasized or omitted but MUST NOT be presented as required
  and MUST NOT break the breakdown sum.

#### 2.4 Free tier, formula source, robustness

- **FR-035**: The entire E1 calculator MUST be **free**: usable **signed-out and offline**, with **no
  persistence of any kind**, no export, no history, and **no premium gate** (consistent with
  `business-rules.md` FREE tier and 003 FR-003).
- **FR-036**: All computation MUST originate in `packages/pricing-core` (pure, deterministic, offline); the
  **backend MUST NOT recompute** any price. `pricing-core` takes a **MAJOR semver bump** (markup base moved
  `material → custo_total`, A25) and MUST stamp `PRICING_MODEL_VERSION = "2.0.0"` on its result so E4 can
  snapshot it later.
- **FR-037**: Rounding MUST follow **ADR-0008**: each cost line and each output is 2-decimal **HALF_UP**, and
  the breakdown's displayed lines sum to the displayed `custo_total`. `pricing-core` is the single source of
  the rounding policy.
- **FR-038**: The calculator MUST never surface `NaN`, `Infinity` or division-by-zero; invalid inputs
  (rollWeightKg ≤ 0, machineLifetimeHours ≤ 0, commissionPct ≥ 100, negatives, non-finite) MUST produce a clear
  pt-BR validation message instead of a bad number (fixes legacy `#DIV/0!`).
- **FR-039**: The math MUST be deterministic and free of time/locale dependence — identical inputs always
  yield identical outputs.

### Key Entities *(include if feature involves data)*

- **Print pricing input (ephemeral, client-only)**: the field set in §2.1 for one piece. Not persisted in E1
  (persistence is E2).
- **Price result (ephemeral, client-only)**: the cost breakdown, `custo_total`, retail/wholesale prices,
  marketplace `preço para anunciar` / `recebido líquido`, and the `PRICING_MODEL_VERSION` stamp. Computed by
  `pricing-core`; not persisted in E1.

---

## 3. Success Criteria

### Measurable Outcomes

- **SC-001 (canonical worked example).** Inputs: costPerRoll R$ 100,00 · rollWeightKg 1 · printGrams 100 g ·
  wasteGrams 10 g · printTimeHours 5 · avgPowerKw 0,10 · tariffPerKwh R$ 1,00 · machineValue R$ 4.000,00 ·
  machineLifetimeHours 2.000 · maintenanceReservePerHour 0 · failurePct 10 · finishTimeHours 0,5 ·
  finishRatePerHour R$ 10,00 · labor 0 · adminTotal 0 · markupVarejoPct 50 · markupAtacadoPct 30 ·
  marketplaceCommissionPct 20 · marketplaceFixedFee R$ 5,00. *(avgPowerKw here is 0,10 kW, a valid effective
  draw; the field's editable pre-fill is 0,12 kW. Markup/fee values are the pre-fills.)* Expected (± R$ 0,01):
  material **R$ 11,00** · energy **R$ 0,50** · machine **R$ 10,00** · falha **R$ 2,15** · finishing
  **R$ 5,00** · **custo_total R$ 28,65** · **preço varejo R$ 42,98** · **preço atacado R$ 37,25** ·
  marketplace **anúncio varejo R$ 59,98** / **recebido líquido varejo R$ 42,98** · marketplace **anúncio
  atacado R$ 52,81** / **recebido líquido atacado R$ 37,25**.
- **SC-002 (breakdown sums to total).** For SC-001 and for randomized valid inputs, the visible breakdown
  lines sum to the displayed `custo_total` with 0 residual under HALF_UP 2-decimal rounding.
- **SC-003 (correct gross-up, both prices).** For each base B ∈ {varejo, atacado}, commission p% (< 100),
  fixed fee f: `preço para anunciar = (B + f)/(1 − p/100)`, and `recebido líquido` nets back to B within
  R$ 0,01. For SC-001 retail: (42,98 + 5,00)/0,80 = R$ 59,98 → recebido líquido R$ 42,98.
- **SC-004 (optional default 0, isolated effect).** With labor, admin and marketplace fee at their 0 defaults,
  every price equals the mandatory-only computation exactly. Setting laborHours 2 × laborRatePerHour R$ 25
  raises `custo_total` by exactly **R$ 50,00** (→ R$ 78,65) and moves only the labor line.
- **SC-005 (effective-draw energy).** `energy = printTimeHours × avgPowerKw × tariffPerKwh`; changing
  `avgPowerKw` from p1 to p2 scales only the energy line by p2/p1. No nameplate or duty-factor input exists.
- **SC-006 (failure over all production inputs).** For SC-001, `falha = R$ 2,15` (10% of 21,50), **not**
  R$ 1,10 (10% of material) — the assertion fails if failure is applied material-only.
- **SC-007 (machine-hour = ADR-0009 A).** `machineHourRate = machineValue/machineLifetimeHours +
  maintenanceReservePerHour`; for SC-001, 4.000/2.000 + 0 = R$ 2,00/h → machine R$ 10,00. No separate
  maintenance/ROI/depreciation lines exist.
- **SC-008 (no bad numbers).** For rollWeightKg 0, machineLifetimeHours 0, commissionPct 100, negative or
  non-finite inputs, the calculator shows a pt-BR validation message and renders no `NaN`/`Infinity`/`#DIV/0!`.
- **SC-009 (free & offline).** With no network and signed out, retail, wholesale and the full breakdown all
  render for valid inputs; no save/export/history affordance and no paywall are present.
- **SC-010 (retail + wholesale both shown).** For any valid inputs both prices are shown; retail ≥ wholesale
  whenever markupVarejoPct ≥ markupAtacadoPct (default 50 ≥ 30).
- **SC-011 (single formula source + version stamp).** No server round-trip is needed to obtain any price
  (backend performs no price computation); `pricing-core` stamps `PRICING_MODEL_VERSION = "2.0.0"` on the
  result.
- **SC-012 (determinism).** Identical inputs produce byte-identical outputs across runs and locales.

---

## 4. Out of Scope (non-goals — each with its deferral target)

- **Taxes / `imposto %` per unit** — OUT of v1 (A24). Deferral: a dedicated **fiscal epic** only if a
  Simples/MEI-DAS module is ever validated; unscheduled. No tax field in E1.
- **Multi-channel marketplace simulator** (Mercado Livre / Shopee side-by-side), **saved scenarios**, ML
  free-shipping subsidy > R$ 79 — **E5**. E1 ships one channel, gross-up on both prices.
- **Catalog + persistence** of filaments / printers / products, and saving any calculation — **E2** (where the
  server-side entitlement scaffolding lands; admin-cost itemization also arrives here).
- **Multi-piece BOM** (a product = sum of its pieces) — **E3**. E1 prices one piece.
- **History, reproducible frozen snapshots, export/share (PDF/CSV)** — **E4** (the `PRICING_MODEL_VERSION`
  stamp introduced in FR-036 exists to enable it later).
- **STL upload / 3D viewer / volume-from-model estimation** — **A26 permanent non-goal** for the manual-grams
  model; revisit only as a future epic if ever validated (the "3D" in the name does not imply it).
- **Billing / premium gating of the calculator** — **E6**; the E1 calculator stays free.
- **Goal-seek (target-margin → price), break-even / price-floor per channel, competitor-positioning alerts,
  progressive quantity-discount curve** — improvement backlog, **post-E1, unscheduled**.

---

## 5. Residual questions for `/speckit-clarify`

All frozen-scope open questions were resolved by the owner on 2026-07-05. These residuals are minor and
low-risk; change-likelihood flags follow the tech-debt governing rule.

- **R-1 — Waste granularity.** v1 ships a single `desperdício (g)` field (mirrors the admin single-field
  decision). Confirm itemization (purga/brim/suporte/refugo) is deferred (candidate E2). **Change-likelihood:
  LOW.**
- **R-2 — Failure / finishing pre-fill.** This spec sets both to "optional, default 0" (approachable,
  consistent with all other optional cost inputs). Confirm the owner does not want a suggested non-zero failure
  starting value (e.g. 5%). **Change-likelihood: LOW.**
- **R-3 — Marketplace fee delta line.** Beyond `preço para anunciar` and `recebido líquido`, should the
  breakdown also surface the explicit fee amount deducted (anúncio − líquido) as its own transparency line?
  **Change-likelihood: LOW.**
- **R-4 — Exact `avgPowerKw` pre-fill.** Owner said "~0,12 kW"; this spec pins **0,12**. Confirm the exact
  value (research range 0,10–0,15 kW). **Change-likelihood: LOW.**

---

## Assumptions

- Builds on **003-app-shell-and-ds** (CLOSED 2026-07-03): the 4-tab shell, DS, offline PWA, pt-BR/BRL input UX,
  the `ErrorCode`→pt-BR map and the `pricing-core`↔UI wiring pattern are in place and green.
- `docs/pricing-model-from-spreadsheet.md` is used **only as a cost-category checklist** (A15 clean-room); no
  wording, layout, constants or calibrations are carried over from the Amado3D sheet. Legacy defaults are
  reference only; the +50%/+30% pre-fills are the owner's independent choice.
- **ADR-0009** (machine-hour capital-recovery: `value ÷ lifetime + reserve`) and **ADR-0008** (rounding
  HALF_UP 2dp + `pricing-core` version registry / `PRICING_MODEL_VERSION`) are the technical decisions this
  spec consumes; `arquiteto` owns their final wording.
- Copy is pt-BR, i18n-ready. This document specifies **behavior**, not UI pixels (UX → designer-ux, UI →
  Claude Design).
