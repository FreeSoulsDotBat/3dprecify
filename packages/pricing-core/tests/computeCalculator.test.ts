import { describe, it, expect } from "vitest";

import { computeCalculator, ValidationError, PRICING_MODEL_VERSION } from "../src/index";
import type { PriceInput } from "../src/index";

// Canonical SC-001 vector (004 §3). Marketplace + admin start empty here so the vector maps onto the
// documented cost breakdown + prices; the single-channel gross-up is exercised in its own block via
// `channels` (3.0.0 shape — the 004 `marketplace`/`adminTotal` inputs are gone, ADR-0011 / A1).
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
  otherCosts: [],
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
  channels: [],
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

  it("no channel configured ⇒ channels is [] and catalogVersion null", () => {
    expect(r.channels).toEqual([]);
    expect(r.catalogVersion).toBeNull();
  });

  it("stamps modelVersion (= PRICING_MODEL_VERSION — the literal pin lives in version.test.ts)", () => {
    expect(r.modelVersion).toBe(PRICING_MODEL_VERSION);
  });
});

describe("computeCalculator — single-channel gross-up (3.0.0 channels[])", () => {
  it("grosses up BOTH prices so the seller nets the base after commission + fee (SC-003 → channels)", () => {
    const r = computeCalculator({
      ...SC001,
      channels: [{ marketplace: "GENERIC", commissionPct: 20, fixedFee: 5 }],
    });
    expect(r.channels).toHaveLength(1);
    const c = r.channels[0];
    // anúncio = (base + fixedFee) / (1 − commission/100)
    expect(c.precoAnuncioVarejo).toBe(59.98); // (42,98 + 5) / 0,8
    expect(c.precoAnuncioAtacado).toBe(52.81); // (37,25 + 5) / 0,8
    // recebido líquido nets back to the base price (round-trip; freightCost 0)
    expect(c.recebidoLiquidoVarejo).toBe(r.precoVarejo); // 42,98
    expect(c.recebidoLiquidoAtacado).toBe(r.precoAtacado); // 37,25
    expect(c.freightCostVarejo).toBe(0);
    expect(c.freightCostAtacado).toBe(0);
    expect(c.marketplace).toBe("GENERIC");
  });

  it("no channels ⇒ empty channel list (direct seller, unchanged headline)", () => {
    const r = computeCalculator({ ...SC001, channels: [] });
    expect(r.channels).toEqual([]);
  });

  it("a fee-only channel (commission 0, fixed fee 2) still computes and nets to base", () => {
    const r = computeCalculator({ ...SC001, channels: [{ commissionPct: 0, fixedFee: 2 }] });
    expect(r.channels).toHaveLength(1);
    // commission 0 ⇒ anúncio = base + fee; líquido nets exactly back to base
    expect(r.channels[0].precoAnuncioVarejo).toBe(Number((r.precoVarejo + 2).toFixed(2)));
    expect(r.channels[0].recebidoLiquidoVarejo).toBe(r.precoVarejo);
  });

  it("a generic freightCost lowers the líquido by exactly that amount (never custo_total)", () => {
    const r = computeCalculator({
      ...SC001,
      channels: [{ commissionPct: 0, fixedFee: 0, freightCost: 3 }],
    });
    const c = r.channels[0];
    // commission 0, fee 0 ⇒ anúncio = base; líquido = base − freight
    expect(c.precoAnuncioVarejo).toBe(r.precoVarejo);
    expect(c.recebidoLiquidoVarejo).toBe(Number((r.precoVarejo - 3).toFixed(2)));
    // custo_total is untouched by any channel fee/freight
    expect(r.custoTotal).toBe(28.65);
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

  it("omitted optional fields default to 0 / empty", () => {
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
    expect(r.channels).toEqual([]);
    // material 10.00 (no waste) + energy 0.50 + machine 10.00 = custo_total 20.50
    expect(r.material).toBe(10.0);
    expect(r.custoTotal).toBe(20.5);
  });

  it("itemized otherCosts sum into custo_total exactly as a single admin did (FR-114)", () => {
    const r = computeCalculator({
      ...SC001,
      laborHours: 2,
      laborRatePerHour: 25,
      otherCosts: [{ name: "Embalagem", value: 3 }],
    });
    expect(r.labor).toBe(50.0);
    expect(r.admin).toBe(3.0);
    expect(r.custoTotal).toBe(81.65); // 28.65 + 50 + 3
  });

  it("multiple named sub-costs sum (each rounded) into admin", () => {
    const r = computeCalculator({
      ...SC001,
      otherCosts: [
        { name: "Embalagem", value: 3 },
        { name: "Frete", value: 2 },
      ],
    });
    expect(r.admin).toBe(5.0);
    expect(r.custoTotal).toBe(33.65); // 28.65 + 5
  });

  // FR-115 / SC-106: each named sub-cost is echoed onto the result (rounded, in order) so the UI can
  // render it as its own breakdown line — and those per-line values sum to `admin` with 0 residual.
  it("echoes each named sub-cost as its own rounded, ordered result line (FR-115)", () => {
    const r = computeCalculator({
      ...SC001,
      otherCosts: [
        { name: "Embalagem", value: 3 },
        { name: "Frete", value: 2 },
      ],
    });
    expect(r.otherCosts).toEqual([
      { name: "Embalagem", value: 3.0 },
      { name: "Frete", value: 2.0 },
    ]);
    // The named lines sum to admin with no residual (each already ADR-0008 rounded).
    const sum = r.otherCosts.reduce((acc, c) => acc + c.value, 0);
    expect(Number(sum.toFixed(2))).toBe(r.admin);
  });

  it("rounds each sub-cost line per ADR-0008 (HALF_UP, 2dp) before summing", () => {
    const r = computeCalculator({
      ...SC001,
      otherCosts: [
        { name: "a", value: 1.005 },
        { name: "b", value: 2.004 },
      ],
    });
    // 1.005 → 1.01, 2.004 → 2.00 ⇒ admin 3.01 (each line rounded, THEN summed — FR-114/ADR-0008).
    expect(r.otherCosts).toEqual([
      { name: "a", value: 1.01 },
      { name: "b", value: 2.0 },
    ]);
    expect(r.admin).toBe(3.01);
  });

  it("removing a sub-cost lowers custo_total by exactly its value, with one line left (SC-106)", () => {
    const two = computeCalculator({
      ...SC001,
      otherCosts: [
        { name: "Embalagem", value: 3 },
        { name: "Frete", value: 2 },
      ],
    });
    const one = computeCalculator({ ...SC001, otherCosts: [{ name: "Embalagem", value: 3 }] });
    expect(two.custoTotal).toBe(33.65);
    expect(one.custoTotal).toBe(31.65); // exactly −2,00, no residual
    expect(one.otherCosts).toEqual([{ name: "Embalagem", value: 3.0 }]);
  });

  it("an empty slot yields no named lines and reproduces the 004 result byte-for-byte (SC-106)", () => {
    const empty = computeCalculator({ ...SC001, otherCosts: [] });
    const none = computeCalculator({ ...SC001 });
    expect(empty.otherCosts).toEqual([]);
    expect(empty.admin).toBe(0);
    // Byte-identical to the mandatory-only 004 result (otherCosts is the only differing input).
    expect(JSON.stringify(empty)).toBe(JSON.stringify(none));
  });
});

describe("computeCalculator — validation (SC-008, never a bad number)", () => {
  it("rollWeightKg = 0 throws (no division by zero)", () => {
    expect(() => computeCalculator({ ...SC001, rollWeightKg: 0 })).toThrow(ValidationError);
  });

  it("machineLifetimeHours = 0 throws", () => {
    expect(() => computeCalculator({ ...SC001, machineLifetimeHours: 0 })).toThrow(ValidationError);
  });

  // 3.0.0 (SC-107): a bad channel no longer throws — it isolates to that slot's `error` while the
  // shared cost calc and the sibling channels still compute. Full isolation lives in channels.test.ts.
  it("a channel commission = 100 yields a per-slot error, not a throw", () => {
    const r = computeCalculator({ ...SC001, channels: [{ commissionPct: 100 }] });
    expect(r.channels[0].error).toBeTruthy();
    expect(r.channels[0].precoAnuncioVarejo).toBeNull();
    expect(r.custoTotal).toBeGreaterThan(0); // the shared cost calc is unaffected
  });

  it("a negative channel commission yields a per-slot error, not a throw", () => {
    const r = computeCalculator({ ...SC001, channels: [{ commissionPct: -1 }] });
    expect(r.channels[0].error).toBeTruthy();
    expect(r.channels[0].precoAnuncioVarejo).toBeNull();
  });

  it("a negative otherCosts value throws with the offending field name", () => {
    try {
      computeCalculator({ ...SC001, otherCosts: [{ name: "x", value: -1 }] });
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe("otherCosts[0].value");
    }
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
