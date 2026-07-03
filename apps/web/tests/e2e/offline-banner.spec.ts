import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US4 / SS-1 (+ analyze I1). The offline banner (role="status", aria-live="polite") is driven
// by navigator.onLine + the online/offline events (decision A33 Phase 2 — the engine is
// navigator.onLine, NO /health ping). Calcular is fully client-side, so it keeps computing with
// no network. The PWA SPA fallback must also boot /calcular offline after the /→/calcular move.

// The banner is scoped by its honest copy so it never collides with other role="status" nodes
// (e.g. an empty Toaster region or a Spinner). While online the widget renders nothing.
function offlineBanner(page: Page) {
  return page.getByRole("status").filter({ hasText: messages.state.offline });
}

test("offline shows the status banner within 1s and online hides it (SS-1)", async ({
  page,
  context,
}) => {
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();

  // Online: no offline banner in the DOM.
  await expect(offlineBanner(page)).toHaveCount(0);

  await context.setOffline(true);
  await expect(offlineBanner(page)).toBeVisible({ timeout: 1000 });

  await context.setOffline(false);
  await expect(offlineBanner(page)).toHaveCount(0);
});

test("Calcular keeps computing while offline (SS-1)", async ({ page, context }) => {
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
  // Canonical seed (R$100 / 1kg / 20g / 50%): material R$ 2,00.
  await expect(page.getByText("R$ 2,00")).toBeVisible();

  await context.setOffline(true);
  await expect(offlineBanner(page)).toBeVisible({ timeout: 1000 });

  // Change grams 20 → 40; the material cost recomputes to R$ 4,00 with no network.
  await page.getByLabel(messages.calculator.fields.grams).fill("40");
  await expect(page.getByText("R$ 4,00")).toBeVisible();

  await context.setOffline(false);
});

test("PWA SPA fallback serves /calcular offline after the /→/calcular move (I1)", async ({
  page,
  context,
}) => {
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
  // Wait until the service worker controls the page (precache populated).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload(); // navigation served from the SW precache, not the network
  await expect(page).toHaveURL(/\/calcular$/);
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
  // The offline boot also surfaces the banner (navigator.onLine is false at first paint).
  await expect(offlineBanner(page)).toBeVisible({ timeout: 1000 });

  await context.setOffline(false);
});
