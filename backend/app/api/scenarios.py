"""E5 (US1/US2, FR-602..614) — saved marketplace scenarios: PR-A subset (T007/T011).

Wire per `specs/010-e5-saved-scenarios/contracts/api-surface.md` + the config envelope per
`specs/010-e5-saved-scenarios/data-model.md` §3/§4. THE GOVERNING SENTENCE (mirror of E4's
two-shelf rule): **a scenario stores the seller's INTENT, not resolved values, and it is
MUTABLE.** So, unlike an E4 snapshot, there is no immutability trigger, no idempotency key, no
offline outbox and — the point this module exists to enforce — **no money column at all**: every
monetary leaf lives inside the ``config`` JSONB as a decimal STRING, and the backend never
recomputes or stores a resolved price (VR-611, ADR-0008/ADR-0015).

**This is the PR-A subset only** (T007 + T011): ``POST`` create, ``GET`` list (keyset), ``GET
/{id}``. The read-time D3/D6 cost-basis resolver is explicitly OUT of scope here — T022 (PR-B)
resolves ``config.costBasis`` against the live catalog; this module returns ``config`` exactly as
stored (verbatim), consistent with "materializes nothing" (VR-607). ``PUT``/``PATCH``/``DELETE``/
``duplicate`` are T028/T026 (PR-B).

**The config validator is STRUCTURAL, not shape-pinning** (VR-602/603, the E4 §9.6 lesson):
``config`` is a raw ``dict[str, Any]``, walked generically for JSON-float leaves / non-finite
decimal strings / an oversized document — never mirrored field-by-field against ``PriceInput``/
``BomResult``, so a pricing-core bump can never make this backend reject its own configs. It runs
on every write (POST now; PUT in PR-B) per data-model §1 N1.

**T011 — the on-save re-snapshot (D6 groundwork, ADR-0017 §6 the ``_snapshot_line`` rule).** A
``costBasis`` referencing a live, owned Product has its ``lastKnown`` REWRITTEN from the live row
on every save — so a later degradation (T022, when the product is gone) is lossless. A ``ref``
that does not resolve is **not** an error (Q13, accept-and-degrade): the client-sent ``lastKnown``
is kept as-is.
"""

from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, Query, status
from pydantic import field_validator
from sqlalchemy import literal, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.products import (
    _live_links,  # pyright: ignore[reportPrivateUsage]
)
from app.api.products import (
    _to_out as _product_to_out,  # pyright: ignore[reportPrivateUsage]
)
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
from app.models import Product, Scenario

router = APIRouter(tags=["scenarios"])

# Generic magnitude ceiling for ANY decimal-string leaf inside `config`. Config is validated
# STRUCTURALLY (VR-603) — we do not know per-field which NUMERIC domain a leaf belongs to, so we
# apply the single widest house ceiling (mirrors `products.py::_CEIL_RATE`, Numeric(18,6)) as one
# generic bound, exactly the way `history.py::_reject_bad_leaves` applies one ceiling to the whole
# frozen document.
_CEIL_CONFIG_LEAF = Decimal(10) ** 12

# 256 KB (data-model §7 item 5, owner-decided 2026-07-19) — lower than E4's 512 KB because a
# scenario stores INTENT, not a full frozen result document. An over-cap config is an HONEST 422,
# never a silent truncation.
_CONFIG_SIZE_CAP_BYTES = 256 * 1024

_VALID_COST_BASIS_KINDS = {"AD_HOC", "PRODUCT", "KIT"}


def _reject_bad_leaves(node: object) -> None:
    """VR-602 — the recursive money guard over the whole `config` document.

    Mirrors `history.py::_reject_bad_leaves` verbatim (the E4 precedent for a JSONB document that
    must reject a float ANYWHERE without pinning its shape). Only int/bool/None/well-formed finite
    decimal strings survive; a JSON float is rejected (precision already died at the serializer
    boundary — `json.loads`/`JSON.parse` both decode a JSON number to binary64).
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
            "config contains a JSON float; every money/rate/qty/percent leaf must be a decimal"
            " STRING (VR-602)"
        )
    elif isinstance(node, str):
        try:
            parsed = Decimal(node)
        except InvalidOperation:
            return  # a non-numeric string (a name/label/marketplace id) — not a money leaf
        if not parsed.is_finite() or abs(parsed) >= _CEIL_CONFIG_LEAF:
            raise ValueError(
                "config contains a non-finite (NaN/Infinity) or oversized decimal string (VR-602)"
            )
    # int / None fall through unchanged — the only legal JSON numbers (schemaVersion, quantity).


def _validate_cost_basis(cost_basis: object) -> None:
    if not isinstance(cost_basis, dict):
        raise ValueError("config.costBasis must be an object")
    cb = cast("dict[str, object]", cost_basis)
    kind = cb.get("kind")
    if kind not in _VALID_COST_BASIS_KINDS:
        raise ValueError("config.costBasis.kind must be one of AD_HOC, PRODUCT, KIT")
    ref = cb.get("ref")
    if kind == "AD_HOC":
        if ref is not None:
            raise ValueError("config.costBasis.ref must be null for an AD_HOC basis")
    elif ref is not None and not (isinstance(ref, dict) and {"id", "name"} <= ref.keys()):
        raise ValueError("config.costBasis.ref must be null or an {id, name} object")
    if "lastKnown" not in cb:
        raise ValueError("config.costBasis.lastKnown is required")


def validate_scenario_config(config: dict[str, Any]) -> None:
    """The recursive config intent-document validator (VR-602/603) — a reusable dependency that
    will run on INSERT now and UPDATE in PR-B (T027/T028). Structural per the flat §3 envelope;
    never mirrors `PriceInput`/`BomResult` field-by-field."""
    schema_version = config.get("schemaVersion")
    if not isinstance(schema_version, int) or isinstance(schema_version, bool):
        raise ValueError("config.schemaVersion is required and must be an integer")
    if not isinstance(config.get("includeMarketplace"), bool):
        raise ValueError("config.includeMarketplace is required and must be a boolean")
    _validate_cost_basis(config.get("costBasis"))
    channels = config.get("channels")
    if not isinstance(channels, list):
        raise ValueError("config.channels must be a list")
    for channel in cast("list[object]", channels):
        if not isinstance(channel, dict) or "marketplace" not in channel:
            raise ValueError("each channel requires a marketplace")
    other_costs = config.get("otherCosts")
    if not isinstance(other_costs, list):
        raise ValueError("config.otherCosts must be a list")
    for cost in cast("list[object]", other_costs):
        if not isinstance(cost, dict) or "value" not in cost:
            raise ValueError("each otherCosts item requires a value")

    # The size cap FIRST — an oversized non-numeric leaf (e.g. a giant ref.name) would otherwise
    # slip past the leaf scan (a non-numeric string is deliberately ignored there).
    if len(json.dumps(config).encode("utf-8")) > _CONFIG_SIZE_CAP_BYTES:
        raise ValueError("config exceeds the maximum document size (256 KB)")

    _reject_bad_leaves(config)


class ScenarioIn(CamelModel):
    """POST create body — `PUT` full-replace (PR-B, T028) reuses this shape."""

    name: str
    note: str | None = None
    config: dict[str, Any]

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("name must not be blank")
        if len(trimmed) > 120:
            raise ValueError("name exceeds the maximum length (120)")
        return trimmed

    @field_validator("note")
    @classmethod
    def _note(cls, v: str | None) -> str | None:
        if v is None:
            return v
        trimmed = v.strip()
        if not trimmed:
            return None  # blank => NULL, unrepresentable as '' (data-model §2)
        if len(trimmed) > 500:
            raise ValueError("note exceeds the maximum length (500)")
        return trimmed

    @field_validator("config")
    @classmethod
    def _config(cls, v: dict[str, Any]) -> dict[str, Any]:
        validate_scenario_config(v)
        return v


class ScenarioOut(CamelModel):
    id: uuid.UUID
    name: str
    note: str | None
    #: Echoed VERBATIM as stored — the read-time D3/D6 resolver is T022 (PR-B), not this module.
    config: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class ScenarioList(CamelModel):
    items: list[ScenarioOut]
    #: Opaque keyset cursor (created_at, id) DESC — never OFFSET (the list is unbounded per
    #: premium account); `null` on the last page.
    next_cursor: str | None = None


def _not_found() -> AppError:
    # The SAME answer for nonexistent, soft-deleted, cross-tenant and malformed ids — never an
    # existence oracle (VR-609).
    return AppError(ErrorCode.NOT_FOUND, "Scenario not found", status_code=404)


def _to_out(row: Scenario) -> ScenarioOut:
    return ScenarioOut(
        id=row.id,
        name=row.name,
        note=row.note,
        config=row.config,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _owned(session: AsyncSession, uid: str, scenario_id: str) -> Scenario:
    """Owner-scoped fetch: wrong owner, soft-deleted or malformed id → 404 (VR-609)."""
    try:
        sid = uuid.UUID(scenario_id)
    except ValueError as exc:
        raise _not_found() from exc
    row = (
        await session.execute(
            select(Scenario).where(
                Scenario.id == sid,
                Scenario.owner_uid == uid,
                Scenario.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise _not_found()
    return row


def _encode_cursor(row: Scenario) -> str:
    """Keyset cursor = base64url(JSON [createdAt, id]) — the exact ORDER BY key (`created_at`,
    `id`) DESC (data-model §5: `created_at` is immutable, so the cursor is stable across an
    interleaved edit — the E4 lesson, never key a cursor on a field that moves under you)."""
    raw = json.dumps([row.created_at.isoformat(), str(row.id)]).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def _decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        raw = base64.urlsafe_b64decode(cursor.encode("ascii"))
        dt_iso, id_str = json.loads(raw)
        return datetime.fromisoformat(dt_iso), uuid.UUID(id_str)
    except (ValueError, TypeError) as exc:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "malformed pagination cursor", status_code=422
        ) from exc


async def _resolve_product_last_known(
    session: AsyncSession, uid: str, product_id: uuid.UUID
) -> dict[str, Any] | None:
    """T011 — resolve an OWNED, LIVE Product to the flat `lastKnown` PriceInput shape (data-model
    §3), reusing the E3 `_snapshot_line` rule one level up: read the live row's RESOLVED values
    (which already resolve ITS filament/printer link, D3) rather than the product's own columns.
    `None` when the ref does not resolve — the caller keeps the client-sent `lastKnown` (Q13)."""
    row = (
        await session.execute(
            select(Product).where(
                Product.id == product_id,
                Product.owner_uid == uid,
                Product.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    filaments, printers = await _live_links(session, [row])
    resolved = _product_to_out(
        row,
        filaments.get(row.filament_id) if row.filament_id else None,
        printers.get(row.printer_id) if row.printer_id else None,
    )
    piece = resolved.piece_inputs
    filament = resolved.filament_values
    printer = resolved.printer_values
    # Hand-built (not a pydantic model dump) so the leaf set matches data-model §3's flat
    # PriceInput shape exactly — money/rate/qty/percent as `str(Decimal)` (scale-preserving,
    # the same idiom `model_dump(mode="json")` uses under the hood).
    return {
        "printGrams": str(piece.print_grams),
        "wasteGrams": str(piece.waste_grams),
        "printTimeHours": str(piece.print_time_hours),
        "tariffPerKwh": str(resolved.tariff_per_kwh),
        "failurePct": str(piece.failure_pct),
        "finishTimeHours": str(piece.finish_time_hours),
        "finishRatePerHour": str(piece.finish_rate_per_hour),
        "laborHours": str(piece.labor_hours),
        "laborRatePerHour": str(piece.labor_rate_per_hour),
        "markupVarejoPct": str(piece.markup_varejo_pct),
        "markupAtacadoPct": str(piece.markup_atacado_pct),
        "filamentMaterial": filament.material,
        "filamentCostPerRoll": str(filament.cost_per_roll),
        "filamentRollWeightKg": str(filament.roll_weight_kg),
        "printerMachineValue": str(printer.machine_value),
        "printerMachineLifetimeHours": str(printer.machine_lifetime_hours),
        "printerAvgPowerKw": str(printer.avg_power_kw),
        "printerMaintenanceReservePerHour": str(printer.maintenance_reserve_per_hour),
    }


async def _resnapshot_cost_basis(
    session: AsyncSession, uid: str, config: dict[str, Any]
) -> dict[str, Any]:
    """T011 — re-snapshot `costBasis.lastKnown` from the live reference on EVERY save, so a later
    D6 degradation (T022) is lossless (ADR-0017 §6). A `PRODUCT` ref that resolves to an owned,
    live Product OVERWRITES the submitted `lastKnown`; a `ref` that does not resolve (nonexistent,
    soft-deleted, cross-tenant, or an ad-hoc/KIT basis) leaves the client-sent `lastKnown` as-is —
    accept-and-degrade (Q13), never an error. KIT re-snapshot is T024 (PR-B, Q12 channel
    composition) — out of scope here."""
    cost_basis = config.get("costBasis")
    if not isinstance(cost_basis, dict):
        return config
    cb = cast("dict[str, Any]", cost_basis)
    if cb.get("kind") != "PRODUCT":
        return config
    ref = cb.get("ref")
    if not isinstance(ref, dict):
        return config
    ref_dict = cast("dict[str, Any]", ref)
    if not ref_dict.get("id"):
        return config
    try:
        product_id = uuid.UUID(str(ref_dict["id"]))
    except ValueError:
        return config
    last_known = await _resolve_product_last_known(session, uid, product_id)
    if last_known is not None:
        cb["lastKnown"] = last_known
    return config


@router.get("/scenarios", responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS})
async def list_scenarios(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: Annotated[str | None, Query()] = None,
    q: Annotated[str | None, Query(max_length=120)] = None,
) -> ScenarioList:
    """Keyset pagination (never OFFSET — the per-account list is unbounded, data-model §5); `?q=`
    is an owner-scoped, case-insensitive, ACCENT-SENSITIVE substring `name ILIKE` (owner-decided
    2026-07-19, the E4 D4 idiom). Readable on lapse (`require_catalog_read`, FR-612)."""
    uid: str = claims["uid"]
    stmt = (
        select(Scenario)
        .where(Scenario.owner_uid == uid, Scenario.deleted_at.is_(None))
        .order_by(Scenario.created_at.desc(), Scenario.id.desc())
        .limit(limit + 1)
    )
    if q:
        term = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(Scenario.name.ilike(f"%{term}%", escape="\\"))
    if cursor is not None:
        cur_dt, cur_id = _decode_cursor(cursor)
        stmt = stmt.where(
            tuple_(Scenario.created_at, Scenario.id) < tuple_(literal(cur_dt), literal(cur_id))
        )
    rows = list((await session.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    page = rows[:limit]
    next_cursor = _encode_cursor(page[-1]) if has_more and page else None
    return ScenarioList(items=[_to_out(r) for r in page], next_cursor=next_cursor)


@router.post(
    "/scenarios",
    status_code=status.HTTP_201_CREATED,
    responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS},
)
async def create_scenario(
    body: ScenarioIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScenarioOut:
    """Create (VR-601 ACTIVE-only write gate). Materializes NOTHING (VR-607) — no catalog row is
    ever touched, the row only REFERENCES the catalog. `owner_uid` is injected from the verified
    token, never the body."""
    uid: str = claims["uid"]
    config = await _resnapshot_cost_basis(session, uid, dict(body.config))
    row = Scenario(
        owner_uid=uid,
        name=body.name,
        note=body.note,
        config=config,
        config_schema_version=int(config["schemaVersion"]),
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return _to_out(row)


@router.get("/scenarios/{scenario_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_scenario(
    scenario_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScenarioOut:
    """Own + not-deleted only (VR-609); `config` served VERBATIM — the D3/D6 resolve is T022."""
    row = await _owned(session, claims["uid"], scenario_id)
    return _to_out(row)
