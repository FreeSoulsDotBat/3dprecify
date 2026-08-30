import { describe, expect, it } from "vitest";

import { diffCatalogs } from "./catalog-diff.ts";
import { classificarDispensa } from "./exemption.ts";
import { MARCADOR_MUDANCA, TITULO_MUDANCAS, corpoDoPrMensal } from "./pr-body.ts";
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

const dispensaNegada = classificarDispensa({
  permitida: false,
  diffSoInerte: true,
  arquivosDoPr: ["backend/app/data/catalog.json"],
  contemFolhaDeOcr: false,
});

const padrao = {
  vereditos: resolverVereditos([lidoAmazon]),
  diff: semMudanca,
  vigias: [],
  dispensa: dispensaNegada,
};

describe("§3 — os TRÊS estados, SEMPRE, para TODOS os marketplaces (US2/AC3, SC-1003)", () => {
  it("declara cada marketplace da cobertura em 100% dos corpos", () => {
    const corpo = corpoDoPrMensal(padrao);
    for (const mk of MARKETPLACE_COVERAGE) expect(corpo).toContain(mk);
  });

  it("um marketplace sem veredito sai NÃO LIDO com o motivo — nunca omitido", () => {
    const corpo = corpoDoPrMensal(padrao);
    expect(corpo).toContain("NÃO LIDO");
    expect(corpo).toContain("o job não produziu veredito");
  });

  it("o abortado sai ABORTADO com o motivo nomeado (o PR parcial da Q4)", () => {
    const corpo = corpoDoPrMensal({
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
    expect(corpo).toContain("ABORTADO");
    expect(corpo).toContain("âncora do art. 26839 ausente");
    // e o LIDO continua LIDO — o PR é PARCIAL, não abortado inteiro
    expect(corpo).toContain("LIDO");
    expect(corpo).toContain("2026-09-01");
  });

  it("uma razão honesta declarada pelo coletor vence a genérica", () => {
    const corpo = corpoDoPrMensal({
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
    expect(corpo).toContain("sem credencial, fora do escopo do 017");
  });
});

describe("§4 — mudanças de tarifa, e a AUSÊNCIA delas (lição 014/US4)", () => {
  it("execução sem mudança ⇒ NENHUMA seção de mudança e NENHUM `antigo → novo`", () => {
    const corpo = corpoDoPrMensal(padrao);
    expect(corpo).not.toContain(TITULO_MUDANCAS);
    expect(corpo).not.toContain(MARCADOR_MUDANCA);
    expect(corpo).toContain("Sem mudança de tarifa");
  });

  it("uma folha mudada ⇒ exatamente ela, com fonte e data de coleta", () => {
    const corpo = corpoDoPrMensal({ ...padrao, diff: comUmaMudanca });
    expect(corpo).toContain(TITULO_MUDANCAS);
    expect(corpo).toContain(`14 ${MARCADOR_MUDANCA} 16`);
    expect(corpo).toContain("commissionPct");
    expect(corpo).toContain(SOURCE);
    expect(corpo).toContain("2026-09-01");
    expect(corpo).not.toContain("Sem mudança de tarifa");
    // uma linha de mudança, não duas
    expect(corpo.split(MARCADOR_MUDANCA).length - 1).toBe(1);
  });

  it("mudança material e prova-de-vida são MUTUAMENTE exclusivas no mesmo corpo", () => {
    const comRemocao = diffCatalogs(
      artefato([entrada("calcados"), entrada("oculos")]),
      artefato([entrada("calcados")]),
    );
    const corpo = corpoDoPrMensal({ ...padrao, diff: comRemocao });
    expect(corpo).not.toContain("Sem mudança de tarifa");
  });
});

describe("§4/AC5 — folha vinda de OCR carrega lido × anterior × link da imagem", () => {
  const folhaOcr = {
    rotulo: "Shopee — banda [80, 100) — comissão",
    lido: 15,
    anterior: 14,
    imagemUrl: "https://cf.shopee.com.br/file/abc123.png",
    acimaDoLimiar: false,
  };

  it("mesmo ABAIXO do limiar do banner, a evidência de revisão está presente", () => {
    const corpo = corpoDoPrMensal({ ...padrao, diff: comUmaMudanca, folhasDeOcr: [folhaOcr] });
    expect(corpo).toContain(folhaOcr.rotulo);
    expect(corpo).toContain(folhaOcr.imagemUrl);
    expect(corpo).toContain("lido");
    expect(corpo).toContain("anterior");
    // e NÃO há banner — o banner é o caso acima do limiar
    expect(corpo).not.toContain("acima do limiar declarado");
  });

  it("§2 — acima do limiar, o BANNER sai no topo (clarify Q8)", () => {
    const corpo = corpoDoPrMensal({
      ...padrao,
      diff: comUmaMudanca,
      folhasDeOcr: [{ ...folhaOcr, acimaDoLimiar: true }],
    });
    expect(corpo).toContain("acima do limiar declarado");
    expect(corpo.indexOf("acima do limiar declarado")).toBeLessThan(
      corpo.indexOf("Estado por marketplace"),
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
    expect(corpoDoPrMensal(padrao)).not.toContain("## Vigias");
  });

  it("com vigia, a seção existe e a frase 'nenhum dado alterado' é parte do TÍTULO", () => {
    const corpo = corpoDoPrMensal({ ...padrao, vigias: [vigia] });
    expect(corpo).toContain("## Vigias (nenhum dado alterado)");
    expect(corpo).toContain(vigia.resumo);
    expect(corpo).toContain(vigia.sourceUrl);
  });

  it("vigia com notícia + catálogo INTACTO ⇒ §5 presente, §4 ausente, dispensa NEGADA pelo eixo (b)", () => {
    const dispensa = classificarDispensa({
      permitida: true,
      diffSoInerte: true,
      arquivosDoPr: [
        "backend/app/data/catalog.json",
        "packages/fee-ingest/data/amazon-precos.baseline.json",
      ],
      contemFolhaDeOcr: false,
    });
    const corpo = corpoDoPrMensal({ ...padrao, vigias: [vigia], dispensa });
    expect(corpo).toContain("## Vigias (nenhum dado alterado)");
    expect(corpo).not.toContain(TITULO_MUDANCAS);
    expect(corpo).toContain("amazon-precos.baseline.json");
    expect(corpo).toMatch(/dispensa.*(negada|NÃO)/i);
  });
});

describe("§1 — a seção de DECISÃO, no TOPO de tudo (clarify Q2)", () => {
  const decisao = {
    titulo: "Amazon: a página e a tabela discordam sobre a tarifa por item",
    fonteA: {
      rotulo: "/precos (página)",
      valor: "R$ 2,50",
      url: "https://venda.amazon.com.br/precos",
    },
    fonteB: { rotulo: "AMAZON_INDIVIDUAL_PER_ITEM_FEE (servido)", valor: "R$ 2,00", url: SOURCE },
    autoDatacao: "20/01/2025",
  };

  it("quando não há decisão pendente, a seção não existe", () => {
    expect(corpoDoPrMensal(padrao)).not.toContain("DECISÃO DO DONO");
  });

  it("quando há, ela é a PRIMEIRA coisa do corpo, com A × B × auto-datação × as duas URLs", () => {
    const corpo = corpoDoPrMensal({ ...padrao, decisao });
    expect(corpo.indexOf("DECISÃO DO DONO")).toBeLessThan(corpo.indexOf("Estado por marketplace"));
    expect(corpo).toContain("R$ 2,50");
    expect(corpo).toContain("R$ 2,00");
    expect(corpo).toContain("20/01/2025");
    expect(corpo).toContain("https://venda.amazon.com.br/precos");
    expect(corpo).toContain(SOURCE);
  });

  it("página sem auto-datação diz isso, em vez de imprimir `null`", () => {
    const corpo = corpoDoPrMensal({ ...padrao, decisao: { ...decisao, autoDatacao: null } });
    expect(corpo).not.toContain("null");
    expect(corpo).toMatch(/não se auto-data|sem auto-datação/i);
  });
});

describe("§6 — o rodapé de dispensa imprime o ESTADO e o PORQUÊ (P0-b)", () => {
  it("desligada: o corpo diz que está desligada e por quê", () => {
    const corpo = corpoDoPrMensal(padrao);
    expect(corpo).toContain("ALLOW_FRESHNESS_EXEMPTION");
    expect(corpo).toMatch(/DESLIGADA/i);
  });

  it("ligada e concedida: o corpo diz que foi concedida e sob qual condição", () => {
    const dispensa = classificarDispensa({
      permitida: true,
      diffSoInerte: true,
      arquivosDoPr: ["backend/app/data/catalog.json"],
      contemFolhaDeOcr: false,
    });
    const corpo = corpoDoPrMensal({ ...padrao, dispensa });
    expect(corpo).toMatch(/dispensa.*concedida/i);
    expect(corpo).toContain("inerte");
  });

  it("o rodapé é o FIM do corpo — o estado da dispensa não se perde no meio", () => {
    const corpo = corpoDoPrMensal({ ...padrao, diff: comUmaMudanca, vigias: [] });
    expect(corpo.indexOf("ALLOW_FRESHNESS_EXEMPTION")).toBeGreaterThan(
      corpo.indexOf(TITULO_MUDANCAS),
    );
  });
});

describe("o corpo é FUNÇÃO PURA — o mesmo insumo dá o mesmo texto", () => {
  it("duas chamadas iguais produzem bytes iguais (nenhum `new Date()` escondido)", () => {
    expect(corpoDoPrMensal(padrao)).toBe(corpoDoPrMensal(padrao));
  });
});

describe("as OUTRAS notícias do diff — cada uma é decisão humana", () => {
  const comEspinha = (entries: unknown[], spine: unknown[]) => ({
    catalogVersion: "2026-07-28.1",
    marketplaces: [{ marketplace: "AMAZON", categorySpine: spine, entries }],
  });
  const no = (id: string, name: string, parentId: string | null = null) => ({ id, name, parentId });

  it("categoria NOVA na fonte aparece nomeada", () => {
    const diff = diffCatalogs(
      comEspinha([entrada("calcados")], [no("calcados", "Calçados")]),
      comEspinha(
        [entrada("calcados"), entrada("oculos")],
        [no("calcados", "Calçados"), no("oculos", "Óculos")],
      ),
    );
    const corpo = corpoDoPrMensal({ ...padrao, diff });
    expect(corpo).toContain("categoria NOVA na fonte");
    expect(corpo).toContain("Óculos");
    expect(corpo).not.toContain("Sem mudança de tarifa");
  });

  it("categoria REMOVIDA da fonte aparece nomeada", () => {
    const diff = diffCatalogs(
      comEspinha(
        [entrada("calcados"), entrada("oculos")],
        [no("calcados", "Calçados"), no("oculos", "Óculos")],
      ),
      comEspinha([entrada("calcados")], [no("calcados", "Calçados")]),
    );
    const corpo = corpoDoPrMensal({ ...padrao, diff });
    expect(corpo).toContain("Categorias removidas da fonte (decisão humana necessária)");
    expect(corpo).toContain("Óculos");
  });

  // FR-019a — muda a alíquota EFETIVA sem nenhum campo diferir. Sem esta seção o PR publicaria uma
  // mudança de preço sem uma linha que a descrevesse.
  it("categoria que mudou de PAI aparece, com o de-para", () => {
    const diff = diffCatalogs(
      comEspinha([entrada("calcados")], [no("moda", "Moda"), no("calcados", "Calçados", "moda")]),
      comEspinha([entrada("calcados")], [no("moda", "Moda"), no("calcados", "Calçados", null)]),
    );
    const corpo = corpoDoPrMensal({ ...padrao, diff });
    expect(corpo).toContain("mudou de pai");
    expect(corpo).toContain("(raiz)");
  });

  it("e no sentido contrário — da raiz para dentro de um pai — o de-para continua legível", () => {
    const diff = diffCatalogs(
      comEspinha([entrada("calcados")], [no("moda", "Moda"), no("calcados", "Calçados", null)]),
      comEspinha([entrada("calcados")], [no("moda", "Moda"), no("calcados", "Calçados", "moda")]),
    );
    const corpo = corpoDoPrMensal({ ...padrao, diff });
    expect(corpo).toContain("de (raiz) para moda");
  });

  it("um valor ESTRUTURADO vira JSON legível, nunca `[object Object]` (U34-a)", () => {
    const diff = diffCatalogs(
      artefato([entrada("calcados")]),
      artefato([entrada("calcados", { priceBands: [{ minPrice: 0, maxPrice: null }] })]),
    );
    const corpo = corpoDoPrMensal({ ...padrao, diff });
    expect(corpo).not.toContain("[object Object]");
    expect(corpo).toContain("minPrice");
  });

  it("mudança material de um marketplace SEM veredito LIDO declara a contradição, não a esconde", () => {
    const corpo = corpoDoPrMensal({
      ...padrao,
      vereditos: resolverVereditos([]),
      diff: comUmaMudanca,
    });
    expect(corpo).toContain("procedência não declarada");
  });

  it("o diff de baseline de um vigia viaja como evidência, em bloco", () => {
    const corpo = corpoDoPrMensal({
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
    expect(corpo).toContain("```diff");
    expect(corpo).toContain('"minimo": 2');
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

  const corpo = corpoDoPrMensal({
    ...padrao,
    vereditos: resolverVereditos([exaustivo]),
    diff: diffComRemocao,
  });

  it("a categoria removida sai NOMEADA, sob o título de decisão humana", () => {
    expect(corpo).toContain("Categorias removidas da fonte (decisão humana necessária)");
    expect(corpo).toContain("Colchões");
  });

  it("com a linha de procedência: seções exaustivas + data + URL", () => {
    expect(corpo).toContain("ausente na leitura EXAUSTIVA de `entries`+`categorySpine`");
    expect(corpo).toContain("em 2026-09-01");
    expect(corpo).toContain(SOURCE);
  });

  it("AUSÊNCIA: uma execução com remoção NUNCA imprime 'Sem mudança de tarifa'", () => {
    expect(corpo).not.toContain("Sem mudança de tarifa");
  });

  it("remoção SEM leitura exaustiva declarada é dita como o incidente que é", () => {
    const semDeclaracao = corpoDoPrMensal({
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
