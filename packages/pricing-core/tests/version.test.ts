import { describe, it, expect } from "vitest";

import pkg from "../package.json";
import { PRICING_MODEL_VERSION } from "../src/index";

// ADR-0008 Part 1 + ADR-0011 + ADR-0016: E3 adds computeBom + exports toMoney/sumMoney/Decimal —
// an additive public surface, so 3.0.0 → 3.1.0 (MINOR). The constant tracks the package.json major
// so a saved calc can record which formula produced it.
// 4.0.0 (ADR-0026 / 016 US10): `wasteGrams` sai da ENTRADA do motor — remoção de campo de entrada é
// quebra ⇒ MAJOR. O rótulo é congelado dentro de um snapshot imutável (ADR-0019) e precisa continuar
// respondendo QUAL fórmula produziu aquele número: 3.x somava o desperdício ao material, 4.x não.
describe("PRICING_MODEL_VERSION (ADR-0008 / ADR-0011 / ADR-0016 / ADR-0026)", () => {
  it("is 4.0.0", () => {
    expect(PRICING_MODEL_VERSION).toBe("4.0.0");
  });

  it("tracks the package.json major", () => {
    expect(PRICING_MODEL_VERSION.split(".")[0]).toBe(pkg.version.split(".")[0]);
    expect(pkg.version.split(".")[0]).toBe("4");
  });
});
