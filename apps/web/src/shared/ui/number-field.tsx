import {
  type ChangeEvent,
  forwardRef,
  type FocusEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { formatDecimal, parseDecimal } from "@/shared/lib/decimal-ptbr";

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
  /** 019/PR-C (T053/T060) — casas decimais que a máscara de blur PRESERVA (default 2). A tarifa de
   *  energia chega com 4 casas (R$ 0,8734/kWh) e a máscara de 2 casas a truncava — o comentário
   *  abaixo ("nunca muda o valor semântico") era falso para 4 casas: 0,8734 virava 0,87. */
  precision?: number;
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
    precision = 2,
    disabled = false,
    inputMode = "decimal",
    placeholder = "0,00",
    className = "",
    id,
    value,
    onChange,
    onBlur,
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

  // 016/PR-C homologação (B2) — pt-BR thousands grouping ON BLUR, currency fields only ("todos os
  // campos currency ganham — consistência"). Never mid-typing (that would fight the caret); never
  // changes the SEMANTIC value — `parseDecimal` already reads "12345,67" and "12.345,67"
  // identically, so re-writing the STRING through the same onChange the caller already owns (RHF's
  // `field.onChange`) keeps the round trip exact. An unparseable/blank value is left exactly as
  // typed — the existing per-field validation error is what should explain it, not a silent rewrite.
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    if (currency && typeof value === "string" && value.trim() !== "" && onChange) {
      const n = parseDecimal(value);
      if (Number.isFinite(n)) {
        const grouped = formatDecimal(n, precision);
        if (grouped !== value) {
          e.target.value = grouped;
          onChange(e as unknown as ChangeEvent<HTMLInputElement>);
        }
      }
    }
    onBlur?.(e);
  };

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
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        {...rest}
      />
      {unit && <span className="tf-inputwrap__affix">{unit}</span>}
    </div>
  );
});

// pt-BR parse/format live in shared/lib; re-exported here to match the design's
// NumberField API surface (consumers can import either path).
export { formatDecimal, parseDecimal } from "@/shared/lib/decimal-ptbr";
