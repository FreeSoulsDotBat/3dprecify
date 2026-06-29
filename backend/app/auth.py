"""Firebase token verification (A6).

The Admin SDK verify call is blocking, so it runs in a threadpool. In dev,
``P3D_FIREBASE_AUTH_EMULATOR_HOST`` points the SDK at the Auth emulator (no real
credentials); in prod, Application Default Credentials are used. No product route consumes this
yet — it exists so the server-side boundary (Principle IV) is ready to wire.
"""

from __future__ import annotations

import os
from typing import Any, cast

import firebase_admin
from fastapi import Header
from fastapi.concurrency import run_in_threadpool
from firebase_admin import auth as firebase_auth

from .errors import AppError, ErrorCode
from .settings import Settings

_app: firebase_admin.App | None = None


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
        raise AppError(ErrorCode.TOKEN_EXPIRED, "Token expired", status_code=401) from exc
    except (
        firebase_auth.InvalidIdTokenError,
        firebase_auth.RevokedIdTokenError,
        ValueError,
    ) as exc:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Invalid token", status_code=401) from exc
    return decoded


async def current_uid(authorization: str | None = Header(default=None)) -> str:
    """Dependency yielding the Firebase uid. Not mounted on any product route yet (skeleton)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(ErrorCode.UNAUTHENTICATED, "Missing bearer token", status_code=401)
    decoded = await verify_id_token(authorization.removeprefix("Bearer "))
    uid = decoded.get("uid")
    if not isinstance(uid, str):
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token missing uid", status_code=401)
    return uid
