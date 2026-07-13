import {
  type BomResult,
  Decimal,
  type PriceInput,
  type PriceResult,
} from "@3dprecify/pricing-core";

// 009/T003 (E4, PR-A) — THE FROZEN DOCUMENT (data-model D1, ADR-0008, ADR-0020 §1).
//
// A snapshot CONTAINS its values; it never REFERENCES the catalog for them. That is the whole
// two-shelf rule, and this module is where it becomes true: everything the detail UI or the export
// renderer will ever print must be inside this document, forever.
//
// Three rules encoded here, each of which prevents a LIE (not a crash):
//
//   1. MONEY IS A STRING. Postgres keeps a JSON number as `numeric` losslessly — but `json.loads`
//      and `JSON.parse` hand it back as a FLOAT. The precision dies in the serializer, silently,
//      app-side. So every money/quantity/rate leaf is a decimal string; the only JSON numbers are
//      integer counts (FR-525).
//
//   2. THE TYPES ARE STRUCTURALLY INDEPENDENT OF `PriceResult`, and every breakdown line is
//      OPTIONAL. This is not stylistic. If the frozen document were typed with the LIVE result, a
//      future pricing-core field would make TypeScript *assert* that a 2026 snapshot carries it —
//      the renderer would reach for `?? 0` and print a zero that was never recorded. FR-507's
//      fabricated zero, produced by the type system itself. Here, absent is a first-class value.
//
//   3. THE DOCUMENT IS SELF-SUFFICIENT. Kit lines carry their NAME, their QUANTITY and their
//      quantity-SCALED money, so the server-side quote renderer can PRINT instead of CALCULATE —
//      which is precisely why the export does not fork the pricing engine, and why "the backend
//      never recomputes" (ADR-0008) survives E4 intact.

/** Bumped only when the ENVELOPE changes shape — never when the formula does (those are two
 *  different versions, and conflating them is how old snapshots start lying). */
export const FROZEN_PAYLOAD_SCHEMA_VERSION = 1;

/** A decimal number as an exact string, e.g. "187.35". Never a float. */
export type MoneyString = string;

/** Settled money: exactly 2dp, ROUND_HALF_UP (ADR-0008 / ADR-0004 — one money story end-to-end). */
export function toMoneyString(value: number): MoneyString {
  return new Decimal(value).toFixed(2);
}

/** An input leaf (grams, hours, kW, %, rates): stringified WITHOUT rounding — quantizing an input
 *  to 2dp would silently corrupt it (0.125 kW is not 0.13 kW). */
function toExactString(value: number): MoneyString {
  return new Decimal(value).toString();
}

export interface FrozenOtherCost {
  name: string;
  value: MoneyString;
}

/**
 * The recorded breakdown. EVERY line is optional — a snapshot renders only what it recorded, so a
 * line invented by a later formula is simply an ABSENT KEY here, never a zero (FR-507).
 */
export interface FrozenBreakdown {
  material?: MoneyString;
  energy?: MoneyString;
  machine?: MoneyString;
  falha?: MoneyString;
  finishing?: MoneyString;
  labor?: MoneyString;
  admin?: MoneyString;
  otherCosts?: FrozenOtherCost[];
}

export interface FrozenTotals {
  custoTotal?: MoneyString;
  precoVarejo?: MoneyString;
  precoAtacado?: MoneyString;
}

/** One recorded channel. Serves BOTH a single piece (per-slot, may carry `error`) and a kit rollup
 *  (which additionally carries the honest line counts) — optional fields, one shape. */
export interface FrozenChannel {
  marketplace: string | null;
  precoAnuncioVarejo?: MoneyString | null;
  recebidoLiquidoVarejo?: MoneyString | null;
  precoAnuncioAtacado?: MoneyString | null;
  recebidoLiquidoAtacado?: MoneyString | null;
  freightCostVarejo?: MoneyString;
  freightCostAtacado?: MoneyString;
  /** Kit rollup only — integer counts are the ONLY legal JSON numbers in this document. */
  contributingLines?: number;
  skippedLines?: number;
  /** Single-piece slot only — an honest per-slot failure, echoed as recorded. */
  error?: string | null;
}

/** The fully RESOLVED inputs (filament/printer values inlined, never references) — so a snapshot
 *  reproduces with nothing but itself, and "Recalcular hoje" has something to fall back on when the
 *  origin no longer resolves. */
export interface FrozenPriceInput {
  [field: string]: MoneyString | FrozenOtherCost[] | FrozenChannelInput[] | string | null;
}

export interface FrozenChannelInput {
  [field: string]: MoneyString | string | Record<string, string> | null | undefined;
}

export interface FrozenKitLine {
  /** The piece's name as captured — a kit quote itemizes its pieces (SC-515), and the renderer must
   *  not have to look it up. */
  name: string | null;
  quantity: number;
  input: FrozenPriceInput;
  /** Per-UNIT breakdown, exactly as displayed. */
  breakdown: FrozenBreakdown;
  /** Quantity-SCALED money — stored, never derived at print time. */
  totals: FrozenTotals;
}

/**
 * Where this snapshot came from — INFORMATIONAL ONLY, never a value source, and deliberately NOT a
 * foreign key (ADR-0019 §5). The id may dangle harmlessly; the captured `name` is what the origin
 * was called then, which is always true. When the id no longer resolves, the "abrir origem"
 * affordance is simply absent — no broken link, no "produto excluído" claim, no degraded caption.
 */
export interface FrozenProvenance {
  kind: "PRODUCT" | "KIT";
  id: string;
  name: string;
}

export interface FrozenSnapshotPayload {
  schemaVersion: number;
  kind: "SINGLE" | "KIT";
  /** The formula that produced these numbers (`PRICING_MODEL_VERSION`) — closes A29. */
  modelVersion: string;
  /** SINGLE only. */
  inputs?: FrozenPriceInput;
  /** SINGLE only. */
  breakdown?: FrozenBreakdown;
  /** KIT only. */
  lines?: FrozenKitLine[];
  totals: FrozenTotals;
  channels?: FrozenChannel[];
  provenance: FrozenProvenance | null;
}

/** Read a recorded money line. An ABSENT line reads as `null` — never as "0.00" (FR-507). A line
 *  that was genuinely recorded as zero still reads as zero, because it really happened. */
export function readFrozenMoney(value: MoneyString | null | undefined): MoneyString | null {
  return value ?? null;
}

function freezeOtherCosts(items: readonly { name: string; value: number }[]): FrozenOtherCost[] {
  return items.map((item) => ({ name: item.name, value: toMoneyString(item.value) }));
}

function freezeBreakdown(result: PriceResult): FrozenBreakdown {
  return {
    material: toMoneyString(result.material),
    energy: toMoneyString(result.energy),
    machine: toMoneyString(result.machine),
    falha: toMoneyString(result.falha),
    finishing: toMoneyString(result.finishing),
    labor: toMoneyString(result.labor),
    admin: toMoneyString(result.admin),
    otherCosts: freezeOtherCosts(result.otherCosts),
  };
}

function freezeTotals(totals: {
  custoTotal: number;
  precoVarejo: number;
  precoAtacado: number;
}): FrozenTotals {
  return {
    custoTotal: toMoneyString(totals.custoTotal),
    precoVarejo: toMoneyString(totals.precoVarejo),
    precoAtacado: toMoneyString(totals.precoAtacado),
  };
}

function freezeSlotChannels(result: PriceResult): FrozenChannel[] {
  return result.channels.map((channel) => ({
    marketplace: channel.marketplace,
    precoAnuncioVarejo:
      channel.precoAnuncioVarejo === null ? null : toMoneyString(channel.precoAnuncioVarejo),
    recebidoLiquidoVarejo:
      channel.recebidoLiquidoVarejo === null ? null : toMoneyString(channel.recebidoLiquidoVarejo),
    precoAnuncioAtacado:
      channel.precoAnuncioAtacado === null ? null : toMoneyString(channel.precoAnuncioAtacado),
    recebidoLiquidoAtacado:
      channel.recebidoLiquidoAtacado === null
        ? null
        : toMoneyString(channel.recebidoLiquidoAtacado),
    freightCostVarejo: toMoneyString(channel.freightCostVarejo),
    freightCostAtacado: toMoneyString(channel.freightCostAtacado),
    error: channel.error,
  }));
}

function freezeRollupChannels(bom: BomResult): FrozenChannel[] {
  return bom.channels.map((rollup) => ({
    marketplace: rollup.marketplace,
    precoAnuncioVarejo:
      rollup.precoAnuncioVarejo === null ? null : toMoneyString(rollup.precoAnuncioVarejo),
    recebidoLiquidoVarejo:
      rollup.recebidoLiquidoVarejo === null ? null : toMoneyString(rollup.recebidoLiquidoVarejo),
    precoAnuncioAtacado:
      rollup.precoAnuncioAtacado === null ? null : toMoneyString(rollup.precoAnuncioAtacado),
    recebidoLiquidoAtacado:
      rollup.recebidoLiquidoAtacado === null ? null : toMoneyString(rollup.recebidoLiquidoAtacado),
    freightCostVarejo: toMoneyString(rollup.freightCostVarejo),
    freightCostAtacado: toMoneyString(rollup.freightCostAtacado),
    contributingLines: rollup.contributingLines,
    skippedLines: rollup.skippedLines,
  }));
}

/** Stringify every numeric leaf of a resolved `PriceInput` — exactly, without rounding. */
function freezeInput(input: PriceInput): FrozenPriceInput {
  const frozen: FrozenPriceInput = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (typeof value === "number") {
      frozen[key] = toExactString(value);
    } else if (key === "otherCosts") {
      frozen[key] = freezeOtherCosts(value as { name: string; value: number }[]);
    } else if (key === "channels") {
      frozen[key] = (value as Record<string, unknown>[]).map((channel) => {
        const out: FrozenChannelInput = {};
        for (const [ck, cv] of Object.entries(channel)) {
          if (cv === undefined) continue;
          out[ck] = typeof cv === "number" ? toExactString(cv) : (cv as FrozenChannelInput[string]);
        }
        return out;
      });
    } else {
      frozen[key] = value as string | null;
    }
  }

  return frozen;
}

/** Freeze a single-piece calculation into the immutable document. */
export function freezePriceResult(
  input: PriceInput,
  result: PriceResult,
  provenance: FrozenProvenance | null,
): FrozenSnapshotPayload {
  return {
    schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
    kind: "SINGLE",
    modelVersion: result.modelVersion,
    inputs: freezeInput(input),
    breakdown: freezeBreakdown(result),
    totals: freezeTotals(result),
    channels: freezeSlotChannels(result),
    provenance,
  };
}

/** Freeze a kit into the immutable document. The piece names ride along because a kit quote
 *  itemizes its pieces (SC-515) and the renderer may not go looking them up. */
export function freezeBomResult(
  lines: readonly { input: PriceInput; quantity: number; name: string | null }[],
  bom: BomResult,
  provenance: FrozenProvenance | null,
): FrozenSnapshotPayload {
  return {
    schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
    kind: "KIT",
    modelVersion: bom.modelVersion,
    lines: bom.lines.map((lineResult, index) => ({
      name: lines[index]?.name ?? null,
      quantity: lineResult.quantity,
      input: freezeInput(lines[index]?.input ?? ({} as PriceInput)),
      breakdown: freezeBreakdown(lineResult.line),
      totals: freezeTotals(lineResult),
    })),
    totals: freezeTotals(bom),
    channels: freezeRollupChannels(bom),
    provenance,
  };
}
