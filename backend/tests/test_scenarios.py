"""E5 saved marketplace scenarios — PR-A subset, FAILING-first (T005).

Wire per `specs/010-e5-saved-scenarios/contracts/api-surface.md` + the config envelope per
`specs/010-e5-saved-scenarios/data-model.md` §3/§4. `/api/v1/scenarios`, camelCase, **all money a
decimal STRING** inside the `config` JSONB (never a float — `json.loads`/`JSON.parse` decode a JSON
number to binary64, so the loss is app-side and silent).

A scenario is the deliberate OPPOSITE of an E4 snapshot at the data layer (data-model governing
sentence): it stores the seller's **INTENT, not a resolved price**, and it is **MUTABLE** — so there
is **no** immutability trigger, **no** idempotency key, **no** money column, **no** catalog FK. The
live price is recomputed client-side on reopen and never stored (VR-611).

This file is the **PR-A subset** of the VR-6xx spec (data-model §8). It is split so the
failing-first progression is legible against T006/T007:

* **Section A — DB-layer CHECK backstops** (via a raw INSERT that bypasses the API). These pin the
  §4 named CHECKs at the database and the §2 "no Numeric column" shape. They go **GREEN after T006**
  (the table + CHECKs exist) with no route needed — the E4 `test_history.py::_raw_insert` idiom.
    - VR-611 (schema: no `Numeric` column), VR-613 (envelope↔column binding CHECK),
      VR-614 (name/note caps at the DB layer).

* **Section B — API surface** (`/api/v1/scenarios`). These exercise the routes that **T007** builds,
  so they stay **RED until T007** (no router ⇒ 404, not the asserted status) even after the table
  exists.
    - VR-601 (entitlement gate), VR-602/603 (config validation — a float leaf ⇒ 422; STRUCTURAL,
      not shape-pinning), VR-607 (materializes nothing), VR-609 (isolation), VR-611 (no resolved
      price on the response), VR-614 (blank name ⇒ 422, blank note ⇒ NULL).
"""

from __future__ import annotations

import json
import uuid
from collections.abc import Callable, Iterator
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy.exc import DatabaseError

from app.main import create_app
from app.settings import Settings
from app.validation import CEIL_CONFIG_LEAF, CEIL_MONEY
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db


# --- The intent document (data-model §3, config_schema_version = 1) -------------------------------
# A fully-resolved ad-hoc PriceInput as `lastKnown` — every money/rate/qty/percent leaf a decimal
# STRING; the only JSON numbers are true int counts (`schemaVersion`). This is INTENT, not a
# resolved PriceResult: `channels[].feeOverrides` carries ONLY the seller's explicit adjustments
# (an absent key re-resolves live on reopen), and none of these numbers is a stored price.


def _piece_input() -> dict[str, Any]:
    """A single resolved `PriceInput` — the FLAT contract shape (`contracts/api-surface.md` lines
    69-79, data-model §3): `pricing-core`'s own `PriceInput` keys verbatim, no `filament`/`printer`
    prefix, no material-name leaf (redirect 2026-07-20 — see `_CONTRACT_PRICE_INPUT_KEYS` below for
    the literal-key regression guard this fixture must stay in sync with)."""
    return {
        "costPerRoll": "110.00",
        "rollWeightKg": "1.000",
        "printGrams": "100.000",
        "wasteGrams": "0.000",
        "printTimeHours": "5.000",
        "avgPowerKw": "0.1200",
        "tariffPerKwh": "1.000000",
        "machineValue": "1200.00",
        "machineLifetimeHours": "2000.000",
        "maintenanceReservePerHour": "0.000000",
        "failurePct": "0.000",
        "finishTimeHours": "0.000",
        "finishRatePerHour": "0.000000",
        "laborHours": "0.000",
        "laborRatePerHour": "0.000000",
        "markupVarejoPct": "50.000",
        "markupAtacadoPct": "30.000",
    }


VALID_CONFIG: dict[str, Any] = {
    "schemaVersion": 1,
    "includeMarketplace": True,
    "costBasis": {
        "kind": "AD_HOC",
        "ref": None,
        "lastKnown": _piece_input(),
    },
    "channels": [
        {
            "marketplace": "MERCADO_LIVRE",
            "modality": "CLASSICO",
            # ONLY explicit overrides — an absent slot (e.g. minPerItem) re-resolves live (FR-607).
            "feeOverrides": {"commissionPct": "12.5", "fixedFee": "6.00"},
        }
    ],
    "otherCosts": [{"name": "Embalagem", "value": "2.50"}],
}


def _body(
    name: str = "Cenário ML Clássico", note: str | None = None, config: dict[str, Any] | None = None
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "name": name,
        "config": config if config is not None else dict(VALID_CONFIG),
    }
    if note is not None:
        body["note"] = note
    return body


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
    """A caller with NO server grant. This is ALSO the "locally-faked-premium" case: the client can
    fake the premium UI, but the server holds no grant — so at the server it is free."""
    patch_verify(monkeypatch, uid)
    return {"Authorization": "Bearer t"}


def _scenario_count(migrated_db: str, uid: str) -> int:
    engine = sa.create_engine(migrated_db)
    with engine.connect() as conn:
        return int(
            conn.execute(
                sa.text("SELECT count(*) FROM scenarios WHERE owner_uid = :u"), {"u": uid}
            ).scalar_one()
        )


def _catalog_counts(migrated_db: str, uid: str) -> dict[str, int]:
    """Row counts for the four existing tables (+ bom_lines through its root) scoped to one owner —
    VR-607 asserts a scenario save leaves every one of them untouched (materializes nothing)."""
    engine = sa.create_engine(migrated_db)
    with engine.connect() as conn:

        def one(query: str) -> int:
            return int(conn.execute(sa.text(query), {"u": uid}).scalar_one())

        return {
            "filaments": one("SELECT count(*) FROM filaments WHERE owner_uid = :u"),
            "printers": one("SELECT count(*) FROM printers WHERE owner_uid = :u"),
            "products": one("SELECT count(*) FROM products WHERE owner_uid = :u"),
            "boms": one("SELECT count(*) FROM boms WHERE owner_uid = :u"),
            "bom_lines": one(
                "SELECT count(*) FROM bom_lines bl"
                " JOIN boms b ON b.id = bl.bom_id WHERE b.owner_uid = :u"
            ),
        }


def _raw_insert(engine: sa.Engine, owner_uid: str, **over: Any) -> None:
    """INSERT a `scenarios` row BYPASSING the API — to prove a DB CHECK fires. Every field defaults
    to a VALID row; each `over` violates exactly ONE named constraint, so the raised name is
    unambiguous (the E4 `test_history.py::_raw_insert` idiom). `config`/`config_schema_version`
    default to a matched pair so the envelope↔column CHECK holds unless a case breaks it."""
    row: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "owner_uid": owner_uid,
        "name": "Cenário X",
        "note": None,
        "config": json.dumps(VALID_CONFIG),
        "config_schema_version": 1,
    }
    row.update(over)
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO scenarios"
                " (id, owner_uid, name, note, config, config_schema_version)"
                " VALUES"
                " (:id, :owner_uid, :name, :note, CAST(:config AS jsonb), :config_schema_version)"
            ),
            row,
        )


# ══ Section A — DB-layer CHECK backstops (GREEN after T006; no route needed) ════════════════════
# These pin the §4 named CHECKs + the §2 no-Numeric-column shape at the DATABASE. The app-layer
# validator (VR-602/603, T007) is the PRIMARY defence; these are the backstop for a non-API writer,
# exactly as `test_history.py`'s raw-INSERT block backstops the snapshot validators.


def test_A_a_valid_raw_insert_succeeds(migrated_db: str) -> None:
    """Positive control: the baseline row is valid, so every violation below isolates ONE CHECK."""
    seed_grant(migrated_db, "u-sc-ok")
    engine = sa.create_engine(migrated_db)
    _raw_insert(engine, "u-sc-ok")
    assert _scenario_count(migrated_db, "u-sc-ok") == 1


# VR-611 — no resolved price on the row (schema assertion) -----------------------------------------


def test_VR611_scenarios_table_has_no_numeric_column(migrated_db: str) -> None:
    """A scenario stores INTENT and recomputes client-side — the row holds NO resolved price. The
    structural proof: the table has ZERO `numeric` columns (data-model §1 sub-decision / §8 VR-611).
    Adding one is exactly the mistake this guards (an E4 `headline_total` has no twin here)."""
    engine = sa.create_engine(migrated_db)
    with engine.connect() as conn:
        # The table must EXIST first — else "no numeric column" is vacuously true (RED pre-T006).
        assert conn.execute(
            sa.text("SELECT to_regclass('public.scenarios') IS NOT NULL")
        ).scalar_one(), "the scenarios table does not exist yet"
        numeric_cols = list(
            conn.execute(
                sa.text(
                    "SELECT column_name FROM information_schema.columns"
                    " WHERE table_name = 'scenarios' AND data_type = 'numeric'"
                )
            ).scalars()
        )
    assert numeric_cols == [], f"scenarios must have no Numeric column, found: {numeric_cols}"


def test_VR611_the_only_foreign_key_is_owner_uid_into_accounts(migrated_db: str) -> None:
    """N2: the cost-basis reference is a SOFT reference inside `config`, never an FK. The ONLY FK on
    the table is `owner_uid → accounts`; no `products`/`boms` FK (a dangling ref degrades read-time,
    it does not break integrity)."""
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
                    "   AND tc.table_name = 'scenarios'"
                )
            ).scalars()
        )
    assert referenced == {"accounts"}, f"the only FK must be into accounts, got: {referenced}"


# VR-613 — envelope↔column binding CHECK ----------------------------------------------------------


def test_VR613_a_raw_insert_whose_config_schemaVersion_disagrees_with_the_column_violates(
    migrated_db: str,
) -> None:
    """ck_scenarios_config_schema_matches — the `(config->>'schemaVersion')::int =
    config_schema_version` binding holds on EVERY write (defence-in-depth against a mismatched
    envelope). The document claims v2 under a v1 column."""
    seed_grant(migrated_db, "u-sc-bind")
    engine = sa.create_engine(migrated_db)
    mismatched = json.dumps({**VALID_CONFIG, "schemaVersion": 2})
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-sc-bind", config=mismatched, config_schema_version=1)
    assert "ck_scenarios_config_schema_matches" in str(exc.value)


def test_VR613_a_raw_insert_with_config_schema_version_below_one_violates(migrated_db: str) -> None:
    """ck_scenarios_config_schema_valid — an envelope version is >= 1 by construction. Mirror the
    document's schemaVersion so ONLY the >=1 guard fails (not the binding CHECK)."""
    seed_grant(migrated_db, "u-sc-schemamin")
    engine = sa.create_engine(migrated_db)
    payload = json.dumps({**VALID_CONFIG, "schemaVersion": 0})
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-sc-schemamin", config=payload, config_schema_version=0)
    assert "ck_scenarios_config_schema_valid" in str(exc.value)


def test_VR613_a_raw_insert_whose_config_is_not_an_object_violates(migrated_db: str) -> None:
    """ck_scenarios_config_is_object — a JSON array/scalar is not an intent document."""
    seed_grant(migrated_db, "u-sc-obj")
    engine = sa.create_engine(migrated_db)
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-sc-obj", config=json.dumps([1, 2, 3]))
    assert "ck_scenarios_config_is_object" in str(exc.value)


# VR-614 — name/note well-formedness at the DB layer -----------------------------------------------


@pytest.mark.parametrize("name", ["", "   ", "A" * 121], ids=["empty", "whitespace", "over-120"])
def test_VR614_a_raw_insert_with_a_blank_or_over_cap_name_violates(
    migrated_db: str, name: str
) -> None:
    """ck_scenarios_name_not_blank — `length(btrim(name)) > 0 AND length(name) <= 120`. A required,
    trimmed, capped name (Q6, DECIDED 2026-07-19)."""
    seed_grant(migrated_db, "u-sc-name")
    engine = sa.create_engine(migrated_db)
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-sc-name", name=name)
    assert "ck_scenarios_name_not_blank" in str(exc.value)


@pytest.mark.parametrize("note", ["", "   ", "A" * 501], ids=["empty", "whitespace", "over-500"])
def test_VR614_a_raw_insert_with_a_blank_or_over_cap_note_violates(
    migrated_db: str, note: str
) -> None:
    """ck_scenarios_note_valid — `note IS NULL OR (length(btrim(note)) > 0 AND length(note) <=
    500)`. A blank note is unrepresentable as '' (it must be NULL); the cap is 500 (Q6)."""
    seed_grant(migrated_db, "u-sc-note")
    engine = sa.create_engine(migrated_db)
    with pytest.raises(DatabaseError) as exc:
        _raw_insert(engine, "u-sc-note", note=note)
    assert "ck_scenarios_note_valid" in str(exc.value)


def test_VR614_a_raw_insert_with_a_valid_note_stores_it(migrated_db: str) -> None:
    """Positive control for the note CHECK: a well-formed note within the cap inserts cleanly."""
    seed_grant(migrated_db, "u-sc-note-ok")
    engine = sa.create_engine(migrated_db)
    _raw_insert(engine, "u-sc-note-ok", note="Estratégia de fim de ano")
    with engine.connect() as conn:
        stored = conn.execute(
            sa.text("SELECT note FROM scenarios WHERE owner_uid = :u"), {"u": "u-sc-note-ok"}
        ).scalar_one()
    assert stored == "Estratégia de fim de ano"


# ══ Section B — API surface (RED until T007: no router ⇒ 404, not the asserted status) ═══════════


# VR-601 — the entitlement gate --------------------------------------------------------------------


def test_VR601_a_free_caller_is_denied_on_save_and_NOTHING_is_written(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _free(monkeypatch, "u-sc-free")
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body())
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
    assert _scenario_count(migrated_db, "u-sc-free") == 0


def test_VR601_a_locally_faked_premium_caller_is_denied_server_side(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """ADR-0015 honesty: a client that fakes the premium UI has NO server grant, so the server gate
    denies the write regardless — recompute is client-side but persistence is server-gated."""
    h = _free(monkeypatch, "u-sc-fake")
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body())
    assert r.status_code == 403, r.text
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
    assert _scenario_count(migrated_db, "u-sc-fake") == 0


def test_VR601_a_signed_out_caller_is_denied_before_any_entitlement_check(
    db_client: TestClient,
) -> None:
    assert db_client.post("/api/v1/scenarios", json=_body()).status_code == 401


def test_VR601_a_free_caller_reads_NOTHING_on_list_and_detail(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """A free/faked caller reads nothing on ANY endpoint (contract §Denials) — list and detail are
    denied, not served empty."""
    h = _free(monkeypatch, "u-sc-free-read")
    assert db_client.get("/api/v1/scenarios", headers=h).status_code == 403
    guessed = "0192f0aa-0000-7000-8000-000000000abc"
    assert db_client.get(f"/api/v1/scenarios/{guessed}", headers=h).status_code == 403


# VR-602/603 — config validation (a float leaf ⇒ 422; STRUCTURAL, not shape-pinning) --------------


def _float_in_feeoverride(c: dict[str, Any]) -> None:
    c["channels"][0]["feeOverrides"]["commissionPct"] = 12.5  # a JSON float, not "12.5"


def _float_in_lastknown(c: dict[str, Any]) -> None:
    c["costBasis"]["lastKnown"]["printGrams"] = 100.0


def _float_in_othercosts(c: dict[str, Any]) -> None:
    c["otherCosts"][0]["value"] = 2.5


@pytest.mark.parametrize(
    "mutate",
    [
        pytest.param(_float_in_feeoverride, id="float-in-feeOverride"),
        pytest.param(_float_in_lastknown, id="float-in-lastKnown"),
        pytest.param(_float_in_othercosts, id="float-in-otherCosts"),
    ],
)
def test_VR602_a_JSON_float_ANYWHERE_in_config_is_422_and_nothing_written(
    db_client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    migrated_db: str,
    mutate: Callable[[dict[str, Any]], None],
) -> None:
    """VR-602 — money/qty/percent leaves are decimal STRINGS. A JSON float buried at any depth (a
    list→dict→list→dict recursion, the E4 I1 defect) is rejected 422 BEFORE it can be stored — and
    the recursion is exactly why `config` must be validated as a RAW dict, not by a per-leaf typed
    pydantic model (which would silently coerce 12.5 → Decimal and defeat the guard)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-float")
    config = json.loads(json.dumps(VALID_CONFIG))  # a deep, independent copy
    mutate(config)
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert _scenario_count(migrated_db, "u-sc-float") == 0


@pytest.mark.parametrize("bad", ["NaN", "Infinity", "-Infinity"])
def test_VR602_a_non_finite_money_string_in_config_is_422(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str, bad: str
) -> None:
    """`Decimal("NaN")`/`Decimal("Infinity")` are valid Python — the validator must assert
    `is_finite()` (the in-JSON twin of `<> 'NaN'::numeric`, which a DB CHECK cannot reach inside
    JSONB)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-nan")
    config = json.loads(json.dumps(VALID_CONFIG))
    config["otherCosts"][0]["value"] = bad
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert r.status_code == 422, r.text
    assert _scenario_count(migrated_db, "u-sc-nan") == 0


def test_VR602_the_config_ceiling_is_CEIL_CONFIG_LEAF_not_CEIL_MONEY(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Q-04 — the two ceilings are DELIBERATELY different, and this test is what says so.

    `history.py` walks a frozen document whose leaves land in MONEY_SETTLED Numeric(12,2) columns
    (CEIL_MONEY = 10**10). `scenarios.py` walks pure JSONB INTENT with no per-leaf NUMERIC domain,
    so it applies the single widest house bound (CEIL_CONFIG_LEAF = 10**12). Before this feature
    that divergence lived under a comment claiming the two walkers "mirror verbatim" — false, and
    maintenance guided by it would have propagated the wrong ceiling. Now each caller passes its
    own `money_ceiling` and the gap between them is asserted, not folklore."""
    assert CEIL_CONFIG_LEAF > CEIL_MONEY

    h = _premium(monkeypatch, migrated_db, "u-sc-ceilparity")
    # Over CEIL_MONEY, under CEIL_CONFIG_LEAF: a 422 in history, ACCEPTED here.
    below = json.loads(json.dumps(VALID_CONFIG))
    below["otherCosts"][0]["value"] = str(CEIL_MONEY)
    ok = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=below))
    assert ok.status_code == 201, ok.text

    # At CEIL_CONFIG_LEAF: rejected — the scenario ceiling is higher, not absent.
    over = json.loads(json.dumps(VALID_CONFIG))
    over["otherCosts"][0]["value"] = str(CEIL_CONFIG_LEAF)
    bad = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Teto", config=over))
    assert bad.status_code == 422, bad.text
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"
    assert _scenario_count(migrated_db, "u-sc-ceilparity") == 1  # only the accepted one


def test_VR603_config_validation_is_STRUCTURAL_not_shape_pinning(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-603 / the E4 §9.6 lesson: validate the FLAT envelope + generic decimal-string leaves; do
    NOT mirror `PriceInput`/`BomResult` field-by-field. A config carrying a leaf a future
    pricing-core adds (here `someFutureRatePct`, a valid decimal string) must still SAVE — otherwise
    a pricing-core bump makes the backend reject its own configs."""
    h = _premium(monkeypatch, migrated_db, "u-sc-struct")
    config = json.loads(json.dumps(VALID_CONFIG))
    config["costBasis"]["lastKnown"]["someFutureRatePct"] = "1.500"  # unknown-but-well-formed leaf
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert r.status_code == 201, r.text


def test_VR602_an_oversized_config_is_an_honest_422_never_truncated(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The 256 KB size cap (data-model §7 item 5, DECIDED 2026-07-19) — an over-cap document is an
    HONEST 422, never a silent truncation. The huge leaf is a NON-numeric string so it is the SIZE
    guard under test, not VR-602's magnitude ceiling."""
    h = _premium(monkeypatch, migrated_db, "u-sc-huge")
    config = json.loads(json.dumps(VALID_CONFIG))
    config["costBasis"]["ref"] = {"id": "x", "name": "A" * (300 * 1024)}
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert r.status_code == 422, r.text
    assert _scenario_count(migrated_db, "u-sc-huge") == 0


# VR-607 — a save materializes nothing -------------------------------------------------------------


def test_VR607_a_save_creates_no_catalog_rows(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-607 — the explicit contrast with an E3 kit-save (which materializes a product). A scenario
    REFERENCES the catalog, it never mutates it: filaments/printers/products/boms/bom_lines counts
    are byte-identical before and after."""
    h = _premium(monkeypatch, migrated_db, "u-sc-mat")
    before = _catalog_counts(migrated_db, "u-sc-mat")

    created = db_client.post("/api/v1/scenarios", headers=h, json=_body())
    assert created.status_code == 201, created.text

    after = _catalog_counts(migrated_db, "u-sc-mat")
    assert after == before, f"a scenario save materialized catalog rows: {before} -> {after}"
    assert _scenario_count(migrated_db, "u-sc-mat") == 1  # only the scenario itself was created


# VR-609 — isolation (no existence oracle) ---------------------------------------------------------


def test_VR609_account_B_cannot_read_As_scenario_and_a_guessed_id_is_indistinguishable(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-609 — the repository always injects `owner_uid = :current_uid`. B reading A's scenario, or
    a guessed id, both return 404 — indistinguishable from non-existent (no existence oracle)."""
    ha = _premium(monkeypatch, migrated_db, "u-sc-owner")
    created = db_client.post("/api/v1/scenarios", headers=ha, json=_body())
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]

    hb = _premium(monkeypatch, migrated_db, "u-sc-other")
    real_but_not_yours = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=hb)
    guessed = db_client.get("/api/v1/scenarios/0192f0aa-0000-7000-8000-000000000abc", headers=hb)
    assert real_but_not_yours.status_code == 404
    assert guessed.status_code == 404  # the same answer — B learns nothing about A's ids


# VR-611 — no resolved price on the RESPONSE ------------------------------------------------------


def test_VR611_the_read_response_carries_no_resolved_price_field(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-611 — the list/detail response echoes the seller's INTENT (name/note/config/timestamps)
    and NO resolved price: no top-level `price`/`headlineTotal`/`precoVarejo`/`total`. The scenario
    recomputes client-side; the backend never recomputes (ADR-0008/ADR-0015)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-noprice")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body())
    assert created.status_code == 201, created.text
    out = created.json()

    forbidden = {"price", "headlineTotal", "precoVarejo", "precoAtacado", "total", "custoTotal"}
    assert forbidden.isdisjoint(out.keys()), f"a resolved price leaked onto the row: {out.keys()}"

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h).json()
    assert forbidden.isdisjoint(fetched.keys())


# VR-614 — name/note well-formedness at the API ---------------------------------------------------


@pytest.mark.parametrize("blank", ["", "   "], ids=["empty", "whitespace"])
def test_VR614_a_blank_name_is_a_422_never_a_500(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str, blank: str
) -> None:
    """A blank/whitespace name violates `ck_scenarios_name_not_blank` at the DB → a 500. Caught
    app-side as a 422: the name is required (Q6)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-blankname")
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(name=blank))
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert _scenario_count(migrated_db, "u-sc-blankname") == 0


def test_VR614_an_over_cap_name_is_a_422(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-sc-longname")
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="A" * 121))
    assert r.status_code == 422, r.text
    assert _scenario_count(migrated_db, "u-sc-longname") == 0


def test_VR614_a_blank_note_is_stored_as_NULL_unrepresentable_as_empty_string(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """A blank note is NULL, never '' (data-model §2: unrepresentable as an empty string). The
    save succeeds; the stored/echoed note is null."""
    h = _premium(monkeypatch, migrated_db, "u-sc-blanknote")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(note="   "))
    assert created.status_code == 201, created.text
    assert created.json()["note"] is None


# ══ T011 — the on-save `lastKnown` re-snapshot (D6 groundwork, ADR-0017 §6 `_snapshot_line`) ═════


def _mk_refs(client: TestClient, h: dict[str, str]) -> tuple[str, str]:
    fid = client.post(
        "/api/v1/filaments",
        headers=h,
        json={
            "name": "PLA Azul",
            "material": "PLA",
            "costPerRoll": "110.00",
            "rollWeightKg": "1.000",
            "defaultWasteGrams": "5.000",
        },
    ).json()["id"]
    pid = client.post(
        "/api/v1/printers",
        headers=h,
        json={
            "name": "Ender 3",
            "machineValue": "1200.00",
            "machineLifetimeHours": "2000.000",
            "avgPowerKw": "0.1200",
            "maintenanceReservePerHour": "0.500000",
        },
    ).json()["id"]
    return fid, pid


def _mk_product(client: TestClient, h: dict[str, str], fid: str, pid: str, name: str) -> str:
    """A real, live catalog product through the public (FR-310) create path — `printGrams` here
    (100.000) is the LIVE value a re-snapshot must produce, distinct from the STALE value the test
    below sends as the client's `lastKnown`."""
    body = {
        "name": name,
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": {
            "printGrams": "100.000",
            "wasteGrams": "0.000",
            "printTimeHours": "5.000",
            "failurePct": "0.000",
            "finishTimeHours": "0.000",
            "finishRatePerHour": "0.000000",
            "laborHours": "0.000",
            "laborRatePerHour": "0.000000",
            "markupVarejoPct": "50.000",
            "markupAtacadoPct": "30.000",
        },
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    r = client.post("/api/v1/products", headers=h, json=body)
    assert r.status_code == 201, r.text
    return str(r.json()["id"])


def _config_with_product_basis(product_id: str, product_name: str) -> dict[str, Any]:
    """A config whose `costBasis` references a live Product — `lastKnown` is deliberately STALE
    (printGrams 999.000, unlike the live product's 100.000) so a save-time re-snapshot is the
    ONLY way the stored value could ever become 100.000."""
    config = json.loads(json.dumps(VALID_CONFIG))
    stale = _piece_input()
    stale["printGrams"] = "999.000"
    config["costBasis"] = {
        "kind": "PRODUCT",
        "ref": {"id": product_id, "name": product_name},
        "lastKnown": stale,
    }
    return config


def test_T011_save_with_live_ref_resnapshots_lastKnown(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """A save whose `costBasis.ref` resolves to an OWNED, LIVE Product re-snapshots `lastKnown`
    from the LIVE row — the stored value reflects TODAY's product (100.000), not the possibly-
    stale client-sent `lastKnown` (999.000). This is the D6-lossless groundwork (T022 reads this
    snapshot when the product is later deleted)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-resnap")
    fid, pid = _mk_refs(db_client, h)
    product_id = _mk_product(db_client, h, fid, pid, "Vaso G")

    config = _config_with_product_basis(product_id, "Vaso G")
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert r.status_code == 201, r.text
    stored = r.json()["config"]["costBasis"]["lastKnown"]
    assert stored["printGrams"] == "100.000", stored  # the LIVE value, not the stale 999.000

    fetched = db_client.get(f"/api/v1/scenarios/{r.json()['id']}", headers=h).json()
    assert fetched["config"]["costBasis"]["lastKnown"]["printGrams"] == "100.000"


def test_T011_save_with_a_ref_that_does_not_resolve_keeps_the_client_sent_lastKnown(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """Q13 accept-and-degrade: a `costBasis.ref` that does NOT resolve (never-existed here) is NOT
    an error — the scenario saves with the client-sent `lastKnown` UNCHANGED (there is nothing
    live to re-snapshot from)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-noresnap")
    guessed = "0192f0aa-0000-7000-8000-000000000abc"

    config = _config_with_product_basis(guessed, "Peça sumida")
    r = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert r.status_code == 201, r.text
    stored = r.json()["config"]["costBasis"]["lastKnown"]
    assert stored["printGrams"] == "999.000", stored  # the client-sent value, kept as-is


# ══ PR-B — US3 the LIVE contract (T021, FAILING-first): the read-time D3/D6 resolver (T022) ══════
#
# Scope note (dated 2026-07-20, backend wave): the brief for T021/T022 names "referenced product"
# for both VR-605 and VR-606 explicitly; KIT-basis read-time resolution rides the same seam but is
# deliberately left to T024 (Q12 kit-basis channel composition, a separate task) since it needs the
# `boms.py` multi-line resolve machinery that task was scoped to touch. Flagging so the parent can
# redirect if PRODUCT-only was not the intended cut.
#
# VR-604 here is deliberately re-scoped to what the BACKEND can honestly assert: per
# `contracts/api-surface.md`, `channels`/`otherCosts`/`includeMarketplace` are echoed back
# VERBATIM — the server never resolves or touches a fee (that is `fee-prefill.ts`, entirely
# client-side, already shipped in T014). So the backend-testable half of VR-604 is that the
# `feeOverrides` partial-map — an explicit override PRESENT, a non-overridden slot's key ABSENT —
# round-trips byte-identical through save + reopen, proving the backend never silently populates or
# strips a fee leaf (the precondition the client's live re-resolution depends on).


def _update_product(
    client: TestClient,
    h: dict[str, str],
    product_id: str,
    fid: str,
    pid: str,
    *,
    print_grams: str,
    name: str = "Vaso G",
) -> None:
    body = {
        "name": name,
        "filamentId": fid,
        "printerId": pid,
        "pieceInputs": {
            "printGrams": print_grams,
            "wasteGrams": "0.000",
            "printTimeHours": "5.000",
            "failurePct": "0.000",
            "finishTimeHours": "0.000",
            "finishRatePerHour": "0.000000",
            "laborHours": "0.000",
            "laborRatePerHour": "0.000000",
            "markupVarejoPct": "50.000",
            "markupAtacadoPct": "30.000",
        },
        "tariffPerKwh": "1.000000",
        "includeMarketplace": True,
        "channels": [],
        "otherCosts": [],
    }
    r = client.put(f"/api/v1/products/{product_id}", headers=h, json=body)
    assert r.status_code == 200, r.text


def test_VR605_reopen_reflects_a_LIVE_edit_to_the_referenced_product(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D3 live-reflect — a scenario whose `costBasis.ref` still resolves owned+live reads the
    CURRENT product row on every GET, not the (possibly-stale) snapshot from the last save."""
    h = _premium(monkeypatch, migrated_db, "u-sc-d3")
    fid, pid = _mk_refs(db_client, h)
    product_id = _mk_product(db_client, h, fid, pid, "Vaso G")

    config = _config_with_product_basis(product_id, "Vaso G")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]
    # After the save-time re-snapshot (T011) the stored lastKnown is already 100.000 (the LIVE
    # value at save time) — now edit the product AFTER the save so only a read-time resolve (not
    # the stored snapshot) can produce the new value on reopen.
    _update_product(db_client, h, product_id, fid, pid, print_grams="250.000")

    fetched = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=h)
    assert fetched.status_code == 200, fetched.text
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is False
    assert resolved["lastKnown"]["printGrams"] == "250.000", resolved


def test_VR606_a_soft_deleted_referenced_product_degrades_honestly_no_break(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D6 last-known — a `costBasis.ref` that no longer resolves (soft-deleted here) degrades to
    the LAST-SAVED snapshot, `degraded: true`, never a blank/500/"removido" claim."""
    h = _premium(monkeypatch, migrated_db, "u-sc-d6")
    fid, pid = _mk_refs(db_client, h)
    product_id = _mk_product(db_client, h, fid, pid, "Vaso G")

    config = _config_with_product_basis(product_id, "Vaso G")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]

    delete_resp = db_client.delete(f"/api/v1/products/{product_id}", headers=h)
    assert delete_resp.status_code == 204

    fetched = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=h)
    assert fetched.status_code == 200, fetched.text  # ZERO breaks — never a 500
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is True
    # The snapshot captured at save time (the LIVE value then, 100.000) — never blank.
    assert resolved["lastKnown"]["printGrams"] == "100.000", resolved
    assert resolved["ref"] == {"id": product_id, "name": "Vaso G"}  # the ref is kept, not erased


def test_VR606_a_cross_tenant_referenced_product_degrades_honestly(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D6 — a `costBasis.ref` pointing at ANOTHER account's (live) product must not resolve: the
    owner-scoping is the same as every other read in this file (VR-609's twin, at the basis)."""
    ha = _premium(monkeypatch, migrated_db, "u-sc-d6-owner-a")
    fid, pid = _mk_refs(db_client, ha)
    others_product_id = _mk_product(db_client, ha, fid, pid, "Peça da Conta A")

    hb = _premium(monkeypatch, migrated_db, "u-sc-d6-owner-b")
    config = _config_with_product_basis(others_product_id, "Peça da Conta A")
    created = db_client.post("/api/v1/scenarios", headers=hb, json=_body(config=config))
    assert created.status_code == 201, created.text
    # T011 accept-and-degrade: the ref did not resolve (not B's product) at save time, so B's
    # client-sent lastKnown (the stale 999.000 fixture value) was kept as-is.

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=hb)
    assert fetched.status_code == 200, fetched.text
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is True
    assert resolved["lastKnown"]["printGrams"] == "999.000", resolved


def test_VR606_a_never_existed_referenced_product_degrades_honestly(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D6 — a `costBasis.ref` id that never existed at all degrades the SAME honest way (no
    existence oracle at the basis either)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-d6-never")
    guessed = "0192f0aa-0000-7000-8000-000000000abc"
    config = _config_with_product_basis(guessed, "Peça sumida")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    assert fetched.status_code == 200, fetched.text
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is True
    assert resolved["lastKnown"]["printGrams"] == "999.000"


def test_VR605_an_AD_HOC_basis_never_degrades_and_echoes_lastKnown_verbatim(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """An AD_HOC basis has no ref to resolve — it is always `degraded: false`, `ref: null`, and
    `lastKnown` is the seller's own authoritative input, echoed unchanged (data-model §1)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-adhoc-resolve")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body())
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved == {
        "kind": "AD_HOC",
        "ref": None,
        "degraded": False,
        "lastKnown": _piece_input(),
    }


# ══ Redirect (2026-07-20): a KIT `costBasis.ref` IS in T022 scope (api-surface.md lines 99-102 +
# 137-139 — `{kind: "PRODUCT"|"KIT", ref, degraded, lastKnown}` names both kinds identically). The
# CLIENT half (Q12 channelSet -> computeBom rollup) stays T024; this is the SERVER read-time
# resolve/degrade for a KIT ref, reusing `boms.py`'s `_resolve_views`/`_lines_of` seam verbatim. ══


def _mk_kit_with_ad_hoc_line(
    client: TestClient, h: dict[str, str], *, piece_name: str, print_grams: str, kit_name: str
) -> tuple[str, str, str]:
    """A real, live kit (POST /api/v1/boms) with ONE ad-hoc line that MATERIALIZES a product
    (ADR-0017) — returns (bomId, materialized productId, the line's live piece name)."""
    body = {
        "name": kit_name,
        "lines": [
            {
                "quantity": 2,
                "pieceName": piece_name,
                "pieceInputs": {
                    "printGrams": print_grams,
                    "wasteGrams": "0.000",
                    "printTimeHours": "5.000",
                    "failurePct": "0.000",
                    "finishTimeHours": "0.000",
                    "finishRatePerHour": "0.000000",
                    "laborHours": "0.000",
                    "laborRatePerHour": "0.000000",
                    "markupVarejoPct": "50.000",
                    "markupAtacadoPct": "30.000",
                },
                "filamentValues": {
                    "material": "PLA",
                    "costPerRoll": "110.00",
                    "rollWeightKg": "1.000",
                },
                "printerValues": {
                    "machineValue": "1200.00",
                    "machineLifetimeHours": "2000.000",
                    "avgPowerKw": "0.1200",
                    "maintenanceReservePerHour": "0.500000",
                },
                "tariffPerKwh": "1.000000",
                "includeMarketplace": True,
                "channels": [],
                "otherCosts": [],
            }
        ],
    }
    r = client.post("/api/v1/boms", headers=h, json=body)
    assert r.status_code == 201, r.text
    kit = r.json()
    return kit["id"], kit["materializations"][0]["productId"], kit["lines"][0]["pieceName"]


def _config_with_kit_basis(bom_id: str, kit_name: str) -> dict[str, Any]:
    """A config whose `costBasis` references a live Kit — `lastKnown` is deliberately a STALE
    single-line placeholder (distinct from the live kit's line) so only a read-time resolve (D3)
    or the stored value (D6) could ever appear on reopen — never a coincidence."""
    config = json.loads(json.dumps(VALID_CONFIG))
    config["costBasis"] = {
        "kind": "KIT",
        "ref": {"id": bom_id, "name": kit_name},
        "lastKnown": {"lines": [{"name": "stale", "quantity": 9, "input": _piece_input()}]},
    }
    return config


def test_KIT_D3_reopen_reflects_a_LIVE_edit_to_the_referenced_kits_line(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D3 live-reflect for a KIT basis: a scenario whose `costBasis.ref` still resolves owned+live
    reads the kit's CURRENT line values (via the materialized product) on every GET — mirroring
    `boms.py::_resolve_views`, never a stored/stale snapshot."""
    h = _premium(monkeypatch, migrated_db, "u-sc-kit-d3")
    bom_id, product_id, piece_name = _mk_kit_with_ad_hoc_line(
        db_client, h, piece_name="Perna", print_grams="100.000", kit_name="Kit Suporte"
    )

    config = _config_with_kit_basis(bom_id, "Kit Suporte")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]

    # Edit the kit's underlying (materialized) product AFTER the save — only a read-time resolve
    # can reflect this on reopen, never the client-sent stale `lastKnown`.
    fid, pid = _mk_refs(db_client, h)
    _update_product(db_client, h, product_id, fid, pid, print_grams="777.000", name=piece_name)

    fetched = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=h)
    assert fetched.status_code == 200, fetched.text
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is False
    live_input = resolved["lastKnown"]["lines"][0]["input"]
    assert resolved["lastKnown"] == {
        "lines": [{"name": piece_name, "quantity": 2, "input": live_input}]
    }
    assert live_input["printGrams"] == "777.000"


def test_KIT_D6_a_soft_deleted_referenced_kit_degrades_honestly_no_break(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D6 last-known for a KIT basis: a `costBasis.ref` that no longer resolves (the kit itself
    soft-deleted) degrades to the STORED `lastKnown`, `degraded: true`, never a blank/500/"removido"
    claim — the exact F1 honesty-class guard (never present stale as live)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-kit-d6")
    bom_id, _product_id, _piece_name = _mk_kit_with_ad_hoc_line(
        db_client, h, piece_name="Braço", print_grams="50.000", kit_name="Kit Braço"
    )

    config = _config_with_kit_basis(bom_id, "Kit Braço")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text
    scenario_id = created.json()["id"]

    delete_resp = db_client.delete(f"/api/v1/boms/{bom_id}", headers=h)
    assert delete_resp.status_code == 204

    fetched = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=h)
    assert fetched.status_code == 200, fetched.text  # ZERO breaks — never a 500
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is True
    # The STORED snapshot (the stale placeholder sent at save — never re-snapshotted server-side
    # for KIT, T024's client half is what does that) — never blank, never fabricated as live.
    assert resolved["lastKnown"] == {
        "lines": [{"name": "stale", "quantity": 9, "input": _piece_input()}]
    }
    assert resolved["ref"] == {"id": bom_id, "name": "Kit Braço"}  # the ref is kept, not erased

    # Still editable + re-saveable — a PUT with the degraded basis unchanged succeeds (US6).
    resave = db_client.put(
        f"/api/v1/scenarios/{scenario_id}",
        headers=h,
        json=_body(config=config),
    )
    assert resave.status_code == 200, resave.text


def test_KIT_D6_a_never_existed_referenced_kit_degrades_honestly(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """D6 — a KIT `costBasis.ref` id that never existed degrades the SAME honest way (no existence
    oracle at the basis, for a KIT ref exactly as for a PRODUCT ref)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-kit-d6-never")
    guessed = "0192f0aa-0000-7000-8000-000000000abc"
    config = _config_with_kit_basis(guessed, "Kit sumido")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    assert fetched.status_code == 200, fetched.text
    resolved = fetched.json()["config"]["costBasis"]
    assert resolved["degraded"] is True
    assert resolved["lastKnown"] == {
        "lines": [{"name": "stale", "quantity": 9, "input": _piece_input()}]
    }


# ══ Redirect (2026-07-20, T030 e2e finding): `costBasis.lastKnown` MUST be the FLAT `PriceInput`
# contract shape (api-surface.md lines 69-79, data-model §3) — the exact `CalcFieldName` set
# `apps/web/src/features/calculator/calculator-schema.ts::CALC_FIELD_NAMES` lists (READ, not
# inferred) and `applyScenarioConfig` looks up by name. The PREVIOUS `_price_input_dict` emitted
# `BomLine`'s OWN internal prefixed column names (`filamentCostPerRoll`, `printerMachineValue`, …)
# — an implementation detail that leaked onto the wire and silently broke every reopen (6+ keys
# never matched `CalcFieldName`, defaults silently applied instead). These two tests assert the
# keys LITERALLY (copied from the contract/CALC_FIELD_NAMES, never derived from `_price_input_dict`
# or `_piece_input()`) so they cannot share either helper's own mistake.
_CONTRACT_PRICE_INPUT_KEYS = {
    "costPerRoll",
    "rollWeightKg",
    "printGrams",
    "wasteGrams",
    "printTimeHours",
    "avgPowerKw",
    "tariffPerKwh",
    "machineValue",
    "machineLifetimeHours",
    "maintenanceReservePerHour",
    "failurePct",
    "finishTimeHours",
    "finishRatePerHour",
    "laborHours",
    "laborRatePerHour",
    "markupVarejoPct",
    "markupAtacadoPct",
}


def test_lastKnown_PRODUCT_shape_is_the_FLAT_PriceInput_contract_not_bom_line_columns(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """`pricing-core`'s `PriceInput` (and `CALC_FIELD_NAMES`) has NO material-name leaf either —
    one must never be invented (`filamentMaterial` is exactly the kind of leak this guards)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-shape-product")
    fid, pid = _mk_refs(db_client, h)
    product_id = _mk_product(db_client, h, fid, pid, "Vaso Shape")

    config = _config_with_product_basis(product_id, "Vaso Shape")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    last_known = fetched.json()["config"]["costBasis"]["lastKnown"]
    assert set(last_known.keys()) == _CONTRACT_PRICE_INPUT_KEYS, last_known.keys()


def test_lastKnown_KIT_line_input_shape_is_the_FLAT_PriceInput_contract(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The KIT `lines[].input` twin — api-surface.md line 74: 'mirror the resolved shape the E3
    read path already produces' means the WIRE `PriceInput` shape, not `BomLine`'s own columns."""
    h = _premium(monkeypatch, migrated_db, "u-sc-shape-kit")
    bom_id, _product_id, _piece_name = _mk_kit_with_ad_hoc_line(
        db_client, h, piece_name="Shape", print_grams="10.000", kit_name="Kit Shape"
    )
    config = _config_with_kit_basis(bom_id, "Kit Shape")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    input_dict = fetched.json()["config"]["costBasis"]["lastKnown"]["lines"][0]["input"]
    assert set(input_dict.keys()) == _CONTRACT_PRICE_INPUT_KEYS, input_dict.keys()


def test_VR604_channel_feeOverrides_round_trip_verbatim_the_backend_never_touches_fees(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The backend-testable half of VR-604 (see the module-level scope note above): channels are
    stored + echoed as INTENT — an explicit override PRESENT, a non-overridden leaf (here
    `minPerItem`/`freightCost`) ABSENT — survive save + a later GET byte-identical. The live
    re-resolution of the absent leaves against today's fee catalog is `fee-prefill.ts` (client-side,
    T014); the backend's job is only to never silently add or drop a fee leaf."""
    h = _premium(monkeypatch, migrated_db, "u-sc-vr604")
    config = json.loads(json.dumps(VALID_CONFIG))
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    channels = fetched.json()["config"]["channels"]
    assert channels == config["channels"]
    assert set(channels[0]["feeOverrides"].keys()) == {"commissionPct", "fixedFee"}
    assert "minPerItem" not in channels[0]["feeOverrides"]
    assert "freightCost" not in channels[0]["feeOverrides"]


# ══ PR-B — US4 duplicate-to-tweak (T025, FAILING-first): VR-608 duplicate independence ═══════════


def test_VR608_duplicate_creates_an_independent_copy_with_its_own_name(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """`POST /{id}/duplicate` deep-copies `config` into a NEW row — new id, own name (contract:
    `"Cópia de {name}"`)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-dup-1")
    original = db_client.post(
        "/api/v1/scenarios", headers=h, json=_body(name="Cenário ML Clássico")
    )
    assert original.status_code == 201, original.text
    original_id = original.json()["id"]

    dup = db_client.post(f"/api/v1/scenarios/{original_id}/duplicate", headers=h)
    assert dup.status_code == 201, dup.text
    copy = dup.json()
    assert copy["id"] != original_id
    assert copy["name"] == "Cópia de Cenário ML Clássico"
    assert copy["config"] == original.json()["config"]

    assert len(db_client.get("/api/v1/scenarios", headers=h).json()["items"]) == 2


def test_VR608_editing_the_copy_changes_ZERO_percent_of_the_original_and_vice_versa(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The headline value: a clone is a genuinely new object. Proven byte-level via SEPARATE
    fetches after mutating each side (PATCH the copy's name; PUT the original's config)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-dup-2")
    original = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Base")).json()
    dup = db_client.post(f"/api/v1/scenarios/{original['id']}/duplicate", headers=h).json()

    # Mutate the COPY's name — the original must be untouched.
    renamed_copy = db_client.patch(
        f"/api/v1/scenarios/{dup['id']}", headers=h, json={"name": "Copy Tweaked"}
    )
    assert renamed_copy.status_code == 200, renamed_copy.text

    # Mutate the ORIGINAL's config (a full PUT with a different otherCosts) — the copy must be
    # untouched.
    other_config = json.loads(json.dumps(VALID_CONFIG))
    other_config["otherCosts"] = [{"name": "Frete extra", "value": "9.99"}]
    updated_original = db_client.put(
        f"/api/v1/scenarios/{original['id']}",
        headers=h,
        json=_body(name="Base", config=other_config),
    )
    assert updated_original.status_code == 200, updated_original.text

    refetched_original = db_client.get(f"/api/v1/scenarios/{original['id']}", headers=h).json()
    refetched_copy = db_client.get(f"/api/v1/scenarios/{dup['id']}", headers=h).json()

    assert refetched_original["name"] == "Base"  # untouched by the copy's rename
    assert refetched_original["config"]["otherCosts"] == [{"name": "Frete extra", "value": "9.99"}]
    assert refetched_copy["name"] == "Copy Tweaked"  # untouched by the original's config edit
    assert refetched_copy["config"]["otherCosts"] == VALID_CONFIG["otherCosts"]  # the OLD value


def test_VR608_duplicate_materializes_nothing(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-sc-dup-mat")
    before = _catalog_counts(migrated_db, "u-sc-dup-mat")
    original = db_client.post("/api/v1/scenarios", headers=h, json=_body()).json()
    dup = db_client.post(f"/api/v1/scenarios/{original['id']}/duplicate", headers=h)
    assert dup.status_code == 201, dup.text
    after = _catalog_counts(migrated_db, "u-sc-dup-mat")
    assert after == before


def test_duplicate_is_isolated_and_entitlement_gated(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-609's twin on duplicate: another owner's id → 404 (no existence oracle); a free/lapsed
    caller is denied `ENTITLEMENT_REQUIRED` (duplicate is a WRITE)."""
    ha = _premium(monkeypatch, migrated_db, "u-sc-dup-owner-a")
    original_id = db_client.post("/api/v1/scenarios", headers=ha, json=_body()).json()["id"]

    hb = _premium(monkeypatch, migrated_db, "u-sc-dup-owner-b")
    dup_resp = db_client.post(f"/api/v1/scenarios/{original_id}/duplicate", headers=hb)
    assert dup_resp.status_code == 404

    h_free = _free(monkeypatch, "u-sc-dup-free")
    r = db_client.post(f"/api/v1/scenarios/{original_id}/duplicate", headers=h_free)
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"


# ══ PR-B — US6 manage + lapse (T027, FAILING-first) ═══════════════════════════════════════════


def test_PUT_full_config_replace_re_runs_structural_validation_VR602_603(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """`PUT` is the full-config-edit path — VR-602/603 MUST re-run on UPDATE (a JSON float leaf is
    422, and nothing is stored)."""
    h = _premium(monkeypatch, migrated_db, "u-sc-put-validate")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body()).json()

    bad_config = json.loads(json.dumps(VALID_CONFIG))
    bad_config["otherCosts"][0]["value"] = 2.5  # a JSON float — VR-602
    r = db_client.put(
        f"/api/v1/scenarios/{created['id']}", headers=h, json=_body(config=bad_config)
    )
    assert r.status_code == 422, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"

    unchanged = db_client.get(f"/api/v1/scenarios/{created['id']}", headers=h).json()
    assert unchanged["config"]["otherCosts"] == VALID_CONFIG["otherCosts"]


def test_PUT_replaces_the_whole_config_and_can_rename(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-sc-put-ok")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Original")).json()

    new_config = json.loads(json.dumps(VALID_CONFIG))
    new_config["includeMarketplace"] = False
    r = db_client.put(
        f"/api/v1/scenarios/{created['id']}",
        headers=h,
        json=_body(name="Renomeado no PUT", note="nova nota", config=new_config),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Renomeado no PUT"
    assert body["note"] == "nova nota"
    assert body["config"]["includeMarketplace"] is False


def test_PATCH_renames_name_and_note_only(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-sc-patch-ok")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Antigo")).json()

    r = db_client.patch(
        f"/api/v1/scenarios/{created['id']}",
        headers=h,
        json={"name": "Novo Nome", "note": "uma nota"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["name"] == "Novo Nome"
    assert body["note"] == "uma nota"
    assert body["config"] == created["config"]  # PATCH never touches config


def test_PATCH_with_a_smuggled_config_field_is_422_extra_forbid(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-sc-patch-smuggle")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body()).json()

    r = db_client.patch(
        f"/api/v1/scenarios/{created['id']}",
        headers=h,
        json={"name": "Tentativa", "config": {"schemaVersion": 2}},
    )
    assert r.status_code == 422, r.text

    unchanged = db_client.get(f"/api/v1/scenarios/{created['id']}", headers=h).json()
    assert unchanged["name"] == created["name"]  # nothing applied — not even the honest field


def test_DELETE_soft_deletes_and_the_scenario_stops_appearing(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    h = _premium(monkeypatch, migrated_db, "u-sc-delete")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body()).json()

    r = db_client.delete(f"/api/v1/scenarios/{created['id']}", headers=h)
    assert r.status_code == 204

    assert db_client.get(f"/api/v1/scenarios/{created['id']}", headers=h).status_code == 404
    assert db_client.get("/api/v1/scenarios", headers=h).json()["items"] == []


def test_q_name_search_is_owner_scoped_case_insensitive_substring(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """`?q=` — owner-scoped, case-insensitive substring `name ILIKE`. If T007 already shipped this
    (PR-A), this test DOCUMENTS the behavior rather than duplicating the implementation."""
    h = _premium(monkeypatch, migrated_db, "u-sc-search")
    db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Cenário Mercado Livre"))
    db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Cenário Shopee"))

    hits = db_client.get("/api/v1/scenarios", headers=h, params={"q": "mercado"}).json()["items"]
    assert [s["name"] for s in hits] == ["Cenário Mercado Livre"]

    other = _premium(monkeypatch, migrated_db, "u-sc-search-other")
    db_client.post("/api/v1/scenarios", headers=other, json=_body(name="Cenário Mercado Pago"))
    # `_premium` monkeypatches the SAME global verify function — restore identity A before
    # querying as A again (the bearer token's literal value is ignored by the test stub).
    _premium(monkeypatch, migrated_db, "u-sc-search")
    hits_a_only = db_client.get("/api/v1/scenarios", headers=h, params={"q": "mercado"}).json()[
        "items"
    ]
    assert [s["name"] for s in hits_a_only] == ["Cenário Mercado Livre"]  # never account B's


def _revoke_scenario_grant(db_url: str, uid: str) -> None:
    import sqlalchemy as sa_

    engine = sa_.create_engine(db_url)
    with engine.begin() as conn:
        conn.execute(
            sa_.text(
                "UPDATE entitlement_grants SET revoked_at = now(), revoked_by = 'op'"
                " WHERE account_uid = :uid"
            ),
            {"uid": uid},
        )
    engine.dispose()


def test_VR610_lapse_reads_everything_writes_nothing_deletes_nothing(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """VR-610 — a lapsed premium keeps READING (list, get, resolved basis) `200`; ALL writes
    (save/PUT/PATCH/duplicate/delete) `403`; ZERO rows deleted or modified."""
    uid = "u-sc-lapse"
    h = _premium(monkeypatch, migrated_db, uid)
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Vivo")).json()
    scenario_id = created["id"]

    _revoke_scenario_grant(migrated_db, uid)

    # Reads keep working, including the resolved cost basis.
    listed = db_client.get("/api/v1/scenarios", headers=h)
    assert listed.status_code == 200
    assert [s["id"] for s in listed.json()["items"]] == [scenario_id]
    got = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=h)
    assert got.status_code == 200
    assert got.json()["config"]["costBasis"]["degraded"] is False

    # Every write denies honestly.
    for resp in (
        db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Nova")),
        db_client.put(f"/api/v1/scenarios/{scenario_id}", headers=h, json=_body(name="Vivo")),
        db_client.patch(f"/api/v1/scenarios/{scenario_id}", headers=h, json={"name": "X"}),
        db_client.post(f"/api/v1/scenarios/{scenario_id}/duplicate", headers=h),
        db_client.delete(f"/api/v1/scenarios/{scenario_id}", headers=h),
    ):
        assert resp.status_code == 403, resp.text
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"

    # ZERO rows deleted/modified.
    assert _scenario_count(migrated_db, uid) == 1
    still = db_client.get(f"/api/v1/scenarios/{scenario_id}", headers=h).json()
    assert still["name"] == "Vivo"


def test_VR610_a_re_grant_restores_writes_with_data_intact(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    uid = "u-sc-regrant"
    h = _premium(monkeypatch, migrated_db, uid)
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(name="Vivo")).json()
    scenario_id = created["id"]

    _revoke_scenario_grant(migrated_db, uid)
    assert db_client.delete(f"/api/v1/scenarios/{scenario_id}", headers=h).status_code == 403

    seed_grant(migrated_db, uid)  # a NEW grant row (the ledger is append-only — ADR-0012)

    renamed = db_client.patch(
        f"/api/v1/scenarios/{scenario_id}", headers=h, json={"name": "De volta"}
    )
    assert renamed.status_code == 200, renamed.text
    assert renamed.json()["name"] == "De volta"


# --- E5-04 (013 audit remediation, T053) -----------------------------------------------------
# `_price_input_dict_from_bom_line` (scenarios.py:308-336) is the ONE-LINE-DEGRADED branch of
# `_resolve_kit_last_known` — a kit that ITSELF still resolves (owned + live), but whose line-level
# `product_id` now points at a soft-deleted product. It was never exercised via the scenarios API:
# every existing KIT fixture used exactly ONE ad-hoc line, so the branch at scenarios.py:399-408
# (the `else` of `resolved is not None`) had zero live coverage. This mutates the BomLine's OWN
# last-known columns into the flat contract shape — if its field mapping breaks (wrong column, wrong
# default, wrong key name), this test is the one that goes red.


def _mk_kit_with_two_ad_hoc_lines(
    client: TestClient, h: dict[str, str], *, kit_name: str
) -> tuple[str, str, str]:
    """A live kit (POST /api/v1/boms) with TWO ad-hoc lines, each materializing its own product
    (ADR-0017) — returns (bomId, productId of line 0, productId of line 1)."""
    body = {
        "name": kit_name,
        "lines": [
            {
                "quantity": 1,
                "pieceName": "Linha viva",
                "pieceInputs": {
                    "printGrams": "100.000",
                    "wasteGrams": "0.000",
                    "printTimeHours": "5.000",
                    "failurePct": "0.000",
                    "finishTimeHours": "0.000",
                    "finishRatePerHour": "0.000000",
                    "laborHours": "0.000",
                    "laborRatePerHour": "0.000000",
                    "markupVarejoPct": "50.000",
                    "markupAtacadoPct": "30.000",
                },
                "filamentValues": {
                    "material": "PLA",
                    "costPerRoll": "110.00",
                    "rollWeightKg": "1.000",
                },
                "printerValues": {
                    "machineValue": "1200.00",
                    "machineLifetimeHours": "2000.000",
                    "avgPowerKw": "0.1200",
                    "maintenanceReservePerHour": "0.500000",
                },
                "tariffPerKwh": "1.000000",
                "includeMarketplace": True,
                "channels": [],
                "otherCosts": [],
            },
            {
                "quantity": 3,
                "pieceName": "Linha a apagar",
                "pieceInputs": {
                    "printGrams": "250.000",
                    "wasteGrams": "5.000",
                    "printTimeHours": "8.000",
                    "failurePct": "2.000",
                    "finishTimeHours": "1.000",
                    "finishRatePerHour": "10.000000",
                    "laborHours": "0.500",
                    "laborRatePerHour": "20.000000",
                    "markupVarejoPct": "60.000",
                    "markupAtacadoPct": "40.000",
                },
                "filamentValues": {
                    "material": "PETG",
                    "costPerRoll": "150.00",
                    "rollWeightKg": "1.000",
                },
                "printerValues": {
                    "machineValue": "2000.00",
                    "machineLifetimeHours": "3000.000",
                    "avgPowerKw": "0.2000",
                    "maintenanceReservePerHour": "1.000000",
                },
                "tariffPerKwh": "1.200000",
                "includeMarketplace": True,
                "channels": [],
                "otherCosts": [],
            },
        ],
    }
    r = client.post("/api/v1/boms", headers=h, json=body)
    assert r.status_code == 201, r.text
    kit = r.json()
    return (
        kit["id"],
        kit["materializations"][0]["productId"],
        kit["materializations"][1]["productId"],
    )


def test_E5_04_a_kit_scenario_with_one_line_soft_deleted_degrades_only_that_line(
    db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
) -> None:
    """The KIT itself still resolves (owned + live), so the scenario is NOT globally degraded
    (`costBasis.degraded` stays False) — but the ONE line whose product was soft-deleted must
    surface via `_price_input_dict_from_bom_line`: an honest empty name (mirrors
    `boms.py::BomLineOut.piece_name=None`) and the line's OWN stored last-known columns, never a
    500 and never silently dropped from the `lines` array. The sibling (still-live) line keeps
    resolving via the normal `_price_input_dict`/live-product path."""
    h = _premium(monkeypatch, migrated_db, "u-sc-e504-kit-line")
    bom_id, live_product_id, dead_product_id = _mk_kit_with_two_ad_hoc_lines(
        db_client, h, kit_name="Kit Duas Linhas"
    )

    delete_resp = db_client.delete(f"/api/v1/products/{dead_product_id}", headers=h)
    assert delete_resp.status_code == 204, delete_resp.text

    config = _config_with_kit_basis(bom_id, "Kit Duas Linhas")
    created = db_client.post("/api/v1/scenarios", headers=h, json=_body(config=config))
    assert created.status_code == 201, created.text

    fetched = db_client.get(f"/api/v1/scenarios/{created.json()['id']}", headers=h)
    assert fetched.status_code == 200, fetched.text  # ZERO breaks — never a 500
    resolved = fetched.json()["config"]["costBasis"]

    # The KIT reference itself still resolves — this is NOT the whole-basis D6 degradation.
    assert resolved["degraded"] is False, resolved

    lines = resolved["lastKnown"]["lines"]
    assert len(lines) == 2, lines

    live_line = next(line for line in lines if line["quantity"] == 1)
    assert live_line["name"] == "Linha viva"
    assert live_line["input"]["printGrams"] == "100.000"

    dead_line = next(line for line in lines if line["quantity"] == 3)
    # The honest empty name (D6 one level down) — never fabricated, never the pre-delete name.
    assert dead_line["name"] == ""
    # The BomLine's OWN last-known columns, in the FLAT contract shape — proves
    # `_price_input_dict_from_bom_line`'s field mapping (not `_price_input_dict`'s Product path).
    assert set(dead_line["input"].keys()) == _CONTRACT_PRICE_INPUT_KEYS, dead_line["input"].keys()
    assert dead_line["input"]["printGrams"] == "250.000"
    assert dead_line["input"]["wasteGrams"] == "5.000"
    assert dead_line["input"]["costPerRoll"] == "150.00"
    assert dead_line["input"]["failurePct"] == "2.000"
    assert dead_line["input"]["machineValue"] == "2000.00"
    _ = live_product_id  # unused beyond materialization-shape proof above
