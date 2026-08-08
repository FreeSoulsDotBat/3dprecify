import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { grossUp } from "../src/index";
import type { PriceBand } from "../src/index";

// A1-r — O ANÚNCIO DOMINADO. `chooseBand` ordena por rank e só depois pelo anúncio mais barato
// (`channels.ts`), então um candidato auto-consistente CARO vence um não-auto-consistente BARATO que
// entregaria a mesma base. Quando isso acontece o selo não mente — o vendedor recebe o que pediu —,
// mas o comprador vê um preço mais alto do que precisava: existia anúncio melhor.
//
// POR QUE ESTE ARQUIVO EXISTE, E POR QUE ELE NÃO É UM DETECTOR NA INGESTÃO.
//
// A hipótese natural era que o gatilho fosse a "forma-vale" — o líquido cair ao subir de banda — e
// que bastasse recusá-la na ingestão. MEDIDO 2026-08-01, e a hipótese é FALSA nas duas direções:
//
//   ML-contiguas             | vale=sim | dominados=0
//   ML-com-lacuna            | vale=sim | dominados=0
//   Amazon-15-para-10        | vale=não | dominados=0
//   VALE-banda-superior-pior | vale=sim | dominados=0   (construída para ser patológica)
//   VALE-fixo-pula           | vale=sim | dominados=0   (idem)
//   LACUNA-sem-vale          | vale=não | dominados=0
//
// Cinco tabelas com vale, zero pontos dominados em ~71 mil. E a tabela REAL do ML já tem vale hoje
// (50% até 12,50 → 12% + R$ 5,00 fixo faz o líquido cair de 6,245 para 6,00 na fronteira), então um
// detector de vale alarmaria no primeiro mês do ML sobre uma tabela correta — o falso positivo
// mensal que a US5 nomeia como o jeito de treinar quem revisa a ignorar o alarme.
//
// Não se detecta uma forma que não se sabe nomear. Então o guarda testa a PROPRIEDADE em vez de um
// proxy adivinhado dela, e dispara no dia em que qualquer tabela produzir o sintoma, seja qual for a
// forma dela. O que este arquivo prova: em todo ponto varrido, o anúncio publicado É o mais barato
// que entrega a base. O que ele NÃO prova: que nenhuma tabela concebível o viole — por isso a
// varredura inclui adversárias construídas, e não só as publicadas.

/** Faixa aplicável — meia-aberta, inclusiva embaixo. Reimplementada de propósito: o teste não pode
 *  confiar no mesmo auxiliar que o código sob teste usa para se dizer correto. */
const bandOf = (bands: PriceBand[], p: number): PriceBand | null =>
  bands.find((b) => p >= b.minPrice && (b.maxPrice === null || p < b.maxPrice)) ?? null;

/** Líquido de um anúncio — `null` quando ele cai numa LACUNA, que não é resposta publicável.
 *
 *  017/T013 — O `fixedFeeRule` ENTRA NA CONTA, e a ausência dele aqui era um DEFEITO REAL deste
 *  guarda, encontrado no instante em que a tabela publicada da Shopee entrou na varredura: 5
 *  contraexemplos, todos FALSOS. A regra chegou com o ADR-0027 (016/PR-F) e o comparador ficou para
 *  trás, porque nenhuma das tabelas transcritas aqui dentro a usava.
 *
 *  O dano de um comparador desatualizado não é "um teste vermelho": ele calcula um líquido que
 *  NINGUÉM consegue receber (na banda [0, 8) da Shopee o fixo é metade do preço, e o comparador o
 *  lia como zero), conclui que existe anúncio melhor, e acusaria o motor de publicar preço
 *  dominado. É exatamente o erro que a primeira versão desta medição já cometeu uma vez — e a lição
 *  se repete: um comparador reimplementado tem de acompanhar TODA regra de dinheiro, ou ele deixa de
 *  ser o segundo par de olhos e vira uma segunda fonte de erro. */
function net(bands: PriceBand[], a: number, minPerItem: number): number | null {
  const b = bandOf(bands, a);
  if (!b) return null;
  const fixo = b.fixedFeeRule ? (a * b.fixedFeeRule.pct) / 100 : b.fixedFee;
  return a - Math.max((b.commissionPct / 100) * a, minPerItem) - fixo;
}

/**
 * Para cada anúncio em centavos, o MELHOR líquido alcançável até ali — não-decrescente por
 * construção, o que permite achar o anúncio ótimo por busca binária em vez de varrer tudo de novo
 * para cada base (a versão ingênua era 153 milhões de operações e inviabilizava a varredura).
 */
function cumulativeMax(bands: PriceBand[], minPerItem: number, ateCentavos: number): number[] {
  const m = new Array<number>(ateCentavos + 1).fill(-Infinity);
  for (let c = 1; c <= ateCentavos; c++) {
    const n = net(bands, c / 100, minPerItem);
    m[c] = Math.max(m[c - 1]!, n ?? -Infinity);
  }
  return m;
}

/** O MENOR anúncio publicável cujo líquido entrega a base — `null` se nenhum entrega. */
function maisBarato(cummax: number[], base: number): number | null {
  let lo = 1;
  let hi = cummax.length - 1;
  if (cummax[hi]! < base - 1e-9) return null;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cummax[mid]! >= base - 1e-9) hi = mid;
    else lo = mid + 1;
  }
  return lo / 100;
}

const TABELAS: { nome: string; bands: PriceBand[]; minPerItem: number }[] = [
  {
    // O custo fixo do ML, contíguo — o recorte de `band-convergence.test.ts`.
    nome: "ML contíguas",
    bands: [
      { minPrice: 0, maxPrice: 12.5, commissionPct: 50, fixedFee: 0 },
      { minPrice: 12.5, maxPrice: 79, commissionPct: 12, fixedFee: 5 },
      { minPrice: 79, maxPrice: null, commissionPct: 12, fixedFee: 0 },
    ],
    minPerItem: 0,
  },
  {
    // A mesma COM a lacuna que a fonte deixa (FR-014a: R$ 50,01–78,99 permanece lacuna).
    nome: "ML com lacuna",
    bands: [
      { minPrice: 0, maxPrice: 29.01, commissionPct: 14, fixedFee: 6.25 },
      { minPrice: 29.01, maxPrice: 50.01, commissionPct: 14, fixedFee: 6.5 },
      { minPrice: 79, maxPrice: null, commissionPct: 14, fixedFee: 0 },
    ],
    minPerItem: 0,
  },
  {
    // A forma da Amazon lida como SELECTION, com o piso por item.
    nome: "Amazon 15%→10%",
    bands: [
      { minPrice: 0, maxPrice: 200, commissionPct: 15, fixedFee: 0 },
      { minPrice: 200, maxPrice: null, commissionPct: 10, fixedFee: 0 },
    ],
    minPerItem: 1,
  },
  {
    // ADVERSÁRIA: a banda de cima é PIOR que a de baixo. Nenhuma fonte publica isso hoje, e é
    // exatamente por isso que ela está aqui — o guarda precisa cobrir o que ainda não chegou.
    nome: "adversária: banda superior pior (10%→25%)",
    bands: [
      { minPrice: 0, maxPrice: 100, commissionPct: 10, fixedFee: 0 },
      { minPrice: 100, maxPrice: null, commissionPct: 25, fixedFee: 0 },
    ],
    minPerItem: 0,
  },
  {
    // ADVERSÁRIA: a alíquota fica, o custo fixo é que salta na banda de cima.
    nome: "adversária: fixo salta na banda superior",
    bands: [
      { minPrice: 0, maxPrice: 60, commissionPct: 12, fixedFee: 0 },
      { minPrice: 60, maxPrice: null, commissionPct: 12, fixedFee: 20 },
    ],
    minPerItem: 0,
  },
  {
    // ADVERSÁRIA: lacuna larga SEM vale — separa o efeito da lacuna do efeito da forma.
    nome: "adversária: lacuna larga sem vale",
    bands: [
      { minPrice: 0, maxPrice: 50, commissionPct: 14, fixedFee: 0 },
      { minPrice: 90, maxPrice: null, commissionPct: 14, fixedFee: 0 },
    ],
    minPerItem: 0,
  },
];

const ATE_CENTAVOS = 15000;

// 017/T013 — este arquivo passou a se chamar `*.artifact.test.ts`, e o nome só é honesto porque a
// varredura passou a incluir as tabelas PUBLICADAS de verdade.
//
// Antes ele varria só tabelas escritas aqui dentro (as reais de então, mais quatro adversárias
// construídas). Isso provava a propriedade sobre o que alguém lembrou de transcrever — e a US1/AC4
// cita este guarda nominalmente como parte do subconjunto que roda DENTRO do job mensal, onde o que
// importa é a tabela que o robô acabou de escrever. Uma varredura que não lê o artefato não pode
// dizer nada sobre ela. As bandas vêm do `catalog.json` commitado, com o `minPerItem` da própria
// entrada (0 quando o marketplace não publica piso por item).
const servido = JSON.parse(
  readFileSync(new URL("../../../backend/app/data/catalog.json", import.meta.url), "utf8"),
) as {
  marketplaces: {
    marketplace: string;
    entries: {
      determinants: Record<string, string> | null;
      priceBands: PriceBand[] | null;
      minPerItem: number | null;
    }[];
  }[];
};

const TABELAS_PUBLICADAS = servido.marketplaces.flatMap((m) =>
  m.entries
    .filter((e) => (e.priceBands?.length ?? 0) > 0)
    .map((e, i) => ({
      nome: `PUBLICADA ${m.marketplace} #${i} ${JSON.stringify(e.determinants)}`,
      bands: e.priceBands!,
      minPerItem: e.minPerItem ?? 0,
    })),
);

describe("A1-r — o anúncio publicado é o mais barato que entrega a base", () => {
  it("há tabela publicada COM bandas para varrer — a premissa, medida (não-vacuidade)", () => {
    expect(TABELAS_PUBLICADAS.length).toBeGreaterThan(0);
  });

  for (const t of [...TABELAS, ...TABELAS_PUBLICADAS]) {
    it(`varredura: "${t.nome}"`, () => {
      const cummax = cumulativeMax(t.bands, t.minPerItem, ATE_CENTAVOS);
      const dominados: string[] = [];
      for (let cents = 100; cents <= 12000; cents += 7) {
        const base = cents / 100;
        const r = grossUp(base, {
          commissionPct: t.bands[0]!.commissionPct,
          fixedFee: 0,
          minPerItem: t.minPerItem,
          priceBands: t.bands,
        });
        // Base que o motor RECUSA precificar não entra: recusar é a resposta certa numa lacuna
        // (FR-014a), e comparar contra um "ótimo" de força bruta aqui seria preencher a lacuna pela
        // porta dos fundos — o erro que a primeira versão desta medição cometeu, produzindo 8 falsos
        // contraexemplos em que o motor estava certo e o comparador é que estava errado.
        if (r.anuncio === null) continue;
        const otimo = maisBarato(cummax, base);
        if (otimo !== null && r.anuncio > otimo + 1e-9 && dominados.length < 5) {
          dominados.push(`base=${base} anunciado=${r.anuncio} melhor=${otimo}`);
        }
      }
      expect(dominados).toEqual([]);
    });
  }
});
