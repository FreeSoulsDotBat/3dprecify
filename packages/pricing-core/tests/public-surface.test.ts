// Onda 5 do chore de legibilidade (2026-08-31) — guarda de SUPERFÍCIE PÚBLICA, escrita ANTES da
// divisão do index.ts em módulos. A divisão é válida só enquanto a API exportada for EXATAMENTE
// esta lista (precedente: tests/retired-fields.test.ts, tests/boots-under-node.test.ts). Um símbolo
// a mais ou a menos aqui é decisão de versão (MINOR/MAJOR), nunca efeito colateral de refatoração.
import { describe, expect, it } from "vitest";

import * as api from "../src/index.ts";

describe("superfície pública do pacote", () => {
    it("exporta exatamente os símbolos de runtime conhecidos", () => {
        expect(Object.keys(api).sort()).toEqual(
            [
                "Decimal",
                "PRICING_MODEL_VERSION",
                "RETIRED_INPUT_FIELDS",
                "ValidationError",
                "bandContaining",
                "bandFixedFee",
                "computeBom",
                "computeCalculator",
                "computeQuote",
                "grossUp",
                "isPreRemovalModel",
                "stripRetiredFields",
                "sumMoney",
                "toMoney",
            ].sort(),
        );
    });

    it("o rótulo do modelo continua sendo o que os snapshots carimbam", () => {
        expect(api.PRICING_MODEL_VERSION).toBe("4.2.0");
    });
});
