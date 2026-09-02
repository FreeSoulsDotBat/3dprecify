import { describe, expect, it } from "vitest";

import { compose } from "./compose.ts";
import type { CatalogSlice } from "./slice.ts";
import type { CollectorVerdict } from "./verdict.ts";

// 017/T008 (ADR-0028 §4/§5, desenho §C.2/§B.3) — a COMPOSIÇÃO: a única coisa que escreve.
//
// Duas propriedades estruturais moram aqui, e nenhuma delas é um `if` que se possa esquecer:
//  · fatia reprovada é DESCARTADA e vira veredito ABORTADO — o PR parcial da clarify Q4 expresso por
//    TIPO, e não por uma condição no meio do orquestrador;
//  · `RunOutcome` tem 2 casos, e o catálogo composto só EXISTE dentro do caso PR. Não há como
//    escrever a partir de um SEM_PR porque o valor a escrever não está lá (FR-020a em dois níveis).

// O caso sobre o ARTEFATO REAL (fatia vazia ⇒ SEM_PR) vive em `catalog-artifact.artifact.test.ts`:
// ele LÊ o artefato, e a convenção da decisão D é que quem lê o artefato roda dentro do
// `gate:artifact` — o gate do PR mensal.

const entrada = (category: string, pct: number) => ({
    determinants: { plan: "PROFISSIONAL", category },
    commissionPct: pct,
    lastReviewed: "2026-07-28",
});

/** Uma base sintética com as 3 seções da cobertura — controlável linha a linha. */
const baseSintetica = (amazonEntries: unknown[] = [entrada("calcados", 14)]) => ({
    catalogVersion: "2026-08-07.0",
    schemaVersion: "1",
    generatedAt: "2026-08-07T00:00:00.000Z",
    marketplaces: [
        { marketplace: "AMAZON", categorySpine: [], entries: amazonEntries },
        { marketplace: "MERCADO_LIVRE", entries: [] },
        { marketplace: "SHOPEE", entries: [{ determinants: null, commissionPct: 20 }] },
    ],
});

const lido = (
    marketplace: string,
    leaves: CatalogSlice["leaves"],
    exhaustive: CatalogSlice["exhaustive"] = [],
): CollectorVerdict => ({
    kind: "LIDO",
    marketplace: marketplace as "AMAZON",
    collectedAt: "2026-09-01",
    sourceUrl: `https://fonte/${marketplace}`,
    slice: {
        marketplace,
        leaves,
        exhaustive,
        collectedAt: "2026-09-01",
        sourceUrl: `https://fonte/${marketplace}`,
    },
});

const padrao = {
    collectedAt: "2026-09-01",
    generatedAt: "2026-09-01T06:00:00.000Z",
    vigias: [],
    dispensaPermitida: false,
    arquivosDoPr: ["backend/app/data/catalog.json"],
};

describe("compor — SEM_PR: nada leu, nada mudou, nada a publicar", () => {
    it("0 fatias admitidas + 0 vigias ⇒ SEM_PR com motivo (data-model §7)", () => {
        const r = compose({ ...padrao, base: baseSintetica(), vereditos: [] });
        expect(r.kind).toBe("SEM_PR");
        expect(r.kind === "SEM_PR" && r.motivo).toMatch(/nada/i);
    });

    it("SEM_PR não carrega catálogo — não existe valor a escrever (FR-020a por tipo)", () => {
        const r = compose({ ...padrao, base: baseSintetica(), vereditos: [] });
        expect(Object.keys(r)).toEqual(["kind", "motivo"]);
    });

    it("todos ABORTADOS também ⇒ SEM_PR, e o artefato fica intocado (I2/SC-806)", () => {
        const r = compose({
            ...padrao,
            base: baseSintetica(),
            vereditos: [
                {
                    kind: "ABORTADO",
                    marketplace: "AMAZON",
                    reason: "casca de SPA",
                    sourceUrl: "https://fonte/AMAZON",
                },
            ],
        });
        expect(r.kind).toBe("SEM_PR");
    });
});

describe("compor — PONTO FIXO: um mês sem mudança de fonte não move um byte", () => {
    it("fatia que reescreve os MESMOS valores ⇒ catálogo byte-idêntico, versão e generatedAt PARADOS", () => {
        const base = baseSintetica();
        const r = compose({
            ...padrao,
            base,
            vereditos: [
                lido("AMAZON", [
                    {
                        level: "ENTRY",
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        field: "commissionPct",
                        value: 14,
                    },
                ]),
            ],
        });
        // Nada mudou nem em dinheiro nem em data: não há PR a abrir.
        expect(r.kind).toBe("SEM_PR");
    });
});

describe("compor — UM bump por EXECUÇÃO (decisão B.3), nunca um por coletor", () => {
    it("2 fatias admitidas na mesma data ⇒ EXATAMENTE 1 incremento de catalogVersion", () => {
        const r = compose({
            ...padrao,
            base: baseSintetica(),
            vereditos: [
                lido("AMAZON", [
                    {
                        level: "ENTRY",
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        field: "commissionPct",
                        value: 16,
                    },
                ]),
                lido("SHOPEE", [
                    { level: "ENTRY", determinants: null, field: "commissionPct", value: 21 },
                ]),
            ],
        });
        expect(r.kind).toBe("PR");
        const cat = r.kind === "PR" ? r.catalog : {};
        // base era "2026-08-07.0"; a coleta é 2026-09-01 ⇒ data nova ⇒ ".0" da data nova, UMA vez.
        expect(cat.catalogVersion).toBe("2026-09-01.0");
        expect(cat.generatedAt).toBe("2026-09-01T06:00:00.000Z");
    });

    it("as DUAS fatias entraram — a segunda não apagou a primeira (o defeito §C.1)", () => {
        const r = compose({
            ...padrao,
            base: baseSintetica(),
            vereditos: [
                lido("AMAZON", [
                    {
                        level: "ENTRY",
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        field: "commissionPct",
                        value: 16,
                    },
                ]),
                lido("SHOPEE", [
                    { level: "ENTRY", determinants: null, field: "commissionPct", value: 21 },
                ]),
            ],
        });
        const mks = (r.kind === "PR" ? r.catalog.marketplaces : []) as Record<string, unknown>[];
        const amazon = mks.find((m) => m.marketplace === "AMAZON")!;
        const shopee = mks.find((m) => m.marketplace === "SHOPEE")!;
        expect((amazon.entries as Record<string, unknown>[])[0]!.commissionPct).toBe(16);
        expect((shopee.entries as Record<string, unknown>[])[0]!.commissionPct).toBe(21);
    });

    it("a ordem de chegada dos vereditos não muda o resultado (aplicação alfabética)", () => {
        const fatias = [
            lido("SHOPEE", [
                { level: "ENTRY", determinants: null, field: "commissionPct", value: 21 },
            ]),
            lido("AMAZON", [
                {
                    level: "ENTRY",
                    determinants: { plan: "PROFISSIONAL", category: "calcados" },
                    field: "commissionPct",
                    value: 16,
                },
            ]),
        ];
        const a = compose({ ...padrao, base: baseSintetica(), vereditos: fatias });
        const b = compose({ ...padrao, base: baseSintetica(), vereditos: [...fatias].reverse() });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it("só data de reverificação avançou ⇒ PR (prova de vida), mas SEM bump de versão", () => {
        const r = compose({
            ...padrao,
            base: baseSintetica(),
            vereditos: [
                lido("AMAZON", [
                    {
                        level: "ENTRY",
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        field: "lastReviewed",
                        value: "2026-09-01",
                    },
                ]),
            ],
        });
        expect(r.kind).toBe("PR");
        expect(r.kind === "PR" && r.catalog.catalogVersion).toBe("2026-08-07.0");
        expect(r.kind === "PR" && r.body).toContain("Sem mudança de tarifa");
    });
});

describe("compor — fatia REPROVADA vira ABORTADO, e o PR sai PARCIAL (clarify Q4)", () => {
    // 40 entradas, e a fatia move 21 delas: acima do teto de 50% com ≥10 entradas.
    const muitas = Array.from({ length: 40 }, (_, i) => entrada(`cat-${i}`, 14));
    const sliceInBlock = Array.from({ length: 21 }, (_, i) => ({
        level: "ENTRY" as const,
        determinants: { plan: "PROFISSIONAL", category: `cat-${i}` },
        field: "commissionPct",
        value: 19,
    }));

    const r = compose({
        ...padrao,
        base: baseSintetica(muitas),
        vereditos: [
            lido("AMAZON", sliceInBlock),
            lido("SHOPEE", [
                { level: "ENTRY", determinants: null, field: "commissionPct", value: 21 },
            ]),
        ],
    });

    it("a fatia reprovada é DESCARTADA — o artefato não recebe meia leitura", () => {
        expect(r.kind).toBe("PR");
        const mks = (r.kind === "PR" ? r.catalog.marketplaces : []) as Record<string, unknown>[];
        const amazon = mks.find((m) => m.marketplace === "AMAZON")!;
        expect((amazon.entries as Record<string, unknown>[])[0]!.commissionPct).toBe(14);
    });

    it("e o veredito dela vira ABORTADO com o motivo do teto — no corpo do PR", () => {
        expect(r.kind === "PR" && r.body).toContain("ABORTADO");
        expect(r.kind === "PR" && r.body).toMatch(/acima do teto/);
    });

    it("a outra fatia entrou assim mesmo — é isso que 'PR parcial' quer dizer", () => {
        const mks = (r.kind === "PR" ? r.catalog.marketplaces : []) as Record<string, unknown>[];
        const shopee = mks.find((m) => m.marketplace === "SHOPEE")!;
        expect((shopee.entries as Record<string, unknown>[])[0]!.commissionPct).toBe(21);
    });

    it("uma fatia que nem se APLICA (seção inexistente) também vira ABORTADO, não exceção", () => {
        const semShopee = {
            ...baseSintetica(),
            marketplaces: [{ marketplace: "AMAZON", categorySpine: [], entries: [] }],
        };
        const out = compose({
            ...padrao,
            base: semShopee,
            vereditos: [
                lido("SHOPEE", [
                    { level: "ENTRY", determinants: null, field: "commissionPct", value: 21 },
                ]),
            ],
        });
        expect(out.kind).toBe("SEM_PR");
    });
});

describe("compor — o PR de DECISÃO e a dispensa (Q2/Q5)", () => {
    const decisao = {
        titulo: "a página e a constante discordam",
        fonteA: { label: "página", valor: "R$ 2,50", url: "https://venda.amazon.com.br/precos" },
        fonteB: { label: "servido", valor: "R$ 2,00", url: "https://fonte/AMAZON" },
        autoDatacao: null,
    };

    it("com decisão pendente, o TÍTULO ganha o prefixo e a dispensa é forçada a NÃO", () => {
        const r = compose({
            ...padrao,
            dispensaPermitida: true,
            base: baseSintetica(),
            vereditos: [
                lido("AMAZON", [
                    {
                        level: "ENTRY",
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        field: "lastReviewed",
                        value: "2026-09-01",
                    },
                ]),
            ],
            decisao,
        });
        expect(r.kind).toBe("PR");
        expect(r.kind === "PR" && r.titulo.startsWith("DECISÃO — ")).toBe(true);
        expect(r.kind === "PR" && r.decisaoDoDono).toBe(true);
        expect(r.kind === "PR" && r.exemption).toBe(false);
    });

    it("sem decisão, o título é o normal e a dispensa segue o classificador", () => {
        const r = compose({
            ...padrao,
            dispensaPermitida: true,
            base: baseSintetica(),
            vereditos: [
                lido("AMAZON", [
                    {
                        level: "ENTRY",
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        field: "lastReviewed",
                        value: "2026-09-01",
                    },
                ]),
            ],
        });
        expect(r.kind === "PR" && r.titulo.startsWith("DECISÃO")).toBe(false);
        expect(r.kind === "PR" && r.exemption).toBe(true);
        expect(r.kind === "PR" && r.decisaoDoDono).toBe(false);
    });

    it("um vigia com notícia abre PR mesmo com o catálogo INTACTO (decisão E.3)", () => {
        const r = compose({
            ...padrao,
            base: baseSintetica(),
            vereditos: [],
            vigias: [
                {
                    fonte: "Amazon /precos",
                    sourceUrl: "https://venda.amazon.com.br/precos",
                    resumo: "a página publica R$ 2,50",
                },
            ],
        });
        expect(r.kind).toBe("PR");
        expect(r.kind === "PR" && r.body).toContain("## Vigias (nenhum dado alterado)");
        expect(r.kind === "PR" && r.catalog.catalogVersion).toBe("2026-08-07.0");
    });
});
