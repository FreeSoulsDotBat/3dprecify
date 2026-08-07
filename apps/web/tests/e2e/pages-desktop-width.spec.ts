import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { signUpThrowaway } from "./history-helpers";

// 016/T072-A11 (2026-08-07) — PR-B (US4/T012, SC-903) only widened the CALCULATOR at the desktop
// breakpoint (`.tf-calc-page`, ≥60% of the shell's main content area at 1440px). Every OTHER main
// page kept a flat `max-w-md` (28rem/448px), MEASURED here BEFORE the fix: ~39% at 1440px on
// /catalogo, matching the PR-B audit's own "~37%" finding almost exactly on a different page.
// `.tf-page-wide` (app-shell.css) is the SAME pattern applied to the other pages' own root
// section; the floor here is a looser ≥40% (SC-903's own ≥60% was tuned for the calculator's
// two-column grid — these pages stay single-column, so a lower floor is honest, not a downgrade:
// what matters is that they are no longer pinned at the mobile cap).

const t = messages;

async function widthRatio(page: import("@playwright/test").Page): Promise<number> {
  const widths = await page.evaluate(() => {
    const main = document.querySelector(".tf-shell__main");
    const content = document.querySelector(".tf-shell__main > section");
    if (!main || !content) return null;
    return {
      main: main.getBoundingClientRect().width,
      content: content.getBoundingClientRect().width,
    };
  });
  expect(widths, "expected both .tf-shell__main and its section child in the DOM").not.toBeNull();
  return widths!.content / widths!.main;
}

test.describe("T072-A11 — desktop content width outside the calculator (1440px)", () => {
  test("/catalogo (signed-out teaser) uses ≥40% of the shell's main content area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/catalogo");
    await expect(page.getByText(t.premiumTeaser.CATALOG.title)).toBeVisible();
    const ratio = await widthRatio(page);
    expect(ratio, `used ${(ratio * 100).toFixed(1)}% of main`).toBeGreaterThanOrEqual(0.4);
  });

  test("/historico (signed-out teaser) uses ≥40% of the shell's main content area", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/historico");
    await expect(page.getByText(t.premiumTeaser.QUOTES.title)).toBeVisible();
    const ratio = await widthRatio(page);
    expect(ratio, `used ${(ratio * 100).toFixed(1)}% of main`).toBeGreaterThanOrEqual(0.4);
  });

  test("/kits (signed-out teaser) uses ≥40% of the shell's main content area", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/kits");
    await expect(page.getByText(t.premiumTeaser.KITS.title)).toBeVisible();
    const ratio = await widthRatio(page);
    expect(ratio, `used ${(ratio * 100).toFixed(1)}% of main`).toBeGreaterThanOrEqual(0.4);
  });

  test("/conta (authenticated) uses ≥40% of the shell's main content area", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await signUpThrowaway(page, "a11-conta-width");
    await page.goto("/conta");
    await expect(page.getByRole("heading", { name: t.conta.title })).toBeVisible();
    const ratio = await widthRatio(page);
    expect(ratio, `used ${(ratio * 100).toFixed(1)}% of main`).toBeGreaterThanOrEqual(0.4);
  });
});
