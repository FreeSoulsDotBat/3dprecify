"""The shared catalog resolver/serializer — products ↔ kits ↔ cenários.

`products.py`, `boms.py` and `scenarios.py` all need the SAME answer to "what does this
product/kit resolve to right now" (the D3 live-reflect / D6 last-known rule, ADR-0017/ADR-0021):
a live-linked filament/printer wins over the row's own snapshot columns, and a kit line degrades
one level down the same way. Before this module existed, `scenarios.py` and `boms.py` imported
these helpers PRIVATELY off each other's routers (`_to_out`, `_apply`, `_live_links`,
`_degraded_or`, `_lines_of`, `_resolve_views`) — any refactor of `products.py`/`boms.py` could
silently break kits/cenários. This module is their one public home instead. It lives under
`app/api/` (not `services/`) because it constructs `ProductOut`, a Pydantic Out model, and
`services → api` imports are forbidden by the import-linter contract.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError, ErrorCode
from app.lib.name_norm import name_norm_key
from app.models import Bom, BomLine, Filament, Printer, Product

if TYPE_CHECKING:
    from app.api.products import ProductIn, ProductOut


def _unresolvable(field: str) -> AppError:
    # Same 422 for nonexistent, soft-deleted and cross-tenant ids — no existence oracle. Mirrors
    # `products.py::_unresolvable`/`boms.py::_unresolvable` verbatim (pre-existing duplication,
    # out of this module's scope) — used here only by `apply_product`'s two unreachable branches.
    return AppError(
        ErrorCode.VALIDATION_ERROR,
        f"{field} does not resolve to a saved item on this account",
        status_code=422,
    )


async def live_links(
    session: AsyncSession, uid: str, rows: list[Product]
) -> tuple[dict[uuid.UUID, Filament], dict[uuid.UUID, Printer]]:
    """Load the live rows the products link to (deleted links degrade in the delete txn, so a
    present link points at a live row; missing rows simply fall back to the columns).

    ``uid`` is REQUIRED (audit finding E2-03, 2026-07-23): this used to select by ID alone, the one
    query in the read path without an ``owner_uid`` predicate. The write path never lets a product
    point at another account's reference, so the hole was latent — but "unreachable by today's
    writers" is not tenant isolation, and this is the function that decides which values a product
    RENDERS. Scoped, an out-of-tenant link simply does not resolve and the product falls back to its
    own snapshot columns, which is the same honest degradation a deleted link already gets."""
    fil_ids = {r.filament_id for r in rows if r.filament_id is not None}
    prn_ids = {r.printer_id for r in rows if r.printer_id is not None}
    filaments: dict[uuid.UUID, Filament] = {}
    printers: dict[uuid.UUID, Printer] = {}
    if fil_ids:
        for f in (
            await session.execute(
                select(Filament).where(Filament.id.in_(fil_ids), Filament.owner_uid == uid)
            )
        ).scalars():
            filaments[f.id] = f
    if prn_ids:
        for p in (
            await session.execute(
                select(Printer).where(Printer.id.in_(prn_ids), Printer.owner_uid == uid)
            )
        ).scalars():
            printers[p.id] = p
    return filaments, printers


def product_to_out(row: Product, filament: Filament | None, printer: Printer | None) -> ProductOut:
    """Serialize with the D3 resolution rule: linked ⇒ the LIVE row wins; degraded ⇒ columns."""
    # Local import (not TYPE_CHECKING-only): these are RUNTIME constructions below, and importing
    # them at module top would cycle with `products.py` importing `product_to_out` from here. By
    # call time (a request handler, long after app startup) `products.py` is always fully loaded.
    from app.api.products import (
        ChannelSlot,
        FilamentValues,
        OtherCost,
        PieceInputs,
        PrinterValues,
        ProductOut,
    )

    if filament is not None:
        filament_values = FilamentValues(
            material=filament.material,
            cost_per_roll=filament.cost_per_roll,
            roll_weight_kg=filament.roll_weight_kg,
        )
    else:
        filament_values = FilamentValues(
            material=row.filament_material,
            cost_per_roll=row.filament_cost_per_roll or Decimal("0"),
            roll_weight_kg=row.filament_roll_weight_kg or Decimal("1"),
        )
    if printer is not None:
        printer_values = PrinterValues(
            machine_value=printer.machine_value,
            machine_lifetime_hours=printer.machine_lifetime_hours,
            avg_power_kw=printer.avg_power_kw,
            maintenance_reserve_per_hour=printer.maintenance_reserve_per_hour,
        )
    else:
        printer_values = PrinterValues(
            machine_value=row.printer_machine_value or Decimal("0"),
            machine_lifetime_hours=row.printer_machine_lifetime_hours or Decimal("1"),
            avg_power_kw=row.printer_avg_power_kw or Decimal("0"),
            maintenance_reserve_per_hour=row.printer_maintenance_reserve_per_hour or Decimal("0"),
        )
    return ProductOut(
        id=row.id,
        name=row.name,
        filament_id=row.filament_id,
        printer_id=row.printer_id,
        filament_values=filament_values,
        printer_values=printer_values,
        piece_inputs=PieceInputs(
            print_grams=row.print_grams,
            print_time_hours=row.print_time_hours,
            failure_pct=row.failure_pct,
            finish_time_hours=row.finish_time_hours,
            finish_rate_per_hour=row.finish_rate_per_hour,
            labor_hours=row.labor_hours,
            labor_rate_per_hour=row.labor_rate_per_hour,
            markup_varejo_pct=row.markup_varejo_pct,
            markup_atacado_pct=row.markup_atacado_pct,
        ),
        tariff_per_kwh=row.tariff_per_kwh,
        include_marketplace=row.include_marketplace,
        # As colunas JSONB guardam exatamente o dump destes dois modelos (`apply_product` abaixo),
        # então revalidá-las na leitura é reler a MESMA forma, não impor uma nova. O ganho é que a
        # forma do dinheiro passa a ter uma fonte só, da entrada à saída e ao contrato gerado.
        channels=[ChannelSlot.model_validate(c) for c in row.channels],
        other_costs=[OtherCost.model_validate(c) for c in row.other_costs],
        seller_fixed_price=row.seller_fixed_price,
        seller_fixed_at=row.seller_fixed_at,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def apply_product(
    row: Product, body: ProductIn, filament: Filament | None, printer: Printer | None
) -> None:
    """Write body → row. Linked refs re-snapshot from the LIVE row (D3 write rule (a));
    degraded refs persist the submitted editable overrides (US6-4)."""
    # 019/PR-D (T072, ADR-0033 §4): este é o FUNIL de nome dos produtos — POST, PUT e a
    # materialização de kit passam todos por aqui. `name_norm` é derivada agora, e o nome FINAL
    # (com sufixo, se houver conflito) é escrito por `flush_with_unique_name`, que chama esta
    # função de dentro do savepoint.
    row.name = body.name
    row.name_norm = name_norm_key(body.name)
    piece = body.piece_inputs
    row.print_grams = piece.print_grams
    row.print_time_hours = piece.print_time_hours
    row.failure_pct = piece.failure_pct
    row.finish_time_hours = piece.finish_time_hours
    row.finish_rate_per_hour = piece.finish_rate_per_hour
    row.labor_hours = piece.labor_hours
    row.labor_rate_per_hour = piece.labor_rate_per_hour
    row.markup_varejo_pct = piece.markup_varejo_pct
    row.markup_atacado_pct = piece.markup_atacado_pct
    row.tariff_per_kwh = body.tariff_per_kwh
    row.include_marketplace = body.include_marketplace
    # JSON mode dumps Decimal as string — money never becomes a JSON float (ADR-0008).
    row.channels = [c.model_dump(mode="json", by_alias=True) for c in body.channels]
    row.other_costs = [c.model_dump(mode="json", by_alias=True) for c in body.other_costs]

    if filament is not None:
        row.filament_id = filament.id
        row.filament_material = filament.material
        row.filament_cost_per_roll = filament.cost_per_roll
        row.filament_roll_weight_kg = filament.roll_weight_kg
    else:
        values = body.filament_values
        if values is None:  # unreachable — enforced by the link-or-snapshot model validator
            raise _unresolvable("filamentId")
        row.filament_id = None
        row.filament_material = values.material
        row.filament_cost_per_roll = values.cost_per_roll
        row.filament_roll_weight_kg = values.roll_weight_kg

    if printer is not None:
        row.printer_id = printer.id
        row.printer_machine_value = printer.machine_value
        row.printer_machine_lifetime_hours = printer.machine_lifetime_hours
        row.printer_avg_power_kw = printer.avg_power_kw
        row.printer_maintenance_reserve_per_hour = printer.maintenance_reserve_per_hour
    else:
        pvalues = body.printer_values
        if pvalues is None:  # unreachable — enforced by the link-or-snapshot model validator
            raise _unresolvable("printerId")
        row.printer_id = None
        row.printer_machine_value = pvalues.machine_value
        row.printer_machine_lifetime_hours = pvalues.machine_lifetime_hours
        row.printer_avg_power_kw = pvalues.avg_power_kw
        row.printer_maintenance_reserve_per_hour = pvalues.maintenance_reserve_per_hour


async def lines_of(session: AsyncSession, uid: str, bom_id: uuid.UUID) -> list[BomLine]:
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


async def resolve_views(
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
    filaments, printers = await live_links(session, uid, products)
    return {
        p.id: product_to_out(
            p,
            filaments.get(p.filament_id) if p.filament_id else None,
            printers.get(p.printer_id) if p.printer_id else None,
        )
        for p in products
    }


def degraded_or(value: Decimal | None, fallback: str) -> Decimal:
    """Preserve a STORED zero verbatim and substitute ONLY on a genuine NULL. A plain
    ``x or Decimal("0")`` corrupts ``Decimal("0.000")`` (which is falsy) to ``Decimal("0")``,
    dropping the column scale and breaking byte-identity with a degraded PRODUCT built from the
    same snapshot (SC-305; caught by test_degraded_kit_line_serves_the_same_values...). On a
    persisted line these are always non-null (``_snapshot_line`` writes them all) — defensive only.
    """
    return value if value is not None else Decimal(fallback)
