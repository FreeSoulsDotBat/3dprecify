import { ApiError } from "@/shared/api/transport";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button } from "@/shared/ui";

interface ErrorPageProps {
  // TanStack Router passes { error, reset }; we only read `error` here.
  error?: unknown;
}

// Foundational router error-boundary stub (T024). US4 (T054) builds the full
// screen; the support code reads the correlationId from the typed ApiError
// surfaced by the T067 transport wrapper, else a local fallback id.
export function ErrorPage({ error }: ErrorPageProps) {
  const supportCode =
    error instanceof ApiError && error.correlationId
      ? error.correlationId
      : `local-${Date.now().toString(36)}`;
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 py-8 text-center">
      <h1 className="tf-title" style={{ fontSize: "var(--fs-xl)" }}>
        {messages.error.title}
      </h1>
      <p style={{ color: "var(--text-muted)" }}>{messages.error.body}</p>
      <div>
        <Button onClick={() => window.location.reload()}>{messages.error.reload}</Button>
      </div>
      <p style={{ color: "var(--text-faint)", fontSize: "var(--fs-caption)" }}>
        {messages.error.supportCode} {supportCode}
      </p>
    </section>
  );
}
