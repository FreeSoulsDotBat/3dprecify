"""Observability — correlation-first debug bundle (O1).

Every request emits one structured log line: ``ts, level, correlationId, service, route, status,
latencyMs, errorCode?, releaseSha``. Given a ``correlationId``, the runbook (docs/observability.md)
leads to the Cloud Logging filter + the linked Sentry issue (release-tagged). The correlation id
header is pinned to ``X-Correlation-Id`` (A9).

Onda 7 (legibilidade, 2026-08-31) correction: this docstring (and docs/observability.md's example)
previously promised a fixed ``userUid`` field. `_emit` below never emitted one — there is no
mechanism wiring the verified claims (resolved per-route by the `current_claims` FastAPI dependency,
AFTER this middleware has already called `call_next`) into this request-lifecycle log line; no
contextvar bridges the two today. Rather than invent that plumbing under a "legibility" chore
(Princípio VIII), this docstring is corrected to describe what the code actually does.
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
            # Onda 7: sem este processor, um `exc_info` (usado por `errors.py`'s
            # `_handle_unexpected`) chega ao JSONRenderer como uma tupla não serializável — ele
            # tem de virar a string `exception` ANTES do render.
            structlog.processors.format_exc_info,
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
        except Exception as exc:
            error_code = "INTERNAL"
            # Onda 7: este ramo relançava a exceção sem registrar QUAL exceção era — o handler
            # global (`errors.py`) agora loga o traceback completo, mas esta linha por-requisição
            # é o único lugar que amarra tipo/mensagem à latência/rota/correlationId da chamada.
            _emit(
                request,
                settings,
                status_code=500,
                started=started,
                error_code=error_code,
                exc_type=type(exc).__name__,
                exc_message=str(exc),
            )
            raise
        _emit(request, settings, status_code=response.status_code, started=started, error_code=None)
        return response

    # Outermost of the two: sets the correlation id BEFORE the logging middleware reads it.
    app.add_middleware(CorrelationIdMiddleware, header_name=CORRELATION_HEADER)


def _route_template(request: Request) -> str:
    """O PADRÃO da rota (``/history/{snapshot_id}``), não o path cru com o UUID embutido — um
    filtro/agrupamento por `route` em Cloud Logging hoje espalha a MESMA rota numa entrada por
    id (Onda 7). Starlette só resolve `request.scope["route"]` depois que o roteamento casa; até
    lá (404 puro, erro antes do dispatch) cai no path cru, que é o comportamento de sempre.
    """
    route = request.scope.get("route")
    path = getattr(route, "path", None)
    return path if isinstance(path, str) else request.url.path


def _emit(
    request: Request,
    settings: Settings,
    *,
    status_code: int,
    started: float,
    error_code: str | None,
    exc_type: str | None = None,
    exc_message: str | None = None,
) -> None:
    latency_ms = round((time.perf_counter() - started) * 1000, 2)
    _log.info(
        "request",
        correlationId=correlation_id.get(),
        service=settings.service_name,
        route=f"{request.method} {_route_template(request)}",
        status=status_code,
        latencyMs=latency_ms,
        errorCode=error_code,
        releaseSha=settings.release,
        excType=exc_type,
        excMessage=exc_message,
    )
