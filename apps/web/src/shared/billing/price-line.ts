import { messages } from "@/shared/i18n/messages.pt-br";

// E6/US7 (T032/T037) — a linha de preco dos teasers, num modulo que NAO importa mais nada.
//
// Ela morava junto do componente e depois junto de `BILLING_PLANS`, e os dois lugares quebraram o
// e2e por motivos diferentes: o componente importa CSS (o carregador de TS do Playwright nao
// parseia), e `plans.ts` importa o cliente gerado, que valida env fora do navegador (ZodError na
// carga). A saida NAO foi recompor o texto no spec — recompor e ter duas fontes, que e exatamente o
// que a FR-710 proibe. E isto: um modulo sem dependencia nenhuma alem das mensagens, que a UI e o
// e2e importam IGUAL.
//
// Os numeros continuam vindo de UM lugar: `messages.billing`, que e de onde `BILLING_PLANS` tambem
// os le. E um teste de unidade afirma que esta linha CONTEM os valores de `BILLING_PLANS` — e esse
// teste e o que mantem as duas leituras amarradas, em vez de apenas parecerem iguais.
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
