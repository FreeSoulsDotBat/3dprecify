"""US1/US2 (FR-501..529, SC-501..514) — snapshot persistence, FAILING-first (T004).

Wire per `specs/009-e4-history-snapshots-export/contracts/api-surface.md`: `/api/v1/history`,
camelCase, money as decimal STRINGS inside a frozen JSONB document.

Four properties are load-bearing here, and each of them, if broken, produces a LIE rather than a
crash — which is why they are pinned at the DB, not merely in the service:

1. **EXACTLY-ONCE (SC-513, ADR-0018).** The device mints `clientSnapshotId` at RECORD time and
   replays it on every retry. `UNIQUE (owner_uid, client_snapshot_id)` is what makes a retry an
   idempotent SUCCESS (200, the row already created) instead of a duplicate — and the constraint is
   UNCONDITIONAL, tombstones included, so a **delete-then-retry cannot RESURRECT** a snapshot the
   seller deleted.

2. **IMMUTABILITY (SC-504, ADR-0019).** SC-504 claims *0* write paths can alter a snapshot — a claim
   about FUTURE code, not just today's. So the guarantee is enforced in the database by a
   `BEFORE UPDATE` trigger (the project's first PL/pgSQL, owner-approved): a raw `UPDATE` of a
   frozen
   column RAISES. Only `label`/`deleted_at`/`updated_at` may ever move.

3. **THE SERVER HOLDS NO QUEUE STATE.** There is no `pending`/`rejected` column and none may be
   added: the row exists only once the server accepted it (FR-529). "Pending" is 100% a device
   concept, and a denied sync writes NOTHING.

4. **THE DATE IS THE DEVICE'S** (FR-528, owner-accepted). `deviceQuotedAt` is stored VERBATIM —
   never
   replaced by a server clock (that would make the snapshot lie about *when the quote was given*) —
   and the row's `created_at` never reaches the wire.
"""

import json
import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.exc import DatabaseError
from sqlalchemy.orm import Session

from app.main import create_app
from app.models import Snapshot
from app.settings import Settings
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db

# A frozen document (the client's `freezePriceResult` output). Money is a decimal STRING everywhere:
# Postgres would keep a JSON number losslessly, but `json.loads` hands it back as a FLOAT — the
# precision dies in the serializer, silently (FR-525, data-model D1).
PAYLOAD: dict[str, Any] = {
    "schemaVersion": 1,
    "kind": "SINGLE",
    "modelVersion": "3.1.0",
    # Locked envelope (I2 / Option A): FLAT — `catalogVersion` is a first-class ROOT field (the
    # fee-catalog provenance echoed by pricing-core, ADR-0010), NOT buried inside `inputs`/`result`.
    # `null` when every channel used manual fees.
    "catalogVersion": None,
    "inputs": {"costPerRoll": "110", "printGrams": "100", "markupVarejoPct": "50"},
    "breakdown": {"material": "11.00", "energy": "0.60", "machine": "3.00"},
    "totals": {"custoTotal": "14.60", "precoVarejo": "21.90", "precoAtacado": "18.98"},
    "channels": [],
    "provenance": None,
}


def _body(client_snapshot_id: str, **over: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "clientSnapshotId": client_snapshot_id,
        "kind": "SINGLE",
        "label": "Cliente João",
        "quoteValidityDays": 15,
        "deviceQuotedAt": "2026-07-13T19:30:00Z",
        "deviceUtcOffsetMinutes": -180,
        "modelVersion": "3.1.0",
        "headlineTotal": "21.90",
        "headlineBasis": "PRECO_VAREJO",
        "payload": dict(PAYLOAD),
    }
    body.update(over)
    return body


CSID = "0192f3c1-1111-7000-8000-000000000001"


@pytest.fixture
def db_client(migrated_db: str) -> Iterator[TestClient]:
    app = create_app(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _premium(monkeypatch: pytest.MonkeyPatch, migrated_db: str, uid: str) -> dict[str, str]:
    seed_grant(migrated_db, uid)
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _free(monkeypatch: pytest.MonkeyPatch, uid: str) -> dict[str, str]:
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _count(migrated_db: str, uid: str) -> int:
    engine = sa.create_engine(migrated_db)
    with engine.connect() as conn:
        return int(
            conn.execute(
                sa.text("SELECT count(*) FROM snapshots WHERE owner_uid = :u"), {"u": uid}
            ).scalar_one()
        )


def _raw_insert(engine: sa.Engine, owner_uid: str, **over: Any) -> None:
    """INSERT a row BYPASSING the API — to prove a DB CHECK fires on a value the app-layer validator
    (VR-501..503, the Wave-2 primary) would also reject. Every field defaults to a VALID row; each
    `over` violates exactly ONE constraint, so the raised name is unambiguous."""
    row: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "owner_uid": owner_uid,
        "client_snapshot_id": str(uuid.uuid4()),
        "kind": "SINGLE",
        "label": None,
        "quote_validity_days": 15,
        "device_quoted_at": "2026-07-13T19:30:00Z",
        "device_utc_offset_minutes": -180,
        "model_version": "3.1.0",
        "payload_schema_version": 1,
        "payload": json.dumps(PAYLOAD),
        "headline_total": "21.90",
        "headline_basis": "PRECO_VAREJO",
    }
    row.update(over)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO snapshots"
                " (id, owner_uid, client_snapshot_id, kind, label, quote_validity_days,"
                "  device_quoted_at, device_utc_offset_minutes, model_version,"
                "  payload_schema_version, payload, headline_total, headline_basis)"
                " VALUES"
                " (:id, :owner_uid, :client_snapshot_id, :kind, :label, :quote_validity_days,"
                "  :device_quoted_at, :device_utc_offset_minutes, :model_version,"
                "  :payload_schema_version, CAST(:payload AS jsonb),"
                "  CAST(:headline_total AS numeric), :headline_basis)"
            ),
            row,
        )


# A payload WITH provenance, for the C8 `payload` case: it lets the raw UPDATE change
# `provenance.name` while keeping EVERY column-bound field (kind, modelVersion, schemaVersion,
# totals) byte-identical — the mutation ONLY the trigger catches (no CHECK binds provenance).
_C8_PROVENANCE: dict[str, Any] = {
    "kind": "PRODUCT",
    "id": "0192f0aa-0000-7000-8000-000000000001",
    "name": "Vaso G",
}
FROZEN_PAYLOAD: dict[str, Any] = {**PAYLOAD, "provenance": dict(_C8_PROVENANCE)}
FROZEN_PAYLOAD_MUTATED: dict[str, Any] = {
    **PAYLOAD,
    "provenance": {**_C8_PROVENANCE, "name": "Vaso GG"},
}

# The 13 FROZEN columns = the 16 table columns MINUS the 3 mutable (label, deleted_at, updated_at).
# Each entry updates ONE frozen column to a DISTINCT value; the trigger (BEFORE UPDATE ⇒ fires
# ahead of any CHECK) must reject all 13. `payload` and `owner_uid` are the two protected ONLY here.
_FROZEN_COLUMN_UPDATES: list[tuple[str, str, dict[str, Any]]] = [
    ("id", "id = gen_random_uuid()", {}),
    # An OWNERSHIP TRANSFER between two real accounts (FR-511/SC-509) — the FK stays valid, so only
    # the trigger stands between one seller's proof and another's account.
    ("owner_uid", "owner_uid = :v", {"v": "u-frozen2"}),
    ("client_snapshot_id", "client_snapshot_id = gen_random_uuid()", {}),
    ("kind", "kind = 'KIT'", {}),
    ("quote_validity_days", "quote_validity_days = 30", {}),
    ("device_quoted_at", "device_quoted_at = TIMESTAMPTZ '2020-01-01 00:00:00+00'", {}),
    ("device_utc_offset_minutes", "device_utc_offset_minutes = 0", {}),
    ("model_version", "model_version = '9.9.9'", {}),
    ("payload_schema_version", "payload_schema_version = 2", {}),
    # The whole frozen document — mutate `provenance.name` only. No CHECK binds it; delete the
    # `OR NEW.payload IS DISTINCT FROM OLD.payload` clause and the rest of the suite stays green.
    ("payload", "payload = CAST(:v AS jsonb)", {"v": json.dumps(FROZEN_PAYLOAD_MUTATED)}),
    ("headline_total", "headline_total = 18.98", {}),
    ("headline_basis", "headline_basis = 'PRECO_ATACADO'", {}),
    ("created_at", "created_at = TIMESTAMPTZ '2020-01-01 00:00:00+00'", {}),
]


# --- 1. Exactly-once (SC-513) --------------------------------------------------------------


def test_a_replayed_client_snapshot_id_returns_the_SAME_row_and_never_duplicates(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The retry path. A lost response is NOT the same as not saved — the outbox resends the same
    key and must get back the row the server already created."""
    h = _premium(monkeypatch, migrated_db, "u-once")

    first = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    assert first.status_code == 201, first.text

    replay = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    assert replay.status_code == 200, replay.text  # idempotent success, NOT a conflict error
    assert replay.json()["id"] == first.json()["id"]
    assert _count(migrated_db, "u-once") == 1


def test_a_replay_after_a_DELETE_does_not_resurrect_the_snapshot(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The tombstone lives INSIDE the unique key (the constraint is unconditional). Without that, a
    queued retry arriving after the seller deleted the entry would silently bring it back.

    WHEN this actually happens (worth stating, because it decides the right status): to delete a
    snapshot the seller must already have it on the SERVER. So this race only arises when the
    response to the original POST was LOST — the outbox still believes the entry is pending — and
    the seller then deletes it from another device. The honest answer is therefore **404: it
    existed, and you deleted it.** Resurrecting it (200 with the row) would silently undo a
    deliberate deletion, and that is the one outcome nobody could defend.

    The outbox contract that follows (ADR-0018): a 404 on replay ⇒ drop the queued entry WITHOUT
    alarming the user. It is not data loss — it is the seller's own later deletion winning.
    """
    h = _premium(monkeypatch, migrated_db, "u-tomb")

    created = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    assert created.status_code == 201
    snapshot_id = created.json()["id"]
    assert db_client.delete(f"/api/v1/history/{snapshot_id}", headers=h).status_code == 204

    replay = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    # It must NOT create a second row, and it must NOT undelete the first.
    assert _count(migrated_db, "u-tomb") == 1
    assert db_client.get(f"/api/v1/history/{snapshot_id}", headers=h).status_code == 404
    assert replay.status_code == 404
    assert db_client.get("/api/v1/history", headers=h).json()["items"] == []


def test_the_same_key_under_a_DIFFERENT_account_is_not_a_collision(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Uniqueness is scoped per account, so one account can never observe another's keys."""
    ha = _premium(monkeypatch, migrated_db, "u-a")
    assert db_client.post("/api/v1/history", headers=ha, json=_body(CSID)).status_code == 201

    hb = _premium(monkeypatch, migrated_db, "u-b")
    assert db_client.post("/api/v1/history", headers=hb, json=_body(CSID)).status_code == 201
    assert _count(migrated_db, "u-b") == 1


# --- 2. Immutability: three layers (SC-504, ADR-0019) --------------------------------------
# Layer 3 (the DB trigger, C8) and layer 2 (the ORM `before_update` guard, M12) are tested here.
# They fail DIFFERENTLY on purpose: a raw UPDATE reaches the DATABASE ⇒ `DatabaseError`; an ORM
# flush is stopped IN PYTHON, before any SQL leaves the process ⇒ `ValueError`.


@pytest.mark.parametrize(
    ("column", "set_clause", "params"),
    _FROZEN_COLUMN_UPDATES,
    ids=[c[0] for c in _FROZEN_COLUMN_UPDATES],
)
def test_C8_a_raw_UPDATE_of_ANY_frozen_column_RAISES_at_the_database(
    db_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    migrated_db: str,
    column: str,
    set_clause: str,
    params: dict[str, Any],
) -> None:
    """C8 — layer 3. A raw UPDATE of ANY of the 13 frozen columns RAISES via the trigger. `payload`
    (the whole frozen document) and `owner_uid` (an ownership transfer) are guarded ONLY here —
    deleting either PL/pgSQL clause would leave the rest of the suite GREEN. The trigger is BEFORE
    UPDATE, so it fires ahead of every CHECK: the `immutable` message proves it is the TRIGGER, not
    a coincidental constraint, standing on each column."""
    h = _premium(monkeypatch, migrated_db, "u-frozen")
    seed_grant(migrated_db, "u-frozen2")  # a real 2nd account ⇒ the owner_uid FK would stay valid
    snapshot_id = db_client.post(
        "/api/v1/history", headers=h, json=_body(CSID, payload=dict(FROZEN_PAYLOAD))
    ).json()["id"]

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn, pytest.raises(DatabaseError) as exc:
        # S608 is safe here: `set_clause` comes from the fixed `_FROZEN_COLUMN_UPDATES` list above,
        # never from request input — and the point of this raw path is to bypass the ORM.
        conn.execute(
            sa.text(f"UPDATE snapshots SET {set_clause} WHERE id = :i"),  # noqa: S608
            {"i": snapshot_id, **params},
        )
    assert "immutable" in str(exc.value), f"{column}: expected the trigger, got {exc.value}"


def test_M12_the_ORM_before_update_guard_raises_a_ValueError_before_any_SQL(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """M12 — layer 2. The `before_update` event on `Snapshot` (models/__init__.py). It stops the
    mutation in PYTHON at `flush()` with a `ValueError`, BEFORE the SQL that the trigger (C8) would
    reject as a `DatabaseError`. Deleting the `@event.listens_for` block leaves the suite green
    without it. The two mutable columns (`label`, `deleted_at`) must flow through untouched."""
    h = _premium(monkeypatch, migrated_db, "u-orm")
    snapshot_id = uuid.UUID(
        db_client.post("/api/v1/history", headers=h, json=_body(CSID)).json()["id"]
    )
    engine = sa.create_engine(migrated_db)

    # A frozen attribute ⇒ ValueError at flush, ahead of any SQL (distinct from C8's DatabaseError).
    with Session(engine) as session:
        snap = session.get(Snapshot, snapshot_id)
        assert snap is not None
        snap.headline_total = Decimal("1.00")
        with pytest.raises(ValueError, match="immutable"):
            session.flush()

    # The two mutable columns pass through the guard silently — a relabel and a soft-delete.
    with Session(engine) as session:
        snap = session.get(Snapshot, snapshot_id)
        assert snap is not None
        snap.label = "Cliente renomeado"
        session.flush()  # must NOT raise
        snap.deleted_at = datetime.now(UTC)
        session.flush()  # must NOT raise
        session.commit()


def test_the_label_and_only_the_label_may_move(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-label")
    snapshot_id = db_client.post("/api/v1/history", headers=h, json=_body(CSID)).json()["id"]

    ok = db_client.patch(
        f"/api/v1/history/{snapshot_id}", headers=h, json={"label": "Cliente Maria"}
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["label"] == "Cliente Maria"
    # The contents are untouched by a label edit.
    assert ok.json()["payload"]["totals"]["precoVarejo"] == "21.90"


@pytest.mark.parametrize(
    "smuggled",
    [
        {"label": "x", "headlineTotal": "1.00"},
        {"label": "x", "deviceQuotedAt": "2020-01-01T00:00:00Z"},
        {"label": "x", "modelVersion": "9.9.9"},
        {"label": "x", "payload": {"totals": {"precoVarejo": "1.00"}}},
    ],
)
def test_PATCH_rejects_a_smuggled_frozen_field_with_422_never_a_silent_ignore(
    db_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    migrated_db: str,
    smuggled: dict[str, Any],
) -> None:
    """`extra="forbid"`. Silently ignoring the extra field would be the worst outcome: the caller
    would believe it had rewritten history."""
    h = _premium(monkeypatch, migrated_db, "u-smuggle")
    snapshot_id = db_client.post("/api/v1/history", headers=h, json=_body(CSID)).json()["id"]

    r = db_client.patch(f"/api/v1/history/{snapshot_id}", headers=h, json=smuggled)
    assert r.status_code == 422, r.text


def test_no_PUT_route_exists_on_the_snapshot_resource(db_client: TestClient) -> None:
    """Immutability by absence of a path (the ADR-0012 idiom). The contract drift-guard then
    machine-checks that no write path appears later."""
    paths = db_client.get("/openapi.json").json()["paths"]
    for path, operations in paths.items():
        if path.startswith("/api/v1/history"):
            assert "put" not in operations, f"a PUT appeared on {path}"


def test_M4_a_PATCH_that_omits_label_leaves_it_untouched(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """M4 — the label is the ONE mutable field, so a body that OMITS it must be a no-op on the
    label (presence-sensitive via `model_fields_set`), NOT an erase. The prior code ran
    `row.label = body.label` unconditionally, so `PATCH {}` wiped the seller's reference and
    returned 200."""
    h = _premium(monkeypatch, migrated_db, "u-omit")
    snapshot_id = db_client.post(
        "/api/v1/history", headers=h, json=_body(CSID, label="Cliente João")
    ).json()["id"]

    r = db_client.patch(f"/api/v1/history/{snapshot_id}", headers=h, json={})
    assert r.status_code == 200, r.text
    assert r.json()["label"] == "Cliente João"  # untouched, NOT erased


def test_M4_a_PATCH_with_null_label_clears_it(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """`null` is PRESENT-and-clearing (distinct from omission): the seller explicitly removes the
    reference."""
    h = _premium(monkeypatch, migrated_db, "u-null")
    snapshot_id = db_client.post(
        "/api/v1/history", headers=h, json=_body(CSID, label="Cliente João")
    ).json()["id"]

    r = db_client.patch(f"/api/v1/history/{snapshot_id}", headers=h, json={"label": None})
    assert r.status_code == 200, r.text
    assert r.json()["label"] is None


@pytest.mark.parametrize("blank", ["", "   "])
def test_M4_a_blank_label_is_a_422_not_a_500(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str, blank: str
) -> None:
    """A blank/whitespace label violates `ck_snapshots_label_not_blank` at the DB → a 500. Caught
    app-side as a 422: an empty string is unrepresentable, and `null` (clear) is the honest way to
    remove a label."""
    h = _premium(monkeypatch, migrated_db, "u-blanklabel")
    snapshot_id = db_client.post("/api/v1/history", headers=h, json=_body(CSID)).json()["id"]

    r = db_client.patch(f"/api/v1/history/{snapshot_id}", headers=h, json={"label": blank})
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


# --- 2c. The lapse policy on the manage surface (US6/SC-508) ---------------------------------
# A lapse is NOT a deletion. The seller's records are their own data: reading stays open (the Q3
# read-only freeze, `require_catalog_read`), while every WRITE — relabel and delete — is denied
# (`require_entitlement`, ACTIVE only). Nothing is auto-purged. The UI hides the affordances too
# (snapshot-manage), but THIS is the enforcement: the client is never trusted (Constitution IV).


def test_a_lapse_freezes_writes_but_keeps_the_ledger_readable(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """SC-508. The record was made while premium; then the grant lapsed. Reads (list + detail) still
    return 200; relabel and delete are 403 ENTITLEMENT_REQUIRED; and the row is auto-deleted by
    NOTHING — a lapse touches no data."""
    uid = "u-lapsed"
    # A grant that expired an hour ago ⇒ status "lapsed" (a grant EXISTS, but none is active). The
    # account row it creates is also the FK target the snapshot needs.
    seed_grant(migrated_db, uid, expires_delta_h=-1)
    patch_verify(monkeypatch, uid)
    h = {"Authorization": "Bearer t"}

    # Seed the snapshot directly — the POST gate would (correctly) deny it now, but it was recorded
    # back when the seller was active.
    engine = sa.create_engine(migrated_db)
    sid = str(uuid.uuid4())
    _raw_insert(engine, uid, id=sid, client_snapshot_id=str(uuid.uuid4()), label="Cliente João")
    engine.dispose()

    # READ stays open — the ledger is the seller's own data (FR-517).
    assert db_client.get("/api/v1/history", headers=h).status_code == 200
    assert db_client.get(f"/api/v1/history/{sid}", headers=h).status_code == 200

    # WRITES are denied at the server — not a silent success the UI gate alone could be fooled into.
    relabel = db_client.patch(f"/api/v1/history/{sid}", headers=h, json={"label": "novo"})
    assert relabel.status_code == 403
    assert relabel.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
    removed = db_client.delete(f"/api/v1/history/{sid}", headers=h)
    assert removed.status_code == 403
    assert removed.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"

    # The lapse auto-deleted NOTHING — the row is intact and its label unchanged.
    assert _count(migrated_db, uid) == 1


# --- 2b. The write-time CHECK backstops (the money/schema guards, review PR-A §2b) ----------
# These are the DB BACKSTOP for a non-API writer; the app-layer validators (VR-501..503, Wave 2)
# are primary. Each raw INSERT violates exactly ONE constraint and asserts its name, so the guard
# is proven — not merely "some error happened".


@pytest.mark.parametrize(
    ("headline_total", "basis_total"),
    [("NaN", "NaN"), ("-1.00", "-1.00")],
    ids=["nan", "negative"],
)
def test_a_raw_insert_with_a_NaN_or_negative_headline_total_violates_the_money_guard(
    migrated_db: str, headline_total: str, basis_total: str
) -> None:
    """ck_snapshots_headline_total_valid — the ADR-0008 guard that was MISSING on the one money
    column (the only money column in the whole schema without it). `basis_total` mirrors it so the
    headline↔totals CHECK still holds and this isolates the guard under test."""
    seed_grant(migrated_db, "u-ck-money")
    engine = sa.create_engine(migrated_db)
    payload = {**PAYLOAD, "totals": {**PAYLOAD["totals"], "precoVarejo": basis_total}}
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(
            engine, "u-ck-money", headline_total=headline_total, payload=json.dumps(payload)
        )
    assert "ck_snapshots_headline_total_valid" in str(exc.value)


@pytest.mark.parametrize(
    ("headline_basis", "total_key", "correct"),
    [("PRECO_VAREJO", "precoVarejo", "21.90"), ("PRECO_ATACADO", "precoAtacado", "18.98")],
    ids=["varejo", "atacado"],
)
def test_a_raw_insert_whose_headline_total_disagrees_with_the_basis_total_violates(
    migrated_db: str, headline_basis: str, total_key: str, correct: str
) -> None:
    """ck_snapshots_headline_matches_totals — the DB backstop for VR-503. The card total and the
    detail's basis total are the SAME immutable claim; the DB refuses to let them diverge, per
    basis. map = {PRECO_VAREJO->precoVarejo, PRECO_ATACADO->precoAtacado}."""
    seed_grant(migrated_db, "u-ck-total")
    engine = sa.create_engine(migrated_db)
    # The document says one thing; the denormalised headline column says another.
    payload = {**PAYLOAD, "totals": {**PAYLOAD["totals"], total_key: "999.00"}}
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(
            engine,
            "u-ck-total",
            headline_basis=headline_basis,
            headline_total=correct,
            payload=json.dumps(payload),
        )
    assert "ck_snapshots_headline_matches_totals" in str(exc.value)


def test_a_raw_insert_whose_document_schemaVersion_disagrees_with_the_column_violates(
    migrated_db: str,
) -> None:
    """ck_snapshots_payload_schema_matches — the version column may never diverge from the document
    it labels (and the label is frozen ⇒ a wrong version would be permanent)."""
    seed_grant(migrated_db, "u-ck-schema")
    engine = sa.create_engine(migrated_db)
    payload = {**PAYLOAD, "schemaVersion": 2}  # the document claims v2 under a v1 column
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-ck-schema", payload_schema_version=1, payload=json.dumps(payload))
    assert "ck_snapshots_payload_schema_matches" in str(exc.value)


def test_a_raw_insert_with_payload_schema_version_below_one_violates(migrated_db: str) -> None:
    """ck_snapshots_payload_schema_valid — an envelope version is >= 1 by construction."""
    seed_grant(migrated_db, "u-ck-schemamin")
    engine = sa.create_engine(migrated_db)
    payload = {**PAYLOAD, "schemaVersion": 0}  # mirror the column so ONLY the >=1 guard fails
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-ck-schemamin", payload_schema_version=0, payload=json.dumps(payload))
    assert "ck_snapshots_payload_schema_valid" in str(exc.value)


def test_a_raw_insert_with_a_blank_model_version_violates(migrated_db: str) -> None:
    """ck_snapshots_model_version_set — the formula version is the whole point of a snapshot; a
    blank one is a snapshot that cannot say which formula produced it."""
    seed_grant(migrated_db, "u-ck-modelver")
    engine = sa.create_engine(migrated_db)
    payload = {**PAYLOAD, "modelVersion": "   "}  # mirror the column so ONLY the set-guard fails
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-ck-modelver", model_version="   ", payload=json.dumps(payload))
    assert "ck_snapshots_model_version_set" in str(exc.value)


# --- 2c. App-layer validation (M2 / VR-501..503 + CHECK mirrors + size cap) -----------------
# The PRIMARY defence: a bad body is a 422 BEFORE the write (the DB CHECKs of §2b are the backstop
# for a non-API writer). Every case asserts BOTH a 422 AND that NOTHING was written — the immutable
# table must never see the row. The reachable-by-input failures that would otherwise be a 500 (the
# outbox re-POSTs a 5xx forever) are the ones that matter most here.


def test_M2_a_JSON_float_anywhere_in_the_payload_is_a_422_never_frozen(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-502 — the recursive float scan, the LAST defence before a float freezes into the JSONB.
    The float is buried in a channel band (an ARRAY of OBJECTS) — the exact I1 defect the ad-hoc
    top-level-only freeze missed; this proves the scan recurses through list→dict→list→dict."""
    h = _premium(monkeypatch, migrated_db, "u-float")
    payload = {
        **PAYLOAD,
        "channels": [{"marketplace": "shopee", "priceBands": [{"fixedFee": 5.99}]}],
    }
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID, payload=payload))
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert _count(migrated_db, "u-float") == 0


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity"])
def test_M2_a_non_finite_money_string_is_a_422(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str, bad: str
) -> None:
    """VR-501 — `Decimal("NaN")`/`Decimal("Infinity")` are valid Python; the validator must assert
    `is_finite()`. This is the in-JSON twin of the `<> 'NaN'::numeric` CHECK that cannot reach a
    money string buried inside JSONB."""
    h = _premium(monkeypatch, migrated_db, "u-nan")
    payload = {**PAYLOAD, "totals": {**PAYLOAD["totals"], "custoTotal": bad}}
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID, payload=payload))
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-nan") == 0


def test_M2_an_overflowing_headline_total_is_a_422_not_a_500(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The review's 500: a headlineTotal past Numeric(12,2) raised `numeric field overflow` at the
    INSERT → an opaque 500 the outbox would re-POST forever. The field validator makes it a
    terminal 422. `10**10` is the first magnitude that overflows the column."""
    h = _premium(monkeypatch, migrated_db, "u-overflow")
    over = "10000000000.00"
    payload = {**PAYLOAD, "totals": {**PAYLOAD["totals"], "precoVarejo": over}}
    r = db_client.post(
        "/api/v1/history", headers=h, json=_body(CSID, headlineTotal=over, payload=payload)
    )
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-overflow") == 0


def test_M2_headline_total_disagreeing_with_the_basis_total_is_a_422(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-503 — the review's exact lie: `headlineTotal:"999.00"` while `totals.precoVarejo:"21.90"`.
    The card would show R$ 999,00 and the detail R$ 21,90 for ONE immutable line. Rejected: the two
    numbers are the SAME claim (app-layer primary; `ck_snapshots_headline_matches_totals` is the
    backstop)."""
    h = _premium(monkeypatch, migrated_db, "u-lie")
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID, headlineTotal="999.00"))
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-lie") == 0


def test_M2_a_headline_basis_with_no_matching_total_is_a_422(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """PRECO_ATACADO must be matched by `totals.precoAtacado` — an absent basis total is an
    ambiguous claim, not a `0.00`.
    map = {PRECO_VAREJO->precoVarejo, PRECO_ATACADO->precoAtacado}."""
    h = _premium(monkeypatch, migrated_db, "u-nobasis")
    payload = {**PAYLOAD, "totals": {"custoTotal": "14.60", "precoVarejo": "21.90"}}
    r = db_client.post(
        "/api/v1/history",
        headers=h,
        json=_body(CSID, headlineBasis="PRECO_ATACADO", headlineTotal="18.98", payload=payload),
    )
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-nobasis") == 0


@pytest.mark.parametrize(
    "over",
    [{"payload_kind": "KIT"}, {"payload_model_version": "9.9.9"}],
    ids=["kind_mismatch", "model_version_mismatch"],
)
def test_M2_a_denormalized_column_disagreeing_with_the_document_is_a_422_not_a_500(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str, over: dict[str, str]
) -> None:
    """The `payload->>'kind' = kind` / `payload->>'modelVersion' = model_version` CHECKs would fire
    at the DB as an IntegrityError → 500. Mirror them app-side: the column and the frozen document
    can never drift (immutability freezes both), and the drift is caught as a 422."""
    h = _premium(monkeypatch, migrated_db, "u-mirror")
    payload = dict(PAYLOAD)
    if "payload_kind" in over:
        payload["kind"] = over["payload_kind"]
    if "payload_model_version" in over:
        payload["modelVersion"] = over["payload_model_version"]
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID, payload=payload))
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-mirror") == 0


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("quoteValidityDays", 0),
        ("quoteValidityDays", 4000),
        ("deviceUtcOffsetMinutes", 841),
        ("deviceUtcOffsetMinutes", -841),
    ],
)
def test_M2_an_out_of_range_scalar_is_a_422(
    db_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    migrated_db: str,
    field: str,
    value: int,
) -> None:
    """`quote_validity_days_range` [1,3650] and `device_utc_offset_range` [-840,840] — the range
    CHECKs mirrored app-side so an out-of-range scalar is a 422, never the DB IntegrityError 500."""
    h = _premium(monkeypatch, migrated_db, "u-range")
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID, **{field: value}))
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-range") == 0


def test_M2_an_oversized_payload_is_an_honest_422_never_truncated(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Size cap (data-model §7 item 6, 512 KB). An over-cap document is an HONEST 422 — never a
    silent truncation, which would make an immutable record lie about what it froze. The huge leaf
    is a NON-numeric string so it is the SIZE guard under test, not VR-501's magnitude ceiling."""
    h = _premium(monkeypatch, migrated_db, "u-huge")
    huge = {**PAYLOAD, "provenance": {"kind": "PRODUCT", "id": "x", "name": "A" * (600 * 1024)}}
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID, payload=huge))
    assert r.status_code == 422, r.text
    assert _count(migrated_db, "u-huge") == 0


def test_M2_the_stored_document_contains_no_float_leaf_after_a_round_trip(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Reinforced round-trip: not merely one asserted key, but a RECURSIVE scan proving psycopg
    handed every money leaf back as a STRING, not a decoded `float`. If any leaf were a JSON number,
    this fails — the entire reason money is stored as decimal strings (FR-525)."""
    h = _premium(monkeypatch, migrated_db, "u-nofloat")
    created = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    fetched = db_client.get(f"/api/v1/history/{created.json()['id']}", headers=h).json()

    def _assert_no_float(node: Any) -> None:
        if isinstance(node, bool):
            return
        assert not isinstance(node, float), f"a float leaf survived the round-trip: {node!r}"
        if isinstance(node, dict):
            for value in node.values():
                _assert_no_float(value)
        elif isinstance(node, list):
            for item in node:
                _assert_no_float(item)

    _assert_no_float(fetched["payload"])


# --- 3. The gate, isolation, lapse (SC-503/508/509) ----------------------------------------


def test_a_free_caller_is_denied_and_NOTHING_is_written(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _free(monkeypatch, "u-free")
    r = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
    assert _count(migrated_db, "u-free") == 0


def test_a_signed_out_caller_is_denied(db_client: TestClient) -> None:
    assert db_client.post("/api/v1/history", json=_body(CSID)).status_code == 401


def test_another_accounts_snapshot_is_indistinguishable_from_non_existent(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """No existence oracle: B cannot tell 'exists but not yours' from 'never existed'."""
    ha = _premium(monkeypatch, migrated_db, "u-owner")
    snapshot_id = db_client.post("/api/v1/history", headers=ha, json=_body(CSID)).json()["id"]

    hb = _premium(monkeypatch, migrated_db, "u-other")
    assert db_client.get(f"/api/v1/history/{snapshot_id}", headers=hb).status_code == 404
    assert (
        db_client.patch(
            f"/api/v1/history/{snapshot_id}", headers=hb, json={"label": "roubado"}
        ).status_code
        == 404
    )
    assert db_client.delete(f"/api/v1/history/{snapshot_id}", headers=hb).status_code == 404


def test_on_lapse_reads_survive_writes_are_denied_and_NOTHING_is_deleted(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The read-only freeze (SC-508). The lapse must never delete a seller's quotes."""
    h = _premium(monkeypatch, migrated_db, "u-lapse")
    snapshot_id = db_client.post("/api/v1/history", headers=h, json=_body(CSID)).json()["id"]

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        conn.execute(
            sa.text("UPDATE entitlement_grants SET revoked_at = now() WHERE account_uid = :u"),
            {"u": "u-lapse"},
        )

    assert db_client.get(f"/api/v1/history/{snapshot_id}", headers=h).status_code == 200
    assert (
        db_client.post(
            "/api/v1/history",
            headers=h,
            json=_body("0192f3c1-2222-7000-8000-000000000002"),
        ).status_code
        == 403
    )
    assert (
        db_client.patch(
            f"/api/v1/history/{snapshot_id}", headers=h, json={"label": "x"}
        ).status_code
        == 403
    )
    assert _count(migrated_db, "u-lapse") == 1  # zero rows deleted by the lapse


# --- 3c. Catalog churn is INERT: the origin has NO foreign key (SC-502, ADR-0019 §5) -------
# The epic's promise, at the DB: a snapshot CONTAINS its values and only CAPTURES its origin (inside
# the JSONB payload), never REFERENCES it. There is deliberately no FK — a SET NULL would WRITE to
# the immutable row (and trip the trigger), and a RESTRICT would make deleting a product FAIL. So
# editing or hard-purging the origin can neither rewrite the snapshot nor be blocked by it.

_FIL = {"name": "PLA Azul", "material": "PLA", "costPerRoll": "110.00", "rollWeightKg": "1.000"}
_PRN = {
    "name": "Ender 3",
    "machineValue": "1200.00",
    "machineLifetimeHours": "2000.000",
    "avgPowerKw": "0.1200",
}
_PIECE = {
    "printGrams": "100.000",
    "printTimeHours": "5.000",
    "markupVarejoPct": "50.000",
    "markupAtacadoPct": "30.000",
}


def _mk_origin_product(db_client: TestClient, h: dict[str, str]) -> str:
    """A real origin product through the API (FR-310 prerequisites) — returns its id."""
    fid = db_client.post("/api/v1/filaments", headers=h, json=dict(_FIL)).json()["id"]
    pid = db_client.post("/api/v1/printers", headers=h, json=dict(_PRN)).json()["id"]
    body = {
        "name": "Vaso G",
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": dict(_PIECE),
        "tariffPerKwh": "1.000000",
        "includeMarketplace": False,
        "channels": [],
        "otherCosts": [],
    }
    created = db_client.post("/api/v1/products", headers=h, json=body)
    assert created.status_code == 201, created.text
    return str(created.json()["id"])


def test_SC502_the_snapshots_table_has_no_foreign_key_into_the_catalog(migrated_db: str) -> None:
    """ADR-0019 §5, structural: provenance is JSONB, not a column, so snapshots reference no product
    or kit table. Deleting this test's premise (adding an FK) is exactly the mistake it guards."""
    engine = sa.create_engine(migrated_db)
    with engine.connect() as conn:
        referenced = set(
            conn.execute(
                sa.text(
                    "SELECT ccu.table_name"
                    " FROM information_schema.table_constraints tc"
                    " JOIN information_schema.constraint_column_usage ccu"
                    "   ON tc.constraint_name = ccu.constraint_name"
                    "  AND tc.table_schema = ccu.table_schema"
                    " WHERE tc.constraint_type = 'FOREIGN KEY'"
                    "   AND tc.table_name = 'snapshots'"
                )
            ).scalars()
        )
    assert "products" not in referenced
    assert "boms" not in referenced


def test_SC502_hard_purging_the_origin_neither_fails_nor_touches_the_snapshot(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """A raw DELETE of the origin row (bypassing the soft-delete API) must SUCCEED — no FK blocks
    it — and the snapshot is byte-identical afterwards, still naming the origin it was cut from."""
    h = _premium(monkeypatch, migrated_db, "u-churn")
    product_id = _mk_origin_product(db_client, h)

    payload = {**PAYLOAD, "provenance": {"kind": "PRODUCT", "id": product_id, "name": "Vaso G"}}
    created = db_client.post("/api/v1/history", headers=h, json=_body(CSID, payload=payload))
    assert created.status_code == 201, created.text
    before = db_client.get(f"/api/v1/history/{created.json()['id']}", headers=h).json()

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn:
        purged = conn.execute(sa.text("DELETE FROM products WHERE id = :p"), {"p": product_id})
    assert purged.rowcount == 1  # a REAL referenced row was hard-deleted, no FK violation raised

    after = db_client.get(f"/api/v1/history/{created.json()['id']}", headers=h).json()
    assert after["payload"] == before["payload"]  # the frozen document did not move
    assert after["headlineTotal"] == before["headlineTotal"]
    # The captured name still shows — the snapshot never learned its origin is gone (two-shelf).
    assert after["payload"]["provenance"]["name"] == "Vaso G"


# --- 3b. Keyset pagination (M3): no silent cap, no lost boundary row ------------------------
# A hard cap of 50 with `next_cursor=None` dropped every row past the page SILENTLY (review PR-A M3)
# — and because the detail resolves via the list (no server caller for GET /{id}), the 51st record's
# detail rendered "Registro não encontrado" for a row the server has. The keyset lets the client
# follow `nextCursor` to exhaustion; a dry cap is forbidden by the spec (D4).


def _seed_dated(db_client: TestClient, headers: dict[str, str], n: int) -> list[str]:
    """POST n snapshots with STRICTLY INCREASING device dates; returns their ids oldest→newest."""
    ids: list[str] = []
    for i in range(n):
        csid = f"0192f3c1-0000-7000-8000-{i:012d}"
        dt = f"2026-07-{10 + i:02d}T12:00:00Z"
        r = db_client.post("/api/v1/history", headers=headers, json=_body(csid, deviceQuotedAt=dt))
        assert r.status_code == 201, r.text
        ids.append(r.json()["id"])
    return ids


def test_M3_keyset_returns_every_row_once_newest_first_with_no_boundary_loss(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Follow `nextCursor` to exhaustion over 5 rows at limit=2 (⇒ 3 pages). Every row appears
    exactly once, newest device-date first, and the page-boundary row is never dropped — the exact
    failure the silent cap produced for the 51st record."""
    h = _premium(monkeypatch, migrated_db, "u-page")
    ids = _seed_dated(db_client, h, 5)
    expected = list(reversed(ids))  # newest device-date first

    seen: list[str] = []
    cursor: str | None = None
    for _ in range(10):  # safety bound
        params = {"limit": "2"}
        if cursor is not None:
            params["cursor"] = cursor
        page = db_client.get("/api/v1/history", headers=h, params=params).json()
        seen.extend(item["id"] for item in page["items"])
        cursor = page["nextCursor"]
        if cursor is None:
            break
    assert seen == expected  # order kept, boundary kept, nothing duplicated or lost


def test_M3_the_cursor_disambiguates_same_device_date_rows_by_id(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Tie-break by id (server uuid7 ⇒ deterministic total order, D4/D6). Two rows sharing a device
    date must page without loss or duplication regardless of which id sorts higher."""
    h = _premium(monkeypatch, migrated_db, "u-tie")
    dt = "2026-07-13T12:00:00Z"
    csid1 = "0192f3c1-0000-7000-8000-00000000aaa1"
    csid2 = "0192f3c1-0000-7000-8000-00000000aaa2"
    id1 = db_client.post("/api/v1/history", headers=h, json=_body(csid1, deviceQuotedAt=dt)).json()[
        "id"
    ]
    id2 = db_client.post("/api/v1/history", headers=h, json=_body(csid2, deviceQuotedAt=dt)).json()[
        "id"
    ]

    seen: list[str] = []
    cursor: str | None = None
    for _ in range(5):  # safety bound
        params = {"limit": "1"}
        if cursor is not None:
            params["cursor"] = cursor
        page = db_client.get("/api/v1/history", headers=h, params=params).json()
        seen.extend(item["id"] for item in page["items"])
        cursor = page["nextCursor"]
        if cursor is None:
            break
    assert sorted(seen) == sorted([id1, id2])
    assert len(seen) == len(set(seen)) == 2  # each row exactly once across the id tie-break


def test_M3_a_malformed_cursor_is_a_422_not_a_500(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """A cursor is opaque CLIENT input; a garbage value is a 422 (VALIDATION_ERROR), never a 500."""
    h = _premium(monkeypatch, migrated_db, "u-badcursor")
    r = db_client.get("/api/v1/history", headers=h, params={"cursor": "not-a-valid-cursor"})
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


# --- 3e. Search by label + date range (US6, T021/T022) -------------------------------------
# ux §2.6: server-side label ILIKE (owner-scoped) + a device-date range, composing with the keyset.
# F5 (owner-accepted for E4): the search is ACCENT-SENSITIVE — `joao` does not find `João` — because
# labels are typed with accents by the same person who searches them (an `unaccent` posture is a
# deliberate future migration, not silently assumed here).


def test_US6_label_search_is_owner_scoped_case_insensitive_and_accent_sensitive(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-search")
    # label defaults to "Cliente João" in _body.
    db_client.post("/api/v1/history", headers=h, json=_body(CSID)).raise_for_status()

    def q(term: str) -> int:
        return len(db_client.get("/api/v1/history", headers=h, params={"q": term}).json()["items"])

    assert q("joão") == 1  # case-insensitive ILIKE
    assert q("CLIENTE") == 1  # substring, any case
    assert q("joao") == 0  # F5: accent-sensitive — `joao` does NOT match `João`
    assert q("Maria") == 0  # a non-match returns an HONEST empty page, never everything

    # Owner scope: account B (empty) cannot find account A's label — no cross-tenant leak.
    # (`_premium` re-patches the shared token to B, so A's own visibility is asserted above, first.)
    hb = _premium(monkeypatch, migrated_db, "u-search-b")
    b_hits = db_client.get("/api/v1/history", headers=hb, params={"q": "joão"}).json()["items"]
    assert len(b_hits) == 0


def test_US6_date_range_filters_on_the_DEVICE_date_and_composes_with_search(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-range")
    # A quote the seller dates 2026-07-13 on their device.
    db_client.post("/api/v1/history", headers=h, json=_body(CSID)).raise_for_status()

    def count(**params: str) -> int:
        return len(db_client.get("/api/v1/history", headers=h, params=params).json()["items"])

    assert count(**{"from": "2026-07-01T00:00:00Z", "to": "2026-07-31T23:59:59Z"}) == 1  # inside
    assert count(**{"from": "2026-08-01T00:00:00Z"}) == 0  # after the whole window
    assert count(**{"to": "2026-07-01T00:00:00Z"}) == 0  # before it
    # Filters COMPOSE (busca ∧ período): the label matches AND the date is inside → still 1.
    assert count(q="joão", **{"from": "2026-07-01T00:00:00Z"}) == 1
    # …but a matching label OUTSIDE the window is excluded — the period is not ignored.
    assert count(q="joão", **{"from": "2026-08-01T00:00:00Z"}) == 0


def test_US6_a_malformed_date_bound_is_a_422_not_a_500(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-baddate")
    r = db_client.get("/api/v1/history", headers=h, params={"from": "not-a-date"})
    assert r.status_code == 422, r.text


def test_US6_clientSnapshotId_exact_lookup_resolves_a_single_row_for_the_detail(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The detail is keyed by clientSnapshotId (a pending record's only id). With lazy pagination a
    deep-linked snapshot need not be on the first page, so the detail resolves it by exact id."""
    h = _premium(monkeypatch, migrated_db, "u-byclient")
    created = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    created.raise_for_status()
    other = "0192f3c1-9999-7000-8000-000000009999"
    db_client.post("/api/v1/history", headers=h, json=_body(other)).raise_for_status()

    page = db_client.get("/api/v1/history", headers=h, params={"clientSnapshotId": CSID}).json()
    assert len(page["items"]) == 1
    assert page["items"][0]["clientSnapshotId"] == CSID
    assert page["items"][0]["id"] == created.json()["id"]


# --- 4. The document survives verbatim; the date is the device's (FR-525/528) --------------


def test_the_frozen_payload_round_trips_byte_identically(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """No float ever touches the money. If a serializer somewhere turns "21.90" into 21.9, this
    fails — which is the entire point of storing decimal strings."""
    h = _premium(monkeypatch, migrated_db, "u-money")
    created = db_client.post("/api/v1/history", headers=h, json=_body(CSID))

    fetched = db_client.get(f"/api/v1/history/{created.json()['id']}", headers=h).json()
    assert fetched["payload"] == PAYLOAD
    assert fetched["payload"]["totals"]["precoVarejo"] == "21.90"  # not 21.9, not 21.900000001


def test_the_device_clock_is_stored_verbatim_and_created_at_never_reaches_the_wire(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """FR-528: the date IS the seller's claim. Substituting a server clock would make the snapshot
    lie about WHEN the quote was given. The row's created_at exists as metadata only — never
    displayed, never exported, never used to order or to validate."""
    h = _premium(monkeypatch, migrated_db, "u-clock")
    body = _body(CSID, deviceQuotedAt="2020-01-01T10:00:00Z")  # a device clock years in the past
    created = db_client.post("/api/v1/history", headers=h, json=body)

    out = created.json()
    assert out["deviceQuotedAt"].startswith("2020-01-01T10:00:00")  # stored as given, not "now"
    assert "createdAt" not in out
    assert "receivedAt" not in out
