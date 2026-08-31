import { type HTMLAttributes, type ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./empty-state.css";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
    /** Optional decorative icon from the DS set. */
    icon?: IconName;
    title: ReactNode;
    description?: ReactNode;
    /** Optional call-to-action (e.g. a Button). */
    action?: ReactNode;
}

/** Centered empty/placeholder state — used by Catálogo/Histórico placeholders. */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className = "",
    ...rest
}: EmptyStateProps) {
    return (
        <div className={["tf-empty", className].filter(Boolean).join(" ")} {...rest}>
            {icon && (
                <span className="tf-empty__icon" aria-hidden="true">
                    <Icon name={icon} size={28} />
                </span>
            )}
            <h2 className="tf-empty__title">{title}</h2>
            {description && <p className="tf-empty__desc">{description}</p>}
            {action && <div className="tf-empty__action">{action}</div>}
        </div>
    );
}
