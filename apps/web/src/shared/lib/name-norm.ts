/**
 * 019/PR-D (T063, ADR-0033 §4) — a normalização de nome de item do catálogo, do lado do cliente.
 * A MESMA regra do servidor (`backend/app/lib/name_norm.py`, escrita pelo cluster de dados desta
 * fatia): `normalize("NFD")` → remover marcas combinantes (`\p{Mn}`) → `toLowerCase()` (NUNCA
 * `toLocaleLowerCase`/casefold — "Straße" não vira "strasse") → trim → colapsar espaços internos
 * em um.
 *
 * A classe de espaço é EXPLÍCITA e escrita com escapes de codepoint, nunca `\s` nem `.trim()`:
 * Python `\s`/`.strip()` casam `\x85` (NEL) e não casam BOM (U+FEFF); JS `\s`/`.trim()` fazem o
 * inverso. Sem a classe explícita as duas linguagens concordariam por acidente em alguns casos e
 * divergiriam silenciosamente em outros — exatamente o que o fixture compartilhado
 * (`specs/019-porte-design/contracts/fixtures/name-norm.json`) existe para provar caso a caso.
 *
 * NEL (U+0085) fica DE FORA da classe por decisão — é preservado, não colapsado. Os pontos de
 * código vêm por escape (`\uXXXX`), nunca crus: U+2028/U+2029 são LineTerminator em JS e um
 * caractere cru quebraria um regex literal (o bug que este comentário evita).
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
