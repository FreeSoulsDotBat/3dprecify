import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/T061 — os screenshots 1:1 da PR-C (comportamentos da calculadora), nos dois temas, para
// `specs/019-porte-design/evidencias/pr-c/`. Só roda com `PORTE_SCREENSHOTS=1` (é evidência, não
// gate). Superfícies da task: o aviso (blur → Aviso com "Entendi"), o readout nos dois modos, a
// confirmação inline de troca de modo, o selo compacto aberto e dispensado. T212 (sticky) está
// ⛔ DONO — não há elemento a capturar.

const OUT = fileURLToPath(
    new URL("../../../../specs/019-porte-design/evidencias/pr-c/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;
const t = messages.calculator;

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
test.use({ deviceScaleFactor: 1, viewport: { width: 390, height: 844 } });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
    await page.evaluate((th) => {
        document.documentElement.dataset.theme = th;
    }, theme);
}

const medidas: Record<string, unknown> = {};
async function shot(page: Page, chave: string, locator?: ReturnType<Page["locator"]>) {
    const alvo = locator ?? page;
    if (locator) await locator.scrollIntoViewIfNeeded();
    await alvo.screenshot({ path: join(OUT, `${chave}.png`) });
    medidas[chave] = {
        overflowX: await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        box: locator ? await locator.boundingBox() : null,
    };
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
test.afterAll(() =>
    writeFileSync(join(OUT, "medidas-pr-c.json"), JSON.stringify(medidas, null, 2) + "\n"),
);

for (const theme of THEMES) {
    test(`aviso de plausibilidade no blur + Entendi (${theme})`, async ({ page }) => {
        await page.goto("/calcular");
        await setTheme(page, theme);
        const consumo = page.getByRole("textbox", { name: new RegExp(t.fields.avgPower) });
        await consumo.fill("120");
        // Sem blur: nenhum aviso (14b — "quem digita 1200 não vê o aviso de 120 piscar").
        await expect(page.getByTestId("aviso-avgPowerKw")).toHaveCount(0);
        await consumo.blur();
        const aviso = page.getByTestId("aviso-avgPowerKw");
        await expect(aviso).toBeVisible();
        await shot(page, `aviso-blur-390-${theme}`, aviso);
        await page.screenshot({ path: join(OUT, `aviso-blur-tela-390-${theme}.png`) });
        await aviso.getByRole("button", { name: t.plausibilidade.entendi }).click();
        await expect(page.getByTestId("aviso-avgPowerKw")).toHaveCount(0);
    });

    test(`readout nos dois modos + confirmação inline (${theme})`, async ({ page }) => {
        await page.goto("/calcular");
        await setTheme(page, theme);
        const readout = page.getByTestId("machine-readout");
        await expect(readout).toBeVisible();
        await shot(page, `readout-estimar-390-${theme}`, readout);
        const modo = page.getByTestId("machine-mode");
        await modo.getByRole("radio", { name: t.machineCost.ajustar }).click();
        const horas = page.getByRole("textbox", { name: new RegExp(t.fields.machineLifetime) });
        await horas.fill("2000");
        await horas.blur();
        await expect(readout).toBeVisible();
        await shot(page, `readout-ajustar-390-${theme}`, readout);
        // Voltar a "Estimar" com 2.000 h digitadas (não é produto de ritmo × payback) → a 15e.
        await modo.getByRole("radio", { name: t.machineCost.estimar }).click();
        const confirm = page.getByTestId("machine-confirm");
        await expect(confirm).toBeVisible();
        await shot(page, `confirmacao-modo-390-${theme}`, confirm);
        await confirm.getByRole("button", { name: /^Manter/ }).click();
        await expect(page.getByTestId("machine-confirm")).toHaveCount(0);
        await expect(modo.getByRole("radio", { name: t.machineCost.ajustar })).toBeChecked();
    });

    test(`selo compacto: aberto, Ver fonte, dispensado (${theme})`, async ({ page }, info) => {
        const email = await signUpThrowaway(page, `shot-selo-${theme}-${info.workerIndex}`);
        await page.goto("/calcular"); // JIT
        grantPremium(email);
        await page.reload();
        await setTheme(page, theme);
        await page
            .getByTestId("channel-slot")
            .first()
            .getByLabel(t.channels.marketplace, { exact: true })
            .selectOption("SHOPEE");
        // O BLOCO (Alert compact) — não a pílula: só ele tem o "Dispensar".
        const selo = page
            .getByTestId("fee-seal")
            .filter({ has: page.getByRole("button", { name: t.seals.dispensar }) })
            .first();
        await expect(selo).toBeVisible();
        await shot(page, `selo-compact-390-${theme}`, selo);
        const verFonte = selo.getByRole("button", { name: t.seals.verFonte });
        if (await verFonte.count()) {
            await verFonte.click();
            const dialog = page.getByTestId("fee-seal-source-dialog");
            await expect(dialog).toBeVisible();
            await shot(page, `selo-ver-fonte-390-${theme}`, dialog);
            await page.keyboard.press("Escape");
        }
        await selo.getByRole("button", { name: t.seals.dispensar }).click();
        await expect(selo).toHaveCount(0);
        await page.reload();
        await page
            .getByTestId("channel-slot")
            .first()
            .getByLabel(t.channels.marketplace, { exact: true })
            .selectOption("SHOPEE");
        // Mesma fonte, mesma data ⇒ o BLOCO continua dispensado após o reload (D3).
        await expect(
            page
                .getByTestId("fee-seal")
                .filter({ has: page.getByRole("button", { name: t.seals.dispensar }) }),
        ).toHaveCount(0);
        await page.screenshot({ path: join(OUT, `selo-dispensado-390-${theme}.png`) });
    });
}
