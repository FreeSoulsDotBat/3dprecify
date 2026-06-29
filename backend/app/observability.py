"""Observability — correlation-first debug bundle (O1).

Every request emits one structured log line with a fixed schema: ``ts, level, correlationId,
service, route, userUid?, status, latencyMs, errorCode?, releaseSha``. Given a ``correlationId``,
the runbook (docs/observability.md) leads to the Cloud Logging filter + the linked Sentry issue
(release-tagged). The correlation id header is pinned to ``X-Correlation-Id`` (A9).
"""

from __future__ import annotations

import logging
import time
from collections.abc import Awaitable, Callable

import sentry_sdk
import structlog
from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, Request, Response

from .settings import Settings

CORRELATION_HEADER = "X-Correlation-Id"

_log = structlog.get_logger()


def _configure_structlog() -> None:
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", key="ts"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )


def configure_observability(app: FastAPI, settings: Settings) -> None:
    _configure_structlog()

    if settings.sentry_dsn is not None:
        sentry_sdk.init(
            dsn=settings.sentry_dsn.get_secret_value(),
            release=settings.release,
            environment=settings.app_env,
            traces_sample_rate=0.0,
        )

    @app.middleware("http")
    async def _log_requests(
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started = time.perf_counter()
        error_code: str | None = None
        try:
            response = await call_next(request)
        except Exception:
            error_code = "INTERNAL"
            _emit(request, settings, status_code=500, started=started, error_code=error_code)
            raise
        _emit(request, settings, status_code=response.status_code, started=started, error_code=None)
        return response

    # Outermost of the two: sets the correlation id BEFORE the logging middleware reads it.
    app.add_middleware(CorrelationIdMiddleware, header_name=CORRELATION_HEADER)


def _emit(
    request: Request,
    settings: Settings,
    *,
    status_code: int,
    started: float,
    error_code: str | None,
) -> None:
    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    _log.info(
        "request",
        correlationId=correlation_id.get(),
        service=settings.service_name,
        route=f"{request.method} {request.url.path}",
        status=status_code,
        latencyMs=latency_ms,
        errorCode=error_code,
        releaseSha=settings.release,
    )
