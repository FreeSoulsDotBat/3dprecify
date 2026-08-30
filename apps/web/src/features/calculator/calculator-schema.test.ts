import { describe, expect, it } from "vitest";

import { messages } from "@/shared/i18n/messages.pt-br";

import {
  type CalcFieldName,
  calculatorSchema,
  defaultCalcValues,
  defaultChannelSlot,
  MARKETPLACE_OPTIONS,
  type MarketplaceId,
  slotResetOnMarketplaceChange,
} from "./calculator-schema";

// 013 US1 (FA-01/FA-02) — the calculator surface of the strict pt-BR grammar. A malformed or
// mixed-separator string must surface the EXISTING per-field pt-BR message; it must never be
// coerced into a plausible, finite, WRONG number (the 100× energy error the audit measured).

const v = messages.calculator.validation;

function parseField(field: CalcFieldName, raw: string) {
  const res = calculatorSchema.safeParse({ ...defaultCalcValues, [field]: raw });
  if (res.success) return { value: res.data[field], error: undefined };
  const issue = res.error.issues.find((i) => i.path[0] === field);
  return { value: undefined, error: issue?.message };
}

describe("calculator numField — the adversarial set errors, never silently coerces", () => {
  it.each(["1,234,56", "5x3", "10-5", "12,,5", "1.5000", "abc", "--"])(
    "rejects avgPowerKw %s with the pt-BR 'valid number' message",
    (raw) => {
      const { value, error } = parseField("avgPowerKw", raw);
      expect(error).toBe(v.invalid);
      expect(value).toBeUndefined();
    },
  );

  it("FA-01: '0.12' in kW is 0,12 — NOT 12 (the measured 100× energy error)", () => {
    expect(parseField("avgPowerKw", "0.12")).toEqual({ value: 0.12, error: undefined });
  });

  it("FA-02: '1,234,56' no longer parses to a plausible 1.234", () => {
    expect(parseField("costPerRoll", "1,234,56").error).toBe(v.invalid);
  });

  it("a negative value still gets the SPECIFIC negative message, not the generic invalid one", () => {
    expect(parseField("costPerRoll", "-5").error).toBe(v.negative);
  });

  it("the pt-BR forms the app has always accepted are untouched", () => {
    expect(parseField("costPerRoll", "1.234,56").value).toBeCloseTo(1234.56, 6);
    expect(parseField("avgPowerKw", "0,12").value).toBeCloseTo(0.12, 6);
  });
});

describe("calculator numField — visual affixes stay tolerated (anchored strip)", () => {
  it.each([
    ["R$ 1.500,00", 1500],
    ["1,50 kg", 1.5],
    ["  100  ", 100],
  ])("accepts %s → %s", (raw, expected) => {
    const { value, error } = parseField("costPerRoll", raw);
    expect(error).toBeUndefined();
    expect(value).toBeCloseTo(expected, 6);
  });
});

// 014/T097 — trocar o marketplace do slot MUST limpar a categoria junto com a modalidade.
//
// A categoria é PER MARKETPLACE (o id "relogios" da Amazon não quer dizer nada no ML), e os três
// handlers de troca — calcular, produto e a linha de kit — resetavam só a modalidade. O id antigo
// sobrevivia INVISÍVEL: o seletor renderiza o ramo de espinha vazia ANTES do ramo `value`, então não
// há chip nem botão "Limpar" para o vendedor desfazer o que ele não vê. E continuava sendo enviado
// como determinante.
//
// Um único lugar decide o que reseta, porque três cópias da mesma regra é como uma delas fica para
// trás — que é exatamente o que aconteceu com a categoria.
describe("slotResetOnMarketplaceChange — a categoria não atravessa marketplaces (T097)", () => {
  it("limpa a categoria e adota a primeira modalidade do novo marketplace", () => {
    expect(slotResetOnMarketplaceChange("MERCADO_LIVRE")).toEqual({
      modality: "CLASSICO",
      category: "",
      sellerType: "",
      highVolume: "",
      surcharges: [],
    });
  });

  it("marketplace sem eixo de modalidade também limpa a categoria", () => {
    expect(slotResetOnMarketplaceChange("SHOPEE")).toEqual({
      modality: "",
      category: "",
      sellerType: "",
      highVolume: "",
      surcharges: [],
    });
  });

  // 016/PR-F (US17, FR-926) — o perfil do vendedor (sellerProfile) e o volumoso (surcharges) sao
  // PER MARKETPLACE pela mesma razao da categoria: "CPF_ALTO_VOLUME" so quer dizer algo na Shopee.
  it("todo marketplace reseta sellerType/highVolume/surcharges — nenhum e excecao", () => {
    for (const { value } of MARKETPLACE_OPTIONS) {
      const next = slotResetOnMarketplaceChange(value as MarketplaceId);
      expect(next.sellerType).toBe("");
      expect(next.highVolume).toBe("");
      expect(next.surcharges).toEqual([]);
    }
  });

  it("todo marketplace reseta a categoria — nenhum é exceção", () => {
    for (const { value } of MARKETPLACE_OPTIONS) {
      expect(slotResetOnMarketplaceChange(value as MarketplaceId).category).toBe("");
    }
  });

  it("concorda com um slot recém-criado do mesmo marketplace", () => {
    for (const { value } of MARKETPLACE_OPTIONS) {
      const m = value as MarketplaceId;
      expect(slotResetOnMarketplaceChange(m).modality).toBe(defaultChannelSlot(m).modality);
    }
  });
});
