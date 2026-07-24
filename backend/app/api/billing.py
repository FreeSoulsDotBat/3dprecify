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

from app.auth import current_claims
from app.billing.checkout import CheckoutConflict, CheckoutUnavailable, PlanPeriod, start_checkout
from app.billing.grant_writer import process_verified_event
from app.billing.providers.mercadopago import MercadoPagoProvider
from app.billing.signature import verify_signature
from app.db import get_session
from app.errors import (
    AUTH_ERRORS,
    VALIDATION_ERRORS,
    AppError,
    CamelModel,
    ErrorCode,
    ErrorEnvelope,
)
from app.settings import Settings, get_settings

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

    # E6-02 (confirmation audit): MP computes the `x-signature` manifest over the `data.id` taken
    # from the NOTIFICATION QUERY PARAM (`?data.id=…`), not the body. Read it from the query first
    # so verification matches MP's real contract; fall back to the body's `data.id` (what the local
    # stub sends) so nothing regresses. A body-only read silently 401'd every real webhook whose
    # query id differed from (or was absent in) the body — an availability defect, not a bypass.
    query_data_id = request.query_params.get("data.id") or request.query_params.get("id")
    data = body.get("data")
    body_data_id: Any = cast("dict[str, Any]", data).get("id") if isinstance(data, dict) else None
    data_id: Any = query_data_id if query_data_id is not None else body_data_id
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


# ══ T012/T013 — POST /billing/checkout (ADR-0023 §1/§7, SEC-301/302/604) ═══════════════════════

_CHECKOUT_RESPONSES: dict[int | str, dict[str, Any]] = {
    **AUTH_ERRORS,
    **VALIDATION_ERRORS,
    409: {"model": ErrorEnvelope, "description": "An open subscription already exists"},
    503: {"model": ErrorEnvelope, "description": "Payment provider unreachable"},
}


class CheckoutIn(CamelModel):
    period: PlanPeriod


class CheckoutOut(CamelModel):
    init_point: str  # serialized "initPoint" — the MP hosted checkout URL


def _plan_id(settings: Settings, period: PlanPeriod) -> str | None:
    secret = settings.mp_plan_id_monthly if period == "monthly" else settings.mp_plan_id_annual
    return secret.get_secret_value() if secret else None


def _back_url(settings: Settings) -> str:
    """T013 constraint (`ux-billing.md` — the measured `base:'./'` cold-load trap applied to the
    external MP return): the returned route MUST be exactly ONE path segment. Base URL comes from
    the CORS allowlist's first entry (settings-driven — never a hardcoded port, ADR-0022 lesson)."""
    base = settings.cors_origins[0] if settings.cors_origins else "http://localhost:5173"
    return f"{base.rstrip('/')}/conta?checkout=retorno"


@router.post(
    "/billing/checkout",
    status_code=status.HTTP_200_OK,
    responses=_CHECKOUT_RESPONSES,
)
async def create_checkout(
    body: CheckoutIn,
    claims: Annotated[dict[str, Any], Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CheckoutOut:
    settings = get_settings()
    uid: str = claims["uid"]
    plan_id = _plan_id(settings, body.period)
    if plan_id is None:
        # A genuinely returnable case (SC-702 adjacent): the environment has no plan id
        # provisioned for this period yet (T002, post-homologation) — honest 503, not a fake 200.
        raise AppError(
            ErrorCode.BILLING_UNAVAILABLE, "billing is not configured for this period", 503
        )

    provider = MercadoPagoProvider(settings)
    try:
        result = await start_checkout(
            session,
            provider,
            uid=uid,
            email=claims.get("email"),
            period=body.period,
            plan_id=plan_id,
            back_url=_back_url(settings),
        )
    except CheckoutConflict as exc:
        # SEC-604: no house code for a state conflict predates E6 (`errors.py`) — reusing
        # VALIDATION_ERROR with an explicit 409 status is a dated T013 deviation over minting a
        # single-caller code (see `errors.py`'s ErrorCode docstring + dod-evidence.md).
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "an open subscription already exists", 409
        ) from exc
    except CheckoutUnavailable as exc:
        raise AppError(ErrorCode.BILLING_UNAVAILABLE, "payment provider unreachable", 503) from exc
    finally:
        await provider.aclose()

    return CheckoutOut(init_point=result.init_point)
