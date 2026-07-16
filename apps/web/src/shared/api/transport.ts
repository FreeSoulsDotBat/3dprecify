// HTTP transport (decision A20 / R2-G2; closes D1). Two public entry points share one
// core so the behaviour is identical:
//   - `orvalFetch` — the Orval custom fetch mutator: the generated client (`generated.ts`)
//     calls THIS instead of raw `fetch`, so every generated request gets a fresh Firebase
//     ID token, the typed baseURL, and the ApiError normalisation for free (A9/T067).
//   - `apiFetch`   — the ergonomic hand-written entry: same transport, but returns the
//     parsed body directly (used by `entities/user/use-identity` where the `{data,…}`
//     envelope + phantom-422 union the generated hook carries would only add noise).
// Both inject a fresh token per request, resolve the baseURL from the typed env, normalise
// BOTH 4xx/5xx responses AND transport-phase failures (offline / DNS / connection refused /
// a failed token refresh) into a typed ApiError carrying the wire `code` + `correlationId`,
// and report that ApiError to Sentry (T069/D2; silent no-op with no DSN).

import { env } from "@/shared/lib/env";
import { auth } from "@/shared/lib/firebase";
import { reportError } from "@/shared/observability/sentry";

import { type ErrorCode, type ErrorEnvelope } from "./generated";

export type ApiErrorCode = ErrorCode | "UNKNOWN";

export interface ApiErrorInit {
  status: number;
  code: ApiErrorCode;
  message: string;
  correlationId: string | null;
}

/** Typed transport error. Never shown raw — mapped to pt-BR at the call site (T055). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly correlationId: string | null;

  constructor({ status, code, message, correlationId }: ApiErrorInit) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.correlationId = correlationId;
  }
}

// Sentry-tag hook point (T069/D2 — now live). Every typed transport failure is reported
// with the wire `code`, the `correlationId`, and the HTTP `status` as searchable tags.
// When no DSN is configured (dev / e2e / tests) `reportError` is a silent no-op, so the
// seam never changes call-site behaviour — it only makes the first real API call (A23)
// observable in prod.
function captureApiError(error: ApiError): void {
  reportError(error, {
    tags: { code: error.code, correlationId: error.correlationId, status: error.status },
  });
}

// Per-request timeout (hardening c/b). A hung request (server accepts the socket but never
// answers) would otherwise spin forever; 15s bounds it, aborting into the status-0 error path.
const REQUEST_TIMEOUT_MS = 15_000;

async function authHeaders(): Promise<Record<string, string>> {
  const user = auth?.currentUser;
  if (!user) return {};
  // A20: fresh token per request — the Firebase SDK caches + auto-refreshes.
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const base = env.VITE_API_BASE_URL.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? "" : "/"}${path}`;
}

// Origin allowlist (hardening c). The Firebase ID token is attached ONLY when the resolved
// URL is the configured API origin — relative paths resolve against the base, so they're
// same-origin by construction; an absolute URL to any OTHER origin never leaks the token.
function isApiOrigin(resolvedUrl: string): boolean {
  try {
    return new URL(resolvedUrl).origin === new URL(env.VITE_API_BASE_URL).origin;
  } catch {
    return false;
  }
}

interface RawResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

/** How to read a 2xx body. `blob` is for the server-rendered artifacts (009/T028, ADR-0020):
 *  `res.text()` decodes bytes as UTF-8 and silently CORRUPTS a PDF, so binary must opt out. An
 *  ERROR body is always JSON (the ErrorEnvelope) and is parsed as such regardless. */
type BodyMode = "auto" | "blob";

/**
 * Shared transport core. Sends the authenticated request and normalises transport-phase
 * failures AND 4xx/5xx responses into a thrown, Sentry-reported `ApiError`; on 2xx returns
 * the parsed body with its status + headers so either entry point can shape the result.
 */
async function request(
  path: string,
  init: RequestInit,
  mode: BodyMode = "auto",
): Promise<RawResponse> {
  const url = resolveUrl(path);

  // 15s timeout via an AbortController (hardening b). An externally-supplied signal is MERGED
  // in: aborting either the caller's signal OR the timeout cancels the same in-flight request.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (init.signal) {
    if (init.signal.aborted) controller.abort();
    else init.signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  let res: Response;
  try {
    const headers = new Headers(init.headers);
    // Origin allowlist (hardening c): only the API origin gets the token.
    if (isApiOrigin(url)) {
      for (const [key, value] of Object.entries(await authHeaders())) headers.set(key, value);
    }
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    res = await fetch(url, { ...init, headers, signal: controller.signal });
  } catch (cause) {
    // No HTTP response (offline / DNS / connection refused / token-refresh failure) OR the
    // 15s timeout / external abort (AbortError): normalise so callers — and Sentry — always
    // see a typed ApiError. status 0 = no response.
    const error = new ApiError({
      status: 0,
      code: "UNKNOWN",
      message: cause instanceof Error ? cause.message : "Network request failed",
      correlationId: null,
    });
    captureApiError(error);
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const headerCorrelationId = res.headers.get("X-Correlation-Id");
  const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;

  let body: unknown;
  try {
    if (res.status === 204) body = null;
    // Binary opts out ONLY on success: a failed export still answers with a JSON ErrorEnvelope, and
    // reading it as a Blob would throw away the `code` the call site needs (lapse vs generic).
    else if (mode === "blob" && res.ok) body = await res.blob();
    else body = isJson ? await res.json() : await res.text();
  } catch (cause) {
    // Malformed body (hardening a): e.g. a 502 that advertises JSON but returns an HTML error
    // page — `res.json()` throws a raw SyntaxError. Normalise to a typed ApiError carrying the
    // REAL response status + the header correlation id, and report it like any other failure.
    const error = new ApiError({
      status: res.status,
      code: "UNKNOWN",
      message: cause instanceof Error ? cause.message : `Malformed response body (${res.status})`,
      correlationId: headerCorrelationId,
    });
    captureApiError(error);
    throw error;
  }

  if (!res.ok) {
    const envelope = typeof body === "object" && body !== null ? (body as ErrorEnvelope) : null;
    const wire = envelope?.error;
    const error = new ApiError({
      status: res.status,
      code: wire?.code ?? "UNKNOWN",
      message: wire?.message ?? `Request failed (${res.status})`,
      correlationId: wire?.correlationId ?? headerCorrelationId ?? null,
    });
    captureApiError(error);
    throw error;
  }

  return { status: res.status, headers: res.headers, body };
}

/**
 * Ergonomic authenticated JSON fetch. Resolves to the parsed body on 2xx; throws a typed
 * ApiError (with `code` + `correlationId`) on 4xx/5xx. Used for direct app calls.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { body } = await request(path, init);
  return body as T;
}

/** A file the server rendered for us, with the name the SERVER chose (009/T028, ADR-0020). */
export interface FetchedFile {
  blob: Blob;
  /** From `Content-Disposition`; null when the server sent none — the caller then names it. */
  filename: string | null;
}

// `filename="orcamento.pdf"` / `filename=historico.csv` — the plain form the API actually sends.
// RFC 5987's `filename*=UTF-8''…` is deliberately NOT parsed: this backend never emits it, and a
// half-right decoder would be worse than an honest null (the caller has a sane default either way).
function filenameFrom(disposition: string | null): string | null {
  const match = /filename="?([^";]+)"?/i.exec(disposition ?? "");
  return match?.[1]?.trim() || null;
}

/**
 * Authenticated fetch for a SERVER-RENDERED file (009/T028). The generated Orval client cannot be
 * used for these: its mutator reads any non-JSON body with `res.text()`, which decodes the bytes as
 * UTF-8 and hands back a corrupted PDF. Everything else is identical — same token, same origin
 * allowlist, same timeout, same typed `ApiError` on 4xx/5xx (so a 403 still carries
 * `ENTITLEMENT_REQUIRED`). The generated URL builders stay the source of truth for the paths.
 */
export async function apiFetchFile(path: string, init: RequestInit = {}): Promise<FetchedFile> {
  const { headers, body } = await request(path, init, "blob");
  return { blob: body as Blob, filename: filenameFrom(headers.get("Content-Disposition")) };
}

/**
 * Orval custom fetch mutator (A9/T067). Orval binds `T` to the FULL response envelope type
 * and expects `{ data, status, headers }` back — which is why it can't reuse `apiFetch`'s
 * body-only return. On 4xx/5xx this throws `ApiError` (react-query surfaces it as
 * `query.error`), so the generated hooks' phantom `HTTPValidationError` `TError` is never
 * actually produced. Wired in `orval.config.ts`; the generated client calls this per request.
 */
export async function orvalFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const { status, headers, body } = await request(url, init);
  return { data: body, status, headers } as T;
}
