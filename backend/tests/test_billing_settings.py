"""E6 billing settings + env plumbing (T006, ADR-0023 §1/§5/§6, seguranca §4).

The MP secrets follow the house pattern verbatim (``env_prefix="P3D_"``, ``SecretStr``, never a
default, never logged) and the Play flag is server-side config that defaults OFF and fails closed.

Scope (honest): the route-level refusal on a missing secret (SEC-403) and the flag-gated Play 404
(SEC-701) land with the routes (T010/T036). Here we assert only what the **config layer** owns:

* the four MP fields are ``SecretStr`` under ``P3D_`` — so they never render in a log/error/OpenAPI;
* absent secrets read as ``None`` (the absence is EXPOSED, never silently defaulted to a usable
  value the webhook could treat as "verified") — the fail-closed precondition SEC-403 builds on;
* ``play_billing_enabled`` defaults ``False`` and is a real ``bool`` — VR-709/SEC-702's "unset ⇒
  OFF, no configuration reads ON" at the config layer.

These do NOT need a database (settings are constructed in-process); they run everywhere.
"""

from __future__ import annotations

from pydantic import SecretStr

from app.settings import Settings

# The exact env keys the deploy/runbook must set (the P3D_ prefix + field name). Pinned so a rename
# is a conscious, reviewed change — not a silent break of the ops contract.
_MP_SECRET_FIELDS = (
    "mp_access_token",
    "mp_webhook_secret",
    "mp_plan_id_monthly",
    "mp_plan_id_annual",
)


def _fresh(**over: object) -> Settings:
    """A Settings built from explicit kwargs only — the process env / .env cannot leak a real
    secret into the assertion (``_env_file=None`` disables .env; kwargs override the default)."""
    return Settings(_env_file=None, **over)  # type: ignore[call-arg]


def test_play_billing_flag_defaults_off() -> None:
    """VR-709 half / SEC-702: the flag's DEFAULT is OFF, and is a real bool (not a truthy str)."""
    settings = _fresh()
    assert settings.play_billing_enabled is False


def test_play_billing_flag_is_a_bool_type() -> None:
    settings = _fresh()
    assert isinstance(settings.play_billing_enabled, bool)


def test_mp_secrets_absent_read_as_none() -> None:
    """Fail-closed precondition (SEC-403): with nothing configured, each MP secret is ``None`` — the
    absence is exposed. A route that later treats ``None`` as "skip verification" is the hole
    SEC-403 forbids; the config layer's job is to make "unset" unambiguous, and it does."""
    settings = _fresh()
    for field in _MP_SECRET_FIELDS:
        assert getattr(settings, field) is None, (
            f"{field} must default to None (absent), fail-closed"
        )


def test_mp_secrets_are_secretstr_when_set() -> None:
    """SEC-401: the MP secrets are ``SecretStr`` — so they never surface in a structlog line, an
    error body, Sentry, or the OpenAPI contract. ``repr`` must not leak the value."""
    settings = _fresh(
        mp_access_token="tok-abc",  # noqa: S106
        mp_webhook_secret="whsec-xyz",  # noqa: S106
        mp_plan_id_monthly="plan-m",
        mp_plan_id_annual="plan-a",
    )
    for field in _MP_SECRET_FIELDS:
        value = getattr(settings, field)
        assert isinstance(value, SecretStr), f"{field} must be SecretStr"
        assert "**" in repr(value), f"{field} repr must be masked, got {value!r}"
    # The secret is retrievable only via the explicit accessor (never accidentally stringified).
    assert settings.mp_webhook_secret is not None
    assert settings.mp_webhook_secret.get_secret_value() == "whsec-xyz"


def test_mp_secrets_load_from_the_p3d_prefixed_env(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """The ops contract: the env keys are ``P3D_MP_ACCESS_TOKEN`` / ``P3D_MP_WEBHOOK_SECRET`` /
    ``P3D_MP_PLAN_ID_MONTHLY`` / ``P3D_MP_PLAN_ID_ANNUAL`` (env_prefix P3D_ + field name)."""
    monkeypatch.setenv("P3D_MP_ACCESS_TOKEN", "env-tok")
    monkeypatch.setenv("P3D_MP_WEBHOOK_SECRET", "env-whsec")
    monkeypatch.setenv("P3D_MP_PLAN_ID_MONTHLY", "env-plan-m")
    monkeypatch.setenv("P3D_MP_PLAN_ID_ANNUAL", "env-plan-a")
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    assert settings.mp_access_token is not None
    assert settings.mp_access_token.get_secret_value() == "env-tok"
    assert settings.mp_webhook_secret is not None
    assert settings.mp_webhook_secret.get_secret_value() == "env-whsec"
    assert settings.mp_plan_id_monthly is not None
    assert settings.mp_plan_id_monthly.get_secret_value() == "env-plan-m"
    assert settings.mp_plan_id_annual is not None
    assert settings.mp_plan_id_annual.get_secret_value() == "env-plan-a"


def test_play_billing_flag_loads_from_env(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """SEC-702: it CAN be turned on in a test env (E7 turn-on), but never by default."""
    monkeypatch.setenv("P3D_PLAY_BILLING_ENABLED", "true")
    assert Settings(_env_file=None).play_billing_enabled is True  # type: ignore[call-arg]
    monkeypatch.setenv("P3D_PLAY_BILLING_ENABLED", "false")
    assert Settings(_env_file=None).play_billing_enabled is False  # type: ignore[call-arg]


def test_L1_prod_refuses_a_non_production_mp_base_url() -> None:
    """T017 finding L1: under app_env=prod the MP base URL (the grant-truth source) must be the
    real API — a stub-pointing override refuses to boot; dev keeps the e2e override working."""
    import pytest
    from pydantic import ValidationError

    from app.settings import Settings

    with pytest.raises(ValidationError, match="must be the production Mercado Pago API"):
        Settings(app_env="prod", mp_base_url="http://localhost:8200")

    assert Settings(app_env="prod").mp_base_url == "https://api.mercadopago.com"
    assert Settings(app_env="dev", mp_base_url="http://localhost:8200").mp_base_url.endswith(
        ":8200"
    )
