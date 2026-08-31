"""Shared plumbing for every model module: naming convention, declarative base, the uuid7
generator, the type domains (data-model §0.1), and the `name_norm` application default
(019/PR-D, ADR-0033 §4) that every named catalog table shares.
"""

from __future__ import annotations

import uuid

from sqlalchemy import MetaData, Numeric
from sqlalchemy.engine.default import DefaultExecutionContext
from sqlalchemy.orm import DeclarativeBase
from uuid6 import uuid7

from app.lib.name_norm import name_norm_key

# Deterministic constraint names so Alembic migrations stay stable across autogenerations.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


def name_norm_default(context: DefaultExecutionContext) -> str:
    """019/PR-D (ADR-0033 §4) — `name_norm` NASCE junto com a linha, derivada de `name`.

    A normalização é da APLICAÇÃO (não há extensão `unaccent` nem expressão IMMUTABLE que a
    exprima em SQL), e este default é o que torna "existe `name_norm` para toda linha" uma
    propriedade ESTRUTURAL em vez de uma disciplina de sete sítios de escrita: uma rota nova que
    esqueça de calculá-la insere certo do mesmo jeito.

    Ele NÃO substitui o escritor: quem RENOMEIA tem de reescrever `name_norm` explicitamente, e é
    também o escritor que trata o conflito com o sufixo "(2)" sob SAVEPOINT (T072/T065). O default
    cobre o INSERT; o UPDATE é decisão de quem renomeia, e por isso não há `onupdate` aqui — um
    `onupdate` "esperto" leria um `name` que pode nem estar no SET e devolveria NULL numa coluna
    NOT NULL.
    """
    raw = context.get_current_parameters().get("name")
    if not isinstance(raw, str):  # pragma: no cover - `name` é NOT NULL em todas as 4 tabelas
        raise ValueError("name_norm derives from `name`, which is missing from the INSERT")
    return name_norm_key(raw)


# Type domains (data-model §0.1). Stored precision ≥ input precision ⇒ lossless round-trip,
# which is what makes catalog pre-fill byte-identical by construction (SC-305).
MONEY_SETTLED = Numeric(12, 2)
MONEY_RATE = Numeric(18, 6)
QTY_G = Numeric(12, 3)
QTY_H = Numeric(9, 3)
QTY_KG = Numeric(9, 3)
QTY_KW = Numeric(9, 4)
PERCENT = Numeric(6, 3)


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def uuid7_default() -> uuid.UUID:
    return uuid7()
