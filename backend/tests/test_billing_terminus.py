"""E6 billing — the verified-payment terminus, FAILING-first (T008).

Where `test_billing_security.py` (T007, frozen) proves the SEC-invariant BOUNDARY (bad signature,
cross-account isolation, unknown subscription), this file proves the terminus's POSITIVE path is
correct end-to-end, through the REAL webhook route (T010) and reconciliation runner (T011), against
the local MP stub (T011b, `tests/mp_stub/stub.py`) — never the real network:

* a verified payment writes exactly ONE grant + ONE `billing_events` row, in the SAME transaction
  (VR-702), with `source=payment`, `subscription_id` set, and `expires_at` taken VERBATIM from
  MP's looked-up `period_end` (the clock-skew rule — spec §Edge Cases — never earlier than MP's
  own boundary);
* N replays of the SAME event ⇒ still one grant (SC-703);
* the webhook path and the reconciliation path converge on the SAME `event_key` without a
  double-grant (US3.5 — a missed webhook, healed by the poll, then a late webhook for the SAME
  payment: still one);
* `GET /api/v1/entitlement` flips to `active`/`source=payment` without re-login (SC-701).

Unlike `test_billing_security.py`'s raw-SQL-only fixtures, every subscription/payment here is
created through the stub's OWN registration API — a clean, non-heuristic path (see
`tests/mp_stub/stub.py`'s module docstring for why the frozen SEC suite needs a different,
documented fallback).
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import get_session_factory
from app.main import create_app
from app.settings import Settings, get_settings
from tests.conftest import requires_db
from tests.helpers import patch_verify
from tests.mp_stub.stub import MPStub

pytestmark = requires_db

WEBHOOK_SECRET = "whsec-local-test-only"  # noqa: S105
WEBHOOK_PATH = "/api/v1/billing/webhook/mercadopago"


@pytest.fixture
def billing_client(migrated_db: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "tok-local-test-only")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    app = create_app(Settings())
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


def _mk_account(engine: sa.Engine, uid: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO accounts (account_uid) VALUES (:u)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"u": uid},
        )


def _mk_subscription(engine: sa.Engine, *, owner_uid: str, mp_preapproval_id: str) -> str:
    sub_id = str(uuid.uuid4())
    _mk_account(engine, owner_uid)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO subscriptions"
                " (id, owner_uid, provider, mp_preapproval_id, plan_period, status,"
                "  created_at, updated_at)"
                " VALUES (:id, :o, 'mercadopago', :mp, 'monthly', 'authorized', now(), now())"
            ),
            {"id": sub_id, "o": owner_uid, "mp": mp_preapproval_id},
        )
    return sub_id


def _grants(engine: sa.Engine, uid: str) -> list[sa.Row[tuple[str, object, object]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT source, expires_at, subscription_id FROM entitlement_grants"
                    " WHERE account_uid = :u"
                ),
                {"u": uid},
            ).all()
        )


def _events(engine: sa.Engine, sub_id: str) -> list[sa.Row[tuple[str, str]]]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text("SELECT event_key, kind FROM billing_events WHERE subscription_id = :s"),
                {"s": sub_id},
            ).all()
        )


def test_verified_payment_writes_one_grant_and_one_inbox_row_same_transaction(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-basic"
    pre = mp_stub.create_preapproval(plan_period="monthly")
    sub_id = _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)
    payment = mp_stub.authorize_payment(pre.id, period_days=30)

    resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text

    grants = _grants(engine, owner_uid)
    events = _events(engine, sub_id)
    assert len(grants) == 1
    assert grants[0].source == "payment"
    assert str(grants[0].subscription_id) == sub_id
    assert len(events) == 1
    assert events[0].event_key == payment.id
    assert events[0].kind == "payment"


def test_clock_skew_expires_at_matches_mp_period_end_verbatim(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """The grant's `expires_at` is MP's `period_end`, VERBATIM — never a server-side floor/recompute
    that could land earlier than MP's authoritative boundary (spec §Edge Cases)."""
    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-skew"
    pre = mp_stub.create_preapproval(plan_period="annual")
    _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)
    payment = mp_stub.authorize_payment(pre.id, period_days=365)
    assert payment.period_end is not None
    expected = datetime.fromisoformat(payment.period_end)

    resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text

    grants = _grants(engine, owner_uid)
    assert len(grants) == 1
    got = grants[0].expires_at
    if got.tzinfo is None:
        got = got.replace(tzinfo=UTC)
    assert got == expected


def test_n_replays_of_the_same_event_still_one_grant(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-replay"
    pre = mp_stub.create_preapproval()
    _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)
    payment = mp_stub.authorize_payment(pre.id)

    for _ in range(5):
        resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
        assert resp.status_code == 200, resp.text

    assert len(_grants(engine, owner_uid)) == 1


async def test_webhook_and_reconcile_converge_on_the_same_key(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """US3.5: a missed webhook, healed by reconciliation, then a LATE webhook for the same payment —
    still exactly one grant (SEC-202's convergence, exercised through T011's runner)."""
    from app.billing.providers.mercadopago import MercadoPagoProvider
    from app.billing.reconcile import reconcile_all

    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-reconcile"
    pre = mp_stub.create_preapproval()
    _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)
    # Registered in the stub but NEVER delivered as a webhook — simulates a missed notification.
    payment = mp_stub.authorize_payment(pre.id)

    session_factory = get_session_factory()
    provider = MercadoPagoProvider(get_settings())
    try:
        async with session_factory() as session:
            summary = await reconcile_all(session, provider)
    finally:
        await provider.aclose()
    assert summary.grants_written == 1
    assert len(_grants(engine, owner_uid)) == 1

    # The late webhook for the SAME payment converges — still one grant.
    resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text
    assert len(_grants(engine, owner_uid)) == 1


def test_entitlement_flips_active_after_verified_payment_no_relogin(
    billing_client: TestClient,
    migrated_db: str,
    mp_stub: MPStub,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """SC-701: the SAME `GET /api/v1/entitlement` (unchanged, E2) flips to active/`source=payment`
    the moment a verified event lands — no new token, no re-login."""
    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-entitlement"
    patch_verify(monkeypatch, owner_uid)
    pre = mp_stub.create_preapproval()
    _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)

    before = billing_client.get("/api/v1/entitlement", headers={"Authorization": "Bearer t"})
    assert before.status_code == 200
    assert before.json().get("status") != "active"

    payment = mp_stub.authorize_payment(pre.id)
    resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text

    after = billing_client.get("/api/v1/entitlement", headers={"Authorization": "Bearer t"})
    assert after.status_code == 200
    body = after.json()
    assert body["status"] == "active"
    assert body["source"] == "payment"


def test_SEC104_a_signed_webhook_whose_lookup_says_rejected_grants_nothing(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """T017 condition C1 — "the single most important test in the epic": a VALIDLY-SIGNED webhook
    whose looked-up resource is NOT approved acks 200 and writes NOTHING — the lookup, never the
    body, is the writer's only input (SEC-104). In the CURRENT increment every non-`payment` kind
    returns before the inbox (grant_writer docstring); PR-B's grace path (T023/T024) refines this:
    a failed RENEWAL of a previously-active subscription will write a grace grant + an inbox row —
    a failed FIRST charge like this one must still grant nothing."""
    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-sec104"
    pre = mp_stub.create_preapproval(plan_period="monthly")
    sub_id = _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)
    payment = mp_stub.fail_payment(pre.id)

    resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text

    assert _grants(engine, owner_uid) == []
    assert _events(engine, sub_id) == []


def test_SEC501_prune_raw_strips_payer_pii_and_card_data() -> None:
    """T017 condition C2 (SC-706/SEC-501): a realistic full MP `authorized_payments` resource —
    payer email/CPF, card first6/last4, address — reduces to the audit whitelist + bare payer id."""
    from app.billing.providers.mercadopago import (
        _RAW_AUDIT_FIELDS,  # pyright: ignore[reportPrivateUsage]
        _prune_raw,  # pyright: ignore[reportPrivateUsage]
    )

    fat_resource = {
        "id": "pay-123",
        "preapproval_id": "pre-123",
        "status": "approved",
        "period_end": "2026-08-21T00:00:00Z",
        "live_mode": False,
        "payer": {
            "id": 991,
            "email": "seller@example.com",
            "identification": {"type": "CPF", "number": "12345678901"},
            "address": {"zip_code": "01234-567"},
        },
        "card": {"first_six_digits": "503143", "last_four_digits": "6351"},
        "transaction_amount": 15.99,
        "payment_method_id": "master",
    }
    pruned = _prune_raw(fat_resource)

    assert pruned["payer_id"] == 991
    allowed = set(_RAW_AUDIT_FIELDS) | {"payer_id"}
    assert set(pruned) <= allowed
    flat = repr(pruned)
    for forbidden in ("email", "CPF", "12345678901", "first_six", "6351", "zip_code", "card"):
        assert forbidden not in flat


def test_SEC501_stored_raw_keys_are_whitelist_only(
    billing_client: TestClient, migrated_db: str, mp_stub: MPStub
) -> None:
    """The wire-level lock of C2: after real webhook processing, every key persisted in
    `billing_events.raw` is inside the audit whitelist (+ `payer_id`) — no PAN-shaped value."""
    import json
    import re

    from app.billing.providers.mercadopago import (
        _RAW_AUDIT_FIELDS,  # pyright: ignore[reportPrivateUsage]
    )

    engine = sa.create_engine(migrated_db)
    owner_uid = "u-terminus-sec501"
    pre = mp_stub.create_preapproval(plan_period="monthly")
    _mk_subscription(engine, owner_uid=owner_uid, mp_preapproval_id=pre.id)
    payment = mp_stub.authorize_payment(pre.id, period_days=30)
    resp = mp_stub.fire_webhook(billing_client, payment_id=payment.id, secret=WEBHOOK_SECRET)
    assert resp.status_code == 200, resp.text

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT raw FROM billing_events")).scalars().all()
    assert rows, "the webhook must have persisted exactly one inbox row"
    allowed = set(_RAW_AUDIT_FIELDS) | {"payer_id"}
    for raw in rows:
        payload = raw if isinstance(raw, dict) else json.loads(str(raw))
        assert set(payload) <= allowed
        assert not re.search(r"\b\d{13,19}\b", json.dumps(payload))
