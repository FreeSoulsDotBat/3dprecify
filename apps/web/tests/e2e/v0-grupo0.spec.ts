import { mkdirSync } from "node:fs";

import { test, expect, type Page } from "@playwright/test";

import { messages } from "../../src/shared/i18n/messages.pt-br";
import { signUpThrowaway } from "./history-helpers";

// 016/T001 (V0) — MEDIÇÃO do Grupo 0 (itens 15–19 do relatório da homologação humana), não conserto.
// Sintoma relatado: logado SEM premium, Catálogo/Kits/Orçamentos/Simulações mostram "Não foi
// possível carregar…" em vermelho no lugar do teaser. Hipótese concorrente: os prints do dono são
// anteriores ao PR #42 (ProactorEventLoop), quando toda rota de banco devolvia 500 — e um 500 cai
// legitimamente no ramo de erro genérico (o cliente já trata ENTITLEMENT_REQUIRED com ramo próprio).
// Este spec NÃO decide o que deveria aparecer: ele REGISTRA o que aparece (screenshot + status HTTP
// por tela) com o backend correto (run_e2e_server.py, SelectorEventLoop). O julgamento é humano.
// A única asserção dura é a da hipótese: NENHUMA chamada /api pode devolver 5xx.

const EVID = "specs/016-correcao-homologacao/evidencias/v0";
const SCREENS = [
    { path: "/catalogo", nome: "12-catalogo" },
    { path: "/kits", nome: "13-kits" },
    { path: "/historico", nome: "14-orcamentos" },
] as const;

async function medir(page: Page, nome: string, statuses: string[]): Promise<void> {
    // Rede assentada + um respiro para os ramos de erro/teaser renderizarem.
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `../../${EVID}/${nome}.png`, fullPage: true });
    const texto = await page.evaluate(() => document.body.innerText);
    const temErroGenerico = /Não foi possível carregar/i.test(texto);
    const temAssinar = /Assinar Premium|fazem parte do Premium|faz parte do Premium/i.test(texto);
    console.log(
        `[V0] ${nome} → api=[${statuses.join(" · ") || "nenhuma chamada"}] ` +
            `erroGenerico=${String(temErroGenerico)} sinalTeaser=${String(temAssinar)}`,
    );
}

test("V0 — logado sem premium: o que as quatro telas premium mostram (medição)", async ({
    page,
}) => {
    mkdirSync(`../../${EVID}`, { recursive: true });
    const statuses: string[] = [];
    page.on("response", (r) => {
        const u = new URL(r.url());
        if (u.pathname.startsWith("/api/")) {
            statuses.push(`${String(r.status())} ${u.pathname}`);
        }
    });

    await signUpThrowaway(page, "v0"); // conta nova, SEM grantPremium — o estado exato do relatório

    for (const s of SCREENS) {
        statuses.length = 0;
        await page.goto(s.path); // rotas de 1 segmento — fora da armadilha do deep-link com base './'
        await medir(page, s.nome, statuses);
        // A hipótese do PR #42: com o backend correto, NENHUM 5xx. (403/401 são legítimos aqui.)
        const cincoXX = statuses.filter((l) => /^5\d\d /.test(l));
        expect(cincoXX, `5xx em ${s.nome}: ${cincoXX.join(", ")}`).toHaveLength(0);
    }

    // Simulações NÃO tem rota — "Meus cenários" é um botão dentro de /calcular
    // (calcular-page.tsx; medido depois de um 404 em /cenarios que era erro DESTE spec).
    statuses.length = 0;
    await page.goto("/calcular");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.getByRole("button", { name: new RegExp(messages.scenarios.navEntry) }).click();
    await medir(page, "15-simulacoes", statuses);
    expect(
        statuses.filter((l) => /^5\d\d /.test(l)),
        "5xx em simulacoes",
    ).toHaveLength(0);

    // Item 4 do relatório — "Usar do catálogo" dentro da calculadora.
    statuses.length = 0;
    await page.goto("/calcular");
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const picker = page.getByText("Usar do catálogo", { exact: false }).first();
    const pickerVisivel = await picker.isVisible().catch(() => false);
    console.log(`[V0] 04-usar-do-catalogo → seção visível=${String(pickerVisivel)}`);
    await medir(page, "04-usar-do-catalogo", statuses);
});
