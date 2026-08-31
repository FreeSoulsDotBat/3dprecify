import {
    CALC_FIELD_NAMES,
    type CalcFieldName,
    type CalcFormValues,
} from "@/features/calculator/calculator-schema";

/**
 * Defect A fix (coordinator, 2026-07-20, T030 e2e finding) — the "unsaved changes" signature,
 * EXACTLY the subset `applyScenarioConfig` patches: the 17 scalar `CalcFieldName`s (were MISSING
 * entirely — a scalar edit never flipped `dirty`) + `includeMarketplace` + `channels` (incl.
 * `feeOverrides`) + `otherCosts`. Computed FRESH on every call from the CURRENT values, never
 * memoized against a `values.channels`/`values.otherCosts` array reference — RHF's `watch()` does
 * not guarantee a new array reference on a nested array-ITEM edit (a `channels.0.commissionPct`
 * change can mutate in place), so a `useMemo([values.channels])` silently never recomputed (the
 * confirmed e2e repro: an override edit moved the price 34,33→61,80 on screen while `dirty` stayed
 * false). `JSON.stringify` over ~20 short fields is cheap enough to run on every render.
 */
export function computeFormSignature(values: CalcFormValues): string {
    const scalars: Partial<Record<CalcFieldName, string>> = {};
    for (const name of CALC_FIELD_NAMES) scalars[name] = values[name];
    return JSON.stringify({
        scalars,
        includeMarketplace: values.includeMarketplace,
        channels: values.channels,
        otherCosts: values.otherCosts,
    });
}
