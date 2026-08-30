import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { compor } from "./compose.ts";
import { checkBandCoverage, checkCategoryIdCollisions } from "./guardrails.ts";
import type { CatalogJson } from "./slice.ts";

// 017/T013 (decisão D) — os guardas do ARTEFATO COMPOSTO, e a META-GUARDA que define quem roda no
// `pnpm gate:artifact`.
//
// Por que este subconjunto existe: `GITHUB_TOKEN` não dispara CI (ADR-0010 §A6.5), então o PR mensal
// chega SEM gate nenhum. O dono escolheu rodar um subconjunto do gate DENTRO do job (clarify Q6a). O
// risco é o D4 de sempre — um subconjunto escrito à mão diverge no dia em que alguém acrescenta um
// guarda de artefato e esquece de acrescentá-lo à lista. Por isso a membresia é DERIVADA de uma
// convenção de nome, e uma meta-guarda reprova quem lê o artefato de fora dela.

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const CAMINHO_DO_ARTEFATO = "backend/app/data/catalog.json";

const artefato = JSON.parse(readFileSync(`${RAIZ}${CAMINHO_DO_ARTEFATO}`, "utf8")) as CatalogJson;
const secoes = artefato.marketplaces as CatalogJson[];
const entradasDe = (m: CatalogJson) => m.entries as CatalogJson[];

describe("o artefato servido é publicável — forma das bandas", () => {
  it("toda entrada com bandas passa em `checkBandCoverage` (sem sobreposição, sem inversão)", () => {
    const problemas: string[] = [];
    for (const m of secoes) {
      for (const e of entradasDe(m)) {
        const bandas = e.priceBands as { minPrice: number; maxPrice: number | null }[] | null;
        if (!bandas || bandas.length === 0) continue;
        const v = checkBandCoverage(bandas);
        if (!v.ok)
          problemas.push(`${String(m.marketplace)} ${JSON.stringify(e.determinants)}: ${v.reason}`);
      }
    }
    expect(problemas).toEqual([]);
  });

  it("há bandas para conferir — a premissa, medida (o guarda não passa por vacuidade)", () => {
    const comBandas = secoes.flatMap((m) =>
      entradasDe(m).filter((e) => ((e.priceBands as unknown[] | null)?.length ?? 0) > 0),
    );
    expect(comBandas.length).toBeGreaterThan(0);
  });
});

describe("o artefato servido é publicável — identidade de categoria", () => {
  it("nenhuma espinha tem dois nomes colapsando no mesmo `categoryId`", () => {
    for (const m of secoes) {
      const espinha = (m.categorySpine ?? []) as { name: string }[];
      if (espinha.length === 0) continue;
      // `categoryId` dobra acentos e caixa: "Óculos" e "Oculos" viram `oculos`. Um id duplicado
      // derruba o marketplace INTEIRO no cliente (`parseSeedResilient` descarta a seção), então um
      // par de acentos apagaria a Amazon do app.
      expect(checkCategoryIdCollisions(espinha)).toEqual({ ok: true });
    }
  });

  it("toda entrada endereçada a uma categoria aponta para um nó que a espinha publica", () => {
    const orfas: string[] = [];
    for (const m of secoes) {
      const ids = new Set(((m.categorySpine ?? []) as { id: string }[]).map((n) => n.id));
      for (const e of entradasDe(m)) {
        const cat = (e.determinants as Record<string, string> | null)?.category;
        if (cat !== undefined && !ids.has(cat)) orfas.push(`${String(m.marketplace)}: ${cat}`);
      }
    }
    expect(orfas).toEqual([]);
  });
});

describe("o artefato servido é publicável — sanidade das alíquotas", () => {
  // A faixa vem da MEDIÇÃO do que as três fontes publicam hoje (93 valores: mínimo 10%, máximo 20%),
  // alargada para (0, 30] — larga o bastante para não disparar quando um marketplace mexer de
  // verdade na tabela, e estreita o bastante para pegar a leitura que trocou de coluna e devolveu
  // um número plausível-mas-errado, que é o defeito que 014/T102 pagou para aprender.
  const ALIQUOTA_MAXIMA = 30;

  it("nenhuma comissão sai da faixa (0, 30]", () => {
    const foraDaFaixa: string[] = [];
    for (const m of secoes) {
      for (const e of entradasDe(m)) {
        const valores = [
          e.commissionPct,
          ...((e.priceBands as { commissionPct: number }[] | null) ?? []).map(
            (b) => b.commissionPct,
          ),
        ].filter((x): x is number => typeof x === "number");
        for (const v of valores) {
          if (!(v > 0 && v <= ALIQUOTA_MAXIMA)) {
            foraDaFaixa.push(`${String(m.marketplace)} ${JSON.stringify(e.determinants)}: ${v}%`);
          }
        }
      }
    }
    expect(foraDaFaixa).toEqual([]);
  });

  it("há alíquotas para conferir (não-vacuidade)", () => {
    const n = secoes.flatMap(entradasDe).length;
    expect(n).toBeGreaterThan(50);
  });
});

describe("compor sobre o ARTEFATO REAL — ponto fixo (I9)", () => {
  it("fatia vazia sobre o artefato publicado ⇒ SEM_PR, e nenhum byte se move", () => {
    const r = compor({
      base: artefato,
      vereditos: [
        {
          kind: "LIDO",
          marketplace: "SHOPEE",
          collectedAt: "2026-09-01",
          sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
          slice: {
            marketplace: "SHOPEE",
            exhaustive: [],
            leaves: [],
            collectedAt: "2026-09-01",
            sourceUrl: "https://seller.shopee.com.br/edu/article/26839",
          },
        },
      ],
      collectedAt: "2026-09-01",
      generatedAt: "2026-09-01T06:00:00.000Z",
      vigias: [],
      dispensaPermitida: false,
      arquivosDoPr: [CAMINHO_DO_ARTEFATO],
    });
    expect(r.kind).toBe("SEM_PR");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// META-GUARDA — a membresia do `gate:artifact` é uma PROPRIEDADE DO ARQUIVO, não uma curadoria que
// alguém precise lembrar de atualizar.

/**
 * Testes que leem o artefato e ainda NÃO seguem a convenção. Lista DATADA, e cada linha carrega o
 * porquê — uma exceção sem prazo nem motivo é uma lista que só cresce (RA7).
 */
const EXCECOES_DATADAS = [
  // 2026-08-07 (017/T013) — os dois são suítes GRANDES de engine/prefill (900 e 780 linhas) em que o
  // artefato aparece dentro de UM ou TRÊS `describe`. Renomear o arquivo inteiro puxaria ~1.500
  // linhas de teste de motor para dentro do gate do job; extrair os blocos é a resposta certa e é
  // churn que não cabe nesta onda. Consequência ACEITA e declarada: a prova de que a curadoria
  // ATRAVESSA até o preço fica fora do `gate:artifact` e continua no `gate:all` (que é o portão do
  // merge humano). Dono: a fatia que mexer nesses arquivos por outro motivo.
  "apps/web/src/features/calculator/calculator-model.test.ts",
  "apps/web/src/features/calculator/fee-prefill.test.ts",
];

/**
 * O que conta como LER o artefato: alcançá-lo por caminho RELATIVO (`../…/backend/app/data/…`), que é
 * a única forma de um teste abrir o arquivo.
 *
 * Não serve procurar a string crua: o caminho aparece como DADO em `exemption.test.ts` e
 * `pr-body.test.ts` (é o par de arquivos que a dispensa de revisão pode tocar), e tratar isso como
 * leitura arrastaria para dentro do gate do job dois testes que nunca abriram o arquivo — uma
 * meta-guarda que grita onde não há problema é a que ensina a desligá-la.
 *
 * Fora de escopo por construção: os `*.spec.ts` do Playwright (`apps/web/tests/e2e/`), que leem o
 * artefato mas não rodam sob vitest e portanto não podem pertencer a este subconjunto.
 */
const LE_O_ARTEFATO = /\.\.\/[^"'`\n]*backend\/app\/data\/catalog\.json/;

/** Todo arquivo de teste do repositório (vitest), por caminho relativo à raiz. */
function testesDoRepositorio(): string[] {
  const saida: string[] = [];
  const ignorar = new Set(["node_modules", "dist", "coverage", ".git", "graphify-out"]);
  const andar = (rel: string) => {
    for (const item of readdirSync(`${RAIZ}${rel}`, { withFileTypes: true })) {
      if (ignorar.has(item.name)) continue;
      const filho = `${rel}${item.name}`;
      if (item.isDirectory()) andar(`${filho}/`);
      else if (/\.test\.tsx?$/.test(item.name)) saida.push(filho);
    }
  };
  andar("apps/");
  andar("packages/");
  return saida;
}

describe("meta-guarda — quem lê o artefato roda no `gate:artifact`", () => {
  const arquivos = testesDoRepositorio();

  it("varre uma quantidade plausível de testes (a varredura não pode estar vazia)", () => {
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("todo teste que LÊ o artefato casa `*.artifact.test.ts` ou está na exceção datada", () => {
    const foraDaConvencao = arquivos
      .filter((f) => LE_O_ARTEFATO.test(readFileSync(`${RAIZ}${f}`, "utf8")))
      .filter((f) => !/\.artifact\.test\.tsx?$/.test(f))
      .filter((f) => !EXCECOES_DATADAS.includes(f));
    expect(foraDaConvencao).toEqual([]);
  });

  it("a lista de exceções não tem entrada MORTA (arquivo renomeado ou apagado)", () => {
    // Uma exceção que já não descreve nada é a forma como uma lista datada apodrece: ela some do
    // radar e passa a autorizar o próximo arquivo que alguém batize com o mesmo nome.
    expect(EXCECOES_DATADAS.filter((f) => !arquivos.includes(f))).toEqual([]);
  });

  it("o conjunto derivado não está vazio — o `gate:artifact` roda alguma coisa", () => {
    const naConvencao = arquivos.filter((f) => /\.artifact\.test\.tsx?$/.test(f));
    expect(naConvencao.length).toBeGreaterThanOrEqual(5);
  });
});
