"""US4 (FR-512..516, SC-506/515) — export a snapshot as a customer quote + the history CSV.

FAILING-first (T026). The renderer PRINTS stored values; it never CALCULATES (ADR-0020 §1) — so the
tests that matter here are HONESTY tests, and each one, if broken, ships a lie rather than a crash:

1. **No cost leak (SC-506, Q4/FR-512).** A customer-facing quote carries ZERO internal cost lines
   (material/energy/machine/failure/margin) unless the seller EXPLICITLY opts in. Leaking the
   seller's margin to their own client is a product-level harm — the default must hide it.
2. **A kit is itemized, still cost-free (SC-515).** Every piece (name + quantity) appears with its
   total; the internal costs stay hidden by default even so.
3. **The gate is REAL (FR-515/FR-516, Q6/Q7).** Export requires an ACTIVE entitlement; on lapse the
   request is DENIED with **no partial artifact** (403, no PDF bytes), and a free/signed-out user
   gets **nothing**. Because the SERVER renders, "no artifact unless authorised" holds by design.
4. **The data file equals the stored rows (FR-513).** CSV rows are the snapshots verbatim — no
   re-derivation, no drift — and `created_at` (unverifiable metadata) is NEVER a column.
5. **Seller identity is the token, not stored data (FR-514/Q13).** Name + e-mail come from the
   verified ID-token claims at export time; a missing name claim ⇒ e-mail only on the quote.

The content + CSV rules are pinned as DB-FREE unit tests over the pure builders (fast, exact); the
gate/wiring is pinned as endpoint tests. All are written before `app.services.quote_render` and the
`/export` routes exist — they fail now, on purpose.
"""

import csv
import datetime
import decimal
import io
import json
import uuid
from typing import Any

import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient

from app.main import create_app
from app.models import Snapshot
from app.services.quote_render import (
    build_history_csv,
    build_quote_view,
    device_local_date,
    format_date_pt_br,
    format_money_pt_br,
)
from app.settings import Settings
from tests.conftest import requires_db
from tests.helpers import patch_verify, seed_grant

# ── frozen documents (a client `freezePriceResult` / `freezeBomResult` output) ──────────────────
# Money is a decimal STRING everywhere (FR-525): a JSON number would come back a float and lose
# precision in the serializer.

SINGLE_PAYLOAD: dict[str, Any] = {
    "schemaVersion": 1,
    "kind": "SINGLE",
    "modelVersion": "3.1.0",
    "catalogVersion": None,
    "inputs": {"costPerRoll": "110", "printGrams": "100", "markupVarejoPct": "50"},
    "breakdown": {"material": "11.00", "energy": "0.60", "machine": "3.00"},
    "totals": {"custoTotal": "14.60", "precoVarejo": "21.90", "precoAtacado": "18.98"},
    "channels": [],
    "provenance": {"kind": "PRODUCT", "id": "p1", "name": "Vaso Grande"},
}

KIT_PAYLOAD: dict[str, Any] = {
    "schemaVersion": 1,
    "kind": "KIT",
    "modelVersion": "3.1.0",
    "catalogVersion": None,
    "lines": [
        {
            "name": "Vaso",
            "quantity": 2,
            "totals": {"custoTotal": "20.00", "precoVarejo": "30.00", "precoAtacado": "26.00"},
        },
        {
            "name": "Prato",
            "quantity": 1,
            "totals": {"custoTotal": "8.00", "precoVarejo": "12.00", "precoAtacado": "10.40"},
        },
    ],
    "totals": {"custoTotal": "28.00", "precoVarejo": "42.00", "precoAtacado": "36.40"},
    "channels": [],
    "provenance": {"kind": "KIT", "id": "k1", "name": "Kit Festa"},
}

_QUOTED_AT = datetime.datetime(2026, 7, 13, 19, 30, tzinfo=datetime.UTC)


def _snap(payload: dict[str, Any] = SINGLE_PAYLOAD, **over: Any) -> Snapshot:
    """An in-memory Snapshot (no session) for the DB-free content tests — money as Decimal, as the
    DB hands it back. `over` tweaks the scalar columns (basis, total, validity…)."""
    fields: dict[str, Any] = {
        "id": uuid.uuid4(),
        "owner_uid": "u1",
        "client_snapshot_id": uuid.uuid4(),
        "kind": payload["kind"],
        "label": "Cliente João",
        "quote_validity_days": 15,
        "device_quoted_at": _QUOTED_AT,
        "device_utc_offset_minutes": -180,
        "model_version": "3.1.0",
        "payload_schema_version": 1,
        "payload": payload,
        "headline_total": decimal.Decimal("21.90"),
        "headline_basis": "PRECO_VAREJO",
    }
    fields.update(over)
    return Snapshot(**fields)


# ════════════════════════════════════════════════════════════════════════════════════════════════
# Content model — the honesty rules, DB-free (the load-bearing coverage).
# ════════════════════════════════════════════════════════════════════════════════════════════════


class TestQuoteContent:
    def test_a_single_quote_hides_internal_costs_by_default(self) -> None:
        """SC-506 / Q4 — the customer sees the price, NEVER the seller's cost breakdown."""
        q = build_quote_view(
            _snap(), seller_name="Ana", seller_email="ana@x.com", include_cost_breakdown=False
        )
        assert q.cost_breakdown == []  # zero cost lines — the default a customer receives
        # ...yet the customer-facing figure IS present, verbatim from the frozen document.
        assert q.total == "21.90"
        assert len(q.lines) == 1

    def test_opting_in_reveals_the_stored_breakdown_verbatim(self) -> None:
        """The opt-in shows the breakdown lines the frozen document recorded — stored strings, not
        recomputed, and only the lines that were actually recorded (FR-507)."""
        q = build_quote_view(
            _snap(), seller_name="Ana", seller_email="ana@x.com", include_cost_breakdown=True
        )
        values = {c.value for c in q.cost_breakdown}
        assert values == {"11.00", "0.60", "3.00"}  # material/energy/machine, the recorded strings
        assert all(isinstance(c.value, str) for c in q.cost_breakdown)  # never a float

    def test_a_kit_quote_itemizes_every_piece_and_still_hides_costs(self) -> None:
        """SC-515 — every piece (name + quantity) with its total; zero cost lines even for a kit."""
        q = build_quote_view(
            _snap(KIT_PAYLOAD),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert [(line.name, line.quantity, line.total) for line in q.lines] == [
            ("Vaso", 2, "30.00"),
            ("Prato", 1, "12.00"),
        ]
        assert q.cost_breakdown == []  # SC-515: a kit hides internal costs by default too
        assert q.total == "42.00"

    def test_seller_identity_comes_from_the_token_claims(self) -> None:
        """FR-514 / Q13 — name + e-mail from the verified ID token, not stored seller data."""
        q = build_quote_view(
            _snap(), seller_name="Ana Silva", seller_email="ana@x.com", include_cost_breakdown=False
        )
        assert q.seller_name == "Ana Silva"
        assert q.seller_email == "ana@x.com"

    def test_seller_identity_falls_back_to_email_only(self) -> None:
        """Q13 accepted consequence — a password account with no `name` claim carries the e-mail
        only, never a fabricated name."""
        q = build_quote_view(
            _snap(), seller_name=None, seller_email="ana@x.com", include_cost_breakdown=False
        )
        assert q.seller_name is None
        assert q.seller_email == "ana@x.com"

    def test_the_quote_presents_the_basis_it_was_quoted_at(self) -> None:
        """The total is the STORED value for the recorded basis — an atacado quote shows the atacado
        total, never varejo (the E4 PR-A C1 honesty defect, guarded here for the export)."""
        q = build_quote_view(
            _snap(headline_total=decimal.Decimal("18.98"), headline_basis="PRECO_ATACADO"),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert q.basis == "PRECO_ATACADO"
        assert q.total == "18.98"  # the atacado total from the frozen doc, not the varejo 21.90
        assert isinstance(q.total, str)

    def test_the_quote_carries_the_device_record_date_and_validity(self) -> None:
        """Every artifact carries the DEVICE record date (the seller's claim) + the validity period
        (ADR-0020 §4). The date is the device's, verbatim — never a server clock."""
        q = build_quote_view(
            _snap(), seller_name="Ana", seller_email="ana@x.com", include_cost_breakdown=False
        )
        assert q.quoted_at == _QUOTED_AT
        assert q.utc_offset_minutes == -180
        assert q.validity_days == 15


# ════════════════════════════════════════════════════════════════════════════════════════════════
# Presentation — the artifact reaches a CUSTOMER, so locale is correctness, not polish.
# (Found by homologating the PDF: the content model was right and the document still wrong.)
# ════════════════════════════════════════════════════════════════════════════════════════════════


class TestQuotePresentation:
    def test_the_printed_date_is_the_DEVICE_day_not_the_UTC_day(self) -> None:
        """FR-528 — the date on a snapshot is the SELLER'S CLAIM. A quote given at 22:00 in Brazil
        (UTC-3) is STORED as 01:00Z the NEXT day; printing the UTC date would put the wrong DAY on
        the customer's quote. Homologation caught this: the PDF said 14/07 for a 13/07 quote."""
        q = build_quote_view(
            _snap(device_quoted_at=datetime.datetime(2026, 7, 14, 1, 0, tzinfo=datetime.UTC)),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert device_local_date(q).date() == datetime.date(2026, 7, 13)
        assert format_date_pt_br(device_local_date(q)) == "13/07/2026"

    def test_dates_print_in_pt_br(self) -> None:
        assert (
            format_date_pt_br(datetime.datetime(2026, 7, 13, tzinfo=datetime.UTC)) == "13/07/2026"
        )

    def test_the_sellers_label_rides_along_as_the_quote_reference(self) -> None:
        """Owner decision (2026-07-16): the label prints as "Referência" — shown for what it IS (a
        reference the seller wrote), never asserted to be the customer's name. It is FREE TEXT that
        reaches the customer, so it is carried verbatim and never reinterpreted."""
        q = build_quote_view(
            _snap(label="Cliente João"),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert q.reference == "Cliente João"

    def test_an_ad_hoc_quote_names_the_ITEM_never_the_buyer(self) -> None:
        """The label prints as "Referência"; it must NOT also become the line-item name. An ad-hoc
        calculator snapshot has `provenance: null` (the common case — T019), and falling back to the
        label would title the item after the CUSTOMER ("Item: Cliente João") and duplicate the
        reference. Caught by homologating the Referência line."""
        ad_hoc = dict(SINGLE_PAYLOAD)
        ad_hoc["provenance"] = None
        q = build_quote_view(
            _snap(ad_hoc, label="Cliente João"),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert q.reference == "Cliente João"
        assert q.lines[0].name != "Cliente João"  # the buyer is never the item
        assert q.lines[0].name == "Peça única"

    def test_a_quote_with_an_origin_names_the_item_by_its_captured_origin(self) -> None:
        q = build_quote_view(
            _snap(label="Cliente João"),  # SINGLE_PAYLOAD carries provenance "Vaso Grande"
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert q.lines[0].name == "Vaso Grande"

    def test_an_unlabelled_snapshot_carries_NO_reference(self) -> None:
        """Absent stays absent — an unlabelled quote must not print an empty "Referência:" line."""
        q = build_quote_view(
            _snap(label=None),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert q.reference is None

    @pytest.mark.parametrize(
        ("stored", "printed"),
        [
            ("44.10", "R$ 44,10"),  # the ordinary case — comma decimal, never a dot
            ("0.60", "R$ 0,60"),
            ("1234.56", "R$ 1.234,56"),  # thousands DOT, decimal COMMA (pt-BR)
            ("1234567.89", "R$ 1.234.567,89"),
            ("21.9", "R$ 21,90"),  # a short cents string still prints two places
            ("", ""),  # absent stays absent — never "R$ 0,00" (FR-507)
        ],
    )
    def test_money_prints_as_pt_br_currency_from_the_stored_string(
        self, stored: str, printed: str
    ) -> None:
        """A pure string/locale transform of the FROZEN digits — no arithmetic, no float (ADR-0020
        §1 holds). The customer must not receive a raw machine string like "44.10"."""
        assert format_money_pt_br(stored) == printed


# ════════════════════════════════════════════════════════════════════════════════════════════════
# CSV — the data file equals the stored rows (FR-513), DB-free.
# ════════════════════════════════════════════════════════════════════════════════════════════════


class TestHistoryCsv:
    def test_rows_equal_the_stored_snapshots_exactly(self) -> None:
        rows = list(
            csv.DictReader(
                io.StringIO(
                    build_history_csv(
                        [
                            _snap(label="Cliente A", headline_total=decimal.Decimal("21.90")),
                            _snap(
                                KIT_PAYLOAD,
                                label="Kit B",
                                headline_total=decimal.Decimal("42.00"),
                                headline_basis="PRECO_VAREJO",
                            ),
                        ]
                    )
                )
            )
        )
        assert len(rows) == 2
        assert rows[0]["label"] == "Cliente A"
        assert rows[0]["headlineTotal"] == "21.90"  # the stored string, no float round-trip
        assert rows[0]["headlineBasis"] == "PRECO_VAREJO"
        assert rows[1]["kind"] == "KIT"
        assert rows[1]["headlineTotal"] == "42.00"

    def test_created_at_is_never_a_column(self) -> None:
        """`created_at` is unverifiable row metadata — never displayed, never exported (FR-528)."""
        header = build_history_csv([_snap()]).splitlines()[0].lower()
        assert "created" not in header
        assert "createdat" not in header.replace("_", "")


# ════════════════════════════════════════════════════════════════════════════════════════════════
# Endpoints — the gate is real (FR-515/FR-516), and the wiring returns the right artifact.
# ════════════════════════════════════════════════════════════════════════════════════════════════


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
        "payload": dict(SINGLE_PAYLOAD),
    }
    body.update(over)
    return body


@pytest.fixture
def db_client(migrated_db: str) -> Any:
    app = create_app(Settings(app_env="dev"))
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client


def _premium(
    monkeypatch: pytest.MonkeyPatch,
    migrated_db: str,
    uid: str,
    *,
    name: str | None = None,
    email: str | None = None,
) -> dict[str, str]:
    seed_grant(migrated_db, uid, email=email)
    patch_verify(monkeypatch, uid, email=email, name=name)
    return {"Authorization": "Bearer x"}


@requires_db
class TestExportEndpoints:
    def test_an_active_premium_gets_a_real_pdf_quote(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        h = _premium(monkeypatch, migrated_db, "u-exp", name="Ana Silva", email="ana@x.com")
        sid = db_client.post("/api/v1/history", headers=h, json=_body(str(uuid.uuid4()))).json()[
            "id"
        ]

        resp = db_client.get(f"/api/v1/history/{sid}/quote.pdf", headers=h)

        assert resp.status_code == 200, resp.text
        assert resp.headers["content-type"].startswith("application/pdf")
        assert resp.content[:5] == b"%PDF-"  # a genuine PDF, not an empty or JSON body

    def test_include_cost_breakdown_query_param_is_accepted(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        h = _premium(monkeypatch, migrated_db, "u-exp2", name="Ana", email="ana@x.com")
        sid = db_client.post("/api/v1/history", headers=h, json=_body(str(uuid.uuid4()))).json()[
            "id"
        ]

        resp = db_client.get(
            f"/api/v1/history/{sid}/quote.pdf", headers=h, params={"includeCostBreakdown": "true"}
        )
        assert resp.status_code == 200, resp.text
        assert resp.content[:5] == b"%PDF-"

    def test_a_lapse_denies_the_export_with_NO_partial_artifact(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        """FR-515 / Q6 — the ledger stays READABLE on lapse, but export is DENIED, and the response
        carries no PDF bytes. The account recorded while active (raw insert), then lapsed."""
        uid = "u-lapsed-exp"
        seed_grant(migrated_db, uid, expires_delta_h=-1)  # an EXPIRED grant ⇒ lapsed now
        patch_verify(monkeypatch, uid, email="a@x.com", name="Ana")
        sid = str(uuid.uuid4())
        engine = sa.create_engine(migrated_db)
        with engine.begin() as conn:
            conn.execute(
                sa.text(
                    "INSERT INTO snapshots"
                    " (id, owner_uid, client_snapshot_id, kind, label, quote_validity_days,"
                    "  device_quoted_at, device_utc_offset_minutes, model_version,"
                    "  payload_schema_version, payload, headline_total, headline_basis)"
                    " VALUES (:id, :uid, :csid, 'SINGLE', 'Cliente João', 15,"
                    "  '2026-07-13T19:30:00Z', -180, '3.1.0', 1, CAST(:payload AS jsonb),"
                    "  CAST('21.90' AS numeric), 'PRECO_VAREJO')"
                ),
                {
                    "id": sid,
                    "uid": uid,
                    "csid": str(uuid.uuid4()),
                    "payload": json.dumps(SINGLE_PAYLOAD),
                },
            )
        engine.dispose()
        h = {"Authorization": "Bearer x"}

        resp = db_client.get(f"/api/v1/history/{sid}/quote.pdf", headers=h)

        assert resp.status_code == 403, resp.text
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"
        assert resp.content[:5] != b"%PDF-"  # no partial artifact — nothing renderable came back

    def test_a_free_account_gets_no_artifact(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        """FR-516 / Q7 — a never-granted (free) user meets the gate, not an export."""
        patch_verify(monkeypatch, "u-free", email="free@x.com")  # authenticated, NO grant
        resp = db_client.get(
            f"/api/v1/history/{uuid.uuid4()}/quote.pdf", headers={"Authorization": "Bearer x"}
        )
        assert resp.status_code == 403, resp.text
        assert resp.json()["error"]["code"] == "ENTITLEMENT_REQUIRED"

    def test_signed_out_is_unauthenticated(self, db_client: TestClient) -> None:
        """No bearer ⇒ 401 before any entitlement or rendering — no artifact for the signed-out."""
        resp = db_client.get(f"/api/v1/history/{uuid.uuid4()}/quote.pdf")
        assert resp.status_code == 401, resp.text

    def test_an_unknown_or_pending_snapshot_cannot_be_exported(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        """You cannot export a record the server has never seen (a pending snapshot has no row) —
        the server returns 404, never a fabricated quote."""
        h = _premium(monkeypatch, migrated_db, "u-none", email="n@x.com")
        resp = db_client.get(f"/api/v1/history/{uuid.uuid4()}/quote.pdf", headers=h)
        assert resp.status_code == 404, resp.text

    def test_the_csv_export_is_active_gated_and_returns_text_csv(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        h = _premium(monkeypatch, migrated_db, "u-csv", name="Ana", email="ana@x.com")
        post = db_client.post("/api/v1/history", headers=h, json=_body(str(uuid.uuid4())))
        post.raise_for_status()

        resp = db_client.get("/api/v1/history/export.csv", headers=h)

        assert resp.status_code == 200, resp.text
        assert resp.headers["content-type"].startswith("text/csv")
        assert "PRECO_VAREJO" in resp.text  # the stored basis, printed verbatim

    def test_the_csv_export_is_denied_to_a_free_account(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        patch_verify(monkeypatch, "u-csv-free", email="free@x.com")
        resp = db_client.get("/api/v1/history/export.csv", headers={"Authorization": "Bearer x"})
        assert resp.status_code == 403, resp.text
