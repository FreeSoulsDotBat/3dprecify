import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_DATABASE_URL } from "../../playwright.config";

// 008/T004+T007 e2e — the E3 PR-A loop against the REAL stack: a premium account composes a
// 3-line BOM (ad-hoc + catalog-referenced) free-standing (nothing persisted, quickstart §2);
// free/signed-out at /kits meet the honest teaser while the FREE single-piece calculator stays
// fully usable (SC-408/SC-409). Persistence e2e lands in PR-B.

const backendDir = fileURLToPath(new URL("../../../../backend", import.meta.url));
const t = messages;

async function signUpThrowaway(page: Page, tag: string): Promise<string> {
  await page.goto("/sign-in");
  await page.waitForFunction(() => "__e2eAuth" in window);
  const email = `e2e-${tag}-${Date.now()}@e2e.local`;
  await page.evaluate(
    ({ em, pw }) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      if (!w.__e2eAuth) throw new Error("e2e auth seam missing");
      void w.__e2eAuth.signUp(em, pw); // fire-and-forget (redirect destroys the eval context)
    },
    { em: email, pw: "test-passw0rd" },
  );
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  return email;
}

/** Grant premium through the REAL operator path (the CLI writing the ledger — ADR-0012). */
function grantPremium(email: string): void {
  execSync(`uv run python -m app.scripts.grant_premium grant ${email} --source beta --by e2e`, {
    cwd: backendDir,
    stdio: "pipe",
    env: { ...process.env, P3D_DATABASE_URL: E2E_DATABASE_URL },
  });
}

test("premium composes a 3-line BOM (ad-hoc + catalog-ref) with live totals (US1, quickstart §2)", async ({
  page,
}, info) => {
  const email = await signUpThrowaway(page, `bom-${info.workerIndex}`);

  // Free (never granted): /kits shows the honest UNIFIED teaser, never the composer (ADR-0015).
  await page.goto("/kits");
  await expect(page.getByText(t.premiumTeaser.KITS.title)).toBeVisible();

  grantPremium(email);

  // Build one saved product to reference (filament + printer + product — the E2 loop).
  await page.goto("/catalogo");
  await page.reload();
  await expect(page.getByRole("tab", { name: t.catalogo.tabFilaments })).toBeVisible();
  await page.getByRole("button", { name: t.catalogo.addFilament }).click();
  await page.getByRole("textbox", { name: t.catalogForm.name }).fill("PLA Azul");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
    .fill("100");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) }).fill("1");
  await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
  await expect(page.getByText("PLA Azul")).toBeVisible();

  await page.getByRole("tab", { name: t.catalogo.tabPrinters }).click();
  await page.getByRole("button", { name: t.catalogo.addPrinter }).click();
  await page.getByRole("textbox", { name: t.catalogForm.name }).fill("Ender 3");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineValue) })
    .fill("4000");
  await page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineLifetime) })
    .fill("2000");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.avgPower) }).fill("0,10");
  await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
  await expect(page.getByText("Ender 3")).toBeVisible();

  await page.getByRole("tab", { name: t.catalogo.tabProducts }).click();
  await page.getByRole("button", { name: t.catalogo.addProduct }).click();
  await page.getByRole("textbox", { name: t.productForm.nameLabel }).fill("Vaso G");
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.filament })
    .selectOption({ label: "PLA Azul" });
  await page
    .getByRole("combobox", { name: t.calculator.catalogPicker.printer })
    .selectOption({ label: "Ender 3" });
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.grams) }).fill("100");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.printTime) }).fill("5");
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.tariff) }).fill("1");
  await page.getByRole("button", { name: t.productForm.saveProduct, exact: true }).click();
  await expect(page.getByText(t.productForm.savedProduct)).toBeVisible();

  // The composer: 3 lines — 2 ad-hoc (one requantified) + 1 catalog-referenced.
  await page.goto("/kits");
  await expect(page.getByText(t.bom.emptyTitle)).toBeVisible();

  await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
  await expect(page.getByText(/R\$\s?20,60/).first()).toBeVisible(); // default line, live

  await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
  await page
    .getByRole("textbox", { name: new RegExp(t.bom.quantity) })
    .last()
    .fill("3");
  // Assembly = 20,60 + 61,80 = 82,40 — read from computeBom, live.
  await expect(page.getByText(/R\$\s?82,40/).first()).toBeVisible();

  await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
  await page
    .getByRole("combobox", { name: new RegExp(t.bom.useProduct) })
    .last()
    .selectOption({ label: "Vaso G" });
  // Product line: 100g of 100/1kg + 5h×0,10kW×1 + 4000/2000×5 = 10 + 0,50 + 10 = custo 20,50.
  // Assembly total: 20,60 + 61,80 + 20,50 = 102,90.
  await expect(page.getByText(/R\$\s?102,90/).first()).toBeVisible();
  await expect(page.getByText(new RegExp("do catálogo: Vaso G")).first()).toBeVisible();

  // Remove the catalog line → total updates live (US1 acceptance 2).
  await page
    .getByRole("button", { name: new RegExp(t.bom.removeLine) })
    .last()
    .click();
  await expect(page.getByText(/R\$\s?82,40/).first()).toBeVisible();
});

// 014/T118 — a barra "Total do kit" é `position: sticky` e a TabBar é `position: fixed; bottom: 0`.
// A `padding-bottom` do shell reserva o espaço da TabBar para o conteúdo que ROLA, mas não move o
// ponto onde um sticky para: ele para em relação ao viewport, ou seja, atrás da navegação. O
// resultado é o custo total e os dois preços com os dígitos cortados durante toda a composição —
// exatamente os números pelos quais o vendedor abriu a tela.
//
// Asserção de CAIXAS, não de texto: `toBeVisible` e `toContainText` passam com o elemento
// inteiramente coberto, porque oclusão não é uma propriedade do texto.
for (const vp of [
  { width: 390, height: 844 },
  { width: 412, height: 915 },
]) {
  test(`T118: a barra de total do kit não fica atrás da navegação (${vp.width}px)`, async ({
    page,
  }, info) => {
    const email = await signUpThrowaway(page, `kitbar${vp.width}-${info.workerIndex}`);
    grantPremium(email);
    await page.setViewportSize(vp);
    await page.goto("/kits");
    await page.reload(); // a concessão só é lida na próxima carga

    await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
    await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();
    await page.getByRole("button", { name: new RegExp(t.bom.addLine) }).click();

    const barra = page.getByTestId("kit-total-bar");
    await expect(barra).toBeVisible();

    // Sem rolagem o sticky nunca chega a FIXAR e o teste passaria sem medir nada.
    await page.evaluate(() => window.scrollTo(0, 0));
    const rola = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(rola, "a página precisa rolar para a barra chegar a fixar").toBe(true);

    const caixaBarra = await barra.boundingBox();
    const caixaNav = await page.locator(".tf-nav--tabbar").boundingBox();
    expect(caixaBarra, "a barra tem caixa").not.toBeNull();
    expect(caixaNav, "a TabBar está na tela neste viewport").not.toBeNull();
    expect(
      caixaBarra!.y + caixaBarra!.height,
      `base da barra (${vp.width}px) acima do topo da TabBar`,
    ).toBeLessThanOrEqual(caixaNav!.y);
  });
}

test("signed-out at /kits sees the honest UNIFIED teaser; the FREE calculator is untouched (US5, SC-408/409, rewritten 016/US1)", async ({
  page,
}) => {
  // Signed-out: /kits renders the teaser directly (no bounce, no dialog). The 5th nav tab
  // "Kits" is the entry point (K1/SC-410) and must be present on every surface.
  const pt = t.premiumTeaser.KITS;
  await page.goto("/kits");
  await expect(page.getByRole("link", { name: t.nav.kits })).toBeVisible();
  await expect(page.getByText(pt.title)).toBeVisible();
  await expect(page.getByText(pt.subtitle)).toBeVisible();
  // NO price surprise, NO date, NO separate "Entrar"/"Entendi" (US1-AC2): the ONE CTA is
  // TeaserUpgrade's own "Assinar Premium" link, whose href already carries sign-in + redirect.
  // E6/US7 — a proibicao de PRECO caiu com a premissa dela ("cobranca e E6", e o E6 chegou). O
  // teaser mostra o preco REAL e leva a oferta. O que sobra e a honestidade do numero: so os tres
  // precos praticados. Qualquer outro valor na tela seria inventado.
  for (const n of (await page.locator("body").innerText()).match(/\d+[.,]\d{2}/g) ?? []) {
    expect(["15,99", "12,99", "155,88"]).toContain(n);
  }
  const cta = page.getByRole("link", { name: t.billing.subscribeAction });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", /\/sign-in\?redirect=/);
  await cta.click();
  await expect(page).toHaveURL(/\/sign-in\?.*redirect=%2Fconta/);

  // The free single-piece calculator stays fully usable, signed-out (SC-409 spot check).
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.grams) }).fill("200");
  // Recomputes live: a REAL price renders (review nit — assert it, don't just claim it) and no
  // premium wall appears anywhere on this page.
  await expect(page.getByText(/R\$\s?\d/).first()).toBeVisible();
  await expect(page.getByText(pt.title)).toHaveCount(0);
});
