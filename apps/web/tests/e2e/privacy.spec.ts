import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// FR-214 (006) — the minimal honest privacy notice must be reachable signed-out at /privacidade,
// and the sign-in screen must link to it (the notice exists BEFORE the UAT URL is shared).

test("privacy notice: /privacidade renders signed-out with the honest pt-BR copy (FR-214)", async ({
    page,
}) => {
    const t = messages.privacy;
    await page.goto("/privacidade"); // public — no sign-in, no guard
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    await expect(page.getByText(t.google)).toBeVisible();
    await expect(page.getByText(t.calculatorFree)).toBeVisible();
});

test("sign-in screen links to the privacy notice (FR-214)", async ({ page }) => {
    const t = messages.privacy;
    await page.goto("/sign-in");
    const link = page.getByRole("link", { name: t.title });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    await expect(page).toHaveURL(/\/privacidade$/);
});
