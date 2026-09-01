import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { ParsedCategory } from "./amazon-parse.ts";
import {
    AMAZON_EXHAUSTIVE,
    evaluateAmazonCollection,
    amazonSlice,
    amazonVerdict,
    previousEffectiveDates,
} from "./amazon-collector.ts";
import { AMAZON_INDIVIDUAL_FEE_SOURCE } from "./amazon-to-catalog.ts";
import { collectedAtFor } from "./guardrails.ts";
import { applySlice } from "./slice.ts";

// 017/T014 — o coletor Amazon como EMISSOR DE FATIA.
//
// A fixture é o PRÓPRIO ARTEFATO commitado, reconstruído em leitura — a mesma técnica do
// `artifact-fixed-point`, e pela mesma razão: uma fixture escrita à mão prova o que alguém lembrou
// de transcrever, e o que precisa ser provado é que a MIGRAÇÃO de writer para emissor não move um
// byte do dado publicado.

const artefato = JSON.parse(
    readFileSync(new URL("../../../backend/app/data/catalog.json", import.meta.url), "utf8"),
) as Record<string, unknown>;

const secao = (c: Record<string, unknown>, mk: string) =>
    (c.marketplaces as Record<string, unknown>[]).find((m) => m.marketplace === mk)!;

const amazon = secao(artefato, "AMAZON");

/** Reconstrói a leitura da tabela a partir do artefato — nome vem da espinha, o resto da entrada. */
function leituraDoArtefato(): ParsedCategory[] {
    const nomes = new Map(
        (amazon.categorySpine as { id: string; name: string }[]).map((n) => [n.id, n.name]),
    );
    const vistas = new Set<string>();
    const out: ParsedCategory[] = [];
    for (const e of amazon.entries as Record<string, unknown>[]) {
        const id = (e.determinants as Record<string, string> | null)?.category;
        if (id === undefined || vistas.has(id)) continue;
        vistas.add(id);
        out.push({
            name: nomes.get(id)!,
            commissionPct: e.commissionPct as number,
            bands: e.priceBands as ParsedCategory["bands"],
            minPerItem: e.minPerItem as number,
        });
    }
    return out;
}

const categories = leituraDoArtefato();
const DATA = (amazon.entries as Record<string, unknown>[])[0]!.lastReviewed as string;

const collection = {
    categories,
    collectedAt: DATA,
    previousEffectiveDates: previousEffectiveDates(amazon),
};

describe("o coletor NUNCA escreve — ele emite fatia e veredito", () => {
    it("o módulo não exporta nada que receba um caminho de arquivo ou escreva no disco", async () => {
        const module_ = await import("./amazon-collector.ts");
        expect(Object.keys(module_).sort()).toEqual([
            "AMAZON_EXHAUSTIVE",
            "amazonSlice",
            "amazonVerdict",
            "evaluateAmazonCollection",
            "previousEffectiveDates",
        ]);
    });

    it("a fatia declara `entries`+`categorySpine` exaustivas — a Amazon lê a página inteira ou nada", () => {
        expect(amazonSlice(collection).exhaustive).toEqual([...AMAZON_EXHAUSTIVE]);
    });

    it("e aponta para a fonte publicada, com a data da releitura", () => {
        const f = amazonSlice(collection);
        expect(f.sourceUrl).toContain("G200336920");
        expect(f.collectedAt).toBe(DATA);
    });
});

describe("vigenciasAnteriores — a MEMÓRIA da vigência (T101)", () => {
    it("lê as vigências que o artefato já carrega", () => {
        expect(previousEffectiveDates(amazon).size).toBeGreaterThan(0);
    });

    it("uma seção sem `entries` devolve mapa vazio, em vez de estourar", () => {
        // Não é hipótese: é o estado de um marketplace que o laço ainda não coletou (o ML tem `entries`
        // vazio hoje), e um coletor que morresse aqui mataria a coleta INTEIRA por causa da forma de um
        // vizinho que ele nem lê.
        expect(previousEffectiveDates({}).size).toBe(0);
        expect(previousEffectiveDates({ entries: "nada disso" }).size).toBe(0);
    });
});

describe("PONTO FIXO da migração — a fatia reproduz o artefato byte a byte (I9 estendido)", () => {
    it("aplicar a fatia da própria leitura devolve o AMAZON idêntico", () => {
        const r = applySlice(artefato, amazonSlice(collection));
        expect(r.ok).toBe(true);
        expect(JSON.stringify(secao(r.ok ? r.catalog : {}, "AMAZON"))).toBe(JSON.stringify(amazon));
    });

    it("e o documento INTEIRO idêntico — a Shopee não é tocada pelo coletor da Amazon", () => {
        const r = applySlice(artefato, amazonSlice(collection));
        expect(JSON.stringify(r.ok ? r.catalog : null)).toBe(JSON.stringify(artefato));
    });

    it("FR-1011 — a MESMA leitura produz a MESMA fatia, e `collectedAt` não avança sozinho", () => {
        const a = amazonSlice(collection);
        const b = amazonSlice(collection);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        expect(a.collectedAt).toBe(DATA);
        // A função não conhece "hoje": TODA data na fatia veio dos INSUMOS (o collectedAt declarado
        // e as vigências das linhas), nunca do relógio. A forma anterior — `not.toContain(hoje)` —
        // era dependente de coincidência e a run 2 do T017 a derrubou: dentro do job, a 1ª passada
        // do fee:build move lastReviewed para hoje e DATA passa a SER hoje LEGITIMAMENTE.
        // Os insumos são a coleta E as constantes de DOMÍNIO declaradas do coletor (a vigência do
        // plano Individual, "2020-12-01", é dado da fonte com procedência — não relógio). As
        // vigências entram EXPLICITAMENTE: `previousEffectiveDates` é um Map, e a run 3 do T017
        // ensinou que `JSON.stringify(Map)` = "{}" — a primeira forma deste conjunto as perdia e
        // só passava localmente por coincidência (DATA == vigência).
        const datasDosInsumos = new Set([
            ...(JSON.stringify(collection).match(/\d{4}-\d{2}-\d{2}/g) ?? []),
            ...collection.previousEffectiveDates.values(),
            AMAZON_INDIVIDUAL_FEE_SOURCE.effectiveDate,
        ]);
        const datasNaFatia = new Set(JSON.stringify(a).match(/\d{4}-\d{2}-\d{2}/g) ?? []);
        for (const d of datasNaFatia) {
            expect(datasDosInsumos.has(d), `data "${d}" na fatia não veio de nenhum insumo`).toBe(
                true,
            );
        }
    });

    it("e o portão da data continua sendo `collectedAtFor`: fixture SEM `COLLECTED_AT` é recusada", () => {
        const v = collectedAtFor({ fromFixture: true, today: "2026-09-01" });
        expect(v.ok).toBe(false);
        expect(v.ok === false && v.reason).toMatch(/COLLECTED_AT/);
    });
});

describe("as canárias e o piso continuam sendo PRÉ-CONDIÇÃO da fatia (§C.2-bis regra 3)", () => {
    it("a leitura real passa nas guardas", () => {
        expect(evaluateAmazonCollection(categories)).toEqual({ ok: true, reason: "" });
    });

    it("piso de linhas: uma tabela encolhida ABORTA antes de virar fatia", () => {
        const v = amazonVerdict({ ...collection, categories: categories.slice(0, 5) });
        expect(v.kind).toBe("ABORTADO");
        expect(v.kind === "ABORTADO" && v.reason).toMatch(/below the 28 floor/);
    });

    it("canária Roupas 14%: a coluna trocada ABORTA, mesmo com número plausível", () => {
        const trocada = categories.map((c) =>
            c.name === "Roupas e Acessórios" ? { ...c, commissionPct: 13 } : c,
        );
        const v = amazonVerdict({ ...collection, categories: trocada });
        expect(v.kind).toBe("ABORTADO");
        expect(v.kind === "ABORTADO" && v.reason).toMatch(/Roupas e Acessórios/);
    });

    it("canária Calçados 14%", () => {
        const trocada = categories.map((c) =>
            c.name === "Calçados" ? { ...c, commissionPct: 9 } : c,
        );
        expect(amazonVerdict({ ...collection, categories: trocada }).kind).toBe("ABORTADO");
    });

    it("canária Relógios 13%", () => {
        const trocada = categories.map((c) =>
            c.name === "Relógios" ? { ...c, commissionPct: 14 } : c,
        );
        expect(amazonVerdict({ ...collection, categories: trocada }).kind).toBe("ABORTADO");
    });

    it("canária do MÍNIMO POR ITEM: a coluna deslocada zera o piso e é pega (014/T102)", () => {
        const trocada = categories.map((c) =>
            c.name === "Calçados" ? { ...c, minPerItem: 0 } : c,
        );
        expect(amazonVerdict({ ...collection, categories: trocada }).kind).toBe("ABORTADO");
    });

    it("colisão de `categoryId` ABORTA — um par de acentos apagaria a Amazon no cliente", () => {
        const colidente = [...categories, { ...categories[0]!, name: "ROUPAS E ACESSORIOS" }];
        const v = amazonVerdict({ ...collection, categories: colidente });
        expect(v.kind).toBe("ABORTADO");
        expect(v.kind === "ABORTADO" && v.reason).toMatch(/is claimed by/);
    });

    it("banda inválida ABORTA — a alíquota aplicada dependeria da ordem das linhas da tabela", () => {
        const comBandaRuim = categories.map((c, i) =>
            i === 0
                ? {
                      ...c,
                      bands: [
                          { minPrice: 0, maxPrice: 100, commissionPct: 14, fixedFee: 0 },
                          { minPrice: 50, maxPrice: null, commissionPct: 10, fixedFee: 0 },
                      ],
                  }
                : c,
        );
        const v = amazonVerdict({ ...collection, categories: comBandaRuim });
        expect(v.kind).toBe("ABORTADO");
        expect(v.kind === "ABORTADO" && v.reason).toMatch(/overlap/);
    });

    it("uma fatia ABORTADA não existe — e o que não existe não remove nada", () => {
        const v = amazonVerdict({ ...collection, categories: [] });
        expect(v.kind).toBe("ABORTADO");
        expect(v).not.toHaveProperty("slice");
    });
});

describe("REMOÇÃO REAL — a fonte deixa de publicar uma categoria", () => {
    const semUma = categories.filter((c) => c.name !== "Relógios");

    it("a leitura sem Relógios ainda passa no piso (é remoção, não falha de forma)", () => {
        // canária de Relógios sai junto? NÃO: `CANARIES` inclui Relógios 13%, então removê-la ABORTA.
        // É o comportamento certo e vale registrar: uma canária É uma categoria que não pode sumir sem
        // decisão humana — sumir dela é indistinguível de a página ter mudado de forma.
        expect(amazonVerdict({ ...collection, categories: semUma }).kind).toBe("ABORTADO");
    });

    it("removendo uma categoria NÃO-canária, a fatia exaustiva a apaga do artefato", () => {
        const naoCanaria = categories.find(
            (c) => !["Roupas e Acessórios", "Calçados", "Relógios", "Outros"].includes(c.name),
        )!;
        const semEla = categories.filter((c) => c.name !== naoCanaria.name);
        const v = amazonVerdict({ ...collection, categories: semEla });
        expect(v.kind).toBe("LIDO");
        const r = applySlice(artefato, v.kind === "LIDO" ? v.slice : amazonSlice(collection));
        expect(r.ok).toBe(true);
        const depois = secao(r.ok ? r.catalog : {}, "AMAZON");
        expect((depois.entries as unknown[]).length).toBe((amazon.entries as unknown[]).length - 2);
        expect((depois.categorySpine as { name: string }[]).map((n) => n.name)).not.toContain(
            naoCanaria.name,
        );
        // e a Shopee segue intacta — a remoção é NAQUELE marketplace e NAQUELA seção
        expect(JSON.stringify(secao(r.ok ? r.catalog : {}, "SHOPEE"))).toBe(
            JSON.stringify(secao(artefato, "SHOPEE")),
        );
    });
});
