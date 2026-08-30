"""E6 PR-B (T021) — `POST /api/v1/billing/subscription/cancel`, FAILING-first.

US4 é a metade REVERSA do contrato de honestidade, e a coisa que ela promete é negativa: cancelar
**não** tira nada de ninguém. O vendedor pagou pelo período; ele fica premium até o fim dele
(owner Q10 / FR-707 / SC-704), e a queda para o congelamento de leitura acontece pela EXPIRAÇÃO do
grant que já existe — nunca por uma escrita nova no ledger (VR-706).

Por isso quase toda asserção aqui é sobre o que **não** muda: o ledger não cresce, o `expires_at`
não anda, nenhuma linha some. A lição que a 014 pagou várias vezes se aplica inteira — um teste que
afirma PRESENÇA não prova nada sobre uma mentira; aqui a mentira possível é uma escrita a mais, e é
a AUSÊNCIA dela que precisa ser afirmada.

Roda pela rota REAL contra o stub local do MP (T011b), como `test_billing_checkout.py` — nunca a
rede de verdade, nenhuma credencial.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

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
CANCEL_PATH = "/api/v1/billing/subscription/cancel"
SUBSCRIPTION_PATH = "/api/v1/billing/subscription"
CHECKOUT_PATH = "/api/v1/billing/checkout"
ENTITLEMENT_PATH = "/api/v1/entitlement"


@pytest.fixture
def billing_client(migrated_db: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "tok-local-test-only")
    monkeypatch.setenv("P3D_MP_PLAN_ID_MONTHLY", "plan-monthly-test")
    monkeypatch.setenv("P3D_MP_PLAN_ID_ANNUAL", "plan-annual-test")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    app = create_app(Settings())
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


# ── helpers: o estado é lido por SQL cru de propósito, não pelo ORM da aplicação ────────────────
# O teste não pode conferir a aplicação usando a mesma camada que a aplicação usa para se dizer
# correta (o mesmo motivo pelo qual `band-convergence.test.ts` reimplementa `bandOf`).


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


def _sub_row(engine: sa.Engine, uid: str) -> sa.Row[tuple[str, object, object]]:
    with engine.connect() as conn:
        return conn.execute(
            text(
                "SELECT status, current_period_end, deleted_at FROM subscriptions"
                " WHERE owner_uid = :u ORDER BY created_at"
            ),
            {"u": uid},
        ).one()


def _grants(engine: sa.Engine, uid: str) -> list[sa.Row[tuple[str, object]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT source, expires_at FROM entitlement_grants"
                    " WHERE account_uid = :u ORDER BY granted_at"
                ),
                {"u": uid},
            ).all()
        )


def _row_census(engine: sa.Engine, uid: str) -> dict[str, int]:
    """Quantas linhas o vendedor tem em cada tabela que um cancelamento poderia apagar.

    SC-704 diz "0 rows deleted", e a única maneira de provar isso é CONTAR antes e depois. Uma
    asserção sobre o status da assinatura não veria um `DELETE` colateral em produto/kit/histórico.
    """
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


def _subscribe(
    client: TestClient, engine: sa.Engine, stub: MPStub, uid: str, *, days: int = 30
) -> str:
    """A caminhada real: preapproval → pagamento aprovado → webhook assinado → grant."""
    pre = stub.create_preapproval(plan_period="monthly")
    sub_id = _mk_subscription(engine, owner_uid=uid, mp_preapproval_id=pre.id)
    payment = stub.authorize_payment(pre.id, period_days=days)
    resp = stub.fire_webhook(client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text
    return sub_id


# ══ §1 fronteira de autenticação ═══════════════════════════════════════════════════════════════


def test_cancel_requires_authentication(billing_client: TestClient) -> None:
    """Cancelar é uma ação sobre a assinatura de UMA conta — sem sessão não há conta."""
    resp = billing_client.post(CANCEL_PATH)
    assert resp.status_code == 401, resp.text


def test_cancel_never_touches_another_account_subscription(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """SEC-204/VR-703: a assinatura cancelada é resolvida pelo `uid` do token, e por nada mais.

    Não existe parâmetro de entrada nesta rota justamente para que não exista o que forjar — mas o
    teste prova o efeito, não a assinatura da função: a assinatura da VÍTIMA continua `authorized`.
    """
    engine = sa.create_engine(migrated_db)
    vitima = f"u-vitima-{uuid.uuid4().hex[:8]}"
    atacante = f"u-atacante-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, vitima)
    _subscribe(billing_client, engine, mp_stub, atacante)

    patch_verify(monkeypatch, atacante)
    resp = billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200, resp.text

    assert _sub_row(engine, vitima).status == "authorized"
    assert _sub_row(engine, atacante).status == "cancelled"


# ══ §2 VR-706 — cancelar não escreve no ledger e não apaga nada ════════════════════════════════


def test_cancel_writes_nothing_to_the_ledger_and_deletes_nothing(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """O coração da VR-706, afirmado pela AUSÊNCIA.

    Um cancelamento que escrevesse uma revogação no ledger cortaria o premium na hora — que é
    exatamente a hostilidade que a US4 existe para impedir. O ledger é append-only, então "não
    escreveu" só se prova comparando a contagem, e a queda tem de vir da expiração que já estava lá.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid)
    patch_verify(monkeypatch, uid)

    antes_grants = _grants(engine, uid)
    antes_censo = _row_census(engine, uid)
    assert len(antes_grants) == 1, "pré-condição: a assinatura deixou exatamente 1 grant"

    resp = billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200, resp.text

    depois_grants = _grants(engine, uid)
    assert depois_grants == antes_grants, "o ledger NÃO pode crescer nem mudar num cancelamento"
    assert _row_census(engine, uid) == antes_censo, "SC-704: 0 linhas apagadas"
    assert _sub_row(engine, uid).deleted_at is None, "cancelar não é soft-delete da assinatura"


def test_cancel_leaves_the_grant_expiry_standing_and_premium_active(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """SC-704: o vendedor pagou pelo período — ele continua premium ATÉ o fim dele."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-ativo-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid, days=30)
    patch_verify(monkeypatch, uid)
    expiry_antes = _grants(engine, uid)[0].expires_at

    billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})

    assert _grants(engine, uid)[0].expires_at == expiry_antes
    ent = billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"})
    assert ent.status_code == 200, ent.text
    assert ent.json()["status"] == "active", "premium persiste até o fim do período pago"


def test_the_lapse_comes_from_expiry_alone(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Passado o período, a conta cai para o congelamento de leitura — e nada foi apagado.

    O relógio é forçado movendo o `expires_at` para trás (o mesmo recurso que as varreduras de lapso
    de E2/E4/E5 usam), porque o que se testa é a REGRA, não a passagem do tempo.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-lapso-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid)
    patch_verify(monkeypatch, uid)
    billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    censo = _row_census(engine, uid)

    with engine.begin() as conn:
        conn.execute(
            text(
                "UPDATE entitlement_grants SET expires_at = now() - interval '1 day'"
                " WHERE account_uid = :u"
            ),
            {"u": uid},
        )

    ent = billing_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"})
    assert ent.json()["status"] == "lapsed", "a queda vem da expiração, e ela é VISÍVEL como lapso"
    assert _row_census(engine, uid) == censo, "o lapso é de ESCRITA, não de dados"


# ══ §3 idempotência e o caso sem assinatura ════════════════════════════════════════════════════


def test_cancel_is_idempotent(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cancelar duas vezes é o mesmo que cancelar uma (contrato: no-op 200).

    Vale mais do que parece: o botão fica numa tela que o vendedor pode recarregar, e um segundo
    clique que escrevesse de novo seria a escrita que a VR-706 proíbe.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-idem-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid)
    patch_verify(monkeypatch, uid)

    primeira = billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    assert primeira.status_code == 200, primeira.text
    estado = (_sub_row(engine, uid), _grants(engine, uid))

    segunda = billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    assert segunda.status_code == 200, segunda.text
    assert (_sub_row(engine, uid), _grants(engine, uid)) == estado
    assert segunda.json() == primeira.json()


def test_cancel_without_a_subscription_is_an_honest_404(
    billing_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Uma conta de cortesia (grant de operador, sem assinatura) não tem o que cancelar.

    Responder 200 aqui seria dizer "cancelei" sobre coisa nenhuma — a classe de mentira que a US5
    da 014 nomeia. O contrato não escreve este caso (só a idempotência), então é uma DECISÃO tomada
    aqui e registrada em `tasks.md`, não uma inferência silenciosa.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-sem-assinatura-{uuid.uuid4().hex[:8]}"
    _mk_account(engine, uid)
    patch_verify(monkeypatch, uid)

    resp = billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    assert resp.status_code == 404, resp.text
    assert resp.json()["error"]["code"] == "NOT_FOUND"
    # E a mensagem TEM de ser a do domínio, não a genérica do framework.
    #
    # Sem esta linha o teste passava VÁCUO na rodada vermelha: com a rota ainda inexistente o
    # FastAPI já devolve `404 NOT_FOUND` com `message: "Not Found"`, que satisfazia as duas
    # asserções acima. Ele foi o único verde entre 12 vermelhos — e um verde que não distingue "a
    # rota recusou porque não há assinatura" de "a rota não existe" não prova nada.
    assert resp.json()["error"]["message"] != "Not Found"
    assert "subscription" in resp.json()["error"]["message"].lower()


# ══ §4 o espelho: GET /billing/subscription diz a verdade sobre "não renova" ═══════════════════


def test_subscription_reads_cancel_at_period_end_after_cancelling(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """T022: o GET é a fonte da frase "ativo até {data}, não renova" — nada é inferido no cliente
    (SC-708). Antes do cancelamento o campo é falso; depois, verdadeiro, com a data intacta."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-get-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid, days=30)
    patch_verify(monkeypatch, uid)

    antes = billing_client.get(SUBSCRIPTION_PATH, headers={"Authorization": "Bearer t"}).json()
    assert antes["status"] == "authorized"
    assert antes["cancelAtPeriodEnd"] is False

    billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})

    depois = billing_client.get(SUBSCRIPTION_PATH, headers={"Authorization": "Bearer t"}).json()
    assert depois["status"] == "cancelled"
    assert depois["cancelAtPeriodEnd"] is True
    assert depois["currentPeriodEnd"] == antes["currentPeriodEnd"], (
        "a data até a qual o vendedor pagou não pode se mexer ao cancelar"
    )


def test_subscription_is_null_for_an_account_without_one(
    billing_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Contrato: `null` quando a conta não tem assinatura (cortesia/gratuita) — a Conta então cai
    para a superfície de entitlement, sem fingir uma assinatura que não existe."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-null-{uuid.uuid4().hex[:8]}"
    _mk_account(engine, uid)
    patch_verify(monkeypatch, uid)

    resp = billing_client.get(SUBSCRIPTION_PATH, headers={"Authorization": "Bearer t"})
    assert resp.status_code == 200, resp.text
    assert resp.json() is None


# ══ §5 reassinar depois do lapso ═══════════════════════════════════════════════════════════════


def test_resubscribe_after_cancelling_is_allowed(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Cenário 3 da US4: reassinar restaura as escritas com os dados intactos.

    O guarda de dupla-assinatura (SEC-604) é um índice único PARCIAL sobre os status não-terminais;
    `cancelled` está fora dele de propósito. Este teste é o que prova que o cancelamento não deixou
    o vendedor preso do lado de fora — o defeito seria um 409 eterno.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-recancel-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid)
    patch_verify(monkeypatch, uid)
    censo = _row_census(engine, uid)

    billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    novo = billing_client.post(
        CHECKOUT_PATH, json={"period": "monthly"}, headers={"Authorization": "Bearer t"}
    )
    assert novo.status_code == 200, novo.text
    assert _row_census(engine, uid)["products"] == censo["products"], "dados intactos"


# ══ §6 o espelho no MP — cancelar aqui tem de cancelar LÁ ══════════════════════════════════════


def test_cancel_cancels_the_preapproval_at_the_provider(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A assinatura vive no MP; o nosso banco é espelho (ADR-0023 §2).

    Um cancelamento que só mudasse a nossa linha deixaria o MP cobrando o cartão do vendedor no mês
    seguinte — o defeito mais caro que esta rota pode ter, e invisível para qualquer asserção que
    olhe só o nosso banco.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-mp-{uuid.uuid4().hex[:8]}"
    pre = mp_stub.create_preapproval(plan_period="monthly")
    _mk_subscription(engine, owner_uid=uid, mp_preapproval_id=pre.id)
    payment = mp_stub.authorize_payment(pre.id, period_days=30)
    mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    patch_verify(monkeypatch, uid)

    billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})

    no_mp = [p for p in mp_stub.preapprovals() if p.id == pre.id]
    assert len(no_mp) == 1
    assert no_mp[0].status == "cancelled", "o preapproval TEM de ficar cancelado no provedor"


def test_period_end_is_mirrored_from_the_grant_not_invented(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    """`currentPeriodEnd` é a data que o MP pagou, verbatim — nunca `hoje + 30`.

    É a mesma lição do `test_clock_skew_expires_at_matches_mp_period_end_verbatim`: uma data
    calculada localmente diverge do provedor e o vendedor lê uma promessa que ninguém fez.
    """
    engine = sa.create_engine(migrated_db)
    uid = f"u-cancel-data-{uuid.uuid4().hex[:8]}"
    _subscribe(billing_client, engine, mp_stub, uid, days=365)
    patch_verify(monkeypatch, uid)

    esperado = _grants(engine, uid)[0].expires_at
    if isinstance(esperado, datetime) and esperado.tzinfo is None:
        esperado = esperado.replace(tzinfo=UTC)

    billing_client.post(CANCEL_PATH, headers={"Authorization": "Bearer t"})
    corpo = billing_client.get(SUBSCRIPTION_PATH, headers={"Authorization": "Bearer t"}).json()

    assert corpo["currentPeriodEnd"] is not None
    assert datetime.fromisoformat(corpo["currentPeriodEnd"]) == esperado
