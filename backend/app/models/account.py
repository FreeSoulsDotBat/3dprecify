"""Account identity + the entitlement ledger (E2, ADR-0012/0013)."""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid7_default


class Account(Base):
    """Account identity (D1: Option B) — JIT-provisioned from verified Firebase claims."""

    __tablename__ = "accounts"
    __table_args__ = (CheckConstraint("currency = 'BRL'", name="currency_brl"),)

    account_uid: Mapped[str] = mapped_column(Text, primary_key=True)
    email: Mapped[str | None] = mapped_column(Text)
    currency: Mapped[str] = mapped_column(Text, nullable=False, server_default="BRL")
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    last_seen_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class EntitlementGrant(Base):
    """Append-only premium grant ledger (D2 / ADR-0012) — source of truth AND audit trail.

    Current premium(uid) = EXISTS(grant WHERE revoked_at IS NULL AND (expires_at IS NULL OR
    expires_at > now())). Revoke = UPDATE revoked_at/by (history preserved); re-grant = new row.
    """

    __tablename__ = "entitlement_grants"
    # E6 (ADR-0023 §3): the source CHECK widens additively to admit ``payment`` — the ONLY new
    # producer is the verified-event ``grant_writer`` (the operator CLI stays beta|comp, VR-710).
    __table_args__ = (CheckConstraint("source IN ('beta','comp','payment')", name="source_enum"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    account_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    source: Mapped[str] = mapped_column(Text, nullable=False)
    granted_by: Mapped[str] = mapped_column(Text, nullable=False)
    granted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    expires_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    #: E6 (ADR-0023 §3): audit linkage — a payment grant traces to its subscription; NULL for
    #: beta/comp. The ledger's evaluation is untouched; this is a nullable annotation, not a rule.
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subscriptions.id")
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
