"""E6 (T009) — the Mercado Pago provider: httpx, ~4 REST calls (research.md D10 — SDK rejected,
sync/requests-based, thin surface). Every method LOOKS UP the authoritative resource; nothing here
ever trusts a webhook body's own claimed fields (Constitution IV / SEC-104) — the caller (the
webhook route, T010) verifies the SIGNATURE first, then calls in here to fetch the truth.

**Test seam (`set_test_transport`)** — dev-backend, 2026-07-21: `test_billing_security.py` (T007,
frozen, opus-authored) and `test_billing_terminus.py` (T008) run with NO real MP credentials and
(per SEC-105/SEC-204's fixtures) invent PSP ids that no real Mercado Pago has ever heard of — so
the provider's httpx client must never touch the real network under pytest. `tests/conftest.py`
installs the local MP stub (T011b, `tests/mp_stub/stub.py`) as an `httpx.ASGITransport` here for
every billing test; production code NEVER calls `set_test_transport` — the default (`None`) always
dials the real Mercado Pago API.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

import httpx

from app.settings import Settings

from ..events import EventKind, VerifiedEvent

MP_API_BASE_URL = "https://api.mercadopago.com"

#: TEST-ONLY seam — see module docstring. Never set outside `tests/conftest.py`. `httpx.AsyncClient`
#: only accepts an ASYNC transport; `httpx.ASGITransport` (T011b's stub carrier) is one.
_test_transport: httpx.AsyncBaseTransport | None = None


def set_test_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    """TEST-ONLY (tests/conftest.py + tests/mp_stub). Routes every subsequently-constructed
    `MercadoPagoProvider`'s httpx client through `transport` instead of the real network."""
    global _test_transport
    _test_transport = transport


def _approved_kind(mp_status: str) -> EventKind:
    return "payment" if mp_status == "approved" else "payment_failed"


def _parse_dt(value: object) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


class MercadoPagoProvider:
    """The MP surface: `GET /preapproval/{id}`, `GET /authorized_payments/{id}`,
    `GET /authorized_payments/search?preapproval_id=`. Construct one per request/run (cheap; the
    underlying httpx connection pool is short-lived by design — no long-held credential in memory
    across requests)."""

    def __init__(self, settings: Settings) -> None:
        token = settings.mp_access_token.get_secret_value() if settings.mp_access_token else ""
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        self._client = httpx.AsyncClient(
            base_url=MP_API_BASE_URL,
            headers=headers,
            timeout=10.0,
            transport=_test_transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get(
        self, path: str, *, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        """A failed/unreachable/non-200 lookup is DENY-BY-DEFAULT: `None`, never a partial guess
        (seguranca-round §0 — "on any doubt the outcome is grant nothing")."""
        try:
            resp = await self._client.get(path, params=params)
        except httpx.HTTPError:
            return None
        if resp.status_code != 200:
            return None
        data: Any = resp.json()
        if isinstance(data, dict):
            return cast("dict[str, Any]", data)
        return None

    async def get_preapproval(self, preapproval_id: str) -> dict[str, Any] | None:
        return await self._get(f"/preapproval/{preapproval_id}")

    async def get_authorized_payment(self, payment_id: str) -> dict[str, Any] | None:
        return await self._get(f"/authorized_payments/{payment_id}")

    async def search_authorized_payments(self, preapproval_id: str) -> list[dict[str, Any]]:
        data = await self._get(
            "/authorized_payments/search", params={"preapproval_id": preapproval_id}
        )
        if not data:
            return []
        results = data.get("results")
        if isinstance(results, list):
            return cast("list[dict[str, Any]]", results)
        return []

    @staticmethod
    def normalise_authorized_payment(payment: dict[str, Any]) -> VerifiedEvent | None:
        """`GET /authorized_payments/{id}` (or a `search` row) → `VerifiedEvent`. `None` when the
        resource is missing the fields a grant needs — malformed-but-verified (T010's 422 case)
        or, for `search`, simply skipped."""
        preapproval_id = payment.get("preapproval_id")
        payment_id = payment.get("id")
        mp_status = payment.get("status")
        if not preapproval_id or payment_id is None or not mp_status:
            return None
        period_end = _parse_dt(payment.get("period_end") or payment.get("next_payment_date"))
        return VerifiedEvent(
            subscription_ref=str(preapproval_id),
            event_key=str(payment_id),
            kind=_approved_kind(str(mp_status)),
            period_end=period_end,
            mp_status=str(mp_status),
            raw=payment,
        )

    async def lookup_verified_event(self, event_type: str, data_id: str) -> VerifiedEvent | None:
        """Verify-then-lookup dispatch (SEC-104/D2): the webhook TYPE selects which resource to
        fetch. An unresolvable id, an unknown type, or a malformed resource returns `None` — the
        caller acks 200-fast (SEC-105) and writes nothing."""
        if event_type == "subscription_authorized_payment":
            payment = await self.get_authorized_payment(data_id)
            if payment is None:
                return None
            return self.normalise_authorized_payment(payment)
        if event_type == "subscription_preapproval":
            preapproval = await self.get_preapproval(data_id)
            if preapproval is None:
                return None
            status = preapproval.get("status")
            if status == "cancelled":
                # Status mirroring (T021/T022, PR-B) — the ledger write side is out of T009's
                # scope; this branch exists so the dispatch is complete, not so grant_writer acts
                # on it yet.
                return VerifiedEvent(
                    subscription_ref=str(preapproval.get("id", data_id)),
                    event_key=f"cancel:{data_id}",
                    kind="cancel",
                    period_end=None,
                    mp_status=str(status),
                    raw=preapproval,
                )
            return None
        return None

    async def list_verified_payments(self, preapproval_id: str) -> list[VerifiedEvent]:
        """T011 — the reconciliation runner's per-subscription poll."""
        payments = await self.search_authorized_payments(preapproval_id)
        events = [self.normalise_authorized_payment(p) for p in payments]
        return [e for e in events if e is not None]
