import { type HTMLAttributes } from "react";

import "./badge.css";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Small status pill. Tone text uses semantic status-text tokens (≥4.5:1, INV-3/4). */
export function Badge({ tone = "neutral", className = "", children, ...rest }: BadgeProps) {
  const cls = ["tf-badge", `tf-badge--${tone}`, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
}
