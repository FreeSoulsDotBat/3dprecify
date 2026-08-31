"""US4 (FR-305/306/307) — printers CRUD. Mirrors filaments (see that module's docstring):
camelCase wire with Decimal-string money, owner-scoped queries (FR-307), soft-delete (D6),
malformed id → 404, reads via ``require_catalog_read`` / writes via ``require_entitlement``.
``machineLifetimeHours`` is strictly > 0 (the E1 denominator rule).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.lib.name_norm import name_norm_key
from app.models import Printer, Product
from app.validation import CEIL_HOURS, CEIL_KW, CEIL_MONEY, CEIL_RATE, finite_non_negative

router = APIRouter(tags=["printers"])

#: 019/PR-D (ADR-0033 §4) — o índice único parcial desta tabela; só ELE dispara o retry de sufixo.
_NAME_INDEX = "uq_printers_owner_name_norm"


class PrinterIn(CamelModel):
    # 019/PR-D (T072): teto de nome só no pydantic (ADR-0033 §Adendo 27/08 §3).
    name: str = Field(max_length=NAME_MAX_CHARS)
    machine_value: Decimal
    machine_lifetime_hours: Decimal
    avg_power_kw: Decimal
    maintenance_reserve_per_hour: Decimal = Decimal("0")

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()

    @field_validator("machine_value")
    @classmethod
    def _value(cls, v: Decimal) -> Decimal:
        return finite_non_negative(v, "machineValue", CEIL_MONEY)

    @field_validator("machine_lifetime_hours")
    @classmethod
    def _lifetime(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0 or v >= CEIL_HOURS:
            raise ValueError(
                "machineLifetimeHours must be a finite number > 0 within the storable range"
            )
        return v

    @field_validator("avg_power_kw")
    @classmethod
    def _power(cls, v: Decimal) -> Decimal:
        return finite_non_negative(v, "avgPowerKw", CEIL_KW)

    @field_validator("maintenance_reserve_per_hour")
    @classmethod
    def _maintenance(cls, v: Decimal) -> Decimal:
        return finite_non_negative(v, "maintenanceReservePerHour", CEIL_RATE)


class PrinterOut(CamelModel):
    id: uuid.UUID
    name: str
    machine_value: Decimal
    machine_lifetime_hours: Decimal
    avg_power_kw: Decimal
    maintenance_reserve_per_hour: Decimal
    created_at: datetime
    updated_at: datetime


def _printer_to_out(row: Printer) -> PrinterOut:
    return PrinterOut(
        id=row.id,
        name=row.name,
        machine_value=row.machine_value,
        machine_lifetime_hours=row.machine_lifetime_hours,
        avg_power_kw=row.avg_power_kw,
        maintenance_reserve_per_hour=row.maintenance_reserve_per_hour,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _apply(row: Printer, body: PrinterIn) -> None:
    """Corpo → linha (019/PR-D · T072): o FUNIL de escrita, chamado de dentro do savepoint —
    o nome FINAL (com sufixo, se houver conflito) quem escreve é `flush_with_unique_name`."""
    row.name = body.name
    row.name_norm = name_norm_key(body.name)
    row.machine_value = body.machine_value
    row.machine_lifetime_hours = body.machine_lifetime_hours
    row.avg_power_kw = body.avg_power_kw
    row.maintenance_reserve_per_hour = body.maintenance_reserve_per_hour


def _printer_not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Printer not found", status_code=404)


async def _owned_printer(session: AsyncSession, uid: str, printer_id: str) -> Printer:
    try:
        pid = uuid.UUID(printer_id)
    except ValueError as exc:
        raise _printer_not_found() from exc
    row = (
        await session.execute(
            select(Printer).where(
                Printer.id == pid,
                Printer.owner_uid == uid,
                Printer.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _printer_not_found()
    return row


@router.get("/printers", responses=ENTITLEMENT_ERRORS)
async def list_printers(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[PrinterOut]:
    rows = (
        await session.execute(
            select(Printer)
            .where(Printer.owner_uid == claims["uid"], Printer.deleted_at.is_(None))
            .order_by(Printer.created_at)
        )
    ).scalars()
    return [_printer_to_out(r) for r in rows]


@router.post(
    "/printers",
    status_code=status.HTTP_201_CREATED,
    responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS},
)
async def create_printer(
    body: PrinterIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PrinterOut:
    row = Printer(owner_uid=claims["uid"])
    await flush_with_unique_name(
        session, row, body.name, index_name=_NAME_INDEX, apply=lambda: _apply(row, body)
    )
    await session.commit()
    await session.refresh(row)
    return _printer_to_out(row)


@router.get("/printers/{printer_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_printer(
    printer_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PrinterOut:
    return _printer_to_out(await _owned_printer(session, claims["uid"], printer_id))


@router.put(
    "/printers/{printer_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def update_printer(
    printer_id: str,
    body: PrinterIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PrinterOut:
    row = await _owned_printer(session, claims["uid"], printer_id)
    await flush_with_unique_name(
        session, row, body.name, index_name=_NAME_INDEX, apply=lambda: _apply(row, body)
    )
    await session.commit()
    await session.refresh(row)
    return _printer_to_out(row)


@router.delete(
    "/printers/{printer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def delete_printer(
    printer_id: str,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    row = await _owned_printer(session, claims["uid"], printer_id)
    # D6/US6-4: the SAME txn writes last-known values into every referencing product and
    # unlinks it — the link-or-snapshot CHECK stays satisfied, the product never goes blank.
    await session.execute(
        update(Product)
        .where(Product.printer_id == row.id)
        .values(
            printer_id=None,
            printer_machine_value=row.machine_value,
            printer_machine_lifetime_hours=row.machine_lifetime_hours,
            printer_avg_power_kw=row.avg_power_kw,
            printer_maintenance_reserve_per_hour=row.maintenance_reserve_per_hour,
        )
    )
    row.deleted_at = datetime.now(UTC)  # soft-delete (D6)
    await session.commit()
