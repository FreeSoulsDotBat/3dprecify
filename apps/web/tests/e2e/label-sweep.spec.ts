import { expect, test, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { grantPremium, recordFromCalculator, signUpThrowaway } from "./history-helpers";

// 016/US2 (T003, spec §Independent Test / FR-904) — a varredura de rótulos: NENHUMA superfície
// visível ao usuário pode conter "Histórico" ou "Cenários" (o par ANTIGO) — o rótulo correto é
// "Orçamentos"/"Simulações", trocado só por VALOR de chave i18n (rota `/historico`, chaves de API
// e payloads ficam intocados; a spec correção V0 registra que `/cenarios` nunca existiu).
//
// Case- and accent-SENSITIVE on purpose (the task's own warning): a lowercase "histórico" inside a
// sentence that legitimately describes the concept (never the OLD label) is not what this guards —
// this checks the exact capitalized nav/label word, the one a screen would show as a heading/button/
// nav item. `nome de rota "/historico"` and the api's `historico` object key are NOT visible text —
// this reads `document.body.innerText`, so neither one can ever trip it.

const FORBIDDEN = [/\bHistórico\b/, /\bCenários\b/] as const;

async function assertNoForbiddenLabels(page: Page, where: string): Promise<void> {
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const text = await page.evaluate(() => document.body.innerText);
    for (const pattern of FORBIDDEN) {
        expect(pattern.test(text), `"${pattern}" apareceu em ${where}:\n${text}`).toBe(false);
    }
}

test.describe("016/US2 — varredura de rótulos (nav, títulos, teasers) — grátis/signed-out", () => {
    test("nav + as cinco telas premium (teaser honesto) não mostram o par antigo", async ({
        page,
    }) => {
        await signUpThrowaway(page, "label-sweep-free");

        // A navegação principal (as 5 abas) é renderizada em toda página — check it once here.
        await assertNoForbiddenLabels(page, "nav (Calcular)");
        await expect(
            page.getByRole("link", { name: messages.nav.history, exact: true }),
        ).toBeVisible();

        for (const rota of ["/catalogo", "/kits", "/historico"]) {
            await page.goto(rota);
            await assertNoForbiddenLabels(page, rota);
        }

        // Simulações não tem rota própria — é o painel "Meus cenários" (agora "Minhas simulações")
        // dentro de /calcular (correção V0).
        await page.goto("/calcular");
        await page.getByRole("button", { name: new RegExp(messages.scenarios.navEntry) }).click();
        await assertNoForbiddenLabels(page, "Minhas simulações (sheet)");

        // "Usar do catálogo" — o slot da calculadora.
        await page.goto("/calcular");
        await assertNoForbiddenLabels(page, "Usar do catálogo (slot)");
    });
});

test.describe("016/US2 — varredura de rótulos — conta PREMIUM (listas reais, não só teaser)", () => {
    test("Orçamentos e Simulações com conteúdo real não mostram o par antigo", async ({
        page,
    }, info) => {
        const email = await signUpThrowaway(page, `label-sweep-premium-${info.workerIndex}`);
        grantPremium(email);
        await page.reload();

        // Um registro real em Orçamentos (a lista não-vazia é onde rótulos de card/badge aparecem).
        await recordFromCalculator(page);
        await page.goto("/historico");
        await assertNoForbiddenLabels(page, "/historico (Orçamentos, com registro)");
        await expect(page.getByRole("heading", { name: messages.history.title })).toBeVisible();

        // Uma simulação real (o painel "Minhas simulações" com ao menos um card).
        await page.goto("/calcular");
        await page.getByRole("button", { name: new RegExp(messages.scenarios.navEntry) }).click();
        await assertNoForbiddenLabels(page, "Minhas simulações (sheet, premium)");

        // Catálogo e Kits (superfícies premium — CRUD real).
        await page.goto("/catalogo");
        await assertNoForbiddenLabels(page, "/catalogo (premium)");
        await page.goto("/kits");
        await assertNoForbiddenLabels(page, "/kits (premium)");
    });
});
