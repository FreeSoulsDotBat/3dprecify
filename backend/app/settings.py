"""Application settings (pydantic-settings). Secrets via SecretStr; never hard-coded.

CORS allowlist is per-env (A7) — never ``*``. Local dev verifies tokens against the Auth emulator
(A6). Region is southamerica-east1 (A10).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="P3D_", env_file=".env", extra="ignore")

    app_env: Literal["dev", "uat", "prod"] = "dev"
    region: str = "southamerica-east1"
    service_name: str = "precifica3d-backend"
    release: str | None = None  # git SHA, used as the Sentry release tag

    # CORS allowlist (A7). Defaults cover local Vite dev (5173) + preview (4173).
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Firebase. In dev, point at the Auth emulator (A6); in prod, ADC + project id.
    firebase_project_id: str | None = None
    firebase_auth_emulator_host: str | None = None  # e.g. "localhost:9099"

    # Database (E2 / ADR-0013). Default targets the compose-local Postgres (docker-compose.yml);
    # dev/CI only — Cloud SQL lands at v1-launch by replaying the same Alembic migrations. psycopg3
    # driver for BOTH async app engine and sync Alembic. The engine is created LAZILY (FR-313: free
    # calculator surfaces keep responding with the DB unreachable).
    database_url: SecretStr = SecretStr(
        "postgresql+psycopg://precifica3d@localhost:5433/precifica3d"
    )

    # Observability.
    sentry_dsn: SecretStr | None = None

    # E6 billing — Mercado Pago (ADR-0023 §1/§5, seguranca §4). Per-environment, SecretStr, and
    # DEFAULT ABSENT: no secret is ever hard-coded, and "unset" must read as absent (None), never as
    # a usable value. Fail-closed is enforced at the route (T010) — a missing webhook secret rejects
    # EVERY event (SEC-403); here the config layer only exposes the absence honestly. The sandbox
    # secret/token bind the running app_env; a sandbox event can never write a prod grant (SEC-402).
    mp_access_token: SecretStr | None = None
    mp_webhook_secret: SecretStr | None = None
    mp_plan_id_monthly: SecretStr | None = None
    mp_plan_id_annual: SecretStr | None = None
    # Overridable ONLY for the e2e stack (uvicorn-served tests/mp_stub — the owner's build-first
    # phase); every deployed environment keeps this production default.
    mp_base_url: str = "https://api.mercadopago.com"

    @model_validator(mode="after")
    def _prod_never_points_at_a_stub(self) -> Settings:
        """T017 finding L1 (the SEC-402 spirit, third guard): the MP lookup is the ONLY source of
        grant truth — under `app_env=prod` a non-production base URL would redirect that truth to
        an arbitrary host, so prod refuses to boot with one."""
        if self.app_env == "prod" and self.mp_base_url != "https://api.mercadopago.com":
            msg = "P3D_MP_BASE_URL must be the production Mercado Pago API when app_env=prod"
            raise ValueError(msg)
        return self

    # E6 Play Billing (ADR-0023 §6, owner Q2 / SEC-701/702). BUILT + sandbox-validated behind an OFF
    # flag in E6; turns ON at E7. Server-side config (never a client flag — Constitution IV). The
    # default AND any unset/unknown value is OFF — no configuration reads ON.
    play_billing_enabled: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
