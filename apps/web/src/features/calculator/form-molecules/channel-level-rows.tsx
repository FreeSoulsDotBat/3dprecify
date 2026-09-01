// `ChannelLevelRows` — one markup level's rows (anúncio/frete/líquido) for a priced channel,
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow } from "@/shared/ui";

import { warnCaption } from "../form-atoms/form-styles";

const t = messages.calculator;

/**
 * As linhas de um nível: anúncio, dedução de frete OPCIONAL, líquido (marcado quando negativo).
 *
 * ⚠ @doc DEC-095 — a linha de frete existe SÓ quando o vendedor declarou (FR-111b), e cada
 *   informação aparece UMA vez: o nível vem do `Segmented`, o aviso vem no `sublabel`.
 */
export function ChannelLevelRows({
    anuncio,
    liquido,
    freight,
}: {
    anuncio: number;
    liquido: number;
    freight: number;
}) {
    return (
        <>
            <BreakdownRow label={t.results.listingPrice} value={anuncio} />
            {freight > 0 && (
                <BreakdownRow
                    label={t.channels.freightLine}
                    sublabel={t.channels.freightHint}
                    value={-freight}
                    emphasis="muted"
                />
            )}
            <BreakdownRow
                label={t.results.netReceived}
                value={liquido}
                emphasis={liquido < 0 ? "negative" : "default"}
            />
            {liquido < 0 && <p style={warnCaption}>{t.channels.negativeNet}</p>}
        </>
    );
}
