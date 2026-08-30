// pt-BR decimal parse/format helpers (shared). Pure & framework-free so the calculator model,
// the catalog forms and the NumberField primitive all rely on the same rules.
// Full i18n library is deferred (TD-001).
//
// 013 / FA-01 · FB-01 · FA-02 · FA-05 — THE GRAMMAR IS THE VALIDATION (research §1).
// The previous parser did `.replace(/\./g,"").replace(",",".")` → `parseFloat`, i.e. it trusted
// "whatever survives the filter". That produced FINITE, PLAUSIBLE, WRONG numbers with no error:
// "0.12" kW → 12 (a measured 100× energy error) and "1,234,56" → 1.234 (parseFloat stopping at the
// residue). `parseFloat` is now ONLY the final conversion of an already-validated string.
//
// Accepted forms (optional leading "-"):
//   ^\d+$                          integer          "1500"      → 1500
//   ^\d+,\d+$                      pt-BR decimal    "0,12"      → 0.12
//   ^[1-9]\d{0,2}(\.\d{3})+(,\d+)? pt-BR thousands  "1.500,00"  → 1500 · "1.500" → 1500
//   ^0\.\d+$                       zero-decimal     "0.125"     → 0.125 · "0.5" → 0.5
//   ^\d+\.\d{1,2}$                 dot-decimal      "0.12"      → 0.12 · "1500.00" → 1500
//   anything else                  REJECTED         "1,234,56" · "10-5" · "5x3" · "12,,5" · "1.5000"
//
// Structural disambiguation: a dot followed by EXACTLY 3 digits in groups is a thousands mark
// (pt-BR convention); a dot followed by 1–2 digits can only be an en-US decimal. The single
// residually ambiguous form "1.500" resolves as pt-BR = 1500 (documented + pinned in the tests).
//
// 013 confirmation audit / F2 — the thousands group must NOT start with zero. "0.125" was matching
// the thousands form (`\d{1,3}` accepted the leading "0") → "0125" → 125: a silent 1000× error for a
// legitimate 3-decimal fraction. A pt-BR thousands number never leads with a zero group, and "0.xxx"
// is unambiguously a fraction < 1 — so the thousands form now requires `[1-9]` first, and "0.\d+" is
// accepted as an en-US decimal. The genuinely ambiguous non-zero case ("1.125") stays thousands, per
// the documented "1.500"≡1500 rule.
//
// TWO DECISIONS, recorded so the next reader does not "fix" them:
// 1. The rejection sentinel stays `Number.NaN`, NOT `null`. tasks.md's "→ null" is shorthand for
//    "→ field error"; every caller already guards with `Number.isFinite(n)` and the return type is
//    `number`. NaN preserves the surface contract with zero ripple and yields the identical
//    user-visible outcome (the existing per-field pt-BR message). Deviation-with-reason.
// 2. Affix stripping lives HERE and is ANCHORED. The old callers each did an unanchored
//    `replace(/[^\d.,-]/g,"")`, which CONCATENATES ACROSS interior garbage ("5x3" → "53") and so
//    would pass any grammar. We strip only the leading and trailing non-numeric runs (so "R$ 1,50"
//    and "1,50 kg" still work) and leave interior characters in place, so "5x3" and "10-5" are
//    rejected. One rule, one home (Constitution V) — callers MUST NOT re-implement the strip.

const RE_INTEGER = /^\d+$/;
const RE_PTBR_DECIMAL = /^\d+,\d+$/;
// F2: the leading group is [1-9] — a thousands number never starts with a zero group, so "0.125" is
// NOT thousands (it was wrongly becoming 125).
const RE_PTBR_THOUSANDS = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/;
// F2: "0." followed by any digits is an unambiguous fraction < 1 (en-US decimal), whatever the
// number of decimals — this is what makes "0.125" resolve to 0.125 instead of being rejected.
const RE_ZERO_DECIMAL = /^0\.\d+$/;
const RE_DOT_DECIMAL = /^\d+\.\d{1,2}$/;

/** Numeric-ish characters: everything else is an affix when it sits at either END of the string. */
const NUMERIC_CHARS = /[\d.,-]/;

/** Drop the leading and trailing non-numeric runs ONLY — interior characters survive on purpose. */
function stripAffixes(raw: string): string {
  let start = 0;
  let end = raw.length;
  while (start < end && !NUMERIC_CHARS.test(raw[start])) start++;
  while (end > start && !NUMERIC_CHARS.test(raw[end - 1])) end--;
  return raw.slice(start, end);
}

/** True when `digits` (already sign-stripped) is one of the four accepted forms. */
function isAcceptedForm(digits: string): boolean {
  return (
    RE_INTEGER.test(digits) ||
    RE_PTBR_DECIMAL.test(digits) ||
    RE_PTBR_THOUSANDS.test(digits) ||
    RE_ZERO_DECIMAL.test(digits) ||
    RE_DOT_DECIMAL.test(digits)
  );
}

/** The accepted form → a canonical en-US decimal string ready for `parseFloat`/the wire. */
function canonicalize(digits: string): string {
  if (digits.includes(",")) return digits.replace(/\./g, "").replace(",", ".");
  if (RE_PTBR_THOUSANDS.test(digits)) return digits.replace(/\./g, "");
  return digits; // integer or dot-decimal — already canonical
}

/** The validated core of a raw entry: `{ sign, digits }`, or null when the string is not accepted. */
function acceptedCore(str: string): { negative: boolean; digits: string } | null {
  const core = stripAffixes(str.trim());
  if (core === "") return null;
  const negative = core.startsWith("-");
  const digits = negative ? core.slice(1) : core;
  return isAcceptedForm(digits) ? { negative, digits } : null;
}

/**
 * Parse a pt-BR (or documented dot-decimal) string into a number. Numbers pass through unchanged;
 * blank and every string outside the grammar above → `NaN`, which every caller already turns into
 * the existing per-field pt-BR error. A leading "-" is accepted and returns a NEGATIVE number so
 * the callers' `n < 0` branch keeps emitting its specific "negative" message.
 */
export function parseDecimal(str: string | number): number {
  if (typeof str === "number") return str;
  if (!str) return Number.NaN;
  const core = acceptedCore(String(str));
  if (!core) return Number.NaN;
  const n = Number.parseFloat(canonicalize(core.digits));
  return core.negative ? -n : n;
}

/**
 * The SAVE-side mirror of `parseDecimal`: a pt-BR form string → the canonical decimal string the
 * wire carries, WITHOUT a float round-trip, so the leaf keeps its precision byte-for-byte
 * ("110,00" → "110.00", SC-305) while reading the exact same grammar the parser reads
 * ("1500.00" → "1500.00", never the old "150000"). A rejected string → "0"; it cannot reach the
 * wire in practice because the form resolver blocks it first.
 */
export function ptBrToWireDecimal(value: string): string {
  const core = acceptedCore(value ?? "");
  if (!core) return "0";
  return `${core.negative ? "-" : ""}${canonicalize(core.digits)}`;
}

/**
 * A wire decimal leaf → the editable pt-BR form string ("1200.00" → "1200,00"). Pure separator
 * swap, never a float round-trip (SC-305: the prefilled form must feed `parseDecimal` the exact
 * string a manual entry would produce).
 *
 * 013 / FA-05 — this was three identical private copies (`catalog-prefill`, `product-mapping`,
 * `scenario-bridge`), each silently assuming the leaf carries AT MOST one "." (true: the leaves
 * come from `Decimal#toString`). The premise is now pinned by a test: if it were ever violated,
 * `replace` swaps only the FIRST dot and the resulting string is REJECTED by `parseDecimal`
 * (an honest field error) instead of silently becoming a wrong number.
 */
export function wireToPtBr(value: string): string {
  return value.replace(".", ",");
}

/** Format a number as pt-BR ("1234.5" → "1.234,50"). NaN/null → "". */
export function formatDecimal(n: number, digits = 2): string {
  if (n == null || Number.isNaN(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Format a number as a pt-BR BRL string (28.65 → "R$ 28,65"). Values arrive already rounded to
 *  2dp by pricing-core; this only renders. Shared home (008 R7) so `features/bom` and the
 *  calculator print money through one rule — the calculator re-exports it unchanged. */
export function formatBRL(value: number): string {
  return `R$ ${formatDecimal(value, 2)}`;
}
