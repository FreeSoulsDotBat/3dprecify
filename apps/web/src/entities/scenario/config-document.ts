import { Decimal, type PriceInput } from "@3dprecify/pricing-core";

// 010/T004 (E5, PR-A foundational) — THE CONFIG INTENT DOCUMENT (data-model.md §3,
// contracts/api-surface.md §Schemas).
//
// A scenario stores the seller's INTENT, never a resolved price (Q3/FR-602/FR-607). The whole
// document is the mirror image of the E4 frozen payload (`entities/history/frozen-payload.ts`):
// there money/qty/rate/percent leaves are STRINGS because a snapshot must survive Postgres → JSON
// losslessly; here they are STRINGS for the same serializer reason, but what is being stored is an
// EDITABLE input set, not a frozen result. Three rules encoded here:
//
//   1. MONEY/RATE/QTY/PERCENT IS A STRING. `JSON.parse`/`JSON.stringify` round-trip a JSON number
//      through binary64 silently — the loss is app-side, not the database's. Only true integer
//      COUNTS (`schemaVersion`, a kit line's `quantity`) are legal JSON numbers anywhere in `config`.
//
//   2. AN ABSENT `feeOverrides` KEY IS THE LIVE-VS-FROZEN BOUNDARY. Which slots the seller actually
//      edited is decided by the FEATURE layer (the 005 `fee-prefill.ts` edited/seal state) — this
//      module only encodes the RULE: a leaf the seller never typed into is OMITTED, not stored as
//      zero, so the reopened scenario re-resolves it from today's fee catalog (FR-607). A slot with
//      zero edited leaves omits the WHOLE `feeOverrides` key, not an empty object.
//
//   3. THE ENVELOPE IS STRUCTURALLY INDEPENDENT OF `PriceInput`/`BomResult` (the E4 §9.6 lesson, one
//      level up). Nothing here `extends`/`Pick`s/maps over a pricing-core type — every envelope type
//      is hand-declared, so a future pricing-core field can never silently widen or narrow this
//      document's shape. The cost basis carries its OWN recursive string-leaf type
//      (`ScenarioLastKnownInput`), not `PriceInput` itself.
//
// This module does not import from `features/*` (FSD-Lite: an entity sits below a feature). The
// serializer's "which slot did the seller edit" input is therefore PLAIN PARAMETERS shaped like the
// 005 form state, not an import of `features/calculator`'s types — the feature layer maps its own
// state into `ScenarioChannelSlotState` at the call site (T009/T010).

/** Bumped only when the ENVELOPE changes shape — never when the pricing formula does (those are two
 *  different versions; conflating them is how a scenario would start claiming a formula it doesn't
 *  use — data-model.md §7.3, DECIDED: no advisory pricing model-version column). */
export const SCENARIO_CONFIG_SCHEMA_VERSION = 1;

/** A decimal number as an exact string, e.g. "12.50", "0.1". Never a float, never rounded (this is
 *  an INPUT/intent leaf, not a settled total — quantizing it would silently corrupt it). */
export type DecimalString = string;

/** Stringify a JS number EXACTLY (no 2dp rounding) — the `PriceInput` leaf idiom. */
function toExactString(value: number): DecimalString {
  return new Decimal(value).toString();
}

export interface ScenarioOtherCost {
  name: string;
  value: DecimalString;
}

/** ONLY the seller's explicit per-slot adjustments. A field present here means "ajustado por você"
 *  (sticks on reopen); a field ABSENT means "re-resolve from today's fee catalog" (FR-607). */
export interface ScenarioChannelFeeOverrides {
  commissionPct?: DecimalString;
  fixedFee?: DecimalString;
  minPerItem?: DecimalString;
  freightCost?: DecimalString;
}

export interface ScenarioChannelIntent {
  marketplace: string;
  modality: string;
  /** Absent entirely when the seller edited NO leaf in this slot — the live-vs-frozen boundary. */
  feeOverrides?: ScenarioChannelFeeOverrides;
}

/** A recursive money/rate/qty leaf: every JS number becomes an exact decimal STRING at any depth
 *  (mirrors `entities/history/frozen-payload.ts`'s `FrozenInputValue`, independently declared here —
 *  this is the concrete shape of N1's "structurally independent" requirement). Strings/null pass
 *  through; arrays and nested objects (a channel's `priceBands`, `freightVoucherBands`) recurse. */
export type ScenarioLeafValue =
  DecimalString | null | ScenarioLeafValue[] | { [field: string]: ScenarioLeafValue };

/** A fully-resolved `PriceInput`-SHAPED value set, stringified leaf-by-leaf — NOT `PriceInput`
 *  itself (no `extends`/`Pick`/mapped reuse, the E4 §9.6 lesson). */
export type ScenarioLastKnownInput = { [field: string]: ScenarioLeafValue };

export interface ScenarioKitLine {
  name: string | null;
  /** An integer COUNT — the only other legal JSON number in `config` besides `schemaVersion`. */
  quantity: number;
  input: ScenarioLastKnownInput;
}

export interface ScenarioBasisRef {
  id: string;
  name: string;
}

/** The polymorphic cost basis (N2): ad-hoc has no ref; a PRODUCT/KIT reference is SOFT (no FK) and
 *  carries a `lastKnown` snapshot re-captured on every save so a D6 degradation is lossless. */
export type ScenarioCostBasis =
  | { kind: "AD_HOC"; ref: null; lastKnown: ScenarioLastKnownInput }
  | { kind: "PRODUCT"; ref: ScenarioBasisRef; lastKnown: ScenarioLastKnownInput }
  | { kind: "KIT"; ref: ScenarioBasisRef; lastKnown: { lines: ScenarioKitLine[] } };

/** The FLAT envelope (the E4 I2 idiom) — everything sits at the root, `config_schema_version = 1`. */
export interface ScenarioConfig {
  schemaVersion: number;
  includeMarketplace: boolean;
  costBasis: ScenarioCostBasis;
  channels: ScenarioChannelIntent[];
  otherCosts: ScenarioOtherCost[];
}

/** Stringify one INPUT value RECURSIVELY: a numeric leaf → an exact decimal string (never rounded);
 *  strings/null pass through; arrays/objects descend (the E4 review PR-A I1 lesson — a shallow
 *  freeze lets a nested band leaf survive as a float). Booleans do not occur in a resolved
 *  `PriceInput` leaf set; invent nothing for one. */
function stringifyLeaf(value: unknown): ScenarioLeafValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return toExactString(value);
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(stringifyLeaf);
  if (typeof value === "object") {
    const out: { [field: string]: ScenarioLeafValue } = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      out[key] = stringifyLeaf(child);
    }
    return out;
  }
  return null;
}

/** Stringify every numeric leaf of a resolved `PriceInput`, at any depth. */
function stringifyInput(input: PriceInput): ScenarioLastKnownInput {
  const out: ScenarioLastKnownInput = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    out[key] = stringifyLeaf(value);
  }
  return out;
}

/** An ad-hoc cost basis: no reference, `lastKnown` IS the authoritative editable input (N2 — never
 *  degrades, there is nothing to resolve). */
export function serializeAdHocBasis(input: PriceInput): ScenarioCostBasis {
  return { kind: "AD_HOC", ref: null, lastKnown: stringifyInput(input) };
}

/** A Product-referenced basis: the soft `ref` resolves live on reopen (D3); `lastKnown` is the D6
 *  fallback, refreshed from the live product on every save (ADR-0017 §6 — the caller's job, not
 *  this module's; this only captures whatever resolved input it is handed). */
export function serializeProductBasis(ref: ScenarioBasisRef, input: PriceInput): ScenarioCostBasis {
  return { kind: "PRODUCT", ref, lastKnown: stringifyInput(input) };
}

/** A Kit-referenced basis: the multi-piece sub-list that is exactly why `config` is JSONB rather
 *  than typed columns (N1). Each line's NAME and QUANTITY ride along (self-sufficient, like a frozen
 *  kit line) alongside its stringified resolved input. */
export function serializeKitBasis(
  ref: ScenarioBasisRef,
  lines: readonly { name: string | null; quantity: number; input: PriceInput }[],
): ScenarioCostBasis {
  return {
    kind: "KIT",
    ref,
    lastKnown: {
      lines: lines.map((line) => ({
        name: line.name,
        quantity: line.quantity,
        input: stringifyInput(line.input),
      })),
    },
  };
}

/** One channel slot's LIVE state, as the feature layer observes it: the determinants + each fee
 *  field's current value alongside whether the seller explicitly typed/overrode it (the 005
 *  `edited`/fee-seal state, `fee-prefill.ts`). Plain parameters — this entity does not import
 *  `features/calculator`'s form types (FSD-Lite boundary). */
export interface ScenarioChannelSlotState {
  marketplace: string;
  modality: string;
  commissionPct: { value: number; overridden: boolean };
  fixedFee: { value: number; overridden: boolean };
  minPerItem: { value: number; overridden: boolean };
  freightCost: { value: number; overridden: boolean };
}

const OVERRIDE_FIELDS = ["commissionPct", "fixedFee", "minPerItem", "freightCost"] as const;

/** Serialize one channel slot's intent. Only the fields the seller EXPLICITLY overrode contribute a
 *  `feeOverrides` leaf; a slot with zero edited leaves omits the whole `feeOverrides` key — that
 *  absence, not an empty object, is what tells the reopened scenario to re-resolve live (FR-607). */
export function serializeChannelIntent(slot: ScenarioChannelSlotState): ScenarioChannelIntent {
  const feeOverrides: ScenarioChannelFeeOverrides = {};
  for (const field of OVERRIDE_FIELDS) {
    if (slot[field].overridden) feeOverrides[field] = toExactString(slot[field].value);
  }
  const hasOverrides = Object.keys(feeOverrides).length > 0;
  return {
    marketplace: slot.marketplace,
    modality: slot.modality,
    ...(hasOverrides ? { feeOverrides } : {}),
  };
}

/** Serialize the full scenario config from the live calculator/bom state. The cost basis and the
 *  per-slot override decision are supplied already-resolved by the feature layer (T009/T010) — this
 *  function only assembles the flat envelope + applies the string/absence rules. */
export function serializeScenarioConfig(args: {
  includeMarketplace: boolean;
  costBasis: ScenarioCostBasis;
  channels: readonly ScenarioChannelSlotState[];
  otherCosts: readonly { name: string; value: number }[];
}): ScenarioConfig {
  return {
    schemaVersion: SCENARIO_CONFIG_SCHEMA_VERSION,
    includeMarketplace: args.includeMarketplace,
    costBasis: args.costBasis,
    channels: args.channels.map(serializeChannelIntent),
    otherCosts: args.otherCosts.map((cost) => ({
      name: cost.name,
      value: toExactString(cost.value),
    })),
  };
}
