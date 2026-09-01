// ErrorCode → friendly pt-BR map (T055; closes analyze D1). The typed `ApiError` (T067) carries
// the wire `code`; Toast/Alert call sites resolve it to a human phrase here so users never see a
// raw wire token (FR-017). Copy is centralised in `messages.pt-br` (single source of UI copy) and
// is honest by construction (no payment provider, no price, no cancellation policy — FR-014).
//
// The map is a `Record<ApiErrorCode, string>`, so adding a new `ErrorCode` to the generated union
// is a COMPILE error here until a phrase is provided — the unit test (error-messages.test.ts) then
// proves every member resolves to a non-empty phrase at runtime.
import { messages } from "@/shared/i18n/messages.pt-br";

import { ErrorCode } from "./generated";
import { ApiError, type ApiErrorCode } from "./transport";

const MESSAGE_BY_CODE: Record<ApiErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: messages.apiError.validation,
  [ErrorCode.UNAUTHENTICATED]: messages.apiError.unauthenticated,
  [ErrorCode.TOKEN_EXPIRED]: messages.apiError.tokenExpired,
  [ErrorCode.FORBIDDEN]: messages.apiError.forbidden,
  [ErrorCode.NOT_FOUND]: messages.apiError.notFound,
  [ErrorCode.INTERNAL]: messages.apiError.internal,
  [ErrorCode.ENTITLEMENT_REQUIRED]: messages.apiError.entitlementRequired,
  // E6/T014 (F6 — no status-code jargon ever reaches the seller). This is the GENERIC fallback
  // for a code that a call site doesn't branch on specially; the checkout surface (409 conflict
  // / 503 unavailable) reads `messages.billing.*` directly for the honest, specific phrasing —
  // this entry only keeps the exhaustive `Record<ApiErrorCode, string>` a compile error away
  // from ever silently shipping a raw wire token.
  [ErrorCode.BILLING_UNAVAILABLE]: messages.billing.offerUnavailable,
  UNKNOWN: messages.apiError.unknown,
};

/** Friendly pt-BR phrase for a wire error code. Unmapped input degrades to the generic phrase. */
export function errorCodeMessage(code: ApiErrorCode): string {
  return MESSAGE_BY_CODE[code] ?? messages.apiError.unknown;
}

/** Convenience for the transport's typed error — maps its `code` to a friendly phrase. */
export function apiErrorMessage(error: ApiError): string {
  return errorCodeMessage(error.code);
}

/**
 * Escrita que falhou → linha pt-BR honesta e específica: nunca erro genérico, nunca salvamento
 * falso. Uma regra só para "como uma escrita negada fala".
 *
 * ⚠ @doc DEC-061 — causa NOMEADA é causa MEDIDA: um valor lançado que não é `ApiError` é falha
 *   inesperada do cliente, então a cópia NÃO pode dizer "precisa de conexão".
 */
export function honestWriteError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 0 ? messages.apiError.offlineWrite : apiErrorMessage(err);
  }
  return messages.apiError.unknown;
}
