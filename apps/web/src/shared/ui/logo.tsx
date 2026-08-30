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
 * (research R10). Dark theme uses the white-wordmark variant so the lockup
 * keeps contrast on the black plane.
 *
 * 016/US3 (T013) — `variant="full"` now renders the owner's actual artwork (a raster PNG,
 * 403×160, exported at 2x+ density) instead of the placeholder SVG that drew the wordmark with
 * a system `<text>` element — that was never the brand's art. `variant="mark"` is UNCHANGED
 * (still the `tf-symbol-*.svg` compact mark) — only the full horizontal lockup was replaced.
 */
export function Logo({ variant = "full", alt, className = "", ...rest }: LogoProps) {
  const theme = useThemeStore((s) => s.theme);
  const decorative = alt === undefined;
  const src =
    variant === "full"
      ? `/brand/logo/logo-inteira-${theme === "dark" ? "white" : "black"}.png`
      : `/brand/logo/tf-symbol-color${theme === "dark" ? "-dark" : ""}.svg`;
  return (
    <img
      src={src}
      alt={decorative ? "" : alt}
      aria-hidden={decorative || undefined}
      className={["tf-logo", `tf-logo--${variant}`, className].filter(Boolean).join(" ")}
      {...rest}
    />
  );
}
