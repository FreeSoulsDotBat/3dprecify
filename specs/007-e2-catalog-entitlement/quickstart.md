# Quickstart — validating E2 (catalog + persistence + entitlement)

Runnable proof per user story. Prerequisites: repo toolchain (pnpm/Node 24, uv/Py 3.12) + **Docker running**
(local Postgres via compose; DB-backed tests SKIP VISIBLY without it and CI remains authoritative —
ADR-0013).

## 0. Stand up the local DB

```bash
docker compose up -d postgres          # local dev DB (never required by the free calculator)
cd backend && uv run alembic upgrade head   # migration 0001 = the full ratified schema
```

## 1. Entitlement gate + grant + freeze (US1/US2 — SC-301/302/309)

```bash
cd backend && uv run pytest tests/test_entitlement*.py -q   # written FAILING first (gate absent)
```

- Deny: free identity calling any persistence op → `403 ENTITLEMENT_REQUIRED`, nothing persisted.
- Forge: client-faked premium state → still denied (server never consults the client).
- Grant walk (CLI, operator-only by construction):
  ```bash
  uv run grant-premium grant <uid-or-email-of-EXISTING-account> --source beta [--expires 2026-12-31]
  # e-mail lookup resolves accounts.email (populated at first sign-in); email-invite is deferred (data-model §12)
  uv run grant-premium list            # ledger: grantor, source, granted_at, expires_at
  uv run grant-premium revoke <uid>
  ```
  Grant → writes succeed; revoke/expiry → **read-only freeze**: reads/pre-fill still 200, writes 403, zero
  rows deleted (SC-309); re-grant → write access returns to the SAME data.
- Audit: `100%` of persistence routes carry `require_entitlement` (the US1-4 audit test greps the route
  table — no bypass path).

## 2. Catalog CRUD round-trips (US3/US4 — SC-303/304/308)

```bash
cd backend && uv run pytest tests/test_filaments.py tests/test_printers.py -q
pnpm --filter @3dprecify/web vitest run src/features/catalog src/pages/catalogo
pnpm e2e   # includes catalog CRUD specs (premium via seeded grant)
```

- Round-trip: create → fresh-session reload identical → edit persists → delete gone.
- Validation: invalid values (rollWeightKg ≤ 0, non-finite money) rejected with the E1 pt-BR messages —
  never stored (FR-306).
- Isolation: account B sees zero of account A's rows under any manipulation (SC-308).

## 3. Pre-fill fidelity (US5 — SC-305, the anchor)

```bash
pnpm --filter @3dprecify/web vitest run src/features/calculator   # byte-identity test FIRST
```

- Pick saved filament + printer → the six fields populate, stay editable, and `computeFromForm` output is
  **byte-identical** (JSON.stringify equality) to typing the same values manually — pricing-core untouched.
- Offline: after one online load, airplane-mode pre-fill still works (uid-keyed IndexedDB cache); sign-out
  purges the cache (identity-leak lesson).

## 4. Products live-recompute (US6 — SC-307)

- Save product referencing filament+printer → reopen recomputes with current `PRICING_MODEL_VERSION` (no
  stored price anywhere — assert the API response carries inputs only).
- Edit referenced filament → product reflects it on reopen. Delete referenced filament → warn, product keeps
  last-known values as editable overrides (never breaks).

## 5. Free-tier honesty (US7 — SC-306) + SC-310 no-regression

```bash
pnpm --filter @3dprecify/web vitest run src/pages/catalogo   # teaser component test FIRST
pnpm e2e                                                     # teaser e2e + ALL existing E1 guards
```

- Free/signed-out: every save/catalog affordance → honest teaser (no price, no date, no fake save; nothing
  persists).
- **SC-310**: the existing E1 e2e suite (free/offline/signed-out calculator, 26+ tests) passes UNCHANGED —
  the compute path never touches DB/entitlement.

## 6. Gates & contract honesty (every PR)

```bash
pnpm gate:all       # DB-backed tests run (Docker) or SKIP VISIBLY (no Docker) — check the skip line
pnpm e2e
grep -c ENTITLEMENT_REQUIRED contracts/openapi.json   # > 0 after regen; drift-guard green in CI
cd backend && uv run pytest tests/test_conformance.py -q   # every NEW route fuzzed, honest statuses
```

Delivery: three PRs (plan §Delivery strategy), each owner-authorized with full gates + visual homologation
for UI stories (qa-produto, 005-style).
