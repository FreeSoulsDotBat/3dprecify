import type { FieldErrors, Resolver } from "react-hook-form";
import { z } from "zod";

import { messages } from "@/shared/i18n/messages.pt-br";
import { parseDecimal } from "@/shared/lib/decimal-ptbr";

// RHF + Zod schema for the E1 MVP calculator form (US1 + US2). It parses the raw pt-BR/BRL
// form strings into the numbers `pricing-core` expects and rejects bad input with a per-field
// pt-BR message — the fix TD-020 asked for (never silently coerce a bad string to 0). The
// MVP surfaces the mandatory inputs (FR-001..003,005..009,017,018) plus the optional-core
// ones (FR-004,010..013). labor/admin (US4) and marketplace (US5) are NOT surfaced yet; the
// engine accepts them as optional and defaults them to 0/null.

const t = messages.calculator;

/** The 15 MVP fields — names mirror `pricing-core`'s `PriceInput` so a thrown
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
  "markupVarejoPct",
  "markupAtacadoPct",
] as const;

export type CalcFieldName = (typeof CALC_FIELD_NAMES)[number];

/** The form's live value shape: one controlled pt-BR string per field. */
export type CalcFormValues = Record<CalcFieldName, string>;

type FieldKind = "required" | "prefilled" | "optional";

interface NumRule {
  kind: FieldKind;
  /** Must be strictly > 0 (a denominator, e.g. roll weight / machine lifetime). */
  positive?: boolean;
  /** Field-specific "> 0" message (defaults to the generic one). */
  positiveMessage?: string;
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
    // Tolerate visual affixes the user may type (R$, unit letters, spaces); keep only
    // digits, comma, dot and sign, then apply the shared pt-BR decimal rule.
    const cleaned = trimmed.replace(/[^\d.,-]/g, "");
    const n = parseDecimal(cleaned);
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
  markupVarejoPct: "50",
  markupAtacadoPct: "30",
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
