import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { aplicarFatia } from "./slice.ts";

// §C.2-bis — EXAUSTIVIDADE DECLARADA: a outra metade da regra da folha lida.
//
// A folha lida só sabe acrescentar e atualizar. Sem contrapeso, o artefato acumularia fantasmas —
// e, pior que acumular, carimbaria `lastReviewed` fresco numa entrada que a fonte deixou de
// publicar: o selo diria "reverificada hoje" sobre uma categoria que não existe mais (I3 e I5
// quebradas de uma vez, sob referência). O contrapeso não é confiado, é CONFERIDO.

const base = JSON.parse(
    readFileSync(new URL("../../../backend/app/data/catalog.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const secaoDe = (cat: Record<string, unknown>, mk: string) =>
    (cat.marketplaces as Record<string, unknown>[]).find((m) => m.marketplace === mk)!;

const amazonBase = {
    marketplaces: [
        {
            marketplace: "AMAZON",
            categorySpine: [
                { id: "calcados", name: "Calçados", parentId: null },
                { id: "colchoes", name: "Colchões", parentId: null },
            ],
            entries: [
                { determinants: { plan: "PROFISSIONAL", category: "calcados" }, commissionPct: 14 },
                { determinants: { plan: "PROFISSIONAL", category: "colchoes" }, commissionPct: 15 },
            ],
        },
    ],
};

describe("regra 1 — sem declaração, a base vence e NADA some", () => {
    it("Shopee com `exhaustive: []` sobre uma base COM duas entradas ⇒ as duas ficam", () => {
        const r = aplicarFatia(base, {
            marketplace: "SHOPEE",
            collectedAt: "2026-09-01",
            sourceUrl: "https://exemplo",
            exhaustive: [],
            leaves: [{ level: "ENTRY", determinants: null, field: "commissionPct", value: 21 }],
        });
        expect(r.ok).toBe(true);
        // a fatia endereçou UMA das duas; a irmã continua lá porque silêncio não é remoção
        expect(secaoDe(r.ok ? r.catalog : base, "SHOPEE").entries).toHaveLength(2);
    });
});

describe("regra 2 — declarada, a ausência REMOVE", () => {
    const semColchoes = aplicarFatia(amazonBase, {
        marketplace: "AMAZON",
        collectedAt: "2026-09-01",
        sourceUrl: "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920",
        exhaustive: ["entries", "categorySpine"],
        leaves: [
            {
                level: "ENTRY",
                determinants: { plan: "PROFISSIONAL", category: "calcados" },
                field: "commissionPct",
                value: 14,
            },
            {
                level: "MARKETPLACE",
                field: "categorySpine",
                value: [{ id: "calcados", name: "Calçados", parentId: null }],
            },
        ],
    });
    const amazonDepois = () => secaoDe(semColchoes.ok ? semColchoes.catalog : {}, "AMAZON");

    it("a entrada ausente da leitura EXAUSTIVA some do artefato", () => {
        expect(semColchoes.ok).toBe(true);
        const entradas = amazonDepois().entries as Record<string, unknown>[];
        expect(entradas).toHaveLength(1);
        expect(entradas[0]!.determinants).toEqual({ plan: "PROFISSIONAL", category: "calcados" });
    });

    it("e o nó correspondente sai da espinha (é o que faz `removedCategories` funcionar)", () => {
        expect((amazonDepois().categorySpine as { id: string }[]).map((n) => n.id)).toEqual([
            "calcados",
        ]);
    });

    it("a entrada que a fatia endereçou continua sob a regra da folha lida", () => {
        expect((amazonDepois().entries as Record<string, unknown>[])[0]!.commissionPct).toBe(14);
    });
});

describe("AS DUAS FECHADURAS sobre o hotfix A2", () => {
    // `SectionKey` não representa bloco de nível de marketplace, então nem escrevendo
    // `exhaustive: ["freightSubsidyInfo"]` alguém autoriza aquela remoção — não há como dizê-lo. Esta
    // é a SEGUNDA fechadura: mesmo com `entries` declarada exaustiva (a declaração mais agressiva que
    // a Shopee poderia fazer), a curadoria de nível de marketplace fica intacta.
    const exaustivaNaShopee = aplicarFatia(base, {
        marketplace: "SHOPEE",
        collectedAt: "2026-09-01",
        sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
        exhaustive: ["entries"],
        leaves: [
            { level: "ENTRY", determinants: null, field: "commissionPct", value: 20 },
            {
                level: "ENTRY",
                determinants: { sellerProfile: "CPF_ALTO_VOLUME" },
                field: "commissionPct",
                value: 20,
            },
        ],
    });
    const depois = () => secaoDe(exaustivaNaShopee.ok ? exaustivaNaShopee.catalog : base, "SHOPEE");

    it("`freightSubsidyInfo` e `optionalSurcharges` seguem byte-idênticos sob declaração exaustiva", () => {
        const antes = secaoDe(base, "SHOPEE");
        expect(JSON.stringify(depois().freightSubsidyInfo)).toBe(
            JSON.stringify(antes.freightSubsidyInfo),
        );
        expect(JSON.stringify(depois().optionalSurcharges)).toBe(
            JSON.stringify(antes.optionalSurcharges),
        );
        expect(antes.freightSubsidyInfo).toBeDefined();
        expect(antes.optionalSurcharges).toBeDefined();
    });

    it("e o `freight: NONE` de cada entrada remanescente também (a folha não lida vem da base)", () => {
        for (const e of depois().entries as Record<string, unknown>[]) {
            expect(e.freight).toEqual({ kind: "NONE" });
        }
    });
});

describe("regras 3 e 4 — a declaração não pode virar faca", () => {
    it("declarar `entries` exaustiva sem endereçar entrada nenhuma é RECUSADO", () => {
        const r = aplicarFatia(amazonBase, {
            marketplace: "AMAZON",
            collectedAt: "2026-09-01",
            sourceUrl: "https://exemplo",
            exhaustive: ["entries"],
            leaves: [],
        });
        expect(r.ok).toBe(false);
        expect(r.ok === false && r.reason).toMatch(/apagaria a seção inteira/);
    });

    it("reescrever `categorySpine` SEM declará-la exaustiva é RECUSADO", () => {
        const r = aplicarFatia(amazonBase, {
            marketplace: "AMAZON",
            collectedAt: "2026-09-01",
            sourceUrl: "https://exemplo",
            exhaustive: ["entries"],
            leaves: [
                {
                    level: "ENTRY",
                    determinants: { plan: "PROFISSIONAL", category: "calcados" },
                    field: "commissionPct",
                    value: 14,
                },
                { level: "MARKETPLACE", field: "categorySpine", value: [] },
            ],
        });
        expect(r.ok).toBe(false);
        expect(r.ok === false && r.reason).toMatch(/remoção exige declaração/);
    });

    it("declarar `categorySpine` exaustiva sem escrevê-la é RECUSADO", () => {
        const r = aplicarFatia(amazonBase, {
            marketplace: "AMAZON",
            collectedAt: "2026-09-01",
            sourceUrl: "https://exemplo",
            exhaustive: ["categorySpine"],
            leaves: [
                {
                    level: "ENTRY",
                    determinants: { plan: "PROFISSIONAL", category: "calcados" },
                    field: "commissionPct",
                    value: 14,
                },
            ],
        });
        expect(r.ok).toBe(false);
        expect(r.ok === false && r.reason).toMatch(/declaração sem leitura/);
    });

    it("PONTO FIXO sob exaustividade: a fatia COMPLETA devolve o documento byte-idêntico", () => {
        const r = aplicarFatia(amazonBase, {
            marketplace: "AMAZON",
            collectedAt: "2026-09-01",
            sourceUrl: "https://exemplo",
            exhaustive: ["entries", "categorySpine"],
            leaves: [
                {
                    level: "ENTRY",
                    determinants: { plan: "PROFISSIONAL", category: "calcados" },
                    field: "commissionPct",
                    value: 14,
                },
                {
                    level: "ENTRY",
                    determinants: { plan: "PROFISSIONAL", category: "colchoes" },
                    field: "commissionPct",
                    value: 15,
                },
                {
                    level: "MARKETPLACE",
                    field: "categorySpine",
                    value: amazonBase.marketplaces[0]!.categorySpine,
                },
            ],
        });
        expect(r.ok).toBe(true);
        expect(JSON.stringify(r.ok ? r.catalog : null)).toBe(JSON.stringify(amazonBase));
    });
});
