import { describe, expect, it } from "vitest";

import { formatDecimal, parseDecimal, ptBrToWireDecimal, wireToPtBr } from "./decimal-ptbr";

describe("parseDecimal — the accepted pt-BR grammar (013 §1)", () => {
  it.each([
    ["1500", 1500],
    ["0", 0],
    ["0,12", 0.12],
    ["110,00", 110],
    ["1.234,56", 1234.56],
    ["1.500,00", 1500],
    ["1.234.567,89", 1234567.89],
  ])("accepts the pt-BR form %s → %s", (raw, expected) => {
    expect(parseDecimal(raw)).toBeCloseTo(expected, 6);
  });

  it.each([
    ["0.12", 0.12],
    ["1500.00", 1500],
    ["1.50", 1.5],
    ["1.5", 1.5],
  ])("accepts the documented non-ambiguous dot-decimal %s → %s", (raw, expected) => {
    expect(parseDecimal(raw)).toBeCloseTo(expected, 6);
  });

  it("resolves the ONE residually ambiguous form 1.500 as pt-BR thousands (= 1500)", () => {
    // Documented in the module: a dot followed by EXACTLY 3 digits is a thousands group.
    expect(parseDecimal("1.500")).toBe(1500);
  });

  // F2 (confirmation audit): a leading-zero group is NEVER pt-BR thousands, and "0.xxx" is an
  // unambiguous fraction < 1. "0.125" used to become 125 (the thousands regex swallowed it).
  it.each([
    ["0.125", 0.125],
    ["0.5", 0.5],
    ["0.999", 0.999],
    ["0.0001", 0.0001],
  ])("F2: a zero-leading dot form %s is the fraction %s, never thousands", (raw, expected) => {
    expect(parseDecimal(raw)).toBeCloseTo(expected as number, 6);
  });

  it("F2: the genuinely ambiguous NON-zero case 1.125 stays pt-BR thousands (= 1125)", () => {
    // Only the leading-ZERO ambiguity is resolved; the documented "1.500"≡1500 rule is untouched.
    expect(parseDecimal("1.125")).toBe(1125);
  });

  it("passes a number through unchanged", () => {
    expect(parseDecimal(5)).toBe(5);
  });

  it("returns NaN for empty/blank input", () => {
    expect(Number.isNaN(parseDecimal(""))).toBe(true);
    expect(Number.isNaN(parseDecimal("   "))).toBe(true);
  });
});

describe("parseDecimal — rejection (FA-01/FB-01/FA-02: never a silent finite wrong number)", () => {
  it.each([
    "1,234,56", // FA-02: parseFloat used to stop at the residue → 1.234
    "10-5",
    "5x3", // the unanchored affix strip used to concatenate this into "53"
    "12,,5",
    "1.5000",
    "1.23.4",
    "abc",
    "--",
    "-",
    "1,",
    ",5",
    "1..5",
    "R$",
  ])("rejects %s with NaN (→ the existing per-field pt-BR error)", (raw) => {
    expect(Number.isNaN(parseDecimal(raw))).toBe(true);
  });
});

describe("parseDecimal — affix stripping is ANCHORED (leading/trailing only)", () => {
  it.each([
    ["R$ 1,50", 1.5],
    ["R$1.234,56", 1234.56],
    ["1,50 kg", 1.5],
    ["  1.500,00  ", 1500],
    ["12 %", 12],
  ])("strips the leading/trailing affix of %s → %s", (raw, expected) => {
    expect(parseDecimal(raw)).toBeCloseTo(expected, 6);
  });

  it("does NOT strip interior garbage (that is what turned 5x3 into 53)", () => {
    expect(Number.isNaN(parseDecimal("R$ 5x3"))).toBe(true);
    expect(Number.isNaN(parseDecimal("10-5 kg"))).toBe(true);
  });
});

describe("parseDecimal — the sign survives (the caller's 'negative' message must not degrade)", () => {
  it("parses a leading minus as a negative number", () => {
    expect(parseDecimal("-5")).toBe(-5);
    expect(parseDecimal("-1.234,56")).toBeCloseTo(-1234.56, 6);
    expect(parseDecimal("R$ -5,50")).toBeCloseTo(-5.5, 6);
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

// FA-05 — the wire→form swap was triplicated (catalog-prefill / product-mapping / scenario-bridge),
// each silently assuming the wire leaf carries AT MOST one ".". One home + the premise pinned.
describe("wireToPtBr — the single home for the wire decimal → pt-BR form swap", () => {
  it.each([
    ["1200.00", "1200,00"],
    ["110.5", "110,5"],
    ["0.1200", "0,1200"],
    ["100", "100"],
    ["2000.000", "2000,000"],
  ])("swaps the single decimal point of %s → %s (no float round-trip)", (wire, form) => {
    expect(wireToPtBr(wire)).toBe(form);
  });

  it("PREMISE (at most one '.'): a multi-dot wire leaf produces a string the parser REJECTS", () => {
    // The premise cannot be violated by `Decimal#toString`, but if a caller ever violates it the
    // outcome is an honest field error — NOT the old silent 1.234. This is the guarantee, not a wish.
    const violating = wireToPtBr("1.234.56");
    expect(violating).toBe("1,234.56");
    expect(Number.isNaN(parseDecimal(violating))).toBe(true);
  });
});

// The save-side mirror: `product-mapping` must write to the wire exactly the number `parseDecimal`
// read, with the leaf's precision preserved byte-for-byte (SC-305).
describe("ptBrToWireDecimal — the string mirror of parseDecimal", () => {
  it.each([
    ["110,00", "110.00"],
    ["1,000", "1.000"],
    ["12,5", "12.5"],
    ["1.234,56", "1234.56"],
    ["1.500", "1500"],
    ["100", "100"],
    ["1500.00", "1500.00"], // dot-decimal: the dot is DECIMAL, never dropped as a thousands mark
    ["0.12", "0.12"],
  ])("maps %s → %s", (form, wire) => {
    expect(ptBrToWireDecimal(form)).toBe(wire);
  });

  it("agrees with parseDecimal on every accepted form (one rule, two renderings)", () => {
    for (const form of ["110,00", "1,000", "1.234,56", "1.500", "1500.00", "0.12", "100"]) {
      expect(Number(ptBrToWireDecimal(form))).toBeCloseTo(parseDecimal(form), 6);
    }
  });

  it("maps a rejected string to '0' (it can never reach the wire — the resolver blocks it first)", () => {
    expect(ptBrToWireDecimal("1,234,56")).toBe("0");
    expect(ptBrToWireDecimal("")).toBe("0");
  });
});
