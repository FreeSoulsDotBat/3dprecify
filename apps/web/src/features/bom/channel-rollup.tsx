import type { BomChannelRollup } from "@3dprecify/pricing-core";

import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow, Card } from "@/shared/ui";

// 008/T005 — the assembly per-channel rollup (ux §1.7, Option A): one block per marketplace,
// the exact "Preços por canal" vocabulary one level up. Every number is read straight off
// `BomChannelRollup` (Σ over contributing lines × qty — computed in pricing-core, never here).
// Honesty rules: `skippedLines > 0` gets a calm caption (never a silent drop);
// `contributingLines === 0` reads as honest absence, never a fabricated R$ 0.

const t = messages.bom;
const tc = messages.calculator;

function marketplaceLabel(marketplace: string | null): string {
  if (marketplace === null) return tc.channels.channelFallback;
  const names = tc.marketplaceNames as Record<string, string>;
  return names[marketplace] ?? marketplace;
}

function plural(template: string, n: number): string {
  return template.replace("{n}", String(n));
}

function RollupBlock({ rollup }: { rollup: BomChannelRollup }) {
  const empty = rollup.contributingLines === 0;
  return (
    <div className="flex flex-col gap-1 border-t border-[var(--border-soft,transparent)] pt-2">
      <p className="text-sm font-medium">{marketplaceLabel(rollup.marketplace)}</p>
      {empty ? (
        <p className="text-sm text-[var(--text-muted)]">{t.channelNoContrib}</p>
      ) : (
        <>
          <BreakdownRow
            label={`${tc.captions.varejo} · ${tc.results.precoAnuncio}`}
            value={formatBRL(rollup.precoAnuncioVarejo ?? 0)}
          />
          <BreakdownRow
            label={`${tc.captions.varejo} · ${tc.results.recebidoLiquido}`}
            value={formatBRL(rollup.recebidoLiquidoVarejo ?? 0)}
          />
          <BreakdownRow
            label={`${tc.captions.atacado} · ${tc.results.precoAnuncio}`}
            value={formatBRL(rollup.precoAnuncioAtacado ?? 0)}
          />
          <BreakdownRow
            label={`${tc.captions.atacado} · ${tc.results.recebidoLiquido}`}
            value={formatBRL(rollup.recebidoLiquidoAtacado ?? 0)}
          />
          <p className="text-xs text-[var(--text-muted)]">
            {plural(t.channelContributing, rollup.contributingLines)}
          </p>
        </>
      )}
      {rollup.skippedLines > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          {plural(t.channelSkipped, rollup.skippedLines)}
        </p>
      )}
    </div>
  );
}

/** The whole rollup card; omitted entirely when no line carries a channel (like the calculator
 *  with marketplaces off — ux §1.7). */
export function ChannelRollup({ channels }: { channels: BomChannelRollup[] }) {
  if (channels.length === 0) return null;
  return (
    <Card padding="md" className="flex flex-col gap-2">
      <p className="text-sm font-semibold">{t.channelsTitle}</p>
      {channels.map((rollup, i) => (
        <RollupBlock key={`${rollup.marketplace ?? "manual"}-${i}`} rollup={rollup} />
      ))}
    </Card>
  );
}
