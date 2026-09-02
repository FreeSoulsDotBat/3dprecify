import { forwardRef, type InputHTMLAttributes } from "react";

import "./field.css";

export type TextFieldSize = "sm" | "md" | "lg";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
    /** Altura do controle — distinta do atributo nativo `size` (omitido, como no `NumberField`). */
    size?: TextFieldSize;
    error?: boolean;
}

// ⚠ @doc DEC-128 — o DS tinha `NumberField` e NÃO tinha o par de texto, então 13 arquivos escreviam
//   `<div class="tf-inputwrap"><input class="tf-input">` à mão. Primitivo que falta vira cópia.

/**
 * Entrada de TEXTO do DS — o par do `NumberField`, mesma moldura `tf-inputwrap` e mesmas variantes
 * de tamanho/erro/desabilitado. Controlado, como todo campo daqui.
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
    { size = "md", error = false, disabled = false, className = "", type = "text", ...rest },
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
            <input ref={ref} className="tf-input" type={type} disabled={disabled} {...rest} />
        </div>
    );
});
