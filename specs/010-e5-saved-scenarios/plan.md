# Implementation Plan: E5 — saved marketplace scenarios (the fourth object)

**Branch**: `feature/010-e5-saved-scenarios` | **Date**: 2026-07-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-e5-saved-scenarios/spec.md`

> **STATUS: architecture round complete; Constitution VIII gate resolved, pending owner homologation.** The two
> specialists (arquiteto + dev-estrutura-de-dados) ran in parallel and **independently converged** on N1/N2; the
> decisions are recorded in **ADR-0021 (Proposed)** + `research.md` + `data-model.md`, and `pricing-core` is
> **verified** unchanged (R-A, 92% — against the source, not assumed). Design artifacts (`research.md`,
> `data-model.md`, `contracts/api-surface.md`) are generated. Per the E3 ADR-0017 precedent, ADR-0021 stays
> **Proposed** until the owner homologates it at the **PR-A gate**; three points are surfaced for that homologation
> (config-edit route, kit-basis composition Q12, save-to-deleted-id Q13). `/speckit-tasks` has since generated
> `tasks.md` (39 tasks, 3 owner-gated PR slices) and `/speckit-analyze` passed clean (2026-07-19, 0 critical);
> implementation may start, with the owner decisions due at the PR-A gate (**tasks.md T002** — answer before
> T006/T007 to avoid reworking the migration CHECKs/index).

## Summary

E5 adds the product's **fourth** persistent object: a **saved marketplace scenario** — the **live mirror of a
frozen E4 snapshot**. E1/005 already ships the live multi-channel calculator (price one product across ML / Amazon /
Shopee at once, fees from the dated catalog). E5 lets a **premium** seller **save that configuration as a named,
re-runnable scenario** — channel set + explicit fee overrides + include/exclude framing + cost basis + Outros
custos — that on reopen **re-computes against today's catalog/fees/formula** (LIVE), can be **duplicated to
tweak-and-compare**, renamed, searched, deleted, and (P3) **frozen into an E4 snapshot**.

The centerpiece is the **four-object map**: where an E4 snapshot **contains** its values and cannot degrade, a
scenario **references** the catalog and **re-resolves** live — it is the deliberate opposite, and it must reuse
E2/E3's live-reflect (D3) + read-time last-known degradation (D6, ADR-0017 §6) **verbatim**, not reinvent them.

Three clarifications shape the build (spec §Clarifications, session 2026-07-17):

- **Freeze intent, resolve values live (Q3)** — the scenario stores the channel set, determinant choices and the
  seller's **explicit** per-slot fee overrides; **non-overridden** fees and catalog references **re-resolve** from
  today's catalog on reopen. This is what makes it live without discarding the seller's strategy.
- **Online-only writes (Q4)** — a scenario save requires a connection and fails **honestly** offline; **no offline
  outbox** (the E4 ADR-0018 machinery is deliberately *not* reused — a scenario is a desk analysis, not fair-booth
  quoting). Offline **read/reopen** is reused from the E2 cache.
- **Cost basis = both (Q2)** — an ad-hoc piece-input set **or** a Product/Kit reference; a reference live-reflects
  (D3) and degrades to last-known (D6), exactly like an E3 kit line.

**E5 is structurally *lighter* than E4**: no immutability trigger (a scenario is **mutable** — editable config,
renameable), and no offline-write machinery (online-only). It reuses the shipped stack almost entirely; the genuine
new surface is **one table** + **its config-payload shape** + **how a cost-basis reference is modeled**. Q1 is
settled: **per-account live fee auth (Shopee OAuth, AliExpress) is OUT** — deferred to its own future increment.

`pricing-core` **does not change** (verified against source, 92%): the engine (`3.1.0`) takes **already-resolved**
channels, and fee resolution + the override model already ship client-side (`fee-prefill.ts` — the shipped
`processSlot` logic **is** Q3). E5 stores determinants + overrides and re-resolves live, so it never needs a frozen
resolved fee. (Two premise corrections from the round: the version is `3.1.0` not 3.0.0; `ChannelResult` does not
carry `resolvedFee` — deferred to E4 per the ADR-0011 Amendment. Neither dents the conclusion.)

## Technical Context

**Language/Version**: TypeScript (React 19 / Vite 8 / pricing-core, Node 24) + Python 3.12 (FastAPI, uv).

**Primary Dependencies**: `pricing-core` **3.1.0 — verified unchanged** (R-A, 92%); TanStack Router/Query,
Zustand, RHF+Zod, `tf-*` DS, `idb-keyval` (reused for the offline **read** cache only); FastAPI, SQLAlchemy 2.0
typed, Alembic, psycopg3. **No new runtime dependency anticipated** (contrast E4, which added a PDF renderer).

**Storage**: PostgreSQL — **one new table `scenarios`** (per-account, soft-delete, mutable), migration **`0004`**
(`down_revision = "0003"`; `0001`/`0002`/`0003` are shipped and never amended — ADR-0013 R4). The **column vs
payload split** and the **cost-basis reference modeling** are **decisions N1/N2 (below), not yet made.**

**Testing**: vitest (the save→reopen→recompute round-trip; duplicate independence; the D3/D6 reconciliation on a
referenced basis; override-stickiness vs fee-refresh), Playwright e2e (save → reopen-live → duplicate → lapse
read-only; offline read + honest offline-save failure), pytest (scenario CRUD, entitlement gate + `ENTITLEMENT_REQUIRED`,
per-account isolation, lapse write-denial + read/recompute survival, materializes-nothing), import-linter,
basedpyright, ruff. All **failing-first** (Principle III).

**Target Platform**: mobile-first responsive web + desktop web (Android later). **Offline read/reopen** (from the
uid-keyed cache); **online-only writes** (Q4).

**Project Type**: web (pnpm monorepo — `apps/web`, `backend`, `packages/pricing-core`).

**Performance Goals**: instant client-side live-recompute of a reopened scenario (runs the existing 005 engine, no
new hot path); keyset pagination over an unbounded per-account scenarios list (E4 precedent).

**Constraints**: camelCase wire; **money/percentage leaves as decimal STRINGS end-to-end** (the E4 money-in-JSONB
rule — `json.loads`/`JSON.parse` hand back floats; the DB keeps `numeric` — so any JSONB config payload obeys the
same string invariant); `pnpm gate:all` parity; contract drift-guard **0 diff** (regen Orval + prove idempotence
after any route change — the drift-guard fires on docstring edits too); FSD-Lite boundaries; owner-gated PRs into
`develop`; deploy deferred to v1; exact R$ prices deferred to E6.

**Scale/Scope**: 7 user stories (US7 P3/droppable); **1** new table; **0** pricing-core changes expected (verify);
~7 REST routes (`POST` · `GET` list · `GET /{id}` · `PUT` full-replace · `PATCH` rename · `POST /{id}/duplicate` · `DELETE`); a
new `scenarios` feature module reusing the E2 offline-read + purge-on-signout substrate; **3 owner-gated PR slices**
(spec §8 / brief: PR-A save+list+teaser · PR-B live-contract + duplicate + manage/lapse · PR-C the E4 bridge).

### The money-in-JSONB rule, inherited (if N1 lands on a payload)

If the config is stored as a JSONB document (N1), every money/quantity/percentage leaf MUST be a **decimal string**
(`"12.50"`), never a JSON number — identical to E4's `snapshots.payload` and today's `products.channels`. The loss
is at the serializer boundary, silent and app-side; the DB `numeric` is not the problem. This is a **decided house
invariant**, not a new decision — it constrains whatever N1 chooses.

## Constitution Check

*GATE: must pass before Phase 0 research. **Principle VIII is currently OPEN** — see below.*

- [x] **I. Scalability & Quality First** — reuses the shared pricing-core engine (web + Android + i18n from one
      core); a scenario adds no new compute path. No scalability/quality trade without an ADR.
- [x] **II. Truth Over Approval** — the honesty seams are named and reused: a reopened scenario shows **today's**
      numbers with the 005 staleness seal when offline/stale (never stale-as-live); a deleted referenced basis uses
      the E2/E3 **last-known** caption (never a "removido" claim); an offline save **fails honestly** (never a fake
      "salvo!"). Confidence carried on the open decisions (N1 ~80%, N2 ~80%, R-A ~85%).
- [x] **III. Test-First** — logical (round-trip, duplicate independence, D3/D6 reconciliation, isolation, lapse) +
      visual (qa-produto homologates the save → reopen-live → duplicate walk) planned failing-first.
- [x] **IV. Server-Side Entitlements (NON-NEGOTIABLE)** — persistence is server-authoritative (ADR-0012 reused, no
      new gate); the **live recompute** on reopen runs **client-side** in pricing-core, so the compute guard is an
      honest client route-guard over server-gated data (ADR-0015 precedent) — the plan/UI MUST NOT imply the
      recompute itself is server-enforced. Lapse: reads/recompute survive, writes denied server-side (FR-612).
- [x] **V. Clean Architecture Integrity** — reuses the entitlement seam (ADR-0012), persistence stack (ADR-0013),
      the D3/D6 reference-degradation semantics (ADR-0017 §6), the uid-keyed read cache + purge-on-signout, and the
      005 compute. **The two genuinely new data-layer choices (N1/N2) are routed to a decision, not copied by
      habit** — the E4 lesson (copy the house pattern only where it fits).
- [x] **VI. Lean Living Documentation** — spec was updated in the same increment (clarify session); no superseded
      rules introduced; the four-object map lives in the spec, not duplicated here.
- [x] **VII. Spec-Driven Flow** — specify → clarify (3 questions resolved) → **plan (this — stopping at the VIII
      gate)** → architecture round → `/speckit-tasks`.
- [x] **VIII. Architecture Decided Before Implementation (NON-NEGOTIABLE)** — **RESOLVED, pending owner
      homologation.** The three E5-specific structural choices were decided in the parallel architecture round (≥3
      options + confidence each), recorded in **ADR-0021 (Proposed)** + `research.md` + `data-model.md`;
      `pricing-core` was **verified** against the source (not assumed). Nothing inferred. Per the E3 ADR-0017
      precedent, ADR-0021 stays **Proposed** until the owner homologates it at the **PR-A gate**; three residual
      points (config-edit route, kit-basis composition Q12, save-to-deleted-id Q13) are surfaced for that gate.

**Result: GATE PASS (Principle VIII), ADR-0021 Proposed → owner-homologated at PR-A.** Phase 0/1 artifacts
(`research.md`, `data-model.md`, `contracts/api-surface.md`) are generated; `quickstart.md` follows at the same
homologation. Complexity Tracking below records **one** deliberate idiom-break (JSONB for a mutable entity).

### The E5 architecture decisions — RESOLVED (independently converged across both specialists)

- **N1 — config payload shape → HYBRID (typed metadata columns + one JSONB `config`), 80–82%.** Both specialists
  chose it independently. Typed columns for what the DB queries/orders (owner, `name`, `note`, timestamps,
  soft-delete) + one `config JSONB NOT NULL` (money leaves = decimal strings). Fully-relational (Opt B, 40%)
  re-implements `bom_lines` for the polymorphic basis with zero required queryability; typed+channels-JSONB (Opt C,
  45%) can't express the polymorphic Product/Kit basis. A scenario is mutable, but nothing queries *inside* the
  config and it edits as a whole. **Recorded as a Constitution-V idiom-break in ADR-0021 + Complexity Tracking.**
- **N2 — cost-basis reference → soft `{kind, refId, refName, snapshot}` in `config`, NO foreign key, read-time
  D3/D6, 82–85%.** Both specialists converged on **no FK**, for two independent reasons — the basis is polymorphic
  (one column can't FK two tables) and `ON DELETE SET NULL` is **dead machinery** under the shipped soft-delete
  (the verified E3 finding). Reuses the ADR-0017 §6 `_resolve_views` owner+live filter (→ D3 live / D6 last-known) +
  `_snapshot_line` re-capture on every save (lossless D6). The recompute stays client-side (FR-619).
- **N3 → YES: ADR-0021** (`docs/adr/0021-scenario-persistence-live-reference-model.md`, Proposed, ≥3 options),
  extending ADR-0013/0017. **R-A verified in source:** `pricing-core` is `3.1.0` and needs **no change** (92%) — the
  fee resolver + override model already ship client-side and the engine takes already-resolved channels.

## Project Structure

### Documentation (this feature)

```text
specs/010-e5-saved-scenarios/
├── plan.md              # this file (VIII gate resolved; ADR-0021 Proposed)
├── spec.md              # feature spec (clarify session 2026-07-17: Q2/Q3/Q4 resolved)
├── research.md          # Phase 0 — R-A (pricing-core verified 3.1.0) + N1–N3         [DONE — arquiteto]
├── data-model.md        # Phase 1 — scenarios table + N1 hybrid + N2 no-FK            [DONE — dev-estrutura]
├── contracts/
│   └── api-surface.md   # /api/v1/scenarios REST surface                              [DONE — arquiteto]
├── quickstart.md        # validation scenarios (decided params baked in)              [DONE — 2026-07-19]
└── tasks.md             # Phase 2 — /speckit-tasks (NOT created here)
```

### Source Code (repository root) — proposed layout (mirrors E2/E3/E4 FSD-Lite)

```text
packages/pricing-core/          # UNCHANGED (3.1.0) — verified against source (R-A, 92%)

backend/
├── app/
│   ├── models/__init__.py      # + Scenario (per-account, soft-delete, mutable; shape per N1)
│   └── api/scenarios.py        # POST · GET list (keyset) · GET /{id} · PUT full-replace · PATCH rename · POST /{id}/duplicate · DELETE — all require_entitlement
├── alembic/versions/0004_e5_scenarios.py    # the scenarios table (down_revision "0003")
└── tests/test_scenarios.py     # failing-first (CRUD, gate, isolation, lapse, materializes-nothing, duplicate)

apps/web/src/
├── features/scenarios/         # save action, scenarios list, reopen→live recompute, duplicate, rename/delete, teaser
├── entities/scenario/
│   └── use-scenarios.ts        # server list + uid-keyed offline READ cache (reused substrate), purge-on-signout
├── pages/ (IA per Q11 — inside Calcular is the working default; final placement → designer-ux)
└── shared/api/generated.ts     # regenerated (raw Orval)
```

**Structure Decision**: extend the existing pnpm-monorepo web layout with a `features/scenarios` + `entities/scenario`
pair mirroring the E2/E3/E4 FSD-Lite layering. The reopen path **reuses the 005 multi-channel compute** and the
E2/E3 D3/D6 degradation — the scenario module orchestrates persistence + live-recompute, it does not re-implement
pricing. Final nav/IA placement (Q11) is a `designer-ux` + owner call; the behavioral requirement (save/load/list
reachable from the multi-channel calculator, FR-615) is fixed.

## Complexity Tracking

> The architecture round chose **one** deliberate deviation from the house idiom, recorded here (ADR-0021). E5 is
> otherwise simpler than E4 (no immutability trigger, no offline outbox).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **JSONB `config` document for a MUTABLE entity** — the house idiom (`products`/`boms`) is typed columns + child tables for live, editable rows; ADR-0021 stores the scenario strategy as one JSONB document instead. | The config edits as a **whole** (full-replace `PUT`), **nothing queries inside it**, and the cost basis is **polymorphic** (ad-hoc / Product+snapshot / Kit+N-line-snapshots) — a shape one relational schema can't hold without re-implementing `bom_lines`. The stored **intent** is version-independent (no `ALTER` per future formula line). Owner-homologated via ADR-0021 at PR-A. | Fully-relational (Opt B, 40%) re-implements the link-or-snapshot machinery for zero required queryability + two dead `SET NULL` FKs; typed+channels-JSONB (Opt C, 45%) can't express the polymorphic basis. "Typed is stricter" collapses at the first sub-list (`channels[]`, `otherCosts[]`, kit lines). |
