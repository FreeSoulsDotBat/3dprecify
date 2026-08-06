import { parseDecimal } from "@/shared/lib/decimal-ptbr";

// 016/US7 (FR-909, arquitetura-016.md §7) — pure h+min ↔ decimal conversion for `printTimeHours`,
// AT THE BORDER ONLY: the engine keeps receiving the exact same decimal it always has (SC-905).
// Nothing here is persisted — a derivation of this kind NEVER enters `PriceInput`, the scenario
// document or a frozen payload (the invariant §7 states).
//
// Bijective in the domain of INTEGER minutes: any (h, min) with min in [0, 59] round-trips
// exactly, because the forward direction (`hmToDecimalHours`) always works off the INTEGER
// total-minutes count, never off a fraction directly. The only place a fraction/rounding
// decision happens is the DISPLAY (decimal → h+min) direction, where a `round(frac×60) === 60`
// carries into +1h/0min (arquitetura-016.md §7).

export interface HoursMinutes {
  h: number;
  min: number;
}

/**
 * decimal → h+min (display direction). `h = trunc(x)`, `min = round(frac(x)×60)`, with the
 * 60-minute carry (`round(frac×60) === 60` → +1h, 0min). A non-finite or negative input reads as
 * 0h0min — never NaN on screen (a document with a bad/blank decimal still opens).
 */
export function decimalHoursToHm(value: string | number): HoursMinutes {
  const n = typeof value === "number" ? value : parseDecimal(value);
  if (!Number.isFinite(n) || n < 0) return { h: 0, min: 0 };
  const h = Math.trunc(n);
  let min = Math.round((n - h) * 60);
  let carriedH = h;
  if (min >= 60) {
    min -= 60;
    carriedH += 1;
  }
  return { h: carriedH, min };
}

/**
 * h+min → decimal (input direction), via the INTEGER total-minutes count — this is what makes
 * "minutos ≥ 60 digitados" transbordar deterministicamente (e.g. 5h + 75min = 6h15min), never a
 * fractional artefact. Negative/non-finite parts are treated as 0.
 */
export function hmToDecimalHours(h: number, min: number): number {
  const safeH = Number.isFinite(h) && h >= 0 ? Math.trunc(h) : 0;
  const safeMin = Number.isFinite(min) && min >= 0 ? Math.trunc(min) : 0;
  return (safeH * 60 + safeMin) / 60;
}

/**
 * The pt-BR form string `hmToDecimalHours` feeds back into `printTimeHours` — comma decimal
 * (`decimal-ptbr.ts`'s `RE_PTBR_DECIMAL` accepts unlimited fraction digits, unlike the dot form's
 * 1–2 digit ceiling, which a repeating fraction like 20min/60 would blow past), 6dp of precision
 * — enough for `round(frac×60)` to recover the exact minute on the way back (SC-905 bijectivity)
 * — trimmed to a bare integer string when minutes are 0 (matches the existing "5" seed value).
 */
export function hmToDecimalString(h: number, min: number): string {
  const decimal = hmToDecimalHours(h, min);
  if (Number.isInteger(decimal)) return String(decimal);
  const fixed = decimal.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return fixed.replace(".", ",");
}
