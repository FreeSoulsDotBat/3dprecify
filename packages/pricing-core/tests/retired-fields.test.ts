import { describe, it, expect } from "vitest";

import {
  RETIRED_INPUT_FIELDS,
  ValidationError,
  computeBom,
  computeCalculator,
  isPreRemovalModel,
  stripRetiredFields,
} from "../src/index";
import type { PriceInput } from "../src/index";

/**
 * 016/US10 — pricing-core **4.0.0**: o `wasteGrams` sai do modelo (ADR-0026, decisão do dono D2/A).
 *
 * O que este arquivo prova não é aritmética — é o PAR que torna a remoção segura:
 *
 *  1. **recusa nominal** no motor: um chamador que ainda manda o campo quebra ALTO, dizendo o nome do
 *     campo e a saída documentada. Ignorar em silêncio era a alternativa rejeitada (ADR-0026 §4) —
 *     é a definição do defeito: um preço diferente sem um sinal.
 *  2. **porta documentada** (`stripRetiredFields`) no MESMO pacote, porque "o wasteGrams existiu até
 *     a 3.x" é a mesma informação que a constante de versão data (ADR-0026 §3.2).
 *
 * O re-baseline numérico (material = gramas × custo/kg) vive nos arquivos canônicos; aqui só a
 * fronteira.
 */

const VALIDO: PriceInput = {
  costPerRoll: 100,
  rollWeightKg: 1,
  printGrams: 100,
  printTimeHours: 5,
  avgPowerKw: 0.1,
  tariffPerKwh: 1,
  machineValue: 4000,
  machineLifetimeHours: 2000,
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
};

/** Como o campo volta na vida real: um `{...documentoAntigo}` que carrega a chave. O tipo 4.0.0 não
 *  a tem mais, então o único jeito de escrevê-la é por fora do tipo — que é exatamente a situação de
 *  um documento gravado hidratado em runtime. */
const comChave = (extra: Record<string, unknown>): PriceInput =>
  ({ ...VALIDO, ...extra }) as unknown as PriceInput;

describe("4.0.0 — a lista de campos aposentados é pública", () => {
  it("declara exatamente `wasteGrams` (a lista é o único lugar que sabe que o campo existiu)", () => {
    expect([...RETIRED_INPUT_FIELDS]).toEqual(["wasteGrams"]);
  });
});

describe("4.0.0 — computeCalculator RECUSA o campo aposentado (FR-912)", () => {
  it("(a) um valor de verdade é recusado, e o erro NOMEIA o campo", () => {
    try {
      computeCalculator(comChave({ wasteGrams: 10 }));
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe("wasteGrams");
      // A mensagem aponta a saída documentada — senão o chamador só sabe que quebrou, não o que fazer.
      expect((e as ValidationError).message).toContain("wasteGrams");
      expect((e as ValidationError).message).toContain("4.0.0");
      expect((e as ValidationError).message).toContain("stripRetiredFields()");
    }
  });

  it("(b) a CHAVE PRESENTE é o sinal — `wasteGrams: undefined` também recusa", () => {
    // Mutação que este caso mata: trocar `f in input` por `input[f] !== undefined`. O espalhamento
    // descuidado (`{...docAntigo}`) carrega a chave com o valor que estiver lá, e um `undefined`
    // passaria batido — voltando a descartar em silêncio pela porta dos fundos.
    expect(() => computeCalculator(comChave({ wasteGrams: undefined }))).toThrow(ValidationError);
  });

  it("(b') a chave herdada do PROTÓTIPO também recusa (`in`, não `hasOwnProperty`)", () => {
    // Mutação que este caso mata: trocar `f in input` por `Object.hasOwn(input, f)`. O `in` é o
    // contrato do ADR-0026, e ele é coerente com o `stripRetiredFields`: o espalhamento que a porta
    // faz descarta a chave herdada, então a recusa tem de enxergá-la — senão haveria um documento
    // que o motor aceita e a porta declara como descartado.
    const herdado = Object.create({ wasteGrams: 10 }) as Record<string, unknown>;
    Object.assign(herdado, VALIDO);
    expect(() => computeCalculator(herdado as unknown as PriceInput)).toThrow(ValidationError);
  });

  it("recusa ANTES de qualquer validação: uma entrada que é inválida POR OUTRO motivo culpa o campo aposentado", () => {
    // Não-vacuidade da ORDEM (ADR-0026 §3.1 "primeira coisa em computeCalculator"): se a recusa
    // viesse depois, este caso culparia `rollWeightKg` e o chamador consertaria a coisa errada.
    try {
      computeCalculator(comChave({ wasteGrams: 10, rollWeightKg: 0 }));
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect((e as ValidationError).field).toBe("wasteGrams");
    }
  });

  it("uma entrada SEM a chave computa normalmente (a recusa não é um portão fechado)", () => {
    expect(computeCalculator(VALIDO).custoTotal).toBeGreaterThan(0);
  });
});

describe("4.0.0 — computeBom herda a recusa, por linha (c)", () => {
  it("a linha que carrega a chave derruba o cálculo, e o erro identifica o campo", () => {
    try {
      computeBom([
        { input: VALIDO, quantity: 1 },
        { input: comChave({ wasteGrams: 10 }), quantity: 2 },
      ]);
      expect.unreachable("deveria ter lançado");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).field).toBe("wasteGrams");
      expect((e as ValidationError).message).toContain("stripRetiredFields()");
    }
  });

  it("um BOM inteiro sem a chave continua computando", () => {
    const bom = computeBom([{ input: VALIDO, quantity: 2 }]);
    expect(bom.custoTotal).toBeGreaterThan(0);
  });
});

describe("4.0.0 — stripRetiredFields: a porta documentada (d)", () => {
  it("separa o que fica do que foi descartado, com o valor para a declaração (FR-913)", () => {
    const r = stripRetiredFields({ wasteGrams: "10", printGrams: "100" });
    expect(r.kept).toEqual({ printGrams: "100" });
    expect(r.discarded).toEqual([{ field: "wasteGrams", value: "10" }]);
  });

  it("remove por `delete` — a chave NÃO existe no resultado, nem com `undefined`", () => {
    // Mutação que este caso mata: `kept[f] = undefined` no lugar do `delete`. Um `toEqual` sozinho
    // não veria a diferença (o Vitest ignora chave com undefined), e o resultado voltaria a ser
    // recusado pelo próprio motor — a porta devolveria um documento que não passa pela porta.
    const r = stripRetiredFields({ wasteGrams: 10, printGrams: 100 });
    expect("wasteGrams" in r.kept).toBe(false);
    expect(Object.keys(r.kept)).toEqual(["printGrams"]);
  });

  it("é genérica na FOLHA: número numa entrada viva, string num documento gravado", () => {
    expect(stripRetiredFields({ wasteGrams: 10 }).discarded).toEqual([
      { field: "wasteGrams", value: "10" },
    ]);
    expect(stripRetiredFields({ wasteGrams: "7,5" }).discarded).toEqual([
      { field: "wasteGrams", value: "7,5" },
    ]);
  });

  it("uma folha vazia (undefined/null) ainda é descarte declarado, com valor vazio", () => {
    // A CHAVE é o fato; o valor é só o que a tela consegue mostrar. "undefined" na tela seria pior
    // do que nada — mas calar o descarte seria a mentira que a FR-913 proíbe.
    expect(stripRetiredFields({ wasteGrams: undefined }).discarded).toEqual([
      { field: "wasteGrams", value: "" },
    ]);
    expect(stripRetiredFields({ wasteGrams: null }).discarded).toEqual([
      { field: "wasteGrams", value: "" },
    ]);
  });

  it("um documento SEM o campo passa intacto e sem descarte (ausência = nada a declarar)", () => {
    const original = { printGrams: 100, markupVarejoPct: 50 };
    const r = stripRetiredFields(original);
    expect(r.kept).toEqual(original);
    expect(r.discarded).toEqual([]);
  });

  it("é PURA — não muta o argumento", () => {
    const original: Record<string, unknown> = { wasteGrams: 10, printGrams: 100 };
    const antes = JSON.stringify(original);
    stripRetiredFields(original);
    expect(JSON.stringify(original)).toBe(antes);
    expect("wasteGrams" in original).toBe(true);
  });

  it("o que ela devolve é aceito pelo motor — a porta fecha o ciclo que a recusa abriu", () => {
    const documentoAntigo = { ...VALIDO, wasteGrams: 10 };
    const { kept, discarded } = stripRetiredFields(documentoAntigo);
    expect(discarded).toHaveLength(1);
    const r = computeCalculator(kept as unknown as PriceInput);
    // Material = 100 g × (R$ 100 / 1000 g) = R$ 10,00 — o desperdício não entra mais na conta.
    expect(r.material).toBe(10.0);
  });
});

describe("4.0.0 — isPreRemovalModel: a regra de leitura do documento congelado (e)", () => {
  it("3.1.0 é pré-remoção; 4.0.0 não é", () => {
    expect(isPreRemovalModel("3.1.0")).toBe(true);
    expect(isPreRemovalModel("4.0.0")).toBe(false);
  });

  it("compara o MAJOR como número, não como texto — 10.2.3 não é pré-remoção", () => {
    // Não-vacuidade: uma comparação de strings diria `"10" < "4"` e classificaria a versão 10 como
    // pré-remoção. É o bug clássico de versão-como-texto, e ele mentiria numa declaração ao usuário.
    expect(isPreRemovalModel("10.2.3")).toBe(false);
    expect(isPreRemovalModel("2.0.0")).toBe(true);
  });

  it("versão sem major legível não é declarada pré-remoção (comportamento medido, deliberado)", () => {
    // Todo `modelVersion` gravado foi carimbado pelo próprio motor, então este caso não existe em
    // documento real. Fica pinado para que ninguém o "conserte" para um lado sem decidir com o dono.
    expect(isPreRemovalModel("")).toBe(false);
  });
});
