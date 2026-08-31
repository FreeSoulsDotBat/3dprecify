"""019/PR-D · T072 — nome único por conta, resolvido com sufixo em SILÊNCIO (ADR-0033 §4, Q5).

Um comportamento só, para as quatro tabelas de catálogo: se `(owner_uid, name_norm)` já estiver
ocupado **entre os vivos**, o servidor grava `"<nome> (2)"`, `"(3)"`… e devolve o registro com o
nome FINAL. Sem erro, sem aviso — a recusa *"já está no catálogo"* é do formulário, no cliente,
antes de enviar; aqui embaixo sobra a corrida entre dois aparelhos, e ela não pode descartar nada.

**Por que SAVEPOINT e não um `SELECT` prévio.** Um `SELECT` não vê a linha que a transação vizinha
ainda não commitou, então ele resolve o caso sequencial e perde exatamente o caso que a unicidade
existe para resolver. Quem decide é o índice: tentamos gravar, e o `IntegrityError` é a resposta.
Como o save de kit é UMA transação (ADR-0017) e um erro de flush envenena a transação inteira, a
tentativa roda dentro de `session.begin_nested()` — o SAVEPOINT é o que faz o conflito de um
produto materializado custar uma renomeação em vez do kit inteiro.

**A regra que o chamador tem de respeitar, e o motivo dela.** `Session.begin_nested()` faz um
`flush()` ANTES de abrir o savepoint (`orm/session.py::_take_snapshot` — e esse flush não obedece
`no_autoflush`, foi medido). Se a linha já estivesse suja com o nome em conflito, o erro estouraria
FORA do savepoint e mataria a transação. Por isso toda a escrita da linha acontece DENTRO da
tentativa, no callback `apply` — e é também isso que torna o retry correto: um savepoint
desfeito EXPIRA os atributos do objeto (medido), então a tentativa seguinte precisa reescrevê-los,
e reescreve.
"""

from __future__ import annotations

from collections.abc import Callable

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import AppError, ErrorCode
from app.lib.name_norm import name_norm_key
from app.models import Bom, Filament, Printer, Product

#: Teto de nome das ESCRITAS NOVAS (pydantic; precedente `scenarios.py:84`). Não há CHECK de
#: comprimento no banco, de propósito: ele invalidaria o legado (Adendo 27/08 §3).
NAME_MAX_CHARS = 120

#: Teto de tentativas. 50 homônimos vivos no mesmo catálogo não é um vendedor trabalhando, é um
#: laço — e a resposta honesta a um laço é 422 com o `VALIDATION_ERROR` que já existe (nenhum
#: `ErrorCode` novo nasce para um caso que ninguém alcança).
MAX_SUFFIX_ATTEMPTS = 50


#: As QUATRO tabelas que a regra governa, nomeadas uma a uma. Um `Protocol` estrutural seria mais
#: elegante e menos verdadeiro: `Mapped[str]` não satisfaz um atributo `str` mutável, e afrouxar o
#: tipo para `Any` compraria elegância com a checagem que este projeto usa como guarda.
NamedRow = Filament | Printer | Product | Bom

#: O índice único parcial `(owner_uid, name_norm)` de cada tabela — só ELE dispara o retry de
#: sufixo em `flush_with_unique_name` (qualquer outra violação de integridade continua subindo).
#: 019/PR-D polish: as quatro entradas viviam repetidas como `_NAME_INDEX` em cada router
#: (`filaments.py`/`printers.py`/`products.py`/`boms.py`), e `boms.py` ainda duplicava a entrada
#: de `Product` como `_PRODUCT_NAME_INDEX` — um único dicionário público mata as duas duplicatas.
NAME_INDEX: dict[type[NamedRow], str] = {
    Filament: "uq_filaments_owner_name_norm",
    Printer: "uq_printers_owner_name_norm",
    Product: "uq_products_owner_name_norm",
    Bom: "uq_boms_owner_name_norm",
}


def _violated_constraint(exc: IntegrityError) -> str | None:
    diag = getattr(exc.orig, "diag", None)
    return getattr(diag, "constraint_name", None)


async def flush_with_unique_name(
    session: AsyncSession,
    row: NamedRow,
    base_name: str,
    *,
    index_name: str,
    apply: Callable[[], None] | None = None,
) -> None:
    """Grava `row` com o primeiro nome livre a partir de `base_name`, e faz `flush` (sem commit).

    `apply` escreve TODOS os campos mutáveis da linha e é chamado dentro de cada tentativa (ver o
    docstring do módulo). O chamador entrega a linha LIMPA: nada de mutá-la antes.
    """
    for attempt in range(1, MAX_SUFFIX_ATTEMPTS + 1):
        candidate = base_name if attempt == 1 else f"{base_name} ({attempt})"
        savepoint = await session.begin_nested()
        try:
            if apply is not None:
                apply()
            row.name = candidate
            row.name_norm = name_norm_key(candidate)
            session.add(row)
            await session.flush()
            await savepoint.commit()
            return
        except IntegrityError as exc:
            await savepoint.rollback()
            if _violated_constraint(exc) != index_name:
                raise
    raise AppError(
        ErrorCode.VALIDATION_ERROR,
        "too many items share this name on this account",
        status_code=422,
    )
