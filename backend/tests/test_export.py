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
from reportlab.pdfbase.pdfmetrics import stringWidth

from app.main import create_app
from app.models import Snapshot
from app.services.quote_render import (
    build_history_csv,
    build_quote_view,
    device_local_date,
    format_date_pt_br,
    format_money_pt_br,
    render_quote_pdf,
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

# 016/PR-F (T069, US16, ADR-0027 §3.2) — a channel slot that declared an optional surcharge (the
# Shopee "Manuseio de item volumoso", R$ 50/pedido). `FrozenChannel` (the result side) stays
# price-only by decision I3 — the {label, value} pair travels inside `inputs.channels[].surcharges`
# only, frozen VERBATIM by the existing generic `freezeInput` (no schema change). Value is an exact
# decimal STRING, unrounded (`toExactString`, not `toMoneyString`) — "50", not "50.00" — so the
# renderer must not assume two decimal places are already there.
SINGLE_PAYLOAD_WITH_SURCHARGE: dict[str, Any] = {
    **SINGLE_PAYLOAD,
    "inputs": {
        **SINGLE_PAYLOAD["inputs"],
        "channels": [
            {
                "marketplace": "SHOPEE",
                "commissionPct": "20",
                "fixedFee": "4",
                "surcharges": [{"label": "Manuseio de item volumoso", "value": "50"}],
            }
        ],
    },
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

    def test_a_declared_surcharge_prints_a_NAMED_line_only_on_opt_in(self) -> None:
        """016/PR-F (T069) — a channel surcharge the seller declared (the Shopee "Manuseio de item
        volumoso") is a cost, so it obeys the SAME opt-in rule as material/energy/machine (SC-506):
        absent from the default customer artifact, present ONLY when the seller opts in — and named
        from the frozen document's own label, never hardcoded."""
        hidden = build_quote_view(
            _snap(SINGLE_PAYLOAD_WITH_SURCHARGE),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=False,
        )
        assert hidden.cost_breakdown == []

        shown = build_quote_view(
            _snap(SINGLE_PAYLOAD_WITH_SURCHARGE),
            seller_name="Ana",
            seller_email="ana@x.com",
            include_cost_breakdown=True,
        )
        surcharge_lines = [
            c for c in shown.cost_breakdown if c.label == "Manuseio de item volumoso"
        ]
        assert len(surcharge_lines) == 1
        assert surcharge_lines[0].value == "50"  # the stored string, verbatim (unrounded)
        # ...and the ordinary breakdown lines are still there beside it — none lost, none doubled.
        assert {"11.00", "0.60", "3.00", "50"} <= {c.value for c in shown.cost_breakdown}

    def test_no_surcharges_declared_prints_NO_surcharge_line(self) -> None:
        """The regression guard: the ordinary SINGLE_PAYLOAD has no `inputs.channels` key at all —
        reading it must not fabricate a line, and the ORIGINAL three-line breakdown must survive
        byte-for-byte (the same set `test_opting_in_reveals_the_stored_breakdown_verbatim` pins)."""
        q = build_quote_view(
            _snap(), seller_name="Ana", seller_email="ana@x.com", include_cost_breakdown=True
        )
        assert {c.value for c in q.cost_breakdown} == {"11.00", "0.60", "3.00"}


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

    def test_a_label_with_quotes_commas_and_newlines_ROUND_TRIPS_exactly(self) -> None:
        """FR-513 says the rows EQUAL the stored snapshots — and for the three characters that
        break naive CSV, nothing tested it: every other case in this class uses a benign label
        ("Cliente A"), so RFC4180 conformance was an untested gift from `csv.DictWriter`.

        Worth pinning because the plausible next change breaks it silently rather than loudly:
        this ledger is unbounded (A29) and the route materializes the whole list, so a streaming
        rewrite that swaps the writer for a `",".join(...)` would corrupt the file for every seller
        who ever typed a comma — with every existing test still green.

        This is also the FR-513-preserving half of the CSV-injection decision (ADR-0020
        Consequences, 2026-07-17): the escaping that round-trips is kept and pinned; a `'` prefix,
        which would NOT round-trip, is not added.
        """
        hostile = 'Ana "A", com vírgula\ne uma quebra de linha'
        rows = list(csv.DictReader(io.StringIO(build_history_csv([_snap(label=hostile)]))))
        assert len(rows) == 1
        assert rows[0]["label"] == hostile

    def test_created_at_is_never_a_column(self) -> None:
        """`created_at` is unverifiable row metadata — never displayed, never exported (FR-528)."""
        header = build_history_csv([_snap()]).splitlines()[0].lower()
        assert "created" not in header
        assert "createdat" not in header.replace("_", "")

    def test_the_quoted_date_is_the_DEVICE_day_the_seller_saw_not_the_UTC_day(self) -> None:
        """T030 homologation defect: the CSV emitted the stored UTC instant and DROPPED the offset.

        A quote made at 22:30 in Brazil (UTC-3) is stored as 01:30Z the NEXT day. The card, the
        detail and the PDF all say 13/07 — the CSV said 14/07, and the local day was not even
        recoverable from the file. FR-513 ("the same dates") and SC-511 ("every snapshot surface
        displays its record date") both break, on the one export surface nobody had rendered.

        Emitting the offset-aware ISO string is MORE faithful to the stored row, not less: same
        instant, and the offset column the model keeps precisely for this comes back with it.
        """
        near_midnight = datetime.datetime(2026, 7, 14, 1, 30, tzinfo=datetime.UTC)
        row = next(
            csv.DictReader(
                io.StringIO(
                    build_history_csv(
                        [_snap(device_quoted_at=near_midnight, device_utc_offset_minutes=-180)]
                    )
                )
            )
        )

        quoted = datetime.datetime.fromisoformat(row["deviceQuotedAt"])
        assert quoted.strftime("%d/%m/%Y") == "13/07/2026"  # the day the seller SAW
        # The same instant — the fix re-anchors the offset, it never shifts the moment.
        assert quoted == near_midnight
        # And the offset travels, so the reader can recover the local day themselves.
        assert quoted.utcoffset() == datetime.timedelta(minutes=-180)


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


# ════════════════════════════════════════════════════════════════════════════════════════════════
# ADVERSARIAL DATA — the quote rendered from input a real seller produces and a fixture rarely does:
# markup characters in free text, `otherCosts` present, a zero quantity, a nameless kit piece.
#
# These live apart from `TestQuoteContent` because the FIXTURE is the point. Every defect below is
# invisible to benign data ("Cliente João", no otherCosts, every piece named) — the document
# renders,
# reads correctly, and is wrong only for the seller who typed "R&D" or zeroed a line.
# ════════════════════════════════════════════════════════════════════════════════════════════════


def _unescape_pdf_string(raw: bytes) -> str:
    """Decode a PDF literal string: `\\ddd` octal (that is how "ê" reaches the page), plus the
    escaped `\\(`, `\\)` and `\\\\`. Without this, "Ateliê" reads as "Ateli\\352" and an assertion
    about printed text would be asserting about the encoding instead."""
    import re

    out = bytearray()
    i = 0
    while i < len(raw):
        if raw[i] == 0x5C and i + 1 < len(raw):  # backslash
            octal = re.match(rb"[0-7]{1,3}", raw[i + 1 : i + 4])
            if octal:
                out.append(int(octal.group(), 8))
                i += 1 + len(octal.group())
            else:
                out.append(raw[i + 1])
                i += 2
            continue
        out.append(raw[i])
        i += 1
    return out.decode("latin-1")


def _pdf_text(pdf: bytes) -> str:
    """What the page ACTUALLY prints.

    ReportLab encodes its page streams ASCII85 **then** Flate, so a byte-grep for "Material" would
    pass whether or not the line is on the page — the exact reason `history-export.spec.ts` refuses
    to assert PDF content at all. Decode both layers and read the text-showing operands.

    The operands are joined with NO separator: one printed line arrives as several text runs
    (escaping `Vaso <grande>` splits it into "Vaso <", "grande", ">"), so a separator would invent
    spaces the page does not show.

    This helper is the trap it exists to catch: an extractor that silently returns "" makes every
    `assert x in text` fail loudly (visible) but every `assert x not in text` PASS (invisible) — a
    green test certifying a page it never read. The self-check at the end forbids that.
    """
    import base64
    import re
    import zlib

    out: list[str] = []
    for raw in re.findall(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        body = raw.strip(b"\r\n")
        try:
            data = zlib.decompress(base64.a85decode(body, adobe=True))
        except Exception:
            try:
                data = zlib.decompress(body)
            except zlib.error:
                continue
        for chunk in re.findall(rb"\((?:[^()\\]|\\.)*\)", data):
            out.append(_unescape_pdf_string(chunk[1:-1]))
    text = "".join(out)
    # Every quote this suite renders prints its title. Missing => the EXTRACTOR broke: fail HERE
    # rather than let a silent "" certify an assertion about the page.
    assert "Orçamento" in text, f"PDF text extraction failed: {text[:200]!r}"
    return text


class TestQuoteContentAdversarialData:
    def test_a_label_with_markup_characters_PRINTS_VERBATIM_and_never_500s(self) -> None:
        """`label` is free text with no character constraint —
        `<` and `&` are things a Brazilian seller types ("Peça <2>", "R&D", "M&M Ateliê"). It was
        interpolated raw into a Platypus `Paragraph`, which parses its content as intra-paragraph
        markup: `Vaso <grande>` printed as `Vaso` (the text SILENTLY vanished from the customer's
        quote) and `Cliente <b>Joao` raised ValueError → HTTP 500, no artifact, forever, with the
        seller unable to guess that their own label was the cause.

        ADR-0020 §1 promises the renderer PRINTS what is stored. It must print it, not parse it.
        """
        for label in ("Vaso <grande>", "R&D", "M&M Ateliê", "Cliente <b>Joao", "Promo </b> hoje"):
            quote = build_quote_view(
                _snap(label=label),
                seller_name=None,
                seller_email=None,
                include_cost_breakdown=False,
            )
            text = _pdf_text(render_quote_pdf(quote))  # must not raise
            assert label in text, f"{label!r} was mangled or dropped: {text!r}"

    def test_the_seller_identity_is_escaped_too(self) -> None:
        """`seller_name` and `seller_email` reach a Paragraph the same way `label` does, straight
        from the ID-token claims — which this renderer did not validate and must not trust.

        Both values need data carrying `<` to be worth asserting: measured against the real parser,
        a lone `&` prints verbatim unescaped, so "M&M" would pass this test either way.
        """
        quote = build_quote_view(
            _snap(label=None),
            seller_name="M&M Ateliê <3D>",  # unescaped, the unknown tag SWALLOWS the shop name
            seller_email="ana<b>@m&m.com.br",  # unescaped, the known tag RAISES → 500, no artifact
            include_cost_breakdown=False,
        )
        text = _pdf_text(render_quote_pdf(quote))
        assert "M&M Ateliê <3D>" in text
        # The e-mail is a SECOND Paragraph, so the name passing proves nothing about it.
        assert "ana<b>@m&m.com.br" in text

    def test_the_quote_never_says_canal(self) -> None:
        """019/T028 (US2) — the seller's word is "marketplace" now (owner, 2026-08-25); the frozen
        document is immutable (ADR-0019) and this renderer has ZERO vocabulary strings of its own —
        so the word can only enter through a heading someone adds later. Measured on the FULL
        artifact (opt-in breakdown, surcharge line, kit lines): what the page says, not the code."""
        import re

        for payload in (SINGLE_PAYLOAD, SINGLE_PAYLOAD_WITH_SURCHARGE, KIT_PAYLOAD):
            quote = build_quote_view(
                _snap(payload),
                seller_name="Ana",
                seller_email="ana@x.com",
                include_cost_breakdown=True,
            )
            text = _pdf_text(render_quote_pdf(quote))
            assert len(text) > 100  # a rendered quote — the negative below is not vacuous
            assert re.search(r"(?i)\bcana(l|is)\b", text) is None, text

    def test_the_breakdown_never_counts_the_same_money_twice(self) -> None:
        """`pricing-core` (index.ts:77/93): "Σ otherCosts === admin" — it IS their sum.
        The renderer printed `admin` AND every otherCosts line, so a customer allowed to see the
        breakdown read the administrative money twice and an inflated cost. The app's own detail
        screen omits `admin` for exactly this reason; the quote must agree with it."""
        payload = {
            **SINGLE_PAYLOAD,
            "breakdown": {
                **SINGLE_PAYLOAD["breakdown"],
                "admin": "8.00",  # == 5.00 + 3.00
                "otherCosts": [
                    {"name": "Aluguel", "value": "5.00"},
                    {"name": "Luz", "value": "3.00"},
                ],
            },
        }
        quote = build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=True
        )
        labels = [c.label for c in quote.cost_breakdown]
        values = [c.value for c in quote.cost_breakdown]

        assert "Aluguel" in labels and "Luz" in labels  # the itemized truth is what prints
        assert "Custos administrativos" not in labels  # their sum must NOT print beside them
        assert values.count("8.00") == 0

    def test_a_zero_quantity_line_prints_ZERO_never_one(self) -> None:
        """`quantity == 0` is a legal, deliberate state (`CHECK quantity >= 0`; owner
        decision Q1 — "não entra neste pedido"). `int(x or 1)` turns 0 into 1 in Python, so the
        customer's quote said they were buying one of something the seller had zeroed out."""
        payload = {
            **KIT_PAYLOAD,
            "lines": [
                {**KIT_PAYLOAD["lines"][0], "quantity": 0},
                KIT_PAYLOAD["lines"][1],
            ],
        }
        quote = build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=False
        )
        assert quote.lines[0].quantity == 0
        assert quote.lines[1].quantity == 1

    def test_a_nameless_kit_piece_is_NAMED_never_a_blank_cell(self) -> None:
        """A kit line may legitimately have no captured name (an ad-hoc piece). `or ""`
        printed an empty Item cell with a price beside it — the customer reads a blank line item.
        The app names it; so must the quote, with the same neutral the SINGLE branch already uses
        (a customer is not buying a "Cálculo avulso" — they are buying a piece)."""
        payload = {**KIT_PAYLOAD, "lines": [{**KIT_PAYLOAD["lines"][0], "name": None}]}
        quote = build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=False
        )
        # The literal, not the constant: `== _ADHOC_ITEM` would compare the module to itself and
        # pass whatever it said. This is customer-visible copy — pin the words (matching the SINGLE
        # ad-hoc test above, which does the same).
        assert quote.lines[0].name == "Peça única"
        assert quote.lines[0].name.strip() != ""


# ════════════════════════════════════════════════════════════════════════════════════════════════
# LAYOUT — the geometry every assertion above is blind to.
#
# Everything so far asks WHAT the quote says. These ask whether the customer can READ it, and that
# is a different question. It is the question that caught a real defect at the E4 close-out
# homologation (T034), after 253 backend tests, two homologations and a 2.13M-token review had all
# passed the export: `line.name` went into a `Table` cell as a RAW str, and a raw str in ReportLab
# does not wrap. Past ~68 characters the name crossed the *Qtd.* and *Total* columns and overprinted
# them — in the document that goes to the CUSTOMER.
#
# It survived everything because `_pdf_text` returns the operands, and the operands are perfect: the
# glyphs collide on the PAGE, not in the string. Text extraction reads a quote it cannot see.
# Hence: assert POSITIONS.
# ════════════════════════════════════════════════════════════════════════════════════════════════


def _pdf_runs(pdf: bytes) -> list[tuple[float, float, float, str]]:
    """Every text run the page draws, as `(x, y, x_end, text)` in page points.

    `_pdf_text` answers *what the page says*; this answers *where*, and no text assertion
    substitutes for it — see the block comment above.

    It has to follow the text state properly, because a wrapped `Paragraph` is ONE text object:

        BT 1 0 0 1 0 14 Tm 12 TL /F1 10 Tf (…em resina) Tj T* (epoxi &…<) Tj (premium) Tj … ET

    `T*` returns to the line start and drops by the leading, and consecutive `Tj`s do NOT carry a
    position — PDF advances the cursor by the glyphs it just drew. Reading `Tm` alone would report
    every one of those runs at the same spot and quietly measure a page that does not exist. The
    advance needs real font metrics, so the run's `x_end` is computed here and handed to the caller
    rather than re-derived (and mis-derived) at the assertion.

    The enclosing `cm` translations are tracked (with `q`/`Q` push/pop) so runs from different
    flowables share one coordinate space.
    """
    import base64
    import re
    import zlib

    # /F1 → Helvetica, /F2 → Helvetica-Bold. Read from the PDF's own font objects: hard-coding the
    # mapping would make every width silently wrong the day a style changes font.
    fonts: dict[str, str] = {}
    for obj in re.finditer(rb"<<[^<>]*?/BaseFont[^<>]*?>>", pdf, re.S):
        base = re.search(rb"/BaseFont /(\S+)", obj.group(0))
        name = re.search(rb"/Name /(\S+)", obj.group(0))
        if base and name:
            fonts[name.group(1).decode()] = base.group(1).decode()

    runs: list[tuple[float, float, float, str]] = []
    ops = re.compile(
        r"(?P<q>\bq\b)|(?P<Q>\bQ\b)"
        r"|[-\d.]+ [-\d.]+ [-\d.]+ [-\d.]+ (?P<e>[-\d.]+) (?P<f>[-\d.]+) cm"
        r"|BT(?P<body>.*?)ET",
        re.S,
    )
    inner = re.compile(
        r"1 0 0 1 (?P<mx>[-\d.]+) (?P<my>[-\d.]+) Tm"
        r"|/(?P<font>F\d+) (?P<size>[-\d.]+) Tf"
        r"|(?P<tl>[-\d.]+) TL"
        r"|(?P<dx>[-\d.]+) (?P<dy>[-\d.]+) (?P<td>TD|Td)"
        r"|(?P<star>T\*)"
        r"|\((?P<s>(?:[^()\\]|\\.)*)\) Tj"
    )
    for raw in re.findall(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        body = raw.strip(b"\r\n")
        try:
            data = zlib.decompress(base64.a85decode(body, adobe=True))
        except Exception:
            try:
                data = zlib.decompress(body)
            except zlib.error:
                continue
        stream = data.decode("latin-1")
        stack: list[tuple[float, float]] = []
        tx = ty = 0.0
        for op in ops.finditer(stream):
            if op.group("q"):
                stack.append((tx, ty))
            elif op.group("Q"):
                if stack:
                    tx, ty = stack.pop()
            elif op.group("e") is not None:
                tx += float(op.group("e"))
                ty += float(op.group("f"))
            elif op.group("body") is not None:
                x = y = line_x = leading = 0.0
                font, size = "Helvetica", 10.0
                for t in inner.finditer(op.group("body")):
                    if t.group("mx") is not None:
                        line_x = x = float(t.group("mx"))
                        y = float(t.group("my"))
                    elif t.group("font") is not None:
                        font = fonts.get(t.group("font"), "Helvetica")
                        size = float(t.group("size"))
                    elif t.group("tl") is not None:
                        leading = float(t.group("tl"))
                    elif t.group("td") is not None:
                        line_x += float(t.group("dx"))
                        y += float(t.group("dy"))
                        x = line_x
                        if t.group("td") == "TD":
                            leading = -float(t.group("dy"))
                    elif t.group("star") is not None:
                        x = line_x
                        y -= leading
                    else:
                        text = _unescape_pdf_string(t.group("s").encode("latin-1"))
                        width = stringWidth(text, font, size)
                        runs.append((tx + x, ty + y, tx + x + width, text))
                        x += width  # PDF advances by the glyphs drawn; the next Tj starts here.
    # Same trap `_pdf_text` guards: an extractor that silently returns nothing turns every
    # "does not overlap" assertion into a green test about a page it never read.
    assert runs, "PDF run extraction failed: no positioned text found"
    return runs


class TestQuoteLayout:
    # Long, but ordinary: a seller who names their pieces descriptively writes this. Carries `&`
    # and `<…>` too, so the fix cannot buy wrapping back by dropping the markup guarantee —
    # a `Paragraph` PARSES its content, which is why `_xml` has to stay on this path.
    LONG_NAME = (
        "Vaso decorativo grande com acabamento em resina epoxi & detalhe dourado <premium> 2026"
    )

    def _long_name_quote(self, *, breakdown: bool = False) -> Any:
        payload = {
            **KIT_PAYLOAD,
            "lines": [{**KIT_PAYLOAD["lines"][0], "name": self.LONG_NAME}],
        }
        return build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=breakdown
        )

    @staticmethod
    def _assert_no_overprint(runs: list[tuple[float, float, float, str]], right_cell: str) -> None:
        """Nothing drawn left of `right_cell` may reach it, ON ITS OWN BASELINE.

        Baseline-scoped on purpose: the column header is right-aligned, so it legitimately starts
        left of the value below it and would read as a collision against a whole-page filter. Only
        runs sharing a baseline can actually overprint each other.
        """
        anchor = [r for r in runs if r[3] == right_cell]
        assert len(anchor) == 1, f"expected exactly one {right_cell!r} run, got {anchor!r}"
        anchor_x, row_y = anchor[0][0], anchor[0][1]

        on_row = [r for r in runs if abs(r[1] - row_y) < 0.5 and r[0] < anchor_x]
        assert on_row, f"nothing rendered left of {right_cell!r} — the row did not render"

        for x, _y, x_end, text in on_row:
            assert x_end <= anchor_x, (
                f"{text!r} overprints {right_cell!r}: it runs from {x:.1f}pt to {x_end:.1f}pt, "
                f"but {right_cell!r} is drawn at {anchor_x:.1f}pt. "
                "A raw str in a Table cell does not wrap."
            )

    def test_a_long_item_name_never_overprints_the_quantity_or_the_price(self) -> None:
        """The defect, stated as geometry: no part of the Item cell may reach the Qtd. column.

        Measured on the real page — the name's right edge landed at 389.5pt with the quantity
        drawn at 328.6pt, so the digit sat UNDER the name. `_pdf_text` still returned both
        perfectly; only the customer could tell.
        """
        runs = _pdf_runs(render_quote_pdf(self._long_name_quote()))
        self._assert_no_overprint(runs, "2")  # the quantity
        self._assert_no_overprint(runs, "R$ 30,00")  # the price

    def test_a_long_other_costs_label_never_overprints_its_value(self) -> None:
        """The SAME defect, one table over, and the reason this class checks both: an "Outros
        custos" label is the seller's own free text (`_cost_lines`), unbounded exactly like a piece
        name, in a `Table` with the same fixed `colWidths`. Fixing only the name it was reported on
        would have left the identical bug in the breakdown — which is the surface the seller opts
        IN to show the customer.
        """
        payload = {
            **SINGLE_PAYLOAD,
            "breakdown": {
                "material": "11.00",
                "otherCosts": [
                    {
                        "name": "Embalagem presente com laço de cetim & etiqueta <personalizada> "
                        "impressa em papel couche 2026",
                        "value": "3.60",
                    }
                ],
            },
        }
        quote = build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=True
        )
        runs = _pdf_runs(render_quote_pdf(quote))
        self._assert_no_overprint(runs, "R$ 3,60")

    def test_the_long_name_WRAPS_rather_than_being_truncated_or_dropped(self) -> None:
        """The other half, and the honest one: fitting the column by LOSING characters would pass
        the geometry test above while quietly shipping a different defect — a customer reading a
        piece name that is not the piece's name. It must wrap; every character stays on the page.

        The markup is the second guard: a `Paragraph` parses its content, so `<premium>` would be
        swallowed as an unknown tag and `&` mangled if `_xml` ever left this path — the exact bug
        the PR-C review fixed on the seller/label fields, one column over.
        """
        text = _pdf_text(render_quote_pdf(self._long_name_quote()))
        for word in self.LONG_NAME.split():
            assert word in text, f"{word!r} was dropped from the wrapped name: {text!r}"
        assert "<premium>" in text, "the markup guarantee regressed — `_xml` left the name path"
        assert "&" in text

    # 016/PR-F (T069) — the E4 lesson applied to the NEW line: a surcharge label is free catalog
    # text (curated, but no length constraint enforced here), rendered in the SAME fixed-width
    # `costs` Table as `otherCosts` (colWidths=[120mm, 40mm]) — the exact geometry that overprinted
    # before. A long surcharge label must wrap, never overprint its own value.
    LONG_SURCHARGE_LABEL = (
        "Manuseio de item volumoso (embalagem fora do padrão, coleta especial) art. 3305 Shopee"
    )

    def test_a_long_surcharge_label_never_overprints_its_value(self) -> None:
        payload = {
            **SINGLE_PAYLOAD,
            "inputs": {
                **SINGLE_PAYLOAD["inputs"],
                "channels": [
                    {
                        "marketplace": "SHOPEE",
                        "commissionPct": "20",
                        "surcharges": [{"label": self.LONG_SURCHARGE_LABEL, "value": "50"}],
                    }
                ],
            },
        }
        quote = build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=True
        )
        runs = _pdf_runs(render_quote_pdf(quote))
        self._assert_no_overprint(runs, "R$ 50,00")

    def test_the_long_surcharge_label_WRAPS_rather_than_being_dropped(self) -> None:
        payload = {
            **SINGLE_PAYLOAD,
            "inputs": {
                **SINGLE_PAYLOAD["inputs"],
                "channels": [
                    {
                        "marketplace": "SHOPEE",
                        "commissionPct": "20",
                        "surcharges": [{"label": self.LONG_SURCHARGE_LABEL, "value": "50"}],
                    }
                ],
            },
        }
        quote = build_quote_view(
            _snap(payload), seller_name="Ana", seller_email=None, include_cost_breakdown=True
        )
        text = _pdf_text(render_quote_pdf(quote))
        for word in self.LONG_SURCHARGE_LABEL.split():
            assert word in text, f"{word!r} was dropped from the wrapped surcharge label: {text!r}"


# ════════════════════════════════════════════════════════════════════════════════════════════════
# ROUTE GUARANTEES — what the ENDPOINT returns, not what the content model builds.
#
# The distinction is the reason this block exists: `TestQuoteContent` pins the model, and a route
# can satisfy every one of those tests while ignoring the caller's flag, serving another account's
# row, or resurrecting a deleted one. These assert the bytes that leave the route.
# ════════════════════════════════════════════════════════════════════════════════════════════════


@requires_db
class TestRouteGuarantees:
    def test_the_endpoint_HONOURS_the_opt_in_flag_in_the_ARTIFACT_it_returns(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        """Hard-code `include_cost_breakdown=True` in export.py and nothing else notices: every
        default quote would ship the seller's costs to their customer with CI fully green.
        `TestQuoteContent` pins the content MODEL; only this asserts the bytes the ROUTE returns,
        which is where the seller's flag is actually read.
        """
        h = _premium(monkeypatch, migrated_db, "u-optin-art", name="Ana", email="ana@x.com")
        sid = db_client.post("/api/v1/history", headers=h, json=_body(str(uuid.uuid4()))).json()[
            "id"
        ]

        default = _pdf_text(db_client.get(f"/api/v1/history/{sid}/quote.pdf", headers=h).content)
        opted_in = _pdf_text(
            db_client.get(
                f"/api/v1/history/{sid}/quote.pdf",
                headers=h,
                params={"includeCostBreakdown": "true"},
            ).content
        )

        # SC-506 — the default artifact a CUSTOMER receives carries no cost line at all.
        assert "Detalhamento de custos" not in default
        assert "Material" not in default
        # ...and the price they are quoted IS there (proving the extractor read a real page).
        assert "R$ 21,90" in default
        # The opt-in is the ONLY way the costs travel.
        assert "Detalhamento de custos" in opted_in
        assert "Material" in opted_in

    def test_one_account_can_NEVER_export_another_account_row(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        """Remove `Snapshot.owner_uid == uid` from export.py and nothing above notices — any premium
        account could export ANY seller's quote by id, and pull
        the whole platform's ledger as CSV. The existing 404 test used a random uuid, which is not
        the same question: an id that exists for SOMEBODY is the one an attacker has. Nothing
        proved the promise `owned_snapshot` makes in its own docstring (FR-511/SC-509).
        """
        victim = _premium(monkeypatch, migrated_db, "u-victim", name="Vic", email="v@x.com")
        sid = db_client.post(
            "/api/v1/history", headers=victim, json=_body(str(uuid.uuid4()), label="Segredo do Vic")
        ).json()["id"]

        # A DIFFERENT premium account, asking for the victim's row by its real id.
        attacker = _premium(monkeypatch, migrated_db, "u-attacker", name="Mal", email="m@x.com")
        resp = db_client.get(f"/api/v1/history/{sid}/quote.pdf", headers=attacker)

        assert resp.status_code == 404  # indistinguishable from "does not exist" — never an oracle
        assert b"%PDF-" not in resp.content  # and NOT one byte of the victim's artifact
        # The attacker's own CSV carries their own (empty) ledger — never the victim's row.
        csv_text = db_client.get("/api/v1/history/export.csv", headers=attacker).text
        assert "Segredo do Vic" not in csv_text

    def test_a_deleted_record_never_comes_back_in_the_csv(
        self, db_client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated_db: str
    ) -> None:
        """Remove `deleted_at.is_(None)` from the CSV query and nothing above notices — records the
        seller deleted would reappear in their export. Deletion has
        to mean deletion on every surface, or the ledger is not the seller's to curate."""
        h = _premium(monkeypatch, migrated_db, "u-del-csv", name="Ana", email="ana@x.com")
        keep = db_client.post(
            "/api/v1/history", headers=h, json=_body(str(uuid.uuid4()), label="Fica")
        ).json()["id"]
        gone = db_client.post(
            "/api/v1/history", headers=h, json=_body(str(uuid.uuid4()), label="Apagado")
        ).json()["id"]
        assert db_client.delete(f"/api/v1/history/{gone}", headers=h).status_code == 204

        csv_text = db_client.get("/api/v1/history/export.csv", headers=h).text

        assert "Fica" in csv_text
        assert "Apagado" not in csv_text
        # And the deleted row is not exportable as a quote either.
        assert db_client.get(f"/api/v1/history/{gone}/quote.pdf", headers=h).status_code == 404
        assert db_client.get(f"/api/v1/history/{keep}/quote.pdf", headers=h).status_code == 200

    def test_a_kit_opt_in_actually_returns_the_kit_cost_line(self) -> None:
        """Replace the KIT branch of the opt-in with `pass` and nothing above notices: the seller
        flips the switch on a kit quote and silently gets nothing.
        The failure is conservative (it leaks nothing), but a control that does nothing without
        saying so is still a promise the app does not keep."""
        q = build_quote_view(
            _snap(KIT_PAYLOAD), seller_name="Ana", seller_email=None, include_cost_breakdown=True
        )
        # The product decision, pinned: a kit shows its stored aggregate, not a per-piece breakdown.
        assert [(c.label, c.value) for c in q.cost_breakdown] == [("Custo total", "28.00")]
