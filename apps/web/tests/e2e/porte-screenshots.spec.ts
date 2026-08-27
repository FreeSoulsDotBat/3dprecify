import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/T034 — os screenshots 1:1 da PR-A (fundação DS), nos dois temas, para
// `specs/019-porte-design/evidencias/pr-a/`. Só roda com `PORTE_SCREENSHOTS=1` (é evidência, não
// gate); as asserções aqui são mínimas — o julgamento é do dono na homologação (Rodada 1 antes).
// Superfícies pedidas pela task: TabBar 390 · 404 · erro · um selo `tf-alert--compact` · um `<Frozen>`.
// A tela de ERRO não tem rota — o boundary só monta quando algo lança; fica registrada como ausente
// (não fingida com um throw injetado que não é o caminho real).

const OUT = fileURLToPath(
  new URL("../../../../specs/019-porte-design/evidencias/pr-a/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
test.use({ deviceScaleFactor: 1, viewport: { width: 390, height: 844 } });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
  }, theme);
}

const FROZEN_MARKUP = `
<div id="shot-frozen" class="tf-card" style="position:fixed;inset:72px 16px auto 16px;z-index:9999">
  <fieldset disabled class="tf-frozen" aria-disabled="true">
    <div class="tf-field">
      <label class="tf-field__label" for="fz-shot">Consumo médio <span class="tf-field__req" aria-hidden="true">*</span></label>
      <div class="tf-inputwrap"><input id="fz-shot" class="tf-input tf-input--num" type="text" aria-disabled="true" readonly><span class="tf-inputwrap__affix">kW</span></div>
      <span class="tf-field__hint">Consumo médio real da impressora, não a potência de placa (~0,12 kW).</span>
    </div>
  </fieldset>
</div>`;

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));

for (const theme of THEMES) {
  test(`TabBar 390 + selo compact da Shopee (${theme})`, async ({ page }, info) => {
    // o marketplace é Premium (016/PR-E): sem conta não há slot nem select
    const email = await signUpThrowaway(page, `shots-${theme}-${info.workerIndex}`);
    grantPremium(email);
    await page.goto("/calcular");
    await setTheme(page, theme);
    await expect(page.locator(".tf-nav--tabbar")).toBeVisible();
    await page.screenshot({ path: join(OUT, `tabbar-390-${theme}.png`) });

    // o selo compacto vive na seção Shopee: escolher SHOPEE no 1º marketplace
    await page
      .getByTestId("channel-slot")
      .first()
      .getByLabel(messages.calculator.channels.marketplace, { exact: true })
      .selectOption("SHOPEE");
    const selo = page.getByTestId("shopee-measured-freight-warning");
    await expect(selo).toBeVisible();
    await selo.scrollIntoViewIfNeeded();
    await selo.screenshot({ path: join(OUT, `selo-compact-shopee-${theme}.png`) });
    await page.screenshot({ path: join(OUT, `secao-shopee-390-${theme}.png`) });

    // 019/T021 — re-medir a seção Shopee a 360px (a geometria do compact mudou 8/12px → 12/8px)
    await page.setViewportSize({ width: 360, height: 800 });
    const box = await selo.boundingBox();
    const secao = await page
      .locator("[data-testid='shopee-measured-freight-warning']")
      .evaluate((el) => {
        const s = el.closest("section, .tf-card") ?? el.parentElement;
        return s ? s.getBoundingClientRect().height : 0;
      });
    writeFileSync(
      join(OUT, `medidas-shopee-360-${theme}.json`),
      JSON.stringify({ viewport: 360, selo: box, secaoShopeePx: secao }, null, 2) + "\n",
    );
  });

  test(`404 (${theme})`, async ({ page }) => {
    await page.goto("/esta-rota-nao-existe");
    await setTheme(page, theme);
    await expect(page.getByText(messages.notFound.title)).toBeVisible();
    await page.screenshot({ path: join(OUT, `404-390-${theme}.png`) });
  });

  test(`Frozen (${theme})`, async ({ page }) => {
    await page.goto("/calcular");
    await setTheme(page, theme);
    await page.evaluate(
      (html) => document.body.insertAdjacentHTML("beforeend", html),
      FROZEN_MARKUP,
    );
    await expect(page.locator("#shot-frozen .tf-frozen")).toBeVisible();
    await page.locator("#shot-frozen").screenshot({ path: join(OUT, `frozen-${theme}.png`) });
  });
}
