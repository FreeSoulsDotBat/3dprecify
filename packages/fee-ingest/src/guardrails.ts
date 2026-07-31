import type { ParsedCategory } from "./amazon-parse";

// The fail-safe, as testable logic rather than `if` statements buried in a CLI (FR-018a/SC-806).
//
// The failure this exists for is NOT "the table disappeared" — that one is obvious. It is a parser
// that reads the WRONG COLUMN and returns a full set of plausible numbers, which then sails through
// a human's review of the monthly PR because nothing looks wrong. Row count alone cannot catch that;
// pinned canaries can.

export interface SanityOptions {
  /** Below this many parsed rows, treat the run as a source-shape failure. */
  minRows: number;
  /** Values fixed from a known-good reading. */
  canaries: ReadonlyArray<readonly [string, number]>;
}

export type SanityVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Decide whether a parse is trustworthy enough to publish.
 *
 * Deliberately returns a verdict instead of throwing: the caller must be able to react by leaving
 * the artifact untouched and alerting — never by writing a partial map (SC-806).
 */
export function checkParseSanity(
  categories: readonly ParsedCategory[],
  opts: SanityOptions,
): SanityVerdict {
  if (categories.length < opts.minRows) {
    return {
      ok: false,
      reason: `parsed ${categories.length} categories, below the ${opts.minRows} floor — source shape changed, not a fee change`,
    };
  }
  for (const [name, expected] of opts.canaries) {
    const hit = categories.find((c) => c.name === name);
    if (!hit) return { ok: false, reason: `canary "${name}" is missing from the parse` };
    if (hit.commissionPct !== expected) {
      return {
        ok: false,
        reason: `canary "${name}" expected ${expected}%, got ${hit.commissionPct} — the parser is likely reading the wrong column`,
      };
    }
  }
  return { ok: true };
}

/** The band shape the coverage check needs — structurally what the catalog carries. */
export interface CoverableBand {
  minPrice: number;
  maxPrice: number | null;
}

/**
 * Is a parsed band set well-formed enough to publish? (014/T114, SC-817.)
 *
 * A GAP is legitimate data and is NOT rejected here — FR-014a is explicit that the window the source
 * leaves unpriced stays unpriced, and `pricing-core` now refuses to price inside one instead of
 * borrowing the neighbour's rate. What this catches is the shapes that make a gap INDISTINGUISHABLE
 * from a parse error:
 *
 * - OVERLAP — two bands claiming the same price. The engine's lower-inclusive lookup would silently
 *   pick whichever came first, so which rate the seller pays would depend on the row order of a
 *   scraped table.
 * - OUT OF ORDER / inverted bounds — a `maxPrice` at or below its own `minPrice` is a band that can
 *   never contain a price, which is a reading error wearing the shape of data.
 * - A SECOND unbounded band — only the terminal band may be open-ended.
 *
 * A verdict, not a throw, for the same reason `checkParseSanity` returns one: the caller must be able
 * to leave the published artifact untouched rather than replace it with something malformed (SC-806).
 */
export function checkBandCoverage(bands: readonly CoverableBand[]): SanityVerdict {
  const sorted = [...bands].sort((a, b) => a.minPrice - b.minPrice);
  for (const [i, band] of sorted.entries()) {
    if (band.maxPrice !== null && band.maxPrice <= band.minPrice) {
      return {
        ok: false,
        reason: `band [${band.minPrice}, ${band.maxPrice}) cannot contain a price`,
      };
    }
    const next = sorted[i + 1];
    if (!next) continue;
    if (band.maxPrice === null) {
      return {
        ok: false,
        reason: `only the terminal band may be unbounded — [${band.minPrice}, ∞) is followed by [${next.minPrice}, …)`,
      };
    }
    if (next.minPrice < band.maxPrice) {
      return {
        ok: false,
        reason: `bands overlap at ${next.minPrice}: [${band.minPrice}, ${band.maxPrice}) and [${next.minPrice}, …)`,
      };
    }
  }
  return { ok: true };
}

/**
 * A próxima `catalogVersion` ("YYYY-MM-DD.n") — a data da LEITURA mais uma sequência dentro dela.
 *
 * 014 (revisão final adversarial, 2026-07-31): `build-amazon.mjs` cravava `${collectedAt}.0`, então
 * regerar na mesma data de coleta reescrevia conteúdo DIFERENTE sob rótulo IDÊNTICO. Foi o que
 * aconteceu nesta branch — o artefato foi de 77 para 79 entradas com `catalogVersion` parado em
 * `2026-07-28.0`.
 *
 * Isso não é higiene de versionamento: o rótulo é congelado dentro do payload que o ADR-0019 torna
 * IMUTÁVEL. Dois registros dizendo o mesmo nome descreviam tabelas diferentes, e a pergunta que o
 * campo existe para responder — QUAL tabela produziu este número — deixava de ter resposta, sem
 * conserto posterior possível, porque o registro não pode ser reescrito.
 *
 * Duas regras, e a segunda é a que evita o ruído: a sequência é INTEIRA (a mesma armadilha que
 * `freshest` pagou — texto faria ".9" perder para ".10"), e o rótulo só se move quando o CONTEÚDO
 * mudou. Ele nomeia o dado, não a execução: reler a mesma tabela não a torna uma tabela nova.
 */
export function nextCatalogVersion(
  // Exigido, não `string | null`: o artefato SEMPRE carrega um rótulo, e um artefato sem ele é uma
  // falha de forma que `build-amazon.mjs` deve recusar em voz alta — como já recusa um artefato sem
  // o marketplace AMAZON (T091). Aceitar a ausência aqui criava um ramo que nenhum caminho alcança,
  // e o ratchet de 100% o encontrou. Rótulo ILEGÍVEL continua tratado: esse é representável.
  previous: string,
  collectedAt: string,
  changed: boolean,
): string {
  if (!changed) return previous;
  const parsed = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(previous);
  return parsed && parsed[1] === collectedAt
    ? `${collectedAt}.${Number(parsed[2]) + 1}`
    : `${collectedAt}.0`;
}
