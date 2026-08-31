// `ChannelLevelRows` — one markup level's rows (anúncio/frete/líquido) for a priced channel,
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { messages } from "@/shared/i18n/messages.pt-br";
import { BreakdownRow } from "@/shared/ui";

import { warnCaption } from "../form-atoms/form-styles";

const t = messages.calculator;

/** One markup level's rows for a priced channel: anúncio, an optional freight deduction line, and
 *  líquido — flagged when negative when a typed freight exceeds the margin. hotfix-016-a2 (R4): a
 *  freight line exists ONLY when the seller typed `freightCost` (FR-111b — "declarado OU com
 *  valor"); the old "Shopee co-funded voucher" wording described the 005 model the sources refuted
 *  (art. 23431: the coupon subsidy is Shopee's cost, universal — never the seller's).
 *
 *  019/PR-F (T142, prancheta 10a/10c) — no caption "Varejo"/"Atacado" própria mais: o `<Segmented
 *  split>` de `PriceResults` já governa qual nível é este, e repeti-lo aqui seria a mesma
 *  informação duas vezes. O aviso de frete (`freightHint`) migra da legenda solta que existia
 *  ABAIXO do bloco para o `sublabel` da própria linha "Frete" (10c: `tf-brow--muted` com o
 *  sublabel embutido) — um único lugar em vez de dois. */
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
            <BreakdownRow label={t.results.precoAnuncio} value={anuncio} />
            {freight > 0 && (
                <BreakdownRow
                    label={t.channels.freightLine}
                    sublabel={t.channels.freightHint}
                    value={-freight}
                    emphasis="muted"
                />
            )}
            <BreakdownRow
                label={t.results.recebidoLiquido}
                value={liquido}
                emphasis={liquido < 0 ? "negative" : "default"}
            />
            {liquido < 0 && <p style={warnCaption}>{t.channels.negativeLiquido}</p>}
        </>
    );
}
