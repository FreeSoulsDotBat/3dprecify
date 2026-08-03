"""015/A3 (`[F04a-001]`) — a data que o vendedor le e a MAIS DISTANTE, nao a do grant mais novo.

`read_entitlement_state` devolvia `expires_at` do grant com `granted_at` mais RECENTE. Quando dois
grants ativos se sobrepõem — o que acontece de verdade: uma cortesia de 7 dias concedida por cima de
uma assinatura anual, um reembolso parcial, uma correção de operador — o mais novo pode ser o mais
CURTO, e a tela passa a anunciar o fim do premium para uma data em que ele ainda estará ativo.

Nada de dinheiro é calculado errado. O que erra é o que se **diz** ao vendedor sobre até quando ele
tem o que pagou — e isso é o suficiente para ele achar que perdeu algo.

Por que nenhum teste pegava isto, e a lição vale mais que o conserto: **as fixtures existentes só
alimentavam combinações COERENTES** (um grant, ou grants em sequência limpa). A incoerência é
exatamente o caso que importa, e é o mesmo motivo pelo qual o "ativo falso" do T027 passou por 14
testes de unidade.

O eixo aqui é a ORDEM: em cada caso o grant mais recente é deliberadamente o mais curto.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.entitlement import EntitlementState, read_entitlement_state
from tests.conftest import requires_db

pytestmark = requires_db


def _mk_account(engine: sa.Engine, uid: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid, email) VALUES (:u, NULL) "
                "ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"u": uid},
        )


def _grant(
    engine: sa.Engine,
    uid: str,
    *,
    source: str,
    granted_at: datetime,
    expires_at: datetime | None,
) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO entitlement_grants "
                "(id, account_uid, source, granted_by, granted_at, expires_at) "
                "VALUES (:i, :u, :s, 'teste', :g, :e)"
            ),
            {
                "i": str(uuid.uuid4()),
                "u": uid,
                "s": source,
                "g": granted_at,
                "e": expires_at,
            },
        )


def _read(url: str, uid: str) -> EntitlementState:
    async def go() -> EntitlementState:
        aengine = create_async_engine(url)
        try:
            async with async_sessionmaker(aengine)() as session:
                return await read_entitlement_state(session, uid)
        finally:
            await aengine.dispose()

    return asyncio.run(go())


def test_reports_the_furthest_expiry_not_the_newest_grant(migrated_db: str) -> None:
    """Uma cortesia curta concedida DEPOIS de uma assinatura longa não pode encurtar a data."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-exp-{uuid.uuid4().hex[:8]}"
    _mk_account(engine, uid)
    agora = datetime.now(UTC)
    longe = agora + timedelta(days=365)
    perto = agora + timedelta(days=7)

    _grant(engine, uid, source="payment", granted_at=agora - timedelta(days=2), expires_at=longe)
    # o mais RECENTE e o mais CURTO — exatamente a combinacao que as fixtures nao produziam
    _grant(engine, uid, source="comp", granted_at=agora, expires_at=perto)

    estado = _read(migrated_db, uid)
    assert estado.status == "active"
    assert estado.expires_at is not None
    assert abs((estado.expires_at - longe).total_seconds()) < 2, (
        f"reportou {estado.expires_at} (a cortesia curta) em vez de {longe} (a assinatura paga)"
    )
    # A ORIGEM continua a do mais recente: e ela que diz POR QUE o premium esta ativo agora.
    assert estado.source == "comp"


def test_an_unbounded_grant_wins_over_any_date(migrated_db: str) -> None:
    """`expires_at IS NULL` significa "sem prazo" — e sem prazo é mais distante que qualquer data.

    Devolver a data do grant limitado aqui anunciaria um fim que não existe."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-exp-{uuid.uuid4().hex[:8]}"
    _mk_account(engine, uid)
    agora = datetime.now(UTC)

    _grant(engine, uid, source="beta", granted_at=agora - timedelta(days=1), expires_at=None)
    _grant(
        engine,
        uid,
        source="payment",
        granted_at=agora,
        expires_at=agora + timedelta(days=30),
    )

    estado = _read(migrated_db, uid)
    assert estado.status == "active"
    assert estado.expires_at is None, (
        f"reportou {estado.expires_at}: ha um grant SEM PRAZO ativo, entao nao ha data de fim"
    )


def test_an_expired_grant_never_becomes_the_reported_date(migrated_db: str) -> None:
    """CONTROLE POSITIVO do "mais distante": um grant VENCIDO pode ter a maior data entre todos os
    vencidos, e ainda assim não pode ser reportado. `max` sobre a lista errada seria pior que o bug
    original — anunciaria uma validade que já passou."""
    engine = sa.create_engine(migrated_db)
    uid = f"u-exp-{uuid.uuid4().hex[:8]}"
    _mk_account(engine, uid)
    agora = datetime.now(UTC)
    vivo = agora + timedelta(days=10)

    # vencido ontem, mas com data "maior" que nada — nao pode entrar no max
    _grant(
        engine,
        uid,
        source="comp",
        granted_at=agora - timedelta(days=40),
        expires_at=agora - timedelta(days=1),
    )
    _grant(engine, uid, source="payment", granted_at=agora, expires_at=vivo)

    estado = _read(migrated_db, uid)
    assert estado.status == "active"
    assert estado.expires_at is not None
    assert abs((estado.expires_at - vivo).total_seconds()) < 2
    assert estado.expires_at > agora, "jamais reportar uma validade que ja passou"
