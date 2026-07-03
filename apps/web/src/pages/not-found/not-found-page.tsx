import { Link } from "@tanstack/react-router";

import { messages } from "@/shared/i18n/messages.pt-br";
import { EmptyState } from "@/shared/ui";

// Foundational 404 stub (T024). US4 (T053) hardens the branded not-found screen.
export function NotFoundPage() {
  return (
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
  );
}
