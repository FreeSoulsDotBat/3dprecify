"""Operator entitlement CLI (E2 US2, ADR-0012) — grant/revoke/list against the ledger.

NO HTTP route exists for granting: this script writes ``entitlement_grants`` directly, so
"operator-only" holds by absence of a path (a remote admin console is E6). Targets must be
EXISTING accounts — uid or e-mail (resolved via ``accounts.email``, populated at first
sign-in); email-invite/grant-before-sign-in is deferred (data-model §12).

Usage (uv, from ``backend/``)::

    uv run python -m app.scripts.grant_premium grant <uid-or-email> --source beta \
        [--expires 2026-12-31] [--note "beta wave 1"] [--by jonatan]
    uv run python -m app.scripts.grant_premium revoke <uid-or-email> [--by jonatan]
    uv run python -m app.scripts.grant_premium list [<uid-or-email>]
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from datetime import UTC, datetime

import sqlalchemy as sa

from app.models import Account, EntitlementGrant
from app.settings import get_settings


class GrantError(Exception):
    """Operator-facing failure (unknown account, nothing to revoke, bad input)."""


@dataclass(frozen=True)
class GrantRow:
    account_uid: str
    source: str
    granted_by: str
    granted_at: datetime
    expires_at: datetime | None
    revoked_at: datetime | None
    revoked_by: str | None
    note: str | None


def _resolve_account_uid(conn: sa.Connection, target: str) -> str:
    """uid or e-mail of an EXISTING account (email-invite deferred — data-model §12)."""
    by_uid = conn.execute(
        sa.select(Account.account_uid).where(Account.account_uid == target)
    ).scalar()
    if by_uid:
        return by_uid
    if "@" in target:
        by_email = conn.execute(
            sa.select(Account.account_uid).where(Account.email == target)
        ).scalar()
        if by_email:
            return by_email
    raise GrantError(
        f"no existing account matches {target!r} — the user must sign in once first "
        "(email-invite is deferred)"
    )


def grant(
    engine: sa.Engine,
    *,
    target: str,
    source: str,
    granted_by: str,
    expires_at: datetime | None = None,
    note: str | None = None,
) -> GrantRow:
    if source not in ("beta", "comp"):
        raise GrantError("source must be 'beta' or 'comp'")
    with engine.begin() as conn:
        uid = _resolve_account_uid(conn, target)
        now = datetime.now(UTC)
        conn.execute(
            sa.insert(EntitlementGrant).values(
                account_uid=uid,
                source=source,
                granted_by=granted_by,
                granted_at=now,
                expires_at=expires_at,
                note=note,
            )
        )
        return GrantRow(
            account_uid=uid,
            source=source,
            granted_by=granted_by,
            granted_at=now,
            expires_at=expires_at,
            revoked_at=None,
            revoked_by=None,
            note=note,
        )


def revoke(engine: sa.Engine, *, target: str, revoked_by: str) -> GrantRow:
    with engine.begin() as conn:
        uid = _resolve_account_uid(conn, target)
        now = datetime.now(UTC)
        active = conn.execute(
            sa.select(EntitlementGrant.id)
            .where(
                EntitlementGrant.account_uid == uid,
                EntitlementGrant.revoked_at.is_(None),
                sa.or_(
                    EntitlementGrant.expires_at.is_(None),
                    EntitlementGrant.expires_at > now,
                ),
            )
            .order_by(EntitlementGrant.granted_at.desc())
        ).scalars()
        ids = list(active)
        if not ids:
            raise GrantError(f"account {uid!r} has no active grant to revoke")
        conn.execute(
            sa.update(EntitlementGrant)
            .where(EntitlementGrant.id.in_(ids))
            .values(revoked_at=now, revoked_by=revoked_by)
        )
    rows = list_grants(engine, target=uid)
    return rows[0]


def list_grants(engine: sa.Engine, *, target: str | None = None) -> list[GrantRow]:
    with engine.connect() as conn:
        stmt = sa.select(EntitlementGrant).order_by(EntitlementGrant.granted_at.desc())
        if target is not None:
            uid = _resolve_account_uid(conn, target)
            stmt = stmt.where(EntitlementGrant.account_uid == uid)
        result = conn.execute(stmt)
        return [
            GrantRow(
                account_uid=row.account_uid,
                source=row.source,
                granted_by=row.granted_by,
                granted_at=row.granted_at,
                expires_at=row.expires_at,
                revoked_at=row.revoked_at,
                revoked_by=row.revoked_by,
                note=row.note,
            )
            for row in result
        ]


def _parse_expires(value: str | None) -> datetime | None:
    if value is None:
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise GrantError(f"invalid --expires {value!r} (use ISO, e.g. 2026-12-31)") from exc
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="grant-premium", description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    p_grant = sub.add_parser("grant", help="grant premium to an existing account")
    p_grant.add_argument("target", help="uid or e-mail of an EXISTING account")
    p_grant.add_argument("--source", required=True, choices=["beta", "comp"])
    p_grant.add_argument("--expires", default=None, help="ISO datetime/date (optional)")
    p_grant.add_argument("--note", default=None)
    p_grant.add_argument("--by", default="operator", help="grantor identifier")

    p_revoke = sub.add_parser("revoke", help="revoke the active grant(s)")
    p_revoke.add_argument("target", help="uid or e-mail of an EXISTING account")
    p_revoke.add_argument("--by", default="operator")

    p_list = sub.add_parser("list", help="list grants (optionally for one account)")
    p_list.add_argument("target", nargs="?", default=None)

    args = parser.parse_args(argv)
    # Sync engine on the same URL (psycopg3 serves both paths — ADR-0013).
    engine = sa.create_engine(get_settings().database_url.get_secret_value())
    try:
        if args.command == "grant":
            row = grant(
                engine,
                target=args.target,
                source=args.source,
                granted_by=args.by,
                expires_at=_parse_expires(args.expires),
                note=args.note,
            )
            print(f"GRANTED {row.account_uid} source={row.source} expires={row.expires_at}")
        elif args.command == "revoke":
            row = revoke(engine, target=args.target, revoked_by=args.by)
            print(f"REVOKED {row.account_uid} at={row.revoked_at}")
        else:
            for row in list_grants(engine, target=args.target):
                state = "revoked" if row.revoked_at else "active/lapsed-by-expiry"
                print(
                    f"{row.account_uid}  {row.source:5} by={row.granted_by}"
                    f" granted={row.granted_at:%Y-%m-%d} expires={row.expires_at}"
                    f" [{state}] note={row.note or '-'}"
                )
        return 0
    except GrantError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        engine.dispose()


if __name__ == "__main__":
    raise SystemExit(main())
