// `UnpricedLevel` — the "no published band" note for a markup level the engine refused to price,
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import { messages } from "@/shared/i18n/messages.pt-br";

import { warnCaption } from "./form-styles";

const t = messages.calculator;

/** One markup level the engine REFUSED to price (SC-817 / FR-014a): the announce it would need
 *  falls in a window the marketplace publishes no fee for, so there is no rate to charge and no
 *  líquido to promise. Saying that costs one line; printing R$ 0,00 would cost the seller a sale.
 *  019/PR-F — no caption própria pela mesma razão de `ChannelLevelRows` acima. */
export function UnpricedLevel() {
    return (
        <p style={warnCaption} data-testid="unpriced-level">
            {t.channels.unpricedBand}
        </p>
    );
}
