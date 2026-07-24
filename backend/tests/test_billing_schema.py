"""E6 billing schema — migration ``0005`` shape, FAILING-first (T004).

Pins the DDL of ``specs/012-e6-billing/data-model.md`` §1-§3 at the DATABASE (the structural
authority; the app-layer writer/route tests live in ``test_billing_security.py`` /
``test_billing_terminus.py``). Runs against a REAL Postgres (testcontainers) migrated to head —
so before migration ``0005`` exists every table-presence assertion FAILS with a visible reason
(``the subscriptions table does not exist yet``), never silently green.

Three new schema facts (data-model §1-§3):

* **``subscriptions``** — the PSP mirror: references ONLY, ``NO money/card column`` (VR-701). Named
  CHECKs on ``provider`` / ``plan_period`` / ``status``; ``mp_preapproval_id`` UNIQUE (nullable, for
  the future Play row); a partial-UNIQUE index enforcing at-most-one active subscription per owner
  (SEC-604).
* **``billing_events``** — the exactly-once inbox: ``event_key`` UNIQUE (the ADR-0018 principle,
  server-side); named CHECK on ``kind``; ``NO money column``.
* **``entitlement_grants``** — the ADDITIVE ADR-0012 extension: the ``source`` CHECK widens to
  include ``payment``; a new nullable ``subscription_id`` FK → ``subscriptions`` (NULL for
  beta/comp). Nothing else on the ledger changes.
"""

from __future__ import annotations

import re

import sqlalchemy as sa

from tests.conftest import requires_db

pytestmark = requires_db


# --- Introspection helpers (raw catalog reads — no ORM, so a missing table is an honest empty) ----


def _table_exists(engine: sa.Engine, table: str) -> bool:
    with engine.connect() as conn:
        return bool(
            conn.execute(
                sa.text("SELECT to_regclass(:t) IS NOT NULL"), {"t": f"public.{table}"}
            ).scalar_one()
        )


def _constraint_defs(engine: sa.Engine, table: str) -> dict[str, str]:
    """{conname: pg_get_constraintdef} for a table — the authoritative SQL text of each CHECK/FK."""
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT con.conname, pg_get_constraintdef(con.oid) AS definition"
                " FROM pg_constraint con"
                " JOIN pg_class rel ON rel.oid = con.conrelid"
                " JOIN pg_namespace n ON n.oid = rel.relnamespace"
                " WHERE n.nspname = 'public' AND rel.relname = :t"
            ),
            {"t": table},
        ).all()
    return {r.conname: r.definition for r in rows}


def _index_defs(engine: sa.Engine, table: str) -> dict[str, str]:
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT indexname, indexdef FROM pg_indexes"
                " WHERE schemaname = 'public' AND tablename = :t"
            ),
            {"t": table},
        ).all()
    return {r.indexname: r.indexdef for r in rows}


def _columns(engine: sa.Engine, table: str) -> dict[str, str]:
    """{column_name: data_type} from information_schema."""
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT column_name, data_type, is_nullable FROM information_schema.columns"
                " WHERE table_name = :t"
            ),
            {"t": table},
        ).all()
    return {r.column_name: r.data_type for r in rows}


def _is_nullable(engine: sa.Engine, table: str, column: str) -> bool:
    with engine.connect() as conn:
        val = conn.execute(
            sa.text(
                "SELECT is_nullable FROM information_schema.columns"
                " WHERE table_name = :t AND column_name = :c"
            ),
            {"t": table, "c": column},
        ).scalar_one()
    return val == "YES"


# A money/card leaf is exactly what this schema must NOT contain (VR-701/SC-706). The column-name
# sweep + the "zero numeric columns" assertion are the two independent guards.
_FORBIDDEN_COLUMN_RE = re.compile(
    r"card|pan|cvv|cvc|ccv|expiry|cardholder|price|amount|total|money|value|cost|brl|cents",
    re.IGNORECASE,
)


# ── subscriptions — the PSP mirror (data-model §1) ═══════════════════════════════════════════════

# The DECIDED column set (data-model §1 table). Literal, so a stray money/card column fails loudly.
_SUBSCRIPTIONS_COLUMNS = {
    "id",
    "owner_uid",
    "provider",
    "mp_preapproval_id",
    "plan_period",
    "status",
    "payer_ref",
    "current_period_end",
    "created_at",
    "updated_at",
    "deleted_at",
}


def test_subscriptions_table_exists(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "subscriptions"), "the subscriptions table does not exist yet"


def test_subscriptions_has_exactly_the_decided_columns(migrated_db: str) -> None:
    """VR-701 (literal): the PSP mirror stores references ONLY — the column set is exactly §1's."""
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "subscriptions"), "the subscriptions table does not exist yet"
    assert set(_columns(engine, "subscriptions")) == _SUBSCRIPTIONS_COLUMNS


def test_subscriptions_has_no_money_or_card_column(migrated_db: str) -> None:
    """VR-701/SC-706: two independent guards — no numeric-typed column, no card/money-shaped name.
    A subscription stores a price NEVER (the E4/E5 no-money-leaf discipline, one level further)."""
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "subscriptions"), "the subscriptions table does not exist yet"
    cols = _columns(engine, "subscriptions")
    numeric = [c for c, t in cols.items() if t == "numeric"]
    assert numeric == [], f"subscriptions must hold NO money column, found numeric: {numeric}"
    forbidden = [c for c in cols if _FORBIDDEN_COLUMN_RE.search(c)]
    assert forbidden == [], f"subscriptions must hold no card/money-shaped column: {forbidden}"


def test_subscriptions_provider_check_pins_the_two_providers(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "subscriptions")
    assert "ck_subscriptions_provider_enum" in defs, defs
    body = defs["ck_subscriptions_provider_enum"]
    assert "mercadopago" in body and "google_play" in body, body


def test_subscriptions_plan_period_check_pins_the_two_plans(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "subscriptions")
    assert "ck_subscriptions_plan_period_enum" in defs, defs
    body = defs["ck_subscriptions_plan_period_enum"]
    assert "monthly" in body and "annual" in body, body


def test_subscriptions_status_check_includes_grace(migrated_db: str) -> None:
    """§1: status IN (pending, authorized, grace, paused, cancelled) — ``grace`` marks FR-708."""
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "subscriptions")
    assert "ck_subscriptions_status_enum" in defs, defs
    body = defs["ck_subscriptions_status_enum"]
    for state in ("pending", "authorized", "grace", "paused", "cancelled"):
        assert state in body, f"status CHECK missing {state!r}: {body}"


def test_subscriptions_mp_preapproval_id_is_unique(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "subscriptions")
    unique_on_preapproval = [
        name
        for name, body in defs.items()
        if body.startswith("UNIQUE") and "mp_preapproval_id" in body
    ]
    assert unique_on_preapproval, f"mp_preapproval_id must be UNIQUE — constraints: {defs}"


def test_subscriptions_mp_preapproval_id_is_nullable(migrated_db: str) -> None:
    """Nullable for the future ``google_play`` row (which carries no MP preapproval id)."""
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "subscriptions"), "the subscriptions table does not exist yet"
    assert _is_nullable(engine, "subscriptions", "mp_preapproval_id")


def test_subscriptions_owner_uid_fk_into_accounts(migrated_db: str) -> None:
    """The ONLY account link (isolation) — FK → accounts, and NOT NULL."""
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "subscriptions")
    fks = [b for b in defs.values() if b.startswith("FOREIGN KEY")]
    assert any("owner_uid" in b and "accounts" in b for b in fks), fks
    assert _table_exists(engine, "subscriptions")
    assert not _is_nullable(engine, "subscriptions", "owner_uid")


def test_subscriptions_one_active_partial_unique_index(migrated_db: str) -> None:
    """SEC-604 double-subscribe guard: a partial-UNIQUE index on ``owner_uid`` restricted to the
    active statuses AND ``deleted_at IS NULL`` — at most one active subscription per account."""
    engine = sa.create_engine(migrated_db)
    idx = _index_defs(engine, "subscriptions")
    partial = {
        name: body
        for name, body in idx.items()
        if "UNIQUE" in body and "WHERE" in body and "owner_uid" in body
    }
    assert partial, f"expected a partial-UNIQUE active-subscription index, indexes: {idx}"
    body = next(iter(partial.values()))
    # The predicate must gate on both the active statuses and the soft-delete flag.
    assert "deleted_at IS NULL" in body, body
    for state in ("pending", "authorized", "grace", "paused"):
        assert state in body, f"active-subscription predicate missing {state!r}: {body}"


# ── billing_events — the exactly-once inbox (data-model §2) ═══════════════════════════════════════

_BILLING_EVENTS_COLUMNS = {
    "id",
    "subscription_id",
    "event_key",
    "kind",
    "mp_status",
    "raw",
    "processed_at",
}


def test_billing_events_table_exists(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "billing_events"), "the billing_events table does not exist yet"


def test_billing_events_has_exactly_the_decided_columns(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "billing_events"), "the billing_events table does not exist yet"
    assert set(_columns(engine, "billing_events")) == _BILLING_EVENTS_COLUMNS


def test_billing_events_has_no_money_or_card_column(migrated_db: str) -> None:
    """VR-701: the inbox stores the looked-up resource in ``raw`` (JSONB audit), no money leaf."""
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "billing_events"), "the billing_events table does not exist yet"
    cols = _columns(engine, "billing_events")
    numeric = [c for c, t in cols.items() if t == "numeric"]
    assert numeric == [], f"billing_events must hold NO money column, found numeric: {numeric}"
    forbidden = [c for c in cols if _FORBIDDEN_COLUMN_RE.search(c)]
    assert forbidden == [], f"billing_events must hold no card/money-shaped column: {forbidden}"


def test_billing_events_event_key_is_unique(migrated_db: str) -> None:
    """SC-703: the exactly-once guarantee is a DATABASE UNIQUE, not app cleverness (ADR-0018)."""
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "billing_events")
    unique_on_key = [
        name for name, body in defs.items() if body.startswith("UNIQUE") and "event_key" in body
    ]
    assert unique_on_key, f"event_key must be UNIQUE — constraints: {defs}"


def test_billing_events_event_key_is_not_null(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "billing_events"), "the billing_events table does not exist yet"
    assert not _is_nullable(engine, "billing_events", "event_key")


def test_billing_events_kind_check_pins_the_five_kinds(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "billing_events")
    assert "ck_billing_events_kind_enum" in defs, defs
    body = defs["ck_billing_events_kind_enum"]
    for kind in ("payment", "payment_failed", "refund", "chargeback", "cancel"):
        assert kind in body, f"kind CHECK missing {kind!r}: {body}"


def test_billing_events_subscription_fk_not_null(migrated_db: str) -> None:
    """Event→account resolution is server-side ONLY (SEC-204): the subscription FK is NOT NULL."""
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "billing_events")
    fks = [b for b in defs.values() if b.startswith("FOREIGN KEY")]
    assert any("subscription_id" in b and "subscriptions" in b for b in fks), fks
    assert _table_exists(engine, "billing_events")
    assert not _is_nullable(engine, "billing_events", "subscription_id")


# ── entitlement_grants — the ADDITIVE ADR-0012 extension (data-model §3) ══════════════════════════


def test_entitlement_grants_source_check_widens_to_payment(migrated_db: str) -> None:
    """§3: the source CHECK widens ('beta','comp') → ('beta','comp','payment'). The verified-event
    writer is the ONLY producer of a payment grant (the operator CLI stays beta|comp — VR-710)."""
    engine = sa.create_engine(migrated_db)
    defs = _constraint_defs(engine, "entitlement_grants")
    assert "ck_entitlement_grants_source_enum" in defs, defs
    body = defs["ck_entitlement_grants_source_enum"]
    for source in ("beta", "comp", "payment"):
        assert source in body, f"source CHECK missing {source!r}: {body}"


def test_entitlement_grants_gains_nullable_subscription_id_fk(migrated_db: str) -> None:
    """§3: a new nullable ``subscription_id`` FK → subscriptions (audit link; NULL for beta/comp).
    The rest of the ledger is byte-identical — evaluation code untouched (ADR-0012 verbatim)."""
    engine = sa.create_engine(migrated_db)
    assert _table_exists(engine, "subscriptions"), "the subscriptions table does not exist yet"
    cols = _columns(engine, "entitlement_grants")
    assert "subscription_id" in cols, f"entitlement_grants must gain subscription_id: {cols}"
    assert _is_nullable(engine, "entitlement_grants", "subscription_id")
    defs = _constraint_defs(engine, "entitlement_grants")
    fks = [b for b in defs.values() if b.startswith("FOREIGN KEY")]
    assert any("subscription_id" in b and "subscriptions" in b for b in fks), fks
