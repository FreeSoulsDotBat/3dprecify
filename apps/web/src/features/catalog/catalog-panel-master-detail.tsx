import { type ReactNode, useState } from "react";

import { type PremiumGate } from "@/shared/billing/premium-gate";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Button, EmptyState, Icon } from "@/shared/ui";

import { captionText, rowNameStyle, rowSummaryStyle } from "./catalog-panel-styles";
import { type CatalogPanelRenderForm } from "./catalog-panel";

const catalogo = messages.catalog;

// 018/US1 — mestre-detalhe (≥1280px), extracted verbatim from `catalog-panel.tsx`'s `isWide`
// non-empty branch. Lista à esquerda, ficha do item à direita; a busca e a seleção seguem locais
// a este componente (nunca na URL — o comentário original em `catalog-panel.tsx` explica o porquê).

export function CatalogPanelMasterDetail<TItem extends { id: string }, TForm, TWire>({
    items,
    nameOf,
    summaryOf,
    rowMeta,
    noteOf,
    gate,
    priceVal,
    rowActions,
    addButton,
    count,
    renderForm,
    toFormValues,
    detailKicker,
    inlineError,
    onInlineSubmit,
    onInlineCancel,
    openEdit,
    saving,
}: {
    items: TItem[];
    nameOf: (item: TItem) => string;
    summaryOf: (item: TItem) => string;
    rowMeta?: (item: TItem) => string | undefined;
    noteOf?: (item: TItem) => string | undefined;
    gate: PremiumGate;
    priceVal: (item: TItem) => ReactNode;
    rowActions: (item: TItem) => ReactNode;
    addButton: (block?: boolean) => ReactNode;
    count: (n: number) => string;
    renderForm?: CatalogPanelRenderForm<TForm, TWire>;
    toFormValues?: (item: TItem) => TForm;
    detailKicker?: string;
    inlineError?: string;
    onInlineSubmit: (item: TItem, wire: TWire) => void;
    onInlineCancel: () => void;
    openEdit: (item: TItem) => void;
    saving?: boolean;
}) {
    // Estado local, NUNCA na URL: a aba continua vindo de `?tab=`, mas a seleção dentro de uma lista
    // é efêmera e escrevê-la na URL faria cada clique mexer no roteador sem que ninguém queira aquele
    // link (ADR-0031/C). A seleção "vaza" de seção sozinha? Não: a página monta um componente
    // DIFERENTE por seção, então trocar de aba desmonta este painel e o estado nasce limpo.
    const [query, setQuery] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const term = query.trim().toLowerCase();
    const visible = term
        ? items.filter((item) => `${nameOf(item)} ${summaryOf(item)}`.toLowerCase().includes(term))
        : items;
    // Derivada contra a lista ATUAL a cada render: item excluído, filtrado ou vindo de outro
    // aparelho cai para um item válido — nunca para uma ficha órfã.
    const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;

    return (
        <div className="tf-catalog-md">
            <div className="tf-catalog-md__master">
                <div className="tf-catalog-md__toolbar">
                    <label className="tf-inputwrap tf-catalog-md__search">
                        <span className="sr-only">{catalogo.searchLabel}</span>
                        <Icon name="search" size={18} aria-hidden />
                        <input
                            className="tf-input"
                            type="search"
                            value={query}
                            placeholder={catalogo.searchPlaceholder}
                            aria-label={catalogo.searchLabel}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                    </label>
                    <p style={captionText}>{count(visible.length)}</p>
                    {addButton()}
                </div>

                {visible.length === 0 ? (
                    // O vazio da BUSCA não é o vazio do catálogo: aqui existem itens salvos, o filtro é que
                    // não achou. Dizer "nenhum filamento salvo" seria mentira sobre os dados do vendedor.
                    <EmptyState
                        icon="package"
                        title={catalogo.searchEmpty.replace("{termo}", query.trim())}
                        action={
                            <Button variant="secondary" size="sm" onClick={() => setQuery("")}>
                                {catalogo.searchClear}
                            </Button>
                        }
                    />
                ) : (
                    <ul className="tf-catalog-md__list" data-testid="master-list">
                        {visible.map((item) => {
                            const isSelected = selected?.id === item.id;
                            return (
                                <li key={item.id}>
                                    <button
                                        type="button"
                                        data-testid="master-item"
                                        aria-current={isSelected ? "true" : undefined}
                                        className={`tf-card tf-card--interactive tf-catalog-md__card${
                                            isSelected ? " tf-catalog-md__card--selected" : ""
                                        }`}
                                        onClick={() => setSelectedId(item.id)}
                                    >
                                        {/* 019/PR-D (T076) — o conteúdo vira uma linha `tf-plist` (nome+meta à
                    esquerda, preço+era+flag à direita) SEM trocar o `<button>` de fora: os
                    testids/`aria-current` do mestre-detalhe (018/US1) continuam iguais. */}
                                        <span className="flex w-full items-start justify-between gap-3">
                                            <span className="tf-plist__main">
                                                <span style={rowNameStyle}>{nameOf(item)}</span>
                                                <span style={rowSummaryStyle}>
                                                    {summaryOf(item)}
                                                </span>
                                                {rowMeta?.(item) && (
                                                    <span style={rowSummaryStyle}>
                                                        {rowMeta(item)}
                                                    </span>
                                                )}
                                                {noteOf?.(item) && (
                                                    <span
                                                        style={rowSummaryStyle}
                                                        data-testid="row-note"
                                                    >
                                                        {noteOf(item)}
                                                    </span>
                                                )}
                                                {/* 019/PR-F (T098) — o `staleHint` POR LINHA saiu: a faixa "Modo leitura
                        offline" (`list.stale`, abaixo no rodapé do painel) já cobre a mesma
                        informação uma vez só, para a lista inteira. */}
                                                {gate === "lapsed" && (
                                                    <span style={rowSummaryStyle}>
                                                        {catalogo.readOnlyHint}
                                                    </span>
                                                )}
                                            </span>
                                            {priceVal(item)}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {selected && (
                <aside className="tf-card tf-catalog-md__detail" data-testid="detail-panel">
                    <header className="tf-catalog-md__detail-head">
                        <div className="tf-catalog-md__detail-title">
                            {detailKicker && (
                                <span className="tf-catalog-md__kicker">{detailKicker}</span>
                            )}
                            <h2>{nameOf(selected)}</h2>
                        </div>
                        <div className="flex items-center gap-1">{rowActions(selected)}</div>
                    </header>

                    {noteOf?.(selected) && <Alert tone="info">{noteOf(selected)}</Alert>}
                    {inlineError && <Alert tone="danger">{inlineError}</Alert>}

                    {renderForm && toFormValues ? (
                        // Filamento e impressora: a ficha É o editor. O MESMO formulário do Sheet, montado
                        // aqui — não uma segunda cópia (decisão do dono no clarify; research §E).
                        // `key` pelo id: sem ele o RHF manteria os defaultValues do item anterior, porque
                        // `defaultValues` só valem na montagem.
                        <div key={selected.id}>
                            {renderForm({
                                mode: "edit",
                                defaultValues: toFormValues(selected),
                                submitting: saving ?? false,
                                submitError: inlineError,
                                gate,
                                onSubmit:
                                    gate === "active"
                                        ? (wire) => onInlineSubmit(selected, wire)
                                        : undefined,
                                onCancel: onInlineCancel,
                            })}
                        </div>
                    ) : (
                        // Produto e kit: a ficha RESUME e manda para o editor de página cheia que já existe.
                        <div className="flex flex-col gap-3">
                            <p style={rowSummaryStyle}>{summaryOf(selected)}</p>
                            <Button variant="secondary" onClick={() => openEdit(selected)}>
                                <Icon name="pencil" size={18} aria-hidden />{" "}
                                {catalogo.detailOpenEditor}
                            </Button>
                        </div>
                    )}
                </aside>
            )}
        </div>
    );
}
