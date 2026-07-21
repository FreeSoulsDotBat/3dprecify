"""E6 (T010) — `POST /api/v1/billing/webhook/mercadopago`: the codebase's FIRST public,
signature-authenticated route (ADR-0023 §5, D5 — no `current_claims`; MP holds no Firebase token).

Pipeline, in order (SEC-103, verify-before-lookup): **(a)** parse the body just enough to build the
HMAC manifest → **(b)** verify `x-signature` (`app.billing.signature`, SEC-101/102/106/107) →
**(c)** assert `live_mode` matches the running `app_env` (SEC-402/VR-705) → **(d)** ONLY THEN look
the resource up against the provider → **(e)** `grant_writer.process_verified_event`. A failure at
(b)/(c) is a plain 401, before any DB touch. Response semantics (contracts/api-surface.md): 200 fast
on accepted-or-duplicate/unresolved (MP retries on non-2xx — never bounce a benign "nothing to do"
as an error), 401 on failed verification, 422 on a verified-but-malformed notification.

This module is NOT gated by `require_entitlement`/`current_claims` on purpose — see the docstring
above and ADR-0023 §5 for why that is a deliberate, ADR-recorded exception, not drift.
"""

from __future__ import annotations

from typing import Annotated, Any, cast

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.billing.grant_writer import process_verified_event
from app.billing.providers.mercadopago import MercadoPagoProvider
from app.billing.signature import verify_signature
from app.db import get_session
from app.errors import AppError, CamelModel, ErrorCode, ErrorEnvelope
from app.settings import get_settings

router = APIRouter(tags=["billing"])

_WEBHOOK_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelope, "description": "Signature verification failed"},
    422: {"model": ErrorEnvelope, "description": "Verified but malformed notification"},
}


class WebhookAck(CamelModel):
    status: str


def _reject() -> AppError:
    return AppError(ErrorCode.UNAUTHENTICATED, "invalid webhook signature", status_code=401)


def _malformed() -> AppError:
    return AppError(ErrorCode.VALIDATION_ERROR, "malformed webhook notification", status_code=422)


@router.post(
    "/billing/webhook/mercadopago",
    status_code=status.HTTP_200_OK,
    responses=_WEBHOOK_RESPONSES,
)
async def mercadopago_webhook(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_session)],
) -> WebhookAck:
    settings = get_settings()

    try:
        raw_body: Any = await request.json()
    except Exception as exc:  # an unparseable body cannot be verified, ever — reject, not crash
        raise _reject() from exc
    if not isinstance(raw_body, dict):
        raise _reject()
    body = cast("dict[str, Any]", raw_body)

    data = body.get("data")
    data_id: Any = cast("dict[str, Any]", data).get("id") if isinstance(data, dict) else None
    data_id_str = str(data_id) if data_id is not None else None

    secret = settings.mp_webhook_secret.get_secret_value() if settings.mp_webhook_secret else None
    verified = verify_signature(
        x_signature=request.headers.get("x-signature"),
        x_request_id=request.headers.get("x-request-id"),
        data_id=data_id_str,
        secret=secret,
    )
    if not verified:
        raise _reject()

    # SEC-402/VR-705 — the second, independent env-isolation guard: a sandbox event can never write
    # a prod grant, even with a signature that (impossibly, given per-env secrets) verified.
    live_mode = bool(body.get("live_mode"))
    expected_live_mode = settings.app_env == "prod"
    if live_mode != expected_live_mode:
        raise _reject()

    event_type = body.get("type")
    if not isinstance(event_type, str) or not event_type or data_id_str is None:
        raise _malformed()

    provider = MercadoPagoProvider(settings)
    try:
        event = await provider.lookup_verified_event(event_type, data_id_str)
    finally:
        await provider.aclose()

    if event is None:
        # SEC-105: verified but unresolvable (unknown subscription / unknown type) — ack fast, write
        # nothing (deny-by-default).
        return WebhookAck(status="ignored")

    result = await process_verified_event(session, event)
    return WebhookAck(status="ok" if result.granted else "noop")
