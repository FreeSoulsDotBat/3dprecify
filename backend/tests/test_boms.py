"""US2/US6 (FR-405..409/FR-415/FR-416, SC-406/411/412) — kit persistence, FAILING-first (T010).

Wire per `specs/008-e3-multi-piece-bom/contracts/api-surface.md`: `/api/v1/boms`, camelCase,
money as DECIMAL STRINGS, INPUTS ONLY — **no price is ever stored or served** (FR-407; the client
recomputes via `computeBom`, ADR-0016). Persistence is the server-authoritative boundary
(ADR-0015): writes pass `require_entitlement`, reads pass `require_catalog_read`.

**Atomic kit-save + materialization (ADR-0017, K3/K4)** is the heart of this suite: ONE transaction
per write — every ad-hoc line either references an existing live product with the same trimmed name
(`action: "referenced"`) or materializes a NEW manual product (refs NULL + full snapshot,
`action: "created"`), and then the kit + lines commit together. A denied or failed save materializes
NOTHING (SC-411). Consequence asserted throughout: **every persisted line is born with a
`productId`** — the snapshot-only branch of the CHECK is reachable only via D6 degradation (PR-C).

The FR-310 relaxation is **path-scoped**: the public `POST /api/v1/products` still requires saved
filament+printer references (regression-guarded below).

`BomLineOut` carries the full RESOLVED value-set (the `ProductOut` value surface) so a line is
self-sufficient for `computeBom` without a second round-trip — live product ⇒ resolved from the live
row; degraded ⇒ from the last-known snapshot columns (data-model §bom_lines).
"""

from collections.abc import Iterator
from typing import Any

import pytest
import sqlalchemy as sa
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
# Column-scale values (QTY_G/QTY_H 3dp, MONEY_RATE 6dp, PERCENT 3dp) so the DB round-trips the
# exact same string — the SC-305 lossless invariant, asserted literally (as in test_products).
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
FILAMENT_VALUES = {"material": "PLA", "costPerRoll": "110.00", "rollWeightKg": "1.000"}
PRINTER_VALUES = {
    "machineValue": "1200.00",
    "machineLifetimeHours": "2000.000",
    "avgPowerKw": "0.1200",
    "maintenanceReservePerHour": "0.500000",
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


def _free(monkeypatch: pytest.MonkeyPatch, uid: str) -> dict[str, str]:
    """A signed-in identity with NO grant — the honest free tier."""
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _mk_refs(client: TestClient, h: dict[str, str]) -> tuple[str, str]:
    fid = client.post("/api/v1/filaments", headers=h, json=dict(FILAMENT)).json()["id"]
    pid = client.post("/api/v1/printers", headers=h, json=dict(PRINTER)).json()["id"]
    return fid, pid


def _mk_product(client: TestClient, h: dict[str, str], fid: str, pid: str, name: str) -> str:
    """A real catalog product through the public (FR-310) create path."""
    body = {
        "name": name,
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": dict(PIECE),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [dict(CHANNEL)],
        "otherCosts": [dict(OTHER_COST)],
    }
    r = client.post("/api/v1/products", headers=h, json=body)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def _ad_hoc_line(piece_name: str | None = "Peça 1 · Kit", **overrides: Any) -> dict[str, Any]:
    """An ad-hoc line: the ProductIn value-set + a name, so it can MATERIALIZE (K4)."""
    line: dict[str, Any] = {
        "quantity": 2,
        "pieceInputs": dict(PIECE),
        "filamentValues": dict(FILAMENT_VALUES),
        "printerValues": dict(PRINTER_VALUES),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [dict(CHANNEL)],
        "otherCosts": [dict(OTHER_COST)],
    }
    if piece_name is not None:
        line["pieceName"] = piece_name
    line.update(overrides)
    return line


def _ref_line(product_id: str, **overrides: Any) -> dict[str, Any]:
    line: dict[str, Any] = {"quantity": 3, "productId": product_id}
    line.update(overrides)
    return line


def _bom_body(lines: list[dict[str, Any]], **overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"name": "Kit Suporte", "lines": lines}
    body.update(overrides)
    return body


def _post(client: TestClient, h: dict[str, str], body: dict[str, Any]) -> Any:
    return client.post("/api/v1/boms", headers=h, json=body)


def _keys_recursive(node: Any) -> Iterator[str]:
    if isinstance(node, dict):
        for k, v in node.items():
            yield k
            yield from _keys_recursive(v)
    elif isinstance(node, list):
        for item in node:
            yield from _keys_recursive(item)


def _rows(db_url: str, sql: str, **params: Any) -> list[Any]:
    """Read the DB directly — the only honest way to assert 'nothing was persisted' for an
    identity that is not even allowed to READ (a denied free save, SC-411)."""
    engine = sa.create_engine(db_url)
    with engine.begin() as conn:
        result = list(conn.execute(sa.text(sql), params).fetchall())
    engine.dispose()
    return result


def _count(db_url: str, table: str, uid: str) -> int:
    sql = f"SELECT count(*) FROM {table} WHERE owner_uid = :uid"  # noqa: S608 - fixed literals
    return int(_rows(db_url, sql, uid=uid)[0][0])


# --- The gate (FR-405/SC-301 lineage): writes are premium, denials persist NOTHING ------------


def test_signed_out_is_401(db_client: TestClient) -> None:
    """No identity ⇒ 401 before any entitlement check — reads included (kits are never public)."""
    for resp in (
        db_client.post("/api/v1/boms", json=_bom_body([_ad_hoc_line()])),
        db_client.get("/api/v1/boms"),
        db_client.get("/api/v1/boms/00000000-0000-0000-0000-000000000000"),
        db_client.put(
            "/api/v1/boms/00000000-0000-0000-0000-000000000000", json=_bom_body([_ad_hoc_line()])
        ),
        db_client.delete("/api/v1/boms/00000000-0000-0000-0000-000000000000"),
    ):
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


def test_free_write_is_403_and_materializes_nothing(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """SC-411: a DENIED save materializes nothing — no kit AND no manual product. Asserted
    against the DB directly (a free identity cannot even read the catalog back)."""
    uid = "bom-free-1"
    h = _free(monkeypatch, uid)

    r = _post(db_client, h, _bom_body([_ad_hoc_line(), _ad_hoc_line(piece_name="Peça 2 · Kit")]))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"

    assert _count(migrated_db, "boms", uid) == 0
    assert _count(migrated_db, "products", uid) == 0
    # Free cannot read the catalog either (never granted — not a lapse).
    assert db_client.get("/api/v1/boms", headers=h).status_code == 403


def test_forged_client_premium_state_is_a_non_event(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A client claiming premium (header or body) is still denied — the server is the boundary."""
    uid = "bom-forged-1"
    h = _free(monkeypatch, uid)
    r = db_client.post(
        "/api/v1/boms",
        headers={**h, "X-Premium": "true"},
        json={**_bom_body([_ad_hoc_line()]), "isPremium": True},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
    assert _count(migrated_db, "boms", uid) == 0
    assert _count(migrated_db, "products", uid) == 0


# --- CRUD round-trip: inputs only, decimal strings, born with productId -----------------------


def test_crud_round_trip_inputs_only(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "bom-crud-1")
    fid, pid = _mk_refs(db_client, h)
    prod_id = _mk_product(db_client, h, fid, pid, "Base")

    created = _post(db_client, h, _bom_body([_ref_line(prod_id), _ad_hoc_line()]))
    assert created.status_code == 201, created.text
    body = created.json()
    bom_id = body["id"]
    assert body["name"] == "Kit Suporte"
    assert [line["position"] for line in body["lines"]] == [0, 1]
    assert [line["quantity"] for line in body["lines"]] == [3, 2]

    ref_line, adhoc_line = body["lines"]
    assert ref_line["productId"] == prod_id
    # ADR-0017: the ad-hoc line MATERIALIZED — it is born with a productId, never snapshot-only.
    assert adhoc_line["productId"] is not None
    assert all(line["degraded"] is False for line in body["lines"])

    # The resolved value-set rides the line (self-sufficient for computeBom, ADR-0016) — and the
    # money round-trips as byte-exact DECIMAL STRINGS (ADR-0008), never JSON floats.
    assert ref_line["pieceInputs"] == PIECE
    assert ref_line["filamentValues"] == FILAMENT_VALUES
    assert ref_line["printerValues"] == PRINTER_VALUES
    assert ref_line["tariffPerKwh"] == "1.000000"
    assert ref_line["includeMarketplace"] is True
    assert ref_line["channels"] == [CHANNEL]
    assert ref_line["otherCosts"] == [OTHER_COST]

    # FR-407: INPUTS ONLY — no stored price anywhere in the payload.
    assert not [k for k in _keys_recursive(body) if "price" in k.lower()]
    assert not [k for k in _keys_recursive(body) if "preco" in k.lower()]

    listed = db_client.get("/api/v1/boms", headers=h)
    assert listed.status_code == 200
    assert [b["id"] for b in listed.json()] == [bom_id]

    got = db_client.get(f"/api/v1/boms/{bom_id}", headers=h)
    assert got.status_code == 200
    assert got.json()["lines"][0]["pieceInputs"]["printGrams"] == "100.000"
    # `materializations` is a WRITE-only envelope (K4) — absent on reads.
    assert "materializations" not in got.json() or got.json()["materializations"] is None

    # A fresh session (new client, new engine) reloads the identical kit.
    app2 = create_app(Settings(app_env="dev"))
    with TestClient(app2, raise_server_exceptions=False) as fresh:
        again = fresh.get(f"/api/v1/boms/{bom_id}", headers=h)
        assert again.status_code == 200
        assert again.json()["lines"] == got.json()["lines"]

    updated = db_client.put(
        f"/api/v1/boms/{bom_id}",
        headers=h,
        json=_bom_body([_ref_line(prod_id, quantity=7)], name="Kit Suporte v2"),
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Kit Suporte v2"
    assert [line["quantity"] for line in updated.json()["lines"]] == [7]

    deleted = db_client.delete(f"/api/v1/boms/{bom_id}", headers=h)
    assert deleted.status_code == 204
    assert db_client.get(f"/api/v1/boms/{bom_id}", headers=h).status_code == 404
    assert db_client.get("/api/v1/boms", headers=h).json() == []


def test_quantity_zero_is_an_honest_zero_not_a_rejection(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Q1: quantity >= 0 — a zeroed line is a legitimate 'not in this order' state, not an error."""
    h = _premium(monkeypatch, migrated_db, "bom-qty0-1")
    r = _post(db_client, h, _bom_body([_ad_hoc_line(quantity=0)]))
    assert r.status_code == 201
    assert r.json()["lines"][0]["quantity"] == 0


def test_over_ceiling_line_input_is_422_never_a_500(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A huge-but-finite snapshot value would overflow the bom_lines NUMERIC column at write time
    (Postgres → 500). The shared PieceInputs ceiling rejects it up front as a clean 422 and the kit
    (with its atomic materialization) is never partially written."""
    h = _premium(monkeypatch, migrated_db, "bom-ceil-1")
    line = _ad_hoc_line(pieceInputs={**PIECE, "printGrams": "1000000000"})  # 10^9 = QTY_G ceiling
    r = _post(db_client, h, _bom_body([line]))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h).json() == []
    assert db_client.get("/api/v1/products", headers=h).json() == []  # nothing materialized


def test_over_ceiling_tariff_per_kwh_is_422_never_a_500(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """E3-01: the line's `tariffPerKwh` had NO ceiling while `ProductIn.tariffPerKwh` enforced
    CEIL_RATE — so an over-ceiling ad-hoc line passed body validation and only blew up downstream
    (materialization / the MONEY_RATE Numeric(18,6) column) as an opaque 500. `10**12` is the first
    magnitude that overflows. Shared validator ⇒ a clean, terminal 422 and nothing written."""
    h = _premium(monkeypatch, migrated_db, "bom-tariff-ceil-1")
    r = _post(db_client, h, _bom_body([_ad_hoc_line(tariffPerKwh="1000000000000")]))
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h).json() == []
    assert db_client.get("/api/v1/products", headers=h).json() == []  # nothing materialized


def test_over_int4_quantity_is_422_never_a_500(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """E3-02: `quantity` is an int4 column; the validator only asserted `>= 0`, so 2**31 reached the
    INSERT and Postgres raised `integer out of range` → 500. CEIL_QUANTITY (2147483647) is the
    physical column limit, enforced up front."""
    h = _premium(monkeypatch, migrated_db, "bom-qty-ceil-1")
    r = _post(db_client, h, _bom_body([_ad_hoc_line(quantity=2147483648)]))
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h).json() == []
    # The boundary itself is still legal — the ceiling is inclusive of the storable max.
    ok = _post(db_client, h, _bom_body([_ad_hoc_line(quantity=2147483647)]))
    assert ok.status_code == 201, ok.text


def test_a_kit_with_no_lines_is_422(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """E3-04 / owner decision D4: an empty kit was blocked ONLY in the client. `BomIn.lines` now
    carries `min_length=1`, so the server holds the same promise the UI already makes."""
    h = _premium(monkeypatch, migrated_db, "bom-empty-1")
    r = _post(db_client, h, _bom_body([]))
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h).json() == []


# --- Materialization (ADR-0017 / K3 / K4) ----------------------------------------------------


def test_ad_hoc_line_materializes_a_manual_product(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """K3: an ad-hoc piece becomes a MANUAL catalog product — refs NULL + the full value snapshot
    (the attention state is DERIVED from the null refs, no new column) — and the line references
    it. `action: "created"` is reported so the client can say so honestly (K4)."""
    h = _premium(monkeypatch, migrated_db, "bom-mat-1")

    created = _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="Suporte L")]))
    assert created.status_code == 201, created.text
    body = created.json()

    assert body["materializations"] == [
        {"position": 0, "productId": body["lines"][0]["productId"], "action": "created"}
    ]

    products = db_client.get("/api/v1/products", headers=h).json()
    assert [p["name"] for p in products] == ["Suporte L"]
    manual = products[0]
    assert manual["id"] == body["lines"][0]["productId"]
    # Born manual: NO filament/printer references, full snapshot present (K3 — the honest
    # "needs attention" state, identical in shape to a delete-degraded product).
    assert manual["filamentId"] is None
    assert manual["printerId"] is None
    assert manual["filamentValues"] == FILAMENT_VALUES
    assert manual["printerValues"] == PRINTER_VALUES
    assert manual["pieceInputs"] == PIECE
    assert manual["channels"] == [CHANNEL]
    assert manual["otherCosts"] == [OTHER_COST]


def test_dedup_references_the_existing_live_product_and_supersedes_values(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """K4 dedup: btrim-exact name match against the account's LIVE products ⇒ the line REFERENCES
    the existing product (no duplicate, SC-411) and the submitted typed values are SUPERSEDED by
    the live ones (the reference wins — surfaced honestly via `action: "referenced"`)."""
    h = _premium(monkeypatch, migrated_db, "bom-dedup-1")
    fid, pid = _mk_refs(db_client, h)
    existing = _mk_product(db_client, h, fid, pid, "Suporte L")

    # Same name (padded — btrim), DIFFERENT values.
    line = _ad_hoc_line(
        piece_name="  Suporte L  ",
        pieceInputs={**PIECE, "printGrams": "999.000"},
        filamentValues={**FILAMENT_VALUES, "costPerRoll": "1.00"},
    )
    created = _post(db_client, h, _bom_body([line]))
    assert created.status_code == 201, created.text
    body = created.json()

    assert body["materializations"] == [
        {"position": 0, "productId": existing, "action": "referenced"}
    ]
    assert body["lines"][0]["productId"] == existing
    # Superseded: the line resolves to the LIVE product's values, not the ones it submitted.
    assert body["lines"][0]["pieceInputs"]["printGrams"] == "100.000"
    assert body["lines"][0]["filamentValues"]["costPerRoll"] == "110.00"

    # No duplicate product was created, and the existing one was NOT overwritten.
    products = db_client.get("/api/v1/products", headers=h).json()
    assert [p["name"] for p in products] == ["Suporte L"]
    assert products[0]["pieceInputs"]["printGrams"] == "100.000"
    assert products[0]["filamentId"] == fid  # still linked — a kit save never unlinks it


def test_dedup_matches_by_name_norm(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """019/PR-D · T129 — emenda datada ao ADR-0017 §3: o match é por `name_norm`.

    A regra ERA trim + exato, case-sensitive, e este teste documentava isso ("'suporte l' é uma
    peça nova"). Com a unicidade de nome (ADR-0033 §4) essa regra virou armadilha: 'suporte l'
    não casaria aqui, seguiria para a materialização e bateria no índice único DENTRO da
    transação atômica do kit. Casar pela MESMA chave que o índice usa é o que faz a referência e
    a unicidade contarem a mesma história — e o efeito para o vendedor é o certo: ele digitou o
    nome da peça que já tem, então é ELA que entra no kit, com os valores vivos dela.
    """
    h = _premium(monkeypatch, migrated_db, "bom-case-1")
    fid, pid = _mk_refs(db_client, h)
    existing = _mk_product(db_client, h, fid, pid, "Suporte L")

    created = _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="suporte l")]))
    assert created.status_code == 201
    assert created.json()["materializations"][0]["action"] == "referenced"
    assert created.json()["materializations"][0]["productId"] == existing
    # Nada foi criado em duplicidade — e nenhum "(2)" apareceu, porque não houve conflito nenhum.
    assert [p["name"] for p in db_client.get("/api/v1/products", headers=h).json()] == ["Suporte L"]


def test_dedup_never_matches_a_soft_deleted_product(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """LIVE rows only: a name that matches only a soft-deleted product materializes a NEW one —
    a kit line must never reference a dead row."""
    h = _premium(monkeypatch, migrated_db, "bom-dead-1")
    fid, pid = _mk_refs(db_client, h)
    dead = _mk_product(db_client, h, fid, pid, "Suporte L")
    assert db_client.delete(f"/api/v1/products/{dead}", headers=h).status_code == 204

    created = _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="Suporte L")]))
    assert created.status_code == 201
    body = created.json()
    assert body["materializations"][0]["action"] == "created"
    assert body["lines"][0]["productId"] != dead
    assert [p["name"] for p in db_client.get("/api/v1/products", headers=h).json()] == ["Suporte L"]


def test_intra_save_same_name_lines_share_one_materialized_product(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ADR-0017 §1: the in-txn {trimmedName → productId} map dedups WITHIN a single save too —
    two same-name ad-hoc lines create ONE product, never two."""
    h = _premium(monkeypatch, migrated_db, "bom-intra-1")
    created = _post(
        db_client,
        h,
        _bom_body([_ad_hoc_line(piece_name="Perna"), _ad_hoc_line(piece_name="Perna", quantity=4)]),
    )
    assert created.status_code == 201, created.text
    body = created.json()

    first, second = body["lines"]
    assert first["productId"] == second["productId"]
    assert [m["action"] for m in body["materializations"]] == ["created", "referenced"]
    assert [p["name"] for p in db_client.get("/api/v1/products", headers=h).json()] == ["Perna"]


def test_a_failing_line_materializes_nothing(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FR-415 all-or-nothing: line 0 materializes, then line 1 fails to resolve INSIDE the same
    transaction — the whole save rolls back, product included. This is the test the atomic
    boundary exists for (a client two-phase save could not pass it)."""
    uid = "bom-atomic-1"
    h = _premium(monkeypatch, migrated_db, uid)

    r = _post(
        db_client,
        h,
        _bom_body(
            [
                _ad_hoc_line(piece_name="Peça válida"),
                _ref_line("00000000-0000-0000-0000-000000000000"),  # unresolvable → 422
            ]
        ),
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    assert db_client.get("/api/v1/boms", headers=h).json() == []
    # The valid line's product must NOT survive the rollback.
    assert db_client.get("/api/v1/products", headers=h).json() == []
    assert _count(migrated_db, "products", uid) == 0


def test_public_product_create_still_requires_saved_refs(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The FR-310 relaxation is PATH-SCOPED (ADR-0017 §2): only the kit-save service builds
    ref-less manual products. The public create path is unchanged — regression guard."""
    h = _premium(monkeypatch, migrated_db, "bom-fr310-1")
    fid, pid = _mk_refs(db_client, h)

    r = db_client.post(
        "/api/v1/products",
        headers=h,
        json={
            "name": "Sem refs",
            "printerId": pid,
            "pieceInputs": dict(PIECE),
            "filamentValues": dict(FILAMENT_VALUES),  # values instead of a filamentId
            "tariffPerKwh": "1.000000",
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/products", headers=h).json() == []
    _ = fid


# --- Per-line validation: rejected input is NEVER stored (FR-306 lineage) ---------------------


@pytest.mark.parametrize(
    ("line", "reason"),
    [
        (_ad_hoc_line(piece_name=None), "ad-hoc line without pieceName (K4 — nothing to name it)"),
        (_ad_hoc_line(piece_name="   "), "blank pieceName"),
        ({"quantity": 1}, "neither a reference nor an ad-hoc value-set"),
        ({"quantity": 1, "pieceName": "X"}, "pieceName without the value-set"),
        (_ad_hoc_line(productId="00000000-0000-0000-0000-000000000000"), "both ref AND ad-hoc"),
        (_ad_hoc_line(quantity=-1), "negative quantity"),
        (_ad_hoc_line(pieceInputs={**PIECE, "printGrams": "-1"}), "negative grams"),
        (_ad_hoc_line(pieceInputs={**PIECE, "printGrams": "NaN"}), "NaN grams"),
        (_ad_hoc_line(pieceInputs={**PIECE, "markupVarejoPct": "abc"}), "non-numeric markup"),
        (_ad_hoc_line(tariffPerKwh="-0.5"), "negative tariff"),
        (
            _ad_hoc_line(filamentValues={**FILAMENT_VALUES, "rollWeightKg": "0"}),
            "zero roll weight (denominator)",
        ),
        (
            _ad_hoc_line(printerValues={**PRINTER_VALUES, "machineLifetimeHours": "0"}),
            "zero lifetime (denominator)",
        ),
        (_ad_hoc_line(channels=[{**CHANNEL, "marketplace": "EBAY"}]), "unknown marketplace"),
        (_ad_hoc_line(channels=[{**CHANNEL, "commissionPct": "100"}]), "commission out of [0,100)"),
        (_ad_hoc_line(otherCosts=[{"name": "x", "value": "-2"}]), "negative other cost"),
    ],
)
def test_invalid_line_is_422_and_stores_nothing(
    db_client: TestClient,
    migrated_db: str,
    monkeypatch: pytest.MonkeyPatch,
    line: dict[str, Any],
    reason: str,
) -> None:
    uid = "bom-val-1"
    h = _premium(monkeypatch, migrated_db, uid)
    r = _post(db_client, h, _bom_body([line]))
    assert r.status_code == 422, reason
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h).json() == []
    assert _count(migrated_db, "products", uid) == 0  # a rejected save materializes nothing


def test_blank_kit_name_is_422(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "bom-name-1")
    r = _post(db_client, h, _bom_body([_ad_hoc_line()], name="   "))
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h).json() == []


def test_unresolvable_product_reference_is_422_with_no_existence_oracle(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """SC-308 lineage: nonexistent, malformed, soft-deleted and CROSS-TENANT ids are the same
    422 — a kit save never tells you whether someone else's product exists."""
    h_a = _premium(monkeypatch, migrated_db, "bom-ref-a")
    fid_a, pid_a = _mk_refs(db_client, h_a)
    prod_a = _mk_product(db_client, h_a, fid_a, pid_a, "Do A")

    uid_b = "bom-ref-b"
    h_b = _premium(monkeypatch, migrated_db, uid_b)
    fid_b, pid_b = _mk_refs(db_client, h_b)
    dead_b = _mk_product(db_client, h_b, fid_b, pid_b, "Morto")
    assert db_client.delete(f"/api/v1/products/{dead_b}", headers=h_b).status_code == 204

    for product_id, reason in (
        (prod_a, "another tenant's product"),
        (dead_b, "own soft-deleted product"),
        ("00000000-0000-0000-0000-000000000000", "nonexistent"),
        ("not-a-uuid", "malformed"),
    ):
        r = _post(db_client, h_b, _bom_body([_ref_line(product_id)]))
        assert r.status_code == 422, reason
        assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get("/api/v1/boms", headers=h_b).json() == []


# --- Per-account isolation (FR-408 / SC-406) -------------------------------------------------


def test_per_account_isolation(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h_a = _premium(monkeypatch, migrated_db, "bom-iso-a")
    bom_id = _post(db_client, h_a, _bom_body([_ad_hoc_line()])).json()["id"]

    h_b = _premium(monkeypatch, migrated_db, "bom-iso-b")  # re-patches verify to B
    assert db_client.get("/api/v1/boms", headers=h_b).json() == []
    # Another account's kit reads as 404 — indistinguishable from nonexistent (no oracle).
    assert db_client.get(f"/api/v1/boms/{bom_id}", headers=h_b).status_code == 404
    assert (
        db_client.put(
            f"/api/v1/boms/{bom_id}", headers=h_b, json=_bom_body([_ad_hoc_line()])
        ).status_code
        == 404
    )
    assert db_client.delete(f"/api/v1/boms/{bom_id}", headers=h_b).status_code == 404

    # A still owns its kit, untouched.
    patch_verify(monkeypatch, "bom-iso-a")
    assert db_client.get(f"/api/v1/boms/{bom_id}", headers=h_a).status_code == 200


# --- D6: deleting a referenced product DEGRADES the line (review BLOCKER regression) ----------


def test_deleting_a_referenced_product_degrades_the_line_not_breaks_the_kit(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review 2026-07-12 BLOCKER: soft-deleting a product a kit references used to leave the read
    path serving the dead product as `degraded: false` (an honesty lie) AND make the kit
    unsaveable (any PUT re-sent the stale productId → 422). The fix: the read resolver is
    owner-scoped + live-only, exactly like the write resolver, so the line DEGRADES to its
    last-known snapshot — priceable, editable, re-saveable (SC-405)."""
    h = _premium(monkeypatch, migrated_db, "bom-d6-1")
    fid, pid = _mk_refs(db_client, h)
    prod = _mk_product(db_client, h, fid, pid, "Base")
    bom_id = _post(db_client, h, _bom_body([_ref_line(prod, quantity=4)])).json()["id"]

    assert db_client.delete(f"/api/v1/products/{prod}", headers=h).status_code == 204

    # Read: the line degrades honestly (NOT served as a live link to a deleted row).
    got = db_client.get(f"/api/v1/boms/{bom_id}", headers=h)
    assert got.status_code == 200
    line = got.json()["lines"][0]
    assert line["degraded"] is True
    assert line["productId"] is None
    assert line["quantity"] == 4
    # The last-known snapshot is intact and still priceable — the values the product resolved to.
    assert line["pieceInputs"]["printGrams"] == "100.000"
    assert line["filamentValues"]["costPerRoll"] == "110.00"
    assert line["printerValues"]["machineValue"] == "1200.00"

    # Write: the kit is STILL SAVEABLE — a degraded line re-saves as an ad-hoc piece (it
    # re-materializes a manual product; the dead row is never referenced again).
    reopened = db_client.put(
        f"/api/v1/boms/{bom_id}",
        headers=h,
        json=_bom_body(
            [
                _ad_hoc_line(
                    piece_name="Base (recuperada)",
                    quantity=4,
                    pieceInputs=line["pieceInputs"],
                    filamentValues=line["filamentValues"],
                    printerValues=line["printerValues"],
                    tariffPerKwh=line["tariffPerKwh"],
                )
            ],
            name="Kit Recuperado",
        ),
    )
    assert reopened.status_code == 200, reopened.text
    assert reopened.json()["name"] == "Kit Recuperado"
    assert reopened.json()["lines"][0]["degraded"] is False  # re-materialized → live again


def test_degraded_kit_line_serves_the_same_values_as_a_degraded_product(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Review F3 safety net (before the PR-C helper extraction): a degraded kit line and a
    degraded product built from the SAME snapshot must resolve to byte-identical values. Today
    the fallback policy is DUPLICATED in `products._to_out` and `boms._to_out`; this pins that
    they agree, so an extraction (or a drift) that changed one and not the other would fail here."""
    h = _premium(monkeypatch, migrated_db, "bom-f3-1")
    fid, pid = _mk_refs(db_client, h)
    prod = _mk_product(db_client, h, fid, pid, "Peça X")
    bom_id = _post(db_client, h, _bom_body([_ref_line(prod)])).json()["id"]

    # Degrade BOTH surfaces the same way: delete the product's filament + printer (product
    # degrades via the E2 D6 path) and delete the product itself (kit line degrades via E3 D6).
    assert db_client.delete(f"/api/v1/filaments/{fid}", headers=h).status_code == 204
    assert db_client.delete(f"/api/v1/printers/{pid}", headers=h).status_code == 204
    degraded_product = db_client.get(f"/api/v1/products/{prod}", headers=h).json()

    assert db_client.delete(f"/api/v1/products/{prod}", headers=h).status_code == 204
    degraded_line = db_client.get(f"/api/v1/boms/{bom_id}", headers=h).json()["lines"][0]

    assert degraded_line["degraded"] is True
    # The resolved value surface must match field-for-field (the money-drift guard).
    assert degraded_line["pieceInputs"] == degraded_product["pieceInputs"]
    assert degraded_line["filamentValues"] == degraded_product["filamentValues"]
    assert degraded_line["printerValues"] == degraded_product["printerValues"]
    assert degraded_line["tariffPerKwh"] == degraded_product["tariffPerKwh"]


# --- D3 live reflection + the read-time-degrade DB pins (ADR-0017 addendum, 2026-07-12) -------


def _edit_product_grams(
    client: TestClient, h: dict[str, str], product_id: str, fid: str, pid: str, grams: str
) -> None:
    """PUT the product (full ProductIn replace, saved refs required) with a new printGrams."""
    r = client.put(
        f"/api/v1/products/{product_id}",
        headers=h,
        json={
            "name": "Base",
            "filamentId": fid,
            "printerId": pid,
            "pieceInputs": {**PIECE, "printGrams": grams},
            "tariffPerKwh": "1.000000",
            "includeMarketplace": True,
            "channels": [dict(CHANNEL)],
            "otherCosts": [dict(OTHER_COST)],
        },
    )
    assert r.status_code == 200, r.text


def test_editing_a_referenced_product_reflects_live_on_kit_reopen(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """D3 (SC-405): a kit line reads its referenced product **live on every reopen** — there is no
    stored copy at save time. Edit the product and the kit resolves the NEW values on the next
    read, no re-save. This is the whole reason `_resolve_views` reads the live product instead of
    freezing a snapshot into the line at write time."""
    h = _premium(monkeypatch, migrated_db, "bom-d3-1")
    fid, pid = _mk_refs(db_client, h)
    prod = _mk_product(db_client, h, fid, pid, "Base")
    bom_id = _post(db_client, h, _bom_body([_ref_line(prod, quantity=4)])).json()["id"]

    before = db_client.get(f"/api/v1/boms/{bom_id}", headers=h).json()["lines"][0]
    assert before["degraded"] is False
    assert before["pieceInputs"]["printGrams"] == "100.000"

    _edit_product_grams(db_client, h, prod, fid, pid, "250.000")

    after = db_client.get(f"/api/v1/boms/{bom_id}", headers=h).json()["lines"][0]
    assert after["degraded"] is False
    assert after["productId"] == prod
    assert after["pieceInputs"]["printGrams"] == "250.000"  # the LIVE value, not the saved one


def test_soft_delete_leaves_the_line_product_id_dangling_degradation_is_read_time(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ADR-0017 addendum: `delete_product` is a PLAIN soft-delete — it does NOT touch `bom_lines`
    (no eager delete-capture, unlike the E2 filament/printer→product path). The line's
    `product_id` keeps pointing at the (now soft-deleted) row; the line degrades on the API read
    ONLY because `_resolve_views` is live-only. Pinned at the DB level so a future 'optimization'
    that eager-nulls the FK on delete would fail here and flag the divergence from the accepted
    read-time design."""
    h = _premium(monkeypatch, migrated_db, "bom-rt-1")
    fid, pid = _mk_refs(db_client, h)
    prod = _mk_product(db_client, h, fid, pid, "Base")
    bom_id = _post(db_client, h, _bom_body([_ref_line(prod, quantity=4)])).json()["id"]

    assert db_client.delete(f"/api/v1/products/{prod}", headers=h).status_code == 204

    # The line row STILL points at the dead product — soft-delete rewrote nothing in bom_lines.
    line_rows = _rows(migrated_db, "SELECT product_id FROM bom_lines WHERE bom_id = :b", b=bom_id)
    assert str(line_rows[0][0]) == prod  # dangling on purpose (read-time degrade)
    # The product row is soft-deleted (present, deleted_at set), not physically gone.
    prod_rows = _rows(migrated_db, "SELECT deleted_at FROM products WHERE id = :p", p=prod)
    assert len(prod_rows) == 1
    assert prod_rows[0][0] is not None
    # …yet the API read degrades it, purely via the live-only resolver.
    line = db_client.get(f"/api/v1/boms/{bom_id}", headers=h).json()["lines"][0]
    assert line["degraded"] is True
    assert line["productId"] is None


def test_a_hard_purge_nulls_the_fk_and_the_line_still_degrades_and_the_check_holds(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The `ON DELETE SET NULL` FK is defense for a HARD purge only (ADR-0017 addendum). Force a
    raw `DELETE FROM products` (the disaster-recovery / erasure path that bypasses the soft-delete
    service): the FK nulls `bom_lines.product_id`, the link-or-snapshot CHECK still holds because
    `_snapshot_line` wrote the full snapshot on every save, and the API read still degrades to the
    last-known values — no orphan, no CHECK violation, no 500."""
    h = _premium(monkeypatch, migrated_db, "bom-purge-1")
    fid, pid = _mk_refs(db_client, h)
    prod = _mk_product(db_client, h, fid, pid, "Base")
    bom_id = _post(db_client, h, _bom_body([_ref_line(prod, quantity=4)])).json()["id"]

    # Hard purge — raw DELETE, NOT the soft-delete endpoint. The FK must absorb it cleanly.
    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM products WHERE id = :p"), {"p": prod})
    engine.dispose()

    # FK fired: the column is NULL now (and the CHECK held, or the DELETE would have raised).
    line_rows = _rows(migrated_db, "SELECT product_id FROM bom_lines WHERE bom_id = :b", b=bom_id)
    assert line_rows[0][0] is None
    # The read still degrades honestly from the snapshot columns — priceable, no crash.
    line = db_client.get(f"/api/v1/boms/{bom_id}", headers=h).json()["lines"][0]
    assert line["degraded"] is True
    assert line["productId"] is None
    assert line["quantity"] == 4
    assert line["pieceInputs"]["printGrams"] == "100.000"
    assert line["filamentValues"]["costPerRoll"] == "110.00"


# --- US4: manage + the honest lapse policy (FR-409 / SC-407) ---------------------------------


def _revoke(db_url: str, uid: str) -> None:
    engine = sa.create_engine(db_url)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = :uid"
            ),
            {"uid": uid},
        )
    engine.dispose()


def test_update_replaces_the_kit_and_renames_it(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """US4 edit: PUT is REPLACE — the submitted lines ARE the kit, positions re-derived."""
    h = _premium(monkeypatch, migrated_db, "bom-edit-1")
    created = _post(
        db_client,
        h,
        _bom_body([_ad_hoc_line(piece_name="A"), _ad_hoc_line(piece_name="B", quantity=5)]),
    ).json()
    bom_id = created["id"]

    updated = db_client.put(
        f"/api/v1/boms/{bom_id}",
        headers=h,
        json=_bom_body([_ad_hoc_line(piece_name="B", quantity=9)], name="Kit Renomeado"),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["name"] == "Kit Renomeado"
    assert [line["position"] for line in body["lines"]] == [0]
    assert body["lines"][0]["quantity"] == 9
    # "B" already exists (this save created it) — the edit REFERENCES it, never a duplicate.
    assert body["materializations"] == [
        {"position": 0, "productId": body["lines"][0]["productId"], "action": "referenced"}
    ]
    assert sorted(p["name"] for p in db_client.get("/api/v1/products", headers=h).json()) == [
        "A",
        "B",
    ]


def test_duplicate_is_a_plain_create_from_an_existing_kit(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """US4 duplicate: no endpoint of its own — reopening a kit and saving it under a new name
    references the SAME products (the dedup rule), so a copy never forks the catalog."""
    h = _premium(monkeypatch, migrated_db, "bom-dup-1")
    original = _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="Perna")])).json()
    original_product = original["lines"][0]["productId"]

    copy = _post(
        db_client,
        h,
        _bom_body([_ref_line(original_product)], name="Kit Suporte (cópia)"),
    )
    assert copy.status_code == 201
    assert copy.json()["id"] != original["id"]
    assert copy.json()["lines"][0]["productId"] == original_product
    assert len(db_client.get("/api/v1/boms", headers=h).json()) == 2
    assert [p["name"] for p in db_client.get("/api/v1/products", headers=h).json()] == ["Perna"]


def test_lapsed_reads_everything_but_writes_nothing_and_deletes_nothing(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """SC-407 / FR-409 — the Q3 freeze: a lapsed premium keeps READING its kits (they are the
    seller's data, not a rented view), every WRITE denies honestly, and NOTHING is deleted. A
    lapse that quietly dropped rows would be the single most destructive thing this app could do.
    """
    uid = "bom-lapse-1"
    h = _premium(monkeypatch, migrated_db, uid)
    bom_id = _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="Peça viva")])).json()["id"]

    _revoke(migrated_db, uid)

    # Reads keep working…
    listed = db_client.get("/api/v1/boms", headers=h)
    assert listed.status_code == 200
    assert [b["id"] for b in listed.json()] == [bom_id]
    assert db_client.get(f"/api/v1/boms/{bom_id}", headers=h).status_code == 200

    # …writes deny honestly.
    for resp in (
        _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="Nova")])),
        db_client.put(
            f"/api/v1/boms/{bom_id}", headers=h, json=_bom_body([_ad_hoc_line(piece_name="X")])
        ),
        db_client.delete(f"/api/v1/boms/{bom_id}", headers=h),
    ):
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"

    # ZERO rows deleted, and the denied writes materialized nothing.
    assert _count(migrated_db, "boms", uid) == 1
    assert _count(migrated_db, "products", uid) == 1
    assert len(db_client.get("/api/v1/boms", headers=h).json()) == 1


def test_a_re_grant_restores_writes_with_the_data_intact(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The other half of the freeze: coming back finds everything exactly where it was."""
    uid = "bom-regrant-1"
    h = _premium(monkeypatch, migrated_db, uid)
    bom_id = _post(db_client, h, _bom_body([_ad_hoc_line(piece_name="Peça viva")])).json()["id"]

    _revoke(migrated_db, uid)
    assert db_client.delete(f"/api/v1/boms/{bom_id}", headers=h).status_code == 403

    seed_grant(migrated_db, uid)  # a NEW grant row (the ledger is append-only — ADR-0012)

    reopened = db_client.get(f"/api/v1/boms/{bom_id}", headers=h)
    assert reopened.status_code == 200
    assert reopened.json()["lines"][0]["quantity"] == 2
    renamed = db_client.put(
        f"/api/v1/boms/{bom_id}",
        headers=h,
        json=_bom_body([_ad_hoc_line(piece_name="Peça viva")], name="De volta"),
    )
    assert renamed.status_code == 200
    assert renamed.json()["name"] == "De volta"
