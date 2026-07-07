import { describe, it, expect } from "vitest";

import { grossUp } from "../src/index";
import type { PriceBand } from "../src/index";

// SC-112 — Amazon per-item commission MINIMUM (floor): the charged commission is
// `max(commissionPct/100 × list, minPerItem)`, so the gross-up is piecewise. Tested on the pure
// per-level `grossUp` (base in → announce/líquido out) with controlled base prices.
describe("SC-112 — Amazon per-item commission floor", () => {
  it("floor binds at a low price: net == base, announce higher than the %-only gross-up", () => {
    const withFloor = grossUp(5, { commissionPct: 15, fixedFee: 0, minPerItem: 1 });
    expect(withFloor.anuncio).toBe(6.0); // base + minPerItem + fixedFee (floor regime)
    expect(withFloor.liquido).toBe(5.0); // still nets to base
    const noFloor = grossUp(5, { commissionPct: 15, fixedFee: 0, minPerItem: 0 });
    expect(withFloor.anuncio).toBeGreaterThan(noFloor.anuncio); // strictly less optimistic
  });

  it("floor does NOT bind at a high price: equals the plain %-gross-up", () => {
    const withFloor = grossUp(100, { commissionPct: 15, fixedFee: 0, minPerItem: 1 });
    const plain = grossUp(100, { commissionPct: 15, fixedFee: 0, minPerItem: 0 });
    expect(withFloor.anuncio).toBe(plain.anuncio);
    expect(withFloor.liquido).toBe(100.0);
  });

  it("no minimum (minPerItem 0 — ML/Shopee) → the floor term vanishes", () => {
    const r = grossUp(42.98, { commissionPct: 12, fixedFee: 6.75, minPerItem: 0 });
    expect(r.anuncio).toBe(56.51);
    expect(r.liquido).toBe(42.98);
  });

  it("is deterministic at the floor boundary", () => {
    const a = grossUp(5, { commissionPct: 15, fixedFee: 0, minPerItem: 1 });
    const b = grossUp(5, { commissionPct: 15, fixedFee: 0, minPerItem: 1 });
    expect(a).toEqual(b);
  });
});

// SC-108 — price-band fixed-point: the fee depends on the band of the COMPUTED announce price, which
// depends on the fee → a bounded, deterministic fixed-point (half-open [min,max), lower-inclusive).
describe("SC-108 — price-band fixed-point determinism", () => {
  const shopeeBands: PriceBand[] = [
    { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
    { minPrice: 80, maxPrice: 200, commissionPct: 14, fixedFee: 18 },
    { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
  ];

  it("stays in the low band when the announce lands below R$80", () => {
    const r = grossUp(42.98, { commissionPct: 20, fixedFee: 4, priceBands: shopeeBands });
    expect(r.anuncio).toBe(58.73); // (42,98 + 4) / 0,80, in [0, 80)
    expect(r.appliedBand).toEqual([0, 80]);
    expect(r.liquido).toBe(42.98);
  });

  it("crosses into the middle band when the gross-up pushes the announce past R$80", () => {
    // base 76 seeds band [0,80) → announce (76+4)/0,80 = 100 → band [80,200) → recompute → stable
    const r = grossUp(76, { commissionPct: 20, fixedFee: 4, priceBands: shopeeBands });
    expect(r.appliedBand).toEqual([80, 200]);
    expect(r.anuncio).toBe(109.3); // (76+18)/0,86
    expect(r.liquido).toBe(76.0);
  });

  it("is deterministic (no oscillation) across runs", () => {
    const a = grossUp(76, { commissionPct: 20, fixedFee: 4, priceBands: shopeeBands });
    const b = grossUp(76, { commissionPct: 20, fixedFee: 4, priceBands: shopeeBands });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("F3: converges deterministically at the steep ML R$12,50 boundary (no oscillation)", () => {
    const mlBands: PriceBand[] = [
      { minPrice: 0, maxPrice: 12.5, commissionPct: 50, fixedFee: 0 },
      { minPrice: 12.5, maxPrice: 79, commissionPct: 12, fixedFee: 5 },
      { minPrice: 79, maxPrice: null, commissionPct: 12, fixedFee: 0 },
    ];
    // base 6,25: seed [0,12.5) → announce 12,50 → lands in [12.5,79) → recompute → stable, no flip-flop
    const a = grossUp(6.25, { commissionPct: 50, fixedFee: 0, priceBands: mlBands });
    const b = grossUp(6.25, { commissionPct: 50, fixedFee: 0, priceBands: mlBands });
    expect(a).toEqual(b); // deterministic
    expect(a.appliedBand).toEqual([12.5, 79]);
    expect(a.liquido).toBe(6.25); // still nets to base
  });
});
