"""Tarefa QA 2026-09-01 — a paridade motor↔backend do desconto de orçamento.

ESPELHO (o que este arquivo pina): `app.api.history._validate_declared_discount`
(`backend/app/api/history.py`, ~linhas 134-176), a defesa PRÓPRIA do backend dentro do validador
`SnapshotIn._validate_frozen_document`. As três regras: (a) PCT recusa `value > 100` (linha ~165);
(b) AMOUNT recusa `amount > grossTotal` (linha ~170); (c) `grossTotal - amount == net_total`, a
identidade amarrada ao `headlineTotal` (linha ~172).

FONTE: `packages/pricing-core/src/quote.ts` — `resolveDiscountAmount` + `computeQuote`, exercitada
em `packages/pricing-core/tests/discount-parity.test.ts`, que lê a MESMA fixture JSON
(`contracts/discount-parity.json`). Se um lado mudar um limite e o outro não, um documento que o
app congela OFFLINE (aceito pelo motor no dispositivo) é recusado pelo servidor com 422 — e o
outbox re-POSTa esse 422 para sempre (ADR-0018 §3, ver o comentário no topo de `history.py`).

`_validate_declared_discount` é uma função PURA (não depende de sessão, banco nem framework) —
chamada direta, sem `TestClient` nem `requires_db`, no molde recomendado pela casa quando existe
uma função alcançável sem HTTP (o precedente `test_history_basis_mirror.py` já evita o request
completo quando o alvo é reachable diretamente).
"""

from __future__ import annotations

import decimal
import json
from pathlib import Path
from typing import Any

import pytest

from app.api.history import _validate_declared_discount  # pyright: ignore[reportPrivateUsage]

_FIXTURE_PATH = Path(__file__).resolve().parents[2] / "contracts" / "discount-parity.json"


def _load_cases() -> list[dict[str, Any]]:
    data = json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))
    cases = data["cases"]
    assert isinstance(cases, list) and cases, "a fixture compartilhada ficou vazia"
    return cases


CASES = _load_cases()


def test_the_shared_fixture_has_the_13_expected_cases() -> None:
    assert len(CASES) == 13


def _payload_for(caso: dict[str, Any]) -> dict[str, Any]:
    """O `payload` mínimo que `_validate_declared_discount` lê: só a chave `discount` importa —
    a função não toca em `totals`/`kind`/etc., o que é exatamente o que a torna chamável direto."""
    if caso["discount"] is None:
        return {}
    d = caso["discount"]
    return {
        "discount": {
            "mode": d["mode"],
            # `wireValue`/`wireAmount` são o documento JÁ CONGELADO (2dp) — o que de fato viaja no
            # payload; `engineValue` (o número cru digitado) é assunto só do lado TS.
            "value": d["wireValue"],
            "amount": d["wireAmount"],
            "grossTotal": caso["gross"],
        }
    }


@pytest.mark.parametrize("caso", CASES, ids=[c["id"] for c in CASES])
def test_the_backend_mirror_agrees_with_the_engine_on_every_shared_case(
    caso: dict[str, Any],
) -> None:
    payload = _payload_for(caso)
    # Para os casos de rejeição a identidade nunca é alcançada (a exceção nasce antes, nas regras
    # a/b) — qualquer Decimal parseável serve como `net_total`; para os de aceite é o líquido real.
    net_total = decimal.Decimal(
        caso["expectedNet"] if caso["expected"] == "accept" else caso["gross"]
    )

    if caso["expected"] == "reject":
        with pytest.raises(ValueError):
            _validate_declared_discount(payload, net_total)
        return

    # Não deve lançar — e o "aceito" só significa algo porque a identidade (regra c) é conferida
    # com o líquido REAL do caso, não com um valor que a tornaria trivialmente verdadeira.
    _validate_declared_discount(payload, net_total)
