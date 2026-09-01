// @doc DEC-002 — a gramática é a validação: `parseFloat` só converte string que já foi aceita.

const RE_INTEGER = /^\d+$/;
const RE_PTBR_DECIMAL = /^\d+,\d+$/;
// F2: o grupo à frente é [1-9] — milhar nunca começa com zero, senão "0.125" virava 125.
const RE_PTBR_THOUSANDS = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?$/;
// F2: "0." seguido de dígitos é fração < 1 inequívoca, qualquer que seja o número de casas.
const RE_ZERO_DECIMAL = /^0\.\d+$/;
const RE_DOT_DECIMAL = /^\d+\.\d{1,2}$/;

/** Numeric-ish characters: everything else is an affix when it sits at either END of the string. */
const NUMERIC_CHARS = /[\d.,-]/;

// ⚠ @doc DEC-002 — corta só as pontas, e o chamador NÃO reimplementa isto: um strip sem âncora
//   concatena através do lixo interior e faz "5x3" passar por qualquer gramática, como 53.
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

/** Fora da gramática → `NaN`, que todo chamador já vira erro de campo. O "-" à frente sobrevive,
 *  para o ramo `n < 0` do chamador seguir emitindo a mensagem específica dele. */
export function parseDecimal(str: string | number): number {
    if (typeof str === "number") return str;
    if (!str) return Number.NaN;
    const core = acceptedCore(String(str));
    if (!core) return Number.NaN;
    const n = Number.parseFloat(canonicalize(core.digits));
    return core.negative ? -n : n;
}

/** O espelho de `parseDecimal` no SALVAR: forma pt-BR → decimal do fio SEM passar por float, para
 *  a folha manter a precisão byte a byte (SC-305). Recusada → "0" (o resolvedor barra antes). */
export function ptBrToWireDecimal(value: string): string {
    const core = acceptedCore(value ?? "");
    if (!core) return "0";
    return `${core.negative ? "-" : ""}${canonicalize(core.digits)}`;
}

/** Folha do fio → forma pt-BR editável. Troca de separador pura, nunca ida-e-volta por float
 *  (SC-305). Premissa "no máximo um ponto" pinada em teste — se cair, a string é RECUSADA. */
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

/** Só renderiza: o valor chega já arredondado a 2 casas pelo pricing-core (ADR-0008). Casa única
 *  (008 R7) para `features/bom` e a calculadora imprimirem dinheiro pela mesma regra. */
export function formatBRL(value: number): string {
    return `R$ ${formatDecimal(value, 2)}`;
}
