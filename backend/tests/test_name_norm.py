"""019/PR-D · T063 (ADR-0033 §4) — a normalização de nome é UMA definição em DOIS idiomas.

O vetor de casos é COMPARTILHADO com o gêmeo TS (`apps/web/src/shared/lib/name-norm.ts`):
`specs/019-porte-design/contracts/fixtures/name-norm.json`. Se as duas implementações divergirem
num caso, o índice único parcial `(owner_uid, name_norm)` passa a recusar no servidor o que o
formulário deixou passar (ou o contrário) — por isso o fixture é LIDO, nunca copiado, e a ausência
do arquivo é falha EXPLÍCITA, jamais um teste que silenciosamente não roda.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.lib.name_norm import NAME_NORM_MAX, name_norm, name_norm_key

_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "specs"
    / "019-porte-design"
    / "contracts"
    / "fixtures"
    / "name-norm.json"
)


def _cases() -> list[dict[str, Any]]:
    if not _FIXTURE.exists():  # pragma: no cover - guarda de caminho, não de comportamento
        pytest.fail(
            f"vetor compartilhado ausente: {_FIXTURE} — o teste do gêmeo TS lê o MESMO arquivo; "
            "sem ele as duas implementações deixam de ser comparadas"
        )
    data = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    cases = data["cases"]
    assert isinstance(cases, list) and cases, "fixture sem casos"
    return cases


@pytest.mark.parametrize(
    ("raw", "expected", "why"),
    [pytest.param(c["in"], c["out"], c["why"], id=f"caso{i:02d}") for i, c in enumerate(_cases())],
)
def test_name_norm_matches_shared_vector(raw: str, expected: str, why: str) -> None:
    assert name_norm(raw) == expected, why


def test_fixture_declares_the_agreed_hard_cases() -> None:
    """O fixture só protege o que ele contém — estes 4 casos são a razão de ele existir (a
    divergência `\\s`/`.strip()`/`.trim()` entre Python e JS). Se alguém os remover, isto avisa."""
    entradas = {c["in"] for c in _cases()}
    assert "Gancho duplo" in entradas, "NBSP interno"  # noqa: RUF001 - o caractere É o caso
    assert "﻿Gancho﻿" in entradas, "BOM nas pontas"
    assert "Ganchoduplo" in entradas, "NEL preservado"
    assert "İstanbul" in entradas, "I com ponto (U+0130)"


def test_nel_is_preserved_never_collapsed() -> None:
    """Decisão registrada (ADR-0033 §4 + fixture): U+0085 fica FORA da classe de espaço nos dois
    idiomas. O `\\s` do Python o casaria e o do JS não — é exatamente a divergência que a classe
    explícita existe para impedir."""
    assert name_norm("Ganchoduplo") == "ganchoduplo"


def test_bom_and_nbsp_are_inside_the_class() -> None:
    """O espelho do teste acima: `.strip()` do Python NÃO tira o BOM e o `.trim()` do JS tira."""
    assert name_norm("﻿  Gancho 　duplo ﻿") == "gancho duplo"


def test_name_norm_returns_the_full_norm_and_key_truncates_at_200() -> None:
    """`name_norm()` devolve a norm COMPLETA; quem grava aplica o teto (`name_norm_key`), que é o
    mesmo `left(norm, 200)` do backfill da 0008 — o índice btree cabe sem CHECK de comprimento no
    banco (o legado ficaria inválido; o teto 120 é do pydantic, escritas novas)."""
    raw = "Á" * 5000
    assert len(name_norm(raw)) == 5000
    assert name_norm(raw) == "a" * 5000
    assert NAME_NORM_MAX == 200
    assert name_norm_key(raw) == "a" * 200
    assert len(name_norm_key(raw)) == 200


def test_name_norm_key_is_idempotent_on_short_names() -> None:
    assert name_norm_key("  Gancho  ") == "gancho"
