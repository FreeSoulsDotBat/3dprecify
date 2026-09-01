import { Link } from "@tanstack/react-router";

import {
    basisCaption,
    cardTitle,
    formatFrozenBRL,
    kindLabel,
    offsetOf,
    quotedDate,
    SYNC_BADGE,
} from "@/entities/history/history-format";
import type { HistoryItem } from "@/entities/history/outbox";
import { EntryActions } from "@/features/history/entry-actions";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Badge, Card } from "@/shared/ui";
import { useHistoricoSearch } from "@/pages/historico/historico-search";

// 019/Polish — moved verbatim out of history-ledger.tsx, along with the formatting helpers it
// reads from `entities/history/history-format` (unchanged imports, just re-sourced from this
// sibling instead of the page).

const t = messages.historico;

export function SnapshotCard({ item }: { item: HistoryItem }) {
    // 019/PR-E (T135) — o rótulo do registro mora em `entities/history` (`kindLabel`): a lista e o
    // detalhe têm de dizer a MESMA coisa sobre o mesmo registro, e a forma anterior aqui chamaria
    // todo orçamento de "Peça única".
    const kind = kindLabel(item);
    // 018 — achado A1 da minha própria homologação: no mestre-detalhe o registro abria à direita e
    // NENHUM card da lista ficava marcado. O vendedor perdia o vínculo entre o que escolheu e o que
    // está lendo — e a spec pede a marcação (FR-021). O Catálogo já marcava; aqui faltava.
    // Fora do mestre-detalhe (mobile) `?snapshot=` toma a tela inteira, então nada fica marcado —
    // que é o certo: não há lista para marcar.
    const aberto = useHistoricoSearch().snapshot;
    const selecionado = aberto === item.clientSnapshotId;

    // A blocked/failed/unauthenticated entry needs an escape hatch right where the seller sees it, or
    // it is a dead end that poisons every future sign-out (review PR-A, B2). Pending is drained by the
    // banner instead. hotfix 016/A3 (H4b): [Tentar novamente] on an `unauthenticated` entry is a safe
    // no-op when the session is still dead (it just reclassifies to `unauthenticated` again) and
    // genuinely succeeds once the seller has signed back in — never a dead button.
    const stuck =
        item.syncState === "blocked" ||
        item.syncState === "failed" ||
        item.syncState === "unauthenticated";

    return (
        <Link
            to="/historico"
            search={{ snapshot: item.clientSnapshotId }}
            className="tf-historico__link"
            id={`snap-${item.clientSnapshotId}`}
            aria-current={selecionado ? "true" : undefined}
        >
            <Card
                padding="sm"
                className={`tf-historico__card${selecionado ? " tf-historico__card--aberto" : ""}`}
            >
                <span className="tf-historico__label">{cardTitle(item)}</span>

                {item.syncState !== "synced" && (
                    <Badge tone={item.syncState === "failed" ? "danger" : "info"}>
                        {SYNC_BADGE[item.syncState]}
                    </Badge>
                )}

                {/* The date comes BEFORE the money. Always. */}
                <span className="tf-historico__meta">
                    {t.quotedAtCard.replace(
                        "{data}",
                        quotedDate(item.deviceQuotedAt, offsetOf(item)),
                    )}{" "}
                    · {kind}
                </span>

                <span className="tf-historico__money">
                    <span>{t.quotedValue}</span>
                    <strong>{formatFrozenBRL(item.headlineTotal)}</strong>
                </span>
                <span className="tf-historico__basis">{basisCaption(item.headlineBasis)}</span>

                {stuck && <EntryActions item={item} />}
            </Card>
        </Link>
    );
}
