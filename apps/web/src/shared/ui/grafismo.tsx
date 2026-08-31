import { type CSSProperties, type HTMLAttributes } from "react";

import "./grafismo.css";

export type GrafismoName = "arco" | "espada" | "linha-curva" | "onda";

export interface GrafismoProps extends HTMLAttributes<HTMLSpanElement> {
    name: GrafismoName;
}

/**
 * Decorative brand flourish (research R10) — one per screen. Recoloured via
 * `currentColor` (CSS mask over the static SVG in `public/brand/grafismos`),
 * always `aria-hidden`, and reduced-motion safe (no animation).
 */
export function Grafismo({ name, className = "", style, ...rest }: GrafismoProps) {
    const vars = {
        "--tf-grafismo-src": `url("/brand/grafismos/${name}.svg")`,
        ...style,
    } as CSSProperties;
    return (
        <span
            aria-hidden="true"
            className={["tf-grafismo", `tf-grafismo--${name}`, className].filter(Boolean).join(" ")}
            style={vars}
            {...rest}
        />
    );
}
