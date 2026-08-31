"""019/PR-D — the "era R$ …" read-marker (ADR-0033 §2)."""

from __future__ import annotations

import datetime
import decimal
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import MONEY_SETTLED, Base, uuid7_default


class PriceObservation(Base):
    """019/PR-D (ADR-0033 §2) — o último preço que o vendedor VIU, uma linha por (conta, item).

    Serve à frase "era R$ …" e à contagem "3 preços mudaram desde a sua última visita". É
    **contexto, nunca fonte**: nenhum caminho de exibição pode ler daqui o número GRANDE — o valor
    exibido é sempre o recomputado de hoje ou o declarado pelo vendedor.

    **Quem escreve é o CLIENTE**, porque é o único que sabe calcular (ADR-0008: o backend nunca
    recomputa). O servidor valida e guarda; não deriva, não compara e não conta — a frase é
    derivada no cliente. A escrita acontece **depois** do render, nunca antes: se ela falhar, a
    marca não avança e o vendedor vê o mesmo aviso na próxima visita (repetir uma verdade é
    honesto; escrever sem ter exibido ESCONDERIA uma mudança real).

    **Ausência é ausência** — sem observação a linha não diz nada, nem "0 preços mudaram" nem
    "era R$ 0,00" (FR-1913).

    Uma linha por item, atualizada no lugar (não é append-only): uma observação não PROVA nada, é
    um marcador de leitura, e o histórico que ninguém consulta cresceria sem fim. Se um dia alguém
    precisar da trilha, isso é uma tabela de EVIDÊNCIA nova, com dono e razão próprios.

    ``model_version``/``catalog_version`` são REGISTRO, não regra: guardados para que um "era R$ X"
    produzido por outra versão do motor ou por outra tabela de tarifas possa ser explicado sem
    adivinhação. Nesta fatia eles não mudam comportamento nenhum.
    """

    __tablename__ = "price_observations"
    __table_args__ = (
        # Uma linha por (conta, item). `KIT` já cabe pelo discriminador — kits entram sem migração.
        # A UNIQUE liderada por `owner_uid` também serve o `WHERE owner_uid = :uid` do GET.
        UniqueConstraint(
            "owner_uid", "subject_kind", "subject_id", name="uq_price_observations_subject"
        ),
        CheckConstraint("subject_kind IN ('PRODUCT','KIT')", name="subject_kind_enum"),
        CheckConstraint(
            "observed_price >= 0 AND observed_price <> 'NaN'::numeric",
            name="observed_price_valid",
        ),
        CheckConstraint(
            "observed_at > '-infinity' AND observed_at < 'infinity'", name="observed_at_finite"
        ),
        CheckConstraint("length(btrim(model_version)) > 0", name="model_version_set"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    owner_uid: Mapped[str] = mapped_column(Text, ForeignKey("accounts.account_uid"), nullable=False)
    subject_kind: Mapped[str] = mapped_column(Text, nullable=False)
    #: **Sem FK, de propósito** (precedente ADR-0019 §5 / ADR-0021 N2): um id que resolve ou não
    #: resolve, nunca uma FK que escreve na linha alheia — apagar um produto não pode fazer o banco
    #: mexer numa observação, e uma observação órfã simplesmente não resolve na leitura.
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    observed_price: Mapped[decimal.Decimal] = mapped_column(MONEY_SETTLED, nullable=False)
    #: Carimbado pelo SERVIDOR (`now()`); o corpo do PUT não o envia. "Salvo em DD/MM" formata no
    #: fuso do aparelho na LEITURA (ADR-0033 §Adendo 2026-08-27, decisão 1).
    observed_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    catalog_version: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
