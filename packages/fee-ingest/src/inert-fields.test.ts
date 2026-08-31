import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { INERT_FIELDS, isInerte } from "./inert-fields.ts";

// 017/T007 (fecha 014/U4-f) — UMA lista de campos inertes, UM lugar.
//
// Ela existia duas vezes, com os mesmos três nomes: `refresh.ts:INERT` (que decide o que entra na
// TABELA do corpo do PR) e `catalog-diff.ts:INERT_PATHS` (que decide `freshnessOnly`, de onde sai a
// dispensa de revisão). Duas cópias de uma regra de dinheiro que ninguém obriga a andarem juntas: um
// campo novo acrescentado a uma só produz um PR que diz "sem mudança de tarifa" e mesmo assim é
// elegível a dispensa — ou o contrário, que é pior.

const SRC = fileURLToPath(new URL("./", import.meta.url));

describe("INERT_FIELDS — a lista única", () => {
    it("carrega exatamente os campos que não são dinheiro nem cobertura", () => {
        expect([...INERT_FIELDS].sort()).toEqual(["catalogVersion", "generatedAt", "lastReviewed"]);
    });

    it("`isInerte` reconhece cada um deles, e recusa uma folha de dinheiro", () => {
        for (const campo of INERT_FIELDS) expect(isInerte(campo)).toBe(true);
        expect(isInerte("commissionPct")).toBe(false);
        // `effectiveDate` NÃO é inerte, e a distinção é a razão de o par existir: `lastReviewed` diz
        // "alguém conferiu"; `effectiveDate` diz "a partir de quando a tarifa vale" — a segunda muda
        // dinheiro no tempo e nunca pode passar por baixo de uma revisão humana.
        expect(isInerte("effectiveDate")).toBe(false);
    });
});

describe("as duas listas antigas deixaram de existir (a migração não é um alias)", () => {
    const fontes = readdirSync(SRC)
        .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "inert-fields.ts")
        .map((f) => ({ f, texto: readFileSync(`${SRC}${f}`, "utf8") }));

    it("nenhum módulo declara `const INERT`/`INERT_PATHS` próprio", () => {
        const declaracoes = fontes
            .filter(({ texto }) => /^\s*(?:export\s+)?const\s+INERT(_PATHS)?\s*=/m.test(texto))
            .map(({ f }) => f);
        expect(declaracoes).toEqual([]);
    });

    it("os DOIS consumidores importam a lista única", () => {
        for (const alvo of ["refresh.ts", "catalog-diff.ts"]) {
            const texto = fontes.find((x) => x.f === alvo)!.texto;
            expect(texto).toContain("./inert-fields.ts");
        }
    });
});
