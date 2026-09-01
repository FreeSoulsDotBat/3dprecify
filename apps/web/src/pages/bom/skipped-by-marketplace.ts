import type { CalcOutcome } from "@/features/calculator/calculator-model";

import type { LineState } from "./bom-page";

// ⚠ @doc DEC-084 — contagem por LINHA: uma linha só é "sem preço" num marketplace quando TODOS
//   os slots dela ali são inválidos. Contagens apenas — nenhum dinheiro sai do `pricing-core`.
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
