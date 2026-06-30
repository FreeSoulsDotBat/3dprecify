import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// Authenticated calculator E2E (US2). Signs a throwaway user in against the Firebase Auth
// emulator through the app's emulator-only seam (window.__e2eAuth, see shared/lib/firebase.ts),
// then drives the calculator. Requires the emulator running — use `pnpm e2e` at the repo root
// (firebase emulators:exec wraps the Playwright run).

async function signInThrowaway(page: import("@playwright/test").Page, tag: string): Promise<void> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    async ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      await w.__e2eAuth.signUp(em, pw);
    },
    { em: email, pw: "test-passw0rd" },
  );
  // The /sign-in guard bounces authenticated users to the calculator at "/".
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
}

test("authenticated user computes material + price (R$ 2,00 / R$ 3,00)", async ({ page }, info) => {
  await signInThrowaway(page, `base-${info.workerIndex}`);

  await page.getByLabel(messages.calculator.fields.costPerRoll).fill("100");
  await page.getByLabel(messages.calculator.fields.rollWeight).fill("1");
  await page.getByLabel(messages.calculator.fields.grams).fill("20");
  await page.getByLabel(messages.calculator.fields.markup).fill("50");

  await expect(page.getByText("R$ 2,00")).toBeVisible(); // material breakdown row
  await expect(page.getByText("R$ 3,00")).toBeVisible(); // suggested-price total row
});

test("zero roll weight shows a friendly error, no division by zero", async ({ page }, info) => {
  await signInThrowaway(page, `err-${info.workerIndex}`);

  await page.getByLabel(messages.calculator.fields.rollWeight).fill("0");
  await expect(page.getByText(messages.calculator.rollWeightError)).toBeVisible();
});

test("app shell + calculator work offline once the SW has precached (FR-008)", async ({
  page,
  context,
}, info) => {
  await signInThrowaway(page, `offline-${info.workerIndex}`);
  // Wait until the service worker controls the page (precache populated).
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 20_000,
  });

  await context.setOffline(true);
  await page.reload(); // navigation served from the SW precache, not the network
  await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();

  // The pricing calc is client-side, so it still works with no network.
  await page.getByLabel(messages.calculator.fields.costPerRoll).fill("100");
  await page.getByLabel(messages.calculator.fields.rollWeight).fill("1");
  await page.getByLabel(messages.calculator.fields.grams).fill("20");
  await page.getByLabel(messages.calculator.fields.markup).fill("50");
  await expect(page.getByText("R$ 3,00")).toBeVisible();

  await context.setOffline(false);
});
