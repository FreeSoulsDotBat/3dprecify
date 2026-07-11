import type { BomResult } from "@3dprecify/pricing-core";

import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow, Card, PriceHero } from "@/shared/ui";

import { ChannelRollup, type UiSkippedChannel } from "./channel-rollup";

// 008/T005 — the assembly summary (ux §1.1/§1.7): the headline the seller came for. Custo total
// as a breakdown row, the varejo/atacado pair as PriceHeroes (mirroring Calcular's results), then
// the per-channel rollup. Every number is read off `BomResult` — the view sums nothing (§0.2).

const t = messages.bom;
const tc = messages.calculator;

export function AssemblySummary({
  bom,
  uiSkipped,
}: {
  bom: BomResult;
  uiSkipped?: UiSkippedChannel[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card padding="md" className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t.assemblyTitle}</p>
        <BreakdownRow label={t.assemblyCusto} value={formatBRL(bom.custoTotal)} emphasis="total" />
        <div className="grid grid-cols-2 gap-2">
          <PriceHero label={tc.results.varejo} value={bom.precoVarejo} prefix="R$" />
          <PriceHero label={tc.results.atacado} value={bom.precoAtacado} prefix="R$" />
        </div>
      </Card>
      <ChannelRollup channels={bom.channels} uiSkipped={uiSkipped} />
    </div>
  );
}
