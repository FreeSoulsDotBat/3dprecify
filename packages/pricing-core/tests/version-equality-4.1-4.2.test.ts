import { describe, it, expect } from "vitest";

import fixture from "./__fixtures__/equality-4.1.0.json";
import {
  computeBom,
  computeCalculator,
  PRICING_MODEL_VERSION,
  type BomLineInput,
  type BomResult,
  type PriceInput,
  type PriceResult,
} from "../src/index.ts";

/**
 * 019/PR-E · T080 — a varredura de igualdade 4.1.0 ↔ 4.2.0 (ADR-0034 §Decision 1, research §D).
 *
 * O que ela prova: a 4.2.0 é MINOR porque `computeCalculator` e `computeBom` continuam produzindo
 * **os mesmos centavos** para as mesmas entradas. A lição que o 014/C cobrou é que "versão bumpada
 * sem diferença medida" e "implementação reescrita sem bump" são a mesma mentira — então a prova
 * não é a leitura do diff, é a re-execução contra uma fixture gerada com o motor 4.1.0 INTOCADO
 * (`__fixtures__/generate-equality-4.1.0.mjs`, PRNG determinístico, SHA-256 no relatório da fatia).
 *
 * A comparação é campo a campo e ignora **apenas** `modelVersion`, em qualquer profundidade — é o
 * único campo que a fatia tem licença para mudar, e ele muda dentro de cada `PriceResult` das
 * linhas do BOM também.
 *
 * Os 200 casos `bom` carregam canais POR LINHA de propósito: `result.channels[]` (o rollup) é o
 * único lugar onde uma mudança de agregação vazaria sem aparecer em nenhum total.
 */

interface CalculatorCase {
  input: PriceInput;
  result: PriceResult;
}
interface BomCase {
  lines: BomLineInput[];
  result: BomResult;
}
const casos = fixture as unknown as {
  generatedAtVersion: string;
  calculator: CalculatorCase[];
  bom: BomCase[];
};

/** Remove `modelVersion` em qualquer profundidade — tudo o mais é comparado como está. */
function semVersao(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(semVersao);
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor as Record<string, unknown>)
        .filter(([chave]) => chave !== "modelVersion")
        .map(([chave, v]) => [chave, semVersao(v)]),
    );
  }
  return valor;
}

describe("igualdade 4.1.0 ↔ 4.2.0 (ADR-0034 — o bump não muda nenhum centavo)", () => {
  it("a fixture nasceu do motor 4.1.0", () => {
    expect(casos.generatedAtVersion).toBe("4.1.0");
    expect(casos.calculator).toHaveLength(500);
    expect(casos.bom).toHaveLength(200);
  });

  it("computeCalculator: 500 casos, campo a campo", () => {
    for (const [i, caso] of casos.calculator.entries()) {
      const agora = computeCalculator(caso.input);
      expect(semVersao(agora), `calculator[${String(i)}]`).toEqual(semVersao(caso.result));
      // O rótulo é o ÚNICO campo autorizado a mudar, e ele é o do motor de hoje.
      expect(agora.modelVersion).toBe(PRICING_MODEL_VERSION);
    }
  });

  it("computeBom: 200 casos, incluindo o rollup por marketplace", () => {
    let rollupsComparados = 0;
    for (const [i, caso] of casos.bom.entries()) {
      const agora = computeBom(caso.lines);
      expect(semVersao(agora), `bom[${String(i)}]`).toEqual(semVersao(caso.result));
      rollupsComparados += agora.channels.length;
    }
    // Não-vacuidade da varredura do rollup: se a fixture tivesse nascido sem canais por linha,
    // esta suíte passaria comparando listas vazias e não provaria nada sobre a agregação.
    expect(rollupsComparados).toBeGreaterThan(300);
  });
});
