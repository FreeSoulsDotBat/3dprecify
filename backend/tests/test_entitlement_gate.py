"""US1 (FR-301/302, SC-301) — the server-side entitlement gate, written FAILING-first.

PR-A has no catalog routes yet, so these tests exercise the seam itself: a test-only probe
route wired with ``require_entitlement`` inside the REAL app stack (middlewares, error
handlers, envelope), plus a DYNAMIC route-table audit that is vacuous today and arms itself
automatically when the PR-B routers land (no rewrite), plus the FR-313 resilience check
(free surfaces respond with the DB unreachable). DB-backed cases run against a real
Postgres (testcontainers) and SKIP VISIBLY without Docker (ADR-0013).
"""

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi import APIRouter, Depends, FastAPI
from fastapi.testclient import TestClient

from app import auth
from app.entitlement import require_catalog_read, require_entitlement
from app.main import create_app
from app.settings import Settings, get_settings
from tests.conftest import requires_db

CATALOG_PREFIXES = (
    "/api/v1/filaments",
    "/api/v1/printers",
    "/api/v1/products",
    "/api/v1/boms",  # E3/PR-B: kit persistence joins the gated catalog surface (ADR-0015)
)


def _patch_verify(monkeypatch: pytest.MonkeyPatch, uid: str, email: str | None = None) -> None:
    def ok(_token: str) -> dict[str, Any]:
        claims: dict[str, Any] = {"uid": uid}
        if email:
            claims["email"] = email
        return claims

    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", ok)


def _app_with_probe(settings: Settings) -> FastAPI:
    """The real app + a test-only persistence probe guarded by the REAL gate."""
    app = create_app(settings)
    probe = APIRouter(prefix="/api/v1/_probe")

    @probe.post("/persist", dependencies=[Depends(require_entitlement)])
    async def _persist() -> dict[str, str]:  # pragma: no cover - trivial body
        return {"ok": "true"}

    @probe.get("/read", dependencies=[Depends(require_catalog_read)])
    async def _read() -> dict[str, str]:  # pragma: no cover - trivial body
        return {"ok": "true"}

    app.include_router(probe)
    return app


@pytest.fixture
def probe_client(migrated_db: str) -> Iterator[TestClient]:
    app = _app_with_probe(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _seed_grant(
    db_url: str,
    uid: str,
    *,
    expires_delta_h: int | None = None,
    revoked: bool = False,
) -> None:
    import sqlalchemy as sa

    engine = sa.create_engine(db_url)
    now = datetime.now(UTC)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid) VALUES (:uid)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"uid": uid},
        )
        conn.execute(
            sa.text(
                "INSERT INTO entitlement_grants"
                " (id, account_uid, source, granted_by, granted_at, expires_at, revoked_at)"
                " VALUES (gen_random_uuid(), :uid, 'beta', 'test-operator', :now, :exp, :rev)"
            ),
            {
                "uid": uid,
                "now": now,
                "exp": (now + timedelta(hours=expires_delta_h)) if expires_delta_h else None,
                "rev": now if revoked else None,
            },
        )
    engine.dispose()


# --- The gate (probe route, real stack) -----------------------------------------------------


def test_signed_out_is_401_before_any_entitlement_check(migrated_db: str) -> None:
    app = _app_with_probe(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as c:
        r = c.post("/api/v1/_probe/persist")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"


@requires_db
def test_free_identity_is_denied_entitlement_required(
    probe_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_verify(monkeypatch, uid="free-user-1")
    r = probe_client.post("/api/v1/_probe/persist", headers={"Authorization": "Bearer t"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


@requires_db
def test_forged_client_premium_state_is_a_non_event(
    probe_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_verify(monkeypatch, uid="free-user-2")
    r = probe_client.post(
        "/api/v1/_probe/persist",
        headers={"Authorization": "Bearer t", "X-Premium": "true"},
        json={"isPremium": True},
    )
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


@requires_db
def test_active_grant_passes(
    probe_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _seed_grant(migrated_db, "premium-user-1")
    _patch_verify(monkeypatch, uid="premium-user-1")
    r = probe_client.post("/api/v1/_probe/persist", headers={"Authorization": "Bearer t"})
    assert r.status_code == 200


@requires_db
def test_expired_grant_is_denied(
    probe_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _seed_grant(migrated_db, "expired-user-1", expires_delta_h=-1)
    _patch_verify(monkeypatch, uid="expired-user-1")
    r = probe_client.post("/api/v1/_probe/persist", headers={"Authorization": "Bearer t"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


@requires_db
def test_revoked_grant_is_denied(
    probe_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _seed_grant(migrated_db, "revoked-user-1", revoked=True)
    _patch_verify(monkeypatch, uid="revoked-user-1")
    r = probe_client.post("/api/v1/_probe/persist", headers={"Authorization": "Bearer t"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


# --- Lapsed = read-only freeze (Q3/FR-311): reads pass, writes deny --------------------------


@requires_db
def test_lapsed_grant_reads_but_cannot_write(
    probe_client: TestClient, migrated_db: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    _seed_grant(migrated_db, "lapsed-user-1", revoked=True)
    _patch_verify(monkeypatch, uid="lapsed-user-1")
    headers = {"Authorization": "Bearer t"}
    assert probe_client.get("/api/v1/_probe/read", headers=headers).status_code == 200
    write = probe_client.post("/api/v1/_probe/persist", headers=headers)
    assert write.status_code == 403
    assert write.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


@requires_db
def test_never_granted_cannot_even_read(
    probe_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_verify(monkeypatch, uid="nobody-user-1")
    r = probe_client.get("/api/v1/_probe/read", headers={"Authorization": "Bearer t"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


# --- Route-table audit (US1-4: vacuous today, arms itself when PR-B routers land) ------------


def test_every_catalog_route_carries_the_gate() -> None:
    from fastapi.routing import APIRoute

    app = create_app(Settings(app_env="dev"))
    catalog_routes = [
        route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path.startswith(CATALOG_PREFIXES)
    ]
    for route in catalog_routes:
        gate_deps: list[Callable[..., object]] = [
            dep.call for dep in route.dependant.dependencies if dep.call is not None
        ]
        # Writes carry require_entitlement (active only); reads carry require_catalog_read
        # (active|lapsed — Q3 freeze). Every catalog route MUST carry one of the two.
        assert require_entitlement in gate_deps or require_catalog_read in gate_deps, (
            f"persistence route {route.methods} {route.path} bypasses the entitlement gates"
        )


# --- FR-313 resilience: free surfaces respond with the DB unreachable ------------------------


def test_free_surfaces_respond_with_db_unreachable(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.db import reset_engine_for_tests

    monkeypatch.setenv("P3D_DATABASE_URL", "postgresql+psycopg://nobody@localhost:1/nope")
    get_settings.cache_clear()
    reset_engine_for_tests()
    try:
        app = create_app(Settings(app_env="dev"))
        with TestClient(app, raise_server_exceptions=False) as c:
            assert c.get("/health").status_code == 200
            assert c.get("/api/v1/fee-catalog").status_code == 200
            # Auth path (no DB): missing token is still the honest 401, not a DB error.
            assert c.get("/api/v1/me").status_code == 401
    finally:
        get_settings.cache_clear()
        reset_engine_for_tests()
