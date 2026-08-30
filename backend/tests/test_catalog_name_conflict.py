"""019/PR-D · T065 (US5) — nome único por conta, com sufixo em SILÊNCIO (ADR-0033 §4, Q5).

A regra tem uma forma só, e vale para as QUATRO tabelas de catálogo (`filaments`, `printers`,
`products`, `boms`):

    conflito em `(owner_uid, name_norm)` entre VIVOS ⇒ o servidor grava `"<nome> (2)"`,
    `"(3)"`… e devolve o registro com o nome FINAL (201/200). Sem erro, sem aviso.

A recusa *"Este nome já está no catálogo"* é do FORMULÁRIO, no cliente, antes de enviar — por isso
o servidor precisa de um comportamento só: online o vendedor quase nunca alcança este caminho, e a
corrida real entre dois aparelhos resolve sozinha, **sem descartar nada** (R6).

Duas propriedades que só um banco de verdade prova, e que estão aqui por isso:

1. **A corrida.** Uma conexão psycopg à parte insere a linha concorrente e SEGURA a transação
   aberta; o `POST` do `TestClient` bloqueia no índice único (o teste espera até VER o backend
   bloqueado em `pg_stat_activity` — nada de `sleep` torcendo pelo escalonador) e, ao COMMIT da
   primeira, recebe `IntegrityError` e renomeia. Uma "(2)", zero perdidas, zero 500.
2. **O kit sobrevive.** O save de kit é UMA transação (ADR-0017): o retry roda em
   `session.begin_nested()` (SAVEPOINT), então o `IntegrityError` do produto materializado não
   aborta a transação inteira. Sem o savepoint o kit MORRE — a mutação está registrada no
   relatório da fatia.

O índice é PARCIAL (`WHERE deleted_at IS NULL`): apagar libera o nome, e é isso que impede um item
morto de bloquear o nome dele para sempre.
"""

import threading
import time
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import httpx
import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db

FILAMENT = {"name": "x", "material": "PLA", "costPerRoll": "110.00", "rollWeightKg": "1.000"}
PRINTER = {
    "name": "x",
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
FILAMENT_VALUES = {"material": "PLA", "costPerRoll": "110.00", "rollWeightKg": "1.000"}
PRINTER_VALUES = {
    "machineValue": "1200.00",
    "machineLifetimeHours": "2000.000",
    "avgPowerKw": "0.1200",
    "maintenanceReservePerHour": "0.500000",
}

TABLES = ["filaments", "printers", "products", "boms"]


@pytest.fixture
def db_client(migrated_db: str) -> Iterator[TestClient]:
    app = create_app(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _premium(monkeypatch: pytest.MonkeyPatch, migrated_db: str, uid: str) -> dict[str, str]:
    seed_grant(migrated_db, uid)
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _refs(client: TestClient, h: dict[str, str], tag: str) -> tuple[str, str]:
    fid = client.post(
        "/api/v1/filaments", headers=h, json={**FILAMENT, "name": f"ref-fil-{tag}"}
    ).json()["id"]
    pid = client.post(
        "/api/v1/printers", headers=h, json={**PRINTER, "name": f"ref-prn-{tag}"}
    ).json()["id"]
    return fid, pid


def _ad_hoc_line(piece_name: str) -> dict[str, Any]:
    return {
        "quantity": 1,
        "pieceName": piece_name,
        "pieceInputs": dict(PIECE),
        "filamentValues": dict(FILAMENT_VALUES),
        "printerValues": dict(PRINTER_VALUES),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }


def _body(table: str, name: str, refs: tuple[str, str]) -> dict[str, Any]:
    """O corpo mínimo válido de cada tabela — só o `name` muda entre os casos."""
    fid, pid = refs
    if table == "filaments":
        return {**FILAMENT, "name": name}
    if table == "printers":
        return {**PRINTER, "name": name}
    if table == "products":
        return {
            "name": name,
            "filamentId": fid,
            "printerId": pid,
            "pieceInputs": dict(PIECE),
            "tariffPerKwh": "1.000000",
            "includeMarketplace": True,
            "channels": [],
            "otherCosts": [],
        }
    # A peça ad-hoc tem nome PRÓPRIO e curto de propósito: o caso sob teste é o nome do KIT, e um
    # nome de peça derivado do nome do kit levaria junto o teto de 120 (uma linha ad-hoc vira um
    # produto, e usa o mesmo teto).
    return {"name": name, "lines": [_ad_hoc_line("peça do kit")]}


def _names(client: TestClient, h: dict[str, str], table: str) -> list[str]:
    return sorted(str(r["name"]) for r in client.get(f"/api/v1/{table}", headers=h).json())


@pytest.mark.parametrize("table", TABLES)
def test_conflicting_name_is_renamed_in_silence(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    """ "Gancho" e depois "gancho " (acento/caixa/espaço não distinguem) ⇒ 201 com "Gancho (2)".

    O sufixo entra no `name` GRAVADO e no DEVOLVIDO — o vendedor lê o nome final, não o enviado.
    """
    h = _premium(monkeypatch, migrated_db, f"nc-{table}")
    refs = _refs(db_client, h, table)

    first = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "Gancho", refs))
    assert first.status_code == 201, first.text
    assert first.json()["name"] == "Gancho"

    second = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "  gancho ", refs))
    assert second.status_code == 201, second.text
    # `name` guarda o nome ENVIADO (já trimado pelo validador) + " (2)" — nunca o do outro item.
    assert second.json()["name"] == "gancho (2)"

    third = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "GANCHO", refs))
    assert third.status_code == 201, third.text
    assert third.json()["name"] == "GANCHO (3)"

    # Nada foi descartado: três itens vivos, três nomes distintos (R6).
    assert len([n for n in _names(db_client, h, table) if "ancho" in n.lower()]) == 3


@pytest.mark.parametrize("table", TABLES)
def test_rename_to_a_taken_name_follows_the_same_rule(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    h = _premium(monkeypatch, migrated_db, f"nc-put-{table}")
    refs = _refs(db_client, h, table)
    db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "Gancho", refs))
    other = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "Suporte", refs))
    assert other.status_code == 201, other.text
    other_id = other.json()["id"]

    renamed = db_client.put(
        f"/api/v1/{table}/{other_id}", headers=h, json=_body(table, "gancho", refs)
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "gancho (2)"


@pytest.mark.parametrize("table", TABLES)
def test_renaming_an_item_to_its_own_name_keeps_it(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    """Salvar o mesmo item sem mudar o nome NÃO pode empurrá-lo para "(2)" — o índice único é
    por linha, e a linha que já ocupa o nome é ela mesma."""
    h = _premium(monkeypatch, migrated_db, f"nc-self-{table}")
    refs = _refs(db_client, h, table)
    created = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "Gancho", refs))
    item_id = created.json()["id"]

    again = db_client.put(
        f"/api/v1/{table}/{item_id}", headers=h, json=_body(table, "Gancho", refs)
    )
    assert again.status_code == 200, again.text
    assert again.json()["name"] == "Gancho"


@pytest.mark.parametrize("table", TABLES)
def test_name_over_120_chars_is_422(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    """Teto de nome no PYDANTIC (escritas novas), sem CHECK de comprimento no banco — o legado
    ficaria inválido (Adendo 27/08 §3)."""
    h = _premium(monkeypatch, migrated_db, f"nc-long-{table}")
    refs = _refs(db_client, h, table)
    assert (
        db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "G" * 120, refs))
    ).status_code == 201
    too_long = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "G" * 121, refs))
    assert too_long.status_code == 422, too_long.text
    assert too_long.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.parametrize("table", TABLES)
def test_a_deleted_name_is_free_again(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    """O índice é PARCIAL (`WHERE deleted_at IS NULL`): um item apagado não bloqueia o nome dele
    para sempre — e o novo item nasce SEM sufixo."""
    h = _premium(monkeypatch, migrated_db, f"nc-del-{table}")
    refs = _refs(db_client, h, table)
    dead = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "Gancho", refs))
    assert db_client.delete(f"/api/v1/{table}/{dead.json()['id']}", headers=h).status_code == 204

    reborn = db_client.post(f"/api/v1/{table}", headers=h, json=_body(table, "Gancho", refs))
    assert reborn.status_code == 201, reborn.text
    assert reborn.json()["name"] == "Gancho"


def test_the_same_name_on_two_accounts_is_not_a_conflict(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A unicidade é POR CONTA (e por tabela): o nome do vizinho não muda o meu."""
    h_a = _premium(monkeypatch, migrated_db, "nc-iso-a")
    assert (
        db_client.post("/api/v1/filaments", headers=h_a, json={**FILAMENT, "name": "Gancho"})
    ).json()["name"] == "Gancho"
    h_b = _premium(monkeypatch, migrated_db, "nc-iso-b")
    assert (
        db_client.post("/api/v1/filaments", headers=h_b, json={**FILAMENT, "name": "Gancho"})
    ).json()["name"] == "Gancho"


def test_a_filament_and_a_product_may_share_a_name(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """ "Por tipo" cai de graça: são tabelas diferentes (ADR-0033 §4)."""
    h = _premium(monkeypatch, migrated_db, "nc-cross-1")
    refs = _refs(db_client, h, "cross")
    assert (
        db_client.post("/api/v1/filaments", headers=h, json={**FILAMENT, "name": "Gancho"})
    ).json()["name"] == "Gancho"
    assert (
        db_client.post("/api/v1/products", headers=h, json=_body("products", "Gancho", refs))
    ).json()["name"] == "Gancho"


# --- a corrida (duas conexões REAIS) ---------------------------------------------------------


def _wait_until_blocked(db_url: str, *, timeout_s: float = 20.0) -> bool:
    """Espera até VER um backend bloqueado em lock — a prova de que o `POST` chegou ao índice.

    Sem isto o teste seria uma corrida contra o escalonador: se a primeira transação fizesse
    COMMIT antes de o `POST` alcançar o `INSERT`, o caminho exercitado seria o trivial (conflito
    já visível no SELECT), e o teste passaria sem nunca tocar no `IntegrityError` — verde vazio.
    """
    engine = sa.create_engine(db_url)
    deadline = time.monotonic() + timeout_s
    try:
        while time.monotonic() < deadline:
            with engine.begin() as conn:
                blocked = conn.execute(
                    sa.text(
                        "SELECT count(*) FROM pg_stat_activity"
                        " WHERE wait_event_type = 'Lock' AND state = 'active'"
                    )
                ).scalar_one()
            if blocked:
                return True
            time.sleep(0.01)
        return False
    finally:
        engine.dispose()


def _run_in_thread(fn: Callable[[], httpx.Response]) -> tuple[threading.Thread, dict[str, Any]]:
    box: dict[str, Any] = {}

    def runner() -> None:
        try:
            box["result"] = fn()
        except BaseException as exc:
            box["error"] = exc

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    return thread, box


def test_race_two_connections_one_is_renamed_none_is_lost(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FR-1915 medida como CONCORRÊNCIA no servidor (não como fila offline: escritas de catálogo
    são online-only e não há outbox — fato medido, ADR-0033 §Context)."""
    uid = "nc-race-1"
    h = _premium(monkeypatch, migrated_db, uid)

    engine = sa.create_engine(migrated_db)
    conn = engine.connect()
    trans = conn.begin()
    conn.execute(
        sa.text(
            "INSERT INTO filaments (id, owner_uid, name, name_norm, cost_per_roll, roll_weight_kg)"
            " VALUES (gen_random_uuid(), :uid, 'Gancho', 'gancho', 110.00, 1.000)"
        ),
        {"uid": uid},
    )  # NÃO commitado: a linha existe só para esta transação, e o índice já a reserva

    def post_filament() -> httpx.Response:
        response: httpx.Response = db_client.post(
            "/api/v1/filaments", headers=h, json={**FILAMENT, "name": "Gancho"}
        )
        return response

    thread, box = _run_in_thread(post_filament)
    try:
        assert _wait_until_blocked(migrated_db), "o POST não chegou a bloquear no índice único"
        trans.commit()
    finally:
        thread.join(timeout=30)
        conn.close()
        engine.dispose()

    assert "error" not in box, box.get("error")
    response = box["result"]
    assert response.status_code == 201, response.text
    assert response.json()["name"] == "Gancho (2)"
    # Zero perdidas: a linha da outra conexão E a renomeada.
    assert _names(db_client, h, "filaments") == ["Gancho", "Gancho (2)"]


def test_race_inside_the_kit_transaction_keeps_the_kit_alive(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A mesma corrida, agora DENTRO da transação atômica do kit (ADR-0017).

    O produto materializado colide com uma linha concorrente; o retry roda em SAVEPOINT, então o
    kit inteiro sobrevive e o produto ganha "(2)". Sem `session.begin_nested()` o `IntegrityError`
    aborta a transação e o kit MORRE — mutação exercitada à mão e registrada no relatório.
    """
    uid = "nc-race-kit"
    h = _premium(monkeypatch, migrated_db, uid)

    engine = sa.create_engine(migrated_db)
    conn = engine.connect()
    trans = conn.begin()
    conn.execute(
        sa.text(
            "INSERT INTO products (id, owner_uid, name, name_norm, print_grams, print_time_hours,"
            " tariff_per_kwh, markup_varejo_pct, markup_atacado_pct, filament_cost_per_roll,"
            " filament_roll_weight_kg, printer_machine_value, printer_machine_lifetime_hours,"
            " printer_avg_power_kw, printer_maintenance_reserve_per_hour)"
            " VALUES (gen_random_uuid(), :uid, 'Peca', 'peca', 1.000, 1.000, 1.000000, 0.000,"
            " 0.000, 110.00, 1.000, 1200.00, 2000.000, 0.1200, 0.500000)"
        ),
        {"uid": uid},
    )

    def post_kit() -> httpx.Response:
        response: httpx.Response = db_client.post(
            "/api/v1/boms", headers=h, json={"name": "Kit A", "lines": [_ad_hoc_line("Peca")]}
        )
        return response

    thread, box = _run_in_thread(post_kit)
    try:
        assert _wait_until_blocked(migrated_db), "o POST /boms não chegou a bloquear no índice"
        trans.commit()
    finally:
        thread.join(timeout=30)
        conn.close()
        engine.dispose()

    assert "error" not in box, box.get("error")
    response = box["result"]
    assert response.status_code == 201, response.text
    body = response.json()
    # O kit existe (não morreu junto com o conflito) e sua linha aponta para o produto renomeado.
    assert body["name"] == "Kit A"
    assert body["materializations"][0]["action"] == "created"
    assert _names(db_client, h, "products") == ["Peca", "Peca (2)"]
    assert uuid.UUID(body["materializations"][0]["productId"])
    assert len(db_client.get("/api/v1/boms", headers=h).json()) == 1
