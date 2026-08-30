"""Normalização de nome de catálogo (019/PR-D · T063 · ADR-0033 §4).

UMA definição, DOIS idiomas: este arquivo e `apps/web/src/shared/lib/name-norm.ts` têm de concordar
caso a caso, e o vetor que prova isso é o MESMO arquivo lido pelos dois testes
(`specs/019-porte-design/contracts/fixtures/name-norm.json`). O servidor é a autoridade; divergir é
defeito, não configuração.

Regra (nesta ordem, e a ordem importa):

1. ``NFD`` — decompõe "É" em "E" + acento e "İ" (U+0130) em "I" + U+0307;
2. remove as marcas combinantes (categoria ``Mn``) — é o que apaga o acento sem apagar a letra;
3. ``str.lower()`` — **nunca** ``casefold()``: ele transformaria "ß" em "ss" e o ``toLowerCase()``
   do JS não faz isso, o que criaria uma divergência silenciosa entre os dois lados;
4. ``trim`` das pontas e colapso dos espaços internos em um só — com uma classe de espaço
   **explícita e idêntica** nos dois idiomas, escrita com escapes de codepoint.

A classe explícita existe porque ``\\s`` (e ``.strip()``/``.trim()``) **divergem**: o Python casa
NEL (U+0085) e não casa o BOM (U+FEFF); o JS faz o inverso. Por decisão registrada, **NEL fica de
FORA** da classe nos dois lados (preservado), e BOM/NBSP ficam DENTRO.
"""

from __future__ import annotations

import re
import unicodedata

__all__ = ["NAME_NORM_MAX", "name_norm", "name_norm_key"]

#: Teto do VALOR gravado em ``name_norm`` (`left(norm, 200)`). Não é regra de produto — o teto de
#: nome é 120 e vive no pydantic (escritas novas); este é o teto do ÍNDICE btree, aplicado também
#: ao legado pelo backfill da migração 0008 (que carrega uma CÓPIA congelada desta função, porque
#: uma migração mergeada é imutável e não pode seguir este arquivo quando ele mudar).
NAME_NORM_MAX = 200

# Escapes de codepoint, nunca os caracteres crus: U+2028/U+2029 são LineTerminator em JS e
# quebrariam a regex gêmea escrita com literais.
_WS_CLASS = (
    "[ \\t\\n\\r\\f\\v\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"
)
_WS_RUN = re.compile(_WS_CLASS + "+")
_WS_EDGE = re.compile("^" + _WS_CLASS + "+|" + _WS_CLASS + "+$")


def name_norm(raw: str) -> str:
    """Devolve a norma COMPLETA (sem teto) — quem grava aplica ``name_norm_key``."""
    decomposed = unicodedata.normalize("NFD", raw)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    lowered = stripped.lower()
    return _WS_RUN.sub(" ", _WS_EDGE.sub("", lowered))


def name_norm_key(raw: str) -> str:
    """A CHAVE que vai para a coluna ``name_norm`` — ``left(norm, 200)``, igual ao backfill."""
    return name_norm(raw)[:NAME_NORM_MAX]
