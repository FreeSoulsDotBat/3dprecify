import { type HTMLAttributes, type ReactNode } from "react";

import { formatDecimal } from "@/shared/lib/decimal-ptbr";

import "./breakdown-row.css";

export type BreakdownEmphasis = "default" | "muted" | "accent" | "negative" | "total";

export interface BreakdownRowProps extends HTMLAttributes<HTMLDivElement> {
    label: ReactNode;
    sublabel?: ReactNode;
    /** Number (formatted pt-BR) or a ready-made string. */
    value?: number | string;
    /** Colour key dot (e.g. a token) to tie the row to a chart/legend. */
    color?: string;
    emphasis?: BreakdownEmphasis;
    prefix?: string;
    decimals?: number;
}

// 3(3) (decisão do dono 2026-09-01) — os DÍGITOS vêm do formatador oficial (`formatDecimal`, a
// mesma casa de `formatBRL`); este componente era o segundo `toLocaleString("pt-BR")` do app, e
// ele imprime justamente o detalhamento do preço.
//
// O SINAL fica como está, e isso NÃO é a exceção que sobrou: o menos tipográfico (U+2212) é
// DESENHO, escrito na prancheta — "Dinheiro em pt-BR com fonte tabular, sinal de menos
// tipográfico: R$ 24,24, R$ 1.234,56, − R$ 3,80"
// (docs/design/prompts/inferidos/calculadora/estados-de-preco-por-canal.md:351) — e dois testes o
// pinam (`freight-line-names-its-control`, `price-results` prancheta 10c). A aprovação do dono
// para "padronizar" veio da minha descrição do sinal como detalhe imperceptível; a prancheta diz o
// contrário, então trocá-lo seria divergir do desenho dele sem decisão informada. A POSIÇÃO (sinal
// antes do prefixo) e `prefix`/`decimals` também seguem sendo deste componente.
function fmt(v: number | string | undefined, prefix: string, decimals: number): ReactNode {
    if (typeof v !== "number") return v;
    const s = formatDecimal(Math.abs(v), decimals);
    return `${v < 0 ? "−" : ""}${prefix ? `${prefix} ` : ""}${s}`;
}

/**
 * One itemised line of the price breakdown. Stack them; mark the last one
 * emphasis="total". Makes the math transparent.
 */
export function BreakdownRow({
    label,
    sublabel,
    value,
    color,
    emphasis = "default",
    prefix = "R$",
    decimals = 2,
    className = "",
    ...rest
}: BreakdownRowProps) {
    const cls = ["tf-brow", emphasis !== "default" && `tf-brow--${emphasis}`, className]
        .filter(Boolean)
        .join(" ");
    return (
        <div className={cls} {...rest}>
            {color && (
                <span className="tf-brow__dot" style={{ background: color }} aria-hidden="true" />
            )}
            <span className="tf-brow__main">
                <span className="tf-brow__label">{label}</span>
                {sublabel && <span className="tf-brow__sub">{sublabel}</span>}
            </span>
            <span className="tf-brow__val">{fmt(value, prefix, decimals)}</span>
        </div>
    );
}
