# Feature Specification: E1 expansion — multi-channel marketplace pricing + itemized other-costs

**Feature Branch**: `feature/004-e1-pricing-model` (spec dir `005-…`; ships in the **same** E1 PR as 004 — one merged increment, per owner "expandir o E1 antes de mergear")

**Created**: 2026-07-06

**Status**: Draft — clarifications resolved + **architecture decided** (ADR-0010 fee-catalog + ADR-0011 pricing-core 3.0.0, both owner-homologated 2026-07-06; fee catalog delivery **amended 2026-07-06 → served endpoint + persisted client cache + bundled seed**). Constitution VIII gate clear. **Ready for `/speckit-plan`.**

**Input**: On top of the built 004 calculator (US1–US6, corrected cost model, single-channel gross-up), let the seller price the **same product across several marketplace channels and listing types at once**, with the per-channel fees pre-filled from a **dated, versioned fee catalog served by the backend and cached client-side, with a bundled seed for first-run offline** (updated via PR + backend deploy; ADR-0010), editable and offline-capable; turn the single "Outros custos" field into a **slot of named sub-costs**. Markup stays **% over `custo_total`** (owner decision). Everything stays **free, offline, signed-out** — no save/export/history, no paywall. Supersedes the E5 "multi-channel simulator" deferral in `specs/004-e1-pricing-model/spec.md` §4 by pulling it forward into E1.

> **Decisions already made by owner (carried in).** Fee reference = dated, versioned catalog **served by a public backend endpoint (`GET /api/v1/fee-catalog`) and cached in a persisted client store, with a MANDATORY bundled seed** for the first-ever offline load (ADR-0010, delivery amended 2026-07-06 — the endpoint serves the committed in-repo artifact per the owner's "artefato no repo + PR" choice; the ML PR-ingestion still human-gates writes), pre-fills each slot and is editable; the calculator computes fully offline from the store/seed, including first run. · Marketplace outcome **composes the product's headline price** (per-channel announce prices ARE the result) **unless** the seller flips a master toggle to treat channels as a side simulation — default **included**. · "Outros custos" becomes a **slot with named sub-costs** whose sum flows into `custo_total` exactly as 004's single `adminTotal` did. · **Markup stays % over cost** (no change). · Commission ≥ 100 % → **inline per-slot error**, never a silent clamp. · The corrected multi-channel/fee-catalog UI was homologated in the Claude Design prototype (2026-07-06, 8 corrections verified).
>
> **Clarifications resolved (owner, 2026-07-06).** **Scope = exactly three marketplaces — Mercado Livre, Amazon, Shopee — all curated.** AliExpress, Magalu, Casas Bahia and Elo7 are OUT of this increment (source-of-truth research 2026-07-06: Elo7 shut down 2026-05-11; the others have no public/reliable fee source — see "Fee sources of truth" below). · **Q2 → model the Mercado Livre free-shipping subsidy now**, but as an **editable estimate** with an honesty seal: verified research shows the ML subsidy is reputation/weight/volume/region-dependent and **not curatable as an exact number**, so it is seller-estimated (optionally seeded by a rough default), never presented as an authoritative catalog value.

> **Truth-over-approval note (Constitution II).** Real per-marketplace fee *values* are NOT fabricated in this spec — the §3 worked-example fee numbers are **self-consistent test vectors**, not asserted live fees. The verified sources of truth (and their limits) are recorded in "Fee sources of truth" below; every curated value MUST carry a `sourceUrl` + `effectiveDate` and be reconciled against that source at implementation. Confidence in the behavioral model: **92%** (scope now locked; residual is the ML-subsidy estimation approach + the fee-catalog contract, both routed to `arquiteto`).

---

## The E1 v3 model delta (only what changes from 004)

004's cost pipeline (`material · energy · machine · producao · falha · finishing · labor · custo_total · preco_varejo · preco_atacado`) is **unchanged**. `packages/pricing-core` takes a **MAJOR bump → `3.0.0`** for the two structural changes below. All amounts BRL; rounding stays ADR-0008 (2-dp HALF_UP per line, sums reconcile).

```
# CHANGE 1 — "outros custos" becomes an itemized list (was one adminTotal field in 004)
otherCosts  = [ { name, value }, … ]                 # 0..N named sub-costs, each value ≥ 0
admin       = Σ otherCosts[i].value                  # empty list ⇒ 0 (behaviourally identical to 004 adminTotal)
custo_total = producao + falha + finishing + labor + admin      # shape unchanged; admin now a sum

# CHANGE 2 — marketplace becomes MULTI-CHANNEL (was one implicit channel in 004)
# channels = [ { marketplace, feeDeterminants, commissionPct, fixedFee, freightInputs }, … ]  (starts with 1; add/remove)
# feeDeterminants are MARKETPLACE-SPECIFIC (research 2026-07-06):
#   Mercado Livre → listingType (Clássico | Premium) + category   (commission + custo fixo depend on both)
#   Amazon        → category (referral % + per-item commission-floor minPerItem = R$1 verified; R$2/category unconfirmed) + plan (Individual → fixedFee R$2/item; Profissional → R$19/mo, fixedFee 0)
#   Shopee        → none selectable — commission + fixed fee derive purely from the listing price band
# The catalog resolves (commissionPct, fixedFee) from feeDeterminants + listing price; the seller may override any.
for each channel c, for base in { preco_varejo, preco_atacado }:
    (commissionPct, fixedFee, minPerItem) = resolveFee(c.marketplace, c.feeDeterminants, listingPrice)  # catalog or override; minPerItem default 0
    # commission is a FLOOR: effective commission R$ = max(commissionPct/100 * list, minPerItem)   (Amazon per-item minimum; 0 elsewhere)
    # gross-up solves `list` so net == base — piecewise, the minimum binds only at low list prices, resolved by the SAME deterministic
    # fixed-point as the price band:
    #   regime %:   list = (base + fixedFee) / (1 - commissionPct/100)     when commissionPct/100 * list >= minPerItem
    #   regime min: list = base + minPerItem + fixedFee                    when the minimum binds
    preco_anuncio    = grossUpWithFloor(base, commissionPct, fixedFee, minPerItem)   # deterministic (band + commission floor)
    freightCost      = freightComponent(c.marketplace, listingPrice, c.freightInputs)  # ML subsidy estimate / Shopee co-funded voucher; 0 if n/a
    recebido_liquido = preco_anuncio - max(commissionPct/100 * preco_anuncio, minPerItem) - fixedFee - freightCost   # == base by construction

# results = a LIST over channels; each channel is independent and shown together ("Preços por canal").
# The gross-up per channel matches 004 FR-031; NEW terms are cardinality (1 → N) and a GENERIC per-channel
# freight/free-shipping component (not ML-only): ML = an editable subsidy ESTIMATE (reputation/weight/volume/
# region — not curatable exactly); Shopee = a seller-co-funded free-shipping voucher (band-based, curatable);
# Amazon = 0 here (own/FBA shipping, out of this model). When freightCost > 0, recebido_liquido < base by that
# cost — truthful (the channel really keeps it), not a rounding drift. No marketplace fee/freight is EVER added
# into custo_total.

# INCLUDE / EXCLUDE toggle:
#   included (default): the per-channel announce prices ARE the headline pricing result.
#   excluded:           headline = the direct preco_varejo / preco_atacado (cost × markup); channels shown as a labelled side simulation.
```

**Fee reference (catalog).** Keyed by `(marketplace, feeDeterminants)`, the reference supplies `commissionPct`, `fixedFee` (incl. price-band schedule), an optional freight/free-shipping component, a **source** label, a **sourceUrl**, an **effectiveDate** and a **lastReviewed** date. **Delivery (ADR-0010, amended 2026-07-06):** the catalog is a **dated, versioned artifact committed in the repo and served by a public `GET /api/v1/fee-catalog` endpoint**; the client **fetches it on first `Calcular` load and persists it to a client store**, reading the store thereafter, while a **bundled seed** ships in the build so a first-ever **offline** visitor still pre-fills. Resolution order: **store (freshest) → seed (first run) → refresh from the endpoint when online**; a fetch failure is **non-blocking** (falls back to store → seed, with a retry affordance). The seller can always **override** any pre-filled value, and can **enter fees manually** for an uncovered combination. The catalog is **reference data only** — no price is computed from it on the server; all math stays in `pricing-core` (FR-036 preserved). **How the artifact is maintained (verified 2026-07-06):** Amazon and Shopee values are **hand-curated** from official published pages (no public fee-schedule API exists for either); **Mercado Livre** values are refreshed by a scheduled backend job that reads the ML `listing_prices` endpoint (`percentage_fee` + `fixed_fee`, site-wide) via **one house ML account's OAuth** and **opens a PR with the fee diff** (owner reviews/merges per ADR-0006; deploy publishes). The catalog updates on **PR + backend deploy** — the endpoint serves the committed artifact (R6=(a): not a datastore), preserving the ML PR human-gate while freshness reaches clients on a backend deploy without a web/app release (ADR-0010).

### Fee sources of truth (verified 2026-07-06 — the anti-fabrication record)

Every curated value MUST trace to the official source below, stamped with `sourceUrl` + `effectiveDate`, and be re-reviewed on a cadence (fees change with weeks of notice). This table is the reference that keeps the catalog honest (Constitution II).

| Marketplace | Official source of truth | Fee API for a schedule? | Verified structure (2026-07-06) | Curation |
|---|---|---|---|---|
| **Mercado Livre** | `vendedores.mercadolivre.com.br/nota/como-funcionam-as-taxas...` + `developers.mercadolivre.com` (fees-for-listing) | **Yes** — `GET /sites/MLB/listing_prices` returns `percentage_fee` + `fixed_fee` site-wide, but needs **one house account's OAuth** (no app-only token; 6 h refresh; BR egress IP) | Comissão Clássico **10–14 %** / Premium **15–19 %** (by category); custo fixo < R$12,50 = **50 %** of value, R$12,50–79 = 3 bands (values not officially published → read from API), **≥ R$79 = none**; free-shipping subsidy (seller-borne, esp. > R$120) is reputation/weight/volume/region-based, **not** in the API | **Auto-refresh (ML API) + manual for the subsidy estimate** |
| **Amazon Brasil** | `venda.amazon.com.br/precos` (official, public, dated 20/01/2025) | **No** — SP-API `getMyFeesEstimate` is per-seller/per-ASIN only (OAuth) | Referral **10–15 %** by category (Casa/Cozinha/Brinquedos **12 %**, Papelaria **13 %**, Outros **15 %**) **with a per-item commission floor** `minPerItem` = **R$1** (verified; a per-category **R$2** floor is reported but **unconfirmed** — default R$1 unless verified) → `max(%×preço, minPerItem)`; **separately**, plan Profissional **R$19/mês** (1º ano grátis, no per-item) or Individual **R$2/item** (a flat `fixedFee`, NOT the referral floor) | **Hand-curated (quarterly review)** |
| **Shopee** | Central do Vendedor artigo **26839** (official, public, SPA — not scrapeable) | **No** — only per-order actuals (per-shop OAuth, gated) | Effective **01/03/2026**, by price band: ≤79,99 → **20 % + R$4**; 80–199,99 → **14 % + R$16–20**; ≥200 → **14 % + R$26**; R$100 cap removed; free shipping mandatory, seller co-funds voucher (**R$20/30/40** by band); CPF surcharge + R$3/item over 450 orders/90 d | **Hand-curated (quarterly review)** |

Open unknowns to resolve at implementation (do NOT hardcode): ML's exact 3-band custo-fixo values + a possible 02/03/2026 shift to weight/volume-based fixed cost (resolve live via `listing_prices`); Shopee's R$500+ band, CPF-surcharge trigger, optional 2,5 % campaign fee; Amazon's per-category exact list beyond the examples above.

---

## 1. User Scenarios & Testing

Persona unchanged: a **solo MEI 3D-print seller**. These stories extend 004's US1–US6 (still all in force); the whole calculator stays **free, offline, signed-out**. Each story is independently valuable and testable.

### User Story 1 — Price the same product across several channels at once (Priority: P1)

The seller's Marketplace section opens with **one channel slot defaulting to Mercado Livre**. They can **add** more slots (from the three supported channels — Mercado Livre, Amazon, Shopee — including a second ML listing type) and **remove** them. For every slot the calculator shows, together in one "**Preços por canal**" view, the **price to list** (`preço para anunciar`) and the **recebido líquido**, for **both** retail (varejo) and wholesale (atacado). No re-entry, no per-channel recompute — one product, every channel visible at a glance.

**Why this priority**: This is the whole point of the expansion — a seller who lists on several marketplaces needs to compare where and at what price to sell without recomputing. It is the direct promise of the owner's request.

**Independent Test**: With the canonical inputs (§3 SC-001), add a second channel; confirm both channels render `anúncio` + `líquido` for varejo and atacado, that removing a channel drops exactly its rows, and that each channel's numbers match the per-channel gross-up.

**Acceptance Scenarios**:
1. **Given** a fresh calculator, **When** the Marketplace section renders, **Then** exactly one channel slot is present, defaulting to Mercado Livre.
2. **Given** one channel, **When** the seller adds a second and picks a different marketplace (or ML listing type), **Then** the "Preços por canal" view shows announce + net for **both** channels, each for varejo and atacado, computed independently.
3. **Given** N channels, **When** the seller removes one, **Then** only that channel's rows disappear and the others are unchanged.
4. **Given** any channel with commission p% (< 100) and effective fixed fee f, **When** it computes (and the per-item minimum does not bind), **Then** `preço para anunciar = (base + f)/(1 − p/100)` and `recebido líquido` nets back to the base for both varejo and atacado; when the minimum binds, the floor regime applies (FR-110/SC-112).

### User Story 2 — Get channel fees pre-filled from a trusted, dated reference (Priority: P1)

When the seller picks a marketplace and its fee determinants (ML listing type + category; Amazon category + plan; Shopee needs none), the slot's **commission %, fixed fee and any freight component are pre-filled** from the dated, versioned catalog **served by the backend and cached client-side (a bundled seed covers first-run offline)**, so they don't have to know each channel's fee table. An **honesty seal** on the slot (and the section) states **where the numbers came from and how fresh they are** (e.g. "referência do catálogo · atualizada em 2026-06"). The seller can **edit any field to override**; overriding flips that slot's seal to "ajustado por você".

**Why this priority**: Fees are the hard part sellers get wrong; trustworthy pre-fills are what make the multi-channel view usable rather than a blank grid. The dated, sourced seal is a direct Constitution-II (truth) requirement — the seller must know whether a number is authoritative, embedded, or their own.

**Independent Test**: Pick Mercado Livre → confirm commission/fixed/band pre-fill from the reference and the seal shows source + date; edit the commission → confirm the seal changes to "ajustado por você" and the number is respected; switch the listing type (Clássico ↔ Premium) → confirm the fee fields update to that determinant's reference.

**Acceptance Scenarios**:
1. **Given** the reference is available, **When** the seller selects a `(marketplace, feeDeterminants)` that the catalog covers, **Then** the fee fields pre-fill from it and the seal shows the source and last-updated date.
2. **Given** a pre-filled slot, **When** the seller edits any fee field, **Then** that value is used in the computation and the slot's seal indicates a manual override.
3. **Given** a `(marketplace, feeDeterminants)` the catalog does **not** cover, **When** selected, **Then** the fields are empty/manual and the seal honestly says there is no reference (no fabricated number is shown).

### User Story 3 — Trust and adjust the fees offline; a seed guarantees first-run (Priority: P2)

The catalog is **fetched from the backend on first load and cached in a persisted client store**; a **bundled seed** guarantees the reference fees are available on the **first-ever, offline visit** with **no blocking step** — a fetch failure falls back to store → seed and offers a **retry**. The seller can **override** any pre-filled fee and can **enter fees manually** for an uncovered combination. When the active reference (store or seed) is older than the freshness window (30 days, per its `lastReviewed` date read against the device clock), the seal warns it **may be out of date** — but it still pre-fills and computes.

**Why this priority**: The 004 free/offline guarantee (US6/SC-009) must not regress. A persisted cache + a bundled seed keep the fee reference available offline (a fetch failure is non-blocking, never a blank grid); the remaining honesty risks are staleness (surfaced by the seal) and a failed refresh (non-blocking, with retry).

**Independent Test**: With no network (including a cold first-ever load), confirm the fees pre-fill from the **seed** and compute; online, confirm the app **fetches and persists** the catalog to the store; override a fee and confirm it is honoured; simulate a fetch error and confirm a **non-blocking retry** with the store/seed still pre-filling; force the active `lastReviewed` past 30 days and confirm the seal shows "pode estar desatualizada" while still computing.

**Acceptance Scenarios**:
1. **Given** a signed-out visitor offline on a first-ever load, **When** they open Marketplace, **Then** the **bundled seed** pre-fills the fees and every price computes; any fetch attempt fails **non-blockingly** (falls back to store → seed) — no blank grid, no blocking error.
2. **Given** the active reference (store or seed) is older than the freshness window, **When** a slot pre-fills, **Then** the seal flags possible staleness while still computing.
3. **Given** an uncovered `(marketplace, feeDeterminants)` or a deliberate override, **When** the seller types fees manually, **Then** they compute and the seal marks the value manual — never a bad number, never a fabricated pre-fill.

### User Story 4 — Choose whether channels shape the headline price or are a side simulation (Priority: P2)

A master toggle **"Incluir marketplaces no preço"** (default **on**) controls the framing. **Included**: the per-channel announce prices are presented as the product's pricing result. **Excluded**: the headline is the direct `preço varejo` / `preço atacado` (cost × markup) and the channel view is clearly labelled a side simulation that does **not** drive the headline.

**Why this priority**: Sellers who sell direct (own store, in person) and sellers who sell only on marketplaces need different headlines. The owner explicitly required the marketplace outcome to compose the main account unless the seller opts out.

**Independent Test**: With the toggle on, confirm the channel prices are presented as the result; flip it off and confirm the headline reverts to the direct cost×markup prices while the entire channel section is hidden (Clarification 2026-07-23, D2=A — see §5).

**Acceptance Scenarios**:
1. **Given** the toggle **on** (default) with ≥ 1 channel, **When** prices render, **Then** the per-channel announce/net prices are presented as the pricing result.
2. **Given** the toggle **off**, **When** prices render, **Then** the headline is the direct `preço varejo`/`preço atacado` and the channel section is hidden entirely — pure UI show/hide, not a labelled simulation list (Clarification 2026-07-23, D2=A).
3. **Given** the toggle **off**, **When** the seller reads the direct headline, **Then** it equals exactly the 004 cost×markup prices (no channel fee folded into it).

### User Story 5 — Itemize "Outros custos" as named sub-costs (Priority: P2)

The single "Outros custos" field becomes its own **slot** where the seller can **add several named sub-costs** ("Embalagem", "Frete até a transportadora", …), each with its own value. Their **sum flows into `custo_total`** exactly as 004's single admin total did, so both prices move by the itemized total; each named line appears in the breakdown.

**Why this priority**: Real sellers have several small overheads; naming them builds the same trust the cost breakdown does, without changing the math. It supersedes the 004 deferral of admin itemization (previously → E2).

**Independent Test**: Add sub-costs "Embalagem" R$ 3,00 and "Frete" R$ 2,00; confirm `custo_total` rises by exactly R$ 5,00 (identical to a single R$ 5,00 admin), both named lines show in the breakdown, and removing one lowers `custo_total` by exactly its value.

**Acceptance Scenarios**:
1. **Given** an empty "Outros custos" slot, **When** the price computes, **Then** it equals the 004 mandatory-only result (admin contributes 0).
2. **Given** sub-costs summing to S, **When** entered, **Then** `custo_total` and both prices increase by exactly S, and each named sub-cost appears as its own breakdown line.
3. **Given** a set of sub-costs, **When** one is removed, **Then** `custo_total` decreases by exactly that sub-cost's value with no residual.

### User Story 6 — Use the whole multi-channel calculator free, signed-out, offline — the fee catalog never gates (Priority: P3)

The entire expansion stays inside the **free, offline, signed-out** calculator: adding channels, the fee catalog, the honesty seals, and the outros-custos slot require **no sign-in**, present **no save/export/history** affordance, and are behind **no paywall**. The fee catalog is **served by a public, unauthenticated endpoint (never a gate) and cached client-side**; it is **reference data** — the **price math** requires no account or network (store/seed).

**Why this priority**: The 004 freemium boundary (computation is free) must extend cleanly over the new surfaces; the served catalog + its endpoint must not accidentally paywall or account-gate the math (the endpoint is public and never a gate; the math runs from store/seed with no account). Restated as an explicit acceptance surface so no later increment regresses it.

**Independent Test**: Signed out and offline, exercise multi-channel pricing, manual fee entry, the include/exclude toggle and the outros-custos slot; confirm everything computes, nothing is offered to be saved, and no premium prompt or sign-in wall appears.

**Acceptance Scenarios**:
1. **Given** a signed-out visitor offline, **When** they use every new surface, **Then** all outputs compute locally with no error and no gate.
2. **Given** any state, **When** the seller looks for save/export/history or a paywall, **Then** none is present (those remain E2/E4/E6).

### Edge Cases
- **commissionPct ≥ 100 on any slot** → that slot shows an inline pt-BR error and contributes no bad number; other slots keep computing.
- **First-ever load offline** → the **bundled seed** still pre-fills; a fetch may be attempted but its failure is **non-blocking** (falls back to store → seed, with retry) — never a blank grid.
- **Active reference (store/seed) older than the freshness window (30 days)** → still usable, seal flags "pode estar desatualizada".
- **A `(marketplace, feeDeterminants)` the catalog can't resolve** (uncovered combo or unverified value) → manual fields, honest "sem referência" seal.
- **Price-band fixed fee** whose band depends on the listing price → the calculator applies the band matching the **computed listing price** (see Assumptions for the fixed-point handling; a boundary price must not oscillate).
- **ML free-shipping subsidy is an estimate** → the seal must never present it as an exact/authoritative figure; the seller's override is authoritative.
- **Duplicate channels** (same marketplace + determinants twice) → allowed; each computes independently (a seller may model two price points).
- **Zero channels** (all removed) with the toggle on → headline falls back to the direct cost×markup prices; the section invites adding a channel.
- **Sub-cost with blank name** → accepted with a neutral placeholder label; **negative or non-finite sub-cost value** → per-field pt-BR validation, never NaN.
- **Many channels / many sub-costs** → compute without overflow and no horizontal scroll at 390 px (inherits 003 FR-010 / 004 edge cases).

---

## 2. Requirements

004's FR-001…FR-039 remain in force. New/changed requirements for this increment:

### 2.1 Channel slots

- **FR-101**: The Marketplace section MUST start with **exactly one** channel slot, defaulting to **Mercado Livre**.
- **FR-102**: The seller MUST be able to **add** and **remove** channel slots, choosing among the **three supported marketplaces — Mercado Livre, Amazon, Shopee**; each slot carries its own fee fields.
- **FR-103**: Selecting a marketplace MUST present that marketplace's **fee determinants** and update the fee fields accordingly: **Mercado Livre** → listing type (Clássico | Premium) + category; **Amazon** → category (+ plan Profissional | Individual); **Shopee** → none selectable (commission + fixed fee derive from the listing price band). The determinants offered MUST match how each marketplace actually prices (research 2026-07-06), not a uniform "modality".
- **FR-104**: Each slot MUST validate its fees per-field in pt-BR: `commissionPct` finite and in **[0, 100)** (≥ 100 → inline slot error, never a clamp), `fixedFee` finite ≥ 0. Invalid input on one slot MUST NOT break other slots or the headline.

### 2.2 Fee reference (catalog) & honesty

- **FR-105**: The app MUST source the fee reference for the shown `(marketplace, feeDeterminants, listingPrice)` from a **dated, versioned catalog served by `GET /api/v1/fee-catalog` (the committed in-repo artifact) and cached in a persisted client store, with a bundled seed for first-run offline** (updated via PR + backend deploy) and **pre-fill** the slot's commission, fixed fee and any freight component; the catalog is **reference data only** and MUST NOT compute any price.
- **FR-105a**: The curated catalog MUST cover exactly the **three supported marketplaces at launch — Mercado Livre, Amazon, Shopee** — each per the verified structure in "Fee sources of truth": ML commission (Clássico/Premium by category) + custo fixo bands + free-shipping subsidy estimate; Amazon referral % by category **with a per-item commission-floor `minPerItem`** (verified **R$1**; a per-category **R$2** floor is reported by one source but **unconfirmed** — curate R$1 unless verified at implementation) **plus a distinct plan-based per-item `fixedFee`** (Individual → R$2/item; Profissional → R$19/mo, fixedFee 0) — two different fees, do not conflate; Shopee price-band commission + fixed fee + co-funded free-shipping voucher. Every curated value MUST carry `sourceUrl` + `effectiveDate` and be reconciled against that official source; a value that cannot be verified MUST NOT be curated (Constitution II) — the field falls back to manual entry with a "sem referência" seal. **Carve-out:** the ML freight-subsidy **estimate** (`freight ESTIMATE.defaultSubsidy`) is *by definition* not an authoritative curated value — its **threshold price** IS sourced, but the subsidy magnitude is a labelled estimate and is therefore **exempt** from the `sourceUrl`-provenance gate (it must instead carry the "estimativa" seal and never be shown as exact — FR-111a).
- **FR-106**: Every pre-filled fee MUST be **editable**; an override MUST be used verbatim in the computation and MUST flip that slot's honesty seal to a "manually adjusted" state.
- **FR-107**: Each slot (and the section) MUST show an **honesty seal** stating the fee **source** and **freshness** — one of: catalog reference (with its `lastReviewed` date), **embedded seed reference ("referência embutida")**, possibly-stale (older than the freshness window), manually adjusted, or "no reference available". No fee number may be shown as authoritative when it is not (Constitution II). The ML freight subsidy MUST additionally be marked an **estimate** (FR-111a).
- **FR-108**: The catalog MUST be **fetched from the backend on first load and cached in a persisted client store**; a **bundled seed** MUST guarantee first-ever offline pre-fills. A fetch failure MUST be **non-blocking** (fall back to store → seed) with a **retry** affordance — never a blank grid or a blocked calculation. The calculator MUST stay fully functional offline; **manual entry** MUST be available for an uncovered combination or a deliberate override; and an active entry (store or seed) older than the freshness window (30 days) MUST still pre-fill, with the seal flagging staleness.
- **FR-109**: For any `(marketplace, feeDeterminants)` the catalog cannot resolve (an uncovered combination, or an unverified value per FR-105a), the slot MUST present empty/manual fee fields with an honest "sem referência" seal — never a fabricated pre-fill.

### 2.3 Multi-channel computation

- **FR-110**: For **each** channel and for **each** base ∈ {`preco_varejo`, `preco_atacado`}, the calculator MUST compute `preço para anunciar` and `recebido líquido = anúncio − max(commissionPct/100 × anúncio, minPerItem) − fixedFee − freightCost`, where `(commissionPct, fixedFee, minPerItem)` come from `resolveFee(marketplace, feeDeterminants, listingPrice)` (catalog or override; `minPerItem` defaults 0) and `freightCost` from FR-111a. The commission is a **floor** (`max(% , minPerItem)` — Amazon's per-item minimum); `preço para anunciar` MUST be grossed up so `recebido líquido == base`, which is piecewise (the minimum binds only at low prices). This is 004 FR-031 generalized to N channels with a commission floor.
- **FR-111**: When a marketplace prices its **fixed fee by price band** (Shopee; Mercado Livre custo fixo) **or its commission by a per-item minimum** (Amazon), the calculator MUST resolve the fee for the **computed listing price** via one **deterministic bounded fixed-point** — no oscillation at a band or floor boundary; identical inputs yield the identical listing price, fee, and regime (see Assumptions).
- **FR-111a** (Q2 — generic freight / free-shipping component): The calculator MUST subtract a per-channel `freightCost` from `recebido líquido` where the channel imposes one: **Mercado Livre** — for listings at/above the free-shipping threshold, an **editable shipping-subsidy estimate** (research 2026-07-06: reputation/weight/volume/region-dependent, therefore **not curatable as an exact catalog value** — seeded by a rough default at most, always seller-overridable, seal MUST mark it an **estimate**); **Shopee** — the seller-co-funded free-shipping **voucher ceiling** by price band (curatable from the official source); **Amazon** — `freightCost = 0` (own/FBA shipping is out of this model). Where none applies, `freightCost = 0` and `recebido líquido` equals the base as in 004. No `freightCost` value may be shown as authoritative when it is an estimate.
- **FR-111b**: Any inputs a freight component needs (e.g. ML peso/categoria) MUST be presented with sensible editable defaults; the seller MUST see and be able to override the resulting `freightCost`. Missing/unknown inputs MUST degrade to a clearly-labelled estimate or zero — never to a bad number or a blocked calculation.
- **FR-112**: All channels MUST be computed and presented **together** ("Preços por canal"), each showing announce + net for varejo and atacado. No marketplace fee is EVER added into `custo_total`.
- **FR-113**: A master **"Incluir marketplaces no preço"** toggle (default **on**) MUST govern framing: **on** → the per-channel announce prices are the presented pricing result; **off** → the headline is the direct `preco_varejo`/`preco_atacado` (equal to 004 exactly) and the channel section is hidden entirely — pure UI show/hide (Clarification 2026-07-23, D2=A; officializes the 2026-07-08 dod-evidence owner-clarification that this living spec had never been amended to reflect — audit finding FA-04). **Descope note**: `PriceResult.includeInHeadline` was never added to the pricing-core result contract — that descope decision was made and recorded in ADR-0011 (§"Field-name/shape reconciliation"), not in this spec; the toggle is client-only UI state, never carried on the computed result.

### 2.4 Itemized other-costs

- **FR-114**: "Outros custos" MUST be a slot of **0..N named sub-costs** `{ name, value }`; `admin = Σ value`, folded into `custo_total` exactly as 004's single `adminTotal` (FR-016/FR-029). An empty slot MUST be behaviourally identical to 004 (admin = 0).
- **FR-115**: Each named sub-cost MUST appear as its own line in the transparent breakdown; the breakdown MUST still sum to `custo_total` with 0 residual under ADR-0008 rounding (extends 004 FR-032).
- **FR-116**: Each sub-cost value MUST be validated per-field (finite ≥ 0) in pt-BR; a blank name MUST be accepted with a neutral placeholder label.

### 2.5 Free tier, formula source, robustness, versioning

- **FR-117**: The entire expansion MUST remain **free, signed-out, offline**, with **no persistence, export, history**, and **no premium gate**; the fee catalog is **served by a public, unauthenticated endpoint (never an entitlement gate) and cached client-side**; the **price math** requires no account or network (store/seed) (extends 004 FR-035; honours Constitution IV — nothing here is a paid entitlement to enforce).
- **FR-118**: All pricing math MUST stay in `packages/pricing-core` (pure, deterministic, offline); the backend MUST NOT recompute any price. `pricing-core` takes a **MAJOR bump → `3.0.0`** (itemized admin + multi-channel result shape) and MUST stamp `PRICING_MODEL_VERSION = "3.0.0"` on its result.
- **FR-119**: The calculator MUST never surface `NaN`/`Infinity`/division-by-zero across any channel or sub-cost; determinism and locale-independence (004 FR-038/FR-039) MUST hold for the multi-channel result (identical inputs → byte-identical output list, stable channel ordering).

### Key Entities

- **Channel slot (ephemeral, client-only)**: `{ marketplace, feeDeterminants, commissionPct, fixedFee, freightInputs?, feeSource }` for one listing channel — `feeDeterminants` is marketplace-specific (ML: `{ listingType, category }`; Amazon: `{ category, plan }`; Shopee: none), `freightInputs` e.g. `{ categoria, peso }` for the ML subsidy estimate; 1..N per calculation; not persisted in E1.
- **Fee reference entry (reference data — served + cached + seeded)**: keyed by `(marketplace, feeDeterminants)` → `commissionPct`, `fixedFee` (incl. price-band schedule), optional `minPerItem` (Amazon per-item commission floor), optional **freight/free-shipping component** (ML subsidy estimate params; Shopee co-funded voucher by band), plus `source`, `sourceUrl`, `effectiveDate`, `lastReviewed`. Read-only to the client; **curated in-repo** for the **three launch marketplaces** (ML refreshed by a backend PR-ingestion job reading `listing_prices`; Amazon + Shopee hand-curated), **served by the backend endpoint, cached in a persisted client store, and shipped as a bundled seed** (one shape for all three paths); not user-editable as a catalog.
- **Other-cost item (ephemeral, client-only)**: `{ name, value }`; 0..N; sum = `admin`.
- **Multi-channel price result (ephemeral, client-only)**: the 004 breakdown/`custo_total`/varejo/atacado **plus** a per-channel list `ChannelResult` = `{ marketplace, feeDeterminants, anúncioVarejo, líquidoVarejo, anúncioAtacado, líquidoAtacado, freightCost, feeSource, resolvedFee: { commissionPct, fixedFee, minPerItem, appliedBand } }`, the include/exclude framing flag, `catalogVersion`, and the `PRICING_MODEL_VERSION = "3.0.0"` stamp. The **resolved per-channel fees + `catalogVersion` are carried on the result** so E4 can freeze them for a reproducible snapshot (ADR-0011 Part 4). Computed by `pricing-core`; not persisted in E1.

---

## 3. Success Criteria

004's SC-001…SC-012 remain in force (the cost model and single-channel gross-up are unchanged). New criteria:

- **SC-101 (multi-channel worked example).** Using the 004 SC-001 inputs → `custo_total` **R$ 28,65**, `preço varejo` **R$ 42,98**, `preço atacado` **R$ 37,25**. Add **two channels** with these **test-vector fees** *(illustrative, but consistent with the verified fee structures; exact live values come from the catalog at implementation)*:
  - **Channel A — Mercado Livre Clássico** commission **12 %** (within the verified 10–14 % Clássico range), custo fixo **R$ 6,75** → varejo `anúncio (42,98+6,75)/0,88 =` **R$ 56,51**, `líquido` **R$ 42,98**; atacado `(37,25+6,75)/0,88 =` **R$ 50,00**, `líquido` **R$ 37,25**.
  - **Channel B — Shopee** (verified ≤ R$79,99 band) commission **20 %**, fixed **R$ 4,00** → varejo `(42,98+4,00)/0,80 =` **R$ 58,73**, `líquido` **R$ 42,98**; atacado `(37,25+4,00)/0,80 =` **R$ 51,56**, `líquido` **R$ 37,25**.
  Both channels are shown together; each `recebido líquido` nets back to its base within R$ 0,01. *(All four listing prices are below R$ 79, so ML custo fixo applies and `freightCost = 0` on both channels — this vector isolates commission + fixed fee; the ML subsidy path is SC-111.)*
- **SC-102 (add/remove isolation).** Adding a channel adds exactly its rows; removing a channel removes exactly its rows and changes no other channel's numbers; channel ordering is stable and deterministic.
- **SC-103 (fee pre-fill + override + seal).** Selecting a catalog-covered `(marketplace, feeDeterminants)` pre-fills its fees and shows a seal with source + date; editing a fee is honoured in the result and flips the seal to "ajustado por você"; an unresolved combination shows manual fields with a "sem referência" seal and no fabricated number.
- **SC-104 (offline resilience: cache + seed).** With no network — including a cold first-ever load — the **bundled seed** pre-fills fees and every per-channel price computes signed-out, with no bad number; **online, the app fetches the catalog and persists it to the store**, and a **fetch error is non-blocking** (falls back to store → seed, with a retry affordance). An active entry (store/seed) older than 30 days pre-fills with a possibly-stale seal; an uncovered combination falls back to manual entry. The full result computes offline from the store/seed.
- **SC-105 (include/exclude framing).** With the toggle **on**, the per-channel announce prices are the presented result; with it **off**, the headline equals the 004 direct `preço varejo`/`preço atacado` **exactly** (no channel fee folded into `custo_total`) and the channel section is hidden entirely — pure show/hide, not a labelled simulation list (Clarification 2026-07-23, D2=A).
- **SC-106 (itemized admin equivalence).** Sub-costs "Embalagem" R$ 3,00 + "Frete" R$ 2,00 raise `custo_total` from R$ 28,65 to **R$ 33,65** — identical to a single R$ 5,00 admin — and each named line appears in the breakdown; removing "Frete" lowers `custo_total` to R$ 31,65 exactly. An empty slot reproduces the 004 result byte-for-byte.
- **SC-107 (commission guard per slot).** A slot with commission ≥ 100 % shows an inline pt-BR error and yields no `NaN`/`Infinity`; other slots continue to compute normally.
- **SC-108 (price-band determinism).** For a marketplace with a price-band fixed fee (Shopee; ML custo fixo), the applied band matches the computed listing price and is stable at band boundaries (no oscillation); identical inputs yield the identical band and fee.
- **SC-109 (no bad numbers, no gate, versioned).** Across any number of channels and sub-costs the calculator never renders `NaN`/`Infinity`/`#DIV/0!`, never shows a save/export/history affordance or paywall, and stamps `PRICING_MODEL_VERSION = "3.0.0"` **as of this increment**; the backend performs no price computation. ⚠ **Note (2026-07-23, E1-07)**: `pricing-core` has since bumped to **`3.1.0`** (E3's BOM compose contract, ADR-0016) — this criterion's literal "3.0.0" is this increment's own baseline stamp and is correct as written for 005; it was never retro-annotated when the later bump landed, which is now recorded here for the next reader.
- **SC-110 (determinism at scale).** Identical inputs (any channel count, any sub-cost set) produce byte-identical outputs across runs and locales, with stable channel and sub-cost ordering.
- **SC-111 (ML free-shipping subsidy estimate).** For a Mercado Livre channel whose listing price is **≥ the free-shipping threshold**, `recebido líquido = anúncio × (1 − commission/100) − fixedFee − freightCost`, is strictly **less** than the same channel's no-freight net by exactly the applied `freightCost`, and is **deterministic** for fixed inputs. The `freightCost` is presented as an **estimate** (its seal says so); editing it changes only that channel's net by exactly the delta. Below the threshold (or non-ML), `freightCost = 0` and the net equals the base. *(The subsidy magnitude used in tests is an illustrative value, not asserted as ML's exact figure.)*
- **SC-112 (Amazon per-item commission minimum).** For an Amazon channel whose listing price is low enough that `commissionPct/100 × anúncio < minPerItem`, the net reflects the **floor** (`recebido líquido = anúncio − minPerItem − fixedFee`) and `preço para anunciar` is grossed up so the net still equals the base; this is strictly less optimistic than the %-only formula would give. For listing prices where `commissionPct/100 × anúncio ≥ minPerItem` the minimum does **not** bind and the result equals the plain gross-up. For channels with no minimum (`minPerItem = 0` — ML, Shopee) the term vanishes. The bound regime is **deterministic** and stable at the floor boundary (shares FR-111's fixed-point).

---

## 4. Out of Scope (non-goals — each with its deferral target)

- **Marketplaces beyond the three** — **Magalu, Casas Bahia, AliExpress** are OUT this increment: source-of-truth research (2026-07-06) found no reliable public fee source (login-gated / third-party-only), so curating them would fabricate numbers (Constitution II). **Elo7** is OUT permanently — it **shut down 2026-05-11**. Deferral: revisit any of these in a later increment only if a validated fee source appears. The channel model is extensible, but no "add other marketplace" option ships now.
- **Live, per-seller-account marketplace APIs** — authenticated calls into the seller's own account (Shopee per-shop OAuth, ML per-seller data). This increment uses a **curated in-repo catalog** (ML additionally refreshed by a backend PR-ingestion job reading the public `listing_prices` schedule via **one house account**), never the customer's account. **Deferred**: a later integration epic if/when validated.
- **A user-editable fee catalog / admin UI** for the reference data — the catalog is **curated in-repo (via PR)**; sellers override per-slot only, they don't manage the catalog. Deferral: internal tooling epic, unscheduled.
- **Saving/exporting the multi-channel comparison**, snapshots, PDF/CSV — **E4** (the `PRICING_MODEL_VERSION` stamp enables it later).
- **Taxes / `imposto %`** — still OUT (A24 / 004 FR-021).
- **Premium gating of anything here** — **E6**; the whole expansion stays free.
- **Goal-seek (target net → price), break-even/price-floor per channel, competitor alerts, quantity-discount curves** — improvement backlog, post-E1, unscheduled.
- **Multi-piece BOM** — **E3**.

---

## 5. Clarifications

### Resolved by owner (2026-07-23, audit remediation — 013, formalizing a 2026-07-08 decision)

- **D2 — toggle-off behaviour → CHOSEN: Option A, full hide (pure show/hide).** FR-113/SC-105 and the US4
  acceptance scenarios originally called for the channel list to **stay visible, labelled a non-driving
  simulation** when the master toggle is off. What actually shipped (`calculator-form.tsx` US4,
  `{included && (...)}`) is **Option A — the whole channel section disappears**; there is no
  "simulation-labelled" intermediate state. This was owner-clarified informally at ship time
  (`dod-evidence.md:48-49`, 2026-07-08: *"pure UI show/hide"*) but the living spec text was never amended to
  match, which the 013 audit caught (**FA-04** — a Principle II/VI drift: the spec kept describing behaviour
  the product does not have). **Officialized now**: Option A stands, chosen for simplicity (one less UI
  state to design/maintain and no partial-simulation copy to write) over Option B (keep the list visible,
  add a "simulação" label) which was never built and is not being retroactively required. FR-113, SC-105 and
  the US4 prose above are amended in place to say "hidden entirely" rather than "visible, labelled".
- **FR-113 descope note.** `PriceResult.includeInHeadline` was never added to the pricing-core result
  contract; that decision was made and recorded in **ADR-0011** (§"Field-name/shape reconciliation as-built
  vs the Part 2 draft block"), not in this spec — recorded here for traceability. The toggle is pure
  client-side UI state; the computed `PriceResult` carries no flag for it.

### Resolved by owner (2026-07-06, after source-of-truth research)

- **Scope → exactly three curated marketplaces: Mercado Livre, Amazon, Shopee.** Chosen because they are the only three with a usable source of truth (see "Fee sources of truth"): ML (official docs + `listing_prices` API), Amazon (official public dated fee page), Shopee (official public fee article). **Magalu, Casas Bahia, AliExpress dropped** (no reliable public source → would fabricate); **Elo7 dropped** (shut down 2026-05-11). *(FR-102, FR-105a, §4.)*
- **Q2 — Mercado Livre free-shipping subsidy → model it now, as an editable ESTIMATE.** Research confirmed the ML subsidy is reputation/weight/volume/region-dependent and **not curatable as an exact catalog number**, so it is a seller-overridable estimate with an honesty seal (never authoritative). Generalized to a per-channel freight component that also carries Shopee's band-based co-funded voucher. Data model routes to `arquiteto` + `dev-estrutura-de-dados`. *(FR-111a, FR-111b, SC-111.)*

### Resolved earlier (carried from owner decisions in this session)

- **Fee source** → dated, versioned catalog **served by `GET /api/v1/fee-catalog` and cached in a persisted client store, with a bundled seed for first-run offline** (updated via PR + backend deploy; ADR-0010, delivery amended 2026-07-06); pre-fills + editable + fully offline. *(The ML ingestion job runs on the backend and opens a PR; the endpoint serves the committed artifact — R6=(a), not a datastore — so the PR human-gate is preserved and freshness reaches clients on a backend deploy.)*
- **Marketplace vs headline** → composes the headline (per-channel announce prices are the result) unless the master toggle excludes them; **default included**.
- **Markup base** → **% over `custo_total`**, unchanged from 004.
- **Commission ≥ 100 %** → inline per-slot error, no silent clamp.
- **Outros custos** → slot of named sub-costs; sum into `custo_total`.

---

## Assumptions

- Builds on **004** (built, MVP owner-homologated 2026-07-05): the corrected cost model, transparent breakdown, retail+wholesale-together, per-field pt-BR validation, determinism, and free/offline/signed-out guarantees are all in force and only **extended** here.
- **Served catalog + persisted cache + bundled seed (ADR-0010, delivery amended 2026-07-06).** The fee catalog is **served by `GET /api/v1/fee-catalog`** (the committed in-repo artifact) and **cached in a persisted client store** on first load; a **MANDATORY bundled seed** covers the first-ever offline visit, so first-run offline is guaranteed without the network, and a fetch failure is non-blocking (store → seed + retry). Its seal reads "referência do catálogo · atualizada em {lastReviewed}" (or "referência embutida" for the seed) and flips to "pode estar desatualizada" past 30 days.
- **Price-band / commission-floor fixed point.** The band (and the Amazon commission floor) depends on the listing price, which depends on the band/floor. **ADR-0011** resolves this deterministically by selecting the regime from the **computed announce price** (not the base — that option was rejected), with an explicit terminal tie-rule at each boundary so identical inputs never oscillate — including the **steep ML "50% do valor" band at the R$12,50 boundary** (whose gross-up can push `list` across the boundary; the terminal rule pins convergence — see F3 test, SC-108). The spec only requires determinism (FR-111 / SC-108); the algorithm is ADR-0011.
- **Fee-catalog architecture is DECIDED** in **ADR-0010** (served versioned artifact + persisted client cache + bundled seed; ML `listing_prices` PR-ingestion job on Cloud Run with a house account + BR egress; freight/subsidy data model) and **ADR-0011** (pricing-core 3.0.0 result contract; band fixed-point; snapshot policy), both owner-homologated 2026-07-06 — clearing the Constitution VIII gate for `/speckit-plan`. `seguranca` still owns the house-account credential handling; the dedicated house ML account is created before any ingestion code.
- Real fee **values** are not invented in this spec; §3 numbers are self-consistent **test vectors**. Curated real values are sourced/validated during implementation per "Fee sources of truth": **Mercado Livre** (official docs + `listing_prices`), **Amazon** (`venda.amazon.com.br/precos`), **Shopee** (Central do Vendedor art. 26839). Any value that cannot be verified is NOT curated (falls back to manual, honest seal). The listed open unknowns are resolved before shipping.
- The **ML free-shipping subsidy** genuinely depends on factors outside a single price (category, weight/volume, buyer region, seller reputation) and is **not exposed by `listing_prices`**; this increment models it as a **best-effort editable estimate** with an honesty seal, not an exact guaranteed figure. The seller's override is always authoritative.
- Copy is pt-BR, i18n-ready. This document specifies **behavior**, not UI pixels — UX → `designer-ux`, final UI → Claude Design. The multi-channel/fee-catalog prototype was homologated 2026-07-06 and its catalog *loading*, *fetch-error / "Tentar de novo"* and *seed/embutida* states are all **in play** under the served-endpoint delivery (fetch on first load → persist to store → non-blocking retry on failure → seed for first-run offline) — manual entry stays for uncovered/override. The prototype already carries the loading/fetch-error/retry states; the **one new state** is the seed "referência embutida" seal, reconciled in a non-blocking design pass (tasks T042).
- `pricing-core` MAJOR bump to **`3.0.0`** is **confirmed** by **ADR-0011** (extends the ADR-0008 version registry): itemized admin + multi-channel result shape are breaking to the 2.0.0 result contract; the result freezes resolved per-channel fees + `catalogVersion` for E4 snapshotting.
