import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US1 login gate (anonymous path). The e2e build runs in emulator mode with no signed-in user,
// so auth resolves to "anonymous" and the protected calculator at "/" must redirect to the
// sign-in screen. The authenticated path (signed-in → calculator) is exercised by calculator.spec
// via the Firebase Auth emulator (run with `pnpm e2e` at the repo root).
test("signed-out user hitting / is redirected to the sign-in screen", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: messages.signIn.title })).toBeVisible();
  await expect(page.getByRole("button", { name: messages.signIn.google })).toBeVisible();
});

test("the app brand and theme toggle render on the sign-in screen", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByText(messages.appName)).toBeVisible();
  await expect(page.getByRole("button", { name: messages.theme.toggle })).toBeVisible();
});

test("theme toggle flips data-theme between light and dark", async ({ page }) => {
  await page.goto("/sign-in");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: messages.theme.toggle }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});
