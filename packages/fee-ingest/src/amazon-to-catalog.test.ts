import { describe, expect, it } from "vitest";

import type { ParsedCategory } from "./amazon-parse";
import {
  AMAZON_CAVEATS_FULL,
  AMAZON_FEE_BASE_CAVEAT,
  AMAZON_SOURCE_URL,
  amazonEntries,
  amazonSpine,
  categoryId,
} from "./amazon-to-catalog";
import { checkBandCoverage, checkParseSanity } from "./guardrails";

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

  it("covers both plans with the same commission — the table does not vary by plan", () => {
    expect(entries).toHaveLength(6);
    const forCat = (plan: string) =>
      entries.find((e) => e.determinants.plan === plan && e.determinants.category === "outros");
    expect(forCat("PROFISSIONAL")?.commissionPct).toBe(15);
    expect(forCat("INDIVIDUAL")?.commissionPct).toBe(15);
  });

  it("carries the banded category through as bands, never flattened", () => {
    const banded = entries.find((e) => e.determinants.category === "acessorios-eletronicos");
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
  const canaries = [["Outros", 15]] as const;

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
