"""E6 (T013) — the checkout service: `POST /api/v1/billing/checkout`'s domain logic (ADR-0023
§1/§7, `contracts/api-surface.md`, seguranca-round SEC-301/302/604).

Auth-only, NOT entitlement-gated (a free seller is exactly the caller). This module NEVER writes a
grant — the checkout path's only DB write is a `pending` `subscriptions` row; the ONE shared
`grant_writer` (T009) is still the sole payment-grant terminus (SEC-301).

Ordering is deliberate: the MP `create_preapproval` call happens BEFORE any local write, so an
MP failure leaves zero partial state (no cleanup rule needed — there is nothing to clean up).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.entitlement import ensure_account
from app.models import Subscription

from .providers.mercadopago import MercadoPagoProvider
from .reconcile import NON_TERMINAL_STATUSES

PlanPeriod = Literal["monthly", "annual"]


class CheckoutError(Exception):
    """Base for the checkout service's mapped failures (the route translates these to wire
    codes)."""


class CheckoutConflict(CheckoutError):
    """SEC-604: an active/grace/paused/pending subscription already exists for this account."""


class CheckoutUnavailable(CheckoutError):
    """MP could not be reached, or rejected/returned a malformed create response."""


@dataclass(frozen=True)
class CheckoutResult:
    init_point: str


async def start_checkout(
    session: AsyncSession,
    provider: MercadoPagoProvider,
    *,
    uid: str,
    email: str | None,
    period: PlanPeriod,
    plan_id: str,
    back_url: str,
) -> CheckoutResult:
    await ensure_account(session, uid, email)

    # SEC-604 (app-level check; the DB partial-unique index below is the race-safe backstop).
    existing = (
        await session.execute(
            select(Subscription.id).where(
                Subscription.owner_uid == uid,
                Subscription.status.in_(NON_TERMINAL_STATUSES),
                Subscription.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise CheckoutConflict()

    preapproval = await provider.create_preapproval(
        plan_id=plan_id, payer_email=email, back_url=back_url
    )
    if preapproval is None:
        raise CheckoutUnavailable()

    preapproval_id = preapproval.get("id")
    init_point = preapproval.get("init_point")
    if not isinstance(preapproval_id, str) or not isinstance(init_point, str):
        raise CheckoutUnavailable()

    session.add(
        Subscription(
            owner_uid=uid,
            provider="mercadopago",
            mp_preapproval_id=preapproval_id,
            plan_period=period,
            status="pending",
            payer_ref=email,
        )
    )
    try:
        await session.commit()
    except IntegrityError as exc:
        # The double-subscribe race the app-level check above can miss (two near-simultaneous
        # checkout-starts, SEC-604) — the DB partial-unique index is the authoritative guard.
        await session.rollback()
        raise CheckoutConflict() from exc

    return CheckoutResult(init_point=init_point)
