import { type QuoteDiscountMode, type QuoteResult } from "@3dprecify/pricing-core";

import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import {
    Alert,
    Aviso,
    BreakdownRow,
    Button,
    Card,
    Field,
    Icon,
    NumberField,
    Select,
} from "@/shared/ui";

import {
    itemId,
    itemName,
    type QuoteCatalogItem,
    type QuoteLineInputResult,
} from "./quote-catalog-item";

const t = messages.quote;
const th = messages.history;
const tb = messages.bom;

// ── 019/PR-E — Revisão (18d + 18e num passo só — ver decisão de fidelidade em `quote-builder.tsx`) ──
// Extraído verbatim do segundo `return` do `QuoteBuilder`. Só lê e emite intenção; `QuoteBuilder`
// segue dono de todo o estado (desconto, validade, envio).

export function QuoteReview({
    selected,
    items,
    resultById,
    perItemRange,
    quoteResult,
    discountMode,
    onDiscountModeChange,
    discountValue,
    onDiscountValueChange,
    discountNum,
    validityDays,
    onValidityDaysChange,
    validityN,
    validUntilLabel,
    online,
    sending,
    sent,
    onBack,
    onSend,
}: {
    selected: Map<string, string>;
    items: QuoteCatalogItem[];
    resultById: Map<string, QuoteLineInputResult | null>;
    perItemRange: Map<string, { start: number; end: number }>;
    quoteResult: QuoteResult;
    discountMode: QuoteDiscountMode;
    onDiscountModeChange: (mode: QuoteDiscountMode) => void;
    discountValue: string;
    onDiscountValueChange: (value: string) => void;
    discountNum: number;
    validityDays: string;
    onValidityDaysChange: (value: string) => void;
    validityN: number;
    validUntilLabel: string;
    online: boolean;
    sending: boolean;
    sent: boolean;
    onBack: () => void;
    onSend: () => void;
}) {
    return (
        <div className="flex flex-col gap-4" data-testid="quote-builder">
            <Card padding="md" className="flex flex-col gap-2">
                {[...selected.entries()].map(([id]) => {
                    const item = items.find((it) => itemId(it) === id);
                    const result = resultById.get(id);
                    const range = perItemRange.get(id);
                    if (!item || !result || !range) return null;
                    const itemLines = quoteResult.lines.slice(range.start, range.end);
                    const subtotal = itemLines.reduce((sum, l) => sum + l.subtotal, 0);
                    return (
                        <div
                            key={id}
                            data-testid={`quote-line-${id}`}
                            className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-2 last:border-0 last:pb-0"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{itemName(item)}</span>
                                <span className="tf-tnum text-sm font-semibold">
                                    {formatBRL(subtotal)}
                                </span>
                            </div>
                            {/* Kit: cada peça aparece — a degradada (D6, ADR-0017 §6) com a legenda que o produto
                  já usa, nunca um erro ou um sumiço silencioso. */}
                            {item.kind === "KIT" &&
                                itemLines.map((l, i) => (
                                    <span key={i} className="text-xs text-[var(--text-muted)]">
                                        {l.name ?? tb.lineAdhoc} · {l.quantity} un.
                                    </span>
                                ))}
                        </div>
                    );
                })}
            </Card>

            <Card padding="md" className="flex flex-col gap-3">
                <Field label={t.discountLabel} tightLabel>
                    <div className="flex gap-2">
                        <Select
                            data-testid="quote-discount-mode"
                            value={discountMode}
                            onChange={(e) =>
                                onDiscountModeChange(e.target.value as QuoteDiscountMode)
                            }
                            options={[
                                { value: "PCT", label: "%" },
                                { value: "AMOUNT", label: "R$" },
                            ]}
                        />
                        <NumberField
                            data-testid="quote-discount-value"
                            inputMode="decimal"
                            value={discountValue}
                            onChange={(e) => onDiscountValueChange(e.target.value)}
                        />
                    </div>
                </Field>

                <BreakdownRow
                    label={t.subtotal}
                    value={quoteResult.grossTotal}
                    data-testid="quote-gross"
                />
                {discountNum > 0 && (
                    <BreakdownRow
                        label={
                            discountMode === "PCT"
                                ? t.discountLine.replace("{pct}", discountValue)
                                : t.discountAmountLine
                        }
                        value={-quoteResult.discountAmount}
                        data-testid="quote-discount-amount"
                    />
                )}
                <BreakdownRow
                    label={t.total}
                    value={quoteResult.netTotal}
                    emphasis="total"
                    data-testid="quote-net"
                />
                {/* Sobra sobre o custo — SÓ a linha apagada (o limiar "aperta, mas passa" da 18d·2 não foi
            decidido, e T088 pede para não inventar regra de dinheiro; ver nota no topo de
            `quote-builder.tsx`). */}
                {!quoteResult.belowCost && (
                    <BreakdownRow
                        label={t.marginOverCost}
                        sublabel={t.marginOverCostSub.replace(
                            "{valor}",
                            formatBRL(quoteResult.costFloor),
                        )}
                        value={quoteResult.netTotal - quoteResult.costFloor}
                        emphasis="muted"
                        data-testid="quote-cost-floor"
                    />
                )}
                {/* Q10 (ADR-0034 §1.5) — avisa, nunca bloqueia. O Enviar continua vivo. */}
                {quoteResult.belowCost && (
                    <Alert tone="warning" data-testid="quote-below-cost">
                        {t.belowCost.replace(
                            "{valor}",
                            formatBRL(quoteResult.costFloor - quoteResult.netTotal),
                        )}
                    </Alert>
                )}
            </Card>

            {/* 18e — o cartão "Enviar congela este preço" é o PASSO final do construtor (a prancheta o
          desenha como cartão do fluxo, com Voltar | Enviar; não um modal por cima — leitura
          registrada em dod-evidence para a 2ª passada). O título e o "Total enviado" vêm dela. */}
            <Card padding="md" className="flex flex-col gap-3">
                <h2 className="tf-title text-[var(--text-strong)]">{t.sendTitle}</h2>
                <BreakdownRow
                    label={t.totalSent}
                    value={formatBRL(quoteResult.netTotal)}
                    prefix=""
                />
                <Field label={th.validityField}>
                    {({ id, ...aria }) => (
                        <NumberField
                            id={id}
                            {...aria}
                            unit={th.validityUnit}
                            inputMode="numeric"
                            min={1}
                            max={3650}
                            value={validityDays}
                            onChange={(e) => onValidityDaysChange(e.target.value)}
                        />
                    )}
                </Field>

                <BreakdownRow
                    data-testid="quote-valid-until"
                    label={t.validUntil}
                    sublabel={t.validUntilSub.replace("{n}", String(validityN))}
                    value={validUntilLabel}
                    prefix=""
                />

                {/* 18e — "lock" não existe no conjunto curado; `Aviso` já usa `info` por padrão. */}
                <Aviso>{t.freezeNote.replace(/\{data\}/g, validUntilLabel)}</Aviso>
            </Card>

            <div className="flex flex-col gap-2">
                {!online && (
                    <p data-testid="quote-send-reason" className="text-sm text-[var(--text-muted)]">
                        {t.sendOffline}
                    </p>
                )}
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={onBack}>
                        {t.back}
                    </Button>
                    <Button
                        data-testid="quote-send"
                        disabled={!online || sending || sent || selected.size === 0}
                        loading={sending}
                        onClick={onSend}
                    >
                        <Icon name="share-2" size={16} />
                        {t.send}
                    </Button>
                </div>
            </div>
        </div>
    );
}
