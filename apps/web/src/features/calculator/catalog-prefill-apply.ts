import type { UseFormSetValue } from "react-hook-form";

import type { FilamentOut, PrinterOut } from "@/shared/api/generated";

import { filamentToCalcFields, printerToCalcFields } from "./catalog-prefill";
import type { CalcFormValues } from "./calculator-schema";

// 019/Polish — `calcular-page.tsx` and `produto-page.tsx` each looped over
// `filamentToCalcFields`/`printerToCalcFields` to call `setValue` field-by-field; the union of
// fields (typed once here) is the part that was byte-identical between the two sites. Each site's
// OWN wrapper (its own state setters, its own `shouldValidate` choice) stays local — only the
// `setValue` loop moved.

type SetValueOptions = Parameters<UseFormSetValue<CalcFormValues>>[2];

/** The calculator fields a saved filament feeds (spec US5): cost, roll weight. */
export function applyFilamentFields(
    setValue: UseFormSetValue<CalcFormValues>,
    filament: FilamentOut,
    options?: SetValueOptions,
): void {
    for (const [field, value] of Object.entries(filamentToCalcFields(filament))) {
        setValue(field as "costPerRoll" | "rollWeightKg", value, options);
    }
}

/** The calculator fields a saved printer feeds: machine value, lifetime, draw, maintenance. */
export function applyPrinterFields(
    setValue: UseFormSetValue<CalcFormValues>,
    printer: PrinterOut,
    options?: SetValueOptions,
): void {
    for (const [field, value] of Object.entries(printerToCalcFields(printer))) {
        setValue(
            field as
                | "machineValue"
                | "machineLifetimeHours"
                | "avgPowerKw"
                | "maintenanceReservePerHour",
            value,
            options,
        );
    }
}
