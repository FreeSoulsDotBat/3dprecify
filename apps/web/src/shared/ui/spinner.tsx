import { type HTMLAttributes } from "react";

import "./spinner.css";

export type SpinnerSize = "sm" | "md" | "lg";

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** SR-announced status label. Rendered visually hidden. */
  label?: string;
}

/** Indeterminate activity indicator. `role="status"` with an SR label. */
export function Spinner({
  size = "md",
  label = "Carregando…",
  className = "",
  ...rest
}: SpinnerProps) {
  const cls = ["tf-spinner", size !== "md" && `tf-spinner--${size}`, className]
    .filter(Boolean)
    .join(" ");
  return (
    <span role="status" className={cls} {...rest}>
      <span className="tf-spinner__ring" aria-hidden="true" />
      <span className="tf-vh">{label}</span>
    </span>
  );
}
