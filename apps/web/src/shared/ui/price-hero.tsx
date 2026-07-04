import { type HTMLAttributes, type ReactNode } from "react";

import "./price-hero.css";

export type PriceHeroTone = "plain" | "accent" | "energy" | "inverse" | "success";

export interface PriceHeroProps extends HTMLAttributes<HTMLDivElement> {
  /** Eyebrow label, e.g. "Preço sugerido". */
  label?: ReactNode;
  /** Numeric value — formatted pt-BR with tabular figures. */
  value?: number;
  /** Sub-caption, e.g. "Varejo · markup 50%". */
  caption?: ReactNode;
  prefix?: string;
  tone?: PriceHeroTone;
  size?: "md" | "default" | "lg";
  center?: boolean;
  decimals?: number;
}

/** The hero suggested-price readout — the focal result of the calculator. */
export function PriceHero({
  label,
  value = 0,
  caption,
  prefix = "R$",
  tone = "accent",
  size = "default",
  center = false,
  decimals = 2,
  className = "",
  children,
  ...rest
}: PriceHeroProps) {
  const parts = Number(value || 0)
    .toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    .split(",");
  const int = parts[0];
  const dec = parts[1];
  const cls = [
    "tf-price",
    `tf-price--${tone}`,
    size !== "default" && `tf-price--${size}`,
    center && "tf-price--center",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {label && <span className="tf-price__label">{label}</span>}
      <div className="tf-price__amount">
        {prefix && <span className="tf-price__cur">{prefix}</span>}
        <span className="tf-price__int">{int}</span>
        {dec != null && <span className="tf-price__dec">,{dec}</span>}
      </div>
      {caption && <span className="tf-price__cap">{caption}</span>}
      {children}
    </div>
  );
}
