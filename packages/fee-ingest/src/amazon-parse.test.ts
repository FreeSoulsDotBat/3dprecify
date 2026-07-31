import { describe, expect, it } from "vitest";

import { CANARIES, CATCH_ALL_NAME, parseAmazonTable, readCommissionCell } from "./amazon-parse";

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

describe("readCommissionCell — the boundary, tested from BOTH sides", () => {
  const cell = readCommissionCell(`15% até BRL${NB}100,00 10% acima de R$${NB}100,00`);
  const bands = cell.kind === "BANDED" ? cell.bands : [];

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
    expect(readCommissionCell("14%")).toEqual({ kind: "FLAT", commissionPct: 14 });
  });

  // If the page ever states the two thresholds differently, the cell shape changed. Guessing which
  // one is right would be inventing money, so the parser refuses instead.
  it("refuses a cell whose two thresholds disagree", () => {
    expect(readCommissionCell(`15% até BRL${NB}100,00 10% acima de BRL${NB}200,00`).kind).toBe(
      "UNRECOGNISED",
    );
  });
});

// 014/T089 (A4, FR-014c) — a recusa tem de SOBREVIVER até a saída.
//
// O teste acima existia e passava, e o defeito estava vivo assim mesmo: `parseBands` devolvia `null`
// tanto para "isto não é banda" quanto para "isto PARECE banda e eu me recuso a ler", e a linha
// seguinte de `parseAmazonTable` chamava `parsePct` na mesma célula. A recusa era desfeita um passo
// abaixo, e a categoria saía com a PRIMEIRA alíquota da célula como se fosse a única. Uma célula com
// limiares divergentes virava "15% fixo" — publicado sob selo de "Referência", no laço mensal, sem
// ninguém para notar.
describe("FR-014c — célula não reconhecida é falha da categoria, nunca a primeira alíquota", () => {
  const linha = (cell: string) => [["Alguma Categoria", cell, `BRL${NB}1,00`]];

  it("limiares divergentes: FALHA — e o 15% da célula não vaza para o resultado", () => {
    const cell = `15% até BRL${NB}100,00 10% acima de BRL${NB}200,00`;
    expect(() => parseAmazonTable(linha(cell))).toThrow(/unparseable/i);
  });

  it("redação alternativa ('excedente'): FALHA, não 15% fixo", () => {
    const cell = `15% para os primeiros R$${NB}200,00 e 10% para o excedente`;
    expect(() => parseAmazonTable(linha(cell))).toThrow(/unparseable/i);
  });

  it("TRÊS faixas: FALHA — a estrutura publicada deixou de ser a que este parser conhece", () => {
    const cell = `15% até BRL${NB}100,00 12% até BRL${NB}200,00 10% acima de BRL${NB}200,00`;
    expect(() => parseAmazonTable(linha(cell))).toThrow(/unparseable/i);
  });

  it("um limiar sem o par ('até' sem 'acima de'): FALHA", () => {
    expect(() => parseAmazonTable(linha(`15% até BRL${NB}100,00`))).toThrow(/unparseable/i);
  });

  it("ordem invertida é LIDA, não recusada — a célula continua sem ambiguidade", () => {
    // Recusar aqui seria zelo sem causa: as duas metades estão presentes e concordam. O que não pode
    // acontecer é virar 10% fixo (a primeira alíquota da célula nessa ordem).
    const cell = `10% acima de R$${NB}100,00 15% até BRL${NB}100,00`;
    const [row] = parseAmazonTable(linha(cell));
    expect(row.commissionPct).toBeNull();
    expect(row.bands).toEqual([
      { minPrice: 0, maxPrice: 100, commissionPct: 15 },
      { minPrice: 100, maxPrice: null, commissionPct: 10 },
    ]);
  });

  it("a célula simples de sempre continua sendo lida como alíquota única", () => {
    const [row] = parseAmazonTable(linha("14%"));
    expect(row).toMatchObject({ commissionPct: 14, bands: null });
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
