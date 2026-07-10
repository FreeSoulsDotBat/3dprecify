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
from pydantic import Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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

router = APIRouter(tags=["products"])


def _finite_non_negative(value: Decimal, field: str) -> Decimal:
    if not value.is_finite() or value < 0:
        raise ValueError(f"{field} must be a finite number >= 0")
    return value


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
        return _finite_non_negative(v, "channel money field")


class OtherCost(CamelModel):
    """One itemized sub-cost (§2.5.2) — blank name allowed (generic label, FR-116)."""

    name: str = ""
    value: Decimal

    @field_validator("value")
    @classmethod
    def _value(cls, v: Decimal) -> Decimal:
        return _finite_non_negative(v, "value")


class PieceInputs(CamelModel):
    """The product-owned E1 piece fields (data-model §2.5)."""

    print_grams: Decimal
    waste_grams: Decimal = Decimal("0")
    print_time_hours: Decimal
    failure_pct: Decimal = Decimal("0")
    finish_time_hours: Decimal = Decimal("0")
    finish_rate_per_hour: Decimal = Decimal("0")
    labor_hours: Decimal = Decimal("0")
    labor_rate_per_hour: Decimal = Decimal("0")
    markup_varejo_pct: Decimal
    markup_atacado_pct: Decimal

    @field_validator("*")
    @classmethod
    def _all_finite_non_negative(cls, v: Decimal) -> Decimal:
        return _finite_non_negative(v, "piece input")


class FilamentValues(CamelModel):
    """Resolved filament fields — live cache while linked, editable override when degraded."""

    material: str | None = None
    cost_per_roll: Decimal
    roll_weight_kg: Decimal

    @field_validator("cost_per_roll")
    @classmethod
    def _cost(cls, v: Decimal) -> Decimal:
        return _finite_non_negative(v, "costPerRoll")

    @field_validator("roll_weight_kg")
    @classmethod
    def _roll(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0:
            raise ValueError("rollWeightKg must be a finite number > 0")
        return v


class PrinterValues(CamelModel):
    """Resolved printer fields — live cache while linked, editable override when degraded."""

    machine_value: Decimal
    machine_lifetime_hours: Decimal
    avg_power_kw: Decimal
    maintenance_reserve_per_hour: Decimal = Decimal("0")

    @field_validator("machine_value", "avg_power_kw", "maintenance_reserve_per_hour")
    @classmethod
    def _non_negative(cls, v: Decimal) -> Decimal:
        return _finite_non_negative(v, "printer value")

    @field_validator("machine_lifetime_hours")
    @classmethod
    def _lifetime(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0:
            raise ValueError("machineLifetimeHours must be a finite number > 0")
        return v


class ProductIn(CamelModel):
    name: str
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
        return _finite_non_negative(v, "tariffPerKwh")

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
    created_at: datetime
    updated_at: datetime


def _to_out(row: Product, filament: Filament | None, printer: Printer | None) -> ProductOut:
    """Serialize with the D3 resolution rule: linked ⇒ the LIVE row wins; degraded ⇒ columns."""
    if filament is not None:
        filament_values = FilamentValues(
            material=filament.material,
            cost_per_roll=filament.cost_per_roll,
            roll_weight_kg=filament.roll_weight_kg,
        )
    else:
        filament_values = FilamentValues(
            material=row.filament_material,
            cost_per_roll=row.filament_cost_per_roll or Decimal("0"),
            roll_weight_kg=row.filament_roll_weight_kg or Decimal("1"),
        )
    if printer is not None:
        printer_values = PrinterValues(
            machine_value=printer.machine_value,
            machine_lifetime_hours=printer.machine_lifetime_hours,
            avg_power_kw=printer.avg_power_kw,
            maintenance_reserve_per_hour=printer.maintenance_reserve_per_hour,
        )
    else:
        printer_values = PrinterValues(
            machine_value=row.printer_machine_value or Decimal("0"),
            machine_lifetime_hours=row.printer_machine_lifetime_hours or Decimal("1"),
            avg_power_kw=row.printer_avg_power_kw or Decimal("0"),
            maintenance_reserve_per_hour=row.printer_maintenance_reserve_per_hour or Decimal("0"),
        )
    return ProductOut(
        id=row.id,
        name=row.name,
        filament_id=row.filament_id,
        printer_id=row.printer_id,
        filament_values=filament_values,
        printer_values=printer_values,
        piece_inputs=PieceInputs(
            print_grams=row.print_grams,
            waste_grams=row.waste_grams,
            print_time_hours=row.print_time_hours,
            failure_pct=row.failure_pct,
            finish_time_hours=row.finish_time_hours,
            finish_rate_per_hour=row.finish_rate_per_hour,
            labor_hours=row.labor_hours,
            labor_rate_per_hour=row.labor_rate_per_hour,
            markup_varejo_pct=row.markup_varejo_pct,
            markup_atacado_pct=row.markup_atacado_pct,
        ),
        tariff_per_kwh=row.tariff_per_kwh,
        include_marketplace=row.include_marketplace,
        channels=row.channels,
        other_costs=row.other_costs,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


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


def _apply(
    row: Product, body: ProductIn, filament: Filament | None, printer: Printer | None
) -> None:
    """Write body → row. Linked refs re-snapshot from the LIVE row (D3 write rule (a));
    degraded refs persist the submitted editable overrides (US6-4)."""
    row.name = body.name
    piece = body.piece_inputs
    row.print_grams = piece.print_grams
    row.waste_grams = piece.waste_grams
    row.print_time_hours = piece.print_time_hours
    row.failure_pct = piece.failure_pct
    row.finish_time_hours = piece.finish_time_hours
    row.finish_rate_per_hour = piece.finish_rate_per_hour
    row.labor_hours = piece.labor_hours
    row.labor_rate_per_hour = piece.labor_rate_per_hour
    row.markup_varejo_pct = piece.markup_varejo_pct
    row.markup_atacado_pct = piece.markup_atacado_pct
    row.tariff_per_kwh = body.tariff_per_kwh
    row.include_marketplace = body.include_marketplace
    # JSON mode dumps Decimal as string — money never becomes a JSON float (ADR-0008).
    row.channels = [c.model_dump(mode="json", by_alias=True) for c in body.channels]
    row.other_costs = [c.model_dump(mode="json", by_alias=True) for c in body.other_costs]

    if filament is not None:
        row.filament_id = filament.id
        row.filament_material = filament.material
        row.filament_cost_per_roll = filament.cost_per_roll
        row.filament_roll_weight_kg = filament.roll_weight_kg
    else:
        values = body.filament_values
        if values is None:  # unreachable — enforced by the link-or-snapshot model validator
            raise _unresolvable("filamentId")
        row.filament_id = None
        row.filament_material = values.material
        row.filament_cost_per_roll = values.cost_per_roll
        row.filament_roll_weight_kg = values.roll_weight_kg

    if printer is not None:
        row.printer_id = printer.id
        row.printer_machine_value = printer.machine_value
        row.printer_machine_lifetime_hours = printer.machine_lifetime_hours
        row.printer_avg_power_kw = printer.avg_power_kw
        row.printer_maintenance_reserve_per_hour = printer.maintenance_reserve_per_hour
    else:
        pvalues = body.printer_values
        if pvalues is None:  # unreachable — enforced by the link-or-snapshot model validator
            raise _unresolvable("printerId")
        row.printer_id = None
        row.printer_machine_value = pvalues.machine_value
        row.printer_machine_lifetime_hours = pvalues.machine_lifetime_hours
        row.printer_avg_power_kw = pvalues.avg_power_kw
        row.printer_maintenance_reserve_per_hour = pvalues.maintenance_reserve_per_hour


async def _resolve_links(
    session: AsyncSession, uid: str, body: ProductIn
) -> tuple[Filament | None, Printer | None]:
    filament = await _resolve_filament(session, uid, body.filament_id) if body.filament_id else None
    printer = await _resolve_printer(session, uid, body.printer_id) if body.printer_id else None
    return filament, printer


async def _live_links(
    session: AsyncSession, rows: list[Product]
) -> tuple[dict[uuid.UUID, Filament], dict[uuid.UUID, Printer]]:
    """Load the live rows the products link to (deleted links degrade in the delete txn, so a
    present link points at a live row; missing rows simply fall back to the columns)."""
    fil_ids = {r.filament_id for r in rows if r.filament_id is not None}
    prn_ids = {r.printer_id for r in rows if r.printer_id is not None}
    filaments: dict[uuid.UUID, Filament] = {}
    printers: dict[uuid.UUID, Printer] = {}
    if fil_ids:
        for f in (
            await session.execute(select(Filament).where(Filament.id.in_(fil_ids)))
        ).scalars():
            filaments[f.id] = f
    if prn_ids:
        for p in (await session.execute(select(Printer).where(Printer.id.in_(prn_ids)))).scalars():
            printers[p.id] = p
    return filaments, printers


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
    filaments, printers = await _live_links(session, rows)
    return [
        _to_out(
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
    _apply(row, body, filament, printer)
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_out(row, filament, printer)


@router.get("/products/{product_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_product(
    product_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ProductOut:
    row = await _owned(session, claims["uid"], product_id)
    filaments, printers = await _live_links(session, [row])
    return _to_out(
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
    _apply(row, body, filament, printer)
    await session.commit()
    await session.refresh(row)
    return _to_out(row, filament, printer)


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
