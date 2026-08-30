"""E6 PR-B (T023) — carência e *dunning*: US5, FAILING-first.

Uma cobrança de renovação falha. O vendedor **não** cai na hora: o MP reprocessa, e enquanto
reprocessa a conta segue premium com a tela dizendo a verdade ("pagamento pendente — regularize até
{data}"). Recuperou, continua ativo sem interrupção; esgotou, cai para o congelamento de leitura
pela EXPIRAÇÃO — nada apagado, nada revogado.

A janela **não é um chute**: o T003 mediu a reciclagem do MP na documentação oficial — até 4
retentativas numa janela de ~10 dias, com auto-cancelamento após 3 recusas — e o dono fixou um piso
humano de 7 dias. A carência é `period_end + max(10d, 7d)`. O teste do §6 crava a REGRA (o `max`),
não o número, porque é a regra que sobrevive ao dia em que o MP encolher a janela.

Mecanismo (research §D6, ADR-0012 verbatim): UM grant de carência acrescentado ao ledger
append-only, `source="payment"` (o CHECK não ganha valor novo), e o status da assinatura vai a
`grace`. **Zero mutação, zero mudança de derivação** — a derivação `active` do ADR-0012 continua
exatamente como está (SC-709).
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import create_app
from app.settings import Settings, get_settings
from tests.conftest import requires_db
from tests.helpers import patch_verify
from tests.mp_stub.stub import MPStub

pytestmark = requires_db

WEBHOOK_SECRET = "whsec-local-test-only"  # noqa: S105
SUBSCRIPTION_PATH = "/api/v1/billing/subscription"
ENTITLEMENT_PATH = "/api/v1/entitlement"


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


def _sub(engine: sa.Engine, uid: str) -> sa.Row[tuple[str, object]]:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT status, current_period_end FROM subscriptions WHERE owner_uid = :u"),
            {"u": uid},
        ).one()


def _grants(engine: sa.Engine, uid: str) -> list[sa.Row[tuple[str, datetime, object]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT source, expires_at, revoked_at FROM entitlement_grants"
                    " WHERE account_uid = :u ORDER BY granted_at, expires_at"
                ),
                {"u": uid},
            ).all()
        )


def _aware(value: object) -> datetime:
    assert isinstance(value, datetime)
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _census(engine: sa.Engine, uid: str) -> dict[str, int]:
    tables = ("products", "boms", "snapshots", "scenarios", "entitlement_grants")
    out: dict[str, int] = {}
    with engine.connect() as conn:
        for t in tables:
            column = "account_uid" if t == "entitlement_grants" else "owner_uid"
            out[t] = int(
                conn.execute(
                    text(f"SELECT count(*) FROM {t} WHERE {column} = :u"),  # noqa: S608
                    {"u": uid},
                ).scalar_one()
            )
    return out


def _subscribe(client: TestClient, engine: sa.Engine, stub: MPStub, uid: str) -> tuple[str, str]:
    """Assinatura ativa de verdade: preapproval → pagamento aprovado → webhook assinado → grant."""
    pre = stub.create_preapproval(plan_period="monthly")
    sub_id = _mk_subscription(engine, owner_uid=uid, mp_preapproval_id=pre.id)
    payment = stub.authorize_payment(pre.id, period_days=30)
    resp = stub.fire_webhook(client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text
    return sub_id, pre.id


def _fail_renewal(client: TestClient, stub: MPStub, preapproval_id: str) -> str:
    """A cobrança de renovação que o MP recusou — o gatilho da carência."""
    failed = stub.fail_payment(preapproval_id)
    resp = stub.fire_webhook(client, payment_id=failed.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text
    return failed.id


def _expire_all(engine: sa.Engine, uid: str) -> None:
    """Força o relógio: o que se testa é a REGRA do lapso, não a passagem do tempo."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE entitlement_grants SET expires_at = now() - interval '1 hour'"
                " WHERE account_uid = :u"
            ),
            {"u": uid},
        )


# ══ §1 a falha abre UMA carência, e a janela é a medida ════════════════════════════════════════


def test_failed_renewal_appends_one_grace_grant_and_marks_grace(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """VR-707: um grant de carência acrescentado, `source="payment"`, e o status vai a `grace`.

    O `expires_at` é `period_end + 10 dias` — o fim do período que o vendedor PAGOU mais a janela de
    reciclagem do MP. Não é `hoje + 10`: a promessa é sobre o período pago, e ancorar no relógio do
    servidor daria carências diferentes para o mesmo evento conforme a hora em que ele chegasse.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    period_end = _aware(_sub(engine, uid).current_period_end)

    _fail_renewal(billing_client, mp_stub, pre_id)

    grants = _grants(engine, uid)
    assert len(grants) == 2, "o de pagamento continua lá; a carência é ACRESCENTADA (append-only)"
    assert [g.source for g in grants] == ["payment", "payment"]
    assert all(g.revoked_at is None for g in grants), "carência não revoga nada"
    assert _aware(grants[1].expires_at) == period_end + timedelta(days=10)
    assert _sub(engine, uid).status == "grace"


def test_the_window_is_the_max_of_the_measured_cadence_and_the_floor(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """§6: crava a REGRA, não o número.

    O T003 mediu a janela do MP em ~10 dias e o dono fixou um piso de 7. Um teste que só afirmasse
    "10" ficaria verde no dia em que alguém trocasse o piso por engano, e ficaria vermelho no dia
    legítimo em que o MP publicasse outra janela. O que precisa valer sempre é o `max`.
    """
    from app.billing.grant_writer import (
        GRACE_FLOOR_DAYS,
        GRACE_WINDOW_DAYS,
        MP_RETRY_WINDOW_DAYS,
    )

    esperado = max(MP_RETRY_WINDOW_DAYS, GRACE_FLOOR_DAYS)
    assert esperado == GRACE_WINDOW_DAYS
    assert GRACE_FLOOR_DAYS == 7, "o piso humano é decisão do dono (Q5), não derivado do MP"
    assert MP_RETRY_WINDOW_DAYS == 10, "medido no T003 na doc do MP, fonte em research.md"


def test_grace_keeps_premium_active_past_the_paid_period(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """FR-708: o período pago acabou e o vendedor SEGUE premium enquanto o MP tenta.

    O grant de pagamento é envelhecido; só o de carência continua válido. Se a conta caísse aqui, a
    carência não existiria de fato — existiria só no status.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-ativo-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    _fail_renewal(billing_client, mp_stub, pre_id)
    patch_verify(monkeypatch, uid)

    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE entitlement_grants SET expires_at = now() - interval '1 hour'"
                " WHERE account_uid = :u AND expires_at = ("
                "  SELECT min(expires_at) FROM entitlement_grants WHERE account_uid = :u)"
            ),
            {"u": uid},
        )

    ent = billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"})
    assert ent.json()["status"] == "active", "a carência é o que segura o premium aqui"


def test_the_grace_grant_is_replay_idempotent(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """O mesmo evento reentregue (webhook + reconciliação) converge para UM grant.

    O MP reentrega, e a reconciliação re-observa o mesmo pagamento recusado. Duas carências
    empilhadas prorrogariam o premium de graça — de novo, o defeito é uma escrita A MAIS.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-replay-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    failed_id = _fail_renewal(billing_client, mp_stub, pre_id)

    for _ in range(3):
        mp_stub.fire_webhook(billing_client, payment_id=failed_id, secret=WEBHOOK_SECRET)

    assert len(_grants(engine, uid)) == 2, "1 pagamento + 1 carência, por mais que o evento repita"


# ══ §2 recuperação ═════════════════════════════════════════════════════════════════════════════


def test_recovery_within_grace_is_continuous(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cenário 2 da US5: o MP recupera a cobrança e o vendedor não vê interrupção nenhuma.

    A recuperação ESCREVE o grant real do novo período e devolve o status a `authorized`. O grant de
    carência fica onde está — o ledger é append-only, e apagá-lo perderia o registro de que houve
    uma falha (que é o que explica a cobrança extra que o vendedor pode estranhar depois).
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-recupera-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    _fail_renewal(billing_client, mp_stub, pre_id)
    patch_verify(monkeypatch, uid)

    recuperado = mp_stub.authorize_payment(pre_id, period_days=30)
    mp_stub.fire_webhook(billing_client, payment_id=recuperado.id, secret=WEBHOOK_SECRET)

    grants = _grants(engine, uid)
    assert len(grants) == 3, "pagamento + carência + novo período — nada substituído"
    assert all(g.revoked_at is None for g in grants)
    assert _sub(engine, uid).status == "authorized"
    ent = billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"})
    assert ent.json()["status"] == "active"


def test_late_recovery_after_the_lapse_reactivates_honestly(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Borda da spec: o MP consegue cobrar DEPOIS de a carência ter esgotado.

    A conta já caiu. A reativação tem de vir de um grant NOVO — nunca de esticar o `expires_at` de
    um grant velho: seria mutação num ledger append-only, e apagaria a evidência do lapso.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-tardio-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    _fail_renewal(billing_client, mp_stub, pre_id)
    patch_verify(monkeypatch, uid)
    # Sem esta linha o teste passava VACUO: enquanto `payment_failed` nao escrevia nada, "a conta
    # caiu e um pagamento novo a reergueu" era verdade sem carencia nenhuma no meio.
    assert len(_grants(engine, uid)) == 2, "pre-condicao: a falha REALMENTE abriu uma carencia"
    _expire_all(engine, uid)
    assert (
        billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"}).json()["status"]
        == "lapsed"
    )
    # A foto e tirada DEPOIS de envelhecer: `_expire_all` mexe no `expires_at`, entao comparar
    # contra uma foto anterior a ele acusaria o proprio helper de "esticar grant". (Foi o que este
    # teste fez na primeira rodada verde — a asseracao estava certa, a referencia e que estava.)
    velhos = _grants(engine, uid)

    tardio = mp_stub.authorize_payment(pre_id, period_days=30)
    mp_stub.fire_webhook(billing_client, payment_id=tardio.id, secret=WEBHOOK_SECRET)

    novos = _grants(engine, uid)
    assert len(novos) == len(velhos) + 1, "reativa por grant NOVO"
    assert [(_aware(g.expires_at)) for g in novos[: len(velhos)]] == [
        _aware(g.expires_at) for g in velhos
    ], "nenhum grant antigo foi esticado"
    assert (
        billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"}).json()["status"]
        == "active"
    )


# ══ §3 esgotamento ═════════════════════════════════════════════════════════════════════════════


def test_exhaustion_lapses_by_expiry_and_deletes_nothing(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cenário 3 da US5: a janela fecha, a conta congela — e o dado do vendedor está todo lá.

    Ninguém REVOGA nada: o lapso é a expiração fazendo o seu trabalho (SC-709, derivação intocada).
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-esgota-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    _fail_renewal(billing_client, mp_stub, pre_id)
    patch_verify(monkeypatch, uid)
    censo = _census(engine, uid)
    # Idem: "esgotar" so quer dizer alguma coisa se houver uma janela de carencia para esgotar.
    assert len(_grants(engine, uid)) == 2, "pre-condicao: ha uma carencia aberta para esgotar"

    _expire_all(engine, uid)

    ent = billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"})
    assert ent.json()["status"] == "lapsed"
    assert _census(engine, uid) == censo, "0 linhas apagadas"
    assert all(g.revoked_at is None for g in _grants(engine, uid)), "expira, não revoga"


def test_a_failure_without_a_known_period_end_grants_nothing(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """Irmão do L2-N1: sem período pago conhecido não há de que medir a carência.

    Uma assinatura que nunca teve pagamento aprovado tem `current_period_end` nulo. Ancorar em
    `hoje` daria 10 dias de premium de graça a quem nunca pagou — deny-by-default: nada é escrito.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-sem-periodo-{uuid.uuid4().hex[:8]}"
    pre = mp_stub.create_preapproval(plan_period="monthly")
    _mk_subscription(engine, owner_uid=uid, mp_preapproval_id=pre.id)

    _fail_renewal(billing_client, mp_stub, pre.id)

    assert _grants(engine, uid) == [], "nenhum grant nasce de uma falha sem período pago"
    assert _sub(engine, uid).status == "authorized", "o status também não se mexe"

    # CONTROLE POSITIVO — sem ele este teste passa VÁCUO enquanto `payment_failed` for um no-op:
    # "nada foi escrito" é trivialmente verdade quando nada NUNCA é escrito. A mesma caminhada, numa
    # assinatura que TEM período pago, precisa escrever a carência; é o contraste que prova que o
    # silêncio acima é a recusa deliberada e não a ausência da funcionalidade.
    outro = f"u-controle-{uuid.uuid4().hex[:8]}"
    _, outro_pre = _subscribe(billing_client, engine, mp_stub, outro)
    _fail_renewal(billing_client, mp_stub, outro_pre)
    assert len(_grants(engine, outro)) == 2, "a MESMA caminhada, com período pago, abre a carência"


# ══ §4 o espelho: graceUntil é DERIVADO, nunca uma coluna nova ═════════════════════════════════


def test_grace_until_is_derived_from_the_grace_grant(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """analyze U1: `graceUntil` sai do `expires_at` do grant de carência, e de mais nada.

    É essa data que a Conta transforma em "regularize até {data}", então ela tem de ser a MESMA que
    de fato segura o premium. Uma coluna nova poderia divergir do ledger, e a tela prometeria um
    prazo que o motor não honra.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-get-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    patch_verify(monkeypatch, uid)

    antes = billing_client.get(SUBSCRIPTION_PATH, headers={"Authorization": "Bearer t"}).json()
    assert antes["graceUntil"] is None, "sem falha não há carência — e o campo diz isso"

    _fail_renewal(billing_client, mp_stub, pre_id)

    depois = billing_client.get(SUBSCRIPTION_PATH, headers={"Authorization": "Bearer t"}).json()
    assert depois["status"] == "grace"
    grace_grant = _grants(engine, uid)[1]
    assert datetime.fromisoformat(depois["graceUntil"]) == _aware(grace_grant.expires_at)


def test_reconciliation_heals_a_missed_failure_event(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """T024: o webhook da falha se perdeu — a reconciliação chega ao MESMO estado.

    É a resiliência que a FR-706 promete, e ela vale para a carência exatamente como vale para o
    pagamento: os dois caminhos passam pelo mesmo terminus e convergem no `event_key`.
    """
    import asyncio

    from app.billing.providers.mercadopago import MercadoPagoProvider
    from app.billing.reconcile import reconcile_all
    from app.db import get_session_factory

    engine = sa.create_engine(migrated_db)
    uid = f"u-grace-reconcilia-{uuid.uuid4().hex[:8]}"
    _, pre_id = _subscribe(billing_client, engine, mp_stub, uid)
    mp_stub.fail_payment(pre_id)  # a falha acontece no MP e o webhook NUNCA chega

    assert len(_grants(engine, uid)) == 1, "pré-condição: só o grant do pagamento"

    async def run() -> None:
        provider = MercadoPagoProvider(get_settings())
        factory = get_session_factory()
        async with factory() as session:
            await reconcile_all(session, provider)
        await provider.aclose()

    asyncio.run(run())

    assert len(_grants(engine, uid)) == 2, (
        "a reconciliação escreveu a carência que o webhook perdeu"
    )
    assert _sub(engine, uid).status == "grace"
