import { type ElementType, type HTMLAttributes, type ReactNode } from "react";

import "./card.css";

export type CardVariant = "default" | "flat" | "outline" | "ghost" | "inverse" | "accent";
export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLElement> {
    variant?: CardVariant;
    padding?: CardPadding;
    /** Hover-lift + keyboard focus, for clickable cards. */
    interactive?: boolean;
    as?: ElementType;
    children?: ReactNode;
}

/** Surface container — the matte panel the brand leans on. */
export function Card({
    variant = "default",
    padding = "md",
    interactive = false,
    as: Tag = "div",
    className = "",
    children,
    ...rest
}: CardProps) {
    const cls = [
        "tf-card",
        variant !== "default" && `tf-card--${variant}`,
        padding !== "md" && `tf-card--pad-${padding}`,
        interactive && "tf-card--interactive",
        className,
    ]
        .filter(Boolean)
        .join(" ");
    const extra = interactive && Tag !== "button" ? { tabIndex: 0, role: "button" } : {};
    return (
        <Tag className={cls} {...extra} {...rest}>
            {children}
        </Tag>
    );
}
