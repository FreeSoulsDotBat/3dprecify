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

from collections.abc import Iterator
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.main import create_app
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
    queued retry arriving after the seller deleted the entry would silently bring it back."""
    h = _premium(monkeypatch, migrated_db, "u-tomb")

    created = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    assert created.status_code == 201
    snapshot_id = created.json()["id"]
    assert db_client.delete(f"/api/v1/history/{snapshot_id}", headers=h).status_code == 204

    replay = db_client.post("/api/v1/history", headers=h, json=_body(CSID))
    # It must NOT create a second row, and it must NOT undelete the first.
    assert _count(migrated_db, "u-tomb") == 1
    assert db_client.get(f"/api/v1/history/{snapshot_id}", headers=h).status_code == 404
    assert replay.status_code in (200, 409)
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


# --- 2. Immutability, enforced by the DATABASE (SC-504) ------------------------------------


def test_a_raw_UPDATE_of_a_frozen_column_RAISES_at_the_database(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The layer that makes SC-504 an INVARIANT rather than a promise about today's code. If this
    ever goes green by deleting the trigger, the epic's central claim quietly becomes false."""
    h = _premium(monkeypatch, migrated_db, "u-frozen")
    snapshot_id = db_client.post("/api/v1/history", headers=h, json=_body(CSID)).json()["id"]

    engine = sa.create_engine(migrated_db)
    with engine.begin() as conn, pytest.raises(sa.exc.DatabaseError):
        conn.execute(
            sa.text("UPDATE snapshots SET headline_total = '1.00' WHERE id = :i"),
            {"i": snapshot_id},
        )

    with engine.begin() as conn, pytest.raises(sa.exc.DatabaseError):
        conn.execute(
            sa.text("UPDATE snapshots SET device_quoted_at = now() WHERE id = :i"),
            {"i": snapshot_id},
        )


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
