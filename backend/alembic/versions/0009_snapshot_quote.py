"""019/PR-E (ADR-0034 §2) — o orçamento enviado congela na tabela que já existe.

`kind` ganha `'QUOTE'` e `headline_basis` ganha `'PRECO_ORCAMENTO'`. **Nenhum segundo mecanismo**
(FR-1917): mesma tabela, mesmo gatilho de imutabilidade (a V2 da 0006, `FOR EACH ROW`, sem filtro de
`kind` — cobre `QUOTE` por construção), mesmo `UNIQUE (owner_uid, client_snapshot_id)`, mesmo `PATCH`
só-de-`label`. Nenhuma linha existente é tocada.

**Não há enum Postgres neste schema** — `kind` e `headline_basis` são `Text` + `CHECK` (0003) —, então
isto é DROP+ADD de três `CHECK`s, roda dentro da transação normal do Alembic e tem downgrade.

**O terceiro `CHECK` é a razão de os três estarem no MESMO ato.** `ck_snapshots_headline_matches_totals`
escolhe a chave do total por um `CASE` sobre `headline_basis`; um valor NOVO cairia no `ELSE` implícito,
o `CASE` devolveria NULL — e **um `CHECK` que avalia NULL PASSA no PostgreSQL**. Abrir o enum sem
estender o `CASE` DESLIGARIA EM SILÊNCIO a única amarração de banco entre o total do cartão
(`headline_total`) e o total do documento (`payload.totals.*`). O ramo
`WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'` entra aqui, e `tests/test_migration_0009.py` prova a
diferença removendo-o à mão (o INSERT divergente passa) e revertendo.

``downgrade()`` restaura os três `CHECK`s anteriores — e **falha por desenho se existir um `QUOTE`
gravado**: o `ADD CONSTRAINT` valida as linhas existentes, e a linha ofensora não pode ser removida
antes porque `trg_snapshots_forbid_delete` (0006) recusa qualquer `DELETE` em `snapshots`. Descer é
possível enquanto nenhum orçamento foi enviado; depois disso, não é — e é a leitura correta, não um
descuido: um snapshot é imutável, e "desfazer a migração apagando o registro" seria destruir a prova
que a tabela existe para guardar. Hoje isso não custa nada (nenhum ambiente foi provisionado — deploy
adiado até v1, decisão do dono 2026-07-09); se aquele adiamento for revisto, este ponto reabre.
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009"
down_revision: str | Sequence[str] | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# O `CASE` completo, nas duas direções — escrito por extenso em vez de montado por f-string: uma
# migração é um registro histórico e tem de ser LEGÍVEL como SQL, não reconstruída mentalmente.
_MATCHES_TOTALS_WITH_QUOTE = (
    "headline_total = ((payload->'totals') ->> ("
    "CASE headline_basis"
    " WHEN 'PRECO_VAREJO' THEN 'precoVarejo'"
    " WHEN 'PRECO_ATACADO' THEN 'precoAtacado'"
    " WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'"
    " END))::numeric"
)
_MATCHES_TOTALS_BEFORE = (
    "headline_total = ((payload->'totals') ->> ("
    "CASE headline_basis"
    " WHEN 'PRECO_VAREJO' THEN 'precoVarejo'"
    " WHEN 'PRECO_ATACADO' THEN 'precoAtacado'"
    " END))::numeric"
)


def upgrade() -> None:
    op.drop_constraint(op.f("ck_snapshots_kind_enum"), "snapshots", type_="check")
    op.create_check_constraint(
        op.f("ck_snapshots_kind_enum"), "snapshots", "kind IN ('SINGLE','KIT','QUOTE')"
    )
    op.drop_constraint(op.f("ck_snapshots_headline_basis_enum"), "snapshots", type_="check")
    op.create_check_constraint(
        op.f("ck_snapshots_headline_basis_enum"),
        "snapshots",
        "headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO','PRECO_ORCAMENTO')",
    )
    # O ramo do CASE, no MESMO ato — sem ele o guarda acima vira NULL e passa em silêncio.
    op.drop_constraint(op.f("ck_snapshots_headline_matches_totals"), "snapshots", type_="check")
    op.create_check_constraint(
        op.f("ck_snapshots_headline_matches_totals"), "snapshots", _MATCHES_TOTALS_WITH_QUOTE
    )


def downgrade() -> None:
    op.drop_constraint(op.f("ck_snapshots_headline_matches_totals"), "snapshots", type_="check")
    op.create_check_constraint(
        op.f("ck_snapshots_headline_matches_totals"), "snapshots", _MATCHES_TOTALS_BEFORE
    )
    op.drop_constraint(op.f("ck_snapshots_headline_basis_enum"), "snapshots", type_="check")
    op.create_check_constraint(
        op.f("ck_snapshots_headline_basis_enum"),
        "snapshots",
        "headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO')",
    )
    op.drop_constraint(op.f("ck_snapshots_kind_enum"), "snapshots", type_="check")
    op.create_check_constraint(
        op.f("ck_snapshots_kind_enum"), "snapshots", "kind IN ('SINGLE','KIT')"
    )
