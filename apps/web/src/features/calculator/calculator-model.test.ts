import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { computeCalculator } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import { feeCatalogSchema } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";

import {
  CALC_FIELD_NAMES,
  type CalcFormValues,
  type ChannelSlotForm,
  COST_FIELDS,
  defaultCalcValues,
  defaultChannelSlot,
  LABOR_AND_FINISH_FIELDS,
  PAYBACK_YEAR_OPTIONS,
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
    // 016/US10 — re-baseline SEM wasteGrams (pricing-core 4.0.0, ADR-0026): material = gramas ×
    // custo/kg, sem soma de desperdício. Confirmado RODANDO computeCalculator com este vetor.
    expect(result?.material).toBeCloseTo(10.0, 2);
    expect(result?.energy).toBeCloseTo(0.5, 2);
    expect(result?.machine).toBeCloseTo(10.0, 2);
    expect(result?.falha).toBeCloseTo(2.05, 2);
    expect(result?.finishing).toBeCloseTo(5.0, 2);
    expect(result?.custoTotal).toBeCloseTo(27.55, 2);
    expect(result?.precoVarejo).toBeCloseTo(41.33, 2);
    expect(result?.precoAtacado).toBeCloseTo(35.82, 2);
  });

  it("the default (seed) form is valid and produces a coherent price", () => {
    const { ok, result } = computeFromForm(defaultCalcValues);
    expect(ok).toBe(true);
    // 016/PR-C homologação (B1) — seed: 100/1kg/100g, printTime 5h, avgPower 0,12kW, tariff 1,
    // machine 4000/3600h (1200h/ano "quase todo dia" × 3 anos payback — the ritmo mode default),
    // no optionals. Confirmed by RUNNING computeCalculator with this seed (not guessed):
    // material 10,00 + energy 0,60 + machine 5,56 = custo_total 16,16 → varejo 24,24 (×1,5) ·
    // atacado 21,01 (×1,3, 16,16×1,3=21,008 rounds ROUND_HALF_UP).
    expect(result?.material).toBeCloseTo(10.0, 2);
    expect(result?.energy).toBeCloseTo(0.6, 2);
    expect(result?.machine).toBeCloseTo(5.56, 2);
    expect(result?.custoTotal).toBeCloseTo(16.16, 2);
    expect(result?.precoVarejo).toBeCloseTo(24.24, 2);
    expect(result?.precoAtacado).toBeCloseTo(21.01, 2);
  });
});

// 016/US9 (T022, FR-911, arquitetura-016.md §7) — PR-C reorganizes sections ("Ajustes opcionais"
// folds into "Custos da peça"; Tempo/Valor do acabamento migram para "Mão de obra e custos") and
// wires h+min + the machine-cost question at the BORDER only. None of that touches
// `computeFromForm`/`calculatorSchema`/the engine — this is the byte-identity proof: the same
// canonical vector, the same `CalcFormValues` shape, before and after the fatia.
describe("US9 (T022) — a reorganização de seção não muda NENHUM resultado (prova byte-idêntica)", () => {
  it("o vetor canônico R$ 27,55 / 41,33 / 35,82 permanece intacto após a fusão de seções", () => {
    const { result } = computeFromForm(canonical);
    expect(result?.custoTotal).toBeCloseTo(27.55, 2);
    expect(result?.precoVarejo).toBeCloseTo(41.33, 2);
    expect(result?.precoAtacado).toBeCloseTo(35.82, 2);
  });

  it("a fusão é PURA UI — CalcFormValues continua com as mesmas 16 chaves escalares do motor", () => {
    // 016/US10 — 17 → 16: wasteGrams saiu (o motor recusa a chave desde pricing-core 4.0.0).
    expect(CALC_FIELD_NAMES).toHaveLength(16);
    expect(CALC_FIELD_NAMES).toContain("printTimeHours");
    expect(CALC_FIELD_NAMES).toContain("machineValue");
    expect(CALC_FIELD_NAMES).toContain("machineLifetimeHours");
  });

  it("os campos fundidos migram de array, nunca de nome (o motor lê o MESMO CalcFieldName)", () => {
    // "Ajustes opcionais" funde em "Custos da peça": maintenanceReservePerHour/failurePct
    // agora vivem em COST_FIELDS (wasteGrams saiu em PR-D/US10).
    const costNames = COST_FIELDS.map((f) => f.name);
    expect(costNames).toEqual(expect.arrayContaining(["maintenanceReservePerHour", "failurePct"]));
    // Tempo/Valor do acabamento migram para "Mão de obra e custos", junto com laborHours/laborRate.
    const laborNames = LABOR_AND_FINISH_FIELDS.map((f) => f.name);
    expect(laborNames).toEqual(
      expect.arrayContaining([
        "finishTimeHours",
        "finishRatePerHour",
        "laborHours",
        "laborRatePerHour",
      ]),
    );
  });
});

describe("computeFromForm — pt-BR/BRL parsing", () => {
  it("accepts comma decimals and thousands separators", () => {
    const r = computeFromForm({
      ...canonical,
      costPerRoll: "1.000,00",
      rollWeightKg: "1",
      printGrams: "10",
    });
    expect(r.ok).toBe(true);
    // (1000 / 1000g) * 10g = 10,00
    expect(r.result?.material).toBeCloseTo(10.0, 2);
  });

  it("tolerates typed R$ / unit affixes around the number", () => {
    const r = computeFromForm({ ...canonical, costPerRoll: "R$ 100,00", avgPowerKw: "0,10 kW" });
    expect(r.ok).toBe(true);
    expect(r.result?.material).toBeCloseTo(10.0, 2);
  });

  it("treats a blank optional field as 0 (does not error)", () => {
    const r = computeFromForm({
      ...canonical,
      finishTimeHours: "",
      failurePct: "",
    });
    expect(r.ok).toBe(true);
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
    const r = computeFromForm({ ...canonical, failurePct: "xx" });
    expect(r.ok).toBe(false);
    expect(r.fieldErrors.failurePct).toBeTruthy();
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
    // 016/US10 — re-baseline (base varejo 41,33): ML Clássico 12% + R$6,75 → 54,64; nets back to 41,33.
    expect(r.channels[0].errors).toEqual({});
    expect(r.channels[0].result?.precoAnuncioVarejo).toBeCloseTo(54.64, 2);
    expect(r.channels[0].result?.recebidoLiquidoVarejo).toBeCloseTo(41.33, 2);
    // Shopee 20% + R$4 → 56,66.
    expect(r.channels[1].result?.precoAnuncioVarejo).toBeCloseTo(56.66, 2);
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
    expect(r.channels[0].result?.precoAnuncioVarejo).toBeCloseTo(54.64, 2);
    expect(r.channels[2].result?.precoAnuncioVarejo).toBeCloseTo(56.66, 2);
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
    // commission 0 + fixed 0 → announce equals the base varejo price 41,33.
    expect(r.channels[0].result?.precoAnuncioVarejo).toBeCloseTo(41.33, 2);
    expect(r.channels[0].result?.recebidoLiquidoVarejo).toBeCloseTo(41.33, 2);
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
    // 016/US10 — re-baseline (varejo 41,33): Shopee 20% + R$4 announce 56,66 (∈ [0,80) → R$20 voucher).
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(56.66, 2);
    // The co-funded voucher lowers the net below base — NOT 41,33 (the old truth gap).
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(21.33, 2);
    expect(ch.result?.freightCostVarejo).toBeCloseTo(20, 2);
    // atacado 35,82 → announce 49,78 (still ∈ [0,80) → R$20 voucher) → líquido 15,82.
    expect(ch.result?.freightCostAtacado).toBeCloseTo(20, 2);
    expect(ch.result?.recebidoLiquidoAtacado).toBeCloseTo(15.82, 2);
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
    // 016/US10 — re-baseline: announce still resolves through the band (20% + R$4 → 56,66) and the
    // voucher (R$20) is STILL deducted on top of the seller's own R$5 freight — net 16,33.
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(56.66, 2);
    expect(ch.result?.freightCostVarejo).toBeCloseTo(25, 2);
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(16.33, 2);
    expect(ch.result?.freightCostAtacado).toBeCloseTo(25, 2);
    // Seal + provenance semantics are untouched by the fix.
    expect(ch.seal.kind).toBe("adjusted");
    expect(ch.result?.feeSource).toBeNull();
    expect(r.result?.catalogVersion).toBeNull();
  });

  // OWNER DECISION 2026-07-23 (013), corrected by the confirmation audit (F1): `priceBands` IS the
  // commission schedule (`pricing-core/channels.ts` overwrites commissionPct/fixedFee from the band
  // containing the announce). Only a typed COMMISSION drops the schedule ("my commission is X, not the
  // catalog's"). A typed fixedFee must NOT — Shopee has no top-level commissionPct (it lives in the
  // bands), so dropping them on a fixedFee edit fell back to 0% commission and overstated the net (F1).
  // The co-financed voucher (a freight dimension) is preserved unconditionally.
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
    // 016/US10 — re-baseline (varejo 41,33): the typed 10% now GOVERNS — 41,33 / 0,9 = 45,92 — no
    // longer the band's 20% + R$4 (56,66).
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(45.92, 2);
    // …and the co-financed voucher is still deducted (announce ∈ [0,80) → R$20), so the seller nets
    // base − voucher, exactly as on the blank slot. This is the E1-02 truth that must never regress.
    expect(ch.result?.freightCostVarejo).toBeCloseTo(20, 2);
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(21.33, 2);
    // atacado 35,82 / 0,9 = 39,80 → still ∈ [0,80) → R$20 voucher → líquido 15,82.
    expect(ch.result?.precoAnuncioAtacado).toBeCloseTo(39.8, 2);
    expect(ch.result?.recebidoLiquidoAtacado).toBeCloseTo(15.82, 2);
    expect(ch.seal.kind).toBe("adjusted");
    expect(ch.result?.feeSource).toBeNull();
    expect(r.result?.catalogVersion).toBeNull();
  });

  // F1 (confirmation audit, ALTO regression guard): typing ONLY the fixed fee on a band-based Shopee
  // slot must NOT drop the schedule. Before the fix, `fixedFee` was in the drop-trigger, and because
  // Shopee's top-level commissionPct is null (→ 0), dropping the bands charged 0% commission instead
  // of the band's 20% — the seller's net was silently overstated by the full commission (~R$9-12).
  it("F1: typing ONLY fixedFee on a band slot keeps the schedule — charges the band's %, never 0", () => {
    const r = computeFromForm(
      {
        ...canonical,
        channels: [slot({ marketplace: "SHOPEE", modality: "", fixedFee: "4" })],
      },
      ctx,
    );
    const ch = r.channels[0];
    const input = r.input?.channels?.[0];
    expect(ch.editedFields).toEqual({ fixedFee: 4 });
    // The commission schedule SURVIVES — a typed fixedFee does not drop it (fixedFee is inert here;
    // the band governs it). The bug was this being `undefined` → 0% commission charged.
    expect(input?.priceBands).toHaveLength(3);
    expect(input?.freightVoucherBands).toHaveLength(3);
    // 016/US10 — re-baseline: the band's 20% + R$4 govern varejo (announce 56,66), NOT a collapsed
    // 0% (which would announce 41,33 and overstate the net). The exact silent-money defect F1 named.
    expect(ch.result?.precoAnuncioVarejo).toBeCloseTo(56.66, 2);
    expect(ch.result?.recebidoLiquidoVarejo).toBeCloseTo(21.33, 2);
    expect(ch.seal.kind).toBe("adjusted");
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
    // 016/US10 — re-baseline: markup varejo 180% → precoVarejo 77,14 → Shopee announce 110,63 ∈
    // [80,200) → R$30 voucher; atacado 30% → precoAtacado 35,82 → announce ∈ [0,80) → R$20 voucher.
    // Proves the per-level resolution end-to-end.
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

  // 015/A8 ([F11a-007], decisao do dono 2026-08-03) — o campo mostra a aliquota APLICADA, e SO
  // quando ela e unica. A homologacao mediu: com AMAZON e sem categoria os quatro campos ficam com
  // placeholder "0,00" (a tela le `Comissão 0,00 %`) enquanto "Precos por canal" mostra um preco
  // com 15% ja embutidos. O numero que o vendedor procura primeiro estava em branco.
  //
  // A ARMADILHA, e ela quase me fez trocar uma mentira por outra: com `priceBands` a comissao VARIA
  // por faixa, e `entryToChannelFees` devolve `commissionPct: entry.commissionPct ?? 0` — ZERO para
  // uma entrada bandada. Publicar isso no campo diria "Comissão 0,00%" com ar de verdade.
  // 016/PR-F homologação (A1) — superou o [F11a-007] acima: o campo NÃO fica mais em branco só
  // porque a entrada é bandada. Uma vez que o motor precificou o nível, a banda que ele REALMENTE
  // aplicou é conhecida (`appliedBand`), e o placeholder passa a mostrar ESSA banda — nunca uma
  // "Comissão 0,00%" fabricada, e nunca uma banda diferente da que o preço na tela usa.
  it("[A1] taxa por FAIXA mostra a banda REALMENTE aplicada — nunca 'Comissão 0,00%'", () => {
    const r = computeFromForm(
      { ...canonical, channels: [slot({ marketplace: "SHOPEE", modality: "" })] },
      ctx,
    );
    const ch = r.channels[0];
    // base 41,33 (canonical) → anúncio 56,66 (comentado na linha 416 acima) ∈ banda [0,80): 20% / R$4,00.
    expect(ch.appliedFees.commissionPct).toBe(20);
    expect(ch.appliedFees.fixedFee).toBe(4);
    expect(ch.appliedFeesFromBand).toBe(true);
    // Esta banda não carrega `fixedFeeRule` — o fixo é a constante, não um % resolvido.
    expect(ch.appliedFixedFeeRulePct).toBeNull();
  });

  it("[A1] um campo DIGITADO na entrada bandada não vira referência — o vendedor já vê o próprio número", () => {
    const r = computeFromForm(
      {
        ...canonical,
        channels: [slot({ marketplace: "SHOPEE", modality: "", commissionPct: "25" })],
      },
      ctx,
    );
    const ch = r.channels[0];
    // Comissão digitada dropa o schedule (regra 013/F1) — nada de bandada aqui, e o placeholder
    // continua sem valor porque o campo já tem o número do vendedor.
    expect(ch.appliedFees.commissionPct).toBeUndefined();
    expect(ch.appliedFeesFromBand).toBeFalsy();
  });

  it("[F11a-007] o que o vendedor DIGITOU nao vira referencia — ele ja ve o proprio numero", () => {
    const r = computeFromForm(
      {
        ...canonical,
        channels: [slot({ marketplace: "SHOPEE", modality: "", freightCost: "12,00" })],
      },
      ctx,
    );
    expect(r.channels[0]?.appliedFees.freightCost).toBeUndefined();
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

// ---------------------------------------------------------------------------------------------
// 014/US1 — the category reaches the model, the seal names its ORIGIN, and the choice is per slot.
// ---------------------------------------------------------------------------------------------

describe("014 — category as a per-slot determinant", () => {
  const prov = {
    freight: { kind: "NONE" as const },
    source: "Tabela de comissões Amazon",
    sourceUrl: "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920",
    effectiveDate: "2026-07-28",
    lastReviewed: "2026-07-28",
  };
  const catalog = feeCatalogSchema.parse({
    catalogVersion: "2026-07-28.t",
    schemaVersion: "1",
    generatedAt: "2026-07-28T00:00:00.000Z",
    marketplaces: [
      {
        marketplace: "AMAZON",
        categorySpine: [
          { id: "casa", name: "Casa e Cozinha", parentId: null },
          { id: "casa-vasos", name: "Vasos e Cachepôs", parentId: "casa" },
        ],
        entries: [
          { ...prov, determinants: { plan: "PROFISSIONAL" }, commissionPct: 15, fixedFee: 0 },
          {
            ...prov,
            determinants: { plan: "PROFISSIONAL", category: "casa" },
            commissionPct: 12,
            fixedFee: 0,
          },
        ],
      },
    ],
  });
  const ctx: CatalogContext = {
    catalog,
    source: "catalog",
    now: Date.parse("2026-07-28"),
  };
  // Only the two fields these tests vary — `exactOptionalPropertyTypes` rejects spreading a Partial
  // over required fields, and being explicit is clearer than casting around it.
  const slot = (over: { category?: string; commissionPct?: string } = {}): ChannelSlotForm => ({
    ...defaultChannelSlot("AMAZON"),
    modality: "PROFISSIONAL",
    ...(over.category !== undefined ? { category: over.category } : {}),
    ...(over.commissionPct !== undefined ? { commissionPct: over.commissionPct } : {}),
  });
  const run = (slots: ChannelSlotForm[]) =>
    computeFromForm({ ...defaultCalcValues, channels: slots }, ctx);

  it("a chosen category changes the commission the model uses", () => {
    expect(run([slot({ category: "casa" })]).channels[0].result?.feeSource).toBeDefined();
    expect(run([slot({ category: "casa" })]).channels[0].seal).toMatchObject({
      kind: "reference",
      originCategoryName: "Casa e Cozinha",
    });
    // no category → the PUBLISHED catch-all, sealed as such and never as a plain reference
    expect(run([slot()]).channels[0].seal.kind).toBe("catchAll");
  });

  // The number can come from an ANCESTOR (rates are piecewise-constant down the tree). The seller
  // must be able to see that, or he reads a parent's rate as his own category's.
  it("an inherited rate seals with the ANCESTOR's name, not the chosen category's", () => {
    expect(run([slot({ category: "casa-vasos" })]).channels[0].seal).toMatchObject({
      kind: "reference",
      originCategoryName: "Casa e Cozinha",
    });
  });

  it("the choice is PER SLOT — a category on one channel does not leak into another", () => {
    const chs = run([slot({ category: "casa" }), slot()]).channels;
    expect(chs[0].seal.kind).toBe("reference");
    expect(chs[1].seal.kind).toBe("catchAll");
  });

  it("a typed commission still wins over the category (override always wins)", () => {
    expect(run([slot({ category: "casa", commissionPct: "9" })]).channels[0].seal.kind).toBe(
      "adjusted",
    );
  });
});

// 014/T114a (SC-817 / FR-014a) — a recusa do motor tem de ATRAVESSAR o adaptador. Provar só em
// `pricing-core` prova a aritmética e não prova o trajeto: o defeito que este teste guarda não é
// "o motor calculou errado", é "o motor recusou e a tela mostrou R$ 0,00 sob selo de Referência".
// É a mesma lição que o ADR-0024 §5 já tinha cobrado uma vez neste incremento.
describe("SC-817 — nível não precificado atravessa até o selo (lacuna publicada)", () => {
  /** Custo fixo do ML com a lacuna que a fonte deixa: nada publicado entre R$ 50,01 e R$ 78,99
   *  (FR-014a — a lacuna permanece lacuna, nunca interpolada). */
  const catalogComLacuna = feeCatalogSchema.parse({
    catalogVersion: "2026-07-28.ml",
    schemaVersion: "1",
    generatedAt: "2026-07-28T00:00:00.000Z",
    marketplaces: [
      {
        marketplace: "MERCADO_LIVRE",
        entries: [
          {
            determinants: null,
            commissionPct: null,
            fixedFee: null,
            priceBands: [
              { minPrice: 0, maxPrice: 29.01, commissionPct: 14, fixedFee: 6.25 },
              { minPrice: 29.01, maxPrice: 50.01, commissionPct: 14, fixedFee: 6.5 },
              { minPrice: 79, maxPrice: null, commissionPct: 14, fixedFee: 0 },
            ],
            freight: { kind: "NONE" },
            source: "Mercado Livre — custos de venda",
            sourceUrl: "https://www.mercadolivre.com.br/ajuda/custos-de-venda_869",
            effectiveDate: "2026-07-01",
            lastReviewed: "2026-07-28",
          },
        ],
      },
    ],
  });
  const ctx: CatalogContext = {
    catalog: catalogComLacuna,
    source: "catalog",
    now: Date.parse("2026-07-28"),
  };
  const mlSlot: ChannelSlotForm = {
    ...defaultChannelSlot(),
    marketplace: "MERCADO_LIVRE",
    modality: "",
  };

  it("o varejo cai na lacuna → sem preço e SEM selo de referência", () => {
    // O varejo canônico (R$ 42,98) precisa anunciar por ~R$ 57 para fechar — dentro da lacuna.
    const r = computeFromForm({ ...canonical, channels: [mlSlot] }, ctx);
    const ch = r.channels[0];
    expect(ch.errors).toEqual({}); // o slot é VÁLIDO: quem não tem tarifa é o preço, não o vendedor
    expect(ch.result?.precoAnuncioVarejo).toBeNull();
    expect(ch.result?.recebidoLiquidoVarejo).toBeNull();
    // O selo é a metade que faltava: sem ela a tela some com o número e mantém "Referência: Mercado
    // Livre" ao lado, vouchando por um preço que ela mesma se recusou a mostrar.
    expect(ch.seal.kind).toBe("none");
  });

  it("acima da lacuna a MESMA tabela volta a precificar, e o selo volta a valer", () => {
    // markup alto empurra o varejo (e o anúncio) para cima da lacuna.
    const r = computeFromForm(
      { ...canonical, markupVarejoPct: "200", markupAtacadoPct: "180", channels: [mlSlot] },
      ctx,
    );
    const ch = r.channels[0];
    expect(ch.result?.precoAnuncioVarejo).not.toBeNull();
    expect(ch.result?.recebidoLiquidoVarejo).not.toBeNull();
    expect(ch.seal.kind).toBe("reference");
  });
});

describe("015/A8 — [F03a-003] atacado acima do varejo e VALIDO (decisao do dono 2026-08-03)", () => {
  // O motor nao recusa, e essa e a metade que importa: um teste que so verificasse "aparece o
  // aviso" passaria com uma implementacao que BLOQUEASSE a conta — que e o oposto do decidido.
  it("o motor calcula normalmente, sem erro de campo", () => {
    const r = computeFromForm({
      ...canonical,
      markupVarejoPct: "50",
      markupAtacadoPct: "200",
    });
    expect(r.ok).toBe(true);
    expect(r.fieldErrors).toEqual({});
    expect(r.result).not.toBeNull();
  });

  it("e o preco de atacado fica MESMO acima do varejo — o gatilho do aviso e observavel", () => {
    const r = computeFromForm({
      ...canonical,
      markupVarejoPct: "50",
      markupAtacadoPct: "200",
    });
    expect(r.result!.precoAtacado).toBeGreaterThan(r.result!.precoVarejo);
  });

  it("no caso normal o gatilho NAO dispara — senao o aviso apareceria sempre", () => {
    const r = computeFromForm({ ...canonical, markupVarejoPct: "120", markupAtacadoPct: "60" });
    expect(r.result!.precoAtacado).toBeLessThan(r.result!.precoVarejo);
  });
});

// 016/US12 (T046, FR-919) — the byte-identical proof: for every combination the calculator supports
// TODAY (3 marketplaces × today's determinants), `channelFieldPlan` (T045/T051) + the derived-render
// path (T052) must not move a single digit. The SERVED catalog (not the seed) is used because it is
// the one carrying real Amazon/Shopee data — the same fixture `calculator.spec.ts`'s e2e suite pins
// against. Numbers below were produced by RUNNING this exact test, not guessed (RA5/FR-919).
describe("016/US12 (T046) — byte-identical fixture: today's 3 marketplaces × determinants", () => {
  const servedCatalog: unknown = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../../../../../backend/app/data/catalog.json", import.meta.url)),
      "utf-8",
    ),
  );
  const catalog = feeCatalogSchema.parse(servedCatalog);
  const ctx: CatalogContext = { catalog, source: "catalog", now: Date.parse("2026-08-06") };

  const mercadoLivreManual: ChannelSlotForm = {
    ...defaultChannelSlot("MERCADO_LIVRE"),
    modality: "CLASSICO",
    commissionPct: "12",
    fixedFee: "6",
  };
  const amazonProfissionalCatchAll: ChannelSlotForm = {
    ...defaultChannelSlot("AMAZON"),
    modality: "PROFISSIONAL",
  };
  const amazonIndividualCatchAll: ChannelSlotForm = {
    ...defaultChannelSlot("AMAZON"),
    modality: "INDIVIDUAL",
  };
  const amazonCategoria: ChannelSlotForm = {
    ...defaultChannelSlot("AMAZON"),
    modality: "PROFISSIONAL",
    category: "roupas-e-acessorios",
  };
  const shopeeCatalogPrefill: ChannelSlotForm = {
    ...defaultChannelSlot("SHOPEE"),
    modality: "",
  };

  it("pins the exact anúncio/líquido for every supported combination", () => {
    const r = computeFromForm(
      {
        ...canonical,
        channels: [
          mercadoLivreManual,
          amazonProfissionalCatchAll,
          amazonIndividualCatchAll,
          amazonCategoria,
          shopeeCatalogPrefill,
        ],
      },
      ctx,
    );
    expect(r.ok).toBe(true);
    const pin = r.channels.map((ch) => ({
      seal: ch.seal.kind,
      anuncioVarejo: ch.result?.precoAnuncioVarejo ?? null,
      liquidoVarejo: ch.result?.recebidoLiquidoVarejo ?? null,
    }));
    // Pinned by RUNNING this exact fixture against the SERVED catalog (not guessed). ML has no
    // reference (empty entries today) → a typed value stands on its own (seal "none", not
    // "adjusted" — there is nothing to have adjusted AWAY from).
    expect(pin).toEqual([
      { seal: "none", anuncioVarejo: 53.78, liquidoVarejo: 41.33 }, // ML manual (12% + R$6)
      { seal: "catchAll", anuncioVarejo: 48.62, liquidoVarejo: 41.33 }, // Amazon PROFISSIONAL catch-all
      // 016/US14 (FR-921) — era 48,62, IDÊNTICO ao Profissional, e essa igualdade era o defeito:
      // o plano Individual cobra R$ 2,00 por item que o app não cobrava. (41,33 + 2,00) / 0,85 =
      // 50,98. O preço SOBE, e subir é a consequência aceita (US14-AC3). O Profissional acima fica
      // parado, e é ELE que prova que o fixo é do plano e não da tabela de comissão.
      { seal: "catchAll", anuncioVarejo: 50.98, liquidoVarejo: 41.33 }, // Amazon INDIVIDUAL catch-all
      { seal: "reference", anuncioVarejo: 48.06, liquidoVarejo: 41.33 }, // Amazon + categoria
      // hotfix 016/A2 (2026-08-07) — o líquido era 21,33 = 41,33 − R$ 20,00 de "voucher
      // co-financiado". A fonte atribui o subsídio à SHOPEE (art. 26839/23431), não ao vendedor, e
      // o catálogo passou a `freight: {kind:"NONE"}`. O ANÚNCIO não se move (o frete nunca foi
      // gross-upado): o que volta é a margem que nunca deveria ter saído. Re-baseline RODADO.
      { seal: "reference", anuncioVarejo: 56.66, liquidoVarejo: 41.33 }, // Shopee catalog pre-fill
    ]);
  });
});

// 019/T026 (US2 — handoff "Vocabulário e marca": "1 anos" → "1 ano"). O rótulo nasce em
// `PAYBACK_YEAR_OPTIONS` (calculator-schema.ts) a partir de `messages.machineCost.paybackYearsLabel`;
// o singular é do TEXTO, e o teste lê a opção pronta — que é o que a pessoa vê no select.
describe("019/T026 — o payback no singular", () => {
  it('n=1 → "1 ano"; n=3 → "3 anos"', () => {
    const porValor = new Map(PAYBACK_YEAR_OPTIONS.map((o) => [o.value, o.label]));
    expect(porValor.get("1")).toBe("1 ano");
    expect(porValor.get("3")).toBe("3 anos");
  });
});
