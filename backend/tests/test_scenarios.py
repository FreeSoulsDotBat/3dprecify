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
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

pytestmark = requires_db


# --- The intent document (data-model §3, config_schema_version = 1) -------------------------------
# A fully-resolved ad-hoc PriceInput as `lastKnown` — every money/rate/qty/percent leaf a decimal
# STRING; the only JSON numbers are true int counts (`schemaVersion`). This is INTENT, not a
# resolved PriceResult: `channels[].feeOverrides` carries ONLY the seller's explicit adjustments
# (an absent key re-resolves live on reopen), and none of these numbers is a stored price.


def _piece_input() -> dict[str, Any]:
    """A single resolved PriceInput (the `products`/`bom_lines` resolved shape) — strings only."""
    return {
        "printGrams": "100.000",
        "wasteGrams": "0.000",
        "printTimeHours": "5.000",
        "tariffPerKwh": "1.000000",
        "failurePct": "0.000",
        "finishTimeHours": "0.000",
        "finishRatePerHour": "0.000000",
        "laborHours": "0.000",
        "laborRatePerHour": "0.000000",
        "markupVarejoPct": "50.000",
        "markupAtacadoPct": "30.000",
        "filamentMaterial": "PLA",
        "filamentCostPerRoll": "110.00",
        "filamentRollWeightKg": "1.000",
        "printerMachineValue": "1200.00",
        "printerMachineLifetimeHours": "2000.000",
        "printerAvgPowerKw": "0.1200",
        "printerMaintenanceReservePerHour": "0.000000",
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
