import { computeCalculator, type PriceResult, ValidationError } from "@3dprecify/pricing-core";

import {
  type CalcFieldName,
  type CalcFormValues,
  calculatorSchema,
} from "@/features/calculator/calculator-schema";
import { formatDecimal } from "@/shared/lib/decimal-ptbr";

// Thin adapter for the E1 calculator (US1 + US2). It is the ONLY seam between the pt-BR form
// strings and the canonical engine: parse + validate (via calculatorSchema) → computeCalculator
// (pricing-core, the single source of the formula — FR-036) → a view-ready outcome. The 001
// `parseDecimal` lenient coercion is gone (TD-020): a bad string now surfaces a per-field
// message instead of silently becoming 0. The numeric formula itself is covered by pricing-core;
// this file only owns parse/validate and the field-error mapping.

/** Format a number as a pt-BR BRL string ("28.65" → "R$ 28,65"). Reuses the shared pt-BR
 *  formatter (single source of the locale rule); pricing-core already rounded to 2dp. */
export function formatBRL(value: number): string {
  return `R$ ${formatDecimal(value, 2)}`;
}

export type CalcFieldErrors = Partial<Record<CalcFieldName, string>>;

export interface CalcOutcome {
  /** True when every field parsed/validated and the engine returned a price. */
  ok: boolean;
  /** Per-field pt-BR validation messages (empty when ok). */
  fieldErrors: CalcFieldErrors;
  /** The computed breakdown + prices, or null when any input is invalid. */
  result: PriceResult | null;
}

/**
 * Parse + validate the raw form strings, then compute. Returns per-field messages instead of
 * ever throwing or emitting a NaN/Infinity (SC-008). A `ValidationError` raised by the engine
 * is mapped back onto its offending field (defensive — the schema already mirrors the engine's
 * bounds, so this is the belt-and-suspenders path).
 */
export function computeFromForm(values: CalcFormValues): CalcOutcome {
  const parsed = calculatorSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: CalcFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as CalcFieldName | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, fieldErrors, result: null };
  }

  try {
    const result = computeCalculator(parsed.data);
    return { ok: true, fieldErrors: {}, result };
  } catch (err) {
    if (err instanceof ValidationError) {
      const key = err.field as CalcFieldName | undefined;
      return {
        ok: false,
        fieldErrors: key ? { [key]: err.message } : {},
        result: null,
      };
    }
    throw err;
  }
}
