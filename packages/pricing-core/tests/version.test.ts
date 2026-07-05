import { describe, it, expect } from "vitest";

import pkg from "../package.json";
import { PRICING_MODEL_VERSION } from "../src/index";

// ADR-0008 Part 1: the E1 formula is stamped 2.0.0 (major bump per A25), and the constant tracks
// the package.json major so a saved calc can record which formula produced it.
describe("PRICING_MODEL_VERSION (ADR-0008)", () => {
  it("is 2.0.0", () => {
    expect(PRICING_MODEL_VERSION).toBe("2.0.0");
  });

  it("tracks the package.json major", () => {
    expect(PRICING_MODEL_VERSION.split(".")[0]).toBe(pkg.version.split(".")[0]);
    expect(pkg.version.split(".")[0]).toBe("2");
  });
});
