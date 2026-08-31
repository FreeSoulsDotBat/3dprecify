"""E5 — saved marketplace scenarios (ADR-0021)."""

from __future__ import annotations

import datetime
import uuid

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, SmallInteger, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, uuid7_default


class Scenario(Base):
    """A saved marketplace strategy — the seller's INTENT ("where and for how much to sell, today").

    THE DELIBERATE OPPOSITE OF A SNAPSHOT (E5 data-model governing sentence). A ``Snapshot`` freezes
    resolved values and is immutable; a ``Scenario`` stores *intent* and is **mutable** (rename +
    edit-config are the feature). So four things a snapshot HAS are, here, load-bearing ABSENCES:

    * **No immutability trigger** — the row is edited, renamed, re-saved. The whole PL/pgSQL
      apparatus of ``0003`` is dropped; the validators (VR-602/603) run on every write instead.
    * **No idempotency key / no offline outbox** — writes are online-only (Q4/FR-613); a scenario is
      created like a ``products``/``boms`` row. There is no ``client_scenario_id`` and no unique
      index to import from E4.
    * **No money / Numeric column at all** — a scenario NEVER stores a resolved price (VR-611).
      Every monetary leaf lives inside ``config`` as a decimal STRING and is an INPUT or an explicit
      override, never a computed price; the live price is recomputed client-side on reopen.
    * **No catalog FK** — the cost basis is a SOFT reference ``{kind, ref, lastKnown}`` inside
      ``config`` (N2). ``owner_uid → accounts`` is the ONLY foreign key; a dangling basis ref
      degrades read-time (D6), it does not break referential integrity.

    Hybrid shape (N1): typed columns for exactly what the DB must query/order/constrain (owner,
    name, note, timestamps, soft-delete, the envelope version) + one ``config JSONB`` holding the
    full, polymorphic, multi-piece-capable intent document (§3). The DB cannot ``CHECK`` a money
    leaf inside ``config``; the ONE binding it CAN enforce — that the JSONB envelope version matches
    its column — is pinned here (``config_schema_matches``), defence against a mismatched envelope.

    ``deleted_at`` is VOLUNTARY soft-delete only; a premium lapse freezes writes but never deletes a
    scenario (FR-612, the Q3 freeze) — so, unlike E4's unconditional key, the active-list index IS
    partial on ``deleted_at IS NULL`` (the E2/E3 idiom; no idempotency-tombstone role to preserve).
    """

    __tablename__ = "scenarios"
    __table_args__ = (
        CheckConstraint("length(btrim(name)) > 0 AND length(name) <= 120", name="name_not_blank"),
        CheckConstraint(
            # 500 = _NOTE_MAX_CHARS (api/scenarios.py) — the DB CHECK keeps its own literal on
            # purpose (a model never imports from an api router); kept in sync by convention.
            "note IS NULL OR (length(btrim(note)) > 0 AND length(note) <= 500)",
            name="note_valid",
        ),
        CheckConstraint("jsonb_typeof(config) = 'object'", name="config_is_object"),
        CheckConstraint("config_schema_version >= 1", name="config_schema_valid"),
        # The envelope↔column binding (VR-613). A plain CHECK evaluates on every INSERT *and* UPDATE
        # — no trigger needed, and it holds for the mutable row too.
        CheckConstraint(
            "(config->>'schemaVersion')::int = config_schema_version", name="config_schema_matches"
        ),
        # Active listing = owner + not-deleted, newest-first. `created_at` is IMMUTABLE, so the
        # keyset cursor (owner_uid eq, then created_at DESC, id DESC via a backward b-tree scan) is
        # stable — the E4 lesson (never key a cursor on a field that moves under a mid-page edit).
        Index(
            "ix_scenarios_owner_active",
            "owner_uid",
            "created_at",
            "id",
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid7_default
    )
    owner_uid: Mapped[str] = mapped_column(
        Text, ForeignKey("accounts.account_uid"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
    #: The full intent document (§3) — read whole, written whole; money leaves are decimal strings.
    config: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    #: OUR envelope version — how to read the JSONB shape. Deliberately NOT a pricing model version
    #: (a scenario makes no frozen claim; it always recomputes with the current engine).
    config_schema_version: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="1"
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    #: Voluntary soft-delete by the owner; a lapse never sets it (FR-612).
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
