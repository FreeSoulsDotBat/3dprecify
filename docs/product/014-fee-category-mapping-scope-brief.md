# 014 — Scope brief: category→fee mapping for Mercado Livre + Amazon, refreshed monthly

**Status**: product scope draft (input to `/speckit-specify`) · **Author**: product-owner · **Date**: 2026-07-23
**Branch**: `014-fee-category-mapping` (cut from `develop` = all of v1: E1–E6 + 013 remediation + the confirmation-audit fixes)
**Owner intent that creates this increment (verbatim, 2026-07-23)**: *"Quero que a gente planeje uma forma de mapping
de todas as categorias→preço da Amazon e do Mercado Livre, e uma forma de buscar isso mensalmente para colocar para
os usuários da aplicação (o mais automático possível)."*

> This brief specifies **behavior**, not architecture. The parser, the job runtime, the payload split, the schema
> shape of a category axis and the ML OAuth plumbing are the arquiteto's / `seguranca`'s call at the plan round
> (Principle VIII). **No fee number is invented anywhere in this document** (Constitution II): every rate cited is
> quoted from `specs/013-audit-remediation/us8-fee-proposal.md` with its provenance, and everything else is named as
> a **gap**, not filled. Where I do arithmetic on sourced rates (§2.2) it is labelled as an illustration computed
> from *our own* engine, not as a third-party fact.

**014 is not a roadmap epic.** E7 (Android/Play packaging, `business-rules.md:58`) is untouched and keeps its place.
This is a **post-v1 data + automation increment** that finishes what ADR-0010 designed in 2026-07-06 and never got
data for.

---

## 0. Status of decisions — everything in §10 is OPEN

Like E6, this brief opens with its owner-decision list **unanswered by design**. It carries recommendations +
confidence into `/speckit-specify` + `/speckit-clarify`; it decides nothing. Three questions gate the shape —
**Q3 (provision the house ML account?)**, **Q1 (coverage vs offline bundle)**, **Q2 (does 014 ship without ML?)** —
and **Q3 should be answered first** because it is the only one with **external lead time** (account creation + ML
app approval happen outside this repo and can start in parallel with spec work).

**What is already settled elsewhere and NOT reopened here:**
- **ADR-0010 Part 3 already decided the write policy**: the refresh job **opens a PR with the diff; the owner
  reviews/merges; the job never writes a datastore; on any error it opens no PR and leaves the artifact untouched**
  (Q-A = human PR review gate, homologated 2026-07-06). The owner's "PR, não auto-merge" instinct is not a new
  choice — it is the standing decision, and 014 **inherits** it (§10 Q7 is only about the *no-change run*).
- **ADR-0010 Part 1 already declared the category axis**: `determinantsSchema` in the shipped artifact is literally
  `MERCADO_LIVRE: {listingType, category}` and `AMAZON: {category, plan}`. The shape anticipated categories from day
  one; only the **wire** and the **data** were never built. 014 is the fulfilment of that design, not a new one.
- **013 gate T063 deferred the single-category curation** *to this increment*, on the owner's reasoning that curating
  one category would ship a wrong number under a "referência" seal for most users
  (`us8-fee-proposal.md §9`). Today `entries: []` still ships for ML and Amazon.

---

## 1. Vision (the seller's problem)

*"Eu imprimo suporte de vaso e miniatura. Anuncio no Mercado Livre e na Amazon. O app já calcula tudo — mas na hora
do marketplace ele me pergunta a comissão e eu não sei. Tenho que sair do app, logar no Mercado Livre, procurar a
minha categoria numa tela escondida, voltar e digitar. E daqui a três meses a taxa muda e eu nem fico sabendo."*

Today the app answers that seller **honestly and uselessly**: ML and Amazon resolve to **no entry**, the seal reads
**"sem referência"**, and he types a number from memory. Shopee — the one curated marketplace — proves the loop
works: a sourced, dated, overridable pre-fill. 014 gives ML and Amazon the same thing, **at the granularity the two
marketplaces actually bill at (per category)**, and keeps it fresh **without a human remembering**.

The one-line pitch: **the app stops asking the seller a question the marketplace already answers in public.**

---

## 2. Honest value analysis — who benefits, and how much (read this before sizing the work)

The owner asked for a materiality read. Here it is, unflattering parts included.

### 2.1 A printed object is listed under its END-USE category, not "Impressão 3D"

This is the load-bearing product fact. The one exact ML rate we own — `Informática › Impressão › Impressão 3D ›
Outros` = **13% Clássico / 18% Premium** (`us8-fee-proposal.md §8.2`, owner's authenticated session) — is almost
certainly **not** the category most of our sellers list under. A vase holder goes in *Casa/Decoração*; a miniature in
*Brinquedos*; a bracket in *Ferramentas/Peças*. Shipping that one rate as "the ML rate" would be exactly the
wrong-number-under-a-reference-seal damage T063 refused. **Per-category is not a nicety here; it is the only honest
way to pre-fill ML or Amazon at all.** (Confidence that end-use categorisation dominates: ~85% — inference from how
marketplaces categorise physical goods, not measured on our users.)

### 2.2 How much money does the granularity actually move? Modest — and I should say so

Amazon's sourced spread across the categories a 3D seller plausibly uses: **Casa e Cozinha 12% · Brinquedos e Jogos
12% · Papelaria e Escritório 13% · catch-all "Outros" 15%** (`us8-fee-proposal.md §7.4/§8.1`, two official sources).
So the realistic error from using the catch-all is **~3 percentage points**.

*Illustration computed with our own gross-up, not a third-party claim*: a piece with R$ 50,00 of total cost priced to
cover the fee lands near R$ 58,80 at 15% and near R$ 56,80 at 12% — **~R$ 2,00, ~3,5% of the announce price**. Real,
but not dramatic per unit, and a seller who already knows his rate fixes it in five seconds with the override that
already exists.

**Two places where the money is genuinely bigger:**
1. **ML's fixed cost under R$ 79** — R$ 6,25 / 6,50 / 6,75 by price band (`§8.2`). On a R$ 40,00 item that is **~16%
   of the announce price** — several times the commission spread. And ML pre-fills **nothing** today.
2. **Amazon's price-banded categories** — Acessórios Eletrônicos 15%/10% at R$ 100; Móveis and Colchões 15%/10% at
   R$ 200 (`§8.1`). A 5pp cliff, and a shape our `priceBands` already models.

### 2.3 The honest ranking of value (this should drive slicing, not the other way round)

| Rank | What delivers it | Why |
|---|---|---|
| **1** | **ML having ANY sourced entry at all** (esp. the sub-R$ 79 fixed cost) | biggest per-unit money effect; today it is literally zero data |
| **2** | **The monthly refresh loop** | a curated rate that silently rots is worse than none; the 30-day seal is the only thing standing between us and a stale lie |
| **3** | **Amazon full 38-category map** | cheap to build (one page, one parser), removes the lookup trip |
| **4** | **ML full leaf-level map** | correct, but expensive, blocked, and the marginal gain over "right subtree + override" is the smallest of the four |

**The uncomfortable part, stated plainly**: the *incremental* value of a complete leaf-by-leaf ML map over "a
correct entry for the handful of categories 3D sellers use, plus the override" is **low-to-moderate**. The friction
being removed is *the trip to a logged-in page*, not the third decimal of a percentage. That is an argument for
**staging** the ML side (§10 Q1), not for skipping it.

### 2.4 The failure mode this increment must not create

Every rate we ship carries a **"referência"** seal with a source and a date — the app's word that the number is
sourced. A category map is **38 to thousands** of chances to be wrong at scale, refreshed by a robot, under that
seal. The whole increment's risk is concentrated there, which is why §6 is heavier on guards than on features.

---

## 3. What 014 IS

014 is: **a category axis on the fee lookup, a sourced category→fee map for Amazon (and for ML when it is
unblocked), and a monthly automated refresh that proposes changes through a human-reviewed PR.** Concretely:

- the **wire**: `category` becomes a determinant the calculator actually sends, with **most-specific-match**
  resolution and a deterministic catch-all fallback;
- a **category picker per channel slot** — optional, search-first, with an honest "não informada" state (behavior
  only; layout/flow → `designer-ux`);
- the **Amazon map**: all categories published in the Seller Central fee table (`G200336920`), the per-category
  commission, the **BRL 1,00** minimum, the plan axis (Profissional / Individual), and the three price-banded
  categories — every value provenance-stamped and category-named in its seal;
- the **monthly refresh loop**: deterministic, **0 LLM tokens**, opening a **PR with a human-readable old→new diff**,
  never auto-merging, **failing loudly rather than emptying the catalog**;
- the **ML map** — same shape, gated on the house account (Q-D), designed so its absence does **not** block the rest;
- **honesty invariants preserved end-to-end**: the referência / ajustado por você / sem referência seal semantics,
  provenance on every value, and the **F3 guard** (no 0%-commission entry under a reference seal) — extended, not
  weakened.

## 3.1 What 014 is NOT (so it cannot creep)

- **NOT a new premium gate.** The fee catalog is public, served unauthenticated and bundled in the client (ADR-0010
  R3/FR-117). It stays **free** (§4, Q4). Nothing here touches the E2 entitlement wall.
- **NOT a pricing-core change.** The commission/gross-up math is unchanged. In particular, Amazon's
  commission-includes-shipping base (§9.4) is **declared, not modelled** — modelling it would change the commission
  base in `packages/pricing-core` (a version bump + the ADR-0022 pricing-domain escalation) for a bounded,
  known-direction understatement. Recommended OUT (Q9).
- **NOT a cross-marketplace taxonomy.** We do not invent a single internal category tree mapped onto ML's and
  Amazon's. Each marketplace's own published categories, verbatim (Q12).
- **NOT per-account / per-seller fee authorisation.** A seller connecting *his own* ML/Amazon account to read *his*
  negotiated rates is the deferred integration increment from E5 Q1 — unrelated, still deferred.
- **NOT a logistics/shipping-mode model.** ML's fixed cost depends on `logistic_type` (Flex / Full / ME1 / próprio),
  an axis the app does not have (`§7.3`). We either declare the assumption or skip the value (Q8) — we do not invent
  the axis here.
- **NOT ML freight.** The ML free-shipping subsidy stays an overridable **estimate** (ADR-0010 Part 4), untouched.
- **NOT a category field on saved products.** Whether the chosen category persists into E2 products / E5 scenarios /
  E4 snapshots is a scoped decision (Q10), defaulting to *scenarios yes, products no*.
- **NOT a scraped ML workaround.** A headless browser driving a stored seller session is explicitly **rejected**
  (`§10.2b` — fragile and ToS-risky). ML comes from the sanctioned OAuth API or from the owner's own session, or it
  does not come.
- **NOT a weakening of the F3 guard.** It gets stronger (SC-802).

---

## 4. Freemium boundary — unchanged, and technically un-gateable

The fee catalog is **free** and stays free. This is not generosity, it is the architecture: the catalog is **bundled
into the client build** (`seed.ts`) and served by a **public unauthenticated** endpoint (ADR-0010 R3). You cannot
server-gate data you ship inside the app bundle, and gating the endpoint would break the offline-first guarantee
(FR-108) that the free calculator rests on. **014 introduces no new gate, no new free capability, and no change to
the E2 entitlement wall.** (Q4 puts this in front of the owner anyway, because it is his boundary to draw.)

---

## 5. User stories

### US1 — Escolher a categoria do anúncio, por canal — **P1**
The seller can tell the app which marketplace category the piece is listed under, per channel slot. Choosing is
**optional**; not choosing is never worse than today.

**Acceptance scenarios**
1. **Given** a channel slot for ML or Amazon, **When** the seller opens the category selector, **Then** he can find
   his category by **typing part of its name** (not only by drilling a multi-level tree), and the names shown are the
   marketplace's own published names.
2. **Given** the seller does **not** pick a category, **When** fees resolve, **Then** the app behaves per Q5 (either
   the marketplace's own catch-all with a seal that says so, or "sem referência") — and **never** silently assumes a
   specific category.
3. **Given** a marketplace with no category axis (Shopee, Outro), **When** the slot renders, **Then** no category
   selector appears (mirrors the existing modality rule).
4. **Given** a seller who picked a category, **When** he adds a second channel slot, **Then** the choice is
   per-slot (a category on ML does not silently become the Amazon category).
5. **Given** an offline session, **When** the seller opens the selector, **Then** it works from the catalog the
   client already has — the picker never requires the network.

> Layout, drill-vs-search affordance, and where the selector sits inside the slot are **`designer-ux`'s**; this story
> fixes only the behavior.

### US2 — O pré-fill resolve pela categoria, com selo que nomeia a categoria — **P1 [FOUNDATIONAL]**
The lookup actually uses the category. Today `slotDeterminants` sends **only** `listingType` (ML) / `plan` (Amazon)
— a category-keyed entry would never resolve and the feature would look broken (`us8-fee-proposal.md §10.3`).

**Acceptance scenarios**
1. **Given** a category-keyed entry exists for the seller's (marketplace, category, modality), **When** the slot
   resolves, **Then** that entry pre-fills and the seal names **the category the number is for**.
2. **Given** both a category-specific entry and a marketplace catch-all match, **When** resolving, **Then** the
   **most specific** entry wins, **deterministically and independently of the order** the entries appear in the
   artifact (SC-801).
3. **Given** the seller edits any pre-filled fee, **When** the seal re-derives, **Then** it reads **"ajustado por
   você"** exactly as today — the override always wins over the map.
4. **Given** a category with no sourced entry, **When** resolving, **Then** the seal reads **"sem referência"** and
   nothing is pre-filled — never a neighbouring category's number, never 0%.
5. **Given** any resolved entry, **When** it pre-fills, **Then** its commission is a **sourced** number — an entry
   that would pre-fill 0% under a "referência" seal is impossible (SC-802).

### US3 — Amazon: o mapa completo de categorias, com procedência — **P1**
Every category Amazon publishes in its fee table, with its commission, the **BRL 1,00** per-item minimum, the
plan axis, and the price-banded categories modelled as `priceBands`.

**Acceptance scenarios**
1. **Given** the official Amazon fee table, **When** the map ships, **Then** **every** category published there is
   present, and **no** category that is not published there exists in the catalog (nothing interpolated, nothing
   carried over from a blog).
2. **Given** a category the source publishes with a price threshold (Acessórios Eletrônicos at R$ 100; Móveis and
   Colchões at R$ 200), **When** it ships, **Then** it is modelled as `priceBands` and the calculator picks the band
   by announce price — not flattened to a single percentage.
3. **Given** every Amazon entry, **When** inspected, **Then** it carries `sourceUrl` + `effectiveDate` +
   `lastReviewed`, and the `source` text names the category (so the seller knows when to override).
4. **Given** the seller selects a plan (Profissional / Individual), **When** fees resolve, **Then** the Individual
   plan's per-item charge and the Profissional plan's absence of one are reflected as sourced, with the monthly
   subscription explicitly **out of scope** (it is a monthly cost, not a per-sale one).
5. **Given** Amazon charges commission on a base that includes shipping while our engine charges on the announce
   price (`§8.1`), **When** an Amazon entry is shown, **Then** that limitation is **stated to the seller** in the
   entry's own text — a declared, bounded understatement, never silent (Q9).

### US4 — Atualização mensal automática que abre um PR com o diff — **P1**
Once a month, a job re-reads the sources, rebuilds the map, and — if anything changed — **opens a PR** with a diff a
human can read. It never merges. It never guesses.

**Acceptance scenarios**
1. **Given** a scheduled run where source values changed, **When** it finishes, **Then** it opens **one PR** whose
   description lists **every change as old → new, per category**, with the source URL and the collection date — and
   the PR is **not** auto-merged (ADR-0010 Q-A).
2. **Given** a run where the source cannot be read (page shape changed, render failed, auth expired, network),
   **When** it fails, **Then** it opens **no PR**, leaves the committed artifact **untouched**, and raises an alert.
   **An empty or drastically-shrunk parse is treated as a failure, not as a fee change** (SC-806).
3. **Given** a run that confirms every value unchanged, **When** it finishes, **Then** it behaves per Q7 (a
   `lastReviewed`-only PR that keeps the seals fresh, or no PR at all) — and in **no** case does `lastReviewed`
   advance for a value that was not actually re-verified.
4. **Given** a category that has **disappeared** from the source, **When** the diff is built, **Then** its removal is
   **surfaced in the PR for a human** — it is never silently kept alive under a fresh review date.
5. **Given** the run, **When** it executes, **Then** it uses **0 LLM tokens** — parsing is deterministic (SC-811).

### US5 — Quando o robô falha, o selo conta a verdade — **P2**
The 30-day staleness seal is the app's built-in dead-man's switch. If the monthly loop dies, the user finds out.

**Acceptance scenarios**
1. **Given** the monthly job has not successfully refreshed a value for more than the staleness window, **When** the
   seller sees that fee, **Then** the seal marks it **desatualizada** — the loop's failure becomes user-visible
   without anyone noticing it in a dashboard.
2. **Given** a value that a run verified as unchanged, **When** `lastReviewed` advances, **Then** it advanced because
   the value was **re-read from the source**, not because the job ran.
3. **Given** an offline client whose bundled seed is older than the served catalog, **When** it renders, **Then** the
   seal marks the values **embutida** exactly as today, and the freshness comparison never **reduces** the coverage
   the client already had (SC-805).

### US6 — Mercado Livre: o mapa completo de categorias — **P2 [BLOCKED on Q-D]**
The same map for ML, built from the **sanctioned OAuth path** (`/sites/MLB/categories` to walk the tree +
`/sites/MLB/listing_prices` for the per-category rate by listing type), which requires the **house ML account** —
the same blocker as the parked D1–D4 ingestion.

**Acceptance scenarios**
1. **Given** the house ML account and its OAuth app exist, **When** the ingestion runs, **Then** ML entries carry the
   **exact** per-category Clássico and Premium rates from the API — never the published 10–14% / 15–19% **range**,
   never a blog.
2. **Given** the account does **not** exist, **When** 014 closes, **Then** ML keeps **today's** honest behaviour
   (`entries: []` → "sem referência" + manual override) and the increment still ships (SC-812 / Q2) — the ML story is
   the only thing missing, and it is missing **visibly**, in the spec.
3. **Given** the ML sub-R$ 79 fixed-cost bands (R$ 6,25 / 6,50 / 6,75), **When** modelled, **Then** the published
   band boundaries are used verbatim and **the R$ 50,01–78,99 gap that ML's own page leaves is left as a gap** —
   never interpolated (Q8).
4. **Given** an ML value, **When** shown, **Then** the entry declares which logistics assumption it holds under
   (Q8) — the app has no `logistic_type` axis and must not pretend otherwise.
5. **Given** the ML API's geo-gate, **When** the ingestion runs, **Then** it runs from BR egress per ADR-0010 Part 3
   — the anonymous path is dead (403 PolicyAgent) and is not retried in disguise.

### US7 — ML sem a conta: a linha de base que já temos — **P3 (droppable, conditional)**
The owner's own authenticated session already produced ML facts that need **no** account and **no** API: the
sub-R$ 79 fixed-cost bands. Shipping *only* those would mean an entry that knows the fixed cost but **not** the
commission — which the current seal vocabulary (per-entry, not per-field) cannot express honestly, and which the
current F3 guard does **not** catch at band level (§9.2). **Recommended dropped unless Q11 resolves the per-field
seal**; kept in the brief so the option is a decision, not an oversight.

### US8 — A categoria escolhida acompanha o que o vendedor salva — **P3**
A category chosen in a channel slot is channel **intent**, so it belongs with the other channel intent E5 already
stores. Scope per Q10.

**Acceptance scenarios**
1. **Given** a saved scenario created after 014, **When** reopened, **Then** its category re-resolves at today's
   catalog exactly like the other non-overridden fee slots (the E5 read-time resolver contract, unchanged).
2. **Given** a scenario, kit or **immutable snapshot** created **before** 014, **When** opened, **Then** it renders
   unchanged with no category — absence of a category is a valid, permanent state (SC-809).

---

## 6. Success criteria (measurable, technology-agnostic)

- **SC-801**: When several catalog entries match a slot, the **most specific** one wins, deterministically and
  **independently of entry order** in the artifact — a marketplace catch-all can never shadow a category entry.
- **SC-802**: **No entry can pre-fill a 0% commission under a "referência" seal.** The F3 guard is extended to
  **price bands** (today it only checks the top level: an entry with `commissionPct: null` whose bands also carry
  null commissions passes validation and pre-fills 0% — §9.2). Rejection happens **at parse/boot, loudly**.
- **SC-803**: 100% of shipped values carry `sourceUrl` + `effectiveDate` + `lastReviewed`, and every seal text
  **names the category** the number belongs to.
- **SC-804**: Every value traces to an official source read in this increment. **0** interpolated values, **0**
  aggregator/blog values, **0** values derived from a published *range*. A hole in the source (e.g. ML's
  R$ 50,01–78,99 fixed-cost band) remains a hole in the catalog.
- **SC-805**: A catalog refresh — at any tier (bundled seed / persisted store / served fetch) — **never reduces
  coverage**: no slot that resolved before starts resolving to nothing after.
- **SC-806**: The monthly job **never merges** and **never publishes** on its own; a fetch/parse failure, or a parse
  whose result is empty or shrinks beyond a stated threshold, opens **no PR**, leaves the artifact untouched, and
  alerts.
- **SC-807**: `lastReviewed` advances **only** on actual re-verification against the source; when the loop stops
  working, the existing 30-day staleness seal fires and the seller sees "desatualizada".
- **SC-808**: A seller who does **not** pick a category is never worse off than before 014 (no regression in
  pre-fill, seal honesty, or offline behaviour).
- **SC-809**: All E1–E6 acceptance guarantees pass unchanged — free offline calculator, catalog live-recompute, kit
  D3/D6, snapshot **immutability**, scenario live/frozen, entitlement gate, lapse freeze. Pre-014 saved objects
  render unchanged with no category.
- **SC-810**: The first-render budget holds: bundled-seed size and boot-time validation cost stay within a stated
  budget (numbers set by the arquiteto) — the offline first paint of the free calculator does **not** regress.
- **SC-811**: The monthly refresh consumes **0 LLM tokens** (deterministic parsing), with its cost row in
  `docs/token-ledger.md` if any AI-assisted step is ever added.
- **SC-812** *(if US6 ships)*: 100% of ML values come from the sanctioned OAuth API or the owner's own authenticated
  session — **0** from an anonymous scrape, a stored-session bot, or a third-party aggregator.

---

## 7. Scope boundaries

### IN
- `category` as a real determinant on the lookup + **most-specific-match** resolution + catch-all fallback.
- A **per-slot, optional, search-first category selector** (behavior only; UX → `designer-ux`).
- The **Amazon** category→fee map: per-category commission, BRL 1,00 minimum, plan axis, price-banded categories.
- The **monthly refresh loop**: deterministic, 0-token, PR-with-diff, fail-safe, never auto-merging.
- The **ML** category→fee map **when Q-D unblocks it**, from the sanctioned OAuth path, with the fixed-cost bands and
  their declared assumptions and declared gaps.
- **Strengthened honesty guards**: F3 extended to bands (SC-802), coverage-non-regression (SC-805), verification-only
  `lastReviewed` (SC-807).
- Whatever coverage/delivery split Q1 selects (bundle vs served vs hybrid), including its size/boot budget.

### OUT (guarding the boundary)
- **Any new premium gate.** The catalog stays free and public (§4).
- **Any `pricing-core` formula change**, including modelling Amazon's shipping-inclusive commission base (Q9 — it is
  **declared**, not modelled) and ML's `logistic_type` axis (Q8).
- **A cross-marketplace internal taxonomy** — no invented unified category tree (Q12).
- **Per-account/per-seller fee authorisation** (Shopee OAuth / AliExpress / a seller's own negotiated rates) — still
  the deferred integration increment from E5 Q1.
- **Scraping ML behind a stored seller session** — rejected on fragility + ToS (`§10.2b`).
- **Any value sourced from an aggregator/blog** — refused, and *empirically* refused: the blogs got the 02/03/2026
  ML change wrong in a checkable way (`§7.3`).
- **Shopee** — already curated and category-independent; untouched by this increment.
- **ML freight/free-shipping subsidy** — stays an overridable estimate (ADR-0010 Part 4).
- **Real-time / on-demand fee lookup per calculation** — the cadence is monthly, through a reviewed PR. No live
  per-request marketplace call from the app.
- **A category field on saved catalog products** — Q10 default is *no* (scenarios only).
- **Per-field seals / partial-knowledge entries** — out unless Q11 says otherwise (which also decides US7).

---

## 8. Recommended PR slicing (owner-authorized, slice by slice — the E2–E6 pattern)

- **PR-A — The wire + the guards (US1 + US2, + SC-801/SC-802/SC-805).** `category` becomes a determinant the client
  sends; most-specific-match resolution; the category selector's behavior; the F3-at-band-level extension and the
  coverage-non-regression rule. **Ships with the existing data** (Shopee curated, ML/Amazon empty) and must be a
  **zero-behaviour-change** release for today's users — that is its homologation. *This is the prerequisite
  `us8-fee-proposal.md §10.3` named; every later slice is dead without it.*
- **PR-B — Amazon, mapped and refreshed (US3 + US4 + US5).** The full Amazon map with provenance, plus the monthly
  job that maintains it and the PR-diff review gate. **This is the first slice a seller can feel**, and it is
  **completely independent of the ML blocker** (§9.1).
- **PR-C — Mercado Livre (US6), CONDITIONAL on Q-D.** The OAuth ingestion, BR egress, and the ML map. **If the house
  account is not provisioned when PR-B lands, 014 closes at PR-B** and PR-C becomes a named, dated follow-up — the
  increment does not hang on a dependency it does not control.
- **PR-D (optional) — US7/US8** if Q10/Q11 turn them on.

Rationale: PR-A carries no user-visible feature and is still non-negotiable — it is the wire *and* the guardrails,
and shipping data before guards is how a 0%-under-reference bug reaches production. PR-B is the value delivery. PR-C
is isolated **precisely so** the blocked dependency can slip without stalling anything.

---

## 9. What routes to the arquiteto / `seguranca` (behavioral requirements, not mechanisms)

### 9.1 Why Amazon is architecturally independent of ML (the key structural claim, ~85%)
- **Amazon**: one public page (`G200336920`), JS-rendered → needs a headless browser (Playwright is already a
  devDependency). **No OAuth, no house account, no BR-egress requirement, no cloud infrastructure.** ADR-0010 Part 3
  already blesses this path: *"a scheduled workflow remains fine for non-API curation chores that make no geo-gated
  call"*. It can run in CI today.
- **ML**: OAuth Bearer token + a **house account** + **BR egress** (the API geo-gates non-BR callers) → ADR-0010's
  Cloud Run Job + Cloud Scheduler + Cloud NAT + Secret Manager, i.e. **provisioning**.
  They share only the artifact they write. Nothing about the Amazon path requires anything the ML path is waiting
  for. *Residual risk to verify in the plan round (~65%): whether the Amazon Seller Central page renders the same
  fee table from a **non-BR CI runner** — the `?locale=pt-BR` route was only ever read from a BR session. If it does
  not, the Amazon job also needs BR egress and Q6 collapses into one runtime.*

### 9.2 Three concrete code-level prerequisites found while writing this brief
1. **The wire blocker (already known, `§10.3`)**: `apps/web/src/features/calculator/fee-prefill.ts` `slotDeterminants`
   sends only `listingType` / `plan`. **Hard prerequisite.**
2. **Resolution is first-match-wins, not most-specific-wins (new).** `resolveEntry` matches an entry when *all of the
   entry's* determinants match the lookup, then takes the **first** hit. A catch-all `{plan: "PROFISSIONAL"}` placed
   before `{plan: "PROFISSIONAL", category: "casa"}` **silently shadows every category entry**. The behavioral
   requirement is SC-801; the mechanism (specificity ranking vs. an ordering invariant enforced by test) is the
   arquiteto's.
3. **The F3 guard is top-level only (new).** The confirmation audit's `.refine` requires `priceBands` when
   `commissionPct` is null — but the band schema *also* allows a null `commissionPct` per band, and
   `entryToChannelFees` maps band commission `?? 0`. **An entry with null commission whose bands also carry null
   commissions passes validation and pre-fills 0% under a "referência" seal.** This is exactly the shape a
   fixed-cost-only ML entry (US7) would take. → SC-802.

### 9.3 The coverage/delivery mechanics behind Q1
The client already has a three-tier resolution — **bundled seed → persisted IndexedDB store → served fetch** — and
the whole document is (a) a TypeScript literal in the JS bundle and (b) zod-validated **synchronously at module
load**. Consequences the plan round must size:
- Amazon at ~38 categories × 2 plans ≈ **tens of entries** — bundleable without thinking about it.
- ML's leaf count is **unknown until the tree is walked** (thousands, order-of-magnitude only). *Estimate, explicitly
  labelled as such*: a few hundred bytes per provenance-stamped entry × thousands of leaves × 2 listing types lands
  in the **megabytes** — too large to bundle and too large to zod-parse on the main thread at every boot on a phone.
- **A collapsing hypothesis worth measuring, not assuming (~55%)**: ML rates may be uniform across large subtrees, so
  storing the rate at the highest uniform node could shrink the map by an order of magnitude. **Only the API walk can
  tell** — which means this measurement is itself blocked on Q-D.
- **A refresh must never downgrade coverage (SC-805).** `freshest()` compares only `catalogVersion`; with an
  asymmetric seed (small) and store (large), a newer app build's small seed can out-rank a rich persisted catalog and
  **silently remove** coverage the client already had. Mechanism (merge, coverage-aware adoption, per-marketplace
  versioning) → arquiteto.

### 9.4 Honesty / security posture
- **The Amazon base-of-commission gap** (`§8.1`): Amazon deducts its commission on the total paid by the customer
  **including shipping**; our engine applies it to the announce price. For free-shipping-in-price sellers the two
  coincide; otherwise we **understate** the fee. Direction is known, magnitude is bounded by the shipping charged.
  Recommendation: **declare it in the entry text** (Q9).
- **`seguranca` owns the ML credential path**: refresh token in Secret Manager, rotation-on-use persisted back, least
  privilege, never in repo/env/client, never exposed to the browser (ADR-0010 Part 3). Unchanged, restated because
  014 is the first increment that would actually execute it.
- **The refresh job is a supply chain into a money-facing artifact.** Its PR is the human gate, and the review must
  be able to *read* the diff (hence the old→new table in US4.1) — a 3,000-line machine diff nobody can review is the
  same as auto-merge with extra steps.

---

## 10. Open questions — owner decisions (recommendation + confidence; **none decided here**)

| # | Decision | Options | Recommendation (confidence) |
|---|---|---|---|
| **Q1** ★ | **Coverage vs the offline bundle.** The app bundles the seed and validates it at boot; ML has thousands of leaves. | (a) bundle everything · (b) **hybrid**: Amazon fully bundled + ML delivered by the endpoint into the persisted store, seed carries only a catch-all · (c) curated **top-N** categories offline + server for the tail · (d) collapse the ML tree to uniform-rate nodes, then bundle | **(b) as the frame, with (d) applied to ML once it can be measured** (**~70%**). (b) reuses the **existing** seed→store→fetch machinery with **no new client architecture**, keeps the bundle small, and preserves offline honesty (an uncovered offline category → "sem referência", never a wrong number). (a) is fine for Amazon alone and impossible for ML. (c) requires picking N by guessing what our sellers list under — we have no usage data, so it is a guess dressed as curation. **This question is only load-bearing for ML**; if Q2/Q3 make 014 Amazon-only, (a) answers it trivially. |
| **Q2** ★ | **Does 014 ship without Mercado Livre?** | (a) **yes** — Amazon-only DoD; ML is a conditional slice that lands when unblocked · (b) no — 014 waits for ML | **(a)** (**~90%**). Making the increment all-or-nothing on a dependency the team does not control is how work parks for months (D1–D4 has been parked on exactly this since E1). Amazon is independently valuable, independently buildable, and independently refreshable (§9.1). ML's absence stays **visible** in the spec, not hidden. |
| **Q3** ★★ | **Provision the house ML account + OAuth app now?** It is the same Q-D blocker as D1–D4, open since ADR-0010 (2026-07-06). | (a) provision now, in parallel with spec work · (b) keep parked; 014 ships Amazon-only and ML waits · (c) provision later, at the first deploy | **(a)** (**~75%**) — **and this is the decision to make first**, because it is the only one with **external lead time** (account + app approval happen outside the repo) and because it determines whether 014 is a 2-slice or a 4-slice increment, which coverage model matters (Q1), and where the job runs (Q6). It also unblocks D1–D4. It is your cost and your time, so the confidence is in the *leverage*, not in the effort being small. |
| **Q4** | **Is the category map free or premium?** | (a) **free** (it is part of the free calculator) · (b) premium | **(a)** (**~85%**). It is not really a product choice: the catalog is bundled in the client and served unauthenticated by design (ADR-0010 R3/FR-117). You cannot gate what ships in the bundle, and gating the endpoint breaks the offline guarantee the free calculator rests on. Putting it to you anyway — it is your boundary. |
| **Q5** | **What happens when the seller picks no category?** | (a) pre-fill the marketplace's **own published catch-all** (Amazon "Outros" 15%) with a seal that says *"categoria não informada — usando 'Outros'"* · (b) pre-fill **nothing** ("sem referência", today's behaviour) until a category is picked | **(a)** (**~65%**, genuinely two-sided). (a) is conservative on money — the catch-all is Amazon's **highest** tier, so it over-estimates the fee and protects the margin — and it is a *published* value, not a derived one. (b) is conservative on honesty: no number at all can never be a wrong number. If you weight "the app never shows a rate that is not this seller's rate" above "the app is useful before he picks", choose (b). |
| **Q6** | **Where does the monthly job run?** | (a) **both, split**: Amazon on a scheduled CI workflow (no geo-gate, no infra, works today) + ML on the ADR-0010 Cloud Run Job when Q-D lands · (b) everything on the Cloud Run Job (one runtime, needs provisioning first) · (c) everything in CI (**breaks ML** — non-BR runners fail the geo-gate) | **(a)** (**~80%**). ADR-0010 Part 3 already anticipated exactly this split. (c) is not an option for ML — ADR-0010 measured that. (b) is cleaner operationally but couples the Amazon refresh to provisioning it does not need. **Verify first** (§9.1): that a non-BR runner really does render the Amazon fee table. |
| **Q7** | **The no-change run** — what does a month with zero fee changes produce? (The PR-with-diff / never-auto-merge policy itself is **already decided**: ADR-0010 Q-A. Only this sub-case is open.) | (a) open a **`lastReviewed`-only PR** — one-line merge, keeps every seal fresh, proves the loop is alive · (b) open **nothing** — the seals go "desatualizada" after 30 days even though the values were verified | **(a)** (**~75%**). The seal claims *"reviewed on this date"*; a verified-unchanged value **was** reviewed, and saying otherwise is its own small dishonesty. The cost is a trivial monthly merge, and the merge is a **liveness signal** — a month with no PR at all means the loop broke. (b) is defensible if you would rather see fewer PRs and treat staleness as the only signal. |
| **Q8** | **ML's sub-R$ 79 fixed cost** (R$ 6,25 / 6,50 / 6,75) — it applies only to Flex / seller's own logistics / pickup, and the app has no logistics axis. | (a) don't model it · (b) **model it and declare the assumption** in the entry text · (c) add a `logistics` determinant (a third axis + more picker surface) | **(b)** (**~60%**). This is the biggest per-unit money effect we found (§2.3) and the seller who ships it himself — our typical user, ~70% inference — is exactly the case it covers. (c) is the *correct* model and a materially bigger increment; revisit if sellers report the mismatch. **Non-negotiable in any option**: ML's own page leaves R$ 50,01–78,99 uncovered, and that gap **stays a gap**. |
| **Q9** | **Amazon's commission base includes shipping; ours does not.** | (a) **declare** the limitation in the entry text; do not model · (b) model it (a `pricing-core` change to the commission base) | **(a)** (**~80%**). (b) touches the pricing domain — a `pricing-core` version bump plus the ADR-0022 escalation — for a **bounded, known-direction** understatement that is **zero** for sellers who price shipping in (very common in 3D printing). Declare it, revisit if it bites. |
| **Q10** | **Does the chosen category persist into saved objects?** | (a) **scenarios yes, products no, snapshots inherit whatever their payload had** · (b) everywhere, including a category field on catalog products · (c) nowhere — transient, per calculation | **(a)** (**~70%**). A category is **channel intent**, which is precisely what E5 scenarios already store (ADR-0021 JSONB); adding an optional field there is the natural home and stays backward-compatible (absent = today). (b) makes a category a *product* attribute, which it is not — the same product sells in different categories on different channels. **In every option, E4 snapshot immutability is untouched and pre-014 objects must render unchanged (SC-809).** |
| **Q11** | **Partial-knowledge entries / per-field seals** — do we allow an entry that knows one fee and not another (the ML fixed-cost-only case, US7)? | (a) **no** — an entry is sourced completely or it does not ship · (b) yes, with **per-field** seals (a schema + seal-vocabulary + designer-ux change) | **(a)** (**~75%**). Today's seal is **per-slot**, so a half-known entry would seal the unknown half as "referência" too — the exact 0%-under-reference trap (§9.2). (b) is a legitimate future refinement and a real increment of its own. Choosing (a) also **drops US7**. |
| **Q12** | **Category vocabulary** — one internal taxonomy mapped onto both marketplaces, or each marketplace's own list? | (a) **each marketplace's own published categories**, verbatim · (b) a unified internal taxonomy with a mapping table | **(a)** (**~85%**). A cross-marketplace mapping has **no honest source** — we would be authoring an opinion about which ML leaf equals which Amazon row and then billing money against it. (a) also means the picker shows the seller the same words he sees on the marketplace. i18n note: these strings are **third-party data, in pt-BR from the source** — they are *not* app copy and must not be routed through the i18n layer as if they were. |

★ = shape-gating · ★★ = **answer this one first**

---

## 11. Dependencies

- **ADR-0010** — the fee-catalog architecture this increment finishes: the 1B snapshot shape (whose
  `determinantsSchema` *already* declares `category` for ML and Amazon), the endpoint + persisted store + mandatory
  bundled seed, the 30-day staleness seal, **Part 3's Cloud Run Job + BR egress + Secret-Manager house account
  (Q-D)** and its **PR-write policy (Q-A)**. 014 adds data and a category axis; it should not need to amend the ADR
  — if it does, that amendment is the arquiteto's call at the plan round.
- **013 / `specs/013-audit-remediation/us8-fee-proposal.md` §7–§10** — three rounds of sourcing plus the owner's
  authenticated capture. **This is the research budget already paid; do not re-run it.** Visual evidence in
  `specs/013-audit-remediation/evidence/us8/`.
- **`specs/audit-confirmation/AUDITORIA-CONFIRMACAO.md` F3** — the `fee-catalog.ts` `.refine` guard added
  *specifically* to protect this increment's curation. 014 **strengthens** it (SC-802); it never weakens it.
- **E1 / 005** — the calculator's channel slots, the fee seal vocabulary (referência / ajustado por você / sem
  referência / embutida / desatualizada) and `pricing-core`'s band + minimum handling, all reused unchanged.
- **E5 / ADR-0021** — the scenario JSONB channel intent, the natural home if Q10 = (a).
- **E4 / ADR-0019** — snapshot immutability: pre-014 frozen payloads must keep rendering with no category, forever.
- **D1–D4 / Q-D** — the parked ML ingestion work shares the blocker Q3 would clear; unblocking one unblocks both.
- **E7 (Android/Play packaging)** — untouched by 014, but it raises the stakes of Q1: after packaging, an
  endpoint-delivered catalog updates fees **without a store release**, while a bundle-only catalog does not
  (ADR-0010's 2026-07-06 amendment rationale).

---

## Decisões do dono — rodada 1 (2026-07-24)

### Q3 — provisionar a conta ML da casa + app OAuth: **SIM, começa agora**
Decisão do dono. É a única com prazo EXTERNO (criação de conta + aprovação do app do ML acontece
fora do repo), então corre em paralelo ao spec. Consequências: o 014 mira as 4 fatias (PR-A wire →
PR-B Amazon+loop → PR-C ML), e o D1–D4 (ingestão ML, parado desde 2026-07-06 no mesmo bloqueio)
destrava junto. **Mantém-se o desenho de contingência**: se a conta não existir quando o PR-B
fechar, o 014 fecha no PR-B com valor real shipado (Amazon completa + loop mensal). Amazon NUNCA
depende do ML — sem OAuth, sem conta, sem egress BR.

### Q1 — cobertura × bundle: **NEM embarcado-completo NEM catch-all — é FETCH-E-PERSISTE**
Decisão do dono, e é um modelo distinto das 3 opções oferecidas:

> No primeiro momento (login / abertura do app), o app CHAMA as APIs de Amazon e ML e deixa salvo na
> aplicação. O que se salva por categoria é enxuto — **a categoria + sua árvore de pais/filhas + a
> taxa dela**. Mesmo sendo uma lista grande, como são poucos dados por categoria, o volume não é
> problema.

Encaixa no mecanismo EXISTENTE (`store persistido → seed → refresh do endpoint`, ADR-0010 Part 2):
não é arquitetura nova, é estender o payload e o momento do fetch. O bundle NÃO cresce com a árvore.

**Duas consequências derivadas (recomendação registrada; o dono corrige se discordar):**

1. **Procedência migra para o nível do MARKETPLACE/catálogo.** O schema hoje exige
   `sourceUrl`/`effectiveDate`/`lastReviewed` por ENTRADA (truth-gate do Princípio II — o teste falha
   o build sem isso). Repetir por milhares de categorias é exatamente o peso a evitar. Recomendação:
   procedência por marketplace + data da coleta da rodada mensal; a entrada carrega identidade
   (categoryId + path da árvore) + taxa. Preserva o SIGNIFICADO do truth-gate (todo número tem origem
   rastreável e datada) sem inflar o payload. **Isto altera `feeEntrySchema` → é mudança de contrato,
   precisa entrar no plan + provavelmente um amendment do ADR-0010.**
2. **Piso do primeiro uso offline (R1).** Hoje o seed embarcado garante catálogo na PRIMEIRA
   renderização sem rede. No modelo fetch-e-persiste, antes do primeiro fetch não haveria nada.
   Recomendação: manter um seed mínimo **só com o catch-all por marketplace** (poucos KB) como piso —
   quem abre offline pela primeira vez vê "sem referência" honesto, nunca tela sem dado nem número
   errado; a árvore completa chega no primeiro online. R1/R2 do ADR-0010 preservados.

**Aberto para o /speckit-clarify**: Q2, Q4–Q12 do §Decisões, mais o momento exato do fetch ("ao
logar ou abrir o app" — toda abertura? com TTL? só quando o `catalogVersion` mudar?) e o critério de
frescor, que hoje é `freshest()` por `catalogVersion` e tem o bug de cobertura (SC-805) já mapeado.
