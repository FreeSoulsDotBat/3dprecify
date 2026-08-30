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
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models import Snapshot

# map(headline_basis) -> the key of the matching total inside the frozen `totals` (Option A: FLAT).
# 019/PR-E: `PRECO_ORCAMENTO` (ADR-0034 §2). Espelho de `api.history._BASIS_TOTAL_KEY` — a
# igualdade dos dois conjuntos (e das duas CHAVES) é guardada em `test_history_basis_mirror.py`.
_BASIS_TOTAL = {
    "PRECO_VAREJO": "precoVarejo",
    "PRECO_ATACADO": "precoAtacado",
    "PRECO_ORCAMENTO": "precoOrcamento",
}

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
)
# `admin` is deliberately ABSENT. `pricing-core` (index.ts:77/93) defines it as "Σ otherCosts ===
# admin" — it IS their sum, not a line beside them, so printing both counts the same money twice and
# shows the customer an inflated cost. The app's own detail screen omits it for this reason; the
# quote must agree with the screen the seller read before sending it.

# What a single piece is called on the quote when the snapshot has NO captured origin (an ad-hoc
# calculator snapshot — `provenance: null`). Mirrors the app's own `kindSingle` wording: it names
# the ITEM, where the frontend's `adhocFallback` ("Cálculo avulso") names the RECORD — a customer
# is not buying a calculation.
_ADHOC_ITEM = "Peça única"

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
    # The seller's own label, printed as "Referência" (owner decision, 2026-07-16). It is FREE TEXT
    # and reaches the customer, so it is shown for what it is — a reference the seller wrote — and
    # never asserted to be the buyer's name. Absent when unlabelled: never an empty "Referência:".
    reference: str | None
    quoted_at: datetime.datetime
    utc_offset_minutes: int
    validity_days: int | None
    basis: str
    lines: list[QuoteLineView]
    total: str
    # EMPTY unless the seller explicitly opted in — the default a customer receives leaks no cost.
    cost_breakdown: list[CostLineView]
    # 019/PR-E — o bloco bruto -> desconto do orçamento, e ele é OPCIONAL de propósito: chave
    # ausente é LINHA ausente (FR-507). Um "Desconto R$ 0,00" impresso sugeriria ao cliente
    # uma negociação que não houve. Ambos vêm do documento; nada aqui é calculado.
    gross_total: str | None = None
    discount_label: str | None = None
    discount_amount: str | None = None


def _basis_key(basis: str) -> str:
    """A chave do total do documento para este `headline_basis` — SEM fallback.

    O fallback silencioso para `precoVarejo` que morava aqui era uma bomba-relógio: o dia em
    que um `basis` novo chegasse (e chegou — `PRECO_ORCAMENTO`), o PDF imprimiria, para o
    CLIENTE, o total de varejo no lugar do total do orçamento — o número ANTES do desconto que
    o vendedor concedeu. Um `basis` desconhecido é impossível pela rota (o `Literal`) e pelo
    banco (o `CHECK`); se acontecer mesmo assim, o certo é NÃO imprimir nada.
    """
    try:
        return _BASIS_TOTAL[basis]
    except KeyError as exc:
        raise ValueError(f"unknown headline_basis {basis!r} — refusing to guess a total") from exc


def _str_or_empty(value: Any) -> str:
    """A leaf money value is a decimal STRING or absent — never coerced from a number here."""
    return value if isinstance(value, str) else ""


def _int_or_zero(value: Any) -> int:
    """A stored count, printed as stored. NOT `int(value or 1)`: `0` is falsy in Python, and a
    zero-quantity kit line is a real decision the seller made (Q1 — "não entra neste pedido"), and
    that idiom silently promotes it to 1 on the CUSTOMER's quote."""
    return value if isinstance(value, int) and not isinstance(value, bool) else 0


def _xml(value: str) -> str:
    """Escape text before it enters a Platypus `Paragraph`.

    A Paragraph parses its content as intra-paragraph markup — this file relies on that itself to
    bold the total. So free text interpolated into one is PARSED, not printed, and `label` is free
    text with no character constraint. Measured against the real parser:

    * `<` is the hazard. An unknown tag is SWALLOWED — `Vaso <grande>` prints as `Vaso`, the text
      gone from the customer's quote with nothing to notice. A known one is worse: `Cliente <b>Joao`
      raises ValueError → HTTP 500, no artifact, forever, for that snapshot.
    * `&` is safe on its own. `R&D`, `M&M`, `A & B` all print verbatim unescaped — only the ENTITY
      form bites: `Tom &amp; Jerry` renders as `Tom & Jerry`, silently eating what was typed.

    ADR-0020 §1 promises the renderer PRINTS what is stored. This is what makes that literally true.
    """
    return escape(value)


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


def _channel_surcharge_lines(channels: Any) -> list[CostLineView]:
    """016/PR-F (T069, US16, ADR-0027 §3.2) — the named surcharge lines a seller declared on a
    channel (e.g. the Shopee "Manuseio de item volumoso", R$ 50/pedido).

    `FrozenChannel` (the result side) stays PRICE-ONLY by decision I3: the {label, value} pair
    the engine echoes on `ChannelResult.surcharges` is never re-frozen there — it already travels,
    verbatim, inside `inputs.channels[].surcharges`, frozen by the existing generic `freezeInput`
    with NO schema change. This reads it back from exactly that one place.

    A surcharge is a COST, so it follows the SAME opt-in rule as material/energy/machine (SC-506) —
    the caller gates this behind `include_cost_breakdown`, not this function. Absent/malformed
    entries print nothing: a label with no value, or a value with no label, is not a line (FR-507's
    rule — an absent key is an absent line, never a fabrication)."""
    lines: list[CostLineView] = []
    for slot in _seq(channels):
        for item in _seq(_obj(slot).get("surcharges")):
            item_obj = _obj(item)
            label = item_obj.get("label")
            value = item_obj.get("value")
            if isinstance(label, str) and label and isinstance(value, str):
                lines.append(CostLineView(label=label, value=value))
    return lines


# Os rótulos que o cliente lê, VERBATIM da prancheta 18d (i18n `quote.subtotal`,
# `quote.discountLine`, `quote.discountAmountLine`): o PDF é servidor e não tem i18n, então a
# cópia mora aqui — e não pode divergir da tela que o vendedor leu antes de enviar.
_DISCOUNT_PCT_LABEL = "Desconto {value}%"
_DISCOUNT_AMOUNT_LABEL = "Desconto"


def _discount_block(payload: dict[str, Any]) -> tuple[str | None, str | None, str | None]:
    """(bruto, rótulo, abatimento) do desconto DECLARADO — ou três `None` se não houve desconto.

    Tudo lido, nada derivado: `grossTotal` e `amount` são strings congeladas, e o rótulo só
    reescreve
    o `value` que o documento guardou. Um bloco incompleto (sem bruto ou sem abatimento) não vira
    meia linha: some inteiro, pela mesma regra de FR-507 que rege o detalhamento de custos.
    """
    discount = _obj(payload.get("discount"))
    gross = _str_or_empty(discount.get("grossTotal"))
    amount = _str_or_empty(discount.get("amount"))
    if not gross or not amount:
        return None, None, None
    value = _str_or_empty(discount.get("value"))
    label = (
        _DISCOUNT_PCT_LABEL.format(value=value)
        if discount.get("mode") == "PCT" and value
        else _DISCOUNT_AMOUNT_LABEL
    )
    return gross, label, amount


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

    gross_total: str | None = None
    discount_label: str | None = None
    discount_amount: str | None = None

    if snapshot.kind == "QUOTE":
        # 019/PR-E (ADR-0034 §2) — o orçamento montado. A linha traz o seu PRÓPRIO total
        # (`subtotal` = unitário vezes a quantidade, já arredondado pelo motor), e não um
        # `totals[basis]` por linha como o kit: um orçamento não tem varejo/atacado por peça,
        # tem o preço que o vendedor está cobrando. Ler a forma do kit devolveria string
        # vazia e o cliente veria o nome com a célula de preço em BRANCO.
        lines = [
            QuoteLineView(
                name=str(_obj(line).get("name") or _ADHOC_ITEM),
                quantity=_int_or_zero(_obj(line).get("quantity")),
                total=_str_or_empty(_obj(line).get("subtotal")),
            )
            for line in _seq(payload.get("lines"))
        ]
        gross_total, discount_label, discount_amount = _discount_block(payload)
    elif snapshot.kind == "KIT":
        lines = [
            QuoteLineView(
                # A piece with no captured name is legitimate (an ad-hoc line); it gets the same
                # neutral the SINGLE branch uses below, never a blank cell with a price beside it.
                name=str(_obj(line).get("name") or _ADHOC_ITEM),
                quantity=_int_or_zero(_obj(line).get("quantity")),
                total=_str_or_empty(_obj(_obj(line).get("totals")).get(key)),
            )
            for line in _seq(payload.get("lines"))
        ]
    else:
        # A customer-facing quote names the ITEM, never the buyer. The label is the seller's own
        # reference and prints as "Referência" — reusing it here would title the line after the
        # CUSTOMER ("Item: Cliente João") and duplicate the reference line. An ad-hoc calculator
        # snapshot genuinely has NO product name (`provenance: null` — the common case per T019),
        # so it falls back to the app's existing neutral for a single piece rather than a lie.
        name = _obj(payload.get("provenance")).get("name") or _ADHOC_ITEM
        lines = [QuoteLineView(name=str(name), quantity=1, total=total)]

    cost_breakdown: list[CostLineView] = []
    if include_cost_breakdown:
        if snapshot.kind == "QUOTE":
            # O piso é custo INTERNO como qualquer outro: só sai no opt-in (SC-506). É o
            # único custo que o documento do orçamento congela, e é um valor STORED.
            floor = payload.get("costFloor")
            if isinstance(floor, str):
                cost_breakdown = [CostLineView(label="Custo total", value=floor)]
        elif snapshot.kind == "KIT":
            # A kit stores its breakdown per line; at the quote level the honest aggregate is the
            # stored `custoTotal`. A single stored value, printed — no summation here.
            custo = totals.get("custoTotal")
            if isinstance(custo, str):
                cost_breakdown = [CostLineView(label="Custo total", value=custo)]
            # Each piece carries its OWN channel inputs (`line.input.channels`) — a surcharge
            # declared on one piece's channel is real money for THAT piece, so every line's
            # surcharges are read, not just the rollup's.
            for line in _seq(payload.get("lines")):
                line_channels = _obj(_obj(line).get("input")).get("channels")
                cost_breakdown += _channel_surcharge_lines(line_channels)
        else:
            cost_breakdown = _cost_lines(_obj(payload.get("breakdown")))
            cost_breakdown += _channel_surcharge_lines(_obj(payload.get("inputs")).get("channels"))

    return QuoteView(
        seller_name=seller_name,
        seller_email=seller_email,
        reference=snapshot.label,
        quoted_at=snapshot.device_quoted_at,
        utc_offset_minutes=snapshot.device_utc_offset_minutes,
        validity_days=snapshot.quote_validity_days,
        basis=basis,
        lines=lines,
        total=total,
        cost_breakdown=cost_breakdown,
        gross_total=gross_total,
        discount_label=discount_label,
        discount_amount=discount_amount,
    )


# A legenda que o CLIENTE lê ao lado do total. Quarto espelho de `headline_basis`: uma entrada
# faltando imprimiria a chave crua ("PRECO_ORCAMENTO") num documento comercial.
_BASIS_CAPTION = {
    "PRECO_VAREJO": "Preço de varejo",
    "PRECO_ATACADO": "Preço de atacado",
    "PRECO_ORCAMENTO": "Preço do orçamento",
}


def _basis_caption(basis: str) -> str:
    """A legenda do total — SEM fallback, pela mesma razão de `_basis_key`: o antigo
    `.get(basis, basis)` imprimia a CHAVE ("PRECO_ORCAMENTO") na frente do cliente no dia em que um
    `basis` novo chegasse, e um documento comercial ilegível é da mesma família de um preço
    errado."""
    try:
        return _BASIS_CAPTION[basis]
    except KeyError as exc:
        raise ValueError(f"unknown headline_basis {basis!r} — refusing to print a raw key") from exc


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

    # Every free-text value below is escaped: the label is the seller's own, and the name/e-mail
    # come from the ID-token claims ("M&M Ateliê" is an ordinary shop name).
    seller = quote.seller_name or quote.seller_email or ""
    if seller:
        story.append(Paragraph(_xml(seller), styles["Normal"]))
    if quote.seller_name and quote.seller_email:
        story.append(Paragraph(_xml(quote.seller_email), styles["Normal"]))

    if quote.reference:
        story.append(Paragraph(f"Referência: {_xml(quote.reference)}", styles["Normal"]))

    quoted = format_date_pt_br(device_local_date(quote))
    story.append(Paragraph(f"Cotado em {quoted}", styles["Normal"]))
    if quote.validity_days is not None:
        story.append(Paragraph(f"Validade: {quote.validity_days} dias", styles["Normal"]))
    story.append(Spacer(1, 8 * mm))

    item_rows: list[list[Any]] = [["Item", "Qtd.", "Total"]]
    # The name is a `Paragraph`, not a raw str, for the reason the two columns beside it exist: a
    # raw str in a Table cell does NOT wrap — it runs straight through `Qtd.` and `Total` and
    # overprints them once the name passes ~68 characters, and nothing anywhere bounds a name's
    # length (DB `Text`, no `max_length`, no `maxLength` on the form). The customer then reads a
    # quote whose quantity and price are illegible. `_xml` is what keeps the Paragraph PRINTING the
    # name instead of parsing it (same reason as the seller/label fields above).
    item_rows += [
        [
            Paragraph(_xml(line.name), styles["Normal"]),
            str(line.quantity),
            format_money_pt_br(line.total),
        ]
        for line in quote.lines
    ]
    items = Table(item_rows, hAlign="LEFT", colWidths=[95 * mm, 25 * mm, 40 * mm])
    items.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, 0), 0.6, colors.black),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                # A wrapped name makes its row taller; without this the quantity and price float
                # to the row's vertical centre and stop reading as the name's first line.
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(items)
    story.append(Spacer(1, 4 * mm))
    # 019/PR-E — bruto -> desconto -> total, e SÓ quando o documento declarou um desconto
    # (FR-1917: "o desconto é declarado, nunca embutido" — um documento que mostra só o
    # líquido esconde do cliente a conta que o vendedor fez). Todo texto do vendedor passa
    # por `_xml` num `Paragraph`, incluindo o rótulo: ele carrega `discount.value`, que é
    # conteúdo do DOCUMENTO e um `<b>` ali levantaria ValueError -> 500 sem artefato nenhum.
    if quote.gross_total is not None and quote.discount_amount is not None:
        summary = Table(
            [
                ["Subtotal", format_money_pt_br(quote.gross_total)],
                [
                    Paragraph(_xml(quote.discount_label or "Desconto"), styles["Normal"]),
                    format_money_pt_br(quote.discount_amount),
                ],
            ],
            hAlign="LEFT",
            colWidths=[120 * mm, 40 * mm],
        )
        summary.setStyle(
            TableStyle([("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP")])
        )
        story.append(summary)
        story.append(Spacer(1, 2 * mm))

    story.append(
        Paragraph(
            f"<b>Total ({_basis_caption(quote.basis)}): {format_money_pt_br(quote.total)}</b>",
            styles["Normal"],
        )
    )

    if quote.cost_breakdown:
        story.append(Spacer(1, 8 * mm))
        story.append(Paragraph("Detalhamento de custos", styles["Heading3"]))
        # Same rule as `item_rows` above, and for the same reason: an "Outros custos" label is the
        # seller's own free text (`_cost_lines`), so it is unbounded and must wrap rather than run
        # through the value column. `_xml` keeps the Paragraph printing it instead of parsing it.
        cost_rows: list[list[Any]] = [
            [Paragraph(_xml(line.label), styles["Normal"]), format_money_pt_br(line.value)]
            for line in quote.cost_breakdown
        ]
        costs = Table(cost_rows, hAlign="LEFT", colWidths=[120 * mm, 40 * mm])
        costs.setStyle(
            TableStyle([("ALIGN", (1, 0), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP")])
        )
        story.append(costs)

    doc.build(story)
    return buffer.getvalue()


def build_history_csv(snapshots: Sequence[Snapshot]) -> str:
    """The history as a data file whose rows equal the stored snapshots exactly (FR-513) — headline
    money as the STORED decimal string, no re-derivation, and `created_at` never a column.

    `deviceQuotedAt` carries the seller's OWN offset, not bare UTC. A quote made at 22:30 in Brazil
    is stored as 01:30Z the NEXT day, so emitting the instant raw makes this file say a different
    date than the card, the detail and the PDF — and the local day is then unrecoverable from the
    file. Re-anchoring the offset changes no instant and re-derives nothing: it hands back exactly
    what the row stores, including the column the model keeps for this reason.
    """
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(_CSV_FIELDS), lineterminator="\n")
    writer.writeheader()
    for snap in snapshots:
        writer.writerow(
            {
                "label": snap.label or "",
                "kind": snap.kind,
                "deviceQuotedAt": snap.device_quoted_at.astimezone(
                    datetime.timezone(datetime.timedelta(minutes=snap.device_utc_offset_minutes))
                ).isoformat(),
                "headlineBasis": snap.headline_basis,
                "headlineTotal": str(snap.headline_total),
            }
        )
    return buffer.getvalue()
