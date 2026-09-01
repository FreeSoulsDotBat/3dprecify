import {
    type FrozenChannel,
    frozenChannelHasFee,
    type FrozenSnapshotPayload,
} from "@/entities/history/frozen-payload";
import { formatFrozenBRL } from "@/entities/history/history-format";
import { messages } from "@/shared/i18n/messages.pt-br";

// 019/Polish — moved verbatim out of snapshot-detail-page.tsx.

const t = messages.historico;
const tr = messages.calculator.results;

/**
 * The per-channel prices the seller actually quoted — frozen strings, only formatted (M11). A `null`
 * price renders ABSENT, never `R$ 0,00` (FR-507). A kit rollup additionally states its honest line
 * counts (how many pieces contributed, how many had no such channel).
 */
export function ChannelsBlock({ payload }: { payload: FrozenSnapshotPayload }) {
    const channels = payload.channels ?? [];
    return (
        <div className="flex flex-col gap-2">
            <h2 className="tf-historico__section">{t.channels}</h2>
            {channels.map((channel, i) => {
                // 014/T120 — prohibition 2 above ("an absent line is not a zero") applied to the channel
                // block, which was the one place that did not honour it. A slot recorded with NO commission
                // priced at anúncio == base: four rows asserting a marketplace price that was never
                // computed, and that the calculator itself refuses to show. The channel stays — the seller
                // DID choose that marketplace — and says what actually happened instead.
                const semComissao = !frozenChannelHasFee(payload, i);
                return <FrozenChannelRow key={i} channel={channel} semComissao={semComissao} />;
            })}
        </div>
    );
}

/**
 * 014/R3 — o nome do marketplace como a Calcular o escreve. O congelado exibia o enum CRU
 * (`MERCADO_LIVRE`) enquanto a mesma sessão da Calcular mostrava "Mercado Livre · Clássico".
 *
 * O valor cru é FALLBACK, não alvo: um documento antigo pode trazer texto livre que este dicionário
 * não conhece, e traduzir só o que ele conhece mantém a regra desta tela — o que está gravado é
 * renderizado, nunca reescrito. `null` é o canal sem marketplace, que já tinha a sua própria cópia.
 */
function marketplaceLabel(raw: string | null): string {
    if (raw === null) return messages.calculator.channels.channelFallback;
    const known: Record<string, string> = messages.calculator.marketplaceNames;
    return known[raw] ?? raw;
}

function FrozenChannelRow({
    channel,
    semComissao,
}: {
    channel: FrozenChannel;
    semComissao: boolean;
}) {
    return (
        <div className="tf-historico__channel">
            <span className="tf-historico__channel-name">
                {marketplaceLabel(channel.marketplace)}
            </span>
            {!semComissao && (
                <>
                    {(
                        [
                            {
                                label: `${tr.precoAnuncio} · ${messages.calculator.captions.varejo}`,
                                value: channel.precoAnuncioVarejo,
                            },
                            {
                                label: `${tr.recebidoLiquido} · ${messages.calculator.captions.varejo}`,
                                value: channel.recebidoLiquidoVarejo,
                            },
                            {
                                label: `${tr.precoAnuncio} · ${messages.calculator.captions.atacado}`,
                                value: channel.precoAnuncioAtacado,
                            },
                            {
                                label: `${tr.recebidoLiquido} · ${messages.calculator.captions.atacado}`,
                                value: channel.recebidoLiquidoAtacado,
                            },
                        ] as const
                    ).map(
                        (piece, i) =>
                            piece.value != null && (
                                <span key={i} className="tf-historico__piece">
                                    <span>{piece.label}</span>
                                    <strong>{formatFrozenBRL(piece.value)}</strong>
                                </span>
                            ),
                    )}
                </>
            )}
            {/* Said in words, in the tense of the RECORD: there is nothing to inform now — what happened
          is that this channel carried no commission on the day it was quoted. */}
            {semComissao && <span className="tf-historico__meta">{t.channelNoFee}</span>}
            {/* An honestly recorded per-slot failure, echoed as recorded — never hidden. Outside the gate
          above: an error is not a price, and a slot can fail for reasons unrelated to its fee. */}
            {channel.error && <span className="tf-historico__meta">{channel.error}</span>}
            {/* Kit rollup: how many lines contributed to this channel, how many had none. Also outside —
          the counts describe the composition, not the money. */}
            {channel.contributingLines != null && (
                <span className="tf-historico__meta">
                    {t.channelContributing
                        .replace("{n}", String(channel.contributingLines))
                        .replace(
                            "{total}",
                            String((channel.contributingLines ?? 0) + (channel.skippedLines ?? 0)),
                        )}
                </span>
            )}
        </div>
    );
}
