import {
    SnapshotDetailPage,
    SnapshotEmbeddedContext,
} from "@/pages/historico/snapshot-detail-page";
import { messages } from "@/shared/i18n/messages.pt-br";
import { EmptyState } from "@/shared/ui";
import { PageHeader } from "@/widgets/page-header/page-header";

import { HistoryLedger } from "@/pages/historico/history-ledger";

const t = messages.history;

/**
 * 018/US2 — o mestre-detalhe: filtros + lista à esquerda, registro congelado à direita.
 *
 * Os dois lados são os componentes de sempre em modo `embedded` — nada foi recomposto, nada foi
 * duplicado. Consequência disso: as ações do registro (exportar, recalcular, comparar, excluir,
 * renomear) chegam aqui com as MESMAS regras de gate, porque são literalmente o mesmo código.
 */
export function HistoryMasterDetail({ snapshotId }: { snapshotId?: string }) {
    return (
        <section className="tf-historico mx-auto flex w-full tf-page-wide flex-col gap-4">
            <PageHeader title={t.title} />
            <p className="text-sm text-[var(--text-muted)]">{t.subtitle}</p>
            <div className="tf-historico-md">
                <div className="tf-historico-md__master">
                    <HistoryLedger embedded />
                </div>
                <aside className="tf-historico-md__detail">
                    {snapshotId ? (
                        <SnapshotEmbeddedContext.Provider value={true}>
                            <SnapshotDetailPage snapshotId={snapshotId} />
                        </SnapshotEmbeddedContext.Provider>
                    ) : (
                        // Sem registro escolhido (lista vazia, ou filtro que não achou nada): a coluna diz o
                        // que falta em vez de ficar em branco — e NÃO inventa um registro para preencher.
                        <EmptyState icon="history" title={t.emptyTitle} description={t.emptyBody} />
                    )}
                </aside>
            </div>
        </section>
    );
}
