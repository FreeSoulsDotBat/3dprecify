import asyncio
import sys
from collections.abc import Iterator
from functools import lru_cache

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings

# psycopg async cannot run on Windows' default ProactorEventLoop — tests (and any Windows dev
# server touching DB routes) need the selector loop. Linux (CI/Cloud Run) is unaffected.
if sys.platform == "win32":  # pragma: no cover - platform-specific
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())


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
