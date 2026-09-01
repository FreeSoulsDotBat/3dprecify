import { useMemo, useState } from "react";

import type { HistoryItem } from "@/entities/history/outbox";
import type { BomOut, ProductOut, SnapshotInHeadlineBasis } from "@/shared/api/generated";
import { useFeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import { Alert, Button, Card } from "@/shared/ui";

import {
    basisCaption,
    frozenPayloadOf,
    formatFrozenBRL,
    offsetOf,
    quotedDate,
} from "@/entities/history/history-format";

import { BASIS_TOTAL, recalcToday, structuralModelNote } from "./recalc-today";

// ⚠ @doc DEC-022 — única tela com congelado E vivo juntos: compara IGUAL com IGUAL, nunca
//   imprime um "hoje" que não calculou, e NÃO calcula a diferença (isso é `pricing-core`).

const t = messages.history;

export function CompareTodayBlock({
    item,
    product,
    kit,
}: {
    item: HistoryItem;
    product?: ProductOut;
    kit?: BomOut;
}) {
    const frozen = frozenPayloadOf(item);
    // No resolvable origin ⇒ there is no "today" to compare against, so the affordance is simply not
    // here. Silent, like the "abrir origem" link: a gone origin is not a problem the seller has
    // (FR-503), and a button that can only ever apologise is worse than no button.
    // 019/PR-E · US17 (T135) — "comparar com hoje" também não vale para um orçamento: a pergunta que
    // esta tela responde ("meu custo subiu desde que cotei?") se apoia em repreçar a origem, e o
    // orçamento não tem UMA origem — tem N, uma por item, mais um desconto que foi decisão do dia.
    // Um "hoje" aqui seria um número que ninguém calculou para aquele cliente.
    if (!frozen || frozen.kind === "QUOTE" || (!product && !kit)) return null;
    return <CompareBody item={item} product={product} kit={kit} />;
}

function CompareBody({
    item,
    product,
    kit,
}: {
    item: HistoryItem;
    product?: ProductOut;
    kit?: BomOut;
}) {
    const online = useOnline();
    const { catalog, source } = useFeeCatalog();
    const [open, setOpen] = useState(false);
    const frozen = frozenPayloadOf(item)!;

    // Priced once, when the seller asks — not on every render of the detail.
    const recalced = useMemo(
        () =>
            open
                ? recalcToday(frozen, { product, kit }, { catalog, source, now: Date.now() })
                : null,
        [open, frozen, product, kit, catalog, source],
    );

    const basis = item.headlineBasis as SnapshotInHeadlineBasis;
    // The ACTUAL outcome decides, never the presence of an origin.
    const todayTotal =
        recalced && !recalced.fromFrozen ? recalced.payload.totals[BASIS_TOTAL[basis]] : null;
    const date = quotedDate(item.deviceQuotedAt, offsetOf(item));

    if (!open) {
        return (
            <Button variant="ghost" onClick={() => setOpen(true)}>
                {t.compareAction}
            </Button>
        );
    }

    return (
        <Card className="tf-compare">
            {/* Same basis on both rows — stated once, above them. */}
            <span className="tf-historico__basis">{basisCaption(basis)}</span>

            {todayTotal ? (
                <>
                    <span className="tf-compare__row">
                        <span>{t.quotedAt.replace("{data}", date)}</span>
                        <strong>{formatFrozenBRL(item.headlineTotal)}</strong>
                    </span>
                    <span className="tf-compare__row">
                        <span>{t.compareToday}</span>
                        <strong>{formatFrozenBRL(todayTotal)}</strong>
                    </span>
                    {/* F3 — offline, "hoje" means the catalog cached on this device, which may be stale. */}
                    {!online && <p className="tf-historico__meta">{t.recalcOfflineNote}</p>}
                    {/* 016/T037 — the same structural note "Recalcular hoje" shows: part of the gap between
              the two numbers above may come purely from the model change, not a real cost move. */}
                    {structuralModelNote(frozen.modelVersion) && (
                        <Alert tone="info">{structuralModelNote(frozen.modelVersion)}</Alert>
                    )}
                    {/* Two totals side by side look exactly like something that just changed the record. */}
                    <p className="tf-historico__meta">{t.compareNote}</p>
                </>
            ) : (
                // We asked, and the answer is that we cannot answer. Said plainly, with the frozen number
                // left exactly where it was — never re-labelled as today's.
                <p className="tf-historico__meta">{t.compareUnavailable}</p>
            )}
        </Card>
    );
}
