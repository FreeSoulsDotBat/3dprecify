"""015/A9 ([F05-001] + [F07-001]) — a exclusão de conta ganha um caminho AUDITÁVEL, e o caminho
destrutivo deixa de ser o único disponível.

A auditoria pré-provisionamento mediu uma inversão perigosa no gatilho de imutabilidade do E4
(ADR-0019, migração 0003):

    ele é ``BEFORE UPDATE``. Um ``DELETE FROM snapshots`` remove o registro inteiro sem encontrar
    guarda nenhuma — enquanto ANONIMIZAR (trocar o titular e limpar o payload, mantendo o registro
    contábil) está BLOQUEADO, porque ``owner_uid`` e ``payload`` estão entre os campos congelados.

Ou seja: quando a exclusão de conta da LGPD (art. 18, VI) for exercida, o caminho legal disponível
seria o MENOS auditável — sumir com a linha — e o MAIS auditável estaria proibido. Esta migração
inverte isso, e roda AGORA por um motivo de custo, não de gosto: enquanto não há snapshot em
produção ela é uma migração vazia; depois do provisionamento ela roda sobre dado imutável de gente
que pagou.

O que muda:

1. ``snapshots.anonymized_at`` — a marca da transição, e ela é de MÃO ÚNICA por construção: uma vez
   preenchida, o gatilho recusa voltá-la a NULL ou alterá-la. Não é uma convenção de aplicação;
   é o banco.

2. O gatilho de UPDATE passa a reconhecer UMA transição especial (``anonymized_at`` saindo de NULL):
   nela, e só nela, ``owner_uid``, ``payload`` e ``label`` podem mudar. **Os fatos contábeis
   continuam congelados em todas as circunstâncias** — ``id``, ``created_at``, ``device_quoted_at``,
   ``headline_total``, ``headline_basis``, ``model_version``, ``kind``. Anonimizar apaga QUEM, nunca
   QUANTO ou QUANDO.

3. Um gatilho ``BEFORE DELETE`` que recusa. Verificado antes de escrever: não existe
   ``DELETE FROM snapshots`` nem ``delete(Snapshot)`` em ``backend/app`` nem nos testes — o app só
   faz soft-delete via ``deleted_at``. O gatilho não quebra nada de hoje; ele fecha a porta que
   estava aberta para amanhã.

Consequência assumida, e escrita para o próximo leitor: um snapshot **nunca** poderá ser removido
por SQL comum. Uma purga futura (retenção fiscal expirada, por exemplo) exigirá uma migração que
derrube o gatilho de propósito — e é assim que se quer: apagar registro contábil deve custar uma
decisão explícita e versionada, não um ``DELETE``.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: str | Sequence[str] | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# O gatilho de UPDATE, reescrito. A diferença em relação ao da 0003 é a variável `anonimizando`.
IMMUTABILITY_TRIGGER_FN_V2 = """
CREATE OR REPLACE FUNCTION snapshots_forbid_content_update() RETURNS trigger AS $$
DECLARE
    anonimizando boolean;
BEGIN
    -- A transição de anonimização: `anonymized_at` saindo de NULL, exatamente uma vez.
    anonimizando := (OLD.anonymized_at IS NULL AND NEW.anonymized_at IS NOT NULL);

    -- Mão única: uma vez anonimizado, a marca não volta nem se move. Sem isto, "anonimizar" seria
    -- reversível por quem tivesse acesso ao banco, e a garantia valeria zero.
    IF (OLD.anonymized_at IS NOT NULL
        AND NEW.anonymized_at IS DISTINCT FROM OLD.anonymized_at) THEN
        RAISE EXCEPTION
            'anonymisation is one-way (015/A9): anonymized_at may never be cleared or moved'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Os fatos CONTÁBEIS. Congelados sempre — inclusive durante a anonimização, que apaga quem
    -- fez a cotação e nunca quanto ela foi, quando foi, ou com qual fórmula.
    IF (NEW.id IS DISTINCT FROM OLD.id)
        OR (NEW.client_snapshot_id IS DISTINCT FROM OLD.client_snapshot_id)
        OR (NEW.kind IS DISTINCT FROM OLD.kind)
        OR (NEW.quote_validity_days IS DISTINCT FROM OLD.quote_validity_days)
        OR (NEW.device_quoted_at IS DISTINCT FROM OLD.device_quoted_at)
        OR (NEW.device_utc_offset_minutes IS DISTINCT FROM OLD.device_utc_offset_minutes)
        OR (NEW.model_version IS DISTINCT FROM OLD.model_version)
        OR (NEW.payload_schema_version IS DISTINCT FROM OLD.payload_schema_version)
        OR (NEW.headline_total IS DISTINCT FROM OLD.headline_total)
        OR (NEW.headline_basis IS DISTINCT FROM OLD.headline_basis)
        OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
    THEN
        RAISE EXCEPTION
            'snapshot accounting facts are immutable (FR-504/ADR-0019): not even anonymisation may change id, kind, dates, totals or model_version'
            USING ERRCODE = 'check_violation';
    END IF;

    -- Os campos que carregam IDENTIDADE. Congelados no uso normal; liberados SÓ na transição.
    IF NOT anonimizando THEN
        IF (NEW.owner_uid IS DISTINCT FROM OLD.owner_uid)
            OR (NEW.payload IS DISTINCT FROM OLD.payload)
        THEN
            RAISE EXCEPTION
                'snapshot contents are immutable (FR-504/ADR-0019): only label, deleted_at and updated_at may change'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""

FORBID_DELETE_FN = """
CREATE OR REPLACE FUNCTION snapshots_forbid_delete() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION
        'snapshots are never hard-deleted (015/A9): use deleted_at to hide, or the anonymisation path to honour an LGPD erasure request'
        USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
"""

# O gatilho da 0003, palavra por palavra — o `downgrade` volta exatamente a ele.
IMMUTABILITY_TRIGGER_FN_V1 = """
CREATE OR REPLACE FUNCTION snapshots_forbid_content_update() RETURNS trigger AS $$
BEGIN
    -- Only the label, the soft-delete tombstone and updated_at may ever move (FR-504/ADR-0019).
    -- Everything else is the seller's recorded claim and is frozen for good.
    IF (NEW.owner_uid IS DISTINCT FROM OLD.owner_uid)
        OR (NEW.client_snapshot_id IS DISTINCT FROM OLD.client_snapshot_id)
        OR (NEW.kind IS DISTINCT FROM OLD.kind)
        OR (NEW.quote_validity_days IS DISTINCT FROM OLD.quote_validity_days)
        OR (NEW.device_quoted_at IS DISTINCT FROM OLD.device_quoted_at)
        OR (NEW.device_utc_offset_minutes IS DISTINCT FROM OLD.device_utc_offset_minutes)
        OR (NEW.model_version IS DISTINCT FROM OLD.model_version)
        OR (NEW.payload_schema_version IS DISTINCT FROM OLD.payload_schema_version)
        OR (NEW.payload IS DISTINCT FROM OLD.payload)
        OR (NEW.headline_total IS DISTINCT FROM OLD.headline_total)
        OR (NEW.headline_basis IS DISTINCT FROM OLD.headline_basis)
        OR (NEW.created_at IS DISTINCT FROM OLD.created_at)
        OR (NEW.id IS DISTINCT FROM OLD.id)
    THEN
        RAISE EXCEPTION
            'snapshot contents are immutable (FR-504/ADR-0019): only label, deleted_at and updated_at may change'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    op.add_column(
        "snapshots", sa.Column("anonymized_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.execute(IMMUTABILITY_TRIGGER_FN_V2)
    op.execute(FORBID_DELETE_FN)
    op.execute("""
        CREATE TRIGGER trg_snapshots_forbid_delete
        BEFORE DELETE ON snapshots
        FOR EACH ROW EXECUTE FUNCTION snapshots_forbid_delete();
    """)
    # ENABLE ALWAYS: espelha a escolha da 0003 — o gatilho vale inclusive em réplica/restauração,
    # e não só para a sessão comum. Um guarda que o `pg_restore` desliga não é um guarda.
    op.execute("ALTER TABLE snapshots ENABLE ALWAYS TRIGGER trg_snapshots_forbid_delete;")


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_snapshots_forbid_delete ON snapshots;")
    op.execute("DROP FUNCTION IF EXISTS snapshots_forbid_delete();")
    op.execute(IMMUTABILITY_TRIGGER_FN_V1)
    op.drop_column("snapshots", "anonymized_at")
