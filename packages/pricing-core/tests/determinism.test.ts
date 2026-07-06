import { describe, it, expect } from "vitest";

import { computeCalculator, PRICING_MODEL_VERSION } from "../src/index";
import type { PriceInput } from "../src/index";

// Cross-cutting guarantees (spec §9): the engine is a pure, offline, deterministic function of its
// input — no Date/random/locale drift, no server round-trip — and every result carries the model
// version so a saved calc records which formula produced it.

const INPUT: PriceInput = {
  costPerRoll: 137.5,
  rollWeightKg: 1,
  printGrams: 83,
  wasteGrams: 7,
  printTimeHours: 6.25,
  avgPowerKw: 0.14,
  tariffPerKwh: 0.92,
  machineValue: 3200,
  machineLifetimeHours: 1800,
  maintenanceReservePerHour: 0.5,
  failurePct: 8,
  finishTimeHours: 0.75,
  finishRatePerHour: 18,
  laborHours: 1.5,
  laborRatePerHour: 30,
  adminTotal: 4,
  markupVarejoPct: 55,
  markupAtacadoPct: 35,
  marketplaceCommissionPct: 16,
  marketplaceFixedFee: 6,
};

describe("computeCalculator — determinism (SC-012)", () => {
  it("identical input → deeply-equal AND byte-identical result across repeated runs", () => {
    const a = computeCalculator(INPUT);
    const b = computeCalculator(INPUT);
    expect(a).toEqual(b);
    // Stable serialization proves no Date/random/locale leaked into any field.
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not mutate its input", () => {
    const snapshot = JSON.stringify(INPUT);
    computeCalculator(INPUT);
    expect(JSON.stringify(INPUT)).toBe(snapshot);
  });
});

describe("computeCalculator — single source + version stamp (SC-011)", () => {
  it("returns a synchronous value (no async server round-trip)", () => {
    const r = computeCalculator(INPUT);
    expect(r).not.toBeInstanceOf(Promise);
  });

  it("stamps every result with the model version", () => {
    const r = computeCalculator(INPUT);
    expect(r.modelVersion).toBe("2.0.0");
    expect(r.modelVersion).toBe(PRICING_MODEL_VERSION);
  });
});
