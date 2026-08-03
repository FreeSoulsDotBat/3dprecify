"""E6 PR-C (T035) — prontidao do Play Billing atras de uma flag DESLIGADA: FAILING-first.

Duas garantias opostas, e as duas importam:

**Com a flag OFF (todo ambiente do E6), as rotas do Play nao EXISTEM** — 404 vindo do servidor, nao
um botao escondido no cliente (VR-709/SC-711, Constituicao IV). Uma superficie de pagamento que
existe "mas ninguem ve" e uma superficie de pagamento que existe.

**Com a flag ON, uma compra verificada chega ao MESMO `grant_writer`** que o Mercado Pago usa. Se o
Play tivesse um caminho proprio ate o ledger, existiriam DOIS jeitos de conceder premium — e dois
caminhos para o mesmo desfecho e como um deles fica sem teste. E a razao de o terminus ser um so
(ADR-0023 §6).

O que este arquivo NAO prova, e esta dito no `tasks.md`: que o provider fala com o Play DE VERDADE.
Isso e o T036, exige conta e credenciais do dono, e uma compra no internal testing.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import create_app
from app.settings import Settings, get_settings
from tests.conftest import requires_db

CHECKOUT_PLAY = "/api/v1/billing/checkout/play"
RTDN_PLAY = "/api/v1/billing/webhook/play-rtdn"


def _app(monkeypatch: pytest.MonkeyPatch, *, enabled: bool) -> TestClient:
    monkeypatch.setenv("P3D_PLAY_BILLING_ENABLED", "true" if enabled else "false")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    return TestClient(create_app(Settings()), raise_server_exceptions=False)


# ══ §1 a flag DESLIGADA — as rotas nao existem ═════════════════════════════════════════════════


@pytest.mark.parametrize("rota", [CHECKOUT_PLAY, RTDN_PLAY])
def test_play_routes_are_404_when_the_flag_is_off(
    monkeypatch: pytest.MonkeyPatch, rota: str
) -> None:
    """SC-711 — 404 do SERVIDOR, e nao 401/403.

    A diferenca importa: um 401 diria "existe, mas voce nao esta autenticado", o que confirma a
    superficie para quem estiver sondando. 404 diz o que e verdade — nao ha rota aqui.
    """
    with _app(monkeypatch, enabled=False) as client:
        assert client.post(rota, json={}).status_code == 404
    get_settings.cache_clear()


def test_the_flag_defaults_to_OFF_with_no_configuration_at_all(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """O default E a garantia: um ambiente que esqueceu de configurar fica DESLIGADO.

    Vale mais que o teste acima. Aquele prova o comportamento quando alguem escreveu `false`; este
    prova que NAO ESCREVER NADA da o mesmo resultado — que e o caso de todo ambiente do E6.
    """
    monkeypatch.delenv("P3D_PLAY_BILLING_ENABLED", raising=False)
    get_settings.cache_clear()
    assert Settings().play_billing_enabled is False
    with TestClient(create_app(Settings()), raise_server_exceptions=False) as client:
        assert client.post(CHECKOUT_PLAY, json={}).status_code == 404
    get_settings.cache_clear()


@pytest.mark.parametrize("valor", ["", "yes", "1x", "ON", "sim", "TRUE-ish", "0"])
def test_no_junk_value_ever_reads_as_ON(monkeypatch: pytest.MonkeyPatch, valor: str) -> None:
    """Nenhum valor estranho liga a flag.

    A ADR-0023 §6 diz "the default AND any unset/unknown value is OFF". Um parser tolerante que
    lesse `"sim"` ou `"ON"` como verdadeiro ligaria uma superficie de pagamento por um erro de
    digitacao no `.env` — e a assercao que pega isso e sobre o que NAO acontece.
    """
    monkeypatch.setenv("P3D_PLAY_BILLING_ENABLED", valor)
    get_settings.cache_clear()
    try:
        ligada = Settings().play_billing_enabled
    except Exception:
        ligada = False  # recusar o valor tambem e ficar desligado
    assert ligada is False, f"o valor {valor!r} nao pode ligar a flag"
    get_settings.cache_clear()


# ══ §2 a flag LIGADA — o caminho existe e termina no MESMO terminus ════════════════════════════


@pytest.fixture
def play_db(migrated_db: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("P3D_PLAY_BILLING_ENABLED", "true")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    with TestClient(create_app(Settings()), raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


@requires_db
def test_a_verified_play_purchase_reaches_the_SAME_grant_writer(
    play_db: TestClient, migrated_db: str
) -> None:
    """ADR-0023 §6 — um terminus so.

    A compra do Play e normalizada para o MESMO `VerifiedEvent` e entregue ao MESMO
    `process_verified_event`. O que se prova aqui e a CONVERGENCIA: o grant nasce com
    `source="payment"` e a assinatura com `provider="google_play"`, pelas regras que ja existem —
    nenhuma regra de entitlement nova nasce para o Play.
    """
    import asyncio
    from datetime import UTC, datetime, timedelta

    from app.billing.events import VerifiedEvent
    from app.billing.grant_writer import process_verified_event
    from app.db import get_session_factory

    engine = sa.create_engine(migrated_db)
    uid = f"u-play-{uuid.uuid4().hex[:8]}"
    token = f"play-token-{uuid.uuid4().hex[:10]}"
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO accounts (account_uid) VALUES (:u)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"u": uid},
        )
        conn.execute(
            text(
                "INSERT INTO subscriptions"
                " (id, owner_uid, provider, mp_preapproval_id, plan_period, status,"
                "  created_at, updated_at)"
                " VALUES (gen_random_uuid(), :o, 'google_play', :t, 'monthly', 'pending',"
                "         now(), now())"
            ),
            {"o": uid, "t": token},
        )

    evento = VerifiedEvent(
        subscription_ref=token,
        event_key=f"play-order-{uuid.uuid4().hex[:10]}",
        kind="payment",
        period_end=datetime.now(UTC) + timedelta(days=30),
        mp_status="approved",
        raw={"id": "play", "status": "approved"},
    )

    async def run() -> None:
        factory = get_session_factory()
        async with factory() as session:
            resultado = await process_verified_event(session, evento)
            assert resultado.matched and resultado.granted

    asyncio.run(run())

    with engine.connect() as conn:
        fonte, prov = conn.execute(
            text(
                "SELECT g.source, s.provider FROM entitlement_grants g"
                " JOIN subscriptions s ON s.id = g.subscription_id"
                " WHERE g.account_uid = :u"
            ),
            {"u": uid},
        ).one()
    assert fonte == "payment", "o Play nao inventa uma fonte propria de grant"
    assert prov == "google_play"


@pytest.mark.parametrize("rota", [CHECKOUT_PLAY, RTDN_PLAY])
def test_the_404_is_NOT_vacuous_the_route_exists_when_the_flag_is_on(
    monkeypatch: pytest.MonkeyPatch, rota: str
) -> None:
    """O CONTROLE POSITIVO, e sem ele os testes do §1 nao provam nada.

    Enquanto as rotas nao existiam em lugar nenhum, "404 com a flag desligada" era trivialmente
    verdade — o mesmo 404 apareceria com a flag LIGADA. E o contraste que mostra que o 404 vem do
    GATING, e nao da ausencia de codigo.

    Com a flag ligada a rota responde 401 (falta autenticacao) ou 503 (o Play nao esta provisionado
    — T036, bloqueado no dono). Qualquer um dos dois serve: o que importa e que NAO e 404.
    """
    with _app(monkeypatch, enabled=True) as client:
        codigo = client.post(rota, json={"purchaseToken": "x"}).status_code
    get_settings.cache_clear()
    assert codigo != 404, "com a flag LIGADA a rota tem de existir — senao o §1 e vacuo"


def test_enabling_the_flag_in_one_app_does_not_leak_into_the_next(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A flag e por APP, nao por processo.

    A primeira versao do gating acrescentava as rotas ao `router` de MODULO, o que faz a flag virar
    estado global: uma `create_app` com a flag ligada deixava as rotas ligadas para todas as
    seguintes. O vazamento e na direcao perigosa — quem liga primeiro contamina quem vem depois — e
    a suite so nao pegava porque os testes de OFF rodavam antes.

    Este teste faz a ordem que quebrava: liga, depois desliga, e cobra o 404.
    """
    with _app(monkeypatch, enabled=True) as ligado:
        assert ligado.post(CHECKOUT_PLAY, json={"purchaseToken": "x"}).status_code != 404
    with _app(monkeypatch, enabled=False) as desligado:
        assert desligado.post(CHECKOUT_PLAY, json={"purchaseToken": "x"}).status_code == 404
    get_settings.cache_clear()
