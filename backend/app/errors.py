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
    # E2 (ADR-0012): persistence is Premium; the server-side gate denies with this code (403).
    # The ONLY new E2 code — no quota (free=zero, premium=unlimited) and no conflict (writes are
    # online-only) codes exist; they would be phantoms (spec 007 Edge Cases).
    ENTITLEMENT_REQUIRED = "ENTITLEMENT_REQUIRED"
    # E6 (T012/T013, ADR-0023 §8): the ONE new code, genuinely returnable — `POST
    # /billing/checkout` 503s when Mercado Pago itself cannot be reached/rejects the create call
    # (`contracts/api-surface.md`). The 409 double-subscribe case (SEC-604) is deliberately NOT a
    # new code — `errors.py` had no conflict/duplicate code before E6 either, and minting one for
    # a single caller would be the phantom-code drift the ADR warns against; it reuses
    # VALIDATION_ERROR with `status_code=409` (a dated T013 deviation — see dod-evidence.md).
    BILLING_UNAVAILABLE = "BILLING_UNAVAILABLE"


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
# E2 catalog routes (ADR-0012): 401 (bad/missing token) + 403 (not entitled).
ENTITLEMENT_ERRORS: dict[int | str, dict[str, Any]] = {
    **AUTH_ERRORS,
    403: {"model": ErrorEnvelope, "description": "Persistence requires an active premium grant"},
}
NOT_FOUND_ERRORS: dict[int | str, dict[str, Any]] = {
    404: {"model": ErrorEnvelope, "description": "No such resource under this account"},
}
# Declared explicitly on routes whose 422 is REACHABLE (bodies with constrained fields) — this
# REPLACES FastAPI's auto-422 schema with the honest ErrorEnvelope, so the openapi() phantom
# strip (which only removes HTTPValidationError-typed 422s) keeps it. 400 is FastAPI's
# unparseable-body response — also reachable on any body-carrying route (conformance caught it
# day 1), distinct from 422 (parseable but invalid) on purpose.
VALIDATION_ERRORS: dict[int | str, dict[str, Any]] = {
    400: {"model": ErrorEnvelope, "description": "Malformed request body (unparseable)"},
    422: {"model": ErrorEnvelope, "description": "Per-field validation failed"},
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
        # 400 here is FastAPI's "There was an error parsing the body" (unparseable payload) —
        # a client-input problem, so it maps to VALIDATION_ERROR, never INTERNAL (E2/conformance).
        if exc.status_code == status.HTTP_404_NOT_FOUND:
            code = ErrorCode.NOT_FOUND
        elif exc.status_code == status.HTTP_400_BAD_REQUEST:
            code = ErrorCode.VALIDATION_ERROR
        else:
            code = ErrorCode.INTERNAL
        message = exc.detail or "HTTP error"
        return JSONResponse(status_code=exc.status_code, content=_envelope(code, message))

    @app.exception_handler(Exception)
    async def _handle_unexpected(_request: Request, _exc: Exception) -> JSONResponse:
        # Never leak internals; the correlationId ties this to the log + Sentry event.
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=_envelope(ErrorCode.INTERNAL, "Internal server error"),
        )
