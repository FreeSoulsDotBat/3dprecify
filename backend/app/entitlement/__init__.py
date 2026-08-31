"""Entitlement seam (E2, ADR-0012): the server-authoritative premium check.

Two FastAPI dependencies gate every catalog route (US1-4 audits this):
- ``require_entitlement`` — WRITE gate, binary: only an ACTIVE grant passes.
- ``require_catalog_read`` — READ gate: active OR lapsed (Q3 read-only freeze — a seller who
  ever had a grant keeps reading/pre-filling); never-granted accounts see nothing.

Truth lives in the append-only ``entitlement_grants`` ledger (app.models):
``active = EXISTS grant(not revoked AND (expiry null OR now < expiry))``. Both gates
JIT-provision the ``accounts`` row from the verified claims (D1) and deny with the wire code
``ENTITLEMENT_REQUIRED`` (403). The client is NEVER consulted (Constitution IV). Grants are
written only by the operator CLI (T013) — no HTTP grant route exists.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated, Literal

import structlog
from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Claims, current_claims
from app.db import get_session
from app.errors import AppError, ErrorCode
from app.models import Account, EntitlementGrant

log = structlog.get_logger(__name__)

EntitlementStatus = Literal["none", "active", "lapsed"]


@dataclass(frozen=True)
class EntitlementState:
    """The account's current premium state, derived live from the ledger (never cached)."""

    status: EntitlementStatus
    source: str | None = None
    expires_at: datetime | None = None


async def ensure_account(session: AsyncSession, uid: str, email: str | None) -> None:
    """JIT-provision the account row from verified claims (D1); refresh email/last_seen."""
    now = datetime.now(UTC)
    stmt = pg_insert(Account).values(account_uid=uid, email=email, last_seen_at=now)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Account.account_uid],
        set_={"email": stmt.excluded.email, "last_seen_at": now},
    )
    await session.execute(stmt)
    await session.commit()


async def read_entitlement_state(session: AsyncSession, uid: str) -> EntitlementState:
    """Derive none/active/lapsed from the ledger — expiry evaluated NOW (ADR-0012/Q3)."""
    result = await session.execute(
        select(EntitlementGrant).where(EntitlementGrant.account_uid == uid)
    )
    grants = list(result.scalars())
    if not grants:
        return EntitlementState(status="none")
    now = datetime.now(UTC)
    active = [
        g for g in grants if g.revoked_at is None and (g.expires_at is None or g.expires_at > now)
    ]
    if not active:
        return EntitlementState(status="lapsed")
    # 015/A3 ([F04a-001]) — a ORIGEM vem do grant mais recente (é ela que diz POR QUE o premium
    # está ativo agora), mas a DATA é a mais DISTANTE entre os ativos. Antes as duas saíam do mesmo
    # grant, e uma cortesia curta concedida por cima de uma assinatura anual fazia a tela anunciar
    # o fim do premium para uma data em que ele ainda estaria valendo.
    newest = max(active, key=lambda g: g.granted_at)
    # `expires_at IS NULL` é "sem prazo" — e sem prazo é mais distante que qualquer data, então
    # basta UM grant ilimitado ativo para que não haja data de fim a anunciar.
    expires_at = (
        None
        if any(g.expires_at is None for g in active)
        else max(g.expires_at for g in active if g.expires_at is not None)
    )
    return EntitlementState(status="active", source=newest.source, expires_at=expires_at)


def _deny() -> AppError:
    return AppError(
        ErrorCode.ENTITLEMENT_REQUIRED,
        "Persistence requires an active premium grant",
        status_code=403,
    )


async def require_entitlement(
    claims: Annotated[Claims, Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Claims:
    """WRITE gate: only an ACTIVE grant passes (binary — FR-301 precision)."""
    await ensure_account(session, claims.uid, claims.email)
    state = await read_entitlement_state(session, claims.uid)
    if state.status != "active":
        # Onda 7: sem `uid` (não logado hoje em nenhum ponto do repo — ver `app/observability.py`)
        # — o status derivado já diz o motivo, e é o mesmo dado que o 403 devolve.
        log.info("entitlement_denied", gate="write", status=state.status)
        raise _deny()
    return claims


async def require_catalog_read(
    claims: Annotated[Claims, Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> Claims:
    """READ gate: active OR lapsed (Q3 freeze keeps reads); never-granted is denied."""
    await ensure_account(session, claims.uid, claims.email)
    state = await read_entitlement_state(session, claims.uid)
    if state.status == "none":
        log.info("entitlement_denied", gate="read", status=state.status)
        raise _deny()
    return claims
