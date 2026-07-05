import { describe, expect, it } from "vitest";

import { messages } from "./messages.pt-br";

// US4 / SS-4 / FR-014 (Principle II — honest copy). The shell + system-state copy must name
// no payment provider, quote no price, and state no cancellation policy. This is a programmatic
// grep over the WHOLE message module (every string leaf, incl. the ErrorCode→pt-BR phrases), so
// the honesty guarantee holds as new keys are added — not just for the 003 keys.
function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") acc.push(value);
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) collectStrings(v, acc);
  return acc;
}

const HAYSTACK = collectStrings(messages).join("\n").toLowerCase();

describe("copy honesty (T051 / US4 — SS-4 / FR-014)", () => {
  it("names no payment provider", () => {
    for (const term of ["mercado pago", "mercadopago", "stripe", "paypal", "pagseguro", "boleto"]) {
      expect(HAYSTACK, `provider name leaked: "${term}"`).not.toContain(term);
    }
  });

  it("states no cancellation policy", () => {
    for (const term of ["cancele", "cancelar", "cancelamento"]) {
      expect(HAYSTACK, `cancellation copy leaked: "${term}"`).not.toContain(term);
    }
  });

  it("quotes no price (no currency literal in the copy)", () => {
    // Prices are produced by number formatting at render time, never hard-coded in copy;
    // a "R$ " literal in a message would imply an undecided commercial price.
    expect(HAYSTACK, 'a "R$" price literal leaked into the copy').not.toContain("r$");
  });
});
