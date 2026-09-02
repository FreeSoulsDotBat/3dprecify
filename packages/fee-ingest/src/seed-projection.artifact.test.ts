import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ehPodada, projectSeed, serializeSeed } from "./seed-projection.ts";
import type { CatalogJson } from "./slice.ts";

// 017/T009 · P0-a — a paridade semente↔artefato, RELACIONAL (decisão B.3, ADR-0029 §2).
//
// Ela mora aqui, e não em `apps/web`, por causa da fronteira do §H: `fee-ingest` não IMPORTA `apps/`
// nem `backend/` (regra `fee-ingest-is-standalone`, severity error) — mas LER um arquivo por `fs` não
// é importar, e é a mesma distinção que o desenho já fez para a auditoria de workflows (§I.2). Assim
// a relação é afirmada num lugar só, com a função de projeção ao lado da política que ela declara,
// sem inventar um acoplamento entre o bundle do browser e um pacote que só roda em CI.
//
// A relação (i) da decisão B é ESTA. As relações (ii)/(iii) — regex de versão, data casando
// `generatedAt`, `schemaVersion` igual dos dois lados — moram no truth-gate de
// `apps/web/src/shared/fee-catalog/fee-catalog.artifact.test.ts`, e a (iv) — o rótulo é o que
// `nextCatalogVersion` produziria — é provada no PONTO DE GERAÇÃO (`compose.test.ts`).

const ARTEFATO = new URL("../../../backend/app/data/catalog.json", import.meta.url);
const SEED = new URL("../../../apps/web/src/shared/fee-catalog/seed.data.json", import.meta.url);

const servido = JSON.parse(readFileSync(ARTEFATO, "utf8")) as CatalogJson;
const rawSeed = readFileSync(SEED, "utf8");
const seed = JSON.parse(rawSeed) as CatalogJson;

const secao = (c: CatalogJson, mk: string) =>
    (c.marketplaces as CatalogJson[]).find((m) => m.marketplace === mk)!;

describe("P0-a — a semente é a PROJEÇÃO do artefato servido, e nada além disso", () => {
    it("relação (i): `seed.data.json` é exatamente `projetarSemente(servido)`", () => {
        expect(seed).toEqual(projectSeed(servido));
    });

    it("e byte a byte — uma edição à mão da semente reprova aqui, não no mês que vem", () => {
        expect(rawSeed).toBe(serializeSeed(projectSeed(servido)));
    });

    it("os metadados viajam INTACTOS — nenhum rótulo é digitado duas vezes", () => {
        for (const campo of ["catalogVersion", "schemaVersion", "generatedAt"]) {
            expect(seed[campo]).toBe(servido[campo]);
        }
    });
});

describe("a POLÍTICA de poda, como propriedade e não como acidente curatorial", () => {
    it("a seção por CATEGORIA é podada: sem espinha, sem entradas", () => {
        const amazonServido = secao(servido, "AMAZON");
        const amazonSeed = secao(seed, "AMAZON");
        // a premissa, medida: o servido REALMENTE carrega o mapa que a semente não carrega
        expect((amazonServido.entries as unknown[]).length).toBeGreaterThan(70);
        expect(amazonServido.categorySpine).toBeDefined();
        expect(amazonSeed.entries).toEqual([]);
        expect(amazonSeed.categorySpine).toBeUndefined();
    });

    it("mas a CASCA fica — o marketplace continua existindo offline, com seus eixos", () => {
        const amazonSeed = secao(seed, "AMAZON");
        expect(amazonSeed.determinantsSchema).toEqual(secao(servido, "AMAZON").determinantsSchema);
        expect(amazonSeed.feeAxes).toEqual(secao(servido, "AMAZON").feeAxes);
    });

    it("a seção category-INDEPENDENTE viaja inteira, byte a byte", () => {
        // Este é o guarda que impede a poda de comer curadoria: `freightSubsidyInfo` e
        // `optionalSurcharges` são folhas do hotfix 016/A2 e do 016/US16, e nenhuma delas tem
        // equivalente no servido de outro marketplace para servir de rede.
        expect(JSON.stringify(secao(seed, "SHOPEE"))).toBe(
            JSON.stringify(secao(servido, "SHOPEE")),
        );
        expect(secao(seed, "SHOPEE").freightSubsidyInfo).toBeDefined();
        expect(secao(seed, "SHOPEE").optionalSurcharges).toBeDefined();
    });

    it("o critério é a FORMA da tabela (o eixo `category`), não uma lista de nomes", () => {
        expect(ehPodada({ determinantsSchema: { category: [], plan: [] } })).toBe(true);
        expect(ehPodada({ determinantsSchema: { sellerProfile: [] } })).toBe(false);
        expect(ehPodada({})).toBe(false);
        expect(ehPodada({ determinantsSchema: null })).toBe(false);
    });

    it("a poda é o orçamento de boot: a semente é uma fração do servido (SC-810)", () => {
        expect(rawSeed.length).toBeLessThan(readFileSync(ARTEFATO, "utf8").length / 4);
    });
});

describe("projetarSemente — idempotente, e é isso que dá ponto fixo ao `fee:build`", () => {
    it("projetar uma projeção devolve a mesma projeção", () => {
        const uma = projectSeed(servido);
        expect(projectSeed(uma)).toEqual(uma);
    });

    it("um documento sem `marketplaces` não estoura — devolve lista vazia", () => {
        expect(projectSeed({ catalogVersion: "x" })).toEqual({
            catalogVersion: "x",
            marketplaces: [],
        });
    });
});
