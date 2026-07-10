import {
  type CalcFormValues,
  type ChannelSlotForm,
  defaultCalcValues,
  type MarketplaceId,
  type Modality,
} from "@/features/calculator/calculator-schema";
import type { ChannelSlot, OtherCost, ProductIn, ProductOut } from "@/shared/api/generated";

// US6/T030 — the wire⇄form mapping for products, same discipline as catalog-prefill (SC-305):
// pure string separator swaps mirroring `parseDecimal`'s rules (dots = thousands, comma =
// decimal), NEVER a float round-trip, so a reopened product feeds `computeFromForm` the exact
// strings a manual entry would produce. Blank channel fees stay BLANK end-to-end (wire null ⇄
// form "") — a blank fee means "resolve from the live fee catalog"; persisting a 0 would
// dishonestly freeze today's fee (D4: channels[] = the same shapes the calculator form uses).

/** en-US wire decimal string → pt-BR form string ("1200.00" → "1200,00"). Pure swap, no floats. */
function wireToPtBr(value: string): string {
  return value.replace(".", ",");
}

/** pt-BR form string → canonical wire decimal string, mirroring `parseDecimal` string-wise:
 *  strip visual affixes, drop thousands dots, swap the decimal comma ("1.234,56" → "1234.56"). */
function ptBrToWire(value: string): string {
  return value
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
}

/** Everything the product page edits: the calculator form values + the product identity bits. */
export interface ProductFormBundle {
  name: string;
  /** Linked filament id, or "" when degraded/manual (US6-4). */
  filamentId: string;
  printerId: string;
  /** The material label rides along so a degraded save keeps it (it has no calculator field). */
  filamentMaterial: string | null;
  values: CalcFormValues;
}

/** The wire pieceInputs keys — identical names to the calculator fields (both mirror
 *  pricing-core's PriceInput), so the mapping is mechanical. */
const PIECE_KEYS = [
  "printGrams",
  "wasteGrams",
  "printTimeHours",
  "failurePct",
  "finishTimeHours",
  "finishRatePerHour",
  "laborHours",
  "laborRatePerHour",
  "markupVarejoPct",
  "markupAtacadoPct",
] as const;

type WireChannel = {
  marketplace?: unknown;
  modality?: unknown;
  commissionPct?: unknown;
  fixedFee?: unknown;
  minPerItem?: unknown;
  freightCost?: unknown;
};

function feeToForm(fee: unknown): string {
  return typeof fee === "string" ? wireToPtBr(fee) : "";
}

/** null when blank — the wire never carries a fabricated 0 for an unset fee. */
function feeToWire(fee: string): string | null {
  return fee.trim() === "" ? null : ptBrToWire(fee);
}

/** Reopen: wire → the pt-BR form bundle. Resolved values (live while linked, last-known when
 *  degraded — the server applies the D3 resolution rule) land in the ordinary editable fields. */
export function productToForm(product: ProductOut): ProductFormBundle {
  const values: CalcFormValues = {
    ...defaultCalcValues,
    costPerRoll: wireToPtBr(product.filamentValues.costPerRoll),
    rollWeightKg: wireToPtBr(product.filamentValues.rollWeightKg),
    machineValue: wireToPtBr(product.printerValues.machineValue),
    machineLifetimeHours: wireToPtBr(product.printerValues.machineLifetimeHours),
    avgPowerKw: wireToPtBr(product.printerValues.avgPowerKw),
    maintenanceReservePerHour: wireToPtBr(product.printerValues.maintenanceReservePerHour ?? "0"),
    printGrams: wireToPtBr(product.pieceInputs.printGrams),
    wasteGrams: wireToPtBr(product.pieceInputs.wasteGrams ?? "0"),
    printTimeHours: wireToPtBr(product.pieceInputs.printTimeHours),
    failurePct: wireToPtBr(product.pieceInputs.failurePct ?? "0"),
    finishTimeHours: wireToPtBr(product.pieceInputs.finishTimeHours ?? "0"),
    finishRatePerHour: wireToPtBr(product.pieceInputs.finishRatePerHour ?? "0"),
    laborHours: wireToPtBr(product.pieceInputs.laborHours ?? "0"),
    laborRatePerHour: wireToPtBr(product.pieceInputs.laborRatePerHour ?? "0"),
    markupVarejoPct: wireToPtBr(product.pieceInputs.markupVarejoPct),
    markupAtacadoPct: wireToPtBr(product.pieceInputs.markupAtacadoPct),
    tariffPerKwh: wireToPtBr(product.tariffPerKwh),
    includeMarketplace: product.includeMarketplace,
    channels: (product.channels as WireChannel[]).map((c): ChannelSlotForm => ({
      marketplace: c.marketplace as MarketplaceId,
      modality: (typeof c.modality === "string" ? c.modality : "") as Modality,
      commissionPct: feeToForm(c.commissionPct),
      fixedFee: feeToForm(c.fixedFee),
      minPerItem: feeToForm(c.minPerItem),
      freightCost: feeToForm(c.freightCost),
    })),
    otherCosts: (product.otherCosts as { name?: unknown; value?: unknown }[]).map((c) => ({
      name: typeof c.name === "string" ? c.name : "",
      value: typeof c.value === "string" ? wireToPtBr(c.value) : "",
    })),
  };
  return {
    name: product.name,
    filamentId: product.filamentId ?? "",
    printerId: product.printerId ?? "",
    filamentMaterial: product.filamentValues.material ?? null,
    values,
  };
}

/** Save: the pt-BR form bundle → the wire body. Linked refs send ONLY the id (the server
 *  re-snapshots from the live row — D3); a degraded ref sends the editable overrides (US6-4). */
export function formToProductIn(bundle: ProductFormBundle): ProductIn {
  const { values } = bundle;
  const pieceInputs = Object.fromEntries(
    PIECE_KEYS.map((key) => [key, ptBrToWire(values[key])]),
  ) as Record<(typeof PIECE_KEYS)[number], string>;

  const body: ProductIn = {
    name: bundle.name,
    filamentId: bundle.filamentId || null,
    printerId: bundle.printerId || null,
    pieceInputs,
    tariffPerKwh: ptBrToWire(values.tariffPerKwh),
    includeMarketplace: values.includeMarketplace,
    channels: values.channels.map((c): ChannelSlot => ({
      marketplace: c.marketplace,
      modality: c.modality,
      commissionPct: feeToWire(c.commissionPct),
      fixedFee: feeToWire(c.fixedFee),
      minPerItem: feeToWire(c.minPerItem),
      freightCost: feeToWire(c.freightCost),
    })),
    // A fully blank row is an untouched affordance, not user data — dropped. A named row with a
    // blank value persists the 0 the calculator computes for it (FR-116 semantics).
    otherCosts: values.otherCosts
      .filter((c) => c.name.trim() !== "" || c.value.trim() !== "")
      .map((c): OtherCost => ({ name: c.name, value: c.value.trim() ? ptBrToWire(c.value) : "0" })),
  };
  if (!body.filamentId) {
    body.filamentValues = {
      material: bundle.filamentMaterial,
      costPerRoll: ptBrToWire(values.costPerRoll),
      rollWeightKg: ptBrToWire(values.rollWeightKg),
    };
  }
  if (!body.printerId) {
    body.printerValues = {
      machineValue: ptBrToWire(values.machineValue),
      machineLifetimeHours: ptBrToWire(values.machineLifetimeHours),
      avgPowerKw: ptBrToWire(values.avgPowerKw),
      maintenanceReservePerHour: ptBrToWire(values.maintenanceReservePerHour),
    };
  }
  return body;
}
