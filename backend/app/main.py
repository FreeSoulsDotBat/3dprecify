"""FastAPI application factory (create_app + lifespan). camelCase wire via aliased models.

Mounts ``/health`` (public, unversioned) and an empty ``/api/v1`` router — NO product routes here.
A dev-only ``/api/v1/_debug/boom`` demonstrates the error envelope + correlation id (SC-4).
"""

from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.billing import router as billing_router
from .api.boms import router as boms_router
from .api.entitlement import router as entitlement_router
from .api.export import router as export_router
from .api.fee_catalog import router as fee_catalog_router
from .api.filaments import router as filaments_router
from .api.history import router as history_router
from .api.me import router as me_router
from .api.printers import router as printers_router
from .api.products import router as products_router
from .api.scenarios import router as scenarios_router
from .auth import init_firebase
from .errors import AppError, ErrorCode, ErrorEnvelope, register_exception_handlers
from .observability import CORRELATION_HEADER, configure_observability
from .settings import Settings, get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    init_firebase(get_settings())
    yield


def _strip_phantom_422(schema: dict[str, Any]) -> dict[str, Any]:
    """Remove FastAPI's auto-injected 422 (``HTTPValidationError``) from the published contract.

    A21/FR-210: none of our routes can actually fail request validation (their only params are
    optional headers), so the auto-422 is a phantom — and per-route ``responses=`` can only
    *replace* it, never remove it. Real validation failures (if a future route gains required
    params) are handled by ``register_exception_handlers`` as a 422 ``ErrorEnvelope``; such a route
    must then DECLARE that envelope explicitly instead of relying on the phantom default.
    """
    for path_item in schema.get("paths", {}).values():
        for operation in path_item.values():
            responses = operation.get("responses", {})
            ref = (
                responses.get("422", {})
                .get("content", {})
                .get("application/json", {})
                .get("schema", {})
                .get("$ref", "")
            )
            if ref.endswith("HTTPValidationError"):
                del responses["422"]
    # Drop the now-unreferenced components — defensively verified, never blind.
    components = schema.get("components", {}).get("schemas", {})
    for name in ("HTTPValidationError", "ValidationError"):
        if name in components:
            without = {k: v for k, v in components.items() if k != name}
            still_referenced = f"#/components/schemas/{name}" in json.dumps(
                {**schema, "components": {"schemas": without}}
            )
            if not still_referenced:
                del components[name]
    return schema


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="Precifica3D API", version="0.0.0", lifespan=lifespan)

    configure_observability(app, settings)
    register_exception_handlers(app)

    # CORS allowlist (A7) — outermost middleware; exposes the correlation id header to the browser.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        # `Content-Disposition` is NOT a CORS-safelisted response header, and web + API are separate
        # origins in every deployed environment — so without this the browser hides it and the
        # export's `filenameFrom()` was dead code that always fell back (review PR-C). Today the
        # fallbacks happen to match; the moment the server names a file per snapshot, they would
        # not.
        expose_headers=[CORRELATION_HEADER, "Content-Disposition"],
    )

    # The error response declares the envelope so it (and ErrorCode) land in the OpenAPI schema,
    # which Orval turns into the TS client + ErrorCode union (A5/C4).
    @app.get("/health", tags=["health"], responses={500: {"model": ErrorEnvelope}})
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    api = APIRouter(prefix="/api/v1")
    api.include_router(me_router)
    # Public, unauthenticated reference data (never a gate — FR-117 / Constitution IV).
    api.include_router(fee_catalog_router)
    # E2: the account's own plan state (honest Conta surface — FR-304/ADR-0012).
    api.include_router(entitlement_router)
    # E2 catalog (premium, gated per-route — US1-4 audits that every route carries a gate).
    api.include_router(filaments_router)
    api.include_router(printers_router)
    api.include_router(products_router)
    # E3 kits (premium persistence — the same gates; writes also materialize catalog products,
    # ADR-0017).
    api.include_router(boms_router)
    # Export BEFORE history: `/history/export.csv` is a LITERAL path that must win over history's
    # `/history/{snapshot_id}` GET (Starlette matches in registration order — otherwise "export.csv"
    # is parsed as a snapshot UUID and 422s). The quote route (`/history/{id}/quote.pdf`) is deeper,
    # so it never collides.
    api.include_router(export_router)
    api.include_router(history_router)
    # E5 saved scenarios (premium persistence, PR-A subset — save · list · get; materializes
    # nothing, VR-607). The same entitlement gates, no new ErrorCode.
    api.include_router(scenarios_router)
    # E6 billing (ADR-0023): the ONE public, signature-authenticated route (no current_claims — MP
    # holds no Firebase token; the signature dependency inside is the auth boundary). Checkout/
    # subscription routes land with T012/T013 (PR-A, not this wave).
    api.include_router(billing_router)

    if settings.app_env == "dev":  # debug route only in local dev (not UAT/prod)

        @api.get("/_debug/boom", include_in_schema=False)
        async def _boom() -> None:
            raise AppError(ErrorCode.INTERNAL, "Boom (debug)", status_code=500)

    app.include_router(api)

    # A21: the published OpenAPI is the default one minus the phantom auto-422 (see helper above).
    default_openapi = app.openapi

    def openapi_without_phantom_422() -> dict[str, Any]:
        if app.openapi_schema:
            return app.openapi_schema
        app.openapi_schema = _strip_phantom_422(default_openapi())
        return app.openapi_schema

    app.openapi = openapi_without_phantom_422  # pyright: ignore[reportAttributeAccessIssue]

    return app


app = create_app()
