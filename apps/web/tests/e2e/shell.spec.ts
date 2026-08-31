import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US2 public calculator (T038). Calcular is no longer gated: a signed-out user hitting "/"
// is redirected to the public calculator (not to sign-in). The freemium boundary now lives
// on the saving tabs — see auth-boundary.spec.ts. The authenticated path (signed-in →
// calculator) is exercised by calculator.spec via the Firebase Auth emulator.
test("signed-out user hitting / lands on the public calculator (no sign-in gate)", async ({
    page,
}) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/calcular$/);
    await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
});

test("the app brand and theme toggle render on the sign-in screen", async ({ page }) => {
    await page.goto("/sign-in");
    // The brand is the Logo primitive — an accessible image (US1/T029). On /sign-in the
    // sign-in CARD shows the lockup and the top-bar logo is intentionally suppressed to avoid
    // a redundant second brand (E1 homologation item 4): exactly one brand img, none in the banner.
    await expect(page.getByRole("img", { name: messages.appName })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("img", { name: messages.appName })).toHaveCount(
        0,
    );
    await expect(page.getByRole("button", { name: messages.theme.toggle })).toBeVisible();
});

test("theme toggle flips data-theme between light and dark", async ({ page }) => {
    await page.goto("/sign-in");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: messages.theme.toggle }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
});

// 018/US5 (T018) — the collapsible rail, on the REAL path: collapse → navigate → reload →
// still collapsed. jsdom already proves the store and the ARIA contract (app-nav-rail.test.tsx);
// what only e2e can prove is persistence across a full page load (localStorage → zustand
// rehydration → CSS variable) and the actual width the content gains (SC-004: ≥160px — the
// 240px sidebar collapses to a 76px rail, freeing 164px).
test("collapsing the rail persists across navigation and reload, and frees ≥160px (018/US5)", async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/calcular");

    const collapse = page.getByRole("button", { name: messages.nav.collapse });
    await expect(collapse).toBeVisible();

    const widthBefore = (await page.locator(".tf-shell__main").boundingBox())?.width ?? 0;
    await collapse.click();

    // The button now offers the opposite action — the visible proof the rail collapsed.
    const expand = page.getByRole("button", { name: messages.nav.expand });
    await expect(expand).toBeVisible();

    // `expect.poll`, não uma leitura única: o rail tem transição de largura (app-nav.css), e um
    // boundingBox colhido no meio da animação mede o quadro intermediário — foi exatamente assim
    // que a primeira versão deste teste "provou" ganhos de 121px e 24px na mesma tela.
    await expect
        .poll(async () => (await page.locator(".tf-shell__main").boundingBox())?.width ?? 0, {
            message: `main deve ganhar ≥160px sobre ${widthBefore}px depois da transição`,
        })
        .toBeGreaterThanOrEqual(widthBefore + 160);

    // Navigate: the rail stays collapsed and every item keeps its accessible name (the label
    // leaves the SCREEN, never the accessibility tree — research §G).
    await page.getByRole("link", { name: messages.nav.catalogo }).click();
    await expect(page).toHaveURL(/\/catalogo/);
    await expect(page.getByRole("button", { name: messages.nav.expand })).toBeVisible();
    await expect(page.getByRole("link", { name: messages.nav.historico })).toBeVisible();

    // Reload: the choice survives a cold boot of the store.
    await page.reload();
    await expect(page.getByRole("button", { name: messages.nav.expand })).toBeVisible();

    // Expand again: the round trip works and hands the label back to the screen.
    await page.getByRole("button", { name: messages.nav.expand }).click();
    await expect(page.getByRole("button", { name: messages.nav.collapse })).toBeVisible();
});
