import { describe, it, expect } from "vitest";

import { grossUp } from "../src/index";
import type { PriceBand, VoucherBand } from "../src/index";

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

// FR-111a / SC-111 — the Shopee co-funded free-shipping voucher: a truthful POST-deduction that
// lowers the seller's net by the voucher for the band of the RESULTING announce (never grossed up,
// never folded into custo_total). The voucher is resolved by the ANNOUNCE, not the base — so a slot
// whose base is below a band edge but whose announce crosses it deducts the higher band's voucher,
// and varejo/atacado can deduct different vouchers. Guards the truth gap where dropping it (freightCost
// 0) overstated the líquido under an authoritative seal.
describe("FR-111a / SC-111 — Shopee co-funded freight voucher", () => {
  const shopeeBands: PriceBand[] = [
    { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
    { minPrice: 80, maxPrice: 200, commissionPct: 14, fixedFee: 18 },
    { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
  ];
  const shopeeVoucher: VoucherBand[] = [
    { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
    { minPrice: 80, maxPrice: 200, voucherCeiling: 30 },
    { minPrice: 200, maxPrice: null, voucherCeiling: 40 },
  ];

  it("deducts the voucher for the announce band, lowering the net below base", () => {
    const withVoucher = grossUp(42.98, {
      commissionPct: 20,
      fixedFee: 4,
      priceBands: shopeeBands,
      freightVoucherBands: shopeeVoucher,
    });
    expect(withVoucher.anuncio).toBe(58.73); // unchanged — freight is NEVER grossed up
    expect(withVoucher.freightCost).toBe(20); // announce 58,73 ∈ [0,80) → R$20 voucher
    expect(withVoucher.liquido).toBe(22.98); // 42,98 − 20 (the seller co-funds the voucher)

    // Same fees WITHOUT the voucher would have overstated the net by exactly R$20 (the old bug).
    const dropped = grossUp(42.98, { commissionPct: 20, fixedFee: 4, priceBands: shopeeBands });
    expect(dropped.freightCost).toBe(0);
    expect(dropped.liquido).toBe(42.98);
    expect(dropped.liquido - withVoucher.liquido).toBeCloseTo(20, 2);
  });

  it("resolves the voucher by the ANNOUNCE band, not the base (base 76 → announce in [80,200))", () => {
    const r = grossUp(76, {
      commissionPct: 20,
      fixedFee: 4,
      priceBands: shopeeBands,
      freightVoucherBands: shopeeVoucher,
    });
    expect(r.anuncio).toBe(109.3); // base 76 seeds [0,80) but the announce lands in [80,200)
    expect(r.freightCost).toBe(30); // → the R$30 voucher, not R$20 from the base's band
    expect(r.liquido).toBe(46.0); // 76 − 30
  });

  it("is deterministic across runs (same input → same voucher/net)", () => {
    const a = grossUp(42.98, {
      commissionPct: 20,
      fixedFee: 4,
      priceBands: shopeeBands,
      freightVoucherBands: shopeeVoucher,
    });
    const b = grossUp(42.98, {
      commissionPct: 20,
      fixedFee: 4,
      priceBands: shopeeBands,
      freightVoucherBands: shopeeVoucher,
    });
    expect(a).toEqual(b);
  });

  it("a voucher larger than the margin yields a TRUTHFUL negative net — never clamped", () => {
    // base 10 → announce (10+4)/0,80 = 17,50 (∈ [0,80) → R$20 voucher). The R$20 voucher exceeds the
    // ~R$3,50 margin, so the seller LOSES money: líquido = 17,50 − 3,50 − 4 − 20 = −10,00. The engine
    // surfaces the loss (Constitution II) rather than clamping to 0 and hiding it. This pins the value
    // so a future display-side clamp can't silently change the formula's output.
    const r = grossUp(10, {
      commissionPct: 20,
      fixedFee: 4,
      priceBands: shopeeBands,
      freightVoucherBands: shopeeVoucher,
    });
    expect(r.anuncio).toBe(17.5);
    expect(r.freightCost).toBe(20);
    expect(r.liquido).toBe(-10.0);
  });
});
