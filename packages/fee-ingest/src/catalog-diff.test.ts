import { describe, expect, it } from "vitest";

import { diffCatalogs, mayAutoMerge } from "./catalog-diff";

// The classifier decides whether a human reads the monthly PR. It must fail CLOSED: when in any
// doubt, a human reads. The cost of a false "needs review" is one glance; the cost of a false
// "freshness only" is an unreviewed change to a number that enters a seller's price.

const prov = {
  freight: { kind: "NONE" },
  source: "Tabela de comissões da Amazon — Casa e Cozinha (comissão sobre base que inclui frete)",
  sourceUrl: "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920",
  effectiveDate: "2026-07-28",
  lastReviewed: "2026-07-28",
};

/** Loose on purpose: tests mutate optional catalog fields (priceBands, minPerItem) that the inferred
 *  literal type would otherwise exclude. The SHAPE under test is the artifact's, not this helper's. */
type TestCatalog = {
  catalogVersion: string;
  schemaVersion: string;
  generatedAt: string;
  marketplaces: {
    marketplace: string;
    categorySpine: { id: string; name: string; parentId: string | null }[];
    entries: Record<string, unknown>[];
  }[];
};

const catalog = (over: Record<string, unknown> = {}): TestCatalog => ({
  catalogVersion: "2026-07-28.0",
  schemaVersion: "1",
  generatedAt: "2026-07-28T00:00:00.000Z",
  marketplaces: [
    {
      marketplace: "AMAZON",
      categorySpine: [
        { id: "casa", name: "Casa e Cozinha", parentId: null },
        { id: "casa-vasos", name: "Vasos", parentId: "casa" },
      ],
      entries: [
        { ...prov, determinants: { plan: "PROFISSIONAL", category: "casa" }, commissionPct: 12 },
      ],
    },
  ],
  ...over,
});

/** Apply a mutation to a deep clone, so fixtures never leak between tests. */
const mutate = (fn: (c: TestCatalog) => void) => {
  const c = JSON.parse(JSON.stringify(catalog())) as TestCatalog;
  fn(c);
  return c;
};

describe("diffCatalogs — freshness vs money", () => {
  it("an identical pair produces no changes and may auto-merge", () => {
    const d = diffCatalogs(catalog(), catalog());
    expect(d.changedEntries).toEqual([]);
    expect(mayAutoMerge(d)).toBe(true);
  });

  it("a run that only advanced lastReviewed may auto-merge", () => {
    const after = mutate((c) => {
      c.catalogVersion = "2026-08-01.0";
      c.generatedAt = "2026-08-01T00:00:00.000Z";
      c.marketplaces[0].entries[0].lastReviewed = "2026-08-01";
    });
    const d = diffCatalogs(catalog(), after);
    expect(d.freshnessOnly).toBe(true);
    expect(mayAutoMerge(d)).toBe(true);
  });

  it("a commission change NEVER auto-merges, and is reported as old → new by category", () => {
    const after = mutate((c) => {
      c.marketplaces[0].entries[0].commissionPct = 14;
      c.marketplaces[0].entries[0].lastReviewed = "2026-08-01";
    });
    const d = diffCatalogs(catalog(), after);
    expect(mayAutoMerge(d)).toBe(false);
    const change = d.changedEntries[0];
    expect(change.categoryName).toBe("Casa e Cozinha");
    expect(change.changes).toContainEqual({ path: "commissionPct", before: 12, after: 14 });
  });

  it("a change inside a price BAND is money too — not buried by the nesting", () => {
    const before = mutate((c) => {
      c.marketplaces[0].entries[0].priceBands = [
        { minPrice: 0, maxPrice: 100, commissionPct: 15, fixedFee: 0 },
      ];
    });
    const after = mutate((c) => {
      c.marketplaces[0].entries[0].priceBands = [
        { minPrice: 0, maxPrice: 100, commissionPct: 10, fixedFee: 0 },
      ];
    });
    const d = diffCatalogs(before, after);
    expect(mayAutoMerge(d)).toBe(false);
    expect(d.changedEntries[0].changes).toContainEqual({
      path: "priceBands.0.commissionPct",
      before: 15,
      after: 10,
    });
  });

  it("a category that DISAPPEARED is surfaced for a human, never silently kept alive", () => {
    const after = mutate((c) => {
      c.marketplaces[0].categorySpine = c.marketplaces[0].categorySpine.filter(
        (n) => n.id !== "casa-vasos",
      );
    });
    const d = diffCatalogs(catalog(), after);
    expect(d.removedCategories).toEqual([
      { marketplace: "AMAZON", categoryId: "casa-vasos", name: "Vasos" },
    ]);
    expect(mayAutoMerge(d)).toBe(false);
  });

  it("a NEW category is surfaced too", () => {
    const after = mutate((c) => {
      c.marketplaces[0].categorySpine.push({ id: "jardim", name: "Jardim", parentId: null });
    });
    const d = diffCatalogs(catalog(), after);
    expect(d.addedCategories[0].categoryId).toBe("jardim");
    expect(mayAutoMerge(d)).toBe(false);
  });

  // FR-019a — THE subtle one. With sparse entries, moving a category under a different parent
  // changes its EFFECTIVE rate while not a single entry field differs. A field-level diff shows
  // nothing, so the loop would publish a price change with no line in the PR.
  it("a RE-PARENTED category is reported even though no entry field changed", () => {
    const after = mutate((c) => {
      c.marketplaces[0].categorySpine.push({ id: "outro-pai", name: "Outro Pai", parentId: null });
      c.marketplaces[0].categorySpine[1].parentId = "outro-pai";
    });
    const d = diffCatalogs(catalog(), after);
    expect(d.changedEntries).toEqual([]); // nothing at field level — this is the trap
    expect(d.reparented).toContainEqual({
      marketplace: "AMAZON",
      categoryId: "casa-vasos",
      name: "Vasos",
      parentBefore: "casa",
      parentAfter: "outro-pai",
    });
    expect(mayAutoMerge(d)).toBe(false);
  });
});

describe("the PR body describes changes a human can act on", () => {
  it("an entry with NO category (Shopee's shape) reports a null category, not a crash", () => {
    const before = mutate((c) => {
      c.marketplaces[0].entries = [{ ...prov, determinants: null, commissionPct: 20 }];
    });
    const after = mutate((c) => {
      c.marketplaces[0].entries = [{ ...prov, determinants: null, commissionPct: 18 }];
    });
    const d = diffCatalogs(before, after);
    expect(d.changedEntries[0].categoryId).toBeNull();
    expect(d.changedEntries[0].categoryName).toBeNull();
  });

  // `String(undefined)` is the string "undefined" — a `?? null` after it never fires. Without this
  // test the reviewer would see a category literally named "undefined" in the monthly PR.
  it('an entry keyed to a category ABSENT from the spine reports null, never "undefined"', () => {
    const before = mutate((c) => {
      c.marketplaces[0].entries[0].determinants = { plan: "PROFISSIONAL", category: "fantasma" };
    });
    const after = mutate((c) => {
      c.marketplaces[0].entries[0].determinants = { plan: "PROFISSIONAL", category: "fantasma" };
      c.marketplaces[0].entries[0].commissionPct = 9;
    });
    const d = diffCatalogs(before, after);
    expect(d.changedEntries[0].categoryId).toBe("fantasma");
    expect(d.changedEntries[0].categoryName).toBeNull();
  });

  it("a category gaining a parent where it had none is a re-parent too", () => {
    const before = mutate((c) => {
      c.marketplaces[0].categorySpine[1] = { id: "casa-vasos", name: "Vasos", parentId: null };
    });
    const after = mutate((c) => {
      c.marketplaces[0].categorySpine[1] = { id: "casa-vasos", name: "Vasos", parentId: "casa" };
    });
    const d = diffCatalogs(before, after);
    expect(d.reparented[0]).toMatchObject({ parentBefore: null, parentAfter: "casa" });
  });
});

describe("shapes the real catalog actually contains", () => {
  // Shopee ships NO categorySpine — it has no category axis. Treating that as malformed would make
  // the monthly diff crash on the one marketplace that is already curated and shipping.
  it("a marketplace with no spine diffs normally", () => {
    const noSpine = {
      catalogVersion: "2026-07-28.0",
      schemaVersion: "1",
      generatedAt: "2026-07-28T00:00:00.000Z",
      marketplaces: [
        { marketplace: "SHOPEE", entries: [{ ...prov, determinants: null, commissionPct: 20 }] },
      ],
    };
    const after = JSON.parse(JSON.stringify(noSpine));
    after.marketplaces[0].entries[0].commissionPct = 18;
    const d = diffCatalogs(noSpine, after);
    expect(d.changedEntries[0].changes).toContainEqual({
      path: "commissionPct",
      before: 20,
      after: 18,
    });
    expect(mayAutoMerge(d)).toBe(false);
  });

  // A category GAINING a band is a real fee change (Amazon added the R$100 threshold at some point).
  // Comparing arrays only up to the shorter one would miss the new band entirely.
  it("a price band being ADDED is reported, not lost to the shorter array", () => {
    const before = mutate((c) => {
      c.marketplaces[0].entries[0].priceBands = [
        { minPrice: 0, maxPrice: null, commissionPct: 15, fixedFee: 0 },
      ];
    });
    const after = mutate((c) => {
      c.marketplaces[0].entries[0].priceBands = [
        { minPrice: 0, maxPrice: 100, commissionPct: 15, fixedFee: 0 },
        { minPrice: 100, maxPrice: null, commissionPct: 10, fixedFee: 0 },
      ];
    });
    const d = diffCatalogs(before, after);
    expect(d.changedEntries[0].changes.map((c) => c.path)).toContain("priceBands.1");
    expect(mayAutoMerge(d)).toBe(false);
  });

  it("a field turning from a scalar into an object is a change, not a silent pass", () => {
    const before = mutate((c) => {
      c.marketplaces[0].entries[0].priceBands = null;
    });
    const after = mutate((c) => {
      c.marketplaces[0].entries[0].priceBands = [
        { minPrice: 0, maxPrice: null, commissionPct: 11, fixedFee: 0 },
      ];
    });
    expect(mayAutoMerge(diffCatalogs(before, after))).toBe(false);
  });
});

describe("a corrupted PREVIOUS artifact degrades, it does not crash the run", () => {
  // The committed artifact is schema-validated in CI, but the monthly job reads it from disk and a
  // corrupted prior state must not take the loop down — it must surface, block auto-merge, and let a
  // human look. Crashing here would mean the fee refresh silently stops running.
  it("survives a previous artifact with no marketplaces at all", () => {
    const d = diffCatalogs({}, catalog());
    expect(mayAutoMerge(d)).toBe(false);
  });

  it("survives a marketplace whose spine/entries are not arrays", () => {
    const broken = {
      catalogVersion: "x",
      marketplaces: [{ marketplace: "AMAZON", categorySpine: "corrupted", entries: null }],
    };
    const d = diffCatalogs(broken, catalog());
    expect(mayAutoMerge(d)).toBe(false);
    expect(d.addedCategories.length).toBeGreaterThan(0);
  });

  it("survives a spine node with no parentId key at all", () => {
    const before = mutate((c) => {
      c.marketplaces[0].categorySpine[1] = { id: "casa-vasos", name: "Vasos" } as never;
    });
    const after = mutate((c) => {
      c.marketplaces[0].categorySpine[1].parentId = "casa";
    });
    expect(diffCatalogs(before, after).reparented[0]).toMatchObject({ parentBefore: null });
  });

  // The catastrophic case SC-806 exists for: the run produced NOTHING. Everything must read as
  // removed and nothing may merge unattended.
  it("a run that produced an EMPTY artifact never auto-merges", () => {
    const d = diffCatalogs(catalog(), {});
    expect(mayAutoMerge(d)).toBe(false);
  });

  // 014/T099 — aqui vivia "compares two bare arrays without losing the path", que comparava dois
  // arrays VAZIOS: iguais, então `leafChanges` retornava no primeiro `JSON.stringify` e o ramo de
  // array que o nome prometia nunca era executado. O ramo já é exercido de verdade acima
  // ("priceBands.0.commissionPct" e "priceBands.1"), então o teste não cobria nada que faltasse — só
  // fazia a cobertura PARECER maior. Um teste vacuoso com nome de teste bom é pior que a ausência
  // dele: ele responde "sim" a uma pergunta que ninguém chegou a fazer.
});

describe("the classifier fails CLOSED", () => {
  it("an entry that vanished blocks auto-merge", () => {
    const after = mutate((c) => {
      c.marketplaces[0].entries = [];
    });
    expect(mayAutoMerge(diffCatalogs(catalog(), after))).toBe(false);
  });

  it("a whole marketplace vanishing blocks auto-merge", () => {
    const after = mutate((c) => {
      c.marketplaces = [];
    });
    expect(mayAutoMerge(diffCatalogs(catalog(), after))).toBe(false);
  });

  it("a marketplace APPEARING blocks auto-merge", () => {
    const after = mutate((c) => {
      c.marketplaces.push({ marketplace: "MERCADO_LIVRE", categorySpine: [], entries: [] });
    });
    expect(mayAutoMerge(diffCatalogs(catalog(), after))).toBe(false);
  });

  it("a NEW entry blocks auto-merge", () => {
    const after = mutate((c) => {
      c.marketplaces[0].entries.push({
        ...prov,
        determinants: { plan: "INDIVIDUAL", category: "casa" },
        commissionPct: 12,
      });
    });
    expect(mayAutoMerge(diffCatalogs(catalog(), after))).toBe(false);
  });

  // An unknown field is not assumed inert. If the schema grows a field this module has never seen,
  // the safe reading is "a human looks", not "probably harmless".
  it("an UNRECOGNISED field changing blocks auto-merge", () => {
    const after = mutate((c) => {
      (c as Record<string, unknown>).somethingNew = "surprise";
    });
    expect(mayAutoMerge(diffCatalogs(catalog(), after))).toBe(false);
  });

  it("a provenance URL change is not freshness — it changes what the seal claims", () => {
    const after = mutate((c) => {
      c.marketplaces[0].entries[0].sourceUrl = "https://example.com/other";
    });
    expect(mayAutoMerge(diffCatalogs(catalog(), after))).toBe(false);
  });
});

// 014/T103-T105 [US4] — tres buracos no fail-closed que o proprio modulo promete. Todos com o mesmo
// desfecho pratico: o PR mensal diz "algo mudou" sem descrever o que, ou nao diz nada.
describe("o comparador falha FECHADO — os tres buracos (T103/T104/T105)", () => {
  const base = (over = {}) => ({
    catalogVersion: "2026-07-28.1",
    marketplaces: [
      {
        marketplace: "AMAZON",
        determinantsSchema: { plan: ["PROFISSIONAL"], category: [] },
        categorySpine: [{ id: "calcados", name: "Calcados", parentId: null }],
        entries: [
          {
            determinants: { plan: "PROFISSIONAL", category: "calcados" },
            commissionPct: 14,
            lastReviewed: "2026-07-28",
          },
        ],
        ...over,
      },
    ],
  });

  // T103 — o laco compara espinha e entradas, e mais nada. Um campo de NIVEL MARKETPLACE muda e
  // passa despercebido: `determinantsSchema` e o contrato de quais determinantes existem, entao
  // perder um eixo ali muda o que resolve para o vendedor.
  it("T103: campo de nivel marketplace que muda derruba a dispensa", () => {
    const antes = base();
    const depois = base({ determinantsSchema: { plan: ["PROFISSIONAL"] } }); // o eixo `category` sumiu
    const diff = diffCatalogs(antes as never, depois as never);
    expect(mayAutoMerge(diff)).toBe(false);
  });

  // T104 — hoje uma entrada que SUMIU derruba `freshnessOnly` e nao entra em lista nenhuma. O
  // revisor recebe um PR que afirma haver mudanca e nao mostra qual: pior que nao avisar, porque
  // gasta a atencao dele sem dirigi-la.
  it("T104: entrada que sumiu aparece em lista PROPRIA, nao so como um sinal mudo", () => {
    const antes = base();
    const depois = base({ entries: [] });
    const diff = diffCatalogs(antes as never, depois as never);
    expect(mayAutoMerge(diff)).toBe(false);
    expect(diff.removedEntries).toHaveLength(1);
    expect(diff.removedEntries[0].determinants).toEqual({
      plan: "PROFISSIONAL",
      category: "calcados",
    });
  });

  it("T104: marketplace adicionado e removido tambem sao NOMEADOS", () => {
    const antes = base();
    const semAmazon = { catalogVersion: "2026-07-28.1", marketplaces: [] };
    expect(diffCatalogs(antes as never, semAmazon as never).removedMarketplaces).toEqual([
      "AMAZON",
    ]);
    expect(diffCatalogs(semAmazon as never, antes as never).addedMarketplaces).toEqual(["AMAZON"]);
  });

  // T105 — `spineOf`/`entriesOf` usam `Array.isArray`; `marketplaces` usava `?? []`, que so cobre
  // null/undefined. Um JSON VALIDO com `marketplaces` como objeto estoura — contra o contrato
  // "degrada, nao quebra" que o modulo declara.
  it("T105: `marketplaces` nao-array degrada em vez de estourar, e NEGA a dispensa", () => {
    const torto = { catalogVersion: "2026-07-28.1", marketplaces: { AMAZON: {} } };
    expect(() => diffCatalogs(base() as never, torto as never)).not.toThrow();
    expect(mayAutoMerge(diffCatalogs(base() as never, torto as never))).toBe(false);
  });

  // As duas OUTRAS formas de entrada que o artefato de verdade carrega: a catch-all so-de-modalidade
  // (sem `category`) e a Shopee, cujo `determinants` e literalmente `null`. Sumir com qualquer uma
  // delas tem de ser NOMEADO igual — e nomear "undefined" seria pior do que nao nomear.
  it("T104: entrada sem categoria e entrada de determinantes nulos tambem sao nomeadas", () => {
    const antes = {
      catalogVersion: "2026-07-28.1",
      marketplaces: [
        {
          marketplace: "AMAZON",
          entries: [{ determinants: { plan: "PROFISSIONAL" }, commissionPct: 15 }],
        },
        { marketplace: "SHOPEE", entries: [{ determinants: null, commissionPct: 20 }] },
      ],
    };
    const depois = {
      catalogVersion: "2026-07-28.1",
      marketplaces: [
        { marketplace: "AMAZON", entries: [] },
        { marketplace: "SHOPEE", entries: [] },
      ],
    };
    const diff = diffCatalogs(antes as never, depois as never);
    expect(diff.removedEntries).toEqual([
      { marketplace: "AMAZON", categoryId: null, determinants: { plan: "PROFISSIONAL" } },
      { marketplace: "SHOPEE", categoryId: null, determinants: null },
    ]);
    expect(mayAutoMerge(diff)).toBe(false);
  });

  it("e o caso sao: nada mudou fora das datas ⇒ dispensa continua possivel", () => {
    const antes = base();
    const depois = JSON.parse(JSON.stringify(base()));
    depois.marketplaces[0].entries[0].lastReviewed = "2026-08-01";
    expect(mayAutoMerge(diffCatalogs(antes as never, depois as never))).toBe(true);
  });
});
