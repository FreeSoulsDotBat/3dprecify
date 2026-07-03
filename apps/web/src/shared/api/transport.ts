// HTTP transport wrapper (decision A20 / R2-G2; closes D1). This is the custom
// Orval fetch mutator: it injects a fresh Firebase ID token per authenticated
// request, resolves the baseURL from the typed env, and normalises 4xx/5xx into a
// typed ApiError carrying the wire `code` + `correlationId`. Sentry tagging has a
// hook point here (Sentry init itself is T069/D2). The post-login `/me` call that
// consumes this wrapper is wired in T068 (US5) — this module only builds the seam.

import { env } from "@/shared/lib/env";
import { auth } from "@/shared/lib/firebase";

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

// Sentry-tag hook point. Sentry is initialised in T069 (D2); until then this is a
// no-op seam so the first real API call (A23) is born observable.
function captureApiError(error: ApiError): void {
  // TODO(T069): Sentry.captureException(error, {
  //   tags: { code: error.code, correlationId: error.correlationId, status: error.status },
  // });
  void error;
}

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

/**
 * Authenticated JSON fetch. Resolves to the parsed body on 2xx; throws a typed
 * ApiError (with `code` + `correlationId`) on 4xx/5xx.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await authHeaders())) headers.set(key, value);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const res = await fetch(resolveUrl(path), { ...init, headers });

  const headerCorrelationId = res.headers.get("X-Correlation-Id");
  const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;
  const body = res.status === 204 ? null : isJson ? await res.json() : await res.text();

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

  return body as T;
}
