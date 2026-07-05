import { describe, expect, it } from "vitest";

import { errorCodeMessage } from "./error-messages";
import { ErrorCode } from "./generated";

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
