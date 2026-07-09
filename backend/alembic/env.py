"""Alembic environment (E2, ADR-0013). URL from app settings (P3D_DATABASE_URL) — the same
psycopg3 URL serves the async app engine and this (sync) migration path. target_metadata is the
typed models' metadata; compare_type/server_default on so autogenerate stays honest. Replaying
these migrations IS the future Cloud SQL provisioning (v1-launch)."""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context
from app.models import Base
from app.settings import get_settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Settings win unless alembic is invoked with an explicit -x url override.
config.set_main_option("sqlalchemy.url", get_settings().database_url.get_secret_value())

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
