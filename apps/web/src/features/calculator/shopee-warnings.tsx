import { messages } from "@/shared/i18n/messages.pt-br";
import { Alert, InfoTip } from "@/shared/ui";

// 016/PR-F (US17, FR-924, T057) — the two Shopee warnings: where the fee is NOT published (the CPF
// regressive fee below R$ 12), and where a real cost is not modelled because it is incalculable in
// advance (the measured-freight retroactive recharge). Both are informational (`role="status"`),
// never blocking, never a fabricated number.
//
// The linear hypothesis (R$ 4 + 0,25 × preço) that fits the two published points is DELIBERATELY
// absent from this module and from the whole codebase (US17-AC2) — a guard elsewhere
// (`shopee-warnings.test.ts`) proves no code path computes it.

const t = messages.calculator.shopeeWarnings;

/**
 * US17-AC1 — Shopee CPF de alto volume com preço abaixo de R$ 12,00 (a banda `CPF_ALTO_VOLUME` só
 * começa ali — abaixo dela o nível fica "sem referência", I9). O aviso cita os DOIS pontos oficiais
 * verbatim do art. 26839 (T057) e o contexto em que valem, e NUNCA aplica uma fórmula.
 */
export function ShopeeRegressiveFeeWarning() {
    return (
        <Alert tone="info" title={t.regressiveTitle} data-testid="shopee-regressive-fee-warning">
            {t.regressiveBody}
        </Alert>
    );
}

/**
 * @doc DEC-041 — estático de propósito: não some quando o vendedor edita. Colapsa para UMA
 *   linha (título + ⓘ inline) porque os dois avisos ocupavam 48% da seção a 360px.
 */
export function ShopeeMeasuredFreightWarning() {
    return (
        <Alert
            tone="info"
            compact
            data-testid="shopee-measured-freight-warning"
            title={
                <>
                    {t.measuredFreightTitle}{" "}
                    <InfoTip label={t.measuredFreightTipLabel}>{t.measuredFreightBody}</InfoTip>
                </>
            }
        />
    );
}
