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

# backend/app/api/fee_catalog.py → parents[1] == backend/app; the artifact lives beside the app at
# app/data/catalog.json. `COPY app ./app` carries it into the image, so this path is IDENTICAL in the
# repo and the container — no Docker/CI/deploy build-context change (placement decided w/ owner 2026-07-07).
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


class FeeEntry(CamelModel):
    determinants: dict[str, str] | None
    commission_pct: float | None
    fixed_fee: float | None
    min_per_item: float | None = None
    price_bands: list[PriceBand] | None = None
    freight: Freight
    source: str
    source_url: str
    effective_date: str
    last_reviewed: str


class MarketplaceCatalog(CamelModel):
    marketplace: Literal["MERCADO_LIVRE", "AMAZON", "SHOPEE"]
    determinants_schema: dict[str, Any] | None = None
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
