import { type ButtonHTMLAttributes, forwardRef } from "react";

import { Spinner } from "./spinner";

import "./button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
export type ButtonSize = "sm" | "md" | "lg";
/** 019/PR-A — as duas larguras do botão solto em coluna (contracts/ui-porte.md §C0). Largura
 *  tirada do nº de letras do rótulo não é legítima; sem a prop, o botão segue no tamanho de
 *  conteúdo de sempre. */
export type ButtonWidth = "full" | "half";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    /** Shows an inline Spinner and blocks interaction; label stays for SR. */
    loading?: boolean;
    /** Optional purple rim-glow — one focal CTA per zone. */
    glow?: boolean;
    width?: ButtonWidth;
}

/** Primary action primitive. Min target 44×44px (WCAG 2.2 AA / INV-2). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = "primary",
        size = "md",
        loading = false,
        glow = false,
        width,
        disabled = false,
        type = "button",
        className = "",
        children,
        ...rest
    },
    ref,
) {
    const cls = [
        "tf-btn",
        `tf-btn--${variant}`,
        size !== "md" && `tf-btn--${size}`,
        glow && "tf-btn--glow",
        loading && "tf-btn--loading",
        width && `tf-btn--${width}`,
        className,
    ]
        .filter(Boolean)
        .join(" ");
    return (
        <button
            ref={ref}
            type={type}
            className={cls}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
            {...rest}
        >
            {loading && <Spinner size="sm" className="tf-btn__spin" />}
            <span className="tf-btn__label">{children}</span>
        </button>
    );
});
