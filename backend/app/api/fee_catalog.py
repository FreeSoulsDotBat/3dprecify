"""Public GET /api/v1/fee-catalog — serves the committed fee catalog (ADR-0010, R6=a).

Data only, never computes a price (FR-118). Public, unauthenticated, never a gate (FR-117 /
Constitution IV — no ``current_claims`` dependency). Serves the versioned artifact
``app/data/catalog.json`` (bundled beside the app, COPYed into the image with ``app``) with an ETag;
a matching ``If-None-Match`` yields 304. The payload shape mirrors the client Zod schema
(apps/web/src/shared/fee-catalog).
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Header, Response, status
from pydantic import Field

from app.errors import CamelModel

router = APIRouter(tags=["fee-catalog"])

# backend/app/api/fee_catalog.py → parents[1] == backend/app; the artifact lives beside the
# app at app/data/catalog.json. `COPY app ./app` carries it into the image, so this path is
# IDENTICAL in the repo and the container — no Docker/CI/deploy build-context change
# (placement decided with owner 2026-07-07).
_CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "catalog.json"


class FixedFeeRule(CamelModel):
    """How a band's FIXED fee forms (016/PR-F, ADR-0027 §3.1). ABSENT = the ``fixed_fee`` constant.

    Data in transit, like ``band_mode``: this service never computes with it (FR-118). Dropping it
    would silently turn "half the price below R$ 8" back into a R$ 4,00 constant — a fee the source
    does not charge there, under a "Referência" seal.
    """

    kind: Literal["PCT_OF_PRICE"]
    pct: float


class PriceBand(CamelModel):
    min_price: float
    max_price: float | None
    commission_pct: float | None
    fixed_fee: float | None
    fixed_fee_rule: FixedFeeRule | None = None


class FreightNone(CamelModel):
    kind: Literal["NONE"]


class FreightEstimate(CamelModel):
    kind: Literal["ESTIMATE"]
    threshold_price: float
    default_subsidy: float
    inputs: list[str] | None = None


class VoucherBand(CamelModel):
    """DEPRECATED 2026-08-07 (hotfix 016/A2). See ``FreightBandVoucher``."""

    min_price: float
    max_price: float | None
    voucher_ceiling: float


class FreightBandVoucher(CamelModel):
    """DEPRECATED 2026-08-07 (hotfix 016/A2) — no emitters left, never removed.

    The served catalog no longer carries this shape: the verbatim sources (art. 26839 + art. 23431)
    attribute the R$ 20/30/40 free-shipping coupon to SHOPEE ("A Shopee oferece subsidios de frete
    para todos os vendedores"), and the value is the coupon's validity CEILING, not a seller charge.
    Both Shopee entries are ``{"kind": "NONE"}`` now, and the subsidy is published as
    ``FreightSubsidyInfo`` (non-computing information).

    Kept readable because the shape travels inside frozen snapshot payloads (ADR-0019, immutable by
    DB trigger) and saved scenario documents (ADR-0021). A model that stopped accepting it would
    make a document the product promises immutable fail to open.
    """

    kind: Literal["BAND_VOUCHER"]
    bands: list[VoucherBand]


Freight = Annotated[
    FreightNone | FreightEstimate | FreightBandVoucher,
    Field(discriminator="kind"),
]


class CategoryNode(CamelModel):
    """One node of a marketplace's category spine (014). Flat + `parent_id` — the client walks the
    ancestor chain, because commission is piecewise-constant down the tree and ~87.5% of nodes
    inherit (ADR-0010 §A13/§A14)."""

    id: str
    name: str
    parent_id: str | None = None


class FixedFeeSource(CamelModel):
    """016/US14 — provenance of the FIXED fee when it does not come from the entry's own page.

    Amazon publishes the referral commission on Seller Central and the Individual plan's per-item
    charge on venda.amazon.com.br/precos. One ``source_url`` would point the seller at a page that
    does not contain the number they are looking at.
    """

    source: str
    source_url: str
    effective_date: str


class OptionalSurcharge(CamelModel):
    """016/US16 — a seller-DECLARED optional cost the marketplace publishes (Shopee: bulky-item
    handling, R$ 50,00 per ORDER). Marketplace-level: it is not keyed by profile or price band."""

    id: str
    label: str
    value: float
    applies_per: Literal["ORDER", "ITEM"]
    source: str
    source_url: str
    effective_date: str
    last_reviewed: str


class FreightSubsidyBand(CamelModel):
    min_price: float
    max_price: float | None
    ceiling: float


class FreightSubsidyInfo(CamelModel):
    """hotfix 016/A2 — the Shopee free-shipping subsidy as INFORMATION, never as a charge.

    Marketplace-level (same precedent as ``optional_surcharges``): the Programa de Frete Gratis is
    universal ("Todos os vendedores tem os beneficios"), not keyed by profile or price band.

    NON-COMPUTING by construction on both sides: this service never computes (FR-118) and no client
    consumer feeds it into the engine. It is a NEW FIELD rather than a new ``Freight`` union member
    on purpose — a new ``kind`` on the wire would make an already-installed PWA client reject the
    WHOLE catalog, silently (it falls back to the bundled seed and nobody sees an error), while an
    extra object property is simply dropped by the old client, which then reads
    ``freight: {"kind": "NONE"}`` — the new truth.

    And, the lesson this file has now learned four times (``category_spine``, ``band_mode``,
    ``fee_axes``, ``optional_surcharges``): a response model is an allowlist, so a field it does not
    know is a field it EATS. ``test_fee_catalog_drops_no_field_from_the_artifact`` caught this one
    red before the model existed.
    """

    bands: list[FreightSubsidyBand]
    source: str
    source_url: str
    effective_date: str
    last_reviewed: str


class FeeEntry(CamelModel):
    determinants: dict[str, str] | None
    commission_pct: float | None
    fixed_fee: float | None
    fixed_fee_source: FixedFeeSource | None = None
    min_per_item: float | None = None
    price_bands: list[PriceBand] | None = None
    # How the bands combine (ADR-0024). ABSENT = "SELECTION". This field is DATA IN TRANSIT for this
    # service — it never computes with it (FR-118: the backend serves, pricing-core computes) — but
    # dropping it silently degrades a per-portion commission into a per-price-band one and
    # understates the seller's fee. A field this service does not understand is still a
    # field it must not eat.
    band_mode: Literal["SELECTION", "PROGRESSIVE"] | None = None
    freight: Freight
    source: str
    source_url: str
    effective_date: str
    last_reviewed: str


class MarketplaceCatalog(CamelModel):
    marketplace: Literal["MERCADO_LIVRE", "AMAZON", "SHOPEE"]
    determinants_schema: dict[str, Any] | None = None
    # 014: WITHOUT this the served payload carries category-keyed entries and no way to NAME them —
    # the client's picker renders empty, and choosing a category becomes impossible through
    # the served path even with the backend healthy. The offline seed hid it; only the live
    # app showed it.
    category_spine: list[CategoryNode] | None = None
    # 016/US12 (T051, FR-918) — which of the 4 fee fields this marketplace's channel section shows.
    # ABSENT = all four (I4). Same lesson as `category_spine`/`band_mode` above: a response model is
    # an allowlist, and a field it does not know is a field it silently drops — this one was caught
    # by `test_fee_catalog_drops_no_field_from_the_artifact` (the guard those two fixes wrote).
    fee_axes: list[Literal["commissionPct", "fixedFee", "minPerItem", "freightCost"]] | None = None
    # 016/US16 (FR-923) — ABSENT/null = none. Same allowlist lesson as the three fields above, and
    # this one carries R$ 50,00: a response model that does not know a field EATS it, and the
    # checkbox would render with nothing behind it.
    optional_surcharges: list[OptionalSurcharge] | None = None
    # hotfix 016/A2 (2026-08-07) — ABSENT/null = no subsidy to inform, which is what every catalog
    # from before this hotfix means. Non-computing: it exists so the seller KNOWS Shopee subsidises
    # freight, without a coupon validity ceiling ever becoming arithmetic again.
    freight_subsidy_info: FreightSubsidyInfo | None = None
    entries: list[FeeEntry]


class FeeCatalog(CamelModel):
    catalog_version: str
    schema_version: str
    generated_at: str
    marketplaces: list[MarketplaceCatalog]


def _load() -> tuple[FeeCatalog, str]:
    raw = _CATALOG_PATH.read_bytes()
    etag = '"' + hashlib.sha256(raw).hexdigest()[:32] + '"'
    return FeeCatalog.model_validate_json(raw), etag


@router.get(
    "/fee-catalog",
    response_model=FeeCatalog,
    responses={status.HTTP_304_NOT_MODIFIED: {"description": "ETag matched — not modified"}},
)
async def get_fee_catalog(
    response: Response,
    if_none_match: Annotated[str | None, Header()] = None,
) -> Response | FeeCatalog:
    catalog, etag = _load()
    if if_none_match == etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={"ETag": etag, "Cache-Control": "public, max-age=300"},
        )
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "public, max-age=300"
    return catalog
