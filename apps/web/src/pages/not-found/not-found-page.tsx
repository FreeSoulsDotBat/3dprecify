import { Link } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { EmptyState } from "@/shared/ui";

import "./not-found-page.css";

// Branded 404 (T053 / SS-2). An on-brand EmptyState with a real way back to the public calculator
// (NAV-4) — never a dead-end blank frame. Copy is honest and calm (no commercial or alarming
// language). 019/T030: the decorative Grafismo LEFT (prancheta 24c — num beco, o ornamento acima
// do título só empurra a saída para baixo); centred on both axes per the sheet.
export function NotFoundPage() {
  return (
    <section className="tf-notfound">
      <EmptyState
        icon="triangle-alert"
        title={messages.notFound.title}
        description={messages.notFound.body}
        action={
          <Link to="/calcular" className="tf-btn tf-btn--primary">
            {messages.notFound.back}
          </Link>
        }
      />
    </section>
  );
}
