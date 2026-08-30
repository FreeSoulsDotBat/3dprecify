# ADR-0013: Persistence stack — SQLAlchemy 2.0 (typed) + Alembic + psycopg3 on PostgreSQL

- **Status**: Accepted
- **Date**: 2026-07-09
- **Deciders**: Jonatan (owner) + arquiteto + dev-estrutura-de-dados

## Context

E2 introduces the project's FIRST database (catalog + entitlement ledger). No data-access layer or migration
tool is decided anywhere (Principle VIII forbids inferring one). Constraints: Python 3.12 + FastAPI + uv;
`basedpyright` strict; pydantic v2 owns the camelCase WIRE layer (ADR-0002) and must stay decoupled from the
DB layer; import-linter contracts grow with the new layer; dev/CI run a LOCAL PostgreSQL (owner posture: no
cloud provisioning until v1-launch — the same migrations must then provision Cloud SQL unchanged, A41);
`pnpm gate:all` runs `gate:be` on pre-push for developers who may not have Docker running.

## Options considered (≥3, per Constitution)

### Option A — SQLAlchemy 2.0 typed ORM + Alembic + psycopg (v3) ✅
- Pros: 2.0's `Mapped`/`mapped_column` declarative is built for static checkers and tested upstream against
  Pyright (fits basedpyright strict, no plugin); Alembic = canonical versioned migrations with autogenerate —
  "provision Cloud SQL = run the same migrations"; psycopg3 covers BOTH the async app path
  (`postgresql+psycopg://`) and Alembic's sync path with one driver; clean ORM(snake_case)↔pydantic(camelCase)
  separation preserves ADR-0002.
- Cons: two model layers (ORM + wire) — modest, deliberate boilerplate; async sessions have known sharp edges.
- Scalability impact: industry standard; portable to Cloud SQL unchanged.
- Confidence: ~85%.

### Option B — raw asyncpg + hand-written versioned SQL migrations
- Pros: minimal dependencies, total SQL control.
- Cons: reinvents a migration runner (dead-weight maintenance, Principle V liability); repetitive row↔model
  mapping under strict typing; second driver needed anyway for tooling.
- Confidence: ~40%.

### Option C — SQLModel
- Pros: one class for ORM+pydantic.
- Cons: entangles the DB schema with the ADR-0002 camelCase wire contract (the wire would hostage the
  schema); thinner typing story under strict pyright; smaller ecosystem.
- Confidence: ~35%.

## Decision

**Option A — owner-approved 2026-07-09.** SQLAlchemy 2.0 typed declarative + Alembic + psycopg3, with the
**async engine** for the FastAPI path (arquiteto sub-recommendation ~70%, ratified) and a sync engine only
where Alembic conventionally wants it. Dev/CI database: **local Docker PostgreSQL** (compose service for dev;
CI job service/testcontainers). Tests: **testcontainers with a Docker-availability skip guard** — `gate:be`
on a machine without Docker SKIPS the DB-backed tests VISIBLY (never silently green), while CI (Docker always
available) runs them authoritatively; unit layers keep running everywhere. SQLite-in-memory is rejected as a
test double (dialect divergence would fake confidence).

## Consequences

- Positive: strict-typing-friendly data layer; one schema authority (Alembic) that later provisions Cloud
  SQL by replay; wire/DB contracts stay independent; the local-first posture costs nothing at v1-launch.
- Negative / trade-offs accepted: ORM + pydantic dual models; pre-push `gate:be` is only FULLY authoritative
  where Docker runs (CI remains the backstop — the skip is visible, honest, and listed in the gate output).
- Follow-ups: `app.db` layer joins the import-linter contracts; migration 0001 carries the full E2 schema
  (`specs/007-e2-catalog-entitlement/data-model.md`); Cloud SQL provisioning stays in the v1-launch increment
  (A41). Retires **TD-004** (schema/money/multi-tenancy/migrations now decided here + in the data model).
