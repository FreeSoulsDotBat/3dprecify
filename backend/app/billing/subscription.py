"""E6 PR-B (T022) — o serviço da assinatura: ler o estado e CANCELAR (US4).

O que esta camada faz de mais importante é o que ela NÃO faz: cancelar não escreve no ledger
(VR-706) e não apaga nada (SC-704). O vendedor pagou pelo período — ele fica premium até o fim dele
(owner Q10 / FR-707), e a queda para o congelamento de leitura vem da EXPIRAÇÃO do grant que já
está lá, pelo mesmo caminho que E2/E4/E5 já exercitam. Um cancelamento que revogasse na hora seria
hostil e convidaria estorno; um que escrevesse no ledger criaria um segundo jeito de a conta cair, e
dois caminhos para o mesmo desfecho é como um deles fica sem teste.

A ORDEM é deliberada e não é simetria com o `checkout`: lá a chamada ao MP vem antes da escrita
local para não deixar estado parcial; aqui ela vem antes porque a assinatura vive NO MP — o nosso
banco é espelho (ADR-0023 §2). Espelhar `cancelled` sem que o MP tenha confirmado produziria a
pior tela possível: "não renova" na Conta enquanto o cartão do vendedor é cobrado no mês seguinte.
"""

from __future__ import annotations

import datetime
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Subscription

from .providers.mercadopago import MercadoPagoProvider
from .reconcile import NON_TERMINAL_STATUSES


class SubscriptionError(Exception):
    """Base das falhas mapeadas deste serviço (a rota as traduz para códigos de wire)."""


class NoSubscription(SubscriptionError):
    """A conta não tem assinatura nenhuma — cortesia/gratuita. Não há o que cancelar."""


class CancelUnavailable(SubscriptionError):
    """O MP não confirmou o cancelamento. Nada foi espelhado localmente, de propósito."""


@dataclass(frozen=True)
class SubscriptionView:
    """O que a Conta lê. Só referências e datas — nenhuma folha de dinheiro (VR-701/SC-706)."""

    plan_period: str
    status: str
    current_period_end: datetime.datetime | None
    cancel_at_period_end: bool
    grace_until: datetime.datetime | None


def _view(sub: Subscription) -> SubscriptionView:
    return SubscriptionView(
        plan_period=sub.plan_period,
        status=sub.status,
        current_period_end=sub.current_period_end,
        # DECISÃO 2026-08-01 (registrada em tasks.md T022): `cancelAtPeriodEnd` é DERIVADO de
        # `status == "cancelled"`, e não de "cancelado E o período ainda corre".
        #
        # O contrato (`contracts/api-surface.md`) nomeia o campo mas não escreve a regra, então isto
        # é escolha, não inferência silenciosa. O motivo de não olhar o relógio: um booleano que
        # depende da hora vira falso sozinho à meia-noite do fim do período, e a Conta passaria a
        # dizer "renova" sobre uma assinatura cancelada. Quem responde "o período ainda corre" é
        # `currentPeriodEnd`, que viaja junto — o cliente compõe a frase com os dois campos.
        cancel_at_period_end=sub.status == "cancelled",
        # US5 (T023/T024) ainda não existe, e enquanto não existir NÃO HÁ janela de carência: `None`
        # aqui é a verdade de hoje, não um campo esquecido. Quando a carência entrar, este valor é
        # DERIVADO do `expires_at` do grant de carência (analyze U1) — nunca uma coluna nova.
        grace_until=None,
    )


async def _find(session: AsyncSession, uid: str) -> Subscription | None:
    """A assinatura da conta — a mais recente, incluindo já-cancelada.

    Resolvida pelo `uid` do token e por nada mais (SEC-204/VR-703): não existe parâmetro de entrada
    nesta rota, então não existe o que forjar.
    """
    return (
        await session.execute(
            select(Subscription)
            .where(Subscription.owner_uid == uid, Subscription.deleted_at.is_(None))
            .order_by(Subscription.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()


async def read_subscription(session: AsyncSession, uid: str) -> SubscriptionView | None:
    """`GET /billing/subscription`. `None` quando a conta não tem assinatura — a Conta então cai
    para a superfície de entitlement em vez de fingir uma assinatura que não existe."""
    sub = await _find(session, uid)
    return _view(sub) if sub is not None else None


async def cancel_subscription(
    session: AsyncSession, provider: MercadoPagoProvider, *, uid: str
) -> SubscriptionView:
    """`POST /billing/subscription/cancel`.

    Idempotente por CONTRATO, e a idempotência é curto-circuito: uma assinatura já cancelada
    volta como está, sem uma segunda ida ao MP. O botão mora numa tela que o vendedor pode
    recarregar, e um segundo clique que reescrevesse seria a escrita que a VR-706 proíbe.
    """
    sub = await _find(session, uid)
    if sub is None:
        raise NoSubscription()
    if sub.status not in NON_TERMINAL_STATUSES:
        return _view(sub)

    if sub.mp_preapproval_id is not None and not await provider.cancel_preapproval(
        sub.mp_preapproval_id
    ):
        raise CancelUnavailable()

    # Só o espelho muda: o status. `current_period_end` fica onde está (é a data que o vendedor
    # pagou), `deleted_at` continua nulo (cancelar não é apagar), e o ledger não é tocado.
    sub.status = "cancelled"
    await session.commit()
    await session.refresh(sub)
    return _view(sub)
