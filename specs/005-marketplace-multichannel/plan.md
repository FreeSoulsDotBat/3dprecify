# Implementation Plan: E1 expansion — multi-channel marketplace pricing + itemized other-costs

**Branch**: `feature/004-e1-pricing-model` (spec dir `005-…`; **ships in the same E1 PR as 004** — one merged
increment, per owner "expandir o E1 antes de mergear") | **Date**: 2026-07-06 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/005-marketplace-multichannel/spec.md` (behavior, homologated) + the two Accepted ADRs it routed
to the arquiteto — **ADR-0010** (fee-catalog: **served versioned artifact via a public `GET /api/v1/fee-catalog`
endpoint + persisted client cache + mandatory bundled seed** — delivery amended 2026-07-06; ML PR-ingestion; freight
discriminated union; 30-day staleness seal) and **ADR-0011** (pricing-core `3.0.0` result contract, band + referral-
fee-floor fixed-point, E4-reproducible snapshot).

## Summary

Extend the **built** 004 calculator (single-channel gross-up) to price **one product across Mercado Livre, Amazon
and Shopee at once**, with per-channel fees **pre-filled from a dated, versioned fee catalog the backend serves**
(`GET /api/v1/fee-catalog`) — the client **fetches it on first `Calcular` load, persists it in a store (IndexedDB),
and reads the store thereafter**, with a **mandatory bundled seed** covering the first-ever offline load. Each slot
carries an **honesty seal** (catalog / possibly-stale > 30 d / seed / manually adjusted / no reference). The single
"Outros custos" field becomes a **slot of 0..N named sub-costs** whose sum flows into `custo_total` exactly as 004's
`adminTotal`. A master **"Incluir marketplaces no preço"** toggle frames the headline. Everything stays **free,
signed-out, offline** — the fee endpoint is **public read-only reference data, never a gate**, and the price math
stays **fully offline** in pricing-core (**the backend never computes a price**, FR-118); a network hiccup never
blocks the calculator (seed + store).

`packages/pricing-core` takes a **MAJOR bump `2.0.0 → 3.0.0`** (ADR-0011): the result gains `otherCosts[]`,
`channels: ChannelResult[]` (per-channel gross-up on varejo+atacado minus a generic `freightCost`), the
include/exclude flag, a `catalogVersion` stamp, a deterministic **price-band fixed-point** (Shopee / ML custo fixo)
**and a referral-fee minimum floor** (`minPerItem`, Amazon `max(% × preço, R$ 1,00)` — modelled exactly). Money
stays ADR-0008 (2-dp HALF_UP per line, breakdown sums to total). Fees are **resolved in the client** (from the
store/seed) and passed **into** the pure engine — pricing-core never imports the catalog.

**Cross-platform gain (why the endpoint):** new fees reach clients on a **backend-only deploy**, and a future
**Android (Capacitor) app gets fresh fees without a store release** (Constitution I) — the capability the earlier
bundle-only lacked.

**Off the calculator critical path (devops + seguranca, can land after the increment ships):** the Cloud Run Job +
Scheduler that refreshes the ML slice via `listing_prices` (house-account OAuth, BR static egress, Secret Manager)
and **opens a PR** with the catalog diff for owner review (ADR-0010 Part 3). The endpoint serves the last-merged
artifact; the calculator ships on the hand-curated seed/store regardless of when that automation lands.

**Technical approach**: a **client + shared-core increment plus one small public backend endpoint**, extending 004
**in place** on the same branch/PR. `pricing-core` grows the multi-channel + itemized-admin model; a **new
`GET /api/v1/fee-catalog`** (FastAPI, camelCase, ETag, public/no-auth/no-gate) serves the committed artifact; the FE
`features/calculator` gains channel-slot management, the fetch→persist→seed catalog store, the fee resolver + seal,
freight inputs, the outros-custos slot and the include/exclude toggle, reusing the 003 DS primitives and the
Claude-Design-homologated UI (2026-07-06). Test-first: SC-101…SC-112 become `pricing-core` numeric cases before
implementation.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) on Node 24; React 19. **Plus one new FastAPI (Py 3.12) endpoint**
(`GET /api/v1/fee-catalog`) — the only backend work; it serves data, never computes a price.

**Primary Dependencies**: `packages/pricing-core` (`2.0.0 → 3.0.0`) · `decimal.js-light` (existing, ADR-0008) ·
React 19 + Vite 8 PWA · TanStack Router/Query · RHF + Zod (per-field pt-BR validation) · Tailwind v4 + `tf-*` DS ·
**Orval-generated client** for the new endpoint (ADR-0002 pipeline). **New runtime-cache dep**: a **persisted
TanStack Query cache** — `@tanstack/query-*-persist-client` + `idb-keyval` (IndexedDB) or
`experimental_createQueryPersister` (**pin the version + re-verify — it is `experimental_`**, ADR-0010 Part 2). A
**committed catalog artifact** + a **bundled seed** derived from it.

**Storage**: the price inputs + result stay client-only, ephemeral (persistence is E2/E4). **New: a persisted
IndexedDB cache of the fee catalog** (the store the front keeps after the first fetch) + the **bundled seed** for
first-run offline. The E4-reproducible snapshot fields (`catalogVersion` + resolved per-channel fees incl.
`minPerItem`) are **carried on the result now** but persisted only at E4 (ADR-0011 Part 4).

**Testing**: Vitest (unit — `pricing-core` SC-101…SC-112 test-first incl. SC-108 band determinism + SC-112 Amazon
referral-fee floor + SC-107 per-slot guard; FE adapter parse/validate/resolve; the fetch→persist→seed store) ·
Playwright + Firebase Auth emulator (e2e — multi-channel add/remove, fee pre-fill + override + seal, **offline first
load via seed**, **online fetch persisting to the store**, fetch-error retry + manual entry, include/exclude,
itemized admin, no-bad-numbers, free/offline) · **backend contract test** for the endpoint (Schemathesis) · coverage
gate. A gate test asserts **both the served artifact and the bundled seed** parse under the current `schemaVersion`
and every curated entry carries `sourceUrl`/`effectiveDate`/`lastReviewed`.

**Target Platform**: Web PWA, mobile-first, offline-capable (003 Workbox SW precaches the shell; the catalog is held
in the persisted store + seed, not the SW). Future **Android via Capacitor fetches the same endpoint** → fresh fees
without a store release. `Calcular` stays the public, sign-in-free surface.

**Project Type**: Web app in a pnpm monorepo — `apps/web` (client) + `packages/pricing-core` (shared offline
engine) + a **new public `apps/api` endpoint** (fee-catalog) + a **committed catalog artifact** (backend-readable).
The ML ingestion Job is a **separate, isolated deployable** (devops), off this plan's critical path.

**Performance Goals**: instantaneous client-side recompute on every input change (no server round-trip for the
math); the band + floor fixed-point is bounded (≤ small N, ADR-0011); the catalog fetch is a **single request per
session** (then the store), non-blocking (seed covers it); no jank at 60 fps; no horizontal scroll at 390 px.

**Constraints**: the **price math is offline + deterministic** (FR-118/119/SC-110) even when the endpoint is
unreachable (seed/store) · never render `NaN`/`Infinity`/`#DIV/0!` (FR-119) · per-slot error isolation
(FR-104/SC-107) · breakdown sums to `custo_total`, 0 residual HALF_UP (FR-115) · **every fee number carries an honest
seal**, no fabricated value (FR-107/109, Constitution II) · the endpoint is **public, unauthenticated, never a
gate** (FR-117/Const IV) · pt-BR/BRL input UX, i18n-ready.

**Scale/Scope**: 3 marketplaces · 1..N channel slots · 0..N named sub-costs · marketplace-specific fee determinants
(ML listingType+category / Amazon category+plan / Shopee none) · a curated catalog (served + seeded) with
provenance · one new backend endpoint · the "Preços por canal" view + the outros-custos slot on the existing page.

## Constitution Check

*GATE: evaluated before Phase 0; re-check after Phase 1.*

- [x] **I. Scalability & Quality First** — the formula lives once in the shared offline `pricing-core` (web +
      future Android + i18n); the **served endpoint** gives cross-platform fee freshness without redeploying every
      client (Android without a store release). No scalability traded for convenience.
- [x] **II. Truth Over Approval** — every curated fee (served + seeded) carries `sourceUrl`/`effectiveDate`/
      `lastReviewed` and is human-validated via PR before publish (ADR-0010 Part 3); unverifiable values fall back
      to manual + "sem referência" (no fabrication); the ML subsidy is an explicit **estimate**, never authoritative.
- [x] **III. Test-First** — SC-101…SC-112 become `pricing-core` numeric cases **before** implementation (SC-101
      anchor; SC-108 band determinism; **SC-112 Amazon referral-fee floor**; SC-107 per-slot guard; SC-111 ML
      subsidy); e2e covers the fetch→persist→seed store + guards; the artifact+seed parse/provenance gate test; the
      endpoint contract test.
- [x] **IV. Server-Side Entitlements** — **N/A and honored**: the expansion is **free, no premium gate** (FR-117);
      `GET /api/v1/fee-catalog` is **public, unauthenticated, read-only reference data — never an entitlement gate**
      (the transport attaches a token only when signed-in; the endpoint ignores it). The one server-side secret
      (house ML credential) is enforced server-side per Principle IV on the **isolated ingestion Job**, gating
      nothing for users. The **price math never depends on the server** (offline via seed/store).
- [x] **V. Clean Architecture Integrity** — extends the 004 build in place; reuses the 003 shell + DS + the
      `pricing-core`↔UI wiring; `pricing-core` stays pure (resolved fees in, never imports the catalog); the
      fee-catalog module is a pure resolver + a persisted store + a seed; the endpoint follows the ADR-0002 contract
      pipeline; the 3.0.0 bump removes the dead single-channel `marketplace*` surface (no dup/dead code).
- [x] **VI. Lean Living Documentation** — **spec re-flip APPLIED 2026-07-06:** the delivery reversal
      (bundle-only → served endpoint + persisted cache + seed) was reconciled into the spec — FR-105/107/108/117,
      US2/US3/US6, SC-104, the §model "Delivery" paragraph, §5 and Assumptions now read "fetch when online → persist
      to a store → offline uses the store → a bundled seed covers first-run". spec ↔ ADR-0010 now **agree** on
      delivery (no residual bundle-only requirement; verified by grep).
- [x] **VII. Spec-Driven Flow** — spec homologated; `/speckit-plan` + `/speckit-tasks` produced; `/speckit-analyze`
      findings A1–A7 remediated + F1–F8 raised; **the delivery re-flip (VI) landed 2026-07-06** — the former
      spec↔ADR contradiction is resolved; ready to re-run `/speckit-analyze` for a clean pass.
- [x] **VIII. Architecture Decided Before Implementation (NON-NEGOTIABLE)** — every structural choice traces to an
      Accepted ADR: stack ADR-0004, DS ADR-0007, money/version ADR-0008, machine-hour ADR-0009, **fee-catalog
      architecture ADR-0010 (delivery amended 2026-07-06 — endpoint + persisted cache + seed, owner-directed)**,
      **pricing-core 3.0.0 ADR-0011**. **Nothing inferred.** **One structural sub-choice re-opened by the reversal
      and decided here (owner to confirm):** the committed artifact now must be **backend-readable**, so it moves
      from apps/web-only (old Option A) to a **shared repo location** the backend serves and the web seed is built
      from — see Structure Decision. **Open (planned default):** ADR-0010 **R6 = (a)** the endpoint serves the
      committed repo artifact (keeps the PR human-gate); flip to (b) datastore only on owner direction.

## Project Structure

### Documentation (this feature)

```text
specs/005-marketplace-multichannel/
├── spec.md                 # Homologated behavior; delivery re-flip (endpoint+cache+seed) APPLIED 2026-07-06
├── plan.md                 # This file
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks (test-first, by user story; A1–A7 remediated; delivery-reversal replanned)
```
Phase 0/1 design is resolved in **ADR-0010** (delivery = served endpoint + persisted cache + seed; ingestion;
freight) + **ADR-0011** (result shape, band + referral-floor fixed-point, snapshot). No new research.md (Principle
VI); the pricing-core `3.0.0` contract is inline in ADR-0011 Part 2; the endpoint contract follows ADR-0002.

### Source Code (repository root)

```text
backend/app/data/                  # NEW — the committed, versioned catalog artifact (source of truth, PR-gated)
└── catalog.json                   #   served by the endpoint (bundled via `COPY app`); web seed mirrors it; ML job edits via PR
                                   #   (moved from repo-root fee-catalog/ 2026-07-07 so `COPY app ./app` bundles it — ADR-0010 amendment)

packages/pricing-core/
├── src/
│   ├── index.ts             # 3.0.0: PriceInput+otherCosts[]+channels[], computeCalculator() → PriceResult(channels[], catalogVersion), PRICING_MODEL_VERSION="3.0.0"
│   ├── channels.ts          # NEW: per-channel gross-up + band fixed-point + referral-fee minimum floor (ADR-0011 P3) + generic freightCost (ADR-0010 P4)
│   ├── rounding.ts          # unchanged (ADR-0008 HALF_UP 2dp)
│   └── tests/*.test.ts      # SC-101..SC-112 (test-first) + constant↔major gate test (A7 tests/ convention)
└── package.json             # version 2.0.0 → 3.0.0

apps/api/                          # NEW ENDPOINT (data only, no price compute)
└── (fee-catalog router)     # GET /api/v1/fee-catalog → serves fee-catalog/catalog.json (camelCase, ETag, public/no-auth/no-gate) + contract test

apps/web/src/
├── shared/fee-catalog/       # schema types + pure resolveEntry() + staleness(30d) + SEED (from fee-catalog/catalog.json) + the fetch→persist store
│   ├── fee-catalog.ts        #   schema/types + resolveEntry + staleness
│   ├── seed.ts               #   bundled seed (first-run offline) — built from fee-catalog/catalog.json
│   ├── use-fee-catalog.ts    #   TanStack Query: fetch GET /api/v1/fee-catalog on first load, PERSIST to IndexedDB (idb-keyval), fallback store→seed
│   └── *.test.ts             #   served-artifact + seed parse/provenance gate; resolveEntry/staleness; store fallback
├── features/calculator/      # EXTEND: resolve fees from store/seed → feed pricing-core; per-channel + sub-cost adapters; schema (channels[]+otherCosts[]+toggle)
├── pages/calcular/           # EXTEND: "Preços por canal" (slots, seals, freight override), outros-custos slot, include/exclude toggle
└── shared/ui/                # REUSE 003 DS; add channel-row + honesty-seal primitives

apps/web/tests/e2e/calculator.spec.ts   # EXTEND: multi-channel, pre-fill+override+seal, offline-first-load-via-seed, online-fetch-persists, fetch-error retry+manual, toggle, itemized admin, no-bad-numbers

# OFF the critical path (devops + seguranca): the ML ingestion Cloud Run Job → opens a PR editing fee-catalog/catalog.json;
#   VPC/NAT static egress; Secret Manager house-account token + rotation runbook.
```

## Structure Decision

Monorepo web app **+ one public backend endpoint**. The **formula stays centralized in `packages/pricing-core`**
(FR-118 — single source, offline, backend never recomputes) and stays **pure**: it receives already-resolved
`(commissionPct, fixedFee, minPerItem)` + the `freight` descriptor + `freightInputs` per channel and owns the band +
referral-floor fixed-point; it does **not** import the catalog. The FE resolves the entry (from the store/seed) and
feeds the engine.

**Resolution split (A6):** `resolveFee(marketplace, feeDeterminants, listingPrice)` (FR-110) = **`resolveEntry`**
(FE, by determinants) **+ the band + referral-floor fixed-point** (pricing-core, by the computed announce price) —
never a price-keyed backend resolver.

**Catalog artifact placement — REVISED by the delivery reversal (owner to confirm).** The old Option A (artifact
only in `apps/web`) no longer fits: the **backend must read the same artifact to serve it**. Decision (planned
default):
- **Committed artifact → `backend/app/data/catalog.json`** (one PR-gated source of truth; moved from repo-root
  `fee-catalog/` on 2026-07-07 so `COPY app ./app` bundles it into the Cloud Run image — ADR-0010 amendment). The
  FastAPI endpoint reads it and serves it; the web **seed** mirrors it; the ML ingestion Job edits it via PR.
- **TS schema + resolver + staleness + store + seed → `apps/web/src/shared/fee-catalog/`** (consumes the JSON).
- Alternative (if the ingestion Job or backend wants shared TS types): promote to **`packages/fee-catalog`** (schema
  + JSON) imported by web + tooling — a cheap lift-and-shift. Recommend the repo-root JSON now; revisit the package
  if TS sharing with the Job is wanted. Placement = **repo-root `fee-catalog/catalog.json`** is the owner-directed default (2026-07-06); confirmable before the fee-catalog tasks start (Principle
  VIII).

**Delivery (ADR-0010 amendment):** `GET /api/v1/fee-catalog` serves the committed artifact (**R6=a**); the client
fetches on first `Calcular` load, **persists to IndexedDB**, and reads the store thereafter; a **bundled seed**
covers first-run offline. The price math never blocks on the network.

## Complexity Tracking

> The **delivery reversal** (bundle-only → served endpoint + persisted client cache + bundled seed) is recorded as
> an **owner-directed amendment to ADR-0010 (2026-07-06)** with a risk review (R1 seed mandatory · R2 persisted
> store · R3 public no-gate endpoint). Close-out: **(1) the spec delivery re-flip is APPLIED (2026-07-06)** —
> FR-105/107/108/117, US2/US3/US6, SC-104, §model/§5/Assumptions reconciled, spec↔ADR agree; **(2) artifact
> placement `fee-catalog/catalog.json` at repo root + R6=(a)** are adopted as the **owner-directed defaults** (from
> the ADR-0010 amendment conversation), confirmable. No Constitution violation requires a waiver.
