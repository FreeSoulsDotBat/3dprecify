"""019/PR-D · T064 (US5) — `price-observations`: o servidor VALIDA e GUARDA, nunca calcula.

Autoridade: ADR-0033 §2 (+ §Adendo 2026-08-27) e `specs/019-porte-design/contracts/api-019.md`
§PR-D. O que estes testes fixam, e por quê:

* **Portas** — `PUT` exige `active` (`require_entitlement`); `GET` aceita `active|lapsed` e recusa
  `none` (`require_catalog_read`). Uma observação é dado do vendedor: quem nunca teve premium não
  tem observação nenhuma para ler.
* **O servidor nunca arredonda o número do vendedor** — `MONEY_SETTLED` é `Numeric(12,2)` e
  arredondaria 3 casas em SILÊNCIO; `finite_non_negative` não olha escala. Por isso existe um
  validador de escala próprio (divergência consciente do resto da casa, registrada no relatório).
* **Lote com o mesmo `(kind,id)` repetido é 422, nunca 500** — `ON CONFLICT DO UPDATE` levanta
  `cardinality_violation` quando a mesma linha aparece duas vezes no mesmo comando.
* **`observedAt` é do SERVIDOR** (`now()`); o corpo não o envia (`extra="forbid"`).
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db

PATH = "/api/v1/price-observations"
SUBJECT_A = "018f5a3a-0000-7000-8000-00000000000a"
SUBJECT_B = "018f5a3a-0000-7000-8000-00000000000b"


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
    """Conta SEM grant nenhum — o estado `none` (a PR-B tolera o lapsed, não o nunca-premium)."""
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _revoke(migrated_db: str, uid: str) -> None:
    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = :uid"
            ),
            {"uid": uid},
        )
    engine.dispose()


def _item(subject_id: str = SUBJECT_A, **overrides: Any) -> dict[str, Any]:
    item: dict[str, Any] = {
        "subjectKind": "PRODUCT",
        "subjectId": subject_id,
        "observedPrice": "38.90",
        "modelVersion": "4.1.0",
        "catalogVersion": "2026-08-06.1",
    }
    item.update(overrides)
    return item


def _rows(migrated_db: str, uid: str) -> list[Any]:
    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        rows = list(
            conn.execute(
                sa.text(
                    "SELECT subject_kind, subject_id, observed_price, observed_at, model_version,"
                    " catalog_version, updated_at FROM price_observations"
                    " WHERE owner_uid = :uid ORDER BY subject_id"
                ),
                {"uid": uid},
            )
        )
    engine.dispose()
    return rows


def test_put_then_get_round_trips_the_account_rows(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "obs-rt-1")
    before = datetime.now(UTC)
    put = db_client.put(
        PATH, headers=h, json={"items": [_item(SUBJECT_A), _item(SUBJECT_B, subjectKind="KIT")]}
    )
    assert put.status_code == 200, put.text
    assert put.json() == {"upserted": 2}

    got = db_client.get(PATH, headers=h)
    assert got.status_code == 200
    items = got.json()["items"]
    assert {i["subjectKind"] for i in items} == {"PRODUCT", "KIT"}
    one = next(i for i in items if i["subjectId"] == SUBJECT_A)
    # Dinheiro sai como STRING decimal, na escala da coluna — o mesmo contrato do resto da casa.
    assert one["observedPrice"] == "38.90"
    assert one["modelVersion"] == "4.1.0"
    assert one["catalogVersion"] == "2026-08-06.1"
    # `observedAt` é carimbado pelo SERVIDOR (Adendo 27/08 §1) — o corpo nunca o enviou.
    assert before <= datetime.fromisoformat(one["observedAt"]) <= datetime.now(UTC)


def test_put_is_idempotent_by_subject(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "obs-idem-1")
    assert db_client.put(PATH, headers=h, json={"items": [_item()]}).json() == {"upserted": 1}
    first = _rows(migrated_db, "obs-idem-1")
    assert len(first) == 1

    second_put = db_client.put(PATH, headers=h, json={"items": [_item(observedPrice="41.00")]})
    assert second_put.json() == {"upserted": 1}
    second = _rows(migrated_db, "obs-idem-1")
    # UMA linha por (conta, item) — atualizada no lugar, nunca append (ADR-0033 §2/Opção 1C).
    assert len(second) == 1
    assert str(second[0].observed_price) == "41.00"
    assert second[0].updated_at > first[0].updated_at
    assert second[0].observed_at > first[0].observed_at


def test_empty_batch_is_a_success_that_writes_nothing(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "obs-empty-1")
    r = db_client.put(PATH, headers=h, json={"items": []})
    assert r.status_code == 200
    assert r.json() == {"upserted": 0}
    assert _rows(migrated_db, "obs-empty-1") == []


def test_gates_write_needs_active_read_tolerates_lapsed(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "obs-gate-1")
    assert db_client.put(PATH, headers=h, json={"items": [_item()]}).status_code == 200
    _revoke(migrated_db, "obs-gate-1")

    # Lapsed: lê (o congelamento Q3 mantém a leitura), não escreve.
    assert db_client.get(PATH, headers=h).status_code == 200
    denied = db_client.put(PATH, headers=h, json={"items": [_item()]})
    assert denied.status_code == 403
    assert denied.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


def test_never_granted_account_reads_403(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _free(monkeypatch, "obs-none-1")
    responses = (
        db_client.get(PATH, headers=h),
        db_client.put(PATH, headers=h, json={"items": []}),
    )
    for resp in responses:
        assert resp.status_code == 403
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


def test_per_account_isolation(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h_a = _premium(monkeypatch, migrated_db, "obs-iso-a")
    assert db_client.put(PATH, headers=h_a, json={"items": [_item()]}).status_code == 200

    # B escreve sobre o MESMO subjectId: são linhas diferentes, e A não vê a de B.
    h_b = _premium(monkeypatch, migrated_db, "obs-iso-b")
    b_put = db_client.put(PATH, headers=h_b, json={"items": [_item(observedPrice="99.99")]})
    assert b_put.status_code == 200
    b_items = db_client.get(PATH, headers=h_b).json()["items"]
    assert [i["observedPrice"] for i in b_items] == ["99.99"]

    patch_verify(monkeypatch, "obs-iso-a")
    a_items = db_client.get(PATH, headers=h_a).json()["items"]
    assert [i["observedPrice"] for i in a_items] == ["38.90"]


@pytest.mark.parametrize(
    ("body", "reason"),
    [
        ({"items": [_item(observedPrice="-1.00")]}, "negativo"),
        ({"items": [_item(observedPrice="NaN")]}, "NaN nunca é dinheiro"),
        ({"items": [_item(observedPrice="1000000000000.00")]}, "acima do CEIL_MONEY"),
        (
            {"items": [_item(observedPrice="38.905")]},
            "3 casas: o servidor NUNCA arredonda o número do vendedor",
        ),
        ({"items": [_item(subjectKind="SCENARIO")]}, "kind fora do enum"),
        ({"items": [_item(subjectId="nao-e-uuid")]}, "id malformado"),
        ({"items": [_item(modelVersion="   ")]}, "modelVersion em branco"),
        ({"items": [_item(ownerUid="outra-conta")]}, "ownerUid no corpo (extra=forbid)"),
        ({"items": [_item(observedAt="2020-01-01T00:00:00Z")]}, "observedAt é do servidor"),
        ({"items": [_item(), _item()]}, "(kind,id) repetido no lote — 422, nunca 500"),
        (
            {"items": [_item(f"018f5a3a-0000-7000-8000-{i:012d}") for i in range(501)]},
            "lote > 500",
        ),
        ({"items": [_item()], "ownerUid": "x"}, "campo extra no envelope"),
        ({}, "items é obrigatório"),
    ],
)
def test_invalid_batch_is_422_and_never_stored(
    db_client: TestClient,
    migrated_db: str,
    monkeypatch: pytest.MonkeyPatch,
    body: dict[str, Any],
    reason: str,
) -> None:
    h = _premium(monkeypatch, migrated_db, "obs-val-1")
    r = db_client.put(PATH, headers=h, json=body)
    assert r.status_code == 422, f"{reason}: {r.text}"
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get(PATH, headers=h).json() == {"items": []}


def test_a_500_is_never_the_answer_to_a_duplicated_pair(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """O par repetido tem de morrer na VALIDAÇÃO: `ON CONFLICT DO UPDATE` levantaria
    `cardinality_violation` (500) — um erro do vendedor não pode virar erro do servidor."""
    h = _premium(monkeypatch, migrated_db, "obs-dup-1")
    r = db_client.put(PATH, headers=h, json={"items": [_item(), _item(observedPrice="12.00")]})
    assert r.status_code == 422
    assert _rows(migrated_db, "obs-dup-1") == []
