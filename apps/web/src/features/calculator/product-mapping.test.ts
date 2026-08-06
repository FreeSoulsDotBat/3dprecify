import { describe, expect, it } from "vitest";

import type { ProductOut } from "@/shared/api/generated";

import { productSummary } from "@/entities/catalog/product-summary";

import { formToProductIn, productToForm } from "./product-mapping";

// US6/T030 — the wire⇄form mapping for products. Same discipline as catalog-prefill (SC-305):
// pure decimal-separator swaps, never a float round-trip, so reopening a product feeds
// `computeFromForm` the exact strings a manual entry would produce. Blank channel fees stay
// BLANK (wire null) — a blank fee means "resolve from the live fee catalog", and persisting a
// 0 would dishonestly freeze it (D4: channels[] = the same shapes the calculator form uses).

const linked: ProductOut = {
  id: "prod-1",
  name: "Vaso G",
  filamentId: "f-1",
  printerId: "p-1",
  filamentValues: { material: "PLA", costPerRoll: "110.00", rollWeightKg: "1.000" },
  printerValues: {
    machineValue: "1200.00",
    machineLifetimeHours: "2000.000",
    avgPowerKw: "0.1200",
    maintenanceReservePerHour: "0.500000",
  },
  pieceInputs: {
    printGrams: "100.000",
    printTimeHours: "5.000",
    failurePct: "0.000",
    finishTimeHours: "0.000",
    finishRatePerHour: "0.000000",
    laborHours: "0.000",
    laborRatePerHour: "0.000000",
    markupVarejoPct: "50.000",
    markupAtacadoPct: "30.000",
  },
  tariffPerKwh: "1.000000",
  includeMarketplace: true,
  channels: [
    {
      marketplace: "MERCADO_LIVRE",
      modality: "CLASSICO",
      commissionPct: "12.5",
      fixedFee: "6.00",
      minPerItem: null,
      freightCost: null,
    },
  ],
  otherCosts: [{ name: "Embalagem", value: "3.50" }],
  createdAt: "2026-07-10T00:00:00Z",
  updatedAt: "2026-07-10T00:00:00Z",
};

describe("productToForm — wire → pt-BR form (reopen)", () => {
  it("maps piece inputs, refs and resolved values as pure separator swaps", () => {
    const bundle = productToForm(linked);

    expect(bundle.name).toBe("Vaso G");
    expect(bundle.filamentId).toBe("f-1");
    expect(bundle.printerId).toBe("p-1");
    expect(bundle.filamentMaterial).toBe("PLA");
    expect(bundle.values.costPerRoll).toBe("110,00");
    expect(bundle.values.rollWeightKg).toBe("1,000");
    expect(bundle.values.printGrams).toBe("100,000");
    expect(bundle.values.avgPowerKw).toBe("0,1200");
    expect(bundle.values.tariffPerKwh).toBe("1,000000");
    expect(bundle.values.markupVarejoPct).toBe("50,000");
    expect(bundle.values.includeMarketplace).toBe(true);
  });

  it("keeps blank channel fees BLANK (null → '') so the live fee catalog still resolves them", () => {
    const bundle = productToForm(linked);

    expect(bundle.values.channels).toEqual([
      {
        marketplace: "MERCADO_LIVRE",
        modality: "CLASSICO",
        commissionPct: "12,5",
        fixedFee: "6,00",
        minPerItem: "",
        freightCost: "",
      },
    ]);
    expect(bundle.values.otherCosts).toEqual([{ name: "Embalagem", value: "3,50" }]);
  });

  it("maps a DEGRADED link (null id) to the manual picker state with last-known values", () => {
    const degraded = { ...linked, filamentId: null };
    const bundle = productToForm(degraded);

    expect(bundle.filamentId).toBe("");
    expect(bundle.values.costPerRoll).toBe("110,00"); // last-known, editable (US6-4)
  });
});

describe("formToProductIn — pt-BR form → wire (save)", () => {
  it("linked: sends both ids, groups pieceInputs, swaps separators, omits value overrides", () => {
    const bundle = productToForm(linked);
    const wire = formToProductIn(bundle);

    expect(wire.name).toBe("Vaso G");
    expect(wire.filamentId).toBe("f-1");
    expect(wire.printerId).toBe("p-1");
    expect(wire.filamentValues).toBeUndefined();
    expect(wire.printerValues).toBeUndefined();
    expect(wire.pieceInputs.printGrams).toBe("100.000");
    expect(wire.pieceInputs.markupAtacadoPct).toBe("30.000");
    expect(wire.tariffPerKwh).toBe("1.000000");
  });

  it("degraded: null id + the editable overrides become filamentValues (US6-4)", () => {
    const bundle = productToForm({ ...linked, filamentId: null });
    const wire = formToProductIn(bundle);

    expect(wire.filamentId).toBeNull();
    expect(wire.filamentValues).toEqual({
      material: "PLA",
      costPerRoll: "110.00",
      rollWeightKg: "1.000",
    });
  });

  it("blank channel fees go out as null (never a frozen 0) and empty other-cost rows drop", () => {
    const bundle = productToForm(linked);
    bundle.values.otherCosts = [
      { name: "Embalagem", value: "3,50" },
      { name: "", value: "" }, // an untouched blank row is not user data
    ];
    const wire = formToProductIn(bundle);

    expect(wire.channels?.[0]).toEqual({
      marketplace: "MERCADO_LIVRE",
      modality: "CLASSICO",
      commissionPct: "12.5",
      fixedFee: "6.00",
      minPerItem: null,
      freightCost: null,
    });
    expect(wire.otherCosts).toEqual([{ name: "Embalagem", value: "3.50" }]);
  });
});

describe("productSummary — the row line (§1.1: refs, never a stored price)", () => {
  it("shows the resolved reference names", () => {
    expect(productSummary(linked, "PLA Azul", "Ender 3")).toBe("PLA Azul · Ender 3");
  });

  it("labels a degraded reference as manual", () => {
    expect(productSummary({ ...linked, filamentId: null }, undefined, "Ender 3")).toBe(
      "manual · Ender 3",
    );
  });
});

// 014/T067 (US8, FR-003a) — a assimetria decidida pelo dono na Clarification de 2026-07-28:
// **cenários sim, produtos de catálogo não**.
//
// A razão não é economia de campo, é o que cada objeto SIGNIFICA. Um produto de catálogo é uma peça
// que o vendedor imprime — ela não tem canal, não tem marketplace e não tem categoria de anúncio; a
// categoria pertence à decisão de ONDE anunciar, que é do cenário. Guardá-la no produto criaria uma
// verdade duplicada, e no dia em que as duas divergissem ninguém saberia qual manda.
//
// O teste existe porque a ausência é fácil de "consertar" por engano: alguém vê `category` no
// formulário, não a vê no produto, e a acrescenta achando que esqueceram.
describe("produto de catálogo NÃO ganha campo de categoria (T067/FR-003a)", () => {
  it("o mapeamento do formulário para o produto não carrega categoria", () => {
    const bundle = productToForm(linked);
    // Mesmo com a categoria preenchida no formulário — que é de onde ela viria —, o produto não a leva.
    bundle.values.channels = bundle.values.channels.map((c) => ({ ...c, category: "calcados" }));
    expect(JSON.stringify(formToProductIn(bundle))).not.toContain("calcados");
  });
});
