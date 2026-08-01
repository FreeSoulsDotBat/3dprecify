"""E6 (T011b) — a small in-process fake Mercado Pago server: the owner's build-first enabler
(2026-07-21). DEV/TEST-ONLY, lives under `tests/` (never `app/`), never shipped.

Implements the slice of MP's REST surface `app.billing.providers.mercadopago.MercadoPagoProvider`
calls — `GET /preapproval/{id}`, `GET /authorized_payments/{id}`, `GET /authorized_payments/search`
— plus a REGISTRATION API (`create_preapproval`/`authorize_payment`/`fail_payment`) to build
fixtures, and `fire_webhook`, a trigger that signs a body with MP's real manifest and POSTs it at
the app UNDER TEST. Wiring this at the httpx-transport level (via `httpx.ASGITransport`,
`set_test_transport`) means the full purchase/renewal/failure loop runs through the REAL app code —
webhook route → provider → `grant_writer` — with zero MP credentials
(`test_billing_terminus.py`, T008).

**Reuse for the future e2e stack** (T016 note per the task brief): mount `MPStub().asgi_app` with
`httpx.ASGITransport` exactly as `tests/conftest.py` does for pytest, OR run it standalone with
`uvicorn` (it is a plain FastAPI app, no dependency the rest of the backend doesn't already carry)
and point `P3D_MP_ACCESS_TOKEN`/a dev-only base-url override at it for a Playwright run — the
registration API and `fire_webhook` work identically either way.

**The T007-compatibility fallback** (`_fallback_authorized_payment`). The FROZEN
`test_billing_security.py` suite (opus-authored, T007) posts webhooks for payment ids it never
registered through this stub — it seeds `subscriptions` directly via raw SQL, independent of any
MP-side object, because its concern is the SIGNATURE/idempotency/isolation boundary, not payment
provenance. A real Mercado Pago would never invent such a mapping; this fallback is a narrow,
DOCUMENTED, test-only concession, exercised ONLY by that frozen suite: when asked about an
unregistered payment id, look at the app's OWN `subscriptions` table for the SOLE non-terminal row
that has never yet received a `billing_events` row — a real MP webhook is, after all, only ever
fired for OUR OWN subscription, so "the one still awaiting its first event" is the reasonable
single candidate. Zero or multiple candidates ⇒ decline (mirrors SEC-105's honest "unknown
subscription, grant nothing"). `test_billing_terminus.py` (T008) never exercises this branch — it
always registers its own fixtures through this stub's clean API first.
"""

from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import sqlalchemy as sa
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient


@dataclass
class Preapproval:
    id: str
    status: str
    plan_period: str
    payer_ref: str | None = None
    #: T012/T013 — the checkout-time `back_url` the app sent (introspectable so the checkout
    #: suite can assert the 1-segment-route contract, `ux-billing.md`'s `base:'./'` finding).
    back_url: str | None = None


@dataclass
class Payment:
    id: str
    preapproval_id: str
    status: str
    period_end: str | None


class MPStub:
    def __init__(self, *, db_url: str | None = None) -> None:
        self._db_url = db_url
        self._preapprovals: dict[str, Preapproval] = {}
        self._payments: dict[str, Payment] = {}
        self.asgi_app = self._build_app()

    # --- registration API -------------------------------------------------------------------

    def create_preapproval(
        self,
        *,
        plan_period: str = "monthly",
        payer_ref: str | None = None,
        back_url: str | None = None,
    ) -> Preapproval:
        pid = f"pre-{uuid.uuid4().hex[:12]}"
        pre = Preapproval(
            id=pid,
            status="pending",
            plan_period=plan_period,
            payer_ref=payer_ref,
            back_url=back_url,
        )
        self._preapprovals[pid] = pre
        return pre

    def preapprovals(self) -> list[Preapproval]:
        """T012 introspection — every preapproval registered so far (via either the Python API
        above or the HTTP `POST /preapproval` route below), newest last."""
        return list(self._preapprovals.values())

    def authorize_payment(self, preapproval_id: str, *, period_days: int = 30) -> Payment:
        """Registers an APPROVED authorized_payment against `preapproval_id` (the "successful
        charge" fixture — T008's happy path + reconciliation heal case)."""
        pre = self._preapprovals.get(preapproval_id)
        if pre is not None:
            pre.status = "authorized"
        payment_id = f"pay-{uuid.uuid4().hex[:12]}"
        period_end = (datetime.now(UTC) + timedelta(days=period_days)).isoformat()
        payment = Payment(
            id=payment_id, preapproval_id=preapproval_id, status="approved", period_end=period_end
        )
        self._payments[payment_id] = payment
        return payment

    def fail_payment(self, preapproval_id: str) -> Payment:
        """Registers a REJECTED authorized_payment (grace/dunning fixtures — PR-B/T023 territory;
        provided here so the stub's surface is complete per T011b's brief)."""
        payment_id = f"pay-{uuid.uuid4().hex[:12]}"
        payment = Payment(
            id=payment_id, preapproval_id=preapproval_id, status="rejected", period_end=None
        )
        self._payments[payment_id] = payment
        return payment

    # --- the signed-webhook firing trigger ----------------------------------------------------

    def fire_webhook(
        self,
        client: TestClient,
        *,
        payment_id: str,
        secret: str,
        webhook_path: str = "/api/v1/billing/webhook/mercadopago",
        event_type: str = "subscription_authorized_payment",
        live_mode: bool = False,
        request_id: str = "stub-req-1",
    ) -> Any:
        """Signs `{type, action, data:{id}, live_mode}` with MP's real manifest and POSTs it at the
        app under test — the same header/body shape `app.billing.signature` verifies."""
        ts = int(time.time())
        manifest = f"id:{payment_id.lower()};request-id:{request_id};ts:{ts};"
        v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
        headers = {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}
        body = {
            "type": event_type,
            "action": "created",
            "data": {"id": payment_id},
            "live_mode": live_mode,
        }
        return client.post(webhook_path, json=body, headers=headers)

    # --- the ASGI surface the provider's httpx client talks to --------------------------------

    def _build_app(self) -> FastAPI:
        app = FastAPI()

        # T012/T013 — the checkout-time create call. Registered BEFORE the `{preapproval_id}` GET
        # below is unnecessary here (different HTTP method, same literal path is fine for
        # Starlette's method-aware matching) but kept adjacent for readability.
        @app.post("/preapproval")
        async def create_preapproval_endpoint(request: Request) -> JSONResponse:
            body: dict[str, Any] = await request.json()
            plan_id = body.get("preapproval_plan_id")
            if not plan_id:
                return JSONResponse({"message": "preapproval_plan_id is required"}, status_code=400)
            pre = self.create_preapproval(
                plan_period=str(plan_id),
                payer_ref=body.get("payer_email"),
                back_url=body.get("back_url"),
            )
            return JSONResponse(
                {
                    "id": pre.id,
                    "status": pre.status,
                    "init_point": f"https://stub.mercadopago.local/checkout/{pre.id}",
                },
                status_code=201,
            )

        # T022/US4 — o cancelamento no provedor. Sem ele o stub aceitaria calado um cancelamento que
        # nunca aconteceu no MP, e o teste que prova "o preapproval fica cancelado LÁ" seria vácuo.
        @app.put("/preapproval/{preapproval_id}")
        async def update_preapproval(preapproval_id: str, request: Request) -> JSONResponse:
            pre = self._preapprovals.get(preapproval_id)
            if pre is None:
                return JSONResponse({"message": "not found"}, status_code=404)
            body: dict[str, Any] = await request.json()
            novo = body.get("status")
            if novo not in ("cancelled", "paused", "authorized"):
                return JSONResponse({"message": "unsupported status"}, status_code=400)
            pre.status = str(novo)
            return JSONResponse({"id": pre.id, "status": pre.status})

        @app.get("/preapproval/{preapproval_id}")
        async def get_preapproval(preapproval_id: str) -> JSONResponse:
            pre = self._preapprovals.get(preapproval_id)
            if pre is None:
                return JSONResponse({"message": "not found"}, status_code=404)
            return JSONResponse({"id": pre.id, "status": pre.status})

        # NOTE (the `export.csv` vs `history/{id}` lesson, `app/main.py`): the LITERAL
        # `/authorized_payments/search` path MUST be registered BEFORE the `{payment_id}` path
        # param route below — Starlette matches in registration order, so a param route registered
        # first would swallow "search" as a payment id and this endpoint would never be reached.
        @app.get("/authorized_payments/search")
        async def search_authorized_payments(preapproval_id: str) -> JSONResponse:
            results = [
                {
                    "id": p.id,
                    "preapproval_id": p.preapproval_id,
                    "status": p.status,
                    "period_end": p.period_end,
                }
                for p in self._payments.values()
                if p.preapproval_id == preapproval_id
            ]
            return JSONResponse({"results": results})

        @app.get("/authorized_payments/{payment_id}")
        async def get_authorized_payment(payment_id: str) -> JSONResponse:
            payment = self._payments.get(payment_id) or self._fallback_authorized_payment(
                payment_id
            )
            if payment is None:
                return JSONResponse({"message": "not found"}, status_code=404)
            return JSONResponse(
                {
                    "id": payment.id,
                    "preapproval_id": payment.preapproval_id,
                    "status": payment.status,
                    "period_end": payment.period_end,
                }
            )

        return app

    def _fallback_authorized_payment(self, payment_id: str) -> Payment | None:
        """T007-compatibility ONLY — see module docstring."""
        if self._db_url is None:
            return None
        engine = sa.create_engine(self._db_url)
        try:
            with engine.connect() as conn:
                rows = conn.execute(
                    sa.text(
                        "SELECT s.mp_preapproval_id FROM subscriptions s"
                        " WHERE s.status IN ('pending','authorized')"
                        " AND s.deleted_at IS NULL"
                        " AND NOT EXISTS ("
                        "   SELECT 1 FROM billing_events be WHERE be.subscription_id = s.id"
                        " )"
                    )
                ).all()
        finally:
            engine.dispose()
        if len(rows) != 1:
            return None
        (preapproval_id,) = rows[0]
        if preapproval_id is None:
            return None
        period_end = (datetime.now(UTC) + timedelta(days=30)).isoformat()
        return Payment(
            id=payment_id, preapproval_id=preapproval_id, status="approved", period_end=period_end
        )
