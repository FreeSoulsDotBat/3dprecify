import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { E2E_BACKEND_URL } from "../../playwright.config";

import { captureEntitlementBearerToken } from "./billing-helpers";
import { grantPremium, signUpThrowaway } from "./history-helpers";

// 019/PR-F — T097 (A11-r). SÓ MEDIR, sem asserção nova (o achado é registrado, não corrigido nesta
// fatia): quantos itens da lista do Catálogo ficam visíveis SEM ROLAR — 1024/1279 (`tf-table`,
// entrou na PR-D, `useIsListDense`) e 1280/1920 (mestre-detalhe do 018, `useIsWide`). Molde de
// criação em lote: `catalog-recalculo.spec.ts` (bearer capturado + POST direto contra o backend
// real, sem passar pela UI 40 vezes).

const catalogo = messages.catalogo;

const OUT = fileURLToPath(
    new URL("../../../../specs/019-porte-design/evidencias/pr-f/a11r.json", import.meta.url),
);

/** Conta quantos elementos do seletor terminam DENTRO da altura visível (scrollY=0) — a mesma régua
 *  nos dois ramos: "sem rolar" é `clientHeight` da própria janela, não um container que se declare
 *  não-rolável (nenhum dos dois ramos declara um — a página inteira rola). */
async function countVisibleWithoutScroll(page: Page, selector: string): Promise<number> {
    return page.evaluate((sel) => {
        const vh = document.documentElement.clientHeight;
        return Array.from(document.querySelectorAll(sel)).filter(
            (el) => el.getBoundingClientRect().bottom <= vh && el.getBoundingClientRect().top >= 0,
        ).length;
    }, selector);
}

test.skip(!process.env.PORTE_SCREENSHOTS, "evidência sob demanda: PORTE_SCREENSHOTS=1");

test("A11-r — itens visíveis sem rolar, 1024/1279 (tf-table) e 1280/1920 (mestre-detalhe)", async ({
    page,
    request,
}, info) => {
    test.skip(info.project.name !== "chromium", "chromium-only — larguras desktop soltas");

    const email = await signUpThrowaway(page, `a11r-${info.workerIndex}`);
    await page.goto("/catalogo"); // JIT-provisiona a conta antes do grant
    await expect(page.getByRole("tab", { name: catalogo.tabFilaments })).toBeVisible();
    grantPremium(email);

    const bearer = captureEntitlementBearerToken(page);
    await page.reload();
    const auth = await bearer;

    // 40 filamentos — o suficiente para transbordar 900px de altura nos dois ramos (medido: a
    // linha do tf-table e o cartão do mestre-detalhe cabem bem menos que 40 na dobra).
    for (let i = 0; i < 40; i++) {
        const res = await request.post(`${E2E_BACKEND_URL}/api/v1/filaments`, {
            headers: { authorization: auth },
            data: {
                name: `A11r Filamento ${String(i).padStart(2, "0")}`,
                material: "PLA",
                costPerRoll: "100",
                rollWeightKg: "1",
            },
        });
        expect(res.ok(), `POST filaments[${i}]: ${res.status()}`).toBe(true);
    }

    const medidas: Record<string, { largura: number; altura: number; visiveisSemRolar: number }> =
        {};

    // 1024/1279 — `tf-table` (PR-D, `useIsListDense` sem `useIsWide`).
    for (const largura of [1024, 1279] as const) {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/catalogo");
        await expect(page.getByRole("table")).toBeVisible();
        const n = await countVisibleWithoutScroll(page, "tbody tr");
        medidas[`tf-table-${largura}`] = { largura, altura: 900, visiveisSemRolar: n };
    }

    // 1280/1920 — mestre-detalhe do 018 (`useIsWide`).
    for (const largura of [1280, 1920] as const) {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/catalogo");
        await expect(page.getByTestId("master-list")).toBeVisible();
        const n = await countVisibleWithoutScroll(page, '[data-testid="master-item"]');
        medidas[`mestre-detalhe-${largura}`] = { largura, altura: 900, visiveisSemRolar: n };
    }

    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(
        OUT,
        JSON.stringify(
            {
                registradoEm: new Date().toISOString(),
                itensCriados: 40,
                medidas,
            },
            null,
            2,
        ) + "\n",
    );

    console.log(`[T097 A11-r] ${JSON.stringify(medidas)}`);
});
