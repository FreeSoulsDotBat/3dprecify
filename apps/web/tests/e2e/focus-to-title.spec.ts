import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US3 / T043 — keyboard/AT navigation moves focus to the destination section title on a
// route change (NAV-2 / SC-006). The page-header <h1> is programmatically focusable
// (tabindex=-1, T030); switching tabs must land focus on the NEW screen's title so
// screen-reader users are announced onto the fresh content. Crucially, the FIRST page
// load must NOT steal focus onto the title (that would fight the user's landing point) —
// only subsequent in-app navigations move it. Runs via `pnpm e2e` (Auth emulator wraps
// the run so the guarded tabs are reachable).

const VIEWPORT = { width: 390, height: 844 };

async function signUpThrowaway(page: Page, tag: string): Promise<void> {
    await page.waitForFunction(() => "__e2eAuth" in window);
    const email = `e2e-${tag}-${Date.now()}@e2e.local`;
    await page.evaluate(
        ({ em, pw }) => {
            const w = window as unknown as {
                __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
            };
            if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
            // Fire-and-forget: signUp triggers the /sign-in → guarded-route auth redirect, and
            // awaiting it here would let that navigation destroy this evaluate's execution context
            // ("Execution context was destroyed"). Kick it off; the caller waits for the redirect UI.
            void w.__e2eAuth.signUp(em, pw);
        },
        { em: email, pw: "test-passw0rd" },
    );
}

test("the first hard load does NOT move focus to the page title", async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
    // Nothing has navigated in-app yet — the landing focus must stay off the title.
    await expect(page.locator("[data-page-header]")).not.toBeFocused();
});

test("switching tabs moves focus to the destination section title", async ({ page }, info) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/sign-in");
    await signUpThrowaway(page, `focus-${info.workerIndex}`);
    await expect(page).toHaveURL(/\/calcular$/);

    // Tab 1: Calcular → Catálogo.
    await page.getByRole("link", { name: messages.nav.catalog }).click();
    await expect(page).toHaveURL(/\/catalogo$/);
    const header = page.locator("[data-page-header]");
    await expect(header).toBeFocused();
    await expect(header).toHaveText(messages.nav.catalog);

    // Tab 2: Catálogo → Histórico — focus follows to the new title.
    await page.getByRole("link", { name: messages.nav.history }).click();
    await expect(page).toHaveURL(/\/historico$/);
    await expect(page.locator("[data-page-header]")).toBeFocused();
    await expect(page.locator("[data-page-header]")).toHaveText(messages.nav.history);
});
