import { describe, expect, it } from "vitest";

import { CHANGED_ROWS_CEILING, decideRefresh, prBody } from "./refresh";

// 014/US4 — o ORQUESTRADOR do laço mensal, como decisão pura. O `.mjs` que roda no CI só junta rede
// e disco em volta disto; tudo que decide fica aqui, onde é testável e cai sob o ratchet de 100%.
//
// A propriedade que governa o módulo inteiro está na FR-020a e é estrutural, não uma checagem: o job
// SEMPRE abre PR e NUNCA escreve no branch de integração. Por isso o resultado é uma união de dois
// casos — abortar ou abrir PR — e não existe um terceiro que escreva. Um `if` esquecido não pode
// criar um caminho de escrita que o tipo não tem.

const SOURCE = "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920";

const entry = (category: string, over: Record<string, unknown> = {}) => ({
  determinants: { plan: "PROFISSIONAL", category },
  commissionPct: 14,
  minPerItem: 1,
  lastReviewed: "2026-07-28",
  ...over,
});

const artifact = (entries: unknown[], spine: unknown[] = []) => ({
  catalogVersion: "2026-07-28.1",
  marketplaces: [{ marketplace: "AMAZON", categorySpine: spine, entries }],
});

const NODE = (id: string, name: string) => ({ id, name, parentId: null });

const ok = { ok: true } as const;
const base = {
  marketplace: "AMAZON",
  collectedAt: "2026-08-01",
  sourceUrl: SOURCE,
  sanity: ok,
};

describe("decideRefresh — o job só tem dois desfechos, e escrever não é um deles (FR-020a)", () => {
  // T043/T044 — as duas falhas que a fonte pode dar têm de sair pelo MESMO buraco. "0 categorias"
  // nunca pode ser lido como "as taxas caíram": é a fonte que mudou de forma, e a resposta é não
  // publicar nada. O artefato fica intocado e `lastReviewed` não avança para valor nenhum.
  it("T043: leitura que falhou ⇒ ABORT, sem PR", () => {
    const out = decideRefresh({
      ...base,
      sanity: { ok: false, reason: 'canary "Outros" is missing from the parse' },
      before: artifact([entry("calcados")]),
      after: artifact([]),
    });
    expect(out.kind).toBe("ABORT");
    expect(out.kind === "ABORT" && out.reason).toContain("Outros");
  });

  it("T044: parse vazio/encolhido produz o MESMO desfecho de uma falha de rede", () => {
    const encolhido = decideRefresh({
      ...base,
      sanity: {
        ok: false,
        reason: "parsed 3 categories, below the 28 floor — source shape changed",
      },
      before: artifact([entry("calcados")]),
      after: artifact([]),
    });
    const rede = decideRefresh({
      ...base,
      sanity: { ok: false, reason: "fetch failed" },
      before: artifact([entry("calcados")]),
      after: artifact([]),
    });
    expect(encolhido.kind).toBe(rede.kind);
    expect(encolhido.kind).toBe("ABORT");
  });

  // T045/Q7 — a execução sem novidade é a PROVA MENSAL de que o robô está vivo. Ela abre PR (o job
  // nunca escreve direto), e é o único caso em que a revisão pode ser dispensada.
  it("T045: execução sem mudança ⇒ PR que mexe só em `lastReviewed`, e só ele dispensa revisão", () => {
    const antes = artifact([entry("calcados")]);
    const depois = artifact([entry("calcados", { lastReviewed: "2026-08-01" })]);
    const out = decideRefresh({ ...base, before: antes, after: depois });
    expect(out.kind).toBe("PR");
    expect(out.kind === "PR" && out.mayAutoMerge).toBe(true);
  });

  // T049b — a metade que importa do classificador: dinheiro NUNCA é dispensado.
  it("T049b: qualquer campo de dinheiro derruba a dispensa", () => {
    const antes = artifact([entry("calcados")]);
    const depois = artifact([entry("calcados", { commissionPct: 16, lastReviewed: "2026-08-01" })]);
    const out = decideRefresh({ ...base, before: antes, after: depois });
    expect(out.kind).toBe("PR");
    expect(out.kind === "PR" && out.mayAutoMerge).toBe(false);
  });

  // T050a — o teto de linhas alteradas. Uma leitura de coluna errada que passe pelas canárias ainda
  // move QUASE TODAS as linhas de uma vez, e nenhuma tabela publicada muda assim num mês. Acima do
  // teto o desfecho é ABORT — não um PR gigante que ninguém lê de verdade.
  it("T050a: mudança acima do teto de linhas é falha de FORMA, não notícia de tarifa", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `cat-${i}`);
    const antes = artifact(ids.map((c) => entry(c)));
    const depois = artifact(ids.map((c) => entry(c, { commissionPct: 9 })));
    const out = decideRefresh({ ...base, before: antes, after: depois });
    expect(out.kind).toBe("ABORT");
    expect(out.kind === "ABORT" && out.reason).toMatch(/100%|linhas|rows/i);
  });

  it("T050a: uma mudança de tarifa NORMAL (poucas linhas) passa e vira PR", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `cat-${i}`);
    const antes = artifact(ids.map((c) => entry(c)));
    const depois = artifact(
      ids.map((c, i) => (i === 0 ? entry(c, { commissionPct: 16 }) : entry(c))),
    );
    const out = decideRefresh({ ...base, before: antes, after: depois });
    expect(out.kind).toBe("PR");
    expect(out.kind === "PR" && out.mayAutoMerge).toBe(false);
    expect(CHANGED_ROWS_CEILING).toBeGreaterThan(0);
    expect(CHANGED_ROWS_CEILING).toBeLessThan(1);
  });

  // A garantia estrutural da FR-020a, asserida sobre a superfície e não sobre um comentário: por mais
  // que se varie a entrada, os únicos desfechos possíveis são abortar e abrir PR.
  it("T049b: nenhuma entrada produz um desfecho que ESCREVA — a união só tem dois casos", () => {
    const casos = [
      { sanity: ok, before: artifact([]), after: artifact([]) },
      { sanity: ok, before: artifact([entry("a")]), after: artifact([]) },
      { sanity: ok, before: artifact([]), after: artifact([entry("a")]) },
      { sanity: { ok: false, reason: "x" } as const, before: artifact([]), after: artifact([]) },
    ];
    for (const c of casos) {
      expect(["ABORT", "PR"]).toContain(decideRefresh({ ...base, ...c }).kind);
    }
  });
});

describe("prBody — o contrato com o humano que revisa (§C3)", () => {
  // T042 — o corpo do PR é a interface do laço. Cabeçalho com marketplace, data e URL da fonte; uma
  // linha por (categoria, campo) com antes → depois. Um diff que o revisor não consegue ler é um
  // diff que ele aprova sem conferir.
  it("T042: cabeçalho nomeia marketplace, data e fonte; a tabela lista old → new POR CATEGORIA", () => {
    const antes = artifact([entry("calcados")], [NODE("calcados", "Calçados")]);
    const depois = artifact(
      [entry("calcados", { commissionPct: 16, lastReviewed: "2026-08-01" })],
      [NODE("calcados", "Calçados")],
    );
    const out = decideRefresh({ ...base, before: antes, after: depois });
    const body = out.kind === "PR" ? out.body : "";
    expect(body).toContain("AMAZON");
    expect(body).toContain("2026-08-01");
    expect(body).toContain(SOURCE);
    expect(body).toContain("| Calçados | commissionPct | 14 | 16 |");
  });

  // T046 — uma categoria que SUMIU da fonte ganha seção própria. Não é apagada em silêncio nem
  // revalidada: some porque o marketplace parou de publicá-la, e isso é decisão humana.
  it("T046: categoria removida da fonte tem seção própria, com o nome que ela tinha", () => {
    const antes = artifact([entry("meli-plus")], [NODE("meli-plus", "Assinatura do MELI Plus")]);
    const depois = artifact([], []);
    const out = decideRefresh({ ...base, before: antes, after: depois });
    const body = out.kind === "PR" ? out.body : "";
    expect(body).toMatch(/removidas da fonte/i);
    expect(body).toContain("Assinatura do MELI Plus");
    expect(out.kind === "PR" && out.mayAutoMerge).toBe(false);
  });

  it("uma execução sem novidade diz isso em palavras — é a prova mensal de que o robô está vivo", () => {
    const antes = artifact([entry("calcados")]);
    const depois = artifact([entry("calcados", { lastReviewed: "2026-08-01" })]);
    const out = decideRefresh({ ...base, before: antes, after: depois });
    expect(out.kind === "PR" && out.body).toMatch(/sem mudança|nenhuma mudança/i);
  });

  it("o corpo é montado a partir do diff, e um diff vazio não inventa tabela", () => {
    const corpo = prBody({
      marketplace: "AMAZON",
      collectedAt: "2026-08-01",
      sourceUrl: SOURCE,
      diff: {
        changedEntries: [],
        addedCategories: [],
        removedCategories: [],
        reparented: [],
        removedEntries: [],
        addedMarketplaces: [],
        removedMarketplaces: [],
        freshnessOnly: true,
      },
    });
    expect(corpo).not.toContain("| categoria |");
  });
});

// As demais seções do corpo. Cada uma é uma pergunta diferente para o revisor, e nenhuma pode sair
// como um "algo mudou" mudo — que foi exatamente o defeito que a T104 corrigiu no comparador.
describe("prBody — as seções que dirigem a atenção do revisor", () => {
  const corpo = (diff: Partial<Parameters<typeof prBody>[0]["diff"]>) =>
    prBody({
      marketplace: "AMAZON",
      collectedAt: "2026-08-01",
      sourceUrl: SOURCE,
      diff: {
        changedEntries: [],
        addedCategories: [],
        removedCategories: [],
        reparented: [],
        removedEntries: [],
        addedMarketplaces: [],
        removedMarketplaces: [],
        freshnessOnly: true,
        ...diff,
      },
    });

  it("categoria nova é nomeada com o id que ela recebeu", () => {
    const b = corpo({
      addedCategories: [{ marketplace: "AMAZON", categoryId: "joias", name: "Joias" }],
    });
    expect(b).toMatch(/Categorias novas/i);
    expect(b).toContain("Joias");
    expect(b).toContain("joias");
  });

  it("entrada que deixou de existir diz o que o vendedor perde: o slot para de resolver", () => {
    const b = corpo({
      removedEntries: [
        {
          marketplace: "AMAZON",
          categoryId: "calcados",
          determinants: { plan: "PROFISSIONAL", category: "calcados" },
        },
      ],
    });
    expect(b).toMatch(/deixaram de existir/i);
    expect(b).toContain("deixa de resolver");
  });

  // FR-019a — muda a alíquota EFETIVA sem nenhum campo diferir. Sem esta seção o PR publicaria uma
  // mudança de preço sem uma linha que a descrevesse.
  it("mudança de pai tem seção própria, e a raiz é dita como raiz e não como vazio", () => {
    const b = corpo({
      reparented: [
        {
          marketplace: "AMAZON",
          categoryId: "smartphones",
          name: "Smartphones",
          parentBefore: null,
          parentAfter: "celulares",
        },
      ],
    });
    expect(b).toMatch(/mudaram de pai/i);
    expect(b).toContain("(raiz) → celulares");
  });

  it("sem nome de categoria, o id serve; sem os dois, o corpo diz isso em vez de imprimir vazio", () => {
    const semNome = corpo({
      changedEntries: [
        {
          marketplace: "AMAZON",
          categoryId: "calcados",
          categoryName: null,
          determinants: null,
          changes: [{ path: "commissionPct", before: 14, after: 16 }],
        },
      ],
    });
    expect(semNome).toContain("| calcados | commissionPct | 14 | 16 |");

    const semNada = corpo({
      changedEntries: [
        {
          marketplace: "AMAZON",
          categoryId: null,
          categoryName: null,
          determinants: null,
          changes: [{ path: "minPerItem", before: undefined, after: 1 }],
        },
      ],
    });
    // Um campo que NÃO EXISTIA antes é ausência, não a string "undefined".
    expect(semNada).toContain("| (sem categoria) | minPerItem | — | 1 |");
  });
});

// O denominador do teto lê o artefato ANTERIOR, que pode chegar disforme (mesma classe da T105). Ele
// degrada para zero em vez de estourar — e com zero o teto simplesmente não se aplica, que é o
// desfecho certo: um artefato anterior ilegível não é evidência de mudança em bloco.
describe("o teto degrada com um artefato anterior disforme", () => {
  it("`marketplaces` não-array e `entries` não-array não estouram, e não disparam o teto", () => {
    const semLista = { catalogVersion: "x", marketplaces: { AMAZON: {} } };
    const entradasTortas = {
      catalogVersion: "x",
      marketplaces: [{ marketplace: "AMAZON", entries: {} }],
    };
    for (const antes of [semLista, entradasTortas]) {
      const out = decideRefresh({
        ...base,
        before: antes as never,
        after: artifact([entry("calcados", { commissionPct: 16 })]),
      });
      expect(out.kind).toBe("PR");
    }
  });

  it("categoria que virou RAIZ também é dita em palavras", () => {
    const b = prBody({
      marketplace: "AMAZON",
      collectedAt: "2026-08-01",
      sourceUrl: SOURCE,
      diff: {
        changedEntries: [],
        addedCategories: [],
        removedCategories: [],
        reparented: [
          {
            marketplace: "AMAZON",
            categoryId: "celulares",
            name: "Celulares",
            parentBefore: "eletronicos",
            parentAfter: null,
          },
        ],
        removedEntries: [],
        addedMarketplaces: [],
        removedMarketplaces: [],
        freshnessOnly: false,
      },
    });
    expect(b).toContain("eletronicos → (raiz)");
  });
});

// Achados da análise em 3 lentes (2026-07-31), ambos confirmados por medição própria. Os dois
// passaram por uma razão só: todo teste asseria PRESENÇA, e nenhum asseria AUSÊNCIA. Um corpo que
// diz A e mostra não-A satisfaz os dois `toContain`.
describe("a prova-de-vida não pode contradizer a seção logo abaixo dela", () => {
  const comSecao = (over: Record<string, unknown>) =>
    prBody({
      marketplace: "AMAZON",
      collectedAt: "2026-08-01",
      sourceUrl: SOURCE,
      diff: {
        changedEntries: [],
        addedCategories: [],
        removedCategories: [],
        reparented: [],
        removedEntries: [],
        addedMarketplaces: [],
        removedMarketplaces: [],
        freshnessOnly: false,
        ...over,
      },
    });

  const SEM_MUDANCA = /Sem mudança de tarifa/;

  it("categoria removida: a frase 'sem mudança' NÃO aparece", () => {
    const b = comSecao({
      removedCategories: [{ marketplace: "AMAZON", categoryId: "joias", name: "Joias" }],
    });
    expect(b).toMatch(/removidas da fonte/i);
    expect(b).not.toMatch(SEM_MUDANCA);
  });

  it("categoria nova, entrada sumida, mudança de pai e marketplace: nenhuma convive com a frase", () => {
    const casos = [
      { addedCategories: [{ marketplace: "AMAZON", categoryId: "j", name: "Joias" }] },
      { removedEntries: [{ marketplace: "AMAZON", categoryId: "j", determinants: null }] },
      {
        reparented: [
          {
            marketplace: "AMAZON",
            categoryId: "j",
            name: "Joias",
            parentBefore: null,
            parentAfter: "x",
          },
        ],
      },
      { addedMarketplaces: ["SHOPEE"] },
      { removedMarketplaces: ["SHOPEE"] },
    ];
    for (const c of casos) expect(comSecao(c)).not.toMatch(SEM_MUDANCA);
  });

  it("e o caso são continua dizendo — senão o conserto teria matado a prova-de-vida", () => {
    expect(comSecao({ freshnessOnly: true })).toMatch(SEM_MUDANCA);
  });
});

// O pacote precisa BOOTAR sob `node`, não só sob o vitest. O vitest resolve `./x` sem extensão; o
// `node` que roda `build-amazon.mjs` não — e a cadeia estava quebrada desde o PR-A (`461a367`), o que
// tornava falsa a frase "o laço roda por node" do dod-evidence. Nenhum teste podia ver isso porque
// todos rodam sob o vitest, que é justamente o resolvedor tolerante.
describe("todo import relativo de VALOR carrega extensão explícita (o pacote roda sob `node`)", () => {
  it("nenhum arquivo de produção importa `./x` sem `.ts`", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const dir = fileURLToPath(new URL(".", import.meta.url));
    const ofensores: string[] = [];
    for (const f of readdirSync(dir)) {
      // U5-c — os `.mjs` entram: e justamente o UNICO arquivo que o `node` executa, e o que a
      // guarda existia para proteger. Ela olhava so os `.ts` e deixava de fora o ponto de entrada.
      if (!/\.(ts|mjs)$/.test(f) || f.endsWith(".test.ts")) continue;
      for (const linha of readFileSync(`${dir}${f}`, "utf8").split("\n")) {
        const m = /from "(\.\/[^"]+)"/.exec(linha);
        if (m && !m[1].endsWith(".ts")) ofensores.push(`${f}: ${m[1]}`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});

// U4-a (follow-up ALTO da analise em 3 lentes, 2026-07-31) — o denominador do teto CRUZA
// marketplaces. `entryCount` soma as entradas de TODOS eles, enquanto o numerador so conta as
// materialmente alteradas — que hoje vem so da Amazon, o unico marketplace regenerado.
//
// Hoje da no mesmo por acidente. No dia em que o ML entrar (US6, a outra metade desta mesma feature)
// o denominador cresce e o teto MORRE CALADO: uma leitura da Amazon que mudasse a tabela inteira
// passaria, porque as entradas do ML diluiriam a fracao. Um alarme que se desliga sozinho quando o
// sistema cresce e pior que nenhum, porque ninguem nota o desligamento.
describe("o teto mede o marketplace da EXECUCAO, nao o catalogo inteiro (U4-a)", () => {
  const entryFor = (cat: string, over: Record<string, unknown> = {}) => ({
    determinants: { plan: "PROFISSIONAL", category: cat },
    commissionPct: 14,
    lastReviewed: "2026-07-28",
    ...over,
  });
  const cat = (amazon: unknown[], outros: unknown[]) => ({
    catalogVersion: "2026-07-28.1",
    marketplaces: [
      { marketplace: "AMAZON", categorySpine: [], entries: amazon },
      { marketplace: "MERCADO_LIVRE", categorySpine: [], entries: outros },
    ],
  });

  const ids = Array.from({ length: 12 }, (_, i) => `a-${i}`);
  const mlIds = Array.from({ length: 40 }, (_, i) => `m-${i}`);
  const ml = mlIds.map((c) => entryFor(c));

  it("a Amazon inteira mudando ABORTA, mesmo com o ML enchendo o catalogo", () => {
    const antes = cat(
      ids.map((c) => entryFor(c)),
      ml,
    );
    const depois = cat(
      ids.map((c) => entryFor(c, { commissionPct: 9 })),
      ml,
    );
    const out = decideRefresh({ ...base, before: antes as never, after: depois as never });
    // 12 de 12 entradas da Amazon = 100%. Sobre o catalogo inteiro seriam 12/52 = 23% e passaria.
    expect(out.kind).toBe("ABORT");
  });

  it("e uma mudanca pequena na Amazon continua passando", () => {
    const antes = cat(
      ids.map((c) => entryFor(c)),
      ml,
    );
    const depois = cat(
      ids.map((c, i) => (i === 0 ? entryFor(c, { commissionPct: 16 }) : entryFor(c))),
      ml,
    );
    expect(decideRefresh({ ...base, before: antes as never, after: depois as never }).kind).toBe(
      "PR",
    );
  });
});

// U34-a — o corpo do PR mostrava `[object Object]` onde deveria dizer QUAL banda mudou.
//
// `leafChanges` desce arrays por indice, entao uma banda que muda de valor sai como
// `priceBands.0.commissionPct: 15 -> 12`, legivel. Mas quando uma categoria GANHA ou PERDE bandas
// inteiras — plana viando faixa, ou o contrario —, um lado e `null` e o outro e o array inteiro: nao
// ha par de objetos para descer, e `String(array)` devolve `[object Object]`.
//
// E dinheiro, e e a classe exata que o §C3 existe para impedir: "um diff que o revisor nao consegue
// ler e um diff que ele aprova sem conferir". PRE-EXISTENTE da US4, achada abrindo o artefato gerado.
describe("o corpo do PR nunca diz [object Object] sobre dinheiro (U34-a)", () => {
  const comBandas = (bands: unknown) => ({
    determinants: { plan: "PROFISSIONAL", category: "moveis" },
    commissionPct: 15,
    priceBands: bands,
    lastReviewed: "2026-07-28",
  });
  const cat = (entries: unknown[]) => ({
    catalogVersion: "2026-07-28.1",
    marketplaces: [{ marketplace: "AMAZON", categorySpine: [], entries }],
  });

  it("categoria que GANHA bandas mostra as bandas, nao [object Object]", () => {
    const antes = cat([comBandas(null)]);
    const depois = cat([
      comBandas([{ minPrice: 0, maxPrice: 200, commissionPct: 15, fixedFee: 0 }]),
    ]);
    const out = decideRefresh({ ...base, before: antes as never, after: depois as never });
    const body = out.kind === "PR" ? out.body : "";
    expect(body).not.toContain("[object Object]");
    expect(body).toContain("minPrice"); // o revisor precisa ver a fronteira
    expect(body).toContain("200");
  });

  it("categoria que PERDE bandas tambem — a direcao contraria e a mesma mentira", () => {
    const antes = cat([
      comBandas([{ minPrice: 0, maxPrice: 200, commissionPct: 15, fixedFee: 0 }]),
    ]);
    const depois = cat([comBandas(null)]);
    const out = decideRefresh({ ...base, before: antes as never, after: depois as never });
    const body = out.kind === "PR" ? out.body : "";
    expect(body).not.toContain("[object Object]");
    expect(body).toContain("200");
  });
});

// 017/§C.2-bis regra 4 — O TETO PASSA A CONTAR REMOÇÃO.
//
// Medição do arquiteto: `changed` contava só `materialEntries`, e remoções vivem em
// `diff.removedEntries` — fora do numerador. Com a exaustividade declarada isso vira um buraco REAL:
// uma leitura encolhida que passe o piso de linhas removeria entradas em bloco sem que o teto
// sequer olhasse. O teto existe exatamente para a mudança em bloco, e uma tabela que perde metade
// das linhas é a mudança em bloco mais óbvia que existe.
describe("teto de mudança em bloco — a remoção entra no numerador (§C.2-bis regra 4)", () => {
  const muitas = (n: number, de = 0) => Array.from({ length: n }, (_, i) => entry(`cat-${i + de}`));

  it("uma leitura ENCOLHIDA (30 de 40 entradas somem) estoura o teto e ABORTA", () => {
    const out = decideRefresh({
      ...base,
      before: artifact(muitas(40)),
      after: artifact(muitas(10)),
    });
    expect(out.kind).toBe("ABORT");
    expect(out.kind === "ABORT" && out.reason).toMatch(/acima do teto/);
  });

  it("uma remoção PEQUENA continua passando — o alarme é para bloco, não para faxina da fonte", () => {
    const out = decideRefresh({
      ...base,
      before: artifact(muitas(40)),
      after: artifact(muitas(38)),
    });
    expect(out.kind).toBe("PR");
  });

  it("materiais e removidas SOMAM: 15 mudadas + 10 removidas de 40 estoura (nenhuma sozinha estouraria)", () => {
    const antes = muitas(40);
    const depois = [...muitas(15).map((e) => ({ ...e, commissionPct: 19 })), ...muitas(15, 15)];
    const out = decideRefresh({ ...base, before: artifact(antes), after: artifact(depois) });
    expect(out.kind).toBe("ABORT");
  });
});
