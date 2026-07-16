"""US4 (FR-512..516, ADR-0020) — export a snapshot as a customer quote (PDF) + the history (CSV).

The gate is REAL because the SERVER renders: both routes sit behind ``require_entitlement`` (ACTIVE
only), so "denied on lapse, no partial artifact" (FR-515) and "no free export" (FR-516) hold BY
CONSTRUCTION — a lapsed/free caller never reaches the renderer, and the response carries no bytes.

The routes read a STORED row and hand it to `quote_render`, which prints it verbatim. No recompute
(ADR-0008 stands): a document renderer forks nothing. A **pending** snapshot has no server row, so
it is simply not found here (404) — you cannot export a record the record-keeper has never seen.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.entitlement import require_entitlement
from app.errors import ENTITLEMENT_ERRORS, NOT_FOUND_ERRORS, AppError, ErrorCode
from app.models import Snapshot
from app.services.quote_render import build_history_csv, build_quote_view, render_quote_pdf

router = APIRouter(tags=["history"])


def _not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Snapshot not found", status_code=404)


async def _owned(session: AsyncSession, uid: str, snapshot_id: uuid.UUID) -> Snapshot:
    """The caller's own, non-deleted snapshot — or a 404 (never another account's row)."""
    row = (
        await session.execute(
            select(Snapshot).where(
                Snapshot.id == snapshot_id,
                Snapshot.owner_uid == uid,
                Snapshot.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _not_found()
    return row


@router.get(
    "/history/export.csv",
    responses={**ENTITLEMENT_ERRORS},
    response_class=Response,
)
async def export_history_csv(
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Response:
    """The whole ledger as a data file whose rows equal the stored snapshots exactly (FR-513)."""
    rows = list(
        (
            await session.execute(
                select(Snapshot)
                .where(Snapshot.owner_uid == claims["uid"], Snapshot.deleted_at.is_(None))
                .order_by(Snapshot.device_quoted_at.desc(), Snapshot.id.desc())
            )
        ).scalars()
    )
    return Response(
        content=build_history_csv(rows),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="historico.csv"'},
    )


@router.get(
    "/history/{snapshot_id}/quote.pdf",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
    response_class=Response,
)
async def export_quote_pdf(
    snapshot_id: uuid.UUID,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
    include_cost_breakdown: Annotated[bool, Query(alias="includeCostBreakdown")] = False,
) -> Response:
    """A customer-facing PDF quote for ONE snapshot. Zero internal cost lines unless the seller opts
    in (SC-506); seller identity from the verified ID-token claims (FR-514 / Q13)."""
    row = await _owned(session, claims["uid"], snapshot_id)
    quote = build_quote_view(
        row,
        seller_name=claims.get("name"),
        seller_email=claims.get("email"),
        include_cost_breakdown=include_cost_breakdown,
    )
    return Response(
        content=render_quote_pdf(quote),
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="orcamento.pdf"'},
    )
