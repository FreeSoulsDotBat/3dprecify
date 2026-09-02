import { describe, it, expect, vi, beforeEach } from "vitest";

// jsdom has no IndexedDB and we don't want a real network call, so mock both seams. The impls are
// created via vi.hoisted (the mock factory runs before module init) and reconfigured per test.
const { idbGet, idbSet, apiFetchMock } = vi.hoisted(() => ({
    idbGet: vi.fn(),
    idbSet: vi.fn(),
    apiFetchMock: vi.fn(),
}));
vi.mock("idb-keyval", () => ({ get: idbGet, set: idbSet }));
vi.mock("@/shared/api/transport", () => ({ apiFetch: apiFetchMock }));

import type { FeeCatalog } from "./fee-catalog";
import { FEE_CATALOG_SEED } from "./seed";
import {
    adoptCatalog,
    FEE_CATALOG_STORE_KEY,
    fetchServedCatalog,
    freshest,
    loadPersistedCatalog,
    persistCatalog,
} from "./use-fee-catalog";

const newer: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-08-20.0" };
const store = new Map<string, unknown>();

beforeEach(() => {
    store.clear();
    idbGet.mockReset().mockImplementation(async (k: string) => store.get(k));
    idbSet.mockReset().mockImplementation(async (k: string, v: unknown) => {
        store.set(k, v);
    });
    apiFetchMock.mockReset().mockImplementation(async () => structuredClone(FEE_CATALOG_SEED));
});

describe("freshest — resolution precedence", () => {
    it("prefers the higher catalogVersion regardless of argument order", () => {
        expect(freshest(newer, FEE_CATALOG_SEED)).toBe(newer);
        expect(freshest(FEE_CATALOG_SEED, newer)).toBe(newer);
    });

    it("keeps the incoming on a version tie (idempotent refresh)", () => {
        expect(freshest(FEE_CATALOG_SEED, FEE_CATALOG_SEED)).toBe(FEE_CATALOG_SEED);
    });

    it("compares the sequence as an INTEGER, not a string — .10 beats .2 (E1-03)", () => {
        const v10: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-07.10" };
        const v2: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-07.2" };
        expect(freshest(v10, v2)).toBe(v10);
        expect(freshest(v2, v10)).toBe(v10);
    });

    // 014/T100 — uma versão que não parseia MUST valer MENOS, e o caso concreto é o sentinel
    // `"invalid-seed"` que o `parseSeedResilient` grava quando a semente empacotada é insalvável.
    //
    // Pela comparação lexicográfica anterior, "invalid-seed" > "2026-07-28.0" (o "i" vence o "2"), e o
    // sentinel é o PISO síncrono do estado. Ou seja: no dia em que a semente do bundle saísse quebrada,
    // o app passaria a recusar PERMANENTEMENTE o catálogo servido e o persistido — os dois caminhos que
    // existem justamente para consertar isso. Um erro de build viraria um app que não aceita conserto.
    it("uma versão ILEGÍVEL nunca vence uma legível — em qualquer ordem", () => {
        const quebrada: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "invalid-seed" };
        const real: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-28.0" };
        expect(freshest(real, quebrada)).toBe(real); // servido chegando por cima da seed quebrada
        expect(freshest(quebrada, real)).toBe(real); // e a quebrada não desbanca a boa que já está lá
    });

    it("vale para qualquer formato irreconhecível, não só para o sentinel", () => {
        const real: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "2026-07-28.0" };
        for (const lixo of ["zzz", "9999", "2026-13-45.0", ""]) {
            const ilegivel: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: lixo };
            expect(freshest(real, ilegivel)).toBe(real);
            expect(freshest(ilegivel, real)).toBe(real);
        }
    });

    it("duas ilegíveis: mantém a que chega, para o refresh continuar idempotente", () => {
        const a: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "invalid-seed" };
        const b: FeeCatalog = { ...FEE_CATALOG_SEED, catalogVersion: "invalid-seed" };
        expect(freshest(a, b)).toBe(a);
    });
});

describe("loadPersistedCatalog (R2 store)", () => {
    it("returns null when nothing is stored (→ the seed answers)", async () => {
        expect(await loadPersistedCatalog()).toBeNull();
    });

    it("returns the validated catalog when one is stored", async () => {
        await persistCatalog(newer);
        const loaded = await loadPersistedCatalog();
        expect(loaded?.catalogVersion).toBe("2026-08-20.0");
    });

    it("returns null (non-blocking) when the store read throws", async () => {
        idbGet.mockImplementationOnce(async () => {
            throw new Error("idb unavailable");
        });
        expect(await loadPersistedCatalog()).toBeNull();
    });

    it("returns null when the stored value fails schema validation (never a bad catalog)", async () => {
        store.set(FEE_CATALOG_STORE_KEY, { not: "a catalog" });
        expect(await loadPersistedCatalog()).toBeNull();
    });
});

describe("persistCatalog (best-effort cache write)", () => {
    it("writes the catalog to the store", async () => {
        await persistCatalog(newer);
        expect(store.get(FEE_CATALOG_STORE_KEY)).toBeTruthy();
    });

    it("swallows a write failure (the cache is not a source of truth)", async () => {
        idbSet.mockImplementationOnce(async () => {
            throw new Error("quota exceeded");
        });
        await expect(persistCatalog(newer)).resolves.toBeUndefined();
    });
});

describe("fetchServedCatalog (schema-guarded refresh)", () => {
    it("fetches and validates the served payload", async () => {
        const c = await fetchServedCatalog();
        expect(c.schemaVersion).toBe(FEE_CATALOG_SEED.schemaVersion);
    });

    it("rejects an invalid served payload (the wire is re-validated)", async () => {
        apiFetchMock.mockImplementationOnce(async () => ({ bogus: true }));
        await expect(fetchServedCatalog()).rejects.toThrow();
    });
});

// 014/T054 (SC-805) — a comparação de frescor NUNCA pode reduzir cobertura.
//
// A semente e o catálogo servido não são competidores: a semente é o PISO SÍNCRONO que garante dado
// na primeira pintura (R1), e por construção ela é uma cópia empacotada que só muda quando sai um
// build. Hoje ela carrega 1 entrada (Shopee); o servido carrega 79.
//
// `adopt` comparava os dois por `catalogVersion`. Basta um bundle sair com a semente mais NOVA que o
// endpoint — um deploy do app na frente do deploy do backend, ou o servido atrasado — para a semente
// VENCER e o catálogo real ser recusado: o vendedor perderia o mapa inteiro da Amazon e o seletor
// diria "este canal ainda não tem taxa de referência", com o mapa a um fetch de distância.
describe("a semente é um PISO, não um competidor (T054/SC-805)", () => {
    const seed: FeeCatalog = {
        ...FEE_CATALOG_SEED,
        catalogVersion: "2026-12-01.0", // mais NOVA que o servido, de propósito
    };
    const servido: FeeCatalog = {
        ...FEE_CATALOG_SEED,
        catalogVersion: "2026-07-28.1",
        marketplaces: [
            ...FEE_CATALOG_SEED.marketplaces.filter((m) => m.marketplace !== "AMAZON"),
            {
                marketplace: "AMAZON",
                determinantsSchema: { plan: ["PROFISSIONAL"], category: [] },
                categorySpine: [{ id: "calcados", name: "Calçados", parentId: null }],
                entries: [
                    {
                        determinants: { plan: "PROFISSIONAL", category: "calcados" },
                        commissionPct: 14,
                        fixedFee: 0,
                        minPerItem: 1,
                        priceBands: null,
                        freight: { kind: "NONE" },
                        source: "Tabela Amazon",
                        sourceUrl: "https://x",
                        effectiveDate: "2026-07-28",
                        lastReviewed: "2026-07-28",
                    },
                ],
            },
        ],
    } as FeeCatalog;

    const entradas = (c: FeeCatalog) => c.marketplaces.reduce((n, m) => n + m.entries.length, 0);

    it("o servido tem mais cobertura que a semente — a premissa do teste, medida", () => {
        expect(entradas(servido)).toBeGreaterThan(entradas(seed));
    });

    it("uma semente com versão mais nova NÃO recusa o catálogo real", () => {
        // `freshest` sozinho diria que a semente vence; a adoção não pode obedecer só a isso.
        expect(freshest(servido, seed)).toBe(seed);
        expect(adoptCatalog({ catalog: seed, source: "seed" }, servido)).toMatchObject({
            source: "catalog",
        });
    });

    it("entre DOIS catálogos reais, a versão volta a mandar — a regra não vira 'o último vence'", () => {
        const velho: FeeCatalog = { ...servido, catalogVersion: "2026-01-01.0" };
        expect(adoptCatalog({ catalog: servido, source: "catalog" }, velho)).toMatchObject({
            catalog: servido,
        });
    });

    // 017/T009 (014/U5-b, US7/AC3) — O RAMO DE CACHE, agora sobre o caso que o laço mensal TORNA
    // COMUM, e que antes deste incremento não existia no mundo real.
    //
    // A partir do 017 a `catalogVersion` só se move quando o CONTEÚDO muda (`nextCatalogVersion` +
    // um bump por execução). Logo, num mês em que o robô releu tudo e nada mudou — o caso de 11 meses
    // por ano —, o servido chega ao cliente com EXATAMENTE o mesmo rótulo do que já está persistido.
    // Não é um erro nem um empate a desempatar: é o estado normal, e a única coisa proibida é o
    // cliente ficar oscilando entre dois documentos que dizem a mesma coisa.
    describe("017 — o mês SEM bump: o servido chega com o rótulo IGUAL ao persistido", () => {
        const persistido: FeeCatalog = { ...servido, catalogVersion: "2026-09-01.3" };
        const mesmoRotulo: FeeCatalog = { ...servido, catalogVersion: "2026-09-01.3" };

        it("o catálogo ativo continua vindo do endpoint, sem cair para a semente", () => {
            expect(
                adoptCatalog({ catalog: persistido, source: "catalog" }, mesmoRotulo),
            ).toMatchObject({
                source: "catalog",
            });
        });

        it("e a adoção é ESTÁVEL: reaplicá-la não muda mais nada (nenhum ping-pong mensal)", () => {
            const uma = adoptCatalog({ catalog: persistido, source: "catalog" }, mesmoRotulo);
            const duas = adoptCatalog(uma, mesmoRotulo);
            expect(duas.catalog.catalogVersion).toBe(uma.catalog.catalogVersion);
            expect(duas.source).toBe(uma.source);
        });

        it("a semente empacotada continua PISO: ela perde do servido de rótulo igual", () => {
            // O ramo `prev.source === "seed"`, exercido com o dado que o laço produz de verdade.
            expect(
                adoptCatalog({ catalog: FEE_CATALOG_SEED, source: "seed" }, mesmoRotulo),
            ).toMatchObject({ source: "catalog", catalog: mesmoRotulo });
        });
    });
});
