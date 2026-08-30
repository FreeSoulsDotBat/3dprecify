"""019/PR-E · T081 (ADR-0034 §2) — a migração 0009 medida em três atos.

`kind` e `headline_basis` são **TEXT + CHECK**, não enum Postgres (zero `sa.Enum`/`CREATE TYPE` em
`alembic/versions/`; `models:753/:755`). Por isso a 0009 é DROP+ADD de três CHECKs no MESMO ato,
roda
dentro da transação normal do Alembic e **tem** downgrade.

(a) **Estado pós-upgrade** contra a fixture de sessão (`conftest.migrated_db`, já em `head`):
    `QUOTE`/`PRECO_ORCAMENTO` aceitos; um QUOTE cujo `headline_total` diverge de
    `payload.totals.precoOrcamento` é RECUSADO por `ck_snapshots_headline_matches_totals`; `SINGLE`
    e `KIT` seguem intocadas; um `UPDATE` de conteúdo num QUOTE morre no `trg_snapshots_immutable`
    (a V2 da 0006, `FOR EACH ROW`, sem filtro de `kind` — cobre QUOTE por construção).

(b) **NÃO-VÁCUO, e ele é o teste principal deste arquivo.** O `CHECK` escolhe a chave do total
    por um `CASE` sobre `headline_basis`; um valor NOVO cairia no `ELSE` implícito, e o `CASE`
    devolveria NULL
    e **um CHECK que avalia NULL PASSA no PostgreSQL**. Ou seja: adicionar o enum sem estender o
    `CASE` DESLIGA EM SILÊNCIO a única amarração de banco entre o total do cartão e o total do
    documento. Aqui o ramo é removido à mão numa transação que depois é revertida, e o INSERT
    divergente **passa** — provando que o ramo `WHEN 'PRECO_ORCAMENTO'` é o que segura o guarda.

(c) **Downgrade em container PRÓPRIO**: em 0008 o `QUOTE` é ilegal; em 0009 é legal; e descer de
    volta com um QUOTE gravado **falha por desenho** — o `ADD CONSTRAINT` não valida a linha
    existente, e ela não pode ser removida antes porque `trg_snapshots_forbid_delete` (0006) recusa
    qualquer `DELETE`. Sem QUOTE, o downgrade conclui e restaura os três CHECKs. Isso é declarado no
    docstring da própria migração (molde `0007:14-27`), não descoberto em produção.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy.exc import DatabaseError, IntegrityError

from alembic import command
from app.db import reset_engine_for_tests
from app.settings import get_settings
from tests.conftest import requires_db

pytestmark = requires_db


# O documento congelado de um orçamento (data-model §4). Todo dinheiro é STRING decimal — inclusive
# `discount.value` —, porque `json.loads` devolveria float e a precisão morreria no serializador.
QUOTE_PAYLOAD: dict[str, Any] = {
    "schemaVersion": 1,
    "kind": "QUOTE",
    "modelVersion": "4.2.0",
    "catalogVersion": None,
    "lines": [
        {
            "name": "Vaso",
            "quantity": 2,
            "unitPrice": "30.00",
            "subtotal": "60.00",
            "origin": {"kind": "PRODUCT", "id": "p1", "name": "Vaso"},
        },
        {
            "name": "Prato",
            "quantity": 1,
            "unitPrice": "12.00",
            "subtotal": "12.00",
            "origin": None,
        },
    ],
    "discount": {"mode": "PCT", "value": "10", "amount": "7.20", "grossTotal": "72.00"},
    "costFloor": "48.00",
    "totals": {"precoOrcamento": "64.80"},
}


def _payload(**over: Any) -> dict[str, Any]:
    return {**json.loads(json.dumps(QUOTE_PAYLOAD)), **over}


# --- (a) estado pós-upgrade ---------------------------------------------------------------------


@pytest.fixture
def head_engine(migrated_db: str) -> Iterator[sa.Engine]:
    engine = sa.create_engine(migrated_db)
    try:
        yield engine
    finally:
        engine.dispose()


def _check_src(conn: sa.Connection, name: str) -> str:
    return str(
        conn.execute(
            sa.text(
                "SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c"
                " JOIN pg_class t ON t.oid = c.conrelid"
                " WHERE t.relname = 'snapshots' AND c.conname = :n"
            ),
            {"n": name},
        ).scalar_one()
    )


_INSERT_SNAPSHOT = sa.text(
    "INSERT INTO snapshots"
    " (id, owner_uid, client_snapshot_id, kind, quote_validity_days, device_quoted_at,"
    "  device_utc_offset_minutes, model_version, payload_schema_version, payload,"
    "  headline_total, headline_basis)"
    " VALUES (:id, :u, :csid, :kind, 15, CAST(:at AS timestamptz), -180, :mv, 1,"
    "  CAST(:payload AS jsonb), CAST(:total AS numeric), :basis)"
)


def _row(owner: str, **over: Any) -> dict[str, Any]:
    row: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "u": owner,
        "csid": str(uuid.uuid4()),
        "kind": "QUOTE",
        "at": "2026-08-29T19:30:00+00:00",
        "mv": "4.2.0",
        "payload": json.dumps(QUOTE_PAYLOAD),
        "total": "64.80",
        "basis": "PRECO_ORCAMENTO",
    }
    row.update(over)
    return row


def _account(engine: sa.Engine, prefix: str) -> str:
    uid = f"{prefix}-{uuid.uuid4().hex[:8]}"
    with engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO accounts (account_uid) VALUES (:u)"), {"u": uid})
    return uid


def test_the_three_checks_carry_the_new_values(head_engine: sa.Engine) -> None:
    with head_engine.connect() as conn:
        kind = _check_src(conn, "ck_snapshots_kind_enum")
        basis = _check_src(conn, "ck_snapshots_headline_basis_enum")
        matches = _check_src(conn, "ck_snapshots_headline_matches_totals")
    assert "'QUOTE'" in kind
    assert "'SINGLE'" in kind and "'KIT'" in kind  # aditiva: nada foi retirado
    assert "'PRECO_ORCAMENTO'" in basis
    assert "'PRECO_VAREJO'" in basis and "'PRECO_ATACADO'" in basis
    # O ramo do CASE é o que mantém o guarda LIGADO — sem ele o CHECK avalia NULL e passa.
    assert "'precoOrcamento'" in matches


def test_a_quote_snapshot_is_accepted(head_engine: sa.Engine) -> None:
    uid = _account(head_engine, "mig9-ok")
    with head_engine.begin() as conn:
        conn.execute(_INSERT_SNAPSHOT, _row(uid))
    with head_engine.connect() as conn:
        assert (
            conn.execute(
                sa.text("SELECT count(*) FROM snapshots WHERE owner_uid = :u"), {"u": uid}
            ).scalar_one()
            == 1
        )


def test_a_quote_whose_headline_total_diverges_from_the_document_is_REFUSED(
    head_engine: sa.Engine,
) -> None:
    """O risco declarado do ADR-0034: gravar o total descontado num campo que diz outra coisa. Um
    documento imutável que MENTE é a pior classe possível aqui — o banco recusa."""
    uid = _account(head_engine, "mig9-diverge")
    with (
        pytest.raises(IntegrityError, match="ck_snapshots_headline_matches_totals"),
        head_engine.begin() as conn,
    ):
        conn.execute(_INSERT_SNAPSHOT, _row(uid, total="99.99"))


@pytest.mark.parametrize(
    ("kind", "basis", "total", "key"),
    [
        ("SINGLE", "PRECO_VAREJO", "21.90", "precoVarejo"),
        ("KIT", "PRECO_ATACADO", "18.98", "precoAtacado"),
    ],
)
def test_SINGLE_and_KIT_stay_untouched(
    head_engine: sa.Engine, kind: str, basis: str, total: str, key: str
) -> None:
    """A 0009 é ADITIVA: os dois `kind` que já existiam gravam exatamente como gravavam, e o ramo
    antigo do `CASE` continua amarrando o total deles."""
    uid = _account(head_engine, "mig9-old")
    payload = {
        "schemaVersion": 1,
        "kind": kind,
        "modelVersion": "4.1.0",
        "totals": {key: total},
    }
    args = _row(uid, kind=kind, basis=basis, total=total, mv="4.1.0", payload=json.dumps(payload))
    with head_engine.begin() as conn:
        conn.execute(_INSERT_SNAPSHOT, args)
    with (
        pytest.raises(IntegrityError, match="ck_snapshots_headline_matches_totals"),
        head_engine.begin() as conn,
    ):
        conn.execute(_INSERT_SNAPSHOT, {**args, "id": str(uuid.uuid4()), "total": "1.00"})


@pytest.mark.parametrize(
    ("over", "constraint"),
    [
        ({"kind": "ORCAMENTO"}, "ck_snapshots_kind_enum"),
        ({"basis": "PRECO_ORCAMENTO_NOVO"}, "ck_snapshots_headline_basis_enum"),
    ],
)
def test_the_enums_still_REFUSE_anything_outside_the_three_values(
    head_engine: sa.Engine, over: dict[str, Any], constraint: str
) -> None:
    uid = _account(head_engine, "mig9-bad")
    with pytest.raises(IntegrityError, match=constraint), head_engine.begin() as conn:
        conn.execute(_INSERT_SNAPSHOT, _row(uid, **over))


def test_an_UPDATE_on_a_QUOTE_is_refused_by_the_immutability_trigger(
    head_engine: sa.Engine,
) -> None:
    """O gatilho vigente é a V2 da 0006, `BEFORE UPDATE … FOR EACH ROW` **sem filtro de `kind`** —
    então o `QUOTE` herda a imutabilidade inteira sem uma linha de código nova (FR-1917: nenhum
    segundo mecanismo)."""
    uid = _account(head_engine, "mig9-imut")
    with head_engine.begin() as conn:
        conn.execute(_INSERT_SNAPSHOT, _row(uid))
    with (
        pytest.raises(DatabaseError, match="snapshot contents are immutable"),
        head_engine.begin() as conn,
    ):
        conn.execute(
            sa.text(
                "UPDATE snapshots SET payload = jsonb_set(payload, '{lines,0,name}', '\"Outro\"')"
                " WHERE owner_uid = :u"
            ),
            {"u": uid},
        )


# --- (b) NÃO-VÁCUO: sem o ramo do CASE o guarda desliga EM SILÊNCIO -----------------------------


def test_MUTATION_without_the_PRECO_ORCAMENTO_branch_the_check_silently_PASSES(
    head_engine: sa.Engine,
) -> None:
    """A mutação que dá sentido ao teste acima.

    Dentro de UMA transação revertida ao fim, o `CHECK` é recriado SEM o ramo novo — exatamente o
    que uma 0009 "só aditiva no enum" teria feito. O mesmo INSERT divergente que morre em
    `test_a_quote_whose_headline_total_diverges_...` passa **sem erro nenhum**: o `CASE` devolve
    NULL, o `CHECK` avalia NULL e o PostgreSQL trata NULL como satisfeito.

    É por isso que o ramo mora na MESMA migração do enum: separá-los deixaria uma janela em que o
    banco aceita um orçamento cujo cartão e cujo documento dizem números diferentes.
    """
    uid = _account(head_engine, "mig9-mut")
    with head_engine.begin() as conn:
        conn.execute(
            sa.text(
                "ALTER TABLE snapshots DROP CONSTRAINT ck_snapshots_headline_matches_totals;"
                " ALTER TABLE snapshots ADD CONSTRAINT ck_snapshots_headline_matches_totals"
                " CHECK (headline_total = ((payload->'totals') ->> ("
                " CASE headline_basis"
                "  WHEN 'PRECO_VAREJO' THEN 'precoVarejo'"
                "  WHEN 'PRECO_ATACADO' THEN 'precoAtacado'"
                " END))::numeric);"
            )
        )
        conn.execute(_INSERT_SNAPSHOT, _row(uid, total="99.99"))
        assert (
            conn.execute(
                sa.text("SELECT headline_total FROM snapshots WHERE owner_uid = :u"), {"u": uid}
            ).scalar_one()
            is not None
        ), "o INSERT divergente passou — é a mutação, e é o ponto"
        conn.rollback()  # nada disto sobrevive ao teste

    # O banco voltou ao estado real: o mesmo INSERT morre de novo.
    with (
        pytest.raises(IntegrityError, match="ck_snapshots_headline_matches_totals"),
        head_engine.begin() as conn,
    ):
        conn.execute(_INSERT_SNAPSHOT, _row(uid, total="99.99"))


# --- (c) 0008 ↔ 0009 em container PRÓPRIO --------------------------------------------------------


def test_0008_refuses_a_QUOTE_and_the_downgrade_fails_by_design_when_one_exists() -> None:
    """Três fatos que a fixture de sessão (nascida em `head`) não consegue medir."""
    os.environ.setdefault("TESTCONTAINERS_RYUK_DISABLED", "true")
    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:17-alpine", driver="psycopg") as pg:
        url = pg.get_connection_url()
        old = os.environ.get("P3D_DATABASE_URL")
        os.environ["P3D_DATABASE_URL"] = url
        get_settings.cache_clear()
        reset_engine_for_tests()
        engine = sa.create_engine(url)
        try:
            cfg = Config("alembic.ini")
            command.upgrade(cfg, "0008")
            with engine.begin() as conn:
                conn.execute(sa.text("INSERT INTO accounts (account_uid) VALUES ('owner-q')"))
            # 1. Em 0008 o orçamento é ILEGAL — a migração é o que o torna representável.
            # A alternância no `match` é honesta, não frouxa: `kind` E `headline_basis` são
            # ilegais em 0008, e a ORDEM em que o Postgres avalia dois CHECKs violados na mesma
            # linha não é contratual.
            with (
                pytest.raises(IntegrityError, match=r"ck_snapshots_(kind|headline_basis)_enum"),
                engine.begin() as conn,
            ):
                conn.execute(_INSERT_SNAPSHOT, _row("owner-q"))

            command.upgrade(cfg, "0009")

            # 2. Sem QUOTE gravado, o downgrade CONCLUI e restaura os três CHECKs.
            command.downgrade(cfg, "0008")
            with engine.connect() as conn:
                assert "'QUOTE'" not in _check_src(conn, "ck_snapshots_kind_enum")
                assert "'PRECO_ORCAMENTO'" not in _check_src(
                    conn, "ck_snapshots_headline_basis_enum"
                )
                assert "'precoOrcamento'" not in _check_src(
                    conn, "ck_snapshots_headline_matches_totals"
                )
            command.upgrade(cfg, "0009")

            # 3. COM um QUOTE gravado o downgrade falha por DESENHO: o `ADD CONSTRAINT` valida as
            #    linhas existentes, e a linha não pode ser removida antes porque
            #    `trg_snapshots_forbid_delete` (0006) recusa qualquer DELETE. É irreversível, e a
            #    migração declara isso no próprio docstring.
            with engine.begin() as conn:
                conn.execute(_INSERT_SNAPSHOT, _row("owner-q"))
            with pytest.raises(IntegrityError, match=r"ck_snapshots_(kind|headline_basis)_enum"):
                command.downgrade(cfg, "0008")
            with (
                pytest.raises(DatabaseError, match="never hard-deleted"),
                engine.begin() as conn,
            ):
                conn.execute(sa.text("DELETE FROM snapshots WHERE kind = 'QUOTE'"))
        finally:
            engine.dispose()
            if old is None:
                os.environ.pop("P3D_DATABASE_URL", None)
            else:
                os.environ["P3D_DATABASE_URL"] = old
            get_settings.cache_clear()
            reset_engine_for_tests()
