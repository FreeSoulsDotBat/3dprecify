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
    "/api/v1/history",  # E4: snapshots + the export.csv/quote.pdf routes (app/api/export.py),
    # which mount under the SAME "/history" path prefix, not a separate one (019/T115)
    "/api/v1/scenarios",  # E5: saved scenarios (ADR-0021) (019/T115)
)

_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _patch_verify(monkeypatch: pytest.MonkeyPatch, uid: str, email: str | None = None) -> None:
    def ok(_token: str) -> dict[str, Any]:
        claims: dict[str, Any] = {"uid": uid}
        if email:
            claims["email"] = email
        return claims

    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", ok)


def _flatten_routes(app: FastAPI) -> list[tuple[str, Any]]:
    """Walk the FULL route table with fully-qualified paths.

    fastapi==0.138 builds ``include_router`` lazily: ``app.routes`` exposes only routes/routers
    added DIRECTLY to the top app object, plus one ``fastapi.routing._IncludedRouter`` wrapper per
    ``include_router`` call — sub-routers (e.g. ``filaments_router``) never appear flattened, and
    a route added directly to a router (e.g. the ``/_debug/boom`` probe in ``app/main.py``) already
    carries that router's OWN prefix baked into ``route.path`` at definition time, while a route
    that arrived via ``include_router`` does NOT (the combining prefix instead lives on
    ``_IncludedRouter.include_context.prefix``, itself already the FULL accumulated prefix up to
    that point). ``app.routes.startswith(CATALOG_PREFIXES)`` against the raw table is therefore
    SILENTLY VACUOUS under this fastapi version — it matches zero routes and the old
    ``for route in catalog_routes: ...`` loop trivially passed with nothing exercised. This helper
    recurses through ``_IncludedRouter`` to recover the real, fully-qualified route table.
    """
    from fastapi.routing import (
        APIRoute,
        _IncludedRouter,  # pyright: ignore[reportPrivateUsage]
    )

    def walk(router: Any, inherited_prefix: str) -> list[tuple[str, Any]]:
        found: list[tuple[str, Any]] = []
        for r in router.routes:
            if isinstance(r, APIRoute):
                found.append((inherited_prefix + r.path, r))
            elif isinstance(r, _IncludedRouter):
                ctx = r.include_context
                found.extend(walk(ctx.included_router, ctx.prefix))
        return found

    return walk(app.router, "")


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


def test_every_catalog_route_carries_the_right_gate() -> None:
    """019/T115: method-aware audit — replaces the old any-port-any-method sweep.

    Every WRITE (POST/PUT/PATCH/DELETE) under a gated prefix MUST carry
    ``require_entitlement`` specifically (active-only — a lapsed seller must not persist).
    Every READ (GET) under a gated prefix must carry ONE of the two gates (``require_entitlement``
    OR ``require_catalog_read`` — both are legitimate for a read; export.py's GETs use the write
    gate on purpose, ADR-0020). Non-vacuous by construction (two separate assert-count sanity
    checks below) and proven non-vacuous by mutation — see the T115 report for the red run
    obtained by flipping ``POST /filaments``'s gate.
    """
    app = create_app(Settings(app_env="dev"))
    catalog_routes = [
        (path, route) for path, route in _flatten_routes(app) if path.startswith(CATALOG_PREFIXES)
    ]
    assert catalog_routes, "the route-table audit found no gated routes — check CATALOG_PREFIXES"
    write_routes = 0
    read_routes = 0
    for path, route in catalog_routes:
        gate_deps: list[Callable[..., object]] = [
            dep.call for dep in route.dependant.dependencies if dep.call is not None
        ]
        methods = route.methods - {"HEAD", "OPTIONS"}
        if methods & _WRITE_METHODS:
            write_routes += 1
            assert require_entitlement in gate_deps, (
                f"write route {sorted(methods)} {path} does not carry require_entitlement "
                "(active-only) — a lapsed or free caller could persist"
            )
        else:
            read_routes += 1
            assert require_entitlement in gate_deps or require_catalog_read in gate_deps, (
                f"read route {sorted(methods)} {path} bypasses the entitlement gates"
            )
    # A prefix list that matched only reads (or only writes) would hide exactly the class of bug
    # this test exists to catch on the other shape — both counters must be non-zero.
    assert write_routes > 0, "audit never exercised a WRITE route — CATALOG_PREFIXES is too narrow"
    assert read_routes > 0, "audit never exercised a READ route — CATALOG_PREFIXES is too narrow"


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
