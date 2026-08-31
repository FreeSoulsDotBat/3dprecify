"""US6 (FR-310/311/313) — products CRUD, live-recomputed on the client.

Wire: camelCase, money/quantities as DECIMAL STRINGS; the payload carries INPUTS ONLY — no
price is ever stored or served (FR-310/FR-313; the backend never computes prices). Reference
semantics per data-model D3: ``filamentId``/``printerId`` present ⇒ the LIVE row is
authoritative (``filamentValues``/``printerValues`` are served from it and re-snapshotted on
every write); NULL (delete-degradation, D6) ⇒ the resolved columns are the authoritative,
EDITABLE source. At create both links are required (FR-310 — a product references SAVED
items); a reference that does not resolve to an OWNED live row is a 422 whether it is
nonexistent or another tenant's (no existence oracle, SC-308). ``channels[]``/``otherCosts[]``
are pydantic-validated JSONB shapes (D4) mirroring the calculator's per-slot rules — money as
decimal strings, never JSON floats (ADR-0008).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, status
from pydantic import ConfigDict, Field, ValidationInfo, field_validator, model_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.catalog_resolver import apply_product, live_links, product_to_out
from app.api.naming import NAME_MAX_CHARS, flush_with_unique_name
from app.db import get_session
from app.entitlement import require_catalog_read, require_entitlement
from app.errors import (
    ENTITLEMENT_ERRORS,
    NOT_FOUND_ERRORS,
    VALIDATION_ERRORS,
    AppError,
    CamelModel,
    ErrorCode,
)
from app.models import Filament, Printer, Product
from app.validation import (
    CEIL_GRAMS,
    CEIL_HOURS,
    CEIL_KG,
    CEIL_KW,
    CEIL_MONEY,
    CEIL_PERCENT,
    CEIL_RATE,
    finite_non_negative,
)

router = APIRouter(tags=["products"])

#: 019/PR-D (ADR-0033 §4) — o índice único parcial que decide o conflito de nome desta tabela.
#: Nomeado aqui porque é ele que o retry de sufixo reconhece: qualquer OUTRA violação de
#: integridade continua subindo (um retry cego renomearia a linha por um erro que nada tem a ver
#: com nome, e o vendedor veria "(2)" sem motivo).
_NAME_INDEX = "uq_products_owner_name_norm"

# 016/US10 (ADR-0026): `wasteGrams` was REMOVED from pricing-core in 4.0.0 — see the identical
# rationale in `app/api/filaments.py::_RETIRED_WASTE_FIELD`.
_RETIRED_WASTE_FIELD = "wasteGrams"


# Piece-input fields fan out to different NUMERIC domains, so the "*" validator picks per field.
# The ceilings themselves live in `app.validation` (the shared financial leaf, audit Q-03).
_PIECE_CEILINGS: dict[str, Decimal] = {
    "print_grams": CEIL_GRAMS,
    "print_time_hours": CEIL_HOURS,
    "failure_pct": CEIL_PERCENT,
    "finish_time_hours": CEIL_HOURS,
    "finish_rate_per_hour": CEIL_RATE,
    "labor_hours": CEIL_HOURS,
    "labor_rate_per_hour": CEIL_RATE,
    "markup_varejo_pct": CEIL_PERCENT,
    "markup_atacado_pct": CEIL_PERCENT,
}


class ChannelSlot(CamelModel):
    """One marketplace slot — the same shape the calculator form validates (D4/§2.5.1).

    Every fee is NULLABLE on purpose: in the calculator a BLANK fee means "resolve from the
    live fee catalog", so persisting a fabricated 0 would dishonestly freeze today's fee.
    null round-trips back to a blank field on reopen; a present value validates as before.
    """

    marketplace: Literal["MERCADO_LIVRE", "SHOPEE", "AMAZON", "OUTRO"]
    modality: Literal["CLASSICO", "PREMIUM", "PROFISSIONAL", "INDIVIDUAL", ""] = ""
    commission_pct: Decimal | None = None
    fixed_fee: Decimal | None = None
    min_per_item: Decimal | None = None
    freight_cost: Decimal | None = None

    @field_validator("commission_pct")
    @classmethod
    def _commission(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        if not v.is_finite() or v < 0 or v >= 100:
            raise ValueError("commissionPct must be a finite number in [0, 100)")
        return v

    @field_validator("fixed_fee", "min_per_item", "freight_cost")
    @classmethod
    def _money(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        return finite_non_negative(v, "channel money field", CEIL_MONEY)


class OtherCost(CamelModel):
    """One itemized sub-cost (§2.5.2) — blank name allowed (generic label, FR-116)."""

    name: str = ""
    value: Decimal

    @field_validator("value")
    @classmethod
    def _value(cls, v: Decimal) -> Decimal:
        return finite_non_negative(v, "value", CEIL_MONEY)


class PieceInputs(CamelModel):
    """The product-owned E1 piece fields (data-model §2.5).

    ``wasteGrams`` was REMOVED by pricing-core 4.0.0 (ADR-0026, 016/US10) — ``extra="forbid"``
    rejects it explicitly (never silently ignores it) with a message naming the change.
    """

    model_config = ConfigDict(extra="forbid")

    print_grams: Decimal
    print_time_hours: Decimal
    failure_pct: Decimal = Decimal("0")
    finish_time_hours: Decimal = Decimal("0")
    finish_rate_per_hour: Decimal = Decimal("0")
    labor_hours: Decimal = Decimal("0")
    labor_rate_per_hour: Decimal = Decimal("0")
    markup_varejo_pct: Decimal
    markup_atacado_pct: Decimal

    @model_validator(mode="before")
    @classmethod
    def _reject_retired_waste_field(cls, data: Any) -> Any:
        raw = data
        if isinstance(raw, dict) and _RETIRED_WASTE_FIELD in raw:
            raise ValueError(
                f"{_RETIRED_WASTE_FIELD} was removed by pricing-core 4.0.0 (US10/ADR-0026): "
                "wasted material now folds into printGrams, so this field is REJECTED, never "
                "silently ignored"
            )
        return data

    @field_validator("*")
    @classmethod
    def _all_finite_non_negative(cls, v: Decimal, info: ValidationInfo) -> Decimal:
        field = info.field_name or "piece input"
        return finite_non_negative(v, field, _PIECE_CEILINGS.get(field, CEIL_RATE))


class FilamentValues(CamelModel):
    """Resolved filament fields — live cache while linked, editable override when degraded."""

    material: str | None = None
    cost_per_roll: Decimal
    roll_weight_kg: Decimal

    @field_validator("cost_per_roll")
    @classmethod
    def _cost(cls, v: Decimal) -> Decimal:
        return finite_non_negative(v, "costPerRoll", CEIL_MONEY)

    @field_validator("roll_weight_kg")
    @classmethod
    def _roll(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0 or v >= CEIL_KG:
            raise ValueError("rollWeightKg must be a finite number > 0 within the storable range")
        return v


class PrinterValues(CamelModel):
    """Resolved printer fields — live cache while linked, editable override when degraded."""

    machine_value: Decimal
    machine_lifetime_hours: Decimal
    avg_power_kw: Decimal
    maintenance_reserve_per_hour: Decimal = Decimal("0")

    @field_validator("machine_value", "avg_power_kw", "maintenance_reserve_per_hour")
    @classmethod
    def _non_negative(cls, v: Decimal, info: ValidationInfo) -> Decimal:
        ceilings = {
            "machine_value": CEIL_MONEY,
            "avg_power_kw": CEIL_KW,
            "maintenance_reserve_per_hour": CEIL_RATE,
        }
        field = info.field_name or "printer value"
        return finite_non_negative(v, field, ceilings.get(field, CEIL_RATE))

    @field_validator("machine_lifetime_hours")
    @classmethod
    def _lifetime(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0 or v >= CEIL_HOURS:
            raise ValueError(
                "machineLifetimeHours must be a finite number > 0 within the storable range"
            )
        return v


class ProductIn(CamelModel):
    # 019/PR-D (T072): teto só no pydantic — sem CHECK de comprimento no banco, que invalidaria
    # o legado (ADR-0033 §Adendo 27/08 §3). Precedente: `scenarios.py:84`.
    name: str = Field(max_length=NAME_MAX_CHARS)
    filament_id: uuid.UUID | None = None
    printer_id: uuid.UUID | None = None
    filament_values: FilamentValues | None = None
    printer_values: PrinterValues | None = None
    piece_inputs: PieceInputs
    tariff_per_kwh: Decimal
    include_marketplace: bool = True
    channels: list[ChannelSlot] = Field(default_factory=list)
    other_costs: list[OtherCost] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()

    @field_validator("tariff_per_kwh")
    @classmethod
    def _tariff(cls, v: Decimal) -> Decimal:
        return finite_non_negative(v, "tariffPerKwh", CEIL_RATE)

    @model_validator(mode="after")
    def _link_or_snapshot(self) -> ProductIn:
        # The API-level mirror of the DB CHECK — a blank product is unrepresentable.
        if self.filament_id is None and self.filament_values is None:
            raise ValueError("filamentId or filamentValues is required")
        if self.printer_id is None and self.printer_values is None:
            raise ValueError("printerId or printerValues is required")
        return self


class ProductOut(CamelModel):
    id: uuid.UUID
    name: str
    filament_id: uuid.UUID | None
    printer_id: uuid.UUID | None
    filament_values: FilamentValues
    printer_values: PrinterValues
    piece_inputs: PieceInputs
    tariff_per_kwh: Decimal
    include_marketplace: bool
    channels: list[dict[str, Any]]
    other_costs: list[dict[str, Any]]
    #: 019/PR-D (ADR-0033 §3) — o número do ANÚNCIO, **declarado** pelo vendedor, e a data em que
    #: ele o declarou. NÃO é preço calculado: o app nunca exibe um preço que ele mesmo calculou no
    #: passado, e este payload segue sem nenhum campo derivado de cálculo (drift-guard é a prova).
    #: `None` = acompanhando o custo. Não participa de kit, orçamento ou cenário — composição é
    #: sempre pelo motor, no cliente.
    seller_fixed_price: Decimal | None
    seller_fixed_at: datetime | None
    created_at: datetime
    updated_at: datetime


def _not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Product not found", status_code=404)


def _unresolvable(field: str) -> AppError:
    # Same 422 for nonexistent, soft-deleted and cross-tenant ids — no existence oracle.
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        f"{field} does not resolve to a saved item on this account",
        status_code=422,
    )


async def _owned(session: AsyncSession, uid: str, product_id: str) -> Product:
    """Owner-scoped fetch (FR-307): wrong owner, soft-deleted or malformed id → 404."""
    try:
        pid = uuid.UUID(product_id)
    except ValueError as exc:
        raise _not_found() from exc
    row = (
        await session.execute(
            select(Product).where(
                Product.id == pid,
                Product.owner_uid == uid,
                Product.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _not_found()
    return row


async def _resolve_filament(session: AsyncSession, uid: str, filament_id: uuid.UUID) -> Filament:
    row = (
        await session.execute(
            select(Filament).where(
                Filament.id == filament_id,
                Filament.owner_uid == uid,
                Filament.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _unresolvable("filamentId")
    return row


async def _resolve_printer(session: AsyncSession, uid: str, printer_id: uuid.UUID) -> Printer:
    row = (
        await session.execute(
            select(Printer).where(
                Printer.id == printer_id,
                Printer.owner_uid == uid,
                Printer.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _unresolvable("printerId")
    return row


async def _resolve_links(
    session: AsyncSession, uid: str, body: ProductIn
) -> tuple[Filament | None, Printer | None]:
    filament = await _resolve_filament(session, uid, body.filament_id) if body.filament_id else None
    printer = await _resolve_printer(session, uid, body.printer_id) if body.printer_id else None
    return filament, printer


@router.get("/products", responses=ENTITLEMENT_ERRORS)
async def list_products(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ProductOut]:
    rows = list(
        (
            await session.execute(
                select(Product)
                .where(Product.owner_uid == claims["uid"], Product.deleted_at.is_(None))
                .order_by(Product.created_at)
            )
        ).scalars()
    )
    filaments, printers = await live_links(session, claims["uid"], rows)
    return [
        product_to_out(
            r,
            filaments.get(r.filament_id) if r.filament_id else None,
            printers.get(r.printer_id) if r.printer_id else None,
        )
        for r in rows
    ]


@router.post(
    "/products",
    status_code=status.HTTP_201_CREATED,
    responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS},
)
async def create_product(
    body: ProductIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProductOut:
    # FR-310: at CREATE a product references saved items — both links are mandatory
    # (values-only products exist solely via the delete-degradation path).
    if body.filament_id is None:
        raise _unresolvable("filamentId")
    if body.printer_id is None:
        raise _unresolvable("printerId")
    filament, printer = await _resolve_links(session, claims["uid"], body)
    row = Product(owner_uid=claims["uid"])
    # A linha chega LIMPA ao helper: toda a escrita acontece dentro do savepoint
    # (`app/api/naming.py` explica por que isso não é estilo, é requisito).
    await flush_with_unique_name(
        session,
        row,
        body.name,
        index_name=_NAME_INDEX,
        apply=lambda: apply_product(row, body, filament, printer),
    )
    await session.commit()
    await session.refresh(row)
    return product_to_out(row, filament, printer)


@router.get("/products/{product_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_product(
    product_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProductOut:
    row = await _owned(session, claims["uid"], product_id)
    filaments, printers = await live_links(session, claims["uid"], [row])
    return product_to_out(
        row,
        filaments.get(row.filament_id) if row.filament_id else None,
        printers.get(row.printer_id) if row.printer_id else None,
    )


@router.put(
    "/products/{product_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def update_product(
    product_id: str,
    body: ProductIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProductOut:
    row = await _owned(session, claims["uid"], product_id)
    filament, printer = await _resolve_links(session, claims["uid"], body)
    await flush_with_unique_name(
        session,
        row,
        body.name,
        index_name=_NAME_INDEX,
        apply=lambda: apply_product(row, body, filament, printer),
    )
    await session.commit()
    await session.refresh(row)
    return product_to_out(row, filament, printer)


class ProductPatchIn(CamelModel):
    """Corpo do `PATCH` — UM campo, e ele é obrigatório (019/PR-D · T073 · ADR-0033 §3).

    `extra="forbid"` (que `CamelModel` não traz) para que um `price` contrabandeado seja um 422
    honesto, nunca um ignorar calado. O campo é obrigatório porque um `PATCH` de corpo vazio não
    tem intenção: fixar e desfixar são as duas escolhas, e `null` já é a segunda.
    `sellerFixedAt` **não existe aqui** — quem carimba a data é o servidor (o único carimbo de
    aparelho na casa é `device_quoted_at`, e o prefixo `device_` declara justamente que aquele o
    servidor não verifica).
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    seller_fixed_price: Decimal | None

    @field_validator("seller_fixed_price")
    @classmethod
    def _fixed_price(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return v
        finite_non_negative(v, "sellerFixedPrice", CEIL_MONEY)
        exponent = v.as_tuple().exponent
        # O número é do VENDEDOR: `MONEY_SETTLED` (Numeric(12,2)) arredondaria a 3ª casa em
        # silêncio, e arredondar o número dele é alterá-lo. 422 — a mesma regra de
        # `price-observations`.
        if not isinstance(exponent, int) or exponent < -2:
            raise ValueError("sellerFixedPrice must have at most 2 decimal places")
        return v


@router.patch(
    "/products/{product_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def fix_product_price(
    product_id: str,
    body: ProductPatchIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProductOut:
    """Fixa (ou desfixa) o preço declarado pelo vendedor; nada mais desta linha é tocado."""
    row = await _owned(session, claims["uid"], product_id)
    row.seller_fixed_price = body.seller_fixed_price
    # Desfixar zera a data junto: uma data de fixação sem fixação seria um fantasma na tela.
    row.seller_fixed_at = datetime.now(UTC) if body.seller_fixed_price is not None else None
    await session.commit()
    await session.refresh(row)
    filaments, printers = await live_links(session, claims["uid"], [row])
    return product_to_out(
        row,
        filaments.get(row.filament_id) if row.filament_id else None,
        printers.get(row.printer_id) if row.printer_id else None,
    )


@router.delete(
    "/products/{product_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def delete_product(
    product_id: str,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    row = await _owned(session, claims["uid"], product_id)
    row.deleted_at = datetime.now(UTC)  # soft-delete (D6) — voluntary deletion only
    await session.commit()
