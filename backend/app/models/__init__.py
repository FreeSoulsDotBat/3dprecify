"""SQLAlchemy 2.0 typed models (E2 ADR-0013 + E3 migration 0002) — the ratified schemas of
``specs/007-e2-catalog-entitlement/data-model.md`` §2 and ``specs/008-e3-multi-piece-bom/``
``data-model.md``.

Seven tables: ``accounts`` (uid PK, JIT-provisioned), ``entitlement_grants`` (append-only
ledger — the ADR-0012 source of truth + audit), ``filaments``, ``printers``, ``products``
(nullable FK ``ON DELETE SET NULL`` + typed resolved-value columns + the "link OR full
snapshot" CHECK, D3/US6-4), and E3's ``boms`` + ``bom_lines`` — the SAME link-or-snapshot
machinery one level up (``bom_line : product :: product : filament/printer``). Money is
NUMERIC per ADR-0008 (never floats, never NaN — the ``<> 'NaN'`` CHECKs close Postgres's
NUMERIC-NaN hole). Soft-delete (``deleted_at``) covers VOLUNTARY deletion only — a premium
lapse never touches data (Q3 freeze, zero schema footprint). snake_case here; camelCase is
the wire's job (ADR-0002).
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
    Index,
    Integer,
    MetaData,
    Numeric,
    SmallInteger,
    Text,
    UniqueConstraint,
    event,
    func,
    inspect,
    text,
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


class Bom(Base):
    """E3 (FR-405..409) — a saved KIT: a named, per-account multi-piece assembly.

    NO price column exists here either (FR-407): a kit stores its INPUTS/STRUCTURE and the
    client recomputes with the current ``PRICING_MODEL_VERSION`` via ``computeBom``
    (ADR-0016). ``deleted_at`` is VOLUNTARY soft-delete only — a premium lapse freezes writes
    but never deletes a kit (FR-409, the Q3 freeze).
    """

    __tablename__ = "boms"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0", name="name_not_blank"),
        # Active listing is always owner + not-deleted — the composite serves it directly.
        Index("ix_boms_owner_uid_deleted_at", "owner_uid", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class BomLine(Base):
    """E3 — one priced line: a quantity + a piece that is EITHER a live product reference OR an
    editable last-known snapshot. The ``products`` link-or-snapshot fractal, one level up.

    After ADR-0017 every line is BORN with ``product_id`` (an ad-hoc piece materializes a manual
    product first, name-dedup'd, in the same transaction), so the snapshot-only branch of the
    CHECK is reachable only via D6 degradation. The referenced product is **soft-deleted** later;
    the kit read resolver (owner + live-only) stops resolving it and these columns become the
    authoritative, editable source — the ``product_id`` column itself stays pointed at the
    soft-deleted row (the ``ON DELETE SET NULL`` FK fires only on a hard purge, for which this
    snapshot is already current). They are re-snapshotted from the live product on EVERY kit write,
    which is what makes that degradation lossless (ADR-0017 addendum — read-time D6, not
    delete-capture).

    No ``deleted_at``: the root kit governs the lifecycle (``bom_id`` cascades on hard delete).
    No ``owner_uid``: ownership comes from ``boms`` — one source of truth, every read is
    owner-scoped through the root.
    """

    __tablename__ = "bom_lines"
    __table_args__ = (
        # Q1: `>= 0`, not `> 0` — a zeroed line is the honest "not in this order" state.
        CheckConstraint("quantity >= 0", name="quantity_non_negative"),
        CheckConstraint("position >= 0", name="position_non_negative"),
        # The snapshot columns are nullable (the CHECK below is what makes a line non-blank), so
        # every value guard is "NULL or valid" — same shape as the products resolved columns.
        CheckConstraint(
            "print_grams IS NULL OR (print_grams >= 0 AND print_grams <> 'NaN'::numeric)",
            name="print_grams_valid",
        ),
        CheckConstraint(
            "waste_grams IS NULL OR (waste_grams >= 0 AND waste_grams <> 'NaN'::numeric)",
            name="waste_grams_valid",
        ),
        CheckConstraint(
            "print_time_hours IS NULL"
            " OR (print_time_hours >= 0 AND print_time_hours <> 'NaN'::numeric)",
            name="print_time_valid",
        ),
        CheckConstraint(
            "tariff_per_kwh IS NULL OR (tariff_per_kwh >= 0 AND tariff_per_kwh <> 'NaN'::numeric)",
            name="tariff_valid",
        ),
        CheckConstraint(
            "failure_pct IS NULL OR (failure_pct >= 0 AND failure_pct <> 'NaN'::numeric)",
            name="failure_pct_valid",
        ),
        CheckConstraint(
            "finish_time_hours IS NULL"
            " OR (finish_time_hours >= 0 AND finish_time_hours <> 'NaN'::numeric)",
            name="finish_time_valid",
        ),
        CheckConstraint(
            "finish_rate_per_hour IS NULL"
            " OR (finish_rate_per_hour >= 0 AND finish_rate_per_hour <> 'NaN'::numeric)",
            name="finish_rate_valid",
        ),
        CheckConstraint(
            "labor_hours IS NULL OR (labor_hours >= 0 AND labor_hours <> 'NaN'::numeric)",
            name="labor_hours_valid",
        ),
        CheckConstraint(
            "labor_rate_per_hour IS NULL"
            " OR (labor_rate_per_hour >= 0 AND labor_rate_per_hour <> 'NaN'::numeric)",
            name="labor_rate_valid",
        ),
        CheckConstraint(
            "markup_varejo_pct IS NULL"
            " OR (markup_varejo_pct >= 0 AND markup_varejo_pct <> 'NaN'::numeric)",
            name="markup_varejo_valid",
        ),
        CheckConstraint(
            "markup_atacado_pct IS NULL"
            " OR (markup_atacado_pct >= 0 AND markup_atacado_pct <> 'NaN'::numeric)",
            name="markup_atacado_valid",
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
        # A "blank line" is unrepresentable: either it points at a product, or it carries the
        # load-bearing pricing inputs + denominators (data-model §bom_lines).
        CheckConstraint(
            "product_id IS NOT NULL OR (print_grams IS NOT NULL AND print_time_hours IS NOT NULL"
            " AND filament_cost_per_roll IS NOT NULL AND filament_roll_weight_kg IS NOT NULL"
            " AND printer_machine_value IS NOT NULL"
            " AND printer_machine_lifetime_hours IS NOT NULL"
            " AND markup_varejo_pct IS NOT NULL AND markup_atacado_pct IS NOT NULL)",
            name="link_or_snapshot",
        ),
        # Lines are read in submitted order — never by created_at (uuid7 ties on a bulk insert).
        Index("ix_bom_lines_bom_id_position", "bom_id", "position"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    bom_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("boms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)

    # Live product reference (D3) — NULL means degraded (D6): the snapshot below takes over.
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), index=True
    )

    # Last-known snapshot — the resolved PriceInput, refreshed from the live product on each write.
    print_grams: Mapped[decimal.Decimal | None] = mapped_column(QTY_G)
    waste_grams: Mapped[decimal.Decimal | None] = mapped_column(QTY_G)
    print_time_hours: Mapped[decimal.Decimal | None] = mapped_column(QTY_H)
    tariff_per_kwh: Mapped[decimal.Decimal | None] = mapped_column(MONEY_RATE)
    failure_pct: Mapped[decimal.Decimal | None] = mapped_column(PERCENT)
    finish_time_hours: Mapped[decimal.Decimal | None] = mapped_column(QTY_H)
    finish_rate_per_hour: Mapped[decimal.Decimal | None] = mapped_column(MONEY_RATE)
    labor_hours: Mapped[decimal.Decimal | None] = mapped_column(QTY_H)
    labor_rate_per_hour: Mapped[decimal.Decimal | None] = mapped_column(MONEY_RATE)
    markup_varejo_pct: Mapped[decimal.Decimal | None] = mapped_column(PERCENT)
    markup_atacado_pct: Mapped[decimal.Decimal | None] = mapped_column(PERCENT)
    include_marketplace: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )

    # Resolved filament/printer values (what the product itself resolves to).
    filament_material: Mapped[str | None] = mapped_column(Text)
    filament_cost_per_roll: Mapped[decimal.Decimal | None] = mapped_column(MONEY_SETTLED)
    filament_roll_weight_kg: Mapped[decimal.Decimal | None] = mapped_column(QTY_KG)
    printer_machine_value: Mapped[decimal.Decimal | None] = mapped_column(MONEY_SETTLED)
    printer_machine_lifetime_hours: Mapped[decimal.Decimal | None] = mapped_column(QTY_H)
    printer_avg_power_kw: Mapped[decimal.Decimal | None] = mapped_column(QTY_KW)
    printer_maintenance_reserve_per_hour: Mapped[decimal.Decimal | None] = mapped_column(MONEY_RATE)

    channels: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )
    other_costs: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB, nullable=False, server_default="[]"
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )


class Snapshot(Base):
    """A recorded price event — the seller's assertion "this is what I quoted" (E4, US1).

    THE TWO-SHELF RULE (spec §The two-shelf rule). A Product/Kit is a live template: it recomputes,
    and it degrades honestly when a reference dies (ADR-0017 §6). A Snapshot is the opposite BY
    NATURE: it **contains** its values instead of referencing them, so catalog churn changes 0% of
    it — no degraded state, no caption, no warning, because it depends on nothing.

    Three things about this table deliberately BREAK the E2/E3 house pattern, each for a reason that
    would otherwise produce a lie (data-model D1/D2/D3, ADR-0019):

    * **A JSONB frozen document, not typed columns per line.** A recorded line is a document whose
      shape must survive a formula change WITHOUT a migration — otherwise every future breakdown
      line means an `ALTER TABLE` forever, on rows that may never be touched. It also gives FR-507
      for free: a line that did not exist then is an ABSENT KEY, not a fabricated `0.00`.
      Money leaves inside the payload are decimal STRINGS (`json.loads` would hand back floats).

    * **NO foreign key to the origin.** `ON DELETE SET NULL` would *write to an immutable row* (and
      would fail against the trigger below, breaking the product delete); `RESTRICT` would let
      history hold the catalog hostage; `CASCADE` would delete the proof. Provenance is a captured
      `{kind, id, name}` inside the payload — informational, allowed to dangle harmlessly.

    * **`device_quoted_at`, and the `device_` prefix is load-bearing.** The date IS the seller's
      claim, and it is stamped by the DEVICE (FR-528, owner-accepted): the server stores a timestamp
      it CANNOT verify. The prefix warns every future reader, in the column name itself.
      `created_at`
      exists as row metadata only — never displayed, never exported, never used to order or to
      validate the device date.
    """

    __tablename__ = "snapshots"
    __table_args__ = (
        # Exactly-once (SC-513): UNCONDITIONAL — tombstones included, so a queued retry arriving
        # after a delete cannot RESURRECT the snapshot.
        UniqueConstraint("owner_uid", "client_snapshot_id", name="uq_snapshots_client_snapshot_id"),
        CheckConstraint("kind IN ('SINGLE','KIT')", name="kind_enum"),
        CheckConstraint(
            "headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO')", name="headline_basis_enum"
        ),
        CheckConstraint("label IS NULL OR length(btrim(label)) > 0", name="label_not_blank"),
        CheckConstraint(
            "quote_validity_days IS NULL OR"
            " (quote_validity_days > 0 AND quote_validity_days <= 3650)",
            name="quote_validity_days_range",
        ),
        # A device clock may be wrong (accepted) — but it may not be 'infinity' (the temporal twin
        # of the NaN hole). This is a well-formedness guard, NOT a sanity check on the seller's
        # clock: "fixing" a skewed clock is precisely what FR-528 forbids.
        CheckConstraint(
            "device_quoted_at > '-infinity' AND device_quoted_at < 'infinity'",
            name="device_quoted_at_finite",
        ),
        CheckConstraint(
            "device_utc_offset_minutes BETWEEN -840 AND 840", name="device_utc_offset_range"
        ),
        CheckConstraint("jsonb_typeof(payload) = 'object'", name="payload_is_object"),
        # The denormalised columns may never drift from the document. Safe here precisely BECAUSE
        # the row is immutable — in E2/E3 this would invite drift; here nothing can update them.
        CheckConstraint("payload->>'kind' = kind", name="payload_kind_matches"),
        CheckConstraint("payload->>'modelVersion' = model_version", name="payload_version_matches"),
        # The ADR-0008 money guard — `headline_total` is the ONE money column here and was the only
        # money column in the schema lacking it. `<> 'NaN'` because numeric CAN hold NaN and treats
        # `NaN = NaN` as TRUE (the numeric twin of the 'infinity' guard on device_quoted_at).
        CheckConstraint(
            "headline_total >= 0 AND headline_total <> 'NaN'::numeric", name="headline_total_valid"
        ),
        # The two MONEY-bound facts the DB did NOT guard until now: the denormalised total must
        # equal the document's basis total (DB backstop for VR-503, app-layer primary), and the
        # version column must equal the document's own `schemaVersion`. Immutability freezes both.
        CheckConstraint(
            "headline_total = ("
            "(payload->'totals') ->> ("
            "CASE headline_basis"
            " WHEN 'PRECO_VAREJO' THEN 'precoVarejo'"
            " WHEN 'PRECO_ATACADO' THEN 'precoAtacado'"
            " END))::numeric",
            name="headline_matches_totals",
        ),
        CheckConstraint(
            "(payload->>'schemaVersion')::int = payload_schema_version",
            name="payload_schema_matches",
        ),
        CheckConstraint("payload_schema_version >= 1", name="payload_schema_valid"),
        CheckConstraint("length(btrim(model_version)) > 0", name="model_version_set"),
        Index(
            "ix_snapshots_owner_active",
            "owner_uid",
            "device_quoted_at",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    #: Minted on the DEVICE at RECORD time (never at send time — minting at send regenerates after
    #: an app restart and duplicates). The idempotency key (ADR-0018 §3).
    client_snapshot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    #: The ONLY mutable field on this row.
    label: Mapped[str | None] = mapped_column(Text)
    quote_validity_days: Mapped[int | None] = mapped_column(Integer)
    device_quoted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    #: So the date the seller SAW renders forever (23:30 BRT must not become "the next day"
    #: elsewhere — that would corrupt the claim itself).
    device_utc_offset_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    #: The ENVELOPE's version — deliberately NOT the formula's. Conflating them is how old
    #: snapshots start lying.
    payload_schema_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    #: Denormalised for the list (money as Decimal, never float).
    headline_total: Mapped[decimal.Decimal] = mapped_column(MONEY_SETTLED, nullable=False)
    #: WHICH number the seller says they quoted — they choose it at record time (design round F1):
    #: someone quoting a shopkeeper quoted ATACADO, and forcing varejo would record a number they
    #: never said to the customer.
    headline_basis: Mapped[str] = mapped_column(Text, nullable=False)
    #: Row metadata: when the sync LANDED. Never on the wire, never ordered by, never used to
    #: validate `device_quoted_at` (FR-528, owner decision 2026-07-12).
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    #: Voluntary soft-delete — AND the idempotency tombstone that stops a delete-then-retry from
    #: resurrecting the row.
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


class Scenario(Base):
    """A saved marketplace strategy — the seller's INTENT ("where and for how much to sell, today").

    THE DELIBERATE OPPOSITE OF A SNAPSHOT (E5 data-model governing sentence). A ``Snapshot`` freezes
    resolved values and is immutable; a ``Scenario`` stores *intent* and is **mutable** (rename +
    edit-config are the feature). So four things a snapshot HAS are, here, load-bearing ABSENCES:

    * **No immutability trigger** — the row is edited, renamed, re-saved. The whole PL/pgSQL
      apparatus of ``0003`` is dropped; the validators (VR-602/603) run on every write instead.
    * **No idempotency key / no offline outbox** — writes are online-only (Q4/FR-613); a scenario is
      created like a ``products``/``boms`` row. There is no ``client_scenario_id`` and no unique
      index to import from E4.
    * **No money / Numeric column at all** — a scenario NEVER stores a resolved price (VR-611).
      Every monetary leaf lives inside ``config`` as a decimal STRING and is an INPUT or an explicit
      override, never a computed price; the live price is recomputed client-side on reopen.
    * **No catalog FK** — the cost basis is a SOFT reference ``{kind, ref, lastKnown}`` inside
      ``config`` (N2). ``owner_uid → accounts`` is the ONLY foreign key; a dangling basis ref
      degrades read-time (D6), it does not break referential integrity.

    Hybrid shape (N1): typed columns for exactly what the DB must query/order/constrain (owner,
    name, note, timestamps, soft-delete, the envelope version) + one ``config JSONB`` holding the
    full, polymorphic, multi-piece-capable intent document (§3). The DB cannot ``CHECK`` a money
    leaf inside ``config``; the ONE binding it CAN enforce — that the JSONB envelope version matches
    its column — is pinned here (``config_schema_matches``), defence against a mismatched envelope.

    ``deleted_at`` is VOLUNTARY soft-delete only; a premium lapse freezes writes but never deletes a
    scenario (FR-612, the Q3 freeze) — so, unlike E4's unconditional key, the active-list index IS
    partial on ``deleted_at IS NULL`` (the E2/E3 idiom; no idempotency-tombstone role to preserve).
    """

    __tablename__ = "scenarios"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0 AND length(name) <= 120", name="name_not_blank"),
        CheckConstraint(
            "note IS NULL OR (length(btrim(note)) > 0 AND length(note) <= 500)", name="note_valid"
        ),
        CheckConstraint("jsonb_typeof(config) = 'object'", name="config_is_object"),
        CheckConstraint("config_schema_version >= 1", name="config_schema_valid"),
        # The envelope↔column binding (VR-613). A plain CHECK evaluates on every INSERT *and* UPDATE
        # — no trigger needed, and it holds for the mutable row too.
        CheckConstraint(
            "(config->>'schemaVersion')::int = config_schema_version", name="config_schema_matches"
        ),
        # Active listing = owner + not-deleted, newest-first. `created_at` is IMMUTABLE, so the
        # keyset cursor (owner_uid eq, then created_at DESC, id DESC via a backward b-tree scan) is
        # stable — the E4 lesson (never key a cursor on a field that moves under a mid-page edit).
        Index(
            "ix_scenarios_owner_active",
            "owner_uid",
            "created_at",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid7)
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    #: The full intent document (§3) — read whole, written whole; money leaves are decimal strings.
    config: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    #: OUR envelope version — how to read the JSONB shape. Deliberately NOT a pricing model version
    #: (a scenario makes no frozen claim; it always recomputes with the current engine).
    config_schema_version: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="1"
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    #: Voluntary soft-delete by the owner; a lapse never sets it (FR-612).
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


#: The only columns a snapshot may ever move. Everything else is frozen (FR-504).
SNAPSHOT_MUTABLE_COLUMNS = frozenset({"label", "deleted_at", "updated_at"})


@event.listens_for(Snapshot, "before_update")
def _forbid_snapshot_content_mutation(
    _mapper: object, _connection: object, target: Snapshot
) -> None:
    """The ORM half of ADR-0019: defence against FUTURE code.

    SC-504 claims *0* write paths can alter a snapshot — a claim about code that does not exist yet
    (E5/E6 will write near this table). The API has no path to mutate contents today; this raises
    the moment someone adds one, instead of letting the epic's central promise quietly become false.
    The database trigger (migration 0003) is the third and final layer.
    """
    dirty = {
        attr.key
        for attr in inspect(target).attrs
        if attr.history.has_changes()  # pyright: ignore[reportUnknownMemberType]
    }
    frozen = dirty - SNAPSHOT_MUTABLE_COLUMNS
    if frozen:
        raise ValueError(
            "snapshot contents are immutable (FR-504/ADR-0019); "
            f"refused to update: {sorted(frozen)}"
        )
