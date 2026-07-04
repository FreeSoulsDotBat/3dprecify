import { type HTMLAttributes, type ReactNode } from "react";

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

function fmt(v: number | string | undefined, prefix: string, decimals: number): ReactNode {
  if (typeof v !== "number") return v;
  const s = Math.abs(v).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
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
      {color && <span className="tf-brow__dot" style={{ background: color }} aria-hidden="true" />}
      <span className="tf-brow__main">
        <span className="tf-brow__label">{label}</span>
        {sublabel && <span className="tf-brow__sub">{sublabel}</span>}
      </span>
      <span className="tf-brow__val">{fmt(value, prefix, decimals)}</span>
    </div>
  );
}
