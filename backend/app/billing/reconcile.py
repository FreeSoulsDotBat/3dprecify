"""E6 (T011, ADR-0023 §4) — the reconciliation runner: the resilience layer for a missed webhook
(FR-706/US3.5, seguranca SEC-202/SEC-405). For every NON-terminal subscription, re-observes MP's
authoritative state and feeds each looked-up payment through the SAME terminus the webhook route
calls (`app.billing.grant_writer.process_verified_event`) — convergence on
`billing_events.event_key` (SC-703): a payment already granted by the webhook is an inbox conflict
(no-op); a missed webhook is healed exactly once.
"""

from __future__ import annotations

from dataclasses import dataclass

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Subscription

from .grant_writer import process_verified_event
from .providers.mercadopago import MercadoPagoProvider, ProviderUnavailable
from .states import NON_TERMINAL_STATUSES

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class ReconcileSummary:
    subscriptions_checked: int
    grants_written: int
    #: 015/A2 — quantas assinaturas NÃO puderam ser consultadas (MP fora do ar). Sem este campo o
    #: resumo dizia "checked 12, granted 0" tanto quando estava tudo em dia quanto quando as 12
    #: consultas falharam — dois mundos opostos com o mesmo relatório. Um número que não distingue
    #: sucesso de falha total não é um relatório, é um consolo.
    subscriptions_unreachable: int = 0


async def reconcile_all(session: AsyncSession, provider: MercadoPagoProvider) -> ReconcileSummary:
    rows = (
        (
            await session.execute(
                select(Subscription).where(
                    Subscription.status.in_(NON_TERMINAL_STATUSES),
                    Subscription.deleted_at.is_(None),
                )
            )
        )
        .scalars()
        .all()
    )
    checked = 0
    granted = 0
    unreachable = 0
    for sub in rows:
        if sub.mp_preapproval_id is None:  # a future Play row (E7) — nothing for this poll to do
            continue
        checked += 1
        try:
            events = await provider.list_verified_payments(sub.mp_preapproval_id)
        except ProviderUnavailable as exc:
            # 015/A2 — o MP não respondeu para ESTA assinatura. Seguir para a próxima é certo (a
            # falha pode ser pontual), abortar o laço inteiro não é. E o contador existe para que
            # a próxima rodada, ou um humano, saiba que este ciclo não observou tudo o que diz
            # ter observado — esta função É a rede de segurança do webhook perdido, e uma rede
            # que falha em silêncio é pior do que nenhuma.
            unreachable += 1
            log.warning(
                "reconcile_subscription_unreachable",
                mp_preapproval_id=sub.mp_preapproval_id,
                reason=str(exc),
            )
            continue
        for event in events:
            result = await process_verified_event(session, event)
            if result.granted:
                granted += 1
    return ReconcileSummary(
        subscriptions_checked=checked,
        grants_written=granted,
        subscriptions_unreachable=unreachable,
    )
