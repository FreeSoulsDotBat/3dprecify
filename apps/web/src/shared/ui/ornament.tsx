import { type CSSProperties, type HTMLAttributes } from "react";

import "./ornament.css";

export type OrnamentName = "arc" | "sword" | "curved-line" | "wave";

export interface OrnamentProps extends HTMLAttributes<HTMLSpanElement> {
    name: OrnamentName;
}

/**
 * Decorative brand flourish (research R10) — one per screen. Recoloured via
 * `currentColor` (CSS mask over the static SVG in `public/brand/ornaments`),
 * always `aria-hidden`, and reduced-motion safe (no animation).
 */
export function Ornament({ name, className = "", style, ...rest }: OrnamentProps) {
    const vars = {
        "--tf-ornament-src": `url("/brand/ornaments/${name}.svg")`,
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
