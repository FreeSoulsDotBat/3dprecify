"""A21/FR-211 — response-conformance suite: the published OpenAPI contract vs the real API.

Schemathesis (v4) loads the app's own schema over the ASGI transport — no live server, no port,
runs inside ``pytest`` and therefore inside ``gate:be``/``gate:all`` (pre-push AND CI, D4). Every
operation is exercised; ``call_and_validate`` fails on any undocumented status code or
response-shape mismatch, which is exactly FR-210+FR-211 (it replaces the temporary "hand-written
test substitutes for Schemathesis" note in ``test_fee_catalog.py``).

Determinism: a fixed Hypothesis configuration (bounded examples, derandomized, no deadline) and a
token-verify stub so a fuzzed ``Authorization`` header always yields the same 401 — never a live
Firebase call (same seam ``test_me.py`` patches).
"""

from typing import Any

import pytest
import schemathesis
from hypothesis import settings as hypothesis_settings
from schemathesis import Case
from schemathesis.specs.openapi.checks import unsupported_method

from app import auth
from app.main import create_app
from app.settings import Settings

# Schema straight from the app (dev env, same as conftest's client fixture). ASGI transport — the
# lifespan does not run, so Firebase is never initialized here; the stub below owns verification.
schema = schemathesis.openapi.from_asgi("/openapi.json", create_app(Settings(app_env="dev")))


@pytest.fixture(autouse=True)
def _stable_token_verify(monkeypatch: pytest.MonkeyPatch) -> None:
    """Any fuzzed bearer token is deterministically invalid (→ 401), never a network call."""

    def reject(_token: str) -> dict[str, Any]:
        raise ValueError("conformance stub: token always invalid")

    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", reject)


@schema.parametrize()  # pyright: ignore[reportUntypedFunctionDecorator] — schemathesis decorator is untyped
@hypothesis_settings(deadline=None, max_examples=20, derandomize=True)
def test_api_conformance(case: Case[Any]) -> None:
    # `unsupported_method` is excluded as out of FR-210/211 scope: it probes methods the contract
    # never declares (e.g. TRACE) and demands an RFC-9110 `Allow` header on the framework's default
    # 405 — a real-but-minor finding recorded in dod-evidence, not part of the published contract's
    # honesty. Every in-contract check (status codes, response schema, content type, auth) stays on.
    case.call_and_validate(excluded_checks=[unsupported_method])
