import { type ScenarioConfig } from "@/entities/scenario/config-document";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, Card } from "@/shared/ui";

import { type CatalogContext, formatBRL } from "./calculator-model";
import { computeScenarioKitChannels } from "./scenario-bridge";

// 010/T024 (E5, PR-B US3, Q12) — the KIT-basis reopen has no scalar form to hydrate (a kit is
// multi-piece); this is its OWN read-only surface instead: the scenario's ONE shared channel set,
// applied uniformly to every kit line (`computeScenarioKitChannels`), rendered as the per-
// marketplace rollup. Read-only by construction — editing a kit-basis scenario's LINES happens on
// the kit itself (`Abrir origem`), never here (ux §4.4).
//
// Lives HERE (`features/calculator`), NOT `features/scenarios`, for the SAME FSD-Lite reason
// `scenario-bridge.ts`'s header explains: a feature may import `entities/*`/`shared/*`, never a
// sibling feature — this composite needs `calculator-model`/`scenario-bridge`, so it sits with them;
// the Calcular page (which may import both features) is the one that wires it in.

const t = messages.scenarios;
const tc = messages.calculator;

export function KitBasisSummary({
  config,
  refName,
  ctx,
}: {
  config: ScenarioConfig;
  refName: string;
  ctx?: CatalogContext;
}) {
  if (config.costBasis.kind !== "KIT") return null;
  const rollup = computeScenarioKitChannels(config, ctx);
  if (!rollup) return null;

  return (
    <Card padding="sm" className="flex flex-col gap-2" data-testid="kit-basis-summary">
      <p className="text-sm font-semibold text-[var(--text-strong)]">
        {t.kitBasisTitle.replace("{nome}", refName)}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{t.kitBasisHint}</p>

      {rollup.excludedLineCount > 0 && (
        <Alert tone="info">
          {tc.channels.errorRow} ({rollup.excludedLineCount})
        </Alert>
      )}

      {rollup.bom ? (
        <div className="flex flex-col gap-3">
          {rollup.bom.channels.map((c, i) => (
            <div key={`${c.marketplace}-${i}`} className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {c.marketplace
                  ? ((tc.marketplaceNames as Record<string, string>)[c.marketplace] ??
                    c.marketplace)
                  : "—"}
              </p>
              {c.precoAnuncioVarejo !== null && (
                <p className="text-xs text-[var(--text-muted)]">
                  {tc.captions.varejo}: {formatBRL(c.precoAnuncioVarejo)}
                </p>
              )}
              {c.precoAnuncioAtacado !== null && (
                <p className="text-xs text-[var(--text-muted)]">
                  {tc.captions.atacado}: {formatBRL(c.precoAnuncioAtacado)}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Alert tone="info">{tc.invalidNote}</Alert>
      )}
    </Card>
  );
}
