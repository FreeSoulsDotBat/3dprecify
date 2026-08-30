"""019/PR-D (ADR-0033) — observação de preço, preço fixado pelo vendedor e unicidade de nome.

Três estruturas, uma migração, todas ADITIVAS:

* ``price_observations`` — UMA linha por (conta, item): o último valor que o vendedor VIU, com a
  data. Quem escreve é o CLIENTE (o backend nunca recomputa, ADR-0008); o servidor valida e guarda.
  É *contexto* ("era R$ …"), nunca *fonte* — e por isso mora em tabela própria: ``products``
  continua LITERALMENTE sem coluna de preço calculado, e o invariante do E2 segue verificável por
  AUSÊNCIA, não por sutileza (ADR-0033 §2, opção 1C). ``subject_id`` **não tem FK** de propósito
  (precedente ADR-0019 §5 / ADR-0021 N2: um id que resolve ou não resolve, nunca uma FK que escreve
  na linha alheia); a única FK é ``owner_uid``.
* ``products.seller_fixed_price`` / ``seller_fixed_at`` — o número do ANÚNCIO, **declarado** pelo
  vendedor (ADR-0033 §3). É dinheiro em ``products``, exatamente onde o docstring do modelo dizia
  que não havia — por isso o docstring é reescrito no mesmo passo e a 007 ganhou Clarification
  datada. ``NULL`` = acompanhando o custo; o prefixo ``seller_`` faz qualquer uso indevido ler
  errado em voz alta.
* ``name_norm`` + índice único PARCIAL ``(owner_uid, name_norm) WHERE deleted_at IS NULL`` nas
  quatro tabelas de catálogo (ADR-0033 §4). ``bom_lines`` fica de fora: não tem ``deleted_at`` e o
  kit raiz governa o ciclo de vida da linha.

**Esta é a primeira data-migration do projeto** e a ordem dos passos é o que a torna segura sobre um
banco com histórico: a coluna nasce NULLABLE, o backfill roda, e só então vêm o ``NOT NULL`` e o
``CREATE UNIQUE INDEX``. Hoje "Gancho" e "gancho " convivem legalmente (nenhuma das 4 tabelas tinha
UniqueConstraint de nome), então criar o índice antes quebraria o upgrade em produção.

A função de normalização é uma **CÓPIA CONGELADA** de ``app/lib/name_norm.py``, e tem de continuar
sendo: uma migração já mergeada é imutável (``scripts/check-migrations.sh``), então importar o
módulo vivo faria esta migração mudar de comportamento no dia em que a regra evoluir — o banco
reescreveria o passado. A cópia é o ponto, não um descuido.

``downgrade()`` reverte o ESQUEMA, **não os VALORES** (mesma leitura de ``0007_remove_waste.py``):
descer para 0007 destrói todas as observações de preço e todo ``seller_fixed_price``/
``seller_fixed_at`` já declarado — Postgres não lembra o que havia numa coluna dropada, e este
arquivo tampouco. ``name`` nunca é tocado, então o catálogo em si sobrevive intacto. Isso é aceito
HOJE porque nenhum ambiente foi provisionado (deploy adiado até v1, decisão do dono 2026-07-09):
não há linha real para destruir. Se aquele adiamento for revisto antes desta migração chegar a um
ambiente real, este ponto reabre.
"""

import re
import unicodedata
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_CATALOG_TABLES = ("filaments", "printers", "products", "boms")

# Teto do VALOR da coluna (índice btree), não do produto: o teto de nome (120) é do pydantic e vale
# para escritas NOVAS; o legado pode ter qualquer comprimento e não pode ficar inválido.
_NAME_NORM_MAX = 200

# Classe de espaço EXPLÍCITA, em escapes de codepoint — idêntica à do gêmeo TS. `\s` divergiria:
# o Python casa NEL (U+0085) e não casa o BOM (U+FEFF); o JS faz o inverso. NEL fica FORA por
# decisão registrada (ADR-0033 §4 + fixture `name-norm.json`).
_WS_CLASS = (
    "[ \\t\\n\\r\\f\\v\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]"
)
_WS_RUN = re.compile(_WS_CLASS + "+")
_WS_EDGE = re.compile("^" + _WS_CLASS + "+|" + _WS_CLASS + "+$")


def _norm(raw: str) -> str:
    """CÓPIA CONGELADA de ``app.lib.name_norm.name_norm`` — NUNCA importar o módulo vivo."""
    decomposed = unicodedata.normalize("NFD", raw)
    stripped = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    # `.lower()`, nunca `.casefold()`: casefold transforma "ß" em "ss" e o `toLowerCase()` do JS
    # não — a divergência apareceria como "nome duplicado" só num dos lados.
    lowered = stripped.lower()
    return _WS_RUN.sub(" ", _WS_EDGE.sub("", lowered))


def _candidate(base: str, n: int) -> str:
    """A n-ésima tentativa para um nome legado que colide. O sufixo cabe DENTRO do teto (o valor
    final nunca passa de 200) — e o laço de quem chama revalida cada candidato, então encurtar a
    base para abrir espaço não pode gerar uma colisão nova em silêncio."""
    if n == 1:
        return base
    suffix = f" ({n})"
    return base[: _NAME_NORM_MAX - len(suffix)] + suffix


def _backfill(conn: sa.Connection, table: str) -> None:
    rows = conn.execute(
        sa.text(
            f"SELECT id, owner_uid, name, deleted_at FROM {table} ORDER BY created_at, id"  # noqa: S608
        )
    ).fetchall()
    seen: set[tuple[str, str]] = set()  # (owner_uid, name_norm) já ocupados por linhas VIVAS
    for row in rows:
        base = _norm(row.name)[:_NAME_NORM_MAX]
        cand = base
        if row.deleted_at is None:
            n = 1
            while (row.owner_uid, cand) in seen:
                # Conflito LEGADO: desempata em silêncio (Q5) e não descarta NADA (R6). O `name`
                # que o vendedor digitou fica intocado — só a chave técnica ganha o sufixo.
                n += 1
                cand = _candidate(base, n)
            seen.add((row.owner_uid, cand))
        # Apagados NÃO desempatam: o índice é parcial e os ignora; reservar nome para uma linha
        # morta é exatamente o que `WHERE deleted_at IS NULL` existe para impedir.
        conn.execute(
            sa.text(f"UPDATE {table} SET name_norm = :v WHERE id = :i"),  # noqa: S608
            {"v": cand, "i": row.id},
        )


def upgrade() -> None:
    # (1) A observação de preço, em tabela própria.
    op.create_table(
        "price_observations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_uid", sa.Text(), nullable=False),
        sa.Column("subject_kind", sa.Text(), nullable=False),
        sa.Column("subject_id", sa.UUID(), nullable=False),  # sem FK, de propósito
        sa.Column("observed_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("model_version", sa.Text(), nullable=False),
        sa.Column("catalog_version", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "subject_kind IN ('PRODUCT','KIT')",
            name=op.f("ck_price_observations_subject_kind_enum"),
        ),
        # O guarda de dinheiro da casa: `numeric` ACEITA NaN e trata `NaN = NaN` como TRUE.
        sa.CheckConstraint(
            "observed_price >= 0 AND observed_price <> 'NaN'::numeric",
            name=op.f("ck_price_observations_observed_price_valid"),
        ),
        sa.CheckConstraint(
            "observed_at > '-infinity' AND observed_at < 'infinity'",
            name=op.f("ck_price_observations_observed_at_finite"),
        ),
        sa.CheckConstraint(
            "length(btrim(model_version)) > 0",
            name=op.f("ck_price_observations_model_version_set"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_uid"],
            ["accounts.account_uid"],
            name=op.f("fk_price_observations_owner_uid_accounts"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_price_observations")),
        # UMA linha por item: a tabela é marcador de leitura, não ledger. E a UNIQUE liderada por
        # `owner_uid` já serve o `WHERE owner_uid = :uid` do GET — nenhum índice extra é preciso.
        sa.UniqueConstraint(
            "owner_uid", "subject_kind", "subject_id", name="uq_price_observations_subject"
        ),
    )

    # (2) O preço DECLARADO pelo vendedor (nunca um cálculo guardado).
    op.add_column(
        "products",
        sa.Column("seller_fixed_price", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "products", sa.Column("seller_fixed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_check_constraint(
        op.f("ck_products_seller_fixed_price_valid"),
        "products",
        "seller_fixed_price IS NULL OR"
        " (seller_fixed_price >= 0 AND seller_fixed_price <> 'NaN'::numeric)",
    )

    # (3) A coluna nasce NULLABLE — é o que permite (4) existir.
    for table in _CATALOG_TABLES:
        op.add_column(table, sa.Column("name_norm", sa.Text(), nullable=True))

    # (4) Backfill sobre o legado, com desempate.
    conn = op.get_bind()
    for table in _CATALOG_TABLES:
        _backfill(conn, table)

    # (5) Agora sim: sem buracos.
    for table in _CATALOG_TABLES:
        op.alter_column(table, "name_norm", nullable=False)

    # (6) A unicidade vira propriedade do BANCO, não intenção da aplicação — parcial, para que um
    # item apagado não reserve o nome dele para sempre.
    for table in _CATALOG_TABLES:
        op.create_index(
            f"uq_{table}_owner_name_norm",
            table,
            ["owner_uid", "name_norm"],
            unique=True,
            postgresql_where=sa.text("deleted_at IS NULL"),
        )


def downgrade() -> None:
    # Inverso exato. O ESQUEMA volta; os VALORES de `seller_fixed_price`/`seller_fixed_at` e TODAS
    # as observações de preço morrem aqui — ver o docstring do módulo.
    for table in reversed(_CATALOG_TABLES):
        op.drop_index(f"uq_{table}_owner_name_norm", table_name=table)
    for table in reversed(_CATALOG_TABLES):
        op.drop_column(table, "name_norm")

    op.drop_constraint(op.f("ck_products_seller_fixed_price_valid"), "products", type_="check")
    op.drop_column("products", "seller_fixed_at")
    op.drop_column("products", "seller_fixed_price")

    op.drop_table("price_observations")
