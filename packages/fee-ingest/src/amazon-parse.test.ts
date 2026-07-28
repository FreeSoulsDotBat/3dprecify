import { describe, expect, it } from "vitest";

import { CANARIES, CATCH_ALL_NAME, parseAmazonTable, parseBands } from "./amazon-parse";

// Fixtures are the REAL cells, captured from the live table on 2026-07-28 — including the
// non-breaking spaces. Writing these from imagination would have missed all three traps below.
const NB = String.fromCharCode(0xa0);
const ROWS: string[][] = [
  ["Categorias", "Porcentagens de comissão", "Comissão mínima aplicável"],
  ["Roupas e Acessórios", "14%", `BRL${NB}1,00`],
  ["Relógios", "13%", `BRL${NB}1,00`],
  // TRAP: footnote digit glued to the name, and the SAME cell mixing "BRL" and "R$".
  ["Acessórios Eletrônicos1", `15% até BRL${NB}100,00 10% acima de R$${NB}100,00`, `BRL${NB}1,00`],
  ["Móveis2", `15% até BRL${NB}200,00 10% acima de BRL${NB}200,00`, `BRL${NB}1,00`],
  ["Outros", "15%", `BRL${NB}1,00`],
];

describe("parseAmazonTable — the real table's shape", () => {
  const parsed = parseAmazonTable(ROWS);

  it("drops the header and keeps every data row", () => {
    expect(parsed).toHaveLength(5);
  });

  it("reads a flat commission and the per-item minimum through the non-breaking space", () => {
    const roupas = parsed.find((c) => c.name === "Roupas e Acessórios");
    expect(roupas).toMatchObject({ commissionPct: 14, bands: null, minPerItem: 1 });
  });

  it("strips the footnote marker glued to the category name", () => {
    expect(parsed.map((c) => c.name)).toContain("Acessórios Eletrônicos");
    expect(parsed.map((c) => c.name)).toContain("Móveis");
    expect(parsed.map((c) => c.name)).not.toContain("Acessórios Eletrônicos1");
  });

  it("models a threshold category as BANDS, never flattened to one percentage", () => {
    const acc = parsed.find((c) => c.name === "Acessórios Eletrônicos");
    expect(acc?.commissionPct).toBeNull();
    expect(acc?.bands).toEqual([
      { minPrice: 0, maxPrice: 100, commissionPct: 15 },
      { minPrice: 100, maxPrice: null, commissionPct: 10 },
    ]);
  });

  it("the published catch-all is a REAL row, which is what lets Q5 quote it", () => {
    expect(parsed.find((c) => c.name === CATCH_ALL_NAME)).toMatchObject({ commissionPct: 15 });
  });

  it("every canary still matches — the guard against reading the wrong column", () => {
    for (const [name, pct] of CANARIES) {
      const hit = parsed.find((c) => c.name === name);
      if (hit) expect(hit.commissionPct).toBe(pct);
    }
  });
});

describe("parseBands — the boundary, tested from BOTH sides", () => {
  const bands = parseBands(`15% até BRL${NB}100,00 10% acima de R$${NB}100,00`)!;

  it("is half-open [min,max) so the threshold itself falls in the UPPER band", () => {
    // R$ 99,99 → 15% ; R$ 100,00 → 10%. Getting this backwards is a silent 5-point money error.
    const rateAt = (price: number) =>
      bands.find((b) => price >= b.minPrice && (b.maxPrice === null || price < b.maxPrice))
        ?.commissionPct;
    expect(rateAt(99.99)).toBe(15);
    expect(rateAt(100)).toBe(10);
    expect(rateAt(100.01)).toBe(10);
  });

  it("a plain percentage is not a band", () => {
    expect(parseBands("14%")).toBeNull();
  });

  // If the page ever states the two thresholds differently, the cell shape changed. Guessing which
  // one is right would be inventing money, so the parser refuses instead.
  it("refuses a cell whose two thresholds disagree", () => {
    expect(parseBands(`15% até BRL${NB}100,00 10% acima de BRL${NB}200,00`)).toBeNull();
  });
});

describe("parseAmazonTable — fails loudly rather than shrinking the map", () => {
  it("throws on a row that has a commission column it cannot read", () => {
    expect(() =>
      parseAmazonTable([["Alguma Categoria", "quinze por cento %", "BRL 1,00"]]),
    ).toThrow(/unparseable/i);
  });

  it("a row narrower than the table's three columns is skipped, not guessed at", () => {
    // Layout rows (colspan notes, section separators) appear as short rows. Reading them as data
    // would invent categories; throwing on them would make an ordinary page break the whole run.
    expect(parseAmazonTable([["Nota de rodapé"], ["Categoria", "14%", "BRL 1,00"]])).toHaveLength(
      1,
    );
  });

  it("a minimum cell with no amount yields null, not zero", () => {
    // Zero would silently mean "no floor applies", which is a different and cheaper claim than
    // "this source does not state a floor".
    const [row] = parseAmazonTable([["Categoria", "14%", "não aplicável"]]);
    expect(row.minPerItem).toBeNull();
  });

  it("throws on a commission with no category", () => {
    expect(() => parseAmazonTable([["", "14%", "BRL 1,00"]])).toThrow(/no category/i);
  });
});
