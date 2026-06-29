"""FastAPI application factory (create_app + lifespan). camelCase wire via aliased models.

Mounts ``/health`` (public, unversioned) and an empty ``/api/v1`` router — NO product routes here.
A dev-only ``/api/v1/_debug/boom`` demonstrates the error envelope + correlation id (SC-4).
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import init_firebase
from .errors import AppError, ErrorCode, ErrorEnvelope, register_exception_handlers
from .observability import CORRELATION_HEADER, configure_observability
from .settings import Settings, get_settings


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    init_firebase(get_settings())
    yield


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
        expose_headers=[CORRELATION_HEADER],
    )

    # The error response declares the envelope so it (and ErrorCode) land in the OpenAPI schema,
    # which Orval turns into the TS client + ErrorCode union (A5/C4).
    @app.get("/health", tags=["health"], responses={500: {"model": ErrorEnvelope}})
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    api = APIRouter(prefix="/api/v1")

    if settings.app_env == "dev":  # debug route only in local dev (not UAT/prod)

        @api.get("/_debug/boom", include_in_schema=False)
        async def _boom() -> None:
            raise AppError(ErrorCode.INTERNAL, "Boom (debug)", status_code=500)

    app.include_router(api)
    return app


app = create_app()
