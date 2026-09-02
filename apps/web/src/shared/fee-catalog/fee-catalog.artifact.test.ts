import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, it, expect } from "vitest";

import {
    type FeeCatalog,
    parseFeeCatalog,
    resolveFreightSubsidyCeiling,
    SCHEMA_VERSION,
} from "./fee-catalog";
import { FEE_CATALOG_SEED } from "./seed";

// 017/T013 — `*.artifact.test.ts`: a convenção que dá MEMBRESIA DERIVADA ao `pnpm gate:artifact`
// (decisão D). Todo teste que lê `backend/app/data/catalog.json` mora num arquivo com este nome, e
// uma meta-guarda (`packages/fee-ingest/src/gate-artifact.test.ts`) reprova quem ler o artefato de
// fora da convenção. O motivo: `GITHUB_TOKEN` não dispara CI (ADR-0010 §A6.5), então o PR mensal
// chega SEM gate — e o subconjunto que roda dentro do job não pode ser uma lista curada à mão, que
// diverge no dia em que alguém acrescenta um guarda e esquece de acrescentá-lo à lista (o risco D4).

// Truth-gate (T009 / Constitution II): the served artifact AND the bundled seed MUST parse under the
// current schema, agree on schemaVersion, and every curated entry MUST carry provenance
// (sourceUrl/effectiveDate/lastReviewed) — a fabricated/unsourced entry fails the build. A4 carve-out:
// the ML freight ESTIMATE.defaultSubsidy is a labelled estimate (its thresholdPrice IS sourced) and is
// exempt from the per-field provenance gate; entry-level provenance still applies.

const catalogPath = fileURLToPath(
    new URL("../../../../../backend/app/data/catalog.json", import.meta.url),
);
const servedCatalog: unknown = JSON.parse(readFileSync(catalogPath, "utf8"));

describe("fee-catalog truth-gate (served artifact + seed)", () => {
    it("the committed backend/app/data/catalog.json parses under the schema", () => {
        expect(() => parseFeeCatalog(servedCatalog)).not.toThrow();
    });

    it("the bundled seed parses under the schema", () => {
        expect(() => parseFeeCatalog(FEE_CATALOG_SEED)).not.toThrow();
    });

    it("served artifact and seed agree on schemaVersion (= SCHEMA_VERSION)", () => {
        expect(parseFeeCatalog(servedCatalog).schemaVersion).toBe(SCHEMA_VERSION);
        expect(FEE_CATALOG_SEED.schemaVersion).toBe(SCHEMA_VERSION);
    });

    it("every curated entry (both sources) carries sourceUrl + effectiveDate + lastReviewed", () => {
        const entriesOf = (c: FeeCatalog) => c.marketplaces.flatMap((m) => m.entries);
        const all = [...entriesOf(parseFeeCatalog(servedCatalog)), ...entriesOf(FEE_CATALOG_SEED)];
        for (const e of all) {
            expect(e.sourceUrl).toMatch(/^https?:\/\//);
            expect(e.effectiveDate.length).toBeGreaterThan(0);
            expect(e.lastReviewed.length).toBeGreaterThan(0);
        }
    });
});

// 016/PR-F — o DADO servido, lido do artefato commitado. Estas asserções são sobre o CATÁLOGO
// (valores e forma); o efeito no PREÇO é provado em `features/calculator/fee-prefill.test.ts`, onde
// o mapeamento para o motor mora.
describe("016/PR-F — a curadoria desta fatia no artefato servido", () => {
    const served = parseFeeCatalog(servedCatalog);
    const mk = (id: string) => served.marketplaces.find((m) => m.marketplace === id)!;

    // 017/T009 · P0-a (ADR-0029 §2) — AQUI MORAVA UMA LITERAL: `expect(served.catalogVersion).toBe(
    // <a versão do dia>)`. Ela foi reeditada À MÃO duas vezes em dois dias (016/PR-F e o hotfix A2/A3),
    // e é essa a prova empírica do defeito: todo bump de conteúdo obrigava alguém a reescrever uma
    // string DENTRO DE UM TESTE, então o primeiro PR mensal do robô nasceria vermelho por construção,
    // com o dado CERTO (SC-1008).
    //
    // No lugar dela, as RELAÇÕES da decisão B — nenhum valor cravado, e todas verdadeiras num mês COM
    // e num mês SEM execução:
    //   (i)   `semente == projetarSemente(servido)` — em `fee-ingest/src/seed-projection.artifact.test.ts`
    //         (lá, e não aqui, porque a função de projeção mora do lado da política que ela declara, e
    //         `apps/web` não importa um pacote que só roda em CI);
    //   (ii)  o rótulo casa `YYYY-MM-DD.n` E sua data é a de `generatedAt`;
    //   (iii) `schemaVersion` igual nos dois;
    //   (iv)  o rótulo é o que `nextCatalogVersion` produziria — provado no PONTO DE GERAÇÃO
    //         (`fee-ingest/src/compose.test.ts`), não adivinhado no consumidor.
    describe("P0-a — a paridade semente↔artefato é RELACIONAL (ADR-0029)", () => {
        it("(ii) o rótulo tem a forma `YYYY-MM-DD.n`, dos DOIS lados", () => {
            const forma = /^\d{4}-\d{2}-\d{2}\.\d+$/;
            expect(served.catalogVersion).toMatch(forma);
            expect(FEE_CATALOG_SEED.catalogVersion).toMatch(forma);
        });

        it("(ii) a DATA do rótulo é a data de `generatedAt` — pega a edição à mão de um lado só", () => {
            expect(served.catalogVersion.split(".")[0]).toBe(served.generatedAt.slice(0, 10));
        });

        it("o seed carrega o MESMO rótulo do servido, sem ninguém digitá-lo", () => {
            expect(FEE_CATALOG_SEED.catalogVersion).toBe(served.catalogVersion);
            expect(FEE_CATALOG_SEED.generatedAt).toBe(served.generatedAt);
        });

        it("(iii) `schemaVersion` é o mesmo nos dois, e é o do código", () => {
            expect(served.schemaVersion).toBe(SCHEMA_VERSION);
            expect(FEE_CATALOG_SEED.schemaVersion).toBe(served.schemaVersion);
        });

        it("nenhuma literal de versão sobrou neste arquivo (o guarda que se guarda)", () => {
            const source = readFileSync(new URL(import.meta.url), "utf8");
            // procura por uma data-versão cravada em aspas; a regex do teste (ii) não casa porque lá ela
            // é uma expressão regular, não uma string literal de versão.
            expect(source).not.toMatch(/"\d{4}-\d{2}-\d{2}\.\d+"/);
        });
    });

    describe("Shopee — a banda partida em R$ 8 (US18) e o perfil (US17)", () => {
        const shopee = mk("SHOPEE");
        const catchAll = shopee.entries.find((e) => e.determinants === null)!;
        const cpf = shopee.entries.find(
            (e) => e.determinants?.sellerProfile === "CPF_ALTO_VOLUME",
        )!;

        it("DUAS entradas, não três — o CPF de baixo volume paga a tabela do catch-all (T057)", () => {
            expect(shopee.entries).toHaveLength(2);
            expect(shopee.determinantsSchema).toEqual({ sellerProfile: ["CPF_ALTO_VOLUME"] });
        });

        it("a banda [0,80) virou [0,8) com a regra + [8,80) com os R$ 4 constantes", () => {
            expect(catchAll.priceBands?.slice(0, 2)).toEqual([
                {
                    minPrice: 0,
                    maxPrice: 8,
                    commissionPct: 20,
                    fixedFee: 0,
                    fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
                },
                { minPrice: 8, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
            ]);
            // A comissão de 20% CONTINUA incidindo abaixo de R$ 8 — é a leitura verbatim do art. 26839
            // (T057) e o oposto do que o OBTENCAO-DINAMICA §8 dizia ("50% sem fixo"), que estava errado.
            expect(catchAll.priceBands?.[0]?.commissionPct).toBe(20);
        });

        it("as bandas de cima ficaram INTOCADAS (a partição não é uma recuradoria)", () => {
            expect(catchAll.priceBands?.slice(2)).toEqual([
                { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 16 },
                { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
                { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
            ]);
        });

        it("CPF alto volume = a tabela do catch-all com +R$ 3,00 no fixo de CADA banda", () => {
            const acima8 = catchAll.priceBands!.filter((b) => b.minPrice >= 8);
            expect(cpf.priceBands).toHaveLength(acima8.length);
            cpf.priceBands!.forEach((b, i) => {
                expect(b.commissionPct).toBe(acima8[i]!.commissionPct);
                expect(b.fixedFee).toBe(acima8[i]!.fixedFee! + 3);
            });
        });

        it("as bandas do CPF começam em R$ 12 e NÃO herdam a partição de R$ 8 (§9.5)", () => {
            // A tabela + R$ 3 daria R$ 7,00 de taxa num item de R$ 9, e a fonte publica R$ 6,00 num de
            // R$ 8 — a regressiva existe e a fórmula NÃO é publicada. Precificar ali mentiria sob selo.
            expect(cpf.priceBands?.[0]?.minPrice).toBe(12);
            expect(cpf.priceBands?.some((b) => b.fixedFeeRule != null)).toBe(false);
            expect(cpf.priceBands?.some((b) => b.minPrice < 12)).toBe(false);
        });

        // hotfix 016/A2 (2026-08-07) — o subsídio migrou de ARITMÉTICA para INFORMAÇÃO.
        describe("o subsídio de frete é informação, não parcela da conta", () => {
            it("as duas entradas declaram `freight: {kind:'NONE'}` — nenhum voucher emitido", () => {
                for (const e of shopee.entries) expect(e.freight).toEqual({ kind: "NONE" });
            });

            it("o marketplace publica `freightSubsidyInfo` com os tetos e a procedência do art. 23431", () => {
                // Os números vivem no DADO e nunca no código (Constituição II): a legenda da tela lê daqui.
                expect(shopee.freightSubsidyInfo).toEqual({
                    bands: [
                        { minPrice: 0, maxPrice: 80, ceiling: 20 },
                        { minPrice: 80, maxPrice: 200, ceiling: 30 },
                        { minPrice: 200, maxPrice: null, ceiling: 40 },
                    ],
                    source: expect.stringContaining("Shopee") as unknown as string,
                    sourceUrl: "https://seller.shopee.com.br/edu/article/23431",
                    effectiveDate: "2026-03-01",
                    lastReviewed: "2026-08-07",
                });
            });

            it("um catálogo SEM o campo parseia idêntico (compatibilidade retroativa)", () => {
                // A propriedade que fez do subsídio um CAMPO NOVO e não um `kind` do union `freight`: um
                // cliente antigo descarta a propriedade extra e continua lendo o catálogo inteiro. Aqui a
                // simetria: um catálogo antigo (sem o campo) continua válido para o cliente novo.
                const withoutField = structuredClone(servedCatalog) as {
                    marketplaces: Record<string, unknown>[];
                };
                for (const m of withoutField.marketplaces) delete m.freightSubsidyInfo;
                const parsed = parseFeeCatalog(withoutField);
                const shopeeWithoutField = parsed.marketplaces.find(
                    (m) => m.marketplace === "SHOPEE",
                )!;
                expect(shopeeWithoutField.freightSubsidyInfo ?? null).toBeNull();
                // E o resto do documento é IGUAL — o campo não carrega nada de que outra folha dependa.
                expect({ ...shopeeWithoutField, freightSubsidyInfo: undefined }).toEqual({
                    ...shopee,
                    freightSubsidyInfo: undefined,
                });
            });

            it("`null` explícito é aceito (é como o backend serializa a ausência)", () => {
                // `nullish` e não `optional`: um schema que só tolera `undefined` RECUSARIA o payload
                // servido, e a recusa aqui é SILENCIOSA (cai no seed embutido e ninguém vê erro).
                const comNull = structuredClone(servedCatalog) as {
                    marketplaces: Record<string, unknown>[];
                };
                for (const m of comNull.marketplaces) m.freightSubsidyInfo = null;
                expect(() => parseFeeCatalog(comNull)).not.toThrow();
            });
        });

        // hotfix 016/A2 (H2c) — a leitura, PURA, que a legenda usa: qual teto vale para o preço da tela.
        describe("resolveFreightSubsidyCeiling — a faixa do anúncio decide o teto exibido", () => {
            it("resolve o teto certo em cada faixa publicada (half-open, lower-inclusive)", () => {
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 0)).toBe(20);
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 79.99)).toBe(20);
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 80)).toBe(30); // a virada
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 199.99)).toBe(30);
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 200)).toBe(40);
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, 5000)).toBe(40); // faixa aberta
            });

            it("null quando o campo não existe — a legenda não inventa um teto", () => {
                expect(resolveFreightSubsidyCeiling(null, 50)).toBeNull();
                expect(resolveFreightSubsidyCeiling(undefined, 50)).toBeNull();
            });

            it("null para um preço fora de qualquer faixa publicada (ex.: negativo)", () => {
                expect(resolveFreightSubsidyCeiling(shopee.freightSubsidyInfo, -1)).toBeNull();
            });
        });

        it("o volumoso é R$ 50,00 POR PEDIDO, com fonte própria (art. 3305)", () => {
            expect(shopee.optionalSurcharges).toEqual([
                {
                    id: "MANUSEIO_VOLUMOSO",
                    label: "Manuseio de item volumoso",
                    value: 50,
                    appliesPer: "ORDER",
                    source: expect.stringContaining("Shopee") as unknown as string,
                    sourceUrl: "https://seller.shopee.com.br/edu/article/3305",
                    effectiveDate: "2026-02-02",
                    lastReviewed: "2026-08-06",
                },
            ]);
        });
    });

    describe("Amazon — a cobrança por item do plano Individual (US14)", () => {
        const amazon = mk("AMAZON");
        const individual = amazon.entries.filter((e) => e.determinants?.plan === "INDIVIDUAL");
        const profissional = amazon.entries.filter((e) => e.determinants?.plan === "PROFISSIONAL");

        it("toda entrada INDIVIDUAL cobra R$ 2,00 de fixo, com procedência própria", () => {
            expect(individual.length).toBeGreaterThan(0);
            for (const e of individual) {
                expect(e.fixedFee).toBe(2);
                expect(e.fixedFeeSource?.sourceUrl).toBe("https://venda.amazon.com.br/precos");
                // A procedência é OUTRA que a da entrada de propósito: o R$ 2,00 não está na página de
                // comissões, e apontar para ela seria mandar o vendedor a um lugar sem o número dele.
                expect(e.fixedFeeSource?.sourceUrl).not.toBe(e.sourceUrl);
            }
        });

        it("a banda também carrega os R$ 2,00 — senão o fixo do topo seria INERTE (013/F1)", () => {
            const bandadas = individual.filter((e) => (e.priceBands?.length ?? 0) > 0);
            expect(bandadas.length).toBeGreaterThan(0);
            for (const e of bandadas) {
                for (const b of e.priceBands!) expect(b.fixedFee).toBe(2);
            }
        });

        it("o plano Profissional fica INTOCADO — os R$ 19/mês não são custo por item", () => {
            expect(profissional.length).toBe(individual.length);
            for (const e of profissional) {
                expect(e.fixedFee).toBe(0);
                expect(e.fixedFeeSource ?? null).toBeNull();
                for (const b of e.priceBands ?? []) expect(b.fixedFee).toBe(0);
            }
        });

        it("`minPerItem` continua R$ 1,00 uniforme (D7 não foi reaberto)", () => {
            for (const e of amazon.entries) expect(e.minPerItem).toBe(1);
        });

        // 016/PR-F homologação (A4) — o texto de `fixedFeeSource.source` não repete a vigência: o
        // `FixedFeeSourceBadge` já imprime `effectiveDate` estruturado como "vigente desde dd/mm/aaaa",
        // então um parêntese com "vigente desde…" DENTRO da string vira "vigente desde X · vigente desde
        // X" no selo — a mesma informação dita duas vezes. A data continua medida e citada, só que uma
        // vez só, no campo estruturado que já existe para isso.
        it("`fixedFeeSource.source` não repete a vigência (o campo estruturado já a diz)", () => {
            for (const e of individual) {
                expect(e.fixedFeeSource?.source ?? "").not.toMatch(/vigente desde/i);
            }
        });
    });
});
