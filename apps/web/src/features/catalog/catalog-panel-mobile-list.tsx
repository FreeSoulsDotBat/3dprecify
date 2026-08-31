import { type ReactNode } from "react";

import { type PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Icon } from "@/shared/ui";

import { captionText } from "./catalog-panel-styles";

const catalogo = messages.catalogo;

// 019/PR-D (T076, prancheta 16a; achado do e2e T069) — a lista mobile (<1024px). Extracted verbatim
// from `catalog-panel.tsx`'s final `else` branch. A 390px a lista É a `tf-plist` de
// `shared/ui/plist.css` — linhas de 56px separadas por um filete, não cartões (com moldura o nome
// quebrava em três linhas e cabiam 4 itens na dobra). A linha inteira é o alvo de `openEdit`; os
// botões de ação ficam ao lado, fora da linha, porque a ficha do produto não tem duplicar/excluir
// (a folha da 16e não está nesta fatia). `truncate` na meta: `.tf-plist__meta` é `nowrap` sem
// corte, e um resumo "Filamento · Impressora" comprido viraria transbordo horizontal da página
// (SC-003).

export function CatalogPanelMobileList<TItem extends { id: string }>({
    items,
    count,
    addButton,
    nameOf,
    summaryOf,
    rowMeta,
    noteOf,
    gate,
    priceVal,
    onDuplicate,
    openEdit,
    onRemove,
}: {
    items: TItem[];
    count: (n: number) => string;
    addButton: () => ReactNode;
    nameOf: (item: TItem) => string;
    summaryOf: (item: TItem) => string;
    rowMeta?: (item: TItem) => string | undefined;
    noteOf?: (item: TItem) => string | undefined;
    gate: PremiumGate;
    priceVal: (item: TItem) => ReactNode;
    onDuplicate?: (item: TItem) => void;
    openEdit: (item: TItem) => void;
    onRemove: (item: TItem) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <p style={captionText}>{count(items.length)}</p>
                {addButton()}
            </div>
            <ul className="tf-plist">
                {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-1">
                        <button
                            type="button"
                            className="tf-plist__row min-w-0 flex-1"
                            onClick={() => openEdit(item)}
                        >
                            <span className="tf-plist__main">
                                <span className="tf-plist__name">{nameOf(item)}</span>
                                <span className="tf-plist__meta truncate">{summaryOf(item)}</span>
                                {rowMeta?.(item) && (
                                    <span className="tf-plist__meta truncate">{rowMeta(item)}</span>
                                )}
                                {noteOf?.(item) && (
                                    <span
                                        className="tf-plist__meta truncate"
                                        data-testid="row-note"
                                    >
                                        {noteOf(item)}
                                    </span>
                                )}
                                {/* 019/PR-F (T098) — o `staleHint` POR LINHA saiu (mesmo raciocínio do ramo
                mestre-detalhe): a faixa "Modo leitura offline" já cobre a lista inteira, uma vez
                só. */}
                                {gate === "lapsed" && (
                                    <span className="tf-plist__meta truncate">
                                        {catalogo.readOnlyHint}
                                    </span>
                                )}
                            </span>
                            {priceVal(item)}
                        </button>
                        <span className="flex shrink-0 items-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`${catalogo.edit} ${nameOf(item)}`}
                                onClick={() => openEdit(item)}
                            >
                                <Icon name="pencil" size={18} aria-hidden />
                            </Button>
                            {onDuplicate && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`${catalogo.duplicate} ${nameOf(item)}`}
                                    onClick={() => onDuplicate(item)}
                                >
                                    <Icon name="copy" size={18} aria-hidden />
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`${catalogo.remove} ${nameOf(item)}`}
                                // 013/FB-02 (T034 homologation nit): on lapsed, tapping delete must NOT open the
                                // working destructive confirm and then 403 on submit — ux-catalog §3: "Never show a
                                // delete/edit as *working* then fail — the intercept happens on tap, honestly." Edit
                                // already routes lapsed to the read-only reactivation surface; delete now mirrors it,
                                // so both write affordances land on the same honest intercept (the server's
                                // ENTITLEMENT_REQUIRED 403 stays the real backstop — this is presentation only).
                                onClick={() => onRemove(item)}
                            >
                                <Icon name="trash-2" size={18} aria-hidden />
                            </Button>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
