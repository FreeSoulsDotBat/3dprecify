import { describe, expect, it } from "vitest";

import { formatDecimal, parseDecimal } from "./decimal-ptbr";

describe("parseDecimal — pt-BR string → number", () => {
  it("parses a thousands+decimal pt-BR string", () => {
    expect(parseDecimal("1.234,56")).toBeCloseTo(1234.56, 2);
  });
  it("parses a plain comma decimal", () => {
    expect(parseDecimal("110,00")).toBeCloseTo(110, 2);
  });
  it("passes a number through unchanged", () => {
    expect(parseDecimal(5)).toBe(5);
  });
  it("returns NaN for empty/blank input", () => {
    expect(Number.isNaN(parseDecimal(""))).toBe(true);
  });
});

describe("formatDecimal — number → pt-BR string", () => {
  it("formats thousands with comma decimals", () => {
    expect(formatDecimal(1234.5)).toBe("1.234,50");
  });
  it("formats zero as 0,00", () => {
    expect(formatDecimal(0)).toBe("0,00");
  });
  it("formats an integer with two decimals", () => {
    expect(formatDecimal(2)).toBe("2,00");
  });
  it("returns empty string for NaN", () => {
    expect(formatDecimal(Number.NaN)).toBe("");
  });
});
