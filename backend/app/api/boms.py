"""US2/US4/US6 (FR-405..409/FR-415/FR-416) — kit (BOM) persistence, server-authoritative.

A *kit* (the user-facing name, K1) is a persisted multi-piece assembly. This module stores its
INPUTS/STRUCTURE and never a price (FR-407): the client recomputes with ``computeBom``
(ADR-0016). Writes pass ``require_entitlement`` (active premium only), reads pass
``require_catalog_read`` (active | lapsed — the Q3 freeze) — ADR-0015.

**Atomic kit-save + materialization (ADR-0017)** is the heart of the write path. ONE transaction:

1. Each line resolves to an OWNED, LIVE product. A ``productId`` line resolves directly (a
   miss is a 422 — the same answer for nonexistent, deleted and cross-tenant ids, so the save
   is never an existence oracle). An **ad-hoc** line (``pieceName`` + the full value-set) is
   **materialized**: an exact ``btrim(name)`` match against the account's live products
   REFERENCES the existing row (``action: "referenced"`` — its live values SUPERSEDE the
   submitted ones), a miss CREATES a manual product (``action: "created"``: refs NULL + the
   full snapshot).
2. The kit + its lines are written, each line re-snapshotting its product's RESOLVED values.
3. A single ``commit()``. Any denial or validation error rolls the whole thing back, so a
   failed save materializes NOTHING (FR-415/SC-411) — the guarantee a client-side two-phase
   save could not make.

The **FR-310 relaxation lives here and only here** (ADR-0017 §2): this service constructs
ref-less manual ``Product`` rows itself and never calls ``create_product``, so the public
``POST /products`` keeps requiring saved filament+printer references. The rows it builds are
exactly the shape the products link-or-snapshot CHECKs already admit — hence no products
migration, and hence a born-manual product and a delete-degraded one are the SAME honest
"needs attention" state (K3), derived from ``filament_id IS NULL OR printer_id IS NULL``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from functools import partial
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, status
from pydantic import Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.naming import NAME_MAX_CHARS, flush_with_unique_name
from app.api.products import (
    ChannelSlot,
    FilamentValues,
    OtherCost,
    PieceInputs,
    PrinterValues,
    ProductIn,
    ProductOut,
    _live_links,  # pyright: ignore[reportPrivateUsage]
)
from app.api.products import (
    _apply as _apply_product,  # pyright: ignore[reportPrivateUsage]
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
from app.lib.name_norm import name_norm_key
from app.models import Bom, BomLine, Product
from app.validation import CEIL_QUANTITY, CEIL_RATE, finite_non_negative

router = APIRouter(tags=["boms"])

#: 019/PR-D (ADR-0033 §4) — o índice único parcial dos KITS. O dos produtos vive em `products.py`
#: e é nomeado aqui porque a materialização passa pelo mesmo helper.
_NAME_INDEX = "uq_boms_owner_name_norm"
_PRODUCT_NAME_INDEX = "uq_products_owner_name_norm"


class BomLineIn(CamelModel):
    """One submitted line: EITHER a live product reference OR a nameable ad-hoc piece.

    The ad-hoc branch carries the whole ``ProductIn`` value-set precisely because it has to
    materialize into a product (ADR-0017/K4) — ``pieceName`` is what that product is called.
    """

    quantity: int
    product_id: uuid.UUID | None = None
    # 019/PR-D (T072): o mesmo teto do nome de produto — uma linha ad-hoc VIRA um produto
    # (`as_product_in`), então um nome que o produto recusaria não pode entrar por aqui: sem este
    # teto o `ProductIn` construído no meio da rota estouraria um `ValidationError` que não é de
    # requisição, e o vendedor receberia 500 no lugar de 422.
    piece_name: str | None = Field(default=None, max_length=NAME_MAX_CHARS)
    piece_inputs: PieceInputs | None = None
    filament_values: FilamentValues | None = None
    printer_values: PrinterValues | None = None
    tariff_per_kwh: Decimal | None = None
    include_marketplace: bool = True
    channels: list[ChannelSlot] = Field(default_factory=list)
    other_costs: list[OtherCost] = Field(default_factory=list)

    @field_validator("quantity")
    @classmethod
    def _quantity(cls, v: int) -> int:
        # `>= 0`, not `> 0` (Q1): a zeroed line is an honest "not in this order", not an error.
        # The upper bound is the int4 column limit (audit E3-02): without it, 2**31 reached the
        # INSERT and Postgres answered `integer out of range` → an opaque 500. INCLUSIVE — the
        # ceiling IS the largest storable count, not the first rejected one.
        if v < 0:
            raise ValueError("quantity must be an integer >= 0")
        if v > CEIL_QUANTITY:
            raise ValueError("quantity exceeds the maximum storable value")
        return v

    @field_validator("tariff_per_kwh")
    @classmethod
    def _tariff(cls, v: Decimal | None) -> Decimal | None:
        # Audit E3-01: this used to check finiteness only, while `ProductIn.tariffPerKwh` — the very
        # model an ad-hoc line materializes INTO — enforced CEIL_RATE. The two rules are now one.
        if v is None:
            return v
        return finite_non_negative(v, "tariffPerKwh", CEIL_RATE)

    @field_validator("piece_name")
    @classmethod
    def _piece_name(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not v.strip():
            raise ValueError("pieceName must not be blank")
        return v.strip()  # trimmed once, here — the dedup key IS this value (ADR-0017 §3)

    @model_validator(mode="after")
    def _reference_xor_ad_hoc(self) -> BomLineIn:
        """Exactly one source of truth per line: a reference OR a complete ad-hoc piece."""
        ad_hoc_fields = (
            self.piece_name,
            self.piece_inputs,
            self.filament_values,
            self.printer_values,
            self.tariff_per_kwh,
        )
        has_any_ad_hoc = any(f is not None for f in ad_hoc_fields)
        if self.product_id is not None:
            if has_any_ad_hoc:
                raise ValueError("a line carries EITHER productId OR an ad-hoc piece, never both")
            return self
        if not has_any_ad_hoc:
            raise ValueError("a line requires productId or an ad-hoc piece")
        # An ad-hoc line MUST be complete — it has to become a real catalog product (K4).
        missing = [
            name
            for name, value in (
                ("pieceName", self.piece_name),
                ("pieceInputs", self.piece_inputs),
                ("filamentValues", self.filament_values),
                ("printerValues", self.printer_values),
                ("tariffPerKwh", self.tariff_per_kwh),
            )
            if value is None
        ]
        if missing:
            raise ValueError(f"an ad-hoc line requires {', '.join(missing)}")
        return self

    def as_product_in(self) -> ProductIn:
        """The ad-hoc value-set IS a ProductIn — this is what makes materialization a one-liner
        (and guarantees a manual product is byte-identical in shape to a degraded one)."""
        if self.piece_name is None or self.piece_inputs is None or self.tariff_per_kwh is None:
            raise _unresolvable("line")  # unreachable — the model validator ran first
        return ProductIn(
            name=self.piece_name,
            filament_id=None,
            printer_id=None,
            filament_values=self.filament_values,
            printer_values=self.printer_values,
            piece_inputs=self.piece_inputs,
            tariff_per_kwh=self.tariff_per_kwh,
            include_marketplace=self.include_marketplace,
            channels=self.channels,
            other_costs=self.other_costs,
        )


class BomIn(CamelModel):
    # 019/PR-D (T072): teto de nome só no pydantic (ADR-0033 §Adendo 27/08 §3).
    name: str = Field(max_length=NAME_MAX_CHARS)
    #: `min_length=1` (owner decision D4, audit E3-04): an empty kit was refused by the client and
    #: accepted by the server — the client's promise now holds at the boundary that enforces it.
    #: This is a real OpenAPI delta (`minItems`), so the contract is regenerated with it.
    lines: list[BomLineIn] = Field(min_length=1)

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be blank")
        return v.strip()


class BomLineOut(CamelModel):
    """A resolved line — self-sufficient for ``computeBom`` (no second round-trip).

    Live product ⇒ every value is resolved from it (which in turn resolves its filament/printer,
    D3). Degraded (``productId`` is null after the product was deleted, D6) ⇒ the values are the
    line's own last-known snapshot, and ``degraded`` says so honestly.
    """

    id: uuid.UUID
    position: int
    quantity: int
    product_id: uuid.UUID | None
    piece_name: str | None
    degraded: bool
    piece_inputs: PieceInputs
    filament_values: FilamentValues
    printer_values: PrinterValues
    tariff_per_kwh: Decimal
    include_marketplace: bool
    channels: list[dict[str, Any]]
    other_costs: list[dict[str, Any]]


class Materialization(CamelModel):
    """What the save DID to a line's catalog product — so the client can say it out loud (K4)."""

    position: int
    product_id: uuid.UUID
    action: Literal["created", "referenced"]


class BomOut(CamelModel):
    id: uuid.UUID
    name: str
    lines: list[BomLineOut]
    created_at: datetime
    updated_at: datetime
    # WRITE responses only — absent on reads (nothing was materialized by a GET).
    materializations: list[Materialization] | None = None


def _not_found() -> AppError:
    return AppError(ErrorCode.NOT_FOUND, "Kit not found", status_code=404)


def _unresolvable(field: str) -> AppError:
    # One answer for nonexistent, soft-deleted and cross-tenant ids — no existence oracle.
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        f"{field} does not resolve to a saved item on this account",
        status_code=422,
    )


async def _owned(session: AsyncSession, uid: str, bom_id: str) -> Bom:
    """Owner-scoped fetch (FR-408): wrong owner, soft-deleted or malformed id → 404."""
    try:
        bid = uuid.UUID(bom_id)
    except ValueError as exc:
        raise _not_found() from exc
    row = (
        await session.execute(
            select(Bom).where(Bom.id == bid, Bom.owner_uid == uid, Bom.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if row is None:
        raise _not_found()
    return row


async def _lines_of(session: AsyncSession, uid: str, bom_id: uuid.UUID) -> list[BomLine]:
    """015/A5 ([F05-002]) — o `uid` entra na CONSULTA, nao so na cabeca de quem chama.

    Antes o filtro era so `bom_id`, e o isolamento vinha HERDADO: todo chamador buscava o kit por
    `(id, owner_uid)` antes, entao na pratica nada vazava. Nao havia defeito — havia dependencia de
    uma disciplina que o proximo chamador nao tem obrigacao de conhecer. O `join` custa nada e move
    a garantia de "todo mundo lembrou" para "a consulta nao devolve linha de outro dono"."""
    return list(
        (
            await session.execute(
                select(BomLine)
                .join(Bom, Bom.id == BomLine.bom_id)
                .where(BomLine.bom_id == bom_id, Bom.owner_uid == uid)
                .order_by(BomLine.position)
            )
        ).scalars()
    )


async def _resolve_product(session: AsyncSession, uid: str, product_id: uuid.UUID) -> Product:
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
        raise _unresolvable("productId")
    return row


async def _dedup_match(session: AsyncSession, uid: str, name: str) -> Product | None:
    """ADR-0017 §3, **emenda datada 2026-08-27** (019/PR-D · T129): o match é por `name_norm`.

    Era trim + EXATO, case-sensitive. Com a unicidade nova (ADR-0033 §4) isso viraria armadilha:
    uma linha ad-hoc "gancho" com um produto vivo "Gancho" NÃO casaria aqui, seguiria para a
    materialização e bateria no índice único — dentro da transação atômica do kit. Casar pela
    MESMA chave que o índice usa é o que faz a referência e a unicidade contarem a mesma história.
    LIVE rows only, como antes: um nome que só casa com produto apagado materializa um NOVO, nunca
    revive um morto (e o índice é parcial pelo mesmo motivo).
    """
    return (
        await session.execute(
            select(Product)
            .where(
                Product.owner_uid == uid,
                Product.deleted_at.is_(None),
                Product.name_norm == name_norm_key(name),
            )
            .order_by(Product.created_at)
            .limit(1)
        )
    ).scalar_one_or_none()


def _snapshot_line(line: BomLine, resolved: ProductOut) -> None:
    """Re-snapshot the line from its product's RESOLVED values, on every write. This is what
    makes a later D6 degradation lossless — the last-known copy is never stale."""
    line.product_id = resolved.id
    piece = resolved.piece_inputs
    line.print_grams = piece.print_grams
    line.print_time_hours = piece.print_time_hours
    line.failure_pct = piece.failure_pct
    line.finish_time_hours = piece.finish_time_hours
    line.finish_rate_per_hour = piece.finish_rate_per_hour
    line.labor_hours = piece.labor_hours
    line.labor_rate_per_hour = piece.labor_rate_per_hour
    line.markup_varejo_pct = piece.markup_varejo_pct
    line.markup_atacado_pct = piece.markup_atacado_pct
    line.tariff_per_kwh = resolved.tariff_per_kwh
    line.include_marketplace = resolved.include_marketplace
    line.filament_material = resolved.filament_values.material
    line.filament_cost_per_roll = resolved.filament_values.cost_per_roll
    line.filament_roll_weight_kg = resolved.filament_values.roll_weight_kg
    line.printer_machine_value = resolved.printer_values.machine_value
    line.printer_machine_lifetime_hours = resolved.printer_values.machine_lifetime_hours
    line.printer_avg_power_kw = resolved.printer_values.avg_power_kw
    line.printer_maintenance_reserve_per_hour = resolved.printer_values.maintenance_reserve_per_hour
    line.channels = list(resolved.channels)
    line.other_costs = list(resolved.other_costs)


async def _resolve_views(
    session: AsyncSession, uid: str, product_ids: set[uuid.UUID]
) -> dict[uuid.UUID, ProductOut]:
    """Resolve MANY products to their value-sets in a BOUNDED number of queries (one for the
    products, one for filaments, one for printers) — the batched replacement for a per-line N+1
    in the read path.

    Owner-scoped and LIVE-only BY CONSTRUCTION: a soft-deleted or cross-tenant ``product_id`` is
    simply absent from the returned map, so its line degrades to its last-known snapshot (D6).
    This is the single place the read path decides "still live vs degraded", and it now agrees
    with the write path's ``_resolve_product`` (same ``owner_uid`` + ``deleted_at`` filter) —
    the disagreement that used to serve a deleted product as live and then 422 the re-save.
    """
    if not product_ids:
        return {}
    products = list(
        (
            await session.execute(
                select(Product).where(
                    Product.id.in_(product_ids),
                    Product.owner_uid == uid,
                    Product.deleted_at.is_(None),
                )
            )
        ).scalars()
    )
    filaments, printers = await _live_links(session, uid, products)
    return {
        p.id: _product_to_out(
            p,
            filaments.get(p.filament_id) if p.filament_id else None,
            printers.get(p.printer_id) if p.printer_id else None,
        )
        for p in products
    }


async def _lines_by_bom(
    session: AsyncSession, uid: str, bom_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[BomLine]]:
    """All lines for many kits in ONE ordered query — keeps ``list_boms`` at a flat query count
    instead of one SELECT per kit. O `uid` entra na consulta por [F05-002] (ver `_lines_of`)."""
    if not bom_ids:
        return {}
    out: dict[uuid.UUID, list[BomLine]] = {bid: [] for bid in bom_ids}
    rows = (
        await session.execute(
            select(BomLine)
            .join(Bom, Bom.id == BomLine.bom_id)
            .where(BomLine.bom_id.in_(bom_ids), Bom.owner_uid == uid)
            .order_by(BomLine.bom_id, BomLine.position)
        )
    ).scalars()
    for line in rows:
        out[line.bom_id].append(line)
    return out


async def _materialize(
    session: AsyncSession,
    uid: str,
    body: BomIn,
) -> tuple[list[Product], list[Materialization]]:
    """Resolve every line to an owned live product, materializing ad-hoc pieces (ADR-0017 §1).

    Nothing is committed here — the caller owns the single transaction, which is precisely what
    makes a later failure roll the materialized products back with it.
    """
    resolved: list[Product] = []
    materializations: list[Materialization] = []
    # Same-name ad-hoc lines within ONE save must share one product — the in-txn map is what
    # stops a two-line kit from creating the piece twice (a flush-less SELECT would not see it).
    minted: dict[str, Product] = {}

    for position, line in enumerate(body.lines):
        if line.product_id is not None:
            resolved.append(await _resolve_product(session, uid, line.product_id))
            continue

        name = line.piece_name or ""  # non-blank by the validator
        # 019/PR-D (T129): a chave do mapa é a MESMA do dedup e do índice — duas linhas ad-hoc do
        # mesmo save escritas "Gancho" e "gancho " são a mesma peça, e criar duas bateria no índice.
        existing = minted.get(name_norm_key(name)) or await _dedup_match(session, uid, name)
        if existing is not None:
            # The reference wins: the submitted typed values are SUPERSEDED by the live ones.
            resolved.append(existing)
            materializations.append(
                Materialization(position=position, product_id=existing.id, action="referenced")
            )
            continue

        product = Product(owner_uid=uid)
        # Refs NULL + the full snapshot — the shape the products CHECKs already admit, and the
        # honest "needs attention" state (K3) until a saved filament + printer are linked.
        # 019/PR-D (T072/T065): o flush do produto acontece em SAVEPOINT. Um conflito de nome com
        # uma criação CONCORRENTE (o dedup acima não vê a linha que a outra transação ainda não
        # commitou) custa uma renomeação "(2)"; sem o savepoint ele abortaria a transação atômica
        # do kit inteiro (ADR-0017) e o vendedor perderia o save por causa de um nome.
        product_in = line.as_product_in()
        await flush_with_unique_name(
            session,
            product,
            product_in.name,
            index_name=_PRODUCT_NAME_INDEX,
            apply=partial(_apply_product, product, product_in, None, None),
        )  # o flush do helper já atribui o PK para a linha referenciar nesta mesma txn
        minted[name_norm_key(name)] = product
        resolved.append(product)
        materializations.append(
            Materialization(position=position, product_id=product.id, action="created")
        )

    return resolved, materializations


async def _write_lines(
    session: AsyncSession, bom: Bom, body: BomIn, products: list[Product]
) -> list[BomLine]:
    # Resolve every line's product ONCE (batched), then snapshot from the map — the write path's
    # last-known copy is what makes a later D6 degradation lossless, so it must be the same
    # resolved view the read path serves.
    views = await _resolve_views(session, bom.owner_uid, {p.id for p in products})
    lines: list[BomLine] = []
    for position, (line_in, product) in enumerate(zip(body.lines, products, strict=True)):
        line = BomLine(bom_id=bom.id, position=position, quantity=line_in.quantity)
        _snapshot_line(line, views[product.id])
        session.add(line)
        lines.append(line)
    return lines


def _degraded_or(value: Decimal | None, fallback: str) -> Decimal:
    """Preserve a STORED zero verbatim and substitute ONLY on a genuine NULL. A plain
    ``x or Decimal("0")`` corrupts ``Decimal("0.000")`` (which is falsy) to ``Decimal("0")``,
    dropping the column scale and breaking byte-identity with a degraded PRODUCT built from the
    same snapshot (SC-305; caught by test_degraded_kit_line_serves_the_same_values...). On a
    persisted line these are always non-null (``_snapshot_line`` writes them all) — defensive only.
    """
    return value if value is not None else Decimal(fallback)


def _to_out(
    bom: Bom,
    lines: list[BomLine],
    views: dict[uuid.UUID, ProductOut],
    materializations: list[Materialization] | None = None,
) -> BomOut:
    """Serialize a kit from its lines + a pre-resolved product map. A line whose product is
    absent from ``views`` (soft-deleted, D6) falls into the degraded branch — the read path's
    single live-vs-degraded decision lives in ``_resolve_views``, never here."""
    out_lines: list[BomLineOut] = []
    for line in lines:
        resolved = views.get(line.product_id) if line.product_id is not None else None
        if resolved is not None:
            out_lines.append(
                BomLineOut(
                    id=line.id,
                    position=line.position,
                    quantity=line.quantity,
                    product_id=resolved.id,
                    piece_name=resolved.name,
                    degraded=False,
                    piece_inputs=resolved.piece_inputs,
                    filament_values=resolved.filament_values,
                    printer_values=resolved.printer_values,
                    tariff_per_kwh=resolved.tariff_per_kwh,
                    include_marketplace=resolved.include_marketplace,
                    channels=resolved.channels,
                    other_costs=resolved.other_costs,
                )
            )
            continue

        # Degraded (D6): the referenced product is gone — the last-known snapshot takes over and
        # stays editable. It has no name of its own; the UI shows the honest "— Manual —" state.
        # `_degraded_or` guards byte-identity (see its docstring).
        out_lines.append(
            BomLineOut(
                id=line.id,
                position=line.position,
                quantity=line.quantity,
                product_id=None,
                piece_name=None,
                degraded=True,
                piece_inputs=PieceInputs(
                    print_grams=_degraded_or(line.print_grams, "0"),
                    print_time_hours=_degraded_or(line.print_time_hours, "0"),
                    failure_pct=_degraded_or(line.failure_pct, "0"),
                    finish_time_hours=_degraded_or(line.finish_time_hours, "0"),
                    finish_rate_per_hour=_degraded_or(line.finish_rate_per_hour, "0"),
                    labor_hours=_degraded_or(line.labor_hours, "0"),
                    labor_rate_per_hour=_degraded_or(line.labor_rate_per_hour, "0"),
                    markup_varejo_pct=_degraded_or(line.markup_varejo_pct, "0"),
                    markup_atacado_pct=_degraded_or(line.markup_atacado_pct, "0"),
                ),
                filament_values=FilamentValues(
                    material=line.filament_material,
                    cost_per_roll=_degraded_or(line.filament_cost_per_roll, "0"),
                    roll_weight_kg=_degraded_or(line.filament_roll_weight_kg, "1"),
                ),
                printer_values=PrinterValues(
                    machine_value=_degraded_or(line.printer_machine_value, "0"),
                    machine_lifetime_hours=_degraded_or(line.printer_machine_lifetime_hours, "1"),
                    avg_power_kw=_degraded_or(line.printer_avg_power_kw, "0"),
                    maintenance_reserve_per_hour=_degraded_or(
                        line.printer_maintenance_reserve_per_hour, "0"
                    ),
                ),
                tariff_per_kwh=_degraded_or(line.tariff_per_kwh, "0"),
                include_marketplace=line.include_marketplace,
                channels=line.channels,
                other_costs=line.other_costs,
            )
        )

    return BomOut(
        id=bom.id,
        name=bom.name,
        lines=out_lines,
        created_at=bom.created_at,
        updated_at=bom.updated_at,
        materializations=materializations,
    )


@router.get("/boms", responses=ENTITLEMENT_ERRORS)
async def list_boms(
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[BomOut]:
    uid = claims["uid"]
    rows = list(
        (
            await session.execute(
                select(Bom)
                .where(Bom.owner_uid == uid, Bom.deleted_at.is_(None))
                .order_by(Bom.created_at)
            )
        ).scalars()
    )
    # Flat query count regardless of how many kits: 1 (boms) + 1 (all lines) + 3 (products +
    # filaments + printers), never one round-trip per line — the old shape scaled AGAINST the
    # premium seller (more kits ⇒ slower list).
    lines_by_bom = await _lines_by_bom(session, uid, [b.id for b in rows])
    product_ids = {
        line.product_id
        for lines in lines_by_bom.values()
        for line in lines
        if line.product_id is not None
    }
    views = await _resolve_views(session, uid, product_ids)
    return [_to_out(bom, lines_by_bom[bom.id], views) for bom in rows]


@router.post(
    "/boms",
    status_code=status.HTTP_201_CREATED,
    responses={**ENTITLEMENT_ERRORS, **VALIDATION_ERRORS},
)
async def create_bom(
    body: BomIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BomOut:
    uid = claims["uid"]
    # ONE transaction (ADR-0017 §1): materialize → write → commit. A raise anywhere before the
    # commit takes the materialized products down with it (FR-415/SC-411).
    products, materializations = await _materialize(session, uid, body)
    bom = Bom(owner_uid=uid)
    # O nome do KIT também é único por conta (ADR-0033 §4) — e o helper já faz o flush que
    # atribui o PK que as linhas referenciam.
    await flush_with_unique_name(session, bom, body.name, index_name=_NAME_INDEX)
    await _write_lines(session, bom, body, products)
    await session.commit()
    await session.refresh(bom)
    return await _rendered(session, uid, bom, materializations)


async def _rendered(
    session: AsyncSession,
    uid: str,
    bom: Bom,
    materializations: list[Materialization] | None = None,
) -> BomOut:
    """Load a single kit's lines + resolve their products (batched), then serialize."""
    lines = await _lines_of(session, bom.owner_uid, bom.id)
    views = await _resolve_views(
        session, uid, {line.product_id for line in lines if line.product_id is not None}
    )
    return _to_out(bom, lines, views, materializations)


@router.get("/boms/{bom_id}", responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS})
async def get_bom(
    bom_id: str,
    claims: Annotated[dict[str, Any], Depends(require_catalog_read)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BomOut:
    bom = await _owned(session, claims["uid"], bom_id)
    return await _rendered(session, claims["uid"], bom)


@router.put(
    "/boms/{bom_id}",
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS, **VALIDATION_ERRORS},
)
async def update_bom(
    bom_id: str,
    body: BomIn,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> BomOut:
    uid = claims["uid"]
    bom = await _owned(session, uid, bom_id)
    products, materializations = await _materialize(session, uid, body)
    # A renomeação segue a MESMA regra da criação; a linha chega limpa ao helper, que é o que
    # permite o retry em savepoint (ver `app/api/naming.py`).
    await flush_with_unique_name(session, bom, body.name, index_name=_NAME_INDEX)
    # Replace semantics: the submitted lines ARE the kit (positions are re-derived from order).
    for line in await _lines_of(session, bom.owner_uid, bom.id):
        await session.delete(line)
    await session.flush()
    await _write_lines(session, bom, body, products)
    await session.commit()
    await session.refresh(bom)
    return await _rendered(session, uid, bom, materializations)


@router.delete(
    "/boms/{bom_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={**ENTITLEMENT_ERRORS, **NOT_FOUND_ERRORS},
)
async def delete_bom(
    bom_id: str,
    claims: Annotated[dict[str, Any], Depends(require_entitlement)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    bom = await _owned(session, claims["uid"], bom_id)
    bom.deleted_at = datetime.now(UTC)  # soft-delete — VOLUNTARY only (a lapse never deletes)
    await session.commit()
