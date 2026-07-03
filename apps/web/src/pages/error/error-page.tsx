import { useMemo } from "react";

import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Grafismo } from "@/shared/ui";

import "./error-page.css";

interface ErrorPageProps {
  // TanStack Router passes { error, reset, info }; we read `error` for the support code.
  error?: unknown;
}

// Resolve the support code ONCE per error: the correlationId from a typed ApiError (A20 —
// X-Correlation-Id header/envelope surfaced by the T067 transport wrapper) when the failure is
// an API call, else a stable local fallback so the code the user quotes never drifts. Callers
// wrap this in a useMemo keyed on `error` (see below) to make "once per error" hold on re-render.
function resolveSupportCode(error: unknown): string {
  if (error instanceof ApiError && error.correlationId) return error.correlationId;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `local-${rand}`;
}

// Router error boundary (T054 / SS-3). On-brand generic error screen with a reload action and a
// discreet "Código de suporte: <id>" line for the user to quote. Honest, no blame, no commercial
// copy. (Sentry logging of code+correlationId is the T069/D2 follow-up.)
export function ErrorPage({ error }: ErrorPageProps) {
  const supportCode = useMemo(() => resolveSupportCode(error), [error]);
  return (
    <section className="tf-error">
      <Grafismo name="espada" className="tf-error__grafismo" />
      <h1 className="tf-error__title">{messages.error.title}</h1>
      <p className="tf-error__body">{messages.error.body}</p>
      <div className="tf-error__actions">
        <Button onClick={() => window.location.reload()}>{messages.error.reload}</Button>
      </div>
      <p className="tf-error__support">
        {messages.error.supportCode} <span className="tf-error__code">{supportCode}</span>
      </p>
    </section>
  );
}
