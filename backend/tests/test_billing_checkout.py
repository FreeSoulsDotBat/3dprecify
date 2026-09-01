"""E6 billing — `POST /api/v1/billing/checkout`, FAILING-first (T012).

Covers `contracts/api-surface.md`'s checkout entry and `seguranca-round.md` SEC-302/SEC-604:

* 401 when signed out (FR-702) — asserted here AND mirrored by the frozen `test_billing_security.py`
  (SEC301/SEC302), which this task flips green.
* authenticated → creates the pending MP preapproval (plan id resolved from settings per period) +
  a `pending` `subscriptions` row + returns `{initPoint}`; NO grant is ever written (SEC-301).
* a second checkout while an active/grace/paused/pending subscription already exists → 409
  (SEC-604 — the DB partial-unique index's double-subscribe guard, exercised end-to-end).
* an abandoned checkout (created, never completed) has ZERO entitlement effect — invisible on
  `GET /api/v1/entitlement` (US2.2).
* MP unreachable at create-time → an honest 503 `BILLING_UNAVAILABLE`, no partial `subscriptions`
  row left behind (checkout only writes the row AFTER the provider call succeeds).

Runs through the REAL route against the local MP stub (T011b) — never the real network, mirroring
`test_billing_terminus.py`'s pattern (a `billing_client`-style fixture, `patch_verify` for auth).
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator

import httpx
import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.main import create_app
from app.settings import Settings, get_settings
from tests.conftest import requires_db
from tests.helpers import patch_verify
from tests.mp_stub.stub import MPStub

pytestmark = requires_db

CHECKOUT_PATH = "/api/v1/billing/checkout"
ENTITLEMENT_PATH = "/api/v1/entitlement"


@pytest.fixture
def checkout_client(migrated_db: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", "whsec-local-test-only")
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "tok-local-test-only")
    monkeypatch.setenv("P3D_MP_PLAN_ID_MONTHLY", "plan-monthly-test")
    monkeypatch.setenv("P3D_MP_PLAN_ID_ANNUAL", "plan-annual-test")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    app = create_app(Settings())
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


def _subscriptions(engine: sa.Engine, uid: str) -> list[sa.Row[tuple[str, str, str]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT status, mp_preapproval_id, plan_period FROM subscriptions"
                    " WHERE owner_uid = :u"
                ),
                {"u": uid},
            ).all()
        )


def _payment_grant_count(engine: sa.Engine, uid: str) -> int:
    with engine.connect() as conn:
        return int(
            conn.execute(
                text(
                    "SELECT count(*) FROM entitlement_grants"
                    " WHERE account_uid = :u AND source = 'payment'"
                ),
                {"u": uid},
            ).scalar_one()
        )


# ══ §1 auth boundary (SEC-302/FR-702) ══════════════════════════════════════════════════════════


def test_checkout_requires_authentication(checkout_client: TestClient) -> None:
    resp = checkout_client.post(CHECKOUT_PATH, json={"period": "monthly"})
    assert resp.status_code == 401, resp.text


# ══ §2 happy path — pending preapproval + pending subscription row, no grant ═══════════════════


def test_checkout_creates_pending_subscription_and_returns_init_point(
    checkout_client: TestClient, migrated_db: str, mp_stub: MPStub, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine = sa.create_engine(migrated_db)
    uid = f"u-checkout-{uuid.uuid4().hex[:8]}"
    patch_verify(monkeypatch, uid, email="seller@example.com")

    resp = checkout_client.post(
        CHECKOUT_PATH, json={"period": "monthly"}, headers={"Authorization": "Bearer t"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "initPoint" in body
    assert body["initPoint"].startswith("https://")

    rows = _subscriptions(engine, uid)
    assert len(rows) == 1
    assert rows[0].status == "pending"
    assert rows[0].mp_preapproval_id is not None
    assert rows[0].plan_period == "monthly"
    assert body["initPoint"].endswith(rows[0].mp_preapproval_id)

    # SEC-301: a checkout NEVER writes a grant by itself.
    assert _payment_grant_count(engine, uid) == 0

    # T013 constraint (ux-billing.md — the measured base:'./' cold-load trap): the back_url MUST
    # be a 1-segment route.
    created = [p for p in mp_stub.preapprovals() if p.id == rows[0].mp_preapproval_id]
    assert len(created) == 1
    back_url = created[0].back_url
    assert back_url is not None
    path = httpx.URL(back_url).path
    assert path.count("/") == 1, f"back_url path must be 1-segment, got {path!r}"


# ══ §3 double-subscribe guard (SEC-604) ══════════════════════════════════════════════════════════


def test_second_checkout_while_one_is_open_returns_409(
    checkout_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    uid = f"u-checkout-{uuid.uuid4().hex[:8]}"
    patch_verify(monkeypatch, uid, email="seller2@example.com")

    first = checkout_client.post(
        CHECKOUT_PATH, json={"period": "monthly"}, headers={"Authorization": "Bearer t"}
    )
    assert first.status_code == 200, first.text

    second = checkout_client.post(
        CHECKOUT_PATH, json={"period": "annual"}, headers={"Authorization": "Bearer t"}
    )
    assert second.status_code == 409, second.text

    engine = sa.create_engine(migrated_db)
    rows = _subscriptions(engine, uid)
    assert len(rows) == 1  # the second attempt wrote nothing


# ══ §4 abandoned checkout = zero entitlement effect (US2.2) ═══════════════════════════════════════


def test_abandoned_checkout_leaves_entitlement_untouched(
    checkout_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    uid = f"u-checkout-{uuid.uuid4().hex[:8]}"
    patch_verify(monkeypatch, uid, email="abandoner@example.com")

    checkout = checkout_client.post(
        CHECKOUT_PATH, json={"period": "monthly"}, headers={"Authorization": "Bearer t"}
    )
    assert checkout.status_code == 200, checkout.text

    # No webhook ever fires (the seller closed the tab) — entitlement stays exactly as before.
    ent = checkout_client.get(ENTITLEMENT_PATH, headers={"Authorization": "Bearer t"})
    assert ent.status_code == 200
    body = ent.json()
    assert body["status"] != "active"
    assert body.get("source") is None


# ══ §5 MP unreachable → honest 503, no partial row (US2/SC-702 adjacent) ══════════════════════════


def test_mp_unreachable_returns_503_and_leaves_no_partial_row(
    checkout_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.billing.providers import mercadopago as mp_provider

    uid = f"u-checkout-{uuid.uuid4().hex[:8]}"
    patch_verify(monkeypatch, uid, email="offline@example.com")

    def _boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("stub outage", request=request)

    mp_provider.set_test_transport(httpx.MockTransport(_boom))
    try:
        resp = checkout_client.post(
            CHECKOUT_PATH, json={"period": "monthly"}, headers={"Authorization": "Bearer t"}
        )
    finally:
        mp_provider.set_test_transport(None)  # the mp_stub fixture resets on teardown too

    assert resp.status_code == 503, resp.text
    assert resp.json()["error"]["code"] == "BILLING_UNAVAILABLE"

    engine = sa.create_engine(migrated_db)
    assert _subscriptions(engine, uid) == []


# ══ §6 B7 — empty CORS allowlist must not leak `localhost` as the payer's return URL ══════════════


def test_empty_cors_origins_fails_checkout_honestly_instead_of_localhost(
    migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """B7 (`docs/RELATORIO_LEGIBILIDADE.md`): `_back_url` used to fall back to the literal
    ``http://localhost:5173`` whenever `cors_origins` was empty — in a real deploy that sends the
    payer, on their own device, to a blank page right after paying. A genuinely empty allowlist
    (a provisioning gap; the shipped default is never empty) must now fail the checkout with an
    honest 503 `BILLING_UNAVAILABLE`, never with a hardcoded localhost URL."""
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", "whsec-local-test-only")
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "tok-local-test-only")
    monkeypatch.setenv("P3D_MP_PLAN_ID_MONTHLY", "plan-monthly-test")
    monkeypatch.setenv("P3D_MP_PLAN_ID_ANNUAL", "plan-annual-test")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    monkeypatch.setenv("P3D_CORS_ORIGINS", "[]")
    get_settings.cache_clear()
    try:
        app = create_app(Settings())
        with TestClient(app, raise_server_exceptions=False) as client:
            uid = f"u-checkout-{uuid.uuid4().hex[:8]}"
            patch_verify(monkeypatch, uid, email="no-origin@example.com")

            resp = client.post(
                CHECKOUT_PATH, json={"period": "monthly"}, headers={"Authorization": "Bearer t"}
            )

            assert resp.status_code == 503, resp.text
            assert resp.json()["error"]["code"] == "BILLING_UNAVAILABLE"

            engine = sa.create_engine(migrated_db)
            assert _subscriptions(engine, uid) == []  # no partial row left behind
    finally:
        get_settings.cache_clear()


def test_default_cors_origins_is_never_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """Pins the assumption `_back_url`'s fix (and every local/dev run) relies on: the SHIPPED
    default keeps covering local Vite dev (5173) + preview (4173), so B7's guard only ever fires
    on a genuine provisioning gap, never in normal operation."""
    monkeypatch.delenv("P3D_CORS_ORIGINS", raising=False)
    assert Settings().cors_origins == ["http://localhost:5173", "http://localhost:4173"]
