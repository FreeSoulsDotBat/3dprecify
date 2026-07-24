import { computeCalculator } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import { feeCatalogSchema } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import {
  type CalcFormValues,
  type ChannelSlotForm,
  defaultCalcValues,
  defaultChannelSlot,
} from "./calculator-schema";
import { type CatalogContext, computeFromForm, formatBRL } from "./calculator-model";

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
  markupVarejoPct: "50",
  markupAtacadoPct: "30",
  channels: [],
  includeMarketplace: true,
  otherCosts: [],
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

describe("computeFromForm — channels adapter (US1, per-slot isolation)", () => {
  const slot = (over: Partial<ChannelSlotForm>): ChannelSlotForm => ({
    ...defaultChannelSlot(),
    ...over,
  });

  it("gross-ups each channel and aligns the result to its form slot", () => {
    const r = computeFromForm({
      ...canonical,
      channels: [
        slot({ marketplace: "MERCADO_LIVRE", commissionPct: "12", fixedFee: "6,75" }),
        slot({ marketplace: "SHOPEE", modality: "", commissionPct: "20", fixedFee: "4" }),
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.channels).toHaveLength(2);
    // ML Clássico 12% + R$6,75 on varejo 42,98 → 56,51; nets back to 42,98.
    expect(r.channels[0].errors).toEqual({});
    expect(r.channels[0].result?.precoAnuncioVarejo).toBeCloseTo(56.51, 2);
    expect(r.channels[0].result?.recebidoLiquidoVarejo).toBeCloseTo(42.98, 2);
    // Shopee 20% + R$4 → 58,73.
    expect(r.channels[1].result?.precoAnuncioVarejo).toBeCloseTo(58.73, 2);
  });

  it("a commission ≥ 100% errors ONLY its slot; the siblings still compute (SC-107)", () => {
    const r = computeFromForm({
      ...canonical,
      channels: [
        slot({ marketplace: "MERCADO_LIVRE", commissionPct: "12", fixedFee: "6,75" }),
        slot({ marketplace: "AMAZON", modality: "", commissionPct: "100" }),
        slot({ marketplace: "SHOPEE", modality: "", commissionPct: "20", fixedFee: "4" }),
      ],
    });
    expect(r.ok).toBe(true); // the main price is unaffected by a bad channel
    expect(r.channels[1].errors.commissionPct).toMatch(/100%/);
    expect(r.channels[1].result).toBeNull();
    expect(r.channels[0].result?.precoAnuncioVarejo).toBeCloseTo(56.51, 2);
    expect(r.channels[2].result?.precoAnuncioVarejo).toBeCloseTo(58.73, 2);
  });

  it("a non-numeric channel fee errors its slot without a NaN", () => {
    const r = computeFromForm({
      ...canonical,
      channels: [slot({ commissionPct: "abc" })],
    });
    expect(r.channels[0].errors.commissionPct).toBeTruthy();
    expect(r.channels[0].result).toBeNull();
  });

  it("blank channel fees are a valid zero-fee channel (anúncio == base)", () => {
    const r = computeFromForm({ ...canonical, channels: [slot({ modality: "" })] });
    expect(r.channels[0].errors).toEqual({});
    // commission 0 + fixed 0 → announce equals the base varejo price 42,98.
    expect(r.channels[0].result?.precoAnuncioVarejo).toBeCloseTo(42.98, 2);
    expect(r.channels[0].result?.recebidoLiquidoVarejo).toBeCloseTo(42.98, 2);
  });
});

// US2 pre-fill through the catalog context: a blank covered slot adopts the catalog fees + echoes
// provenance (feeSource + catalogVersion, ADR-0011), and the Shopee co-funded voucher is DEDUCTED from
// the líquido (FR-111a — the truth gap where it was dropped to 0 under an authoritative seal).
describe("computeFromForm — catalog context (US2 pre-fill + provenance + voucher)", () => {
  const catalog = feeCatalogSchema.parse({
    catalogVersion: "2026-07-07.x",
    schemaVersion: "1",
    generatedAt: "2026-07-07T00:00:00.000Z",
    marketplaces: [
      {
        marketplace: "SHOPEE",
        entries: [
          {
            determinants: null,
            commissionPct: null,
            fixedFee: null,
            priceBands: [
              { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
              { minPrice: 80, maxPrice: 200, commissionPct: 14, fixedFee: 18 },
              { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
            ],
            freight: {
              kind: "BAND_VOUCHER",
              bands: [
                { minPrice: 0, maxPrice: 80, voucherCeiling: 20 },
                { minPrice: 80, maxPrice: 200, voucherCeiling: 30 },
                { minPrice: 200, maxPrice: null, voucherCeiling: 40 },
              ],
            },
            source: "Central do Vendedor Shopee",
            sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
            effectiveDate: "2026-03-01",
            lastReviewed: "2026-07-07",
          },
        ],
      },
    ],
  });
  const ctx: CatalogContext = { catalog, source: "catalog", now: Date.parse("2026-07-10") };
  const slot = (over: Partial<ChannelSlotForm>): ChannelSlotForm => ({
    ...defaultChannelSlot(),
    ...over,
  });

  it("a blank Shopee slot pre-fills from the catalog and DEDUCTS the voucher (FR-111a)", () => {
    const r = computeFromForm(
      { ...canonical, channels: [slot({ marketplace: "SHOPEE", modality: "" })] },
      ctx,
    );
    const ch = r.channels[0];
    expect(ch.errors).toEqual({});
    // varejo 42,98 → Shopee 20% + R$4 announce 58,73 (∈ [0,80) → R$20 voucher).
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(58.73, 2);
    // The co-funded voucher lowers the net below base — NOT 42,98 (the old truth gap).
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(22.98, 2);
    expect(ch.result?.freightCostVarejo).toBeCloseTo(20, 2);
    // atacado 37,25 → announce 51,56 (still ∈ [0,80) → R$20 voucher) → líquido 17,25.
    expect(ch.result?.freightCostAtacado).toBeCloseTo(20, 2);
    expect(ch.result?.recebidoLiquidoAtacado).toBeCloseTo(17.25, 2);
    // Provenance echoed onto the result (ADR-0011).
    expect(ch.result?.feeSource).toBe("Central do Vendedor Shopee");
    expect(r.result?.catalogVersion).toBe("2026-07-07.x");
    expect(ch.seal.kind).toBe("reference"); // dated reference, not a manual entry
  });

  // 013 / E1-02 — the override seam. Typing ONE fee used to drop the catalog entry WHOLESALE
  // (`priceBands: undefined, freightVoucherBands: undefined`), so the co-financed Shopee voucher
  // vanished and the net received was overstated by exactly the voucher. The merge is now selective:
  // only the scalars the seller actually typed (`editedFields`) are overwritten; the band structures
  // survive. The seal stays "ajustado por você" and provenance stays cleared (unchanged semantics).
  it("E1-02: typing ONE fee keeps priceBands + the co-financed voucher (selective merge)", () => {
    const r = computeFromForm(
      {
        ...canonical,
        channels: [slot({ marketplace: "SHOPEE", modality: "", freightCost: "5" })],
      },
      ctx,
    );
    const ch = r.channels[0];
    const input = r.input?.channels?.[0];
    expect(ch.errors).toEqual({});
    // The band structures reach the engine — the whole point of the fix.
    expect(input?.priceBands).toHaveLength(3);
    expect(input?.freightVoucherBands).toHaveLength(3);
    // Only the typed scalar was overwritten.
    expect(input?.freightCost).toBe(5);
    expect(ch.editedFields).toEqual({ freightCost: 5 });
    // Announce still resolves through the band (20% + R$4 → 58,73) and the voucher (R$20) is STILL
    // deducted on top of the seller's own R$5 freight — net 17,98, not the overstated 37,98.
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(58.73, 2);
    expect(ch.result?.freightCostVarejo).toBeCloseTo(25, 2);
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(17.98, 2);
    expect(ch.result?.freightCostAtacado).toBeCloseTo(25, 2);
    // Seal + provenance semantics are untouched by the fix.
    expect(ch.seal.kind).toBe("adjusted");
    expect(ch.result?.feeSource).toBeNull();
    expect(r.result?.catalogVersion).toBeNull();
  });

  // OWNER DECISION 2026-07-23 (013, surfaced by this slice): `priceBands` IS the commission schedule
  // (`pricing-core/channels.ts:101-102` overwrites commissionPct/fixedFee from the band containing the
  // announce). Preserving the bands while the seller typed a commission would make that input silently
  // inert — trading E1-02's silent wrong for a different one. So a typed commission/fixedFee DROPS the
  // schedule ("my commission is X, not the catalog's"); the co-financed voucher, a freight dimension
  // orthogonal to commission, is preserved unconditionally. Typing only freight keeps the bands (the
  // test above). Net effect: no typed input is ever inert, and "ajustado por você" is always true.
  it("a typed commission DROPS the bands (it governs the price) but keeps the voucher", () => {
    const r = computeFromForm(
      {
        ...canonical,
        channels: [slot({ marketplace: "SHOPEE", modality: "", commissionPct: "10" })],
      },
      ctx,
    );
    const ch = r.channels[0];
    const input = r.input?.channels?.[0];
    expect(ch.editedFields).toEqual({ commissionPct: 10 });
    // The commission schedule is gone; the voucher schedule survives.
    expect(input?.priceBands).toBeUndefined();
    expect(input?.freightVoucherBands).toHaveLength(3);
    // The typed 10% now GOVERNS: varejo 42,98 / 0,9 = 47,76 — no longer the band's 20% + R$4 (58,73).
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(47.76, 2);
    // …and the co-financed voucher is still deducted (announce ∈ [0,80) → R$20), so the seller nets
    // base − voucher, exactly as on the blank slot. This is the E1-02 truth that must never regress.
    expect(ch.result?.freightCostVarejo).toBeCloseTo(20, 2);
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(22.98, 2);
    // atacado 37,25 / 0,9 = 41,39 → still ∈ [0,80) → R$20 voucher → líquido 17,25.
    expect(ch.result?.precoAnuncioAtacado).toBeCloseTo(41.39, 2);
    expect(ch.result?.recebidoLiquidoAtacado).toBeCloseTo(17.25, 2);
    expect(ch.seal.kind).toBe("adjusted");
    expect(ch.result?.feeSource).toBeNull();
    expect(r.result?.catalogVersion).toBeNull();
  });

  it("a typed fee on a NON-band entry overrides that scalar and leaves the rest of the entry", () => {
    // ML-style entry: scalar commission + an ESTIMATE freight subsidy, no bands.
    const mlCatalog = feeCatalogSchema.parse({
      catalogVersion: "2026-07-07.ml",
      schemaVersion: "1",
      generatedAt: "2026-07-07T00:00:00.000Z",
      marketplaces: [
        {
          marketplace: "MERCADO_LIVRE",
          entries: [
            {
              determinants: { listingType: "CLASSICO" },
              commissionPct: 12,
              fixedFee: 6.75,
              freight: { kind: "ESTIMATE", thresholdPrice: 79, defaultSubsidy: 10 },
              source: "Central de Vendas Mercado Livre",
              sourceUrl: "https://www.mercadolivre.com.br/ajuda/tarifas",
              effectiveDate: "2026-03-01",
              lastReviewed: "2026-07-07",
            },
          ],
        },
      ],
    });
    const r = computeFromForm(
      {
        ...canonical,
        channels: [
          slot({ marketplace: "MERCADO_LIVRE", modality: "CLASSICO", commissionPct: "15" }),
        ],
      },
      { catalog: mlCatalog, source: "catalog", now: Date.parse("2026-07-10") },
    );
    const input = r.input?.channels?.[0];
    expect(input?.commissionPct).toBe(15); // the typed scalar wins
    expect(input?.fixedFee).toBeCloseTo(6.75, 2); // untyped → still the entry's
    expect(input?.freightCost).toBeCloseTo(10, 2); // untyped → the entry's subsidy survives
    expect(r.channels[0].seal.kind).toBe("adjusted");
  });

  it("stamps no catalogVersion when there is no catalog context (all-manual)", () => {
    const r = computeFromForm({
      ...canonical,
      channels: [slot({ marketplace: "MERCADO_LIVRE", commissionPct: "12", fixedFee: "6,75" })],
    });
    expect(r.result?.catalogVersion).toBeNull();
    expect(r.channels[0].result?.feeSource).toBeNull();
  });

  it("deducts DIFFERENT vouchers for varejo vs atacado when they fall in different bands", () => {
    // markup varejo 180% → precoVarejo 80,22 → Shopee announce ∈ [80,200) → R$30 voucher; atacado 30%
    // → precoAtacado 37,25 → announce ∈ [0,80) → R$20 voucher. Proves the per-level resolution end-to-end.
    const r = computeFromForm(
      {
        ...canonical,
        markupVarejoPct: "180",
        channels: [slot({ marketplace: "SHOPEE", modality: "" })],
      },
      ctx,
    );
    const ch = r.channels[0];
    expect(ch.result?.freightCostVarejo).toBeCloseTo(30, 2);
    expect(ch.result?.freightCostAtacado).toBeCloseTo(20, 2);
  });
});

describe("US4 — 'Incluir marketplaces no preço' master toggle (SC-105)", () => {
  // The toggle is UI visibility, not math: when off we simply stop computing the channels. The
  // direct cost×markup headline is byte-identical either way (a marketplace fee is a gross-up ON
  // TOP of the price, never folded into custo_total), so this pins that toggling off drops the
  // channel outcomes WITHOUT perturbing the headline the seller reads first.
  it("off → zero channel outcomes, byte-identical custoTotal + varejo + atacado", () => {
    const on = computeFromForm({ ...defaultCalcValues, includeMarketplace: true });
    const off = computeFromForm({ ...defaultCalcValues, includeMarketplace: false });

    expect(on.channels.length).toBeGreaterThan(0);
    expect(off.channels).toHaveLength(0);
    expect(off.result?.channels).toHaveLength(0);

    expect(off.result?.custoTotal).toBe(on.result?.custoTotal);
    expect(off.result?.precoVarejo).toBe(on.result?.precoVarejo);
    expect(off.result?.precoAtacado).toBe(on.result?.precoAtacado);
    // Off also stamps no catalog provenance — there is no channel that could have used it.
    expect(off.result?.catalogVersion).toBeNull();
  });
});

describe("US5 — itemized 'Outros custos' slot maps to the engine (SC-106 / FR-114-116)", () => {
  it("named sub-costs sum into custo_total; each is echoed as its own result line", () => {
    const base = computeFromForm(canonical);
    const withCosts = computeFromForm({
      ...canonical,
      otherCosts: [
        { name: "Embalagem", value: "3,00" },
        { name: "Frete", value: "2,00" },
      ],
    });
    expect(withCosts.result?.otherCosts).toEqual([
      { name: "Embalagem", value: 3 },
      { name: "Frete", value: 2 },
    ]);
    expect(withCosts.result?.custoTotal).toBeCloseTo((base.result?.custoTotal ?? 0) + 5, 2);
    expect(withCosts.otherCostErrors).toEqual([undefined, undefined]);
  });

  it("a blank-value row contributes nothing and yields no engine line (untouched → 0)", () => {
    const r = computeFromForm({ ...canonical, otherCosts: [{ name: "Embalagem", value: "" }] });
    expect(r.result?.otherCosts).toEqual([]);
    expect(r.result?.admin).toBe(0);
    expect(r.otherCostErrors).toEqual([undefined]);
  });

  it("a negative row errors ONLY that row; the valid rows still fold into the price (FR-116)", () => {
    const r = computeFromForm({
      ...canonical,
      otherCosts: [
        { name: "Embalagem", value: "3,00" },
        { name: "Ruim", value: "-1" },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.otherCostErrors[0]).toBeUndefined();
    expect(r.otherCostErrors[1]).toBe(messages.calculator.validation.negative);
    // Only the valid row is folded in — the bad row is dropped from the sum, never a NaN.
    expect(r.result?.otherCosts).toEqual([{ name: "Embalagem", value: 3 }]);
  });

  it("a non-numeric row errors that row with the 'invalid' message", () => {
    const r = computeFromForm({ ...canonical, otherCosts: [{ name: "x", value: "abc" }] });
    expect(r.otherCostErrors[0]).toBe(messages.calculator.validation.invalid);
    expect(r.result?.otherCosts).toEqual([]);
  });

  it("a blank name is accepted (kept as an empty label for the UI fallback, FR-116)", () => {
    const r = computeFromForm({ ...canonical, otherCosts: [{ name: "", value: "5" }] });
    expect(r.result?.otherCosts).toEqual([{ name: "", value: 5 }]);
  });
});

describe("formatBRL — pt-BR/BRL formatting", () => {
  it("formats with the R$ prefix, comma decimals and thousands separator", () => {
    expect(formatBRL(28.65)).toBe("R$ 28,65");
    expect(formatBRL(1234.5)).toBe("R$ 1.234,50");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

// 008/T004 — the R7 seam: the BOM page reuses the calculator's parse by reading the EXACT
// engine input computeFromForm built, so a BOM line and the single-piece calculator derive from
// one PriceInput (SC-402 anchoring at the web layer; the numeric identity lives in pricing-core).
describe("computeFromForm — exposes the engine input it computed from (008 R7)", () => {
  it("returns the built PriceInput; recomputing it reproduces the result byte-for-byte", () => {
    const r = computeFromForm(canonical);
    expect(r.input).toBeTruthy();
    expect(JSON.stringify(computeCalculator(r.input!))).toBe(JSON.stringify(r.result));
  });

  it("carries the parsed channels + otherCosts on the input (same slots the result shows)", () => {
    const r = computeFromForm({
      ...canonical,
      channels: [
        {
          marketplace: "OUTRO",
          modality: "",
          commissionPct: "20",
          fixedFee: "5,00",
          minPerItem: "",
          freightCost: "",
        },
      ],
      otherCosts: [{ name: "Embalagem", value: "3,00" }],
    });
    expect(r.input?.channels).toHaveLength(1);
    expect(r.input?.channels?.[0].commissionPct).toBe(20);
    expect(r.input?.channels?.[0].fixedFee).toBe(5);
    expect(r.input?.otherCosts).toEqual([{ name: "Embalagem", value: 3 }]);
  });

  it("is null when a scalar field is invalid (no engine input was built)", () => {
    const r = computeFromForm({ ...canonical, costPerRoll: "abc" });
    expect(r.input).toBeNull();
  });
});
