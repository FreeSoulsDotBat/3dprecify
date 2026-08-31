import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-F — T099. Os screenshots 1:1 de "Simulações" na coluna larga (≥1280px, DECISÃO 2), nos
// dois temas, para `specs/019-porte-design/evidencias/pr-f/`. Só roda com `PORTE_SCREENSHOTS=1`
// (é evidência, não gate). Molde: `porte-screenshots-pr-d.spec.ts` (deviceScaleFactor: 1,
// animations: "disabled", `shot()` grava PNG + a caixa medida, `afterAll` FUNDE com o disco).
//
// Superfícies (T099):
//   (a) 1280 e 1920, conta Premium, ≥2 simulações salvas — a coluna larga com a lista ao lado da
//       calculadora, SEM nenhuma simulação aberta.
//   (b) 1280 e 1920, com uma simulação ABERTA — barra de contexto + lista com a selecionada.
//   (c) a gaveta a 390 — deve ser IDÊNTICA ao baseline (`baseline-mobile/gaveta-390-*`,
//       comparação por boundingBox + overflowX — a mesma disciplina de `porte-pr-f-t093.spec.ts`).

const OUT = fileURLToPath(
    new URL("../../../../specs/019-porte-design/evidencias/pr-f/", import.meta.url),
);
const BASELINE_DIR = fileURLToPath(
    new URL("../../../../specs/019-porte-design/evidencias/pr-f/baseline-mobile/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;
const s = messages.scenarios;

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");
test.use({ deviceScaleFactor: 1 });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
    await page.evaluate((th) => {
        document.documentElement.dataset.theme = th;
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
test.afterAll(() => {
    const path = join(OUT, "medidas-pr-f.json");
    let prev: Record<string, unknown>;
    try {
        prev = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    } catch {
        prev = {};
    }
    writeFileSync(path, JSON.stringify({ ...prev, ...medidas }, null, 2) + "\n");
});

async function saveScenario(page: Page, name: string, note?: string): Promise<void> {
    await page.getByTestId("save-scenario-trigger").click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(s.nameField).fill(name);
    if (note) await sheet.getByLabel(s.noteField).fill(note);
    await sheet.getByTestId("save-scenario-submit").click();
    await expect(page.getByText(s.saved)).toBeVisible();
}

// ---- (a)+(b) — 1280/1920, sem e com simulação aberta ------------------------------------------

for (const theme of THEMES) {
    test(`(a)+(b) simulações na coluna larga — 1280/1920, sem e com aberta (${theme})`, async ({
        page,
    }, info) => {
        test.setTimeout(120_000);
        await page.setViewportSize({ width: 1280, height: 900 });
        const email = await signUpThrowaway(page, `shot-sims-${theme}-${info.workerIndex}`);
        grantPremium(email);
        await page.goto("/calcular");
        await page.reload(); // entitlement resolve `active`
        await expect(page.getByText("R$ 16,16")).toBeVisible(); // a semente E1 (016/US10)

        await saveScenario(page, "Comparativo ML x Shopee", "Nota da simulação de evidência");
        await saveScenario(page, "Simulação sem nota");

        for (const width of [1280, 1920] as const) {
            await page.setViewportSize({ width, height: 1000 });
            await page.goto("/calcular");
            await setTheme(page, theme);
            await expect(page.getByTestId("calc-content")).toBeVisible();

            const aside = page.getByTestId("scenarios-wide-aside");
            await expect(aside).toBeVisible();
            await expect(aside.getByText("Comparativo ML x Shopee")).toBeVisible();
            await expect(aside.getByText("Simulação sem nota")).toBeVisible();
            await expect(page.getByTestId("scenario-context-bar")).toHaveCount(0);

            // (a) sem simulação aberta — a coluna larga com a lista ao lado da calculadora.
            await shot(page, `simulacoes-${width}-${theme}`);

            // (b) com uma simulação aberta — barra de contexto + lista com a selecionada.
            await aside.getByText("Comparativo ML x Shopee").click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(page.getByTestId("scenario-context-bar")).toBeVisible();
            await expect(page.getByText(s.loadedLive)).toBeVisible();
            await shot(page, `simulacoes-aberta-${width}-${theme}`);

            await page.getByRole("button", { name: s.closeScenario }).click();
            await expect(page.getByTestId("scenario-context-bar")).toHaveCount(0);
        }
    });
}

// ---- (c) — a gaveta a 390, comparada geometricamente com o baseline (mobile idêntico) ----------

for (const theme of THEMES) {
    test(`(c) gaveta a 390 — idêntica ao baseline (${theme})`, async ({ page }, info) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: 390, height: 844 });
        const email = await signUpThrowaway(page, `shot-gaveta-${theme}-${info.workerIndex}`);
        grantPremium(email);
        await page.goto("/calcular");
        await page.reload();
        await expect(page.getByText("R$ 16,16")).toBeVisible();

        await saveScenario(page, "Simulação base", "Comparação ML x Shopee — nota do baseline");
        await saveScenario(page, "Simulação sem nota");

        await setTheme(page, theme);
        await page.getByRole("button", { name: s.navEntry }).click();
        const list = page.getByRole("dialog");
        await expect(list.getByText("Simulação base")).toBeVisible();
        await expect(list.getByText("Simulação sem nota")).toBeVisible();

        await shot(page, `simulacoes-390-${theme}`, list);

        // Compara com o baseline gravado ANTES do código da fatia (T094) — mesma disciplina do T093:
        // geometria exata (boundingBox + overflowX), nunca "parece igual".
        let baseline: Record<string, { box: { width: number }; overflowX: number }>;
        try {
            baseline = JSON.parse(
                readFileSync(join(BASELINE_DIR, "medidas-baseline.json"), "utf-8"),
            );
        } catch {
            baseline = {};
        }
        const baseKey = `gaveta-390-${theme}`;
        const base = baseline[baseKey];
        expect(base, `sem baseline gravado para ${baseKey}`).toBeDefined();
        const box = await list.boundingBox();
        expect(box, `${baseKey}: sem boundingBox`).not.toBeNull();
        expect(box!.width, `${baseKey}: largura mudou do baseline`).toBeCloseTo(base!.box.width, 0);
        const overflowX = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflowX, `${baseKey}: overflowX`).toBe(base!.overflowX);
    });
}
