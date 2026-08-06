"""US3 (FR-305/306/307) — filaments CRUD.

Wire: camelCase, money/quantities as DECIMAL STRINGS (contracts/api-surface.md — JSON number
precision is never trusted for money). Validation mirrors the calculator rules (FR-306):
finite, ≥ 0, roll weight strictly > 0, name non-blank — a bad entry is NEVER stored.
Authorization: reads via ``require_catalog_read`` (active|lapsed — Q3 freeze), writes via
``require_entitlement`` (active only). Every query is OWNER-SCOPED (FR-307): another
account's row answers 404 — existence is never leaked. Voluntary deletion is a soft-delete
(D6); a malformed id answers 404 (no such resource), keeping reads free of 422.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any

from fastapi import APIRouter, Depends, status
from pydantic import ConfigDict, field_validator, model_validator
from sqlalchemy import select, update
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
from app.models import Filament, Product
from app.validation import CEIL_KG, CEIL_MONEY, finite_non_negative

router = APIRouter(tags=["filaments"])

# 016/US10 (ADR-0026): `defaultWasteGrams` was REMOVED from pricing-core in 4.0.0 — a client that
# still sends it is NOT silently ignored (Pydantic's default `extra="ignore"` would let a seller
# save believing the discard entered the price and see a different number, the exact silent lie
# this increment exists to kill). `extra="forbid"` below is the blanket safety net for ANY unknown
# field; this pre-validator exists so the retired field gets a message that NAMES it and the model
# change, rather than Pydantic's generic "Extra inputs are not permitted".
_RETIRED_WASTE_FIELD = "defaultWasteGrams"


class FilamentIn(CamelModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    material: str | None = None
    cost_per_roll: Decimal
    roll_weight_kg: Decimal

    @model_validator(mode="before")
    @classmethod
    def _reject_retired_waste_field(cls, data: Any) -> Any:
        raw = data
        if isinstance(raw, dict) and _RETIRED_WASTE_FIELD in raw:
            raise ValueError(
                f"{_RETIRED_WASTE_FIELD} was removed by pricing-core 4.0.0 (US10/ADR-0026): "
                "wasted material now folds into the printed grams, so this field is REJECTED, "
                "never silently ignored"
            )
        return data

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()

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


class FilamentOut(CamelModel):
    id: uuid.UUID
    name: str
    material: str | None = None
    cost_per_roll: Decimal
    roll_weight_kg: Decimal
    created_at: datetime
    updated_at: datetime


def _to_out(row: Filament) -> FilamentOut:
    return FilamentOut(
        id=row.id,
        name=row.name,
        material=row.material,
        cost_per_roll=row.cost_per_roll,
        roll_weight_kg=row.roll_weight_kg,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def _not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Filament not found", status_code=404)


async def _owned(session: AsyncSession, uid: str, filament_id: str) -> Filament:
    """Owner-scoped fetch (FR-307): wrong owner, soft-deleted or malformed id → 404."""
    try:
        fid = uuid.UUID(filament_id)
    except ValueError as exc:
        raise _not_found() from exc
    row = (
        await session.execute(
            select(Filament).where(
                Filament.id == fid,
                Filament.owner_uid == uid,
                Filament.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _not_found()
    return row


@router.get("/filaments", responses=ENTITLEMENT_ERRORS)
async def list_filaments(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[FilamentOut]:
    rows = (
        await session.execute(
            select(Filament)
            .where(Filament.owner_uid == claims["uid"], Filament.deleted_at.is_(None))
            .order_by(Filament.created_at)
        )
    ).scalars()
    return [_to_out(r) for r in rows]


@router.post(
    "/filaments",
    status_code=status.HTTP_201_CREATED,
    responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS},
)
async def create_filament(
    body: FilamentIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FilamentOut:
    row = Filament(
        owner_uid=claims["uid"],
        name=body.name,
        material=body.material,
        cost_per_roll=body.cost_per_roll,
        roll_weight_kg=body.roll_weight_kg,
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_out(row)


@router.get("/filaments/{filament_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_filament(
    filament_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FilamentOut:
    return _to_out(await _owned(session, claims["uid"], filament_id))


@router.put(
    "/filaments/{filament_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def update_filament(
    filament_id: str,
    body: FilamentIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> FilamentOut:
    row = await _owned(session, claims["uid"], filament_id)
    row.name = body.name
    row.material = body.material
    row.cost_per_roll = body.cost_per_roll
    row.roll_weight_kg = body.roll_weight_kg
    await session.commit()
    await session.refresh(row)
    return _to_out(row)


@router.delete(
    "/filaments/{filament_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def delete_filament(
    filament_id: str,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    row = await _owned(session, claims["uid"], filament_id)
    # D6/US6-4: the SAME txn writes last-known values into every referencing product and
    # unlinks it — the link-or-snapshot CHECK stays satisfied, the product never goes blank.
    await session.execute(
        update(Product)
        .where(Product.filament_id == row.id)
        .values(
            filament_id=None,
            filament_material=row.material,
            filament_cost_per_roll=row.cost_per_roll,
            filament_roll_weight_kg=row.roll_weight_kg,
        )
    )
    row.deleted_at = datetime.now(UTC)  # soft-delete (D6) — voluntary deletion only
    await session.commit()
