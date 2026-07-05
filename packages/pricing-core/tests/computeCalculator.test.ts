import { describe, it, expect } from "vitest";

import { computeCalculator, ValidationError, PRICING_MODEL_VERSION } from "../src/index";
import type { PriceInput } from "../src/index";

// Canonical SC-001 vector (spec §3). Marketplace inputs are present but the MVP engine leaves the
// marketplace block null — the gross-up is E1 US5.
const SC001: PriceInput = {
  costPerRoll: 100,
  rollWeightKg: 1,
  printGrams: 100,
  wasteGrams: 10,
  printTimeHours: 5,
  avgPowerKw: 0.1,
  tariffPerKwh: 1,
  machineValue: 4000,
  machineLifetimeHours: 2000,
  maintenanceReservePerHour: 0,
  failurePct: 10,
  finishTimeHours: 0.5,
  finishRatePerHour: 10,
  laborHours: 0,
  laborRatePerHour: 0,
  adminTotal: 0,
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
  marketplaceCommissionPct: 20,
  marketplaceFixedFee: 5,
};

describe("computeCalculator — canonical worked example (SC-001)", () => {
  const r = computeCalculator(SC001);

  it("computes each cost line in R$ (SC-001)", () => {
    expect(r.material).toBe(11.0);
    expect(r.energy).toBe(0.5);
    expect(r.machine).toBe(10.0);
    expect(r.falha).toBe(2.15);
    expect(r.finishing).toBe(5.0);
    expect(r.labor).toBe(0);
    expect(r.admin).toBe(0);
  });

  it("custo_total is R$ 28,65 and the breakdown lines sum to it (SC-002)", () => {
    expect(r.custoTotal).toBe(28.65);
    const sum = r.material + r.energy + r.machine + r.falha + r.finishing + r.labor + r.admin;
    expect(Number(sum.toFixed(2))).toBe(r.custoTotal);
  });

  it("prices are R$ 42,98 (varejo) and R$ 37,25 (atacado)", () => {
    expect(r.precoVarejo).toBe(42.98);
    expect(r.precoAtacado).toBe(37.25);
  });

  it("stamps modelVersion 2.0.0; MVP leaves marketplace null", () => {
    expect(r.modelVersion).toBe("2.0.0");
    expect(r.modelVersion).toBe(PRICING_MODEL_VERSION);
    expect(r.marketplace).toBeNull();
  });
});

describe("computeCalculator — corrected-math guards", () => {
  it("failure covers material + energy + machine, not material alone (SC-006)", () => {
    const r = computeCalculator(SC001);
    // 10% of (11 + 0.5 + 10) = 2.15, NOT 10% of material (1.10)
    expect(r.falha).toBe(2.15);
    expect(r.falha).not.toBe(1.1);
  });

  it("machine-hour = value/lifetime + reserve (ADR-0009 A, SC-007)", () => {
    const r = computeCalculator({ ...SC001, maintenanceReservePerHour: 1 });
    // (4000/2000 + 1) * 5 = 15.00
    expect(r.machine).toBe(15.0);
  });

  it("energy uses the effective-draw kW; scales with avgPowerKw only (SC-005)", () => {
    const base = computeCalculator(SC001);
    const doubled = computeCalculator({ ...SC001, avgPowerKw: 0.2 });
    expect(doubled.energy).toBe(1.0); // 0.5 → 1.0
    expect(doubled.material).toBe(base.material); // nothing else moved
    expect(doubled.machine).toBe(base.machine);
  });
});

describe("computeCalculator — edges & robustness", () => {
  it("both prices returned; varejo >= atacado when markupVarejo >= markupAtacado (SC-010)", () => {
    const r = computeCalculator(SC001);
    expect(r.precoVarejo).toBeGreaterThanOrEqual(r.precoAtacado);
  });

  it("printTimeHours = 0 → energy and machine 0, coherent material-only cost (Edge)", () => {
    const r = computeCalculator({ ...SC001, printTimeHours: 0, failurePct: 0, finishTimeHours: 0 });
    expect(r.energy).toBe(0);
    expect(r.machine).toBe(0);
    expect(r.material).toBe(11.0);
    expect(r.custoTotal).toBe(11.0);
  });

  it("omitted optional fields default to 0", () => {
    const minimal: PriceInput = {
      costPerRoll: 100,
      rollWeightKg: 1,
      printGrams: 100,
      printTimeHours: 5,
      avgPowerKw: 0.1,
      tariffPerKwh: 1,
      machineValue: 4000,
      machineLifetimeHours: 2000,
      markupVarejoPct: 50,
      markupAtacadoPct: 30,
    };
    const r = computeCalculator(minimal);
    expect(r.falha).toBe(0);
    expect(r.finishing).toBe(0);
    expect(r.labor).toBe(0);
    expect(r.admin).toBe(0);
    // material 10.00 (no waste) + energy 0.50 + machine 10.00 = custo_total 20.50
    expect(r.material).toBe(10.0);
    expect(r.custoTotal).toBe(20.5);
  });

  it("labor and admin fold into custo_total (US4 formula already in the engine)", () => {
    const r = computeCalculator({ ...SC001, laborHours: 2, laborRatePerHour: 25, adminTotal: 3 });
    expect(r.labor).toBe(50.0);
    expect(r.admin).toBe(3.0);
    expect(r.custoTotal).toBe(81.65); // 28.65 + 50 + 3
  });
});

describe("computeCalculator — validation (SC-008, never a bad number)", () => {
  it("rollWeightKg = 0 throws (no division by zero)", () => {
    expect(() => computeCalculator({ ...SC001, rollWeightKg: 0 })).toThrow(ValidationError);
  });

  it("machineLifetimeHours = 0 throws", () => {
    expect(() => computeCalculator({ ...SC001, machineLifetimeHours: 0 })).toThrow(ValidationError);
  });

  it("marketplaceCommissionPct = 100 throws (gross-up denominator ≤ 0)", () => {
    expect(() => computeCalculator({ ...SC001, marketplaceCommissionPct: 100 })).toThrow(
      ValidationError,
    );
  });

  it("negative commission throws", () => {
    expect(() => computeCalculator({ ...SC001, marketplaceCommissionPct: -1 })).toThrow(
      ValidationError,
    );
  });

  it("negative input throws with the offending field name", () => {
    try {
      computeCalculator({ ...SC001, costPerRoll: -1 });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe("costPerRoll");
    }
  });

  it("non-finite (NaN) input throws", () => {
    expect(() => computeCalculator({ ...SC001, printGrams: Number.NaN })).toThrow(ValidationError);
  });
});
