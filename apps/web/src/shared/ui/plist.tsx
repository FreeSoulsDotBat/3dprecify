import { type ReactNode } from "react";

import "./plist.css";

export type PlistFlagTone = "warning" | "neutral" | "success" | "danger";

export interface PlistFlag {
    label: ReactNode;
    tone?: PlistFlagTone;
}

export interface PlistItemData {
    id: string | number;
    name: ReactNode;
    /** Texto simples do meta, OU uma flag (marca da linha — "recalcular", "fixado" etc). */
    meta?: ReactNode | { flag: PlistFlag };
    price: ReactNode;
    /** Preço anterior, mostrado só quando o preço foi recalculado. */
    was?: ReactNode;
    onSelect?: () => void;
    selected?: boolean;
}

export interface PlistProps {
    items: readonly PlistItemData[];
    className?: string;
}

function isFlagMeta(meta: PlistItemData["meta"]): meta is { flag: PlistFlag } {
    return typeof meta === "object" && meta !== null && "flag" in meta;
}

/**
 * `tf-plist` (019/T012·T018, PR-A, ADR-0032, contrato ui-porte.md §C0) — a lista densa do
 * Catálogo a 390px. Medida (23b/handoff §1): o card salvo gastava 24px de padding + 1px de borda
 * para separar duas linhas de texto — cabiam 4 itens na dobra; como linha (filete, não caixa),
 * cabem 9. `list-style: none` some com o papel implícito de lista no VoiceOver do Safari, por isso
 * os papéis `list`/`listitem` são explícitos aqui.
 */
export function Plist({ items, className = "" }: PlistProps) {
    return (
        <ul className={["tf-plist", className].filter(Boolean).join(" ")} role="list">
            {items.map((item) => {
                const flag = isFlagMeta(item.meta) ? item.meta.flag : undefined;
                const metaText = isFlagMeta(item.meta) ? undefined : item.meta;
                const main = (
                    <span className="tf-plist__main">
                        <span className="tf-plist__name">{item.name}</span>
                        {flag ? (
                            <span className="tf-plist__meta">
                                <span
                                    className={[
                                        "tf-plist__flag",
                                        // "warning" é a cor BASE de `.tf-plist__flag` (folha, lote 18) — só
                                        // neutral/success/danger existem como modificador `--<tone>`.
                                        flag.tone &&
                                            flag.tone !== "warning" &&
                                            `tf-plist__flag--${flag.tone}`,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    {flag.label}
                                </span>
                            </span>
                        ) : (
                            metaText !== undefined &&
                            metaText !== null && <span className="tf-plist__meta">{metaText}</span>
                        )}
                    </span>
                );
                const val = (
                    <span className="tf-plist__val">
                        <span className="tf-plist__price">{item.price}</span>
                        {item.was !== undefined && item.was !== null && (
                            <span className="tf-plist__was">{item.was}</span>
                        )}
                    </span>
                );

                return (
                    <li key={item.id} role="listitem">
                        {item.onSelect ? (
                            <button
                                type="button"
                                className="tf-plist__row"
                                onClick={item.onSelect}
                                aria-selected={item.selected ? "true" : "false"}
                            >
                                {main}
                                {val}
                            </button>
                        ) : (
                            <span className="tf-plist__row">
                                {main}
                                {val}
                            </span>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}
