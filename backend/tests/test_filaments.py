"""US3 (FR-305/306/307/311, SC-303/308) — filaments CRUD, written FAILING-first.

Wire per contracts/api-surface.md: camelCase, money/quantities as DECIMAL STRINGS (JSON
number precision is not trusted for money), statuses exactly 200/201/204 + 401/403/404/422
ErrorEnvelope. Validation mirrors the calculator rules (FR-306 — a bad entry is NEVER
stored). Isolation is absolute (SC-308: another account's row reads as 404, never leaking
existence). Lapsed accounts read but cannot write (Q3 freeze).
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
    "name": "PLA Azul",
    "material": "PLA",
    "costPerRoll": "110.00",
    "rollWeightKg": "1.000",
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
    return client.post("/api/v1/filaments", headers=headers, json=body or dict(VALID))


def test_crud_round_trip(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "fil-crud-1")

    created = _post(db_client, h)
    assert created.status_code == 201
    body = created.json()
    fid = body["id"]
    assert body["name"] == "PLA Azul"
    assert body["costPerRoll"] == "110.00"  # decimal STRING on the wire
    assert body["rollWeightKg"] == "1.000"

    listed = db_client.get("/api/v1/filaments", headers=h)
    assert listed.status_code == 200
    assert [f["id"] for f in listed.json()] == [fid]

    got = db_client.get(f"/api/v1/filaments/{fid}", headers=h)
    assert got.status_code == 200
    assert got.json()["costPerRoll"] == "110.00"

    updated = db_client.put(
        f"/api/v1/filaments/{fid}", headers=h, json={**VALID, "costPerRoll": "125.50"}
    )
    assert updated.status_code == 200
    assert updated.json()["costPerRoll"] == "125.50"

    # Fresh session (new client) sees the same persisted state.
    app2 = create_app(Settings(app_env="dev"))
    with TestClient(app2, raise_server_exceptions=False) as fresh:
        again = fresh.get(f"/api/v1/filaments/{fid}", headers=h)
        assert again.status_code == 200
        assert again.json()["costPerRoll"] == "125.50"

    deleted = db_client.delete(f"/api/v1/filaments/{fid}", headers=h)
    assert deleted.status_code == 204
    assert db_client.get(f"/api/v1/filaments/{fid}", headers=h).status_code == 404
    assert db_client.get("/api/v1/filaments", headers=h).json() == []


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("rollWeightKg", "0"),  # divisor must be > 0 (the E1 rule)
        ("rollWeightKg", "-1"),
        ("costPerRoll", "-5"),
        ("costPerRoll", "NaN"),
        ("costPerRoll", "abc"),
        ("costPerRoll", "10000000000"),  # 10^10 = MONEY_SETTLED ceiling → overflow, must be 422
        ("rollWeightKg", "1000000"),  # 10^6 = QTY_KG ceiling → overflow, must be 422
        ("name", "   "),  # blank name
    ],
)
def test_invalid_input_is_422_and_never_stored(
    db_client: TestClient,
    migrated_db: str,
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: str,
) -> None:
    h = _premium(monkeypatch, migrated_db, "fil-val-1")
    r = _post(db_client, h, {**VALID, field: value})
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/filaments", headers=h).json() == []


def test_malformed_body_is_400_validation_error(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Unparseable payload → 400 (FastAPI body-parse), mapped to VALIDATION_ERROR — never
    INTERNAL. Caught by the conformance suite on day 1; pinned here."""
    h = _premium(monkeypatch, migrated_db, "fil-400-1")
    r = db_client.post(
        "/api/v1/filaments",
        headers={**h, "Content-Type": "application/json"},
        content=b"\x80not-json\x9e",
    )
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_per_account_isolation(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h_a = _premium(monkeypatch, migrated_db, "fil-iso-a")
    fid = _post(db_client, h_a).json()["id"]

    h_b = _premium(monkeypatch, migrated_db, "fil-iso-b")  # re-patches verify to B
    assert db_client.get("/api/v1/filaments", headers=h_b).json() == []
    # Another account's row reads as 404 — existence is never leaked (SC-308).
    assert db_client.get(f"/api/v1/filaments/{fid}", headers=h_b).status_code == 404
    assert (
        db_client.put(f"/api/v1/filaments/{fid}", headers=h_b, json=dict(VALID)).status_code == 404
    )
    assert db_client.delete(f"/api/v1/filaments/{fid}", headers=h_b).status_code == 404

    # A still owns its row untouched.
    patch_verify(monkeypatch, "fil-iso-a")
    assert db_client.get(f"/api/v1/filaments/{fid}", headers=h_a).status_code == 200


def test_lapsed_reads_but_cannot_write(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "fil-lapse-1")
    fid = _post(db_client, h).json()["id"]

    # Lapse: revoke via a second (revoked) grant state — reseed as revoked-only account is
    # not possible (append-only); revoke the active grant directly.
    import sqlalchemy as sa

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = 'fil-lapse-1'"
            )
        )
    engine.dispose()

    # Reads keep working (Q3 freeze)…
    assert db_client.get("/api/v1/filaments", headers=h).status_code == 200
    assert db_client.get(f"/api/v1/filaments/{fid}", headers=h).status_code == 200
    # …writes deny honestly.
    for resp in (
        _post(db_client, h),
        db_client.put(f"/api/v1/filaments/{fid}", headers=h, json=dict(VALID)),
        db_client.delete(f"/api/v1/filaments/{fid}", headers=h),
    ):
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
