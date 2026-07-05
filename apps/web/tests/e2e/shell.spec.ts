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
  // The brand is the Logo primitive — an accessible image, not a text node (US1/T029).
  // Scope to the top-bar banner so the assertion is unambiguous even when the sign-in
  // card renders its own Logo.
  await expect(page.getByRole("banner").getByRole("img", { name: messages.appName })).toBeVisible();
  await expect(page.getByRole("button", { name: messages.theme.toggle })).toBeVisible();
});

test("theme toggle flips data-theme between light and dark", async ({ page }) => {
  await page.goto("/sign-in");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: messages.theme.toggle }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
});
