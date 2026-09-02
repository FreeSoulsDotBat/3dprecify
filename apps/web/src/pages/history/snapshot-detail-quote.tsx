import {
    frozenKitLines,
    frozenQuoteLines,
    type FrozenSnapshotPayload,
} from "@/entities/history/frozen-payload";
import {
    formatFrozenBRL,
    offsetOf,
    quotedDate,
    validUntil,
} from "@/entities/history/history-format";
import type { HistoryItem } from "@/entities/history/outbox";
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow } from "@/shared/ui";

// 019/Polish — moved verbatim out of snapshot-detail-page.tsx: the orçamento document (US16) + the
// kit itemization (both "linhas do orçamento/kit"), discount block included where it always lived
// (inside `QuoteDocument`, never restructured).

const t = messages.history;
const tq = messages.quote;

/**
 * 019/PR-E · US16 (T135, ADR-0034 §2) — o ORÇAMENTO enviado, como documento.
 *
 * Três coisas que esta tela faz e que valem por escrito:
 *
 *   1. Itemiza `lines` com o dinheiro JÁ escalado que o documento carrega (`unitPrice`,
 *      `subtotal`) — nenhuma multiplicação acontece aqui, do mesmo jeito que nenhuma acontece no
 *      PDF (ADR-0020 §1). `quote.lineMeta` é "{n} un. × {valor}".
 *   2. Mostra o DESCONTO declarado: bruto → desconto → total. Um documento que mostrasse só o
 *      líquido esconderia a conta que o vendedor fez — e é a conta que o cliente recebeu.
 *   3. "Válido até" é TEXTO derivado da coluna `quoteValidityDays` (Q7): data do registro + os
 *      dias prometidos. Não há estado de vencimento; um orçamento nunca "vence" na lista.
 */
export function QuoteDocument({
    payload,
    validity,
    item,
}: {
    payload: FrozenSnapshotPayload;
    validity: number | null;
    item: HistoryItem;
}) {
    const lines = frozenQuoteLines(payload);
    const discount = payload.discount;
    const quoted = quotedDate(item.deviceQuotedAt, offsetOf(item));

    return (
        <div className="flex flex-col gap-2">
            {validity !== null && (
                <p className="tf-historico__meta" data-testid="quote-document-dates">
                    {tq.documentDates
                        .replace("{data}", quoted)
                        .replace("{ate}", validUntil(item, validity))}
                </p>
            )}

            <h2 className="tf-historico__section">
                {lines.length === 1
                    ? tq.itemCountOne
                    : tq.itemCount.replace("{n}", String(lines.length))}
            </h2>
            {lines.map((line, i) => (
                <span key={i} className="tf-historico__piece">
                    <span>{line.name ?? t.adhocFallback}</span>
                    <span className="tf-historico__qty">
                        {tq.lineMeta
                            .replace("{n}", String(line.quantity))
                            .replace("{valor}", formatFrozenBRL(line.unitPrice))}
                    </span>
                    <strong>{formatFrozenBRL(line.subtotal)}</strong>
                </span>
            ))}

            {/* O desconto só aparece quando foi DECLARADO — ausente não é zero (FR-507). */}
            {discount && (
                <>
                    <BreakdownRow
                        label={tq.subtotal}
                        value={formatFrozenBRL(discount.grossTotal)}
                    />
                    <BreakdownRow
                        label={
                            discount.mode === "PCT"
                                ? // O percentual é gravado com as duas casas da casa ("10.00"); na tela ele se lê
                                  // como o vendedor o digitou — formatação, nunca reescrita do que está gravado.
                                  tq.discountLine.replace(
                                      "{pct}",
                                      Number(discount.value).toLocaleString("pt-BR", {
                                          maximumFractionDigits: 2,
                                      }),
                                  )
                                : tq.discountAmountLine
                        }
                        value={`- ${formatFrozenBRL(discount.amount)}`}
                    />
                </>
            )}
            {payload.totals.precoOrcamento && (
                <BreakdownRow
                    label={tq.total}
                    value={formatFrozenBRL(payload.totals.precoOrcamento)}
                    emphasis="total"
                />
            )}
        </div>
    );
}

/** A kit quote ITEMIZES its pieces (SC-515) — with the names as CAPTURED, so the renderer never has
 *  to look anything up (and so a renamed product cannot rewrite a past quote). Each piece is priced
 *  at the SNAPSHOT'S headline basis (review PR-A, C1): a kit quoted at ATACADO itemizes at atacado,
 *  or the pieces would contradict the very total the seller charged (`freezeTotals` stores both). */
export function KitLines({ payload, basis }: { payload: FrozenSnapshotPayload; basis: string }) {
    return (
        <div className="flex flex-col gap-1">
            <h2 className="tf-historico__section">{t.kitPieces}</h2>
            {frozenKitLines(payload).map((line, i) => {
                const total =
                    basis === "PRECO_ATACADO" ? line.totals.precoAtacado : line.totals.precoVarejo;
                return (
                    <span key={i} className="tf-historico__piece">
                        <span>{line.name ?? t.adhocFallback}</span>
                        {/* A COUNT, not a "×" factor: `total` is ALREADY quantity-scaled (review PR-A, C2). */}
                        <span className="tf-historico__qty">
                            {t.kitPieceQty.replace("{n}", String(line.quantity))}
                        </span>
                        <strong>{total ? formatFrozenBRL(total) : "—"}</strong>
                    </span>
                );
            })}
        </div>
    );
}
