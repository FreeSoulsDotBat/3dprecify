import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { Table } from "@/shared/ui";

import { captionText } from "./catalog-panel-styles";

const catalogo = messages.catalogo;

// 019/PR-D (T076/T130, prancheta 16g) — 1024–1279px: `tf-table`, a coluna "Antes" é o "era R$ X" da
// lista promovida a coluna, e um travessão (`tableNoChange`) onde a linha não mudou. Extracted
// verbatim from `catalog-panel.tsx`'s `isDense` branch.

export function CatalogPanelDenseTable<TItem extends { id: string }>({
    items,
    count,
    addButton,
    nameOf,
    summaryOf,
    rowMeta,
    rowPrice,
    rowWas,
    rowActions,
    openEdit,
}: {
    items: TItem[];
    count: (n: number) => string;
    addButton: () => ReactNode;
    nameOf: (item: TItem) => string;
    summaryOf: (item: TItem) => string;
    rowMeta?: (item: TItem) => string | undefined;
    rowPrice?: (item: TItem) => number | undefined;
    rowWas?: (item: TItem) => number | undefined;
    rowActions: (item: TItem) => ReactNode;
    openEdit: (item: TItem) => void;
}) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
                <p style={captionText}>{count(items.length)}</p>
                {addButton()}
            </div>
            <Table>
                <thead>
                    <tr>
                        <th scope="col">{catalogo.tableColName}</th>
                        <th scope="col" style={{ textAlign: "right" }}>
                            {catalogo.tableColPrice}
                        </th>
                        <th scope="col" style={{ textAlign: "right" }}>
                            {catalogo.tableColBefore}
                        </th>
                        <th scope="col">{catalogo.tableColSavedAt}</th>
                        <th scope="col">
                            <span className="sr-only">{catalogo.tableColActions}</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const price = rowPrice?.(item);
                        const was = rowWas?.(item);
                        return (
                            <tr key={item.id}>
                                <td className="tf-table__name">
                                    {/* 019/PR-F (T099, achado do QA): o botão NÃO repete `tf-table__name` — a folha
                  (`table.css`) foi escrita para a CÉLULA, onde `max-width: 0` é inerte no
                  `table-layout: auto`; num `<button>` ele vale de verdade e o nome nascia com
                  largura ZERO (invisível e inclicável a 1024–1279, nas três abas — regressão da
                  PR-D que chegou a develop). O botão só herda a fonte da célula e trunca. */}
                                    <button
                                        type="button"
                                        onClick={() => openEdit(item)}
                                        className="block w-full min-w-0 truncate text-left"
                                    >
                                        {nameOf(item)}
                                    </button>
                                </td>
                                <td className="tf-table__num">
                                    {price !== undefined ? formatBRL(price) : "—"}
                                </td>
                                <td className="tf-table__num tf-table__num--muted">
                                    {was !== undefined ? formatBRL(was) : catalogo.tableNoChange}
                                </td>
                                <td>{rowMeta?.(item) ?? summaryOf(item)}</td>
                                <td className="tf-table__actions">{rowActions(item)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </Table>
        </div>
    );
}
