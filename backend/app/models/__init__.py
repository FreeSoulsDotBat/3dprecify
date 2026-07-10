"""SQLAlchemy 2.0 typed models (E2, ADR-0013) — the ratified schema of
``specs/007-e2-catalog-entitlement/data-model.md`` §2.

Five tables: ``accounts`` (uid PK, JIT-provisioned), ``entitlement_grants`` (append-only
ledger — the ADR-0012 source of truth + audit), ``filaments``, ``printers`` and ``products``
(nullable FK ``ON DELETE SET NULL`` + typed resolved-value columns + the "link OR full
snapshot" CHECK, D3/US6-4). Money is NUMERIC per ADR-0008 (never floats, never NaN — the
``<> 'NaN'`` CHECKs close Postgres's NUMERIC-NaN hole). Soft-delete (``deleted_at``) covers
VOLUNTARY deletion only — a premium lapse never touches data (Q3 freeze, zero schema
footprint). snake_case here; camelCase is the wire's job (ADR-0002).
"""

from __future__ import annotations

import datetime
import decimal
import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    MetaData,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from uuid6 import uuid7

# Deterministic constraint names so Alembic migrations stay stable across autogenerations.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

# Type domains (data-model §0.1). Stored precision ≥ input precision ⇒ lossless round-trip,
# which is what makes catalog pre-fill byte-identical by construction (SC-305).
MONEY_SETTLED = Numeric(12, 2)
MONEY_RATE = Numeric(18, 6)
QTY_G = Numeric(12, 3)
QTY_H = Numeric(9, 3)
QTY_KG = Numeric(9, 3)
QTY_KW = Numeric(9, 4)
PERCENT = Numeric(6, 3)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def _uuid7() -> uuid.UUID:
    return uuid7()


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
    __table_args__ = (CheckConstraint("source IN ('beta','comp')", name="source_enum"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
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
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Filament(Base):
    """FR-305 — feeds costPerRoll / rollWeightKg / material / default waste."""

    __tablename__ = "filaments"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        CheckConstraint(
            "cost_per_roll >= 0 AND cost_per_roll <> 'NaN'::numeric", name="cost_per_roll_valid"
        ),
        CheckConstraint("roll_weight_kg > 0", name="roll_weight_positive"),
        CheckConstraint(
            "default_waste_grams >= 0 AND default_waste_grams <> 'NaN'::numeric",
            name="default_waste_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    material: Mapped[str | None] = mapped_column(Text)
    cost_per_roll: Mapped[decimal.Decimal] = mapped_column(MONEY_SETTLED, nullable=False)
    roll_weight_kg: Mapped[decimal.Decimal] = mapped_column(QTY_KG, nullable=False)
    default_waste_grams: Mapped[decimal.Decimal] = mapped_column(
        QTY_G, nullable=False, server_default="0"
    )
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
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
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


class Product(Base):
    """FR-310 — live-recompute product: piece inputs + reference-with-fallback (D3) + JSONB (D4).

    NO price column exists anywhere — prices are recomputed client-side with the current
    ``PRICING_MODEL_VERSION`` (FR-310/FR-313). ``filament_id``/``printer_id`` present ⇒ the live
    row is authoritative (US6-3); NULL (via delete-degradation) ⇒ the resolved columns are
    authoritative and editable (US6-4) — the CHECKs make a "blank product" unrepresentable.
    """

    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        CheckConstraint(
            "print_grams >= 0 AND print_grams <> 'NaN'::numeric", name="print_grams_valid"
        ),
        CheckConstraint(
            "waste_grams >= 0 AND waste_grams <> 'NaN'::numeric", name="waste_grams_valid"
        ),
        CheckConstraint(
            "print_time_hours >= 0 AND print_time_hours <> 'NaN'::numeric", name="print_time_valid"
        ),
        CheckConstraint(
            "tariff_per_kwh >= 0 AND tariff_per_kwh <> 'NaN'::numeric", name="tariff_valid"
        ),
        CheckConstraint(
            "failure_pct >= 0 AND failure_pct <> 'NaN'::numeric", name="failure_pct_valid"
        ),
        CheckConstraint(
            "finish_time_hours >= 0 AND finish_time_hours <> 'NaN'::numeric",
            name="finish_time_valid",
        ),
        CheckConstraint(
            "finish_rate_per_hour >= 0 AND finish_rate_per_hour <> 'NaN'::numeric",
            name="finish_rate_valid",
        ),
        CheckConstraint(
            "labor_hours >= 0 AND labor_hours <> 'NaN'::numeric", name="labor_hours_valid"
        ),
        CheckConstraint(
            "labor_rate_per_hour >= 0 AND labor_rate_per_hour <> 'NaN'::numeric",
            name="labor_rate_valid",
        ),
        CheckConstraint(
            "markup_varejo_pct >= 0 AND markup_varejo_pct <> 'NaN'::numeric",
            name="markup_varejo_valid",
        ),
        CheckConstraint(
            "markup_atacado_pct >= 0 AND markup_atacado_pct <> 'NaN'::numeric",
            name="markup_atacado_valid",
        ),
        CheckConstraint(
            # material is an OPTIONAL display label (nullable on ``filaments``), NOT load-bearing:
            # a valid last-known snapshot needs only the pricing inputs cost_per_roll +
            # roll_weight_kg, so a material-less filament degrades cleanly (homologation).
            "filament_id IS NOT NULL OR (filament_cost_per_roll IS NOT NULL"
            " AND filament_roll_weight_kg IS NOT NULL)",
            name="filament_link_or_snapshot",
        ),
        CheckConstraint(
            "printer_id IS NOT NULL OR (printer_machine_value IS NOT NULL"
            " AND printer_machine_lifetime_hours IS NOT NULL"
            " AND printer_avg_power_kw IS NOT NULL"
            " AND printer_maintenance_reserve_per_hour IS NOT NULL)",
            name="printer_link_or_snapshot",
        ),
        CheckConstraint(
            "filament_cost_per_roll IS NULL"
            " OR (filament_cost_per_roll >= 0 AND filament_cost_per_roll <> 'NaN'::numeric)",
            name="filament_cost_valid",
        ),
        CheckConstraint(
            "filament_roll_weight_kg IS NULL OR filament_roll_weight_kg > 0",
            name="filament_roll_weight_positive",
        ),
        CheckConstraint(
            "printer_machine_value IS NULL"
            " OR (printer_machine_value >= 0 AND printer_machine_value <> 'NaN'::numeric)",
            name="printer_value_valid",
        ),
        CheckConstraint(
            "printer_machine_lifetime_hours IS NULL OR printer_machine_lifetime_hours > 0",
            name="printer_lifetime_positive",
        ),
        CheckConstraint(
            "printer_avg_power_kw IS NULL"
            " OR (printer_avg_power_kw >= 0 AND printer_avg_power_kw <> 'NaN'::numeric)",
            name="printer_power_valid",
        ),
        CheckConstraint(
            "printer_maintenance_reserve_per_hour IS NULL"
            " OR (printer_maintenance_reserve_per_hour >= 0"
            " AND printer_maintenance_reserve_per_hour <> 'NaN'::numeric)",
            name="printer_maintenance_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)

    # Piece inputs (product-owned; tariff lives here — spec assumption, data-model §11).
    print_grams: Mapped[decimal.Decimal] = mapped_column(QTY_G, nullable=False)
    waste_grams: Mapped[decimal.Decimal] = mapped_column(QTY_G, nullable=False, server_default="0")
    print_time_hours: Mapped[decimal.Decimal] = mapped_column(QTY_H, nullable=False)
    tariff_per_kwh: Mapped[decimal.Decimal] = mapped_column(MONEY_RATE, nullable=False)
    failure_pct: Mapped[decimal.Decimal] = mapped_column(
        PERCENT, nullable=False, server_default="0"
    )
    finish_time_hours: Mapped[decimal.Decimal] = mapped_column(
        QTY_H, nullable=False, server_default="0"
    )
    finish_rate_per_hour: Mapped[decimal.Decimal] = mapped_column(
        MONEY_RATE, nullable=False, server_default="0"
    )
    labor_hours: Mapped[decimal.Decimal] = mapped_column(QTY_H, nullable=False, server_default="0")
    labor_rate_per_hour: Mapped[decimal.Decimal] = mapped_column(
        MONEY_RATE, nullable=False, server_default="0"
    )
    markup_varejo_pct: Mapped[decimal.Decimal] = mapped_column(PERCENT, nullable=False)
    markup_atacado_pct: Mapped[decimal.Decimal] = mapped_column(PERCENT, nullable=False)
    include_marketplace: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    channels: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )
    other_costs: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )

    # Filament reference + resolved values (D3).
    filament_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("filaments.id", ondelete="SET NULL"), index=True
    )
    filament_material: Mapped[str | None] = mapped_column(Text)
    filament_cost_per_roll: Mapped[decimal.Decimal | None] = mapped_column(MONEY_SETTLED)
    filament_roll_weight_kg: Mapped[decimal.Decimal | None] = mapped_column(QTY_KG)

    # Printer reference + resolved values (D3).
    printer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("printers.id", ondelete="SET NULL"), index=True
    )
    printer_machine_value: Mapped[decimal.Decimal | None] = mapped_column(MONEY_SETTLED)
    printer_machine_lifetime_hours: Mapped[decimal.Decimal | None] = mapped_column(QTY_H)
    printer_avg_power_kw: Mapped[decimal.Decimal | None] = mapped_column(QTY_KW)
    printer_maintenance_reserve_per_hour: Mapped[decimal.Decimal | None] = mapped_column(MONEY_RATE)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
