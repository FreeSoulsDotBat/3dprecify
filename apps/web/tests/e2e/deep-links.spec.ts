import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, recordFromCalculator, signUpThrowaway } from "./history-helpers";

// 013/T020 (F-02, D1=A) — the class of test THIS project deliberately avoided until now: a REAL
// cold `page.goto()` straight at a 2-segment URL, against the BUILT app (`base: "./"`, vite
// preview — see playwright.config.ts). Every other e2e spec reaches a detail screen by CLIENT-NAV
// (a card/row click) specifically to dodge this trap; these two specs walk straight into it, on
// the NEW one-segment-plus-query URLs the migration produces (`/historico?snapshot=`,
// `/catalogo?produto=`) — the ones the migration promises now survive it.
//
// What this does NOT prove: the OLD 2-segment URLs (`/historico/:id`, `/catalogo/produtos/:id`)
// redirecting on a COLD hit. That half is the `firebase.json` hosting-level 301 (T024), which only
// exists at the real Firebase Hosting layer — vite preview has no such rewrite, so a cold hit on
// the OLD shape would still blank here exactly as it did before the migration (the client-side
// redirect route in router.tsx cannot run before the app boots, and the app cannot boot on that
// URL — the whole reason the hosting-level redirect is a SEPARATE, required layer).

const t = messages;

/** Create one filament + one printer (the same numbers `catalog.spec.ts`/E2-T025 already prove
 *  compute "R$ 25,65", 016/US10 — sem Desperdício) — the minimum a product needs to save (FR-310). */
async function createFilamentAndPrinter(page: Page): Promise<void> {
  await page.goto("/catalogo");
  await page.getByRole("button", { name: t.catalogo.addFilament }).click();
  await page.getByRole("textbox", { name: t.catalogForm.name }).fill("PLA Azul");
  await page.getByRole("textbox", { name: new RegExp(t.catalogForm.material) }).fill("PLA");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
    .fill("110");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) }).fill("1");
  await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
  await expect(page.getByText("PLA Azul")).toBeVisible();

  await page.getByRole("tab", { name: t.catalogo.tabPrinters }).click();
  await page.getByRole("button", { name: t.catalogo.addPrinter }).click();
  await page.getByRole("textbox", { name: t.catalogForm.name }).fill("Ender 3");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineValue) })
    .fill("1200");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineLifetime) })
    .fill("2000");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.avgPower) }).fill("0,12");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.maintenance) })
    .fill("0,5");
  await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
  await expect(page.getByText("Ender 3")).toBeVisible();
}

test("T020: /historico?snapshot=<id> renders on a COLD page.goto AND survives a reload", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `deep-hist-${info.workerIndex}`);
  grantPremium(email);

  await page.goto("/calcular");
  await page.reload();
  await recordFromCalculator(page);
  await expect(page.getByText(t.historico.saved)).toBeVisible();

  // Open it the normal way ONCE, to mint the real URL (the client-nav path every other spec uses).
  await page.goto("/historico");
  await page.getByText(t.historico.quotedAt.split("{")[0]!.trim()).first().click();
  await expect(page).toHaveURL(/\/historico\?snapshot=.+/);
  const detailUrl = page.url();

  // THE ACTUAL F-02 REGRESSION GUARD: a fresh, cold navigation straight at that URL — no client
  // router involved, the browser requests it exactly as a bookmark/shared-link opener would.
  await page.goto(detailUrl);
  await expect(page.getByText(t.historico.quotedValue)).toBeVisible();
  await expect(page.getByRole("button", { name: t.historico.editLabel })).toBeVisible();

  // And a reload of the already-open screen — the other half of F-02 (refresh, not just first load).
  await page.reload();
  await expect(page.getByText(t.historico.quotedValue)).toBeVisible();
});

test("T020: /catalogo?produto=<id> renders on a COLD page.goto AND survives a reload", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `deep-cat-${info.workerIndex}`);
  grantPremium(email);
  await page.reload();

  await createFilamentAndPrinter(page);
  await page.getByRole("tab", { name: t.catalogo.tabProducts }).click();
  await page.getByRole("button", { name: t.catalogo.addProduct }).click();
  await page.getByRole("textbox", { name: t.productForm.nameLabel }).fill("Vaso Cold-Load");
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.filament })
    .selectOption({ label: "PLA Azul" });
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.printer })
    .selectOption({ label: "Ender 3" });
  await expect(page.getByText("R$ 25,65").first()).toBeVisible();
  await page.getByRole("button", { name: t.productForm.saveProduct }).click();
  await expect(page.getByText(t.productForm.savedProduct)).toBeVisible();

  // Open the saved product the normal way (client-nav row click) to mint the real URL.
  await page.getByText("Vaso Cold-Load").click();
  await expect(page).toHaveURL(/\/catalogo\?produto=.+/);
  const productUrl = page.url();

  // THE ACTUAL F-02 REGRESSION GUARD: cold `page.goto` straight at the URL.
  await page.goto(productUrl);
  await expect(page.getByRole("textbox", { name: t.productForm.nameLabel })).toHaveValue(
    "Vaso Cold-Load",
  );
  await expect(page.getByText("R$ 25,65").first()).toBeVisible();

  // Reload of the already-open screen.
  await page.reload();
  await expect(page.getByRole("textbox", { name: t.productForm.nameLabel })).toHaveValue(
    "Vaso Cold-Load",
  );
});
