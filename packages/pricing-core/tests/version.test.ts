import { describe, it, expect } from "vitest";

import pkg from "../package.json";
import { PRICING_MODEL_VERSION } from "../src/index";

// ADR-0008 Part 1 + ADR-0011: the E1 v3 formula is stamped 3.0.0 (major bump for the itemized-admin
// + multi-channel result contract), and the constant tracks the package.json major so a saved calc
// can record which formula produced it.
describe("PRICING_MODEL_VERSION (ADR-0008 / ADR-0011)", () => {
  it("is 3.0.0", () => {
    expect(PRICING_MODEL_VERSION).toBe("3.0.0");
  });

  it("tracks the package.json major", () => {
    expect(PRICING_MODEL_VERSION.split(".")[0]).toBe(pkg.version.split(".")[0]);
    expect(pkg.version.split(".")[0]).toBe("3");
  });
});
