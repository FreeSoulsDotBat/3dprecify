# ADR-0010: Marketplace fee-catalog architecture (served artifact + client cache + seed · ML PR-ingestion · freight model)

- **Status**: **Accepted (owner-homologated 2026-07-06)** · **delivery amended 2026-07-06 (owner-directed): backend endpoint + persisted client cache + bundled seed** (see "Amendment"). Supersedes the bundle-only delivery.
- **Date**: 2026-07-06
- **Deciders**: Jonatan (owner, homologated + amended 2026-07-06) + arquiteto; implemented with dev-backend (endpoint),
  dev-frontend (cache/seed/seal), dev-estrutura-de-dados (schema + curation), devops (ingestion job), **seguranca** (house ML credential)

## Context

`specs/005-marketplace-multichannel/spec.md` expands E1 to price one product across **Mercado Livre, Amazon,
Shopee** at once, with per-channel fees **pre-filled from a curated, dated fee reference** (owner-decided), editable
and **fully offline-capable**. Hard invariants that frame every option below:

- **The backend NEVER computes a price** (FR-118 / 004 FR-036). It serves fee **reference data** only; all math
  stays in `packages/pricing-core` (offline). → the client must resolve fees + compute with **zero** network.
- The whole calculator stays **free, signed-out, offline**; the fee reference is **public read-only data, never an
  entitlement gate** (FR-117; Constitution IV applies to the house ML credential, not to users). **This is the
  binding constraint on delivery:** a brand-new, signed-out, **offline** visitor MUST still price (FR-108/SC-104).
- **Truth over approval (Constitution II).** Every curated value carries `sourceUrl` + `effectiveDate` +
  `lastReviewed`; an unverifiable value is **not** curated (falls back to manual + a "sem referência" seal). The ML
  free-shipping subsidy is reputation/weight/volume/region-dependent and **not** curatable as an exact number →
  modelled as a seller-overridable **estimate**, never authoritative.
- **Verified facts** (2026-07-06, sources in Consequences): ML `GET /sites/MLB/listing_prices` returns
  `percentage_fee` + `fixed_fee`, filterable by `price`/`listing_type_id`/`category_id`/`currency_id`, and requires
  an **OAuth Bearer token** from **one house account** (no app-only grant; 6 h access token + refresh; the endpoint
  geo/IP-gates non-BR egress). Amazon + Shopee have **no** public fee-schedule API → hand-curated. Cloud Run
  supports a **static outbound IP** via VPC egress + Cloud NAT (a BR-region NAT ⇒ BR egress IP).

Decision 5 (pricing-core 3.0.0 result/version contract) extends ADR-0008 and is recorded in **ADR-0011**.

---

## Part 1 — Fee-catalog contract & delivery model

### Option 1A — Per-query "resolve fee" endpoint (`…/resolve?…&listingPrice`) — rejected
Server resolves band + freight and returns the single value.
- **Cons:** a network round-trip **per (channel, price)** breaks offline-first; the band depends on the announce
  price which depends on the band (a fixed point pricing-core must own) → can't recompute offline on edit; edges
  toward "backend computes the price". **Confidence 25%.**

### Option 1B — Whole-catalog **snapshot document** (all three marketplaces, versioned, provenance) — CHOSEN (shape)
One document carrying every channel's commission, price-band fixed-fee schedules, freight descriptors, and
provenance; the client resolves fees for any channel + price **entirely offline**.
- **Pros:** resolve once, compute offline forever; backend serves **data only** by construction; band + freight are
  plain data pricing-core resolves offline; one shape drives **every** delivery path (endpoint, cached store, seed).
- **Cons:** carries all three marketplaces (a few KB — negligible). **Confidence 82%.**

### Option 1C — Hybrid (bulk snapshot + per-query resolve) — rejected (YAGNI)
Two contracts + two code paths for one consumer; the resolve endpoint is dead weight (Principle VI). **40%.**

**Chosen snapshot shape (1B), camelCase (ADR-0002)** — used identically by the endpoint, the persisted cache and the bundled seed:
```
GET /api/v1/fee-catalog            # public, unauthenticated; Cache-Control: public; ETag + If-None-Match → 304
{
  catalogVersion: string,        // data-freshness stamp, e.g. "2026-07-06.1" (drives the seal + the E4 snapshot, ADR-0011)
  schemaVersion: string,         // payload-shape version for forward-compat
  generatedAt: string,           // ISO-8601
  marketplaces: [{
    marketplace: "MERCADO_LIVRE" | "AMAZON" | "SHOPEE",
    determinantsSchema: {...},                    // ML {listingType,category} | Amazon {category,plan} | Shopee none
    entries: [{
      determinants: {...} | null,
      commissionPct: number | null, fixedFee: number | null,
      priceBands: [{ minPrice, maxPrice, commissionPct, fixedFee }] | null,   // half-open [min,max); maxPrice null = ∞
      freight: { kind: "NONE" | "ESTIMATE" | "BAND_VOUCHER", ... },           // Part 4
      minPerItem: number | null,
      source, sourceUrl, effectiveDate, lastReviewed
    }]
  }]
}
```
- **Price bands:** ordered **half-open** intervals `[minPrice, maxPrice)` (`maxPrice: null` = ∞), lower-inclusive
  tie-rule → deterministic, no boundary oscillation (data here; the fixed-point **algorithm** is pricing-core's, ADR-0011).
- **Provenance is mandatory per entry** so the honesty seal (FR-107) is data-driven, not hard-coded.
- **Error surface:** reuses the ADR-0002 envelope; the only realistic failure is `INTERNAL` (500) — **no new
  `ErrorCode`**. A fetch failure is non-fatal: the client falls back to the persisted store, then the seed.

### Delivery model — **backend endpoint + persisted client cache + bundled seed** (amended 2026-07-06, owner-directed)

Supersedes the earlier bundle-only delivery. The backend **serves** the catalog; the client **fetches on first
screen load, persists it, and consumes from the store** thereafter; a **bundled seed** guarantees the offline/free
first-run promise. See "Amendment" for the reversal rationale + risk review.

- **Backend serves the committed artifact.** `GET /api/v1/fee-catalog` returns the **versioned artifact committed
  in the repo**, read from the deployed backend image (**R6 = (a)**: NOT a datastore — this keeps the ML **PR
  human-gate** of Part 3; freshness reaches clients on a **backend deploy**, without redeploying the web/app). A
  future variant may read a datastore for no-deploy freshness (R6 = (b)) — that re-opens the auto-vs-review gate and
  is **not** chosen now.
- **Client fetches once per session, then caches.** On first `Calcular` mount (online) the app fetches the catalog
  and **persists it** (see Part 2); subsequent renders + reloads read the **store**; when online it revalidates
  (ETag) and updates the store + `catalogVersion`.
- **Bundled seed (MANDATORY).** A small seed snapshot ships **in the app build** so a **first-ever, signed-out,
  offline** visitor (empty store, no reachable backend) still gets pre-fills — otherwise FR-108/SC-104 regress
  (risk R1). Resolution order: **store (freshest cached) → seed (first run) → fetch/refresh from the endpoint when
  online**.
- **Cross-platform gain (why the endpoint earns its keep):** new fees reach clients on a **backend-only deploy** and
  a future **Android (Capacitor) app gets fresh fees without a store release** — the capability bundle-only lacked
  (Constitution I).

---

## Part 2 — Offline availability, persisted cache, staleness & first-run

The fee reference is **not** on the price hot-path (pricing-core computes offline from whatever catalog the client
holds), but the **pre-fill UX** now depends on the endpoint on first contact — so the offline guarantee rests on the
**seed + a persisted store**, not on the network.

### Persisted client cache — CHOSEN: per-query persister → IndexedDB (with a whole-client fallback)
- **2B — `experimental_createQueryPersister` (per-query) → IndexedDB via `idb-keyval` — CHOSEN (74%).** Persists
  **only** the fee-catalog query (no auth/identity on disk); lazy restore; `maxAge` bounds eviction. **Pin the
  version + re-verify at implementation** (`experimental_`). — **R2 caveat:** the store MUST be **persisted**
  (IndexedDB/localStorage); an in-memory Zustand store would **lose the catalog on an offline reload**.
- **2A — `persistQueryClient` whole-client → IndexedDB — FALLBACK (66%)** if 2B churns; requires a
  `shouldDehydrateQuery` filter so only the catalog (never `["me", uid]`) is written to disk.
- **2C — Workbox SW `StaleWhileRevalidate` on `/api/v1/fee-catalog` — rejected (45%):** opaque to the staleness UI
  (the seal needs `generatedAt`/`lastReviewed`); app-layer caching keeps the seal honest.

### Seed, staleness & first-run
- **Bundled seed** (`apps/web/src/shared/fee-catalog/seed`): the whole catalog for the three launch marketplaces,
  same `schemaVersion`; seal reads **"referência embutida"** until a live fetch/store entry supersedes it. A gate
  test asserts the seed parses under the current `schemaVersion`.
- **Staleness seal (30 days, unchanged).** The seal reads the **active** data's `generatedAt`/`lastReviewed` vs the
  device clock; `now − lastReviewed > 30 d` → **"pode estar desatualizada"**. Seal states (FR-107/109): catalog
  reference (fresh, with date) · possibly-stale · **seed/embutida** · seller override → **"ajustado por você"** ·
  uncovered combo → **"sem referência"** + manual entry.
- **First-run offline (R1) is covered by the seed** — never a blank grid, never a blocking fetch error. Online, the
  first fetch replaces the seed and is persisted for the next offline session.

---

## Part 3 — Mercado Livre ingestion (compute/egress) + PR write policy

### Option 3A — Cloud Run **Job** + Cloud Scheduler in southamerica-east1, static BR egress — CHOSEN (compute/egress)
- **Pros:** matches ADR-0004/0005 (Cloud Run + WIF, southamerica-east1, scale-to-zero); isolated from any
  request-serving path; São Paulo region + Cloud NAT ⇒ **BR egress IP** (satisfies the ML geo-gate — verified);
  token lifecycle bounded in one job. **Confidence 76%.**
- Rejected alternatives: **3B** in-process task in the FastAPI service — Cloud Run scales to zero, no reliable
  scheduler (20%); **3C** GitHub Actions calling ML — runners are non-BR, the geo-gate fails (30% for ML — but a
  scheduled workflow remains fine for non-API curation chores that make no geo-gated call).

### Write policy — **VERSIONED REPO ARTIFACT via PR** (unchanged by the delivery amendment; R6 = (a))
The job **does not write a datastore.** It fetches `listing_prices`, computes the refreshed ML slice, and **opens
a PR with the fee-catalog diff**; the **owner reviews/merges** (the human validation gate = the PR, per ADR-0006);
a **backend deploy** publishes it (the endpoint then serves the new artifact). **Amazon/Shopee** curated values live
in the **same** committed artifact, edited by PR. This is the strongest Constitution-II posture: **every** ML change
is validated against its source by a human before it can go live.

**Credential & egress (coordinate with `seguranca`):**
- A **dedicated house ML account** (homologated Q-D — the owner provisions it before any ingestion code; not a
  personal account).
- OAuth **refresh token in GCP Secret Manager** (never in repo/env/client), read via the job's WIF service account
  (least privilege). ML issues 6 h access tokens and **may rotate the refresh token on use** → the job **persists
  the rotated refresh token back to Secret Manager** each cycle (verify ML's rotation behaviour + the minimal scope
  for `listing_prices` at implementation). The token is **never** exposed to the client.
- **Egress:** Serverless VPC Access (or Direct VPC egress) + Cloud NAT static IP in southamerica-east1 → BR
  outbound.
- **Failure handling — fail-safe:** on any ML error the job **opens no PR / leaves the artifact untouched**,
  reports to Sentry (ADR-0002 correlation), and the last-merged artifact stays live. Because the client always has
  the **persisted store + seed**, an ML refresh failure — or the endpoint being unreachable — **cannot** break the
  calculator (FR-108).

**Coexistence:** one uniform schema. ML entries `source:"API Mercado Livre (listing_prices)"`; Amazon/Shopee
`source:"curadoria manual"`; all carry `sourceUrl`/`effectiveDate`/`lastReviewed`.

---

## Part 4 — Freight / free-shipping data model — discriminated union (CHOSEN)

`freightCost` is a **deduction from `recebido_liquido`**, **never** added to `custo_total` (homologated).

### Option 4A — Per-entry `freight` discriminated union + per-channel `freightInputs`, computed in pricing-core — CHOSEN
```
ML     → { kind: "ESTIMATE",     thresholdPrice, defaultSubsidy, inputsSchema: ["categoria","peso"] }   # seal MUST say "estimativa"; override authoritative; never curate an exact ML value
Shopee → { kind: "BAND_VOUCHER", bands: [{ minPrice, maxPrice, voucherCeiling }] }                      # curatable from art. 26839, with provenance; overridable
Amazon → { kind: "NONE" }                                                                               # freightCost = 0
```
- **Pros:** one generic component, extensible to future channels; pricing-core stays the **sole** computer; the
  honesty (`ESTIMATE` vs curated `BAND_VOUCHER`) is encoded in `kind` and drives the seal; deterministic.
  **Confidence 72%.**
- Rejected: **4B** flat seller-entered number (loses Shopee's curatable voucher + ML default; 35%); **4C** force
  freight into the price-band mechanism (ML's subsidy isn't band-shaped → dishonest; 40%).
- The richer weight/volume/region ML estimator is a **future extension** — not built now (Principle VI).

---

## Amendment 2026-07-06 — delivery reversed to endpoint + persisted cache + seed (owner-directed)

**Trigger.** The owner directed that the **backend serve** the catalog and the **front consume it on first screen
load and keep the latest in a store** (F1/F2/F5 of the analyze reconciliation), explicitly asking for a **risk
review**. This reverses the bundle-only delivery homologated earlier the same day.

**Why it's justified (not moot, unlike under pure bundle-only).** Bundle-only was chosen because, under a
PR+deploy write model, an endpoint's payload changes only on deploy. The **new, legitimate benefit** is
cross-platform freshness: with a served endpoint, new fees reach clients on a **backend-only deploy** and a future
**Android/Capacitor app updates fees without a store release** (Constitution I). That earns the endpoint.

**Risk review (owner-requested).**
- **R1 (was HIGH — mitigated MANDATORY):** first-ever load **offline** / backend down → empty store → no pre-fills
  → would regress FR-108/SC-104. → a **bundled seed is mandatory** (kept in the build). The offline/free guarantee
  now **rests on the seed + the persisted store**, not on the network.
- **R2 (MED):** an in-memory store loses the catalog on an offline reload → the cache **MUST be persisted**
  (IndexedDB; Part 2 2B/2A). Re-introduces the `experimental_createQueryPersister` dep (pin + verify).
- **R3 (MED):** a new **public, unauthenticated** endpoint (CORS, ETag) that **must never gate** (FR-117 / Const IV)
  and must not require a token — the existing transport sends a token only when signed-in, so a public GET is fine.
- **R4/R5 (LOW):** "backend never computes a price" holds (data only, FR-118); the staleness seal logic is unchanged
  (reads the active data's dates vs 30 d).
- **R6 (open sub-choice, planned default = (a)):** the endpoint serves the **committed repo artifact** (keeps the PR
  human-gate; deploy-cadence freshness) rather than a **datastore** (near-real-time, re-opens the auto-vs-review
  gate). Flip to (b) only if the owner wants no-deploy freshness at the cost of that gate.

**Net delivery:** endpoint (serves committed artifact) → client fetch-on-first-load → **persisted** store → **seed**
for first-run offline. Everything else in this ADR (1B shape, 3A ingestion + PR write policy, 4A freight, provenance)
is **unchanged**.

## Decision (homologated 2026-07-06, delivery amended same day)

**1B snapshot shape**, delivered by a **public `GET /api/v1/fee-catalog` endpoint that serves the committed,
versioned repo artifact**, with the **client fetching on first `Calcular` load and persisting it (IndexedDB), a
MANDATORY bundled seed for first-run offline**, a **30-day staleness seal** · **3A Cloud Run Job + Scheduler with
static BR egress + Secret-Manager house-account OAuth**, writing via a **PR the owner reviews/merges** (R6=a; job
never touches a datastore) · **4A freight discriminated union** deducting from líquido only. Open questions resolved:
**Q-A** = human PR review gate; **Q-B** = 30 days; **Q-C/R6** = committed repo artifact **served** by the endpoint;
**Q-D** = dedicated house account. Nothing lets the backend compute a price; nothing gates the calculator; every
served value is provenance-stamped; the offline/free guarantee is held by the **seed + persisted store**.

## Consequences

- **Positive:** cross-platform freshness — fees update on a **backend-only deploy**, and a future Android app gets
  them without a store release; the fee reference stays **public read-only, never a gate**; pricing-core still
  computes **fully offline**; every ML change is human-validated before publish (Constitution II); one 1B schema
  serves endpoint + store + seed; the model extends to more channels as pure data.
- **Negative / trade-offs accepted:** more surface than bundle-only — a **backend endpoint** (dev-backend), a
  **persisted client cache** (a pre-stable persister dep to pin/verify), and a **maintained bundled seed**; the
  offline/free guarantee now **depends on the seed being shipped** (a gate test enforces its presence + parse); the
  ML house credential is a high-value secret needing a rotation runbook (`seguranca`).
- **Follow-ups:** consumes **ADR-0011** (pricing-core 3.0.0 contract + snapshot freezing `catalogVersion` +
  resolved fees). Tasks split to: **dev-backend** (the `/api/v1/fee-catalog` endpoint serving the committed
  artifact, ETag, public/no-gate), **dev-frontend** (fetch-on-load + persisted store + seed + the seal/staleness +
  override + manual-entry), **dev-estrutura-de-dados** (artifact schema + curated entries + the seed), **devops**
  (Cloud Run Job + Scheduler + VPC/NAT + Secret Manager + PR-open automation), **seguranca** (house-account runbook).
  **Re-verify the ML API shape, token-rotation behaviour, required scope, and the `experimental_` persister at
  implementation.**
- **Spec reconciliation (ADR does not edit the spec):** the delivery reversal **re-flips** the bundle-only spec
  wording — FR-105/107/108/117, US2/US3/US6, SC-104, the §model "Delivery" paragraph, §5 and Assumptions revert
  toward "**fetch from the backend when online → persist to a store → offline uses the store → a bundled seed covers
  first-run offline**". Exact deltas are handed to the owner alongside this amendment.

### Sources verified (2026-07-06)
- ML OAuth (Bearer token, auth-code exchange, refresh) + `get_listing_prices` filters:
  <https://developers.mercadolivre.com.br/en_us/authentication-and-authorization> · <https://github.com/matihick/mercadolibre>
  (the `percentage_fee`/`fixed_fee` fields + non-BR IP-gate are the spec's 2026-07-06 verification — reconcile live before curating).
- Cloud Run static outbound IP via VPC egress + Cloud NAT: <https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip> · <https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc>
- TanStack Query persistence (chosen client-cache path): <https://tanstack.com/query/v5/docs/framework/react/plugins/createPersister> · <https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient>
