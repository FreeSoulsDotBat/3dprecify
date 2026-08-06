"""016/US10 (ADR-0026) — pricing-core 4.0.0: `wasteGrams` DROPS from the schema.

The dono homologated as a free user and refused the ambiguity between "Desperdício (g)" and "Taxa
de falha (%)" — two fields a seller reads as the same thing. Decision D2, option A — complete
removal, not just from the screen. The engine (`packages/pricing-core` 4.0.0) now REFUSES the
field by key rather than silently ignoring it (ADR-0026 §3.1); this migration is the schema half.

Dropped, with their named CHECKs:

* ``filaments.default_waste_grams`` (+ ``ck_filaments_default_waste_valid``)
* ``products.waste_grams`` (+ ``ck_products_waste_grams_valid``)
* ``bom_lines.waste_grams`` (+ ``ck_bom_lines_waste_grams_valid``)

**``downgrade()`` recreates the SCHEMA, not the VALUES.** The three columns come back with their
original types/nullability/``server_default('0')`` (or nullable, for ``bom_lines``, mirroring
migration 0002) and their CHECKs are restored verbatim — but a column that was dropped had its
DATA dropped with it; Postgres does not remember what used to be there, and neither does this
file. Every row that re-materializes the column reads the DEFAULT, not what a seller once typed.

This is judged an acceptable reversal precisely because of the state of THIS project TODAY: no
environment has ever been provisioned (deploy is deliberately deferred until v1 = E1-E6 complete,
owner decision 2026-07-09, `docs/decisions/deploy-deferred-until-v1.md`) — there is no production
row to destroy, so "the schema is reversible, the values are not" costs nothing right now. If that
deferral is revisited before this migration ships to a real environment, this point reopens and a
data-preserving downgrade (or an explicit "no downgrade past this point") would need to be
reconsidered.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(op.f("ck_filaments_default_waste_valid"), "filaments", type_="check")
    op.drop_column("filaments", "default_waste_grams")

    op.drop_constraint(op.f("ck_products_waste_grams_valid"), "products", type_="check")
    op.drop_column("products", "waste_grams")

    op.drop_constraint(op.f("ck_bom_lines_waste_grams_valid"), "bom_lines", type_="check")
    op.drop_column("bom_lines", "waste_grams")


def downgrade() -> None:
    # Schema reversible, VALUES ARE NOT — see the module docstring. Every row re-materializes the
    # column at its DEFAULT ('0'/NULL), never at whatever a seller once typed.
    op.add_column(
        "bom_lines",
        sa.Column("waste_grams", sa.Numeric(precision=12, scale=3), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_bom_lines_waste_grams_valid"),
        "bom_lines",
        "waste_grams IS NULL OR (waste_grams >= 0 AND waste_grams <> 'NaN'::numeric)",
    )

    op.add_column(
        "products",
        sa.Column(
            "waste_grams",
            sa.Numeric(precision=12, scale=3),
            server_default="0",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_products_waste_grams_valid"),
        "products",
        "waste_grams >= 0 AND waste_grams <> 'NaN'::numeric",
    )

    op.add_column(
        "filaments",
        sa.Column(
            "default_waste_grams",
            sa.Numeric(precision=12, scale=3),
            server_default="0",
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_filaments_default_waste_valid"),
        "filaments",
        "default_waste_grams >= 0 AND default_waste_grams <> 'NaN'::numeric",
    )
