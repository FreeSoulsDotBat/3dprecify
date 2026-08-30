"""US2 (FR-303/304/311, SC-302/309) — operator grant/revoke via the CLI core, FAILING-first.

The CLI core is plain sync functions over the ledger (no HTTP route exists — operator-only by
construction, ADR-0012). Targets must be EXISTING accounts (uid or e-mail; email-invite is
deferred — data-model §12 / analyze P1). Freeze semantics (write-denied/read-kept) are proven
at the gate (test_entitlement_gate); here we prove the LEDGER mechanics: grant → active,
revoke/expiry → lapsed with ZERO rows deleted, re-grant → active again with history preserved,
audit fields recorded.
"""

import asyncio
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
import sqlalchemy as sa

from app.entitlement import read_entitlement_state
from app.scripts.grant_premium import GrantError, grant, list_grants, revoke
from tests.conftest import requires_db

pytestmark = requires_db


@pytest.fixture
def engine(migrated_db: str) -> Iterator[sa.Engine]:
    eng = sa.create_engine(migrated_db)
    yield eng
    eng.dispose()


def _mk_account(engine: sa.Engine, uid: str, email: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid, email) VALUES (:uid, :email)"
                " ON CONFLICT (account_uid) DO UPDATE SET email = EXCLUDED.email"
            ),
            {"uid": uid, "email": email},
        )


def _state(migrated_url: str, uid: str) -> str:
    """Read the entitlement state through the SAME reader the gate uses."""
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def go() -> str:
        aengine = create_async_engine(migrated_url)
        try:
            async with async_sessionmaker(aengine)() as session:
                return (await read_entitlement_state(session, uid)).status
        finally:
            await aengine.dispose()

    return asyncio.run(go())


def test_grant_by_uid_activates(engine: sa.Engine, migrated_db: str) -> None:
    _mk_account(engine, "g-uid-1")
    result = grant(engine, target="g-uid-1", source="beta", granted_by="jonatan")
    assert result.account_uid == "g-uid-1"
    assert _state(migrated_db, "g-uid-1") == "active"


def test_grant_by_email_resolves_existing_account(
    engine: sa.Engine,
    migrated_db: str,
) -> None:
    _mk_account(engine, "g-uid-2", email="seller@beta.dev")
    result = grant(engine, target="seller@beta.dev", source="comp", granted_by="jonatan")
    assert result.account_uid == "g-uid-2"
    assert _state(migrated_db, "g-uid-2") == "active"


def test_grant_unknown_target_is_a_clear_error(engine: sa.Engine) -> None:
    with pytest.raises(GrantError, match="account"):
        grant(engine, target="ghost@nowhere.dev", source="beta", granted_by="jonatan")


def test_revoke_lapses_and_deletes_nothing(engine: sa.Engine, migrated_db: str) -> None:
    _mk_account(engine, "g-uid-3")
    grant(engine, target="g-uid-3", source="beta", granted_by="jonatan")
    revoke(engine, target="g-uid-3", revoked_by="jonatan")
    assert _state(migrated_db, "g-uid-3") == "lapsed"
    # Zero rows deleted (SC-309): the grant row is revoked, never removed; the account stays.
    rows = list_grants(engine, target="g-uid-3")
    assert len(rows) == 1
    assert rows[0].revoked_at is not None
    with engine.connect() as conn:
        count = conn.execute(
            sa.text("SELECT count(*) FROM accounts WHERE account_uid = 'g-uid-3'")
        ).scalar()
    assert count == 1


def test_regrant_restores_active_with_history(engine: sa.Engine, migrated_db: str) -> None:
    _mk_account(engine, "g-uid-4")
    grant(engine, target="g-uid-4", source="beta", granted_by="jonatan")
    revoke(engine, target="g-uid-4", revoked_by="jonatan")
    grant(engine, target="g-uid-4", source="comp", granted_by="jonatan")
    assert _state(migrated_db, "g-uid-4") == "active"
    rows = list_grants(engine, target="g-uid-4")
    assert len(rows) == 2  # append-only history preserved


def test_expired_grant_lapses(engine: sa.Engine, migrated_db: str) -> None:
    _mk_account(engine, "g-uid-5")
    grant(
        engine,
        target="g-uid-5",
        source="beta",
        granted_by="jonatan",
        expires_at=datetime.now(UTC) - timedelta(hours=1),
    )
    assert _state(migrated_db, "g-uid-5") == "lapsed"


def test_audit_fields_recorded(engine: sa.Engine) -> None:
    _mk_account(engine, "g-uid-6")
    exp = datetime.now(UTC) + timedelta(days=30)
    grant(
        engine,
        target="g-uid-6",
        source="beta",
        granted_by="jonatan",
        expires_at=exp,
        note="beta wave 1",
    )
    row = list_grants(engine, target="g-uid-6")[0]
    assert row.source == "beta"
    assert row.granted_by == "jonatan"
    assert row.note == "beta wave 1"
    assert row.expires_at is not None
    assert row.granted_at is not None


def test_revoke_without_active_grant_is_a_clear_error(engine: sa.Engine) -> None:
    _mk_account(engine, "g-uid-7")
    with pytest.raises(GrantError, match="active"):
        revoke(engine, target="g-uid-7", revoked_by="jonatan")
