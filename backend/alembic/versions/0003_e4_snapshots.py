"""e4 snapshots (frozen document + immutability trigger)

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-13

E4 history persistence (ADR-0018 / ADR-0019, data-model D1-D6). Additive only — `0001` and `0002`
are SHIPPED and are never amended.

THREE THINGS HERE DELIBERATELY BREAK THE HOUSE PATTERN, each for a reason that would otherwise
produce a lie rather than a bug:

1. **A JSONB frozen document instead of typed columns per line.** A snapshot is an immutable
   document whose shape must survive a formula change WITHOUT a migration; typed columns would mean
   an `ALTER TABLE` for every future breakdown line, forever, on rows that may never be touched. It
   also buys FR-507 for free: a line that did not exist then is an ABSENT KEY, never a fabricated
   `0.00`. Money leaves inside the payload are decimal STRINGS — Postgres would keep a JSON number
   losslessly, but `json.loads` hands it back as a float, so the precision would die app-side.

2. **NO foreign key to products/kits.** `ON DELETE SET NULL` would *write to an immutable row* — and
   would fire as an UPDATE, hitting the trigger below and making the PRODUCT DELETE FAIL. `RESTRICT`
   would let history hold the catalog hostage; `CASCADE` would delete the proof. Provenance lives
   inside the payload as a captured `{kind, id, name}` and is allowed to dangle harmlessly.

3. **The project's FIRST PL/pgSQL** (owner-approved 2026-07-12; E2 §0 had promised "tables / CHECK /
   RLS only"). A `CHECK` cannot express immutability — it never sees the OLD row. SC-504 claims *0*
   write paths can alter a snapshot, which is a claim about FUTURE code; the trigger is what makes
   that an invariant in the DATABASE rather than a promise about the code we happen to have written.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


IMMUTABILITY_TRIGGER_FN = """
CREATE OR REPLACE FUNCTION snapshots_forbid_content_update() RETURNS trigger AS $$
BEGIN
    -- Only the label, the soft-delete tombstone and updated_at may ever move (FR-504/ADR-0019).
    -- Everything else is the seller's recorded claim and is frozen for good.
    IF (NEW.owner_uid IS DISTINCT FROM OLD.owner_uid)
        OR (NEW.client_snapshot_id IS DISTINCT FROM OLD.client_snapshot_id)
        OR (NEW.kind IS DISTINCT FROM OLD.kind)
        OR (NEW.quote_validity_days IS DISTINCT FROM OLD.quote_validity_days)
        OR (NEW.device_quoted_at IS DISTINCT FROM OLD.device_quoted_at)
        OR (NEW.device_utc_offset_minutes IS DISTINCT FROM OLD.device_utc_offset_minutes)
        OR (NEW.model_version IS DISTINCT FROM OLD.model_version)
        OR (NEW.payload_schema_version IS DISTINCT FROM OLD.payload_schema_version)
        OR (NEW.payload IS DISTINCT FROM OLD.payload)
        OR (NEW.headline_total IS DISTINCT FROM OLD.headline_total)
        OR (NEW.headline_basis IS DISTINCT FROM OLD.headline_basis)
        OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
        OR (NEW.id IS DISTINCT FROM OLD.id)
    THEN
        RAISE EXCEPTION
            'snapshot contents are immutable (FR-504/ADR-0019): only label, deleted_at and updated_at may change'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "snapshots",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_uid", sa.Text(), nullable=False),
        sa.Column("client_snapshot_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("label", sa.Text(), nullable=True),
        sa.Column("quote_validity_days", sa.Integer(), nullable=True),
        sa.Column("device_quoted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("device_utc_offset_minutes", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("payload_schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("headline_total", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("headline_basis", sa.Text(), nullable=False),
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
        sa.CheckConstraint("kind IN ('SINGLE','KIT')", name=op.f("ck_snapshots_kind_enum")),
        sa.CheckConstraint(
            "headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO')",
            name=op.f("ck_snapshots_headline_basis_enum"),
        ),
        sa.CheckConstraint(
            "label IS NULL OR length(btrim(label)) > 0", name=op.f("ck_snapshots_label_not_blank")
        ),
        sa.CheckConstraint(
            "quote_validity_days IS NULL OR (quote_validity_days > 0 AND quote_validity_days <= 3650)",
            name=op.f("ck_snapshots_quote_validity_days_range"),
        ),
        sa.CheckConstraint(
            "device_quoted_at > '-infinity' AND device_quoted_at < 'infinity'",
            name=op.f("ck_snapshots_device_quoted_at_finite"),
        ),
        sa.CheckConstraint(
            "device_utc_offset_minutes BETWEEN -840 AND 840",
            name=op.f("ck_snapshots_device_utc_offset_range"),
        ),
        sa.CheckConstraint(
            "jsonb_typeof(payload) = 'object'", name=op.f("ck_snapshots_payload_is_object")
        ),
        sa.CheckConstraint(
            "payload->>'kind' = kind", name=op.f("ck_snapshots_payload_kind_matches")
        ),
        sa.CheckConstraint(
            "payload->>'modelVersion' = model_version",
            name=op.f("ck_snapshots_payload_version_matches"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_uid"],
            ["accounts.account_uid"],
            name=op.f("fk_snapshots_owner_uid_accounts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_snapshots")),
        # Exactly-once (SC-513). UNCONDITIONAL — the tombstone is INSIDE the key, so a queued retry
        # arriving after the seller deleted the entry cannot resurrect it. (This is why it is NOT a
        # partial index over `deleted_at IS NULL`, which is the E2 idiom for names.)
        sa.UniqueConstraint(
            "owner_uid", "client_snapshot_id", name=op.f("uq_snapshots_client_snapshot_id")
        ),
    )
    op.create_index(op.f("ix_snapshots_owner_uid"), "snapshots", ["owner_uid"], unique=False)
    # Serves the newest-first list AND the date-range filter: with owner_uid pinned by equality,
    # Postgres walks the b-tree BACKWARDS for `ORDER BY device_quoted_at DESC, id DESC` (FR-520/523).
    op.create_index(
        "ix_snapshots_owner_active",
        "snapshots",
        ["owner_uid", "device_quoted_at", "id"],
        unique=False,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )

    op.execute(IMMUTABILITY_TRIGGER_FN)
    op.execute(
        """
        CREATE TRIGGER trg_snapshots_immutable
        BEFORE UPDATE ON snapshots
        FOR EACH ROW EXECUTE FUNCTION snapshots_forbid_content_update();
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TRIGGER IF EXISTS trg_snapshots_immutable ON snapshots;")
    op.execute("DROP FUNCTION IF EXISTS snapshots_forbid_content_update();")
    op.drop_index("ix_snapshots_owner_active", table_name="snapshots")
    op.drop_index(op.f("ix_snapshots_owner_uid"), table_name="snapshots")
    op.drop_table("snapshots")
