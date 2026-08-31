import type { CalcOutcome } from "@/features/calculator/calculator-model";

import type { LineState } from "./bom-page";

// 019/Polish — moved verbatim out of `bom-page.tsx` (`uiSkippedCounts`), pure function, no behavior
// change. Kept as a sibling (not `features/bom/`) because it is typed against `LineState`, the
// composer's own page-local shape.
//
// T006b top nit (ux §1.7): a FORM-invalid channel slot is rejected by the per-slot validation
// BEFORE the engine, so it can never reach `skippedLines` — count those per marketplace (on
// lines that otherwise compute; a fully-invalid line already carries its own caption) and let
// the rollup surface them honestly. Counts are per LINE, aligned with the engine's rule
// (review, 2026-07-11): a line counts as skipped for a marketplace only when EVERY one of its
// slots there is invalid — a line that still summed is never "sem preço". Counts only — no
// money leaves pricing-core.
export function countSkippedByMarketplace(
    lines: LineState[],
    outcomes: CalcOutcome[],
    parseQuantity: (raw: string) => number | null,
): { marketplace: string | null; count: number }[] {
    const uiSkippedCounts = new Map<string | null, number>();
    lines.forEach((l, i) => {
        if (parseQuantity(l.quantityRaw) === null || !outcomes[i].ok) return;
        const lineFlags = new Map<string | null, { ok: boolean; bad: boolean }>();
        outcomes[i].channels.forEach((slot, j) => {
            const marketplace = l.values.channels[j]?.marketplace ?? null;
            const flags = lineFlags.get(marketplace) ?? { ok: false, bad: false };
            if (Object.keys(slot.errors).length > 0) flags.bad = true;
            else flags.ok = true;
            lineFlags.set(marketplace, flags);
        });
        lineFlags.forEach((flags, marketplace) => {
            if (flags.bad && !flags.ok) {
                uiSkippedCounts.set(marketplace, (uiSkippedCounts.get(marketplace) ?? 0) + 1);
            }
        });
    });
    return [...uiSkippedCounts].map(([marketplace, count]) => ({ marketplace, count }));
}
