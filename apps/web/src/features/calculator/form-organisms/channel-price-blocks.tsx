// `ChannelPriceBlocks` — "Preços por marketplace" cards, extracted verbatim from
// calculator-form.tsx (019-polish readability split, no behavior change).
import type { ChannelSlotOutcome } from "@/features/calculator/calculator-model";
import type { CalcFormValues } from "@/features/calculator/calculator-schema";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Card } from "@/shared/ui";

import { captionText, channelCardTitle, channelModality } from "../form-atoms/form-styles";
import { UnpricedLevel } from "../form-atoms/unpriced-level";
import { ChannelLevelRows } from "../form-molecules/channel-level-rows";
import type { PriceLevel } from "../form-logic/price-level";

const t = messages.calculator;

/** "Preços por marketplace" cards: every slot's anúncio + líquido, one `level` at a time (the
 *  `<Segmented split>` in `PriceResults` governs it — SAME `level` as the hero + the summary
 *  line). A slot with an inline error shows a note, not stale prices.
 *
 *  019/PR-F (T142, prancheta 10a/10d) — was folded into the SAME "Como chegamos no preço" Card
 *  (016/US5, FR-907); now it is its OWN section (10a: "vira seção própria"), and each channel is
 *  its OWN `<Card>` (10d: a two-column grid at ≥1024px via `.tf-marketplace-cards`, one column
 *  below that) instead of a `channelDivider`-separated list inside one big card. Returns `null`
 *  with no active channel — the caller only renders the wrapping section when this has content. */
export function ChannelPriceBlocks({
    values,
    channelOutcomes,
    level,
}: {
    values: CalcFormValues;
    channelOutcomes: ChannelSlotOutcome[];
    level: PriceLevel;
}) {
    if (channelOutcomes.length === 0) return null;
    return (
        <>
            {channelOutcomes.map((oc, i) => {
                const slot = values.channels[i];
                const name = t.marketplaceNames[slot.marketplace] ?? t.channels.channelFallback;
                const modName = slot.modality ? t.modalityNames[slot.modality] : "";
                const r = oc.result;
                // Three states: a valid priced channel shows its rows; a valid slot with no fee yet shows
                // a hint (base==anúncio rows would just echo the headline); a bad slot shows its note.
                const priced = r && r.error === null && oc.hasFee;
                // SC-817 — a level whose announce falls outside every published band is NOT priced.
                // `?? 0` would have printed R$ 0,00 under a "Referência" seal; the absence of a published
                // fee is said in words, and only for the LEVEL SELECTED (varejo and atacado can land on
                // different sides of a gap, but only one shows at a time now). `r` non-null is what
                // `priced` already proved — `fields` re-narrows it once, so `anuncio`/`liquido` type as
                // `number | null` (never `undefined`, matching `ChannelResult`'s own shape).
                const fields = r
                    ? level === "varejo"
                        ? {
                              anuncio: r.precoAnuncioVarejo,
                              liquido: r.recebidoLiquidoVarejo,
                              freight: r.freightCostVarejo,
                          }
                        : {
                              anuncio: r.precoAnuncioAtacado,
                              liquido: r.recebidoLiquidoAtacado,
                              freight: r.freightCostAtacado,
                          }
                    : null;
                return (
                    <Card
                        key={i}
                        padding="md"
                        className="flex flex-col gap-2"
                        data-testid="channel-price"
                    >
                        <p style={channelCardTitle}>
                            {name}
                            {modName && <span style={channelModality}> · {modName}</span>}
                        </p>
                        <div className="flex flex-col">
                            {priced && fields ? (
                                fields.anuncio === null || fields.liquido === null ? (
                                    <UnpricedLevel />
                                ) : (
                                    <ChannelLevelRows
                                        anuncio={fields.anuncio}
                                        liquido={fields.liquido}
                                        freight={fields.freight}
                                    />
                                )
                            ) : (
                                <p style={captionText}>
                                    {oc.result ? t.channels.noFeeHint : t.channels.errorRow}
                                </p>
                            )}
                        </div>
                    </Card>
                );
            })}
        </>
    );
}
