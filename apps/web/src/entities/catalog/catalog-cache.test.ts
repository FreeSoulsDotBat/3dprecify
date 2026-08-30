import { describe, expect, it } from "vitest";

import type { ProductOut } from "@/shared/api/generated";

import { readSellerFixedPrice } from "./catalog-cache";

// 019/PR-D (T127, ADR-0033 §3) — `readSellerFixedPrice` colapsa as DUAS formas de "não fixado" no
// mesmo estado: `null` (o servidor, pós-migração 0008) e `undefined` (uma entrada do cache IDB
// persistida ANTES da 0008 existir — `catalog-cache.ts:61` grava o `ProductOut` inteiro, e um
// documento antigo simplesmente não tem a chave). Nenhum dos dois é `0,00`.

function product(over: Partial<ProductOut> = {}): ProductOut {
  return {
    id: "p1",
    name: "Suporte L",
    filamentId: null,
    printerId: null,
    filamentValues: { material: "PLA", costPerRoll: "100.00", rollWeightKg: "1.000" },
    printerValues: {
      machineValue: "4000.00",
      machineLifetimeHours: "2000",
      avgPowerKw: "0.100",
      maintenanceReservePerHour: "0",
    },
    pieceInputs: {
      printGrams: "100",
      printTimeHours: "5",
      failurePct: "0",
      finishTimeHours: "0",
      finishRatePerHour: "0",
      laborHours: "0",
      laborRatePerHour: "0",
      markupVarejoPct: "50",
      markupAtacadoPct: "30",
    },
    tariffPerKwh: "1.00",
    includeMarketplace: true,
    channels: [],
    otherCosts: [],
    sellerFixedPrice: null,
    sellerFixedAt: null,
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    ...over,
  } as ProductOut;
}

describe("readSellerFixedPrice — undefined (cache pré-0008) e null (servidor) são o MESMO 'não fixado'", () => {
  it("null (servidor, nunca fixado) ⇒ null", () => {
    expect(readSellerFixedPrice(product({ sellerFixedPrice: null }))).toBeNull();
  });

  it("undefined (item do cache gravado antes da 0008) ⇒ null, NUNCA 0", () => {
    const semCampo = product();
    delete (semCampo as Partial<ProductOut>).sellerFixedPrice;
    expect(readSellerFixedPrice(semCampo)).toBeNull();
  });

  it("fixado ⇒ o número", () => {
    expect(readSellerFixedPrice(product({ sellerFixedPrice: "42.00" }))).toBe(42);
  });
});
