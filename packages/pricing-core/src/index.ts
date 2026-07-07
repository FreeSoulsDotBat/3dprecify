// Canonical 3D-print pricing core — E1 v3: itemized "outros custos" + multi-channel marketplace
// pricing. Pure, deterministic, offline. Specs: specs/005-marketplace-multichannel/spec.md (on top
// of specs/004-e1-pricing-model). ADR-0008 (money) · ADR-0009 (machine) · ADR-0011 (3.0.0 result
// contract). The backend never recomputes any price (FR-118); this module is the single source of
// the formula.
import { grossUp, type ChannelFees, type PriceBand, type VoucherBand } from "./channels";
import { Decimal, toMoney, sumMoney } from "./rounding";

// 3.0.0 (ADR-0011): itemized admin (`otherCosts[]`) + the multi-channel result (`channels[]`) are
// breaking to the 2.0.0 result contract ⇒ MAJOR bump. The constant tracks the package.json major so
// a saved calc records which formula produced it.
export const PRICING_MODEL_VERSION = "3.0.0";

/** One named "outros custos" sub-cost; its value folds into custo_total exactly as 004's adminTotal. */
export interface OtherCostItem {
  name: string;
  value: number; // R$, ≥ 0
}

/**
 * One marketplace listing channel to price. `marketplace`/`feeDeterminants`/`feeSource` are opaque
 * provenance labels the engine echoes back onto the result — it never resolves fees (the client passes
 * already-resolved fees in, FR-110 / A6). Price-keyed resolution the engine DOES own: the Amazon
 * per-item commission floor (`minPerItem`, SC-112), the price-band fixed-point (`priceBands`, SC-108),
 * and the co-funded freight voucher (`freightVoucherBands`, Shopee, FR-111a) — all by listing price.
 */
export interface ChannelInput {
  marketplace?: string;
  feeDeterminants?: Record<string, string>;
  feeSource?: string; // human-readable provenance of the resolved fees (catalog source), echoed back
  commissionPct: number; // %, [0, 100) — the base commission (a matching priceBand overrides it)
  fixedFee?: number; // R$, ≥ 0, default 0
  minPerItem?: number; // R$, ≥ 0, default 0 — Amazon per-item commission floor
  freightCost?: number; // R$, ≥ 0, default 0 — deducted from líquido (never added to custo_total)
  freightVoucherBands?: VoucherBand[]; // Shopee co-funded voucher, deducted by the announce band (FR-111a)
  priceBands?: PriceBand[]; // fee by listing-price band (Shopee / ML custo fixo) — resolved by pricing-core
}

/**
 * Per-channel gross-up outcome (varejo + atacado), shown together in "Preços por canal" (FR-112). A
 * slot that fails its own validation carries an `error` and null prices — its siblings still compute
 * (per-slot isolation, SC-107); the engine never throws for one bad channel.
 */
export interface ChannelResult {
  marketplace: string | null;
  feeDeterminants: Record<string, string> | null;
  feeSource: string | null; // provenance of the resolved fees (catalog source) — echoed, null when manual
  precoAnuncioVarejo: number | null;
  recebidoLiquidoVarejo: number | null;
  precoAnuncioAtacado: number | null;
  recebidoLiquidoAtacado: number | null;
  freightCost: number; // total freight deducted from the VAREJO líquido (atacado may differ by band)
  error: string | null;
}

export interface PriceInput {
  costPerRoll: number; // R$, ≥ 0
  rollWeightKg: number; // kg, > 0
  printGrams: number; // g, ≥ 0
  wasteGrams?: number; // g, ≥ 0, default 0
  printTimeHours: number; // h, ≥ 0
  avgPowerKw: number; // kW, ≥ 0 (effective average draw)
  tariffPerKwh: number; // R$/kWh, ≥ 0
  machineValue: number; // R$, ≥ 0
  machineLifetimeHours: number; // h, > 0
  maintenanceReservePerHour?: number; // R$/h, ≥ 0, default 0
  failurePct?: number; // %, ≥ 0, default 0
  finishTimeHours?: number; // h, ≥ 0, default 0
  finishRatePerHour?: number; // R$/h, ≥ 0, default 0
  laborHours?: number; // h, ≥ 0, default 0
  laborRatePerHour?: number; // R$/h, ≥ 0, default 0
  otherCosts?: OtherCostItem[]; // 0..N named sub-costs; Σ value = admin (replaces 004 `adminTotal`)
  markupVarejoPct: number; // %, ≥ 0
  markupAtacadoPct: number; // %, ≥ 0
  channels?: ChannelInput[]; // 0..N listing channels (replaces the 004 single marketplace fee)
  catalogVersion?: string; // provenance of the resolved fees, echoed onto the result; null when all-manual
}

export interface PriceResult {
  material: number;
  energy: number;
  machine: number;
  falha: number;
  finishing: number;
  labor: number;
  admin: number;
  custoTotal: number;
  precoVarejo: number;
  precoAtacado: number;
  channels: ChannelResult[];
  catalogVersion: string | null;
  modelVersion: string;
}

export class ValidationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/** Finite and ≥ 0 (the default bound for every numeric input). */
function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(`${field} must be a finite number >= 0`, field);
  }
}

/** Finite and strictly > 0 (a denominator that must not be zero). */
function assertPositive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(`${field} must be a finite number > 0`, field);
  }
}

export function computeCalculator(input: PriceInput): PriceResult {
  // Normalize optionals to their 0 default (FR-023).
  const wasteGrams = input.wasteGrams ?? 0;
  const maintenanceReservePerHour = input.maintenanceReservePerHour ?? 0;
  const failurePct = input.failurePct ?? 0;
  const finishTimeHours = input.finishTimeHours ?? 0;
  const finishRatePerHour = input.finishRatePerHour ?? 0;
  const laborHours = input.laborHours ?? 0;
  const laborRatePerHour = input.laborRatePerHour ?? 0;
  const otherCosts = input.otherCosts ?? [];
  const channels = input.channels ?? [];

  // Validation (FR-038 / SC-008) — never compute a bad number. Shared cost inputs still throw
  // (a bad denominator dooms the whole calc); per-channel validation lives in computeChannel.
  assertNonNegative(input.costPerRoll, "costPerRoll");
  assertPositive(input.rollWeightKg, "rollWeightKg");
  assertNonNegative(input.printGrams, "printGrams");
  assertNonNegative(wasteGrams, "wasteGrams");
  assertNonNegative(input.printTimeHours, "printTimeHours");
  assertNonNegative(input.avgPowerKw, "avgPowerKw");
  assertNonNegative(input.tariffPerKwh, "tariffPerKwh");
  assertNonNegative(input.machineValue, "machineValue");
  assertPositive(input.machineLifetimeHours, "machineLifetimeHours");
  assertNonNegative(maintenanceReservePerHour, "maintenanceReservePerHour");
  assertNonNegative(failurePct, "failurePct");
  assertNonNegative(finishTimeHours, "finishTimeHours");
  assertNonNegative(finishRatePerHour, "finishRatePerHour");
  assertNonNegative(laborHours, "laborHours");
  assertNonNegative(laborRatePerHour, "laborRatePerHour");
  otherCosts.forEach((c, i) => assertNonNegative(c.value, `otherCosts[${i}].value`));
  assertNonNegative(input.markupVarejoPct, "markupVarejoPct");
  assertNonNegative(input.markupAtacadoPct, "markupAtacadoPct");

  // Full-precision intermediates (Decimal); quantize only at emit (ADR-0008).
  // Production inputs — the three lines the failure factor covers (A16.4).
  const material = new Decimal(input.costPerRoll)
    .dividedBy(new Decimal(input.rollWeightKg).times(1000))
    .times(new Decimal(input.printGrams).plus(wasteGrams)); // FR-024
  // A16.2 (SC-005): energy = the effective average draw (avgPowerKw) × time × tariff.
  // There is deliberately NO nameplate-power × duty-cycle path — the corrected model takes the
  // real average kW directly, so only this line moves when avgPowerKw changes.
  const energy = new Decimal(input.printTimeHours)
    .times(input.avgPowerKw)
    .times(input.tariffPerKwh); // FR-025
  // ADR-0009 A (SC-007): ONE coherent capital-recovery rate — straight-line amortization
  // (machineValue / lifetimeHours) + a maintenance reserve/hour. No separate depreciation/ROI/
  // maintenance lines that would triple-count the same wear.
  const machineHourRate = new Decimal(input.machineValue)
    .dividedBy(input.machineLifetimeHours)
    .plus(maintenanceReservePerHour);
  const machine = machineHourRate.times(input.printTimeHours); // FR-026

  const materialR = toMoney(material);
  const energyR = toMoney(energy);
  const machineR = toMoney(machine);

  // A16.4 (SC-006): a failed print wastes ALL production inputs, so failure is a % of
  // material + energy + machine — never material alone. Taken over the (rounded) production
  // subtotal so the shown falha = failure% of the shown subtotal (21,50 → 2,15 for SC-001).
  const producaoR = sumMoney([materialR, energyR, machineR]);
  const falhaR = toMoney(new Decimal(producaoR).times(failurePct).dividedBy(100)); // FR-027

  // Cost lines OUTSIDE the failure base (OQ-8).
  const finishingR = toMoney(new Decimal(finishTimeHours).times(finishRatePerHour)); // FR-028
  const laborR = toMoney(new Decimal(laborHours).times(laborRatePerHour));
  // FR-114: "outros custos" is now a slot of named sub-costs; admin = Σ value (each rounded per
  // ADR-0008). An empty slot ⇒ 0 — behaviourally identical to 004's single `adminTotal`.
  const adminR = sumMoney(otherCosts.map((c) => toMoney(c.value)));

  const custoTotal = sumMoney([materialR, energyR, machineR, falhaR, finishingR, laborR, adminR]); // FR-029

  // Markup over the displayed (rounded) custo_total — WYSIWYG (FR-030).
  const precoVarejo = toMoney(
    new Decimal(custoTotal).times(percentMultiplier(input.markupVarejoPct)),
  );
  const precoAtacado = toMoney(
    new Decimal(custoTotal).times(percentMultiplier(input.markupAtacadoPct)),
  );

  // Multi-channel gross-up (FR-110/112): each configured channel is priced independently over BOTH
  // suggested prices and shown together ("Preços por canal"). No marketplace fee is EVER folded into
  // custo_total. Foundational covers %-commission + fixedFee + a generic freightCost; the Amazon
  // per-item floor + price-band fixed-point + per-slot error isolation land in US1.
  const channelResults = channels.map((ch) => computeChannel(precoVarejo, precoAtacado, ch));

  return {
    material: materialR,
    energy: energyR,
    machine: machineR,
    falha: falhaR,
    finishing: finishingR,
    labor: laborR,
    admin: adminR,
    custoTotal,
    precoVarejo,
    precoAtacado,
    channels: channelResults,
    catalogVersion: input.catalogVersion ?? null,
    modelVersion: PRICING_MODEL_VERSION,
  };
}

/**
 * Price ONE channel over both base prices (FR-110/112). The client passes ALREADY-RESOLVED fees
 * (commission %, fixed fee, per-item floor, freight, price bands); pricing-core owns the price-keyed
 * math — the band fixed-point + the commission floor + the gross-up (see ./channels). A slot that
 * fails its OWN validation returns an `error` with null prices and never throws, so its siblings keep
 * computing (per-slot isolation, SC-107).
 */
function computeChannel(
  precoVarejo: number,
  precoAtacado: number,
  ch: ChannelInput,
): ChannelResult {
  const commissionPct = ch.commissionPct;
  const fixedFee = ch.fixedFee ?? 0;
  const minPerItem = ch.minPerItem ?? 0;
  const freightCost = ch.freightCost ?? 0;
  const voucherBands = ch.freightVoucherBands ?? [];

  const shell: ChannelResult = {
    marketplace: ch.marketplace ?? null,
    feeDeterminants: ch.feeDeterminants ?? null,
    feeSource: ch.feeSource ?? null,
    precoAnuncioVarejo: null,
    recebidoLiquidoVarejo: null,
    precoAnuncioAtacado: null,
    recebidoLiquidoAtacado: null,
    freightCost: 0,
    error: null,
  };
  const fail = (error: string): ChannelResult => ({ ...shell, error });

  if (!Number.isFinite(commissionPct) || commissionPct < 0 || commissionPct >= 100) {
    return fail("commissionPct must be a finite number in [0, 100)");
  }
  if (!Number.isFinite(fixedFee) || fixedFee < 0)
    return fail("fixedFee must be a finite number >= 0");
  if (!Number.isFinite(minPerItem) || minPerItem < 0) {
    return fail("minPerItem must be a finite number >= 0");
  }
  if (!Number.isFinite(freightCost) || freightCost < 0) {
    return fail("freightCost must be a finite number >= 0");
  }
  if (voucherBands.some((b) => !Number.isFinite(b.voucherCeiling) || b.voucherCeiling < 0)) {
    return fail("freightVoucherBands.voucherCeiling must be a finite number >= 0");
  }

  const fees: ChannelFees = {
    commissionPct,
    fixedFee,
    minPerItem,
    freightCost,
    freightVoucherBands: voucherBands.length > 0 ? voucherBands : undefined,
    priceBands: ch.priceBands,
  };
  const varejo = grossUp(precoVarejo, fees);
  const atacado = grossUp(precoAtacado, fees);
  return {
    ...shell,
    freightCost: varejo.freightCost,
    precoAnuncioVarejo: varejo.anuncio,
    recebidoLiquidoVarejo: varejo.liquido,
    precoAnuncioAtacado: atacado.anuncio,
    recebidoLiquidoAtacado: atacado.liquido,
  };
}

/** `1 + pct/100` as a Decimal (markup multiplier). */
function percentMultiplier(pct: number): Decimal {
  return new Decimal(1).plus(new Decimal(pct).dividedBy(100));
}

// The per-channel gross-up primitive (band fixed-point + commission floor) + its types live in
// ./channels; re-export so consumers and tests reach them from the package entry.
export { grossUp } from "./channels";
export type { ChannelFees, ChannelLevel, PriceBand, VoucherBand } from "./channels";
