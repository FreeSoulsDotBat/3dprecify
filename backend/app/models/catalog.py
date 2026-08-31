"""The premium catalog leaves — filaments and printers (E2, FR-305)."""

from __future__ import annotations

import datetime
import decimal
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import (
    MONEY_RATE,
    MONEY_SETTLED,
    QTY_H,
    QTY_KG,
    QTY_KW,
    Base,
    name_norm_default,
    uuid7_default,
)


class Filament(Base):
    """FR-305 — feeds costPerRoll / rollWeightKg / material.

    ``default_waste_grams`` was REMOVED in pricing-core 4.0.0 (ADR-0026, 016/US10): the motor
    now recuses the field by key rather than silently ignoring it, so there is no default to
    carry here anymore. Migration 0007 drops the column + its CHECK; it never returns.
    """

    __tablename__ = "filaments"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        CheckConstraint(
            "cost_per_roll >= 0 AND cost_per_roll <> 'NaN'::numeric", name="cost_per_roll_valid"
        ),
        CheckConstraint("roll_weight_kg > 0", name="roll_weight_positive"),
        # 019/PR-D (ADR-0033 §4): a unicidade de nome vira propriedade do BANCO, não intenção da
        # aplicação (duas requisições simultâneas passariam as duas). PARCIAL de propósito.
        Index(
            "uq_filaments_owner_name_norm",
            "owner_uid",
            "name_norm",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    #: 019/PR-D (ADR-0033 §4) — a chave de unicidade "sem maiúscula e sem acento" por conta.
    #: `left(name_norm(name), 200)`, escrita pela aplicação (`app.lib.name_norm`), NUNCA exibida:
    #: o vendedor lê `name`. O índice único é PARCIAL, então um item apagado não reserva o nome.
    name_norm: Mapped[str] = mapped_column(Text, nullable=False, default=name_norm_default)
    material: Mapped[str | None] = mapped_column(Text)
    cost_per_roll: Mapped[decimal.Decimal] = mapped_column(MONEY_SETTLED, nullable=False)
    roll_weight_kg: Mapped[decimal.Decimal] = mapped_column(QTY_KG, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class Printer(Base):
    """FR-305 — feeds machineValue / machineLifetimeHours / avgPowerKw / maintenance."""

    __tablename__ = "printers"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        CheckConstraint(
            "machine_value >= 0 AND machine_value <> 'NaN'::numeric", name="machine_value_valid"
        ),
        CheckConstraint("machine_lifetime_hours > 0", name="lifetime_positive"),
        CheckConstraint(
            "avg_power_kw >= 0 AND avg_power_kw <> 'NaN'::numeric", name="avg_power_valid"
        ),
        CheckConstraint(
            "maintenance_reserve_per_hour >= 0 AND maintenance_reserve_per_hour <> 'NaN'::numeric",
            name="maintenance_valid",
        ),
        # 019/PR-D (ADR-0033 §4): a unicidade de nome vira propriedade do BANCO, não intenção da
        # aplicação (duas requisições simultâneas passariam as duas). PARCIAL de propósito.
        Index(
            "uq_printers_owner_name_norm",
            "owner_uid",
            "name_norm",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    #: 019/PR-D (ADR-0033 §4) — a chave de unicidade "sem maiúscula e sem acento" por conta.
    #: `left(name_norm(name), 200)`, escrita pela aplicação (`app.lib.name_norm`), NUNCA exibida:
    #: o vendedor lê `name`. O índice único é PARCIAL, então um item apagado não reserva o nome.
    name_norm: Mapped[str] = mapped_column(Text, nullable=False, default=name_norm_default)
    machine_value: Mapped[decimal.Decimal] = mapped_column(MONEY_SETTLED, nullable=False)
    machine_lifetime_hours: Mapped[decimal.Decimal] = mapped_column(QTY_H, nullable=False)
    avg_power_kw: Mapped[decimal.Decimal] = mapped_column(QTY_KW, nullable=False)
    maintenance_reserve_per_hour: Mapped[decimal.Decimal] = mapped_column(
        MONEY_RATE, nullable=False, server_default="0"
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
