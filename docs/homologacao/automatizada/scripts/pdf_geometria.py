"""CF-029 — a geometria do PDF de orçamento, sob dados adversariais.

A lição que o E4 pagou duas vezes, e que este arquivo existe para exercer em volume:

    abrir o artefato é NECESSÁRIO e não é suficiente — é preciso abri-lo com DADOS adversariais e,
    num artefato renderizado, com TAMANHO adversarial, medindo GEOMETRIA. Extração de texto é cega
    a uma colisão de layout, porque os glifos colidem na PÁGINA e não na string.

Reusa o extrator posicional que a suíte do projeto já mantém (`tests/test_export.py:_pdf_runs`), de
propósito: escrever um segundo extrator de PDF nesta homologação seria inventar uma segunda verdade
sobre onde o texto está.

A regra medida é geral e não depende de conhecer as colunas do desenho:

    na MESMA linha de base, nenhum trecho de texto pode começar antes de o anterior terminar.

Rodar (de `backend/`):  uv run python ../docs/homologacao/automatizada/scripts/pdf_geometria.py
"""

from __future__ import annotations

import copy
import json
import pathlib
import sys
from collections import defaultdict
from typing import Any

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[4] / "backend"))

from app.services.quote_render import build_quote_view, render_quote_pdf  # noqa: E402
from tests.test_export import KIT_PAYLOAD, _pdf_runs, _snap  # noqa: E402

SAIDA = pathlib.Path(__file__).resolve().parents[1] / "resultados"
SAIDA.mkdir(parents=True, exist_ok=True)
DEFEITOS = SAIDA / "defeitos-pdf.jsonl"
EXECUCOES = SAIDA / "execucoes-pdf.jsonl"

#: Nomes que um vendedor de verdade escreve, e alguns que ele cola sem perceber. Cada um existe
#: porque quebra o layout de um jeito diferente: comprimento, ausência de espaço (não há onde
#: quebrar a linha), largura de glifo (emoji e CJK são mais largos), e direção do texto.
NOMES: list[tuple[str, str]] = [
    ("Vaso", "curto"),
    ("Vaso decorativo grande com acabamento em resina epoxi e detalhe dourado", "descritivo longo"),
    ("Vaso " * 40, "200+ caracteres COM espaços (pode quebrar linha)"),
    ("V" * 120, "120 caracteres SEM espaço (não há onde quebrar)"),
    ("V" * 400, "400 caracteres SEM espaço"),
    ("Vaso-decorativo-grande-com-acabamento-em-resina-epoxi-dourado-2026", "hifenizado longo"),
    ("VASO DECORATIVO GRANDE COM ACABAMENTO EM RESINA EPOXI DOURADO", "tudo maiúsculo"),
    ("Vaso & Prato <premium> \"aspas\" 'simples'", "markup e aspas"),
    ("Vaso 🎉🎊🎈🥳🎁 Festa", "emoji (glifos largos)"),
    ("花瓶装飾大型エポキシ樹脂仕上げゴールドディテール", "CJK"),
    ("مزهرية زخرفية كبيرة", "árabe (RTL)"),
    ("Vaso ção ÀÉÎÕÜ çÇ ñ ü", "acentuação pesada"),
    ("=HYPERLINK(\"http://x\";\"clique\")", "texto com cara de fórmula"),
    ("Vaso\tcom\ttabulação", "tabulações"),
    ("Vaso  com   espaços    múltiplos", "espaços múltiplos"),
]

#: Valores monetários que alargam a coluna da direita — é o outro lado da mesma colisão.
TOTAIS: list[tuple[str, str]] = [
    ("30.00", "normal"),
    ("1234.56", "milhar"),
    ("1234567.89", "milhão"),
    ("1234567890.12", "bilhão"),
    ("999999999999.99", "doze dígitos"),
]


def registrar(arquivo: pathlib.Path, linha: dict[str, Any]) -> None:
    with arquivo.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(linha, ensure_ascii=False) + "\n")


def defeito(**campos: Any) -> None:
    registrar(DEFEITOS, {"origem": "pdf_geometria", **campos})


def executado(caso: str, categoria: str) -> None:
    registrar(EXECUCOES, {"subcenario": "CF-029-UI-01", "categoria": categoria, "titulo": caso})


def colisoes(runs: list[tuple[float, float, float, str]]) -> list[str]:
    """Trechos que se sobrepõem NA MESMA linha de base.

    Escopo por linha de base de propósito: um cabeçalho alinhado à direita começa legitimamente à
    esquerda do valor que está abaixo dele, e um filtro de página inteira leria isso como colisão.
    """
    por_linha: dict[float, list[tuple[float, float, str]]] = defaultdict(list)
    for x1, y, x2, texto in runs:
        if texto.strip():
            por_linha[round(y, 1)].append((x1, x2, texto))
    achados: list[str] = []
    for y, trechos in sorted(por_linha.items()):
        trechos.sort()
        for (_x1a, x2a, ta), (x1b, _x2b, tb) in zip(trechos, trechos[1:]):
            # 0,5pt de folga: o arredondamento do stringWidth não é uma colisão.
            if x2a > x1b + 0.5:
                achados.append(
                    f"y={y}: \"{ta.strip()[:30]}\" termina em {x2a:.1f} e "
                    f"\"{tb.strip()[:30]}\" começa em {x1b:.1f} (invasão de {x2a - x1b:.1f}pt)"
                )
    return achados


def dentro_da_pagina(runs: list[tuple[float, float, float, str]], largura: float = 595.0) -> list[str]:
    """Nada pode ser desenhado fora da folha A4 — um glifo além da margem simplesmente não existe
    para quem recebe o PDF, e nenhuma extração de texto acusa isso."""
    fora: list[str] = []
    for x1, y, x2, texto in runs:
        if texto.strip() and (x2 > largura + 1 or x1 < -1):
            fora.append(f"y={y:.0f}: \"{texto.strip()[:30]}\" ocupa {x1:.1f}..{x2:.1f} (folha=0..{largura:.0f})")
    return fora


def caso(nome: str, nota_nome: str, total: str, nota_total: str, breakdown: bool) -> None:
    rotulo = f"nome={nota_nome} | total={nota_total} | custos={'sim' if breakdown else 'nao'}"
    payload = copy.deepcopy(KIT_PAYLOAD)
    payload["lines"][0]["name"] = nome
    payload["lines"][0]["totals"]["precoVarejo"] = total
    payload["totals"]["precoVarejo"] = total
    try:
        view = build_quote_view(
            _snap(payload), seller_name="Ana Vendedora", seller_email=None,
            include_cost_breakdown=breakdown,
        )
        pdf = render_quote_pdf(view)
    except Exception as err:  # noqa: BLE001 — o objetivo é justamente descobrir o que estoura
        defeito(
            subcenario="CF-029-UI-01", categoria="estabilidade",
            descricao=f"Renderizar o PDF estourou com {rotulo}: {type(err).__name__}: {err}",
            resultado_esperado="PDF gerado ou recusa explicada — nunca uma exceção",
            resultado_obtido=f"{type(err).__name__}: {err}", severidade="critica",
        )
        executado(rotulo, "estresse_de_dados")
        return

    executado(rotulo, "estresse_de_dados")
    if len(pdf) < 800:
        defeito(
            subcenario="CF-029-UI-01", categoria="estabilidade",
            descricao=f"O PDF gerado com {rotulo} tem apenas {len(pdf)} bytes",
            resultado_esperado="Um PDF com conteúdo",
            resultado_obtido=f"{len(pdf)} bytes", severidade="alta",
        )
        return

    runs = _pdf_runs(pdf)
    executado(rotulo, "layout")

    for achado in colisoes(runs):
        defeito(
            subcenario="CF-029-UI-01", categoria="layout",
            descricao=f"Colisão de texto no PDF ({rotulo}) — {achado}",
            resultado_esperado="Nenhum trecho invade o seguinte na mesma linha de base",
            resultado_obtido=achado, severidade="alta",
        )
    for achado in dentro_da_pagina(runs):
        defeito(
            subcenario="CF-029-UI-01", categoria="layout",
            descricao=f"Texto desenhado fora da folha no PDF ({rotulo}) — {achado}",
            resultado_esperado="Todo texto dentro dos limites da A4",
            resultado_obtido=achado, severidade="alta",
        )

    # O nome do vendedor tem de sobreviver ao dado adversarial: um PDF que perde o nome da peça
    # entrega ao cliente uma linha de dinheiro sem dizer do quê.
    # Compara com o espaço em branco COLAPSADO dos dois lados: o parágrafo do renderizador normaliza
    # tabulações e espaços múltiplos (é o que qualquer motor de texto faz), então comparar byte a byte
    # acusava "o nome sumiu" em 20 casos onde o nome estava lá, só que com um espaço no lugar de três.
    impresso = " ".join(" ".join(t.split()) for _, _, _, t in runs)
    pedaco = " ".join(nome.split())[:12]
    if pedaco and pedaco.isascii() and pedaco not in impresso:
        defeito(
            subcenario="CF-029-UI-01", categoria="acolhimento",
            descricao=f"O nome da peça sumiu do PDF ({rotulo}) — o cliente recebe um valor sem saber do quê",
            resultado_esperado=f"O início do nome ({pedaco!r}) impresso na linha do item",
            resultado_obtido="não encontrado entre os trechos desenhados", severidade="alta",
        )


def main() -> int:
    DEFEITOS.unlink(missing_ok=True)
    EXECUCOES.unlink(missing_ok=True)
    for nome, nota_nome in NOMES:
        for total, nota_total in TOTAIS:
            for breakdown in (False, True):
                caso(nome, nota_nome, total, nota_total, breakdown)
    n_def = sum(1 for _ in DEFEITOS.open(encoding="utf-8")) if DEFEITOS.exists() else 0
    n_exec = sum(1 for _ in EXECUCOES.open(encoding="utf-8")) if EXECUCOES.exists() else 0
    print(f"CF-029 geometria do PDF: {n_exec} execucoes, {n_def} defeitos")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
