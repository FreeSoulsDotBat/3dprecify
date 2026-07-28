import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";

import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";
import type { SelectOption } from "@/shared/ui";

// RHF + Zod schema for the E1 calculator form. It parses the raw pt-BR/BRL form strings into
// the numbers `pricing-core` expects and rejects bad input with a per-field pt-BR message —
// the fix TD-020 asked for (never silently coerce a bad string to 0). It surfaces the mandatory
// inputs (FR-001..003,005..009,017,018), the optional-core ones (FR-004,010..013) and the US4
// labor cost (laborHours/laborRatePerHour — optional, default 0). All optionals default to 0/null
// in the engine. The US1 multi-channel marketplace fees and the US5 "Outros custos" sub-costs are
// NOT in this Zod object: each channel slot and each named sub-cost is parsed + validated per-item
// in the model so one bad item (e.g. commission ≥ 100%) errors only itself without hiding the rest.

const t = messages.calculator;

/** The 20 calculator fields — names mirror `pricing-core`'s `PriceInput` so a thrown
 *  `ValidationError.field` maps straight back to a form field. */
export const CALC_FIELD_NAMES = [
  "costPerRoll",
  "rollWeightKg",
  "printGrams",
  "wasteGrams",
  "printTimeHours",
  "avgPowerKw",
  "tariffPerKwh",
  "machineValue",
  "machineLifetimeHours",
  "maintenanceReservePerHour",
  "failurePct",
  "finishTimeHours",
  "finishRatePerHour",
  "laborHours",
  "laborRatePerHour",
  "markupVarejoPct",
  "markupAtacadoPct",
] as const;

export type CalcFieldName = (typeof CALC_FIELD_NAMES)[number];

// US1 — a channel slot: a marketplace + optional modality (ML Clássico/Premium, Amazon
// Profissional/Individual; Shopee/Outro have none) plus its manual fees. Values are pt-BR
// strings like the scalar fields; the model parses + gross-ups each slot in isolation.
export type MarketplaceId = "MERCADO_LIVRE" | "SHOPEE" | "AMAZON" | "OUTRO";
export type Modality = "CLASSICO" | "PREMIUM" | "PROFISSIONAL" | "INDIVIDUAL" | "";

export interface ChannelSlotForm {
  marketplace: MarketplaceId;
  modality: Modality;
  /** 014/US1 — the marketplace category the piece is listed under. OPTIONAL as a gate (it never
   *  blocks a calculation) and PER SLOT: a category chosen for ML must not become the Amazon one.
   *  Empty string = not informed, which is a valid and permanent state (SC-809). */
  category?: string;
  commissionPct: string;
  fixedFee: string;
  minPerItem: string;
  freightCost: string;
}

/** The channel numeric fields the model validates per-slot (keys of the inline error map). */
export type ChannelFieldName = "commissionPct" | "fixedFee" | "minPerItem" | "freightCost";

// US5 — one "Outros custos" sub-cost: a free-text name + a pt-BR value string. 0..N of these replace
// 004's single `adminTotal`; their sum flows into custo_total exactly as the single field did.
export interface OtherCostForm {
  name: string;
  value: string;
}

/** The form's live value shape: one controlled pt-BR string per scalar field + N channel slots +
 *  the master "include marketplaces" toggle (US4) + the "Outros custos" named sub-costs (US5). */
export interface CalcFormValues extends Record<CalcFieldName, string> {
  channels: ChannelSlotForm[];
  includeMarketplace: boolean;
  otherCosts: OtherCostForm[];
}

type FieldKind = "required" | "prefilled" | "optional";

interface NumRule {
  kind: FieldKind;
  /** Must be strictly > 0 (a denominator, e.g. roll weight / machine lifetime). */
  positive?: boolean;
  /** Field-specific "> 0" message (defaults to the generic one). */
  positiveMessage?: string;
  /** Exclusive upper bound (n must be strictly < this, e.g. marketplace commission < 100%). */
  ltExclusive?: number;
  /** Message shown when the exclusive upper bound is hit (defaults to the generic one). */
  ltExclusiveMessage?: string;
}

/**
 * One reusable pt-BR/BRL number parser+validator. Distinguishes a truly BLANK field
 * (optional → 0; required → "obrigatório") from a NON-EMPTY but unparseable string
 * ("abc", "--" → "número válido"): a bad string is rejected, never coerced to 0.
 */
function numField(rule: NumRule) {
  return z.string().transform((raw, ctx): number => {
    const trimmed = (raw ?? "").trim();
    if (trimmed === "") {
      if (rule.kind === "optional") return 0; // FR-023: untouched optional contributes 0
      ctx.addIssue({ code: "custom", message: t.validation.required });
      return z.NEVER;
    }
    // Visual affixes the user may type (R$, unit letters, spaces) are stripped by `parseDecimal`
    // itself — ANCHORED to the ends only (013/FA-05: the local unanchored strip that used to live
    // here concatenated across interior garbage, turning "5x3" into a valid "53").
    const n = parseDecimal(trimmed);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: t.validation.invalid });
      return z.NEVER;
    }
    if (rule.positive) {
      if (n <= 0) {
        ctx.addIssue({ code: "custom", message: rule.positiveMessage ?? t.rollWeightError });
        return z.NEVER;
      }
    } else if (n < 0) {
      ctx.addIssue({ code: "custom", message: t.validation.negative });
      return z.NEVER;
    }
    if (rule.ltExclusive !== undefined && n >= rule.ltExclusive) {
      ctx.addIssue({ code: "custom", message: rule.ltExclusiveMessage ?? t.validation.invalid });
      return z.NEVER;
    }
    return n;
  });
}

/** The Zod object: raw `CalcFormValues` (strings) → validated numeric MVP input. */
export const calculatorSchema = z.object({
  costPerRoll: numField({ kind: "required" }),
  rollWeightKg: numField({ kind: "required", positive: true, positiveMessage: t.rollWeightError }),
  printGrams: numField({ kind: "required" }),
  wasteGrams: numField({ kind: "optional" }),
  printTimeHours: numField({ kind: "required" }),
  avgPowerKw: numField({ kind: "prefilled" }),
  tariffPerKwh: numField({ kind: "required" }),
  machineValue: numField({ kind: "required" }),
  machineLifetimeHours: numField({
    kind: "required",
    positive: true,
    positiveMessage: t.validation.machineLifetimePositive,
  }),
  maintenanceReservePerHour: numField({ kind: "optional" }),
  failurePct: numField({ kind: "optional" }),
  finishTimeHours: numField({ kind: "optional" }),
  finishRatePerHour: numField({ kind: "optional" }),
  laborHours: numField({ kind: "optional" }),
  laborRatePerHour: numField({ kind: "optional" }),
  markupVarejoPct: numField({ kind: "prefilled" }),
  markupAtacadoPct: numField({ kind: "prefilled" }),
});

/** Validated numeric MVP input (a subset of `pricing-core`'s `PriceInput`). */
export type CalcParsedInput = z.infer<typeof calculatorSchema>;

/**
 * RHF resolver built from `calculatorSchema` — the RHF↔Zod integration point. It keeps the
 * raw string `values` (the form stays a string form) and maps each Zod issue to the first
 * per-field message so inline errors wire up the standard RHF way.
 */
export const calculatorResolver: Resolver<CalcFormValues> = (values) => {
  const parsed = calculatorSchema.safeParse(values);
  if (parsed.success) return { values, errors: {} };
  const errors: FieldErrors<CalcFormValues> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as CalcFieldName | undefined;
    if (key && !errors[key]) errors[key] = { type: "validation", message: issue.message };
  }
  return { values: {}, errors };
};

// US1: the marketplace channel slot — a marketplace picker, its modality (when it has one) and
// the manual fees fed into the per-channel gross-up. The determinant selectors key the catalog
// pre-fill in US2; here they identify the channel and choose the modality-specific fee. Defined
// before `defaultCalcValues` so its `defaultChannelSlot()` reads a fully-initialized MODALITY_OPTIONS.
export const MARKETPLACE_OPTIONS: readonly SelectOption[] = [
  { value: "MERCADO_LIVRE", label: t.marketplaceNames.MERCADO_LIVRE },
  { value: "SHOPEE", label: t.marketplaceNames.SHOPEE },
  { value: "AMAZON", label: t.marketplaceNames.AMAZON },
  { value: "OUTRO", label: t.marketplaceNames.OUTRO },
];

/** Modalities by marketplace — Shopee/Outro have none (empty ⇒ the modality select is hidden). */
export const MODALITY_OPTIONS: Record<MarketplaceId, readonly SelectOption[]> = {
  MERCADO_LIVRE: [
    { value: "CLASSICO", label: t.modalityNames.CLASSICO },
    { value: "PREMIUM", label: t.modalityNames.PREMIUM },
  ],
  AMAZON: [
    { value: "PROFISSIONAL", label: t.modalityNames.PROFISSIONAL },
    { value: "INDIVIDUAL", label: t.modalityNames.INDIVIDUAL },
  ],
  SHOPEE: [],
  OUTRO: [],
};

/** A fresh channel slot — defaults to the marketplace's first modality (or none) + blank fees. */
export function defaultChannelSlot(marketplace: MarketplaceId = "MERCADO_LIVRE"): ChannelSlotForm {
  return {
    marketplace,
    modality: (MODALITY_OPTIONS[marketplace][0]?.value ?? "") as Modality,
    commissionPct: "",
    fixedFee: "",
    minPerItem: "",
    freightCost: "",
  };
}

/** A fresh, blank "Outros custos" row (US5). Blank name is accepted — the UI shows a neutral
 *  placeholder and the breakdown falls back to a generic label (FR-116). */
export function defaultOtherCost(): OtherCostForm {
  return { name: "", value: "" };
}

/** The channel numeric fields shown as a compact 2-col grid, with pt-BR labels + affixes. */
export const CHANNEL_FEE_FIELDS: readonly {
  name: ChannelFieldName;
  label: string;
  currency?: boolean;
  unit?: string;
}[] = [
  { name: "commissionPct", label: t.channels.commission, unit: "%" },
  { name: "fixedFee", label: t.channels.fixedFee, currency: true },
  { name: "minPerItem", label: t.channels.minPerItem, currency: true },
  { name: "freightCost", label: t.channels.freight, currency: true },
];

/** UX starting values (pt-BR strings). Required/prefilled ship an editable value so the
 *  page renders a coherent price on load; optional-core fields start at 0 (de-emphasized,
 *  contribute nothing until touched — FR-023). */
export const defaultCalcValues: CalcFormValues = {
  costPerRoll: "100,00",
  rollWeightKg: "1",
  printGrams: "100",
  wasteGrams: "0",
  printTimeHours: "5",
  avgPowerKw: "0,12",
  tariffPerKwh: "1,00",
  machineValue: "4000,00",
  machineLifetimeHours: "2000",
  maintenanceReservePerHour: "0",
  failurePct: "0",
  finishTimeHours: "0",
  finishRatePerHour: "0",
  laborHours: "0",
  laborRatePerHour: "0",
  markupVarejoPct: "50",
  markupAtacadoPct: "30",
  channels: [defaultChannelSlot()],
  includeMarketplace: true,
  // Starts empty — 0 sub-costs is behaviourally identical to 004's `adminTotal: 0` (admin = 0).
  otherCosts: [],
};

/** Render metadata (label, unit, requiredness) so the page maps fields → DS controls. */
export interface CalcFieldMeta {
  name: CalcFieldName;
  label: string;
  /** Show the R$ prefix. */
  currency?: boolean;
  /** Unit suffix, e.g. "kg", "g", "h", "kW", "%", "/kWh". */
  unit?: string;
  /** Always-visible clarifying hint (e.g. the avgPower tooltip). */
  hint?: string;
  /** True for the mandatory + pre-filled inputs (marked required); false for optional-core. */
  required: boolean;
}

export const MANDATORY_FIELDS: readonly CalcFieldMeta[] = [
  { name: "costPerRoll", label: t.fields.costPerRoll, currency: true, required: true },
  { name: "rollWeightKg", label: t.fields.rollWeight, unit: "kg", required: true },
  { name: "printGrams", label: t.fields.grams, unit: "g", required: true },
  { name: "printTimeHours", label: t.fields.printTime, unit: "h", required: true },
  {
    name: "avgPowerKw",
    label: t.fields.avgPower,
    unit: "kW",
    hint: t.hints.avgPower,
    required: true,
  },
  { name: "tariffPerKwh", label: t.fields.tariff, currency: true, unit: "/kWh", required: true },
  { name: "machineValue", label: t.fields.machineValue, currency: true, required: true },
  { name: "machineLifetimeHours", label: t.fields.machineLifetime, unit: "h", required: true },
] as const;

export const OPTIONAL_FIELDS: readonly CalcFieldMeta[] = [
  { name: "wasteGrams", label: t.fields.wasteGrams, unit: "g", required: false },
  {
    name: "maintenanceReservePerHour",
    label: t.fields.maintenance,
    currency: true,
    unit: "/h",
    required: false,
  },
  { name: "failurePct", label: t.fields.failure, unit: "%", required: false },
  { name: "finishTimeHours", label: t.fields.finishTime, unit: "h", required: false },
  {
    name: "finishRatePerHour",
    label: t.fields.finishRate,
    currency: true,
    unit: "/h",
    required: false,
  },
] as const;

export const MARKUP_FIELDS: readonly CalcFieldMeta[] = [
  {
    name: "markupVarejoPct",
    label: t.fields.markupVarejo,
    unit: "%",
    hint: t.hints.markup,
    required: true,
  },
  { name: "markupAtacadoPct", label: t.fields.markupAtacado, unit: "%", required: true },
] as const;

// Optional labor cost that sums into custo_total (default 0 → no effect). The "Outros custos" slot
// (US5) lives alongside these fields on the page but is a named-sub-cost array, not a scalar field.
export const LABOR_FIELDS: readonly CalcFieldMeta[] = [
  { name: "laborHours", label: t.fields.laborHours, unit: "h", required: false },
  {
    name: "laborRatePerHour",
    label: t.fields.laborRate,
    currency: true,
    unit: "/h",
    required: false,
  },
] as const;
