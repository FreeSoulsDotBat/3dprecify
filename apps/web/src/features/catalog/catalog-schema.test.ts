import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import {
  emptyFilamentForm,
  emptyPrinterForm,
  filamentResolver,
  filamentToWire,
  printerResolver,
  printerToWire,
} from "./catalog-schema";

// 013 US1 (FB-01) — the catalog is the surface that PERSISTS the number: a silently mis-parsed
// value contaminates every future price derived from the saved item. Same grammar, same messages
// as the calculator; here we also pin what reaches the WIRE.

const v = messages.calculator.validation;

const validFilament = {
  ...emptyFilamentForm,
  name: "PLA",
  costPerRoll: "110,00",
  rollWeightKg: "1",
};
const validPrinter = {
  ...emptyPrinterForm,
  name: "Ender",
  machineValue: "4000,00",
  machineLifetimeHours: "2000",
  avgPowerKw: "0,12",
};

const ADVERSARIAL = ["1,234,56", "5x3", "10-5", "12,,5", "1.5000", "abc", "--"];

describe("filament costPerRoll — the persisted money field (FB-01)", () => {
  it.each(ADVERSARIAL)("rejects %s with a field error (never a saved wrong number)", (raw) => {
    const res = filamentResolver({ ...validFilament, costPerRoll: raw }, undefined, {
      shouldUseNativeValidation: false,
      fields: {},
      criteriaMode: "firstError",
    });
    expect(res.errors.costPerRoll?.message).toBe(v.invalid);
  });

  it("FB-01: '1500.00' is R$ 1500 on the wire — NOT the 150000 the audit measured", () => {
    const form = { ...validFilament, costPerRoll: "1500.00" };
    const res = filamentResolver(form, undefined, {
      shouldUseNativeValidation: false,
      fields: {},
      criteriaMode: "firstError",
    });
    expect(res.errors).toEqual({});
    expect(filamentToWire(form).costPerRoll).toBe("1500");
  });

  it("keeps tolerating the R$ affix and the pt-BR forms", () => {
    expect(filamentToWire({ ...validFilament, costPerRoll: "R$ 1.234,56" }).costPerRoll).toBe(
      "1234.56",
    );
  });
});

describe("printer machineValue — the persisted machine cost (FB-01)", () => {
  it.each(ADVERSARIAL)("rejects %s with a field error", (raw) => {
    const res = printerResolver({ ...validPrinter, machineValue: raw }, undefined, {
      shouldUseNativeValidation: false,
      fields: {},
      criteriaMode: "firstError",
    });
    expect(res.errors.machineValue?.message).toBe(v.invalid);
  });

  it("FB-01: '1500.00' persists as 1500", () => {
    const form = { ...validPrinter, machineValue: "1500.00" };
    const res = printerResolver(form, undefined, {
      shouldUseNativeValidation: false,
      fields: {},
      criteriaMode: "firstError",
    });
    expect(res.errors).toEqual({});
    expect(printerToWire(form).machineValue).toBe("1500");
  });

  it("'0.12' in avgPowerKw stays 0,12 on the wire (the 100× energy error, persisted)", () => {
    expect(printerToWire({ ...validPrinter, avgPowerKw: "0.12" }).avgPowerKw).toBe("0.12");
  });
});
