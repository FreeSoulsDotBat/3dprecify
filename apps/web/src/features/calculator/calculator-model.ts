import {
  type ChannelInput,
  type ChannelResult,
  computeCalculator,
  type OtherCostItem,
  type PriceInput,
  type PriceResult,
  ValidationError,
} from "@3dprecify/pricing-core";

import {
  type CalcFieldName,
  type CalcFormValues,
  type ChannelFieldName,
  type ChannelSlotForm,
  calculatorSchema,
} from "@/features/calculator/calculator-schema";
import {
  entryToChannelFees,
  feeSealState,
  resolveSlotEntry,
} from "@/features/calculator/fee-prefill";
import type { FeeSealState } from "@/features/calculator/fee-seal";
import type { CatalogSource, FeeCatalog } from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { formatDecimal, parseDecimal } from "@/shared/lib/decimal-ptbr";

// Thin adapter for the E1 calculator. It is the ONLY seam between the pt-BR form strings and the
// canonical engine: parse + validate → computeCalculator (pricing-core, the single source of the
// formula — FR-036) → a view-ready outcome. The scalar cost fields gate the whole price (a bad
// denominator dooms the calc); each marketplace CHANNEL is parsed + gross-up'd in isolation so one
// bad slot (e.g. commission ≥ 100%) errors only itself while the siblings still compute (SC-107).

const t = messages.calculator;

/** Format a number as a pt-BR BRL string ("28.65" → "R$ 28,65"). Reuses the shared pt-BR
 *  formatter (single source of the locale rule); pricing-core already rounded to 2dp. */
export function formatBRL(value: number): string {
  return `R$ ${formatDecimal(value, 2)}`;
}

export type CalcFieldErrors = Partial<Record<CalcFieldName, string>>;
export type ChannelSlotErrors = Partial<Record<ChannelFieldName, string>>;

/** One channel slot's outcome, aligned to `form.channels[i]`: inline pt-BR errors (empty when the
 *  slot is valid) + the engine's gross-up result (null when the slot has an error). `hasFee` is
 *  false while every fee is blank/0 — the UI then shows a hint instead of base==anúncio rows. `seal`
 *  is the honesty seal (where the fees came from); `freightIsEstimate` marks a subsidy-based freight. */
export interface ChannelSlotOutcome {
  errors: ChannelSlotErrors;
  result: ChannelResult | null;
  hasFee: boolean;
  seal: FeeSealState;
  freightIsEstimate: boolean;
}

/** The resolved fee catalog + where it came from + the clock, for the honesty seal + pre-fill. */
export interface CatalogContext {
  catalog: FeeCatalog;
  source: CatalogSource;
  now: number;
}

export interface CalcOutcome {
  /** True when every scalar field parsed/validated and the engine returned a price. */
  ok: boolean;
  /** Per-field pt-BR validation messages for the scalar inputs (empty when ok). */
  fieldErrors: CalcFieldErrors;
  /** The computed breakdown + prices, or null when a scalar input is invalid. */
  result: PriceResult | null;
  /** Per-slot channel outcomes, aligned to `values.channels` (empty when the scalars are invalid). */
  channels: ChannelSlotOutcome[];
  /** Per-row "Outros custos" value errors (US5), aligned to `values.otherCosts`; `undefined` = ok.
   *  Empty when the scalars are invalid. A bad row errors only itself — the price still computes. */
  otherCostErrors: (string | undefined)[];
}

const CHANNEL_NUM_FIELDS: readonly ChannelFieldName[] = [
  "commissionPct",
  "fixedFee",
  "minPerItem",
  "freightCost",
];

/**
 * Parse ONE channel slot's pt-BR fee strings in isolation. A blank numeric field is an untouched
 * optional (→ 0). A non-numeric string, a negative value, or a commission ≥ 100% is an inline
 * per-field error (pt-BR) that fails ONLY this slot — never a silent clamp, never a NaN.
 * `hasManualInput` is true when the user typed into ANY fee field (the signal that they are entering
 * or overriding fees rather than accepting a catalog pre-fill).
 */
function parseManualFees(slot: ChannelSlotForm): {
  nums: Record<ChannelFieldName, number>;
  errors: ChannelSlotErrors;
  hasManualInput: boolean;
} {
  const errors: ChannelSlotErrors = {};
  const nums: Record<ChannelFieldName, number> = {
    commissionPct: 0,
    fixedFee: 0,
    minPerItem: 0,
    freightCost: 0,
  };
  let hasManualInput = false;
  for (const f of CHANNEL_NUM_FIELDS) {
    const raw = (slot[f] ?? "").trim();
    if (raw === "") continue; // untouched optional → 0
    hasManualInput = true;
    const n = parseDecimal(raw.replace(/[^\d.,-]/g, ""));
    if (!Number.isFinite(n)) {
      errors[f] = t.validation.invalid;
    } else if (n < 0) {
      errors[f] = t.validation.negative;
    } else {
      nums[f] = n;
    }
  }
  // Upper bound gets its own pt-BR message (the gross-up denominator 1 − c/100 must stay > 0).
  if (errors.commissionPct === undefined && nums.commissionPct >= 100) {
    errors.commissionPct = t.validation.commissionMax;
  }
  return { nums, errors, hasManualInput };
}

interface SlotProcessing {
  input: ChannelInput | null;
  errors: ChannelSlotErrors;
  hasFee: boolean;
  seal: FeeSealState;
  freightIsEstimate: boolean;
}

/**
 * Resolve ONE slot's effective fees + honesty seal. A covered marketplace+modality with NO typed
 * fees pre-fills from the catalog (reference seal); any typed fee is a manual override ("ajustado por
 * você" over a covered combo, else "sem referência"). A per-field error fails only this slot (SC-107).
 */
function processSlot(slot: ChannelSlotForm, ctx?: CatalogContext): SlotProcessing {
  const manual = parseManualFees(slot);
  const entry = ctx ? resolveSlotEntry(ctx.catalog, slot.marketplace, slot.modality) : null;

  if (Object.keys(manual.errors).length > 0) {
    return {
      input: null,
      errors: manual.errors,
      hasFee: false,
      seal: entry ? { kind: "adjusted" } : { kind: "none" },
      freightIsEstimate: false,
    };
  }

  // Use the catalog entry only when the user hasn't typed any fee (a blank slot accepts the pre-fill).
  const useCatalog = entry !== null && !manual.hasManualInput;
  const fees = useCatalog
    ? entryToChannelFees(entry)
    : {
        ...manual.nums,
        priceBands: undefined,
        freightVoucherBands: undefined,
        freightIsEstimate: false,
      };
  const seal: FeeSealState = useCatalog
    ? feeSealState({ entry, source: ctx!.source, now: ctx!.now, edited: false })
    : entry
      ? { kind: "adjusted" }
      : { kind: "none" };
  // Provenance echoed onto the result — only when the fees actually came from the catalog (blank slot);
  // a manual override is not "from" the reference, so it carries no feeSource.
  const feeSource = useCatalog && entry ? entry.source : undefined;

  const hasFee =
    fees.commissionPct > 0 ||
    fees.fixedFee > 0 ||
    fees.minPerItem > 0 ||
    fees.freightCost > 0 ||
    (fees.priceBands?.length ?? 0) > 0 ||
    (fees.freightVoucherBands?.length ?? 0) > 0;

  return {
    input: {
      marketplace: slot.marketplace,
      feeDeterminants: slot.modality ? { modality: slot.modality } : undefined,
      feeSource,
      commissionPct: fees.commissionPct,
      fixedFee: fees.fixedFee,
      minPerItem: fees.minPerItem,
      priceBands: fees.priceBands,
      freightCost: fees.freightCost,
      freightVoucherBands: fees.freightVoucherBands,
    },
    errors: {},
    hasFee,
    seal,
    freightIsEstimate: fees.freightIsEstimate,
  };
}

/**
 * Parse the itemized "Outros custos" slot (US5). Each row's value is validated in isolation: a blank
 * value is an untouched row (contributes nothing, no engine item), a non-finite or negative value is
 * an inline per-row error that fails ONLY that row (never a NaN, FR-116). The name is free text — a
 * blank name is accepted (the UI shows a neutral placeholder). Returns the engine items (valid rows,
 * in order) alongside a per-row error array aligned to `forms`.
 */
function parseOtherCosts(forms: readonly { name: string; value: string }[]): {
  items: OtherCostItem[];
  errors: (string | undefined)[];
} {
  const items: OtherCostItem[] = [];
  const errors: (string | undefined)[] = [];
  for (const row of forms) {
    const raw = (row.value ?? "").trim();
    if (raw === "") {
      errors.push(undefined); // untouched row → 0, no engine item
      continue;
    }
    const n = parseDecimal(raw.replace(/[^\d.,-]/g, ""));
    if (!Number.isFinite(n)) {
      errors.push(t.validation.invalid);
    } else if (n < 0) {
      errors.push(t.validation.negative);
    } else {
      errors.push(undefined);
      items.push({ name: (row.name ?? "").trim(), value: n });
    }
  }
  return { items, errors };
}

/**
 * Parse + validate the raw form strings, then compute. Returns per-field messages instead of ever
 * throwing or emitting a NaN/Infinity (SC-008). Valid channel slots are passed to the engine and
 * their gross-up results mapped back onto their form position; invalid slots carry inline errors.
 */
export function computeFromForm(values: CalcFormValues, ctx?: CatalogContext): CalcOutcome {
  const parsed = calculatorSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: CalcFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as CalcFieldName | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors, result: null, channels: [], otherCostErrors: [] };
  }

  // US5 — the "Outros custos" slot is parsed outside the Zod object (like the channels): each named
  // sub-cost's value is validated per-row so one bad row errors only itself while the price computes.
  const { items: otherCosts, errors: otherCostErrors } = parseOtherCosts(values.otherCosts ?? []);

  try {
    // Map the flat form onto the 3.0.0 engine shape (ADR-0011): the itemized "Outros custos" rows
    // become `otherCosts[]` (each named sub-cost sums into custo_total + shows its own breakdown line,
    // FR-114/115); the channel slots become `channels[]` with catalog pre-fill applied per slot.
    const cost = parsed.data;
    // US4 — the master "Incluir marketplaces no preço" toggle (default on). When off, the marketplace
    // section is hidden and NO channel is computed (an empty channels[] → the headline is the direct
    // cost×markup exactly, with no fee ever folded into custo_total — SC-105).
    const includeMarketplace = values.includeMarketplace !== false;
    const slots = includeMarketplace ? (values.channels ?? []) : [];
    const processed = slots.map((slot) => processSlot(slot, ctx));
    const engineChannels = processed
      .map((p) => p.input)
      .filter((x): x is ChannelInput => x !== null);
    // Stamp the catalog version ONLY when at least one channel actually resolved its fees from the
    // catalog (a slot carries `feeSource` iff it used the pre-fill). An all-manual calc records no
    // catalog provenance — "null when all-manual" (ADR-0011), so a future saved quote isn't mislabelled.
    const usedCatalog = processed.some((p) => p.input?.feeSource != null);
    const input: PriceInput = {
      ...cost,
      otherCosts,
      channels: engineChannels,
      catalogVersion: usedCatalog ? ctx?.catalog.catalogVersion : undefined,
    };
    const result = computeCalculator(input);
    // Re-align engine results (valid slots only, in order) back onto every form slot.
    let ep = 0;
    const channels: ChannelSlotOutcome[] = processed.map((p) =>
      p.input === null
        ? {
            errors: p.errors,
            result: null,
            hasFee: p.hasFee,
            seal: p.seal,
            freightIsEstimate: false,
          }
        : {
            errors: {},
            result: result.channels[ep++] ?? null,
            hasFee: p.hasFee,
            seal: p.seal,
            freightIsEstimate: p.freightIsEstimate,
          },
    );
    return { ok: true, fieldErrors: {}, result, channels, otherCostErrors };
  } catch (err) {
    if (err instanceof ValidationError) {
      const key = err.field as CalcFieldName | undefined;
      return {
        ok: false,
        fieldErrors: key ? { [key]: err.message } : {},
        result: null,
        channels: [],
        otherCostErrors: [],
      };
    }
    throw err;
  }
}
