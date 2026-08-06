import type { FilamentOut, PrinterOut } from "@/shared/api/generated";
import { wireToPtBr } from "@/shared/lib/decimal-ptbr";

import type { CalcFormValues } from "./calculator-schema";

// US5 (FR-308/SC-305) — the wire→form mapping behind the calculator's catalog pickers. The wire
// carries en-US decimal STRINGS ("110.00", money precision preserved); the form holds pt-BR
// strings ("110,00"). The conversion is a pure decimal-separator swap — no float round-trip — so
// `parseDecimal` sees the exact number a manual entry would produce and the computed prices are
// byte-identical BY CONSTRUCTION (the engine is untouched). Pre-filled fields stay ordinary
// editable text: picking never locks anything.
//
// 013/FA-05: `wireToPtBr` was a private copy here, in `product-mapping` and in `scenario-bridge`;
// it now has ONE home in `shared/lib/decimal-ptbr` with its "at most one dot" premise under test.

/** The calculator fields a saved filament feeds (spec US5): cost, roll weight. */
export function filamentToCalcFields(
  filament: FilamentOut,
): Pick<CalcFormValues, "costPerRoll" | "rollWeightKg"> {
  return {
    costPerRoll: wireToPtBr(filament.costPerRoll),
    rollWeightKg: wireToPtBr(filament.rollWeightKg),
  };
}

/** The calculator fields a saved printer feeds: machine value, lifetime, draw, maintenance. */
export function printerToCalcFields(
  printer: PrinterOut,
): Pick<
  CalcFormValues,
  "machineValue" | "machineLifetimeHours" | "avgPowerKw" | "maintenanceReservePerHour"
> {
  return {
    machineValue: wireToPtBr(printer.machineValue),
    machineLifetimeHours: wireToPtBr(printer.machineLifetimeHours),
    avgPowerKw: wireToPtBr(printer.avgPowerKw),
    maintenanceReservePerHour: wireToPtBr(printer.maintenanceReservePerHour ?? "0"),
  };
}
