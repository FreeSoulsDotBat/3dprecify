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
const CTA = messages.billing.subscribeAction;

const SCREENS: { route: string; title: string }[] = [
  { route: "/catalogo", title: messages.premiumTeaser.CATALOG.title },
  { route: "/kits", title: messages.premiumTeaser.KITS.title },
  { route: "/historico", title: messages.premiumTeaser.QUOTES.title },
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
      // Anchor on the teaser title first — proves the screen finished rendering its gated state.
      await expect(page.getByText(s.title).first()).toBeVisible();
      await expect(page.getByRole("link", { name: CTA })).toHaveCount(1);
    });
  }

  test(`SC-006: a folha de Simulações at ${vp.name} shows exactly one Premium invite (signed out)`, async ({
    page,
  }) => {
    // A QUARTA tela do invariante 016/US1 é a folha "Minhas simulações" — não a /calcular inteira:
    // a página da calculadora tem DUAS superfícies premium por desenho (o teaser do picker e o gate
    // do marketplace), cada uma com o próprio convite. Dentro da FOLHA, o convite é um só.
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/calcular");
    await page.getByRole("button", { name: messages.scenarios.navEntry }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText(messages.premiumTeaser.SCENARIOS.title)).toBeVisible();
    await expect(sheet.getByRole("link", { name: CTA })).toHaveCount(1);
  });
}
