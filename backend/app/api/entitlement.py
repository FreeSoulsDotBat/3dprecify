"""US2/T014 — GET /api/v1/entitlement (FR-304, ADR-0012 sub-decision R1b).

Tells an authenticated account its OWN plan state so the Conta page is honest. Unlike the
catalog gates this never denies with 403 — "none" is a valid answer — and the grantor is
never exposed. Statuses published: 200 + 401 (contracts/api-surface.md).
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import current_claims
from app.db import get_session
from app.entitlement import EntitlementStatus, ensure_account, read_entitlement_state
from app.errors import AUTH_ERRORS, CamelModel

router = APIRouter(tags=["entitlement"])


class EntitlementView(CamelModel):
    status: EntitlementStatus
    source: str | None = None
    expires_at: datetime | None = None  # serialized as ``expiresAt``


@router.get("/entitlement", responses=AUTH_ERRORS, response_model_exclude_none=True)
async def get_entitlement(
    claims: Annotated[dict[str, Any], Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> EntitlementView:
    uid: str = claims["uid"]
    await ensure_account(session, uid, claims.get("email"))
    state = await read_entitlement_state(session, uid)
    return EntitlementView(status=state.status, source=state.source, expires_at=state.expires_at)
