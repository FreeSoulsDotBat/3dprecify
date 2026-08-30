"""Database layer (E2, ADR-0013): async SQLAlchemy engine + session factory.

The engine is created LAZILY on first use (FR-313: the app must boot and serve the free
surfaces — /health, fee catalog, auth — with the database unreachable; only entitlement/
catalog routes touch it, and they fail honestly). psycopg3 async driver; URL from settings
(``P3D_DATABASE_URL``). Import direction (import-linter): api → entitlement → db; this
module imports only settings and SQLAlchemy.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.settings import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """The process-wide async engine, created on first call (lazy — FR-313)."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            get_settings().database_url.get_secret_value(),
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(get_engine(), expire_on_commit=False)
    return _session_factory


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: one session per request, closed afterwards."""
    async with get_session_factory()() as session:
        yield session


def reset_engine_for_tests() -> None:
    """Test seam: drop the cached engine/factory (e.g. after repointing the URL)."""
    global _engine, _session_factory
    _engine = None
    _session_factory = None
