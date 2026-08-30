"""US1 — protected GET /api/v1/me proves the server-side boundary (Constitution Principle IV).

Token verification is mocked (no real Firebase / emulator needed for the unit layer).
"""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import auth


def _patch_verify(monkeypatch: pytest.MonkeyPatch, fn: Callable[[str], Any]) -> None:
    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", fn)


def test_me_without_token_is_401(client: TestClient) -> None:
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_me_with_invalid_token_is_401(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(_token: str) -> dict[str, Any]:
        raise ValueError("invalid token")

    _patch_verify(monkeypatch, boom)
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer bad"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHENTICATED"


def test_me_with_valid_token_returns_uid_and_email(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _patch_verify(monkeypatch, lambda _token: {"uid": "u1", "email": "a@b.com"})
    response = client.get("/api/v1/me", headers={"Authorization": "Bearer good"})
    assert response.status_code == 200
    assert response.json() == {"uid": "u1", "email": "a@b.com"}
