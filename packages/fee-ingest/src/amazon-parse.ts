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
 * What ONE commission cell says — as three distinct answers, deliberately.
 *
 * The predecessor returned `ParsedBand[] | null`, and `null` carried two incompatible meanings:
 * "this is a plain percentage" and "this LOOKS banded and I refuse to read it". The caller could not
 * tell them apart, so it did the only thing it could — fell back to `parsePct`, which returns the
 * FIRST percentage in the cell. A cell whose two thresholds disagreed came out as a flat 15%,
 * published under a "Referência" seal by the monthly loop. FR-014c: a refusal MUST NOT be undone
 * downstream, and the way to guarantee that is to make it unrepresentable as "not banded".
 */
export type CommissionCell =
  | { kind: "FLAT"; commissionPct: number }
  | { kind: "BANDED"; bands: ParsedBand[] }
  | { kind: "UNRECOGNISED"; reason: string };

/** Any wording that announces a threshold. Presence means the cell is NOT a single rate, whether or
 *  not this parser knows how to read the rest of it — which is the distinction that matters. */
const THRESHOLD_WORDING = /até|acima de|excedente|superior a|a partir de|primeiros/i;

const RATE = /\d+(?:[.,]\d+)?\s*%/g;

/**
 * Read a commission cell, e.g. "15% até BRL 100,00 10% acima de R$ 100,00".
 *
 * Bands are half-open `[min, max)` to match the catalog contract's lower-inclusive tie-rule, so the
 * threshold itself falls in the UPPER band — which is what "acima de" and "até" mean read together,
 * and is testable from both sides.
 *
 * Everything that is neither a bare rate nor exactly this two-band shape is UNRECOGNISED. That
 * includes shapes a human would find readable (three bands, "para o excedente"): the parser saying
 * "I do not know this" is cheap, and the alternative — publishing a partial reading of a cell about
 * money — is the failure this whole guard exists for.
 */
export function readCommissionCell(cell: string): CommissionCell {
  const text = normalise(cell);
  const rates = text.match(RATE) ?? [];

  if (!THRESHOLD_WORDING.test(text) && rates.length <= 1) {
    const flat = parsePct(text);
    return flat === null
      ? { kind: "UNRECOGNISED", reason: "no percentage in the cell" }
      : { kind: "FLAT", commissionPct: flat };
  }

  if (rates.length !== 2) {
    return {
      kind: "UNRECOGNISED",
      reason: `${rates.length} rate(s) in a threshold cell — the published structure is not the two-band one this parser knows`,
    };
  }

  const upTo = /(\d+(?:[.,]\d+)?)\s*%\s*até\s*(?:BRL|R\$)\s*([\d.]+,\d{2})/i.exec(text);
  const above = /(\d+(?:[.,]\d+)?)\s*%\s*acima de\s*(?:BRL|R\$)\s*([\d.]+,\d{2})/i.exec(text);
  if (!upTo || !above) {
    return { kind: "UNRECOGNISED", reason: "threshold wording this parser does not know" };
  }

  // The capture groups hold BARE amounts ("100,00") — the currency prefix was consumed by the
  // pattern. Feeding them to parseMoney (which REQUIRES a prefix) silently returned null and killed
  // every band; that is what these tests caught.
  const threshold = parseBrNumber(upTo[2]);
  const thresholdAbove = parseBrNumber(above[2]);
  // The page states the same number twice, in two notations. If they ever disagree, the cell shape
  // changed and guessing which one is right would be inventing money.
  if (threshold !== thresholdAbove) {
    return {
      kind: "UNRECOGNISED",
      reason: `the two thresholds disagree (${threshold} vs ${thresholdAbove})`,
    };
  }

  return {
    kind: "BANDED",
    bands: [
      { minPrice: 0, maxPrice: threshold, commissionPct: Number(upTo[1].replace(",", ".")) },
      { minPrice: threshold, maxPrice: null, commissionPct: Number(above[1].replace(",", ".")) },
    ],
  };
}

/**
 * Parse the whole table. Rows that do not carry a percentage are dropped as headers/notes; a row
 * that looks like data but yields no commission is a HARD failure, because silently skipping it
 * would shrink the map without anyone noticing (SC-806's shape-failure family).
 */
export function parseAmazonTable(rows: readonly RawRow[]): ParsedCategory[] {
  const out: ParsedCategory[] = [];
  for (const row of rows) {
    // U4-b — uma linha CURTA que parece DADO e mudanca de forma, nao ruido. `row.length < 3` a
    // descartava em silencio: uma coluna removida da fonte faz TODA linha de dado virar curta, o
    // parse encolhe para zero e cai no MIN_ROWS — detectado, mas com o diagnostico ERRADO ("a fonte
    // encolheu"), que manda o operador procurar categorias que a Amazon nunca apagou. Cabecalho e
    // nota continuam sendo pulados, porque nao carregam percentual.
    if (row.length < 3) {
      // A guarda olha a SEGUNDA celula, nao "qualquer uma". A leitura e POSICIONAL — `[nome, pct,
      // min]` —, entao a forma de "linha de dado com uma coluna a menos" e ter percentual em `[1]`.
      // Olhar qualquer celula matava o laco numa NOTA DE RODAPE ("Comissao de 15% sobre o valor
      // total..."), com a mensagem falsa "a column was REMOVED": o mesmo defeito que esta guarda
      // conserta, virado do avesso, e num lugar onde o unico sintoma seria o laco mensal parar de
      // rodar com um diagnostico que manda procurar a coisa errada. (Regressao introduzida junto com
      // a propria U4-b e achada pela lente que EXECUTA — nenhum teste unitario podia ve-la.)
      if (row.length >= 2 && normalise(row[1]).includes("%")) {
        throw new Error(
          `row with ${row.length} columns carrying a percentage — the published table has 3, so a ` +
            `column was REMOVED and the positional read would shift silently: ${JSON.stringify(row)}`,
        );
      }
      continue;
    }
    const [rawName, rawPct, rawMin] = row.map(normalise);
    if (!rawPct.includes("%")) continue; // header row

    // 014/T102 — ARIDADE EXATA. A leitura acima é POSICIONAL, e `row.length >= 3` aceitava uma quarta
    // coluna calada: se a Amazon inserir uma ("Taxa de fechamento", por exemplo), `rawMin` passa a
    // vir da coluna errada e todo mínimo por item vira zero, com o percentual intacto. Isso é
    // mudança de FORMA da fonte — a família de falha do SC-806 —, não uma mudança de tarifa, e a
    // resposta honesta é recusar em voz alta em vez de publicar números plausíveis e errados.
    if (row.length !== 3) {
      throw new Error(
        `row with ${row.length} columns — the published table has 3, so a column was INSERTED and ` +
          `the positional read would shift silently: ${JSON.stringify(row)}`,
      );
    }

    const name = rawName.replace(FOOTNOTE, "").trim();
    if (!name) throw new Error(`row with a commission but no category: ${JSON.stringify(row)}`);

    // ONE reading of the cell, and no second chance at it: there is no `?? parsePct(...)` here any
    // more, because that fallback is exactly how the refusal used to be undone (FR-014c).
    const cell = readCommissionCell(rawPct);
    if (cell.kind === "UNRECOGNISED") {
      throw new Error(
        `unparseable commission cell for "${name}": ${cell.reason} — ${JSON.stringify(rawPct)}`,
      );
    }

    out.push({
      name,
      commissionPct: cell.kind === "FLAT" ? cell.commissionPct : null,
      bands: cell.kind === "BANDED" ? cell.bands : null,
      minPerItem: parseMoney(rawMin),
    });
  }
  return out;
}

/** Canary values fixed from the 2026-07-28 reading (FR-018a): if these stop matching, the parser is
 *  reading the wrong column — the failure mode that returns plausible numbers and passes review. */
/** 014/T102 — o PAR `(comissão, mínimo por item)`, medido no artefato de 2026-07-28. Só a comissão
 *  não bastava: o deslocamento de coluna que a aridade agora recusa mantinha o percentual e zerava o
 *  mínimo, e a canária dizia `ok`. */
export const CANARIES: ReadonlyArray<readonly [string, number, number]> = [
  ["Roupas e Acessórios", 14, 1],
  ["Calçados", 14, 1],
  ["Relógios", 13, 1],
  ["Outros", 15, 1],
];

/** The published catch-all. It is a REAL row of the table, not an invention of ours — which is the
 *  whole reason Q5 lets us pre-fill it: using it quotes Amazon rather than guessing. */
export const CATCH_ALL_NAME = "Outros";
