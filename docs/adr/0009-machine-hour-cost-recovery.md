# ADR-0009: Machine-hour capital-recovery method (single coherent R$/print-hour)

- **Status**: Accepted
- **Date**: 2026-07-05
- **Deciders**: Jonatan (owner) + planning round (arquiteto), 2026-07-05

## Context

E1 (`feature/004-e1-pricing-model`) computes a full first-principles cost model. Sub-decision **A16.3**
(scope frozen 2026-07-05, `docs/decisions/audit-findings-r2.md` §5) requires **one single, coherent,
non-overlapping** method to turn "the machine costs money to own and run" into a **R$/print-hour** figure
that feeds `custo_producao` (alongside material, energy, failure, finishing).

Two constraints frame this decision:

1. **No triple-count (fixes clean-room defect #2).** The reverse-engineered legacy sheet recovers the
   machine's purchase price **three overlapping times** — a maintenance line (a % of machine value), a
   ROI/payback line, and a depreciation line — inflating unit cost. Its depreciation line is also
   dimensionally broken (defect #1: `hours ÷ R$/month` → a constant that means nothing). E1 must collapse
   this to **one** capital line with a provable no-overlap argument.
2. **Approachable for a solo MEI seller.** The inputs the calculator demands must be answerable by a
   one-person shop, not a cost accountant. An input the user cannot honestly estimate is worse than a
   defensible default.

**IP / clean-room (A15).** Straight-line amortization, payback math, and `energy = h·kW·tariff` are standard,
non-protectable cost-engineering. This ADR uses those first principles freely and **does not** carry over the
Amado3D sheet's specific expression: its categorical "Nível de Uso" wear percentages (10/20/30/45%), its
fiscal-depreciation block, or its labels.

**The conceptual key to killing the triple-count.** Three things are habitually conflated; separating them
is the whole decision:

| Concept in the legacy sheet | What it economically *is* | Where it belongs in E1 |
|-----------------------------|---------------------------|------------------------|
| Depreciation line           | Recovering the purchase price | **THE** machine-hour capital line (once) |
| ROI / payback line          | Recovering the purchase price **+ a desired return** | Capital recovery = the same line; the **return** is **markup** over `custo_total` (A25) — never in the machine rate |
| Maintenance = % of machine value | A **disguised second capital recovery** (scales with purchase price) | **Forbidden as-is.** Maintenance is legitimate only when modelled as **cash for consumables/repairs in R$** (nozzles, belts, hotend, PTFE, bed), which is disjoint from the purchase price |

So: **depreciation ≡ amortization ≡ capital recovery = ONE line.** **ROI's return = markup (A25), counted once,
elsewhere.** **Maintenance may be a separate line only if expressed as R$ of wear parts, never as a % of
machine value.** Every option below obeys this; they differ only in how the user expresses the horizon.

## Options considered (≥3, per Constitution)

### Option A — Straight-line amortization per hour (+ optional separate maintenance reserve) — CHOSEN
Formula:
```
custo_maquina_hora = machine_price / expected_lifetime_hours          # capital recovery (ONCE)
                   + maintenance_reserve_ano / expected_annual_hours  # OPTIONAL, default 0
custo_maquina      = custo_maquina_hora * tempo_h
```
- **User inputs:** `machine_price` (R$ — known exactly); `expected_lifetime_hours` (h — the single abstract
  knob); optional `maintenance_reserve_ano` (R$/ano) + `expected_annual_hours` if the wear line is enabled.
- **How it avoids the triple-count:** exactly one capital line (amortization = depreciation, single count);
  **no return term** (that is markup's job over `custo_total`, A25, so profit is counted once); the optional
  maintenance line is a **R$ cash reserve for wear parts**, not a % of machine value, so it is dimensionally
  and economically disjoint from recovering the purchase price.
- **Pros:** dimensionally correct (`R$ ÷ h = R$/h`, fixing defect #1); textbook straight-line (matches the
  amortization stance already in ADR-0004); one knob; safe default (maintenance 0 keeps v1 minimal); trivial
  to snapshot and to reason about in E5 multi-machine work.
- **Cons:** `expected_lifetime_hours` is abstract for a solo seller (mitigate with a shipped sensible default
  and a helper "≈ anos × horas/dia"); it does not itself express a desired payback speed (intentional — that
  is markup / a business goal, not a cost).
- **Scalability impact:** high — a clean, composable primitive; per-machine cadastre (E2) and utilization
  modelling (E5) layer on without reshaping it; no locale-bound constants (i18n-safe).
- **Confidence:** 78%

### Option B — Payback-window per hour — rejected
Formula:
```
custo_maquina_hora = machine_price / (payback_meses * h_dia * dias_mes)
custo_maquina      = custo_maquina_hora * tempo_h
```
- **User inputs:** `machine_price` (R$); `payback_meses` (horizon the owner picks); `h_dia`; `dias_mes`.
- **How it avoids the triple-count:** it recovers the purchase price **exactly once** over the chosen window.
  It has the *shape* of the sheet's `roi` line, but here it is the **sole** capital-recovery method (the
  sheet's error was having `roi` **and** maintenance **and** depreciation). No return is added on top —
  markup still provides profit once.
- **Pros:** the most business-friendly inputs ("quero pagar a impressora em 18 meses, rodo ~6 h/dia,
  ~26 dias/mês") — highly approachable for MEI; directly answers "quando recupero a máquina"; no abstract
  lifetime-hours guess.
- **Cons:** it is a **financing horizon, not the machine's economic life** — after `payback_meses` the rate
  implies R$0/h while the machine still wears/depreciates, so long-term it under-recovers; it couples the
  **cost** rate to a **business goal** (arguably markup's territory); the `h_dia`/`dias_mes` utilization guess
  drives the rate strongly (a low-utilization guess inflates the hourly cost).
- **Scalability impact:** medium — fine for v1 single-machine; the "R$0 after payback" cliff needs an explicit
  story at E5 (utilization / multi-machine).
- **Confidence:** 62%

### Option C — Blended TCO per hour (one transparent rate, documented sub-parts) — rejected
Formula:
```
custo_maquina_hora = machine_price       / expected_lifetime_hours   # capital recovery (ONCE)
                   + manutencao_vida_util / expected_lifetime_hours   # wear/consumables (R$, separate)
# NO return term — profit stays in markup
custo_maquina      = custo_maquina_hora * tempo_h
```
- **User inputs:** `machine_price` (R$); `expected_lifetime_hours` (h); a single `manutencao_vida_util` (R$
  of wear parts over the whole life) — one number instead of an annual reserve + annual hours.
- **How it avoids the triple-count:** capital counted once; wear is a distinct R$ figure (not a % of machine
  value); return omitted (markup). Both sub-parts share one lifetime horizon and are documented so the single
  displayed rate stays auditable.
- **Pros:** one line in the UI (least intimidating) yet a transparent two-part breakdown; folds maintenance
  without a second utilization input; a single consistent horizon for both parts.
- **Cons:** hides two concepts behind one number (transparency then depends on us surfacing the sub-parts —
  in tension with the "breakdown sums to the total" rule of ADR-0008 if collapsed); still needs
  `expected_lifetime_hours` (same abstraction cost as A); slightly more model surface than A.
- **Scalability impact:** high — same primitive as A plus one documented term; good for E5.
- **Confidence:** 70%

## Decision

**Option A — straight-line amortization per hour**, with an optional **separate** maintenance reserve
(default `0`), explicitly non-overlapping:

```
custo_maquina_hora = valor_maquina / vida_util_horas          # capital recovery, counted ONCE
                   + reserva_manutencao_ano / horas_ano        # OPTIONAL, default 0, wear parts in R$
custo_maquina      = custo_maquina_hora * tempo_h
```

Rationale (one line): it is the minimal dimensionally-correct primitive A16.3 asks for — a **single** capital
line — with the cleanest provable no-triple-count and the least model surface; the abstract `vida_util_horas`
input is mitigated with a shipped default + a derived helper, and Option C stays available as a strict superset
if a maintenance line later proves necessary.

**Triple-count reconciliation (provable):**
- **Depreciation / amortization** → the ONE capital line. Counted exactly once; dimensionally `R$ ÷ h`.
- **ROI / return** → **dropped from the machine rate on purpose.** The desired return lives in **markup over
  `custo_total`** (A25). Embedding a return in the machine rate *and* applying markup would double-count
  profit; we do not.
- **Maintenance** → either **omitted** (default `0`) or a **separate R$ cash reserve for wear parts**, never a
  % of machine value. As R$-of-consumables it cannot overlap the purchase-price recovery.

**Input-UX implication (what the E1 calculator must ask):**
- `valor da máquina` (R$).
- `vida útil estimada` (horas) — presented as a preset/derived helper ("≈ anos × horas/dia") with a shipped
  sensible default so a solo MEI never invents it cold.
- Optional, default `0`, clearly labelled: `peças de desgaste (bico, correias, hotend) — separado da
  amortização` (not the sheet's %-of-value wear).

Jonatan approved Option A in the 2026-07-05 planning round.

## Consequences

- **Positive:** kills the legacy triple-count and the dimensionally-broken depreciation line with a documented
  one-line capital recovery; keeps profit in exactly one place (markup, A25); the chosen input set is small
  and MEI-answerable; the R$/h primitive composes cleanly into `custo_producao` and later per-machine/E5 work;
  no Amado3D constants or labels carried over (A15 clean-room preserved).
- **Negative / trade-offs accepted:** `vida_util_horas` is an **estimate** the user must supply — mitigated
  with a default/helper but not removable; deliberately excluding a machine-level return means the machine line
  is "cost only," and the entire return story rests on markup being set sensibly.
- **Follow-ups / new ADRs triggered:**
  - Feeds the E1 domain model in `packages/pricing-core` (`custo_maquina` line of `custo_producao`); its
    version stamp + rounding are governed by **ADR-0008**.
  - Ship a sensible **default** for `vida_util_horas` as product/UX content — not a protected architectural
    choice; capture the number when the E1 calculator copy is written.
  - E2 per-machine cadastre and E5 utilization/multi-machine modelling reuse this rate.
