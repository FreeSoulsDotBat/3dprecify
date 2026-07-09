# Precifica3D backend (FastAPI)

Verifies Firebase tokens and serves reference/catalog data. **Never computes prices** — the pricing formula
is canonical in `packages/pricing-core` (FR-118/FR-313).

## Local database (E2, ADR-0013)

The catalog + entitlement features need PostgreSQL. Locally it runs via Docker Compose (repo root):

```bash
docker compose up -d postgres        # postgres:17, dev creds; host port 5433 (avoids native-Postgres clashes)
cd backend
uv run alembic upgrade head          # apply migrations (0001 = full E2 schema)
```

- Connection URL: `P3D_DATABASE_URL` (settings default matches the compose service).
- The engine is **lazy**: the app boots and serves the free surfaces (`/health`, fee catalog, auth) with the
  DB down — only entitlement/catalog routes need it (FR-313).
- **Tests**: DB-backed tests use testcontainers and **SKIP VISIBLY** when Docker isn't running (`gate:be`
  stays honest); CI always runs them. Cloud SQL provisioning happens at v1-launch by replaying the same
  migrations — nothing to migrate away from.

## Everyday commands

```bash
uv sync                              # install deps
uv run uvicorn app.main:app --reload # dev server (http://localhost:8000)
uv run pytest -q                     # tests (DB tests skip without Docker)
pnpm gate:be                         # full backend gate (from repo root)
uv run grant-premium --help          # operator entitlement CLI (E2 US2)
```
