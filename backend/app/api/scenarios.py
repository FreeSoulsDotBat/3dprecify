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
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, Query, status
from pydantic import ConfigDict, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import literal, select, tuple_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.boms import (
    _degraded_or as _bom_degraded_or,  # pyright: ignore[reportPrivateUsage]
)
from app.api.boms import (
    _lines_of as _bom_lines_of,  # pyright: ignore[reportPrivateUsage]
)
from app.api.boms import (
    _resolve_views as _bom_resolve_views,  # pyright: ignore[reportPrivateUsage]
)
from app.api.products import (
    ProductOut,
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
from app.models import Bom, BomLine, Product, Scenario

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


def _price_input_dict(resolved: ProductOut) -> dict[str, Any]:
    """The FLAT `PriceInput`-shaped `lastKnown`/`lines[].input` contract (`contracts/api-surface.md`
    lines 69-79, data-model §3) — the EXACT `CalcFieldName` set
    `apps/web/src/features/calculator/calculator-schema.ts::CALC_FIELD_NAMES` lists and
    `applyScenarioConfig` looks up by name (mirrors `pricing-core`'s own `PriceInput` keys verbatim
    — no `filament`/`printer` prefix, no material-name leaf; `PriceInput` doesn't have one either).

    Redirect (2026-07-20, T030 e2e finding): the PREVIOUS version of this function emitted
    `BomLine`'s OWN internal prefixed column names (`filamentCostPerRoll`, `printerMachineValue`,
    …) — an implementation-storage detail that leaked onto the wire and silently broke every
    `applyScenarioConfig` reopen (6+ keys never matched, defaults silently applied instead). Hand-
    built (not a pydantic model dump) so the leaf set matches the contract exactly — money/rate/qty/
    percent as `str(Decimal)` (scale-preserving, the same idiom `model_dump(mode="json")` uses
    under the hood). Shared by the PRODUCT and KIT-line resolve paths (T022) — a KIT line's live
    value-set is a `ProductOut` one level down."""
    piece = resolved.piece_inputs
    filament = resolved.filament_values
    printer = resolved.printer_values
    return {
        "costPerRoll": str(filament.cost_per_roll),
        "rollWeightKg": str(filament.roll_weight_kg),
        "printGrams": str(piece.print_grams),
        "wasteGrams": str(piece.waste_grams),
        "printTimeHours": str(piece.print_time_hours),
        "avgPowerKw": str(printer.avg_power_kw),
        "tariffPerKwh": str(resolved.tariff_per_kwh),
        "machineValue": str(printer.machine_value),
        "machineLifetimeHours": str(printer.machine_lifetime_hours),
        "maintenanceReservePerHour": str(printer.maintenance_reserve_per_hour),
        "failurePct": str(piece.failure_pct),
        "finishTimeHours": str(piece.finish_time_hours),
        "finishRatePerHour": str(piece.finish_rate_per_hour),
        "laborHours": str(piece.labor_hours),
        "laborRatePerHour": str(piece.labor_rate_per_hour),
        "markupVarejoPct": str(piece.markup_varejo_pct),
        "markupAtacadoPct": str(piece.markup_atacado_pct),
    }


def _price_input_dict_from_bom_line(line: BomLine) -> dict[str, Any]:
    """The SAME flat `PriceInput` contract shape (see `_price_input_dict` above), built from a
    `BomLine`'s OWN last-known snapshot COLUMNS — the E3 read path's degraded-line branch
    (`boms.py::_to_out`), for a kit LINE whose own product ref is gone even though the KIT itself
    still resolves (D6 one level down, mirrored verbatim via `_degraded_or` so a stored zero is
    never corrupted to a dropped scale). The `BomLine` column NAMES stay prefixed (its own
    internal storage idiom, unaffected by this fix); only the WIRE keys this function emits follow
    the contract."""
    return {
        "costPerRoll": str(_bom_degraded_or(line.filament_cost_per_roll, "0")),
        "rollWeightKg": str(_bom_degraded_or(line.filament_roll_weight_kg, "1")),
        "printGrams": str(_bom_degraded_or(line.print_grams, "0")),
        "wasteGrams": str(_bom_degraded_or(line.waste_grams, "0")),
        "printTimeHours": str(_bom_degraded_or(line.print_time_hours, "0")),
        "avgPowerKw": str(_bom_degraded_or(line.printer_avg_power_kw, "0")),
        "tariffPerKwh": str(_bom_degraded_or(line.tariff_per_kwh, "0")),
        "machineValue": str(_bom_degraded_or(line.printer_machine_value, "0")),
        "machineLifetimeHours": str(_bom_degraded_or(line.printer_machine_lifetime_hours, "1")),
        "maintenanceReservePerHour": str(
            _bom_degraded_or(line.printer_maintenance_reserve_per_hour, "0")
        ),
        "failurePct": str(_bom_degraded_or(line.failure_pct, "0")),
        "finishTimeHours": str(_bom_degraded_or(line.finish_time_hours, "0")),
        "finishRatePerHour": str(_bom_degraded_or(line.finish_rate_per_hour, "0")),
        "laborHours": str(_bom_degraded_or(line.labor_hours, "0")),
        "laborRatePerHour": str(_bom_degraded_or(line.labor_rate_per_hour, "0")),
        "markupVarejoPct": str(_bom_degraded_or(line.markup_varejo_pct, "0")),
        "markupAtacadoPct": str(_bom_degraded_or(line.markup_atacado_pct, "0")),
    }


async def _resolve_product_last_known(
    session: AsyncSession, uid: str, product_id: uuid.UUID
) -> dict[str, Any] | None:
    """T011/T022 — resolve an OWNED, LIVE Product to the flat `lastKnown` PriceInput shape
    (data-model §3), reusing the E3 `_snapshot_line` rule one level up: read the live row's
    RESOLVED values (which already resolve ITS filament/printer link, D3) rather than the
    product's own columns. `None` when the ref does not resolve (the T011 caller keeps the
    client-sent `lastKnown`, Q13; the T022 caller reports `degraded: true`)."""
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
    return _price_input_dict(resolved)


async def _resolve_kit_last_known(
    session: AsyncSession, uid: str, bom_id: uuid.UUID
) -> dict[str, Any] | None:
    """T022 (redirect 2026-07-20) — resolve an OWNED, LIVE Kit to the `{lines: [...]}` `lastKnown`
    shape (data-model §3/§8 VR-605/606, `api-surface.md` lines 74-80/99-102). REUSES the E3 seam
    verbatim (`boms.py::_lines_of` + `_resolve_views`) rather than duplicating kit-line resolution
    — a line whose OWN product ref is gone (even though the kit itself still resolves) degrades
    the same way `boms.py`'s read path already does (D6 one level down), via
    `_price_input_dict_from_bom_line`. `None` when the KIT itself does not resolve (soft-deleted /
    cross-tenant / never-existed / malformed id) — the caller reports `degraded: true` and serves
    the scenario's own STORED `lastKnown`."""
    row = (
        await session.execute(
            select(Bom).where(Bom.id == bom_id, Bom.owner_uid == uid, Bom.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if row is None:
        return None
    lines = await _bom_lines_of(session, bom_id)
    product_ids = {line.product_id for line in lines if line.product_id is not None}
    views = await _bom_resolve_views(session, uid, product_ids)
    out_lines: list[dict[str, Any]] = []
    for line in lines:
        resolved = views.get(line.product_id) if line.product_id is not None else None
        if resolved is not None:
            out_lines.append(
                {
                    "name": resolved.name,
                    "quantity": line.quantity,
                    "input": _price_input_dict(resolved),
                }
            )
        else:
            # The kit resolves, but THIS line's own product ref is gone (D6 one level down) — no
            # name to show honestly (mirrors `boms.py::BomLineOut.piece_name=None`), never a 500.
            out_lines.append(
                {
                    "name": "",
                    "quantity": line.quantity,
                    "input": _price_input_dict_from_bom_line(line),
                }
            )
    return {"lines": out_lines}


async def _resolve_cost_basis_for_read(
    session: AsyncSession, uid: str, cost_basis: dict[str, Any]
) -> dict[str, Any]:
    """T022 — the read-time D3/D6 resolver (VR-605/606), reusing the E3 `_resolve_views` seam
    (owner + `deleted_at IS NULL`). Returns the `ResolvedCostBasis` shape (api-surface.md):
    `{kind, ref, degraded, lastKnown}`. Called on EVERY read (`GET /{id}`, list, and every write
    response) — never mutates the stored row (that is `_resnapshot_cost_basis`, save-time only).

    * `AD_HOC` (or a null `ref`) never degrades — there is nothing to resolve (data-model §1).
    * `PRODUCT`/`KIT` whose `ref` resolves to an OWNED, LIVE row ⇒ **D3 live-reflect**: the CURRENT
      resolved values, `degraded: false` — a since-save edit is reflected on THIS read (redirect
      2026-07-20: `api-surface.md` lines 99-102 name BOTH kinds identically — a KIT ref is IN this
      resolver's scope, not T024's; T024 owns only the CLIENT `computeBom` rollup).
    * `PRODUCT`/`KIT` whose `ref` does not resolve (soft-deleted / cross-tenant / never-existed /
      malformed id) ⇒ **D6 last-known**: the STORED `lastKnown` (captured at the last save),
      `degraded: true` — never blank, never "removido", never presented as live (the F1 class).
    """
    kind = cost_basis.get("kind")
    ref = cost_basis.get("ref")
    stored_last_known = cost_basis.get("lastKnown")
    if kind not in ("PRODUCT", "KIT") or not isinstance(ref, dict):
        return {"kind": kind, "ref": ref, "degraded": False, "lastKnown": stored_last_known}
    ref_dict = cast("dict[str, Any]", ref)
    try:
        ref_id = uuid.UUID(str(ref_dict.get("id")))
    except (ValueError, TypeError):
        return {"kind": kind, "ref": ref, "degraded": True, "lastKnown": stored_last_known}
    live = (
        await _resolve_product_last_known(session, uid, ref_id)
        if kind == "PRODUCT"
        else await _resolve_kit_last_known(session, uid, ref_id)
    )
    if live is not None:
        return {"kind": kind, "ref": ref, "degraded": False, "lastKnown": live}
    return {"kind": kind, "ref": ref, "degraded": True, "lastKnown": stored_last_known}


async def _render_out(session: AsyncSession, uid: str, row: Scenario) -> ScenarioOut:
    """The single read-rendering seam (T022): the stored `config`, echoed verbatim EXCEPT
    `costBasis`, which is resolved read-time (D3/D6). Used by every read AND write response
    (`GET /{id}`, list, `POST`, and PR-B's `PUT`/`PATCH`/duplicate) — the contract's "GET /{id}
    (and every write response) returns the resolved-or-degraded basis"."""
    config: dict[str, Any] = dict(row.config)
    cost_basis = config.get("costBasis")
    if isinstance(cost_basis, dict):
        config = {
            **config,
            "costBasis": await _resolve_cost_basis_for_read(
                session, uid, cast("dict[str, Any]", cost_basis)
            ),
        }
    return ScenarioOut(
        id=row.id,
        name=row.name,
        note=row.note,
        config=config,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


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
    items = [await _render_out(session, uid, r) for r in page]
    return ScenarioList(items=items, next_cursor=next_cursor)


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
    return await _render_out(session, uid, row)


@router.get("/scenarios/{scenario_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_scenario(
    scenario_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScenarioOut:
    """Own + not-deleted only (VR-609); `config.costBasis` is resolved read-time (T022, D3/D6);
    every other leaf is served VERBATIM (the seller's intent)."""
    uid: str = claims["uid"]
    row = await _owned(session, uid, scenario_id)
    return await _render_out(session, uid, row)


@router.put(
    "/scenarios/{scenario_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def update_scenario(
    scenario_id: str,
    body: ScenarioIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScenarioOut:
    """T028 — the full-config-edit path (`PUT`, the four-object-map "whole config editable"). The
    submitted `config` REPLACES the stored one wholesale — VR-602/603 re-run on this UPDATE (the
    one operational difference from E4: the row is mutable, so the validators run on every write,
    not once), and the cost basis is re-snapshotted the same way a create is (T011)."""
    uid: str = claims["uid"]
    row = await _owned(session, uid, scenario_id)
    config = await _resnapshot_cost_basis(session, uid, dict(body.config))
    row.name = body.name
    row.note = body.note
    row.config = config
    row.config_schema_version = int(config["schemaVersion"])
    await session.commit()
    await session.refresh(row)
    return await _render_out(session, uid, row)


class RenameIn(CamelModel):
    """`PATCH` body — `name`/`note` ONLY. `extra="forbid"` (not `CamelModel`'s default) so a
    smuggled `config` (or any other) field is an honest 422, never a silent ignore."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid")

    name: str | None = None
    note: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        if v is None:
            return v
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
            return None
        if len(trimmed) > 500:
            raise ValueError("note exceeds the maximum length (500)")
        return trimmed


@router.patch(
    "/scenarios/{scenario_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def rename_scenario(
    scenario_id: str,
    body: RenameIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScenarioOut:
    """T028 — rename only (`name`/`note`); `config` is never touched by this route."""
    uid: str = claims["uid"]
    row = await _owned(session, uid, scenario_id)
    fields_set = body.model_fields_set
    if "name" in fields_set and body.name is not None:
        row.name = body.name
    if "note" in fields_set:
        row.note = body.note
    await session.commit()
    await session.refresh(row)
    return await _render_out(session, uid, row)


@router.post(
    "/scenarios/{scenario_id}/duplicate",
    status_code=status.HTTP_201_CREATED,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def duplicate_scenario(
    scenario_id: str,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ScenarioOut:
    """T026 — VR-608 duplicate independence: a DEEP copy of `config` into a NEW row (new id, own
    name `"Cópia de {name}"`). A separate row BY CONSTRUCTION — editing one changes 0% of the
    other. Materializes nothing (VR-607's twin)."""
    uid: str = claims["uid"]
    original = await _owned(session, uid, scenario_id)
    copy_name = f"Cópia de {original.name}"
    if len(copy_name) > 120:
        copy_name = copy_name[:120]
    copy = Scenario(
        owner_uid=uid,
        name=copy_name,
        note=original.note,
        config=json.loads(json.dumps(original.config)),  # a DEEP, independent copy
        config_schema_version=original.config_schema_version,
    )
    session.add(copy)
    await session.commit()
    await session.refresh(copy)
    return await _render_out(session, uid, copy)


@router.delete(
    "/scenarios/{scenario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def delete_scenario(
    scenario_id: str,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Soft-delete — VOLUNTARY only (a lapse never deletes, VR-610/FR-612)."""
    uid: str = claims["uid"]
    row = await _owned(session, uid, scenario_id)
    row.deleted_at = datetime.now(UTC)
    await session.commit()
