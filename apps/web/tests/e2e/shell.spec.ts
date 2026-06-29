import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

test("foundation shell renders the brand name and the foundation message", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(messages.appName)).toBeVisible();
  await expect(page.getByText(messages.foundationReady)).toBeVisible();
  await expect(page.getByRole("button", { name: messages.theme.toggle })).toBeVisible();
});

test("theme toggle flips data-theme between light and dark", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: messages.theme.toggle }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});
