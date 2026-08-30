import { describe, it, expect } from "vitest";

import { computeCalculator, grossUp } from "../src/index";
import type { ChannelFees, PriceBand, PriceInput } from "../src/index";

// 016/PR-F · T058 (US18 / FR-927 / ADR-0027 §3.1) — a taxa FIXA como função do preço.
//
// A Shopee publica, verbatim (art. 26839, releitura T057 registrada em dod-evidence §PR-F·T057):
//   "Para produtos com preço abaixo de R$8, o adicional por item é a metade do preço do produto.
//    Produtos acima de R$8 mantêm a comissão conforme a variação de valor do item;"
// ⇒ a comissão de 20% CONTINUA incidindo; o que vira função do preço é o ADICIONAL fixo.
// (A leitura "50% sem fixo" do OBTENCAO-DINAMICA §8 estava errada e NÃO é o que este teste crava.)
//
// O gross-up permanece FECHADO — nenhuma iteração nova:
//   L − (c/100)·L − (p/100)·L = base   ⇒   L = base / (1 − c/100 − p/100)
//
// Dinheiro por ADR-0008 (2 casas, HALF_UP), sempre sobre o anúncio JÁ arredondado (WYSIWYG).

/** A tabela Shopee catch-all DEPOIS da partição de `[0,80)` (PR-F/T063). */
const BANDS_SPLIT: PriceBand[] = [
  // Abaixo de R$ 8 o adicional é METADE do preço. `fixedFee: 0` é marcador inerte: com
  // `fixedFeeRule` presente o motor NUNCA lê a constante (é a regra que forma o fixo).
  {
    minPrice: 0,
    maxPrice: 8,
    commissionPct: 20,
    fixedFee: 0,
    fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
  },
  { minPrice: 8, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
  { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 16 },
  { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
  { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
];

/** A MESMA tabela como ela era ANTES da partição — a referência da prova byte-idêntica. */
const BANDS_PRE_016: PriceBand[] = [
  { minPrice: 0, maxPrice: 80, commissionPct: 20, fixedFee: 4 },
  { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 16 },
  { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 20 },
  { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 26 },
];

const fees = (priceBands: PriceBand[]): ChannelFees => ({ commissionPct: 0, priceBands });

describe("fixedFeeRule PCT_OF_PRICE — o gross-up continua fechado (ADR-0027 §3.1)", () => {
  it("base R$ 1,50 → anúncio R$ 5,00, com o adicional = metade do anúncio", () => {
    // L = 1,50 / (1 − 0,20 − 0,50) = 1,50 / 0,30 = 5,00
    // comissão = 20% × 5,00 = 1,00 · adicional = 50% × 5,00 = 2,50
    // líquido  = 5,00 − 1,00 − 2,50 = 1,50 ✓ (nets a base, que é a definição do gross-up)
    const r = grossUp(1.5, fees(BANDS_SPLIT));
    expect(r.anuncio).toBe(5);
    expect(r.liquido).toBe(1.5);
    expect(r.appliedBand).toEqual([0, 8]);
  });

  it("base R$ 2,10 → anúncio R$ 7,00 (mesma álgebra, outro ponto)", () => {
    // L = 2,10 / 0,30 = 7,00 · comissão 1,40 · adicional 3,50 · líquido 2,10
    const r = grossUp(2.1, fees(BANDS_SPLIT));
    expect(r.anuncio).toBe(7);
    expect(r.liquido).toBe(2.1);
  });

  it("base R$ 1,00 → anúncio R$ 3,33 (arredondamento HALF_UP sobre o anúncio)", () => {
    // L = 1,00 / 0,30 = 3,3333… → 3,33 (HALF_UP)
    // comissão = 20% × 3,33 = 0,666 · adicional = 50% × 3,33 = 1,665
    // líquido = 3,33 − 0,666 − 1,665 = 0,999 → 1,00
    const r = grossUp(1, fees(BANDS_SPLIT));
    expect(r.anuncio).toBe(3.33);
    expect(r.liquido).toBe(1);
  });

  // NÃO-VACUIDADE (padrão da casa): mudar o `pct` tem de mudar o preço. Sem isto, um `bandFixedFee`
  // que ignorasse a regra passaria em tudo acima.
  it("mutar o pct muda o preço (a regra não é decorativa)", () => {
    const mutated = BANDS_SPLIT.map((b) =>
      b.fixedFeeRule ? { ...b, fixedFeeRule: { kind: "PCT_OF_PRICE" as const, pct: 40 } } : b,
    );
    // L = 1,50 / (1 − 0,20 − 0,40) = 1,50 / 0,40 = 3,75
    const r = grossUp(1.5, fees(mutated));
    expect(r.anuncio).toBe(3.75);
    expect(r.liquido).toBe(1.5);
    expect(r.anuncio).not.toBe(5);
  });
});

// A TERCEIRA chamada de `bandFixedFee` — `chooseBand.at()`, onde ela forma o `net` que decide o
// RANKING. Ela sobreviveu à primeira rodada de mutação (trocar `bandFixedFee(applied, anuncio)` por
// `applied.fixedFee` deixou os 176 testes verdes), e a razão é instrutiva: na tabela Shopee real a
// banda com regra sempre responde por si mesma (rank 0), e num rank 0 o `net` nem é olhado. O `net`
// só decide quando a banda que COBRA não é a que produziu o anúncio — e aí um `net` superestimado
// promove uma resposta que NÃO entrega a base.
//
// Esta tabela é construída exatamente para esse ponto. Sem ela, o esquecimento mais caro dos três
// (o motor achando que o vendedor leva para casa o que ele não leva) passaria em silêncio.
describe("chooseBand.at — a regra forma o `net`, e o `net` é quem impede um preço que não entrega", () => {
  /**
   * Tabela construída para o ponto, e a construção é a única difícil das três: a comissão da banda
   * de baixo tem de ser MENOR que a de cima (senão a conta da banda de cima já entrega menos que a
   * base mesmo ignorando a regra, e a mutação não muda desfecho nenhum). Aqui 10% embaixo, 12% em
   * cima, e a regra de 50% é a ÚNICA coisa que separa "entrega" de "não entrega".
   */
  const DEGRAU: PriceBand[] = [
    {
      minPrice: 0,
      maxPrice: 10,
      commissionPct: 10,
      fixedFee: 0,
      fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
    },
    { minPrice: 10, maxPrice: null, commissionPct: 12, fixedFee: 0 },
  ];

  it("base R$ 6,00 → anúncio R$ 10,00 (o limiar), NUNCA R$ 6,83", () => {
    // R$ 6,83 é a conta da banda de CIMA (6 / 0,88), mas ele cai na banda de BAIXO, que cobra 10%
    // + metade do preço: entrega 6,83 − 0,68 − 3,42 = R$ 2,73 para uma base de R$ 6,00 — falta
    // R$ 3,27. Lendo a CONSTANTE da banda (0) em vez da regra, o motor calcula entrega R$ 6,15,
    // conclui que basta, e escolhe os R$ 6,83 por serem mais baratos que o limiar.
    const r = grossUp(6, fees(DEGRAU));
    expect(r.anuncio).toBe(10);
    expect(r.anuncio).not.toBe(6.83);
    expect(r.appliedBand).toEqual([10, null]);
    // E entrega de verdade: 10,00 − 12% = 8,80 ≥ 6,00. O excedente é dinheiro real do vendedor.
    expect(r.liquido).toBe(8.8);
  });

  it("o candidato descartado seria um DÉFICIT — medido, não suposto", () => {
    // A mesma conta pelo outro lado: R$ 6,83 é o anúncio de quem tem base R$ 2,73, não R$ 6,00.
    const oQueSeisOitentaTresEntrega = grossUp(2.73, fees(DEGRAU));
    expect(oQueSeisOitentaTresEntrega.anuncio).toBe(6.83);
    expect(oQueSeisOitentaTresEntrega.liquido).toBe(2.73);
    expect(oQueSeisOitentaTresEntrega.appliedBand).toEqual([0, 10]);
  });
});

describe("VARREDURA do limiar R$ 8 — o par (anúncio, líquido) é contínuo e sem banda emprestada", () => {
  /** Bases de R$ 0,30 a R$ 4,00 de centavo em centavo: o anúncio atravessa R$ 8 no meio. */
  const bases = Array.from({ length: 371 }, (_, i) => Number(((30 + i) / 100).toFixed(2)));
  const results = bases.map((b) => ({ base: b, ...grossUp(b, fees(BANDS_SPLIT)) }));

  it("nenhuma base da varredura fica sem preço (a tabela cobre a reta)", () => {
    expect(results.every((r) => r.anuncio !== null && r.liquido !== null)).toBe(true);
  });

  it("o anúncio NUNCA cai quando a base sobe (monotonicidade através do degrau)", () => {
    for (let i = 1; i < results.length; i += 1) {
      expect(results[i]!.anuncio!).toBeGreaterThanOrEqual(results[i - 1]!.anuncio!);
    }
  });

  it("a banda aplicada SEMPRE contém o anúncio (I9: nenhuma banda emprestada)", () => {
    for (const r of results) {
      const [min, max] = r.appliedBand!;
      expect(r.anuncio!).toBeGreaterThanOrEqual(min);
      if (max !== null) expect(r.anuncio!).toBeLessThan(max);
    }
  });

  it("o líquido entrega a base em toda a varredura (nunca menos, a menos do centavo)", () => {
    for (const r of results) {
      expect(r.liquido!).toBeGreaterThanOrEqual(r.base - 0.005);
    }
  });

  it("a travessia do limiar é contínua: R$ 2,39 · R$ 2,40 · R$ 2,41 → 7,97 · 8,00 · 8,01", () => {
    // O ponto que faz a costura fechar: em L = 8,00 as DUAS tabelas cobram o mesmo — metade de 8
    // é exatamente os R$ 4,00 constantes da faixa de cima. A fonte é contínua no limiar, e o motor
    // não inventa degrau nenhum.
    expect(grossUp(2.39, fees(BANDS_SPLIT)).anuncio).toBe(7.97);
    expect(grossUp(2.4, fees(BANDS_SPLIT)).anuncio).toBe(8);
    expect(grossUp(2.41, fees(BANDS_SPLIT)).anuncio).toBe(8.01);
    expect(grossUp(2.4, fees(BANDS_SPLIT)).liquido).toBe(2.4);
  });
});

describe("regressão zero (FR-927/SC-909): anúncio ≥ R$ 8 é BYTE-IDÊNTICO ao pré-016", () => {
  // A asserção correta é sobre o PAR (anúncio, líquido) numa varredura ATRAVESSANDO o limiar —
  // não sobre um caso pontual acima dele (ADR-0027 §5): `chooseBand` passa a avaliar também o
  // candidato de LIMIAR em R$ 8, e um limiar novo pode mexer numa resposta que já era publicável.
  const bases = Array.from({ length: 30_000 }, (_, i) => Number(((i + 1) / 100).toFixed(2)));
  // Uma passada só, reusada pelas três asserções (30 mil × 2 gross-ups): a varredura é o dado, e
  // recomputá-la por `it` é o que fazia o arquivo estourar o timeout sem provar nada a mais.
  const par = bases.map((base) => ({
    base,
    novo: grossUp(base, fees(BANDS_SPLIT)),
    velho: grossUp(base, fees(BANDS_PRE_016)),
  }));
  const acimaDoLimiar = par.filter(({ novo }) => novo.anuncio !== null && novo.anuncio >= 8);

  it("toda base cujo anúncio novo é ≥ R$ 8 reproduz o DINHEIRO anterior bit a bit", () => {
    // O que FR-927/SC-909 protege é o DINHEIRO — e o arquiteto nomeia a asserção correta (§B.1):
    // o par (anúncio, líquido) numa varredura atravessando o limiar. O frete entra junto porque
    // também é dinheiro deduzido. Divergências acumuladas e comparadas de uma vez: a lista é a
    // evidência; um `expect` por base só mostraria a primeira.
    const divergem = acimaDoLimiar.filter(
      ({ novo, velho }) =>
        novo.anuncio !== velho.anuncio ||
        novo.liquido !== velho.liquido ||
        novo.freightCost !== velho.freightCost,
    );
    expect(divergem).toEqual([]);
    // Não-vacuidade da própria varredura: ela precisa ter comparado algo.
    expect(acimaDoLimiar.length).toBeGreaterThan(29_000);
  });

  // O RÓTULO muda, e a mudança é a verdade nova — não uma folga que a asserção acima escondeu.
  // A partição criou a banda `[8,80)`, e é ELA que contém um anúncio de R$ 8,00 ou mais. Devolver
  // `[0,80)` depois da partição seria nomear uma banda que o catálogo servido não tem mais. Este
  // teste crava que a diferença é EXATAMENTE essa e nada além dela.
  it("a ÚNICA diferença é o rótulo da banda: [0,80) vira [8,80) e nada mais", () => {
    const diferentes = new Set(
      acimaDoLimiar
        .map(
          ({ novo, velho }) =>
            [JSON.stringify(velho.appliedBand), JSON.stringify(novo.appliedBand)] as const,
        )
        .filter(([v, n]) => v !== n)
        .map(([v, n]) => `${v}→${n}`),
    );
    expect([...diferentes]).toEqual(["[0,80]→[8,80]"]);
  });

  it("a partição NÃO cria preço onde a tabela antiga não tinha (nem apaga onde tinha)", () => {
    const discordam = par.filter(
      ({ novo, velho }) => (novo.anuncio === null) !== (velho.anuncio === null),
    );
    expect(discordam).toEqual([]);
  });
});

describe("I9 — sem banda publicada para o preço, o nível fica SEM referência", () => {
  // A entrada CPF_ALTO_VOLUME começa em R$ 12 (a regressiva abaixo disso não é publicada). Um
  // anúncio abaixo do piso não pode tomar emprestada a banda vizinha: "sem tarifa publicada" é um
  // ESTADO, não um número (SC-817).
  const CPF_ALTO_VOLUME: PriceBand[] = [
    { minPrice: 12, maxPrice: 80, commissionPct: 20, fixedFee: 7 },
    { minPrice: 80, maxPrice: 100, commissionPct: 14, fixedFee: 19 },
    { minPrice: 100, maxPrice: 200, commissionPct: 14, fixedFee: 23 },
    { minPrice: 200, maxPrice: null, commissionPct: 14, fixedFee: 29 },
  ];

  it("base baixa demais para alcançar R$ 12 ⇒ anúncio/líquido null", () => {
    const r = grossUp(1.5, fees(CPF_ALTO_VOLUME));
    expect(r.anuncio).toBeNull();
    expect(r.liquido).toBeNull();
    expect(r.appliedBand).toBeNull();
  });

  it("base que alcança a primeira banda publicada tem preço normal", () => {
    // L = (10 + 7) / 0,80 = 21,25
    const r = grossUp(10, fees(CPF_ALTO_VOLUME));
    expect(r.anuncio).toBe(21.25);
    expect(r.liquido).toBe(10);
  });

  // O DEFEITO que este bloco existe para matar, e ele NÃO estava no motor de 4.0.0 por acaso:
  // até 016 toda tabela publicada começava em R$ 0, então nenhum anúncio podia cair fora dela.
  // A entrada CPF_ALTO_VOLUME é a primeira com PISO, e sem a guarda o motor respondia R$ 12,00
  // para uma base de R$ 1,50 — empurrando o vendedor até a borda da tabela e afirmando, sob selo,
  // que R$ 12,00 é o mais barato que dá. A própria fonte desmente (art. 26839: R$ 6,00 de taxa num
  // item de R$ 8), e a fórmula abaixo de R$ 12 ela não publica. Logo: sem referência.
  it("sem a guarda o motor devolveria o PISO (R$ 12,00) — e é isso que ele não pode fazer", () => {
    // O número que a versão sem guarda produzia, cravado para que a regressão apareça pelo NOME.
    const semGuarda = 12;
    const r = grossUp(1.5, fees(CPF_ALTO_VOLUME));
    expect(r.anuncio).not.toBe(semGuarda);
    expect(r.anuncio).toBeNull();
  });

  it("a fronteira é exata: base 2,59 fica sem referência, base 2,60 fecha em R$ 12,00", () => {
    // A conta da banda [12,80) é L = (base + 7) / 0,80. Ela alcança o piso publicado exatamente
    // em base 2,60 → 12,00. Um centavo abaixo ela fecha em 11,99, que a tabela não tarifa.
    expect(grossUp(2.59, fees(CPF_ALTO_VOLUME)).anuncio).toBeNull();
    const naFronteira = grossUp(2.6, fees(CPF_ALTO_VOLUME));
    expect(naFronteira.anuncio).toBe(12);
    expect(naFronteira.appliedBand).toEqual([12, 80]);
    expect(naFronteira.liquido).toBe(2.6); // 12,00 − 2,40 − 7,00
  });

  // A guarda tem de distinguir FORA DA TABELA de LACUNA DENTRO da tabela. O platô do ML em
  // R$ 79,00 é o segundo caso: todo preço entre a resposta natural e R$ 79,00 ESTÁ publicado e
  // nenhum entrega a base, então subir é honesto. Se a guarda matasse isso, ela teria trocado um
  // defeito por outro — e é exatamente essa confusão que este teste impede.
  it("uma LACUNA interna continua sendo precificada pelo platô (o ML em R$ 79,00 sobrevive)", () => {
    const ML: PriceBand[] = [
      { minPrice: 0, maxPrice: 12.5, commissionPct: 50, fixedFee: 0 },
      { minPrice: 12.5, maxPrice: 79, commissionPct: 12, fixedFee: 5 },
      { minPrice: 79, maxPrice: null, commissionPct: 12, fixedFee: 0 },
    ];
    const r = grossUp(64.52, { commissionPct: 12, fixedFee: 0, priceBands: ML });
    expect(r.anuncio).toBe(79);
    expect(r.liquido).toBe(69.52);
  });
});

describe("recusas declaradas — erro por SLOT nomeado, nunca um Infinity sob selo", () => {
  const base: PriceInput = {
    costPerRoll: 100,
    rollWeightKg: 1,
    printGrams: 100,
    printTimeHours: 5,
    avgPowerKw: 0.1,
    tariffPerKwh: 1,
    machineValue: 4000,
    machineLifetimeHours: 2000,
    markupVarejoPct: 50,
    markupAtacadoPct: 30,
  };

  it("fixedFeeRule fora de bandMode SELECTION é erro de forma", () => {
    const r = computeCalculator({
      ...base,
      channels: [
        {
          marketplace: "SHOPEE",
          commissionPct: 0,
          bandMode: "PROGRESSIVE",
          priceBands: [
            {
              minPrice: 0,
              maxPrice: null,
              commissionPct: 20,
              fixedFee: 0,
              fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 50 },
            },
          ],
        },
      ],
    });
    expect(r.channels[0]!.error).toMatch(/fixedFeeRule/);
    expect(r.channels[0]!.error).toMatch(/SELECTION/);
    expect(r.channels[0]!.precoAnuncioVarejo).toBeNull();
  });

  it("commissionPct + pct ≥ 100 é recusado (o denominador zeraria/inverteria)", () => {
    const r = computeCalculator({
      ...base,
      channels: [
        {
          marketplace: "SHOPEE",
          commissionPct: 0,
          priceBands: [
            {
              minPrice: 0,
              maxPrice: null,
              commissionPct: 60,
              fixedFee: 0,
              fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 40 },
            },
          ],
        },
      ],
    });
    expect(r.channels[0]!.error).toMatch(/priceBands\[0\]/);
    expect(r.channels[0]!.precoAnuncioVarejo).toBeNull();
    expect(r.channels[0]!.recebidoLiquidoVarejo).toBeNull();
  });

  it("um pct fora de (0, 100) é recusado pelo nome da banda", () => {
    const r = computeCalculator({
      ...base,
      channels: [
        {
          marketplace: "SHOPEE",
          commissionPct: 0,
          priceBands: [
            { minPrice: 0, maxPrice: 8, commissionPct: 20, fixedFee: 0 },
            {
              minPrice: 8,
              maxPrice: null,
              commissionPct: 20,
              fixedFee: 0,
              fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 0 },
            },
          ],
        },
      ],
    });
    expect(r.channels[0]!.error).toMatch(/priceBands\[1\]/);
  });

  it("o primitivo `grossUp` também recusa: SEM referência, jamais Infinity", () => {
    const r = grossUp(10, {
      commissionPct: 0,
      priceBands: [
        {
          minPrice: 0,
          maxPrice: null,
          commissionPct: 60,
          fixedFee: 0,
          fixedFeeRule: { kind: "PCT_OF_PRICE", pct: 40 },
        },
      ],
    });
    expect(r.anuncio).toBeNull();
    expect(Number.isFinite(r.anuncio ?? 0)).toBe(true);
  });
});
