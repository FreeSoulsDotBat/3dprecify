import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { ParsedCategory } from "./amazon-parse";
import { amazonEntries, amazonSpine } from "./amazon-to-catalog";

// O artefato commitado tem de ser PONTO FIXO do gerador: alimentar o gerador com o que o artefato diz
// que leu deve reproduzir o artefato byte a byte.
//
// Por que isso é um teste e não um script: sem ele, uma edição à mão no artefato de dinheiro passa
// despercebida até o próximo laço mensal, que a veria como MUDANÇA DA FONTE — um diff fantasma no PR
// que o revisor não tem como distinguir de uma alíquota que a Amazon mexeu de verdade. O laço só é
// confiável se o artefato e o gerador não puderem divergir em silêncio.
//
// Ele NÃO prova que a fonte foi relida (isso é `lastReviewed`, e só uma coleta real o avança). Prova
// que ninguém contrabandeou valor para dentro do artefato por fora do gerador.

const artifact = JSON.parse(
    readFileSync(new URL("../../../backend/app/data/catalog.json", import.meta.url), "utf8"),
) as {
    marketplaces: {
        marketplace: string;
        categorySpine?: { id: string; name: string; parentId: string | null }[];
        entries: {
            determinants: Record<string, string> | null;
            commissionPct: number | null;
            minPerItem: number | null;
            priceBands:
                { minPrice: number; maxPrice: number | null; commissionPct: number }[] | null;
            effectiveDate: string;
            lastReviewed: string;
        }[];
    }[];
};

const amazon = artifact.marketplaces.find((m) => m.marketplace === "AMAZON")!;

/** Reconstrói a leitura da tabela a partir do próprio artefato — nome vem da espinha, o resto da entrada. */
function readingFromArtifact(): ParsedCategory[] {
    const names = new Map((amazon.categorySpine ?? []).map((n) => [n.id, n.name]));
    const seen = new Set<string>();
    const out: ParsedCategory[] = [];
    for (const e of amazon.entries) {
        const id = e.determinants?.category;
        if (id === undefined || seen.has(id)) continue;
        seen.add(id);
        out.push({
            name: names.get(id)!,
            commissionPct: e.commissionPct,
            bands: e.priceBands,
            minPerItem: e.minPerItem,
        });
    }
    return out;
}

describe("o artefato commitado é ponto fixo do gerador", () => {
    const reading = readingFromArtifact();
    const first = amazon.entries[0]!;
    const regenerated = amazonEntries(reading, {
        collectedAt: first.lastReviewed,
        effectiveDate: first.effectiveDate,
    });

    it("regenerar a partir da própria leitura reproduz as entradas exatamente", () => {
        expect(regenerated).toEqual(amazon.entries);
    });

    it("e reproduz a espinha exatamente", () => {
        expect(amazonSpine(reading)).toEqual(amazon.categorySpine);
    });

    // A asserção que o defeito A1 teria reprovado: bandas publicadas sem o discriminador de ADR-0024.
    it("toda categoria com bandas declara `bandMode: PROGRESSIVE`, e nenhuma plana declara nada", () => {
        const comBandas = amazon.entries.filter((e) => (e.priceBands?.length ?? 0) > 0);
        expect(comBandas.length).toBeGreaterThan(0);
        for (const e of amazon.entries) {
            const esperado = (e.priceBands?.length ?? 0) > 0 ? "PROGRESSIVE" : undefined;
            expect((e as { bandMode?: string }).bandMode).toBe(esperado);
        }
    });
});
