/* Guardas de regressão nascidas da homologação das correções pós-016 (qa-produto, 2026-08-07).
   13-B: o furo do cache [] — uma leitura OK de catálogo VAZIO persistia `[]` e o `cached === null`
   silenciava o erro honesto PARA SEMPRE (o caminho de todo vendedor premium novo). 13-C: o teste
   de sobre-disparo (free NÃO vê erro de leitura — o 403 do gate não é falha). 13-D: o mesmo
   mecanismo em /catalogo, onde o silêncio virava a AFIRMAÇÃO falsa "Nenhum filamento salvo ainda".
   Vermelho observado nos três antes da correção de use-catalog/use-bom (isError && items === 0). */
import { expect, test } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";

import { grantPremium, signUpThrowaway } from "./history-helpers";

const t = messages;

const ABORT = /\/api\/v1\/(filaments|printers)/;

test("13-B — A8 ramo 2 (o REALISTA): catálogo VAZIO já cacheado + leitura falhando", async ({
    page,
    context,
}, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // 1) sessão normal: o vendedor premium abre /calcular uma vez, catálogo vazio, leitura OK
    const email = await signUpThrowaway(page, `qa-a8b-${info.workerIndex}`);
    grantPremium(email);
    await page.goto("/calcular");
    await page.reload();
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(3000); // deixa a leitura bem-sucedida (lista VAZIA) ser persistida

    // 2) agora a leitura passa a falhar (servidor fora do ar / 500 / rede podre)
    let aborted = 0;
    await context.route(ABORT, (r) => {
        aborted += 1;
        return r.abort("failed");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    // O estado FINAL chega depois da janela de retry do React Query (~7s) — espera-se por ele,
    // nunca por relógio (a lição da SEMENTE que responde a primeira pintura, invertida).
    await expect(page.getByText(t.calculator.catalogPicker.loadError)).toBeVisible({
        timeout: 20_000,
    });

    const state = await page.evaluate(
        ({ err, title }) => {
            const has = (s: string) => document.body.innerText.includes(s);
            return {
                erroHonesto: has(err),
                tituloSeletor: has(title),
                online: navigator.onLine,
                // qualquer texto na tela que explique a ausência do catálogo
                trecho: document.body.innerText.slice(0, 1200),
            };
        },
        { err: t.calculator.catalogPicker.loadError, title: t.calculator.catalogPicker.title },
    );
    console.log(
        `[A8-ramo2] abortadas=${aborted} · erroHonesto=${state.erroHonesto} · cartãoSeletor=${state.tituloSeletor} · online=${state.online}`,
    );
    expect(aborted, "nenhuma requisição abortada no ramo 2").toBeGreaterThan(0);
    expect(
        state.erroHonesto,
        "RAMO 2: com um catálogo VAZIO já cacheado, a leitura falha e a tela NÃO diz nada — o cartão some em silêncio, exatamente o defeito A8",
    ).toBe(true);
});

test("13-C — A8: conta FREE (sem premium) NÃO vê o erro de leitura — o 403 do gate não é falha", async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signUpThrowaway(page, `qa-a8c-${info.workerIndex}`); // sem grantPremium: FREE
    await page.goto("/calcular");
    await page.reload();
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(4000);
    const state = await page.evaluate(
        (err) => ({
            erro: document.body.innerText.includes(err),
            texto: document.body.innerText.slice(0, 500),
        }),
        t.calculator.catalogPicker.loadError,
    );
    console.log(`[A8-free] erro de leitura visível numa conta FREE = ${state.erro}`);
    expect(
        state.erro,
        "a correção dispara demais: uma conta FREE vê 'não foi possível carregar' em vez do teaser",
    ).toBe(false);
});

test("13-D — o MESMO mecanismo em /catalogo: leitura falha e a tela diz 'nenhum salvo ainda'", async ({
    page,
    context,
}, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const email = await signUpThrowaway(page, `qa-a8d-${info.workerIndex}`);
    grantPremium(email);
    await page.goto("/catalogo");
    await page.reload();
    await page.waitForTimeout(3500); // 1ª leitura OK (lista VAZIA) → cache [] gravado

    let aborted = 0;
    await context.route(ABORT, (r) => {
        aborted += 1;
        return r.abort("failed");
    });
    await page.reload();
    await expect(page.getByText(t.catalogo.loadError)).toBeVisible({ timeout: 20_000 });
    const texto = await page.evaluate(() => document.body.innerText);
    console.log(`[13-D] abortadas=${aborted}\n--- tela ---\n${texto.slice(0, 600)}`);
    // "Nenhum filamento salvo ainda" após uma leitura que FALHOU é uma afirmação falsa
    const mente = /Nenhum filamento salvo ainda/i.test(texto);
    console.log(`[13-D] a tela afirma "nenhum salvo ainda" mesmo com a leitura falhando? ${mente}`);
    expect(aborted).toBeGreaterThan(0);
    expect(
        mente,
        "/catalogo afirma 'Nenhum filamento salvo ainda' depois de uma leitura que FALHOU — o vendedor pode ter itens salvos e a tela nega",
    ).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// N01 (achado da re-verificação do qa, 2026-08-07) — o ramo de ERRO do cartão de identidade
// em /conta era a linha flex do avatar: o Alert espremido a uma palavra por coluna e o
// "Tentar novamente" nascendo FORA da viewport a 360px (right 378,5 — a classe E6/T028-B1).
// Determinístico: /api/v1/me → 500.
test("N01 — /conta com /me falhando: erro empilhado, nada fora da viewport a 360px", async ({
    page,
    context,
}, info) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await signUpThrowaway(page, `qa-n01-${info.workerIndex}`);
    await context.route(/\/api\/v1\/me$/, (r) =>
        r.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
    );
    await page.goto("/conta");
    await expect(page.getByText(t.conta.identityErrorTitle)).toBeVisible({ timeout: 15_000 });
    const geo = await page.evaluate(() => {
        const card = document.querySelector(".tf-conta__identity");
        const retry = [...document.querySelectorAll(".tf-conta__retry button")].at(0);
        const r = retry?.getBoundingClientRect();
        return {
            pageX: document.documentElement.scrollWidth,
            retryRight: r ? r.right : null,
            cardStacked: card ? getComputedStyle(card).flexDirection === "column" : null,
        };
    });
    expect(geo.pageX, "documento sem overflow horizontal").toBeLessThanOrEqual(360);
    expect(geo.retryRight, "botão de retry dentro da viewport (era 378,5)").not.toBeNull();
    expect(geo.retryRight!).toBeLessThanOrEqual(360);
    expect(geo.cardStacked, "o ramo de erro empilha (coluna)").toBe(true);
    // Não-vacuidade por mutação viva: de volta à LINHA, o transbordo tem de reaparecer.
    await page.addStyleTag({
        content: ".tf-conta__identity--error { flex-direction: row !important; }",
    });
    const mutated = await page.evaluate(() => {
        const retry = [...document.querySelectorAll(".tf-conta__retry button")].at(0);
        return retry ? retry.getBoundingClientRect().right : null;
    });
    expect(mutated, "não-vacuidade: em linha, o retry volta a estourar").not.toBeNull();
    expect(mutated!).toBeGreaterThan(360);
});
