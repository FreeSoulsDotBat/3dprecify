import { describe, expect, it } from "vitest";

import { ARQUIVOS_DISPENSAVEIS, classificarDispensa, lerPermissaoDeDispensa } from "./exemption.ts";

// 017/T011 (desenho §I) — a dispensa de revisão, falha-fechada nos DOIS eixos.
//
// O buraco que o SEGUNDO marketplace abre, e que é achado do desenho: `mayAutoMerge(diff)` decide
// olhando SÓ o diff do catálogo. A partir do 017 o PR mensal também carrega BASELINES de vigia. Um
// mês em que só um baseline mude produz diff de catálogo vazio ⇒ `freshnessOnly === true` ⇒ dispensa
// concedida — e um arquivo que ninguém revisou entraria sozinho.

const base = {
  permitida: true,
  diffSoInerte: true,
  arquivosDoPr: [...ARQUIVOS_DISPENSAVEIS],
  contemFolhaDeOcr: false,
};

describe("lerPermissaoDeDispensa — ela NASCE desligada (clarify Q5)", () => {
  it("sem a variável, é false", () => {
    expect(lerPermissaoDeDispensa(undefined)).toBe(false);
    expect(lerPermissaoDeDispensa("")).toBe(false);
  });

  it("só a string exata `true` liga — nada de valor caprichoso ligando dispensa de dinheiro", () => {
    expect(lerPermissaoDeDispensa("true")).toBe(true);
    for (const v of ["TRUE", "1", "yes", "sim", "false", "verdadeiro"]) {
      expect(lerPermissaoDeDispensa(v)).toBe(false);
    }
  });
});

describe("classificarDispensa — o caso concedido, e ele é estreito", () => {
  it("flag ligada + diff só inerte + arquivos ⊆ par ⇒ CONCEDIDA, com o porquê escrito", () => {
    const d = classificarDispensa(base);
    expect(d.concedida).toBe(true);
    expect(d.eixosQueNegaram).toEqual([]);
    expect(d.motivo).toMatch(/lastReviewed|inerte/i);
  });

  it("um SUBCONJUNTO do par também passa (mês em que só o artefato mudou)", () => {
    expect(
      classificarDispensa({ ...base, arquivosDoPr: ["backend/app/data/catalog.json"] }).concedida,
    ).toBe(true);
  });
});

describe("classificarDispensa — falha FECHADO, e nomeia o eixo que negou", () => {
  it("eixo FLAG: a permissão desligada nega sozinha, mesmo com tudo o resto limpo", () => {
    const d = classificarDispensa({ ...base, permitida: false });
    expect(d.concedida).toBe(false);
    expect(d.eixosQueNegaram).toContain("FLAG");
    expect(d.motivo).toMatch(/ALLOW_FRESHNESS_EXEMPTION/);
  });

  it("eixo DIFF: qualquer mudança material nega", () => {
    const d = classificarDispensa({ ...base, diffSoInerte: false });
    expect(d.concedida).toBe(false);
    expect(d.eixosQueNegaram).toContain("DIFF_MATERIAL");
  });

  // O caso do data-model §7 — o buraco que o desenho encontrou.
  it("eixo ARQUIVOS: baseline de vigia no PR ⇒ NEGADA, mesmo com o diff do catálogo só-lastReviewed", () => {
    const d = classificarDispensa({
      ...base,
      arquivosDoPr: [
        "backend/app/data/catalog.json",
        "apps/web/src/shared/fee-catalog/seed.data.json",
        "packages/fee-ingest/data/amazon-precos.baseline.json",
      ],
    });
    expect(d.concedida).toBe(false);
    expect(d.eixosQueNegaram).toEqual(["ARQUIVOS_FORA_DO_PAR"]);
    expect(d.motivo).toContain("packages/fee-ingest/data/amazon-precos.baseline.json");
  });

  // §F.5 — proibição explícita do desenho. Fica declarada aqui desde já porque a folha de OCR chega
  // na PR-C, e um eixo acrescentado DEPOIS é um eixo que alguém precisa lembrar de acrescentar.
  it("eixo OCR: folha vinda de OCR nunca dispensa revisão, por mais inerte que o diff pareça", () => {
    const d = classificarDispensa({ ...base, contemFolhaDeOcr: true });
    expect(d.concedida).toBe(false);
    expect(d.eixosQueNegaram).toContain("FOLHA_DE_OCR");
  });

  it("vários eixos negando aparecem TODOS — o revisor não conserta um e descobre o outro depois", () => {
    const d = classificarDispensa({
      permitida: false,
      diffSoInerte: false,
      arquivosDoPr: ["README.md"],
      contemFolhaDeOcr: true,
    });
    expect(d.eixosQueNegaram).toEqual([
      "FLAG",
      "DIFF_MATERIAL",
      "ARQUIVOS_FORA_DO_PAR",
      "FOLHA_DE_OCR",
    ]);
  });

  it("um PR sem arquivo nenhum não é 'subconjunto vazio ⇒ dispensável' — não há PR a dispensar", () => {
    const d = classificarDispensa({ ...base, arquivosDoPr: [] });
    expect(d.concedida).toBe(false);
    expect(d.eixosQueNegaram).toContain("ARQUIVOS_FORA_DO_PAR");
  });
});
