import { describe, expect, it } from "vitest";

import { LIVENESS_WARNING_DAYS, LOOP_CYCLE_DAYS, avaliarLiveness } from "./liveness.ts";

// 017/T022 (US7 · decisão G do desenho) — vermelho observado ANTES de `liveness.ts` existir.
//
// A DECISÃO é medir a idade do DADO (`lastReviewed`), não a idade do RUN — um job que roda e
// ABORTA parece "vivo" pra quem só olha o histórico de execuções, e é exatamente o caso que mais
// importa (G.1). `35 = LOOP_CYCLE_DAYS(31) + 4`, e o número É CÓDIGO, não constante mágica: 35 < 45
// porque o dono precisa ser avisado ANTES de o selo falar "atualizada há mais de 45 dias" com o
// vendedor.

const catalogo = (marketplaces: Record<string, { lastReviewed: string }[]>) => ({
  marketplaces: Object.entries(marketplaces).map(([marketplace, entries]) => ({
    marketplace,
    entries,
  })),
});

describe("avaliarLiveness — idade do DADO, restrita à MARKETPLACE_COVERAGE", () => {
  it("35 = LOOP_CYCLE_DAYS(31) + 4 de folga — a REGRA, não o número solto", () => {
    expect(LIVENESS_WARNING_DAYS).toBe(LOOP_CYCLE_DAYS + 4);
    expect(LIVENESS_WARNING_DAYS).toBeLessThan(45); // 35 < 45: avisa ANTES do selo falar com o vendedor
  });

  it("dado recente (10 dias) ⇒ OK", () => {
    const c = catalogo({ AMAZON: [{ lastReviewed: "2026-07-29" }] });
    const r = avaliarLiveness(c, "2026-08-08");
    expect(r).toEqual({ kind: "OK", idadeDias: 10 });
  });

  it("dado com exatamente 35 dias ⇒ AINDA ok (o limiar é '> 35', não '>=')", () => {
    const c = catalogo({ AMAZON: [{ lastReviewed: "2026-07-04" }] });
    const r = avaliarLiveness(c, "2026-08-08");
    expect(r.kind).toBe("OK");
  });

  it("dado com 36 dias ⇒ AVISO, com a data mais recente nomeada", () => {
    const c = catalogo({ AMAZON: [{ lastReviewed: "2026-07-03" }] });
    const r = avaliarLiveness(c, "2026-08-08");
    expect(r).toEqual({ kind: "AVISO", idadeDias: 36, maisRecente: "2026-07-03" });
  });

  it("usa o MAIS RECENTE entre todos os marketplaces cobertos — um coletor vivo conta como sinal de vida", () => {
    const c = catalogo({
      AMAZON: [{ lastReviewed: "2026-06-01" }],
      SHOPEE: [{ lastReviewed: "2026-08-01" }],
      MERCADO_LIVRE: [],
    });
    const r = avaliarLiveness(c, "2026-08-08");
    expect(r).toEqual({ kind: "OK", idadeDias: 7 });
  });

  it("a PRIMEIRA data (na ordem de MARKETPLACE_COVERAGE) já é a mais recente ⇒ ela vence a comparação", () => {
    const c = catalogo({
      AMAZON: [{ lastReviewed: "2026-08-01" }],
      MERCADO_LIVRE: [],
      SHOPEE: [{ lastReviewed: "2026-06-01" }],
    });
    const r = avaliarLiveness(c, "2026-08-08");
    expect(r).toEqual({ kind: "OK", idadeDias: 7 });
  });

  it("uma entrada SEM `lastReviewed` (forma quebrada de uma linha) é IGNORADA, não derruba o job", () => {
    const c = catalogo({
      AMAZON: [{ lastReviewed: "2026-08-01" }, { lastReviewed: undefined as unknown as string }],
      SHOPEE: [],
      MERCADO_LIVRE: [],
    });
    const r = avaliarLiveness(c, "2026-08-08");
    expect(r).toEqual({ kind: "OK", idadeDias: 7 });
  });

  it("cobertura vazia (nenhum marketplace coberto tem `lastReviewed`) ⇒ NUNCA_COLETADO, mensagem PRÓPRIA", () => {
    const c = catalogo({ AMAZON: [], MERCADO_LIVRE: [], SHOPEE: [] });
    expect(avaliarLiveness(c, "2026-08-08")).toEqual({ kind: "NUNCA_COLETADO" });
  });

  it("artefato sem `marketplaces` (forma quebrada) ⇒ NUNCA_COLETADO, nunca uma exceção", () => {
    expect(avaliarLiveness({}, "2026-08-08")).toEqual({ kind: "NUNCA_COLETADO" });
  });

  it("marketplace fora da cobertura é IGNORADO — ele não pode segurar a idade sozinho", () => {
    const c = catalogo({
      AMAZON: [],
      MERCADO_LIVRE: [],
      SHOPEE: [],
      // um marketplace hipotético que a tabela de cobertura não conhece
      OUTRO: [{ lastReviewed: "2026-08-08" }],
    });
    expect(avaliarLiveness(c, "2026-08-08")).toEqual({ kind: "NUNCA_COLETADO" });
  });
});
