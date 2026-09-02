import { describe, expect, it } from "vitest";

import { diffCatalogs } from "./catalog-diff.ts";
import { classifyExemption } from "./exemption.ts";
import { MARCADOR_MUDANCA, CHANGES_HEADING, monthlyPrBody } from "./pr-body.ts";
import { type CollectorVerdict, MARKETPLACE_COVERAGE, resolverVereditos } from "./verdict.ts";

// 017/T010 — o CONTRATO do corpo do PR mensal (`contracts/pr-mensal.md`).
//
// Testado nas DUAS direções, e a segunda é a que este projeto já pagou para aprender: no 014/US4 o
// corpo do PR imprimia "Sem mudança de tarifa" DIRETAMENTE ACIMA de "Categorias removidas da fonte",
// e todos os testes passavam porque cada um afirmava que uma string estava PRESENTE e nenhum
// afirmava que outra estava AUSENTE.

const SOURCE = "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920";

const entrada = (category: string, over: Record<string, unknown> = {}) => ({
    determinants: { plan: "PROFISSIONAL", category },
    commissionPct: 14,
    minPerItem: 1,
    lastReviewed: "2026-07-28",
    ...over,
});

const artefato = (entries: unknown[]) => ({
    catalogVersion: "2026-07-28.1",
    marketplaces: [
        {
            marketplace: "AMAZON",
            categorySpine: [{ id: "calcados", name: "Calçados", parentId: null }],
            entries,
        },
    ],
});

const semMudanca = diffCatalogs(artefato([entrada("calcados")]), artefato([entrada("calcados")]));
const comUmaMudanca = diffCatalogs(
    artefato([entrada("calcados")]),
    artefato([entrada("calcados", { commissionPct: 16 })]),
);

const lidoAmazon: CollectorVerdict = {
    kind: "LIDO",
    marketplace: "AMAZON",
    collectedAt: "2026-09-01",
    sourceUrl: SOURCE,
    slice: {
        marketplace: "AMAZON",
        leaves: [],
        exhaustive: [],
        collectedAt: "2026-09-01",
        sourceUrl: SOURCE,
    },
};

const exemptionDenied = classifyExemption({
    permitida: false,
    diffSoInerte: true,
    arquivosDoPr: ["backend/app/data/catalog.json"],
    contemFolhaDeOcr: false,
});

const padrao = {
    vereditos: resolverVereditos([lidoAmazon]),
    diff: semMudanca,
    vigias: [],
    exemption: exemptionDenied,
};

describe("§3 — os TRÊS estados, SEMPRE, para TODOS os marketplaces (US2/AC3, SC-1003)", () => {
    it("declara cada marketplace da cobertura em 100% dos corpos", () => {
        const body = monthlyPrBody(padrao);
        for (const mk of MARKETPLACE_COVERAGE) expect(body).toContain(mk);
    });

    it("um marketplace sem veredito sai NÃO LIDO com o motivo — nunca omitido", () => {
        const body = monthlyPrBody(padrao);
        expect(body).toContain("NÃO LIDO");
        expect(body).toContain("o job não produziu veredito");
    });

    it("o abortado sai ABORTADO com o motivo nomeado (o PR parcial da Q4)", () => {
        const body = monthlyPrBody({
            ...padrao,
            vereditos: resolverVereditos([
                lidoAmazon,
                {
                    kind: "ABORTADO",
                    marketplace: "SHOPEE",
                    reason: "âncora do art. 26839 ausente",
                    sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
                },
            ]),
        });
        expect(body).toContain("ABORTADO");
        expect(body).toContain("âncora do art. 26839 ausente");
        // e o LIDO continua LIDO — o PR é PARCIAL, não abortado inteiro
        expect(body).toContain("LIDO");
        expect(body).toContain("2026-09-01");
    });

    it("uma razão honesta declarada pelo coletor vence a genérica", () => {
        const body = monthlyPrBody({
            ...padrao,
            vereditos: resolverVereditos([
                lidoAmazon,
                {
                    kind: "NAO_LIDO",
                    marketplace: "MERCADO_LIVRE",
                    reason: "sem credencial, fora do escopo do 017",
                },
            ]),
        });
        expect(body).toContain("sem credencial, fora do escopo do 017");
    });
});

describe("§4 — mudanças de tarifa, e a AUSÊNCIA delas (lição 014/US4)", () => {
    it("execução sem mudança ⇒ NENHUMA seção de mudança e NENHUM `antigo → novo`", () => {
        const body = monthlyPrBody(padrao);
        expect(body).not.toContain(CHANGES_HEADING);
        expect(body).not.toContain(MARCADOR_MUDANCA);
        expect(body).toContain("Sem mudança de tarifa");
    });

    it("uma folha mudada ⇒ exatamente ela, com fonte e data de coleta", () => {
        const body = monthlyPrBody({ ...padrao, diff: comUmaMudanca });
        expect(body).toContain(CHANGES_HEADING);
        expect(body).toContain(`14 ${MARCADOR_MUDANCA} 16`);
        expect(body).toContain("commissionPct");
        expect(body).toContain(SOURCE);
        expect(body).toContain("2026-09-01");
        expect(body).not.toContain("Sem mudança de tarifa");
        // uma linha de mudança, não duas
        expect(body.split(MARCADOR_MUDANCA).length - 1).toBe(1);
    });

    it("mudança material e prova-de-vida são MUTUAMENTE exclusivas no mesmo corpo", () => {
        const comRemocao = diffCatalogs(
            artefato([entrada("calcados"), entrada("oculos")]),
            artefato([entrada("calcados")]),
        );
        const body = monthlyPrBody({ ...padrao, diff: comRemocao });
        expect(body).not.toContain("Sem mudança de tarifa");
    });
});

describe("§4/AC5 — folha vinda de OCR carrega lido × anterior × link da imagem", () => {
    const folhaOcr = {
        label: "Shopee — banda [80, 100) — comissão",
        lido: 15,
        anterior: 14,
        imagemUrl: "https://cf.shopee.com.br/file/abc123.png",
        acimaDoLimiar: false,
    };

    it("mesmo ABAIXO do limiar do banner, a evidência de revisão está presente", () => {
        const body = monthlyPrBody({ ...padrao, diff: comUmaMudanca, folhasDeOcr: [folhaOcr] });
        expect(body).toContain(folhaOcr.label);
        expect(body).toContain(folhaOcr.imagemUrl);
        expect(body).toContain("lido");
        expect(body).toContain("anterior");
        // e NÃO há banner — o banner é o caso acima do limiar
        expect(body).not.toContain("acima do limiar declarado");
    });

    it("§2 — acima do limiar, o BANNER sai no topo (clarify Q8)", () => {
        const body = monthlyPrBody({
            ...padrao,
            diff: comUmaMudanca,
            folhasDeOcr: [{ ...folhaOcr, acimaDoLimiar: true }],
        });
        expect(body).toContain("acima do limiar declarado");
        expect(body.indexOf("acima do limiar declarado")).toBeLessThan(
            body.indexOf("Estado por marketplace"),
        );
    });
});

describe("§5 — a seção de vigias, cujo TÍTULO diz que nada de dado mudou", () => {
    const vigia = {
        fonte: "Amazon /precos",
        sourceUrl: "https://venda.amazon.com.br/precos",
        resumo: "tarifa do plano Individual publicada como R$ 2,50 (constante: R$ 2,00)",
    };

    it("sem vigia com notícia, a seção NÃO existe", () => {
        expect(monthlyPrBody(padrao)).not.toContain("## Vigias");
    });

    it("com vigia, a seção existe e a frase 'nenhum dado alterado' é parte do TÍTULO", () => {
        const body = monthlyPrBody({ ...padrao, vigias: [vigia] });
        expect(body).toContain("## Vigias (nenhum dado alterado)");
        expect(body).toContain(vigia.resumo);
        expect(body).toContain(vigia.sourceUrl);
    });

    it("vigia com notícia + catálogo INTACTO ⇒ §5 presente, §4 ausente, dispensa NEGADA pelo eixo (b)", () => {
        const exemption = classifyExemption({
            permitida: true,
            diffSoInerte: true,
            arquivosDoPr: [
                "backend/app/data/catalog.json",
                "packages/fee-ingest/data/amazon-precos.baseline.json",
            ],
            contemFolhaDeOcr: false,
        });
        const body = monthlyPrBody({ ...padrao, vigias: [vigia], exemption });
        expect(body).toContain("## Vigias (nenhum dado alterado)");
        expect(body).not.toContain(CHANGES_HEADING);
        expect(body).toContain("amazon-precos.baseline.json");
        expect(body).toMatch(/exemption.*(negada|NÃO)/i);
    });
});

describe("§1 — a seção de DECISÃO, no TOPO de tudo (clarify Q2)", () => {
    const decisao = {
        titulo: "Amazon: a página e a tabela discordam sobre a tarifa por item",
        fonteA: {
            label: "/precos (página)",
            valor: "R$ 2,50",
            url: "https://venda.amazon.com.br/precos",
        },
        fonteB: {
            label: "AMAZON_INDIVIDUAL_PER_ITEM_FEE (servido)",
            valor: "R$ 2,00",
            url: SOURCE,
        },
        autoDatacao: "20/01/2025",
    };

    it("quando não há decisão pendente, a seção não existe", () => {
        expect(monthlyPrBody(padrao)).not.toContain("DECISÃO DO DONO");
    });

    it("quando há, ela é a PRIMEIRA coisa do corpo, com A × B × auto-datação × as duas URLs", () => {
        const body = monthlyPrBody({ ...padrao, decisao });
        expect(body.indexOf("DECISÃO DO DONO")).toBeLessThan(
            body.indexOf("Estado por marketplace"),
        );
        expect(body).toContain("R$ 2,50");
        expect(body).toContain("R$ 2,00");
        expect(body).toContain("20/01/2025");
        expect(body).toContain("https://venda.amazon.com.br/precos");
        expect(body).toContain(SOURCE);
    });

    it("página sem auto-datação diz isso, em vez de imprimir `null`", () => {
        const body = monthlyPrBody({ ...padrao, decisao: { ...decisao, autoDatacao: null } });
        expect(body).not.toContain("null");
        expect(body).toMatch(/não se auto-data|sem auto-datação/i);
    });
});

describe("§6 — o rodapé de dispensa imprime o ESTADO e o PORQUÊ (P0-b)", () => {
    it("desligada: o corpo diz que está desligada e por quê", () => {
        const body = monthlyPrBody(padrao);
        expect(body).toContain("ALLOW_FRESHNESS_EXEMPTION");
        expect(body).toMatch(/DESLIGADA/i);
    });

    it("ligada e concedida: o corpo diz que foi concedida e sob qual condição", () => {
        const exemption = classifyExemption({
            permitida: true,
            diffSoInerte: true,
            arquivosDoPr: ["backend/app/data/catalog.json"],
            contemFolhaDeOcr: false,
        });
        const body = monthlyPrBody({ ...padrao, exemption });
        expect(body).toMatch(/exemption.*concedida/i);
        expect(body).toContain("inerte");
    });

    it("o rodapé é o FIM do corpo — o estado da dispensa não se perde no meio", () => {
        const body = monthlyPrBody({ ...padrao, diff: comUmaMudanca, vigias: [] });
        expect(body.indexOf("ALLOW_FRESHNESS_EXEMPTION")).toBeGreaterThan(
            body.indexOf(CHANGES_HEADING),
        );
    });
});

describe("o corpo é FUNÇÃO PURA — o mesmo insumo dá o mesmo texto", () => {
    it("duas chamadas iguais produzem bytes iguais (nenhum `new Date()` escondido)", () => {
        expect(monthlyPrBody(padrao)).toBe(monthlyPrBody(padrao));
    });
});

describe("as OUTRAS notícias do diff — cada uma é decisão humana", () => {
    const comEspinha = (entries: unknown[], spine: unknown[]) => ({
        catalogVersion: "2026-07-28.1",
        marketplaces: [{ marketplace: "AMAZON", categorySpine: spine, entries }],
    });
    const no = (id: string, name: string, parentId: string | null = null) => ({
        id,
        name,
        parentId,
    });

    it("categoria NOVA na fonte aparece nomeada", () => {
        const diff = diffCatalogs(
            comEspinha([entrada("calcados")], [no("calcados", "Calçados")]),
            comEspinha(
                [entrada("calcados"), entrada("oculos")],
                [no("calcados", "Calçados"), no("oculos", "Óculos")],
            ),
        );
        const body = monthlyPrBody({ ...padrao, diff });
        expect(body).toContain("categoria NOVA na fonte");
        expect(body).toContain("Óculos");
        expect(body).not.toContain("Sem mudança de tarifa");
    });

    it("categoria REMOVIDA da fonte aparece nomeada", () => {
        const diff = diffCatalogs(
            comEspinha(
                [entrada("calcados"), entrada("oculos")],
                [no("calcados", "Calçados"), no("oculos", "Óculos")],
            ),
            comEspinha([entrada("calcados")], [no("calcados", "Calçados")]),
        );
        const body = monthlyPrBody({ ...padrao, diff });
        expect(body).toContain("Categorias removidas da fonte (decisão humana necessária)");
        expect(body).toContain("Óculos");
    });

    // FR-019a — muda a alíquota EFETIVA sem nenhum campo diferir. Sem esta seção o PR publicaria uma
    // mudança de preço sem uma linha que a descrevesse.
    it("categoria que mudou de PAI aparece, com o de-para", () => {
        const diff = diffCatalogs(
            comEspinha(
                [entrada("calcados")],
                [no("moda", "Moda"), no("calcados", "Calçados", "moda")],
            ),
            comEspinha(
                [entrada("calcados")],
                [no("moda", "Moda"), no("calcados", "Calçados", null)],
            ),
        );
        const body = monthlyPrBody({ ...padrao, diff });
        expect(body).toContain("mudou de pai");
        expect(body).toContain("(raiz)");
    });

    it("e no sentido contrário — da raiz para dentro de um pai — o de-para continua legível", () => {
        const diff = diffCatalogs(
            comEspinha(
                [entrada("calcados")],
                [no("moda", "Moda"), no("calcados", "Calçados", null)],
            ),
            comEspinha(
                [entrada("calcados")],
                [no("moda", "Moda"), no("calcados", "Calçados", "moda")],
            ),
        );
        const body = monthlyPrBody({ ...padrao, diff });
        expect(body).toContain("de (raiz) para moda");
    });

    it("um valor ESTRUTURADO vira JSON legível, nunca `[object Object]` (U34-a)", () => {
        const diff = diffCatalogs(
            artefato([entrada("calcados")]),
            artefato([entrada("calcados", { priceBands: [{ minPrice: 0, maxPrice: null }] })]),
        );
        const body = monthlyPrBody({ ...padrao, diff });
        expect(body).not.toContain("[object Object]");
        expect(body).toContain("minPrice");
    });

    it("mudança material de um marketplace SEM veredito LIDO declara a contradição, não a esconde", () => {
        const body = monthlyPrBody({
            ...padrao,
            vereditos: resolverVereditos([]),
            diff: comUmaMudanca,
        });
        expect(body).toContain("procedência não declarada");
    });

    it("o diff de baseline de um vigia viaja como evidência, em bloco", () => {
        const body = monthlyPrBody({
            ...padrao,
            vigias: [
                {
                    fonte: "Amazon /precos",
                    sourceUrl: "https://venda.amazon.com.br/precos",
                    resumo: "mínimo por categoria mudou",
                    diffBaseline: '-  "minimo": 1\n+  "minimo": 2',
                },
            ],
        });
        expect(body).toContain("```diff");
        expect(body).toContain('"minimo": 2');
    });
});

// §C.2-bis — A LINHA DE PROCEDÊNCIA DA REMOÇÃO.
//
// `diffCatalogs` já produz `removedCategories`/`removedEntries` e `semNoticia()` já retorna false
// quando qualquer uma é não-vazia. O que o 017 acrescenta é a PROCEDÊNCIA: sem ela o revisor não
// consegue distinguir "a fonte deixou de publicar" de "o coletor não leu" — e as duas exigem ações
// opostas (uma é notícia, a outra é incidente).
describe("remoção — a procedência que distingue 'a fonte parou' de 'o coletor não leu'", () => {
    const comEspinha = (entries: unknown[], spine: unknown[]) => ({
        catalogVersion: "2026-07-28.1",
        marketplaces: [{ marketplace: "AMAZON", categorySpine: spine, entries }],
    });
    const no = (id: string, name: string) => ({ id, name, parentId: null });

    const diffComRemocao = diffCatalogs(
        comEspinha(
            [entrada("calcados"), entrada("colchoes")],
            [no("calcados", "Calçados"), no("colchoes", "Colchões")],
        ),
        comEspinha([entrada("calcados")], [no("calcados", "Calçados")]),
    );

    const exaustivo: CollectorVerdict = {
        kind: "LIDO",
        marketplace: "AMAZON",
        collectedAt: "2026-09-01",
        sourceUrl: SOURCE,
        slice: {
            marketplace: "AMAZON",
            leaves: [],
            exhaustive: ["entries", "categorySpine"],
            collectedAt: "2026-09-01",
            sourceUrl: SOURCE,
        },
    };

    const body = monthlyPrBody({
        ...padrao,
        vereditos: resolverVereditos([exaustivo]),
        diff: diffComRemocao,
    });

    it("a categoria removida sai NOMEADA, sob o título de decisão humana", () => {
        expect(body).toContain("Categorias removidas da fonte (decisão humana necessária)");
        expect(body).toContain("Colchões");
    });

    it("com a linha de procedência: seções exaustivas + data + URL", () => {
        expect(body).toContain("ausente na leitura EXAUSTIVA de `entries`+`categorySpine`");
        expect(body).toContain("em 2026-09-01");
        expect(body).toContain(SOURCE);
    });

    it("AUSÊNCIA: uma execução com remoção NUNCA imprime 'Sem mudança de tarifa'", () => {
        expect(body).not.toContain("Sem mudança de tarifa");
    });

    it("remoção SEM leitura exaustiva declarada é dita como o incidente que é", () => {
        const semDeclaracao = monthlyPrBody({
            ...padrao,
            vereditos: resolverVereditos([
                { ...exaustivo, slice: { ...exaustivo.slice, exhaustive: [] } } as CollectorVerdict,
            ]),
            diff: diffComRemocao,
        });
        expect(semDeclaracao).not.toContain("ausente na leitura EXAUSTIVA");
        expect(semDeclaracao).toMatch(/nenhum coletor declarou leitura exaustiva/i);
    });
});
