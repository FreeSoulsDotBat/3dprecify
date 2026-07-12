# Product & Business Rules (source of truth)

Decided with Jonatan, Round 2 (2026-06-26). This file is what the **server-side entitlement check enforces**
(Constitution Principle IV). Architecture of the enforcement itself → a PENDING, unnumbered entitlement ADR
(NOT ADR-0003 — that is the no-inference ADR; ADR-0002 = API contract, ADR-0004 = stack).

## Freemium boundary (R2.1 = B — no free persistence quota)
Principle: **computation is free; persistence & scale are premium.** Revised Round 3 (2026-06-29): the free tier
saves **nothing** — there is no "taste it first" quota; the only thing unlocked for free is the calculator itself.

### FREE (no payment; runs client-side, offline-capable)
- The **single-piece** pricing calculator, including the full corrected model (material, energy, machine/
  depreciation, failure, finishing, marketplace-fee math). The single-piece math is never paywalled.
- Ephemeral use **only**: enter inputs → see the full transparent breakdown. **No saving of any kind on free** —
  saving calculations, catalog, history and export are all Premium.

> **Amendment 2026-07-10 (E3, owner decision — spec 008 Clarifications Q3):** the **multi-piece BOM** feature
> (compose + price an assembly of several pieces) is **Premium**, not free — the product's **first paywalled
> compute**, a deliberate, dated exception to "the math is never paywalled" above. The single-piece calculator
> stays fully free. Because BOM math runs client-side/offline, premium access to the composer is a **client
> route-guard** with an honest teaser, while **persistence stays server-authoritative** (Principle IV holds for
> anything server-side; the client-side compute cannot be server-enforced). Revisitable as development unfolds.

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
| **E2** | Catalog (filaments/printers/products) + persistence. **BUILT 2026-07-09..10 (spec 007)**: server-authoritative entitlement gate + append-only ledger + operator grant CLI (ADR-0012) · SQLAlchemy 2.0 typed schema, single migration `0001` (ADR-0013) · filaments/printers/products CRUD (per-account, decimal-string wire, soft-delete) · uid-keyed offline read cache + purge-on-signout · calculator pre-fill (SC-305 byte-identical) · products live-recomputed with reference + last-known degradation (US6) · honest free-tier teaser (US7, `/catalogo` public). **E2 COMPLETE + SHIPPED to `develop`:** PR-A #10 (`16c1824`) + PR-B #11 (`e655504`) + PR-C #12 (`3a940ba`), all owner-homologated, full CI green. Evidence: `specs/007-e2-catalog-entitlement/dod-evidence.md`. | **Entitlement scaffolding lands here** (binary premium flag — persistence gated entirely, no free quota), even though purchase comes at E6 |
| **E3** | **Multi-piece "Kits"** — compose + price multi-piece orders (ad-hoc + catalog-referenced lines, quantities, per-channel rollup). **BUILT 2026-07-11..12 (spec 008)**: client-side `computeBom` (pricing-core **3.1.0**, ADR-0016 — byte-identical to the single-piece calc at qty 1) · server-authoritative `/api/v1/boms` (ADR-0015) · migration `0002` (`boms` + `bom_lines`) · **atomic kit-save + name-dedup materialization** — ad-hoc lines become manual catalog products, all-or-nothing (ADR-0017, K3/K4) · **K1** "Kits" 5th nav tab + catalog Kits tab · catalog-reference lifecycle: **D3 live-reflect** on reopen + **D6 read-time degradation** to last-known (ADR-0017 §6 addendum) with a calm, honest degraded-line caption (F1/K3 — never a removal claim). **E3 COMPLETE + SHIPPED to `develop`:** PR-A #15 (`64fe10e`) + PR-B #16 (`b8b5eee`) + PR-C #17 (`e0ed56e`, US3 lifecycle), all owner-homologated, full CI green (`gate:all` + e2e **102/102** + contract drift-guard). Evidence: `specs/008-e3-multi-piece-bom/dod-evidence.md`. | **premium** — compose is a client soft-gate on `active`; **persistence is the server-authoritative boundary** (a faked local flag unlocks nothing) |
| **E4** | History + reproducible snapshots + export | export = premium |
| **E5** | Marketplace simulator — **live multi-channel compute pulled forward into E1 (spec 005, 2026-07-08)**; E5 keeps what's left: **saved scenarios** + per-account live fee auth (Shopee OAuth, AliExpress) | saved scenarios = premium |
| **E6** | Billing (Mercado Pago recurring / Play Billing — PENDING unnumbered payments ADR) | actual purchase flow |
| **E7** | Android / Play packaging (Capacitor) | — |

### Deploy posture (owner decision 2026-07-09)
The **first public deploy waits for v1 complete = E1–E6** (006 spec Clarifications). Everything deploy-side
is dry-ready (pipeline on `main`, runbook, gate parity); FR-010 consciously stays open across E2–E6.
**Revisitable**: the owner may move this trigger either way as development unfolds (dated decision-log entry
+ spec Clarification when it changes).

### Sequencing truth (recorded, Principle II)
Premium gates persistence from **E2**, but the **purchase** flow only arrives at **E6**. Between E2 and E6 the
entitlement boundary is **real and server-enforced** (so Principle IV holds from day one); entitlement is granted
out-of-band (beta/comp grants) until E6 wires payment. Building the gate before the paywall is intentional, not
an oversight.
