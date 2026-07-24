"""E6 (T011, ADR-0023 §4) — the reconciliation runner: the resilience layer for a missed webhook
(FR-706/US3.5, seguranca SEC-202/SEC-405). For every NON-terminal subscription, re-observes MP's
authoritative state and feeds each looked-up payment through the SAME terminus the webhook route
calls (`app.billing.grant_writer.process_verified_event`) — convergence on
`billing_events.event_key` (SC-703): a payment already granted by the webhook is an inbox conflict
(no-op); a missed webhook is healed exactly once.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Subscription

from .grant_writer import process_verified_event
from .providers.mercadopago import MercadoPagoProvider

#: `data-model.md` §5 — the state machine's non-terminal statuses (a subscription still expecting
#: MP-side activity). `cancelled` is terminal for reconciliation purposes even though its grant can
#: still be running out the paid period (that lapse is expiry-driven, not reconciliation-driven).
NON_TERMINAL_STATUSES = ("pending", "authorized", "grace", "paused")


@dataclass(frozen=True)
class ReconcileSummary:
    subscriptions_checked: int
    grants_written: int


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
    for sub in rows:
        if sub.mp_preapproval_id is None:  # a future Play row (E7) — nothing for this poll to do
            continue
        checked += 1
        for event in await provider.list_verified_payments(sub.mp_preapproval_id):
            result = await process_verified_event(session, event)
            if result.granted:
                granted += 1
    return ReconcileSummary(subscriptions_checked=checked, grants_written=granted)
