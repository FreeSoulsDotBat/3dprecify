import { describe, expect, it } from "vitest";

import type { ParsedCategory } from "./amazon-parse";
import {
  AMAZON_CAVEATS_FULL,
  AMAZON_FEE_BASE_CAVEAT,
  AMAZON_SOURCE_URL,
  amazonEntries,
  amazonSpine,
  effectiveDatesOf,
  categoryId,
} from "./amazon-to-catalog";
import { diffCatalogs, mayAutoMerge } from "./catalog-diff";
import {
  checkBandCoverage,
  checkCategoryIdCollisions,
  checkParseSanity,
  nextCatalogVersion,
} from "./guardrails";

const CATS: ParsedCategory[] = [
  { name: "Roupas e Acessórios", commissionPct: 14, bands: null, minPerItem: 1 },
  {
    name: "Acessórios Eletrônicos",
    commissionPct: null,
    bands: [
      { minPrice: 0, maxPrice: 100, commissionPct: 15 },
      { minPrice: 100, maxPrice: null, commissionPct: 10 },
    ],
    minPerItem: 1,
  },
  { name: "Outros", commissionPct: 15, bands: null, minPerItem: 1 },
];
const OPTS = { collectedAt: "2026-07-28", effectiveDate: "2026-07-28" };

describe("categoryId — a stable identity for a marketplace that publishes only names", () => {
  it("folds accents and case so the same name always yields the same id", () => {
    expect(categoryId("Acessórios Eletrônicos")).toBe("acessorios-eletronicos");
    expect(categoryId("Casa e Cozinha")).toBe("casa-e-cozinha");
    expect(categoryId("Mídia: Livros, DVD, Música")).toBe("midia-livros-dvd-musica");
  });

  it("never leaves stray separators at the edges", () => {
    expect(categoryId("  Óculos  ")).toBe("oculos");
    expect(categoryId("DIY e ferramentas!")).toBe("diy-e-ferramentas");
  });

  it("is idempotent — re-running the ingestion must not churn ids", () => {
    const once = categoryId("Joias e Relógios");
    expect(categoryId(once)).toBe(once);
  });
});

describe("amazonSpine — flat, because Amazon publishes no hierarchy", () => {
  const spine = amazonSpine(CATS);

  it("keeps the published name verbatim (Q12) and every node is a root", () => {
    expect(spine).toEqual([
      { id: "roupas-e-acessorios", name: "Roupas e Acessórios", parentId: null },
      { id: "acessorios-eletronicos", name: "Acessórios Eletrônicos", parentId: null },
      { id: "outros", name: "Outros", parentId: null },
    ]);
  });
});

describe("amazonEntries — one per (plan, category)", () => {
  const entries = amazonEntries(CATS, OPTS);

  /** Determinants are a union (`{plan}` for the catch-all, `{plan, category}` otherwise). */
  const catOf = (e: (typeof entries)[number]) =>
    "category" in e.determinants ? e.determinants.category : null;

  it("covers both plans with the same commission — the table does not vary by plan", () => {
    // 3 categorias × 2 planos, MAIS a entrada só-de-modalidade de cada plano (T094).
    expect(entries).toHaveLength(8);
    const forCat = (plan: string) =>
      entries.find((e) => e.determinants.plan === plan && catOf(e) === "outros");
    expect(forCat("PROFISSIONAL")?.commissionPct).toBe(15);
    expect(forCat("INDIVIDUAL")?.commissionPct).toBe(15);
  });

  // 014/T094+T095 — o catch-all publicado, emitido como entrada PRÓPRIA sem eixo de categoria: é o
  // que um slot sem categoria escolhida resolve. Cópia da linha "Outros", nunca média nem extremo
  // derivado (FR-011a) — e a procedência nomeia a linha, porque usar isso é CITAR a Amazon.
  it("emite a entrada só-de-modalidade a partir da linha publicada 'Outros'", () => {
    const catchAll = entries.filter((e) => catOf(e) === null);
    expect(catchAll).toHaveLength(2); // um por plano
    for (const e of catchAll) {
      expect(e.commissionPct).toBe(15);
      expect(e.source).toContain("Outros");
      expect(e.determinants).not.toHaveProperty("category");
    }
  });

  it("sem a linha 'Outros' na fonte, NENHUM catch-all é emitido — nunca um substituto escolhido por nós", () => {
    const semOutros = CATS.filter((c) => c.name !== "Outros");
    const sem = amazonEntries(semOutros, OPTS);
    expect(sem.every((e) => catOf(e) !== null)).toBe(true);
    // A assimetria com o Mercado Livre (que publica uma FAIXA e nenhum catch-all) cai do dado.
    expect(sem).toHaveLength(semOutros.length * 2);
  });

  it("carries the banded category through as bands, never flattened", () => {
    const banded = entries.find((e) => catOf(e) === "acessorios-eletronicos");
    expect(banded?.commissionPct).toBeNull();
    expect(banded?.priceBands).toEqual([
      { minPrice: 0, maxPrice: 100, commissionPct: 15, fixedFee: 0 },
      { minPrice: 100, maxPrice: null, commissionPct: 10, fixedFee: 0 },
    ]);
  });

  it("every entry names its category AND declares the fee-base limitation (FR-014/SC-803)", () => {
    for (const e of entries) {
      expect(e.source).toContain(AMAZON_FEE_BASE_CAVEAT);
      expect(e.sourceUrl).toBe(AMAZON_SOURCE_URL);
      expect(e.effectiveDate).toBe("2026-07-28");
      expect(e.lastReviewed).toBe("2026-07-28");
    }
    expect(entries[0].source).toContain("Roupas e Acessórios");
  });

  it("keeps the per-item minimum and never invents freight", () => {
    expect(entries.every((e) => e.minPerItem === 1)).toBe(true);
    expect(entries.every((e) => e.freight.kind === "NONE")).toBe(true);
  });

  // The seal is a Badge. The full caveat exists for the detail surface (T041a) and must NOT be what
  // every entry carries inline, or the honest text becomes unreadable — and unreadable is not honest.
  it("the SHORT caveat is what ships per entry; the full one stays out of the seal", () => {
    expect(AMAZON_CAVEATS_FULL.length).toBeGreaterThan(200);
    expect(entries[0].source.length).toBeLessThan(120);
    expect(entries[0].source).not.toContain(AMAZON_CAVEATS_FULL);
  });
});

describe("checkParseSanity — the fail-safe that catches a parser reading the wrong column", () => {
  // T102 — a canária é o PAR `(comissão, mínimo por item)`: só o percentual deixava passar o
  // deslocamento de coluna que zera todo `minPerItem`.
  const canaries = [["Outros", 15, 1]] as const;

  it("passes a healthy parse", () => {
    expect(checkParseSanity(CATS, { minRows: 3, canaries })).toEqual({ ok: true });
  });

  it("rejects a shrunk parse as a SHAPE failure, not as a fee change", () => {
    const v = checkParseSanity(CATS, { minRows: 28, canaries });
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/source shape changed/i);
  });

  it("rejects a parse whose canary vanished", () => {
    const v = checkParseSanity(CATS.slice(0, 1), { minRows: 1, canaries });
    expect(v.ok === false && v.reason).toMatch(/missing/i);
  });

  // The dangerous one: a full set of plausible numbers, all wrong. Row count cannot see it.
  it("rejects a parse where every row is plausible but the canary moved", () => {
    const shifted = CATS.map((c) => ({
      ...c,
      commissionPct: c.commissionPct === null ? null : 12,
    }));
    const v = checkParseSanity(shifted, { minRows: 3, canaries });
    expect(v.ok === false && v.reason).toMatch(/wrong column/i);
  });
});

// 014/T114 (SC-817) — o que a cobertura de bandas aceita e o que ela recusa. A distinção é o ponto:
// uma LACUNA publicada é dado legítimo (FR-014a manda preservá-la), então recusá-la seria recusar a
// fonte. O que não pode passar é a forma que torna a lacuna indistinguível de erro de leitura.
describe("checkBandCoverage — lacuna é dado; sobreposição é erro de leitura", () => {
  it("aceita bandas contíguas terminadas no infinito", () => {
    expect(
      checkBandCoverage([
        { minPrice: 0, maxPrice: 200 },
        { minPrice: 200, maxPrice: null },
      ]),
    ).toEqual({ ok: true });
  });

  it("ACEITA a lacuna que a fonte deixa (ML R$ 50,01–78,99) — FR-014a", () => {
    expect(
      checkBandCoverage([
        { minPrice: 0, maxPrice: 29.01 },
        { minPrice: 29.01, maxPrice: 50.01 },
        { minPrice: 79, maxPrice: null },
      ]),
    ).toEqual({ ok: true });
  });

  it("aceita fora de ordem — a ordem da tabela raspada não é dado", () => {
    expect(
      checkBandCoverage([
        { minPrice: 200, maxPrice: null },
        { minPrice: 0, maxPrice: 200 },
      ]),
    ).toEqual({ ok: true });
  });

  it("recusa sobreposição: a alíquota aplicada dependeria da ordem das linhas", () => {
    const v = checkBandCoverage([
      { minPrice: 0, maxPrice: 100 },
      { minPrice: 50, maxPrice: null },
    ]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("overlap");
  });

  it("recusa uma banda que não pode conter preço nenhum", () => {
    const v = checkBandCoverage([{ minPrice: 100, maxPrice: 100 }]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("cannot contain a price");
  });

  it("recusa uma SEGUNDA banda aberta — só a terminal pode ser ilimitada", () => {
    const v = checkBandCoverage([
      { minPrice: 0, maxPrice: null },
      { minPrice: 200, maxPrice: null },
    ]);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("terminal");
  });

  it("um conjunto vazio não é violação — é ausência de bandas", () => {
    expect(checkBandCoverage([])).toEqual({ ok: true });
  });
});

// 014/revisão final adversarial (2026-07-31) — MEDIDO no diff `adf85ed..5e63047`:
//   adf85ed → catalogVersion 2026-07-28.0 | 77 entradas
//   5e63047 → catalogVersion 2026-07-28.0 | 79 entradas
// Duas entradas novas sob rótulo IDÊNTICO, porque `build-amazon.mjs` cravava a sequência em `.0`.
//
// Por que isso não é cosmético: esse rótulo é congelado dentro do payload que o ADR-0019 torna
// IMUTÁVEL. Dois registros dizendo "2026-07-28.0" descrevem tabelas diferentes — num deles um slot
// Amazon sem categoria não tinha preço, no outro ele precifica a 15% pelo catch-all. O rótulo existe
// para responder QUAL tabela produziu aquele número, e um registro irregravável não tem conserto
// depois. Regerar na mesma data de coleta reescrevia conteúdo diferente com o mesmo nome, por
// construção — a armadilha voltaria em toda regeração mensal.
describe("nextCatalogVersion — o rótulo nomeia o DADO, não a execução", () => {
  it("conteúdo mudou na MESMA data de coleta: a sequência incrementa", () => {
    expect(nextCatalogVersion("2026-07-28.0", "2026-07-28", true)).toBe("2026-07-28.1");
    expect(nextCatalogVersion("2026-07-28.1", "2026-07-28", true)).toBe("2026-07-28.2");
  });

  // A mesma armadilha que a T100 pagou em `freshest`: comparar/incrementar a sequência como TEXTO
  // faria ".9" virar ".91" ou perder para ".10". É inteiro.
  it("a sequência é INTEIRA, não texto: .9 vira .10", () => {
    expect(nextCatalogVersion("2026-07-28.9", "2026-07-28", true)).toBe("2026-07-28.10");
    expect(nextCatalogVersion("2026-07-28.10", "2026-07-28", true)).toBe("2026-07-28.11");
  });

  it("leitura NOVA: a sequência reinicia em .0", () => {
    expect(nextCatalogVersion("2026-07-28.3", "2026-08-01", true)).toBe("2026-08-01.0");
  });

  it("conteúdo IGUAL: o rótulo não se move — ele nomeia o dado, não a execução", () => {
    expect(nextCatalogVersion("2026-07-28.1", "2026-07-28", false)).toBe("2026-07-28.1");
    // Nem quando a data muda: reler a mesma tabela não a torna uma tabela nova.
    expect(nextCatalogVersion("2026-07-28.1", "2026-08-01", false)).toBe("2026-07-28.1");
  });

  // Ilegível é representável (alguém edita o JSON à mão); AUSENTE não é — um artefato sem rótulo é
  // falha de forma, e o gerador a recusa em voz alta em vez de inventar uma sequência.
  it("rótulo anterior ilegível: começa em .0 da data de hoje, sem inventar sequência", () => {
    expect(nextCatalogVersion("cru", "2026-08-01", true)).toBe("2026-08-01.0");
    expect(nextCatalogVersion("", "2026-08-01", true)).toBe("2026-08-01.0");
  });
});

// 014/T101 [US4] — a PRE-CONDICAO do laco mensal, e a que decide se ele nasce util.
//
// MEDIDO no artefato de hoje: as 78 entradas Amazon carregam `effectiveDate: "2026-07-28"`, que e a
// data em que EU RODEI o script; a unica entrada Shopee carrega "2026-03-01", que e uma data
// DECLARADA PELA FONTE. O campo existe para dizer desde quando a tarifa vale — e a Amazon estava
// recebendo quando o robo passou por la.
//
// A consequencia nao e cosmetica: `effectiveDate` NAO esta em `INERT_PATHS` (e nao deve estar — uma
// mudanca real de vigencia e noticia de dinheiro). Entao regerar mes que vem sobre uma tabela
// IDENTICA marcaria as 78 como alteradas, `freshnessOnly` cairia, e `mayAutoMerge` jamais
// dispensaria revisao. O laco mensal nasceria incapaz de dizer "nada mudou".
//
// Decisao do dono (2026-07-31): PRESERVAR o valor anterior. Entrada nova recebe a data da sua
// primeira coleta — que e verdade e e parseavel, ao contrario de um literal livre.
describe("effectiveDate — o campo diz desde quando a tarifa vale, nao quando o robo passou (T101)", () => {
  const CATS: ParsedCategory[] = [
    { name: "Calcados", commissionPct: 14, minPerItem: 1, bands: null },
    // Inclui o catch-all publicado, para exercitar TAMBEM a entrada modality-only (sem categoria).
    { name: "Outros", commissionPct: 15, minPerItem: 1, bands: null },
  ];

  it("entrada que ja existia preserva o effectiveDate anterior, mesmo em outra data de coleta", () => {
    const antes = amazonEntries(CATS, { collectedAt: "2026-07-28", effectiveDate: "2026-07-28" });
    const depois = amazonEntries(CATS, {
      collectedAt: "2026-08-01",
      effectiveDate: "2026-08-01",
      previousEffectiveDates: effectiveDatesOf(antes),
    });
    for (const e of depois) expect(e.effectiveDate).toBe("2026-07-28");
    // …e `lastReviewed` AVANCA: ele diz quando conferimos, que e outra pergunta.
    for (const e of depois) expect(e.lastReviewed).toBe("2026-08-01");
  });

  it("entrada NOVA recebe a data da sua primeira coleta", () => {
    const antes = amazonEntries(CATS, { collectedAt: "2026-07-28", effectiveDate: "2026-07-28" });
    const depois = amazonEntries(
      [...CATS, { name: "Joias", commissionPct: 20, minPerItem: 1, bands: null }],
      {
        collectedAt: "2026-08-01",
        effectiveDate: "2026-08-01",
        previousEffectiveDates: effectiveDatesOf(antes),
      },
    );
    const nova = depois.filter(
      (e) => "category" in e.determinants && e.determinants.category === "joias",
    );
    expect(nova.length).toBeGreaterThan(0);
    for (const e of nova) expect(e.effectiveDate).toBe("2026-08-01");
  });

  // A assercao que importa nao e sobre o campo: e sobre a CONSEQUENCIA. Sem isto o laco mensal
  // existe e nao serve.
  it("duas execucoes sobre a MESMA tabela produzem diff dispensavel — a razao de a tarefa existir", () => {
    const cat = (entries: unknown[]) => ({
      catalogVersion: "2026-07-28.1",
      marketplaces: [{ marketplace: "AMAZON", categorySpine: [], entries }],
    });
    const antes = amazonEntries(CATS, { collectedAt: "2026-07-28", effectiveDate: "2026-07-28" });
    const depois = amazonEntries(CATS, {
      collectedAt: "2026-08-01",
      effectiveDate: "2026-08-01",
      previousEffectiveDates: effectiveDatesOf(antes),
    });
    const diff = diffCatalogs(cat(antes) as never, cat(depois) as never);
    // `changedEntries` NAO fica vazio, e nao deveria: `lastReviewed` avanca de verdade — conferimos
    // a tabela hoje. O que a tarefa exige e que TODA mudanca seja inerte, e so isso libera a
    // dispensa. Asserir lista vazia teria sido asserir a coisa errada.
    const caminhos = [...new Set(diff.changedEntries.flatMap((e) => e.changes.map((c) => c.path)))];
    expect(caminhos).toEqual(["lastReviewed"]);
    expect(mayAutoMerge(diff)).toBe(true);
  });

  it("SEM o mapa anterior o defeito reaparece — a guarda e o mapa, nao a sorte", () => {
    const cat = (entries: unknown[]) => ({
      catalogVersion: "2026-07-28.1",
      marketplaces: [{ marketplace: "AMAZON", categorySpine: [], entries }],
    });
    const antes = amazonEntries(CATS, { collectedAt: "2026-07-28", effectiveDate: "2026-07-28" });
    const depois = amazonEntries(CATS, { collectedAt: "2026-08-01", effectiveDate: "2026-08-01" });
    expect(mayAutoMerge(diffCatalogs(cat(antes) as never, cat(depois) as never))).toBe(false);
  });
});

// 014/T106 [US4] — o gerador nao validava o proprio output. `categoryId` DOBRA acentos e caixa, entao
// dois nomes diferentes na fonte podem colapsar no mesmo id ("Óculos" e "Oculos", "Relogios" e
// "Relógios"). Hoje isso sai com exit 0 e "sucesso" impresso, e o artefato com ids duplicados derruba
// o marketplace INTEIRO no cliente — `categorySpineSchema` recusa id duplicado, e o
// `parseSeedResilient` responde descartando o marketplace, entao um par de acentos apaga a Amazon.
//
// O truth-gate (`fee-catalog.test.ts`) pega o artefato invalido no `gate:all`, o que impede que ele
// chegue ao usuario — mas nao impede o gerador de MENTIR na saida. Quem roda o script precisa saber
// pelo proprio script.
describe("colisao de categoryId nao sai como sucesso (T106)", () => {
  it("dois nomes que dobram para o mesmo id sao recusados, NOMEANDO os colidentes", () => {
    const v = checkCategoryIdCollisions([{ name: "Óculos" }, { name: "Oculos" }]);
    expect(v.ok).toBe(false);
    // Nomear os dois e o que torna o erro acionavel: sem isso, quem roda ve "colisao" e nao sabe onde.
    expect(v.ok === false && v.reason).toContain("Óculos");
    expect(v.ok === false && v.reason).toContain("Oculos");
    expect(v.ok === false && v.reason).toContain("oculos");
  });

  it("uma tabela sa passa", () => {
    expect(checkCategoryIdCollisions(CATS)).toEqual({ ok: true });
  });

  it("o mesmo nome repetido tambem e colisao — a fonte nao deveria repetir uma linha", () => {
    const v = checkCategoryIdCollisions([{ name: "Calçados" }, { name: "Calçados" }]);
    expect(v.ok).toBe(false);
  });
});
