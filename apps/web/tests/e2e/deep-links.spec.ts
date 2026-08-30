import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, recordFromCalculator, signUpThrowaway } from "./history-helpers";

// 013/T020 (F-02, D1=A) — the class of test THIS project deliberately avoided until now: a REAL
// cold `page.goto()` straight at a 2-segment URL, against the BUILT app (vite preview — see
// playwright.config.ts). Every other e2e spec reaches a detail screen by CLIENT-NAV (a card/row
// click) specifically to dodge this trap; these two specs walk straight into it, on the NEW
// one-segment-plus-query URLs the migration produces (`/historico?snapshot=`, `/catalogo?produto=`)
// — the ones the migration promises now survive it.
//
// 016/T072-A4 (2026-08-07): the root cause of "the OLD 2-segment URLs blank on a cold hit" was
// `vite.config.ts`'s unconditional `base: "./"` — a RELATIVE base makes index.html's
// `<script src="./assets/…">` resolve against the CURRENT PATH, so a cold hit on
// `/catalogo/produtos/xxx` 404s its own JS bundle and never mounts React (measured directly on
// the built index.html before the fix: `src="./assets/index-*.js"`). `base` is now env-driven
// (`"/"` unless `CAPACITOR=1`), so `vite preview`'s own SPA html-fallback serves a working shell
// at ANY path depth — the tests below now exercise the OLD 2-segment shapes directly, cold, and
// prove the honest not-found screen (never blank) for an id that doesn't exist.

const t = messages;

// 018 mestre-detalhe: a ≥1280px a lista e a ficha do item convivem na MESMA tela, então um nome
// de catálogo aparece duas vezes (a linha `master-item` + o `<h2>` da ficha) e o conteúdo de um
// registro do Histórico também (o link-resumo da lista + a coluna `complementary`). Abaixo do
// corte cada tela é a única leitura — daí os locators trocarem por viewport, nunca `.first()`.
function itemVisible(page: Page, text: string) {
  return (page.viewportSize()?.width ?? 0) >= 1280
    ? page.getByTestId("master-item").filter({ hasText: text })
    : page.getByText(text);
}

/** A ficha de um registro do Histórico: no mestre-detalhe (≥1280) é a coluna `complementary` ao
 *  lado da lista; abaixo do corte é a tela inteira. */
function historicoDetail(page: Page) {
  return (page.viewportSize()?.width ?? 0) >= 1280 ? page.getByRole("complementary") : page;
}

/** Abre um produto/kit salvo do Catálogo: no mestre-detalhe (≥1280) o clique na lista só
 *  SELECIONA — quem navega para a rota cheia é o botão "Abrir para editar" da ficha. Abaixo do
 *  corte o clique na linha já navega (comportamento de sempre). */
async function openCatalogItem(page: Page, text: string): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    await page.getByTestId("master-item").filter({ hasText: text }).click();
    await page
      .getByTestId("detail-panel")
      .getByRole("button", { name: t.catalogo.detailOpenEditor })
      .click();
  } else {
    await page.getByText(text).click();
  }
}

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
  await expect(itemVisible(page, "PLA Azul")).toBeVisible();

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
  await expect(itemVisible(page, "Ender 3")).toBeVisible();
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
  const painel = historicoDetail(page);
  await expect(painel.getByText(t.historico.quotedValue)).toBeVisible();
  await expect(painel.getByRole("button", { name: t.historico.editLabel })).toBeVisible();

  // And a reload of the already-open screen — the other half of F-02 (refresh, not just first load).
  await page.reload();
  await expect(historicoDetail(page).getByText(t.historico.quotedValue)).toBeVisible();
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
  await openCatalogItem(page, "Vaso Cold-Load");
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

// 016/T072-A4 — the OLD 2-segment shapes (`/catalogo/produtos/:id`, `/historico/:id`), cold, on a
// GHOST id: proves the fix is the ASSET LOADING (base), not the app's not-found copy (which
// already existed — `produto-page.tsx`/`snapshot-detail-page.tsx` both had an honest not-found
// state that a blank page never let anyone see). Before the base fix this was a blank page: the
// browser's own JS bundle 404'd, so no React ever mounted to show ANY screen, honest or not.
test("T072-A4: cold GET on the OLD /catalogo/produtos/:id (ghost id) renders honest not-found, never blank", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `deep-cat-ghost-${info.workerIndex}`);
  void email;

  await page.goto("/catalogo/produtos/id-fantasma");
  await expect(page.getByText(t.productForm.notFound)).toBeVisible();
  await expect(page.getByRole("button", { name: t.productForm.backToCatalog })).toBeVisible();
});

test("T072-A4: cold GET on the OLD /historico/:id (ghost id) renders honest not-found, never blank", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `deep-hist-ghost-${info.workerIndex}`);
  grantPremium(email); // Orçamentos is premium-gated (US5) — a free account sees the honest teaser
  // for `?snapshot=`, never a not-found; that is correct behaviour, not this guard's target.

  // A real, well-formed UUID that doesn't exist (`clientSnapshotId` is minted with
  // `crypto.randomUUID()`, T013) — a malformed id like a literal "id-fantasma" 422s the backend's
  // validation, which is a DIFFERENT, correct "could not load" branch, not the not-found one.
  await page.goto("/historico/00000000-0000-4000-8000-000000000000");
  await expect(historicoDetail(page).getByText(t.historico.notFound)).toBeVisible();
  // 018 mestre-detalhe: a ≥1280px o link "Voltar" da Shell não existe DE PROPÓSITO (comentário em
  // snapshot-detail-page.tsx) — a lista já está ali, ao lado, e é ELA que prova que a tela não
  // ficou presa. Abaixo do corte a ficha toma a tela inteira e o link é o único caminho de volta.
  if ((page.viewportSize()?.width ?? 0) >= 1280) {
    await expect(page.getByText(t.historico.emptyTitle)).toBeVisible();
  } else {
    await expect(page.getByRole("link", { name: t.historico.backToList })).toBeVisible();
  }
});
