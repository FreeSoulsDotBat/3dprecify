import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { errorCodeMessage, honestWriteError } from "./error-messages";
import { ErrorCode } from "./generated";
import { ApiError } from "./transport";

// T055 / analyze D1. The ErrorCode→friendly-pt-BR map is the single seam that keeps raw wire
// codes off the screen (FR-017). This asserts EVERY member of the generated `ErrorCode` union
// (plus the transport's "UNKNOWN" fallback) resolves to a non-empty pt-BR phrase — so a newly
// added backend code can never silently surface as a raw token.
describe("errorCodeMessage (T055 / US4 — D1)", () => {
  it("maps every generated ErrorCode member to a non-empty phrase", () => {
    for (const code of Object.values(ErrorCode)) {
      const phrase = errorCodeMessage(code);
      expect(phrase.trim().length, `empty phrase for ${code}`).toBeGreaterThan(0);
    }
  });

  it("maps the UNKNOWN fallback to a non-empty phrase", () => {
    expect(errorCodeMessage("UNKNOWN").trim().length).toBeGreaterThan(0);
  });

  it("never surfaces the raw wire code to the user", () => {
    for (const code of Object.values(ErrorCode)) {
      expect(errorCodeMessage(code)).not.toContain(code);
    }
  });
});

// 016/T072-A9 — the cause named must be the cause MEASURED. `status === 0` is the one real signal
// transport.ts gives for "no response came back" (offline/DNS/refused/timeout); anything else —
// including a thrown value that isn't even a typed `ApiError` — must never be relabelled as a
// connection problem.
describe("honestWriteError (T072-A9)", () => {
  it("names the connection ONLY for a real transport-phase failure (status 0)", () => {
    const err = new ApiError({ status: 0, code: "UNKNOWN", message: "x", correlationId: null });
    expect(honestWriteError(err)).toBe(messages.catalog.offlineWriteBlocked);
  });

  it("a coded server error gets its own honest phrase, never the connection line", () => {
    const err = new ApiError({
      status: 403,
      code: "ENTITLEMENT_REQUIRED",
      message: "x",
      correlationId: null,
    });
    expect(honestWriteError(err)).toBe(messages.apiError.entitlementRequired);
    expect(honestWriteError(err)).not.toBe(messages.catalog.offlineWriteBlocked);
  });

  it("an unexpected non-ApiError failure gets the generic honest phrase, NOT the connection line", () => {
    expect(honestWriteError(new Error("boom"))).toBe(messages.apiError.unknown);
    expect(honestWriteError("not even an Error")).toBe(messages.apiError.unknown);
    expect(honestWriteError(new Error("boom"))).not.toBe(messages.catalog.offlineWriteBlocked);
  });
});
