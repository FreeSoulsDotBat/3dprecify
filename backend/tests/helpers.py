"""Shared test helpers (E2): token stub + ledger seeding — one source, no per-file copies."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
import sqlalchemy as sa

from app import auth


def patch_verify(monkeypatch: pytest.MonkeyPatch, uid: str, email: str | None = None) -> None:
    """Deterministic token verification: any bearer resolves to the given uid/email."""

    def ok(_token: str) -> dict[str, Any]:
        claims: dict[str, Any] = {"uid": uid}
        if email:
            claims["email"] = email
        return claims

    monkeypatch.setattr(auth.firebase_auth, "verify_id_token", ok)


def seed_grant(
    db_url: str,
    uid: str,
    *,
    email: str | None = None,
    expires_delta_h: int | None = None,
    revoked: bool = False,
) -> None:
    """Insert account + ledger grant directly (test seam — production writes go via the CLI)."""
    engine = sa.create_engine(db_url)
    now = datetime.now(UTC)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid, email) VALUES (:uid, :email)"
                " ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"uid": uid, "email": email},
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
