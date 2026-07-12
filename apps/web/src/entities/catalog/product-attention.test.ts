import { describe, expect, it } from "vitest";

import type { ProductOut } from "@/shared/api/generated";

import { productNeedsAttention } from "./product-summary";

// 008/T015d (K3) — the attention state, written FAILING-first. It is DERIVED from the missing
// references, never a stored column (ADR-0017 §4): a product born manual (materialized from a kit
// save) and a product degraded by a deletion are the SAME honest state, because the remedy is the
// same — link a saved filament and printer. Linking both clears it (SC-412).

function product(over: Partial<ProductOut> = {}): ProductOut {
  return {
    id: "p1",
    name: "Suporte L",
    filamentId: "f1",
    printerId: "pr1",
    filamentValues: { material: "PLA", costPerRoll: "100.00", rollWeightKg: "1.000" },
    printerValues: {
      machineValue: "4000.00",
      machineLifetimeHours: "2000",
      avgPowerKw: "0.100",
      maintenanceReservePerHour: "0",
    },
    pieceInputs: {
      printGrams: "100",
      wasteGrams: "0",
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
    createdAt: "2026-07-11T00:00:00Z",
    updatedAt: "2026-07-11T00:00:00Z",
    ...over,
  } as ProductOut;
}

describe("productNeedsAttention — one honest state, derived (K3)", () => {
  it("a fully linked product needs nothing", () => {
    expect(productNeedsAttention(product())).toBe(false);
  });

  it("a product materialized from a kit save (both refs null) needs attention", () => {
    expect(productNeedsAttention(product({ filamentId: null, printerId: null }))).toBe(true);
  });

  it("a product degraded by a deletion needs attention — the SAME state, either ref missing", () => {
    expect(productNeedsAttention(product({ filamentId: null }))).toBe(true);
    expect(productNeedsAttention(product({ printerId: null }))).toBe(true);
  });

  it("linking BOTH a saved filament and printer clears it (SC-412)", () => {
    const manual = product({ filamentId: null, printerId: null });
    expect(productNeedsAttention(manual)).toBe(true);
    // Only half-linked is still not resolved — the remedy is both.
    expect(productNeedsAttention({ ...manual, filamentId: "f1" })).toBe(true);
    expect(productNeedsAttention({ ...manual, filamentId: "f1", printerId: "pr1" })).toBe(false);
  });
});
