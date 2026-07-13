# Feature Specification: E4 — Histórico + snapshots reproduzíveis + export

**Feature Branch**: `feature/009-e4-history-snapshots-export`

**Created**: 2026-07-12

**Status**: Draft

**Input**: User description: "E4 — Histórico + snapshots reproduzíveis + export. Scope modeled by the
product-owner and homologated by the owner in `docs/product/e4-scope-brief.md` (vision, US1–US7, SC-501..512,
IN/OUT boundaries, dependencies, and §0 with the owner decisions of 2026-07-12). The Catálogo (E2/E3) shows
what a thing is worth TODAY (live recompute + honest degradation); the Histórico (E4) proves what the seller
CHARGED. Master rule: a snapshot cannot degrade because it does not REFERENCE the catalog — it CONTAINS the
values."

> **Why now.** E1 shipped the free single-piece calculator; E2 the persisted catalog + the server-authoritative
> premium gate; E3 the multi-piece Kits. All three are **live**: they answer *"quanto isso custa **hoje**?"*.
> Nothing in the product answers *"quanto eu **cobrei**, naquele dia, daquele cliente?"* — and that is exactly
> where the seller gets burned: *"cotei R$ 187 na semana passada, mandei no WhatsApp, o cliente voltou pra
> fechar; só que o filamento subiu, eu editei o catálogo, e agora o app me mostra R$ 203. Qual dos dois eu
> prometi?"* E4 adds the second shelf: an **immutable Histórico** of price events the seller deliberately
> recorded — each a frozen, reproducible snapshot — plus the **export** of that snapshot as a quote the
> customer can read. In one line: **o Catálogo mostra o que vale hoje; o Histórico prova o que você cobrou.**

## The two-shelf rule (the centerpiece — resolves the E2/E3 tension)

E2 and E3 deliberately chose **live recompute + honest degradation to last-known** (ADR-0017 §6). A snapshot is
the opposite **by nature**. Both are correct — they answer different questions. E4 makes the difference an
explicit product rule, not an accident:

| | **Catálogo / Kits (E2, E3)** | **Histórico (E4)** |
|---|---|---|
| Answers | "quanto custa **hoje**?" | "quanto eu **cobrei** em 03/07?" |
| Object | reusable **template** (live) | recorded **event** (frozen) |
| On reopen | **recomputes** with current formula + references | **never recomputes** — renders stored values |
| Reference edited | price changes (D3 live-reflect) | **nothing changes** |
| Reference deleted | degrades to last-known + honest caption (D6) | **nothing changes** — a snapshot has no degraded state, because it depends on nothing |
| Editable | yes | **contents never**; label only; deletable by its owner |
| Carries a date | no | **always** — the date is part of the claim |

**Why a snapshot cannot degrade**: it does not *reference* the catalog for values — it **contains** them
(ADR-0008 freezes `PRICING_MODEL_VERSION` + inputs + rounded line values). Catalog links kept on a snapshot are
**provenance only** ("originou-se do produto Vaso G"), never a value source. A dangling provenance link MUST
never alter, break, or degrade a snapshot.

## Clarifications

### Session 2026-07-12 (owner decisions — Principle VIII)

Recorded from `docs/product/e4-scope-brief.md` §0. Question numbers are the brief's, kept for traceability.
Two of the four **override** the product-owner's recommendation — the reasoning is recorded because the
divergence matters later.

- **Q3 / A29 — formula-version UX for a saved quote: LABELED + "RECALCULAR HOJE".** A snapshot displays *when*
  it was calculated and *with which formula version*; a "Recalcular hoje" action produces a **new** snapshot
  from the same inputs at today's values, leaving the original untouched. This **closes A29**
  (`docs/decisions/audit-findings-r2.md`, open since 2026-07-02 and explicitly reserved for E4).
- **Q6 — export does NOT survive a premium lapse** (*overrides* the PO's recommendation, which the PO itself
  scored as genuinely close at 65%). A lapsed account keeps its snapshots **readable in-app** — the E2/E3
  read-only freeze is unchanged — but the **export action is denied**. Rationale: export is E4's headline
  premium value, and "lapsou ⇒ read-only no app, sem export" is a harder and simpler rule to explain than a
  read/write hair-split.
- **Q7 — export stays Premium, full stop.** No free export of the ephemeral (unsaved) calculation. The standing
  `business-rules.md` R3 split is unchanged. The conversion tension the PO flagged — *the single strongest
  upgrade moment in the product is a free user who just computed a price and wants to send it to a client* — is
  **consciously accepted**, not overlooked. The standing rule (`business-rules.md` §Freemium boundary, revised
  Round 3, 2026-06-29: *"saving calculations, catalog, history and export are all Premium"*) is unchanged;
  changing it later = a dated business-rules amendment.
- **Q13 — seller identity on an exported quote: ACCOUNT NAME + E-MAIL ONLY** (*overrides* the PO's
  recommendation of an optional "Nome do negócio" field, 80%). **Zero new seller data in E4.** Accepted
  consequence, stated openly: the exported quote carries the seller's **personal login e-mail** and no business
  name. The real gap the PO surfaced — **nothing in E1–E3 models the seller** — stays **deliberately open**
  rather than being closed mid-epic; it is a candidate for its own small increment.

### Session 2026-07-12 (`/speckit-clarify` — owner answers)

- Q: Q2 — is a kit (multi-piece) recordable as a snapshot from PR-A, or single-piece first? → A: **Both from
  PR-A** (confirms the working default). The frozen payload in the first slice must therefore carry kit lines
  and the per-channel rollup, not just a single piece.
- Q: Q5 — export formats? → A: **PDF (quote) + CSV (history); a public shareable link stays OUT** (confirms the
  working default, and matches `business-rules.md`, which already names "Export / share (PDF / CSV)").
- Q: Q8 — does recording require a connection, or is it queued offline? → A: **OFFLINE QUEUE that syncs later**
  — **this FLIPS the working default** (the PO recommended online-only at 80%). The seller **at a fair, offline,
  quoting in person** is a persona the product will serve: recording works offline, is held locally, and
  synchronizes when connectivity returns.
- Q: With an offline queue, which clock stamps the snapshot's date (the date **is** the claim)? → A: **The
  device clock only.** The date shown in-app and on the exported quote is the one captured on the device at
  record time. **Accepted trade-off, recorded openly:** the server accepts a timestamp it **cannot verify** — a
  wrong or manipulated device clock yields a snapshot with a wrong date, and there is no server-side
  received-at to audit against. (The dual-date alternative — device "cotado em" + server "registrado em" — was
  offered and declined.) The plan and the security review must treat this as a **known, owner-accepted
  integrity limitation**, not as an oversight to fix silently.
- Q: NEW (not among the nine) — in a **kit** quote sent to the customer, what appears? → A: **The kit's items
  (name + quantity) plus the total**, still with **zero** internal cost lines. An opaque "Kit — R$ 500" was
  declined.

### Session 2026-07-12 (plan round — owner decisions on the architecture questions)

Raised by the `arquiteto` + `dev-estrutura-de-dados` Phase-0 round (see `research.md`, `data-model.md`) and
decided by the owner. All four followed the specialists' recommendation.

- **"Recalcular hoje" re-resolves the origin** (FR-505, rewritten above): it reprices from **today's catalog
  values**, not merely the frozen inputs under a newer formula. The alternative could never answer "sim" to a
  filament price rise, leaving US7 structurally unable to do its job.
- **DB-enforced immutability APPROVED** — a `BEFORE UPDATE` trigger, the **project's first PL/pgSQL** (E2 had
  promised "tables/CHECK/RLS only"). This is what makes SC-504 ("**0** write paths can alter a snapshot")
  demonstrable **in the database** rather than "we did not write the code that breaks it", and what protects the
  epic's central promise against **future** code (E5/E6 will write near this table). ADR-0019.
- **Export is online-only, and that is accepted** (ADR-0020): the artifact is **server-rendered** behind an
  active-entitlement gate, so FR-515 ("denied on lapse, no partial artifact") holds **by construction** instead
  of being a client route-guard over data a lapsed user legitimately holds on the device. Consequence accepted
  and to be stated plainly in the UI: **export requires a connection**, and a still-**pending** snapshot cannot
  be exported until it syncs. *(Note the deliberate asymmetry the owner chose: recording works offline for the
  seller at a fair; exporting does not.)*
- **A row-metadata `created_at` is kept**, bound by three rules — never displayed, never exported, never used to
  order or to validate the device date. This also **corrected FR-528**, which had claimed an unachievable
  property (see the correction note on FR-528).

**Recorded honestly for the security review, not buried:** E4 is the **first time client-computed money is
persisted** — E2/E3 store inputs and never a price. The server **cannot verify** those values (by design it has
no engine — ADR-0008). Acceptable today (a snapshot is the seller's assertion about their own quote, readable
only by them — they can only lie to themselves). What it **constrains**: any future feature treating a snapshot
as proof *toward a third party* (fiscal export, dispute, marketplace integration) would require server-side
verification and would **reopen ADR-0008**.

### Working defaults — status after `/speckit-clarify`

The nine defaults carried the product-owner's recommendation (confidence in parentheses). Three were put to the
owner above; the remaining six stand as **declared defaults** and are written into the requirements below.

| # | Status | Rule |
|---|---|---|
| **Q1** | default (85%) | **Explicit capture** — a price enters the Histórico only via a deliberate "Salvar no histórico" action; never auto-captured (the calculator recomputes on every keystroke — auto-capture would record noise, not quotes). |
| **Q2** | ✅ **CONFIRMED** | **Both single-piece and kit recordable from PR-A** — the multi-piece order *is* what sellers actually quote. Cost accepted: a bigger frozen payload in the first slice. |
| **Q4** | default (90%) | **Two artifacts; customer-facing by default** — the internal cost breakdown (material/energy/machine/failure/margin) is **omitted unless the seller explicitly opts in**. Leaking margin to the seller's client is a product-level harm. |
| **Q5** | ✅ **CONFIRMED** | **PDF (quote) + CSV (history)**; a **public shareable link is OUT** of E4 — a new unauthenticated surface with LGPD/expiry/abuse questions deserves its own increment. |
| **Q8** | 🔄 **FLIPPED** | **Offline queue** — recording works offline and syncs later (see the clarify session above). The snapshot's date is the **device clock**, with the integrity trade-off accepted on the record. |
| **Q9** | default (75%) | **Label + validity period** — "validade: 15 dias". A quote without an expiry is a promise with no deadline. A client *registry* stays OUT. |
| **Q10** | default (90%) | **Never auto-delete** — no TTL, no cap. |
| **Q11** | default (75%) | **Quote status (enviado/aceito/recusado) is OUT of E4** — a pipeline/CRM lifecycle would contradict an epic whose whole point is immutability. Strong backlog candidate. |
| **Q12** | default (90%) | **Recording materializes nothing** — the explicit contrast with E3's K3. A record must not mutate the world it describes. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a price as a frozen snapshot (Premium) (Priority: P1) [FOUNDATIONAL]

A **premium** seller who has just computed a price — a single piece or a whole kit (Q2) — explicitly records it
in the Histórico with an optional label (client name / order reference). The entry freezes the **inputs**, the
**rounded output lines and totals exactly as displayed**, the **formula version** and the **timestamp**. It is
persisted server-side, behind the E2 entitlement gate.

**Why this priority**: This is the capability E4 exists to deliver; every other story (consult, immutability,
export, teaser) is built on the recorded entry. Unlike E3 — where a free-standing composer had value before
persistence — a Histórico with nothing in it is worthless, so E4's first slice **is** the server slice.

**Independent Test**: A premium account computes a price, records it with a label, and finds it on a fresh
session/device showing label · total · date; reopening renders the stored breakdown with no recomputation. A
free/signed-out caller is denied server-side and nothing is written.

**Acceptance Scenarios**:

1. **Given** a premium user with a computed result, **When** they record it with a label, **Then** the entry
   persists and appears in the Histórico on a fresh session/device, showing label, total and date.
2. **Given** a recorded snapshot, **When** it is reopened, **Then** it renders the **stored** breakdown —
   byte-identical to what was displayed at record time — with **no recomputation** of any line.
3. **Given** a free or signed-out caller, **When** any record/list/read operation is called, **Then** the server
   denies with `ENTITLEMENT_REQUIRED`, nothing is written or read, and the client's local state is never
   trusted.
4. **Given** a recorded snapshot, **When** the account's catalog is inspected, **Then** **nothing was
   materialized** — no product, no kit, no catalog change (Q12; the explicit contrast with E3's K3).

---

### User Story 2 - Consult the Histórico (list, open, offline read) (Priority: P1)

The Histórico tab — today an honest "em breve" placeholder — becomes the seller's ledger: entries newest-first,
each showing label · total · **date**, opening into the frozen detail. Readable offline after one online load;
purged from the device on sign-out.

**Why this priority**: Recording without consulting is a write-only feature. US1 + US2 together are the minimum
coherent Histórico.

**Independent Test**: With several snapshots saved, open the Histórico → they list newest-first with date on
every card; go offline → they stay readable; sign out → the local cache is purged; sign in as another account →
none of them are visible.

**Acceptance Scenarios**:

1. **Given** several snapshots, **When** the Histórico is opened, **Then** they list newest-first with label,
   total and date; **every** card carries its date (never a live-looking price).
2. **Given** a premium account that loaded the Histórico online once, **When** the device goes offline, **Then**
   snapshots remain **readable** from the local cache, and a **new recording is queued** and shown as visibly
   pending until it syncs — never claiming to be saved before it is, never silently dropped (Q8, FR-527).
3. **Given** account A's snapshot, **When** account B is signed in, **Then** B can neither read nor modify it,
   and it is indistinguishable from non-existent (no existence oracle).
4. **Given** a sign-out, **When** it completes, **Then** the local history cache is purged (the existing
   uid-keyed purge-on-signout pattern).

---

### User Story 3 - A snapshot never changes; recalculating creates a new one (Priority: P1)

The reproducibility contract, made visible. Catalog churn **cannot rewrite history**: editing or deleting a
filament, printer, product or kit that a snapshot came from changes **nothing** about that snapshot — no new
value, no degraded caption, no warning. The snapshot honestly shows *when* it was calculated and with *which
formula version*; "Recalcular hoje" creates a **new** entry.

**Why this priority**: This is the promise the whole epic sells. It is also where the risk lives: E2 and E3
trained the codebase (and the reader) to expect live-reflect + degradation, and E4 must do the exact opposite
here without contradicting them.

**Independent Test**: Record a snapshot from product P; edit P's filament cost → the snapshot's numbers are
unchanged; delete P → the snapshot stays fully intact and readable, with **no degraded state and no "produto
excluído" claim**; hit "Recalcular hoje" → a **new** entry appears and the original is untouched.

**Acceptance Scenarios**:

1. **Given** a snapshot taken from product P, **When** P's filament cost is edited, **Then** the snapshot's
   values and total are **unchanged** on reopen.
2. **Given** a snapshot taken from product P, **When** P is deleted, **Then** the snapshot stays fully intact —
   **no degraded state, no last-known caption, no warning** (it never depended on P); the origin's **captured
   name** still displays (it is what the thing was called then) and "abrir produto" is simply **not offered** —
   no broken link, no removal claim.
3. **Given** a snapshot, **When** it is opened, **Then** it displays honestly *when* it was calculated and with
   *which formula version* (Q3/A29).
4. **Given** a snapshot, **When** the user chooses "Recalcular hoje", **Then** a **new** snapshot is created
   from the same inputs at today's values/formula, and the original entry is **not modified**.
5. **Given** a snapshot recorded under an older formula version, **When** the current formula has additional
   breakdown lines, **Then** the snapshot renders **only the lines it recorded** — never a fabricated zero line.

---

### User Story 4 - Export a snapshot as a quote the customer can read (Premium) (Priority: P1)

The seller sends the customer a readable quote (PDF) and keeps their own bookkeeping export (CSV) (Q5). **The
customer never sees the seller's internal cost breakdown** unless the seller explicitly opts in (Q4) — this is
a business-confidentiality guarantee, not a preference. The quote identifies the seller by the account's name
and e-mail (Q13).

**Why this priority**: Export is the reason a Histórico entry leaves the app and reaches a customer — the
epic's headline premium value. It is P1 in value but **last in sequence**: it is the only slice that can be
deferred without leaving the product incoherent.

**Independent Test**: A premium user exports a snapshot → the artifact carries item(s), quantity, price, date
and the seller's identification, and contains **zero** internal cost lines; enable "incluir detalhamento de
custos" → and only then the breakdown appears. A lapsed account is denied the export (Q6). A free/signed-out
user meets the honest teaser and **no artifact is produced**.

**Acceptance Scenarios**:

1. **Given** a premium user on a snapshot, **When** they export it as a customer-facing quote, **Then** the
   artifact contains the item(s), quantities, the price, the date, the validity period (Q9) and the seller's
   identification (account name + e-mail, Q13), and **omits** material/energy/machine/failure/margin lines.
2. **Given** the export options, **When** the seller explicitly enables "incluir detalhamento de custos",
   **Then** and only then the internal breakdown appears in the artifact.
3. **Given** a premium user, **When** they export the history as a data file, **Then** the exported rows equal
   the stored snapshots **exactly** (same values, same rounding, same dates) — no re-derivation, no drift.
4. **Given** a **lapsed** premium account, **When** it attempts any export, **Then** the export is **denied**
   honestly while the snapshots remain readable in-app (Q6 — owner decision).
5. **Given** a free or signed-out user, **When** they meet any export affordance, **Then** they get the honest
   teaser (US5) — **no artifact is produced**, no fake success, and no free export of the ephemeral calculation
   (Q7 — owner decision).

---

### User Story 5 - Honest teaser for Histórico + Export (free / signed-out) (Priority: P2)

Every free-facing affordance ("Salvar no histórico", the Histórico tab, "Exportar") is **visible** and opens an
honest Premium notice — no price, no availability date, no fake "salvo!", no pre-E6 purchase CTA. The free
single-piece calculator stays **fully free, offline and untouched**.

**Why this priority**: The whole epic is Premium, so it needs an honest door for everyone else. It must ship
with the first slice (E2 US7 / E3 US5 lineage).

**Independent Test**: Signed out or free, open the Histórico tab → an honest explanation, never a broken list
and never a fabricated sample entry; tap "salvar"/"exportar" → the honest teaser, nothing persists, nothing is
generated.

**Acceptance Scenarios**:

1. **Given** free/signed-out, **When** the Histórico tab is opened, **Then** it explains the premium value
   honestly (never a broken list, never a fabricated sample entry).
2. **Given** free/signed-out, **When** any "salvar no histórico" / "exportar" affordance is tapped, **Then** the
   honest teaser appears, nothing persists, nothing is generated, no success is faked.
3. **Given** the teaser copy, **When** reviewed, **Then** it promises no price and no availability date.

---

### User Story 6 - Manage the Histórico + lapse policy (Priority: P2)

Label / re-label, search by label, filter by date range, delete — per-account and isolated. On premium lapse:
**read-only freeze**, exactly like E2/E3 — snapshots stay readable, **nothing is auto-deleted**, writes are
denied, and **export is denied too** (Q6).

**Why this priority**: Management is what keeps a growing ledger usable, but it only matters once entries exist
(US1/US2), and the lapse rule must match E2/E3 for a coherent product.

**Independent Test**: With many snapshots, search by label and filter by period → the right entries are found;
edit a label → it persists, while the entry's **contents** stay non-editable; revoke premium → entries readable,
every write denied, export denied, nothing deleted; re-grant → writes and export restored with data intact.

**Acceptance Scenarios**:

1. **Given** saved snapshots, **When** the owner edits a label or deletes an entry, **Then** the change persists
   per-account; the snapshot's **contents** remain non-editable (only the label is).
2. **Given** a lapsed account, **When** it opens the Histórico, **Then** entries are readable, **zero** writes
   succeed, **export is denied**, and no entry is deleted by the lapse; re-grant restores writes and export with
   data intact.
3. **Given** many snapshots, **When** the seller searches by label or filters by period, **Then** the matching
   entries are found without the list becoming unusable.

---

### User Story 7 - Compare a snapshot with today's cost (Priority: P3) [DROPPABLE]

*"Meu custo subiu desde que cotei?"* — the snapshot detail can show, side by side, the frozen total and today's
recomputed total for the same inputs, labelled unambiguously as *"cotado em {data}"* vs *"hoje"*. Purely
informational: recording the new number is still the explicit "Recalcular hoje" action (US3.4).

**Why this priority**: A genuine insight, but the epic is coherent without it. **Explicitly droppable** if it
endangers the export slice — cut this before cutting US4.

**Independent Test**: On a snapshot whose inputs still resolve, request the comparison → both totals appear with
unambiguous labels and dates, and the frozen entry remains unmodified.

**Acceptance Scenarios**:

1. **Given** a snapshot whose inputs still resolve, **When** the comparison is requested, **Then** both totals
   are shown with unambiguous labels and dates, and the frozen entry remains **unmodified**.

---

### Edge Cases

- A snapshot whose **provenance product/kit was deleted**: the entry must stay whole and honest — captured name
  shown, "abrir produto" absent, **no** degraded caption and **no** removal claim. (The inverse-honesty trap E3
  hit in PR-C: a correct component starved of correct data still lies — here the failure would be a snapshot
  quietly rendering as if it were live.)
- A snapshot recorded under an **older formula version** rendered by a UI that now knows more breakdown lines —
  render only what was recorded; never a fabricated zero.
- **Recording offline** (Q8 — the product's **first offline write**): the entry is queued and visibly pending;
  it must never claim to be saved before it is, and never be silently dropped.
- **Queued entry whose sync is denied** (premium lapsed or revoked between recording and syncing): the denial is
  honest and visible; the entry is not silently discarded (FR-529).
- **Sign-out with a non-empty queue**: what happens to snapshots recorded offline but never synced must be
  honest — they must not vanish silently, nor leak into the next account (routed to the plan).
- **Device clock wrong or skewed** (FR-528): the snapshot carries a wrong date and the server cannot detect it.
  Accepted; list ordering (newest-first) likewise depends on the device clock.
- **Sign-out with cached history**: the local cache is purged; another account never sees the previous one's
  entries.
- A **very large history** (hundreds of entries): the list stays usable; pagination/indexing is an engineering
  concern, not a product cap (a cap would be a business-rules amendment, never a silent limit).
- **Lapse mid-session** while an export is in flight — the denial must be honest and produce **no partial
  artifact** (Q6).
- **Export of a kit snapshot** with many lines — the customer-facing artifact stays readable and still omits
  internal costs.
- **Two snapshots recorded seconds apart** from the same inputs — both exist independently (a record is an
  assertion, not a deduplicated cache).
- **Clock / timezone**: the recorded date is part of the claim; it must be unambiguous to the seller and on the
  exported quote.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-501**: A price MUST enter the Histórico **only** through a deliberate, explicit recording action; the
  system MUST NOT auto-capture computed prices (Q1).
- **FR-502**: A recorded snapshot MUST freeze, at record time: the **inputs**, the **rounded output lines and
  totals exactly as displayed** (per channel where applicable), the **formula version**
  (`PRICING_MODEL_VERSION`) and the **timestamp**. Reopening it MUST render the **stored** values with **zero
  recomputation** of any line.
- **FR-503**: A snapshot MUST **contain** its values, never **reference** the catalog for them. Editing or
  deleting any catalog entity the snapshot originated from MUST change **0%** of the snapshot and MUST NOT
  produce any degraded state, last-known caption or warning on it. Catalog links on a snapshot are
  **provenance only** (informational); a dangling provenance link MUST NOT alter, break or degrade the
  snapshot — the captured name still displays, and the "open origin" affordance is simply absent (never a
  "produto excluído" claim, never a broken link).
- **FR-504**: A snapshot's **contents MUST be immutable**: no write path may alter its recorded inputs, values,
  formula version or timestamp. Only its **label** is editable; the whole entry is deletable by its owner.
- **FR-505** (semantics settled in the plan round, 2026-07-12): "Recalcular hoje" MUST create a **new** snapshot
  and MUST leave the original entry unmodified (Q3/A29). It **re-resolves the origin** — it reprices using the
  **catalog's values as they are today** (product / filament / printer), not merely the frozen inputs under a
  newer formula. *Rationale: "meu custo subiu desde que cotei?" is the question the seller is actually asking;
  repricing frozen inputs could never answer "sim" to a filament price rise, which would leave US7 structurally
  unable to do its job.* Where the origin **no longer resolves** (deleted product/kit), the recalculation is
  offered honestly from the frozen inputs, and the app says so plainly — it MUST NOT silently present a
  frozen-input reprice as a catalog-current one.
- **FR-506**: A snapshot MUST display *when* it was calculated and *with which formula version* on its detail
  surface (Q3/A29 — closes A29).
- **FR-507**: A snapshot recorded under an older formula version MUST render **only the lines it recorded** —
  never a fabricated zero line for a breakdown line that did not exist then.
- **FR-508**: Recording a snapshot MUST materialize **nothing** in the catalog — no product, no kit, no
  filament, no printer (Q12; the explicit contrast with E3's K3 materialization).
- **FR-509**: Both a **single-piece calculation and a kit** MUST be recordable as snapshots from the first
  slice (Q2).
- **FR-510**: Recording, listing, reading, labelling and deleting snapshots MUST be authorized on the
  **server** against the binary premium entitlement (reusing the E2 seam, ADR-0012); a free/signed-out caller
  MUST be denied with `ENTITLEMENT_REQUIRED` and nothing persisted or read. **The whole epic is Premium** — the
  roadmap's "export = premium" is shorthand; `business-rules.md` §Freemium boundary already places **history AND
  export** on the Premium side ("saving calculations, catalog, history and export are all Premium"; PREMIUM
  explicitly lists "Export / share (PDF / CSV)"), so **E4 introduces no new gate**.
- **FR-511**: Snapshots MUST be strictly per-account and isolated — zero cross-account read or write; another
  account's entry MUST be indistinguishable from a non-existent one (no existence oracle).
- **FR-512**: The system MUST export a snapshot as a **customer-facing quote** carrying the item(s),
  quantities, price, record date, validity period and the seller's identification, and **omitting** the
  internal cost breakdown (material, energy, machine, failure, margin) **unless** the seller explicitly opts in
  via an "incluir detalhamento de custos" toggle (Q4). For a **kit** snapshot, the quote MUST **itemize the
  kit's pieces** (name + quantity) alongside the total — an opaque "Kit — R$ 500" is not acceptable — while
  still exposing **zero** internal cost lines (clarified 2026-07-12).
- **FR-513**: The system MUST export the history as a **data file** whose rows equal the stored snapshots
  exactly — same values, same rounding, same dates; no re-derivation, no drift (Q5).
- **FR-514**: The exported quote MUST identify the seller using **only the account's name and e-mail** — E4
  introduces **no new seller-profile data** (Q13, owner decision). *Accepted consequence: the quote carries the
  seller's personal login e-mail and no business name.*
- **FR-515**: Export MUST require an **active** premium entitlement: on lapse the export action MUST be denied
  honestly, with **no partial artifact**, while snapshots stay readable in-app (Q6, owner decision).
- **FR-516**: There MUST be **no free export** — a free/signed-out user meets the honest teaser and **no
  artifact is produced**, including for an ephemeral (unsaved) calculation (Q7, owner decision).
- **FR-517**: On premium **lapse**, snapshots MUST remain **readable** and **0%** writable; **nothing** is
  auto-deleted by the lapse; export is denied (FR-515); re-grant MUST restore writes and export with data
  intact.
- **FR-518**: Snapshots MUST **never** be auto-deleted or expired by the system — no TTL, no silent cap (Q10).
- **FR-519**: A snapshot MUST carry an optional **label** (free text: client / order reference) and a
  **validity period** for the quote (Q9). A client **registry** (CRM entity) is explicitly NOT introduced.
- **FR-520**: The seller MUST be able to **search by label** and **filter by date range** over their history.
- **FR-521**: After one online load, snapshots MUST be **readable offline** from the local cache; the cache MUST
  be purged on sign-out (existing uid-keyed pattern).
- **FR-522**: Every free/signed-out Histórico and export affordance MUST be honest — no fake success, no
  fabricated price/date/sample entry, no purchase CTA before E6 (E2 US7 / E3 US5 teaser lineage).
- **FR-523**: Every snapshot surface (list card, detail, exported artifact) MUST display its **record date**; no
  snapshot surface may present a value as **current**.
- **FR-524**: The existing **Histórico tab** (today an honest "em breve" placeholder) MUST be filled by E4; the
  information architecture MUST NOT change — **no new navigation tab**.
- **FR-525**: Monetary values in any snapshot the system persists, transmits or exports MUST preserve exact
  decimal semantics (no precision drift), consistent with the established money handling.
- **FR-526**: All prior **E1** (free single-piece calculator), **E2** (catalog + entitlement) and **E3** (kits:
  D3 live-reflect, D6 degradation) guarantees MUST hold **unchanged** — E4 **adds a shelf**, it does not alter
  the existing ones.
- **FR-527** (Q8 — **flipped 2026-07-12**): Recording MUST work **offline**. A snapshot recorded without
  connectivity is **queued locally** and **synchronized** when connectivity returns. The queued entry MUST be
  shown in a **visibly pending** state — it MUST NOT be presented as server-confirmed until it actually is (no
  fake "salvo!"), and it MUST NOT be silently dropped. Synchronization MUST be **exactly-once**: a queued entry
  that syncs MUST NOT produce duplicates on retry, reconnect or app restart. *(This is the product's **first
  offline write** — every other write in E2/E3 is online-only. The mechanism is an architecture decision for
  `/speckit-plan`.)*
- **FR-528** (Q8 clock — *corrected in the plan round, 2026-07-12*): A snapshot's date — the date shown in the
  app and printed on the exported quote — MUST be the **device clock at record time** ("cotado em"), because the
  date **is** the seller's claim. **Accepted, owner-acknowledged trade-off**: the server stores a timestamp it
  **cannot verify**; a wrong or manipulated device clock yields a snapshot with a wrong date. It MUST NOT be
  silently "fixed" by substituting a server clock (that would make the snapshot lie about *when the quote was
  given*), and it MUST NOT be presented to the user as a verified date. The plan and the security review MUST
  treat this as a **known, owner-accepted integrity limitation**, not an oversight.
  > **Correction.** An earlier draft of this requirement claimed *"no server-side received-at exists"*. That is
  > **literally unachievable** and was wrong: a server-generated `uuid7` primary key already embeds a
  > millisecond timestamp, and every table in the project carries a `created_at`. The requirement is therefore a
  > **product** rule, not a storage one — the server MAY hold a row-metadata `created_at` (owner decision,
  > 2026-07-12), bound by three rules: it is **never displayed, never exported, and never used to order or to
  > validate** the device date. The only date the product asserts is the device's.
- **FR-529** (Q8 + entitlement): The **server gate still governs persistence** of a queued snapshot: when a
  queued entry syncs, the server MUST authorize it against the premium entitlement (FR-510). A queued entry
  whose sync is denied (free/lapsed caller) MUST fail **honestly and visibly** — never silently dropped, never
  left claiming to be saved. *(A client offline cannot verify entitlement; the queue is a client convenience,
  the server remains the authority — Principle IV.)*

### Key Entities *(include if feature involves data)*

- **Snapshot (History Entry)**: an explicitly recorded price event — the seller's assertion *"this is what I
  quoted"*. Immutably carries: the inputs as computed (single piece **or** kit), the rounded output lines and
  totals as displayed, the formula version, the timestamp; plus an editable **label**, a **validity period**,
  and optional **provenance**. It is **not** a template (that's a Product), **not** a re-priceable assembly
  (that's a Kit), and **not** an autosave.
- **Snapshot Line**: one recorded line of the frozen breakdown — its values are stored, never recomputed and
  never re-derived from the catalog.
- **Queued snapshot (pending sync)** (Q8): a snapshot recorded offline, held locally and **visibly pending**
  until the server accepts it. It is a **transient state of a Snapshot**, not a second kind of entity: once
  synced it is an ordinary snapshot, carrying the **device-stamped** date from the moment it was recorded — not
  from the moment it synced (FR-527/528).
- **Provenance link**: an informational pointer to the product/kit a snapshot originated from. **Never a value
  source.** May dangle harmlessly.
- **Export artifact**: a document generated from a snapshot — a customer-facing **quote** (internal costs
  omitted by default) or a **history data file**. Never a stored entity that could drift from its snapshot.
- **Entitlement (E2)**: the existing server-authoritative premium check; reused verbatim. E4 adds **no new
  gate**; it does add the rule that **export requires an *active* entitlement** (FR-515).
- **Product / Kit / Filament / Printer (E2, E3)**: existing catalog entities a snapshot may *originate from*;
  reused, not redefined, and **never** a value source for a snapshot.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-501**: A premium user records a computed price and, on a fresh session/device, reopens it with **every
  displayed line byte-identical** to the recording moment — with **zero** recomputation.
- **SC-502**: Editing **or** deleting any catalog entity referenced at record time changes **0%** of existing
  snapshots (values, totals, dates, version stamp all unchanged) and produces **no** degraded/warning state on
  any snapshot.
- **SC-503**: 100% of history persistence operations are authorized server-side; a free/signed-out or
  locally-faked-premium caller is denied (`ENTITLEMENT_REQUIRED`) and persists/reads nothing.
- **SC-504**: A snapshot's contents are immutable: **0** write paths can alter recorded inputs, values, version
  or timestamp; only the label is editable and the whole entry is deletable by its owner.
- **SC-505**: Recording a snapshot creates **zero** catalog objects (no product, no kit, no filament, no
  printer) — verified after every record path.
- **SC-506**: An exported customer-facing quote contains **zero** internal cost lines unless the seller
  explicitly opted in; the exported values equal the stored snapshot values **exactly** (no drift, no
  re-derivation).
- **SC-507**: Every free/signed-out history/export affordance is honest on the rendered UI (no price, no date,
  no fake success, no fabricated sample, no pre-E6 purchase CTA); the E1 free calculator's guarantees hold
  unchanged.
- **SC-508**: On lapse, 100% of snapshots stay readable, 0% writable, **0% exportable**, and 0% deleted;
  re-grant restores writes and export with data intact.
- **SC-509**: Zero cross-account reads or writes of snapshots under any manipulation; another account's entry is
  indistinguishable from non-existent.
- **SC-510**: After one online load, 100% of the account's snapshots are readable offline.
- **SC-513** (Q8): A snapshot recorded **offline** is queued and, once connectivity returns, syncs **exactly
  once** — 0 duplicates across retry, reconnect and app restart — and 0 queued entries are silently dropped.
  While pending it is **visibly** pending and never claims to be saved.
- **SC-514** (Q8): A queued snapshot whose sync is **denied** by the server (free/lapsed caller) surfaces the
  denial honestly — 0 silent drops, 0 entries left claiming to be saved.
- **SC-515**: A **kit** quote itemizes every piece (name + quantity) with the total and **zero** internal cost
  lines.
- **SC-511**: Every snapshot surface (list card, detail, export) displays its record date; **no** snapshot
  surface presents a value as current.
- **SC-512**: All E1/E2/E3 acceptance guarantees pass unchanged (free calculator, catalog live-recompute, kit
  D3/D6 degradation, entitlement gate) — E4 adds a shelf, it does not alter the existing ones.

## Out of Scope (guarding the boundary)

- **Saved marketplace scenarios / what-if configs** → **E5**. A snapshot may *contain* per-channel results (they
  were part of the computed price); a reusable, re-runnable **scenario object** is E5.
- **Billing, purchase, self-service upgrade, prices in R$** → **E6**. Grants stay out-of-band; teasers carry no
  price and no date.
- **Public shareable quote links** (a server-hosted URL a customer opens without auth) → OUT (a new
  unauthenticated surface: LGPD, expiry, abuse). E4 exports **files** (Q5).
- **Customer / client registry (CRM)** → OUT. A snapshot carries a free-text label, not a `Cliente` entity (Q9).
- **Quote status / pipeline** (enviado · aceito · recusado · produzido) → OUT of E4 (Q11) — a new lifecycle
  domain, and it would contradict an epic whose point is immutability. Strong backlog candidate.
- **Seller profile / business name / logo** → OUT (Q13, owner decision). The gap is consciously left open.
- **Editing a snapshot's contents · versioned snapshots · snapshot diff-migration** → OUT **by definition**
  (immutability is the feature).
- **Replaying an old formula version** (a `MODEL_REGISTRY` re-executing historical engines) → **not needed and
  OUT**: ADR-0008 freezes *rounded outputs*, so a snapshot renders from stored values. ADR-0008's Option 1B
  stays deferred. *(85% inference — the plan must confirm the frozen payload is complete enough to render the
  full detail UI.)*
- **Server-verified record timestamps** → OUT (owner decision, 2026-07-12): the date the product asserts is the
  **device's**, and the server does not verify it. (A row-metadata `created_at` exists but is never displayed,
  exported, or used to order/validate — FR-528.) A known, accepted integrity limitation, **not** an oversight
  for the plan to quietly repair.
- **Offline export** → OUT (owner decision, plan round 2026-07-12): the export artifact is **rendered on the
  server** behind an active-entitlement gate (ADR-0020), so export **requires a connection** and a still-pending
  snapshot is not exportable until it syncs. This is the price of FR-515 being *real* rather than a client
  route-guard — accepted knowingly, and it must be said plainly in the UI ("exportar precisa de conexão"), never
  faked.
- **Shared-print-job cost pooling** (deferred from E3 Q1) → still out. **Taxes** → still out (A24).
- **Full LGPD program** (consent management, self-service portability / erasure) → still deferred; E4's data
  export is a *product* feature, not the LGPD portability answer.
- **Public deploy** → still deferred to v1 = E1–E6 (owner rule, revisitable).

## Recommended slicing (owner-authorized, slice by slice — E2/E3 pattern)

- **PR-A — The frozen shelf (US1 + US2 + US5)**: recording from the calculator **and from a kit** (Q2 confirmed
  — so the frozen payload carries kit lines + the per-channel rollup from day one), server-gated persistence,
  the Histórico list + frozen detail, offline read cache + purge-on-signout, the **offline recording queue**
  (Q8 flipped — the product's first offline write, FR-527/528/529), the honest free/signed-out teaser.
  *Demoable alone: a premium seller records a quote — online or offline at a fair — and reopens it identical; a
  free user sees an honest door.* **Note: the two owner calls in `/speckit-clarify` both landed in this slice,
  so PR-A is bigger than the brief assumed.**
- **PR-B — Immutability + lifecycle honesty (US3 + US6)**: catalog churn proven inert against history
  (SC-502), the date + formula-version surface (Q3/A29), "Recalcular hoje" → new entry, label / search /
  filter / delete, the lapse freeze. *This is the slice that proves the two-shelf rule — **the epic's risk lives
  here**.*
- **PR-C — Export (US4, + US7 if it survives)**: customer-facing quote (internal costs off by default), history
  data export, the export gate including the lapse denial (Q6) and its honest teaser. *Independently
  homologable, and the natural place to cut scope if the epic runs long.*

## Assumptions

- **No new premium gate**: `business-rules.md` §Freemium boundary (revised Round 3, 2026-06-29) already places
  history AND export on the Premium side with **zero free persistence**, and its PREMIUM list already names
  "Export / share (PDF / CSV)" — which independently corroborates the Q5 default. E4 reuses the E2
  server-authoritative entitlement (ADR-0012, Constitution IV) verbatim. The only *new* rule is that **export
  requires an active entitlement** (Q6).
- **Enforcement honesty (Principle IV, ADR-0015 precedent)**: persistence of snapshots is server-authoritative —
  that boundary is real. If the export artifact is rendered **client-side** (likely, given the offline-first
  stack), then the export *action* is a client route-guard on top of server-gated data, exactly as E3's
  client-side compute was. The spec and plan MUST say so **honestly** and MUST NOT imply the rendering itself is
  server-enforced. **Which side renders is an architecture decision for `/speckit-plan`** — it determines both
  whether export can work offline and whether the gate is server-enforceable.
- **First offline write in the product (Q8, flipped 2026-07-12)**: every write in E2/E3 is online-only, so the
  offline recording queue is **new machinery**, not a reuse — local durability, exactly-once sync, a visible
  pending state, and an entitlement check that only happens at sync time (FR-527/529). The mechanism is an
  architecture decision for `/speckit-plan` (likely an ADR), and it is the main reason PR-A grew.
- **Client-stamped snapshot dates (FR-528)**: an owner-accepted integrity limitation, not a defect. The security
  review will see a server storing an unverifiable client timestamp — it is recorded here so it is judged as a
  decision, not discovered as a bug.
- **`pricing-core` is likely untouched (85%)**: recording freezes existing outputs and "Recalcular hoje" runs
  the current engine on stored inputs — so no formula change and no historical-engine replay. The plan must
  confirm before assuming a version bump.
- **Snapshot payload completeness**: the frozen payload must contain every line the detail UI renders, forever
  (SC-501 + the "no fabricated zero" rule). To be confirmed against ADR-0008 in the plan.
- **History volume is unbounded** per premium account (business-rules: premium = unlimited). Pagination,
  indexing and offline-cache size are engineering concerns, not a product cap.
- **A29 is closed by this epic** (Q3) — the close-out must flip it in `docs/decisions/audit-findings-r2.md`.
- **Exact R$ prices remain deferred** to E6; **first public deploy remains deferred** to v1 = E1–E6 (both
  revisitable owner decisions).

## Dependencies

- **E2 (007)**: the entitlement gate (ADR-0012), per-account isolation, the offline read-cache +
  purge-on-signout pattern, the `ENTITLEMENT_REQUIRED` vocabulary and the lapse-freeze policy — all reused.
- **E3 (008)**: kit results are recordable payloads (Q2); ADR-0015's honesty clause is the precedent for any
  client-side export gate; ADR-0017's read-time degradation is precisely the behavior E4 deliberately **does
  not** apply to snapshots (the two-shelf rule).
- **E1 (004/005)**: `PRICING_MODEL_VERSION` + the ADR-0008 rounding/freezing contract — the reason snapshots are
  reproducible **without** a backend recompute.
- **A29** (`docs/decisions/audit-findings-r2.md`, open since 2026-07-02) — **closed by Q3** in this epic.
- **Histórico tab** already exists as an honest placeholder (`apps/web/src/pages/historico/historico-page.tsx`,
  copy "Histórico em breve") — E4 fills it; the IA does not change (FR-524).
- **Product scope source**: `docs/product/e4-scope-brief.md` (product-owner, 2026-07-12) + its §0 owner
  decisions.
