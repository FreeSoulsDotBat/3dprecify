import { CheckoutInPeriod } from "@/shared/api/generated";
import { messages } from "@/shared/i18n/messages.pt-br";

// MOVIDO de `features/billing` para `shared/` na US7 (T032), pelo caminho que o ux-billing §9-G2 ja
// previa: os quatro teasers sao FEATURES irmas, e `feature -> feature` e proibido por desenho
// (eslint-boundaries). Elevar foi a saida escrita no proprio spec — e e a mais correta: uma
// constante de PRODUTO e transversal, como `messages`, nao propriedade de uma feature.
//
// E6/T014-T015 (US1 — ux-billing.md §0.2/§8). THE ONE product constant: every billing surface
// (the offer, the shared Assinar CTA, and — in a later wave — the four teasers) reads prices
// from here, never a locally-typed number. A mismatch between two rendered prices would be a
// release blocker (FR-701/SC-707, contracts §Wire invariants); having exactly one source is what
// makes that impossible rather than merely tested-for.
//
// The annual "equivalente a R$ 12,99/mês" and "~19% de economia" are DERIVED honest facts
// (155,88 / 12 ≈ 12,99; 12×15,99 = 191,88 → (191,88-155,88)/191,88 ≈ 18,8%) — never a fabricated
// number, and R$ 191,88 itself never renders as a struck-through "de" price (§0.2, the de/por
// prohibition). No `caution`/urgency copy anywhere here.
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
