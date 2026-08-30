"""019/PR-E · T082 (ADR-0034 §2) — `headline_basis` e `kind` são ESPELHOS, e um espelho a menos é
um 500 que o outbox re-tenta para sempre.

O valor de `headline_basis` viaja por quatro tabelas no backend, cada uma com um dono diferente:

1. `SnapshotIn.headline_basis` — o `Literal` que decide o que a ROTA aceita (422 se não bater);
2. `api.history._BASIS_TOTAL_KEY` — um **dict**, e a chave faltando é `KeyError` ⇒ **500**
   (`history.py`), num POST que o outbox re-POSTa para sempre (ADR-0018 §3);
3. `services.quote_render._BASIS_TOTAL` — de onde o PDF tira o NÚMERO que o cliente vai ler;
4. `services.quote_render._BASIS_CAPTION` — de onde o PDF tira a LEGENDA daquele número.

Nenhum tipo liga os quatro: `Literal` é do pydantic, os outros três são dicts comuns. Um `basis`
novo aceito em (1) e esquecido em (2) derruba a gravação; esquecido em (3) faz o PDF imprimir o
total ERRADO (o antigo fallback silencioso para `precoVarejo`); esquecido em (4) imprime a chave
crua — "PRECO_ORCAMENTO" — na frente do cliente. Este arquivo transforma os quatro numa igualdade de
CONJUNTOS: acrescentar um valor sem acrescentar os outros três fica VERMELHO aqui, e não no cliente.

O mesmo vale para `kind`, cujo 5º espelho é o `CHECK` do banco.
"""

from __future__ import annotations

import re
import typing
from typing import cast

import sqlalchemy as sa

from app.api.history import (
    _BASIS_TOTAL_KEY,  # pyright: ignore[reportPrivateUsage]
    SnapshotIn,
)
from app.models import Snapshot
from app.services.quote_render import (
    _BASIS_CAPTION,  # pyright: ignore[reportPrivateUsage]
    _BASIS_TOTAL,  # pyright: ignore[reportPrivateUsage]
)
from tests.conftest import requires_db

# Os três valores que o produto conhece hoje. Escrito à mão de propósito: derivar deste conjunto a
# partir de um dos espelhos faria o teste concordar com o erro.
EXPECTED_BASIS = {"PRECO_VAREJO", "PRECO_ATACADO", "PRECO_ORCAMENTO"}
EXPECTED_KIND = {"SINGLE", "KIT", "QUOTE"}


def _literal_values(field: str) -> set[str]:
    annotation = SnapshotIn.model_fields[field].annotation
    values = set(typing.get_args(annotation))
    assert values, f"{field} deixou de ser um Literal — a guarda abaixo perde o sentido"
    return values


def test_the_four_basis_mirrors_are_the_SAME_set() -> None:
    assert _literal_values("headline_basis") == EXPECTED_BASIS
    assert set(_BASIS_TOTAL_KEY) == EXPECTED_BASIS
    assert set(_BASIS_TOTAL) == EXPECTED_BASIS
    assert set(_BASIS_CAPTION) == EXPECTED_BASIS


def test_the_two_total_key_mirrors_agree_on_the_KEY_too() -> None:
    """Não basta terem as mesmas CHAVES: se `history` amarrasse `PRECO_ORCAMENTO` a
    `totals.precoOrcamento` e o renderizador lesse `totals.precoVarejo`, a rota gravaria um número e
    o PDF do cliente imprimiria outro — os dois "válidos", nenhum dos dois checável por tipo."""
    assert _BASIS_TOTAL_KEY == _BASIS_TOTAL


def test_every_caption_is_TRANSLATED_never_the_raw_key() -> None:
    """A legenda chega ao CLIENTE. "PRECO_ORCAMENTO" impresso num orçamento é a mesma classe de
    defeito de um preço errado: o documento fica ilegível para quem o recebe."""
    for basis, caption in _BASIS_CAPTION.items():
        assert caption != basis
        assert caption == caption.strip() and caption
        assert "_" not in caption and caption.lower() != caption.upper()


def _model_check_values(name: str) -> set[str]:
    """Os literais de um `CHECK ... IN ('A','B')` do MODELO SQLAlchemy (o espelho do ORM)."""
    check = next(
        c
        for c in cast("sa.Table", Snapshot.__table__).constraints
        if isinstance(c, sa.CheckConstraint) and c.name == name
    )
    return set(re.findall(r"'([^']+)'", str(check.sqltext)))


def test_the_kind_and_basis_literals_match_the_MODEL_checks() -> None:
    assert _literal_values("kind") == EXPECTED_KIND
    assert _model_check_values("ck_snapshots_kind_enum") == EXPECTED_KIND
    assert _model_check_values("ck_snapshots_headline_basis_enum") == EXPECTED_BASIS


@requires_db
def test_the_DATABASE_agrees_with_both_literals(migrated_db: str) -> None:
    """O 5º espelho, e o único que a aplicação não consegue contradizer sem um 500: os `CHECK`
    vivos. Um `Literal` mais largo que o `CHECK` é um `IntegrityError` no INSERT — 500 num POST que
    o outbox repete para sempre; mais estreito é uma funcionalidade que o banco aceita e a rota
    recusa (422 silencioso)."""
    engine = sa.create_engine(migrated_db)
    try:
        with engine.connect() as conn:
            defs = {
                name: str(
                    conn.execute(
                        sa.text(
                            "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c"
                            " JOIN pg_class t ON t.oid = c.conrelid"
                            " WHERE t.relname = 'snapshots' AND c.conname = :n"
                        ),
                        {"n": name},
                    ).scalar_one()
                )
                for name in ("ck_snapshots_kind_enum", "ck_snapshots_headline_basis_enum")
            }
    finally:
        engine.dispose()

    for value in EXPECTED_KIND:
        assert f"'{value}'" in defs["ck_snapshots_kind_enum"]
    for value in EXPECTED_BASIS:
        assert f"'{value}'" in defs["ck_snapshots_headline_basis_enum"]
    # E nada ALÉM: um CHECK mais largo que o `Literal` esconderia um valor que só um escritor
    # não-API conseguiria gravar — e que o renderizador não saberia ler.
    assert defs["ck_snapshots_kind_enum"].count("'") == 2 * len(EXPECTED_KIND)
    assert defs["ck_snapshots_headline_basis_enum"].count("'") == 2 * len(EXPECTED_BASIS)
