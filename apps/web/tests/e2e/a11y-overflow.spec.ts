import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US3 / T041 — no horizontal overflow at 390px on every reachable surface, in BOTH
// themes (INV-1 / SC-005). The check is the canonical "0px horizontal overflow" test:
// document.scrollingElement.scrollWidth must equal its clientWidth (no content pushes a
// horizontal scrollbar). Runs against the built app via `pnpm e2e` (Auth emulator wraps
// the run so the guarded surfaces can be signed into).
//
// Surfaces (spec's 7): /calcular, /sign-in and the branded 404 are public/renderable
// signed-out; /catalogo, /historico, /conta are the guarded surfaces measured signed-in
// via the emulator (signed-out they only redirect to /sign-in, already covered). The
// router error boundary is not reachable through routing (it needs a thrown render
// error), so it is exercised by the US4 error-page unit test, not here.

const THEMES = ["dark", "light"] as const;
const VIEWPORT = { width: 390, height: 844 };

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
}

async function overflow(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
  });
}

async function signUpThrowaway(page: Page, tag: string): Promise<void> {
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
}

test.describe("no horizontal overflow at 390px — public surfaces", () => {
  for (const theme of THEMES) {
    test(`/calcular has no horizontal overflow (${theme})`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
      await setTheme(page, theme);
      const { scrollWidth, clientWidth } = await overflow(page);
      expect(scrollWidth, `/calcular ${theme}`).toBe(clientWidth);
    });

    test(`/calcular has no horizontal overflow with giant values (${theme})`, async ({ page }) => {
      // D2 regression: an enormous suggested price + material value must WRAP, not push a
      // horizontal scrollbar. Roll weight stays at the seeded "1" so the price renders (no
      // zero-weight error); the other three fields get 15-digit / huge inputs.
      await page.setViewportSize(VIEWPORT);
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
      await page.getByLabel(messages.calculator.fields.costPerRoll).fill("999999999999999,99");
      await page.getByLabel(messages.calculator.fields.grams).fill("999999999999999");
      // markupVarejo (not the ambiguous "Markup" substring, which now matches both
      // "Markup varejo" and "Markup atacado" — E1 split the single markup into two).
      await page.getByLabel(messages.calculator.fields.markupVarejo).fill("999999999");
      await setTheme(page, theme);
      const { scrollWidth, clientWidth } = await overflow(page);
      expect(scrollWidth - clientWidth, `/calcular giant ${theme}`).toBeLessThanOrEqual(1);
    });

    test(`/sign-in has no horizontal overflow (${theme})`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto("/sign-in");
      await expect(page.getByRole("heading", { name: messages.signIn.title })).toBeVisible();
      await setTheme(page, theme);
      const { scrollWidth, clientWidth } = await overflow(page);
      expect(scrollWidth, `/sign-in ${theme}`).toBe(clientWidth);
    });

    test(`branded 404 has no horizontal overflow (${theme})`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT);
      await page.goto("/rota-que-nao-existe-xyz");
      await expect(page.getByRole("heading", { name: messages.notFound.title })).toBeVisible();
      await setTheme(page, theme);
      const { scrollWidth, clientWidth } = await overflow(page);
      expect(scrollWidth, `404 ${theme}`).toBe(clientWidth);
    });
  }
});

test.describe("no horizontal overflow at 390px — guarded surfaces (signed-in)", () => {
  const GUARDED = [
    { path: "/catalogo", title: messages.nav.catalogo },
    { path: "/historico", title: messages.nav.historico },
    { path: "/conta", title: messages.conta.title },
  ] as const;

  for (const theme of THEMES) {
    test(`catalogo / historico / conta have no horizontal overflow (${theme})`, async ({
      page,
    }, info) => {
      await page.setViewportSize(VIEWPORT);
      // /conta now fetches server-confirmed identity through the transport wrapper (US5).
      // No backend runs in the e2e harness, so serve a real-contract camelCase {uid,email}
      // for /api/v1/me: this renders the actual signed-in Conta surface we mean to measure
      // (not its handled error fallback) and proves the transport→/me→identity wire.
      await page.route("**/api/v1/me", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ uid: "e2e-uid", email: "e2e@precifica.local" }),
        }),
      );
      await page.goto("/sign-in");
      await signUpThrowaway(page, `overflow-${theme}-${info.workerIndex}`);
      await expect(page).toHaveURL(/\/calcular$/);

      for (const { path, title } of GUARDED) {
        await page.goto(path); // full navigation → authenticated render of the real surface
        // exact: the page-header <h1> ("Catálogo") vs the EmptyState <h2> ("Catálogo em breve").
        await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
        await setTheme(page, theme);
        const { scrollWidth, clientWidth } = await overflow(page);
        expect(scrollWidth, `${path} ${theme}`).toBe(clientWidth);
      }
    });
  }
});
