# Implementation Plan: E4 — Histórico + snapshots reproduzíveis + export

**Branch**: `feature/009-e4-history-snapshots-export` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-e4-history-snapshots-export/spec.md`

## Summary

E4 adds the product's **second shelf**. E1–E3 are all **live** — they answer *"quanto isso custa **hoje**?"*.
E4 answers *"quanto eu **cobrei**, naquele dia?"*: an immutable **Histórico** of deliberately recorded price
snapshots, plus **export** of a snapshot as a customer-facing quote.

The centerpiece is the **two-shelf rule**: a snapshot **cannot degrade**, because it does not *reference* the
catalog for values — it **contains** them (ADR-0008 freezes `PRICING_MODEL_VERSION` + inputs + rounded lines).
Catalog links on a snapshot are **provenance only**; editing or deleting a filament changes **0%** of existing
snapshots, with no degraded caption and no warning. This is the deliberate opposite of E2/E3's live-reflect +
read-time degradation (ADR-0017 §6), and E4 must do it **without contradicting them**.

Four owner decisions shape the build (spec §Clarifications — three dated sessions):

- **Recording works OFFLINE** (Q8, flipped) — the product's **first offline write**. Outbox in IndexedDB,
  exactly-once sync via a device-minted idempotency key + a DB unique constraint, an honest **pending** state,
  and the **entitlement checked AT SYNC** (the server stays the authority). **ADR-0018.**
- **The snapshot's date is the DEVICE clock** (FR-528) — an owner-accepted integrity limitation: the server
  stores a timestamp it cannot verify. It must **not** be silently "fixed" with a server clock.
- **Immutability is enforced in the database** — a `BEFORE UPDATE` trigger, the project's **first PL/pgSQL**
  (owner-approved), plus no-PUT + an ORM guard. **ADR-0019.** Provenance carries **NO foreign key** (both
  specialists reached this independently — see below).
- **Export is SERVER-rendered** behind an active-entitlement gate, so FR-515 ("denied on lapse, no partial
  artifact") is real rather than a client route-guard. Accepted consequence: **export requires a connection**.
  **ADR-0020.**

`pricing-core` **does not change** (90%, verified in code — stays **3.1.0**); persistence adds one table
`snapshots` via migration **`0003`**. All E1/E2/E3 guarantees hold unchanged.

## Technical Context

**Language/Version**: TypeScript (React 19 / Vite / pricing-core, Node 24) + Python 3.12 (FastAPI, uv).

**Primary Dependencies**: pricing-core **3.1.0 (unchanged)**, TanStack Router/Query, Zustand, RHF+Zod, `tf-*` DS,
`idb-keyval` (already shipped — reused for the outbox); FastAPI, SQLAlchemy 2.0 typed, Alembic, psycopg3.
**New backend dependency: a PDF renderer — to be VERIFIED and pinned at implementation, not assumed** (ADR-0020
§5; candidates WeasyPrint / ReportLab / fpdf2, judged on: no native deps > DS fidelity > licence).

**Storage**: PostgreSQL — one new table `snapshots` (typed columns + a `payload` JSONB frozen document),
migration `0003` (`down_revision = "0002"`), including the immutability trigger.

**Testing**: vitest (outbox engine, merge selector, snapshot render), Playwright e2e (offline record → sync →
reopen; catalog churn inert; lapse denies export), pytest (POST idempotency/dedup, immutability trigger, gate,
isolation, lapse, export content rules), import-linter, basedpyright, ruff.

**Target Platform**: mobile-first responsive web + desktop web (Android later); **offline-capable recording**,
online-only export.

**Project Type**: web (pnpm monorepo — `apps/web`, `backend`, `packages/pricing-core`).

**Performance Goals**: instant client-side render of a stored snapshot (**zero recomputation** — SC-501); keyset
pagination over an unbounded history.

**Constraints**: camelCase wire, **money as decimal STRINGS end-to-end** (JSONB money leaves are strings — see
the trap below); `pnpm gate:all` parity; contract drift-guard 0 diff; FSD-Lite boundaries; failing-first tests;
owner-gated PRs into `develop`; deploy deferred to v1; exact R$ prices deferred to E6.

**Scale/Scope**: 7 user stories; **1** new table; **0** pricing-core changes; ~7 REST routes (incl. 2 export);
a new history feature module + the first offline-write machinery; 3 owner-gated PR slices.

### The money trap, recorded (data-model D1)

PostgreSQL stores a JSON number as `numeric` **without precision loss** — but **`json.loads` (Python) and
`JSON.parse` (JS) hand back `float`**. The loss is in the *serializer*, silently, app-side. Therefore **every
money / quantity / percentage leaf in the frozen payload is a decimal STRING** (`"187.35"`); the only JSON
numbers are integer counts. The export prints the **stored string** — no float ever enters the path (FR-525).

## Constitution Check

*GATE: evaluated pre-Phase 0 and re-affirmed post-Phase 1.*

- [x] **I. Scalability & Quality First** — the outbox generalises to any future offline write (E5 scenarios) with
      zero new dependencies; one server-side renderer serves web + desktop + the future Android WebView.
- [x] **II. Truth Over Approval** — the honesty seams are explicit and *named*: a queued entry is **"pendente"**,
      never "salvo" (a lost response is **not** the same as not saved); export offline is **disabled with its
      reason**, never faked; the device-stamped date is recorded as an **owner-accepted, unverifiable** claim, not
      dressed up. Confidence carried on every decision (R1 85%, R2 72%, R3 85%, R4 90%; D1 85%, D3 88%, D6 88%).
- [x] **III. Test-First** — outbox exactly-once (restart/retry/two-tab), the immutability trigger, catalog-churn
      inertness (SC-502), and the export content rules are written **failing-first**; qa-produto homologates the
      offline→sync→reopen walk before done.
- [x] **IV. Server-Side Entitlements (NON-NEGOTIABLE)** — persistence stays server-authoritative; the offline
      queue is a **client convenience**, and the entitlement is enforced **at sync** (FR-529): a denied entry is
      **blocked and visible**, never silently kept or dropped. **Export is the one E4 paywall a client cannot walk
      around** (ADR-0020) — and where enforcement is *not* possible, the plan says so (below), rather than
      implying it.
- [x] **V. Clean Architecture Integrity** — reuses the entitlement seam (ADR-0012), the persistence stack
      (ADR-0013), the uid-keyed cache substrate and purge-on-signout. **Where the house pattern is the wrong fit,
      it is broken deliberately and recorded**: typed-columns-per-line (would force an `ALTER TABLE` per future
      formula line, forever, on rows that may never be touched) and FK provenance (see ADR-0019) are both
      rejected with reasons, not copied out of habit.
- [x] **VI. Lean Living Documentation** — the spec was **corrected** where the plan round proved it wrong (FR-528
      claimed an unachievable property; FR-505 was ambiguous). What became false was rewritten, not appended
      around.
- [x] **VII. Spec-Driven Flow** — specify → clarify (5 questions, 1 flip) → plan (this, with the Constitution
      Check) → `/speckit-tasks` next.
- [x] **VIII. Architecture Decided Before Implementation (NON-NEGOTIABLE)** — every structural choice traces to an
      owner decision + an ADR: R1→**ADR-0018**, R3/D1–D6→**ADR-0019** + `data-model.md`, R2→**ADR-0020**;
      R4 (pricing-core unchanged) **verified against the code**, not assumed. Each surfaced ≥3 options with
      confidence for the owner. Nothing in these areas inferred.

**Result: GATE PASS.** Complexity Tracking below is **not** empty — one deliberate deviation is recorded.

### Where enforcement is honestly NOT possible (Principle II + IV, stated, not buried)

1. **The snapshot's date is unverifiable** (FR-528) — owner decision, recorded for the security review to judge
   as a decision, not discover as a bug.
2. **The snapshot's VALUES are client-authored, and this is NEW.** E2/E3 store **inputs and never a price**; E4
   is the **first time client-computed money is persisted**, and the server **cannot verify it** — by design it
   has no engine (ADR-0008). Acceptable today: a snapshot is the seller's assertion about their own quote,
   readable only by them — they can only lie to themselves. **What it constrains:** any future feature treating a
   snapshot as proof *toward a third party* (fiscal export, dispute, marketplace integration) would need
   server-side verification and would **reopen ADR-0008**.
3. **The compute paywall stays soft** (ADR-0015, unchanged) — but the **export** paywall is not (ADR-0020).
4. **A queued snapshot is a *request*, not a *save*** — the client never authorises a write.

## Project Structure

### Documentation (this feature)

```text
specs/009-e4-history-snapshots-export/
├── plan.md              # this file
├── spec.md              # feature spec (3 dated owner-decision sessions in Clarifications)
├── research.md          # Phase 0 — R1..R4 (arquiteto)
├── data-model.md        # Phase 0 — D1..D6 + the snapshots table (dev-estrutura-de-dados)
├── contracts/
│   └── api-surface.md   # /api/v1/history REST surface (+ the export endpoints)
├── quickstart.md        # validation scenarios
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root)

```text
packages/pricing-core/          # UNCHANGED (3.1.0) — verified, not assumed (research R4)

backend/
├── app/
│   ├── models/__init__.py      # + Snapshot (typed columns + payload JSONB; ORM before_update guard)
│   ├── api/history.py          # POST (idempotent) · GET list · GET /{id} · PATCH label-only · DELETE
│   ├── api/export.py           # GET /{id}/quote.pdf · GET /export.csv — require_entitlement(ACTIVE)
│   └── services/quote_render.py # prints stored values — ZERO arithmetic (ADR-0020 §1)
├── alembic/versions/0003_e4_snapshots.py   # table + indices + immutability TRIGGER (down_revision "0002")
└── tests/test_history.py · test_export.py  # failing-first

apps/web/src/
├── features/history/           # record action, snapshot detail (renders STORED values), "Recalcular hoje"
├── entities/history/
│   ├── outbox.ts               # idb-keyval store `history:outbox:{uid}` — the offline queue (ADR-0018)
│   ├── sync-engine.ts          # drain triggers, backoff, Web Locks single-flight, blocked-on-403
│   └── use-history.ts          # the ONE selector: (server list) ∪ (outbox), deduped on clientSnapshotId
├── pages/historico/            # fills the existing honest "em breve" placeholder — NO new nav tab (FR-524)
└── shared/api/generated.ts     # regenerated (raw Orval)
```

**Structure Decision**: extend the existing pnpm-monorepo web layout. A new `feature/history` + `entities/history`
pair mirrors the E2/E3 FSD-Lite layering. **The pending union is structural, not cosmetic**: no component may read
the server query alone — the merged selector *is* the list (ADR-0018 §8). This is the direct answer to the E3
PR-C lesson: *a correct component starved of correct data still lies.*

## Complexity Tracking

> One deliberate deviation from a shipped promise, recorded rather than hidden.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **First PL/pgSQL in the project** (immutability trigger) — E2 §0 had promised "tables / CHECK / RLS only" | SC-504 claims **0** write paths can alter a snapshot — an invariant about **future** code (E5/E6 will write near this table). A trigger makes it demonstrable **in the DB**. Owner-approved 2026-07-12. | A `CHECK` **cannot** express it (it never sees the old row). App-only enforcement (Option B, 60%) would reduce SC-504 to "0 write paths *in today's code*" — and the plan would have to say so in those words. |
