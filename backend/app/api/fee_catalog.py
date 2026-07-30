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


class PriceBand(CamelModel):
    min_price: float
    max_price: float | None
    commission_pct: float | None
    fixed_fee: float | None


class FreightNone(CamelModel):
    kind: Literal["NONE"]


class FreightEstimate(CamelModel):
    kind: Literal["ESTIMATE"]
    threshold_price: float
    default_subsidy: float
    inputs: list[str] | None = None


class VoucherBand(CamelModel):
    min_price: float
    max_price: float | None
    voucher_ceiling: float


class FreightBandVoucher(CamelModel):
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


class FeeEntry(CamelModel):
    determinants: dict[str, str] | None
    commission_pct: float | None
    fixed_fee: float | None
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
