import { type ImgHTMLAttributes } from "react";

import { useThemeStore } from "./theme-store";

import "./logo.css";

export type LogoVariant = "full" | "mark";

export interface LogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  /** `full` = horizontal lockup, `mark` = compact symbol. */
  variant?: LogoVariant;
  /** Accessible name. Omit to render the logo decoratively (hidden from AT). */
  alt?: string;
}

/**
 * Brand logo — theme-aware colour art served static from `public/brand/logo`
 * (research R10). Dark theme uses the `-dark` (white-wordmark) variant so the
 * lockup keeps contrast on the black plane.
 */
export function Logo({ variant = "full", alt, className = "", ...rest }: LogoProps) {
  const theme = useThemeStore((s) => s.theme);
  const base = variant === "full" ? "tf-lockup" : "tf-symbol";
  const file = `${base}-color${theme === "dark" ? "-dark" : ""}.svg`;
  const decorative = alt === undefined;
  return (
    <img
      src={`/brand/logo/${file}`}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      className={["tf-logo", `tf-logo--${variant}`, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
