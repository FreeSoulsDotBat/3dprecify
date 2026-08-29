"""019/PR-D · T062 (ADR-0033 §2/§3/§4) — a migração 0008 medida em três atos.

(a) **Estado pós-upgrade** contra a fixture de sessão (`conftest.migrated_db`, já em `head`):
    `price_observations` com a UNIQUE de assunto, os 4 CHECKs nomeados e UMA só FK (`accounts`);
    `products` com o dinheiro DECLARADO pelo vendedor (`seller_fixed_price`/`seller_fixed_at`) e seu
    CHECK; `name_norm TEXT NOT NULL` + índice único PARCIAL nas QUATRO tabelas de catálogo —
    `bom_lines` fica de fora porque não tem `deleted_at` (a linha pertence ao kit).

(b) **Backfill com LEGADO**, em container PRÓPRIO (molde `test_migrations.py:63-76`): a fixture de
    sessão nasce em `head` e nunca vê dados de 0007, então ela não pode provar o passo que mais pode
    quebrar em produção — o `CREATE UNIQUE INDEX` sobre nomes que HOJE são legais ("Gancho" e
    "gancho " convivem: nenhuma das 4 tabelas tinha UniqueConstraint de nome). O upgrade tem de
    CONCLUIR desempatando com "(2)" em silêncio (Q5), sem descartar nada (R6) e sem tocar o `name`.

(c) **Downgrade com DADO dentro** (mesmo container): volta ao esquema de 0007. Os VALORES morrem —
    é o que o docstring da migração declara.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Iterator
from typing import Any

import pytest
import sqlalchemy as sa
from alembic.config import Config
from sqlalchemy.exc import IntegrityError

from alembic import command
from app.db import reset_engine_for_tests
from app.settings import get_settings
from tests.conftest import requires_db

pytestmark = requires_db

_CATALOG_TABLES = ("filaments", "printers", "products", "boms")


# --- (a) estado pós-upgrade ---------------------------------------------------------------------


@pytest.fixture
def head_engine(migrated_db: str) -> Iterator[sa.Engine]:
    engine = sa.create_engine(migrated_db)
    try:
        yield engine
    finally:
        engine.dispose()


def _constraint_names(engine: sa.Engine, table: str, contype: str) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(
            sa.text(
                "SELECT c.conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid"
                " WHERE t.relname = :t AND c.contype = :k"
            ),
            {"t": table, "k": contype},
        ).scalars()
        return set(rows)


def test_price_observations_table_shape(head_engine: sa.Engine) -> None:
    insp = sa.inspect(head_engine)
    cols = {c["name"]: c for c in insp.get_columns("price_observations")}
    assert set(cols) == {
        "id",
        "owner_uid",
        "subject_kind",
        "subject_id",
        "observed_price",
        "observed_at",
        "model_version",
        "catalog_version",
        "created_at",
        "updated_at",
    }
    # Uma linha por (conta, item) — a tabela é um MARCADOR de leitura, não um ledger (ADR-0033 §2,
    # opção 1C: append-only cresce sem que nada leia o histórico).
    uniques = {
        u["name"]: list(u["column_names"])
        for u in insp.get_unique_constraints("price_observations")
    }
    assert uniques["uq_price_observations_subject"] == ["owner_uid", "subject_kind", "subject_id"]

    assert _constraint_names(head_engine, "price_observations", "c") >= {
        "ck_price_observations_subject_kind_enum",
        "ck_price_observations_observed_price_valid",
        "ck_price_observations_observed_at_finite",
        "ck_price_observations_model_version_set",
    }
    assert cols["observed_price"]["nullable"] is False
    assert cols["catalog_version"]["nullable"] is True
    assert str(cols["observed_price"]["type"]) == "NUMERIC(12, 2)"


def test_price_observations_has_exactly_one_fk_and_it_is_accounts(head_engine: sa.Engine) -> None:
    """`subject_id` NÃO tem FK, de propósito: um id que resolve ou não resolve, nunca uma FK que
    escreve na linha alheia (precedente ADR-0019 §5 / ADR-0021 N2)."""
    fks = sa.inspect(head_engine).get_foreign_keys("price_observations")
    assert [(f["constrained_columns"], f["referred_table"]) for f in fks] == [
        (["owner_uid"], "accounts")
    ]


def test_price_observations_rejects_bad_rows(head_engine: sa.Engine) -> None:
    uid = f"mig8-{uuid.uuid4().hex[:8]}"
    with head_engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO accounts (account_uid) VALUES (:u)"), {"u": uid})

    def _insert(**over: Any) -> None:
        row = {
            "id": str(uuid.uuid4()),
            "u": uid,
            "k": "PRODUCT",
            "s": str(uuid.uuid4()),
            "p": "10.00",
            "at": "2026-08-29T12:00:00+00:00",
            "mv": "4.1.0",
        }
        row.update(over)
        with head_engine.begin() as conn:
            conn.execute(
                sa.text(
                    "INSERT INTO price_observations"
                    " (id, owner_uid, subject_kind, subject_id, observed_price, observed_at,"
                    "  model_version)"
                    " VALUES (:id, :u, :k, :s, CAST(:p AS numeric), CAST(:at AS timestamptz), :mv)"
                ),
                row,
            )

    _insert()  # o caso bom
    for bad, _why in (
        ({"k": "SCENARIO"}, "subject_kind fora do enum"),
        ({"p": "-1"}, "dinheiro negativo"),
        ({"p": "NaN"}, "NaN (numeric aceita, e NaN = NaN é TRUE)"),
        ({"at": "infinity"}, "instante infinito"),
        ({"mv": "  "}, "model_version em branco"),
    ):
        with pytest.raises(IntegrityError, match="violates check constraint"):
            _insert(**bad)


def test_products_gained_the_sellers_declared_price_only(head_engine: sa.Engine) -> None:
    """O único dinheiro que entra em `products` é DECLARADO pelo vendedor (ADR-0033 §3) — e o
    prefixo `seller_` faz qualquer uso indevido ler errado em voz alta."""
    cols = {c["name"]: c for c in sa.inspect(head_engine).get_columns("products")}
    assert cols["seller_fixed_price"]["nullable"] is True
    assert str(cols["seller_fixed_price"]["type"]) == "NUMERIC(12, 2)"
    assert cols["seller_fixed_at"]["nullable"] is True
    assert "TIMESTAMP" in str(cols["seller_fixed_at"]["type"]).upper()
    assert "ck_products_seller_fixed_price_valid" in _constraint_names(head_engine, "products", "c")
    # Nenhuma coluna de preço CALCULADO nasceu junto (o invariante do E2 segue verificável por
    # ausência — é a razão de a observação morar em tabela própria).
    assert not [
        n
        for n in cols
        if "price" in n and n not in {"seller_fixed_price"} and not n.startswith("filament_")
    ]


@pytest.mark.parametrize("table", _CATALOG_TABLES)
def test_catalog_tables_have_name_norm_and_partial_unique_index(
    head_engine: sa.Engine, table: str
) -> None:
    cols = {c["name"]: c for c in sa.inspect(head_engine).get_columns(table)}
    assert cols["name_norm"]["nullable"] is False
    assert str(cols["name_norm"]["type"]) == "TEXT"
    with head_engine.connect() as conn:
        ddl = conn.execute(
            sa.text("SELECT indexdef FROM pg_indexes WHERE indexname = :n"),
            {"n": f"uq_{table}_owner_name_norm"},
        ).scalar_one()
    assert "UNIQUE INDEX" in ddl
    assert "owner_uid" in ddl and "name_norm" in ddl
    # PARCIAL: um item apagado não pode reservar o nome dele para sempre (ADR-0033 §4).
    assert "WHERE (deleted_at IS NULL)" in ddl


def test_bom_lines_has_no_name_norm_index(head_engine: sa.Engine) -> None:
    """`bom_lines` não tem `deleted_at` — o kit raiz governa o ciclo de vida —, então o índice
    parcial não teria predicado e a unicidade por conta nem faria sentido lá."""
    names = {i["name"] for i in sa.inspect(head_engine).get_indexes("bom_lines")}
    assert "uq_bom_lines_owner_name_norm" not in names


def test_partial_unique_index_lets_a_deleted_row_free_the_name(head_engine: sa.Engine) -> None:
    uid = f"mig8-{uuid.uuid4().hex[:8]}"
    with head_engine.begin() as conn:
        conn.execute(sa.text("INSERT INTO accounts (account_uid) VALUES (:u)"), {"u": uid})
        conn.execute(
            sa.text(
                "INSERT INTO boms (id, owner_uid, name, name_norm, deleted_at)"
                " VALUES (:i, :u, 'Gancho', 'gancho', now())"
            ),
            {"i": str(uuid.uuid4()), "u": uid},
        )
        conn.execute(
            sa.text(
                "INSERT INTO boms (id, owner_uid, name, name_norm)"
                " VALUES (:i, :u, 'Gancho', 'gancho')"
            ),
            {"i": str(uuid.uuid4()), "u": uid},
        )
    with (
        pytest.raises(IntegrityError, match="uq_boms_owner_name_norm"),
        head_engine.begin() as conn,
    ):
        conn.execute(
            sa.text(
                "INSERT INTO boms (id, owner_uid, name, name_norm)"
                " VALUES (:i, :u, 'gancho', 'gancho')"
            ),
            {"i": str(uuid.uuid4()), "u": uid},
        )


# --- (b)+(c) backfill sobre LEGADO + downgrade, em container PRÓPRIO ----------------------------

_LONG = "Á" * 5000  # "Á" — 5.000 chars: a norm cabe no índice só porque é truncada em 200


def _seed_0007(conn: sa.Connection, owner: str) -> None:
    conn.execute(sa.text("INSERT INTO accounts (account_uid) VALUES (:u)"), {"u": owner})
    for i, name in enumerate(("Gancho", "gancho ", "GANCHO", _LONG)):
        deleted = "now()" if name == "GANCHO" else "NULL"
        ts = f"2026-01-0{i + 1}T10:00:00+00:00"
        args = {"i": str(uuid.uuid4()), "u": owner, "n": name, "t": ts}
        conn.execute(
            sa.text(
                "INSERT INTO filaments (id, owner_uid, name, cost_per_roll, roll_weight_kg,"  # noqa: S608 - tabela literal deste teste, nunca entrada de usuário
                " created_at, deleted_at)"
                f" VALUES (:i, :u, :n, 100, 1, CAST(:t AS timestamptz), {deleted})"
            ),
            args,
        )
        conn.execute(
            sa.text(
                "INSERT INTO printers (id, owner_uid, name, machine_value,"  # noqa: S608 - tabela literal deste teste, nunca entrada de usuário
                " machine_lifetime_hours, avg_power_kw, created_at, deleted_at)"
                f" VALUES (:i, :u, :n, 2000, 5000, 0.2, CAST(:t AS timestamptz), {deleted})"
            ),
            {**args, "i": str(uuid.uuid4())},
        )
        conn.execute(
            sa.text(
                "INSERT INTO products (id, owner_uid, name, print_grams, print_time_hours,"  # noqa: S608 - tabela literal deste teste, nunca entrada de usuário
                " tariff_per_kwh, markup_varejo_pct, markup_atacado_pct,"
                " filament_cost_per_roll, filament_roll_weight_kg, printer_machine_value,"
                " printer_machine_lifetime_hours, printer_avg_power_kw,"
                " printer_maintenance_reserve_per_hour, created_at, deleted_at)"
                " VALUES (:i, :u, :n, 30, 2, 0.9, 200, 100, 100, 1, 2000, 5000, 0.2, 0,"
                f" CAST(:t AS timestamptz), {deleted})"
            ),
            {**args, "i": str(uuid.uuid4())},
        )
        conn.execute(
            sa.text(
                "INSERT INTO boms (id, owner_uid, name, created_at, deleted_at)"  # noqa: S608 - tabela literal deste teste, nunca entrada de usuário
                f" VALUES (:i, :u, :n, CAST(:t AS timestamptz), {deleted})"
            ),
            {**args, "i": str(uuid.uuid4())},
        )


def test_backfill_over_legacy_rows_then_downgrade() -> None:
    """Guarda de mutação (o que este teste existe para pegar): criar o índice único ANTES do
    backfill, ou desempatar sem excluir os apagados, deixa o `upgrade` VERMELHO aqui — e é
    exatamente o passo que só quebraria num banco com histórico."""
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
            command.upgrade(cfg, "0007")
            with engine.begin() as conn:
                assert "name_norm" not in {
                    c["name"] for c in sa.inspect(conn).get_columns("products")
                }
                _seed_0007(conn, "owner-a")
                _seed_0007(conn, "owner-b")

            command.upgrade(cfg, "0008")  # o passo que precisava concluir sobre legado colidente

            for table in _CATALOG_TABLES:
                with engine.connect() as conn:
                    rows = conn.execute(
                        sa.text(
                            f"SELECT name, name_norm, deleted_at FROM {table}"  # noqa: S608 - tabela literal deste teste, nunca entrada de usuário
                            " WHERE owner_uid = 'owner-a' ORDER BY created_at"
                        )
                    ).all()
                nomes = [r.name for r in rows]
                norms = [r.name_norm for r in rows]
                # NADA descartado e o `name` legado INTOCADO (R6).
                assert nomes == ["Gancho", "gancho ", "GANCHO", _LONG], table
                # Vivos desempatam em silêncio; o APAGADO não desempata (o índice o ignora).
                assert norms[0] == "gancho", table
                assert norms[1] == "gancho (2)", table
                assert norms[2] == "gancho", table
                # `left(norm, 200)` — o índice btree cabe sem CHECK de comprimento no banco.
                assert norms[3] == "a" * 200, table
                assert len(rows[3].name) == 5000, table
                # A conta B é um universo à parte: "por conta + tipo" (Q5).
                with engine.connect() as conn:
                    outro = conn.execute(
                        sa.text(
                            f"SELECT name_norm FROM {table} WHERE owner_uid = 'owner-b'"  # noqa: S608 - tabela literal deste teste, nunca entrada de usuário
                            " ORDER BY created_at LIMIT 1"
                        )
                    ).scalar_one()
                assert outro == "gancho", table

            command.downgrade(cfg, "0007")
            insp = sa.inspect(engine)
            assert insp.get_table_names().count("price_observations") == 0
            for table in _CATALOG_TABLES:
                assert "name_norm" not in {c["name"] for c in insp.get_columns(table)}
                assert f"uq_{table}_owner_name_norm" not in {
                    i["name"] for i in insp.get_indexes(table)
                }
            produtos = {c["name"] for c in insp.get_columns("products")}
            assert "seller_fixed_price" not in produtos and "seller_fixed_at" not in produtos
            # O que sobreviveu ao downgrade: as LINHAS de catálogo (o `name` nunca foi tocado).
            with engine.connect() as conn:
                assert conn.execute(sa.text("SELECT count(*) FROM products")).scalar_one() == 8
        finally:
            engine.dispose()
            if old is None:
                os.environ.pop("P3D_DATABASE_URL", None)
            else:
                os.environ["P3D_DATABASE_URL"] = old
            get_settings.cache_clear()
            reset_engine_for_tests()
