import {
    cloneElement,
    isValidElement,
    type HTMLAttributes,
    type ReactElement,
    type ReactNode,
} from "react";

import { messages } from "@/shared/i18n/messages.pt-br";

import { Icon, type IconName } from "./icon";

import "./alert.css";

export type AlertTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
    tone?: AlertTone;
    title?: ReactNode;
    children?: ReactNode;
    /** 019/PR-A — geometria densa do selo de procedência (12px/8px, ação de 18px). */
    compact?: boolean;
    /** 019/PR-A — link de ação dentro do selo (ex.: "Ver fonte"); `tf-alert__action`. */
    action?: ReactNode;
    /** 019/PR-A — presença = há dispensa (`tf-alert__close`); ausência = sem botão. */
    onDismiss?: () => void;
    /** 013/FC-02 — o DS não guarda copy; default de `messages.ds`, sobrescrevível por chamada. */
    dismissLabel?: string;
    /** 019/PR-C (prancheta 13b·3, decisão do dono 28/08) — sobrescreve o ícone padrão do `tone`
     *  (`TONE_ICON`); aditiva, sem a prop nada muda. */
    icon?: IconName;
}

/** `tf-alert__action` vive no elemento de ação em si (link/botão), não num wrapper — a folha o
 *  estiliza como link inline (`display: inline-flex`), e um `<span>` em volta quebraria isso. */
function withActionClass(action: ReactNode): ReactNode {
    if (!isValidElement(action)) return action;
    const el = action as ReactElement<{ className?: string }>;
    const cls = ["tf-alert__action", el.props.className].filter(Boolean).join(" ");
    return cloneElement(el, { className: cls });
}

const TONE_ICON: Record<AlertTone, IconName> = {
    neutral: "info",
    info: "info",
    success: "circle-check",
    warning: "triangle-alert",
    danger: "circle-alert",
};

/**
 * Inline message block. Danger is assertive (`role="alert"`); other tones are
 * polite status regions. Tone colour comes from semantic status-text tokens.
 */
export function Alert({
    tone = "info",
    title,
    className = "",
    children,
    compact = false,
    action,
    onDismiss,
    dismissLabel = messages.ds.dismiss,
    icon,
    ...rest
}: AlertProps) {
    const cls = ["tf-alert", `tf-alert--${tone}`, compact && "tf-alert--compact", className]
        .filter(Boolean)
        .join(" ");
    return (
        <div className={cls} role={tone === "danger" ? "alert" : "status"} {...rest}>
            <Icon name={icon ?? TONE_ICON[tone]} size={20} className="tf-alert__icon" />
            <div className="tf-alert__body">
                {title && <p className="tf-alert__title">{title}</p>}
                {children && <div className="tf-alert__text">{children}</div>}
                {action && withActionClass(action)}
            </div>
            {onDismiss && (
                <button
                    type="button"
                    className="tf-alert__close"
                    onClick={onDismiss}
                    aria-label={dismissLabel}
                >
                    <Icon name="x" size={16} />
                </button>
            )}
        </div>
    );
}
