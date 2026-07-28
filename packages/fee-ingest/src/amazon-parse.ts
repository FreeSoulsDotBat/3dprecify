// Amazon BR referral-fee table → catalog entries (014/US3). PURE parsing: no network, no browser.
// The fetching half lives in `amazon-fetch.ts` so this can be tested against fixtures captured from
// the real page — which is how the three traps below were found rather than guessed.
//
// Measured against the live table on 2026-07-28: ONE table, 38 data rows, three columns
// (Categorias · Porcentagens de comissão · Comissão mínima aplicável).

/** A row exactly as the page yields it: [category, commission, minimum]. */
export type RawRow = readonly string[];

export interface ParsedBand {
  minPrice: number;
  maxPrice: number | null;
  commissionPct: number;
}

export interface ParsedCategory {
  name: string;
  /** Flat commission, or null when the category is banded. */
  commissionPct: number | null;
  bands: ParsedBand[] | null;
  minPerItem: number | null;
}

// TRAP 1 — Amazon writes money cells with a NON-BREAKING space (U+00A0). A plain-space regex misses
// "BRL 1,00" even though the extracted text visibly contains it. This cost gate G2 a false FAIL on a
// page that had rendered perfectly. Normalise before matching anything.
const NBSP = new RegExp(String.fromCharCode(0xa0), "g");

/** Trailing footnote markers are glued to the name: "Acessórios Eletrônicos1", "Móveis2". */
const FOOTNOTE = /\d+$/;

const normalise = (s: string) => s.replace(NBSP, " ").replace(/\s+/g, " ").trim();

/** A bare pt-BR amount ("1.234,56") → number. Thousands dots dropped, comma is the decimal mark. */
function parseBrNumber(digits: string): number {
  return Number(digits.replace(/\./g, "").replace(",", "."));
}

/** pt-BR money WITH its currency prefix → number. Handles "BRL 1,00" and "R$ 100,00" — TRAP 2: the
 *  SAME cell mixes both notations. Returns null when no prefixed amount is present. */
function parseMoney(text: string): number | null {
  const m = /(?:BRL|R\$)\s*([\d.]+,\d{2})/.exec(normalise(text));
  return m ? parseBrNumber(m[1]) : null;
}

function parsePct(text: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*%/.exec(normalise(text));
  return m ? Number(m[1].replace(",", ".")) : null;
}

/**
 * A banded commission cell, e.g. "15% até BRL 100,00 10% acima de R$ 100,00".
 *
 * Returns null when the cell is a plain percentage. Bands are half-open `[min, max)` to match the
 * catalog contract's lower-inclusive tie-rule, so the threshold itself falls in the UPPER band —
 * which is what "acima de" and "até" mean read together, and is testable from both sides.
 */
export function parseBands(cell: string): ParsedBand[] | null {
  const text = normalise(cell);
  const upTo = /(\d+(?:[.,]\d+)?)\s*%\s*até\s*(?:BRL|R\$)\s*([\d.]+,\d{2})/i.exec(text);
  const above = /(\d+(?:[.,]\d+)?)\s*%\s*acima de\s*(?:BRL|R\$)\s*([\d.]+,\d{2})/i.exec(text);
  if (!upTo || !above) return null;

  // The capture groups hold BARE amounts ("100,00") — the currency prefix was consumed by the
  // pattern. Feeding them to parseMoney (which REQUIRES a prefix) silently returned null and killed
  // every band; that is what these tests caught.
  const threshold = parseBrNumber(upTo[2]);
  const thresholdAbove = parseBrNumber(above[2]);
  // The page states the same number twice, in two notations. If they ever disagree, the cell shape
  // changed and guessing which one is right would be inventing money.
  if (threshold !== thresholdAbove) return null;

  return [
    { minPrice: 0, maxPrice: threshold, commissionPct: Number(upTo[1].replace(",", ".")) },
    { minPrice: threshold, maxPrice: null, commissionPct: Number(above[1].replace(",", ".")) },
  ];
}

/**
 * Parse the whole table. Rows that do not carry a percentage are dropped as headers/notes; a row
 * that looks like data but yields no commission is a HARD failure, because silently skipping it
 * would shrink the map without anyone noticing (SC-806's shape-failure family).
 */
export function parseAmazonTable(rows: readonly RawRow[]): ParsedCategory[] {
  const out: ParsedCategory[] = [];
  for (const row of rows) {
    if (row.length < 3) continue;
    const [rawName, rawPct, rawMin] = row.map(normalise);
    if (!rawPct.includes("%")) continue; // header row

    const name = rawName.replace(FOOTNOTE, "").trim();
    if (!name) throw new Error(`row with a commission but no category: ${JSON.stringify(row)}`);

    const bands = parseBands(rawPct);
    const commissionPct = bands ? null : parsePct(rawPct);
    if (bands === null && commissionPct === null) {
      throw new Error(`unparseable commission cell for "${name}": ${JSON.stringify(rawPct)}`);
    }

    out.push({ name, commissionPct, bands, minPerItem: parseMoney(rawMin) });
  }
  return out;
}

/** Canary values fixed from the 2026-07-28 reading (FR-018a): if these stop matching, the parser is
 *  reading the wrong column — the failure mode that returns plausible numbers and passes review. */
export const CANARIES: ReadonlyArray<readonly [string, number]> = [
  ["Roupas e Acessórios", 14],
  ["Calçados", 14],
  ["Relógios", 13],
  ["Outros", 15],
];

/** The published catch-all. It is a REAL row of the table, not an invention of ours — which is the
 *  whole reason Q5 lets us pre-fill it: using it quotes Amazon rather than guessing. */
export const CATCH_ALL_NAME = "Outros";
