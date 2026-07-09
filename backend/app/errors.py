"""Error model (A5/A9): the wire error envelope and its codes.

Python ``ErrorCode`` is the single source of wire error codes (generated to a TS union via Orval).
The envelope serializes via an aliased Pydantic model, so ``correlationId`` is camelCase like the
success bodies — the hand-built handlers do NOT bypass the casing convention.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from asgi_correlation_id import correlation_id
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode(StrEnum):
    """Single source of wire error codes. Mirrored to TS via Orval (A5)."""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    TOKEN_EXPIRED = "TOKEN_EXPIRED"  # noqa: S105
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    INTERNAL = "INTERNAL"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ErrorBody(CamelModel):
    code: ErrorCode
    message: str
    details: list[dict[str, Any]] | None = None
    correlation_id: str | None = None  # serialized as ``correlationId``


class ErrorEnvelope(CamelModel):
    error: ErrorBody


# A21 (FR-210): composable per-route ``responses=`` constants declaring ONLY the statuses a route
# can actually return — the positive half of the honest error contract (the negative half, removing
# FastAPI's auto-injected phantom 422, lives in ``main.py``'s ``openapi()`` override). No 403
# constant exists on purpose: no route has authorization logic yet, so publishing one would itself
# be a phantom (Principle II).
AUTH_ERRORS: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelope, "description": "Missing/invalid/expired bearer token"},
}
INTERNAL_ERRORS: dict[int | str, dict[str, Any]] = {
    500: {"model": ErrorEnvelope, "description": "Unexpected server error"},
}


class AppError(Exception):
    """Domain/application error carrying a wire ``ErrorCode`` and HTTP status."""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def _envelope(
    code: ErrorCode,
    message: str,
    details: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    body = ErrorBody(
        code=code,
        message=message,
        details=details,
        correlation_id=correlation_id.get(),
    )
    return ErrorEnvelope(error=body).model_dump(by_alias=True, exclude_none=True)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(_request: Request, exc: RequestValidationError) -> JSONResponse:
        details = [
            {
                "field": ".".join(str(p) for p in err.get("loc", [])),
                "constraint": err.get("msg", ""),
            }
            for err in exc.errors()
        ]
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content=_envelope(ErrorCode.VALIDATION_ERROR, "Validation failed", details),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http(_request: Request, exc: StarletteHTTPException) -> JSONResponse:
        is_404 = exc.status_code == status.HTTP_404_NOT_FOUND
        code = ErrorCode.NOT_FOUND if is_404 else ErrorCode.INTERNAL
        message = exc.detail or "HTTP error"
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, message))

    @app.exception_handler(Exception)
    async def _handle_unexpected(_request: Request, _exc: Exception) -> JSONResponse:
        # Never leak internals; the correlationId ties this to the log + Sentry event.
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(ErrorCode.INTERNAL, "Internal server error"),
        )
