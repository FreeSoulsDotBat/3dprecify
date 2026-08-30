# E4 — Scope brief: History + reproducible snapshots + export

**Status**: product scope draft (input to `/speckit-specify`) · **Author**: product-owner · **Date**: 2026-07-12
**Roadmap line being expanded**: `docs/product/business-rules.md:55` — *"E4 | History + reproducible snapshots
+ export | export = premium"*.

> This brief specifies **behavior**, not architecture. Endpoints, tables, PDF libraries and storage are the
> arquiteto's call (Principle VIII). Where a product decision depends on a technical unknown, it is flagged.

## 0. Owner decisions (2026-07-12)

Four of the §10 open questions were put to the owner and are now **settled**. Two of them **override the
product-owner's recommendation** — recorded here with the reasoning, because the divergence matters later:

| # | Decision | vs. recommendation |
|---|---|---|
| **Q3 / A29** | **(c) Labeled + "Recalcular hoje"** — a snapshot displays when it was calculated and with which formula version, and recalculating creates a **new** entry (the original is never mutated). **A29 is closed by this.** | = rec (c), 75% |
| **Q6** | **(b) NO — export does not survive a premium lapse.** A lapsed account keeps its snapshots **readable in-app** (the E2/E3 read-only freeze is unchanged); the **export action is denied**. Rationale: export is E4's headline premium value, and the rule "lapsou ⇒ read-only no app, sem export" is harder and simpler to explain than a read/write hair-split. | **OVERRIDES** rec (a) (65% — the PO itself called this genuinely close) |
| **Q7** | **(a) Export stays Premium, full stop.** No free ephemeral export. The standing split (`business-rules.md` §Freemium boundary, revised Round 3, 2026-06-29) is unchanged; the conversion tension the PO flagged is **acknowledged and consciously accepted**, not overlooked. | = rec (a), 70% |
| **Q13** | **(a) Account name + e-mail only** — zero new seller data in E4. The quote prints what the account already has. **Consequence, accepted openly:** the exported quote carries the seller's **personal** login e-mail and no business name. The gap the PO found (E1–E3 model no seller) stays **open**, deliberately, rather than being closed mid-epic. | **OVERRIDES** rec (b) (80%) — scope discipline chosen over PDF credibility |

The remaining nine questions (Q1, Q2, Q4, Q5, Q8, Q9, Q10, Q11, Q12) carried the product-owner's recommendation
as the working default into `/speckit-specify` + `/speckit-clarify`.

**Update — `/speckit-clarify`, same day (2026-07-12).** Three of the nine were put to the owner. **Q2 and Q5
confirmed. Q8 FLIPPED**: recording is **not** online-only — an **offline queue** ships, so the seller quoting
at a fair without connectivity can record. That forced a follow-up the brief had not asked: with an offline
queue, **which clock stamps the date** (the date *is* the claim)? Owner: **the device clock only** — the server
stores a timestamp it cannot verify, an accepted integrity limitation. A fifth, genuinely new question also
surfaced during the ambiguity scan: a **kit** quote must **itemize its pieces**, not print an opaque "Kit —
R$ 500". **The authoritative record for all of this is now
`specs/009-e4-history-snapshots-export/spec.md` §Clarifications — this brief is the input that produced it, not
the source of truth.**

---

## 1. Epic vision (the seller's problem)

*"Eu calculei R$ 187 pro cliente na semana passada, mandei por WhatsApp, e agora ele voltou pra fechar. Só que
o filamento subiu, eu editei o preço no catálogo, e agora o app me mostra R$ 203. Qual dos dois eu prometi?"*

E1–E3 gave the seller a calculator, a catalog and kits — all of them **live**: they answer *"quanto isso custa
HOJE"*. Nothing in the product answers *"quanto eu COBREI, naquele dia, daquele cliente"*. E4 adds the second
shelf: an immutable **histórico** of price events the seller deliberately recorded, each one a frozen,
reproducible snapshot (inputs + rounded line values + formula version + timestamp), and the ability to **export**
that snapshot as a quote the customer can read. The pitch in one line: **o Catálogo mostra o que vale hoje; o
Histórico prova o que você cobrou.**

---

## 2. The two-shelf rule (the centerpiece — resolves the E2/E3 tension)

E2 and E3 deliberately chose **live recompute + honest degradation to last-known** (a product/kit reflects
today's filament price; ADR-0017 §6). A snapshot is the opposite by nature. Both are correct; they answer
different questions. E4 makes the difference a **product rule**, not an accident:

| | **Catálogo / Kits (E2, E3)** | **Histórico (E4)** |
|---|---|---|
| Answers | "quanto custa **hoje**?" | "quanto eu **cobrei** em 03/07?" |
| Object | reusable **template** (live) | recorded **event** (frozen) |
| On reopen | **recomputes** with the current formula and current references | **never recomputes** — renders the stored values |
| Reference edited | price changes (D3 live-reflect) | **nothing changes** |
| Reference deleted | degrades to last-known, honest caption (D6) | **nothing changes** — a snapshot has no degraded state, because it depends on nothing |
| Editable | yes | **contents never**; only its label; deletable by the owner |
| Carries a date | no | **always** — the date is part of the claim |

**Why a snapshot cannot degrade:** it does not *reference* the catalog for values — it **contains** them
(ADR-0008: what freezes = `PRICING_MODEL_VERSION` + inputs + rounded line values). Catalog links kept on a
snapshot are **provenance only** (informational: "originou-se do produto Vaso G"), never a value source. A
dangling provenance link must never alter, break, or degrade a snapshot.

**Honesty rules inherited from `docs/product/ux-decisions.md` + E2 US7 / E3 D6 lineage:**
- **Never present stale as live.** Every snapshot surface (list card, detail, export) carries its date. A
  snapshot card must never be confusable with a live catalog card.
- **Never claim something was removed/changed when it wasn't.** A snapshot shows the origin's name **as
  captured at the time** (always true — that is what it was called then). "Abrir produto" is offered only when
  the origin still resolves; when it doesn't, the affordance is simply absent — no "produto excluído" claim, no
  broken link.
- **Never invent data.** A snapshot renders **only the lines it recorded**. If a future formula adds a
  breakdown line, older snapshots render **without** that line — they never show a fabricated zero.
- **A recalculation is a new event, never a mutation.** "Recalcular hoje" produces a **new** history entry; the
  original is untouched (see US3 / Q3).

---

## 3. What a history entry IS (crisp, so E4 does not collide with E2/E3)

A **history entry (snapshot)** is: an **explicitly recorded** price event — the seller's assertion *"this is what
I quoted"* — carrying, immutably:
- the **inputs** as computed (single piece **or** a whole kit, per Q2),
- the **rounded output lines + totals** exactly as displayed at that moment (per channel where applicable),
- the **formula version** (`PRICING_MODEL_VERSION`) and the **timestamp**,
- an optional **label** (free text: client name / order ref) — a label, **not** a customer registry,
- optional **provenance** (which product/kit it came from), informational only.

**It is not**: a template (that's a Product), an assembly you re-price (that's a Kit), an autosave of every
keystroke, or a catalog asset. **Saving a snapshot materializes nothing** — the explicit contrast with E3's K3
(kit save materializes ad-hoc pieces into the catalog). Recording a quote must never mutate the seller's catalog.

---

## 4. Freemium boundary (settled — not reopened here)

`business-rules.md` §Freemium boundary (revised Round 3, 2026-06-29 — *not* a rule id "R3"; the PO's shorthand
was corrected during `/speckit-specify`) already places **history AND export** on the Premium side, with **zero free
persistence**. E4 therefore introduces **no new gate**: it reuses the E2 server-authoritative entitlement
(ADR-0012, Constitution IV). The roadmap's *"export = premium"* is shorthand — in truth **the whole epic is
premium** (record, list, reopen, export). The free/signed-out user gets the honest teaser (E2 US7 / E3 US5
lineage) and keeps the fully free calculator.

One conversion tension is **flagged, not decided by me** (Q7): the strongest upgrade moment in the whole product
is a free user who just computed a price and wants to send it to a client. Today the rule says: teaser, no
export. Weakening that is an owner decision and a dated business-rules amendment — not mine to make.

**Enforcement honesty (Principle IV, ADR-0015 precedent).** Persistence of snapshots is server-authoritative —
that boundary is real. If export renders **client-side** (likely, given the offline-first stack), then the export
*action* is a client route-guard on top of server-gated data, exactly as E3's client-side compute was; the spec
and plan MUST say so honestly and MUST NOT imply the rendering itself is server-enforced. Which side renders is
an arquiteto decision (see §9 Technical unknowns), and it determines whether export works offline.

---

## 5. User stories

### US1 — Record a price as a frozen snapshot (Premium) — **P1 [FOUNDATIONAL]**
A premium seller, having computed a price (single piece or kit), explicitly records it in the Histórico with an
optional label. The entry freezes inputs + rounded outputs + formula version + timestamp, server-side.

**Acceptance scenarios**
1. **Given** a premium user with a computed result, **When** they record it with a label, **Then** the entry
   persists and appears in the Histórico on a fresh session/device, showing label, total and date.
2. **Given** a recorded snapshot, **When** it is reopened, **Then** it renders the **stored** breakdown —
   byte-identical to what was displayed at record time — with **no recomputation** of any line.
3. **Given** a free or signed-out caller, **When** any record/list/read operation is called, **Then** the server
   denies with `ENTITLEMENT_REQUIRED`, nothing is written or read, and the client's local state is never trusted.
4. **Given** a recorded snapshot, **When** the account's catalog is inspected, **Then** **nothing was
   materialized** — recording a quote creates no product, no kit, no catalog change.

### US2 — Consult the Histórico (list, open, offline read) — **P1**
The Histórico tab (today an honest "em breve" placeholder) becomes the seller's ledger: entries ordered
newest-first, each showing label · total · date, opening into the frozen detail.

**Acceptance scenarios**
1. **Given** several snapshots, **When** the Histórico is opened, **Then** they list newest-first with label,
   total and date; the date is present on every card (never a live-looking price).
2. **Given** a premium account that loaded the Histórico online once, **When** the device goes offline, **Then**
   snapshots remain **readable** from the local cache (mirrors E2/E3 offline read); recording requires a
   connection and fails honestly — no silent drop, no fake success (Q8).
3. **Given** account A's snapshot, **When** account B is signed in, **Then** B can neither read nor modify it,
   and it is indistinguishable from non-existent (no existence oracle).
4. **Given** a sign-out, **When** it completes, **Then** the local history cache is purged (existing uid-keyed
   purge-on-signout pattern).

### US3 — A snapshot never changes; recalculating creates a new one — **P1**
The reproducibility contract, made visible. Catalog churn cannot rewrite history.

**Acceptance scenarios**
1. **Given** a snapshot taken from product P, **When** P's filament cost is edited, **Then** the snapshot's
   values and total are **unchanged** on reopen.
2. **Given** a snapshot taken from product P, **When** P is deleted, **Then** the snapshot stays fully intact
   and priceable-as-recorded — **no degraded state, no last-known caption, no warning** (it never depended on P);
   the origin's captured name still displays, and "abrir produto" is simply not offered.
3. **Given** a snapshot, **When** it is opened, **Then** it displays honestly *when* it was calculated and *with
   which formula version* (exact copy/behavior = Q3 / A29).
4. **Given** a snapshot, **When** the user chooses "Recalcular hoje", **Then** a **new** snapshot is created from
   the same inputs with today's formula/values, and the original entry is **not modified** (immutability holds).
5. **Given** a snapshot recorded under an older formula version, **When** the current formula has additional
   breakdown lines, **Then** the snapshot renders only the lines it recorded — never a fabricated zero line.

### US4 — Export / share a snapshot as a quote (Premium) — **P1**
The seller sends the customer a readable quote. **The customer never sees the seller's internal cost
breakdown** unless the seller explicitly opts in (Q4 — this is a business-confidentiality guarantee, not a
preference).

**Acceptance scenarios**
1. **Given** a premium user on a snapshot, **When** they export it as a customer-facing quote, **Then** the
   artifact contains the item(s), quantities, the price, the date and the seller's identification (Q13), and
   **omits** material/energy/machine/failure/margin cost lines by default.
2. **Given** the export options, **When** the seller explicitly enables "incluir detalhamento de custos",
   **Then** and only then the internal breakdown appears in the artifact.
3. **Given** a premium user, **When** they export the history as a data file, **Then** the exported rows match
   the stored snapshots exactly (same values, same rounding, same dates) — no re-derivation, no drift.
4. **Given** a free or signed-out user, **When** they meet any export affordance, **Then** they get the honest
   teaser (US5) — no artifact is produced, no fake success.

### US5 — Honest teaser for Histórico + Export (free / signed-out) — **P2**
Every free-facing affordance ("Salvar no histórico", the Histórico tab, "Exportar") is **visible** and opens an
honest Premium notice: no price, no date, no fake "salvo!", no pre-E6 purchase CTA. The free single-piece
calculator remains fully free, offline and untouched.

**Acceptance scenarios**
1. **Given** free/signed-out, **When** the Histórico tab is opened, **Then** it explains the premium value
   honestly (never a broken list, never a fabricated sample entry).
2. **Given** free/signed-out, **When** any "salvar no histórico" / "exportar" affordance is tapped, **Then** the
   honest teaser appears, nothing persists, nothing is generated, no success is faked.
3. **Given** the teaser copy, **When** reviewed, **Then** it promises no price and no availability date.

### US6 — Manage the Histórico + lapse policy — **P2**
Label/re-label, search/filter (by label and by date range), delete — per-account, isolated. On premium lapse:
**read-only freeze**, exactly like E2/E3 — snapshots stay readable, nothing is auto-deleted, new records are
denied. Whether **export** survives a lapse is Q6.

**Acceptance scenarios**
1. **Given** saved snapshots, **When** the owner edits a label or deletes an entry, **Then** the change persists
   per-account; the snapshot's **contents** remain non-editable (only the label is).
2. **Given** a lapsed account, **When** it opens the Histórico, **Then** entries are readable, **zero** writes
   succeed, and no entry is deleted by the lapse; re-grant restores writes with data intact.
3. **Given** many snapshots, **When** the seller searches by label or filters by period, **Then** the matching
   entries are found without the list becoming unusable.

### US7 — Compare a snapshot with today's cost — **P3 (droppable)**
"Meu custo subiu desde que cotei?" — the snapshot detail can show, side by side, the frozen total and today's
recomputed total for the same inputs, flagged clearly as *"hoje"* vs *"cotado em {data}"*. Purely informational;
recording the new number is still an explicit US3.4 action.

**Acceptance scenario**: **Given** a snapshot whose inputs still resolve, **When** the comparison is requested,
**Then** both totals are shown with unambiguous labels and dates, and the frozen entry remains unmodified.

> P3 = explicitly droppable if it endangers PR-C. Recommend cutting it before cutting US4.

---

## 6. Success criteria (measurable, technology-agnostic)

- **SC-501**: A premium user records a computed price and, on a fresh session/device, reopens it with **every
  displayed line byte-identical** to the recording moment — with zero recomputation.
- **SC-502**: Editing **or** deleting any catalog entity referenced at record time changes **0%** of existing
  snapshots (values, totals, dates, version stamp all unchanged), and produces **no** degraded/warning state on
  any snapshot.
- **SC-503**: 100% of history persistence operations are authorized server-side; a free/signed-out or
  locally-faked-premium caller is denied (`ENTITLEMENT_REQUIRED`) and persists/reads nothing.
- **SC-504**: A snapshot's contents are immutable: **0** write paths can alter recorded inputs, values, version
  or timestamp; only the label is editable and the whole entry is deletable by its owner.
- **SC-505**: Recording a snapshot creates **zero** catalog objects (no product, no kit, no filament, no
  printer) — verified after every record path.
- **SC-506**: An exported customer-facing quote contains **zero** internal cost lines unless the seller
  explicitly opted in; the exported values equal the stored snapshot values exactly (no drift, no re-derivation).
- **SC-507**: Every free/signed-out history/export affordance is honest on the rendered UI (no price, no date,
  no fake success, no pre-E6 purchase CTA); the E1 free calculator's guarantees hold unchanged.
- **SC-508**: On lapse, 100% of snapshots stay readable and 0% writable/deleted; re-grant restores writes with
  data intact.
- **SC-509**: Zero cross-account reads or writes of snapshots under any manipulation; another account's entry is
  indistinguishable from non-existent.
- **SC-510**: After one online load, 100% of the account's snapshots are readable offline; a record attempted
  offline fails honestly (no silent drop, no fake success).
- **SC-511**: Every snapshot surface (list card, detail, export) displays its record date; no snapshot surface
  presents a value as current.
- **SC-512**: All E1/E2/E3 acceptance guarantees pass unchanged (free calculator, catalog live-recompute, kit
  D3/D6 degradation, entitlement gate) — E4 adds a shelf, it does not alter the existing ones.

---

## 7. Scope boundaries

### IN
- Explicit recording of a computed price (single piece **and** kit — Q2) as an immutable snapshot.
- The Histórico section: list, open, offline read, label, search/filter, delete, lapse freeze.
- The frozen-vs-live product rule and its honest surfaces (date + formula-version label; "recalcular hoje" as a
  new entry).
- Export of a snapshot as a customer-facing quote + export of the history as a data file (Premium; Q4/Q5).
- Honest teaser for every free/signed-out history + export affordance.

### OUT (guarding the boundary)
- **Saved marketplace scenarios / what-if configs** → **E5**. A snapshot may *contain* per-channel results
  (they were part of the computed price); a reusable, re-runnable scenario object is E5.
- **Billing, purchase, self-service upgrade, prices in R$** → **E6**. Grants stay out-of-band; teasers carry no
  price and no date.
- **Public shareable quote links** (server-hosted URL a customer opens without auth) → OUT (new public surface,
  LGPD + expiry + abuse questions). E4 exports **files** (Q5).
- **Customer/client registry (CRM)** → OUT. A snapshot carries a free-text label, not a `Cliente` entity.
- **Quote status / pipeline** (enviado · aceito · recusado · produzido) → OUT of E4 (Q11 — flagged as a strong
  backlog candidate, but it is a new domain, not history).
- **Editing a snapshot's contents / versioned snapshots / snapshot diff-migration** → OUT by definition
  (immutability is the feature).
- **Replaying an old formula version** (a `MODEL_REGISTRY` that re-executes historical engines) → **not needed
  and OUT**: ADR-0008 freezes *rounded outputs*, so a snapshot renders from stored values. ADR-0008's Option 1B
  stays deferred. *(Inference, 85% — the arquiteto must confirm the frozen payload is complete enough to render
  the full detail UI.)*
- **Shared-print-job cost pooling** (deferred from E3 Q1) → still out.
- **Full LGPD program** (consent management, self-service data portability/erasure) → still deferred; E4's CSV
  export is a *product* feature, not the LGPD portability answer.
- **Taxes** → still out (A24).
- **Public deploy** → still deferred to v1 = E1–E6 (owner rule, revisitable).

---

## 8. Recommended PR slicing (owner-authorized, slice by slice — E2/E3 pattern)

- **PR-A — The frozen shelf (US1 + US2 + US5).** Snapshot recording from the calculator (and kit, per Q2),
  server-gated persistence, the Histórico list + frozen detail, offline read cache + purge-on-signout, the honest
  free/signed-out teaser. *Demoable alone: a premium seller records a quote and reopens it identical; a free user
  sees an honest door.*
- **PR-B — Immutability + lifecycle honesty (US3 + US6).** Catalog churn proven inert against history (SC-502),
  the date + formula-version surface (Q3/A29), "recalcular hoje" → new entry, label/search/filter/delete, lapse
  read-only freeze. *This is the slice that proves the two-shelf rule; it is where the E4 risk lives.*
- **PR-C — Export (US4, + US7 if it survives).** Customer-facing quote artifact (internal costs off by default),
  history data export, the export gate + its honest teaser, seller identification (Q13). *Independently
  homologable; also the natural place to cut scope if the epic runs long.*

Rationale for the order: PR-A is worthless without persistence (unlike E3, where the composer had standalone
value), so E4's first slice **is** the server slice. Export last because it is the only part that can be
deferred without leaving the product incoherent — a Histórico that records and reproduces honestly is already
shippable value.

---

## 9. Technical unknowns to route to the arquiteto (not product calls)

1. **Where the export artifact is rendered** (client vs server). Determines (a) whether export works offline and
   (b) whether the export gate can be server-enforced or must be an honest client route-guard (ADR-0015
   precedent + honesty clause).
2. **Snapshot payload completeness** — the frozen payload must contain every line the detail UI renders, forever
   (see SC-501 + the "no fabricated zero" rule). Confirm against ADR-0008.
3. **Immutability enforcement** — server-side absence of any content-mutating write path; soft-delete policy.
4. **History volume** — unbounded per premium account (business-rules: premium = unlimited); pagination/indexing
   and offline-cache size are engineering concerns, not a product cap. *(If a cap ever becomes necessary, it is a
   business-rules amendment, not a silent limit.)*
5. **`pricing-core` impact** — E4 likely needs **no** formula change (85%): recording freezes existing outputs;
   "recalcular hoje" runs the current engine on stored inputs. Confirm before assuming a version bump.

---

## 10. Open questions — owner decisions (→ `/speckit-clarify`)

| # | Decision | Options | Recommendation (confidence) |
|---|---|---|---|
| **Q1** | **Capture model** — how does a price get into the history? | (a) **Explicit** "Salvar no histórico" action · (b) **auto-capture** every computed price · (c) hybrid (auto-draft + explicit keep) | **(a) Explicit** (85%). The calculator recomputes on every keystroke — auto-capture would record noise, not quotes. A snapshot is an *assertion* ("foi isto que eu cobrei"); assertions need intent. Also keeps zero-free-persistence trivially true. |
| **Q2** | **What can be recorded** — single-piece calc only, or kits too? | (a) **Both** from PR-A · (b) single-piece in PR-A, kits in PR-B · (c) single-piece only in E4 | **(a) Both** (80%). The multi-piece order *is* the thing sellers actually quote; a history that can't record a kit would be strange. Cost: a bigger frozen payload in PR-A. Choose (b) if PR-A must stay small. |
| **Q3** | **A29 — formula-version UX for saved quotes** (open since 2026-07-02, explicitly paired with E4) | (a) **Silent freeze** (date only) · (b) **labeled** ("calculado em 03/07/2026 · fórmula 3.1.0") · (c) labeled **+ "Recalcular hoje"** creating a new entry · (d) (c) + side-by-side diff (= US7) | **(c)** (75%). (a) hides information the seller needs; (d) is the P3 US7 and can be cut. (c) is honest, actionable, and preserves immutability. **→ OWNER DECIDED 2026-07-12: (c). A29 closed. See §0.** |
| **Q4** | **Export audience & content** — what does the customer see? | (a) Customer-facing quote **only** (no internal costs) · (b) internal record **only** (full breakdown) · (c) **both artifacts**, customer-facing by **default**, internal breakdown behind an explicit opt-in toggle | **(c)** (90%). Leaking material/failure/margin costs to the seller's client would be a **product-level harm**; the default must protect the seller's margin. The opt-in exists because some sellers *do* itemize for B2B clients. |
| **Q5** | **Export format(s) / channel** | (a) **PDF** (quote) + **CSV** (history) · (b) PDF only · (c) CSV only · (d) any of the above **+ a public share link** | **(a)** (80%). PDF is what gets sent on WhatsApp; CSV is the seller's bookkeeping. **(d) is OUT** of E4 — a public URL is a new unauthenticated surface with LGPD/expiry/abuse questions that deserve their own increment. |
| **Q6** | **Does export survive a premium lapse?** (E2 freeze = read-only; is export a "read"?) | (a) **Yes** — lapsed users can still read *and* export their own data · (b) **No** — export requires active premium | **(a)** (65% — genuinely close). Export is a read, and denying a paying-then-lapsed seller access to their own quotes is hostile and LGPD-adjacent. Counter-argument for (b): export is E4's headline premium value; letting it survive lapse softens the gate. **→ OWNER DECIDED 2026-07-12: (b) NO — export requires active premium; lapse = read-only in-app, no export. OVERRIDES this recommendation. See §0.** |
| **Q7** | **Free ephemeral export as a conversion device** — may a free user export the price they just computed (without saving)? | (a) **No** — export is Premium, full stop (current `business-rules.md`) · (b) **Yes**, limited (e.g. watermarked / customer-quote only, still nothing persisted) | **(a) Keep it Premium** (70%). It is the standing rule and I will not weaken the split. But I flag honestly: this is the **single strongest conversion moment in the product** ("acabei de calcular, preciso mandar pro cliente **agora**"). Changing it = a dated business-rules amendment, exactly like E3's Q3. **→ OWNER DECIDED 2026-07-12: (a) — export stays Premium; the conversion tension is consciously accepted. See §0.** |
| **Q8** | **Offline recording** | (a) **Online-only writes**, honest failure offline (mirrors E2 Q2 / E3) · (b) **offline queue** that syncs later | **(a)** (80%). Consistency with every other write in the product, and a queued snapshot raises a real integrity question (whose clock stamps it?). Flagged cost: the seller **at a fair/feira, offline, quoting in person** cannot record — a genuinely plausible scenario. If that persona matters, (b) needs its own increment. |
| **Q9** | **Snapshot metadata** — what does an entry carry besides the numbers? | (a) **Label only** (free text: client/order) · (b) label + **validity period** ("validade: 15 dias" on the quote) · (c) label + validity + free-text notes | **(b)** (75%). A quote without a validity date is a promise with no expiry — sellers get burned by that. Notes (c) are cheap but grow the surface; defer unless the owner wants them. **A client *registry* stays OUT.** |
| **Q10** | **Retention** — do snapshots ever expire or get auto-deleted? | (a) **Never auto-delete** (matches E2 Q3/A27 freeze posture) · (b) cap/TTL | **(a)** (90%). "Nunca apagamos seus dados" is already the recorded posture; a silent TTL on someone's quote history would be a betrayal. |
| **Q11** | **Quote status** (enviado · aceito · recusado) | (a) **OUT of E4** · (b) minimal status field in E4 | **(a) OUT** (75%). It is a *pipeline/CRM* domain, not history, and it would smuggle a new lifecycle into an epic whose whole point is immutability. Strong backlog candidate for E5+. |
| **Q12** | **Does recording a snapshot materialize anything** (à la E3 K3)? | (a) **No** — recording is inert on the catalog · (b) yes, mirror K3 | **(a) No** (90%). E3 materializes because a kit *reuses* pieces; a snapshot is a **record**, and records must not mutate the world they describe. Also protects SC-505. |
| **Q13** | **Seller identity on the exported quote** — a customer-facing quote needs a "from", and today **no seller-profile data exists** beyond the Google account. | (a) Account **name + e-mail** only (zero new data) · (b) + an optional free-text **"Nome do negócio / contato"** field in Conta · (c) + **logo upload** | **(b)** (80%). (a) produces an anonymous-looking PDF; (c) drags in file storage, moderation and a whole asset pipeline. (b) is one text field for a large credibility gain. **This is a real gap I found — nothing in E1–E3 models the seller.** **→ OWNER DECIDED 2026-07-12: (a) name + e-mail only — no new seller data in E4. OVERRIDES this recommendation; the quote prints the personal login e-mail and the seller-identity gap stays consciously open. See §0.** |

---

## 11. Dependencies

- **E2 (007)**: entitlement gate (ADR-0012), per-account isolation, offline read-cache + purge-on-signout,
  `ENTITLEMENT_REQUIRED` vocabulary, lapse freeze policy — all reused verbatim.
- **E3 (008)**: `computeBom` results are recordable payloads (Q2); ADR-0015's honesty clause is the precedent for
  any client-side export gate.
- **E1 (004/005)**: `PRICING_MODEL_VERSION` + the ADR-0008 rounding/freezing contract — the reason snapshots are
  reproducible without a backend recompute.
- **A29** (`docs/decisions/audit-findings-r2.md:71`) is **closed by Q3** in this epic.
- **Histórico tab** already exists as an honest placeholder (`apps/web/src/pages/historico/historico-page.tsx`,
  copy "Histórico em breve") — E4 fills it; the IA does not change (no new nav tab).
