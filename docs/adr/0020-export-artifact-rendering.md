# ADR-0020: Export artifact rendering — server-rendered PDF/CSV behind an active-entitlement gate

- **Status**: Accepted (owner, at the E4 PR-C gate — 2026-07-17, PR #20 `e10b49f`)
- **Date**: 2026-07-12 (accepted 2026-07-17)
- **Deciders**: Jonatan (owner) + arquiteto, 2026-07-12
- **Relates**: ADR-0008 (backend never recomputes) · ADR-0012 (entitlement) · ADR-0015 (enforcement honesty)

## Context

E4 exports a snapshot as a customer-facing **PDF quote** and the history as a **CSV** (Q5). Owner decisions:
export requires an **ACTIVE** entitlement — *"lapsou ⇒ read-only no app, sem export"* (Q6, FR-515, denial with
**no partial artifact**); there is **no free export**, not even of an ephemeral calculation (Q7); internal cost
lines are **omitted unless the seller opts in** (Q4 / FR-512); and a kit quote **itemizes its pieces** (SC-515).

Where the artifact is rendered decides two things the spec explicitly routed to the plan: (a) whether export works
**offline**, and (b) whether the export gate is **server-enforceable** or is an honest client route-guard.
ADR-0015's honesty clause binds us: *the spec MUST NOT imply server enforcement where there is none.*

The tension that makes this non-trivial: FR-517 keeps snapshots **readable on lapse**, and the read cache lives on
the device — so a lapsed user legitimately **holds the data**. Any client-side renderer could therefore produce the
artifact without the server's consent.

## Options considered

### Option A — Server-rendered PDF + CSV behind `require_entitlement` (ACTIVE only) — CHOSEN
- **Pros:** **FR-515 is really enforced** — the artifact cannot exist unless the server made it, so "denied on
  lapse, no partial artifact" holds by construction (200-with-file or 403-with-nothing); FR-513 ("exported rows
  equal the stored snapshots exactly — no re-derivation, no drift") is true because the renderer reads the stored
  row and **prints** it; one renderer serves web + desktop + the future Android WebView; zero frontend bundle cost.
- **Cons:** export becomes **online-only**; a **pending** (unsynced) snapshot is not exportable until it syncs; a
  PDF toolchain enters the backend image.
- **Scalability impact:** high — one artifact, one renderer, one gate; a future e-mail/share path reuses it.
- **Confidence:** 72%

### Option B — Client-rendered (pdf-lib/jsPDF + JS CSV) with a server-informed route-guard — rejected
- **Pros:** export works **offline** (fits the fair persona the owner chose for *recording*); no backend PDF
  toolchain.
- **Cons:** the gate is **not server-enforceable** — the lapsed user holds the data (FR-517), so the artifact is
  producible without the server. FR-515 would have to be **reworded** as an honest client guard, which *weakens an
  owner decision (Q6) rather than implementing it*.
- **Confidence:** 55%

### Option C — Hybrid: server authorises, client renders — rejected
- **Cons:** still **online-only** (forfeiting B's only real advantage) **and** still unenforceable (cached data can
  be rendered without asking) — it takes A's cost and B's weakness.
- **Confidence:** 45%

### Option D — Split (CSV client-side, PDF server-side) — rejected
- **Cons:** two mechanisms, two honesty stories, a gate that is half real, and no coherent rule to explain.
- **Confidence:** 30%

## Decision

**Option A.** The owner accepted the online-only consequence explicitly (2026-07-12), knowing the deliberate
asymmetry it creates: **recording works offline for the seller at a fair; exporting does not.**

1. **The ADR-0015 precedent deliberately does NOT transfer.** What forced the soft boundary in E3 was that a
   server-side *compute* would **fork the canonical pricing engine** and break offline pricing (ADR-0008: *the
   backend never recomputes*). A **document renderer forks nothing**: the server prints **stored, already-rounded**
   values and performs **no arithmetic** — no formula, no markup, no gross-up. *(This holds only if the frozen
   payload contains every printed value, including each kit line's quantity-scaled money — which `BomResult`
   already produces. That is a hard requirement on the data model, and `data-model.md` D1 satisfies it.)*
   **"Backend never recomputes" stands, untouched.**
2. **Honest consequences, stated in the UI, never dressed up:** offline, the export affordance is **disabled with
   its reason** ("exportar precisa de conexão") — never a fake success; a **pending** snapshot is not exportable
   until it syncs ("sincronize para exportar") — *you cannot export a record the record-keeper has never seen*.
3. **Seller identity (FR-514 / Q13)** comes from the **verified ID-token claims** at export time (`name` +
   `email`). Verified: `Account` has **no display-name column** — and E4 adds **no new seller data**, so the name
   is read from the token, not stored. When the claim is absent (password accounts), the quote carries the e-mail
   only, which Q13 already accepts.
4. **Content rules are server-side and testable:** zero internal cost lines unless `includeCostBreakdown` is
   explicitly true (Q4 / FR-512 / SC-506); a kit quote itemizes every piece (name + quantity) with the total and
   still zero cost lines (SC-515); every artifact carries the **device record date** and the validity period.
5. **PDF library — VERIFIED and PINNED (T025, 2026-07-16; owner-ratified): `reportlab==5.0.0`** (the open-source
   BSD toolkit). Evaluated on the stated priority order — **no native deps > fidelity to the DS > licence** — with
   current facts re-verified per ADR-0008's precedent (*do not assume version facts remain current*):
   - **ReportLab 5.0.0 — CHOSEN.** Ships a **pure-Python `reportlab-5.0.0-py3-none-any.whl`** (the C accelerator is
     now the optional `rl_accel` extra), so it installs on the `python:3.12-slim` image with **no compiler and no
     `apt` layer**; runtime deps are `pillow>=9.0.0` + `charset-normalizer` (both pip wheels). Licence **BSD**
     (permissive). Python `>=3.9,<4`. Its Platypus flowables (Paragraph/Table/ParagraphStyle) give programmatic
     control for an itemized kit quote and are the most **deterministic/testable** fit for "the renderer PRINTS,
     never CALCULATES" (SC-506). Wins criteria 1 (no native deps) and 3 (licence); on criterion 2 it is close
     enough given criterion 1 eliminates the only better option. **Install base only** — the `rlPyCairo` /
     `freetype-py` (cairo) and `uharfbuzz` extras are NOT added; they would reintroduce native deps and are
     unneeded for a text+table quote.
   - **fpdf2 2.8.7 — fallback.** Also zero native deps (pure Python; Pillow/defusedxml/fontTools) and actively
     maintained, but **LGPL-3.0** (fine for server-side unmodified import, more encumbered than BSD) and a thinner
     layout engine. Adopt only if a ReportLab-specific blocker surfaces.
   - **WeasyPrint 69 — rejected.** Best DS fidelity (HTML/CSS → PDF) but requires the native **Pango + cairo +
     GDK-PixBuf + libffi** system libs, which **cannot be pip-installed** and would add an `apt` layer to the slim
     image — failing the top criterion. Reconsider only if the owner later prioritises pixel-DS-fidelity over image
     simplicity.

   **Deploy is deferred to v1, so an image change is cheap now and expensive later** — pinning the pure-Python pick
   now keeps the backend image `apt`-clean through the deploy increment.

## Consequences

- **Positive:** the export gate is **real** — the one paywall in E4 a client cannot walk around; artifact/record
  drift is impossible; one renderer for every platform; "no partial artifact" is structural, not a UI promise.
- **Negative / accepted:** **no offline export**; a pending snapshot is export-blocked until it syncs; the backend
  image gains a PDF dependency.
- **If the owner ever prefers offline export:** FR-515 **must be reworded** — the export gate becomes an honest
  client route-guard over data the lapsed user legitimately holds, and neither spec nor UI may imply server
  enforcement. That is a coherent product, but a **different product decision**, not an implementation detail.

### CSV formula injection — consciously accepted, 2026-07-17 (E4 close-out, `seguranca` review, 85%)

`build_history_csv` emits cell values **raw**: a `label` of `=SUM(A1:A9)` (or a `+`/`-`/`@`/tab/CR leader) reaches
the file verbatim. **No guard is added.** The reasoning, recorded because a future reader will otherwise "fix" it:

- **`label` is the only attacker-influenceable column.** `kind` and `headlineBasis` are CHECK-constrained enums,
  `deviceQuotedAt` is digit-leading ISO, `headlineTotal` is a numeric string (`-21.90` is a *number* to Excel, not
  a formula).
- **The author of the payload and the reader of the file are the same principal.** The export is owner-scoped
  (`require_entitlement` + the `owner_uid` predicate + `deleted_at IS NULL`, pinned by
  `test_one_account_can_NEVER_export_another_account_row`), and there is **no cross-account write path into a
  label** (`PATCH` is owner-scoped, `extra="forbid"`, label-only). Classic CSV injection needs attacker-controlled
  data reaching a **victim's** spreadsheet; here it is the seller's own text in the seller's own file — the shape
  of **self-XSS**. A seller who wants a formula in their spreadsheet can type one. **The guard would protect
  nobody**, so in this topology it is a borrowed checklist item, and saying so is the honest answer.
- **Every neutralization costs FR-513, measured not assumed.** A `'` prefix does **not** round-trip
  (`csv.DictReader` returns `'=SUM(A1:A9)` ≠ the stored label); quoting does not neutralize at all (Excel still
  evaluates `"=SUM(A1)"`). This module has already fixed FR-513's operative meaning twice — RFC4180 escaping and
  the offset re-anchoring both change bytes while **preserving the round-trip**. A prefix breaks it. So
  "guard only at render, the stored value is untouched" is a **rationalization, not a reconciliation**: the file
  would say something the seller never typed.
- **E4's own precedent cuts against the guard.** `_xml()` on the PDF path *raises* fidelity (without it the
  customer's quote silently lost `Vaso <grande>`); a `'` prefix *lowers* it. The standing rule is *never silently
  alter the seller's data*.

**Mandatory re-open triggers** (any one of these, and the preferred formulation then is a **write-boundary**
charset guard — the only FR-513-preserving one, since a stored value with no leader exports verbatim and safe —
or an `.xlsx` artifact for the cross-principal case):

1. **Any write to `snapshots.label` by a principal other than the exporter** — team/multi-member accounts; **D1–D4
   (ML ingestion)** populating a label from a Mercado Livre title/order; any snapshot/label import.
2. **Any export serving account A's rows to principal B** — e.g. the operator CLI (ADR-0012) gaining a ledger
   read/dump subcommand, or any support tooling.
3. **Any automated delivery of the CSV to a third party** — a scheduled/e-mailed bookkeeping export, or an
   accountant integration (adjacent to E6).
4. **The public shareable link** (Q5, today explicitly OUT) landing.

**Kept and pinned instead** (the FR-513-preserving half): the RFC4180 escaping that already round-trips is now
guarded by `test_a_label_with_quotes_commas_and_newlines_ROUND_TRIPS_exactly` — it was previously an *untested*
gift from `csv.DictWriter`, and the plausible next change (streaming this **unbounded** ledger instead of
`list(...)`-ing it) would have silently corrupted the file for every seller who typed a comma.
