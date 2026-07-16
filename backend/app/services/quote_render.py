"""US4 (ADR-0020) — render an export artifact. The renderer PRINTS stored values; it never COMPUTES.

Every figure here is read VERBATIM from the frozen snapshot document (money as decimal STRINGS) — no
arithmetic, no markup, no gross-up (ADR-0020 §1). That is what lets "backend never recomputes"
(ADR-0008) stand while the server owns the export gate: a document renderer forks nothing.

Two artifacts: a customer-facing PDF quote (ReportLab, pinned 5.0.0 — pure-Python, no native deps)
and a history CSV. The HONESTY rules live in the pure builders (`build_quote_view` /
`build_history_csv`), kept apart from the PDF bytes so they are exactly testable without rendering.
"""

from __future__ import annotations

import csv
import datetime
import io
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import Snapshot

# map(headline_basis) -> the key of the matching total inside the frozen `totals` (Option A: FLAT).
_BASIS_TOTAL = {"PRECO_VAREJO": "precoVarejo", "PRECO_ATACADO": "precoAtacado"}

# The internal cost lines a customer must NEVER see unless the seller opts in (Q4 / FR-512 /
# SC-506), in a stable print order. Only the keys actually recorded in the frozen breakdown are
# shown — an absent key is an absent line, never a fabricated zero (FR-507).
_COST_LABELS: tuple[tuple[str, str], ...] = (
    ("material", "Material"),
    ("energy", "Energia"),
    ("machine", "Máquina"),
    ("falha", "Falhas"),
    ("finishing", "Acabamento"),
    ("labor", "Mão de obra"),
    ("admin", "Custos administrativos"),
)

# The CSV columns — the stored row, verbatim. `created_at` is deliberately ABSENT: it is
# unverifiable metadata, never displayed and never exported (FR-528).
_CSV_FIELDS = ("label", "kind", "deviceQuotedAt", "headlineBasis", "headlineTotal")


@dataclass(frozen=True)
class QuoteLineView:
    """One itemized piece of the quote — a single snapshot has one, a kit one per piece (SC-515).
    `total` is the quantity-scaled, basis-selected money as a STORED string (never derived here)."""

    name: str
    quantity: int
    total: str


@dataclass(frozen=True)
class CostLineView:
    label: str
    value: str


@dataclass(frozen=True)
class QuoteView:
    """The content model of a quote — WHAT to print, per the honesty rules, before any PDF."""

    seller_name: str | None
    seller_email: str | None
    quoted_at: datetime.datetime
    utc_offset_minutes: int
    validity_days: int | None
    basis: str
    lines: list[QuoteLineView]
    total: str
    # EMPTY unless the seller explicitly opted in — the default a customer receives leaks no cost.
    cost_breakdown: list[CostLineView]


def _basis_key(basis: str) -> str:
    return _BASIS_TOTAL.get(basis, "precoVarejo")


def _str_or_empty(value: Any) -> str:
    """A leaf money value is a decimal STRING or absent — never coerced from a number here."""
    return value if isinstance(value, str) else ""


def _obj(value: Any) -> dict[str, Any]:
    """A nested JSONB object as an Any-valued dict (empty if missing) — the frozen document is
    trusted, so its shape is read, never type-inferred."""
    return cast("dict[str, Any]", value) if isinstance(value, dict) else {}


def _seq(value: Any) -> list[Any]:
    """A nested JSONB array as an Any list (empty if missing)."""
    return cast("list[Any]", value) if isinstance(value, list) else []


def _cost_lines(breakdown: dict[str, Any]) -> list[CostLineView]:
    """The recorded breakdown lines, in print order — only the keys the document actually froze."""
    lines: list[CostLineView] = []
    for key, label in _COST_LABELS:
        value = breakdown.get(key)
        if isinstance(value, str):
            lines.append(CostLineView(label=label, value=value))
    for other in _seq(breakdown.get("otherCosts")):
        value = _obj(other).get("value")
        if isinstance(value, str):
            lines.append(CostLineView(label=str(_obj(other).get("name") or "Outros"), value=value))
    return lines


def build_quote_view(
    snapshot: Snapshot,
    *,
    seller_name: str | None,
    seller_email: str | None,
    include_cost_breakdown: bool,
) -> QuoteView:
    """Select WHAT the quote prints from the frozen document. Reads stored strings for the RECORDED
    basis; itemizes a kit's pieces; and includes the internal cost breakdown ONLY on opt-in. The
    frozen payload is trusted (DB-CHECKed, immutable) — read as `Any`, never recomputed."""
    payload = _obj(snapshot.payload)
    basis = snapshot.headline_basis
    key = _basis_key(basis)
    totals = _obj(payload.get("totals"))
    total = _str_or_empty(totals.get(key))

    if snapshot.kind == "KIT":
        lines = [
            QuoteLineView(
                name=str(_obj(line).get("name") or ""),
                quantity=int(_obj(line).get("quantity") or 1),
                total=_str_or_empty(_obj(_obj(line).get("totals")).get(key)),
            )
            for line in _seq(payload.get("lines"))
        ]
    else:
        name = _obj(payload.get("provenance")).get("name") or snapshot.label
        lines = [QuoteLineView(name=str(name or ""), quantity=1, total=total)]

    cost_breakdown: list[CostLineView] = []
    if include_cost_breakdown:
        if snapshot.kind == "KIT":
            # A kit stores its breakdown per line; at the quote level the honest aggregate is the
            # stored `custoTotal`. A single stored value, printed — no summation here.
            custo = totals.get("custoTotal")
            if isinstance(custo, str):
                cost_breakdown = [CostLineView(label="Custo total", value=custo)]
        else:
            cost_breakdown = _cost_lines(_obj(payload.get("breakdown")))

    return QuoteView(
        seller_name=seller_name,
        seller_email=seller_email,
        quoted_at=snapshot.device_quoted_at,
        utc_offset_minutes=snapshot.device_utc_offset_minutes,
        validity_days=snapshot.quote_validity_days,
        basis=basis,
        lines=lines,
        total=total,
        cost_breakdown=cost_breakdown,
    )


_BASIS_CAPTION = {"PRECO_VAREJO": "Preço de varejo", "PRECO_ATACADO": "Preço de atacado"}


def format_money_pt_br(value: str) -> str:
    """A STORED decimal string as pt-BR currency: "44.10" → "R$ 44,10"; "1234.56" → "R$ 1.234,56".

    A pure STRING/locale transform — ADR-0020 §1 still holds: no arithmetic, no rounding, no
    float. The digits printed are the frozen document's own, only regrouped and re-punctuated.
    The artifact reaches a CUSTOMER, so a raw machine string ("44.10", dot-decimal) is not an
    option: the rest of the app says "R$ 44,10"; the quote must not be the one surface that
    doesn't."""
    if not value:
        return ""
    negative = value.startswith("-")
    whole, _, cents = value.lstrip("-+").partition(".")
    whole = whole or "0"
    cents = (cents + "00")[:2]
    groups: list[str] = []
    while len(whole) > 3:
        groups.insert(0, whole[-3:])
        whole = whole[:-3]
    groups.insert(0, whole)
    return f"{'-' if negative else ''}R$ {'.'.join(groups)},{cents}"


def device_local_date(quote: QuoteView) -> datetime.datetime:
    """The instant AS THE DEVICE SAW IT — the stored UTC instant shifted by the offset the device
    recorded. The date on a snapshot is the SELLER'S CLAIM (FR-528), so printing the UTC date would
    put the wrong DAY on the customer's quote whenever the two straddle midnight (a quote given at
    22:00 in Brazil is stored 01:00Z the NEXT day)."""
    return quote.quoted_at + datetime.timedelta(minutes=quote.utc_offset_minutes)


def format_date_pt_br(moment: datetime.datetime) -> str:
    """dd/mm/aaaa — the locale the quote's reader actually uses."""
    return f"{moment.day:02d}/{moment.month:02d}/{moment.year}"


def render_quote_pdf(quote: QuoteView) -> bytes:
    """Print a QuoteView to a PDF. Layout + locale formatting only — every value is already decided
    and stored as a string on the view; this function performs no arithmetic and no rounding."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        title="Orçamento",
    )
    styles = getSampleStyleSheet()
    story: list[Any] = [Paragraph("Orçamento", styles["Title"])]

    seller = quote.seller_name or quote.seller_email or ""
    if seller:
        story.append(Paragraph(seller, styles["Normal"]))
    if quote.seller_name and quote.seller_email:
        story.append(Paragraph(quote.seller_email, styles["Normal"]))

    quoted = format_date_pt_br(device_local_date(quote))
    story.append(Paragraph(f"Cotado em {quoted}", styles["Normal"]))
    if quote.validity_days is not None:
        story.append(Paragraph(f"Validade: {quote.validity_days} dias", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    item_rows = [["Item", "Qtd.", "Total"]]
    item_rows += [
        [line.name, str(line.quantity), format_money_pt_br(line.total)] for line in quote.lines
    ]
    items = Table(item_rows, hAlign="LEFT", colWidths=[95 * mm, 25 * mm, 40 * mm])
    items.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.black),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(items)
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            f"<b>Total ({_BASIS_CAPTION.get(quote.basis, quote.basis)}): "
            f"{format_money_pt_br(quote.total)}</b>",
            styles["Normal"],
        )
    )

    if quote.cost_breakdown:
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph("Detalhamento de custos", styles["Heading3"]))
        cost_rows = [[line.label, format_money_pt_br(line.value)] for line in quote.cost_breakdown]
        costs = Table(cost_rows, hAlign="LEFT", colWidths=[120 * mm, 40 * mm])
        costs.setStyle(TableStyle([("ALIGN", (1, 0), (-1, -1), "RIGHT")]))
        story.append(costs)

    doc.build(story)
    return buffer.getvalue()


def build_history_csv(snapshots: Sequence[Snapshot]) -> str:
    """The history as a data file whose rows equal the stored snapshots exactly (FR-513) — headline
    money as the STORED decimal string, no re-derivation, and `created_at` never a column."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(_CSV_FIELDS), lineterminator="\n")
    writer.writeheader()
    for snap in snapshots:
        writer.writerow(
            {
                "label": snap.label or "",
                "kind": snap.kind,
                "deviceQuotedAt": snap.device_quoted_at.isoformat(),
                "headlineBasis": snap.headline_basis,
                "headlineTotal": str(snap.headline_total),
            }
        )
    return buffer.getvalue()
