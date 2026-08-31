"""E6 billing — the PSP mirror + the exactly-once inbox (ADR-0023)."""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid7_default


class Subscription(Base):
    """E6 (ADR-0023 §2, data-model §1) — the PSP mirror: references ONLY, never a price.

    A subscription stores what MP is the authority for — the preapproval id, the mirrored status,
    the plan period, the current period end, a minimum payer ref, the provider — and NOTHING a card
    could leak (VR-701/SC-706): there is NO money/card column here or ever (the E4/E5 no-money-leaf
    discipline, one level up). `raw` PSP payloads live in `billing_events`, not here.

    `owner_uid → accounts` is the ONLY account link — cross-account isolation (SEC-204/VR-703) is
    resolved server-side by `subscription_id → owner_uid`, never by a webhook body field. The
    partial-UNIQUE `uq_subscriptions_one_active` makes at-most-one-active-subscription-per-account a
    DATABASE guarantee (SEC-604 double-subscribe guard). `mp_preapproval_id` is UNIQUE but nullable
    — the future `google_play` row (E7) carries none. `status` includes `grace` (FR-708): the
    displayed pending-but-active state, mirrored from the authoritative lookup, never derived.
    `deleted_at` is soft-delete only (stale-pending reaping); a lapse never touches it.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint("provider IN ('mercadopago','google_play')", name="provider_enum"),
        CheckConstraint("plan_period IN ('monthly','annual')", name="plan_period_enum"),
        CheckConstraint(
            "status IN ('pending','authorized','grace','paused','cancelled')",
            name="status_enum",
        ),
        UniqueConstraint("mp_preapproval_id", name="uq_subscriptions_mp_preapproval_id"),
        # SEC-604: at most one active subscription per account — the double-subscribe guard, at the
        # DB. Partial on the non-terminal statuses AND not-deleted (matches migration 0005).
        Index(
            "uq_subscriptions_one_active",
            "owner_uid",
            unique=True,
            postgresql_where=text(
                "status IN ('pending','authorized','grace','paused') AND deleted_at IS NULL"
            ),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    #: UNIQUE, nullable — the future Play row carries no MP preapproval id.
    mp_preapproval_id: Mapped[str | None] = mapped_column(Text)
    plan_period: Mapped[str] = mapped_column(Text, nullable=False)
    #: Mirrored from the authoritative MP lookup (never the webhook body); `grace` marks FR-708.
    status: Mapped[str] = mapped_column(Text, nullable=False)
    #: MP's minimum payer identifier — the LGPD-mapped field (SEC-5xx). Never a name/CPF/address.
    payer_ref: Mapped[str | None] = mapped_column(Text)
    current_period_end: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    #: Soft-delete only (stale-pending reaping); a premium lapse never sets it.
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class BillingEvent(Base):
    """E6 (ADR-0023 §3, data-model §2) — the exactly-once inbox (ADR-0018 principle, server-side).

    The `event_key` UNIQUE is what makes exactly-once a DATABASE guarantee, not app cleverness (the
    ADR-0018 §3 lesson, restated server-side): the same MP `authorized_payment.id` delivered by the
    webhook AND re-observed by the reconciliation poll converges to ONE row (`ON CONFLICT DO
    NOTHING`), so neither path double-grants (SC-703). A grant-writing event is inserted here in the
    SAME transaction as the ledger grant. `raw` holds the LOOKED-UP authoritative resource (audit) —
    never the raw webhook body alone, and never a money/card leaf. `subscription_id` is the ONLY
    account resolution path (SEC-204): an event → its subscription → its owner, server-side.
    """

    __tablename__ = "billing_events"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('payment','payment_failed','refund','chargeback','cancel')",
            name="kind_enum",
        ),
        UniqueConstraint("event_key", name="uq_billing_events_event_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    subscription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=False, index=True
    )
    #: The idempotency key = MP `authorized_payment.id` (or provider-scoped equivalent); webhook +
    #: poll converge here. UNIQUE — the exactly-once constraint.
    event_key: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    #: The looked-up authoritative status.
    mp_status: Mapped[str] = mapped_column(Text, nullable=False)
    #: The LOOKED-UP resource (never the raw webhook body alone) — the audit trail.
    raw: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    processed_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
