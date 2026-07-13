"""US1/US2 (FR-501..529) — the Histórico: immutable price snapshots, server-authoritative.

THE TWO-SHELF RULE. `products`/`boms` are LIVE templates: they store inputs, never a price, and
they recompute on every read (ADR-0016/0017). A **snapshot is the opposite by nature**: it stores
the seller's recorded claim — inputs AND the rounded output lines AND the formula version AND the
device's timestamp — and it **never recomputes anything**. The server here is a scribe, not a
calculator: it writes the document down and reads it back verbatim.

Consequences that shape this module:

* **The only writer of frozen fields is `POST`.** There is deliberately **NO PUT**. `PATCH` accepts
  ``label`` and nothing else (``extra="forbid"``), so a smuggled value/date/version is a **422**,
  never a silent ignore — silently dropping it would be the worst outcome, since the caller would
  believe it had rewritten history (ADR-0019 §1).

* **`POST` is IDEMPOTENT** (ADR-0018 §3). The device mints ``clientSnapshotId`` at RECORD time and
  replays it on every retry; ``UNIQUE (owner_uid, client_snapshot_id)`` turns a retry into an
  idempotent SUCCESS — **200 with the row that already exists**, never a duplicate and never an
  error the outbox would misread as failure. *A lost response is not the same as not saved.*

* **The server holds NO queue state.** There is no ``pending``/``rejected`` column and none may be
  added: a row exists only once the server accepted it. A denied sync writes NOTHING (FR-529), and
  "pending" is 100% a device concept.

* **The date is the DEVICE's** (FR-528, owner-accepted). ``deviceQuotedAt`` is stored VERBATIM — a
  server clock would make the snapshot lie about *when the quote was given*. The row's
  ``created_at``
  exists as metadata only: never on the wire, never ordered by, never used to validate the device
  date. The server therefore stores a timestamp it cannot verify, and that is a recorded decision,
  not an oversight.
"""

from __future__ import annotations

import datetime
import decimal
import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import ConfigDict
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
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
from app.models import Snapshot

router = APIRouter(tags=["history"])


class SnapshotIn(CamelModel):
    """A recorded claim. Self-contained and frozen on the device at record time — the outbox stores
    exactly this body and replays it byte-for-byte."""

    client_snapshot_id: uuid.UUID
    kind: Literal["SINGLE", "KIT"]
    label: str | None = None
    quote_validity_days: int | None = None
    device_quoted_at: datetime.datetime
    device_utc_offset_minutes: int
    model_version: str
    headline_total: decimal.Decimal
    #: WHICH number the seller says they quoted — they choose it at record time (design round F1):
    #: a seller quoting a shopkeeper quoted ATACADO, and forcing varejo would record a number they
    #: never said to the customer.
    headline_basis: Literal["PRECO_VAREJO", "PRECO_ATACADO"]
    #: The frozen document. Money leaves inside it are decimal STRINGS (a JSON number would come
    #: back from `json.loads` as a float — the precision dies in the serializer, silently).
    payload: dict[str, Any]


class SnapshotLabelIn(CamelModel):
    """The ONLY mutable surface of a snapshot. `extra="forbid"` is load-bearing: it is what turns a
    smuggled frozen field into a 422 instead of a silent no-op (ADR-0019 §1)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    label: str | None = None


class SnapshotOut(CamelModel):
    id: uuid.UUID
    client_snapshot_id: uuid.UUID
    kind: str
    label: str | None
    quote_validity_days: int | None
    device_quoted_at: datetime.datetime
    device_utc_offset_minutes: int
    model_version: str
    payload_schema_version: int
    payload: dict[str, Any]
    headline_total: decimal.Decimal
    headline_basis: str
    # NOTE: `created_at` is deliberately ABSENT from the wire (FR-528). The only date this product
    # asserts is the device's.


class SnapshotPage(CamelModel):
    items: list[SnapshotOut]
    #: Keyset cursor — never OFFSET (history is unbounded per premium account, and a page size is
    #: not a cap: no limit on how many snapshots a seller may keep exists, or may be added
    #: silently).
    next_cursor: str | None = None


def _not_found() -> AppError:
    # The SAME answer for nonexistent, deleted and cross-tenant ids — so the API is never an
    # existence oracle (FR-511/SC-509).
    return AppError(ErrorCode.NOT_FOUND, "Snapshot not found", status_code=404)


def _to_out(row: Snapshot) -> SnapshotOut:
    return SnapshotOut(
        id=row.id,
        client_snapshot_id=row.client_snapshot_id,
        kind=row.kind,
        label=row.label,
        quote_validity_days=row.quote_validity_days,
        device_quoted_at=row.device_quoted_at,
        device_utc_offset_minutes=row.device_utc_offset_minutes,
        model_version=row.model_version,
        payload_schema_version=row.payload_schema_version,
        payload=row.payload,
        headline_total=row.headline_total,
        headline_basis=row.headline_basis,
    )


async def _owned(session: AsyncSession, uid: str, snapshot_id: uuid.UUID) -> Snapshot:
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


@router.post(
    "/history",
    status_code=status.HTTP_201_CREATED,
    responses={
        # An idempotent REPLAY answers 200 with the row the server already had. It is declared here
        # so the generated client's types know it: a contract that advertised only 201 would type a
        # legitimate 200 as an error envelope, and the outbox drain would treat a successful replay
        # as a failure — the exact duplicate this endpoint exists to prevent.
        status.HTTP_200_OK: {
            "model": SnapshotOut,
            "description": "Already recorded — the same clientSnapshotId was replayed.",
        },
        **ENTITLEMENT_ERRORS,
        **VALIDATION_ERRORS,
    },
)
async def record_snapshot(
    body: SnapshotIn,
    response: Response,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SnapshotOut:
    """Record a snapshot — the ONLY writer of frozen fields, and idempotent by construction.

    `ON CONFLICT DO NOTHING` + read-back is what makes a retry an idempotent SUCCESS rather than a
    duplicate or an error: the outbox may replay the same `clientSnapshotId` any number of times
    (lost response, reconnect, app restart, two tabs) and always gets back the row the server
    already created. Because the unique key is UNCONDITIONAL — tombstones included — a replay that
    arrives AFTER the seller deleted the entry cannot RESURRECT it: the insert no-ops, and the
    read-back finds only the soft-deleted row, which is not served.
    """
    uid: str = claims["uid"]

    stmt = (
        pg_insert(Snapshot)
        .values(
            owner_uid=uid,
            client_snapshot_id=body.client_snapshot_id,
            kind=body.kind,
            label=body.label,
            quote_validity_days=body.quote_validity_days,
            device_quoted_at=body.device_quoted_at,
            device_utc_offset_minutes=body.device_utc_offset_minutes,
            model_version=body.model_version,
            payload=body.payload,
            headline_total=body.headline_total,
            headline_basis=body.headline_basis,
        )
        .on_conflict_do_nothing(index_elements=["owner_uid", "client_snapshot_id"])
        .returning(Snapshot.id)
    )
    inserted = (await session.execute(stmt)).scalar_one_or_none()
    await session.commit()

    existing = (
        await session.execute(
            select(Snapshot).where(
                Snapshot.owner_uid == uid,
                Snapshot.client_snapshot_id == body.client_snapshot_id,
            )
        )
    ).scalar_one()

    if inserted is None:
        # A replay. If the seller has since DELETED it, the honest answer is "gone" — resurrecting
        # it would silently undo a deliberate deletion.
        if existing.deleted_at is not None:
            raise _not_found()
        response.status_code = status.HTTP_200_OK

    return _to_out(existing)


@router.get("/history", responses=ENTITLEMENT_ERRORS)
async def list_history(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> SnapshotPage:
    """Newest-first by the DEVICE's date — the date that is the seller's claim (FR-523)."""
    uid: str = claims["uid"]
    rows = (
        (
            await session.execute(
                select(Snapshot)
                .where(Snapshot.owner_uid == uid, Snapshot.deleted_at.is_(None))
                .order_by(Snapshot.device_quoted_at.desc(), Snapshot.id.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return SnapshotPage(items=[_to_out(r) for r in rows], next_cursor=None)


@router.get("/history/{snapshot_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_snapshot(
    snapshot_id: uuid.UUID,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SnapshotOut:
    """Serves the STORED document. No recomputation, ever — that is the whole promise."""
    return _to_out(await _owned(session, claims["uid"], snapshot_id))


@router.patch(
    "/history/{snapshot_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def relabel_snapshot(
    snapshot_id: uuid.UUID,
    body: SnapshotLabelIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SnapshotOut:
    """The label, and ONLY the label. Anything else was already rejected as a 422 by the model."""
    row = await _owned(session, claims["uid"], snapshot_id)
    row.label = body.label
    await session.commit()
    await session.refresh(row)
    return _to_out(row)


@router.delete(
    "/history/{snapshot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def delete_snapshot(
    snapshot_id: uuid.UUID,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Voluntary soft-delete. The tombstone is ALSO the idempotency guard: it lives inside the
    unique key, so a queued retry cannot bring the entry back (SC-513)."""
    row = await _owned(session, claims["uid"], snapshot_id)
    row.deleted_at = datetime.datetime.now(datetime.UTC)
    await session.commit()
