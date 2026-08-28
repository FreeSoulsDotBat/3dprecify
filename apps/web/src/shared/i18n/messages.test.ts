import { describe, expect, it } from "vitest";

import { messages } from "./messages.pt-br";

// 019/T027 (US2, decisão do dono 25/08 — spec §Clarifications "vocabulário"): a palavra que a
// pessoa lê é "marketplace", nunca "canal". O SÍMBOLO continua `channel*` (chaves, rotas,
// `channelSet`, arquivos) — esta guarda olha só o VALOR de cada folha de `messages`, que é o que
// vira texto na tela. A V0 mediu 31 folhas (dod-evidence §T003); a lista de exceções nasce vazia e
// TERMINA vazia — uma exceção só entra datada e com motivo, e a T032 é quem zera as 31.
function leaves(value: unknown, path = "", acc: [string, string][] = []): [string, string][] {
  if (typeof value === "string") acc.push([path, value]);
  else if (value && typeof value === "object")
    for (const [k, v] of Object.entries(value)) leaves(v, path ? `${path}.${k}` : k, acc);
  return acc;
}

/** Exceções JUSTIFICADAS, por caminho de chave — vazia ao fim da PR-A (T032). */
const EXCECOES: ReadonlyMap<string, string> = new Map([]);

describe("019/T027 — o vocabulário visível", () => {
  it('nenhuma frase visível diz "canal"/"canais" (símbolos ficam; só o texto muda)', () => {
    const achados = leaves(messages)
      .filter(([, texto]) => /canal|canais/i.test(texto))
      .filter(([caminho]) => !EXCECOES.has(caminho))
      .map(([caminho, texto]) => `${caminho}: ${texto}`);
    expect(achados, `folhas com "canal":\n${achados.join("\n")}`).toEqual([]);
  });

  it("toda exceção listada ainda existe e ainda diz canal (lista não envelhece)", () => {
    const atuais = new Map(leaves(messages));
    for (const [caminho, motivo] of EXCECOES) {
      expect(atuais.get(caminho), `${caminho} sumiu — tire da lista (${motivo})`).toBeDefined();
      expect(/canal|canais/i.test(atuais.get(caminho) ?? "")).toBe(true);
    }
  });

  it("avisoAtacadoAcimaDoVarejo tem os acentos (preço · só · é)", () => {
    const frase = messages.calculator.avisoAtacadoAcimaDoVarejo as string;
    expect(frase).toContain("preço");
    expect(frase).toContain("só");
    expect(frase).toContain(" é "); // `\b` do JS é ASCII — não vê fronteira antes de "é"
  });
});
