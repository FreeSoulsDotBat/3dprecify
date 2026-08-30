"""E6 PR-C (T033) — estorno e chargeback: US8, FAILING-first.

O buraco que esta fatia existe para fechar tem nome: **premium silencioso**. Um estorno que ninguem
processa deixa o vendedor premium de graca, e ninguem descobre — nao ha erro, nao ha log, so uma
conta ativa que nao devia estar. Por isso a US8 e P3 mas o PISO DE MECANICA nao e descartavel.

Mecanismo (research §D7, ADR-0012 verbatim): linha no inbox + **REVOGACAO append-only** no grant de
pagamento ativo (`revoked_at`/`revoked_by`), o que derruba o premium NA HORA pela derivacao que ja
existe (a derivacao `active` do ADR-0012). Nada e apagado, nada e recalculado.

A assercao que mais importa aqui e sobre o que NAO pode ser revogado: um grant de **cortesia ou
beta** e uma decisao de operador que nao tem nada a ver com o cartao do vendedor. Um estorno que o
apagasse tiraria o acesso de alguem que nunca pagou por ele — e nenhum teste de "o premium caiu"
notaria, porque o premium ter caido e justamente o que se espera.
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


def _mk_account(engine: sa.Engine, uid: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO accounts (account_uid) VALUES (:u)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"u": uid},
        )


def _mk_subscription(engine: sa.Engine, *, owner_uid: str, mp_preapproval_id: str) -> str:
    sub_id = str(uuid.uuid4())
    _mk_account(engine, owner_uid)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO subscriptions"
                " (id, owner_uid, provider, mp_preapproval_id, plan_period, status,"
                "  created_at, updated_at)"
                " VALUES (:id, :o, 'mercadopago', :mp, 'monthly', 'authorized', now(), now())"
            ),
            {"id": sub_id, "o": owner_uid, "mp": mp_preapproval_id},
        )
    return sub_id


def _mk_courtesy(engine: sa.Engine, uid: str, source: str = "comp") -> None:
    """Um grant de OPERADOR — decisao humana, sem nenhuma relacao com o cartao do vendedor."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO entitlement_grants"
                " (id, account_uid, source, granted_by, granted_at, expires_at)"
                " VALUES (gen_random_uuid(), :u, :s, 'operador-e2e', now(),"
                "         now() + interval '365 days')"
            ),
            {"u": uid, "s": source},
        )


def _grants(engine: sa.Engine, uid: str) -> list[sa.Row[tuple[str, object, object]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT source, revoked_at, revoked_by FROM entitlement_grants"
                    " WHERE account_uid = :u ORDER BY granted_at, source"
                ),
                {"u": uid},
            ).all()
        )


def _ativo(engine: sa.Engine, uid: str) -> bool:
    """A derivacao do ADR-0012, reimplementada aqui de proposito: o teste nao pode conferir a
    aplicacao usando a mesma funcao que ela usa para se dizer correta."""
    with engine.connect() as conn:
        return bool(
            conn.execute(
                text(
                    "SELECT EXISTS(SELECT 1 FROM entitlement_grants WHERE account_uid = :u"
                    "  AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))"
                ),
                {"u": uid},
            ).scalar_one()
        )


def _eventos(engine: sa.Engine, sub_id: str) -> list[sa.Row[tuple[str, str]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text("SELECT event_key, kind FROM billing_events WHERE subscription_id = :s"),
                {"s": sub_id},
            ).all()
        )


def _assinar(client: TestClient, engine: sa.Engine, stub: MPStub, uid: str) -> tuple[str, str, str]:
    pre = stub.create_preapproval(plan_period="monthly")
    sub_id = _mk_subscription(engine, owner_uid=uid, mp_preapproval_id=pre.id)
    pagamento = stub.authorize_payment(pre.id, period_days=30)
    resp = stub.fire_webhook(client, payment_id=pagamento.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text
    return sub_id, pre.id, pagamento.id


def _estornar(client: TestClient, stub: MPStub, preapproval_id: str, tipo: str) -> str:
    """O evento de estorno/chargeback que o MP reporta."""
    evento = stub.refund_payment(preapproval_id, kind=tipo)
    resp = stub.fire_webhook(client, payment_id=evento.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text
    return evento.id


# ══ §1 o estorno derruba o premium NA HORA, e por revogacao ════════════════════════════════════


@pytest.mark.parametrize("tipo", ["refunded", "charged_back"])
def test_refund_revokes_the_payment_grant_and_lapses_immediately(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, tipo: str
) -> None:
    """SC-710: o grant de pagamento ganha `revoked_at`, e o premium cai pela derivacao existente.

    Nao ha `DELETE` e nao ha recalculo: o ledger e append-only, e revogar e uma escrita que a
    derivacao ja sabe ler. Estorno e chargeback percorrem o mesmo caminho porque o efeito no
    vendedor e o mesmo — o dinheiro voltou.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-estorno-{tipo}-{uuid.uuid4().hex[:8]}"
    sub_id, pre_id, _ = _assinar(billing_client, engine, mp_stub, uid)
    assert _ativo(engine, uid), "pre-condicao: o pagamento deixou a conta ativa"

    _estornar(billing_client, mp_stub, pre_id, tipo)

    grants = _grants(engine, uid)
    assert len(grants) == 1, "revogar NAO cria linha nova — e um UPDATE no grant existente"
    assert grants[0].revoked_at is not None
    assert grants[0].revoked_by == "mercadopago"
    assert not _ativo(engine, uid), "o premium cai NA HORA, sem esperar expiracao"
    # O evento fica registrado no inbox — auditavel, e e o que torna o replay idempotente. O tipo
    # importa: um estorno gravado como `payment_failed` abriria CARENCIA para quem pediu o dinheiro
    # de volta, que e o premium de graca que esta fatia existe para impedir.
    #
    # (A primeira versao desta linha era `.count(...) >= 0`, que e SEMPRE verdade — uma assercao
    # morta que eu escrevi e o `ruff` nao pegaria. Ela nao guardava nada.)
    esperado = "refund" if tipo == "refunded" else "chargeback"
    assert [e.kind for e in _eventos(engine, sub_id)] == ["payment", esperado]


def test_a_courtesy_grant_is_NEVER_touched_by_a_refund(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """VR-708 — a assercao que nenhum teste de "o premium caiu" faria.

    Cortesia e beta sao decisoes de OPERADOR e nao tem relacao nenhuma com o cartao do vendedor. Um
    estorno que as apagasse tiraria o acesso de quem nunca pagou por ele — e o defeito seria
    invisivel, porque "o premium do pagamento caiu" e exatamente o que se espera ver.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-cortesia-{uuid.uuid4().hex[:8]}"
    _, pre_id, _ = _assinar(billing_client, engine, mp_stub, uid)
    _mk_courtesy(engine, uid, "comp")
    _mk_courtesy(engine, uid, "beta")

    _estornar(billing_client, mp_stub, pre_id, "refunded")

    por_fonte = {g.source: g for g in _grants(engine, uid)}
    assert por_fonte["payment"].revoked_at is not None, "o do PAGAMENTO cai"
    assert por_fonte["comp"].revoked_at is None, "a cortesia NAO e do MP para revogar"
    assert por_fonte["beta"].revoked_at is None, "nem o beta"
    # E o efeito visivel: a conta CONTINUA premium, pela cortesia. Um estorno nao e uma punicao.
    assert _ativo(engine, uid)


# ══ §2 idempotencia e o caso tardio ════════════════════════════════════════════════════════════


def test_the_same_refund_replayed_revokes_once(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """O MP reentrega, e a reconciliacao re-observa. A convergencia e o UNIQUE do inbox.

    O `revoked_at` da primeira passagem nao pode se mexer numa segunda: um carimbo que anda a cada
    reentrega apaga QUANDO a revogacao aconteceu, e essa data e o registro auditavel.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-estorno-replay-{uuid.uuid4().hex[:8]}"
    _, pre_id, _ = _assinar(billing_client, engine, mp_stub, uid)
    evento_id = _estornar(billing_client, mp_stub, pre_id, "refunded")
    primeiro = _grants(engine, uid)[0].revoked_at

    for _ in range(3):
        mp_stub.fire_webhook(billing_client, payment_id=evento_id, secret=WEBHOOK_SECRET)

    grants = _grants(engine, uid)
    assert len(grants) == 1
    assert grants[0].revoked_at == primeiro, "o carimbo da revogacao NAO anda a cada reentrega"


def test_a_chargeback_after_the_lapse_is_audit_only(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """Chargeback que chega depois de a conta ja ter caido: registra e nao faz nada.

    E o caso comum — bancos levam semanas. Revogar um grant ja expirado nao muda nada para o
    vendedor, mas SOBRESCREVERIA o motivo da queda: o registro passaria a dizer "revogado por
    estorno" sobre uma conta que na verdade so deixou de renovar.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-chargeback-tardio-{uuid.uuid4().hex[:8]}"
    _, pre_id, _ = _assinar(billing_client, engine, mp_stub, uid)
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE entitlement_grants SET expires_at = now() - interval '1 day'"
                " WHERE account_uid = :u"
            ),
            {"u": uid},
        )
    assert not _ativo(engine, uid)

    _estornar(billing_client, mp_stub, pre_id, "charged_back")

    grants = _grants(engine, uid)
    assert grants[0].revoked_at is None, (
        "um grant JA expirado nao e revogado — sobrescreveria o motivo real da queda"
    )
    assert not _ativo(engine, uid)


def test_a_refund_for_an_unknown_subscription_grants_and_revokes_nothing(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """SEC-105 continua valendo para o novo tipo: verificado mas nao resolvivel = zero escritas."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-estorno-orfao-{uuid.uuid4().hex[:8]}"
    _mk_account(engine, uid)
    _mk_courtesy(engine, uid, "comp")

    orfao = mp_stub.refund_payment("pre-que-nao-existe", kind="refunded")
    resp = mp_stub.fire_webhook(billing_client, payment_id=orfao.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text

    assert _grants(engine, uid)[0].revoked_at is None
    assert _ativo(engine, uid)
