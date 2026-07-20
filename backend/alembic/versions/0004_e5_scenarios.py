"""e5 scenarios (mutable intent document — the deliberate opposite of an E4 snapshot)

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-19

E5 saved marketplace scenarios (ADR-0021, data-model §2/§4/§5/§6). Additive only — `0001`, `0002`
and `0003` are SHIPPED and are never amended (ADR-0013 R4; the chain head is 0003). Nothing in
`filaments`, `printers`, `products`, `boms`, `bom_lines`, `accounts`, `entitlement_grants` or
`snapshots` is touched — E5 ADDS a shelf, it does not alter the existing four (FR-620).

This migration is LIGHTER than 0003 on purpose, and each thing it does NOT do is a documented
non-mistake (data-model §4/§6):

* **No PL/pgSQL trigger.** A scenario is MUTABLE (rename + edit-config are the feature), so there is
  nothing to make immutable. The `0003` immutability apparatus is dropped entirely.
* **No `<> 'NaN'::numeric` column CHECK.** There is NO money column to guard — a scenario stores
  intent, never a resolved price (VR-611). The NaN/float hole is closed INSIDE `config` by the
  app-layer validator (VR-602: `Decimal.is_finite()`), because a DB CHECK cannot reach into JSONB.
* **No unique idempotency index.** Online-only writes, no outbox — a scenario is created like a
  `products` row.
* **No catalog FK.** The cost-basis reference is a SOFT reference in `config` (N2); `owner_uid →
  accounts` is the ONLY foreign key. A dangling ref degrades read-time (D6), it breaks nothing.

The ONE binding the DB can enforce across the JSONB↔column seam — that the envelope version matches
its column — is a plain CHECK (`ck_scenarios_config_schema_matches`), which evaluates on every
INSERT *and* UPDATE (no trigger needed for a per-write expression). No extension is required
(`uuid7` is app-minted; no `pg_trgm`, no `unaccent`, no `uuid-ossp`) — Cloud-SQL-portable.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: str | Sequence[str] | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "scenarios",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_uid", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("config_schema_version", sa.SmallInteger(), server_default="1", nullable=False),
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
        # §4 named CHECKs. The ORM __table_args__ mirrors these exactly.
        sa.CheckConstraint(
            "length(btrim(name)) > 0 AND length(name) <= 120",
            name=op.f("ck_scenarios_name_not_blank"),
        ),
        sa.CheckConstraint(
            "note IS NULL OR (length(btrim(note)) > 0 AND length(note) <= 500)",
            name=op.f("ck_scenarios_note_valid"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(config) = 'object'", name=op.f("ck_scenarios_config_is_object")
        ),
        sa.CheckConstraint(
            "config_schema_version >= 1", name=op.f("ck_scenarios_config_schema_valid")
        ),
        # Envelope↔column binding (VR-613) — holds on every INSERT and UPDATE.
        sa.CheckConstraint(
            "(config->>'schemaVersion')::int = config_schema_version",
            name=op.f("ck_scenarios_config_schema_matches"),
        ),
        # The ONLY foreign key on this table (N2): the tenant key. No catalog FK.
        sa.ForeignKeyConstraint(
            ["owner_uid"],
            ["accounts.account_uid"],
            name=op.f("fk_scenarios_owner_uid_accounts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_scenarios")),
    )
    op.create_index(op.f("ix_scenarios_owner_uid"), "scenarios", ["owner_uid"], unique=False)
    # Active listing + the keyset cursor: owner pinned by equality, then a BACKWARD b-tree walk for
    # `ORDER BY created_at DESC, id DESC` over the not-deleted rows (§5). Partial on
    # `deleted_at IS NULL` — the E2/E3 idiom (no idempotency-tombstone role, unlike the E4 key).
    op.create_index(
        "ix_scenarios_owner_active",
        "scenarios",
        ["owner_uid", "created_at", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    """Downgrade schema — the exact reverse (drop the two indices, then the table). No data
    migration in either direction: the table is new, nothing pre-exists."""
    op.drop_index("ix_scenarios_owner_active", table_name="scenarios")
    op.drop_index(op.f("ix_scenarios_owner_uid"), table_name="scenarios")
    op.drop_table("scenarios")
