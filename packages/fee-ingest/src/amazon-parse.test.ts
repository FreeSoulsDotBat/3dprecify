import { describe, expect, it } from "vitest";

import { CANARIES, CATCH_ALL_NAME, parseAmazonTable, readCommissionCell } from "./amazon-parse";
import { checkParseSanity } from "./guardrails";

// Fixtures are the REAL cells, captured from the live table on 2026-07-28 — including the
// non-breaking spaces. Writing these from imagination would have missed all three traps below.
const NB = String.fromCharCode(0xa0);
const ROWS: string[][] = [
    ["Categorias", "Porcentagens de comissão", "Comissão mínima aplicável"],
    ["Roupas e Acessórios", "14%", `BRL${NB}1,00`],
    ["Relógios", "13%", `BRL${NB}1,00`],
    // TRAP: footnote digit glued to the name, and the SAME cell mixing "BRL" and "R$".
    [
        "Acessórios Eletrônicos1",
        `15% até BRL${NB}100,00 10% acima de R$${NB}100,00`,
        `BRL${NB}1,00`,
    ],
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
        expect(
            parseAmazonTable([["Nota de rodapé"], ["Categoria", "14%", "BRL 1,00"]]),
        ).toHaveLength(1);
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

// 014/T102 [US4] — o fail-safe que a US4 precisa que seja verdade, e hoje nao e.
//
// A leitura das colunas e POSICIONAL (`[nome, pct, min]`) e a guarda aceita `row.length >= 3`. Basta
// a Amazon inserir uma coluna — "Taxa de fechamento", por exemplo — para o `minPerItem` passar a ser
// lido da coluna errada. E a canaria so confere a COMISSAO, entao o deslocamento que preserva o
// percentual e zera todo `minPerItem` sai com `ok: true`: numeros plausiveis, todos errados, sob selo
// de referencia. E a familia de falha que o SC-806 existe para pegar.
describe("uma coluna inserida na fonte nao pode sair como sucesso (T102)", () => {
    const TRES = [
        ["Categoria", "Comissao", "Minimo"],
        ["Roupas e Acessórios", "14%", "R$ 1,00"],
        ["Calçados", "14%", "R$ 1,00"],
    ];
    const QUATRO = [
        ["Categoria", "Comissao", "Taxa de fechamento", "Minimo"],
        ["Roupas e Acessórios", "14%", "R$ 0,00", "R$ 1,00"],
        ["Calçados", "14%", "R$ 0,00", "R$ 1,00"],
    ];

    it("a tabela de 3 colunas continua lendo o minimo por item", () => {
        const cats = parseAmazonTable(TRES);
        expect(cats.every((c) => c.minPerItem === 1)).toBe(true);
    });

    it("ARIDADE: uma quarta coluna e recusada como mudanca de FORMA, nao lida torto", () => {
        expect(() => parseAmazonTable(QUATRO)).toThrow(/coluna|column|forma|shape/i);
    });

    // A segunda metade: mesmo que a aridade passasse, a canaria tem de olhar o PAR. Um deslocamento
    // que preserva 14% e zera o minimo e exatamente o que a canaria so-de-comissao deixava passar.
    it("CANARIA: comissao certa com minimo zerado NAO e sucesso", () => {
        const deslocado = [
            { name: "Roupas e Acessórios", commissionPct: 14, bands: null, minPerItem: 0 },
            { name: "Calçados", commissionPct: 14, bands: null, minPerItem: 0 },
        ];
        const v = checkParseSanity(deslocado, {
            minRows: 2,
            canaries: [["Roupas e Acessórios", 14, 1]],
        });
        expect(v.ok).toBe(false);
        expect(v.ok === false && v.reason).toMatch(/wrong column|coluna/i);
    });

    it("e o par correto continua passando", () => {
        const bom = [
            { name: "Roupas e Acessórios", commissionPct: 14, bands: null, minPerItem: 1 },
        ];
        expect(
            checkParseSanity(bom, { minRows: 1, canaries: [["Roupas e Acessórios", 14, 1]] }),
        ).toEqual({ ok: true });
    });
});

// U4-b (follow-up ALTO) — a T102 fechou a coluna A MAIS e deixou aberta a coluna A MENOS.
// `row.length < 3` descarta a linha CURTA em SILENCIO, antes da guarda de aridade. E a mensagem de
// erro da guarda promete `"a column was inserted or removed"` quando o caso "removed" e inalcancavel
// — a copia afirmando uma cobertura que o codigo nao tem.
//
// Uma coluna removida faz TODA linha de dado virar curta: o parse encolhe para zero e cai no
// MIN_ROWS. Detectado, sim — mas como "a fonte encolheu", que e o diagnostico errado e manda o
// operador procurar categorias que a Amazon nao apagou.
describe("a coluna A MENOS tambem e mudanca de FORMA, e nao encolhimento (U4-b)", () => {
    it("linha que PARECE dado e tem menos de 3 colunas e recusada, nao pulada", () => {
        const duasColunas = [
            ["Categoria", "Comissao"],
            ["Roupas e Acessórios", "14%"],
            ["Calçados", "14%"],
        ];
        expect(() => parseAmazonTable(duasColunas)).toThrow(/coluna|column/i);
    });

    it("linha curta que NAO parece dado (cabecalho, nota) continua sendo pulada em silencio", () => {
        const comNota = [
            ["Tabela de comissoes"],
            ["Categoria", "Comissao", "Minimo"],
            ["Calçados", "14%", "R$ 1,00"],
        ];
        expect(parseAmazonTable(comNota)).toHaveLength(1);
    });
});

// Regressao que a U4-b introduziu e a lente que EXECUTA achou (2026-08-01): a guarda olhava
// "qualquer celula com %", entao uma NOTA DE RODAPE numa celula so — que a Amazon publica — matava o
// laco mensal com a mensagem falsa "a column was REMOVED". Falha fechada, sim, mas com o diagnostico
// errado, e o unico sintoma seria o robo parar de rodar mandando procurar a coisa errada.
describe("nota de rodape com % nao e coluna faltando (regressao da U4-b)", () => {
    const dados = [
        ["Categoria", "Comissao", "Minimo"],
        ["Calçados", "14%", "R$ 1,00"],
    ];

    it("uma linha de PROSA com percentual e pulada, nao mata o laco", () => {
        const comNota = [
            dados[0],
            ["Comissao de 15% sobre o valor total do pedido, incluindo frete"],
            dados[1],
        ];
        expect(() => parseAmazonTable(comNota)).not.toThrow();
        expect(parseAmazonTable(comNota)).toHaveLength(1);
    });

    it("mas a linha de DADO com uma coluna a menos continua sendo recusada", () => {
        expect(() =>
            parseAmazonTable([
                ["Categoria", "Comissao"],
                ["Calçados", "14%"],
            ]),
        ).toThrow(/coluna|column/i);
    });
});
