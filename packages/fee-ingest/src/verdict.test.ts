import { describe, expect, it } from "vitest";

import {
    MARKETPLACE_COVERAGE,
    type CollectorVerdict,
    type Mk,
    resolverVereditos,
} from "./verdict.ts";

const lido = (marketplace: Mk): CollectorVerdict => ({
    kind: "LIDO",
    marketplace,
    collectedAt: "2026-08-07",
    sourceUrl: "https://exemplo/tabela",
    slice: {
        marketplace,
        exhaustive: [],
        leaves: [],
        collectedAt: "2026-08-07",
        sourceUrl: "https://exemplo/tabela",
    },
});

describe("MARKETPLACE_COVERAGE — a tabela é a verdade, não o `ls`", () => {
    it("declara os marketplaces que o laço cobre", () => {
        expect([...MARKETPLACE_COVERAGE]).toEqual(["AMAZON", "MERCADO_LIVRE", "SHOPEE"]);
    });

    it("está em ordem alfabética — a composição aplica fatias nessa ordem", () => {
        expect([...MARKETPLACE_COVERAGE]).toEqual([...MARKETPLACE_COVERAGE].sort());
    });

    it("não tem repetido (um marketplace resolvido duas vezes seria um estado ambíguo)", () => {
        expect(new Set(MARKETPLACE_COVERAGE).size).toBe(MARKETPLACE_COVERAGE.length);
    });
});

describe("resolverVereditos — função TOTAL: nenhum marketplace calado (US2/AC3, SC-1003)", () => {
    it("com o disco VAZIO, todos saem NÃO LIDO com o motivo literal", () => {
        const r = resolverVereditos([]);
        expect(Object.keys(r).sort()).toEqual([...MARKETPLACE_COVERAGE].sort());
        for (const mk of MARKETPLACE_COVERAGE) {
            expect(r[mk]).toEqual({
                kind: "NAO_LIDO",
                marketplace: mk,
                reason: "o job não produziu veredito",
            });
        }
    });

    it("um coletor que produziu veredito não é sobrescrito, e os OUTROS não somem", () => {
        const r = resolverVereditos([lido("AMAZON")]);
        expect(r.AMAZON.kind).toBe("LIDO");
        expect(r.MERCADO_LIVRE.kind).toBe("NAO_LIDO");
        expect(r.SHOPEE.kind).toBe("NAO_LIDO");
    });

    it("preserva ABORTADO com motivo e URL — o PR parcial da Q4 depende deste caso", () => {
        const abortado: CollectorVerdict = {
            kind: "ABORTADO",
            marketplace: "SHOPEE",
            reason: "âncora do art. 26839 ausente na leitura",
            sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
        };
        expect(resolverVereditos([abortado]).SHOPEE).toEqual(abortado);
    });

    it("preserva um NÃO LIDO com motivo PRÓPRIO — a razão honesta vence a genérica", () => {
        const r = resolverVereditos([
            {
                kind: "NAO_LIDO",
                marketplace: "MERCADO_LIVRE",
                reason: "sem credencial (fora do 017)",
            },
        ]);
        expect(r.MERCADO_LIVRE).toEqual({
            kind: "NAO_LIDO",
            marketplace: "MERCADO_LIVRE",
            reason: "sem credencial (fora do 017)",
        });
    });

    // Falha-fechado: dois artefatos para a mesma fonte (job reexecutado, upload duplicado) não podem
    // eleger um vencedor em silêncio — sobre dinheiro, "o último venceu" é a regra que o §C.1 nomeia
    // como o defeito que a composição existe para matar.
    it("dois vereditos para o MESMO marketplace ⇒ NÃO LIDO nomeando a ambiguidade", () => {
        const r = resolverVereditos([lido("AMAZON"), lido("AMAZON")]);
        expect(r.AMAZON.kind).toBe("NAO_LIDO");
        expect(r.AMAZON.kind === "NAO_LIDO" && r.AMAZON.reason).toMatch(/dois vereditos/i);
    });

    it("a ambiguidade de um não contamina os outros", () => {
        const r = resolverVereditos([lido("AMAZON"), lido("AMAZON"), lido("SHOPEE")]);
        expect(r.AMAZON.kind).toBe("NAO_LIDO");
        expect(r.SHOPEE.kind).toBe("LIDO");
    });

    it("o resultado é indexável por QUALQUER membro da cobertura (é o que 'total' quer dizer)", () => {
        const r = resolverVereditos([]);
        for (const mk of MARKETPLACE_COVERAGE) expect(r[mk].marketplace).toBe(mk);
    });
});
