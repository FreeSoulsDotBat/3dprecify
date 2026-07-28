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
