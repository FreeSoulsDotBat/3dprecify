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

import base64
import datetime
import decimal
import json
import uuid
from typing import Annotated, Any, Literal, cast

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import ConfigDict, field_validator, model_validator
from sqlalchemy import literal, select, tuple_
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

# Integer-digit budget for MONEY_SETTLED Numeric(12,2): a value AT/ABOVE this OVERFLOWS the column
# at write time — Postgres raises `numeric field overflow` and FastAPI would surface an opaque 500.
# We reject it here as a clean 422 (the outbox re-POSTs a 5xx forever, so a permanent 500 is an
# infinite loop). Copied module-local, following the filaments/printers/products precedent — the
# 4-way dedup of this constant is a separate janitorial task, NOT this fix.
_CEIL_MONEY = decimal.Decimal(10) ** 10

# One frozen document has a maximum size (abuse/DoS guard, data-model §7 item 6 — owner-confirmed
# 512 KB). A document over the cap is an HONEST 422, never a silent truncation: truncating an
# immutable record would make a snapshot quietly lie about what it froze — the worst outcome.
_PAYLOAD_SIZE_CAP_BYTES = 512 * 1024

# map(headline_basis) -> the key of the matching total inside `payload.totals`. The envelope is FLAT
# (I2 / Option A): `totals` sits at the ROOT, there is no `payload.result` wrapper. VR-503 binds the
# denormalised `headline_total` to exactly this leaf.
_BASIS_TOTAL_KEY: dict[str, str] = {
    "PRECO_VAREJO": "precoVarejo",
    "PRECO_ATACADO": "precoAtacado",
}


def _finite_non_negative(
    value: decimal.Decimal, field: str, ceiling: decimal.Decimal = _CEIL_MONEY
) -> decimal.Decimal:
    if not value.is_finite() or value < 0:
        raise ValueError(f"{field} must be a finite number >= 0")
    if value >= ceiling:
        raise ValueError(f"{field} exceeds the maximum storable magnitude")
    return value


def _reject_bad_leaves(node: object) -> None:
    """VR-501 / VR-502 — the recursive money guard over the whole frozen document.

    The payload is opaque JSONB, so this walks it GENERICALLY rather than pinning
    `PriceResult`/`BomResult` field-by-field (pinning would make a pricing-core version bump reject
    its own payloads — the exact property JSONB exists to avoid, data-model §9.6). Two rules:

    * **VR-502 — no JSON float anywhere.** A float leaf means precision already died at the
      serializer boundary (a JSON number decodes to binary64 in BOTH runtimes). This is the LAST
      defence before a float freezes into the immutable table; the client (I1) also stops emitting
      them. `bool`/`int` pass — the only legal JSON numbers are integer counts (`schemaVersion`,
      `quantity`, `contributingLines`, `skippedLines`).
    * **VR-501 — every string that PARSES as a Decimal must be finite** (rejects `"NaN"`/
      `"Infinity"` — the in-JSON twin of the `<> 'NaN'::numeric` CHECK, which cannot reach inside
      JSONB) and within magnitude. A non-numeric string (a name, a label, an id) is ignored —
      generic leaf validation, no shape-pin.
    """
    if isinstance(node, dict):
        for value in cast("dict[str, object]", node).values():
            _reject_bad_leaves(value)
    elif isinstance(node, list):
        for item in cast("list[object]", node):
            _reject_bad_leaves(item)
    elif isinstance(node, bool):
        return  # a JSON true/false — never money
    elif isinstance(node, float):
        raise ValueError(
            "payload contains a JSON float; every money leaf must be a decimal STRING (FR-525)"
        )
    elif isinstance(node, str):
        try:
            parsed = decimal.Decimal(node)
        except decimal.InvalidOperation:
            return  # a non-numeric string (a name/label/id) — not a money leaf
        if not parsed.is_finite() or abs(parsed) >= _CEIL_MONEY:
            raise ValueError("payload money string is non-finite or exceeds the storable magnitude")
    # int / None fall through unchanged.


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

    @field_validator("headline_total")
    @classmethod
    def _headline_total_finite(cls, v: decimal.Decimal) -> decimal.Decimal:
        # Overflow of Numeric(12,2) would be a 500 at INSERT time; catch it here (and NaN/Infinity/
        # negatives) as a clean 422. The DB `ck_snapshots_headline_total_valid` is the backstop.
        return _finite_non_negative(v, "headlineTotal", _CEIL_MONEY)

    @model_validator(mode="after")
    def _validate_frozen_document(self) -> SnapshotIn:
        """M2 — the app-layer PRIMARY defence for the immutable table (the DB CHECKs are backstops).

        Nothing reachable by input may become a 500: `history.py`'s POST insert can violate several
        CHECKs (and the money guards) that would otherwise raise `IntegrityError`/`DataError` → the
        generic handler → 500. The outbox re-POSTs a 5xx forever, so a permanent 500 on an invalid
        body is an infinite loop; every one of those cases is mirrored here as a terminal 422.
        """
        # VR-501 / VR-502 — the recursive money guard (floats, NaN/Infinity, magnitude).
        _reject_bad_leaves(self.payload)

        # The denormalised columns may never diverge from the document (immutability freezes both,
        # the DB `payload_kind_matches` / `payload_version_matches` CHECKs are the backstops).
        if self.payload.get("kind") != self.kind:
            raise ValueError("payload.kind must equal kind")
        if self.payload.get("modelVersion") != self.model_version:
            raise ValueError("payload.modelVersion must equal modelVersion")

        # VR-503 — the anti-lie invariant: the card total (headline_total) IS the detail's basis
        # total. Divergence would show two different "what you charged" for one immutable line.
        totals = self.payload.get("totals")
        if not isinstance(totals, dict):
            raise ValueError("payload.totals is required")
        key = _BASIS_TOTAL_KEY[self.headline_basis]
        basis_total = cast("dict[str, object]", totals).get(key)
        if basis_total is None:
            raise ValueError(f"payload.totals.{key} must be present and equal headlineTotal")
        try:
            basis_decimal = decimal.Decimal(str(basis_total))
        except decimal.InvalidOperation as exc:
            raise ValueError(f"payload.totals.{key} is not a valid decimal") from exc
        if basis_decimal != self.headline_total:
            raise ValueError(f"headlineTotal must equal payload.totals.{key}")

        # The remaining column CHECK mirrors — range guards + blank-label normalisation.
        if self.quote_validity_days is not None and not 1 <= self.quote_validity_days <= 3650:
            raise ValueError("quoteValidityDays must be within [1, 3650]")
        if not -840 <= self.device_utc_offset_minutes <= 840:
            raise ValueError("deviceUtcOffsetMinutes must be within [-840, 840]")
        if self.label is not None and not self.label.strip():
            self.label = None  # blank is unrepresentable as '' (ck_snapshots_label_not_blank)

        # Size cap — an HONEST 422, never a silent truncation of an immutable record.
        if len(json.dumps(self.payload).encode("utf-8")) > _PAYLOAD_SIZE_CAP_BYTES:
            raise ValueError("payload exceeds the maximum document size")
        return self


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


def _encode_cursor(row: Snapshot) -> str:
    """Keyset cursor = base64url(JSON ``[deviceQuotedAt, id]``) — the exact ORDER BY key
    (``device_quoted_at``, ``id``) DESC. Opaque to the client, which only echoes ``nextCursor``
    back verbatim on the next page."""
    raw = json.dumps([row.device_quoted_at.isoformat(), str(row.id)]).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _decode_cursor(cursor: str) -> tuple[datetime.datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii"))
        dt_iso, id_str = json.loads(raw)
        return datetime.datetime.fromisoformat(dt_iso), uuid.UUID(id_str)
    except (ValueError, TypeError) as exc:
        # A malformed cursor is CLIENT input, never a 500 (base64/JSON/UUID all raise ValueError
        # subclasses; a wrong-shape tuple raises ValueError/TypeError on unpack).
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "malformed pagination cursor", status_code=422
        ) from exc


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


@router.get("/history", responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS})
async def list_history(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    cursor: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
    from_: Annotated[datetime.datetime | None, Query(alias="from")] = None,
    to: Annotated[datetime.datetime | None, Query()] = None,
    client_snapshot_id: Annotated[uuid.UUID | None, Query(alias="clientSnapshotId")] = None,
) -> SnapshotPage:
    """Newest-first by the DEVICE's date — the date that is the seller's claim (FR-523).

    Keyset pagination (data-model D4), never OFFSET and never a silent cap: a page size is NOT a
    limit on how many snapshots a seller may keep (that would be a business-rules amendment). The
    client follows ``nextCursor`` to exhaustion — or, from PR-B, lazily via [Carregar mais] — so the
    whole unbounded history is reachable. ``limit + 1`` peeks one row ahead to decide whether a next
    page exists.

    US6 filters (ux §2.6), all owner-scoped and composing with the keyset:

    * ``q`` — a substring label search, ILIKE (case-insensitive) and **accent-sensitive** (F5,
      owner-accepted for E4: ``joao`` does not find ``João``). ILIKE metacharacters in the term are
      escaped, so a literal ``%``/``_`` in a label is matched, not treated as a wildcard. A NULL
      label never matches (an unlabelled row is not a search hit).
    * ``from``/``to`` — a range on the **DEVICE** date (the seller's claimed quote date), never
      ``created_at`` (which is unverifiable metadata and never ordered/filtered by, FR-528).
    * ``clientSnapshotId`` — an exact lookup, so the detail can resolve a deep-linked snapshot that
      may not be on the first lazily-loaded page (review PR-A M3, preserved under lazy pagination).
    """
    uid: str = claims["uid"]
    stmt = (
        select(Snapshot)
        .where(Snapshot.owner_uid == uid, Snapshot.deleted_at.is_(None))
        .order_by(Snapshot.device_quoted_at.desc(), Snapshot.id.desc())
        .limit(limit + 1)
    )
    if q:
        term = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Snapshot.label.ilike(f"%{term}%", escape="\\"))
    if from_ is not None:
        stmt = stmt.where(Snapshot.device_quoted_at >= from_)
    if to is not None:
        stmt = stmt.where(Snapshot.device_quoted_at <= to)
    if client_snapshot_id is not None:
        stmt = stmt.where(Snapshot.client_snapshot_id == client_snapshot_id)
    if cursor is not None:
        cur_dt, cur_id = _decode_cursor(cursor)
        # Row-value comparison matches the composite DESC order exactly — the next page is every
        # row strictly "older" than the last one already returned (the index serves it backwards).
        # The cursor scalars become bound literals (SQLAlchemy infers DateTime/Uuid) so the row
        # comparison renders `(device_quoted_at, id) < ($1, $2)`.
        stmt = stmt.where(
            tuple_(Snapshot.device_quoted_at, Snapshot.id)
            < tuple_(literal(cur_dt), literal(cur_id))
        )
    rows = list((await session.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = _encode_cursor(page[-1]) if has_more and page else None
    return SnapshotPage(items=[_to_out(r) for r in page], next_cursor=next_cursor)


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
    """The label, and ONLY the label. Anything else was already rejected as a 422 by the model.

    Presence-sensitive (M4): the label is the ONE mutable field, so a PATCH that OMITS ``label``
    must leave it untouched — erasing it on omission would silently drop the seller's reference.
    ``null`` clears it; a blank/whitespace string is a 422 (the DB ``ck_snapshots_label_not_blank``
    would otherwise surface as a 500), never a silent no-op.
    """
    row = await _owned(session, claims["uid"], snapshot_id)
    if "label" not in body.model_fields_set:
        return _to_out(row)  # label omitted ⇒ untouched
    new_label = body.label
    if new_label is not None and not new_label.strip():
        raise AppError(ErrorCode.VALIDATION_ERROR, "label must not be blank", status_code=422)
    row.label = new_label
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
