import { type HTMLAttributes, type ReactNode, useId } from "react";

import "./field.css";

export interface FieldRenderProps {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    label?: ReactNode;
    /** 016/PR-C homologação (B4) — content rendered on the SAME row as the label (e.g. an
     *  `InfoTip` trigger), but a SIBLING of the `<label>`, never nested inside it: a `<label>`'s
     *  accessible-name computation folds in ALL descendant text, including a nested button's own
     *  name — a "Vida útil da máquina Sobre a vida útil da máquina" accessible name, confirmed the
     *  hard way (e2e `getByRole("textbox", …)` stopped resolving). It also frees the CONTROL row
     *  for the input alone, so a wide unit affix (e.g. "/kWh") no longer competes with the tip
     *  trigger for the same cramped row at 360/390px. */
    labelAddon?: ReactNode;
    htmlFor?: string;
    required?: boolean;
    /** Shows a muted "opcional" tag on the right of the label. */
    optional?: boolean;
    /** Reserve only ONE line for the label (default reserves two, to baseline-align 2-col grids).
     *  Use for a standalone full-width control whose label never wraps (e.g. a select). */
    tightLabel?: boolean;
    hint?: ReactNode;
    /** Error message — replaces the hint and sets aria-invalid on the control. */
    error?: ReactNode;
    /** A control element, or a render-fn given {id, aria-describedby, aria-invalid}. */
    children?: ReactNode | ((props: FieldRenderProps) => ReactNode);
}

/**
 * Label + hint + error wrapper with correct ARIA wiring. Compose around
 * NumberField/Input, or pass a render-fn that receives the wiring props.
 */
export function Field({
    label,
    labelAddon,
    htmlFor,
    required = false,
    optional = false,
    tightLabel = false,
    hint,
    error,
    children,
    className = "",
    ...rest
}: FieldProps) {
    const autoId = useId();
    const id = htmlFor ?? autoId;
    const hintId = hint ? `${id}-hint` : undefined;
    const errId = error ? `${id}-err` : undefined;
    const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
    const control =
        typeof children === "function"
            ? children({
                  id,
                  "aria-describedby": describedBy,
                  "aria-invalid": error ? true : undefined,
              })
            : children;
    return (
        <div className={`tf-field ${className}`.trim()} {...rest}>
            {(label || labelAddon) && (
                <div className="tf-field__label-row">
                    {label && (
                        <label
                            className={`tf-field__label${tightLabel ? " tf-field__label--tight" : ""}`}
                            htmlFor={id}
                        >
                            {label}
                            {required && (
                                <span className="tf-field__req" aria-hidden="true">
                                    *
                                </span>
                            )}
                            {optional && !required && (
                                <span className="tf-field__optional">opcional</span>
                            )}
                        </label>
                    )}
                    {labelAddon}
                </div>
            )}
            {control}
            {hint && !error && (
                <div className="tf-field__hint" id={hintId}>
                    {hint}
                </div>
            )}
            {error && (
                <div className="tf-field__error" id={errId} role="alert">
                    {error}
                </div>
            )}
        </div>
    );
}
