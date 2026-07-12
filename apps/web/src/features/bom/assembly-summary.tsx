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
  excludedLineCount = 0,
}: {
  bom: BomResult;
  uiSkipped?: UiSkippedChannel[];
  /** Composer lines that did NOT reach the total (invalid field or quantity). A truthful zero
   *  (every line quantity 0) is NOT excluded — those lines still contributed to `bom.lines`. */
  excludedLineCount?: number;
}) {
  // No line contributed: the total is not "R$ 0,00", it does not exist yet. Show the honest
  // waiting state instead of three fake zeros (review 2026-07-12), pinned like the total it
  // stands in for. There is no channel rollup here (no line ⇒ no channels).
  if (bom.lines.length === 0) {
    return (
      <div className="sticky bottom-2 z-10">
        <Card padding="md" className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{t.assemblyTitle}</p>
          <p className="text-sm text-[var(--text-muted)]">{t.assemblyNoPriceTitle}</p>
          <p className="text-xs text-[var(--text-muted)]">{t.assemblyNoPriceBody}</p>
        </Card>
      </div>
    );
  }

  // Layout (ux §1.7/G4, refined after the 2026-07-12 homologation): only the COMPACT total is the
  // sticky bottom bar — the per-channel rollup scrolls in normal flow above it. Pinning both took
  // ~2/3 of the viewport and crowded out the piece list.
  return (
    <>
      <ChannelRollup channels={bom.channels} uiSkipped={uiSkipped} />
      <div className="sticky bottom-2 z-10">
        <Card padding="md" className="flex flex-col gap-2">
          <p className="text-sm font-semibold">{t.assemblyTitle}</p>
          <BreakdownRow
            label={t.assemblyCusto}
            value={formatBRL(bom.custoTotal)}
            emphasis="total"
          />
          <div className="grid grid-cols-2 gap-2">
            <PriceHero label={tc.results.varejo} value={bom.precoVarejo} prefix="R$" />
            <PriceHero label={tc.results.atacado} value={bom.precoAtacado} prefix="R$" />
          </div>
          {excludedLineCount > 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              {t.assemblyExcluded.replace("{n}", String(excludedLineCount))}
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
