"""Application settings (pydantic-settings). Secrets via SecretStr; never hard-coded.

CORS allowlist is per-env (A7) — never ``*``. Local dev verifies tokens against the Auth emulator
(A6). Region is southamerica-east1 (A10).
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="P3D_", env_file=".env", extra="ignore")

    app_env: Literal["dev", "prod"] = "dev"
    region: str = "southamerica-east1"
    service_name: str = "precifica3d-backend"
    release: str | None = None  # git SHA, used as the Sentry release tag

    # CORS allowlist (A7). Defaults cover local Vite dev (5173) + preview (4173).
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:4173"]

    # Firebase. In dev, point at the Auth emulator (A6); in prod, ADC + project id.
    firebase_project_id: str | None = None
    firebase_auth_emulator_host: str | None = None  # e.g. "localhost:9099"

    # Observability.
    sentry_dsn: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
