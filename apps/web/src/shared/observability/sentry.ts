import * as Sentry from "@sentry/react";

// FE observability (decision D2 / R2-G3; makes the 002 DoD claim true). Sentry is the
// error + breadcrumb sink. It initialises ONLY when a DSN is configured — dev, the e2e
// harness, and unit tests run without one, so this is a silent no-op there (Sentry is
// optional in dev, A22). Breadcrumbs (console / network / clicks / navigation) give the
// triager the trail that led to a captured error; the first real API call (A23) is born
// observable via the transport's `captureApiError` hook, and the router error boundary
// (pages/error) reports the failure with its support code as `correlationId`.

let initialised = false;

export interface InitObservabilityOptions {
  dsn?: string;
  release?: string;
  environment?: string;
}

/**
 * Initialise Sentry when a DSN is present. Returns whether Sentry was (or already is)
 * live, so callers/tests can assert the gating. No DSN → returns false and never touches
 * `Sentry.init` (silent no-op).
 */
export function initObservability({
  dsn,
  release,
  environment,
}: InitObservabilityOptions): boolean {
  if (!dsn) return false;
  if (initialised) return true;
  Sentry.init({
    dsn,
    release,
    environment,
    // Explicit breadcrumbs: console, network (fetch + xhr), clicks (dom), navigation
    // (history) — the trail decision D2 asks for.
    integrations: [
      Sentry.breadcrumbsIntegration({
        console: true,
        dom: true,
        fetch: true,
        xhr: true,
        history: true,
      }),
    ],
    // PII scrub (defence-in-depth with the Conta fix that dropped the email `title`): the DOM
    // breadcrumb instrumentation serializes clicked elements into a selector that can carry a
    // `title="…"` attribute. Redact any title value out of ui.* breadcrumbs so a titled element
    // (e.g. an email) never rides into Sentry.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category?.startsWith("ui.") && typeof breadcrumb.message === "string") {
        breadcrumb.message = breadcrumb.message.replace(/title="[^"]*"/g, 'title="[redacted]"');
      }
      return breadcrumb;
    },
  });
  initialised = true;
  return true;
}

export function isObservabilityInitialised(): boolean {
  return initialised;
}

/**
 * Report an error to Sentry with searchable tags. Safe when Sentry never initialised
 * (the SDK swallows the call). `null` / `undefined` tag values are dropped so we never
 * emit an empty-string `correlationId`. Call sites stay tag-explicit (`code`,
 * `correlationId`, `status`) so a captured `ApiError` is filterable in Sentry.
 */
export function reportError(
  error: unknown,
  context?: { tags?: Record<string, string | number | null | undefined> },
): void {
  const tags: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(context?.tags ?? {})) {
    if (value !== null && value !== undefined) tags[key] = value;
  }
  Sentry.captureException(error, Object.keys(tags).length > 0 ? { tags } : undefined);
}
