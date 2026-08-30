"""015/A2 ([F04b-001], BLOQUEANTE) — "não achei" e "não consegui perguntar" não são a mesma coisa.

`MercadoPagoProvider._get` devolvia `None` para os dois, e a rota do webhook lê esse `None` como
"assinatura desconhecida", acka **HTTP 200 "ignored"** e não escreve nada. O resultado, medido na
auditoria pré-provisionamento: uma indisponibilidade transitória do MP durante um webhook de
renovação vira **perda permanente e silenciosa de um grant pago**.

O que torna isso pior do que "perdemos um evento" — e é o motivo de ser Bloqueante:

    A documentação oficial do Mercado Pago (P-009, verificada 2026-08-03) diz que ele espera
    `200`/`201` e, se não receber, "realizará novas tentativas de envio A CADA 15 MINUTOS, até
    receber uma resposta". O tempo de espera da resposta é de 22 segundos.

Ou seja: existe uma rede de segurança do lado do MP, e o código **a desarmava** — respondendo 200
("recebi, está tudo certo") para um evento que jogou fora. A cura é devolver um status != 2xx
quando não conseguimos consultar, e deixar o MP insistir.

O eixo dos testes é a DIFERENÇA de conduta, não a presença de uma linha:
  * MP responde 404  → ele respondeu, e a resposta é "não existe" → 200 `ignored`  (inalterado)
  * MP recusa conexão → não perguntamos nada                      → 503, nada escrito
  * MP responde 500   → não obtivemos resposta útil               → 503, nada escrito
  * MP responde 200 com corpo que não é um objeto                 → 503, nada escrito

O 404 é o CONTROLE POSITIVO: sem ele, um teste que só exige 503 passaria com um provider que
devolve 503 para tudo — inclusive para eventos que o MP já respondeu, e aí o MP reenviaria para
sempre um evento que nunca vai resolver.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator

import httpx
import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.billing.providers import mercadopago
from app.main import create_app
from app.settings import Settings, get_settings
from tests.conftest import requires_db
from tests.mp_stub.stub import MPStub

pytestmark = requires_db

WEBHOOK_SECRET = "whsec-local-test-only"  # noqa: S105


@pytest.fixture
def billing_client(migrated_db: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "tok-local-test-only")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    app = create_app(Settings())
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


Handler = Callable[[httpx.Request], httpx.Response]


def _route_mp_through(handler: Handler) -> None:
    """Substitui o transporte do provider — o MESMO seam que o stub usa (nunca a rede real)."""
    mercadopago.set_test_transport(httpx.MockTransport(handler))


# --- os quatro MPs possiveis do outro lado da linha -------------------------------------------
def _mp_404(_req: httpx.Request) -> httpx.Response:
    return httpx.Response(404, json={"message": "not found"})


def _mp_conexao_recusada(_req: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("connection refused")


def _mp_500(_req: httpx.Request) -> httpx.Response:
    return httpx.Response(500, text="upstream boom")


def _mp_200_corpo_estranho(_req: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=["nao", "e", "dict"])


def _counts(engine: sa.Engine) -> tuple[int, int]:
    """(grants, billing_events) — contagem GLOBAL, comparada por DELTA.

    Afirmar "a tabela esta vazia" seria errado e ja falhou uma vez: o banco e compartilhado entre
    os arquivos de teste da sessao, e os vizinhos deixam linhas legitimas la. O que este arquivo
    quer provar nao e "nada existe", e "esta requisicao nao escreveu NADA" — e isso e um delta."""
    with engine.connect() as conn:
        grants = int(conn.execute(sa.text("SELECT count(*) FROM entitlement_grants")).scalar_one())
        events = int(conn.execute(sa.text("SELECT count(*) FROM billing_events")).scalar_one())
    return grants, events


def _fire(client: TestClient, *, payment_id: str = "pay-mp-fora-do-ar") -> httpx.Response:
    """Assina um webhook legítimo — a assinatura é válida; o que varia é o MP do outro lado."""
    stub = MPStub()
    return stub.fire_webhook(client, payment_id=payment_id, secret=WEBHOOK_SECRET)


# ── o CONTROLE POSITIVO: o MP respondeu, e a resposta é "não existe" ────────────────────────────
def test_mp_answered_404_still_acks_200_and_writes_nothing(
    billing_client: TestClient, migrated_db: str
) -> None:
    """Conduta INALTERADA (SEC-105). O MP respondeu; insistir não mudaria a resposta, então
    ackar 200 é certo — reenviar um 404 a cada 15 minutos seria um laço infinito."""
    engine = sa.create_engine(migrated_db)
    antes = _counts(engine)
    _route_mp_through(_mp_404)
    try:
        resp = _fire(billing_client)
    finally:
        mercadopago.set_test_transport(None)

    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "ignored"
    assert _counts(engine) == antes, "um 404 do MP nao pode escrever nada"


# ── os três casos em que NÃO conseguimos perguntar ─────────────────────────────────────────────
@pytest.mark.parametrize(
    ("rotulo", "handler"),
    [
        ("conexao recusada", _mp_conexao_recusada),
        ("500 do MP", _mp_500),
        ("200 com corpo que nao e objeto", _mp_200_corpo_estranho),
    ],
)
def test_mp_unreachable_returns_5xx_so_mercadopago_retries(
    billing_client: TestClient, migrated_db: str, rotulo: str, handler: Handler
) -> None:
    """O evento não pode ser dado como resolvido. Devolvemos != 2xx e o MP reenvia em 15 min."""
    engine = sa.create_engine(migrated_db)
    antes = _counts(engine)
    _route_mp_through(handler)
    try:
        resp = _fire(billing_client)
    finally:
        mercadopago.set_test_transport(None)

    assert resp.status_code >= 500, (
        f"[{rotulo}] o webhook respondeu {resp.status_code}: um 2xx aqui DESARMA o reenvio do MP "
        f"e o grant pago some em silencio - corpo: {resp.text}"
    )
    # E nada foi escrito: deny-by-default continua valendo. O 5xx pede reenvio, nao adivinha.
    assert _counts(engine) == antes, f"[{rotulo}] pedir reenvio nao e adivinhar o resultado"
