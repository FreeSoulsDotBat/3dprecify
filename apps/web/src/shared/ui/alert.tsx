import { type HTMLAttributes, type ReactNode } from "react";

import { Icon, type IconName } from "./icon";

import "./alert.css";

export type AlertTone = "neutral" | "info" | "success" | "danger";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
}

const TONE_ICON: Record<AlertTone, IconName> = {
  neutral: "info",
  info: "info",
  success: "circle-check",
  danger: "circle-alert",
};

/**
 * Inline message block. Danger is assertive (`role="alert"`); other tones are
 * polite status regions. Tone colour comes from semantic status-text tokens.
 */
export function Alert({ tone = "info", title, className = "", children, ...rest }: AlertProps) {
  const cls = ["tf-alert", `tf-alert--${tone}`, className].filter(Boolean).join(" ");
  return (
    <div className={cls} role={tone === "danger" ? "alert" : "status"} {...rest}>
      <Icon name={TONE_ICON[tone]} size={20} className="tf-alert__icon" />
      <div className="tf-alert__body">
        {title && <p className="tf-alert__title">{title}</p>}
        {children && <div className="tf-alert__text">{children}</div>}
      </div>
    </div>
  );
}
