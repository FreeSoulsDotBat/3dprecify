import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { AMAZON_INDIVIDUAL_PER_ITEM_FEE } from "../amazon-to-catalog.ts";

// 017/T020 (US4 · arquitetura-017.md §E) — vermelho observado ANTES de `watch/amazon-precos.ts`
// existir: todo `import` abaixo falha até T021.
//
// A fixture é um RECORTE MÍNIMO da /precos real (`__fixtures__/amazon-precos.excerpt.html`),
// baixada por `curl -s https://venda.amazon.com.br/precos` em 2026-08-08 (medido: HTTP 200,
// 647813 bytes, sem navegador). Os valores medidos DIVERGEM da hipótese do brief numa coisa
// importante — está registrado no cabeçalho do fixture e repetido no `dod-evidence.md`: a página
// hoje afirma a comissão mínima como R$ 1,00 UNIFORME (não "~11 categorias a R$ 2,00"); os planos
// batem exatamente com o brief (Individual R$ 2,00/item · Profissional R$ 19,00/mês) e a
// auto-datação "20/01/2025" também bate.

const EXCERPT = readFileSync(
  new URL("./__fixtures__/amazon-precos.excerpt.html", import.meta.url),
  "utf8",
);

describe("o módulo NUNCA exporta um caminho até o dinheiro (D7 · decisão E.2)", () => {
  it("nenhum export do watch é uma função WatchReading -> FeeEntry | CatalogSlice", async () => {
    const modulo = await import("./amazon-precos.ts");
    const nomesQueEscreveriamDinheiro = Object.keys(modulo).filter((nome) =>
      /toFeeEntry|toCatalogSlice|paraFatia|paraFolha|toLeaf/i.test(nome),
    );
    expect(nomesQueEscreveriamDinheiro).toEqual([]);
  });
});

describe("parseAmazonPrecos — parser determinístico sobre a fixture REAL", () => {
  it("captura a comissão mínima, os dois planos e a auto-datação", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const r = parseAmazonPrecos(EXCERPT, {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-08-08",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reading.comissaoMinima).toBe(1.0);
    expect(r.reading.individualPerItem).toBe(2.0);
    expect(r.reading.profissionalMensal).toBe(19.0);
    expect(r.reading.selfDatedAs).toBe("20/01/2025");
    expect(r.reading.collectedAt).toBe("2026-08-08");
    expect(r.reading.sourceUrl).toBe("https://venda.amazon.com.br/precos");
  });

  it("o plano Individual medido bate com a constante que já é a fonte do número servido", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const r = parseAmazonPrecos(EXCERPT, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reading.individualPerItem).toBe(AMAZON_INDIVIDUAL_PER_ITEM_FEE);
  });

  it("duas leituras da MESMA fixture produzem o MESMO reading (função pura)", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const a = parseAmazonPrecos(EXCERPT, { sourceUrl: "x", collectedAt: "2026-08-08" });
    const b = parseAmazonPrecos(EXCERPT, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ÂNCORA SUMIDA (mutação: a frase da comissão mínima removida) ⇒ ABORT nomeado, nunca 'diff vazio'", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const mutada = EXCERPT.replace(/comiss[aã]o m[ií]nima, equivalente a R\$[^.]*\./gi, "");
    const r = parseAmazonPrecos(mutada, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/comiss[aã]o m[ií]nima/i);
  });

  it("ÂNCORA do plano Individual sumida ⇒ ABORT nomeado", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const mutada = EXCERPT.replace(/por produto vendido/gi, "");
    const r = parseAmazonPrecos(mutada, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/individual/i);
  });

  it("ÂNCORA do plano Profissional sumida ⇒ ABORT nomeado", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const mutada = EXCERPT.replace(/mensais/gi, "");
    const r = parseAmazonPrecos(mutada, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/profissional/i);
  });

  it("sem auto-datação (âncora ausente) ⇒ ainda LÊ os valores, com `selfDatedAs: null`", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const mutada = EXCERPT.replace(/atualizadas em \d{2}\/\d{2}\/\d{4}/gi, "");
    const r = parseAmazonPrecos(mutada, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reading.selfDatedAs).toBeNull();
  });

  it("`absentAnchors` presente (mutação: a página passa a falar de mínimo POR CATEGORIA) ⇒ ABORT", async () => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const mutada = EXCERPT.replace(
      "a comissão mínima, equivalente a R$ 1,00 (um real)",
      "a comissão mínima por categoria, listada abaixo",
    );
    const r = parseAmazonPrecos(mutada, { sourceUrl: "x", collectedAt: "2026-08-08" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/por categoria/i);
  });
});

// 017/T021 — o vigia em si: baseline vs leitura vs a constante que já é a fonte do número servido.
describe("avaliarVigiaAmazonPrecos — divergência, decisão e o caminho comum (E.3/E.4)", () => {
  const baselineDe = async (overrides: Record<string, unknown> = {}) => {
    const { parseAmazonPrecos } = await import("./amazon-precos.ts");
    const r = parseAmazonPrecos(EXCERPT, {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-08-08",
    });
    if (!r.ok) throw new Error("fixture não deveria abortar");
    const { baselineFromReading } = await import("./amazon-precos.ts");
    return { ...baselineFromReading(r.reading), ...overrides };
  };

  it("leitura igual ao baseline ⇒ SEM_NOTICIA (o caminho comum, sem PR)", async () => {
    const { parseAmazonPrecos, avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe();
    const r = parseAmazonPrecos(EXCERPT, {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
    });
    if (!r.ok) throw new Error("não deveria abortar");
    const v = avaliarVigiaAmazonPrecos({ leitura: r.reading, baseline });
    expect(v.kind).toBe("SEM_NOTICIA");
  });

  it("plano Individual muda vs baseline (mas continua batendo com a constante) ⇒ DIVERGENCIA, nunca DECISAO", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe();
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "20/01/2025",
      comissaoMinima: 1.5, // mudou vs baseline (1,00) — dispara o relato
      individualPerItem: 2.0,
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") {
      expect(v.relato.fonte).toMatch(/amazon.*precos/i);
      expect(v.relato.resumo).toMatch(/1,00.*1,50|1,50/);
      expect(v.relato.sourceUrl).toBe(leitura.sourceUrl);
      expect(v.baselineAtualizado.values.comissaoMinima).toBe(1.5);
    }
  });

  it("plano Individual DIVERGE da constante (novo valor) ⇒ DIVERGENCIA com a constante citada", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe();
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "20/01/2025",
      comissaoMinima: 1.0,
      individualPerItem: 2.5,
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") {
      expect(v.relato.resumo).toContain("2,00");
      expect(v.relato.resumo).toContain("2,50");
    }
  });

  it("individual JÁ divergia e CONTINUA divergindo no MESMO valor, mas outro campo mudou ⇒ resumo cita a divergência que persiste", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe({
      values: { comissaoMinima: 1.0, individualPerItem: 2.5, profissionalMensal: 19.0 },
    });
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "20/01/2025",
      comissaoMinima: 1.5, // o que muda este mês é a comissão mínima, não o plano Individual
      individualPerItem: 2.5, // igual ao baseline — mas ainda diverge da constante (2,00)
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") {
      expect(v.relato.resumo).toMatch(/segue divergindo/);
      expect(v.relato.resumo).toContain("2,50");
    }
  });

  it("mensalidade do Profissional muda vs baseline ⇒ entra no resumo", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe();
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "20/01/2025",
      comissaoMinima: 1.0,
      individualPerItem: 2.0,
      profissionalMensal: 25.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") expect(v.relato.resumo).toContain("Profissional");
  });

  it("auto-datação muda vs baseline ⇒ entra no resumo (a página se re-datou)", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe();
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "15/03/2026",
      comissaoMinima: 1.0,
      individualPerItem: 2.0,
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") expect(v.relato.resumo).toContain("auto-datação");
  });

  it("baseline SEM auto-datação (null) e a leitura passa a ter uma ⇒ o resumo imprime '(ausente)', nunca `null`", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe({ selfDatedAs: null });
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "20/01/2025",
      comissaoMinima: 1.0,
      individualPerItem: 2.0,
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") {
      expect(v.relato.resumo).toContain("(ausente)");
      expect(v.relato.diffBaseline).toContain("null");
      expect(v.relato.diffBaseline).not.toContain("undefined");
    }
  });

  it("a leitura PERDE a auto-datação que o baseline tinha ⇒ o resumo também imprime '(ausente)' do outro lado", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    const baseline = await baselineDe();
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: null,
      comissaoMinima: 1.0,
      individualPerItem: 2.0,
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DIVERGENCIA");
    if (v.kind === "DIVERGENCIA") {
      expect(v.relato.resumo).toContain("20/01/2025 → (ausente)");
      expect(v.relato.diffBaseline).toContain("null");
    }
  });

  it("CONVERGÊNCIA — a leitura deixa de divergir da constante ⇒ DECISAO, e o dado não muda (Q2)", async () => {
    const { avaliarVigiaAmazonPrecos } = await import("./amazon-precos.ts");
    // baseline com uma divergência PRÉ-EXISTENTE (mês anterior já achava 2,50)
    const baseline = await baselineDe({
      values: { comissaoMinima: 1.0, individualPerItem: 2.5, profissionalMensal: 19.0 },
    });
    const leitura = {
      sourceUrl: "https://venda.amazon.com.br/precos",
      collectedAt: "2026-09-01",
      selfDatedAs: "20/01/2025",
      comissaoMinima: 1.0,
      individualPerItem: 2.0, // voltou a bater com AMAZON_INDIVIDUAL_PER_ITEM_FEE
      profissionalMensal: 19.0,
    };
    const v = avaliarVigiaAmazonPrecos({ leitura, baseline });
    expect(v.kind).toBe("DECISAO");
    if (v.kind === "DECISAO") {
      expect(v.decisao.fonteA.valor).toContain("2,00");
      expect(v.decisao.fonteB.valor).toContain("2,00");
      expect(v.decisao.autoDatacao).toBe("20/01/2025");
    }
  });

  it("`baselineFromReading` nunca produz uma função WatchReading -> FeeEntry/CatalogSlice (canária estrutural)", async () => {
    const modulo = await import("./amazon-precos.ts");
    for (const nome of Object.keys(modulo)) {
      expect(nome).not.toMatch(/toFeeEntry|toCatalogSlice|paraFatia/i);
    }
  });
});
