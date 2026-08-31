import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-F — T093. Mede a composição DEPOIS da T095 (Simulações ≥1280px, DECISÃO 2) e compara com
// o baseline da T094 (`porte-baseline-pr-f.spec.ts`, `evidencias/pr-f/baseline-mobile/
// medidas-baseline.json`, gravado ANTES de qualquer mudança de código).
//
// (a) Desktop: `widthRatio()` — o MESMO método de `pages-desktop-width.spec.ts:17-29` — e overflow
//     NOS DOIS EIXOS (a lição do 016: headless não vê scrollbar clássica, então `scrollWidth` E
//     `scrollHeight` do documento, nunca só X).
// (b) Mobile: recaptura a gaveta 390/360 nos dois temas e compara PIXEL A PIXEL (boundingBox) com o
//     baseline — sem `pngjs`/`pixelmatch` no lockfile (checado), a comparação é geometria exata, não
//     "frase" ("idêntico" é a asserção de igualdade abaixo, não um comentário).

const BASELINE_PATH = fileURLToPath(
    new URL(
        "../../../../specs/019-porte-design/evidencias/pr-f/baseline-mobile/medidas-baseline.json",
        import.meta.url,
    ),
);
const baseline = JSON.parse(readFileSync(BASELINE_PATH, "utf-8")) as Record<
    string,
    { viewport: { width: number; height: number }; overflowX: number; box: unknown }
>;

const s = messages.scenarios;
const THEMES = ["dark", "light"] as const;
const WIDTHS = [390, 360] as const;

test.use({ deviceScaleFactor: 1 });

async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
    await page.evaluate((th) => {
        document.documentElement.dataset.theme = th;
    }, theme);
}

async function widthRatio(page: Page): Promise<number> {
    const widths = await page.evaluate(() => {
        const main = document.querySelector(".tf-shell__main");
        const content = document.querySelector(".tf-shell__main > section");
        if (!main || !content) return null;
        return {
            main: main.getBoundingClientRect().width,
            content: content.getBoundingClientRect().width,
        };
    });
    expect(widths, "esperava .tf-shell__main e seu filho section no DOM").not.toBeNull();
    return widths!.content / widths!.main;
}

async function overflow(page: Page): Promise<{ x: number; y: number }> {
    return page.evaluate(() => ({
        x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
}

async function saveScenario(page: Page, name: string, note?: string): Promise<void> {
    await page.getByTestId("save-scenario-trigger").click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(s.nameField).fill(name);
    if (note) await sheet.getByLabel(s.noteField).fill(note);
    await sheet.getByTestId("save-scenario-submit").click();
    await expect(page.getByText(s.saved)).toBeVisible();
}

test.describe("019/PR-F T093 — desktop ≥1280px DEPOIS da composição (US7)", () => {
    test("widthRatio() 1280/1440/1920, sem e com simulação carregada — zero transbordo nos dois eixos", async ({
        page,
    }, info) => {
        test.skip(info.project.name !== "chromium", "chromium-only — larguras desktop soltas");

        const email = await signUpThrowaway(page, `t093-desktop-${info.workerIndex}`);
        grantPremium(email);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto("/calcular");
        await page.reload();
        await expect(page.getByText("R$ 16,16")).toBeVisible();
        await saveScenario(page, "Simulação T093");

        const medidas: Record<string, unknown> = {};

        for (const width of [1280, 1440, 1920] as const) {
            await page.setViewportSize({ width, height: 900 });

            // A coluna larga é sempre visível — nenhuma gaveta para abrir. "sem simulação" aqui é a
            // recarga da página, com nada carregado ainda. Espera o conteúdo REAL montar antes de medir —
            // sem isso a leitura corre contra a section vazia entre a navegação e o primeiro render.
            await page.reload();
            await expect(page.getByTestId("calc-content")).toBeVisible();
            const ratioClosed = await widthRatio(page);
            const overflowClosed = await overflow(page);
            medidas[`ratio-${width}-fechada`] = { ratio: ratioClosed, overflow: overflowClosed };

            // "com simulação aberta" agora é clicar o cartão DENTRO da coluna — nunca uma gaveta.
            const aside = page.getByTestId("scenarios-wide-aside");
            await expect(aside).toBeVisible();
            await aside.getByText("Simulação T093").click();
            await expect(page.getByTestId("scenario-context-bar")).toBeVisible();
            const ratioOpen = await widthRatio(page);
            const overflowOpen = await overflow(page);
            medidas[`ratio-${width}-aberta`] = { ratio: ratioOpen, overflow: overflowOpen };

            console.log(
                `[T093] ${width}px fechada=${(ratioClosed * 100).toFixed(1)}% (overflowX=${overflowClosed.x}) ` +
                    `aberta=${(ratioOpen * 100).toFixed(1)}% (overflowX=${overflowOpen.x})`,
            );

            // Zero transbordo HORIZONTAL nos dois eixos, com ou sem simulação carregada — a régua do 016.
            expect(overflowClosed.x, `${width}px fechada: overflowX`).toBeLessThanOrEqual(1);
            expect(overflowOpen.x, `${width}px aberta: overflowX`).toBeLessThanOrEqual(1);

            // O baseline (T094) já media a MESMA `widthRatio()` antes de qualquer código da fatia — como
            // a coluna nova mora DENTRO de `.tf-calc-page` (nunca por fora, T095), a razão section/main
            // fica INTOCADA: o teto de largura de `.tf-calc-page` não mudou, só o que existe dentro dele.
            const baselineRatio = (
                baseline[`ratio-${width}-fechada`] as { ratio: number } | undefined
            )?.ratio;
            if (baselineRatio !== undefined) {
                expect(
                    ratioClosed,
                    `${width}px: razão mudou do baseline ${baselineRatio} para ${ratioClosed} — a coluna nova vazou para FORA de .tf-calc-page`,
                ).toBeCloseTo(baselineRatio, 3);
            }

            await page.getByRole("button", { name: s.closeScenario }).click();
            await expect(page.getByTestId("scenario-context-bar")).toHaveCount(0);
        }
    });
});

test.describe("019/PR-F T093 — mobile idêntico ao baseline (US7)", () => {
    test("gaveta 390/360, 2 temas — mesma geometria (boundingBox) do baseline gravado na T094", async ({
        page,
    }, info) => {
        test.skip(
            info.project.name !== "chromium",
            "chromium-only — setViewportSize cobre 390/360",
        );

        const email = await signUpThrowaway(page, `t093-mobile-${info.workerIndex}`);
        grantPremium(email);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/calcular");
        await page.reload();
        await expect(page.getByText("R$ 16,16")).toBeVisible();

        await page.getByTestId("save-scenario-trigger").click();
        let sheet = page.getByRole("dialog");
        await sheet.getByLabel(s.nameField).fill("Simulação base");
        await sheet.getByLabel(s.noteField).fill("Comparação ML x Shopee — nota do baseline");
        await sheet.getByTestId("save-scenario-submit").click();
        await expect(page.getByText(s.saved)).toBeVisible();

        await page.getByTestId("save-scenario-trigger").click();
        sheet = page.getByRole("dialog");
        await sheet.getByLabel(s.nameField).fill("Simulação sem nota");
        await sheet.getByTestId("save-scenario-submit").click();
        await expect(page.getByText(s.saved)).toBeVisible();

        for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of THEMES) {
                await setTheme(page, theme);

                await page.getByRole("button", { name: s.navEntry }).click();
                const list = page.getByRole("dialog");
                await expect(list.getByText("Simulação base")).toBeVisible();

                const gavetaKey = `gaveta-${width}-${theme}`;
                const gavetaBase = baseline[gavetaKey];
                expect(gavetaBase, `sem baseline gravado para ${gavetaKey}`).toBeDefined();
                const gavetaBox = await list.boundingBox();
                expect(gavetaBox, `${gavetaKey}: sem boundingBox`).not.toBeNull();
                expect(gavetaBox!.width, `${gavetaKey}: largura mudou do baseline`).toBeCloseTo(
                    (gavetaBase!.box as { width: number }).width,
                    0,
                );
                const overflowX = await page.evaluate(
                    () =>
                        document.documentElement.scrollWidth - document.documentElement.clientWidth,
                );
                expect(overflowX, `${gavetaKey}: overflowX`).toBe(gavetaBase!.overflowX);

                await list.getByText("Simulação base").click();
                await expect(page.getByRole("dialog")).toHaveCount(0);
                const bar = page.getByTestId("scenario-context-bar");
                await expect(bar).toBeVisible();

                const barKey = `barra-contexto-${width}-${theme}`;
                const barBase = baseline[barKey];
                expect(barBase, `sem baseline gravado para ${barKey}`).toBeDefined();
                const barBox = await bar.boundingBox();
                expect(barBox, `${barKey}: sem boundingBox`).not.toBeNull();
                expect(barBox!.width, `${barKey}: largura mudou do baseline`).toBeCloseTo(
                    (barBase!.box as { width: number }).width,
                    0,
                );
                expect(barBox!.x, `${barKey}: x mudou do baseline`).toBeCloseTo(
                    (barBase!.box as { x: number }).x,
                    0,
                );

                await page.getByRole("button", { name: s.closeScenario }).click();
                await expect(bar).toHaveCount(0);
            }
        }
    });
});
