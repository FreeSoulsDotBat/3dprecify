import { type ReactNode } from "react";

import { Icon } from "./icon";

import "./aviso.css";

export interface AvisoProps {
  /** Texto do aviso (`tf-aviso__text`). */
  children: ReactNode;
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
export function Aviso({ children, action, className = "" }: AvisoProps) {
  return (
    <div className={["tf-aviso", className].filter(Boolean).join(" ")} role="status">
      <Icon name="info" size={16} className="tf-aviso__icon" />
      <div className="tf-aviso__body">
        <p className="tf-aviso__text">{children}</p>
        {action && <div className="tf-aviso__action">{action}</div>}
      </div>
    </div>
  );
}
