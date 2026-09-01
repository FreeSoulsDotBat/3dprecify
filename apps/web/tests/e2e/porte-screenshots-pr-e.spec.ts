import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { goOffline, goOnline, grantPremium, signUpThrowaway } from "./history-helpers";

// 019/T089 — os screenshots 1:1 da PR-E (Montar e Enviar, US16/US17), nos dois temas, para
// `specs/019-porte-design/evidencias/pr-e/`. Só roda com `PORTE_SCREENSHOTS=1` (é evidência, não
// gate). Molde: `porte-screenshots-pr-d.spec.ts` (mesma disciplina — `deviceScaleFactor: 1`,
// `animations: "disabled"`, `shot()` grava a imagem + a caixa medida do DOM, `medidas-pr-e.json`
// funde com o que já está no disco). Helpers de catálogo copiados de `quote-builder.spec.ts` (T084,
// já provados verdes) — não importáveis entre arquivos de teste.
//
// Superfícies (briefing do coordenador, T089):
//   (a) o construtor a 390 e 1280 (seleção 18b, com um item PARADO — K3 — apagado na lista)
//   (b) o desconto até o piso — aviso "Abaixo do custo" (Q10), Enviar continua HABILITADO
//   (c) o cartão 18e — "Enviar congela este preço" + Total enviado + Válido até + o aviso
//   (d) offline — Enviar desabilitado, com a razão visível
//   (e) o registro na lista de Orçamentos + o detalhe itemizado, com "válido até"
//   (f) medidas-pr-e.json — overflow dos dois eixos em cada captura

const OUT = fileURLToPath(
    new URL("../../../../specs/019-porte-design/evidencias/pr-e/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;
const catalogTabs = messages.catalog;
const cf = messages.catalogForm;
const pf = messages.productForm;
const f = messages.calculator.fields;
const ti = messages.calculator.timeInput;
const tq = messages.quote;

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
test.use({ deviceScaleFactor: 1 });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
    await page.evaluate((th_) => {
        document.documentElement.dataset.theme = th_;
    }, theme);
}

const medidas: Record<string, unknown> = {};
async function shot(page: Page, chave: string, locator?: ReturnType<Page["locator"]>) {
    const alvo = locator ?? page;
    if (locator) await locator.scrollIntoViewIfNeeded();
    await alvo.screenshot({ path: join(OUT, `${chave}.png`), animations: "disabled" });
    medidas[chave] = {
        viewport: page.viewportSize(),
        overflowX: await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        overflowY: await page.evaluate(
            () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
        ),
        box: locator ? await locator.boundingBox() : null,
    };
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
// Funde com o que já está no disco (armadilha do `medidas-*.json` da PR-C/PR-D: o `afterAll` roda
// por worker/arquivo, e o último a terminar sobrescrevia os demais).
test.afterAll(() => {
    const path = join(OUT, "medidas-pr-e.json");
    let prev: Record<string, unknown>;
    try {
        prev = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    } catch {
        prev = {};
    }
    writeFileSync(path, JSON.stringify({ ...prev, ...medidas }, null, 2) + "\n");
});

// ---- Helpers (molde/copiados de `quote-builder.spec.ts`, T084, já provados verdes) -------------

async function setupPremiumAccount(page: Page, tag: string): Promise<string> {
    const email = await signUpThrowaway(page, tag);
    await page.goto("/catalogo");
    await expect(page.getByRole("tab", { name: catalogTabs.tabFilaments })).toBeVisible();
    grantPremium(email);
    await page.reload();
    return email;
}

async function createFilament(page: Page, name: string): Promise<void> {
    const resWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/filaments") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: catalogTabs.addFilament }).click();
    await page.getByRole("textbox", { name: cf.name }).fill(name);
    await page.getByRole("textbox", { name: new RegExp(cf.material) }).fill("PLA");
    await page.getByRole("textbox", { name: f.costPerRoll, exact: true }).fill("100");
    await page.getByRole("textbox", { name: f.rollWeight, exact: true }).fill("1");
    await page.getByRole("button", { name: cf.save, exact: true }).click();
    await resWait;
    await expect(page.getByText(name).first()).toBeVisible();
}

async function createPrinter(page: Page, name: string): Promise<void> {
    const resWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/printers") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: catalogTabs.addPrinter }).click();
    await page.getByRole("textbox", { name: cf.name }).fill(name);
    await page.getByRole("textbox", { name: f.machineValue, exact: true }).fill("1200");
    await page.getByRole("textbox", { name: f.machineLifetime, exact: true }).fill("2000");
    await page.getByRole("textbox", { name: f.avgPower, exact: true }).fill("0,12");
    // `maintenanceReservePerHour` é `required: false` — o nome acessível ganha o sufixo " opcional"
    // (`field.tsx`) — achado T084, mesmo fix.
    await page.getByRole("textbox", { name: new RegExp(f.maintenance) }).fill("0,5");
    await page.getByRole("button", { name: cf.save, exact: true }).click();
    await resWait;
    await expect(page.getByText(name).first()).toBeVisible();
}

async function createProduct(
    page: Page,
    name: string,
    filamentName: string,
    printerName: string,
    printGrams: string,
    printHours: string,
): Promise<void> {
    await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
    await page.getByRole("button", { name: catalogTabs.addProduct }).click();
    await page.getByRole("textbox", { name: pf.nameLabel }).fill(name);
    await page
        .getByRole("combobox", { name: messages.calculator.catalogPicker.filament })
        .selectOption({ label: filamentName });
    await page
        .getByRole("combobox", { name: messages.calculator.catalogPicker.printer })
        .selectOption({ label: printerName });
    await page.getByRole("textbox", { name: f.grams, exact: true }).fill(printGrams);
    await page.getByLabel(ti.hoursAria).fill(printHours);
    await page.getByLabel(ti.minutesAria).fill("0");

    const resWait = page.waitForResponse(
        (r) => r.url().includes("/api/v1/products") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: pf.saveProduct }).click();
    await resWait;
    await expect(page.getByText(pf.savedProduct).last()).toBeVisible();
}

/** Um item PARADO (K3) — sem filamento/impressora LINKADOS. ACHADO (T089): a API RECUSA criar um
 *  produto assim direto (`products.py` — "FR-310: at CREATE a product references saved items —
 *  both links are mandatory (values-only products exist solely via the delete-degradation path)")
 *  — um POST direto com `filamentValues`/`printerValues` e sem os ids devolve 422
 *  `VALIDATION_ERROR` ("filamentId does not resolve…"). O único caminho real de um produto MANUAL
 *  é a materialização de uma peça AVULSA de kit (`kits-save.spec.ts`, K3/K4): salvar um kit com uma
 *  linha avulsa materializa "Peça 1 · {nome do kit}" como produto manual, sem ids — exatamente o
 *  que `productNeedsAttention` (`entities/catalog/product-summary.ts`) lê como "parado". */
async function createStoppedProduct(page: Page, kitName: string): Promise<string> {
    await page.goto("/kits");
    await page.reload();
    await page.getByRole("button", { name: new RegExp(messages.bom.addLine) }).click();
    await page.getByRole("textbox", { name: new RegExp(messages.bom.kitName) }).fill(kitName);
    await page.getByRole("button", { name: messages.bom.save, exact: true }).click();
    await expect(page.getByText(messages.bom.saved)).toBeVisible();
    return `Peça 1 · ${kitName}`;
}

async function openBuilder(page: Page): Promise<void> {
    await page.goto("/historico");
    await page.getByRole("button", { name: tq.newQuote }).click();
    await expect(page.getByTestId("quote-builder")).toBeVisible();
}

async function pick(page: Page, name: string, qty: string): Promise<void> {
    const row = page.locator('[data-testid^="quote-line-"]').filter({ hasText: name });
    await row.click();
    await row.getByTestId(/^quote-qty-/).fill(qty);
}

// ---------------------------------------------------------------------------------------------

for (const theme of THEMES) {
    test(`(a) construtor 390/1280 — seleção 18b, item parado apagado (${theme})`, async ({
        page,
    }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await setupPremiumAccount(page, `shot-builder-${theme}-${info.workerIndex}`);
        await createFilament(page, "Filamento Shot");
        await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
        await createPrinter(page, "Impressora Shot");
        await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
        await createProduct(page, "Peca Shot", "Filamento Shot", "Impressora Shot", "100", "4");
        const stoppedName = await createStoppedProduct(page, "Kit Parado Shot");

        await setTheme(page, theme);
        await openBuilder(page);
        await expect(
            page.locator('[data-testid^="quote-line-"]').filter({ hasText: stoppedName }),
        ).toBeVisible();
        await pick(page, "Peca Shot", "1");
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `construtor-selecao-390-${theme}`);

        // ACHADO REAL (T089, achado de produto — NÃO conserto aqui, só registro e contorno para a
        // evidência): `app-shell.tsx` monta DOIS `<Outlet/>` distintos, um em cada ramo do
        // `isMobile ? <>…</> : <div>…</div>` (a query é `max-width: 425px`). Cruzar essa borda com um
        // resize (390→1280, SEM navegação) troca a identidade da subárvore React na raiz — o
        // `QuoteBuilder` inteiro REMONTA e perde a seleção em silêncio ("1 item" vira "0 itens", o
        // checkbox de "Peca Shot" volta a "+"), sem aviso nenhum ao vendedor. Reproduzido aqui todo dia
        // (ver `medidas-pr-e.json`/captura anterior a este achado). Contorno para a EVIDÊNCIA (não é o
        // conserto do defeito, que é estrutural em `app-shell.tsx` — fora do escopo desta tarefa):
        // reabrir o construtor e reselecionar depois do resize, para a captura 1280 mostrar o MESMO
        // estado pretendido pela prancheta, não o reset.
        await page.setViewportSize({ width: 1280, height: 900 });
        await openBuilder(page);
        await pick(page, "Peca Shot", "1");
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `construtor-selecao-1280-${theme}`);
    });

    test(`(b) desconto até o piso — Abaixo do custo, Enviar habilitado (${theme})`, async ({
        page,
    }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await setupPremiumAccount(page, `shot-below-${theme}-${info.workerIndex}`);
        await createFilament(page, "Filamento Piso");
        await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
        await createPrinter(page, "Impressora Piso");
        await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
        await createProduct(page, "Peca Piso", "Filamento Piso", "Impressora Piso", "100", "4");

        await setTheme(page, theme);
        await openBuilder(page);
        await pick(page, "Peca Piso", "1");
        await page.getByRole("button", { name: tq.continueAction }).click();

        const gross = Number(
            (await page.getByTestId("quote-gross").innerText())
                .replace(/[^\d,.-]/g, "")
                .replace(".", "")
                .replace(",", "."),
        );
        await page.getByTestId("quote-discount-mode").selectOption("AMOUNT");
        await page
            .getByTestId("quote-discount-value")
            .fill((gross - 1).toFixed(2).replace(".", ","));
        const aviso = page.getByTestId("quote-below-cost");
        await expect(aviso).toBeVisible();
        await expect(page.getByTestId("quote-send")).toBeEnabled();
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `abaixo-do-custo-390-${theme}`, aviso);
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await page.screenshot({
            path: join(OUT, `abaixo-do-custo-tela-390-${theme}.png`),
            animations: "disabled",
        });
    });

    test(`(c) cartão 18e — Enviar congela este preço (${theme})`, async ({ page }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await setupPremiumAccount(page, `shot-freeze-${theme}-${info.workerIndex}`);
        await createFilament(page, "Filamento Congela");
        await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
        await createPrinter(page, "Impressora Congela");
        await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
        await createProduct(
            page,
            "Peca Congela",
            "Filamento Congela",
            "Impressora Congela",
            "100",
            "4",
        );

        await setTheme(page, theme);
        await openBuilder(page);
        await pick(page, "Peca Congela", "1");
        await page.getByRole("button", { name: tq.continueAction }).click();
        const card = page.getByText(tq.sendTitle).locator("..");
        await expect(page.getByText(tq.sendTitle)).toBeVisible();
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `cartao-enviar-congela-390-${theme}`, card);
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await page.screenshot({
            path: join(OUT, `cartao-enviar-congela-tela-390-${theme}.png`),
            animations: "disabled",
        });
    });

    test(`(d) offline — Enviar desabilitado com a razão (${theme})`, async ({
        page,
        context,
    }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await setupPremiumAccount(page, `shot-offline-${theme}-${info.workerIndex}`);
        await createFilament(page, "Filamento Offline Shot");
        await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
        await createPrinter(page, "Impressora Offline Shot");
        await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
        await createProduct(
            page,
            "Peca Offline Shot",
            "Filamento Offline Shot",
            "Impressora Offline Shot",
            "100",
            "4",
        );

        await setTheme(page, theme);
        await openBuilder(page);
        await pick(page, "Peca Offline Shot", "1");
        await page.getByRole("button", { name: tq.continueAction }).click();
        await goOffline(page, context);
        await expect(page.getByTestId("quote-send")).toBeDisabled();
        const reason = page.getByTestId("quote-send-reason");
        await expect(reason).toBeVisible();
        // ACHADO (T089): `page.screenshot()` sem locator só captura o VIEWPORT, e o botão/razão vivem
        // abaixo da dobra a 390×844 — `toBeVisible()` não exige estar rolado à vista (só CSS), então a
        // 1ª rodada gravou uma imagem sem a superfície pedida. Rolar até a razão antes da captura.
        await reason.scrollIntoViewIfNeeded();
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `offline-enviar-desabilitado-390-${theme}`);
        await goOnline(page, context);
    });

    test(`(e) registro em Orçamentos + detalhe itemizado com válido até (${theme})`, async ({
        page,
    }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        await setupPremiumAccount(page, `shot-list-${theme}-${info.workerIndex}`);
        await createFilament(page, "Filamento Lista");
        await page.getByRole("tab", { name: catalogTabs.tabPrinters }).click();
        await createPrinter(page, "Impressora Lista");
        await page.getByRole("tab", { name: catalogTabs.tabProducts }).click();
        await createProduct(page, "Peca Lista", "Filamento Lista", "Impressora Lista", "100", "4");

        await openBuilder(page);
        await page.getByLabel(tq.clientLabel).fill("Cliente Screenshot");
        await pick(page, "Peca Lista", "1");
        await page.getByRole("button", { name: tq.continueAction }).click();
        const postWait = page.waitForResponse(
            (r) => r.url().includes("/api/v1/history") && r.request().method() === "POST",
        );
        await page.getByTestId("quote-send").click();
        await postWait;

        await page.goto("/historico");
        await setTheme(page, theme);
        await expect(page.getByText("Cliente Screenshot").first()).toBeVisible();
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `lista-orcamentos-390-${theme}`);

        await page.getByText("Cliente Screenshot").first().click();
        await expect(page.getByTestId("quote-document-dates")).toBeVisible();
        // o tema vive em `dataset` do documento VIVO — cada goto/reload o apaga; reaplicar antes de capturar.
        await setTheme(page, theme);
        await shot(page, `detalhe-itemizado-390-${theme}`);
    });
}
