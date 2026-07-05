import { describe, it, expect } from "vitest";

import { toMoney, sumMoney } from "../src/rounding";

// ADR-0008: 2-decimal ROUND_HALF_UP; aggregates = sum of already-rounded lines.
describe("rounding policy (ADR-0008)", () => {
  it("rounds half up at 2 decimals", () => {
    expect(toMoney(42.975)).toBe(42.98);
    expect(toMoney(37.245)).toBe(37.25);
    expect(toMoney(2.675)).toBe(2.68);
    expect(toMoney("0.005")).toBe(0.01);
  });

  it("passes exact 2-decimal values through unchanged", () => {
    expect(toMoney(11)).toBe(11);
    expect(toMoney(0.5)).toBe(0.5);
    expect(toMoney(0)).toBe(0);
  });

  it("sumMoney adds already-rounded lines so the breakdown closes", () => {
    expect(sumMoney([11.0, 0.5, 10.0, 2.15, 5.0, 0, 0])).toBe(28.65);
    expect(sumMoney([])).toBe(0);
  });
});
