import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// 016/PR-B (US4/T012) — the desktop layout geometry: A6 measured the calculator's own content
// at ~37% of the shell's main content area at 1440px ([F11a-005]); SC-903 sets the floor at
// ≥60%. This spec was RED before any CSS existed here — no `.tf-calc-grid`, so `.tf-calc-page`
// (still `max-w-md`, 448px) rendered at a fixed 448/~1200 ≈ 37%, matching the audit's finding
// almost exactly. The guard [F11a-002] (a price card never scrolls internally / never breaks a
// number mid-digit) FIRES here too, at 360/390/1440, with an adversarial six-figure price — the
// scroll must disappear because the page got WIDER, never because this guard was loosened.

const t = messages.calculator;

async function fillNumeric(page: Page, label: RegExp | string, value: string): Promise<void> {
  // Playwright's `.fill()` drives the input through real DOM input events (unlike a raw
  // `el.value = x` from `page.evaluate`, which React's controlled inputs never observe) — the
  // same pattern already proven across this suite (a11y-overflow.spec.ts et al.).
  await page.getByLabel(label).fill(value);
}

/** Drives an adversarial six-figure price (the "R$ 95.057-classe" input the brief names): a
 *  costly filament near a full roll, with a steep markup. Mirrors a11y-overflow.spec.ts's own
 *  "realistic maximum" combo so both guards stress the same class of number. */
async function fillAdversarialPrice(page: Page): Promise<void> {
  await fillNumeric(page, t.fields.costPerRoll, "99999");
  await fillNumeric(page, t.fields.grams, "950");
  await fillNumeric(page, t.fields.markupVarejo, "900");
}

async function priceCardGeometry(page: Page): Promise<{
  lineBoxes: number;
  amountOverflow: number;
  amountOverflowY: number;
  text: string;
}> {
  const int = page.locator(".tf-price__int").first();
  await expect(int).toBeVisible();
  return int.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const amount = el.closest(".tf-price__amount");
    return {
      lineBoxes: range.getClientRects().length,
      text: (el.textContent ?? "").trim(),
      amountOverflow: amount ? amount.scrollWidth - amount.clientWidth : 0,
      // 016/T018-A2 — o eixo do DEFEITO REAL do item 9 é o VERTICAL: `overflow-x: auto` faz o
      // overflow-y computar `auto`, e um conteúdo 4px mais alto que a caixa (line-height: 1)
      // renderiza a barra clássica de 15px em Chromium HEADED (o ambiente do dono) — invisível
      // em headless, que desenha overlay. A guarda só media X, e 112/112 e2e ficaram verdes com
      // a barra da foto do dono na tela. scrollHeight é medível em headless; a barra não é.
      amountOverflowY: amount ? amount.scrollHeight - amount.clientHeight : 0,
    };
  });
}

async function assertNoPriceCardScrollOrBreak(page: Page, label: string): Promise<void> {
  const geo = await priceCardGeometry(page);
  expect(
    geo.amountOverflowY,
    `${label}: price "${geo.text}" overflows vertically by ${geo.amountOverflowY}px (headed Chromium renders a 15px scrollbar here)`,
  ).toBeLessThanOrEqual(0);
  // Non-vacuity: prove the price actually stressed the layout (six digits), not a coincidence.
  expect(
    geo.text.replace(/\D/g, "").length,
    `${label}: expected a six-figure price, got "${geo.text}"`,
  ).toBeGreaterThanOrEqual(6);
  expect(geo.lineBoxes, `${label}: price "${geo.text}" split across ${geo.lineBoxes} lines`).toBe(
    1,
  );
  expect(
    geo.amountOverflow,
    `${label}: price "${geo.text}" scrolls internally by ${geo.amountOverflow}px`,
  ).toBeLessThanOrEqual(0);
}

test.describe("calculator desktop layout — geometry (016/US4, SC-903)", () => {
  test("at 1440px the calculator's own content is ≥60% of the shell's main content area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();

    const widths = await page.evaluate(() => {
      const main = document.querySelector(".tf-shell__main");
      const calc = document.querySelector('[data-testid="calc-content"]');
      if (!main || !calc) return null;
      return {
        main: main.getBoundingClientRect().width,
        calc: calc.getBoundingClientRect().width,
      };
    });
    expect(
      widths,
      "expected both .tf-shell__main and [data-testid=calc-content] in the DOM",
    ).not.toBeNull();
    const ratio = widths!.calc / widths!.main;
    expect(
      ratio,
      `content used ${widths!.calc}px of ${widths!.main}px main (${(ratio * 100).toFixed(1)}%)`,
    ).toBeGreaterThanOrEqual(0.6);
  });

  test("at 1440px the price cards never scroll internally with an adversarial price", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
    await fillAdversarialPrice(page);
    await assertNoPriceCardScrollOrBreak(page, "1440px");

    // The document itself never grows a horizontal scrollbar either — a wide grid that leaks
    // past the viewport would trade one overflow for another.
    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - el.clientWidth;
    });
    expect(overflow, `document horizontal overflow at 1440px: ${overflow}px`).toBeLessThanOrEqual(
      1,
    );
  });

  // 015/A6's own lesson, re-checked here: 360 AND 390, never just one. Nothing in this PR
  // touches the mobile breakpoint's CSS, but the guard is cheap and the class of regression
  // (a grid rule with no upper media-query bound leaking into mobile) is exactly the kind a
  // desktop-only manual check would miss.
  for (const width of [360, 390]) {
    test(`at ${width}px nothing regresses: single column, no price-card scroll/break`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/calcular");
      await expect(page.getByRole("heading", { name: t.title })).toBeVisible();
      await fillAdversarialPrice(page);
      await assertNoPriceCardScrollOrBreak(page, `${width}px`);

      const overflow = await page.evaluate(() => {
        const el = document.scrollingElement ?? document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow, `document horizontal overflow at ${width}px: ${overflow}px`).toBe(0);
    });
  }
});
