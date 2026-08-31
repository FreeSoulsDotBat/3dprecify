"""Firebase token verification (A6).

The Admin SDK verify call is blocking, so it runs in a threadpool. In dev,
``P3D_FIREBASE_AUTH_EMULATOR_HOST`` points the SDK at the Auth emulator (no real
credentials); in prod, Application Default Credentials are used. ``current_claims`` is the
server-side boundary (Principle IV): every entitlement-gated route (filaments, printers,
products, boms, history, export, scenarios) depends on it transitively through
``app.entitlement.require_entitlement`` / ``require_catalog_read``, plus ``/api/v1/me`` and
``/api/v1/fee-catalog`` consume it directly (013 audit remediation, finding F-03 — this
docstring previously claimed "no product route consumes this yet", which stopped being true
back at E2).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, cast

import firebase_admin
import structlog
from fastapi import Header
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as firebase_auth

from .errors import AppError, ErrorCode
from .settings import Settings

log = structlog.get_logger(__name__)

_app: firebase_admin.App | None = None


@dataclass(frozen=True)
class Claims:
    """019/polish — the verified Firebase ID-token fields this app actually reads, typed instead
    of an untyped `dict[str, Any]` every route dependency threaded through by hand. `uid` is
    always present (Firebase always sets it); `email`/`name` are OPTIONAL claims (an anonymous or
    email-less provider omits them) — never derived, never defaulted to a lie.

    This is a WIRE-ADJACENT boundary type, not a wire model: it is never serialised to a response
    (OpenAPI is unaffected), only passed between `current_claims` and every route/dependency that
    used to read the raw decoded token dict.
    """

    uid: str
    email: str | None = None
    name: str | None = None


def init_firebase(settings: Settings) -> None:
    """Initialize the Admin SDK once. Safe to call when no project is configured (skips)."""
    global _app
    if _app is not None:
        return
    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host
    if settings.firebase_project_id is None and not settings.firebase_auth_emulator_host:
        return  # nothing to init (e.g. unit tests); verification will fail closed if called
    _app = cast(
        "firebase_admin.App",
        cast("Any", firebase_admin).initialize_app(
            options={"projectId": settings.firebase_project_id or "demo-precifica3d"},
        ),
    )


async def verify_id_token(token: str) -> dict[str, Any]:
    """Verify a Firebase ID token off the event loop. Maps failures to wire ErrorCodes."""
    # firebase-admin is untyped; cast at this boundary so the type checker stays strict elsewhere.
    verify = cast("Any", firebase_auth.verify_id_token)
    try:
        decoded = cast("dict[str, Any]", await run_in_threadpool(verify, token))
    except firebase_auth.ExpiredIdTokenError as exc:
        # Onda 7 (legibilidade): NUNCA o token/claims — só o motivo nomeado (o repo não loga
        # `uid` hoje em nenhum ponto; ver `app/observability.py` — este não é o lugar para começar).
        log.info("auth_rejected", reason="token_expired")
        raise AppError(ErrorCode.TOKEN_EXPIRED, "Token expired", status_code=401) from exc
    except (
        firebase_auth.InvalidIdTokenError,
        firebase_auth.RevokedIdTokenError,
        ValueError,
    ) as exc:
        log.info("auth_rejected", reason="invalid_token", exc_type=type(exc).__name__)
        raise AppError(ErrorCode.UNAUTHENTICATED, "Invalid token", status_code=401) from exc
    return decoded


async def current_claims(authorization: str | None = Header(default=None)) -> Claims:
    """Dependency yielding the verified Firebase token claims, TYPED. 401 if missing/invalid."""
    if not authorization or not authorization.startswith("Bearer "):
        log.info("auth_rejected", reason="missing_bearer_token")
        raise AppError(ErrorCode.UNAUTHENTICATED, "Missing bearer token", status_code=401)
    decoded = await verify_id_token(authorization.removeprefix("Bearer "))
    return Claims(uid=decoded["uid"], email=decoded.get("email"), name=decoded.get("name"))
