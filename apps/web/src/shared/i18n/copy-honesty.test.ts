import { describe, expect, it } from "vitest";

import { messages } from "./messages.pt-br";

// US4 / SS-4 / FR-014 (Principle II — honest copy). The shell + system-state copy must name
// no payment provider, quote no price, and state no cancellation policy. This is a programmatic
// grep over the WHOLE message module (every string leaf, incl. the ErrorCode→pt-BR phrases), so
// the honesty guarantee holds as new keys are added — not just for the 003 keys.
function collectStrings(value: unknown, acc: string[] = []): string[] {
    if (typeof value === "string") acc.push(value);
    else if (value && typeof value === "object")
        for (const v of Object.values(value)) collectStrings(v, acc);
    return acc;
}

// E6/T014 dated exception (2026-07-21, ux-billing.md §0.2/§8, owner flags F1-F9): the `billing`
// namespace is precisely where a real payment provider, a real price, and honest cancellation
// copy ("cancele quando quiser" / "Cancelar assinatura") become the legitimate, owner-ratified
// truth — this is the epic where that flow starts existing. Every OTHER surface (E1-E5, the
// system shell) still carries none of that, which is what this invariant continues to guard.
const { billing: _omittedBillingCopy, ...NON_BILLING_MESSAGES } = messages;
void _omittedBillingCopy;

// 016/US6 dated exception (2026-08-06, conteudo-tooltips.md, FR-908/Constitution II): the price
// literal this guard forbids is OUR product's undecided commercial price (SS-4/FR-014's actual
// target — see the `billing` carve-out above). `fieldTips` and `tooltipRefs` quote THIRD-PARTY
// public figures instead — the national average electricity tariff (ANEEL), the legal minimum
// wage, and dono-approved worked examples ("R$ 3.000 ÷ 160 h") — sourced + dated in
// `specs/016-correcao-homologacao/conteudo-tooltips.md`, never a price this app is charging.
// Rendered as plain body text (not through the number-formatting pipeline) precisely because it
// is prose quoting an external fact, not a computed result.
// 016/PR-F dated exception (2026-08-06, US17/FR-924, T057): `shopeeWarnings.regressiveBody` quotes
// the Shopee official page VERBATIM — "um produto de R$10 tem uma taxa de R$6,50, enquanto um de
// R$8 terá taxa de R$6" (art. 26839) — precisely because the point of US17 is that this app
// computes NO price there; changing the digits to satisfy this guard would make the quote no
// longer match the source, which is worse than the literal it forbids. Same class as the
// `fieldTips` carve-out above: prose quoting a THIRD-PARTY fact, never a price this app charges.
// Homologação automatizada, exceção datada (2026-08-13): `plausibilidade` é a MESMA classe do
// `fieldTips` acima, e pelo mesmo motivo — é prosa didática que ensina uma CONVERSÃO usando o
// dinheiro DO VENDEDOR ("R$ 3.000 ÷ 160 h = R$ 18,75", o mesmo exemplo aprovado que já vive no
// `fieldTips.laborRate`), nunca um preço que este app cobra. O alvo real desta guarda continua
// sendo o preço comercial indeciso do produto, que segue coberto pelo carve-out de `billing`.
//
// A exceção é estreita de propósito: se algum dia uma frase de plausibilidade citar o preço da
// ASSINATURA, ela terá saído desta classe e a guarda deve voltar a cobri-la.
const {
    fieldTips: _omittedFieldTips,
    tooltipRefs: _omittedTooltipRefs,
    shopeeWarnings: _omittedShopeeWarnings,
    plausibilidade: _omittedPlausibilidade,
    ...NON_TOOLTIP_CALCULATOR
} = messages.calculator;
void _omittedFieldTips;
void _omittedTooltipRefs;
void _omittedShopeeWarnings;
void _omittedPlausibilidade;
const HAYSTACK = collectStrings({
    ...NON_BILLING_MESSAGES,
    calculator: NON_TOOLTIP_CALCULATOR,
})
    .join("\n")
    .toLowerCase();

describe("copy honesty (T051 / US4 — SS-4 / FR-014)", () => {
    it("names no payment provider", () => {
        for (const term of [
            "mercado pago",
            "mercadopago",
            "stripe",
            "paypal",
            "pagseguro",
            "boleto",
        ]) {
            expect(HAYSTACK, `provider name leaked: "${term}"`).not.toContain(term);
        }
    });

    it("states no cancellation policy", () => {
        for (const term of ["cancele", "cancelar", "cancelamento"]) {
            expect(HAYSTACK, `cancellation copy leaked: "${term}"`).not.toContain(term);
        }
    });

    it("quotes no price (no currency literal in the copy)", () => {
        // Prices are produced by number formatting at render time, never hard-coded in copy;
        // a "R$ " literal in a message would imply an undecided commercial price.
        expect(HAYSTACK, 'a "R$" price literal leaked into the copy').not.toContain("r$");
    });
});
