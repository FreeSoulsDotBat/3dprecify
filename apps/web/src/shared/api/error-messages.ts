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
import { type ApiError, type ApiErrorCode } from "./transport";

const MESSAGE_BY_CODE: Record<ApiErrorCode, string> = {
  [ErrorCode.VALIDATION_ERROR]: messages.apiError.validation,
  [ErrorCode.UNAUTHENTICATED]: messages.apiError.unauthenticated,
  [ErrorCode.TOKEN_EXPIRED]: messages.apiError.tokenExpired,
  [ErrorCode.FORBIDDEN]: messages.apiError.forbidden,
  [ErrorCode.NOT_FOUND]: messages.apiError.notFound,
  [ErrorCode.INTERNAL]: messages.apiError.internal,
  [ErrorCode.ENTITLEMENT_REQUIRED]: messages.apiError.entitlementRequired,
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
