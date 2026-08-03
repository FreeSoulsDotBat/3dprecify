"""015/A9 ([F05-001] + [F07-001]) — o gatilho de imutabilidade sabe a diferença entre APAGAR e
ANONIMIZAR, e prefere o segundo.

Antes desta migração o gatilho era `BEFORE UPDATE` apenas, e a consequência medida na auditoria era
uma inversão: um `DELETE` passava sem guarda nenhuma, enquanto anonimizar (trocar o titular, limpar
o payload, manter o registro contábil) estava PROIBIDO — `owner_uid` e `payload` são campos
congelados. O caminho legal disponível era o menos auditável.

As quatro condutas provadas aqui, e cada uma pode falhar de um jeito diferente:

  1. o uso normal continua congelado           — trocar `payload` sem anonimizar ainda explode
  2. a anonimização é PERMITIDA                — `owner_uid` + `payload` mudam com `anonymized_at`
  3. os fatos contábeis NÃO cedem              — nem durante a anonimização
  4. a anonimização é de MÃO ÚNICA             — `anonymized_at` não volta a NULL
  5. `DELETE` é recusado                       — a porta que estava aberta

A 1 é o CONTROLE POSITIVO da 2: sem ela, um gatilho que permitisse tudo passaria no teste de
anonimização e teria destruído a garantia do ADR-0019 sem que nenhuma asserção reclamasse.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
import sqlalchemy as sa
from sqlalchemy.exc import DBAPIError

from tests.conftest import requires_db

pytestmark = requires_db

TOMBSTONE = "anon-titular-removido"


def _mk_account(engine: sa.Engine, uid: str, email: str | None = None) -> None:
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "INSERT INTO accounts (account_uid, email, created_at, last_seen_at) "
                "VALUES (:u, :e, now(), now()) ON CONFLICT (account_uid) DO NOTHING"
            ),
            {"u": uid, "e": email},
        )


def _mk_snapshot(engine: sa.Engine, owner_uid: str) -> str:
    snap_id = str(uuid.uuid4())
    with engine.begin() as conn:
        conn.execute(
            sa.text("""
                INSERT INTO snapshots (
                    id, owner_uid, client_snapshot_id, kind, label, quote_validity_days,
                    device_quoted_at, device_utc_offset_minutes, model_version,
                    payload_schema_version, payload, headline_total, headline_basis,
                    created_at, updated_at
                ) VALUES (
                    :id, :owner, :csid, 'SINGLE', 'Peca do cliente Joao', 7,
                    :quoted, -180, '3.1.0', '1',
                    CAST(:payload AS jsonb), 123.45, 'PRECO_VAREJO', now(), now()
                )
            """),
            {
                "id": snap_id,
                "owner": owner_uid,
                "csid": str(uuid.uuid4()),
                "quoted": datetime.now(UTC),
                "payload": '{"sellerName": "Joao da Silva", "custoTotal": 100.0}',
            },
        )
    return snap_id


def _read(engine: sa.Engine, snap_id: str) -> sa.Row[tuple[str, str, str, float]]:
    with engine.connect() as conn:
        return conn.execute(
            sa.text(
                "SELECT owner_uid, payload::text, label, headline_total "
                "FROM snapshots WHERE id = :id"
            ),
            {"id": snap_id},
        ).one()


# ── 1. CONTROLE POSITIVO: o uso normal continua congelado ──────────────────────────────────────
def test_normal_update_of_payload_is_still_forbidden(migrated_db: str) -> None:
    """Sem este teste, um gatilho que permitisse TUDO passaria em todos os outros — e a garantia
    do ADR-0019 teria sido destruída sem nenhuma asserção reclamar."""
    engine = sa.create_engine(migrated_db)
    _mk_account(engine, "u-anon-controle")
    snap_id = _mk_snapshot(engine, "u-anon-controle")

    with pytest.raises(DBAPIError, match="immutable"), engine.begin() as conn:
        conn.execute(
            sa.text(
                "UPDATE snapshots SET payload = '{\"adulterado\": true}'::jsonb WHERE id = :id"
            ),
            {"id": snap_id},
        )


# ── 2. a anonimização é permitida ──────────────────────────────────────────────────────────────
def test_anonymisation_may_replace_owner_and_payload(migrated_db: str) -> None:
    engine = sa.create_engine(migrated_db)
    _mk_account(engine, "u-anon-titular", email="joao@exemplo.com")
    _mk_account(engine, TOMBSTONE)
    snap_id = _mk_snapshot(engine, "u-anon-titular")
    antes = _read(engine, snap_id)
    assert "Joao" in antes[1], "a fixture precisa carregar identidade, senao o teste nao prova nada"

    with engine.begin() as conn:
        conn.execute(
            sa.text("""
                UPDATE snapshots
                   SET owner_uid = :tomb,
                       payload = jsonb_build_object('custoTotal', payload->'custoTotal'),
                       label = 'Registro anonimizado',
                       anonymized_at = now()
                 WHERE id = :id
            """),
            {"tomb": TOMBSTONE, "id": snap_id},
        )

    depois = _read(engine, snap_id)
    assert depois[0] == TOMBSTONE
    assert "Joao" not in depois[1], "a identidade tinha de sair do payload"
    assert depois[3] == antes[3], "e o dinheiro tinha de ficar"


# ── 3. os fatos contábeis não cedem NEM durante a anonimização ─────────────────────────────────
@pytest.mark.parametrize(
    ("campo", "valor"),
    [
        ("headline_total", "999.99"),
        ("model_version", "'0.0.0'"),
        ("device_quoted_at", "now()"),
        ("kind", "'KIT'"),
    ],
)
def test_anonymisation_cannot_touch_accounting_facts(
    migrated_db: str, campo: str, valor: str
) -> None:
    """Anonimizar apaga QUEM. Nunca QUANTO, QUANDO ou COM QUAL FÓRMULA — senão a "manutenção do
    registro contábil" que justifica anonimizar em vez de apagar seria uma frase vazia."""
    engine = sa.create_engine(migrated_db)
    _mk_account(engine, f"u-anon-contabil-{campo}")
    _mk_account(engine, TOMBSTONE)
    snap_id = _mk_snapshot(engine, f"u-anon-contabil-{campo}")

    with (
        pytest.raises(DBAPIError, match="accounting facts are immutable"),
        engine.begin() as conn,
    ):
        conn.execute(
            # S608: `campo`/`valor` sao literais desta parametrizacao, nunca entrada externa —
            # e sao exatamente o que o teste precisa variar (nome de COLUNA nao e ligavel).
            sa.text(f"""
                UPDATE snapshots
                   SET owner_uid = :tomb, anonymized_at = now(), {campo} = {valor}
                 WHERE id = :id
            """),  # noqa: S608
            {"tomb": TOMBSTONE, "id": snap_id},
        )


# ── 4. mão única ───────────────────────────────────────────────────────────────────────────────
def test_anonymisation_cannot_be_undone(migrated_db: str) -> None:
    """Sem isto, "anonimizado" seria reversível por quem tivesse acesso ao banco — e a garantia
    dada ao titular valeria exatamente nada."""
    engine = sa.create_engine(migrated_db)
    _mk_account(engine, "u-anon-mao-unica")
    _mk_account(engine, TOMBSTONE)
    snap_id = _mk_snapshot(engine, "u-anon-mao-unica")
    with engine.begin() as conn:
        conn.execute(
            sa.text("UPDATE snapshots SET owner_uid = :tomb, anonymized_at = now() WHERE id = :id"),
            {"tomb": TOMBSTONE, "id": snap_id},
        )

    for tentativa in ("NULL", "now()"):
        with pytest.raises(DBAPIError, match="one-way"), engine.begin() as conn:
            conn.execute(
                # S608: `tentativa` e literal do laco acima ("NULL" / "now()").
                sa.text(f"UPDATE snapshots SET anonymized_at = {tentativa} WHERE id = :id"),  # noqa: S608
                {"id": snap_id},
            )


# ── 5. DELETE é recusado — a porta que estava aberta ───────────────────────────────────────────
def test_hard_delete_is_refused(migrated_db: str) -> None:
    """`[F07-001]`: o gatilho da 0003 era `BEFORE UPDATE`, e um `DELETE` passava sem guarda nenhuma.
    Verificado antes de fechar a porta: nada em `backend/app` nem nos testes apaga snapshot."""
    engine = sa.create_engine(migrated_db)
    _mk_account(engine, "u-anon-delete")
    snap_id = _mk_snapshot(engine, "u-anon-delete")

    with pytest.raises(DBAPIError, match="never hard-deleted"), engine.begin() as conn:
        conn.execute(sa.text("DELETE FROM snapshots WHERE id = :id"), {"id": snap_id})

    # e a linha continua lá — a recusa não é cosmética
    assert _read(engine, snap_id)[0] == "u-anon-delete"
