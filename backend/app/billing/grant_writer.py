"""E6 (T009) — the ONE shared terminus: inbox insert + ledger grant, same transaction,
on-conflict-no-op (ADR-0023 §2-3, data-model §2/§4). The webhook route (T010) and the
reconciliation runner (T011) both call `process_verified_event` AFTER their own verify-then-lookup
— convergence is structural (VR-702/SC-703), never application-level dedup cleverness (the
ADR-0018 §3 lesson, restated server-side).

**Scope of this file today (T009): the `payment` kind only.** `payment_failed` (grace, T023/T024),
`refund`/`chargeback` (revoke, T033/T034) and `cancel` (status mirror, T021/T022) are PR-B/PR-C
territory — their `entitlement_grants`/`subscriptions` effects are NOT invented here (Principle
VIII: no inferred entitlement rule). A non-`payment` event still resolves its subscription (so
cross-account isolation and "unknown subscription" behave identically for every kind) but writes
nothing yet; the follow-on tasks extend the branch below, they do not replace this function's shape.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BillingEvent, EntitlementGrant, Subscription

from .events import VerifiedEvent


@dataclass(frozen=True)
class ProcessResult:
    #: A local subscription was resolved for this event (server-side only — SEC-204/VR-703).
    matched: bool
    #: THIS call's insert won the exactly-once race (a new grant/state change actually happened).
    granted: bool


async def process_verified_event(session: AsyncSession, event: VerifiedEvent) -> ProcessResult:
    """The terminus. Resolves the owning subscription by `event.subscription_ref` (the LOOKED-UP
    preapproval id) ONLY — never by any client/body-supplied account field (SEC-204/VR-703, T3 in
    seguranca-round.md). An event that resolves to no local subscription is SEC-105:
    deny-by-default, zero writes, `matched=False`."""
    sub = (
        await session.execute(
            select(Subscription).where(
                Subscription.mp_preapproval_id == event.subscription_ref,
                Subscription.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if sub is None:
        return ProcessResult(matched=False, granted=False)

    if event.kind != "payment":
        # See module docstring — payment_failed/refund/chargeback/cancel are PR-B/PR-C tasks.
        return ProcessResult(matched=True, granted=False)

    now = datetime.now(UTC)
    # Clock-skew rule (spec §Edge Cases): the grant's `expires_at` is MP's `period_end`,
    # VERBATIM — never a server-side floor/recompute that could land earlier than MP's
    # authoritative boundary (the boundary always favors the paying seller).
    period_end = event.period_end
    # L2-N1 (confirmation audit): a payment grant MUST carry a bounded expiry. A null `period_end`
    # (MP omitted both `period_end` and `next_payment_date`, or they were unparseable) would write
    # `expires_at=None`, which the entitlement resolver reads as PREMIUM FOREVER — and since
    # refund/chargeback revocation is a later task, that perpetual grant has no path to expire. A
    # payment we cannot bound is not a payment we grant: deny-by-default (matched, not granted), so
    # reconciliation retries rather than the seller getting free lifetime premium.
    if period_end is None:
        return ProcessResult(matched=True, granted=False)

    stmt = (
        pg_insert(BillingEvent)
        .values(
            subscription_id=sub.id,
            event_key=event.event_key,
            kind=event.kind,
            mp_status=event.mp_status,
            raw=event.raw,
            processed_at=now,
        )
        .on_conflict_do_nothing(index_elements=[BillingEvent.event_key])
        .returning(BillingEvent.id)
    )
    inserted = (await session.execute(stmt)).first() is not None
    if inserted:
        # Same transaction as the inbox insert above (VR-702) — both commit or neither does.
        session.add(
            EntitlementGrant(
                account_uid=sub.owner_uid,
                source="payment",
                granted_by="mercadopago",
                expires_at=period_end,
                subscription_id=sub.id,
            )
        )
        sub.status = "authorized"
        sub.current_period_end = period_end  # guaranteed non-null by the L2-N1 guard above
    await session.commit()
    return ProcessResult(matched=True, granted=inserted)
