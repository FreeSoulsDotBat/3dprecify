import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import { type CalcFieldName, calculatorSchema, defaultCalcValues } from "./calculator-schema";

// 013 US1 (FA-01/FA-02) — the calculator surface of the strict pt-BR grammar. A malformed or
// mixed-separator string must surface the EXISTING per-field pt-BR message; it must never be
// coerced into a plausible, finite, WRONG number (the 100× energy error the audit measured).

const v = messages.calculator.validation;

function parseField(field: CalcFieldName, raw: string) {
  const res = calculatorSchema.safeParse({ ...defaultCalcValues, [field]: raw });
  if (res.success) return { value: res.data[field], error: undefined };
  const issue = res.error.issues.find((i) => i.path[0] === field);
  return { value: undefined, error: issue?.message };
}

describe("calculator numField — the adversarial set errors, never silently coerces", () => {
  it.each(["1,234,56", "5x3", "10-5", "12,,5", "1.5000", "abc", "--"])(
    "rejects avgPowerKw %s with the pt-BR 'valid number' message",
    (raw) => {
      const { value, error } = parseField("avgPowerKw", raw);
      expect(error).toBe(v.invalid);
      expect(value).toBeUndefined();
    },
  );

  it("FA-01: '0.12' in kW is 0,12 — NOT 12 (the measured 100× energy error)", () => {
    expect(parseField("avgPowerKw", "0.12")).toEqual({ value: 0.12, error: undefined });
  });

  it("FA-02: '1,234,56' no longer parses to a plausible 1.234", () => {
    expect(parseField("costPerRoll", "1,234,56").error).toBe(v.invalid);
  });

  it("a negative value still gets the SPECIFIC negative message, not the generic invalid one", () => {
    expect(parseField("costPerRoll", "-5").error).toBe(v.negative);
  });

  it("the pt-BR forms the app has always accepted are untouched", () => {
    expect(parseField("costPerRoll", "1.234,56").value).toBeCloseTo(1234.56, 6);
    expect(parseField("avgPowerKw", "0,12").value).toBeCloseTo(0.12, 6);
  });
});

describe("calculator numField — visual affixes stay tolerated (anchored strip)", () => {
  it.each([
    ["R$ 1.500,00", 1500],
    ["1,50 kg", 1.5],
    ["  100  ", 100],
  ])("accepts %s → %s", (raw, expected) => {
    const { value, error } = parseField("costPerRoll", raw);
    expect(error).toBeUndefined();
    expect(value).toBeCloseTo(expected, 6);
  });
});
