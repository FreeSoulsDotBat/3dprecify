"""The live-recomputed product (E2, FR-310)."""

from __future__ import annotations

import datetime
import decimal
import uuid

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Text, func, text
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


class Product(Base):
    """FR-310 — live-recompute product: piece inputs + reference-with-fallback (D3) + JSONB (D4).

    **O app nunca exibe um preço que ele mesmo calculou no passado; ele exibe o cálculo de hoje ou
    o número que o vendedor declarou** (ADR-0033 §1 — a redação que substitui o antigo "NO price
    column exists anywhere", 019/PR-D, Clarification datada em `specs/007-e2-catalog-entitlement`).
    Continua não existindo aqui NENHUMA coluna de preço CALCULADO: o preço é recomputado no cliente
    com o ``PRICING_MODEL_VERSION`` corrente (FR-310/FR-313) e o backend nunca chama o motor
    (ADR-0008). O único dinheiro desta linha é ``seller_fixed_price`` — o número do ANÚNCIO,
    **declarado** pelo vendedor, com ``seller_fixed_at`` dizendo quando —, e o prefixo ``seller_``
    é carga: ele faz "usar isto como o preço do produto" ler errado em voz alta. ``NULL`` = o
    produto acompanha o custo; desfixar volta o recomputado de hoje, e o produto NUNCA desfixa
    sozinho. O fixado **não compõe** kit, orçamento nem cenário (embute a comissão do marketplace;
    composição é sempre pelo motor).

    O "era R$ …" mora em outro lugar de propósito: ``PriceObservation`` é *contexto*, nunca
    *fonte*, e mantê-lo fora desta tabela é o que preserva o invariante do E2 verificável por
    AUSÊNCIA em vez de por sutileza.

    ``filament_id``/``printer_id`` present ⇒ the live
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
        # 019/PR-D (ADR-0033 §3): o guarda de dinheiro da casa aplicado ao ÚNICO valor monetário
        # desta tabela — declarado pelo vendedor, nunca calculado. `numeric` aceita NaN e trata
        # `NaN = NaN` como TRUE, por isso o `<> 'NaN'` explícito.
        CheckConstraint(
            "seller_fixed_price IS NULL OR"
            " (seller_fixed_price >= 0 AND seller_fixed_price <> 'NaN'::numeric)",
            name="seller_fixed_price_valid",
        ),
        # 019/PR-D (ADR-0033 §4): a unicidade de nome vira propriedade do BANCO, não intenção da
        # aplicação (duas requisições simultâneas passariam as duas). PARCIAL de propósito.
        Index(
            "uq_products_owner_name_norm",
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

    # Piece inputs (product-owned; tariff lives here — spec assumption, data-model §11).
    # ``waste_grams`` was REMOVED in pricing-core 4.0.0 (ADR-0026, 016/US10) — migration 0007.
    print_grams: Mapped[decimal.Decimal] = mapped_column(QTY_G, nullable=False)
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

    # 019/PR-D (ADR-0033 §3) — o preço do ANÚNCIO, DECLARADO pelo vendedor. NULL = acompanhando o
    # custo (o estado "não fixado" é a ausência, sem tabela paralela e sem etapa intermediária).
    # Não é cálculo guardado, não desfixa sozinho e NÃO participa de kit/orçamento/cenário.
    seller_fixed_price: Mapped[decimal.Decimal | None] = mapped_column(MONEY_SETTLED)
    #: Carimbado pelo SERVIDOR ao fixar (NULL ao desfixar) — sem prefixo `device_` porque, ao
    #: contrário de `device_quoted_at`, este instante é o servidor que sabe.
    seller_fixed_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
