"""E4 — the immutable price snapshot (ADR-0019), and its ORM-level immutability guard.

The snapshot table and the rule that protects it are kept DELIBERATELY neighbors in this
module (they were ~180 lines apart in the old single-file layout).
"""

from __future__ import annotations

import datetime
import decimal
import uuid

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    event,
    func,
    inspect,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import MONEY_SETTLED, Base, uuid7_default


class Snapshot(Base):
    """A recorded price event — the seller's assertion "this is what I quoted" (E4, US1).

    THE TWO-SHELF RULE (spec §The two-shelf rule). A Product/Kit is a live template: it recomputes,
    and it degrades honestly when a reference dies (ADR-0017 §6). A Snapshot is the opposite BY
    NATURE: it **contains** its values instead of referencing them, so catalog churn changes 0% of
    it — no degraded state, no caption, no warning, because it depends on nothing.

    Three things about this table deliberately BREAK the E2/E3 house pattern, each for a reason that
    would otherwise produce a lie (data-model D1/D2/D3, ADR-0019):

    * **A JSONB frozen document, not typed columns per line.** A recorded line is a document whose
      shape must survive a formula change WITHOUT a migration — otherwise every future breakdown
      line means an `ALTER TABLE` forever, on rows that may never be touched. It also gives FR-507
      for free: a line that did not exist then is an ABSENT KEY, not a fabricated `0.00`.
      Money leaves inside the payload are decimal STRINGS (`json.loads` would hand back floats).

    * **NO foreign key to the origin.** `ON DELETE SET NULL` would *write to an immutable row* (and
      would fail against the trigger below, breaking the product delete); `RESTRICT` would let
      history hold the catalog hostage; `CASCADE` would delete the proof. Provenance is a captured
      `{kind, id, name}` inside the payload — informational, allowed to dangle harmlessly.

    * **`device_quoted_at`, and the `device_` prefix is load-bearing.** The date IS the seller's
      claim, and it is stamped by the DEVICE (FR-528, owner-accepted): the server stores a timestamp
      it CANNOT verify. The prefix warns every future reader, in the column name itself.
      `created_at`
      exists as row metadata only — never displayed, never exported, never used to order or to
      validate the device date.
    """

    __tablename__ = "snapshots"
    __table_args__ = (
        # Exactly-once (SC-513): UNCONDITIONAL — tombstones included, so a queued retry arriving
        # after a delete cannot RESURRECT the snapshot.
        UniqueConstraint("owner_uid", "client_snapshot_id", name="uq_snapshots_client_snapshot_id"),
        # 019/PR-E (ADR-0034 §2, migração 0009): `QUOTE`/`PRECO_ORCAMENTO` — o orçamento enviado
        # congela AQUI, na mesma tabela, sob o mesmo gatilho. Nenhum segundo mecanismo (FR-1917).
        CheckConstraint("kind IN ('SINGLE','KIT','QUOTE')", name="kind_enum"),
        CheckConstraint(
            "headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO','PRECO_ORCAMENTO')",
            name="headline_basis_enum",
        ),
        CheckConstraint("label IS NULL OR length(btrim(label)) > 0", name="label_not_blank"),
        CheckConstraint(
            "quote_validity_days IS NULL OR"
            " (quote_validity_days > 0 AND quote_validity_days <= 3650)",
            name="quote_validity_days_range",
        ),
        # A device clock may be wrong (accepted) — but it may not be 'infinity' (the temporal twin
        # of the NaN hole). This is a well-formedness guard, NOT a sanity check on the seller's
        # clock: "fixing" a skewed clock is precisely what FR-528 forbids.
        CheckConstraint(
            "device_quoted_at > '-infinity' AND device_quoted_at < 'infinity'",
            name="device_quoted_at_finite",
        ),
        CheckConstraint(
            "device_utc_offset_minutes BETWEEN -840 AND 840", name="device_utc_offset_range"
        ),
        CheckConstraint("jsonb_typeof(payload) = 'object'", name="payload_is_object"),
        # The denormalised columns may never drift from the document. Safe here precisely BECAUSE
        # the row is immutable — in E2/E3 this would invite drift; here nothing can update them.
        CheckConstraint("payload->>'kind' = kind", name="payload_kind_matches"),
        CheckConstraint("payload->>'modelVersion' = model_version", name="payload_version_matches"),
        # The ADR-0008 money guard — `headline_total` is the ONE money column here and was the only
        # money column in the schema lacking it. `<> 'NaN'` because numeric CAN hold NaN and treats
        # `NaN = NaN` as TRUE (the numeric twin of the 'infinity' guard on device_quoted_at).
        CheckConstraint(
            "headline_total >= 0 AND headline_total <> 'NaN'::numeric", name="headline_total_valid"
        ),
        # The two MONEY-bound facts the DB did NOT guard until now: the denormalised total must
        # equal the document's basis total (DB backstop for VR-503, app-layer primary), and the
        # version column must equal the document's own `schemaVersion`. Immutability freezes both.
        CheckConstraint(
            "headline_total = ("
            "(payload->'totals') ->> ("
            "CASE headline_basis"
            " WHEN 'PRECO_VAREJO' THEN 'precoVarejo'"
            " WHEN 'PRECO_ATACADO' THEN 'precoAtacado'"
            # O ramo do orçamento entrou junto com o enum, e tinha de entrar: um `headline_basis`
            # sem ramo cai no `ELSE` implícito, o `CASE` devolve NULL, e um `CHECK` que avalia NULL
            # PASSA — o guarda se desligaria em silêncio (ADR-0034 §2, migração 0009).
            " WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'"
            " END))::numeric",
            name="headline_matches_totals",
        ),
        CheckConstraint(
            "(payload->>'schemaVersion')::int = payload_schema_version",
            name="payload_schema_matches",
        ),
        CheckConstraint("payload_schema_version >= 1", name="payload_schema_valid"),
        CheckConstraint("length(btrim(model_version)) > 0", name="model_version_set"),
        Index(
            "ix_snapshots_owner_active",
            "owner_uid",
            "device_quoted_at",
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
    #: Minted on the DEVICE at RECORD time (never at send time — minting at send regenerates after
    #: an app restart and duplicates). The idempotency key (ADR-0018 §3).
    client_snapshot_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    #: The ONLY mutable field on this row.
    label: Mapped[str | None] = mapped_column(Text)
    quote_validity_days: Mapped[int | None] = mapped_column(Integer)
    device_quoted_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    #: So the date the seller SAW renders forever (23:30 BRT must not become "the next day"
    #: elsewhere — that would corrupt the claim itself).
    device_utc_offset_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    model_version: Mapped[str] = mapped_column(Text, nullable=False)
    #: The ENVELOPE's version — deliberately NOT the formula's. Conflating them is how old
    #: snapshots start lying.
    payload_schema_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    #: Denormalised for the list (money as Decimal, never float).
    headline_total: Mapped[decimal.Decimal] = mapped_column(MONEY_SETTLED, nullable=False)
    #: WHICH number the seller says they quoted — they choose it at record time (design round F1):
    #: someone quoting a shopkeeper quoted ATACADO, and forcing varejo would record a number they
    #: never said to the customer.
    headline_basis: Mapped[str] = mapped_column(Text, nullable=False)
    #: Row metadata: when the sync LANDED. Never on the wire, never ordered by, never used to
    #: validate `device_quoted_at` (FR-528, owner decision 2026-07-12).
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    #: Voluntary soft-delete — AND the idempotency tombstone that stops a delete-then-retry from
    #: resurrecting the row.
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))
    #: 015/A9 — a marca da anonimização LGPD (migração 0006), e ela é de MÃO ÚNICA no BANCO: o
    #: gatilho recusa limpá-la ou movê-la. Enquanto NULL, `owner_uid` e `payload` estão congelados
    #: como sempre estiveram; preenchê-la é a ÚNICA transição em que esses dois podem mudar — e
    #: nem nela os fatos contábeis cedem. Existe aqui para manter a paridade modelo↔schema; quem
    #: escreve é o CLI de operador, nunca uma rota.
    anonymized_at: Mapped[datetime.datetime | None] = mapped_column(DateTime(timezone=True))


#: The only columns a snapshot may ever move. Everything else is frozen (FR-504).
SNAPSHOT_MUTABLE_COLUMNS = frozenset({"label", "deleted_at", "updated_at"})


@event.listens_for(Snapshot, "before_update")
def _forbid_snapshot_content_mutation(
    _mapper: object, _connection: object, target: Snapshot
) -> None:
    """The ORM half of ADR-0019: defence against FUTURE code.

    SC-504 claims *0* write paths can alter a snapshot — a claim about code that does not exist yet
    (E5/E6 will write near this table). The API has no path to mutate contents today; this raises
    the moment someone adds one, instead of letting the epic's central promise quietly become false.
    The database trigger (migration 0003) is the third and final layer.
    """
    dirty = {
        attr.key
        for attr in inspect(target).attrs
        if attr.history.has_changes()  # pyright: ignore[reportUnknownMemberType]
    }
    frozen = dirty - SNAPSHOT_MUTABLE_COLUMNS
    if frozen:
        raise ValueError(
            "snapshot contents are immutable (FR-504/ADR-0019); "
            f"refused to update: {sorted(frozen)}"
        )
