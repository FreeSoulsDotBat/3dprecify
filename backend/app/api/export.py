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
from sqlalchemy.orm import load_only

# The ownership predicate is IMPORTED, not copied (review PR-C): it IS the cross-account isolation
# invariant (FR-511/SC-509), and history.py carries the comment explaining why the answer must be
# identical for a nonexistent, a deleted and someone else's id — so the API is never an existence
# oracle. Two copies could drift, and what would drift is that invariant. `app.api` is a single
# import-linter layer and `boms.py` already imports from `products.py`: reuse is the direction.
# (It is `owned_snapshot`, not the `_owned` of the sibling routers, because a shared helper has no
# business being private — basedpyright is right to refuse the cross-module reach into a `_` name.)
from app.api.history import owned_snapshot
from app.db import get_session
from app.entitlement import require_entitlement
from app.errors import ENTITLEMENT_ERRORS, NOT_FOUND_ERRORS
from app.models import Snapshot
from app.services.quote_render import build_history_csv, build_quote_view, render_quote_pdf

router = APIRouter(tags=["history"])

# These routes answer with BYTES, not JSON, and the contract has to say so — otherwise Orval types
# the success `data: void` and the transport's Blob is a lie the client never hears about (review
# PR-C). The schema is not decoration either: with a bare `{"text/csv": {}}` the generator has
# nothing to map and drops the success type entirely, while `format: "binary"` is the OpenAPI idiom
# for a file and is what makes the generated `data: Blob` TRUE of what `request()` returns.
_FILE = {"schema": {"type": "string", "format": "binary"}}


@router.get(
    "/history/export.csv",
    responses={**ENTITLEMENT_ERRORS, 200: {"content": {"text/csv": _FILE}}},
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
                # The ledger is UNBOUNDED (which is why the list is keyset-paginated, A29) and the
                # frozen `payload` is a KB-scale JSONB per row — a kit carries one input+breakdown
                # per piece. The CSV reads six scalars and never touches the document, so loading it
                # pulled the whole ledger's payloads into memory to print nothing from them (review
                # PR-C). `load_only` also states in code what the docstring already promised.
                .options(
                    load_only(
                        Snapshot.label,
                        Snapshot.kind,
                        Snapshot.device_quoted_at,
                        Snapshot.device_utc_offset_minutes,
                        Snapshot.headline_basis,
                        Snapshot.headline_total,
                    )
                )
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
    responses={
        **ENTITLEMENT_ERRORS,
        **NOT_FOUND_ERRORS,
        200: {"content": {"application/pdf": _FILE}},
    },
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
    row = await owned_snapshot(session, claims["uid"], snapshot_id)
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
