# Product & Business Rules (source of truth)

Decided with Jonatan, Round 2 (2026-06-26). This file is what the **server-side entitlement check enforces**
(Constitution Principle IV). Architecture of the enforcement itself → a PENDING, unnumbered entitlement ADR
(NOT ADR-0003 — that is the no-inference ADR; ADR-0002 = API contract, ADR-0004 = stack).

## Freemium boundary (R2.1 = B — no free persistence quota)
Principle: **computation is free; persistence & scale are premium.** Revised Round 3 (2026-06-29): the free tier
saves **nothing** — there is no "taste it first" quota; the only thing unlocked for free is the calculator itself.

### FREE (no payment; runs client-side, offline-capable)
- Every pricing **calculator**, including the full corrected model (material, energy, machine/depreciation,
  failure, finishing, marketplace-fee math, multi-piece BOM compute). The math is never paywalled.
- Ephemeral use **only**: enter inputs → see the full transparent breakdown. **No saving of any kind on free** —
  saving calculations, catalog, history and export are all Premium.

### PREMIUM (server-side validated)
- Persist calculations & quotes (cloud).
- Product / material / printer **catalog** (CRUD + cloud sync).
- Calculation **history** + reproducible frozen snapshots (calc + pricing-core semver).
- **Export / share** (PDF / CSV).
- Saved **marketplace-simulation** scenarios.
- Catalog-scale **multi-product / BOM** management.

### Free-tier persistence: NONE (the rule the entitlement check enforces)
Free saves **zero** of everything: no saved calculations, no catalog (filaments/printers/products), no history,
no export, no saved marketplace scenarios. The **calculator is fully free** (compute + transparent breakdown,
offline); **any persistence is Premium**. Premium = unlimited. (Revised Round 3, 2026-06-29 — replaces the prior
provisional 3-products / 5-calculations quota.)

## Tiers (R2.2 = B)
- **Free** — as above.
- **Premium** — single paid tier, two billing periods: **monthly** and **annual** (annual discounted for LTV/cash).
- No Pro/Business split at launch (revisit post-traction).

## Pricing (R2.4 = A)
Exact R$ amounts are **deferred** until validated with real sellers (willingness-to-pay unvalidated, ~55%
confidence). Decide structure now (above); set prices before E6 (billing). No provisional anchor committed.

## Roadmap — epic sequence (R2.3 = A)
Walking skeleton (001) is pre-E1 (auth gate + minimal material+markup calc). Then:

| Epic | Scope | Premium gate introduced |
|------|-------|-------------------------|
| **E1** | Full corrected pricing model, clean-room (A15). **BUILT 2026-07-06** (US1–US6 + polish on `feature/004-e1-pricing-model`; pricing-core 2.0.0; gate + e2e green; MVP owner-homologated 2026-07-05). Scope **frozen 2026-07-05** (A16/A24/A25): material + explicit waste · energy (real duty cycle) · single machine-hour recovery (no triple-count) · failure over all inputs · finishing time×rate · **optional labor + admin** (default 0; markup base → `custo_total`) · **basic single-channel marketplace fee** (correct gross-up). **Taxes OUT of v1** (MEI DAS is a fixed monthly amount, not a per-unit %). **EXPANDED 2026-07-08 (spec 005, owner-decided — supersedes the "multi-channel stays E5" deferral):** multi-channel/multi-modality marketplace pricing (ML/Shopee/Amazon/Outro; pricing-core **3.0.0**, ADR-0011) · backend **fee catalog** (`GET /api/v1/fee-catalog`, public data-only, ADR-0010) + persisted cache + bundled seed, with honesty seals · "Incluir marketplaces no preço" toggle · itemized **"Outros custos"** (named sub-costs, replaces the single admin field). All still free/offline/signed-out. Evidence: `specs/005-marketplace-multichannel/dod-evidence.md`. | — (calc stays free) |
| **E2** | Catalog (filaments/printers/products) + persistence | **Entitlement scaffolding lands here** (binary premium flag — persistence gated entirely, no free quota), even though purchase comes at E6 |
| **E3** | Multi-piece BOM | premium |
| **E4** | History + reproducible snapshots + export | export = premium |
| **E5** | Marketplace simulator — **live multi-channel compute pulled forward into E1 (spec 005, 2026-07-08)**; E5 keeps what's left: **saved scenarios** + per-account live fee auth (Shopee OAuth, AliExpress) | saved scenarios = premium |
| **E6** | Billing (Mercado Pago recurring / Play Billing — PENDING unnumbered payments ADR) | actual purchase flow |
| **E7** | Android / Play packaging (Capacitor) | — |

### Deploy posture (owner decision 2026-07-09)
The **first public deploy waits for v1 complete = E1–E6** (006 spec Clarifications). Everything deploy-side
is dry-ready (pipeline on `main`, runbook, gate parity); FR-010 consciously stays open across E2–E6.

### Sequencing truth (recorded, Principle II)
Premium gates persistence from **E2**, but the **purchase** flow only arrives at **E6**. Between E2 and E6 the
entitlement boundary is **real and server-enforced** (so Principle IV holds from day one); entitlement is granted
out-of-band (beta/comp grants) until E6 wires payment. Building the gate before the paywall is intentional, not
an oversight.
