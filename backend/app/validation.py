"""The single home of the FINANCIAL validators — ceilings, leaf guards, document walkers.

Findings Q-03/Q-04 of the 013 audit: `_finite_non_negative` and the `_CEIL_*` table were copied
into FIVE routers (filaments, printers, products, history, boms-inline) and `_reject_bad_leaves`
into two. A financial rule replicated by hand is consistent "by luck, not by construction" — and it
had ALREADY diverged (E3-01: a BOM line's `tariffPerKwh` carried no ceiling at all, so an
over-ceiling value reached the NUMERIC column and surfaced as an opaque 500 instead of a 422).

This module is a LEAF: it imports nothing from `app.*`, and `import-linter` enforces that
(`backend/pyproject.toml`, contract "Financial validators are a dependency-free leaf"). That is what
keeps it importable from every router without creating a cycle — and what keeps the structural
decision verifiable in the gate instead of aspirational.

The ceilings are the INTEGER-DIGIT budget of each NUMERIC domain (precision minus scale, in lockstep
with the type domains in `models.py`). A value AT or ABOVE its ceiling overflows the column at write
time: Postgres raises `numeric field overflow` and FastAPI surfaces a 500. Every one of them is
rejected here as a clean, terminal 422 — which matters most on the history path, where the offline
outbox re-POSTs a 5xx forever (a permanent 500 is an infinite loop).

The values below are IDENTICAL to the ones that lived in `products.py` — this module changed their
residence, never their magnitude. The one genuinely new constant is `CEIL_QUANTITY` (E3-02).
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import cast

CEIL_MONEY = Decimal(10) ** 10  # MONEY_SETTLED Numeric(12,2)
CEIL_RATE = Decimal(10) ** 12  # MONEY_RATE    Numeric(18,6)
CEIL_GRAMS = Decimal(10) ** 9  # QTY_G         Numeric(12,3)
CEIL_HOURS = Decimal(10) ** 6  # QTY_H         Numeric(9,3)
CEIL_KG = Decimal(10) ** 6  # QTY_KG        Numeric(9,3)
CEIL_KW = Decimal(10) ** 5  # QTY_KW        Numeric(9,4)
CEIL_PERCENT = Decimal(10) ** 3  # PERCENT       Numeric(6,3)

#: The widest house bound, applied to a JSONB `config` leaf whose NUMERIC domain is UNKNOWN by
#: construction (a scenario stores INTENT, validated structurally — there is no per-field column to
#: read a domain from). DELIBERATELY larger than `CEIL_MONEY`: the two document walkers do NOT share
#: a ceiling, and each caller passes its own (Q-04 — the old "mirrors verbatim" comment was false).
CEIL_CONFIG_LEAF = Decimal(10) ** 12

#: The int4 limit of `bom_lines.quantity` (E3-02). A count, not money: it is an `int` ceiling and it
#: is INCLUSIVE — 2147483647 is storable, 2147483648 overflows the column.
CEIL_QUANTITY = 2_147_483_647

#: `snapshots.quote_validity_days` range (E4/019 history mirror — `history.py` + the DB CHECK on
#: `app/models/snapshot.py`, which keeps its own literal since a model never imports from an api
#: router).
MAX_QUOTE_VALIDITY_DAYS = 3650  # 10 anos

#: `snapshots.device_utc_offset_minutes` range, INCLUSIVE both ends (UTC±14h is the real-world
#: extreme — Kiribati's Line Islands). Same mirror note as `MAX_QUOTE_VALIDITY_DAYS` above.
MAX_UTC_OFFSET_MINUTES = 840  # UTC±14h

#: Object keys whose SUBTREE is money by definition. Inside them a JSON integer is never a count,
#: so it is rejected (E4-01): an int money leaf passed the float scan, froze into an immutable row,
#: and then rendered as an EMPTY cell on the customer's PDF, because the renderer prints stored
#: STRINGS and never coerces a number. Outside these keys an int is a legitimate count
#: (`schemaVersion`, `quantity`, `contributingLines`, `skippedLines`) and passes untouched.
#:
#: 019/PR-E (ADR-0034 §2) — o documento do ORÇAMENTO trouxe dinheiro FORA de `totals`/`breakdown`,
#: e ele entra aqui pelas FOLHAS, uma a uma. A marca é de SUBÁRVORE (`_walk` abaixo), e é por isso
#: que `lines` e `discount` ficam de fora **por decisão, não por esquecimento**:
#:
#: * marcar `lines` recusaria o `quantity` INTEIRO de todo KIT já gravado — uma regressão do `kind`
#:   antigo causada pelo `kind` novo;
#: * marcar `discount` marcaria `value`, que em modo `PCT` é um PERCENTUAL, não dinheiro.
_MONEY_POSITION_KEYS = frozenset(
    {
        "totals",
        "breakdown",
        "unitPrice",
        "subtotal",
        "costFloor",
        "amount",
        "grossTotal",
    }
)


def money_scale_ok(value: Decimal) -> bool:
    """`True` iff `value` has AT MOST 2 fractional digits — the `MONEY_SETTLED` `Numeric(12,2)`
    scale. `finite_non_negative` checks MAGNITUDE, never scale — a value entering that column by
    silent rounding (Postgres would round the 3rd decimal on write) is a change to a number that
    is the SELLER's own (never engine-rounded), so a caller writing one must check both.
    `value` must already be finite (call `finite_non_negative` first): a non-finite `Decimal`
    (NaN/Infinity) has no integer exponent, and this function does not itself guard against that.
    """
    exponent = value.as_tuple().exponent
    return isinstance(exponent, int) and exponent >= -2


def finite_non_negative(value: Decimal, field: str, ceiling: Decimal) -> Decimal:
    """A single money/rate/quantity field: finite, >= 0, below its column's magnitude ceiling.

    `ceiling` is REQUIRED — there is no house default. Every call site names the NUMERIC domain it
    is writing into, which is the property that made the E3-01 divergence possible to see.
    """
    if not value.is_finite() or value < 0:
        raise ValueError(f"{field} must be a finite number >= 0")
    if value >= ceiling:
        raise ValueError(f"{field} exceeds the maximum storable magnitude")
    return value


def reject_bad_leaves(node: object, *, money_ceiling: Decimal) -> None:
    """The recursive money guard over a whole opaque JSONB document (VR-501/502, VR-602).

    The document is walked GENERICALLY rather than pinned field-by-field: pinning would make a
    `pricing-core` version bump reject its own payloads — the exact property JSONB exists to avoid.
    Three rules:

    * **No JSON float, anywhere.** A float leaf means precision already died at the serializer
      boundary (a JSON number decodes to binary64 in BOTH runtimes). This is the last defence before
      it freezes. `bool` passes (a JSON true/false is never money).
    * **No JSON integer in a money POSITION** (inside `totals`/`breakdown`) — see
      `_MONEY_POSITION_KEYS`. An int elsewhere is a legal count and passes.
    * **Every string that PARSES as a Decimal must be finite and within `money_ceiling`** — rejects
      `"NaN"`/`"Infinity"` (the in-JSON twin of the `<> 'NaN'::numeric` CHECK, which cannot reach
      inside JSONB) and oversized magnitudes. A non-numeric string (a name, a label, an id) is
      ignored: generic leaf validation, no shape-pin.

    `money_ceiling` is a PARAMETER with no default, and the two callers pass different values on
    purpose: `history` passes `CEIL_MONEY` (its leaves land in Numeric(12,2) columns), `scenarios`
    passes `CEIL_CONFIG_LEAF`. `test_scenarios.py::test_VR602_the_config_ceiling_is_CEIL_CONFIG_LEAF
    _not_CEIL_MONEY` asserts that gap so it stays a decision instead of folklore.
    """
    _walk(node, money_ceiling=money_ceiling, money_position=False)


def _walk(node: object, *, money_ceiling: Decimal, money_position: bool) -> None:
    if isinstance(node, dict):
        for key, value in cast("dict[str, object]", node).items():
            _walk(
                value,
                money_ceiling=money_ceiling,
                money_position=money_position or key in _MONEY_POSITION_KEYS,
            )
    elif isinstance(node, list):
        for item in cast("list[object]", node):
            _walk(item, money_ceiling=money_ceiling, money_position=money_position)
    elif isinstance(node, bool):
        return  # a JSON true/false — never money
    elif isinstance(node, float):
        raise ValueError(
            "document contains a JSON float; every money/rate/qty/percent leaf must be a decimal"
            " STRING"
        )
    elif isinstance(node, int):
        # An int is a legal COUNT — but not where the document says the value is money (E4-01).
        if money_position:
            raise ValueError(
                "a money leaf must be a decimal STRING, not a JSON integer (it would freeze into"
                " the record and render blank on the quote)"
            )
    elif isinstance(node, str):
        try:
            parsed = Decimal(node)
        except InvalidOperation:
            return  # a non-numeric string (a name/label/id) — not a money leaf
        if not parsed.is_finite() or abs(parsed) >= money_ceiling:
            raise ValueError(
                "document contains a non-finite (NaN/Infinity) or oversized decimal string"
            )
    # None falls through unchanged.
