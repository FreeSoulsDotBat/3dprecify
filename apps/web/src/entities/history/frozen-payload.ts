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

/**
 * A frozen INPUT value: every numeric leaf is an exact decimal STRING (inputs are stringified
 * WITHOUT rounding — 0.125 kW is not 0.13 kW); strings and null pass through; arrays and nested
 * objects (a channel's `priceBands`, `freightVoucherBands`, `feeDeterminants`) are frozen
 * RECURSIVELY. The one-level-deep freeze that first shipped froze channel-band leaves as floats
 * inside the immutable document (review PR-A, finding I1) — a recursive value type forbids that.
 */
export type FrozenInputValue =
  MoneyString | null | FrozenInputValue[] | { [field: string]: FrozenInputValue };

/** The fully RESOLVED inputs (filament/printer values inlined, never references) — so a snapshot
 *  reproduces with nothing but itself, and "Recalcular hoje" has something to fall back on when the
 *  origin no longer resolves. */
export type FrozenPriceInput = { [field: string]: FrozenInputValue };

/** One frozen channel is just a frozen input object — kept as a name for readability. */
export type FrozenChannelInput = { [field: string]: FrozenInputValue };

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
  // 010/T035 (E5, PR-C, US7) — "SCENARIO" is the E4 bridge: recording from a saved scenario's live
  // result captures the SAME informational triad as PRODUCT/KIT (id + the name AS CAPTURED), never a
  // foreign key, never a value source. The scenario keeps changing after this; the snapshot does not.
  kind: "PRODUCT" | "KIT" | "SCENARIO";
  id: string;
  name: string;
}

export interface FrozenSnapshotPayload {
  schemaVersion: number;
  kind: "SINGLE" | "KIT";
  /** The formula that produced these numbers (`PRICING_MODEL_VERSION`) — closes A29. */
  modelVersion: string;
  /** The fee-catalog version that priced the channels (ADR-0010) — root-level provenance, captured
   *  so a snapshot records WHICH tariff table it used; `null` when every channel used manual fees.
   *  Owner decision I2/Option A: a first-class root field, not buried inside `inputs`. */
  catalogVersion: string | null;
  /** SINGLE only. */
  inputs?: FrozenPriceInput;
  /** SINGLE only. */
  breakdown?: FrozenBreakdown;
  /** KIT only. */
  lines?: FrozenKitLine[];
  totals: FrozenTotals;
  channels?: FrozenChannel[];
  provenance: FrozenProvenance | null;
  /**
   * 014/SC-818 — set ONLY when "Recalcular hoje" could not reprice from the catalog and re-emitted
   * the FROZEN document instead (the origin was deleted or unresolvable). ABSENT means an ordinary
   * record: every payload written before this field existed keeps meaning exactly what it meant,
   * which is why the flag is additive and one-sided (the same discipline as `bandMode`, ADR-0024).
   *
   * It has to be decided AT WRITE TIME. The dialog already warns before confirming, but that warning
   * dies with the dialog: without this, the stored record is indistinguishable from a genuine reprice
   * while carrying today's `deviceQuotedAt`. And a snapshot is IMMUTABLE by DB trigger (ADR-0019) —
   * an ambiguous record stays ambiguous forever, so there is no later place to add the truth.
   */
  repricedFromFrozen?: true;
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

/** Freeze one INPUT value RECURSIVELY: a numeric leaf → an exact decimal string (never rounded);
 *  strings/null pass through; arrays and nested objects are descended so no float can hide in a
 *  channel band (review PR-A, I1). A `PriceInput` has no integer-count leaves, so every number
 *  legitimately becomes a string here. */
function freezeInputValue(value: unknown): FrozenInputValue {
  if (value === null) return null;
  if (typeof value === "number") return toExactString(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(freezeInputValue);
  if (typeof value === "object") {
    const out: { [field: string]: FrozenInputValue } = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      out[key] = freezeInputValue(child);
    }
    return out;
  }
  // Booleans / other non-money leaves do not occur in a resolved PriceInput; invent nothing.
  return null;
}

/** Stringify every numeric leaf of a resolved `PriceInput`, at any depth. */
function freezeInput(input: PriceInput): FrozenPriceInput {
  const frozen: FrozenPriceInput = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    frozen[key] = freezeInputValue(value);
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
    catalogVersion: result.catalogVersion,
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
  // `BomResult` carries no catalogVersion (every line resolves from the same catalog); the call
  // site supplies it explicitly (I2/Option A) rather than bumping pricing-core to add it.
  catalogVersion: string | null,
): FrozenSnapshotPayload {
  return {
    schemaVersion: FROZEN_PAYLOAD_SCHEMA_VERSION,
    kind: "KIT",
    modelVersion: bom.modelVersion,
    catalogVersion,
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
