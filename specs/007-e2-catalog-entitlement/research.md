# Phase 0 — Research: E2 — catalog + persistence + entitlement scaffolding

Architectural input for E2, produced by the **arquiteto**. The spec (`spec.md`) fixed five owner decisions
(Q1/Q2/Q3/Q5/Q6) that are **not reopened here**; it routed **one** to this phase — **Q4, the
entitlement-flag storage mechanism = the TD-005 ADR**. That is the centre of this document. Everything else
below is the structural work E2 forces for the first time (the first database, the first data-access layer,
the first authorization-carrying routes) — each surfaced as options with a recommendation, per **Principle
VIII** (structure/data-layer/standards are decided WITH the owner, never inferred).

Constitution tags used below: **[K]** = verified knowledge, **[I]** = reasoned inference, **[S]** =
speculation. Library capabilities that carry a claim are verified against current sources in the
**Dependency verification** appendix (Constitution II — never assumed).

Status of clarifications entering `/speckit-plan`: **0 open NEEDS CLARIFICATION**. Two structural choices
(TD-005 mechanism; data-layer stack) require the **owner's sign-off** before implementation — they are
recorded as recommendations here and listed in *Owner sign-off needed*; they are not ambiguities for the
plan phase to resolve.

---

## R1 — TD-005: the premium-flag mechanism (Q4 — the owner's decision) [CENTREPIECE]

**Decision (recommended, pending owner sign-off): Option B — an authoritative `entitlement` row in Postgres,
evaluated server-side on every protected operation; in-process caching DEFERRED until measured.** Confidence
**~88%**. A clean seam is left to evolve to Option C (a read-through token claim) *if and only if* per-request
latency is ever shown to matter — but E2 has no such evidence, and adding a second authority now would be
premature complexity (Principle V).

### Rationale (scored against the FIXED product constraints from the spec)

The spec froze the constraints that must judge the mechanism; the DB already exists for the catalog, so the
question is purely *where the authoritative bit and its metadata live*, not *whether a DB exists*.

| Fixed constraint (spec) | A — Firebase custom claim | B — Postgres row per request | C — hybrid (row + claim) |
|---|---|---|---|
| Metadata: source(beta/comp)+grantor+granted-at+expiry+revoked-at, **auditable** | Claim is a boolean-ish blob capped at **1000 bytes** and is *not* an audit log → still needs a DB table anyway | **Native**: columns + optional history row in the DB you already have | Native (row) + duplicated in claim |
| **Operator-only** grant | Admin SDK `setCustomUserClaims` from a script/endpoint | DB write from a CLI script or protected endpoint | Both writes must stay consistent |
| **Propagation ≤ 1 refresh**, honest UX in the window | Server sees the new claim only on **next token issue** (auto ≤ 1 h, or forced `getIdToken(true)`) — meets ≤1-refresh only if the client force-refreshes | **Instant** server-side (next request); the only "refresh" is the *client* re-fetching its plan indicator | Instant server-side; claim path still lags |
| **Q3 freeze — expiry ⇒ the check must evaluate expiration** | A boolean claim stays "premium" until the token expires; you must either bake `premiumUntil` into the claim and compare it, **and** for early revoke call `revokeRefreshTokens` + verify with `check_revoked=True` (an extra network call) or accept up to ~1 h stale | **The check reads `expires_at`/`revoked_at` live every request → expiry and early-revoke are honoured immediately**; exactly what Q3 needs | Correct only when it falls back to the row for the security-critical (revoke/expiry) case → the DB check happens anyway |
| **Auditability** | Elsewhere (DB) | In the DB, one place | In the DB (+ claim drift risk) |
| Runs under the **Firebase emulator** in dev/e2e | `setCustomUserClaims` is supported by the emulator **[K]**, but the propagation/force-refresh choreography must be reproduced in e2e | Entitlement does **not** touch Firebase at all — it keys off the already-verified `uid`; identical behaviour in emulator and prod | Emulator must exercise both paths |
| Cost per protected op | Zero DB query | **One PK lookup** (sub-ms; cacheable later) | Zero when claim fresh, one on fallback |

The decisive rows are **Q3 (expiry/revoke)** and **auditability**: the product *requires* the check to
evaluate expiration and early revocation immediately, and to record who/when/source. A signed token is a
**snapshot**; it is structurally the wrong place for a value that must change *now* and be *audited*. Option B
makes the authoritative decision instant, correct, and auditable, and it satisfies Principle IV textbook-style
(the client is never trusted; the server reads its own DB). The per-request cost is a primary-key lookup on a
tiny table — negligible, and trivially wrapped in a short-TTL in-process cache later if a real number ever
justifies it. Option A's apparent "no DB" win is illusory (audit forces a table regardless) and it fights the
Q3 requirement. Option C is the right *future* evolution (claim as a read-through cache) but is unearned
complexity in E2.

### Options considered

**Option A — Firebase custom claim on the ID token.** `setCustomUserClaims(uid, {...})`; the backend reads the
claim from the already-verified token (reuses `current_claims`), zero DB query on the hot path.
- Pros: fastest read; reuses the existing auth dependency; the claim is Firebase-signed so it cannot be forged
  (Principle IV holds).
- Cons: propagation lag (token lifetime ≤ ~1 h unless force-refreshed) **[K]**; a boolean claim cannot honour
  an arbitrary future `expiry` or an *early* revoke without either baking `premiumUntil` into the claim
  **and** paying `check_revoked` network cost, or accepting up to ~1 h of stale premium; the 1000-byte claim
  cap **[K]**; **audit still needs a DB table**, so "no persistence" is false.
- Scalability impact: excellent read scaling; poor fit for a value that must revoke/expire promptly and be
  audited — the property E2 actually needs.
- Confidence it satisfies E2's fixed constraints as a *sole* mechanism: **~60%**.

**Option B — authoritative `entitlement` row in Postgres, evaluated per request (cache deferred).** A
dependency loads the row for the verified `uid` and computes
`active = granted AND revoked_at IS NULL AND (expires_at IS NULL OR now < expires_at)`.
- Pros: single source of truth; **instant** expiry/revoke (Q3) and instant grant (propagation is effectively
  zero-refresh server-side); native audit; identical in emulator and prod; no token-refresh choreography;
  uses the DB E2 provisions anyway.
- Cons: one PK lookup per protected op (mitigable with a short-TTL uid-keyed in-process cache — deferred);
  entitlement decisions require the DB to be reachable (but the catalog needs the DB regardless, so this adds
  no new failure mode).
- Scalability impact: a PK lookup on a small table scales to well beyond the MEI-seller volume; the cache seam
  and Cloud SQL migration (R7) keep headroom without upfront cost.
- Confidence: **~90%** it is the cleanest fit for the fixed constraints.

**Option C — hybrid: authoritative row + short-TTL token claim as a read-through cache.** The row is truth +
audit; a claim mirrors it for a fast path, re-validated against the row when absent/expired.
- Pros: fast path + authoritative expiry/revoke/audit; a natural *later* optimization.
- Cons: two sources to keep consistent; Firebase token lifetime is fixed (~1 h) so a genuinely "short" claim
  TTL is not natively expressible — you bake `premiumUntil` and still hit the row for the revoke case, i.e.
  the security-critical path does a DB check anyway, negating the fast path where it matters; more moving
  parts in dev/e2e; no measured latency problem to justify it in E2.
- Scalability impact: best raw read-scaling, but the complexity is unearned at E2 volumes.
- Confidence the added complexity is justified *now*: **~55%** (good *future* evolution, ~85% if latency ever
  bites).

### Sub-decision R1a — how the OPERATOR grants (no admin UI in E2)

**Recommended: a CLI grant/revoke script** (e.g. `uv run python -m app.scripts.entitlement grant --uid … --source beta --expires 2026-09-01 --grantor jonatan`)
writing through the same models/migrations, recording grantor + source + expiry. Confidence **~80%**.
- Rationale: operator-only becomes *structural* (only someone with server/DB access can run it) — no network
  authz to get wrong, **no new route for Schemathesis to fuzz**, minimal surface (Principle V/VI). Fully
  auditable (writes the audit columns/history row).
- **Genuine owner sub-choice to confirm:** US2 scenario 4 ("a non-operator attempts the grant → denied") is
  satisfied *by absence of a path* under the CLI option (strongest possible form — there is nothing to call).
  If the owner instead wants a **demonstrable HTTP 403** for a non-operator, choose a protected admin endpoint
  (`POST /api/v1/admin/entitlements`, operator allowlist via `P3D_OPERATOR_UIDS`, `FORBIDDEN`), accepting the
  extra fuzzed route + authz surface. The arquiteto recommends CLI for E2 and deferring the admin endpoint to
  E6 (when a real remote operator console exists).

### Sub-decision R1b — how the CLIENT learns its plan (honest Conta surface, FR-304)

Today `entities/user/user.ts` deliberately carries **no** plan field and Conta shows a static "Gratuito". E2
must expose the **server-derived** plan so Conta is honest. Recommended: a dedicated
**`GET /api/v1/entitlement`** → `{ status, source, expiresAt }` (no `grantor` leaked to the user), uid-scoped,
single-responsibility, cacheable. Lighter alternative: extend `/me` with an `entitlement` sub-object (one
fewer round-trip, but couples identity + entitlement). Recommend the dedicated endpoint (entitlement will
grow); confidence **~70%**. The "≤ 1 refresh" honest-UX window (spec Edge Cases) then applies only to this
client fetch — a "recarregar / entre novamente" affordance on Conta, never a fake state.

### ADR-0012 skeleton (Proposed — number to be assigned after owner sign-off)

> Written here per the task; not yet created as a file in `docs/adr/`. On sign-off, lift into
> `docs/adr/0012-entitlement-flag-mechanism.md` (MADR/template.md), add the index row, and retire TD-005 from
> `audit-findings-r2.md`.

```
# ADR-0012: Entitlement flag mechanism (server-authoritative premium state)
- Status: Proposed
- Date: 2026-07-08
- Deciders: Jonatan (owner) + arquiteto (+ seguranca review)

## Context
E2 turns on Constitution IV (server-side entitlement). Persistence is Premium; grants are out-of-band
(beta/comp) until E6. The mechanism must: store grant metadata (source, grantor, granted-at, optional
expiry, revoked-at); be operator-only; propagate a grant/revoke within ≤ 1 refresh with honest UX; make the
authorization check EVALUATE expiry and early revocation (Q3 read-only-freeze depends on it); be auditable;
work under the Firebase emulator in dev/e2e. The E2 Postgres DB exists regardless.

## Options considered (≥3)
A — Firebase custom claim on the token (fast read; poor expiry/revoke + audit fit; token-lag). Conf ~60%.
B — Authoritative Postgres entitlement row evaluated per request; cache deferred. Conf ~90%.
C — Hybrid row + read-through claim (best read-scaling; unearned complexity at E2). Conf ~55% now.

## Decision
Option B. Authoritative row: (uid PK, status, source, grantor, granted_at, expires_at, revoked_at,
+ append-only audit trail). A FastAPI dependency `require_entitlement` reads the row for the verified uid and
computes active = granted ∧ ¬revoked ∧ (expiry null ∨ now<expiry); denies with ENTITLEMENT_REQUIRED (403)
otherwise. Grant/revoke via an operator CLI script (R1a). Plan exposed via GET /api/v1/entitlement (R1b).
In-process short-TTL uid cache is a documented FUTURE optimization (evolve toward C), not built in E2.

## Consequences
+ Instant, auditable, single-source entitlement; identical under the emulator; textbook Principle IV.
- One PK lookup per protected op (acceptable; cache seam left). Requires DB reachable (catalog needs it too).
- Follow-ups: entitlement schema in the R2 data layer; ENTITLEMENT_REQUIRED joins ErrorCode (R4);
  Cloud SQL migration posture (R7); seguranca signs off the deny-by-default + isolation tests.
```

---

## R2 — Data-access layer & migrations (Principle VIII — undecided anywhere)

**Decision (recommended, pending owner sign-off): SQLAlchemy 2.0 typed ORM (`Mapped` / `mapped_column`) +
Alembic migrations + the `psycopg` (v3) driver.** Confidence **~85%** on the ORM+migrations pair; the
**async-vs-sync** engine choice is a sub-decision (see R2a) at **~70%** for async.

### Rationale
- SQLAlchemy 2.0's typed declarative (`Mapped[...]` + `mapped_column()`) is designed for static type checkers
  and is tested against **Pyright** upstream **[K]** (see appendix) — it fits the `basedpyright strict` gate
  without a plugin (the legacy Mypy plugin is deprecated in 2.0). Pydantic v2 is already in the stack for the
  **wire** layer (`CamelModel`), and keeping ORM (DB) and pydantic (wire) as **separate** models is the clean
  separation E2 wants: the DB is snake_case; the wire is camelCase via `alias_generator` (ADR-0002). Mixing
  them (SQLModel) would entangle the two contracts.
- **Alembic** is the canonical, autogenerate-capable migration tool for SQLAlchemy and is the single schema
  authority — which is exactly what the **Cloud SQL migration** at v1-launch needs ("provision = run the same
  migrations", R7). Hand-rolling a migration runner (Option below) would be dead-weight to maintain and a
  Principle V liability.
- `psycopg` (v3) supports both **async** (`postgresql+psycopg://`) and **sync** — one driver covers the async
  app path *and* Alembic's (conventionally sync) migration path, minimizing dependencies. `asyncpg` is a fine
  alternative (faster, async-only) but then Alembic needs a second sync driver.

### Options considered
**Option A — SQLAlchemy 2.0 (typed) + Alembic + psycopg3.** Pros: mature; typed for strict pyright **[K]**;
autogenerate migrations; async-capable; clean ORM/wire separation; import-linter-friendly (a `app.db`/
`app.<domain>.repository` layer with explicit contracts). Cons: two model layers (ORM + pydantic) — modest
boilerplate; async sessions have sharp edges (R2a). Scalability: the standard, portable to Cloud SQL
unchanged. Confidence **~85%**.

**Option B — raw `asyncpg` + hand-written versioned SQL migrations.** Pros: minimal deps; full SQL control.
Cons: **reinvents migrations** (no autogenerate, no schema-diff safety) → maintenance liability and drift risk
(Principle V/VI); hand-mapped rows re-implement what an ORM gives typed; more surface to get isolation/`uid`
scoping wrong. Scalability: fine at runtime, poor at *engineering* scale. Confidence it's the right call:
**~25%**.

**Option C — SQLModel.** Pros: one model for DB + wire, terse. Cons: couples the ORM to the wire contract
(fights our snake↔camel + ErrorCode/Orval boundary); thinner/younger; historically laggy under pydantic v2 +
strict type-checkers **[I]**; Alembic integration is less first-class than plain SQLAlchemy. Scalability:
convenient early, constraining once the wire and storage shapes diverge (they already do — camelCase wire).
Confidence: **~35%**.

### Sub-decision R2a — async vs sync engine
- **Recommended: async SQLAlchemy** (`create_async_engine` + `async_sessionmaker`, `postgresql+psycopg://`)
  to match FastAPI's async-native request path and keep non-blocking headroom (Principle I). Alembic runs
  migrations with a **sync** engine (the common, well-supported pattern) even in an async app.
- **Honest alternative: sync SQLAlchemy in a threadpool** — the app already uses `run_in_threadpool` for the
  blocking Firebase verify, so a sync `Session` in a threadpool is *lower-risk* (no async-session/greenlet
  lifecycle pitfalls, simpler pytest fixtures) at E2's modest concurrency. Confidence async is worth its edges
  at E2 volume: **~70%** — a genuine owner/plan sub-decision, not an inference to make silently.

**Needs sign-off:** the ORM+migrations pair (A) and the async-vs-sync engine (R2a). Everything downstream
(models, repositories, import-linter contracts) depends on this — Principle VIII stops here until decided.

---

## R3 — Postgres in dev/CI without breaking `pnpm gate:all` (the pre-push constraint)

**Decision (recommended): DB integration tests use `testcontainers` (ephemeral Postgres) behind a
docker-availability skip guard; pure/unit tests (validation, mapping, entitlement predicate) never touch a
DB.** Confidence **~80%**.

### The constraint (verified from the repo)
`lefthook.yml` pre-push runs the **literal** `pnpm gate:all`, whose `gate:be` runs `uv run pytest -q`
locally. So any test that *requires* a live Postgres would break the push for a contributor who has no Docker
running. SQLite-in-memory is **not** a substitute: the dialect differs (JSONB, `ON CONFLICT`, server-side
defaults, types) and would let dialect-specific bugs through — rejected. **[K]**

### Options
**Option A — `testcontainers-python` + docker-availability skip guard.** A session-scoped fixture pings Docker
and `pytest.skip("Docker unavailable")`s the DB suite if it's down; CI's `ubuntu-latest` **has Docker**
(the repo already runs a `docker` image-build job), so the DB suite **always executes in CI** and only
*optionally* skips on a laptop without Docker. Pros: real Postgres (dialect-faithful); no compose file to
maintain; deterministic; pre-push stays green (visible SKIP count, not a broken push). Cons: **honest gap** —
a laptop without Docker skips DB tests locally, so a DB-breaking change is caught in CI rather than pre-push
(weakens D4's "no drift by construction" *for the DB slice only*); first run pulls the Postgres image
(cacheable). Confidence **~80%**.

**Option B — CI `services: postgres` + local `docker-compose`, tests read `P3D_DATABASE_URL`.** Pros: one
canonical Postgres per environment. Cons: pre-push `pytest` needs a running compose Postgres for *everyone*
→ breaks `gate:all` for anyone who hasn't started it (worse pre-push ergonomics than A); more moving parts.
Confidence **~45%**.

**Option C — SQLite-in-memory for tests.** Rejected — dialect divergence hides real bugs; violates
"test the thing you ship". Confidence **~10%**.

### Recommendation
Option A, made honest: mark the DB suite (`@pytest.mark.db`), skip-guard on Docker, and make **CI
authoritative** for it (Docker guaranteed on `ubuntu-latest`, so it never skips there). Keep the entitlement
*predicate* and pt-BR validation as **pure** unit tests that always run everywhere. This keeps pre-push fast
and unbroken while guaranteeing the DB path is exercised on every CI run. **Interaction with Schemathesis:**
the conformance stub keeps every fuzzed token **invalid → 401** (see `test_conformance.py`), so the fuzzer
never reaches the DB on the new write routes; DB round-trips live only in the marked testcontainers suite.
Flag for the plan: ensure this stays true so Schemathesis never writes to a real DB.

---

## R4 — E2 API surface (outcome-level)

**Decision (recommended):** three REST resources under `/api/v1` — `filaments`, `printers`, `products` —
each a small CRUD collection; **no pagination** in E2; add **one** new wire error code
`ENTITLEMENT_REQUIRED` (HTTP **403**); reuse the honest-contract machinery (`AUTH_ERRORS` + a new
`ENTITLEMENT_ERRORS` constant); regen Orval; new routes auto-enter `test_conformance`.

### Resources & shape
- `GET/POST /api/v1/filaments`, `GET/PATCH/DELETE /api/v1/filaments/{id}` (same for `printers`, `products`).
  All behind `current_claims` (401) **and** `require_entitlement` (403 `ENTITLEMENT_REQUIRED`). Per-account
  isolation is enforced by scoping every query to the verified `uid` (FR-307/SC-308) — never a client-supplied
  owner id.
- **Pagination — recommend NONE for E2.** A personal catalog is small (tens of filaments/printers; products
  bounded) and the offline read-cache (R5) stores the **whole** list per collection; pagination would
  complicate the cache for no benefit (YAGNI, Principle VI). Return the full list with a **stable sort**
  (e.g. `name`, tiebreak `created_at`) for deterministic order and cache diffing. If a power-user ever exceeds
  a few hundred, add cursor pagination later; the cache design (R5) should tolerate that shift. Confidence
  **~85%**.

### Error contract (honest, no phantom codes)
- Add **only** `ENTITLEMENT_REQUIRED` to `ErrorCode` (server enum → Orval TS union → pt-BR message map). HTTP
  **403** (authenticated but not entitled; 402 is reserved/unstandardized). **Do NOT** add `QUOTA_EXCEEDED`
  (free=0/premium=unlimited, R3 → no quota) or `CONFLICT` (writes are online-only, Q2 → no conflict) — the old
  `audit-findings-r2.md` §4 batch note is **superseded** by the spec's decisions; publishing unreachable codes
  would be a phantom (Principle II/VI). This corrects that note.
- `errors.py` currently states *"No 403 constant exists on purpose: no route has authorization logic yet."*
  **E2 is exactly when that changes** — add an `ENTITLEMENT_ERRORS = {403: ErrorEnvelope}` constant next to
  `AUTH_ERRORS` and declare it on every protected route. Because the CRUD routes now have **required body
  params**, they *can* fail real validation → per `main.py`'s `_strip_phantom_422` contract they **must
  DECLARE** `422: ErrorEnvelope` explicitly (not rely on the stripped phantom). So a write route publishes
  `{401, 403, 404?, 422, 500}` honestly. `GET/{id}`, `PATCH`, `DELETE` also declare **404 NOT_FOUND**.
- **Orval regen**: adding routes + the enum member regenerates `apps/web/src/shared/api` and the `ErrorCode`
  union; the `contract-drift` CI job enforces the regen; add the pt-BR string for `ENTITLEMENT_REQUIRED` to
  `shared/api/error-messages.ts` (honest teaser wording, no price/date — Q5/FR-312).

### Conformance impact (must be honest from day 1)
- `test_conformance.py` runs Schemathesis over **every published operation**, so the new routes are fuzzed
  automatically. With the token stub always invalid, they resolve to **401** — so every protected route must
  declare 401 (via `AUTH_ERRORS`) or conformance fails. The 200/403/404/422 branches are covered by targeted
  unit/integration tests (a valid-token seam in those tests only). Net: declare the full honest response set
  up front and conformance stays green; no phantom, no undocumented status.

---

## R5 — Offline read-cache for PRIVATE per-account data (Q2 = b)

**Decision (recommended): reuse the fee-catalog pattern (TanStack Query + IndexedDB via `idb-keyval`) — with
three deliberate differences forced by the data being private and per-account.** Confidence **~88%**.

The shipped `shared/fee-catalog` store (fetch → persist → seed, `refreshFailed` sticky latch) is the right
shape, but the fee catalog is **public reference data**. The user catalog is **private, per-account** — the
cross-user identity-leak lesson (the 2026-07-03 HIGH: `/me` cache read across accounts, fixed with a
uid-keyed query + sign-out purge) applies with full force:

1. **Key by `uid` — both layers.** The TanStack query key includes `uid` (like `use-identity.ts`
   `["me", uid]`) **and** the IndexedDB store key is uid-scoped (e.g. `catalog:{uid}:filaments`), never a
   single global key. A re-login as a different account can never read the previous account's cache.
2. **No seed.** The fee catalog bundles a seed for first-run offline; private data has **none** — first-run
   offline is an honest empty state (aligns with the shipped Catálogo empty-state and FR-312), never a
   fabricated pre-fill.
3. **Purge on sign-out.** Extend the existing sign-out cache purge to clear the uid's IndexedDB catalog
   stores (defence-in-depth beyond uid-keying, and reduces PII at rest on a shared device — LGPD-adjacent,
   R7). 
- **Writes are online-only (Q2):** the cache is a **read path only** — no write queue, no conflict code; an
  offline create/edit shows an honest "requires connection" state (FR-309), never a fake success.
- **Honest staleness:** when serving from cache without a successful refresh, surface a "pode estar
  desatualizado / offline" indicator, mirroring the fee-catalog `refreshFailed` latch (avoid the transient
  `'pending'` blink bug the latch already solved).
- **Lapse interplay (Q3):** on read-only freeze the cache still serves reads/pre-fill (FR-311); writes are
  blocked server-side (403) — the cache needs no special lapse handling beyond honest write-failure UX.

---

## R6 — FSD-Lite placement in the web app

Consistent with the repo (`entities/user`, `features/calculator`, `shared/fee-catalog`, `pages/*`) and the
eslint-boundaries / dependency-cruiser contracts (entities ⇏ features/pages; features → entities+shared;
pages compose features):

- **`entities/filament`, `entities/printer`, `entities/product`** — domain nouns: Zod schemas (reuse the
  calculator's per-field pt-BR validation so a saved value can never flow NaN/∞ into the engine — FR-306), the
  view-models, and each entity's **data hooks** (`use-filaments.ts` etc.) owning the uid-keyed query.
- **`features/catalog-crud`** (or per-entity `features/filament-crud`) — the create/edit/delete forms
  (RHF+Zod) + mutation hooks + the entitlement-gated affordances (honest teaser for free users, US7/Q5).
- **`features/catalog-prefill`** — the "pick a saved filament/printer to pre-fill the calculator" surface,
  composed by `pages/calcular`. Keep the existing `features/calculator` **free/offline/signed-out** untouched
  (FR-313/SC-310); pre-fill is an *additive*, entitlement-gated feature layered on top — it must never alter
  the compute path (byte-identical result, FR-308/SC-305).
- **`pages/catalogo`** — the Catálogo tab (already an honest empty-state from 003) extended to list/manage; the
  free-tier teaser attaches here and on each save affordance.
- **Boundary call to confirm (R6a):** the **generic uid-keyed IndexedDB primitive** (a thin wrapper over
  `idb-keyval`) is domain-agnostic → **`shared/offline-cache`** (keeps `shared` domain-free, like the idb
  usage today), while the **domain data hooks** live in each **entity** (they know the shape). Alternative:
  put the whole cache in `shared/catalog-cache` mirroring `shared/fee-catalog`. Recommend the split
  (shared primitive + entity-owned hooks) for FSD purity; confidence **~75%** — a placement the owner may
  simply ratify. Extend the depcruise + import-linter contracts for the new layers.

---

## R7 — Risks

- **Grant propagation.** Under the recommended Option B it is a *non-risk* server-side (instant); the only
  residual is the **client** plan-indicator refetch (≤1 refresh, honest "recarregar/entre novamente"). If the
  owner picks A/C instead, the ~1 h token-staleness + `getIdToken(true)` force-refresh choreography becomes a
  real risk to design and e2e-test.
- **Dev-DB → Cloud SQL at v1-launch (A41, deferred by Q6).** Keep the engine URL in settings
  (`P3D_DATABASE_URL`, never a hard-coded localhost); make **Alembic the single schema authority** so
  provisioning Cloud SQL = *run the same migrations*; use Postgres-portable features only (no local-only
  extensions); pool config in settings. Build **nothing** Cloud-SQL-specific now (Q6 defers it) but leave the
  seams so the v1-launch increment is wiring-only. Confidence this avoids a rewrite: **~85%**.
- **LGPD / retention of the Q3 freeze.** Frozen data is retained indefinitely, never auto-deleted; the 006
  privacy notice gains a "seus dados salvos" line when the catalog ships publicly (spec Out-of-Scope);
  user-initiated deletion + full LGPD stay deferred. Residual risk: retained PII (catalog names) with no
  self-service erasure — acceptable pre-public-deploy (nothing deploys until v1) but must sit on the LGPD
  backlog; the sign-out device-cache purge (R5) mitigates *local* PII at rest.
- **Isolation is security-critical (SC-308).** Every query scoped to the verified `uid`; add explicit
  cross-account negative tests (account B cannot read/write A's rows) and route them through `seguranca`
  review — this is the E2 analogue of the E1 identity-leak lesson.
- **Schemathesis vs a real DB.** Keep the conformance token stub invalid so fuzzing never reaches the DB
  (R3/R4); DB round-trips live only in the marked testcontainers suite.

---

## Owner sign-off needed (Principle VIII — decide WITH the owner before implementation)

1. **TD-005 mechanism** — recommend **Option B** (authoritative Postgres row, per-request check, cache
   deferred), ~88%. Sub-choices: **R1a** operator grant path = **CLI script** (recommended) vs protected admin
   endpoint; **R1b** client plan surface = dedicated **`GET /api/v1/entitlement`** (recommended) vs `/me`
   extension. → on sign-off, this becomes **ADR-0012** (skeleton above) and retires TD-005.
2. **Data-layer stack** — recommend **SQLAlchemy 2.0 typed + Alembic + psycopg3** (~85%), with **R2a
   async-vs-sync engine** (recommend async, ~70%) as the paired sub-decision. Everything downstream depends on
   this; Principle VIII stops implementation here until decided.

(The R3 test strategy, R4 API surface, R5 cache, R6 placement are arquiteto recommendations that follow from
the two decisions above and can be ratified in the plan; they are surfaced for visibility, not blocking the
owner.)

## Open questions for `/speckit-plan`

**None.** No NEEDS CLARIFICATION remain in the spec. The two items above are **owner decisions** (options +
recommendation presented), not planning ambiguities; once signed off they enter the plan as fixed inputs
(ADR-0012 + the data-layer ADR/decision note). The R6a placement and R2a engine choices are the only
low-stakes calls that could alternatively be ratified during planning.

---

## Dependency verification (Constitution II — verified, not assumed)

- **Firebase custom claims propagation/TTL** — new claims via `setCustomUserClaims` appear in the ID token on
  the **next** issued token; the token lasts **≤ ~1 h**, and `getIdToken(true)` forces an immediate refresh;
  claims payload capped at **1000 bytes**; the **Auth emulator supports** `setCustomUserClaims`. Verified
  against the Firebase Auth admin docs + firebase-tools-ui issue. **[K]** These facts drive the Option A
  cons and the R1 scoring. Sources:
  [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims) ·
  [emulator custom-claims issue](https://github.com/firebase/firebase-tools-ui/issues/424) ·
  [propagation caveat (js-sdk #6113)](https://github.com/firebase/firebase-js-sdk/issues/6113)
- **SQLAlchemy 2.0 typed ORM under Pyright** — `Mapped[...]` + `mapped_column()` is the 2.0 typing surface,
  **tested against Pyright and Mypy** upstream (the Mypy plugin is deprecated; no plugin/stubs needed). Known
  edge-cases exist (some query-condition mismatches Pyright won't flag) but the mapping declarations type-check
  under strict — compatible with `basedpyright strict`. **[K]** Sources:
  [What's New in SQLAlchemy 2.0 (typing)](https://docs.sqlalchemy.org/en/21/changelog/whatsnew_20.html) ·
  [pyright inference discussion #11093](https://github.com/sqlalchemy/sqlalchemy/discussions/11093)
- **testcontainers-python + pytest skip-when-no-Docker** — the documented pattern is a fixture that pings the
  Docker daemon and `pytest.skip`s the DB module when unavailable, otherwise starts `PostgresContainer`;
  supports the R3 recommendation exactly. **[K]** Sources:
  [testcontainers-python](https://github.com/testcontainers/testcontainers-python) ·
  [container testing + skip pattern](https://pytest-test-categories.readthedocs.io/en/latest/examples/container-testing.html)
- **psycopg3 async + SQLAlchemy 2.0** (`postgresql+psycopg://`, one driver for sync migrations + async app) —
  **[I]** established knowledge, confidence ~85%; pin/verify exact versions at plan time.

Sources:
- https://firebase.google.com/docs/auth/admin/custom-claims
- https://github.com/firebase/firebase-tools-ui/issues/424
- https://github.com/firebase/firebase-js-sdk/issues/6113
- https://docs.sqlalchemy.org/en/21/changelog/whatsnew_20.html
- https://github.com/sqlalchemy/sqlalchemy/discussions/11093
- https://github.com/testcontainers/testcontainers-python
- https://pytest-test-categories.readthedocs.io/en/latest/examples/container-testing.html
