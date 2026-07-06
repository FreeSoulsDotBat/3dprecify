// Canonical 3D-print pricing core — E1 full corrected model. Pure, deterministic, offline.
// Spec: specs/004-e1-pricing-model/{spec,contracts/pricing-core}.md · ADR-0008 (money) · ADR-0009 (machine).
// The backend never recomputes any price (FR-036); this module is the single source of the formula.
import { Decimal, toMoney, sumMoney } from "./rounding";

// A25: markup base moved material → custo_total, a semantic change ⇒ MAJOR bump (implicit v1 = 001 material+markup).
export const PRICING_MODEL_VERSION = "2.0.0";

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
  adminTotal?: number; // R$, ≥ 0, default 0
  markupVarejoPct: number; // %, ≥ 0
  markupAtacadoPct: number; // %, ≥ 0
  marketplaceCommissionPct?: number; // %, in [0, 100), default 0
  marketplaceFixedFee?: number; // R$, ≥ 0, default 0
}

export interface MarketplaceResult {
  precoAnuncioVarejo: number;
  recebidoLiquidoVarejo: number;
  precoAnuncioAtacado: number;
  recebidoLiquidoAtacado: number;
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
  marketplace: MarketplaceResult | null;
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
  const adminTotal = input.adminTotal ?? 0;
  const marketplaceCommissionPct = input.marketplaceCommissionPct ?? 0;
  const marketplaceFixedFee = input.marketplaceFixedFee ?? 0;

  // Validation (FR-038 / SC-008) — never compute a bad number.
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
  assertNonNegative(adminTotal, "adminTotal");
  assertNonNegative(input.markupVarejoPct, "markupVarejoPct");
  assertNonNegative(input.markupAtacadoPct, "markupAtacadoPct");
  assertNonNegative(marketplaceFixedFee, "marketplaceFixedFee");
  if (
    !Number.isFinite(marketplaceCommissionPct) ||
    marketplaceCommissionPct < 0 ||
    marketplaceCommissionPct >= 100
  ) {
    throw new ValidationError(
      "marketplaceCommissionPct must be a finite number in [0, 100)",
      "marketplaceCommissionPct",
    );
  }

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
  const adminR = toMoney(adminTotal);

  const custoTotal = sumMoney([materialR, energyR, machineR, falhaR, finishingR, laborR, adminR]); // FR-029

  // Markup over the displayed (rounded) custo_total — WYSIWYG (FR-030).
  const precoVarejo = toMoney(
    new Decimal(custoTotal).times(percentMultiplier(input.markupVarejoPct)),
  );
  const precoAtacado = toMoney(
    new Decimal(custoTotal).times(percentMultiplier(input.markupAtacadoPct)),
  );

  // US5: basic single-channel marketplace gross-up over BOTH suggested prices (FR-031). No
  // channel configured (commission AND fixed fee both 0) ⇒ no block, so the calculator stays
  // clean for direct sellers.
  const marketplace =
    marketplaceCommissionPct === 0 && marketplaceFixedFee === 0
      ? null
      : marketplaceGrossUp(
          precoVarejo,
          precoAtacado,
          marketplaceCommissionPct,
          marketplaceFixedFee,
        );

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
    marketplace,
    modelVersion: PRICING_MODEL_VERSION,
  };
}

/**
 * Gross up each base price so that, after the channel takes `commissionPct` of the LISTED price
 * plus a `fixedFee`, the seller still nets the base (FR-031). Derived over the displayed (rounded)
 * base and displayed (rounded) list price — WYSIWYG, per ADR-0008:
 *   anúncio  = (base + fixedFee) / (1 − commissionPct/100)
 *   líquido  = anúncioRounded × (1 − commissionPct/100) − fixedFee   (nets back to base)
 * The denominator is safe: commissionPct is validated to [0, 100), so `keep` ∈ (0, 1].
 */
function marketplaceGrossUp(
  precoVarejo: number,
  precoAtacado: number,
  commissionPct: number,
  fixedFee: number,
): MarketplaceResult {
  const keep = new Decimal(1).minus(new Decimal(commissionPct).dividedBy(100));
  const listAndNet = (base: number): [anuncio: number, liquido: number] => {
    const anuncioR = toMoney(new Decimal(base).plus(fixedFee).dividedBy(keep));
    const liquidoR = toMoney(new Decimal(anuncioR).times(keep).minus(fixedFee));
    return [anuncioR, liquidoR];
  };
  const [precoAnuncioVarejo, recebidoLiquidoVarejo] = listAndNet(precoVarejo);
  const [precoAnuncioAtacado, recebidoLiquidoAtacado] = listAndNet(precoAtacado);
  return {
    precoAnuncioVarejo,
    recebidoLiquidoVarejo,
    precoAnuncioAtacado,
    recebidoLiquidoAtacado,
  };
}

/** `1 + pct/100` as a Decimal (markup multiplier). */
function percentMultiplier(pct: number): Decimal {
  return new Decimal(1).plus(new Decimal(pct).dividedBy(100));
}
