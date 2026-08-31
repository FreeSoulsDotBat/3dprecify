import { type FieldsetHTMLAttributes, type ReactNode } from "react";

import "./frozen.css";

export interface FrozenProps extends Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "disabled"> {
    children?: ReactNode;
}

/**
 * Congelamento por fora, vivo por dentro — research.md §3 / handoff §1 (`tf-frozen`).
 *
 * `tf-frozen` **veste**, nunca inerta: quem torna o formulário inerte continua sendo o
 * `<fieldset disabled>` nativo (o produto já usa esse padrão em `filament-form.tsx` /
 * `produto-page.tsx`). Por isso não existe prop `disabled` aqui — não há como montar um
 * `<Frozen>` "congelado por fora, vivo por dentro"; o `disabled` é sempre `true`.
 *
 * Quem precisa continuar clicável (ex.: o caminho de assinatura) fica FORA do `<Frozen>` —
 * um `fieldset` desabilitado desabilita tudo dentro dele, sem exceção.
 */
export function Frozen({ className = "", children, ...rest }: FrozenProps) {
    const cls = ["tf-frozen", className].filter(Boolean).join(" ");
    return (
        <fieldset className={cls} {...rest} disabled>
            {children}
        </fieldset>
    );
}
