"""016/US10 (ADR-0026, T034) — the wire's POSTURE with the retired `wasteGrams` field, written
FAILING-first.

pricing-core 4.0.0 REFUSES `wasteGrams` by key (never silently ignores it — a caller carrying the
key gets a `ValidationError` naming the field, even when the value is `undefined`). The wire has
to make the SAME promise: before this increment, Pydantic's default `extra="ignore"` behaviour let
a stale client (an old cached bundle, or a hand-built request) POST/PUT `defaultWasteGrams`/
`wasteGrams` and have it silently DROPPED — 200/201 with the field simply never applied. That is
the exact silent lie US10 exists to kill: a seller believing the discard entered the price and
seeing a different number with no explanation.

`FilamentIn`/`PieceInputs` now declare `extra="forbid"` PLUS a `model_validator(mode="before")`
that raises a message naming the field and the model change (`contracts/wire-changes.md` §3) —
these tests assert 422, never 200/201, and assert the message actually names the retired field.
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

FILAMENT = {
    "name": "PLA Azul",
    "material": "PLA",
    "costPerRoll": "110.00",
    "rollWeightKg": "1.000",
}
PRINTER = {
    "name": "Ender 3",
    "machineValue": "1200.00",
    "machineLifetimeHours": "2000.000",
    "avgPowerKw": "0.1200",
    "maintenanceReservePerHour": "0.500000",
}
PIECE = {
    "printGrams": "100.000",
    "printTimeHours": "5.000",
    "failurePct": "0.000",
    "finishTimeHours": "0.000",
    "finishRatePerHour": "0.000000",
    "laborHours": "0.000",
    "laborRatePerHour": "0.000000",
    "markupVarejoPct": "50.000",
    "markupAtacadoPct": "30.000",
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


def _mk_refs(client: TestClient, h: dict[str, str]) -> tuple[str, str]:
    fid = client.post("/api/v1/filaments", headers=h, json=dict(FILAMENT)).json()["id"]
    pid = client.post("/api/v1/printers", headers=h, json=dict(PRINTER)).json()["id"]
    return fid, pid


def _assert_names_the_retired_field(body: dict[str, Any], field: str) -> None:
    """422 alone is not enough (Constitution II — fail loud, don't lie by omission): the message
    must name the RETIRED FIELD and the pricing-core 4.0.0 model change, so a caller who only
    reads the error text still learns what happened, not just that "something" was rejected."""
    assert body["error"]["code"] == "VALIDATION_ERROR", body
    details = body["error"].get("details") or []
    texts = [body["error"]["message"]] + [d.get("constraint", "") for d in details]
    joined = " ".join(texts)
    assert field in joined, joined
    assert "4.0.0" in joined, joined


# ══ FilamentIn ═════════════════════════════════════════════════════════════════════════════════


def test_post_filament_with_default_waste_grams_present_is_422_naming_the_field(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "wire-fil-post")
    r = db_client.post(
        "/api/v1/filaments", headers=h, json={**FILAMENT, "defaultWasteGrams": "5.000"}
    )
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "defaultWasteGrams")


def test_post_filament_with_default_waste_grams_present_as_null_is_ALSO_422(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The KEY present is the signal, even with an `undefined`/`null` value (ADR-0026 §3.1) — the
    real way this would come back is a careless `{...oldDocument}` spread, which carries the key
    with whatever value the old document had, including a null/undefined one."""
    h = _premium(monkeypatch, migrated_db, "wire-fil-post-null")
    r = db_client.post("/api/v1/filaments", headers=h, json={**FILAMENT, "defaultWasteGrams": None})
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "defaultWasteGrams")


def test_put_filament_with_default_waste_grams_present_is_422_naming_the_field(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "wire-fil-put")
    created = db_client.post("/api/v1/filaments", headers=h, json=dict(FILAMENT))
    assert created.status_code == 201, created.text
    fid = created.json()["id"]

    r = db_client.put(
        f"/api/v1/filaments/{fid}", headers=h, json={**FILAMENT, "defaultWasteGrams": "5.000"}
    )
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "defaultWasteGrams")


def test_post_filament_without_the_retired_field_still_succeeds(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The negative control: the postural guard rejects the RETIRED field specifically, not the
    route in general — a clean body (no `wasteGrams`) is still a normal 201."""
    h = _premium(monkeypatch, migrated_db, "wire-fil-clean")
    r = db_client.post("/api/v1/filaments", headers=h, json=dict(FILAMENT))
    assert r.status_code == 201, r.text
    assert "defaultWasteGrams" not in r.json()


# ══ PieceInputs (products) ═════════════════════════════════════════════════════════════════════


def test_post_product_with_piece_waste_grams_present_is_422_naming_the_field(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "wire-prod-post")
    fid, pid = _mk_refs(db_client, h)
    body = {
        "name": "Vaso G",
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": {**PIECE, "wasteGrams": "5.000"},
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    r = db_client.post("/api/v1/products", headers=h, json=body)
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "wasteGrams")


def test_post_product_with_piece_waste_grams_present_as_null_is_ALSO_422(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "wire-prod-post-null")
    fid, pid = _mk_refs(db_client, h)
    body = {
        "name": "Vaso G",
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": {**PIECE, "wasteGrams": None},
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    r = db_client.post("/api/v1/products", headers=h, json=body)
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "wasteGrams")


def test_put_product_with_piece_waste_grams_present_is_422_naming_the_field(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "wire-prod-put")
    fid, pid = _mk_refs(db_client, h)
    clean_body = {
        "name": "Vaso G",
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": dict(PIECE),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    created = db_client.post("/api/v1/products", headers=h, json=clean_body)
    assert created.status_code == 201, created.text
    pid_product = created.json()["id"]

    dirty_body = {**clean_body, "pieceInputs": {**PIECE, "wasteGrams": "5.000"}}
    r = db_client.put(f"/api/v1/products/{pid_product}", headers=h, json=dirty_body)
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "wasteGrams")


def test_post_product_without_the_retired_field_still_succeeds(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Negative control mirroring the filament one above."""
    h = _premium(monkeypatch, migrated_db, "wire-prod-clean")
    fid, pid = _mk_refs(db_client, h)
    body = {
        "name": "Vaso G",
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": dict(PIECE),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    r = db_client.post("/api/v1/products", headers=h, json=body)
    assert r.status_code == 201, r.text
    assert "wasteGrams" not in r.json()["pieceInputs"]


# ══ PieceInputs via an ad-hoc BOM line (boms.py reuses PieceInputs verbatim) ══════════════════════


def test_post_bom_with_ad_hoc_line_waste_grams_present_is_422_naming_the_field(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "wire-bom-post")
    body = {
        "name": "Kit Recusado",
        "lines": [
            {
                "quantity": 1,
                "pieceName": "Peça",
                "pieceInputs": {**PIECE, "wasteGrams": "5.000"},
                "filamentValues": {
                    "material": "PLA",
                    "costPerRoll": "110.00",
                    "rollWeightKg": "1.000",
                },
                "printerValues": {
                    "machineValue": "1200.00",
                    "machineLifetimeHours": "2000.000",
                    "avgPowerKw": "0.1200",
                    "maintenanceReservePerHour": "0.500000",
                },
                "tariffPerKwh": "1.000000",
                "includeMarketplace": True,
                "channels": [],
                "otherCosts": [],
            }
        ],
    }
    r = db_client.post("/api/v1/boms", headers=h, json=body)
    assert r.status_code == 422, r.text
    _assert_names_the_retired_field(r.json(), "wasteGrams")
