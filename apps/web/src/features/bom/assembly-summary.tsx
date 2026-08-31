import type { BomResult } from "@3dprecify/pricing-core";

import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow, Card, PriceHero } from "@/shared/ui";

import { ChannelRollup, type UiSkippedChannel } from "./channel-rollup";

import "./assembly-summary.css";

// 008/T005 — the assembly summary (ux §1.1/§1.7): the headline the seller came for. Custo total
// as a breakdown row, the varejo/atacado pair as PriceHeroes (mirroring Calcular's results), then
// the per-channel rollup. Every number is read off `BomResult` — the view sums nothing (§0.2).

const t = messages.bom;

/**
 * 018/US3 — como o resumo se apresenta.
 * - `pinned` (padrão): a barra colada no rodapé. É o comportamento de hoje, e é o do MOBILE.
 * - `column`: o resumo mora numa coluna fixa à direita (desktop ≥1280px), e nada fica no rodapé.
 *
 * O padrão é `pinned` de propósito: quem montar este componente sem saber do 018 recebe o
 * comportamento antigo, não o novo.
 */
export type AssemblySummaryVariant = "pinned" | "column";

export function AssemblySummary({
    bom,
    uiSkipped,
    excludedLineCount = 0,
    variant = "pinned",
}: {
    bom: BomResult;
    uiSkipped?: UiSkippedChannel[];
    /** Composer lines that did NOT reach the total (invalid field or quantity). A truthful zero
     *  (every line quantity 0) is NOT excluded — those lines still contributed to `bom.lines`. */
    excludedLineCount?: number;
    variant?: AssemblySummaryVariant;
}) {
    // Na coluna, o "fixado" é a coluna inteira (CSS da página), não este bloco: manter
    // `.assembly-summary__pinned` aqui somaria um segundo sticky dentro de um sticky.
    const pinnedClass = variant === "pinned" ? "assembly-summary__pinned" : "assembly-summary__col";
    // No line contributed: the total is not "R$ 0,00", it does not exist yet. Show the honest
    // waiting state instead of three fake zeros (review 2026-07-12), pinned like the total it
    // stands in for. There is no channel rollup here (no line ⇒ no channels).
    if (bom.lines.length === 0) {
        return (
            <div className={pinnedClass} data-testid="kit-total-bar">
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
            <div className={pinnedClass} data-testid="kit-total-bar">
                <Card padding="md" className="flex flex-col gap-2">
                    <p className="text-sm font-semibold">{t.assemblyTitle}</p>
                    <BreakdownRow
                        label={t.assemblyCusto}
                        value={formatBRL(bom.custoTotal)}
                        emphasis="total"
                    />
                    {/* A5-b (a5-a6-decisoes.md, emenda 2026-08-07) — na barra FIXADA o par vira duas
              LINHAS DE LEITURA, nunca dois cartões: a 360px duas colunas deixam 89px por valor,
              e 89px não comportam "R$ 1.234,56" nem em texto corrido — não existe saída
              tipográfica. Uma coluna devolve ~216px ao número E encolhe a barra ~13px. O guard
              do a5-a6-geometry.spec.ts mede com valor de 5 dígitos (foi um valor curto que
              deixou este aperto dormir até aqui). */}
                    <div className="assembly-summary__pinned-prices">
                        {/* A5-d — rótulos curtos PRÓPRIOS do readout (t.pinned), nunca tc.results: o rótulo
                longo ("Preço atacado", 111px) tranca no orçamento de ~101px da linha e a
                reticência apareceria no caso NORMAL de 5 dígitos. */}
                        <PriceHero
                            label={t.pinned.varejo}
                            value={bom.precoVarejo}
                            prefix="R$"
                            size="md"
                        />
                        <PriceHero
                            label={t.pinned.atacado}
                            value={bom.precoAtacado}
                            prefix="R$"
                            size="md"
                        />
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
