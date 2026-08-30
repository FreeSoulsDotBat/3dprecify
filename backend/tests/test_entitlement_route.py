"""US2/T014 — GET /api/v1/entitlement (FR-304), FAILING-first.

The endpoint TELLS an authenticated account its own plan state (none/active/lapsed) so the
Conta page is honest — it never denies with 403 (contrast with the catalog gates) and never
leaks the grantor. Statuses: 200 + 401 only (contracts/api-surface.md).
"""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app import auth
from app.main import create_app
from app.settings import Settings
from tests.conftest import requires_db


def _patch_verify(monkeypatch: pytest.MonkeyPatch, uid: str) -> None:
    def ok(_token: str) -> dict[str, Any]:
        return {"uid": uid, "email": f"{uid}@t.dev"}

    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", ok)


@pytest.fixture
def db_client(migrated_db: str) -> Iterator[TestClient]:
    app = create_app(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _grant(db_url: str, uid: str, *, revoked: bool = False, expires_days: int | None = 30) -> None:
    engine = sa.create_engine(db_url)
    now = datetime.now(UTC)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid) VALUES (:uid)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"uid": uid},
        )
        conn.execute(
            sa.text(
                "INSERT INTO entitlement_grants"
                " (id, account_uid, source, granted_by, granted_at, expires_at, revoked_at)"
                " VALUES (gen_random_uuid(), :uid, 'beta', 'op', :now, :exp, :rev)"
            ),
            {
                "uid": uid,
                "now": now,
                "exp": (now + timedelta(days=expires_days)) if expires_days else None,
                "rev": now if revoked else None,
            },
        )
    engine.dispose()


def test_signed_out_is_401(client: TestClient) -> None:
    r = client.get("/api/v1/entitlement")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"


@requires_db
def test_never_granted_reads_none(db_client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_verify(monkeypatch, "ent-none-1")
    r = db_client.get("/api/v1/entitlement", headers={"Authorization": "Bearer t"})
    assert r.status_code == 200
    assert r.json() == {"status": "none"}


@requires_db
def test_active_reads_source_and_expiry_but_never_grantor(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _grant(migrated_db, "ent-active-1")
    _patch_verify(monkeypatch, "ent-active-1")
    r = db_client.get("/api/v1/entitlement", headers={"Authorization": "Bearer t"})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "active"
    assert body["source"] == "beta"
    assert "expiresAt" in body  # camelCase wire (ADR-0002)
    assert set(body.keys()) <= {"status", "source", "expiresAt"}  # grantor NEVER leaks


@requires_db
def test_lapsed_reads_lapsed(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _grant(migrated_db, "ent-lapsed-1", revoked=True)
    _patch_verify(monkeypatch, "ent-lapsed-1")
    r = db_client.get("/api/v1/entitlement", headers={"Authorization": "Bearer t"})
    assert r.status_code == 200
    assert r.json()["status"] == "lapsed"
