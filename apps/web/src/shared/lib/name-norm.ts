/**
 * ⚠ @doc DEC-036 — classe de espaço EXPLÍCITA por codepoint, nunca `\s` nem `.trim()`: JS e
 *   Python discordam sobre NEL e BOM, e concordariam por ACIDENTE em alguns casos. Pontos de
 *   código sempre por escape — U+2028/U+2029 quebram um regex literal em JS.
 */
const SPACE_CLASS_SOURCE =
    "[ \\t\\n\\r\\f\\v\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";
const SPACE_CLASS_RUN = new RegExp(`${SPACE_CLASS_SOURCE}+`, "gu");
const SPACE_CLASS_BOUNDARY = new RegExp(`^${SPACE_CLASS_SOURCE}+|${SPACE_CLASS_SOURCE}+$`, "gu");

/** O teto do pydantic para o nome do item (ver `backend/app/schemas` — o campo é `max_length=120`). */
export const NAME_MAX = 120;

/**
 * Normaliza um nome de item para comparação/dedupe, seguindo byte-a-byte a regra do servidor
 * (ADR-0033 §4). NÃO trunca — quem grava a chave usa `nameNormKey`.
 */
export function nameNorm(raw: string): string {
    const decomposed = raw.normalize("NFD").replace(/\p{Mn}/gu, "");
    const lower = decomposed.toLowerCase();
    const trimmed = lower.replace(SPACE_CLASS_BOUNDARY, "");
    return trimmed.replace(SPACE_CLASS_RUN, " ");
}

/** O que o servidor grava como chave de deduplicação: `nameNorm` truncado a 200 caracteres. */
export function nameNormKey(raw: string): string {
    return nameNorm(raw).slice(0, 200);
}
