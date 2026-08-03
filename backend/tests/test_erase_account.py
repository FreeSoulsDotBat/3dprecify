"""015/A9 ([F05-001]) — o CLI de exclusão de conta atende o titular SEM apagar a contabilidade.

O que precisa ser verdade ao mesmo tempo, e é fácil entregar só metade:

  a lei  — o titular sai: e-mail some, uid vira pseudônimo aleatório, conteúdo dele é apagado
  o fisco — a venda não some: valor, data e versão da fórmula continuam legíveis no snapshot

Um teste que só verificasse (a) passaria com um `DELETE` geral — que é exatamente o caminho que a
`[F07-001]` chamou de "o menos auditável". Um que só verificasse (b) passaria sem apagar nada.
Por isso as duas metades são afirmadas na MESMA execução, sobre os MESMOS dados.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import sqlalchemy as sa

from app.scripts.erase_account import build_plan, erase
from tests.conftest import requires_db

pytestmark = requires_db

EMAIL = "titular.que.saiu@exemplo.com"


def _seed(engine: sa.Engine, uid: str) -> tuple[str, float]:
    """Uma conta com identidade no e-mail, no label e no payload — mais um snapshot com dinheiro."""
    snap_id = str(uuid.uuid4())
    total = 456.78
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid, email, created_at, last_seen_at) "
                "VALUES (:u, :e, now(), now())"
            ),
            {"u": uid, "e": EMAIL},
        )
        conn.execute(
            sa.text(
                "INSERT INTO filaments (id, owner_uid, name, material, cost_per_roll, "
                "roll_weight_kg, created_at, updated_at) "
                "VALUES (:i, :u, 'PLA do Joao', 'PLA', 120, 1, now(), now())"
            ),
            {"i": str(uuid.uuid4()), "u": uid},
        )
        conn.execute(
            sa.text("""
                INSERT INTO snapshots (
                    id, owner_uid, client_snapshot_id, kind, label, quote_validity_days,
                    device_quoted_at, device_utc_offset_minutes, model_version,
                    payload_schema_version, payload, headline_total, headline_basis,
                    created_at, updated_at
                ) VALUES (
                    :id, :u, :csid, 'SINGLE', 'Orcamento para o Joao', 7,
                    :quoted, -180, '3.1.0', '1', CAST(:payload AS jsonb),
                    :total, 'PRECO_VAREJO', now(), now()
                )
            """),
            {
                "id": snap_id,
                "u": uid,
                "csid": str(uuid.uuid4()),
                "quoted": datetime.now(UTC),
                "payload": '{"sellerName": "Joao da Silva", "custoTotal": 200.0,'
                ' "origin": {"kind": "PRODUCT", "id": "x", "name": "Peca do Joao"}}',
                "total": total,
            },
        )
    return snap_id, total


def test_erase_removes_the_person_and_keeps_the_money(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    uid = f"u-erase-{uuid.uuid4().hex[:8]}"
    snap_id, total = _seed(engine, uid)

    with engine.connect() as conn:
        plano = build_plan(conn, EMAIL)
    assert plano.account_uid == uid
    assert plano.owned["filaments"] == 1, "a fixture precisa ter conteudo, senao nao se prova nada"
    assert plano.retained["snapshots"] == 1

    with engine.begin() as conn:
        _, pseudonimo = erase(conn, EMAIL)

    with engine.connect() as conn:
        # --- a lei: o titular saiu ---
        assert (
            conn.execute(
                sa.text("SELECT count(*) FROM accounts WHERE account_uid = :u"), {"u": uid}
            ).scalar_one()
            == 0
        ), "a conta do titular tinha de sair"
        assert (
            conn.execute(
                sa.text("SELECT count(*) FROM accounts WHERE email = :e"), {"e": EMAIL}
            ).scalar_one()
            == 0
        ), "o e-mail nao pode sobreviver em lugar nenhum"
        assert (
            conn.execute(
                sa.text("SELECT count(*) FROM filaments WHERE owner_uid = :u"), {"u": uid}
            ).scalar_one()
            == 0
        ), "o conteudo do titular tinha de ser apagado"

        # --- o fisco: a venda ficou ---
        row = conn.execute(
            sa.text(
                "SELECT owner_uid, headline_total, model_version, device_quoted_at, "
                "payload::text, label, anonymized_at FROM snapshots WHERE id = :id"
            ),
            {"id": snap_id},
        ).one()

    assert row[0] == pseudonimo, "o snapshot tinha de seguir o pseudonimo, nao sumir"
    assert float(row[1]) == total, "o VALOR da venda nao pode mudar"
    assert row[2] == "3.1.0", "a versao da formula que precificou tem de continuar legivel"
    assert row[3] is not None, "a data da cotacao tem de continuar la"
    assert row[6] is not None, "e a marca de anonimizacao tem de estar carimbada"

    # --- e a identidade saiu de DENTRO do documento congelado, nao so do ponteiro ---
    assert "Joao" not in row[4], f"identidade sobreviveu no payload: {row[4]}"
    assert "origin" not in row[4], "a proveniencia capturada carrega o nome da peca do titular"
    assert row[5] is None, "o label e texto livre que o titular digitou"

    # --- o pseudonimo nao aponta para ninguem ---
    assert pseudonimo.startswith("anon-")
    assert uid not in pseudonimo, "o pseudonimo nao pode derivar do uid original"
