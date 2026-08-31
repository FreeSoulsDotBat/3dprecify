"""E6 (T010) — `POST /api/v1/billing/webhook/mercadopago`: the codebase's FIRST public,
signature-authenticated route (ADR-0023 §5, D5 — no `current_claims`; MP holds no Firebase token).

Pipeline, in order (SEC-103, verify-before-lookup): **(a)** parse the body just enough to build the
HMAC manifest → **(b)** verify `x-signature` (`app.billing.signature`, SEC-101/102/106/107) →
**(c)** assert `live_mode` matches the running `app_env` (SEC-402/VR-705) → **(d)** ONLY THEN look
the resource up against the provider → **(e)** `grant_writer.process_verified_event`. A failure at
(b)/(c) is a plain 401, before any DB touch. Response semantics (contracts/api-surface.md): 200 fast
on accepted-or-duplicate/unresolved (never bounce a benign "nothing to do" as an error), 401 on
failed verification, 422 on a verified-but-malformed notification, and **503 when the provider could
not be reached at all** (015/A2 — MP reenvia a cada 15 minutos ate receber 200/201, entao um 5xx
PEDE reenvio; um 200 dado a um evento nao processado desarma essa recuperacao).

This module is NOT gated by `require_entitlement`/`current_claims` on purpose — see the docstring
above and ADR-0023 §5 for why that is a deliberate, ADR-recorded exception, not drift.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, cast

import structlog
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Claims, current_claims
from app.billing.checkout import CheckoutConflict, CheckoutUnavailable, PlanPeriod, start_checkout
from app.billing.grant_writer import process_verified_event
from app.billing.providers.mercadopago import MercadoPagoProvider, ProviderUnavailable
from app.billing.signature import verify_signature
from app.billing.subscription import (
    CancelUnavailable,
    NoSubscription,
    SubscriptionView,
    cancel_subscription,
    read_subscription,
)
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

log = structlog.get_logger(__name__)

router = APIRouter(tags=["billing"])

_WEBHOOK_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelope, "description": "Signature verification failed"},
    422: {"model": ErrorEnvelope, "description": "Verified but malformed notification"},
    503: {
        "model": ErrorEnvelope,
        "description": "Provider unreachable - ask Mercado Pago to retry",
    },
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
    except ProviderUnavailable as exc:
        # 015/A2 ([F04b-001]) — NÃO conseguimos consultar o MP. Antes isto virava `None` e caía no
        # `ignored` abaixo: 200 para um evento jogado fora, e um grant pago sumindo em silêncio.
        # Um 503 é a resposta honesta E a útil: por P-009 o MP reenvia a cada 15 minutos até
        # receber 200/201, então a recuperação já existe — o que faltava era não desarmá-la.
        # Nada é escrito: pedir reenvio não é adivinhar o resultado.
        log.warning(
            "billing_webhook_provider_unavailable",
            event_type=event_type,
            data_id=data_id_str,
            reason=str(exc),
        )
        raise AppError(ErrorCode.BILLING_UNAVAILABLE, "payment provider unreachable", 503) from exc
    finally:
        await provider.aclose()

    if event is None:
        # SEC-105: o MP RESPONDEU e o recurso não resolve (assinatura desconhecida / tipo que não
        # tratamos) — ack rápido, nada escrito (deny-by-default). Insistir não mudaria a resposta.
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
    claims: Annotated[Claims, Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> CheckoutOut:
    settings = get_settings()
    uid: str = claims.uid
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
            email=claims.email,
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


# ══ T022 (US4) — GET /billing/subscription · POST /billing/subscription/cancel ══════════════════
#
# A metade REVERSA do contrato: o vendedor sai sozinho, e sair não lhe custa nada do que ele já
# pagou. A regra inteira mora em `app.billing.subscription`; aqui só há tradução para o wire.

_SUBSCRIPTION_RESPONSES: dict[int | str, dict[str, Any]] = {**AUTH_ERRORS}

_CANCEL_RESPONSES: dict[int | str, dict[str, Any]] = {
    **AUTH_ERRORS,
    404: {"model": ErrorEnvelope, "description": "The account has no subscription to cancel"},
    503: {"model": ErrorEnvelope, "description": "Payment provider unreachable"},
}


class SubscriptionOut(CamelModel):
    """O espelho do PSP que a Conta lê. Sem folha de dinheiro — só referências e datas (VR-701)."""

    plan: PlanPeriod
    status: str
    current_period_end: datetime | None
    cancel_at_period_end: bool
    grace_until: datetime | None


def _out(view: SubscriptionView) -> SubscriptionOut:
    return SubscriptionOut(
        plan=cast("PlanPeriod", view.plan_period),
        status=view.status,
        current_period_end=view.current_period_end,
        cancel_at_period_end=view.cancel_at_period_end,
        grace_until=view.grace_until,
    )


@router.get(
    "/billing/subscription",
    status_code=status.HTTP_200_OK,
    responses=_SUBSCRIPTION_RESPONSES,
)
async def get_subscription(
    claims: Annotated[Claims, Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SubscriptionOut | None:
    """`null` quando a conta não tem assinatura (cortesia/gratuita) — a Conta cai para a superfície
    de entitlement, e NADA de estado de cobrança é inferido no cliente (SC-708)."""
    view = await read_subscription(session, claims.uid)
    return _out(view) if view is not None else None


@router.post(
    "/billing/subscription/cancel",
    status_code=status.HTTP_200_OK,
    responses=_CANCEL_RESPONSES,
)
async def cancel_subscription_route(
    claims: Annotated[Claims, Depends(current_claims)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> SubscriptionOut:
    """Cancela no MP e espelha aqui. NÃO escreve no ledger e NÃO apaga nada (VR-706/SC-704).

    A rota não recebe corpo nem parâmetro: a assinatura é resolvida pelo `uid` do token, então não
    existe campo por onde apontar para a assinatura de outra conta (SEC-204/VR-703).
    """
    provider = MercadoPagoProvider(get_settings())
    try:
        view = await cancel_subscription(session, provider, uid=claims.uid)
    except NoSubscription as exc:
        # A mensagem nomeia o DOMÍNIO de propósito: um 404 genérico ("Not Found") é
        # indistinguível de "esta rota não existe", e foi exatamente assim que o teste deste caso
        # passou VÁCUO na rodada vermelha do T021, único verde entre doze.
        raise AppError(
            ErrorCode.NOT_FOUND, "this account has no subscription to cancel", 404
        ) from exc
    except CancelUnavailable as exc:
        # Nada foi espelhado: o vendedor vê um erro honesto e tenta de novo, em vez de ler
        # "não renova" numa tela enquanto o MP segue cobrando o cartão dele.
        raise AppError(ErrorCode.BILLING_UNAVAILABLE, "payment provider unreachable", 503) from exc
    finally:
        await provider.aclose()

    return _out(view)


# ══ T035/T036 — Play Billing atras de uma flag DESLIGADA (ADR-0023 §6, owner Q2) ══════════════
#
# As duas rotas existem no CODIGO e NAO existem em nenhum ambiente do E6: elas so sao registradas
# quando `P3D_PLAY_BILLING_ENABLED` e verdadeira, entao com a flag desligada o proprio roteador
# responde 404 — nao ha handler que possa vazar por engano (VR-709/SC-711).
#
# 404 e nao 401/403 de proposito: um 401 diria "existe, mas voce nao esta autenticado", confirmando
# a superficie para quem estiver sondando. 404 diz o que e verdade — nao ha rota aqui.
#
# Gating por REGISTRO e nao por `if` dentro do handler: um `if` esquecido e um vazamento; uma rota
# que nunca foi registrada nao tem como responder.


class PlayCheckoutIn(CamelModel):
    """O token de compra que o cliente Play devolve. A verificacao e SERVIDOR contra o Play (T036)
    — este campo e uma alegacao do cliente ate ser conferida, nunca uma concessao."""

    purchase_token: str


def play_router(settings: Settings) -> APIRouter | None:
    """As rotas do Play, ou `None` quando a flag esta desligada. Chamado por `create_app`.

    Devolve um router NOVO a cada chamada, e nao muta o `router` de modulo. A primeira versao
    recebia o router compartilhado e acrescentava nele — o que faz a flag virar um estado GLOBAL do
    processo: duas `create_app` com flags diferentes (o que a suite de testes faz o tempo todo)
    vazariam uma na outra, e o vazamento seria na direcao perigosa, porque quem ligou primeiro
    deixaria as rotas ligadas para quem veio depois. Os testes so passavam pela ORDEM em que rodam.
    """
    if not settings.play_billing_enabled:
        return None

    play = APIRouter(tags=["billing"])

    @play.post("/billing/checkout/play", status_code=status.HTTP_200_OK)
    async def play_checkout(
        body: PlayCheckoutIn,
        claims: Annotated[Claims, Depends(current_claims)],
        session: Annotated[AsyncSession, Depends(get_session)],
    ) -> WebhookAck:
        # T036 (BLOQUEADO no dono): a verificacao do `purchase_token` contra a Play Developer API
        # exige conta, credencial de service account e uma compra no internal testing. Ate la esta
        # rota so existe com a flag ligada — que e nenhum ambiente — e recusa em voz alta, em vez de
        # conceder premium a partir de um token que ninguem conferiu (Constituicao IV).
        raise AppError(
            ErrorCode.BILLING_UNAVAILABLE,
            "play billing is not provisioned in this environment",
            503,
        )

    @play.post("/billing/webhook/play-rtdn", status_code=status.HTTP_200_OK)
    async def play_rtdn(
        request: Request,
        session: Annotated[AsyncSession, Depends(get_session)],
    ) -> WebhookAck:
        # Idem: a RTDN chega assinada pelo Pub/Sub do Google, e verificar essa assinatura precisa da
        # chave do projeto. Sem ela, deny-by-default — ack sem escrever nada seria pior, porque o
        # Google pararia de reentregar um evento que nunca foi processado.
        raise AppError(
            ErrorCode.BILLING_UNAVAILABLE,
            "play billing is not provisioned in this environment",
            503,
        )

    return play
