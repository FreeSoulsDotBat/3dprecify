import { describe, it, expect } from "vitest";

import pkg from "../package.json";
import { PRICING_MODEL_VERSION } from "../src/index";

// ADR-0008 Part 1 + ADR-0011 + ADR-0016: E3 adds computeBom + exports toMoney/sumMoney/Decimal —
// an additive public surface, so 3.0.0 → 3.1.0 (MINOR). The constant tracks the package.json major
// so a saved calc can record which formula produced it.
describe("PRICING_MODEL_VERSION (ADR-0008 / ADR-0011 / ADR-0016)", () => {
  it("is 3.1.0", () => {
    expect(PRICING_MODEL_VERSION).toBe("3.1.0");
  });

  it("tracks the package.json major", () => {
    expect(PRICING_MODEL_VERSION.split(".")[0]).toBe(pkg.version.split(".")[0]);
    expect(pkg.version.split(".")[0]).toBe("3");
  });
});
