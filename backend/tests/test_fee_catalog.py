"""Contract test for the public GET /api/v1/fee-catalog (T009b).

Validates the wire contract end-to-end: public (no auth), a camelCase body that round-trips through
the served Pydantic schema, an ETag + 304 on revalidation, and DATA ONLY (the served catalogVersion
matches the committed artifact; no computed price fields). Since 006/A21, ``test_conformance.py``
runs Schemathesis over EVERY published operation (this one included) — this hand-written test no
longer substitutes for it; it complements it with the semantic assertions Schemathesis cannot know
(catalog↔artifact equality, no-price-fields, cache semantics).
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.fee_catalog import FeeCatalog

_CATALOG_PATH = Path(__file__).resolve().parents[1] / "app" / "data" / "catalog.json"


def test_fee_catalog_is_public_and_camelcase(client: TestClient) -> None:
    # No Authorization header — the endpoint must NOT gate (FR-117 / Constitution IV).
    res = client.get("/api/v1/fee-catalog")
    assert res.status_code == 200
    body = res.json()
    # camelCase wire keys (alias_generator), not snake_case.
    assert "catalogVersion" in body
    assert "schemaVersion" in body
    assert "marketplaces" in body
    assert "catalog_version" not in body
    # The body validates against the served schema (round-trip).
    FeeCatalog.model_validate(body)


def test_fee_catalog_serves_the_committed_artifact(client: TestClient) -> None:
    disk = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
    body = client.get("/api/v1/fee-catalog").json()
    assert body["catalogVersion"] == disk["catalogVersion"]
    assert body["schemaVersion"] == disk["schemaVersion"]
    assert [m["marketplace"] for m in body["marketplaces"]] == [
        m["marketplace"] for m in disk["marketplaces"]
    ]


def test_fee_catalog_etag_and_304(client: TestClient) -> None:
    res = client.get("/api/v1/fee-catalog")
    etag = res.headers.get("ETag")
    assert etag
    assert "public" in res.headers.get("Cache-Control", "")
    not_modified = client.get("/api/v1/fee-catalog", headers={"If-None-Match": etag})
    assert not_modified.status_code == 304
    assert not_modified.content == b""


def test_fee_catalog_computes_no_price(client: TestClient) -> None:
    # Data only (FR-118): the payload carries reference fields, never a computed price.
    body = json.dumps(client.get("/api/v1/fee-catalog").json())
    assert "precoVarejo" not in body
    assert "custoTotal" not in body


def test_served_artifact_is_bundled_inside_the_app_package() -> None:
    # The image builds with `COPY app ./app`; the served artifact MUST resolve to a path
    # INSIDE the app package so it is carried into the container. If it moves back outside
    # app/, the endpoint 500s in prod — silently, since the client falls back to its seed.
    # This guard makes the repo path == the container path by construction and fails FIRST
    # on any such regression.
    import app as app_pkg
    from app.api import fee_catalog

    app_dir = Path(app_pkg.__file__).resolve().parent
    # White-box: assert the endpoint's own resolved artifact path (an internal) lives in app/.
    resolved = fee_catalog._CATALOG_PATH.resolve()  # pyright: ignore[reportPrivateUsage]
    assert resolved.is_file(), f"served catalog missing at {resolved}"
    assert app_dir in resolved.parents, (
        f"{resolved} must live under the app package ({app_dir}) so `COPY app ./app` bundles it"
    )
