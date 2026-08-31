import { forwardRef, type SelectHTMLAttributes } from "react";

import "./field.css";
import "./select.css";

export interface SelectOption {
    value: string;
    label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
    options: readonly SelectOption[];
    /** Optional leading placeholder rendered as a disabled first row (empty value). */
    placeholder?: string;
    error?: boolean;
}

/**
 * Marketplace / modality picker. A native `<select>` skinned with the shared tf-input
 * frame so it inherits the same border/focus/error tokens as NumberField — and, being
 * native, opens the OS wheel picker on mobile (ideal at 390 px) with zero JS/deps. Drop
 * it into a DS `Field` render-fn exactly like NumberField.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
    { options, placeholder, error = false, disabled = false, className = "", value, ...rest },
    ref,
) {
    const wrapCls = [
        "tf-inputwrap",
        "tf-selectwrap",
        error && "tf-inputwrap--error",
        disabled && "tf-inputwrap--disabled",
        className,
    ]
        .filter(Boolean)
        .join(" ");
    return (
        <div className={wrapCls}>
            <select
                ref={ref}
                className="tf-input tf-select"
                disabled={disabled}
                value={value}
                {...rest}
            >
                {placeholder !== undefined && (
                    <option value="" disabled>
                        {placeholder}
                    </option>
                )}
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
            <span className="tf-select__caret" aria-hidden="true">
                ▾
            </span>
        </div>
    );
});
