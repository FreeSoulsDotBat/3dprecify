// Canonical 3D-print pricing core — E1 v3: itemized "outros custos" + multi-channel marketplace
// pricing. Pure, deterministic, offline. Specs: specs/005-marketplace-multichannel/spec.md (on top
// of specs/004-e1-pricing-model). ADR-0008 (money) · ADR-0009 (machine) · ADR-0011 (3.0.0 result
// contract). The backend never recomputes any price (FR-118); this module is the single source of
// the formula.
import {
  grossUp,
  type BandMode,
  type ChannelFees,
  type PriceBand,
  type VoucherBand,
} from "./channels.ts";
import { Decimal, toMoney, sumMoney } from "./rounding.ts";

// 3.0.0 (ADR-0011): itemized admin (`otherCosts[]`) + the multi-channel result (`channels[]`) are
// breaking to the 2.0.0 result contract ⇒ MAJOR bump. The constant tracks the package.json major so
// a saved calc records which formula produced it.
// 3.1.0 (ADR-0016): E3 adds `computeBom` (assembly = independent per-piece sum + per-marketplace
// rollup) and exports `toMoney`/`sumMoney`/`Decimal` — additive public surface ⇒ MINOR bump.
// 4.0.0 (ADR-0026, 016/US10): `wasteGrams` SAI da entrada — o material passa de
// `custo/kg × (gramas + desperdício)` para `custo/kg × gramas`. Remoção de campo de entrada é
// quebra ⇒ MAJOR, e o rótulo é congelado dentro de um snapshot imutável (ADR-0019): ele precisa
// continuar respondendo QUAL fórmula produziu aquele número.
export const PRICING_MODEL_VERSION = "4.0.0";

/**
 * Campos que já foram entrada do motor e **não são mais aceitos** (ADR-0026 §3.1).
 *
 * A recusa é NOMINAL e por CHAVE PRESENTE, não por valor: um `{...documentoAntigo}` carrega a chave,
 * e é assim que o campo voltaria na prática. Ignorar em silêncio era a alternativa rejeitada — é a
 * definição do defeito que a US10 existe para matar: um preço diferente sem nenhum sinal.
 */
export const RETIRED_INPUT_FIELDS = ["wasteGrams"] as const;

/** Um campo aposentado encontrado num documento gravado, com o valor que a tela vai declarar. */
export interface DiscardedField {
  field: (typeof RETIRED_INPUT_FIELDS)[number];
  /** Sempre texto: a folha é número numa entrada viva e string num documento gravado. Vazio quando
   *  a chave existia sem valor — a CHAVE é o fato a declarar, o valor é só o que dá para mostrar. */
  value: string;
}

/**
 * A porta documentada da recusa (ADR-0026 §3.2): tira os campos aposentados de um documento gravado
 * e devolve, junto, o que foi descartado — para que a tela possa DIZER (FR-913).
 *
 * Pura, determinística, offline e **genérica na folha**: o mesmo mapeamento serve ao documento de
 * cenário (folha string) e a uma entrada viva (folha número).
 *
 * Ela mora aqui, e não em `entities/`/`shared/`, porque "o `wasteGrams` existiu até a 3.x" é a mesma
 * informação que `PRICING_MODEL_VERSION` data. Dois lugares que precisam concordar viram um lugar
 * que fica para trás.
 */
export function stripRetiredFields<T extends Record<string, unknown>>(
  stored: T,
): { kept: Omit<T, (typeof RETIRED_INPUT_FIELDS)[number]>; discarded: DiscardedField[] } {
  // O espalhamento copia só as chaves PRÓPRIAS enumeráveis; o `delete` abaixo garante que nem uma
  // chave com `undefined` sobrevive. Atribuir `undefined` no lugar do `delete` devolveria um
  // documento que o próprio motor recusa — a porta cuspindo o que a porta existe para consertar.
  const kept: Record<string, unknown> = { ...stored };
  const discarded: DiscardedField[] = [];
  for (const field of RETIRED_INPUT_FIELDS) {
    if (!(field in stored)) continue;
    const value = stored[field];
    discarded.push({ field, value: value == null ? "" : String(value) });
    delete kept[field];
  }
  return { kept: kept as Omit<T, (typeof RETIRED_INPUT_FIELDS)[number]>, discarded };
}

/**
 * `major(modelVersion) < 4` — o sinal para um documento CONGELADO, que não tem a folha para
 * inspecionar (o desperdício já vem somado dentro de `material`, ADR-0026 §3.3).
 *
 * O 4 é literal de propósito: é o major em que a remoção aconteceu, um fato permanente. Derivá-lo de
 * `PRICING_MODEL_VERSION` faria a resposta mudar sozinha no dia de uma 5.0.0 que nada tem a ver com
 * o desperdício.
 */
export function isPreRemovalModel(modelVersion: string): boolean {
  return Number.parseInt(modelVersion.split(".")[0], 10) < 4;
}

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
  bandMode?: BandMode; // ABSENT = "SELECTION" (ADR-0024) — absence is what preserves every stored payload
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
  // Total freight deducted from EACH level's líquido — per level because a co-funded voucher is
  // resolved by that level's announce band (varejo/atacado can differ). 0 when the slot has no freight.
  freightCostVarejo: number;
  freightCostAtacado: number;
  error: string | null;
}

export interface PriceInput {
  costPerRoll: number; // R$, ≥ 0
  rollWeightKg: number; // kg, > 0
  /** g, ≥ 0 — **todo** o filamento que a peça consome: purga, suporte e brim entram aqui (4.0.0 /
   *  FR-914). O antigo `wasteGrams` foi removido em 4.0.0 e é RECUSADO (ADR-0026). */
  printGrams: number;
  printTimeHours: number; // h, ≥ 0
  avgPowerKw: number; // kW, ≥ 0 (effective average draw)
  tariffPerKwh: number; // R$/kWh, ≥ 0
  machineValue: number; // R$, ≥ 0
  machineLifetimeHours: number; // h, > 0
  maintenanceReservePerHour?: number; // R$/h, ≥ 0, default 0
  /**
   * %, ≥ 0, default 0 — e **sem teto, deliberadamente** (015/A8, `[F03a-002]`, decisão do dono
   * 2026-08-03). A auditoria pré-provisionamento perguntou se `failurePct = 1000` deveria ser
   * recusado, já que produz uma falha de 10× o subtotal de produção. Não deve: **300% representa
   * legitimamente uma peça que falha três vezes antes de sair**, e um teto arbitrário recusaria um
   * caso real. O número é do vendedor.
   *
   * Este comentário existe para impedir que o próximo leitor "conserte" o que foi decidido.
   */
  failurePct?: number;
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
  /** The named sub-costs, rounded (ADR-0008) and in input order — each renders as its own breakdown
   *  line (FR-115); Σ value === `admin`. Empty when the "Outros custos" slot is empty. */
  otherCosts: OtherCostItem[];
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
  // A PRIMEIRA coisa que acontece aqui, antes de qualquer validação (ADR-0026 §3.1): um campo
  // aposentado é recusado pelo NOME, e a mensagem diz a saída. Se esta recusa viesse depois, uma
  // entrada que também fosse inválida por outro motivo culparia o outro campo — e o chamador
  // consertaria a coisa errada, deixando o descarte silencioso de pé.
  for (const field of RETIRED_INPUT_FIELDS) {
    if (field in input) {
      throw new ValidationError(
        `${field} foi removido do modelo de preço em 4.0.0 — use stripRetiredFields() antes de recomputar`,
        field,
      );
    }
  }

  // Normalize optionals to their 0 default (FR-023).
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
  // 4.0.0 (FR-024 / ADR-0026): material = gramas × custo por grama. O somando de desperdício saiu —
  // purga/suporte/brim entram nas GRAMAS USADAS, e o que se perde por impressão inteira perdida é a
  // taxa de falha. Eram dois campos que o vendedor lia como a mesma coisa (homologação do dono, D2).
  const material = new Decimal(input.costPerRoll)
    .dividedBy(new Decimal(input.rollWeightKg).times(1000))
    .times(input.printGrams);
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
  // FR-114/115: "outros custos" is now a slot of named sub-costs. Each value is rounded per ADR-0008
  // and echoed back (in order) as its own breakdown line; admin = Σ of those rounded lines. An empty
  // slot ⇒ [] / 0 — behaviourally identical to 004's single `adminTotal`.
  const otherCostsR: OtherCostItem[] = otherCosts.map((c) => ({
    name: c.name,
    value: toMoney(c.value),
  }));
  const adminR = sumMoney(otherCostsR.map((c) => c.value));

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
    otherCosts: otherCostsR,
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
    freightCostVarejo: 0,
    freightCostAtacado: 0,
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
    // Carried through, never re-derived. Dropping it here would silently degrade a progressive
    // schedule back to selection — the exact defect ADR-0024 fixes, reintroduced where the default
    // makes it invisible (ADR-0024 §5 names losing this field as the real risk, not the arithmetic).
    ...(ch.bandMode ? { bandMode: ch.bandMode } : {}),
  };
  const varejo = grossUp(precoVarejo, fees);
  const atacado = grossUp(precoAtacado, fees);
  return {
    ...shell,
    freightCostVarejo: varejo.freightCost,
    freightCostAtacado: atacado.freightCost,
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

// ── E3 assembly compute (ADR-0016, 3.1.0) ────────────────────────────────────────────────────────
// A BOM prices N independent lines (each a full single-piece input × a quantity) and sums them —
// no shared-plate amortization in 3.1.0 (spec Q1; a shared-plate mode can extend this additively).
// Contract: specs/008-e3-multi-piece-bom/contracts/pricing-core-bom.md.

/** One BOM line: the existing single-piece input (reused verbatim) × a finite integer qty ≥ 0. */
export interface BomLineInput {
  input: PriceInput;
  quantity: number;
}

/** Per-line outcome: the per-UNIT result (unchanged) + its money scaled by quantity. */
export interface BomLineResult {
  line: PriceResult;
  quantity: number;
  custoTotal: number;
  precoVarejo: number;
  precoAtacado: number;
}

/**
 * Per-marketplace assembly rollup (FR-403). Money fields are assembly TOTALS — Σ over the
 * contributing lines of (that line's slot values × quantity), per level. Counts are per LINE,
 * not per slot: a line with several slots of one marketplace contributes once (its money still
 * sums every valid slot), and it counts as skipped only when EVERY one of its slots for that
 * marketplace errored (honest, not silent — extends SC-107). A rollup nobody fed
 * (`contributingLines === 0`) reports null prices, never a fake R$ 0,00.
 */
export interface BomChannelRollup {
  marketplace: string | null;
  precoAnuncioVarejo: number | null;
  recebidoLiquidoVarejo: number | null;
  precoAnuncioAtacado: number | null;
  recebidoLiquidoAtacado: number | null;
  freightCostVarejo: number;
  freightCostAtacado: number;
  contributingLines: number;
  skippedLines: number;
}

export interface BomResult {
  lines: BomLineResult[];
  custoTotal: number;
  precoVarejo: number;
  precoAtacado: number;
  channels: BomChannelRollup[];
  modelVersion: string;
}

/** Decimal accumulator behind one BomChannelRollup while the lines stream in. */
interface RollupAccumulator {
  marketplace: string | null;
  anuncioVarejo: Decimal;
  liquidoVarejo: Decimal;
  anuncioAtacado: Decimal;
  liquidoAtacado: Decimal;
  freightVarejo: Decimal;
  freightAtacado: Decimal;
  contributingLines: number;
  skippedLines: number;
}

/**
 * Canonical assembly compute (ADR-0016). Money rule one level up from ADR-0008: the per-unit line
 * is already rounded (2dp), per-line×qty is `toMoney(Decimal × qty)` — never native `*` — and every
 * aggregate is `sumMoney` of those already-rounded per-line values, so the assembly total equals
 * the sum of the numbers the user SEES (FR-412, no double-rounding). A line's channel error stays
 * channel-local (per-slot isolation); a bad quantity or piece input throws ValidationError exactly
 * like computeCalculator does.
 */
export function computeBom(lines: BomLineInput[]): BomResult {
  lines.forEach((l, i) => {
    if (!Number.isInteger(l.quantity) || l.quantity < 0) {
      throw new ValidationError(
        `lines[${i}].quantity must be a finite integer >= 0`,
        `lines[${i}].quantity`,
      );
    }
  });

  const lineResults: BomLineResult[] = lines.map(({ input, quantity }) => {
    const line = computeCalculator(input);
    const times = (perUnit: number): number => toMoney(new Decimal(perUnit).times(quantity));
    return {
      line,
      quantity,
      custoTotal: times(line.custoTotal),
      precoVarejo: times(line.precoVarejo),
      precoAtacado: times(line.precoAtacado),
    };
  });

  // Per-marketplace rollup — grouped in first-appearance order (deterministic; Map keeps it).
  const rollups = new Map<string | null, RollupAccumulator>();
  for (const { line, quantity } of lineResults) {
    // Line-scoped flags so the counts stay per LINE even when a line carries several slots of
    // the same marketplace (money accumulates per slot; counts resolve after the line closes).
    const lineFlags = new Map<string | null, { ok: boolean; err: boolean }>();
    for (const slot of line.channels) {
      let acc = rollups.get(slot.marketplace);
      if (!acc) {
        acc = {
          marketplace: slot.marketplace,
          anuncioVarejo: new Decimal(0),
          liquidoVarejo: new Decimal(0),
          anuncioAtacado: new Decimal(0),
          liquidoAtacado: new Decimal(0),
          freightVarejo: new Decimal(0),
          freightAtacado: new Decimal(0),
          contributingLines: 0,
          skippedLines: 0,
        };
        rollups.set(slot.marketplace, acc);
      }
      const flags = lineFlags.get(slot.marketplace) ?? { ok: false, err: false };
      lineFlags.set(slot.marketplace, flags);
      // Two ways a slot cannot feed the rollup, and BOTH are skips, never silent drops: its own
      // validation failed, or a level is UNPRICED — no published band covers that announce
      // (SC-817). Summing an unpriced level as R$ 0,00 would understate the kit under a seal; a
      // partial sum is exactly the lie the whole rollup exists to avoid.
      if (
        slot.error !== null ||
        slot.precoAnuncioVarejo === null ||
        slot.precoAnuncioAtacado === null
      ) {
        flags.err = true; // honest: resolved to a skipped LINE below, never silently dropped
        continue;
      }
      flags.ok = true;
      // Past that guard a slot carries the four prices together (computeChannel writes announce and
      // líquido as one outcome per level): a `?? 0` here would add four dead branches the
      // 100%-branch gate can never cover — the non-null assertion states the invariant instead.
      acc.anuncioVarejo = acc.anuncioVarejo.plus(
        new Decimal(slot.precoAnuncioVarejo!).times(quantity),
      );
      acc.liquidoVarejo = acc.liquidoVarejo.plus(
        new Decimal(slot.recebidoLiquidoVarejo!).times(quantity),
      );
      acc.anuncioAtacado = acc.anuncioAtacado.plus(
        new Decimal(slot.precoAnuncioAtacado!).times(quantity),
      );
      acc.liquidoAtacado = acc.liquidoAtacado.plus(
        new Decimal(slot.recebidoLiquidoAtacado!).times(quantity),
      );
      acc.freightVarejo = acc.freightVarejo.plus(
        new Decimal(slot.freightCostVarejo).times(quantity),
      );
      acc.freightAtacado = acc.freightAtacado.plus(
        new Decimal(slot.freightCostAtacado).times(quantity),
      );
    }
    // Close the line: one contributing count per marketplace it fed; skipped only when every
    // slot of that marketplace on this line errored. A flags entry exists only because a slot
    // set ok OR err, so `!ok` implies err — a third branch would be dead code the 100%-branch
    // gate can never cover.
    for (const [marketplace, flags] of lineFlags) {
      const acc = rollups.get(marketplace)!;
      if (flags.ok) acc.contributingLines += 1;
      else acc.skippedLines += 1;
    }
  }

  const channels: BomChannelRollup[] = [...rollups.values()].map((acc) => ({
    marketplace: acc.marketplace,
    precoAnuncioVarejo: acc.contributingLines === 0 ? null : toMoney(acc.anuncioVarejo),
    recebidoLiquidoVarejo: acc.contributingLines === 0 ? null : toMoney(acc.liquidoVarejo),
    precoAnuncioAtacado: acc.contributingLines === 0 ? null : toMoney(acc.anuncioAtacado),
    recebidoLiquidoAtacado: acc.contributingLines === 0 ? null : toMoney(acc.liquidoAtacado),
    freightCostVarejo: toMoney(acc.freightVarejo),
    freightCostAtacado: toMoney(acc.freightAtacado),
    contributingLines: acc.contributingLines,
    skippedLines: acc.skippedLines,
  }));

  return {
    lines: lineResults,
    custoTotal: sumMoney(lineResults.map((l) => l.custoTotal)),
    precoVarejo: sumMoney(lineResults.map((l) => l.precoVarejo)),
    precoAtacado: sumMoney(lineResults.map((l) => l.precoAtacado)),
    channels,
    modelVersion: PRICING_MODEL_VERSION,
  };
}

// The per-channel gross-up primitive (band fixed-point + commission floor) + its types live in
// ./channels; re-export so consumers and tests reach them from the package entry.
export { grossUp } from "./channels.ts";
export type { BandMode, ChannelFees, ChannelLevel, PriceBand, VoucherBand } from "./channels.ts";
// 3.1.0 public money primitives (ADR-0016): consumers (the BOM feature layer) format/verify with
// these instead of ever doing native float arithmetic — pricing-core stays the only money home.
export { Decimal, toMoney, sumMoney } from "./rounding.ts";
