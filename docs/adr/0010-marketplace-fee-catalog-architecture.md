# ADR-0010: Marketplace fee-catalog architecture (served artifact + client cache + seed · ML PR-ingestion · freight model)

- **Status**: **Accepted (owner-homologated 2026-07-06)** · **delivery amended 2026-07-06 (owner-directed): backend endpoint + persisted client cache + bundled seed** (see "Amendment"). Supersedes the bundle-only delivery.
  · **Part 3 ingestion runtime amended 2026-07-24 (owner-directed): CI-first — a scheduled GitHub Actions workflow for
  Amazon **and** Mercado Livre, superseding Option 3A (Cloud Run Job + Cloud Scheduler + Cloud NAT + Secret Manager).
  The ML runner location (GitHub-hosted vs self-hosted BR) is gated on the **G1** geo-gate measurement; credential
  custody is routed to `seguranca`.** See "Amendment 2026-07-24 — Part 3 ingestion runtime". The write-via-PR human
  gate, the fail-safe, and Parts 1/2/4 are **unchanged**.
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

> **SUPERSEDED IN PART, 2026-07-24.** The **compute/egress** choice below (Option 3A) is superseded by
> "Amendment 2026-07-24 — Part 3 ingestion runtime" at the end of this ADR (CI-first for Amazon **and** ML). The
> **write policy**, the **credential principles**, the **fail-safe** and the **coexistence** rules below remain in
> force. The original text is kept intact so the earlier decision and its reasoning stay legible.

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

## Amendment — committed-artifact placement (2026-07-07, owner-directed)

The committed source-of-truth artifact moves from repo-root `fee-catalog/catalog.json` to
**`backend/app/data/catalog.json`**. Rationale: the served endpoint MUST bundle the artifact into the
Cloud Run image, and `backend/Dockerfile` builds with context `./backend` + `COPY app ./app` — an artifact
at the repo root is OUTSIDE that context (it would 500 the endpoint in prod, silently, since the client
falls back to its seed). Placing it under `app/` makes the read path identical in the repo and the
container (`Path(__file__).parents[1] / "data" / "catalog.json"`) with **no** Dockerfile/CI/deploy
build-context change. It remains the **single source of truth**: the FE bundled seed mirrors it, the
truth-gate test parses it, and the ML ingestion Job (D3) edits it via PR. A backend contract test guards
that the served path resolves inside the `app/` package so it can never silently leave the build context
again. Trade-off accepted: the FE truth-gate + e2e read the artifact via a cross-package path into
`backend/app/data/` (test-only reach); the neutral repo-root location is given up for guaranteed bundling.

### Sources verified (2026-07-06)
- ML OAuth (Bearer token, auth-code exchange, refresh) + `get_listing_prices` filters:
  <https://developers.mercadolivre.com.br/en_us/authentication-and-authorization> · <https://github.com/matihick/mercadolibre>
  (the `percentage_fee`/`fixed_fee` fields + non-BR IP-gate are the spec's 2026-07-06 verification — reconcile live before curating).
- Cloud Run static outbound IP via VPC egress + Cloud NAT: <https://docs.cloud.google.com/run/docs/configuring/static-outbound-ip> · <https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc>
- TanStack Query persistence (chosen client-cache path): <https://tanstack.com/query/v5/docs/framework/react/plugins/createPersister> · <https://tanstack.com/query/v4/docs/framework/react/plugins/persistQueryClient>

---

## Amendment 2026-07-24 — Part 3 ingestion runtime: **CI-first for Amazon AND Mercado Livre** (owner-directed; supersedes Option 3A)

**Status of this amendment**: **Accepted for Amazon** · **Accepted-in-principle for Mercado Livre, with the runner
location gated on the G1 measurement** · **credential-custody sub-decision routed to `seguranca` (not decided here)**.
Authored by `arquiteto` at the 014 plan round; owner ratification pending on the questions in §A7.

### A1. Trigger — the owner's rectification (verbatim)

> "Faz mais sentido que essa chamada seja **trigada em tempo de CI** do que fazermos algo diferente disso. Porque
> **não gera mais custo** de qualquer serviço web do Google Cloud ou AWS, e porque **já utilizamos um processo que
> acontece dentro da aplicação**."

and, when told the ML API is believed to geo-gate non-BR egress:

> "pode deixar essa estratégia **para os dois** (amazon e ml)"

This is a **conscious rectification of an Accepted decision**, recorded per ADR-0003/Principle VIII rather than
silently absorbed. Option 3A was chosen on 2026-07-06 at 76% confidence; two things have changed since, and one thing
was never true:

1. **Standing decision 2026-07-09 — provisioning + first deploy DEFERRED until v1 (E1–E6).** 3A cannot execute at
   all until a GCP project, WIF pool, VPC connector, Cloud NAT, Cloud Scheduler and Secret Manager exist. Under the
   deferral, choosing 3A for 014 means the ML ingestion stays parked **even after Q3 (the house ML account) clears** —
   it would trade one blocker for another. This is the strongest argument for the amendment and it is *not* the
   cost argument.
2. **The in-repo precedent the owner cites is real.** `.github/workflows/auto-pr.yml` already opens PRs from CI with
   `gh pr create` + `secrets.GITHUB_TOKEN` (ADR-0006). The "PR-open automation" line item that Part 3 assigned to
   devops as new work **already exists and is exercised on every develop/main CI pass**.
3. **The geo-gate was never measured.** Part 3 calls the BR-egress requirement "verified", yet the same section
   prices 3C's geo-gate failure at only **30% confidence**. Those two statements cannot both be true. A targeted
   search on 2026-07-24 found **no official ML documentation asserting an IP/country restriction on
   `listing_prices`** (negative result — not proof of absence). The one 403 observed in-session
   (`us8-fee-proposal.md §10.2`) was **`PolicyAgent` on an anonymous call**, which proves only that the
   **unauthenticated** path is dead. **This amendment resolves the contradiction by measurement (G1), not by
   argument.**

### A2. Scope of the supersession — what changes and what is NOT re-decided

**Changed (this amendment only):** the **compute/egress runtime** of the refresh job — Option 3A (Cloud Run Job +
Cloud Scheduler + Serverless VPC/Cloud NAT + Secret Manager) → **a scheduled GitHub Actions workflow**, for **both**
marketplaces, plus the **custody** question that move creates (§A5).

**Explicitly unchanged and NOT re-opened here** (any deviation needs its own amendment):
- **Write policy Q-A** — the job **opens a PR with the diff; the owner reviews/merges; the job never merges and
  never writes a datastore**. Human gate intact.
- **Fail-safe** — any fetch/parse/auth failure ⇒ **no PR, artifact untouched**, alert to Sentry; an empty or
  drastically-shrunk parse is a **failure**, not a fee change (014 SC-806).
- **Delivery + resolution order** — endpoint (serves the committed artifact, R6=(a)) → **persisted store → seed**;
  R1 (first-run offline) and R2 (the store must be persisted) hold unchanged.
- **1B uniform schema** and **per-value provenance** (`source`/`sourceUrl`/`effectiveDate`/`lastReviewed`),
  Constitution II. *(014's owner round-1 decision to move provenance to the marketplace level is a **separate**
  schema question for the 014 plan — it is not decided by this amendment.)*
- **Part 1, Part 2, Part 4** in full; the **30-day staleness seal**; the "backend never computes a price" invariant.
- **The house ML account (Q-D)** stays a hard precondition for any ML ingestion. This amendment changes **where the
  job runs**, never **whether the credential is needed**.

### A3. Options (compute/egress runtime)

#### Option 3D — Scheduled GitHub Actions on **GitHub-hosted** runners, for Amazon **and** ML — CHOSEN for Amazon; chosen for ML **iff G1 passes**
One `schedule:`d workflow on the default branch (plus `workflow_dispatch`), reusing the existing checkout →
Playwright → parse → `gh pr create` toolchain.
- **Pros:** zero new cloud surface and **zero new provisioning** — it works under the 2026-07-09 deferral, which 3A
  does not; the PR-open mechanism already exists (`auto-pr.yml`); the parser runs in the same runtime the repo
  already tests it in (Playwright is a devDependency; the same `ubuntu-latest` image runs the e2e job); one runtime
  for both marketplaces = one failure mode, one log, one runbook; cost is de-minimis (§A4).
- **Cons:** for ML it **assumes** no geo-gate — unmeasured; the credential leaves Secret Manager (§A5); scheduled
  runs are bound to the **default branch** and are best-effort (§A6); a PR opened with `GITHUB_TOKEN` **does not
  trigger CI** (§A6.5), so the money artifact's own truth-gate must be re-arranged.
- **Scalability:** trivially linear — more marketplaces = more steps in the same job; monthly cadence uses ~0.25% of
  the Free private quota. The scaling ceiling is **human review throughput** (unchanged from 3A), not compute.
- **Confidence: Amazon 88%** (no auth, no geo-gated call, ADR-0010 Part 3 already blessed exactly this for
  "non-API curation chores") · **ML 45%** — honest low information: it is a coin-flip on G1, and 45% (not 50%) only
  because the 2026-07-06 spec author wrote down a geo-gate belief that, though unverified, was not invented from
  nothing.

#### Option 3E — Scheduled GitHub Actions with a **self-hosted BR runner** for the ML job (Amazon stays hosted) — CHOSEN for ML **iff G1 fails**
Same workflow; the ML job carries `runs-on: [self-hosted, br]`.
- **Pros:** satisfies BR egress **without any GCP service** — which is precisely the owner's constraint; self-hosted
  minutes are **free** and do not touch the plan quota; keeps one CI-shaped design for both marketplaces (the owner's
  "para os dois"); no Cloud Run/NAT/Scheduler to provision or pay for.
- **Cons:** it introduces a **machine** — someone owns, patches and keeps it reachable once a month; if that machine
  is the owner's workstation, the monthly run only happens when it is up (a liveness risk the 30-day seal exposes but
  does not fix); if it is a small BR VPS it is a **recurring cost**, which weakens the amendment's own cost premise;
  and **GitHub explicitly recommends against self-hosted runners on public repositories** (a fork PR can execute code
  on the runner) — see §A7/QA3 and the `seguranca` review.
- **Scalability:** fine for a monthly job; poor if the loop ever needs high frequency or parallel marketplaces on one
  host; a second BR runner is a second machine, not a config flag.
- **Confidence 72%** as the ML fallback (drops sharply if the host would be a workstation rather than a small
  always-on BR box — that is QA4).

#### Option 3F — Split runtimes: Amazon in CI + ML on the ADR-0010 **3A Cloud Run Job** — NOT chosen; retained as the documented fallback
The 014 brief's Q6(a) recommendation, and the shape ADR-0010 Part 3 anticipated.
- **Pros:** BR egress by a **verified, documented mechanism** (Cloud NAT static IP) with no runner to own; keeps the
  ML refresh token in **Secret Manager** with **WIF, no long-lived credential** and a trivial rotation write-back —
  the strongest credential posture of all four options (§A5).
- **Cons:** **blocked by the standing provisioning deferral** — it cannot run in 014 without reversing a separate
  owner decision; two runtimes, two failure modes, two runbooks for one artifact; recurring GCP surface (NAT is
  billed hourly + per-GB even when idle) — the exact cost the owner rejected; and it re-introduces the "Amazon waits
  on nothing / ML waits on infra" asymmetry the CI-first move erases.
- **Scalability:** the most robust for high-frequency or high-volume ingestion (the ML category walk is thousands of
  calls); the least aligned with the owner's cost/uniformity constraint.
- **Confidence 55%** as of today (it was 76% on 2026-07-06 — the drop is entirely the 2026-07-09 deferral plus the
  now-visible fact that the geo-gate that justified it is unmeasured).

#### Option 3G — Unchanged 3A (both marketplaces on Cloud Run Job + Scheduler) — SUPERSEDED
- **Cons:** everything in 3F plus coupling the **unblocked** Amazon path to provisioning it does not need — Amazon
  has no OAuth, no account, no geo-gated call (§A8). **Confidence 40%.**

### A4. The cost read (measured 2026-07-24) — cost is *not* the discriminator

| Fact | Value | Note |
|---|---|---|
| `schedule`/cron availability | **core Actions on every plan** | **does NOT require Pro**; Pro buys quota, not the trigger |
| Included minutes, **private** repo | **Free 2,000/mo · Pro 3,000/mo** | public repos on standard hosted runners: free |
| Self-hosted runners | **free**, no quota consumption | and they run wherever you put them (⇒ BR egress with no GCP) |
| This repo's CI today | **~16 billed min/run** | GitHub rounds **each job** up: `Gate` 328s→6, `E2E` 203s→4, + 6 jobs of ~20s→1 each ⇒ ~125 runs/mo on Free-private |
| The monthly fee job | **~5 min/month** | **≈0.25%** of the Free-private quota |

**Reading:** the monthly job is free-in-practice under either plan and either visibility. So the amendment must not be
argued on quota. Its real currency is: **(a)** no provisioning dependency, **(b)** one runtime instead of two,
**(c)** an existing, exercised PR-open mechanism — against **(d)** a weaker credential posture and **(e)** an
unmeasured geo assumption.

### A5. The weak point, named: **ML refresh-token custody moves from Secret Manager to GitHub**

This is the cost of the amendment and it must not be buried. **The security decision is `seguranca`'s parecer, in
flight in parallel — this section states the tension, it does not resolve it.**

- **Under 3A/3F (Secret Manager):** the refresh token is read by the job's service account over **WIF — no
  long-lived credential exists anywhere**. ML **rotates the refresh token on use**, so the job must **write the
  rotated token back**; in Secret Manager that is one `versions.add` on the same least-privilege SA. Blast radius of
  a compromise: whoever holds the GCP project / that SA.
- **Under 3D/3E (GitHub Secrets):** the token sits in an Actions secret (encrypted at rest, masked in logs, not
  exposed to fork PRs). But the **write-back has no free path**: the default `GITHUB_TOKEN` **cannot** update
  repository secrets, so persisting the rotated token requires a **PAT or GitHub App credential stored as another
  secret** — i.e. **a second long-lived credential whose compromise yields both the ML token and repo write
  access**, held in the same store it is meant to protect. Blast radius: the GitHub repo/org surface plus anyone who
  can run a workflow on the default branch — and, under 3E, the self-hosted runner host itself.
- **The non-negotiable corollary:** if the rotated token is **not** written back, the loop breaks the first time ML
  rotates. The fail-safe means that is a **silent stall** (no PR, artifact untouched, alert) — never corruption —
  but the loop is dead until someone re-authenticates by hand. **So: verify ML's actual rotation behaviour before
  choosing** (ADR-0010 Part 3 already required this verification and it has never been done).
- **A middle path `seguranca` should price (do NOT read this as chosen):** keep the credential in **Secret Manager**
  and let the **CI job** read/write it via **GitHub OIDC → WIF** — the identical keyless posture `deploy.yml` already
  wires (`google-github-actions/auth@v2`). It removes every long-lived credential while keeping compute in CI. Its
  honest con: it **re-introduces a GCP dependency** (project + WIF pool + Secret Manager, ~cents/month but non-zero)
  that the owner's stated rationale was rejecting, and it does **nothing** for egress.

### A6. Operational constraints of scheduled Actions (verified 2026-07-24) — these shape the design

1. **Default-branch only.** Verbatim: *"Scheduled workflows run on the latest commit on the default branch."* The
   default branch is **`main`**; the house flow is `develop` → `main` via a release cut (ADR-0006). Consequences,
   all real: **(a)** the workflow **does not exist to the scheduler** until it has been promoted to `main` — the same
   trap `auto-pr.yml` documents in its own header; **(b)** the code that runs monthly is **`main`'s parser**, so a
   parser fix reaches the loop only at the next release cut; **(c)** the job must **explicitly check out the branch it
   intends to diff against** (`actions/checkout` with an explicit `ref`), because the schedule's implicit checkout is
   `main` while the PR may target `develop` — otherwise the diff is computed against the wrong tree. Which branch the
   fee PR targets is **QA1** (owner's flow decision, not mine).
2. **UTC and best-effort.** Cron is UTC, and verbatim: *"The `schedule` event can be delayed during periods of high
   loads… If the load is sufficiently high enough, some queued jobs may be dropped."* A monthly cadence absorbs
   delay; **"dropped" means a month can silently vanish**. Design response: schedule **off the top of the hour**, and
   treat the **30-day staleness seal (014 US5/SC-807) as the dead-man's switch it already is** — it must not be
   weakened to accommodate a flaky scheduler.
3. **Inactivity auto-disable.** Verbatim: *"**In a public repository**, scheduled workflows are automatically
   disabled when no repository activity has occurred in 60 days."* **Correction to the 014 brief's framing:** the
   documented rule is scoped to **public** repositories. It therefore **applies to this repo today** and, per the
   docs, would not apply once it is private. Either way the mitigation is the same and cheap: an active repo, the
   staleness seal, and a manual re-enable.
4. **`workflow_dispatch` is mandatory, not optional.** It is the manual escape for a dropped/disabled run, for the
   G1/G2 probes, and for re-running after a fail-safe abort. It is also one of the documented exceptions to the
   `GITHUB_TOKEN` recursion rule below.
5. **A PR opened with `GITHUB_TOKEN` does not run CI.** Verbatim: *"When you use the repository's `GITHUB_TOKEN` to
   perform tasks, events triggered by the `GITHUB_TOKEN` will not create a new workflow run."* So the fee-refresh PR
   would arrive **without** the gate that parses the artifact (zod truth-gate, the F3/SC-802 band guard,
   seed↔artifact parity) — the human would review a **machine diff no machine has validated**. Options, all small:
   **(i)** the refresh job **validates the artifact itself** before opening the PR (self-contained, no new
   credential — **recommended, 80%**); **(ii)** open the PR with a PAT/App token so CI fires (works, and adds exactly
   the long-lived credential §A5 is trying to avoid — 45%); **(iii)** rely on a manual CI `workflow_dispatch` on the
   PR branch (free, but it is a human step that can be forgotten — 55%, acceptable only *alongside* (i)).
   **Recommendation: (i) + (iii).** This is mechanism, inside this ADR's remit; option (ii) collides with §A5 and is
   `seguranca`'s call.

### A7. The amendment's own gates — measure, do not assume

**G1 — the ML geo-gate probe (gates the ML runner location; blocks nothing else).**
From a **GitHub-hosted `ubuntu-latest`** runner, with a **valid house-account Bearer token**, call
`GET https://api.mercadolibre.com/sites/MLB/listing_prices?price=100` (and one `category_id`-filtered variant).
It must be a **two-arm** test: the **same token, same minute, from BR egress** (the owner's machine or any BR host)
is the control. Without the control arm a 403 proves nothing — exactly the error the anonymous `PolicyAgent` 403
already caused once.
- **Pass** (hosted arm returns 200 with `percentage_fee`/`fixed_fee`) ⇒ **Option 3D for ML**; no self-hosted runner,
  no BR egress requirement, and ADR-0010's geo-gate belief is formally retired.
- **Fail** (hosted arm blocked while the BR control succeeds) ⇒ **Option 3E** (self-hosted BR runner), subject to
  QA3/QA4.
- **Precondition:** G1 needs the house account token ⇒ it is **blocked on Q3**, which the owner opened on 2026-07-24.
  It is the **first ML task** of the 014 PR-C, not a design debate.
- **Confidence the hosted arm passes: 45%** (see §A1.3). Deliberately *not* stated higher: the amendment's ML half is
  honestly a measurement away from being decided.

**G2 — the Amazon locale/render probe (unblocked; run it first, it costs one CI run).**
Does `sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR` render the **same BR fee
table** from a **non-BR hosted runner**? The whole curated corpus was read from BR sessions (`us8-fee-proposal.md`
§7.4/§8.1), and the 014 brief flags this at ~65%. If G2 fails, **Amazon also needs a BR runner** — which does **not**
make Amazon depend on ML (§A8), it just merges both jobs onto the 3E runner, and the owner's "para os dois" holds
unchanged. **Confidence G2 passes: 70%** (a `?locale=` query parameter is an explicit locale selector, but
Amazon help hubs are known to geo-route).

### A8. Contingency preserved — **Amazon never depends on Mercado Livre**

Under every branch above: Amazon needs **no OAuth, no house account, no ML credential, and no ML-gated egress**. If
Q3 stalls, if G1 fails, if `seguranca` blocks the GitHub-secrets custody — **Amazon's map and the monthly loop still
ship**, and 014 closes at PR-B with real delivered value, exactly as the 014 brief's Q2(a) and the owner's round-1
decision specify. G2 failing would give Amazon a *runner* requirement, never a *credential* or *account* one.

### A9. Sequencing precondition — repo visibility

The repo is **public today**; the owner intends to make it private soon. Implementation of the ML half of this
amendment (secrets in GitHub, and above all a **self-hosted runner** under 3E) is **sequenced after** that
transition, or after `seguranca` explicitly clears doing it on a public repo. `seguranca` owns the reasoning; this
ADR records only that the order matters and that the Amazon half (no secrets, hosted runner) carries none of this
constraint. **Note the interaction with §A6.3:** while public, the 60-day inactivity auto-disable applies; once
private, per the docs, it does not — visibility moves this in the *helpful* direction.

### A10. Decision (this amendment)

**The fee-refresh ingestion runs CI-first, as one scheduled GitHub Actions workflow (`schedule` + `workflow_dispatch`)
covering Amazon and Mercado Livre, superseding Option 3A.** Amazon runs on a GitHub-hosted runner now (subject to
G2). ML runs on a GitHub-hosted runner **if G1 passes**, else on a **self-hosted BR runner** (3E); Cloud Run Job (3F)
survives only as a documented fallback if G1 fails **and** self-hosted is rejected — and reversing the 2026-07-09
provisioning deferral would then be a **separate owner decision**, not a consequence of this one. The PR write policy,
the human merge gate, the fail-safe, the resolution order and the provenance rules are **carried over untouched**.
Credential custody (§A5) is **open pending `seguranca`**; the artifact-validation arrangement is §A6.5 (i)+(iii).

### A11. Consequences

- **Positive:** the ML ingestion stops being blocked by infrastructure the project has consciously deferred — after
  Q3 it is blocked by nothing but a measurement; **one** runtime, **one** log, **one** runbook for both marketplaces;
  the PR-open mechanism is already written and exercised (`auto-pr.yml`); no new recurring cloud cost; ADR-0004/0005
  are untouched (this adds no service — it removes four).
- **Negative / accepted:** a **weaker credential posture** for the ML refresh token (§A5) — the single real
  regression against 3A; the loop's cadence becomes **best-effort** and **default-branch-bound** (§A6.1–A6.2), so a
  fee refresh reaches users only after a release cut **and** a backend deploy (the deploy step is unchanged from 3A
  under R6=(a)); the fee PR loses automatic CI (mitigated by §A6.5); under 3E, the project acquires **a machine to
  own** — the one place this amendment's "no extra cost" premise can quietly fail (QA4).
- **Task re-routing (supersedes the Part-3 line of the 2026-07-06 Follow-ups):** **devops** delivers a scheduled
  workflow + the G1/G2 probes + (conditionally) a self-hosted BR runner runbook — **not** Cloud Run Job + Scheduler +
  VPC/NAT + Secret Manager; **seguranca** delivers the custody parecer (§A5) and the public-repo sequencing (§A9);
  **dev-estrutura-de-dados** owns the deterministic parser + the in-job artifact validation (§A6.5(i)); the ML
  house-account runbook (Q-D) is unchanged.
- **Unaffected:** 014 SC-806 (fail-safe), SC-807 (`lastReviewed` only on real re-verification), SC-811 (**0 LLM
  tokens** — parsing stays deterministic; no `docs/token-ledger.md` row is created by the monthly loop), and the
  E1–E6 acceptance surface.

### A12. Open questions for the owner (Principle VIII — enumerated, NOT defaulted)

| # | Question | Options | Recommendation (confidence) |
|---|---|---|---|
| **QA1** | **Which branch does the fee-refresh PR target?** The schedule fires from `main`; the house integration line is `develop`. | (a) PR into **`develop`** (house flow; reaches users at the next release cut + backend deploy) · (b) PR into **`main`** (fewer hops to publish; bypasses the develop integration line) · (c) PR into `develop`, and let `auto-pr.yml` promote as usual | **(a)/(c)** (**75%**) — a money artifact should travel the same road as every other change; (b) buys days and spends the integration line. |
| **QA2** | **ML refresh-token custody** (the §A5 tension). | (a) GitHub Secrets + a PAT/App token for rotation write-back · (b) Secret Manager read/written from CI via the **existing OIDC→WIF** path · (c) GitHub Secrets with **no** write-back, after verifying ML's rotation behaviour permits it | **Deliberately not recommended here** — `seguranca`'s parecer decides, owner ratifies. Note (b) re-adds a small GCP dependency the rectification was removing. |
| **QA3** | **Do we implement the ML half before the repo is private?** | (a) wait for private, then implement · (b) implement now with `seguranca`'s explicit clearance · (c) implement the hosted-runner variant now (if G1 passes) and defer only the self-hosted piece | **(a)** (**70%**) — but this is `seguranca`'s call to sharpen; self-hosted runners on a public repo are the specific hazard. |
| **QA4** | **If G1 fails — whose machine is the BR runner?** | (a) a small always-on BR VPS (a real recurring cost, ~the thing the rectification avoided) · (b) the owner's workstation (free, but the monthly run only happens when it is on) · (c) revisit 3F/Cloud Run Job instead | **Not defaulted.** (a) keeps the loop honest and costs money; (b) is free and makes liveness depend on a desk. The 30-day seal exposes either failure, it does not prevent it. |
| **QA5** | **Cadence + hour.** ADR-0010/014 assume "monthly"; cron is UTC and best-effort. | (a) monthly, off-hour · (b) fortnightly (more chances to survive a dropped run) · (c) weekly | **(a)** (**70%**) — matches the 014 brief; (b) is the cheap hedge against §A6.2 dropping a month, at the price of more PRs. |

*(The 014 brief's Q7 — what a no-change run produces — is untouched by this amendment and remains open there.)*

### Sources verified (2026-07-24)

- `schedule` event — default-branch execution, UTC/delay/drop, 5-minute floor, and the **public-repo** 60-day
  inactivity auto-disable: <https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows>
- `GITHUB_TOKEN` does not trigger new workflow runs (recursion prevention; `workflow_dispatch`/`repository_dispatch`
  excepted): <https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow>
- Included minutes (Free 2,000 / Pro 3,000 for private repos), Actions free for public repos and **self-hosted**
  runners: <https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions>
- ML `listing_prices` geo/IP restriction: **no official documentation found** in a targeted search on 2026-07-24
  (negative result, recorded as such — this is precisely why **G1** exists).
- In-repo evidence: `.github/workflows/auto-pr.yml` (PR-open from CI with `GITHUB_TOKEN`),
  `.github/workflows/deploy.yml` (`google-github-actions/auth@v2` — the OIDC→WIF path already wired),
  `.github/workflows/ci.yml` (the 8 jobs behind the ~16 billed-minute measurement).
