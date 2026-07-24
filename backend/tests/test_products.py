"""US6 (FR-310/311/313, SC-306/308) — products CRUD, written FAILING-first (T028).

Wire per contracts/api-surface.md: `{ id, name, filamentId?, printerId?, filamentValues,
printerValues, pieceInputs, channels[], otherCosts[], tariffPerKwh, createdAt, updatedAt }` —
camelCase, money/quantities as DECIMAL STRINGS. The response carries INPUTS ONLY: no stored
price exists anywhere (FR-310/FR-313 — prices are recomputed client-side with the current
PRICING_MODEL_VERSION). Reference semantics per data-model D3: link present ⇒ the LIVE
filament/printer row is authoritative (edits reflect on reopen, US6-3); deleting a referenced
item degrades the link in the SAME txn (FK → NULL + last-known snapshot keeps the
link-or-snapshot CHECK satisfied, US6-4) and the snapshot becomes editable. channels[] /
otherCosts[] are pydantic-validated JSONB shapes (D4 — money as decimal strings, one bad slot
is never stored). Isolation (SC-308) + lapse freeze (Q3) mirror filaments/printers.
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
    "defaultWasteGrams": "5.000",
}
PRINTER = {
    "name": "Ender 3",
    "machineValue": "1200.00",
    "machineLifetimeHours": "2000.000",
    "avgPowerKw": "0.1200",
    "maintenanceReservePerHour": "0.500000",
}
# Piece inputs at column scale (QTY_G/QTY_H 3dp, MONEY_RATE 6dp, PERCENT 3dp) so the DB
# round-trips the exact same string — the SC-305 lossless invariant, asserted literally.
PIECE = {
    "printGrams": "100.000",
    "wasteGrams": "5.000",
    "printTimeHours": "5.000",
    "failurePct": "0.000",
    "finishTimeHours": "0.000",
    "finishRatePerHour": "0.000000",
    "laborHours": "0.000",
    "laborRatePerHour": "0.000000",
    "markupVarejoPct": "50.000",
    "markupAtacadoPct": "30.000",
}
CHANNEL = {
    "marketplace": "MERCADO_LIVRE",
    "modality": "CLASSICO",
    "commissionPct": "12.5",
    "fixedFee": "6.00",
    "minPerItem": "1.00",
    "freightCost": "0.00",
}
OTHER_COST = {"name": "Embalagem", "value": "3.50"}


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
    """Create the referenced filament + printer through the real API (FR-310 prerequisites)."""
    fid = client.post("/api/v1/filaments", headers=h, json=dict(FILAMENT)).json()["id"]
    pid = client.post("/api/v1/printers", headers=h, json=dict(PRINTER)).json()["id"]
    return fid, pid


def _product_body(fid: str | None, pid: str | None, **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": "Vaso G",
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": dict(PIECE),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [dict(CHANNEL)],
        "otherCosts": [dict(OTHER_COST)],
    }
    body.update(overrides)
    return body


def _post(client: TestClient, h: dict[str, str], body: dict[str, Any]) -> Any:
    return client.post("/api/v1/products", headers=h, json=body)


def _keys_recursive(node: Any) -> Iterator[str]:
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from _keys_recursive(v)
    elif isinstance(node, list):
        for item in node:
            yield from _keys_recursive(item)


def test_crud_round_trip_inputs_only(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "prod-crud-1")
    fid, pid = _mk_refs(db_client, h)

    created = _post(db_client, h, _product_body(fid, pid))
    assert created.status_code == 201
    body = created.json()
    prod_id = body["id"]
    assert body["name"] == "Vaso G"
    assert body["filamentId"] == fid
    assert body["printerId"] == pid
    # Resolved values come from the LIVE linked rows (D3 resolution rule).
    assert body["filamentValues"] == {
        "material": "PLA",
        "costPerRoll": "110.00",
        "rollWeightKg": "1.000",
    }
    assert body["printerValues"] == {
        "machineValue": "1200.00",
        "machineLifetimeHours": "2000.000",
        "avgPowerKw": "0.1200",
        "maintenanceReservePerHour": "0.500000",
    }
    assert body["pieceInputs"] == PIECE
    assert body["tariffPerKwh"] == "1.000000"
    assert body["includeMarketplace"] is True
    assert body["channels"] == [CHANNEL]  # JSONB round-trips byte-exact (D4)
    assert body["otherCosts"] == [OTHER_COST]
    # INPUTS ONLY — no stored price anywhere in the payload (FR-310/FR-313).
    assert not [k for k in _keys_recursive(body) if "price" in k.lower()]

    listed = db_client.get("/api/v1/products", headers=h)
    assert listed.status_code == 200
    assert [p["id"] for p in listed.json()] == [prod_id]

    got = db_client.get(f"/api/v1/products/{prod_id}", headers=h)
    assert got.status_code == 200
    assert got.json()["pieceInputs"]["printGrams"] == "100.000"

    updated = db_client.put(
        f"/api/v1/products/{prod_id}",
        headers=h,
        json=_product_body(fid, pid, name="Vaso G v2", channels=[]),
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Vaso G v2"
    assert updated.json()["channels"] == []

    # Fresh session (new client) sees the same persisted state.
    app2 = create_app(Settings(app_env="dev"))
    with TestClient(app2, raise_server_exceptions=False) as fresh:
        again = fresh.get(f"/api/v1/products/{prod_id}", headers=h)
        assert again.status_code == 200
        assert again.json()["name"] == "Vaso G v2"

    deleted = db_client.delete(f"/api/v1/products/{prod_id}", headers=h)
    assert deleted.status_code == 204
    assert db_client.get(f"/api/v1/products/{prod_id}", headers=h).status_code == 404
    assert db_client.get("/api/v1/products", headers=h).json() == []


def test_reopen_reflects_live_reference_edits(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """US6-3: while linked, the live row is authoritative — edits reflect on reopen."""
    h = _premium(monkeypatch, migrated_db, "prod-live-1")
    fid, pid = _mk_refs(db_client, h)
    prod_id = _post(db_client, h, _product_body(fid, pid)).json()["id"]

    r = db_client.put(
        f"/api/v1/filaments/{fid}", headers=h, json={**FILAMENT, "costPerRoll": "125.50"}
    )
    assert r.status_code == 200
    r = db_client.put(
        f"/api/v1/printers/{pid}", headers=h, json={**PRINTER, "machineValue": "999.00"}
    )
    assert r.status_code == 200

    reopened = db_client.get(f"/api/v1/products/{prod_id}", headers=h).json()
    assert reopened["filamentValues"]["costPerRoll"] == "125.50"
    assert reopened["printerValues"]["machineValue"] == "999.00"


def test_deleting_referenced_items_degrades_with_last_known(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """US6-4/D6: deletion unlinks (NULL) + captures last-known in the SAME txn — the
    link-or-snapshot CHECK stays satisfied and the product never goes blank."""
    h = _premium(monkeypatch, migrated_db, "prod-degrade-1")
    fid, pid = _mk_refs(db_client, h)
    prod_id = _post(db_client, h, _product_body(fid, pid)).json()["id"]

    assert db_client.delete(f"/api/v1/filaments/{fid}", headers=h).status_code == 204
    degraded = db_client.get(f"/api/v1/products/{prod_id}", headers=h).json()
    assert degraded["filamentId"] is None
    assert degraded["filamentValues"] == {
        "material": "PLA",
        "costPerRoll": "110.00",
        "rollWeightKg": "1.000",
    }
    # Printer link untouched by the filament deletion.
    assert degraded["printerId"] == pid

    assert db_client.delete(f"/api/v1/printers/{pid}", headers=h).status_code == 204
    degraded = db_client.get(f"/api/v1/products/{prod_id}", headers=h).json()
    assert degraded["printerId"] is None
    assert degraded["printerValues"]["machineValue"] == "1200.00"


def test_material_less_filament_degrades_cleanly(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Regression (homologation 2026-07-10): material is an OPTIONAL label — deleting a
    referenced filament that has NO material must still degrade (the snapshot needs only the
    pricing inputs), never a 500 from the link-or-snapshot CHECK."""
    h = _premium(monkeypatch, migrated_db, "prod-nomat-1")
    fid = db_client.post(
        "/api/v1/filaments", headers=h, json={**FILAMENT, "material": None}
    ).json()["id"]
    pid = db_client.post("/api/v1/printers", headers=h, json=dict(PRINTER)).json()["id"]
    prod_id = _post(db_client, h, _product_body(fid, pid)).json()["id"]

    assert db_client.delete(f"/api/v1/filaments/{fid}", headers=h).status_code == 204
    degraded = db_client.get(f"/api/v1/products/{prod_id}", headers=h).json()
    assert degraded["filamentId"] is None
    assert degraded["filamentValues"]["material"] is None
    assert degraded["filamentValues"]["costPerRoll"] == "110.00"


def test_degraded_values_are_editable_overrides(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """US6-4: once degraded, the snapshot is the authoritative EDITABLE source."""
    h = _premium(monkeypatch, migrated_db, "prod-override-1")
    fid, pid = _mk_refs(db_client, h)
    prod_id = _post(db_client, h, _product_body(fid, pid)).json()["id"]
    assert db_client.delete(f"/api/v1/filaments/{fid}", headers=h).status_code == 204

    updated = db_client.put(
        f"/api/v1/products/{prod_id}",
        headers=h,
        json=_product_body(
            None,
            pid,
            filamentId=None,
            filamentValues={"material": "PLA+", "costPerRoll": "99.00", "rollWeightKg": "1.000"},
        ),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["filamentId"] is None
    assert body["filamentValues"]["costPerRoll"] == "99.00"
    assert body["filamentValues"]["material"] == "PLA+"


def test_null_link_without_snapshot_is_422(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The API enforces link-or-snapshot BEFORE the DB CHECK — a blank product is 422."""
    h = _premium(monkeypatch, migrated_db, "prod-blank-1")
    fid, pid = _mk_refs(db_client, h)
    prod_id = _post(db_client, h, _product_body(fid, pid)).json()["id"]

    r = db_client.put(
        f"/api/v1/products/{prod_id}",
        headers=h,
        json=_product_body(None, pid, filamentId=None),  # no filamentValues either
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_requires_both_links(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FR-310: at create a product references SAVED items — both FKs are required."""
    h = _premium(monkeypatch, migrated_db, "prod-links-1")
    fid, pid = _mk_refs(db_client, h)

    for body in (
        _product_body(fid, pid, filamentId=None),
        _product_body(fid, pid, printerId=None),
    ):
        r = _post(db_client, h, body)
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/products", headers=h).json() == []


def test_unresolvable_reference_is_422_never_stored(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A reference that does not resolve to an OWNED live row is a validation error —
    the same 422 whether the id is nonexistent or another tenant's (no existence oracle,
    SC-308)."""
    h_a = _premium(monkeypatch, migrated_db, "prod-ref-a")
    fid_a, pid_a = _mk_refs(db_client, h_a)

    h_b = _premium(monkeypatch, migrated_db, "prod-ref-b")
    fid_b, pid_b = _mk_refs(db_client, h_b)

    for body in (
        _product_body(fid_a, pid_b),  # another tenant's filament
        _product_body(fid_b, pid_a),  # another tenant's printer
        _product_body("00000000-0000-0000-0000-000000000000", pid_b),  # nonexistent
        _product_body("not-a-uuid", pid_b),  # malformed
    ):
        r = _post(db_client, h_b, body)
        assert r.status_code == 422
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/products", headers=h_b).json() == []


@pytest.mark.parametrize(
    ("patch", "reason"),
    [
        ({"name": "   "}, "blank name"),
        ({"pieceInputs": {**PIECE, "printGrams": "-1"}}, "negative grams"),
        ({"pieceInputs": {**PIECE, "printGrams": "NaN"}}, "NaN grams"),
        ({"pieceInputs": {**PIECE, "markupVarejoPct": "abc"}}, "non-numeric markup"),
        ({"tariffPerKwh": "-0.5"}, "negative tariff"),
        ({"channels": [{**CHANNEL, "marketplace": "EBAY"}]}, "unknown marketplace"),
        ({"channels": [{**CHANNEL, "commissionPct": "100"}]}, "commission out of [0,100)"),
        ({"channels": [{**CHANNEL, "fixedFee": "-1"}]}, "negative fee"),
        ({"otherCosts": [{"name": "x", "value": "-2"}]}, "negative other cost"),
        ({"otherCosts": [{"name": "x", "value": "abc"}]}, "non-numeric other cost"),
        # Magnitude ceiling — a huge-but-finite value would overflow its NUMERIC column at write
        # time (Postgres → 500); it must be rejected up front as a clean 422 (never a 500).
        ({"pieceInputs": {**PIECE, "printGrams": "1000000000"}}, "grams at QTY_G ceiling (10^9)"),
        ({"pieceInputs": {**PIECE, "markupVarejoPct": "1000"}}, "markup at PERCENT ceiling (10^3)"),
        ({"tariffPerKwh": "1000000000000"}, "tariff at MONEY_RATE ceiling (10^12)"),
    ],
)
def test_invalid_input_is_422_and_never_stored(
    db_client: TestClient,
    migrated_db: str,
    monkeypatch: pytest.MonkeyPatch,
    patch: dict[str, Any],
    reason: str,
) -> None:
    """FR-306 discipline extends to the JSONB shapes (D4) — a bad entry is NEVER stored."""
    h = _premium(monkeypatch, migrated_db, "prod-val-1")
    fid, pid = _mk_refs(db_client, h)
    r = _post(db_client, h, _product_body(fid, pid, **patch))
    assert r.status_code == 422, reason
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/products", headers=h).json() == []


def test_per_account_isolation(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h_a = _premium(monkeypatch, migrated_db, "prod-iso-a")
    fid, pid = _mk_refs(db_client, h_a)
    prod_id = _post(db_client, h_a, _product_body(fid, pid)).json()["id"]

    h_b = _premium(monkeypatch, migrated_db, "prod-iso-b")  # re-patches verify to B
    assert db_client.get("/api/v1/products", headers=h_b).json() == []
    # Another account's row reads as 404 — existence is never leaked (SC-308).
    assert db_client.get(f"/api/v1/products/{prod_id}", headers=h_b).status_code == 404
    fid_b, pid_b = _mk_refs(db_client, h_b)
    assert (
        db_client.put(
            f"/api/v1/products/{prod_id}", headers=h_b, json=_product_body(fid_b, pid_b)
        ).status_code
        == 404
    )
    assert db_client.delete(f"/api/v1/products/{prod_id}", headers=h_b).status_code == 404

    # A still owns its row untouched.
    patch_verify(monkeypatch, "prod-iso-a")
    assert db_client.get(f"/api/v1/products/{prod_id}", headers=h_a).status_code == 200


def test_lapsed_reads_but_cannot_write(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "prod-lapse-1")
    fid, pid = _mk_refs(db_client, h)
    prod_id = _post(db_client, h, _product_body(fid, pid)).json()["id"]

    import sqlalchemy as sa

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = 'prod-lapse-1'"
            )
        )
    engine.dispose()

    # Reads keep working (Q3 freeze)…
    assert db_client.get("/api/v1/products", headers=h).status_code == 200
    assert db_client.get(f"/api/v1/products/{prod_id}", headers=h).status_code == 200
    # …writes deny honestly.
    for resp in (
        _post(db_client, h, _product_body(fid, pid)),
        db_client.put(f"/api/v1/products/{prod_id}", headers=h, json=_product_body(fid, pid)),
        db_client.delete(f"/api/v1/products/{prod_id}", headers=h),
    ):
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


# ══ 013 US6 / T074 — audit finding E2-03: `_live_links` was not owner-scoped ═════════════════════


def test_E2_03_live_links_never_resolves_another_accounts_filament_or_printer(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Audit finding E2-03. `_live_links` loaded the linked filament/printer rows by ID ALONE — no
    `owner_uid` predicate — while every sibling query in this module is owner-scoped. The write
    path made a cross-tenant link unreachable, so the leak was latent; but "unreachable today" is
    not an isolation guarantee, and this is the read path that renders a product's live values. A
    row repointed at another account's reference (simulated here at the DB level, the only way to
    reach the state) must fall back to the product's OWN snapshot columns, never render B's data.
    """
    import sqlalchemy as sa

    h_b = _premium(monkeypatch, migrated_db, "prod-links-b")
    fid_b = db_client.post(
        "/api/v1/filaments", headers=h_b, json={**FILAMENT, "costPerRoll": "999.00"}
    ).json()["id"]
    pid_b = db_client.post(
        "/api/v1/printers", headers=h_b, json={**PRINTER, "machineValue": "9999.00"}
    ).json()["id"]

    h_a = _premium(monkeypatch, migrated_db, "prod-links-a")
    fid_a, pid_a = _mk_refs(db_client, h_a)
    prod_id = _post(db_client, h_a, _product_body(fid_a, pid_a)).json()["id"]

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text("UPDATE products SET filament_id = :f, printer_id = :p WHERE id = :i"),
            {"f": fid_b, "p": pid_b, "i": prod_id},
        )
    engine.dispose()

    detail = db_client.get(f"/api/v1/products/{prod_id}", headers=h_a)
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert body["filamentValues"]["costPerRoll"] == "110.00", body["filamentValues"]
    assert body["printerValues"]["machineValue"] == "1200.00", body["printerValues"]

    listed = next(p for p in db_client.get("/api/v1/products", headers=h_a).json())
    assert listed["filamentValues"]["costPerRoll"] == "110.00", listed["filamentValues"]
    assert listed["printerValues"]["machineValue"] == "1200.00", listed["printerValues"]
