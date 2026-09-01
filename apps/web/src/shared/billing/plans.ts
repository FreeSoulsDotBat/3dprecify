import { CheckoutInPeriod } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

// ⚠ @doc DEC-042 — a ÚNICA fonte de preço: dois preços renderizados divergentes seriam
//   bloqueador de release, e uma fonte só torna isso impossível em vez de testado.
const t = messages.billing;

export const BILLING_PLANS = {
    monthly: {
        period: CheckoutInPeriod.monthly,
        name: t.planMonthlyName,
        price: t.planMonthlyPrice,
        note: t.planMonthlyNote,
    },
    annual: {
        period: CheckoutInPeriod.annual,
        name: t.planAnnualName,
        price: t.planAnnualPrice,
        equivalent: t.planAnnualEquiv,
        saving: t.planAnnualSaving,
        badge: t.planAnnualBadge,
    },
} as const;

export type BillingPlanKey = keyof typeof BILLING_PLANS;

/**
 * A linha de preço — montada a partir de `BILLING_PLANS`, NUNCA de números redigitados.
 *
 * FR-710/SC-707: uma só fonte. Dois preços diferentes renderizados no mesmo app é bloqueador de
 * release, e ter uma fonte única é o que torna isso impossível em vez de meramente testado. O anual
 * entra pelo EQUIVALENTE mensal (um fato derivado honesto: 155,88 / 12 ≈ 12,99), que é o número que
 * o vendedor usa para comparar — e o R$ 191,88 nunca aparece riscado, porque um "de/por" fabricaria
 * um desconto que nunca existiu.
 */
