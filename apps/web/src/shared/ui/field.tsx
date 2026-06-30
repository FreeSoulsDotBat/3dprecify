import { type HTMLAttributes, type ReactNode, useId } from "react";

import "./field.css";

export interface FieldRenderProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  /** Shows a muted "opcional" tag on the right of the label. */
  optional?: boolean;
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
  htmlFor,
  required = false,
  optional = false,
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
      ? children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })
      : children;
  return (
    <div className={`tf-field ${className}`.trim()} {...rest}>
      {label && (
        <label className="tf-field__label" htmlFor={id}>
          {label}
          {required && (
            <span className="tf-field__req" aria-hidden="true">
              *
            </span>
          )}
          {optional && !required && <span className="tf-field__optional">opcional</span>}
        </label>
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
