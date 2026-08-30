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


class ProviderUnavailable(Exception):
    """015/A2 — não conseguimos OBTER uma resposta do MP (rede, timeout, 5xx, corpo ilegível).

    É deliberadamente uma exceção e não um terceiro valor de retorno: um `None` extra seria fácil
    de ignorar por acidente, exatamente como o `None` original foi. Uma exceção obriga cada
    chamador a decidir o que fazer — e quem não decidir devolve 5xx, que é a conduta certa aqui.
    Nunca significa "o recurso não existe"; para isso o retorno continua sendo `None`.
    """


#: TEST-ONLY seam — see module docstring. Never set outside `tests/conftest.py`. `httpx.AsyncClient`
#: only accepts an ASYNC transport; `httpx.ASGITransport` (T011b's stub carrier) is one.
_test_transport: httpx.AsyncBaseTransport | None = None


def set_test_transport(transport: httpx.AsyncBaseTransport | None) -> None:
    """TEST-ONLY (tests/conftest.py + tests/mp_stub). Routes every subsequently-constructed
    `MercadoPagoProvider`'s httpx client through `transport` instead of the real network."""
    global _test_transport
    _test_transport = transport


#: T034 (US8) — os status que significam DINHEIRO DE VOLTA. Separados de `payment_failed` porque o
#: efeito e oposto: uma recusa abre carencia (o vendedor continua premium enquanto o MP tenta), um
#: estorno revoga (o pagamento deixou de existir). Tratar os dois como "nao aprovado" daria carencia
#: a quem pediu o dinheiro de volta — premium de graca, e silencioso.
_REEMBOLSO: dict[str, EventKind] = {
    "refunded": "refund",
    "charged_back": "chargeback",
    "cancelled": "refund",
}


def _approved_kind(mp_status: str) -> EventKind:
    if mp_status == "approved":
        return "payment"
    return _REEMBOLSO.get(mp_status, "payment_failed")


#: SC-706/SEC-501 minimisation (T017 condition C2): the ONLY fields of a looked-up MP resource
#: that `billing_events.raw` may retain. A real `authorized_payments` resource carries payer
#: email/CPF (`payer.identification`) and card `first_six_digits`/`last_four_digits` — none of
#: that is ours to keep; the audit trail needs identity + state, not PII.
_RAW_AUDIT_FIELDS = (
    "id",
    "preapproval_id",
    "status",
    "period_end",
    "next_payment_date",
    "plan_period",
    "reason",
    "live_mode",
    "date_created",
    "last_modified",
)


def _prune_raw(resource: dict[str, Any]) -> dict[str, Any]:
    """Whitelist-prune a looked-up MP resource before it is persisted as audit data. The payer
    is reduced to its bare id (`payer_id`); every unlisted field — card data, emails, documents,
    addresses — is dropped BEFORE the writer ever sees it."""
    pruned = {k: resource[k] for k in _RAW_AUDIT_FIELDS if k in resource}
    payer = resource.get("payer")
    if isinstance(payer, dict) and "id" in payer:
        pruned["payer_id"] = payer["id"]
    elif "payer_id" in resource:
        pruned["payer_id"] = resource["payer_id"]
    return pruned


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
            # Overridable ONLY so the e2e stack can point at the uvicorn-served T011b stub
            # (P3D_MP_BASE_URL); every deployed environment keeps the production default.
            base_url=settings.mp_base_url,
            headers=headers,
            timeout=10.0,
            transport=_test_transport,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get(
        self, path: str, *, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None:
        """Deny-by-default continua valendo — mas "não achei" e "não consegui perguntar" deixam de
        ser a mesma coisa (015/A2, `[F04b-001]`).

        Antes, todo caminho de falha devolvia `None`, e a rota do webhook lê `None` como
        "assinatura desconhecida": acka 200 e não escreve nada. Uma queda transitória do MP durante
        um webhook de renovação virava perda PERMANENTE e SILENCIOSA de um grant pago — e pior,
        respondendo 200 o código DESARMAVA o reenvio automático do MP (P-009: ele reenvia a cada 15
        minutos até receber 200/201).

        Agora:
          * `None`  — o MP RESPONDEU e não há recurso (404, ou um 4xx que dizemos malformado).
                      Insistir não muda a resposta; o chamador acka e segue.
          * raise   — NÃO obtivemos resposta útil (rede, timeout, 5xx, corpo que não é objeto).
                      O chamador não pode concluir nada, e quem pergunta de novo é o MP.

        Nenhum dos dois escreve. A diferença é só se o evento fica ou não dado como resolvido.
        """
        try:
            resp = await self._client.get(path, params=params)
        except httpx.HTTPError as exc:
            raise ProviderUnavailable(f"GET {path}: {type(exc).__name__}") from exc
        if resp.status_code >= 500:
            raise ProviderUnavailable(f"GET {path}: upstream {resp.status_code}")
        if resp.status_code != 200:
            return None
        data: Any = resp.json()
        if isinstance(data, dict):
            return cast("dict[str, Any]", data)
        # 200 com corpo que não é um objeto: o MP respondeu, mas não com o recurso. Tratar como
        # "não existe" seria concluir a partir de uma resposta que não entendemos.
        raise ProviderUnavailable(f"GET {path}: 200 com corpo {type(data).__name__}")

    async def get_preapproval(self, preapproval_id: str) -> dict[str, Any] | None:
        return await self._get(f"/preapproval/{preapproval_id}")

    async def create_preapproval(
        self, *, plan_id: str, payer_email: str | None, back_url: str
    ) -> dict[str, Any] | None:
        """T013 — `POST /preapproval` (ADR-0023 §1/§7): a plan-linked, pending preapproval whose
        `init_point` is the MP-hosted checkout URL the client redirects to. Deny-by-default on any
        network/non-2xx/malformed-response failure — `None`, never a partial guess (mirrors `_get`,
        seguranca-round §0); the caller (`app.billing.checkout`) maps `None` to an honest 503."""
        body: dict[str, Any] = {"preapproval_plan_id": plan_id, "back_url": back_url}
        if payer_email:
            body["payer_email"] = payer_email
        try:
            resp = await self._client.post("/preapproval", json=body)
        except httpx.HTTPError:
            return None
        if resp.status_code not in (200, 201):
            return None
        data: Any = resp.json()
        if not isinstance(data, dict):
            return None
        typed = cast("dict[str, Any]", data)
        if typed.get("id") and typed.get("init_point"):
            return typed
        return None

    async def cancel_preapproval(self, preapproval_id: str) -> bool:
        """T022 (US4) — `PUT /preapproval/{id}` com `status: "cancelled"`: para a cobrança
        recorrente NO PROVEDOR, que é onde ela de fato acontece.

        Devolve `True` só quando o MP confirmou. O padrão deny-by-default dos irmãos acima vale
        INVERTIDO aqui, e é a diferença que importa: numa leitura, a dúvida vira "não conceda
        nada"; num cancelamento, a dúvida NÃO pode virar "considere cancelado", porque o efeito de
        errar é o cartão do vendedor sendo cobrado no mês seguinte enquanto a nossa tela diz "não
        renova". Por isso o chamador só espelha o status local depois de um `True`.
        """
        try:
            resp = await self._client.put(
                f"/preapproval/{preapproval_id}", json={"status": "cancelled"}
            )
        except httpx.HTTPError:
            return False
        return resp.status_code in (200, 201)

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
            raw=_prune_raw(payment),
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
                    raw=_prune_raw(preapproval),
                )
            return None
        return None

    async def list_verified_payments(self, preapproval_id: str) -> list[VerifiedEvent]:
        """T011 — the reconciliation runner's per-subscription poll."""
        payments = await self.search_authorized_payments(preapproval_id)
        events = [self.normalise_authorized_payment(p) for p in payments]
        return [e for e in events if e is not None]
