import { type HTMLAttributes, type ReactNode } from "react";

import { Icon } from "./icon";

import "./aviso.css";

export interface AvisoProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Texto do aviso (`tf-aviso__text`), quando é UMA frase só. Ignorado se `lines` for passado. */
  children?: ReactNode;
  /** 019/PR-C (T056, prancheta 14d) — quando o aviso soma DUAS frases (ex.: preço zerado + custo
   *  absurdo no mesmo resultado), cada uma vira seu próprio `<p class="tf-aviso__text">` — elas
   *  param de ser um parágrafo só (`join`), porque são dois fatos e cada um pede uma linha. */
  lines?: readonly ReactNode[];
  /** Slot da dispensa (ex.: um botão "Entendi"). Ausente quando o aviso acompanha uma recusa. */
  action?: ReactNode;
  className?: string;
}

/**
 * `tf-aviso` (019/T012·T018, PR-A, ADR-0032, contrato ui-porte.md §C0) — a 3ª categoria de
 * mensagem: nem dica, nem erro. O número é válido e a conta sai; o aviso só diz que ele
 * provavelmente significa outra coisa. `role="status"` porque é polido (acompanha, não
 * interrompe) — nunca `role="alert"`, que é do `tf-alert` de erro.
 */
export function Aviso({ children, lines, action, className = "", ...rest }: AvisoProps) {
  return (
    <div className={["tf-aviso", className].filter(Boolean).join(" ")} role="status" {...rest}>
      <Icon name="info" size={16} className="tf-aviso__icon" />
      <div className="tf-aviso__body">
        {lines ? (
          lines.map((line, i) => (
            <p className="tf-aviso__text" key={i}>
              {line}
            </p>
          ))
        ) : (
          <p className="tf-aviso__text">{children}</p>
        )}
        {action && <div className="tf-aviso__action">{action}</div>}
      </div>
    </div>
  );
}
