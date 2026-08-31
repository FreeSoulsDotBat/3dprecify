"""E3 multi-piece BOM (Kits) — the composed assembly and its priced lines (ADR-0016/0017)."""

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
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import (
    MONEY_RATE,
    MONEY_SETTLED,
    PERCENT,
    QTY_G,
    QTY_H,
    QTY_KG,
    QTY_KW,
    Base,
    name_norm_default,
    uuid7_default,
)


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
        # 019/PR-D (ADR-0033 §4): a unicidade de nome vira propriedade do BANCO, não intenção da
        # aplicação (duas requisições simultâneas passariam as duas). PARCIAL de propósito.
        Index(
            "uq_boms_owner_name_norm",
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

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
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
    # ``waste_grams`` was REMOVED in pricing-core 4.0.0 (ADR-0026, 016/US10) — migration 0007.
    print_grams: Mapped[decimal.Decimal | None] = mapped_column(QTY_G)
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
