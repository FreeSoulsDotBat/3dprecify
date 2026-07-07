import { describe, it, expect } from "vitest";

import { computeCalculator } from "../src/index";
import type { PriceInput } from "../src/index";

// US1 — price the SAME product across several channels at once. The cost half of the vector is the
// 004 SC-001 canonical (→ custo_total 28,65, varejo 42,98, atacado 37,25); the channels exercise the
// multi-channel gross-up shown together in "Preços por canal".
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
  failurePct: 10,
  finishTimeHours: 0.5,
  finishRatePerHour: 10,
  otherCosts: [],
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
};

describe("SC-101 — price the same product across channels at once", () => {
  const r = computeCalculator({
    ...SC001,
    channels: [
      {
        marketplace: "MERCADO_LIVRE",
        feeDeterminants: { listingType: "CLASSICO", category: "casa" },
        commissionPct: 12,
        fixedFee: 6.75,
      },
      { marketplace: "SHOPEE", commissionPct: 20, fixedFee: 4 },
    ],
  });

  it("computes both channels together; each nets to its base for varejo + atacado", () => {
    expect(r.channels).toHaveLength(2);
    const [ml, shopee] = r.channels;
    // ML Clássico 12% + R$6,75
    expect(ml.precoAnuncioVarejo).toBe(56.51); // (42,98 + 6,75) / 0,88
    expect(ml.recebidoLiquidoVarejo).toBe(42.98);
    expect(ml.precoAnuncioAtacado).toBe(50.0); // (37,25 + 6,75) / 0,88
    expect(ml.recebidoLiquidoAtacado).toBe(37.25);
    // Shopee 20% + R$4
    expect(shopee.precoAnuncioVarejo).toBe(58.73); // (42,98 + 4) / 0,80
    expect(shopee.recebidoLiquidoVarejo).toBe(42.98);
    expect(shopee.precoAnuncioAtacado).toBe(51.56); // (37,25 + 4) / 0,80
    expect(shopee.recebidoLiquidoAtacado).toBe(37.25);
  });

  it("no channel errors; freightCost 0 (no freight configured)", () => {
    expect(r.channels.every((c) => c.error === null)).toBe(true);
    expect(r.channels.every((c) => c.freightCostVarejo === 0 && c.freightCostAtacado === 0)).toBe(
      true,
    );
    expect(r.channels[0].marketplace).toBe("MERCADO_LIVRE");
    expect(r.channels[0].feeDeterminants).toEqual({ listingType: "CLASSICO", category: "casa" });
  });
});

describe("SC-102 — add/remove isolation + stable ordering", () => {
  const chA = { marketplace: "A", commissionPct: 12, fixedFee: 6.75 };
  const chB = { marketplace: "B", commissionPct: 15, fixedFee: 3 };
  const chC = { marketplace: "C", commissionPct: 20, fixedFee: 4 };

  it("removing a channel drops only its result; the survivors are byte-identical", () => {
    const three = computeCalculator({ ...SC001, channels: [chA, chB, chC] });
    const two = computeCalculator({ ...SC001, channels: [chA, chC] });
    expect(three.channels.map((c) => c.marketplace)).toEqual(["A", "B", "C"]);
    expect(two.channels.map((c) => c.marketplace)).toEqual(["A", "C"]);
    // A is unchanged; C is unchanged (position shifts but its numbers don't).
    expect(JSON.stringify(two.channels[0])).toBe(JSON.stringify(three.channels[0]));
    expect(JSON.stringify(two.channels[1])).toBe(JSON.stringify(three.channels[2]));
  });
});

describe("SC-107 — per-slot error isolation (never a silent clamp, never a throw)", () => {
  it("commission ≥ 100 errors ONLY that slot; the others compute; no NaN/Infinity", () => {
    const r = computeCalculator({
      ...SC001,
      channels: [
        { marketplace: "A", commissionPct: 12, fixedFee: 6.75 },
        { marketplace: "BAD", commissionPct: 100 },
        { marketplace: "C", commissionPct: 20, fixedFee: 4 },
      ],
    });
    expect(r.channels[1].error).toBeTruthy();
    expect(r.channels[1].precoAnuncioVarejo).toBeNull();
    expect(r.channels[1].recebidoLiquidoVarejo).toBeNull();
    expect(r.channels[0].error).toBeNull();
    expect(r.channels[0].precoAnuncioVarejo).toBe(56.51);
    expect(r.channels[2].precoAnuncioVarejo).toBe(58.73);
    const nums = r.channels
      .flatMap((c) => [c.precoAnuncioVarejo, c.recebidoLiquidoVarejo])
      .filter((n): n is number => n !== null);
    expect(nums.every(Number.isFinite)).toBe(true);
  });

  it("a negative commission also errors only its slot", () => {
    const r = computeCalculator({
      ...SC001,
      channels: [
        { marketplace: "A", commissionPct: 12, fixedFee: 6.75 },
        { marketplace: "NEG", commissionPct: -5 },
      ],
    });
    expect(r.channels[1].error).toBeTruthy();
    expect(r.channels[0].error).toBeNull();
  });

  it("each per-field fee validation errors only its own slot (fixedFee/minPerItem/freight/voucher)", () => {
    const r = computeCalculator({
      ...SC001,
      channels: [
        { marketplace: "OK", commissionPct: 12, fixedFee: 6.75 },
        { marketplace: "BAD_FIXED", commissionPct: 12, fixedFee: -1 },
        { marketplace: "BAD_MIN", commissionPct: 12, minPerItem: -1 },
        { marketplace: "BAD_FREIGHT", commissionPct: 12, freightCost: -1 },
        {
          marketplace: "BAD_VOUCHER",
          commissionPct: 12,
          freightVoucherBands: [{ minPrice: 0, maxPrice: null, voucherCeiling: -5 }],
        },
      ],
    });
    expect(r.channels[0].error).toBeNull();
    expect(r.channels[1].error).toBe("fixedFee must be a finite number >= 0");
    expect(r.channels[2].error).toBe("minPerItem must be a finite number >= 0");
    expect(r.channels[3].error).toBe("freightCost must be a finite number >= 0");
    expect(r.channels[4].error).toBe(
      "freightVoucherBands.voucherCeiling must be a finite number >= 0",
    );
    // Every errored slot carries null prices + zeroed per-level freight (never a partial number).
    for (const bad of [1, 2, 3, 4]) {
      expect(r.channels[bad].precoAnuncioVarejo).toBeNull();
      expect(r.channels[bad].freightCostVarejo).toBe(0);
      expect(r.channels[bad].freightCostAtacado).toBe(0);
    }
  });
});

describe("SC-110 — determinism at scale", () => {
  it("identical inputs → byte-identical result across runs (many channels + sub-costs)", () => {
    const input: PriceInput = {
      ...SC001,
      otherCosts: [
        { name: "Embalagem", value: 3 },
        { name: "Frete", value: 2 },
      ],
      channels: [
        { marketplace: "A", commissionPct: 12, fixedFee: 6.75 },
        { marketplace: "B", commissionPct: 15, fixedFee: 3, minPerItem: 1 },
        { marketplace: "C", commissionPct: 20, fixedFee: 4, freightCost: 5 },
      ],
    };
    const a = computeCalculator(input);
    const b = computeCalculator(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
