import asyncio
import sys
from collections.abc import Iterator
from functools import lru_cache
from typing import TYPE_CHECKING

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings

if TYPE_CHECKING:
    from tests.mp_stub.stub import MPStub

# psycopg async cannot run on Windows' default ProactorEventLoop — tests (and any Windows dev
# server touching DB routes) need the selector loop. Linux (CI/Cloud Run) is unaffected.
# set_event_loop_policy is deprecated from Py 3.14, but we pin >=3.12,<3.13 (pyproject) and it
# is the only policy hook on 3.12 — revisit when the Python pin moves.
if sys.platform == "win32":  # pragma: no cover - platform-specific
    asyncio.set_event_loop_policy(  # pyright: ignore[reportDeprecated]
        asyncio.WindowsSelectorEventLoopPolicy()
    )


@pytest.fixture
def client() -> Iterator[TestClient]:
    app = create_app(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client


# --- DB test infrastructure (E2, ADR-0013) -------------------------------------------------
# DB-backed tests run against a REAL Postgres via testcontainers. Without a reachable Docker
# daemon they SKIP with a VISIBLE reason (never silently green): `pnpm gate:be` on a machine
# without Docker shows the skips; CI (ubuntu runners ship Docker) runs them authoritatively.
# SQLite is deliberately NOT a test double (dialect divergence — ADR-0013).


@lru_cache
def _docker_available() -> bool:
    try:
        from testcontainers.core.docker_client import DockerClient

        DockerClient()
        return True
    except Exception:  # any daemon/connection failure means "no Docker here"
        return False


requires_db = pytest.mark.skipif(
    not _docker_available(),
    reason=(
        "DOCKER UNAVAILABLE — DB-backed test SKIPPED (visible guard, ADR-0013); "
        "CI runs these authoritatively"
    ),
)


@pytest.fixture(scope="session")
def postgres_url() -> Iterator[str]:
    """A real Postgres for the test session (testcontainers), psycopg3 URL."""
    import os

    # Ryuk (the reaper sidecar) fails its port mapping on Docker Desktop/Windows setups; the
    # context manager below already guarantees container cleanup, so the reaper is redundant.
    os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:17-alpine", driver="psycopg") as pg:
        yield pg.get_connection_url()


@pytest.fixture(scope="session")
def migrated_db(postgres_url: str) -> Iterator[str]:
    """Point the app at the testcontainer DB (env) + apply migration 0001 (session-wide)."""
    import os

    from alembic.config import Config

    from alembic import command
    from app.db import reset_engine_for_tests
    from app.settings import get_settings

    old = os.environ.get("P3D_DATABASE_URL")
    os.environ["P3D_DATABASE_URL"] = postgres_url
    get_settings.cache_clear()
    reset_engine_for_tests()
    command.upgrade(Config("alembic.ini"), "head")
    yield postgres_url
    if old is None:
        os.environ.pop("P3D_DATABASE_URL", None)
    else:
        os.environ["P3D_DATABASE_URL"] = old
    get_settings.cache_clear()
    reset_engine_for_tests()


# --- E6 billing test infra (T008/T010/T011b/T012) -----------------------------------------------
# Applies ONLY to the billing test modules — everything else in the suite is unaffected.
_BILLING_TEST_MODULES = {
    "tests.test_billing_security",
    "tests.test_billing_terminus",
    "tests.test_billing_checkout",
    "tests.test_billing_cancel",
    "tests.test_billing_grace",
}


@pytest.fixture(autouse=True)
def mp_stub(request: pytest.FixtureRequest) -> Iterator["MPStub | None"]:
    """Autouse for the two billing test modules (nothing elsewhere is affected):

    1. Installs the LOCAL MP stub (T011b, `tests/mp_stub/stub.py`) as every `MercadoPagoProvider`'s
       httpx transport for the test's duration — no billing test ever touches the real network
       (`test_billing_security.py`, T007, is FROZEN and carries no such wiring itself; installing it
       here, globally, is what makes its webhook posts resolve without real MP credentials).
    2. Truncates `billing_events`/`subscriptions` and deletes `source='payment'` grants BEFORE each
       test. `test_billing_security.py::test_SEC105_unknown_subscription_grants_nothing` asserts a
       GLOBAL `entitlement_grants WHERE source='payment'` count of zero — unlike the rest of the
       house's per-uid-scoped assertions — which only holds with per-test isolation on these three
       billing tables (it runs, by file order, AFTER SEC201/203/204, which legitimately write
       grants). Nothing else in either module depends on cross-test billing state.

    Yields the `MPStub` instance so `test_billing_terminus.py` (T008) can use its registration API
    directly (`mp_stub.create_preapproval(...)`, `.authorize_payment(...)`, `.fire_webhook(...)`);
    the frozen SEC suite never references it by name, which is fine — autouse still applies.
    """
    module_name = request.node.module.__name__
    if module_name not in _BILLING_TEST_MODULES or "migrated_db" not in request.fixturenames:
        # Um teste que PEDE `mp_stub` pelo nome e cujo modulo ficou de fora da lista recebia `None`
        # em silencio, e o sintoma chegava como `AttributeError: 'NoneType' has no attribute
        # 'create_preapproval'` la dentro do teste — que nao aponta para a lista, que e onde esta a
        # causa. A lista e a aplicacao da regra, e uma lista que falha calada e a familia de defeito
        # que este projeto vem pagando. Pedir explicitamente e um sinal claro de intencao, entao
        # aqui ele vira erro com o conserto escrito. (Autouse continua entregando `None` calado para
        # todo o resto da suite, que e o comportamento correto para quem nao pediu nada.)
        code = getattr(request.function, "__code__", None)
        declarados = code.co_varnames[: code.co_argcount] if code is not None else ()
        if "mp_stub" in declarados:
            pytest.fail(
                f"{module_name} pede a fixture `mp_stub` mas nao esta em _BILLING_TEST_MODULES "
                "(tests/conftest.py) — acrescente-o la, ou o stub do MP nao e instalado."
            )
        yield None
        return

    import sqlalchemy as sa
    from sqlalchemy import text

    from app.billing.providers import mercadopago as mp_provider

    url = request.getfixturevalue("migrated_db")
    engine = sa.create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM entitlement_grants WHERE source = 'payment'"))
        conn.execute(text("DELETE FROM billing_events"))
        conn.execute(text("DELETE FROM subscriptions"))
    engine.dispose()

    import httpx

    from tests.mp_stub.stub import MPStub

    stub = MPStub(db_url=url)
    mp_provider.set_test_transport(httpx.ASGITransport(app=stub.asgi_app))
    try:
        yield stub
    finally:
        mp_provider.set_test_transport(None)
