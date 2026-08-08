import { describe, expect, it } from "vitest";

import type { AmazonPrecosBaseline } from "./amazon-precos.ts";
import { paraComposicao } from "./vigia-artifacts.ts";

// 017/T023 — vermelho observado ANTES de `vigia-artifacts.ts` existir: a PONTE entre o artefato
// que `watch-amazon-precos.mjs` grava em disco e os argumentos `vigias`/`decisao`/baselines que
// `compor` (e o `build.mjs`) precisam. Pura e testada — os `.mjs` só fazem I/O em volta dela
// (014/US4: nenhuma decisão pode morar num lugar isento de cobertura).

const baseline: AmazonPrecosBaseline = {
  sourceUrl: "https://venda.amazon.com.br/precos",
  collectedAt: "2026-08-08",
  selfDatedAs: "20/01/2025",
  shape: { rows: 3, cols: 1 },
  anchors: [],
  absentAnchors: [],
  values: { comissaoMinima: 1, individualPerItem: 2, profissionalMensal: 19 },
  contentHash: "sha256:abc",
};

describe("paraComposicao — nenhum artefato de vigia", () => {
  it("[] ⇒ vigias vazio, nenhuma decisão, nenhum baseline a escrever", () => {
    const r = paraComposicao([]);
    expect(r).toEqual({ vigias: [], baselinesParaEscrever: {} });
  });
});

describe("paraComposicao — SEM_NOTICIA", () => {
  it("não vira relato nem escreve baseline (o baseline não mudou)", () => {
    const r = paraComposicao([
      { fonte: "amazon-precos", resultado: { kind: "SEM_NOTICIA", baselineAtualizado: baseline } },
    ]);
    expect(r.vigias).toEqual([]);
    expect(r.decisao).toBeUndefined();
    expect(r.baselinesParaEscrever).toEqual({});
  });
});

describe("paraComposicao — DIVERGENCIA", () => {
  it("vira UM relato em `vigias`, e o baseline atualizado entra em `baselinesParaEscrever`", () => {
    const relato = {
      fonte: "Amazon /precos",
      sourceUrl: "https://venda.amazon.com.br/precos",
      resumo: "algo mudou",
    };
    const r = paraComposicao([
      {
        fonte: "amazon-precos",
        resultado: { kind: "DIVERGENCIA", relato, baselineAtualizado: baseline },
      },
    ]);
    expect(r.vigias).toEqual([relato]);
    expect(r.decisao).toBeUndefined();
    expect(r.baselinesParaEscrever).toEqual({ "amazon-precos.baseline.json": baseline });
  });
});

describe("paraComposicao — DECISAO", () => {
  it("vira a SecaoDeDecisao (forçando o desfecho a PR de decisão), e ainda assim atualiza o baseline", () => {
    const decisao = {
      titulo: "convergiu",
      fonteA: { rotulo: "página", valor: "R$ 2,00", url: "https://venda.amazon.com.br/precos" },
      fonteB: { rotulo: "servido", valor: "R$ 2,00", url: "https://x" },
      autoDatacao: "20/01/2025",
    };
    const r = paraComposicao([
      {
        fonte: "amazon-precos",
        resultado: { kind: "DECISAO", decisao, baselineAtualizado: baseline },
      },
    ]);
    expect(r.decisao).toEqual(decisao);
    expect(r.vigias).toEqual([]);
    expect(r.baselinesParaEscrever).toEqual({ "amazon-precos.baseline.json": baseline });
  });
});

describe("paraComposicao — ABORT do vigia", () => {
  it("não escreve baseline, não vira relato — consequência é parada, nunca corrupção", () => {
    const r = paraComposicao([
      { fonte: "amazon-precos", resultado: { kind: "ABORT", reason: "âncora sumida" } },
    ]);
    expect(r.vigias).toEqual([]);
    expect(r.baselinesParaEscrever).toEqual({});
  });
});

describe("paraComposicao — DUAS decisões pendentes no mesmo mês (hipotético, hoje só existe uma fonte)", () => {
  it("a PRIMEIRA decisão encontrada vence — nunca silenciosamente combinadas", () => {
    const decisaoA = {
      titulo: "A",
      fonteA: { rotulo: "x", valor: "1", url: "u" },
      fonteB: { rotulo: "y", valor: "2", url: "u" },
      autoDatacao: null,
    };
    const decisaoB = { ...decisaoA, titulo: "B" };
    const r = paraComposicao([
      {
        fonte: "amazon-precos",
        resultado: { kind: "DECISAO", decisao: decisaoA, baselineAtualizado: baseline },
      },
      {
        fonte: "outra-fonte",
        resultado: { kind: "DECISAO", decisao: decisaoB, baselineAtualizado: baseline },
      },
    ]);
    expect(r.decisao?.titulo).toBe("A");
  });
});
