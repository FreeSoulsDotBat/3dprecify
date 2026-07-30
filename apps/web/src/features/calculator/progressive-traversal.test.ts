import { readFileSync } from "node:fs";

import { grossUp } from "@3dprecify/pricing-core";
import { describe, expect, it } from "vitest";

import { parseFeeCatalog } from "../../shared/fee-catalog";
import { entryToChannelFees, resolveSlot } from "./fee-prefill";

// ADR-0024 §5 — o risco REAL desta correção não é errar a aritmética progressiva. É `bandMode` se
// PERDER em algum ponto do trajeto artefato → resolução → taxas → motor, e degradar em silêncio de
// volta para seleção. Isso seria o bug original de volta, agora invisível porque o PADRÃO o justifica.
//
// Por isso este teste atravessa a cadeia inteira contra o ARTEFATO COMMITADO DE VERDADE, não contra
// fixture. Um fixture prova a função; só o artefato real prova o produto — a lição que a varredura
// adversarial cobrou (o caminho catch-all era "provado" por um fixture cuja forma o gerador nunca
// produz, e passou verde durante todo o incremento).

const served: unknown = JSON.parse(
  readFileSync(new URL("../../../../../backend/app/data/catalog.json", import.meta.url), "utf8"),
);
const catalog = parseFeeCatalog(served);

/** O modo APAGADO — exatamente o que o bug fazia, e o que uma regressão futura faria em silêncio. */
function semModo(fees: ReturnType<typeof entryToChannelFees>) {
  const copy = { ...fees };
  delete copy.bandMode;
  return copy;
}

/** Categorias que a Amazon cobra por parcela, com o limiar publicado e o erro que a seleção causava. */
const PROGRESSIVAS = [
  { id: "moveis", limiar: 200, erroDaSelecao: 10 },
  { id: "colchoes", limiar: 200, erroDaSelecao: 10 },
  { id: "acessorios-eletronicos", limiar: 100, erroDaSelecao: 5 },
] as const;

describe("SC-814 — a travessia até o dinheiro, contra o artefato commitado", () => {
  it.each(PROGRESSIVAS)(
    "$id: o artefato declara PROGRESSIVE e o modo sobrevive até `ChannelFees`",
    ({ id }) => {
      const { entry } = resolveSlot(catalog, "AMAZON", "PROFISSIONAL", id);
      expect(entry).not.toBeNull();
      expect(entry?.bandMode).toBe("PROGRESSIVE");
      // o elo que o ADR-0024 §5 aponta como o frágil
      expect(entryToChannelFees(entry!).bandMode).toBe("PROGRESSIVE");
    },
  );

  it.each(PROGRESSIVAS)(
    "$id: acima do limiar o líquido fecha na conta da FONTE, não na da seleção",
    ({ id, limiar, erroDaSelecao }) => {
      const { entry } = resolveSlot(catalog, "AMAZON", "PROFISSIONAL", id);
      const fees = entryToChannelFees(entry!);
      const base = limiar * 1.5; // seguramente acima do limiar
      const comProgressao = grossUp(base, fees);
      const comSelecao = grossUp(base, semModo(fees));

      expect(comProgressao.liquido).toBe(base);
      expect(comSelecao.liquido).toBe(base); // a seleção também "fecha"…
      // …mas fecha sobre uma comissão que a Amazon não cobraria: o anúncio da seleção é BAIXO demais,
      // e a diferença é exatamente o erro constante (15% − 10%) × limiar, propagado pelo gross-up.
      expect(comProgressao.anuncio).toBeGreaterThan(comSelecao.anuncio);
      const faltando = comProgressao.anuncio - comSelecao.anuncio;
      expect(faltando).toBeCloseTo(erroDaSelecao / 0.9, 1);
    },
  );

  it("abaixo do limiar as duas leituras coincidem — a correção não move o que já estava certo", () => {
    const { entry } = resolveSlot(catalog, "AMAZON", "PROFISSIONAL", "moveis");
    const fees = entryToChannelFees(entry!);
    expect(grossUp(50, fees).anuncio).toBe(grossUp(50, semModo(fees)).anuncio);
  });

  it("nenhuma categoria PLANA ganhou `bandMode` — a aditividade não vazou", () => {
    const amazon = catalog.marketplaces.find((m) => m.marketplace === "AMAZON");
    for (const e of amazon?.entries ?? []) {
      if (e.priceBands == null || e.priceBands.length === 0) {
        expect(e.bandMode).toBeUndefined();
      }
    }
  });

  it("os outros marketplaces seguem SEM modo — ausência é o significado gravado (SC-815)", () => {
    for (const name of ["MERCADO_LIVRE", "SHOPEE"] as const) {
      const mk = catalog.marketplaces.find((m) => m.marketplace === name);
      for (const e of mk?.entries ?? []) expect(e.bandMode).toBeUndefined();
    }
  });
});
