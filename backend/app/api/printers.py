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
from pydantic import field_validator
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
from app.models import Printer

router = APIRouter(tags=["printers"])


def _finite_non_negative(value: Decimal, field: str) -> Decimal:
    if not value.is_finite() or value < 0:
        raise ValueError(f"{field} must be a finite number >= 0")
    return value


class PrinterIn(CamelModel):
    name: str
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
        return _finite_non_negative(v, "machineValue")

    @field_validator("machine_lifetime_hours")
    @classmethod
    def _lifetime(cls, v: Decimal) -> Decimal:
        if not v.is_finite() or v <= 0:
            raise ValueError("machineLifetimeHours must be a finite number > 0")
        return v

    @field_validator("avg_power_kw")
    @classmethod
    def _power(cls, v: Decimal) -> Decimal:
        return _finite_non_negative(v, "avgPowerKw")

    @field_validator("maintenance_reserve_per_hour")
    @classmethod
    def _maintenance(cls, v: Decimal) -> Decimal:
        return _finite_non_negative(v, "maintenanceReservePerHour")


class PrinterOut(CamelModel):
    id: uuid.UUID
    name: str
    machine_value: Decimal
    machine_lifetime_hours: Decimal
    avg_power_kw: Decimal
    maintenance_reserve_per_hour: Decimal
    created_at: datetime
    updated_at: datetime


def _to_out(row: Printer) -> PrinterOut:
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


def _not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Printer not found", status_code=404)


async def _owned(session: AsyncSession, uid: str, printer_id: str) -> Printer:
    try:
        pid = uuid.UUID(printer_id)
    except ValueError as exc:
        raise _not_found() from exc
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
        raise _not_found()
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
    return [_to_out(r) for r in rows]


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
    row = Printer(
        owner_uid=claims["uid"],
        name=body.name,
        machine_value=body.machine_value,
        machine_lifetime_hours=body.machine_lifetime_hours,
        avg_power_kw=body.avg_power_kw,
        maintenance_reserve_per_hour=body.maintenance_reserve_per_hour,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_out(row)


@router.get("/printers/{printer_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_printer(
    printer_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> PrinterOut:
    return _to_out(await _owned(session, claims["uid"], printer_id))


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
    row = await _owned(session, claims["uid"], printer_id)
    row.name = body.name
    row.machine_value = body.machine_value
    row.machine_lifetime_hours = body.machine_lifetime_hours
    row.avg_power_kw = body.avg_power_kw
    row.maintenance_reserve_per_hour = body.maintenance_reserve_per_hour
    await session.commit()
    await session.refresh(row)
    return _to_out(row)


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
    row = await _owned(session, claims["uid"], printer_id)
    row.deleted_at = datetime.now(UTC)  # soft-delete (D6)
    await session.commit()
