"""E6 billing — the SEC-invariant suite as executable spec (T007), FAILING-first.

Translates ``specs/012-e6-billing/seguranca-round.md`` SEC-1xx..7xx into pytest against the FUTURE
surface (the webhook route + the ``grant_writer`` land with T009/T010; checkout with T013; Play with
T036). Like E5's T005 API-red split, this file is deliberately RED now: every webhook/checkout
assertion hits an ABSENT route (404, not the asserted 401/200), so the suite fails until the
implementation turns it green — the failing-first spine seguranca signs off against (§8).

**Two guards are intentionally GREEN now** and stay green forever (they assert an ABSENCE, and the
absence is the invariant):

* **VR-710** — the operator CLI still rejects ``source=payment`` (only the verified-event writer
  mints payment grants — Constitution IV). This runs against the LIVE ``grant_premium.py``.
* **VR-709** — with the Play flag OFF (the E6 default), no Play route is reachable server-side. No
  Play route exists yet, so 404 holds now; when T036 adds the flag-gated route it must STILL 404
  while OFF. (The exact Play path is a T036 contract decision — the assertion binds "unreachable",
  not a specific path.)

No real Mercado Pago anything: a LOCAL test webhook secret signs the fixtures with MP's real
manifest (``id:<data.id>;request-id:<x-request-id>;ts:<ts>;`` → HMAC-SHA256 → ``x-signature:
ts=…,v1=…``), so the signature path is genuinely exercised the moment the verifier lands — and
nothing here needs owner-provisioned credentials.

The encoded response contract (the implementation T010 owns; adjust here if a decision changes):
a signature that fails to verify (bad/absent/garbage/stale/``live_mode`` mismatch) is rejected
**401 before any lookup or DB write**; a validly-signed event that resolves to no local
subscription is **200-fast + zero grants** (the ADR-0023 §5 "ack 200, process idempotently, grant
nothing" shape). The load-bearing invariant under both is DENY-BY-DEFAULT: on any doubt, grant
nothing.
"""

from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import text

import app as app_pkg
from app.main import create_app
from app.scripts.grant_premium import GrantError, grant
from app.settings import Settings, get_settings
from tests.conftest import requires_db

pytestmark = requires_db

# A LOCAL test secret — never a real MP secret (the owner provisions later, T002). Signs the
# fixtures with MP's real manifest so the verifier is genuinely exercised once it lands.
WEBHOOK_SECRET = "whsec-local-test-only"  # noqa: S105

WEBHOOK_PATH = "/api/v1/billing/webhook/mercadopago"
CHECKOUT_PATH = "/api/v1/billing/checkout"
# The Play verify/RTDN route path is a T036 contract decision (undecided — Principle VIII). The
# VR-709 assertion binds "unreachable while OFF", not this specific path.
PLAY_VERIFY_PATH = "/api/v1/billing/webhook/google-play"


# --- MP signature + body fixtures (the real manifest, a local secret) -----------------------------


def _sign(
    data_id: str, *, secret: str = WEBHOOK_SECRET, ts: int | None = None, request_id: str = "req-1"
) -> dict[str, str]:
    """Build the ``x-signature`` header MP would send: HMAC-SHA256 over
    ``id:<data.id>;request-id:<x-request-id>;ts:<ts>;`` keyed by the webhook secret."""
    ts = ts if ts is not None else int(time.time())
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return {"x-signature": f"ts={ts},v1={v1}", "x-request-id": request_id}


def _body(
    data_id: str,
    *,
    live_mode: bool = False,
    type_: str = "subscription_authorized_payment",
    action: str = "created",
) -> dict[str, object]:
    return {"type": type_, "action": action, "data": {"id": data_id}, "live_mode": live_mode}


# --- Seeding (raw SQL — the writer does not exist yet) --------------------------------------------


def _mk_account(engine: sa.Engine, uid: str, email: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO accounts (account_uid, email) VALUES (:u, :e)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"u": uid, "e": email},
        )


def _mk_subscription(
    engine: sa.Engine,
    *,
    owner_uid: str,
    mp_preapproval_id: str,
    status: str = "authorized",
    plan_period: str = "monthly",
) -> str:
    sub_id = str(uuid.uuid4())
    _mk_account(engine, owner_uid)
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO subscriptions"
                " (id, owner_uid, provider, mp_preapproval_id, plan_period, status,"
                "  current_period_end, created_at, updated_at)"
                " VALUES (:id, :o, 'mercadopago', :mp, :pp, :st,"
                "  now() + interval '30 days', now(), now())"
            ),
            {
                "id": sub_id,
                "o": owner_uid,
                "mp": mp_preapproval_id,
                "pp": plan_period,
                "st": status,
            },
        )
    return sub_id


def _grant_counts(url: str, uid: str) -> tuple[int, int]:
    """(total grants, payment grants) for an account — the deny-by-default backstop."""
    engine = sa.create_engine(url)
    with engine.connect() as conn:
        total = int(
            conn.execute(
                text("SELECT count(*) FROM entitlement_grants WHERE account_uid = :u"), {"u": uid}
            ).scalar_one()
        )
        payment = int(
            conn.execute(
                text(
                    "SELECT count(*) FROM entitlement_grants"
                    " WHERE account_uid = :u AND source = 'payment'"
                ),
                {"u": uid},
            ).scalar_one()
        )
    engine.dispose()
    return total, payment


@pytest.fixture
def webhook_client(migrated_db: str, monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    """An app configured with the LOCAL webhook secret + a sandbox (dev) app_env, on the migrated
    testcontainer DB — so the future verifier reads a real (test) secret and the ``live_mode``↔env
    guard runs under ``app_env=dev`` (⇒ sandbox ⇒ ``live_mode=false`` expected)."""
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", WEBHOOK_SECRET)
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "tok-local-test-only")
    monkeypatch.setenv("P3D_APP_ENV", "dev")
    get_settings.cache_clear()
    app = create_app(Settings())
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client
    get_settings.cache_clear()


# ══ §1 Webhook authenticity — verify, THEN look up (SEC-101..107) ════════════════════════════════


def test_SEC101_bad_signature_rejected_401_and_zero_grants(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-101: a wrong ``v1`` is rejected 401 before any lookup/write. RED now (route absent)."""
    engine = sa.create_engine(migrated_db)
    _mk_subscription(engine, owner_uid="u-sec101", mp_preapproval_id="pre-101")
    data_id = "1010101"
    headers = _sign(data_id)
    headers["x-signature"] = "ts=1,v1=deadbeef"  # a wrong HMAC
    resp = webhook_client.post(WEBHOOK_PATH, json=_body(data_id), headers=headers)
    assert resp.status_code == 401, resp.text
    assert _grant_counts(migrated_db, "u-sec101") == (0, 0)


def test_SEC102_absent_signature_rejected_401(webhook_client: TestClient, migrated_db: str) -> None:
    """SEC-102: no ``x-signature`` header ⇒ rejected before any lookup. RED now."""
    resp = webhook_client.post(WEBHOOK_PATH, json=_body("2020202"))
    assert resp.status_code == 401, resp.text


def test_SEC102_absent_request_id_rejected_401(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-102: the manifest needs ``x-request-id``; without it verification cannot succeed."""
    headers = _sign("2020203")
    del headers["x-request-id"]
    resp = webhook_client.post(WEBHOOK_PATH, json=_body("2020203"), headers=headers)
    assert resp.status_code == 401, resp.text


def test_SEC101_garbage_signature_header_rejected_401(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-101: a malformed ``x-signature`` (not ``ts=…,v1=…``) is rejected, never parsed loose."""
    resp = webhook_client.post(
        WEBHOOK_PATH,
        json=_body("3030303"),
        headers={"x-signature": "not-a-signature", "x-request-id": "req-1"},
    )
    assert resp.status_code == 401, resp.text


def test_SEC106_stale_timestamp_rejected(webhook_client: TestClient, migrated_db: str) -> None:
    """SEC-106: a validly-HMAC'd body whose ``ts`` is far in the past is rejected as stale
    (signature-capture replay defence, on top of idempotency). RED now."""
    data_id = "4040404"
    old_ts = int(time.time()) - 60 * 60 * 24  # 24h old — outside any sane freshness window
    headers = _sign(data_id, ts=old_ts)
    resp = webhook_client.post(WEBHOOK_PATH, json=_body(data_id), headers=headers)
    assert resp.status_code == 401, resp.text


def test_SEC402_live_mode_mismatch_rejected(webhook_client: TestClient, migrated_db: str) -> None:
    """SEC-402/VR-705: a ``live_mode=true`` (prod) event presented to a sandbox (dev) app is
    rejected — the second, independent env-isolation guard (a sandbox event never writes a prod
    grant). RED now."""
    engine = sa.create_engine(migrated_db)
    _mk_subscription(engine, owner_uid="u-sec402", mp_preapproval_id="pre-402")
    data_id = "5050505"
    headers = _sign(data_id)
    resp = webhook_client.post(WEBHOOK_PATH, json=_body(data_id, live_mode=True), headers=headers)
    assert resp.status_code == 401, resp.text
    assert _grant_counts(migrated_db, "u-sec402") == (0, 0)


def test_SEC107_signature_compare_is_constant_time() -> None:
    """SEC-107: the HMAC comparison uses ``hmac.compare_digest`` (constant-time), never ``==`` (a
    timing oracle). Inspection-level: the value is that it is REVIEWED. RED now — ``app/billing``
    does not exist yet, so the constant-time primitive cannot be present."""
    billing_dir = Path(app_pkg.__file__).resolve().parent / "billing"
    assert billing_dir.exists(), "app/billing does not exist yet (lands with T009/T010)"
    sources = "\n".join(p.read_text(encoding="utf-8") for p in billing_dir.rglob("*.py"))
    assert "compare_digest" in sources, "signature verify must use hmac.compare_digest (SEC-107)"


def test_SEC403_missing_webhook_secret_rejects_all(
    migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """SEC-403: with the webhook secret UNSET, the endpoint rejects EVERY event — there is no branch
    that treats "no secret" as "accept". RED now (route absent → 404, not 401)."""
    monkeypatch.delenv("P3D_MP_WEBHOOK_SECRET", raising=False)
    get_settings.cache_clear()
    app = create_app(Settings())
    with TestClient(app, raise_server_exceptions=False) as client:
        data_id = "6060606"
        resp = client.post(WEBHOOK_PATH, json=_body(data_id), headers=_sign(data_id))
        assert resp.status_code == 401, resp.text
    get_settings.cache_clear()


# ══ §2 Idempotency, replay, cross-account isolation (SEC-201..204) ═══════════════════════════════


def test_SEC201_idempotent_processing_one_grant(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-201/VR-702: the same signed event delivered 5 times ⇒ exactly ONE payment grant (the
    ``event_key`` UNIQUE inbox). RED now — the route/writer are absent."""
    engine = sa.create_engine(migrated_db)
    _mk_subscription(engine, owner_uid="u-sec201", mp_preapproval_id="pre-201")
    data_id = "7070701"
    headers = _sign(data_id)
    for _ in range(5):
        resp = webhook_client.post(WEBHOOK_PATH, json=_body(data_id), headers=headers)
        assert resp.status_code == 200, resp.text
    assert _grant_counts(migrated_db, "u-sec201") == (1, 1)


def test_SEC203_old_event_replay_does_not_extend_entitlement(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-203/VR-704: re-delivering a genuine PAST event never extends ``expires_at`` nor
    re-activates a lapsed account — its ``event_key`` is already inbox'd, and its period end is
    already in the past. RED now."""
    engine = sa.create_engine(migrated_db)
    _mk_subscription(engine, owner_uid="u-sec203", mp_preapproval_id="pre-203")
    data_id = "7070703"
    headers = _sign(data_id)
    first = webhook_client.post(WEBHOOK_PATH, json=_body(data_id), headers=headers)
    assert first.status_code == 200, first.text
    replay = webhook_client.post(WEBHOOK_PATH, json=_body(data_id), headers=headers)
    assert replay.status_code == 200, replay.text
    # Still exactly one grant — the replay is inert.
    assert _grant_counts(migrated_db, "u-sec203") == (1, 1)


def test_SEC204_cross_account_event_isolation(webhook_client: TestClient, migrated_db: str) -> None:
    """SEC-204/VR-703: an event whose BODY carries ``account_uid=Y`` but whose subscription maps
    locally to X grants X, never Y — the account is resolved ONLY by the server-side
    subscription→owner mapping. RED now."""
    engine = sa.create_engine(migrated_db)
    _mk_subscription(engine, owner_uid="u-sec204-x", mp_preapproval_id="pre-204")
    _mk_account(engine, "u-sec204-y")
    data_id = "8080808"
    body = _body(data_id)
    body["account_uid"] = "u-sec204-y"  # attacker-supplied — MUST be ignored
    resp = webhook_client.post(WEBHOOK_PATH, json=body, headers=_sign(data_id))
    assert resp.status_code == 200, resp.text
    assert _grant_counts(migrated_db, "u-sec204-x")[1] == 1, "the mapped owner X gets the grant"
    assert _grant_counts(migrated_db, "u-sec204-y") == (0, 0), "the body-supplied Y gets nothing"


def test_SEC105_unknown_subscription_grants_nothing(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-105: a validly-signed event whose ``data.id`` resolves to NO subscription we created
    grants nothing (200-fast + zero writes). RED now (route absent → 404)."""
    data_id = "9090909"  # no local subscription references this
    resp = webhook_client.post(WEBHOOK_PATH, json=_body(data_id), headers=_sign(data_id))
    assert resp.status_code == 200, resp.text
    # No account exists for this phantom id, so no grant can have been written anywhere.
    with sa.create_engine(migrated_db).connect() as conn:
        payment_total = int(
            conn.execute(
                text("SELECT count(*) FROM entitlement_grants WHERE source = 'payment'")
            ).scalar_one()
        )
    assert payment_total == 0


# ══ §3 Client-trust boundary — checkout is auth'd + self-only (SEC-302) ══════════════════════════


def test_SEC302_checkout_requires_authentication(webhook_client: TestClient) -> None:
    """SEC-302/FR-702: checkout-start requires ``current_claims`` — 401 when signed out. RED now
    (route absent → 404)."""
    resp = webhook_client.post(CHECKOUT_PATH, json={"period": "monthly"})
    assert resp.status_code == 401, resp.text


def test_SEC301_no_client_write_path_to_a_payment_grant(
    webhook_client: TestClient, migrated_db: str
) -> None:
    """SEC-301: there is NO route by which an authenticated client mints a ``source=payment`` grant
    from client-supplied data. A client POST claiming "paid" grants nothing. RED now (the checkout
    route that should 4xx/ignore such a claim is absent → 404)."""
    resp = webhook_client.post(CHECKOUT_PATH, json={"period": "monthly", "paid": True})
    # Signed-out (no bearer) ⇒ 401; the point is it is NEVER a 200 that writes a grant.
    assert resp.status_code == 401, resp.text
    with sa.create_engine(migrated_db).connect() as conn:
        payment_total = int(
            conn.execute(
                text("SELECT count(*) FROM entitlement_grants WHERE source = 'payment'")
            ).scalar_one()
        )
    assert payment_total == 0


# ══ §7 Play Billing flag OFF — unreachable server-side (VR-709/SEC-701) ══════════════════════════


def test_VR709_play_route_unreachable_while_flag_off(webhook_client: TestClient) -> None:
    """VR-709/SEC-701: with ``P3D_PLAY_BILLING_ENABLED`` OFF (the E6 default), the Play verify/grant
    path is unreachable server-side. Currently GREEN by absence (no route); when T036 adds the
    flag-gated route it must STILL 404/return-disabled while OFF — hiding UI is insufficient.
    (Intentionally green now — the invariant is the ABSENCE.)"""
    assert get_settings().play_billing_enabled is False
    resp = webhook_client.post(PLAY_VERIFY_PATH, json={"purchaseToken": "fake"})
    assert resp.status_code == 404, resp.text


# ══ §Writer-separation — operator CLI never mints a payment grant (VR-710) ═══════════════════════


def test_VR710_operator_cli_rejects_source_payment(migrated_db: str) -> None:
    """VR-710/Constitution IV: the operator ``grant_premium.py`` CLI stays ``beta|comp`` — only the
    verified-event writer mints ``source=payment``. This is the ONE intentionally-GREEN guard now
    (it runs against the live CLI, whose guard must never be widened)."""
    engine = sa.create_engine(migrated_db)
    _mk_account(engine, "u-cli-pay")
    with pytest.raises(GrantError, match="source"):
        grant(engine, target="u-cli-pay", source="payment", granted_by="jonatan")
    assert _grant_counts(migrated_db, "u-cli-pay") == (0, 0)
