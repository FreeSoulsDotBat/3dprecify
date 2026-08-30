import { describe, it, expect } from "vitest";

import pkg from "../package.json";
import { PRICING_MODEL_VERSION } from "../src/index";

// ADR-0008 Part 1 + ADR-0011 + ADR-0016: E3 adds computeBom + exports toMoney/sumMoney/Decimal —
// an additive public surface, so 3.0.0 → 3.1.0 (MINOR). The constant tracks the package.json major
// so a saved calc can record which formula produced it.
// 4.0.0 (ADR-0026 / 016 US10): `wasteGrams` sai da ENTRADA do motor — remoção de campo de entrada é
// quebra ⇒ MAJOR. O rótulo é congelado dentro de um snapshot imutável (ADR-0019) e precisa continuar
// respondendo QUAL fórmula produziu aquele número: 3.x somava o desperdício ao material, 4.x não.
// 4.1.0 (ADR-0027 / 016 PR-F): `fixedFeeRule` (taxa fixa como FUNÇÃO do preço) e `surcharges`
// (custo opcional declarado) são adições OPCIONAIS cuja ausência preserva o resultado bit a bit —
// superfície pública aditiva ⇒ MINOR. O rótulo continua respondendo QUAL fórmula produziu o número
// congelado: um 4.0.0 não sabia representar "metade do preço abaixo de R$ 8".
describe("PRICING_MODEL_VERSION (ADR-0008 / ADR-0011 / ADR-0016 / ADR-0026 / ADR-0027)", () => {
  it("is 4.1.0", () => {
    expect(PRICING_MODEL_VERSION).toBe("4.1.0");
  });

  it("tracks the package.json version (major AND minor)", () => {
    // O major sozinho não bastava: uma 4.1.0 no `package.json` com a constante parada em 4.0.0
    // passava — e é exatamente a MINOR aditiva desta fatia que ficaria invisível no congelado.
    expect(PRICING_MODEL_VERSION).toBe(pkg.version);
    expect(pkg.version.split(".")[0]).toBe("4");
  });
});
