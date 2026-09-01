import { messages } from "@/shared/i18n/messages.pt-br";

// ⚠ @doc DEC-086 — módulo SEM dependência nenhuma além das mensagens, para a UI e o e2e lerem
//   IGUAL. Recompor o texto no spec seria ter duas fontes — o que a FR-710 proíbe.
const t = messages.billing;

/**
 * `Premium: R$ 15,99/mes · no plano anual, equivalente a R$ 12,99/mes`.
 *
 * O anual entra pelo EQUIVALENTE mensal (155,88/12 ≈ 12,99), que e o numero que o vendedor usa para
 * comparar; o R$ 191,88 nunca aparece riscado, porque um "de/por" fabricaria um desconto que nunca
 * existiu.
 */
export function teaserPriceLine(): string {
    return `${t.teaserPriceLead} ${t.planMonthlyPrice} · ${t.teaserAnnualLead} ${t.planAnnualEquiv}`;
}
