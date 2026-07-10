"""US4 (FR-305/306/307/311, SC-304/308) — printers CRUD, written FAILING-first.

Mirrors test_filaments with the printer field set: machineValue / machineLifetimeHours
(strictly > 0 — the E1 denominator rule) / avgPowerKw / maintenanceReservePerHour.
"""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db

VALID = {
    "name": "Ender 3",
    "machineValue": "1200.00",
    "machineLifetimeHours": "2000.000",
    "avgPowerKw": "0.1200",
    "maintenanceReservePerHour": "0.500000",
}


@pytest.fixture
def db_client(migrated_db: str) -> Iterator[TestClient]:
    app = create_app(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _premium(monkeypatch: pytest.MonkeyPatch, migrated_db: str, uid: str) -> dict[str, str]:
    seed_grant(migrated_db, uid)
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _post(client: TestClient, headers: dict[str, str], body: dict[str, Any] | None = None) -> Any:
    return client.post("/api/v1/printers", headers=headers, json=body or dict(VALID))


def test_crud_round_trip(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "prt-crud-1")

    created = _post(db_client, h)
    assert created.status_code == 201
    body = created.json()
    pid = body["id"]
    assert body["name"] == "Ender 3"
    assert body["machineValue"] == "1200.00"  # decimal STRING on the wire
    assert body["machineLifetimeHours"] == "2000.000"
    assert body["avgPowerKw"] == "0.1200"

    assert [p["id"] for p in db_client.get("/api/v1/printers", headers=h).json()] == [pid]

    updated = db_client.put(
        f"/api/v1/printers/{pid}", headers=h, json={**VALID, "machineLifetimeHours": "2500.000"}
    )
    assert updated.status_code == 200
    assert updated.json()["machineLifetimeHours"] == "2500.000"

    assert db_client.delete(f"/api/v1/printers/{pid}", headers=h).status_code == 204
    assert db_client.get(f"/api/v1/printers/{pid}", headers=h).status_code == 404
    assert db_client.get("/api/v1/printers", headers=h).json() == []


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("machineLifetimeHours", "0"),  # divisor must be > 0 (the E1 rule)
        ("machineLifetimeHours", "-10"),
        ("machineValue", "-1"),
        ("avgPowerKw", "NaN"),
        ("maintenanceReservePerHour", "-0.5"),
        ("name", ""),
    ],
)
def test_invalid_input_is_422_and_never_stored(
    db_client: TestClient,
    migrated_db: str,
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: str,
) -> None:
    h = _premium(monkeypatch, migrated_db, "prt-val-1")
    r = _post(db_client, h, {**VALID, field: value})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/printers", headers=h).json() == []


def test_per_account_isolation_and_lapse(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h_a = _premium(monkeypatch, migrated_db, "prt-iso-a")
    pid = _post(db_client, h_a).json()["id"]

    h_b = _premium(monkeypatch, migrated_db, "prt-iso-b")
    assert db_client.get("/api/v1/printers", headers=h_b).json() == []
    assert db_client.get(f"/api/v1/printers/{pid}", headers=h_b).status_code == 404

    # Lapse A: reads keep working, writes deny (Q3 freeze).
    import sqlalchemy as sa

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = 'prt-iso-a'"
            )
        )
    engine.dispose()
    patch_verify(monkeypatch, "prt-iso-a")
    assert db_client.get(f"/api/v1/printers/{pid}", headers=h_a).status_code == 200
    denied = _post(db_client, h_a)
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
