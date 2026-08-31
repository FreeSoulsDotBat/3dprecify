"""019/PR-D · T072 (US5) — observação de preço: o servidor VALIDA e GUARDA, nunca calcula.

Autoridade: ADR-0033 §2 (+ §Adendo 2026-08-27). Recurso **separado** do produto de propósito:
`ProductOut` continua sem campo de dinheiro derivado de cálculo, e isso segue verificável no
contrato congelado pelo drift-guard.

Quem escreve é o CLIENTE, porque é o único que sabe calcular (ADR-0008: o backend nunca recomputa).
O servidor não deriva, não compara e não conta — a frase *"3 preços mudaram desde a sua última
visita"* é derivada no cliente, comparando o recomputado de hoje com a observação lida. A escrita
acontece **depois** do render: se ela falhar, a marca não avança e o vendedor vê o mesmo aviso na
próxima visita (repetir uma verdade é honesto; escrever sem ter exibido esconderia uma mudança
real).

Três recusas que existem por medida, não por gosto:

* **escala** — `MONEY_SETTLED` é `Numeric(12,2)` e arredondaria a terceira casa em SILÊNCIO, e
  `finite_non_negative` não olha escala. Como o número aqui é o do VENDEDOR, arredondá-lo seria
  alterá-lo: 3 casas é 422. (Divergência consciente do resto da casa, registrada na fatia.)
* **par repetido no lote** — `ON CONFLICT DO UPDATE` levanta `cardinality_violation` quando o
  mesmo `(kind,id)` aparece duas vezes no mesmo comando. Um erro do cliente não pode virar 500.
* **teto de 500 itens** — o lote é uma visita ao Catálogo, não um despejo.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal, cast

from fastapi import APIRouter, Depends
from pydantic import ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Claims
from app.db import get_session
from app.entitlement import require_catalog_read, require_entitlement
from app.errors import ENTITLEMENT_ERRORS, VALIDATION_ERRORS, CamelModel
from app.models import PriceObservation
from app.validation import CEIL_MONEY, finite_non_negative, money_scale_ok

router = APIRouter(tags=["price-observations"])

#: Uma visita ao Catálogo, não um despejo (Adendo 27/08 §2).
MAX_BATCH_ITEMS = 500

SubjectKind = Literal["PRODUCT", "KIT"]


class PriceObservationIn(CamelModel):
    """Um item do lote. `observedAt` NÃO vem daqui: quem carimba é o servidor.

    **Chave desconhecida é 422** — e a recusa vive num validador, não em
    `model_config = ConfigDict(extra="forbid")`, por uma razão MEDIDA (2026-08-29): um
    `additionalProperties: false` publicado no ITEM de um array faz a coleta da suíte de
    conformidade (Schemathesis/Hypothesis, `test_conformance.py`) passar de **6,7s para mais de
    4 minutos sem terminar** — o gate inteiro deixa de rodar. As quatro combinações medidas:
    `maxItems` 5/50/200 + `forbid` → rápido · `maxItems` 500 + `forbid` → não termina · sem
    `maxItems` + `forbid` → não termina · `maxItems` 500 sem `forbid` no item → 6,7s.

    O comportamento é o mesmo do `extra="forbid"` (a mensagem, inclusive, NOMEIA as chaves
    recusadas, o que a genérica do pydantic não faz); o que se perde é a linha
    `additionalProperties: false` no schema publicado DESTE item — o envelope
    (`PriceObservationsPutIn`) segue com `extra="forbid"` de verdade, porque ele não está dentro
    de um array. **Ponto para o dono decidir** (registrado no relatório da fatia): a alternativa é
    manter o `forbid` no item e tirar a operação da suíte de conformidade, trocando uma linha de
    schema por cobertura de FR-210/211 na rota nova.
    """

    subject_kind: SubjectKind
    subject_id: uuid.UUID
    observed_price: Decimal
    model_version: str
    catalog_version: str | None = None

    @model_validator(mode="before")
    @classmethod
    def _reject_unknown_keys(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        raw = cast("dict[str, Any]", data)
        known = {"subjectKind", "subjectId", "observedPrice", "modelVersion", "catalogVersion"}
        known |= set(cls.model_fields)
        unknown = sorted(str(key) for key in raw if key not in known)
        if unknown:
            raise ValueError(
                f"unknown field(s) {', '.join(unknown)} — `observedAt` is stamped by the "
                "server and `ownerUid` comes from the token, never from the body"
            )
        return raw

    @field_validator("observed_price")
    @classmethod
    def _price(cls, v: Decimal) -> Decimal:
        finite_non_negative(v, "observedPrice", CEIL_MONEY)
        # `finite_non_negative` já barrou NaN/Infinity, então `money_scale_ok` é seguro aqui.
        if not money_scale_ok(v):
            raise ValueError("observedPrice must have at most 2 decimal places")
        return v

    @field_validator("model_version")
    @classmethod
    def _model_version(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("modelVersion must not be blank")
        return v.strip()


class PriceObservationsPutIn(CamelModel):
    model_config = ConfigDict(extra="forbid")

    items: list[PriceObservationIn] = Field(max_length=MAX_BATCH_ITEMS)

    @model_validator(mode="after")
    def _one_row_per_subject(self) -> PriceObservationsPutIn:
        seen = {(i.subject_kind, i.subject_id) for i in self.items}
        if len(seen) != len(self.items):
            raise ValueError("each (subjectKind, subjectId) may appear only once in a batch")
        return self


class PriceObservationOut(CamelModel):
    subject_kind: SubjectKind
    subject_id: uuid.UUID
    observed_price: Decimal
    observed_at: datetime
    model_version: str
    catalog_version: str | None


class PriceObservationsOut(CamelModel):
    items: list[PriceObservationOut]


class PriceObservationsPutOut(CamelModel):
    upserted: int


@router.get("/price-observations", responses=ENTITLEMENT_ERRORS)
async def list_price_observations(
    claims: Annotated[Claims, Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PriceObservationsOut:
    """As observações da conta — contexto para o "era R$ …", nunca fonte do valor exibido."""
    rows = (
        await session.execute(
            select(PriceObservation)
            .where(PriceObservation.owner_uid == claims.uid)
            .order_by(PriceObservation.subject_id)
        )
    ).scalars()
    return PriceObservationsOut(
        items=[
            PriceObservationOut(
                subject_kind=_kind_of(row),
                subject_id=row.subject_id,
                observed_price=row.observed_price,
                observed_at=row.observed_at,
                model_version=row.model_version,
                catalog_version=row.catalog_version,
            )
            for row in rows
        ]
    )


def _kind_of(row: PriceObservation) -> SubjectKind:
    # A coluna é TEXT + CHECK (não há enum no schema); o CHECK garante o par, e este estreitamento
    # existe só para o tipo — um valor fora dele seria uma linha que o banco não deixou entrar.
    return "KIT" if row.subject_kind == "KIT" else "PRODUCT"


@router.put("/price-observations", responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS})
async def put_price_observations(
    body: PriceObservationsPutIn,
    claims: Annotated[Claims, Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PriceObservationsPutOut:
    """Grava o lote, idempotente por `(subjectKind, subjectId)` — uma linha por item da conta."""
    if not body.items:
        return PriceObservationsPutOut(upserted=0)

    now = datetime.now(UTC)
    stmt = pg_insert(PriceObservation).values(
        [
            {
                "owner_uid": claims.uid,  # SÓ do token — o corpo nunca escolhe a conta
                "subject_kind": item.subject_kind,
                "subject_id": item.subject_id,
                "observed_price": item.observed_price,
                "observed_at": now,
                "model_version": item.model_version,
                "catalog_version": item.catalog_version,
            }
            for item in body.items
        ]
    )
    stmt = stmt.on_conflict_do_update(
        constraint="uq_price_observations_subject",
        set_={
            "observed_price": stmt.excluded.observed_price,
            "observed_at": stmt.excluded.observed_at,
            "model_version": stmt.excluded.model_version,
            "catalog_version": stmt.excluded.catalog_version,
            "updated_at": now,
        },
    )
    await session.execute(stmt)
    await session.commit()
    return PriceObservationsPutOut(upserted=len(body.items))
