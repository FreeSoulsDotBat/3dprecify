import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-F — T094. O BASELINE, gravado ANTES de qualquer mudança de código na fatia (o código está
// intocado — só duas pranchetas novas em `design/` e 4 chaves de i18n sem consumidor). É a
// referência que a T093 compara depois ("mobile idêntico ao baseline") e que a T097/T099 comparam
// no desktop (Simulações ≥1280px, DECISÃO 2 — hospedeiro é a coluna larga de `/calcular`).
//
// Molde (a): `porte-screenshots-pr-d.spec.ts` — `deviceScaleFactor: 1`, `animations: "disabled"`
// (a lição da 1ª rodada 29/08: uma transição de 150ms no Segmented captura o meio da troca de
// tema), `shot()` grava PNG + a caixa medida, `afterAll` FUNDE com o que já está no disco (a
// armadilha do `medidas-*.json` da PR-C: o último worker a terminar sobrescrevia os demais).
// Molde (b): `pages-desktop-width.spec.ts:17-29` — o MESMO `widthRatio()` (não px soltos).
//
// Só roda com `PORTE_SCREENSHOTS=1` (evidência, não gate) e só no projeto `chromium`
// (`--project=chromium`) — mesma disciplina do molde: as larguras 1280/1440/1920 não fazem sentido
// sob o perfil "mobile" (`isMobile` fixo), e 390/360 saem cobertos aqui via `setViewportSize` sem
// precisar do segundo projeto.

const OUT = fileURLToPath(
    new URL("../../../../specs/019-porte-design/evidencias/pr-f/baseline-mobile/", import.meta.url),
);
const THEMES = ["dark", "light"] as const;
const WIDTHS = [390, 360] as const;
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
        box: locator ? await locator.boundingBox() : null,
    };
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
test.afterAll(() => {
    const path = join(OUT, "medidas-baseline.json");
    let prev: Record<string, unknown>;
    try {
        prev = JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
    } catch {
        prev = {};
    }
    writeFileSync(path, JSON.stringify({ ...prev, ...medidas }, null, 2) + "\n");
});

async function openScenariosList(page: Page) {
    await page.getByRole("button", { name: s.navEntry }).click();
    return page.getByRole("dialog");
}

/** Cria uma simulação salva a partir do estado padrão da calculadora em `/calcular` (a semente E1
 *  já computa um resultado válido — nenhum canal/config extra é necessário para o botão "Salvar
 *  simulação" aparecer/funcionar, `save-scenario-sheet.tsx:63` — confirmado em `scenarios.spec.ts`
 *  onde o slot 0 já existe por padrão antes de qualquer configuração). */
async function saveScenario(page: Page, name: string, note?: string): Promise<void> {
    await page.getByTestId("save-scenario-trigger").click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(s.nameField).fill(name);
    if (note) await sheet.getByLabel(s.noteField).fill(note);
    await sheet.getByTestId("save-scenario-submit").click();
    await expect(page.getByText(s.saved)).toBeVisible();
}

test.describe("019/PR-F T094 — baseline MOBILE (gaveta de simulações + barra de contexto)", () => {
    test("gaveta com ≥2 simulações (uma com nota) e barra de contexto com uma aberta — 390/360, 2 temas", async ({
        page,
    }, info) => {
        test.skip(
            info.project.name !== "chromium",
            "chromium-only — setViewportSize cobre 390/360",
        );

        const email = await signUpThrowaway(page, `baseline-pr-f-${info.workerIndex}`);
        grantPremium(email);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto("/calcular");
        await page.reload(); // entitlement resolve `active` → o botão "Salvar simulação" aparece
        await expect(page.getByText("R$ 16,16")).toBeVisible(); // a semente E1 (016/US10)

        await saveScenario(page, "Simulação base", "Comparação ML x Shopee — nota do baseline");
        await saveScenario(page, "Simulação sem nota");

        for (const width of WIDTHS) {
            await page.setViewportSize({ width, height: 844 });
            for (const theme of THEMES) {
                await setTheme(page, theme);

                // (a) a gaveta — lista com as 2 simulações, uma delas exibindo a nota.
                const list = await openScenariosList(page);
                await expect(list.getByText("Simulação base")).toBeVisible();
                await expect(list.getByText("Simulação sem nota")).toBeVisible();
                await expect(
                    list.getByText("Comparação ML x Shopee — nota do baseline"),
                ).toBeVisible();
                await shot(page, `gaveta-${width}-${theme}`, list);

                // (b) a barra de contexto — abre "Simulação base" (fecha a gaveta, abre a barra).
                await list.getByText("Simulação base").click();
                await expect(page.getByRole("dialog")).toHaveCount(0);
                await expect(page.getByTestId("scenario-context-bar")).toBeVisible();
                await expect(page.getByText(s.loadedLive)).toBeVisible();
                await shot(
                    page,
                    `barra-contexto-${width}-${theme}`,
                    page.getByTestId("scenario-context-bar"),
                );

                // Fecha a simulação para o próximo ciclo (tema/largura) partir do mesmo estado limpo.
                await page.getByRole("button", { name: s.closeScenario }).click();
                await expect(page.getByTestId("scenario-context-bar")).toHaveCount(0);
            }
        }
    });
});

test.describe("019/PR-F T094 — baseline DESKTOP: widthRatio() de /calcular (o hospedeiro da PR-F)", () => {
    test("1280/1440/1920, com e sem simulação aberta — o MESMO widthRatio() de pages-desktop-width.spec.ts:17-29", async ({
        page,
    }, info) => {
        test.skip(info.project.name !== "chromium", "chromium-only — larguras desktop soltas");

        async function widthRatio(): Promise<number> {
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

        async function overflow(): Promise<{ x: number; y: number }> {
            return page.evaluate(() => ({
                x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
            }));
        }

        const email = await signUpThrowaway(page, `baseline-pr-f-desktop-${info.workerIndex}`);
        grantPremium(email);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto("/calcular");
        await page.reload();
        await expect(page.getByText("R$ 16,16")).toBeVisible();
        await saveScenario(page, "Simulação desktop baseline");

        for (const width of [1280, 1440, 1920] as const) {
            await page.setViewportSize({ width, height: 900 });

            // sem simulação aberta
            const ratioClosed = await widthRatio();
            const overflowClosed = await overflow();
            medidas[`ratio-${width}-fechada`] = { ratio: ratioClosed, overflow: overflowClosed };

            // com simulação aberta
            const list = await openScenariosList(page);
            await list.getByText("Simulação desktop baseline").click();
            await expect(page.getByRole("dialog")).toHaveCount(0);
            await expect(page.getByTestId("scenario-context-bar")).toBeVisible();
            const ratioOpen = await widthRatio();
            const overflowOpen = await overflow();
            medidas[`ratio-${width}-aberta`] = { ratio: ratioOpen, overflow: overflowOpen };

            console.log(
                `[T094 baseline] ${width}px fechada=${(ratioClosed * 100).toFixed(1)}% (overflowX=${overflowClosed.x}) ` +
                    `aberta=${(ratioOpen * 100).toFixed(1)}% (overflowX=${overflowOpen.x})`,
            );

            await page.getByRole("button", { name: s.closeScenario }).click();
            await expect(page.getByTestId("scenario-context-bar")).toHaveCount(0);
        }
    });
});
