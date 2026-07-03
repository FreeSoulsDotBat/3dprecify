import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

// US3 / T042 — two WCAG 2.2 AA hardening checks (INV-2 / INV-3/4, SC-004/006):
//   1. interactive targets (nav items, top-bar controls, buttons) are ≥44×44px;
//   2. status-text (danger/success/info) reads ≥4.5:1 in BOTH themes — measured from
//      the COMPUTED colours, including the real calculator validation error (weight=0),
//      so the assertion is tied to a token the shipped UI actually renders.

const THEMES = ["dark", "light"] as const;
const VIEWPORT = { width: 390, height: 844 };
const MIN_TARGET = 44;
const AA_TEXT = 4.5;

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
}

function parseRgb(value: string): [number, number, number] {
  const m = value.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) throw new Error(`Unparseable colour: ${value}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Resolve a CSS colour expression (e.g. `var(--danger-text)`) to computed rgb by probing
// a throwaway element in the live, themed document — getPropertyValue would return the
// unresolved `var(...)` chain, so we read the browser's computed value instead.
async function resolve(
  page: Page,
  value: string,
  prop: "color" | "background-color",
): Promise<[number, number, number]> {
  const computed = await page.evaluate(
    ({ value, prop }) => {
      const el = document.createElement("span");
      el.style.setProperty(prop, value);
      document.body.appendChild(el);
      const read = getComputedStyle(el).getPropertyValue(prop);
      el.remove();
      return read;
    },
    { value, prop },
  );
  return parseRgb(computed);
}

test.describe("interactive targets are ≥44×44px", () => {
  test("nav + top-bar controls on /calcular", async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: messages.calculator.title })).toBeVisible();

    const controls = page.locator("a[data-nav-item], .tf-topbar__theme");
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(5); // 4 nav items + theme toggle
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `control #${i} has a box`).not.toBeNull();
      expect(box!.width, `control #${i} width`).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(box!.height, `control #${i} height`).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });

  test("nav + buttons on /sign-in", async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: messages.signIn.title })).toBeVisible();

    const controls = page.locator("a[data-nav-item], .tf-topbar__theme, button.tf-btn");
    const count = await controls.count();
    expect(count).toBeGreaterThanOrEqual(6); // 4 nav + theme toggle + Google button
    for (let i = 0; i < count; i++) {
      const box = await controls.nth(i).boundingBox();
      expect(box, `control #${i} has a box`).not.toBeNull();
      expect(box!.width, `control #${i} width`).toBeGreaterThanOrEqual(MIN_TARGET);
      expect(box!.height, `control #${i} height`).toBeGreaterThanOrEqual(MIN_TARGET);
    }
  });
});

test.describe("status-text contrast ≥4.5:1 in both themes", () => {
  // The status-text tokens live on the card surface (Alert/Field error sit on --surface-card,
  // which is exactly the basis the token doc measured them against — white on light, #14151a
  // on dark). Assert each resolves ≥4.5:1 in both themes.
  for (const theme of THEMES) {
    test(`--danger/--success/--info-text on the card surface (${theme})`, async ({ page }) => {
      await page.goto("/calcular");
      await setTheme(page, theme);
      const bg = await resolve(page, "var(--surface-card)", "background-color");
      for (const token of ["--danger-text", "--success-text", "--info-text"] as const) {
        const fg = await resolve(page, `var(${token})`, "color");
        const ratio = contrastRatio(fg, bg);
        expect(
          ratio,
          `${token} on --surface-card (${theme}) = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    });
  }

  test("the real calculator validation error uses --danger-text and reads ≥4.5:1", async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);
    await page.goto("/calcular");
    await page.getByLabel(messages.calculator.fields.rollWeight).fill("0");

    const error = page.locator(".tf-field__error");
    await expect(error).toBeVisible();
    await expect(error).toHaveText(messages.calculator.rollWeightError);

    for (const theme of THEMES) {
      await setTheme(page, theme);
      const fg = parseRgb(await error.evaluate((el) => getComputedStyle(el).color));
      const token = await resolve(page, "var(--danger-text)", "color");
      // The shipped element renders the semantic token, never a raw hue (INV-4).
      expect(fg, `error colour == --danger-text (${theme})`).toEqual(token);
      const bg = await resolve(page, "var(--surface-card)", "background-color");
      const ratio = contrastRatio(fg, bg);
      expect(
        ratio,
        `validation error contrast (${theme}) = ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});
