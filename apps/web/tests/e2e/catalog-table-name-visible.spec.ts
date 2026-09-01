import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-F (T099) — GUARDA PERMANENTE do achado do QA: a 1024–1279px (faixa `tf-table` densa do
// Catálogo, PR-D/T018), o botão do nome de filamento/impressora/produto nascia com largura ZERO —
// invisível E inclicável — nas TRÊS abas, porque `catalog-panel.tsx` repetia a classe `tf-table__name`
// (escrita para a CÉLULA, onde `max-width: 0` é inerte sob `table-layout: auto`) também no `<button>`
// interno (inline-block, onde o MESMO `max-width: 0` É respeitado de verdade). Medida da 1ª rodada
// (repro, antes do fix): `btnWidth: "0px"`, `btnOffsetWidth: 0`, `btnScrollWidth: 61`,
// `buttonVisible: false` — idêntico a 1024px e a 1279px, com nome curto E longo. O fix
// (`catalog-panel.tsx`) tira a classe do botão (`block w-full min-w-0 truncate text-left`, herda a
// fonte da célula). Esta guarda prova NÃO-VÁCUO cravando o piso medido (`offsetWidth > 0`, bem acima
// de 0) — se a classe `tf-table__name` voltar ao botão, este teste falha exatamente como o repro.

const t = messages;

async function setupPremium(page: Page, tag: string): Promise<void> {
    const email = await signUpThrowaway(page, tag);
    grantPremium(email);
    await page.goto("/catalogo");
    await expect(page.getByRole("tab", { name: t.catalog.tabFilaments })).toBeVisible();
    await page.reload();
}

async function createFilament(page: Page, name: string): Promise<void> {
    await page.getByRole("tab", { name: t.catalog.tabFilaments }).click();
    await page.getByRole("button", { name: t.catalog.addFilament }).click();
    await page.getByRole("textbox", { name: t.catalogForm.name }).fill(name);
    await page.getByRole("textbox", { name: new RegExp(t.catalogForm.material) }).fill("PLA");
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
        .fill("110");
    await page.getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) }).fill("1");
    await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
    await expect(page.getByText(t.catalogForm.savedFilament)).toBeVisible();
}

async function createPrinter(page: Page, name: string): Promise<void> {
    await page.getByRole("tab", { name: t.catalog.tabPrinters }).click();
    await page.getByRole("button", { name: t.catalog.addPrinter }).click();
    await page.getByRole("textbox", { name: t.catalogForm.name }).fill(name);
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineValue) })
        .fill("1200");
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.machineLifetime) })
        .fill("2000");
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.avgPower) })
        .fill("0,12");
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.maintenance) })
        .fill("0,5");
    await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
    await expect(page.getByText(t.catalogForm.savedPrinter)).toBeVisible();
}

async function createProduct(
    page: Page,
    name: string,
    filamentName: string,
    printerName: string,
): Promise<void> {
    await page.getByRole("tab", { name: t.catalog.tabProducts }).click();
    await page.getByRole("button", { name: t.catalog.addProduct }).click();
    await page.getByRole("textbox", { name: t.productForm.nameLabel }).fill(name);
    await page
        .getByRole("combobox", { name: t.calculator.catalogPicker.filament })
        .selectOption({ label: filamentName });
    await page
        .getByRole("combobox", { name: t.calculator.catalogPicker.printer })
        .selectOption({ label: printerName });
    await page.getByRole("button", { name: t.productForm.saveProduct }).click();
    await expect(page.getByText(t.productForm.savedProduct).last()).toBeVisible();
    await page.getByRole("tab", { name: t.catalog.tabProducts }).click();
}

/** O botão do nome, DENTRO da célula `tf-table__name` — nunca a própria célula (ela sempre foi
 *  "visível" e larga; o defeito vivia no botão). */
function nameButton(page: Page, name: string) {
    return page.locator("td.tf-table__name").filter({ hasText: name }).locator("button");
}

for (const width of [1024, 1279] as const) {
    test(`tf-table a ${width}px — o botão do nome é visível e clicável nas 3 abas`, async ({
        page,
    }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: 900 });
        await setupPremium(page, `tftable-name-${width}-${info.workerIndex}`);

        await createFilament(page, "Filamento Visível");
        await createPrinter(page, "Impressora Visível");
        await createProduct(page, "Produto Visível", "Filamento Visível", "Impressora Visível");

        // ---- Filamentos ----
        await page.getByRole("tab", { name: t.catalog.tabFilaments }).click();
        let btn = nameButton(page, "Filamento Visível");
        await expect(btn).toBeVisible();
        // Não-vácuo: o repro da 1ª rodada media `btnOffsetWidth: 0` — aqui exigimos uma folga real,
        // bem acima do que um colapso silencioso deixaria passar por acidente de arredondamento.
        expect(await btn.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeGreaterThan(40);
        await btn.click();
        await expect(
            page.getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) }),
        ).toBeVisible();
        await page.keyboard.press("Escape");

        // ---- Impressoras ----
        await page.getByRole("tab", { name: t.catalog.tabPrinters }).click();
        btn = nameButton(page, "Impressora Visível");
        await expect(btn).toBeVisible();
        expect(await btn.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeGreaterThan(40);
        await btn.click();
        await expect(
            page.getByRole("textbox", { name: new RegExp(t.calculator.fields.machineValue) }),
        ).toBeVisible();
        await page.keyboard.press("Escape");

        // ---- Produtos (o clique NAVEGA para a ficha de página cheia, não abre um Sheet) ----
        await page.getByRole("tab", { name: t.catalog.tabProducts }).click();
        btn = nameButton(page, "Produto Visível");
        await expect(btn).toBeVisible();
        expect(await btn.evaluate((el) => (el as HTMLElement).offsetWidth)).toBeGreaterThan(40);
        await btn.click();
        await expect(page.getByTestId("calc-content")).toBeVisible();
    });
}
