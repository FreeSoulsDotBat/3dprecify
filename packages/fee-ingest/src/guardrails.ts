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
