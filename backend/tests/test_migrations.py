"""Migration downgrade round-trip (013 audit remediation, T051 — finding T-01).

**Adaptation note (verify-before-writing, per the task brief).** `tasks.md` names
`subscriptions`/`billing_events` as the tables to assert `to_regclass(...) IS NULL` for after a
downgrade. Those tables belong to migration `0005_e6_billing.py`, which exists ONLY on
`feature/012-e6-billing` — this branch (`013-audit-remediation`) is cut from `develop`, whose
migration chain currently stops at `0004_e5_scenarios.py` (`ls backend/alembic/versions/`
confirmed: `0001`, `0002`, `0003`, `0004`, no `0005` here). Writing an assertion against tables
that do not exist on this branch would be a silent no-op, not a guard — so this test asserts
against every table the FOUR migrations that DO exist here actually own.

FOLLOW-UP (recorded, not silent): when E6 (`012-e6-billing`) merges and `0005_e6_billing.py`
lands on `develop`, add `"subscriptions"` and `"billing_events"` to `_OWNED_TABLES` below — that
is the literal completion of what `tasks.md` originally asked for.

Every migration's `downgrade()` runs only in THIS test — `conftest.migrated_db` (used by every
other DB-backed test in this suite) calls `command.upgrade(..., "head")` exactly once per session
and never downgrades. A downgrade with a wrong DROP order, a dangling trigger/function dependency,
or a straight syntax error would go completely unnoticed until an operator ran a real rollback in
production. This test uses its OWN dedicated container (never the shared session `postgres_url`/
`migrated_db`) so a full teardown-and-rebuild here can never disturb another test's data mid-suite.
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from alembic.config import Config

from alembic import command
from app.db import reset_engine_for_tests
from app.settings import get_settings
from tests.conftest import requires_db

pytestmark = requires_db

# Every table owned by the migrations on `develop` (0001-0005). The 0005 tables were added once
# 0005_e6_billing merged from feature/012-e6-billing (the T051 follow-up, fulfilled by the
# confirmation audit L6-01) — so the downgrade round-trip now asserts they drop cleanly too.
_OWNED_TABLES = [
    "accounts",
    "entitlement_grants",
    "filaments",
    "printers",
    "products",
    "boms",
    "bom_lines",
    "snapshots",
    "scenarios",
    "subscriptions",
    "billing_events",
]


def _to_regclass(url: str, table: str) -> str | None:
    engine = sa.create_engine(url)
    try:
        with engine.connect() as conn:
            return conn.execute(sa.text("SELECT to_regclass(:t)"), {"t": table}).scalar()
    finally:
        engine.dispose()


def test_full_downgrade_to_base_then_reupgrade_to_head_round_trips_cleanly() -> None:
    """`alembic upgrade head` -> `downgrade base` -> `upgrade head` against a real Postgres
    (testcontainer). Guard mutation (T051): inverting the order of the `DROP TRIGGER`/
    `DROP FUNCTION` pair in `0003_e4_snapshots.py::downgrade()` (dropping the function first,
    while the trigger still depends on it) MUST turn this red — Postgres refuses to drop a
    function a live trigger depends on."""
    os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:17-alpine", driver="psycopg") as pg:
        url = pg.get_connection_url()
        old = os.environ.get("P3D_DATABASE_URL")
        os.environ["P3D_DATABASE_URL"] = url
        get_settings.cache_clear()
        reset_engine_for_tests()
        try:
            cfg = Config("alembic.ini")

            command.upgrade(cfg, "head")
            for table in _OWNED_TABLES:
                assert _to_regclass(url, table) == table, f"{table} missing after upgrade head"

            command.downgrade(cfg, "base")
            for table in _OWNED_TABLES:
                assert _to_regclass(url, table) is None, f"{table} still exists after downgrade"

            command.upgrade(cfg, "head")
            for table in _OWNED_TABLES:
                assert _to_regclass(url, table) == table, f"{table} missing after re-upgrade"
        finally:
            if old is None:
                os.environ.pop("P3D_DATABASE_URL", None)
            else:
                os.environ["P3D_DATABASE_URL"] = old
            get_settings.cache_clear()
            reset_engine_for_tests()
