import { describe, expect, it } from "vitest";

import { type CalcFormValues, defaultCalcValues } from "./calculator-schema";
import { computeFromForm, formatBRL } from "./calculator-model";

// E1 adapter (US1 + US2). We assert the form-string → parse → validate → compute → format
// mapping the screen depends on. The numeric formula is covered exhaustively by the
// @3dprecify/pricing-core tests; here we only pin that the adapter wires it correctly and
// that bad input surfaces a per-field message instead of silently coercing to 0 (TD-020).

/** The SC-001 canonical vector as pt-BR form strings. labor/admin (US4) and the marketplace
 *  fees (US5) start at 0 so this vector still maps onto the documented MVP breakdown + prices. */
const canonical: CalcFormValues = {
  costPerRoll: "100,00",
  rollWeightKg: "1",
  printGrams: "100",
  wasteGrams: "10",
  printTimeHours: "5",
  avgPowerKw: "0,10",
  tariffPerKwh: "1,00",
  machineValue: "4000,00",
  machineLifetimeHours: "2000",
  maintenanceReservePerHour: "0",
  failurePct: "10",
  finishTimeHours: "0,5",
  finishRatePerHour: "10,00",
  laborHours: "0",
  laborRatePerHour: "0",
  adminTotal: "0",
  markupVarejoPct: "50",
  markupAtacadoPct: "30",
  marketplaceCommissionPct: "0",
  marketplaceFixedFee: "0",
};

describe("computeFromForm — canonical vector flows through the engine (SC-001)", () => {
  it("maps the SC-001 form strings onto the documented breakdown + prices", () => {
    const { ok, result, fieldErrors } = computeFromForm(canonical);
    expect(ok).toBe(true);
    expect(fieldErrors).toEqual({});
    expect(result).not.toBeNull();
    expect(result?.material).toBeCloseTo(11.0, 2);
    expect(result?.energy).toBeCloseTo(0.5, 2);
    expect(result?.machine).toBeCloseTo(10.0, 2);
    expect(result?.falha).toBeCloseTo(2.15, 2);
    expect(result?.finishing).toBeCloseTo(5.0, 2);
    expect(result?.custoTotal).toBeCloseTo(28.65, 2);
    expect(result?.precoVarejo).toBeCloseTo(42.98, 2);
    expect(result?.precoAtacado).toBeCloseTo(37.25, 2);
  });

  it("the default (seed) form is valid and produces a coherent price", () => {
    const { ok, result } = computeFromForm(defaultCalcValues);
    expect(ok).toBe(true);
    // seed: 100/1kg/100g, printTime 5h, avgPower 0,12kW, tariff 1, machine 4000/2000h, no optionals.
    expect(result?.custoTotal).toBeCloseTo(20.6, 2);
    expect(result?.precoVarejo).toBeCloseTo(30.9, 2);
    expect(result?.precoAtacado).toBeCloseTo(26.78, 2);
  });
});

describe("computeFromForm — pt-BR/BRL parsing", () => {
  it("accepts comma decimals and thousands separators", () => {
    const r = computeFromForm({
      ...canonical,
      costPerRoll: "1.000,00",
      rollWeightKg: "1",
      printGrams: "10",
      wasteGrams: "0",
    });
    expect(r.ok).toBe(true);
    // (1000 / 1000g) * 10g = 10,00
    expect(r.result?.material).toBeCloseTo(10.0, 2);
  });

  it("tolerates typed R$ / unit affixes around the number", () => {
    const r = computeFromForm({ ...canonical, costPerRoll: "R$ 100,00", avgPowerKw: "0,10 kW" });
    expect(r.ok).toBe(true);
    expect(r.result?.material).toBeCloseTo(11.0, 2);
  });

  it("treats a blank optional field as 0 (does not error)", () => {
    const r = computeFromForm({
      ...canonical,
      wasteGrams: "",
      finishTimeHours: "",
      failurePct: "",
    });
    expect(r.ok).toBe(true);
    // waste 0 → material = (100/1000)*100 = 10,00; falha/finishing 0
    expect(r.result?.material).toBeCloseTo(10.0, 2);
    expect(r.result?.falha).toBeCloseTo(0, 2);
    expect(r.result?.finishing).toBeCloseTo(0, 2);
  });
});

describe("computeFromForm — per-field validation (never coerce a bad string to 0)", () => {
  it("rejects a non-numeric string instead of treating it as 0", () => {
    const r = computeFromForm({ ...canonical, costPerRoll: "abc" });
    expect(r.ok).toBe(false);
    expect(r.result).toBeNull();
    expect(r.fieldErrors.costPerRoll).toBeTruthy();
  });

  it("rejects a non-numeric OPTIONAL string too (only blank means 0)", () => {
    const r = computeFromForm({ ...canonical, wasteGrams: "xx" });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.wasteGrams).toBeTruthy();
  });

  it("flags a blank required field as obrigatório", () => {
    const r = computeFromForm({ ...canonical, printGrams: "" });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.printGrams).toMatch(/obrigat/i);
  });

  it("flags roll weight <= 0 with the specific '> 0' message (no division by zero)", () => {
    const r = computeFromForm({ ...canonical, rollWeightKg: "0" });
    expect(r.ok).toBe(false);
    expect(r.result).toBeNull();
    expect(r.fieldErrors.rollWeightKg).toMatch(/maior que zero/i);
  });

  it("flags machine lifetime <= 0", () => {
    const r = computeFromForm({ ...canonical, machineLifetimeHours: "0" });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.machineLifetimeHours).toBeTruthy();
  });

  it("flags a negative value as não pode ser negativo", () => {
    const r = computeFromForm({ ...canonical, printTimeHours: "-5" });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.printTimeHours).toMatch(/negativ/i);
  });

  it("collects errors from multiple fields at once", () => {
    const r = computeFromForm({ ...canonical, costPerRoll: "abc", rollWeightKg: "0" });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.costPerRoll).toBeTruthy();
    expect(r.fieldErrors.rollWeightKg).toBeTruthy();
  });
});

describe("formatBRL — pt-BR/BRL formatting", () => {
  it("formats with the R$ prefix, comma decimals and thousands separator", () => {
    expect(formatBRL(28.65)).toBe("R$ 28,65");
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});
