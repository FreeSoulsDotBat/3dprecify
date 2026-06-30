import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

import "./field.css";

export type NumberFieldSize = "sm" | "md" | "lg";

export interface NumberFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Control height — distinct from the native input `size` attribute (omitted). */
  size?: NumberFieldSize;
  /** Show the "R$" prefix. */
  currency?: boolean;
  /** Unit suffix, e.g. "g", "kg", "kWh", "h", "%". */
  unit?: ReactNode;
  error?: boolean;
}

/**
 * Money / quantity input tuned for pt-BR: R$ prefix, comma decimal, unit
 * suffix, numeric keypad on mobile, tabular figures. Controlled string value;
 * parse with parseDecimal (from "@/shared/lib/decimal-ptbr") on submit.
 */
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  {
    size = "md",
    currency = false,
    unit,
    error = false,
    disabled = false,
    inputMode = "decimal",
    placeholder = "0,00",
    className = "",
    id,
    ...rest
  },
  ref,
) {
  const wrapCls = [
    "tf-inputwrap",
    size !== "md" && `tf-inputwrap--${size}`,
    error && "tf-inputwrap--error",
    disabled && "tf-inputwrap--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={wrapCls}>
      {currency && <span className="tf-inputwrap__affix tf-inputwrap__affix--strong">R$</span>}
      <input
        ref={ref}
        id={id}
        className="tf-input tf-input--num"
        inputMode={inputMode}
        placeholder={placeholder}
        disabled={disabled}
        {...rest}
      />
      {unit && <span className="tf-inputwrap__affix">{unit}</span>}
    </div>
  );
});

// pt-BR parse/format live in shared/lib; re-exported here to match the design's
// NumberField API surface (consumers can import either path).
export { formatDecimal, parseDecimal } from "@/shared/lib/decimal-ptbr";
