import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { formatDayMonthPtBr } from "@/shared/lib/format-date";
import { Button, Card, Field, Icon, NumberField, TextField } from "@/shared/ui";

import {
    itemId,
    itemName,
    itemBaseTotal,
    type QuoteCatalogItem,
    type QuoteLineInputResult,
} from "./quote-catalog-item";

const t = messages.quote;

// 019/PR-E (T088, US16/US17) — o passo "select" do construtor (18b), extraído verbatim de
// `quote-builder.tsx`. Só lê e emite intenção (tocar um item, digitar quantidade, avançar); quem
// possui os dados (`selected`, `resultById`, o total) continua sendo o `QuoteBuilder`.

export function QuoteItemPicker({
    clientLabel,
    onClientLabelChange,
    query,
    onQueryChange,
    filtered,
    resultById,
    selected,
    onToggle,
    onQtyChange,
    observations,
    grossTotal,
    onContinue,
}: {
    clientLabel: string;
    onClientLabelChange: (value: string) => void;
    query: string;
    onQueryChange: (value: string) => void;
    filtered: QuoteCatalogItem[];
    resultById: Map<string, QuoteLineInputResult | null>;
    selected: Map<string, string>;
    onToggle: (item: QuoteCatalogItem) => void;
    onQtyChange: (id: string, raw: string) => void;
    observations: ReadonlyMap<string, { observedAt: string }>;
    grossTotal: number;
    onContinue: () => void;
}) {
    return (
        <div className="flex flex-col gap-3" data-testid="quote-builder">
            <Field label={t.clientLabel}>
                {({ id, ...aria }) => (
                    <TextField
                        id={id}
                        {...aria}
                        type="text"
                        maxLength={120}
                        value={clientLabel}
                        onChange={(e) => onClientLabelChange(e.target.value)}
                    />
                )}
            </Field>

            <div className="tf-inputwrap">
                <Icon name="search" size={16} />
                <input
                    className="tf-input"
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                />
            </div>

            <div className="flex flex-col gap-2">
                {filtered.map((item) => {
                    const id = itemId(item);
                    const result = resultById.get(id);
                    const isSelected = selected.has(id);

                    if (result?.stopped) {
                        const product = item.kind === "PRODUCT" ? item.product : null;
                        const obs = product ? observations.get(product.id) : undefined;
                        const dataIso = obs?.observedAt ?? product?.updatedAt ?? "";
                        return (
                            <Card
                                key={id}
                                padding="sm"
                                data-testid={`quote-line-${id}`}
                                className="flex items-center gap-3 opacity-60"
                            >
                                <Icon
                                    name="triangle-alert"
                                    size={16}
                                    className="text-[var(--warning-text)]"
                                />
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-sm">{itemName(item)}</span>
                                    <span className="text-xs text-[var(--warning-text)]">
                                        {t.stoppedCannotQuote.replace(
                                            "{data}",
                                            formatDayMonthPtBr(dataIso),
                                        )}
                                    </span>
                                </div>
                            </Card>
                        );
                    }

                    const baseTotal = itemBaseTotal(result);
                    const priceLabel = baseTotal.failed ? "—" : formatBRL(baseTotal.value);

                    return (
                        <Card
                            key={id}
                            padding="sm"
                            interactive
                            data-testid={`quote-line-${id}`}
                            onClick={() => onToggle(item)}
                            className="flex items-center gap-3"
                        >
                            <Icon
                                name={isSelected ? "check" : "plus"}
                                size={16}
                                className={
                                    isSelected ? "text-[var(--accent)]" : "text-[var(--text-muted)]"
                                }
                            />
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="truncate text-sm font-semibold">
                                    {itemName(item)}
                                </span>
                                <span className="text-xs text-[var(--text-muted)]">
                                    {baseTotal.failed
                                        ? t.basePriceUnavailable
                                        : item.kind === "KIT"
                                          ? t.kitLineMeta
                                                .replace("{n}", selected.get(id) ?? "1")
                                                .replace("{pecas}", String(item.kit.lines.length))
                                          : t.unitPriceMeta.replace("{valor}", priceLabel)}
                                </span>
                            </div>
                            <span className="tf-tnum text-sm font-semibold">{priceLabel}</span>
                            {isSelected && (
                                <div onClick={(e) => e.stopPropagation()}>
                                    <NumberField
                                        size="sm"
                                        className="w-20"
                                        inputMode="numeric"
                                        data-testid={`quote-qty-${id}`}
                                        value={selected.get(id) ?? "1"}
                                        onChange={(e) => onQtyChange(id, e.target.value)}
                                    />
                                </div>
                            )}
                        </Card>
                    );
                })}
            </div>

            <div className="flex items-center gap-3 border-t border-[var(--border-subtle)] pt-3">
                <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-xs text-[var(--text-muted)]">
                        {selected.size === 1
                            ? t.itemCountOne
                            : t.itemCount.replace("{n}", String(selected.size))}
                    </span>
                    <span className="tf-tnum text-base font-semibold">{formatBRL(grossTotal)}</span>
                </div>
                <Button disabled={selected.size === 0} onClick={onContinue}>
                    {t.continueAction}
                </Button>
            </div>
        </div>
    );
}
