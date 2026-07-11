// pt-BR decimal parse/format helpers (shared). Pure & framework-free so the
// calculator model and the NumberField primitive both rely on the same rules.
// Full i18n library is deferred (TD-001).

/** Parse a pt-BR decimal string ("1.234,56" → 1234.56). Numbers pass through; blank → NaN. */
export function parseDecimal(str: string | number): number {
  if (typeof str === "number") return str;
  if (!str) return Number.NaN;
  return Number.parseFloat(String(str).replace(/\./g, "").replace(",", "."));
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
