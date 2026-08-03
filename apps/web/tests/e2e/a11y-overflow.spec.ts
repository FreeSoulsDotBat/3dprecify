import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US3 / T041 — no horizontal overflow at 360px on every reachable surface, in BOTH
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
// 015/A6 — measured DOWN from 390 to 360. The product declares 360 as its floor, and the
// pre-provisioning audit found two blocking defects that live in the 30px between the two
// ([F11a-001] a numeric field left with 33px of usable width for 36px of content). A suite
// that measures 390 while the product promises 360 measures the wrong product.
const VIEWPORT = { width: 360, height: 844 };

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

test.describe("no horizontal overflow at 360px — public surfaces", () => {
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

    // 015/A6 — the assertion the audit found MISSING, and its absence is why the giant-values
    // test above is not vacuous but COMPLICIT: `.tf-price__int { overflow-wrap: anywhere }` kills
    // the horizontal overflow that test asserts against, and it does so by breaking the price in
    // the MIDDLE OF THE NUMBER (`18.130` → `18.13` / `0`). A wrapped block still reports
    // scrollWidth === clientWidth, so no overflow assertion can ever see it.
    //
    // The instrument matters: `element.getClientRects()` returns ONE rect for a wrapped BLOCK.
    // A Range over the contents returns one rect PER LINE BOX — that is what detects the break.
    //
    // Scope: a REALISTIC maximum (six figures), not the absurd 15-digit value the test above
    // uses. Wrapping is a legitimate last resort for an absurd number; it is never acceptable
    // for a price a 3D-print seller can actually charge.
    // Both widths, deliberately. The F12 finding was "the suite measures 390 while the product
    // promises 360" — and the answer to that is NOT to swap one blind spot for the other. A
    // 160px grid floor fixed 360 and left 390 scrolling by 24px; only measuring both caught it.
    for (const width of [360, 390]) {
      test(`the hero price never breaks mid-number at realistic maximums (${theme}, ${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto("/calcular");
        await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();
        // An expensive engineering filament on a near-full-roll print: material alone lands
        // in the tens of thousands, and a 900% markup carries it to six figures. The inputs are
        // plausible; what matters is that the OUTPUT is a price a seller could really charge.
        await page.getByLabel(messages.calculator.fields.costPerRoll).fill("99999");
        await page.getByLabel(messages.calculator.fields.grams).fill("950");
        await page.getByLabel(messages.calculator.fields.markupVarejo).fill("900");
        await setTheme(page, theme);

        const int = page.locator(".tf-price__int").first();
        await expect(int).toBeVisible();

        const measured = await int.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const amount = el.closest(".tf-price__amount");
          return {
            lineBoxes: range.getClientRects().length,
            text: (el.textContent ?? "").trim(),
            // The line-box check alone is NOT enough, and this assertion exists because it caught
            // a bad fix of mine: forbidding the break made the price render on one line and then
            // SCROLL sideways inside its own card (R$ 95.057 overflowed by 16px at 360px). One
            // line and a hidden scrollbar is not "readable" — it is the same digits-out-of-sight
            // failure wearing a different hat. The price must FIT.
            amountOverflow: amount ? amount.scrollWidth - amount.clientWidth : 0,
          };
        });

        // Non-vacuity guard: if the formula ever stops producing a six-figure price here, this
        // test would pass on a two-digit number and prove nothing. Fail loudly instead.
        expect(
          measured.text.replace(/\D/g, "").length,
          `expected a six-figure price to stress the layout, got "${measured.text}"`,
        ).toBeGreaterThanOrEqual(6);

        expect(
          measured.lineBoxes,
          `the price integer "${measured.text}" split across ${measured.lineBoxes} lines at ${width}px (${theme})`,
        ).toBe(1);

        expect(
          measured.amountOverflow,
          `the price "${measured.text}" overflows its own card by ${measured.amountOverflow}px at ${width}px (${theme}) — it renders on one line only because it scrolls`,
        ).toBeLessThanOrEqual(0);

        // The pair is what matters: forbidding the break must not be paid for with overflow.
        const { scrollWidth, clientWidth } = await overflow(page);
        expect(scrollWidth - clientWidth, `/calcular realistic-max ${theme}`).toBeLessThanOrEqual(
          1,
        );
      });
    }

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

test.describe("no horizontal overflow at 360px — guarded surfaces (signed-in)", () => {
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
