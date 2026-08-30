"""019/PR-D · T066 (US5) — `sellerFixedPrice`: o número do ANÚNCIO, declarado pelo vendedor.

Autoridade: ADR-0033 §3 e a Clarification datada da 007 (§5 do mesmo ADR). A distinção que governa
tudo isto, e que estes testes medem:

> O app **nunca exibe um preço que ele mesmo calculou no passado**. Ele exibe **o cálculo de hoje**
> ou **o número que o vendedor declarou**.

Por isso `seller_fixed_price` mora em `products` com prefixo (`seller_`) e verbo próprio: qualquer
uso indevido lê errado em voz alta. E por isso a **não-composição** é provada por AUSÊNCIA, não por
comportamento: o backend nunca chama o motor (ADR-0008, `boms.py:4`), então não há número para
conferir — o que há é um conjunto de campos, e ele está CONGELADO aqui. Se um dia alguém acrescentar
um `price` a `ProductOut`, ou empurrar `sellerFixedPrice` para dentro de `BomLineOut`, este arquivo
fica vermelho antes de a mentira chegar à tela.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.api.boms import BomLineOut, BomOut
from app.api.products import ProductOut
from app.main import create_app
from app.settings import Settings
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db

FILAMENT = {"name": "PLA Azul", "material": "PLA", "costPerRoll": "110.00", "rollWeightKg": "1.000"}
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


def _mk_product(client: TestClient, h: dict[str, str], name: str = "Vaso G") -> str:
    fid = client.post("/api/v1/filaments", headers=h, json=dict(FILAMENT)).json()["id"]
    pid = client.post("/api/v1/printers", headers=h, json=dict(PRINTER)).json()["id"]
    r = client.post(
        "/api/v1/products",
        headers=h,
        json={
            "name": name,
            "filamentId": fid,
            "printerId": pid,
            "pieceInputs": dict(PIECE),
            "tariffPerKwh": "1.000000",
            "includeMarketplace": True,
            "channels": [],
            "otherCosts": [],
        },
    )
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def test_fixing_and_unfixing_a_price(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "fix-rt-1")
    pid = _mk_product(db_client, h)
    created = db_client.get(f"/api/v1/products/{pid}", headers=h).json()
    # Ausência é ausência: sem fixação, os dois campos são NULL (nunca "R$ 0,00").
    assert created["sellerFixedPrice"] is None
    assert created["sellerFixedAt"] is None

    before = datetime.now(UTC)
    fixed = db_client.patch(
        f"/api/v1/products/{pid}", headers=h, json={"sellerFixedPrice": "38.90"}
    )
    assert fixed.status_code == 200, fixed.text
    body = fixed.json()
    assert body["sellerFixedPrice"] == "38.90"
    # `sellerFixedAt` é carimbado pelo SERVIDOR — nunca vem do corpo (T073/auditoria 27/08).
    assert before <= datetime.fromisoformat(body["sellerFixedAt"]) <= datetime.now(UTC)
    # E sobrevive à leitura (é dado, não eco da resposta).
    assert db_client.get(f"/api/v1/products/{pid}", headers=h).json()["sellerFixedPrice"] == "38.90"

    unfixed = db_client.patch(f"/api/v1/products/{pid}", headers=h, json={"sellerFixedPrice": None})
    assert unfixed.status_code == 200, unfixed.text
    # Desfixar é NULL de volta, sem etapa intermediária e sem perder o item (ADR-0033 §3) —
    # e a DATA vai junto: uma data de fixação sem fixação seria um fantasma.
    assert unfixed.json()["sellerFixedPrice"] is None
    assert unfixed.json()["sellerFixedAt"] is None


def test_a_full_update_does_not_erase_the_fixed_price(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`PUT` é o formulário do produto e não conhece fixação: editar o custo NÃO desfixa.

    O produto **nunca desfixa sozinho** (decisão do dono, ADR-0033 §3) — e "sozinho" inclui um
    `PUT` que simplesmente não fala do assunto.
    """
    h = _premium(monkeypatch, migrated_db, "fix-put-1")
    pid = _mk_product(db_client, h)
    db_client.patch(f"/api/v1/products/{pid}", headers=h, json={"sellerFixedPrice": "38.90"})

    current = db_client.get(f"/api/v1/products/{pid}", headers=h).json()
    put_body = {
        "name": current["name"],
        "filamentId": current["filamentId"],
        "printerId": current["printerId"],
        "pieceInputs": {**PIECE, "printGrams": "150.000"},
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    updated = db_client.put(f"/api/v1/products/{pid}", headers=h, json=put_body)
    assert updated.status_code == 200, updated.text
    assert updated.json()["sellerFixedPrice"] == "38.90"


@pytest.mark.parametrize(
    ("body", "reason"),
    [
        ({"sellerFixedPrice": "-1.00"}, "negativo"),
        ({"sellerFixedPrice": "NaN"}, "NaN nunca é dinheiro"),
        ({"sellerFixedPrice": "1000000000000.00"}, "acima do CEIL_MONEY"),
        ({"sellerFixedPrice": "38.905"}, "3 casas — o servidor não arredonda o vendedor"),
        ({"sellerFixedPrice": "38.90", "name": "outro"}, "outra chave (extra=forbid)"),
        ({"price": "38.90"}, "`price` não existe e nunca vai existir"),
        ({}, "o corpo declara a intenção: fixar ou desfixar, nunca nada"),
    ],
)
def test_invalid_patch_is_422_and_never_stored(
    db_client: TestClient,
    migrated_db: str,
    monkeypatch: pytest.MonkeyPatch,
    body: dict[str, Any],
    reason: str,
) -> None:
    h = _premium(monkeypatch, migrated_db, "fix-val-1")
    pid = _mk_product(db_client, h)
    r = db_client.patch(f"/api/v1/products/{pid}", headers=h, json=body)
    assert r.status_code == 422, f"{reason}: {r.text}"
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert db_client.get(f"/api/v1/products/{pid}", headers=h).json()["sellerFixedPrice"] is None


def test_patch_is_gated_and_owner_scoped(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h_a = _premium(monkeypatch, migrated_db, "fix-gate-a")
    pid = _mk_product(db_client, h_a)

    # Outra conta: 404, nunca 403 — existência não vaza (SC-308, `_owned`).
    _premium(monkeypatch, migrated_db, "fix-gate-b")
    other = db_client.patch(
        f"/api/v1/products/{pid}", headers=h_a, json={"sellerFixedPrice": "38.90"}
    )
    assert other.status_code == 404

    patch_verify(monkeypatch, "fix-gate-a")
    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = 'fix-gate-a'"
            )
        )
    engine.dispose()
    lapsed = db_client.patch(
        f"/api/v1/products/{pid}", headers=h_a, json={"sellerFixedPrice": "38.90"}
    )
    # Fixar é ESCRITA: o congelamento Q3 lê, não escreve.
    assert lapsed.status_code == 403
    assert lapsed.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


def test_a_missing_product_is_404(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    h = _premium(monkeypatch, migrated_db, "fix-404-1")
    for target in ("018f5a3a-0000-7000-8000-0000000000ff", "nao-e-uuid"):
        r = db_client.patch(
            f"/api/v1/products/{target}", headers=h, json={"sellerFixedPrice": "38.90"}
        )
        assert r.status_code == 404, r.text


# --- a não-composição, provada por AUSÊNCIA ---------------------------------------------------


def test_product_out_field_set_is_frozen() -> None:
    """O conjunto de campos de `ProductOut` é CONGELADO: os de hoje + os DOIS declarados.

    Nenhum `price`/`preco*` — e a lista literal é o ponto: acrescentar um campo de dinheiro a este
    payload passa a exigir mudar este teste, que é onde a regra está escrita.
    """
    assert set(ProductOut.model_fields) == {
        "id",
        "name",
        "filament_id",
        "printer_id",
        "filament_values",
        "printer_values",
        "piece_inputs",
        "tariff_per_kwh",
        "include_marketplace",
        "channels",
        "other_costs",
        "created_at",
        "updated_at",
        "seller_fixed_price",
        "seller_fixed_at",
    }


@pytest.mark.parametrize("model", [BomLineOut, BomOut, ProductOut])
def test_no_output_carries_a_computed_price(model: Any) -> None:
    """Nenhuma saída carrega preço CALCULADO — o backend nunca computa (ADR-0008/FR-407)."""
    forbidden = {"price", "preco", "precoVarejo", "preco_varejo", "total", "headline_total"}
    assert not (set(model.model_fields) & forbidden)


@pytest.mark.parametrize("model", [BomLineOut, BomOut])
def test_kit_outputs_never_carry_the_fixed_price(model: Any) -> None:
    """**Fixar é do Catálogo**: kit, orçamento e cenário seguem o motor (ADR-0033 §3).

    O preço fixado é o preço do ANÚNCIO — embute a comissão do marketplace —, então usá-lo como
    preço unitário de uma venda direta cobraria do cliente uma comissão que não existe naquela
    venda. A garantia é estrutural: o campo não chega ao payload do kit.
    """
    assert "seller_fixed_price" not in model.model_fields
    assert "seller_fixed_at" not in model.model_fields


def test_a_fixed_price_does_not_reach_the_kit_payload(
    db_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A mesma propriedade, agora no fio: um produto FIXADO dentro de um kit não leva o número.

    (A asserção estrutural acima é a que não pode ser burlada; esta é a que um leitor entende.)
    """
    h = _premium(monkeypatch, migrated_db, "fix-kit-1")
    pid = _mk_product(db_client, h, "Peca do kit")
    db_client.patch(f"/api/v1/products/{pid}", headers=h, json={"sellerFixedPrice": "38.90"})

    kit = db_client.post(
        "/api/v1/boms",
        headers=h,
        json={"name": "Kit A", "lines": [{"quantity": 1, "productId": pid}]},
    )
    assert kit.status_code == 201, kit.text
    assert "38.90" not in kit.text
