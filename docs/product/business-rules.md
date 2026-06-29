# Product & Business Rules (source of truth)

Decided with Jonatan, Round 2 (2026-06-26). This file is what the **server-side entitlement check enforces**
(Constitution Principle IV). Architecture of the enforcement itself → a PENDING, unnumbered entitlement ADR
(NOT ADR-0003 — that is the no-inference ADR; ADR-0002 = API contract, ADR-0004 = stack).

## Freemium boundary (R2.1 = B + quota lever)
Principle: **computation is free; persistence & scale are premium.**

### FREE (no payment; runs client-side, offline-capable)
- Every pricing **calculator**, including the full corrected model (material, energy, machine/depreciation,
  failure, finishing, marketplace-fee math, multi-piece BOM compute). The math is never paywalled.
- Ephemeral use: enter inputs → see result. Plus a **small persistence allowance** (quota lever, below) so the
  user tastes saving/catalog before hitting the wall.

### PREMIUM (server-side validated)
- Persist calculations & quotes (cloud).
- Product / material / printer **catalog** (CRUD + cloud sync) beyond the free quota.
- Calculation **history** + reproducible frozen snapshots (calc + pricing-core semver).
- **Export / share** (PDF / CSV).
- Saved **marketplace-simulation** scenarios.
- Catalog-scale **multi-product / BOM** management beyond the free quota.

### Free-tier quota (the integers the entitlement check enforces)
**PROVISIONAL — finalized when E2 (catalog/persistence) is specified.** Anchors: free = up to **3 saved
products** and **5 saved calculations**, **no export**, **no saved marketplace scenarios**. Premium = unlimited.
Quotas are updatable system config, not hard-coded.

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
| **E1** | Full corrected pricing model (energy, machine/depreciation, failure, finishing, marketplace fees) | — (calc stays free) |
| **E2** | Catalog (filaments/printers/products) + persistence | **Entitlement scaffolding lands here** (quota + premium flag), even though purchase comes at E6 |
| **E3** | Multi-piece BOM | quota |
| **E4** | History + reproducible snapshots + export | export = premium |
| **E5** | Marketplace simulator (ML, Shopee) | saved scenarios = premium |
| **E6** | Billing (Mercado Pago recurring / Play Billing — PENDING unnumbered payments ADR) | actual purchase flow |
| **E7** | Android / Play packaging (Capacitor) | — |

### Sequencing truth (recorded, Principle II)
Premium gates persistence from **E2**, but the **purchase** flow only arrives at **E6**. Between E2 and E6 the
entitlement boundary is **real and server-enforced** (so Principle IV holds from day one); entitlement is granted
out-of-band (beta/comp grants) until E6 wires payment. Building the gate before the paywall is intentional, not
an oversight.
