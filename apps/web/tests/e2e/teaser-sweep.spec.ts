import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// 018/T054 — SC-006: for a signed-out (free) account, each premium screen shows EXACTLY ONE
// Premium invite — never zero, never two (the 016/US1 single-teaser invariant, which E6 once
// broke with a duplicated CTA under a dialog and 016 re-fixed).
//
// "Invite" is counted by the CTA — the TeaserUpgrade LINK "Assinar Premium" every teaser and the
// marketplace gate render (shared/billing/teaser-upgrade.tsx) — not by the teaser title: a second
// CTA sneaking in OUTSIDE the card (the E6 regression class) keeps the title count at 1 while the
// screen shows two invitations. Counting the CTA catches both failure modes.
//
// Swept at BOTH widths the spec names (1920px desktop, 390px mobile) because 018 introduced a
// second composition per screen — a teaser correct on mobile can be duplicated by the desktop
// branch, and vice versa. That is precisely how the width-dependent defects of this project
// escaped before (016/PR-B).
//
// 019/PR-B (T041) — a parede saiu (FR-1906): a ÂNCORA "a tela renderizou o estado grátis" deixa de
// ser o título do teaser e passa a ser o título do VAZIO DIDÁTICO; e o invariante é contado em DOIS
// estados por tela — a lista (o convite mora no vazio) e o formulário inerte ABERTO (o convite mora
// no rodapé do formulário, e o do vazio some). Um convite em cada estado; nunca dois ao mesmo tempo.
const CTA = messages.billing.subscribeAction;

const SCREENS: { route: string; title: string; abrir?: string }[] = [
    {
        route: "/catalogo",
        title: messages.catalog.emptyFilamentsTitle,
        abrir: messages.catalog.addFilament,
    },
    { route: "/kits", title: messages.catalog.emptyKitsTitle },
    { route: "/historico", title: messages.history.educationalTitle },
];

const VIEWPORTS = [
    { name: "1920px", width: 1920, height: 1080 },
    { name: "390px", width: 390, height: 844 },
] as const;

for (const vp of VIEWPORTS) {
    for (const s of SCREENS) {
        test(`SC-006: ${s.route} at ${vp.name} shows exactly one Premium invite (signed out)`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: vp.width, height: vp.height });
            await page.goto(s.route);
            // Anchor on the didactic-empty title first — proves the screen finished rendering its free state.
            await expect(page.getByText(s.title).first()).toBeVisible();
            await expect(page.getByRole("link", { name: CTA })).toHaveCount(1);

            // Second state: the inert form OPEN. The empty state's invite must yield to the form footer's.
            if (s.abrir) {
                await page.getByRole("button", { name: s.abrir }).first().click();
                await expect(page.getByTestId("catalog-form-frozen")).toBeVisible();
                await expect(page.getByRole("link", { name: CTA })).toHaveCount(1);
            }
        });
    }

    test(`SC-006: a folha de Simulações at ${vp.name} shows exactly one Premium invite (signed out)`, async ({
        page,
    }) => {
        // A QUARTA tela do invariante 016/US1 é a folha "Minhas simulações" — não a /calcular inteira:
        // a página da calculadora tem DUAS superfícies premium por desenho (o teaser do picker e o gate
        // do marketplace), cada uma com o próprio convite. Dentro da FOLHA, o convite é um só.
        //
        // 019/PR-F (T099, adoção) — ≥1280px a "folha" deixou de ser um `dialog`: a coluna larga
        // (`scenarios-wide-aside`, T095) fica sempre visível ao lado da calculadora, e o clique em
        // "Minhas simulações" só rola/foca essa coluna (nunca abre um diálogo). A revisão do main loop
        // fez o vazio da coluna montar com `teaser={false}` de propósito — a página JÁ carrega os
        // seus DOIS convites por desenho (picker + gate do marketplace); um terceiro ali seria o
        // duplo-convite que a PR-B matou no Catálogo. Então ≥1280: zero convites DENTRO da coluna, e a
        // PÁGINA INTEIRA mantém exatamente os 2 de sempre. < 1280 (a gaveta): segue como estava — um
        // dialog com o convite único (FR-1906).
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto("/calcular");
        await page.getByRole("button", { name: messages.scenarios.navEntry }).click();

        if (vp.width >= 1280) {
            const aside = page.getByTestId("scenarios-wide-aside");
            await expect(aside).toBeVisible();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(aside.getByText(messages.scenarios.emptyTitle)).toBeVisible();
            await expect(aside.getByRole("link", { name: CTA })).toHaveCount(0);
            await expect(page.getByRole("link", { name: CTA })).toHaveCount(2);
        } else {
            const sheet = page.getByRole("dialog");
            await expect(sheet.getByText(messages.scenarios.emptyTitle)).toBeVisible();
            await expect(sheet.getByRole("link", { name: CTA })).toHaveCount(1);
        }
    });
}
