"""e6 billing (the PSP mirror + the exactly-once inbox + the additive payment-grant extension)

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-21

E6 billing schema (ADR-0023 §2, data-model §1-§3). Additive only — `0001`..`0004` are SHIPPED and
are never amended (ADR-0013 R4; the chain head was 0004). E6 adds TWO tables and extends ONE
column-set on the ledger; it changes NO evaluation code and mutates NO existing row.

Three schema facts, each a deliberate shape:

* **`subscriptions`** — the PSP mirror. References ONLY: `mp_preapproval_id`, `status`,
  `plan_period`, `current_period_end`, `payer_ref`, `provider`. **NO money/card column exists or
  ever will** (VR-701/SC-706) — a subscription stores a reference, never a price (the E4/E5
  no-money-leaf discipline, one level up). CHECK-guarded enums (`provider`/`plan_period`/`status`,
  `status` including `grace` for FR-708); `mp_preapproval_id` UNIQUE but nullable (the future Play
  row carries none); a **partial-UNIQUE** index enforcing at-most-one active subscription per owner
  (SEC-604 — the double-subscribe guard, at the DATABASE).

* **`billing_events`** — the exactly-once inbox (the ADR-0018 principle, server-side mechanism). The
  `event_key` UNIQUE is what makes exactly-once a DATABASE guarantee, not app cleverness: the same
  MP `authorized_payment.id` delivered by webhook AND reconciliation converges to ONE row
  (`ON CONFLICT DO NOTHING`). `raw` JSONB holds the LOOKED-UP resource (audit) — never a money leaf.

* **`entitlement_grants`** — the ADDITIVE ADR-0012 extension. The `source` CHECK widens
  `('beta','comp')` → `('beta','comp','payment')`; a new **nullable** `subscription_id` FK →
  `subscriptions` traces a payment grant to its subscription (NULL for beta/comp). Nothing else on
  the ledger changes — `read_entitlement_state`/`require_entitlement` are byte-identical; a payment
  grant is just another row (ADR-0023 §Context). The operator CLI stays `beta|comp` (VR-710).

No extension is required (`uuid7` is app-minted; no `pg_trgm`/`unaccent`/`uuid-ossp`) —
Cloud-SQL-portable. The downgrade is the exact reverse (drop the additions, restore the ledger's
original two-value source CHECK), so upgrade→downgrade→upgrade is byte-stable.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: str | Sequence[str] | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema — create the two tables, then extend the ledger additively."""
    # ── subscriptions — the PSP mirror (data-model §1). References only, NO money column. ────────
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_uid", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("mp_preapproval_id", sa.Text(), nullable=True),
        sa.Column("plan_period", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("payer_ref", sa.Text(), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "provider IN ('mercadopago','google_play')",
            name=op.f("ck_subscriptions_provider_enum"),
        ),
        sa.CheckConstraint(
            "plan_period IN ('monthly','annual')",
            name=op.f("ck_subscriptions_plan_period_enum"),
        ),
        sa.CheckConstraint(
            "status IN ('pending','authorized','grace','paused','cancelled')",
            name=op.f("ck_subscriptions_status_enum"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_uid"],
            ["accounts.account_uid"],
            name=op.f("fk_subscriptions_owner_uid_accounts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_subscriptions")),
        sa.UniqueConstraint("mp_preapproval_id", name=op.f("uq_subscriptions_mp_preapproval_id")),
    )
    op.create_index(
        op.f("ix_subscriptions_owner_uid"), "subscriptions", ["owner_uid"], unique=False
    )
    # SEC-604 — at most one active subscription per account. A partial-UNIQUE on owner_uid gated to
    # the non-terminal statuses AND not-deleted rows: a second concurrent checkout cannot create a
    # second active subscription (the double-subscribe guard lives in the DB, not the app).
    op.create_index(
        "uq_subscriptions_one_active",
        "subscriptions",
        ["owner_uid"],
        unique=True,
        postgresql_where=sa.text(
            "status IN ('pending','authorized','grace','paused') AND deleted_at IS NULL"
        ),
    )

    # ── billing_events — the exactly-once inbox (data-model §2). event_key UNIQUE = exactly-once. ─
    op.create_table(
        "billing_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("subscription_id", sa.UUID(), nullable=False),
        sa.Column("event_key", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("mp_status", sa.Text(), nullable=False),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "kind IN ('payment','payment_failed','refund','chargeback','cancel')",
            name=op.f("ck_billing_events_kind_enum"),
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"],
            ["subscriptions.id"],
            name=op.f("fk_billing_events_subscription_id_subscriptions"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_billing_events")),
        sa.UniqueConstraint("event_key", name=op.f("uq_billing_events_event_key")),
    )
    op.create_index(
        op.f("ix_billing_events_subscription_id"),
        "billing_events",
        ["subscription_id"],
        unique=False,
    )

    # ── entitlement_grants — the ADDITIVE ADR-0012 extension (data-model §3). ────────────────────
    # (a) widen the source CHECK to include 'payment' — recreate under the SAME name so the ORM
    #     __table_args__ mirrors it exactly (drift-guard stability).
    op.drop_constraint(
        op.f("ck_entitlement_grants_source_enum"), "entitlement_grants", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_entitlement_grants_source_enum"),
        "entitlement_grants",
        "source IN ('beta','comp','payment')",
    )
    # (b) add the nullable subscription_id FK (audit linkage; NULL for beta/comp).
    op.add_column(
        "entitlement_grants",
        sa.Column("subscription_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        op.f("fk_entitlement_grants_subscription_id_subscriptions"),
        "entitlement_grants",
        "subscriptions",
        ["subscription_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema — the exact reverse. Restore the ledger's original two-value source CHECK,
    drop the additive column+FK, then drop the two new tables (inbox before its subscriptions FK)."""
    op.drop_constraint(
        op.f("fk_entitlement_grants_subscription_id_subscriptions"),
        "entitlement_grants",
        type_="foreignkey",
    )
    op.drop_column("entitlement_grants", "subscription_id")
    op.drop_constraint(
        op.f("ck_entitlement_grants_source_enum"), "entitlement_grants", type_="check"
    )
    op.create_check_constraint(
        op.f("ck_entitlement_grants_source_enum"),
        "entitlement_grants",
        "source IN ('beta','comp')",
    )

    op.drop_index(op.f("ix_billing_events_subscription_id"), table_name="billing_events")
    op.drop_table("billing_events")

    op.drop_index("uq_subscriptions_one_active", table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_owner_uid"), table_name="subscriptions")
    op.drop_table("subscriptions")
