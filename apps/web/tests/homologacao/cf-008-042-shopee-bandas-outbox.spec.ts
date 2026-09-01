import { expect, test, type Page } from "@playwright/test";

import {
    aplicarSubcenario,
    culpadosDoOverflow,
    defeito,
    executado,
    offline,
    online,
    overflow,
    premium,
    rotulo,
    t,
    varreduraDeSaude,
} from "./_harness";

// O bloco final: perfil Shopee (CF-009) · categoria do anúncio (CF-008) · a banda cujo fixo é uma
// REGRA e não uma constante (CF-010, regime `PCT_OF_PRICE`) · a fila offline diante de 401 e 403
// (CF-025-UI-03 / CF-042) · e a degradação de uma referência apagada (CF-024).

const ch = t.calculator.channels;
const cp = t.calculator.categoryPicker;
const h = t.history;

function brl(x: string): number {
    return Number(x.replace(/\./g, "").replace(",", "."));
}

async function leituraCanal(
    page: Page,
): Promise<{ varejo: number | null; anuncio: number | null; liquido: number | null }> {
    const texto = await page.locator("body").innerText();
    const pega = (r: string): number | null => {
        const m = new RegExp(`${r}[\\s\\S]{0,60}?R\\$\\s*(-?[\\d.]+,\\d{2})`, "i").exec(texto);
        return m ? brl(m[1]) : null;
    };
    return {
        varejo: pega(t.calculator.results.retail),
        anuncio: pega(t.calculator.results.listingPrice),
        liquido: pega(t.calculator.results.netReceived),
    };
}

async function escolherMarketplace(page: Page, nome: string): Promise<boolean> {
    const sel = page.getByRole("combobox", { name: rotulo(ch.marketplace) }).first();
    if (!(await sel.isVisible().catch(() => false))) return false;
    await sel.selectOption({ label: nome }).catch(() => undefined);
    await page.waitForTimeout(900);
    return true;
}

// =====================================================================================
// CF-009 — o perfil do vendedor Shopee: duas perguntas que mudam a tabela
// =====================================================================================
test("CF-009-UI-01 — perfil Shopee: as duas perguntas aparecem, mudam a tarifa e o vazio é o catch-all", async ({
    page,
}, info) => {
    const SUB = "CF-009-UI-01";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `shopee-${info.workerIndex}`);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(1200);
    executado(info, SUB, "gate_premium");

    if (!(await escolherMarketplace(page, t.calculator.marketplaceNames.SHOPEE))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: "Não há seletor de marketplace no canal para escolher a Shopee",
            resultado_esperado: `Combobox "${ch.marketplace}"`,
            resultado_obtido: "não encontrado",
            severidade: "alta",
        });
        return;
    }

    // T01 — a primeira pergunta existe SÓ na Shopee.
    const perfil = page.getByRole("combobox", { name: rotulo(ch.sellerTypeLabel) }).first();
    const temPerfil = await perfil.isVisible().catch(() => false);
    executado(info, SUB, "fluxo");
    if (!temPerfil) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `Na Shopee, a pergunta "${ch.sellerTypeLabel}" não aparece — o eixo que escolhe a tabela some`,
            resultado_esperado: "As duas perguntas do perfil, dirigidas pelo catálogo (016/US17)",
            resultado_obtido: (await page.locator("body").innerText()).slice(0, 220),
            severidade: "alta",
        });
        return;
    }

    const semPerfil = await leituraCanal(page);

    // T02 — a segunda pergunta SÓ aparece quando o perfil é CPF.
    await perfil.selectOption({ label: ch.sellerTypeOptions.CNPJ }).catch(() => undefined);
    await page.waitForTimeout(800);
    const volumeComCnpj = await page
        .getByRole("combobox", { name: rotulo(ch.highVolumeLabel) })
        .first()
        .isVisible()
        .catch(() => false);
    executado(info, SUB, "fluxo");
    if (volumeComCnpj) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `A pergunta "${ch.highVolumeLabel}" aparece para CNPJ, mas ela só faz sentido para CPF (FR-926)`,
            resultado_esperado: "Pergunta de volume apenas quando o perfil é Pessoa física",
            resultado_obtido: "visível com CNPJ selecionado",
            severidade: "media",
        });
    }
    const comCnpj = await leituraCanal(page);

    await perfil.selectOption({ label: ch.sellerTypeOptions.CPF }).catch(() => undefined);
    await page.waitForTimeout(800);
    const volume = page.getByRole("combobox", { name: rotulo(ch.highVolumeLabel) }).first();
    executado(info, SUB, "fluxo");
    if (!(await volume.isVisible().catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `Com o perfil CPF, a pergunta "${ch.highVolumeLabel}" não aparece`,
            resultado_esperado: "Segunda pergunta condicionada a CPF",
            resultado_obtido: "não encontrada",
            severidade: "media",
        });
    } else {
        await volume.selectOption({ label: ch.highVolumeOptions.SIM }).catch(() => undefined);
        await page.waitForTimeout(800);
        const cpfAlto = await leituraCanal(page);
        await volume.selectOption({ label: ch.highVolumeOptions.NAO }).catch(() => undefined);
        await page.waitForTimeout(800);
        const cpfBaixo = await leituraCanal(page);
        executado(info, SUB, "calculo");

        // T03 — os eixos precisam MUDAR alguma coisa; se as três respostas dão o mesmo número, o
        // seletor é decorativo e a promessa de "tabela por perfil" não se cumpre.
        const todosIguais =
            cpfAlto.anuncio !== null &&
            cpfAlto.anuncio === cpfBaixo.anuncio &&
            cpfBaixo.anuncio === comCnpj.anuncio &&
            comCnpj.anuncio === semPerfil.anuncio;
        if (todosIguais) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `As quatro combinações de perfil Shopee (vazio, CNPJ, CPF+alto volume, CPF+baixo) produzem o MESMO anúncio (R$ ${cpfAlto.anuncio?.toFixed(2)}) — o eixo não escolhe tabela nenhuma`,
                resultado_esperado:
                    "Perfis diferentes selecionam entradas diferentes do catálogo (FR-926)",
                resultado_obtido: `anúncio idêntico em todas: R$ ${cpfAlto.anuncio?.toFixed(2)}`,
                severidade: "alta",
            });
        }

        // T04 — a invariante do gross-up continua valendo em CADA perfil.
        for (const [nome, l] of [
            ["vazio", semPerfil],
            ["CNPJ", comCnpj],
            ["CPF alto volume", cpfAlto],
            ["CPF sem volume", cpfBaixo],
        ] as const) {
            executado(info, SUB, "calculo");
            if (l.anuncio !== null && l.varejo !== null && l.anuncio < l.varejo - 0.01) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "calculo",
                    descricao: `Perfil "${nome}": o anúncio (R$ ${l.anuncio.toFixed(2)}) ficou abaixo do preço varejo (R$ ${l.varejo.toFixed(2)})`,
                    resultado_esperado: "Anúncio sempre >= preço-base",
                    resultado_obtido: `R$ ${l.anuncio.toFixed(2)}`,
                    severidade: "critica",
                });
            }
        }
    }
    await varreduraDeSaude(page, info, SUB, "canal Shopee com perfil", { contraste: true });
});

// =====================================================================================
// CF-010 (resto) — a banda cujo fixo é uma REGRA: Shopee abaixo de R$ 8
// =====================================================================================
test("CF-010-UI-05 — taxa fixa como % do preço (Shopee abaixo de R$ 8): a legenda e a conta", async ({
    page,
}, info) => {
    const SUB = "CF-010-UI-05";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `banda-${info.workerIndex}`);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(1200);
    await escolherMarketplace(page, t.calculator.marketplaceNames.SHOPEE);

    // Empurra o preço-base para MUITO abaixo de R$ 8, onde a regra PCT_OF_PRICE governa.
    for (const [campo, valor] of [
        [t.calculator.fields.costPerRoll, "1,00"],
        [t.calculator.fields.grams, "1"],
        [t.calculator.fields.machineValue, "0"],
        [t.calculator.fields.markupRetail, "10"],
    ] as const) {
        const c = page.getByRole("textbox", { name: rotulo(campo) }).first();
        if (await c.isVisible().catch(() => false)) {
            await c.fill(valor);
            await c.blur();
        }
    }
    await page.waitForTimeout(1000);
    executado(info, SUB, "calculo");

    const l = await leituraCanal(page);
    const corpo = await page.locator("body").innerText();

    // A legenda que avisa que o número muda de faixa é o que impede o vendedor de ler um valor
    // resolvido como se fosse constante.
    const temLegenda =
        corpo.includes(ch.bandedFeesCaption) ||
        /faixa de preço|faixa do seu anúncio|% do anúncio/i.test(corpo);
    executado(info, SUB, "acolhimento");
    if (l.anuncio !== null && l.anuncio < 8 && !temLegenda) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: `Com o anúncio em R$ ${l.anuncio.toFixed(2)} (abaixo de R$ 8, onde a taxa fixa da Shopee é uma REGRA sobre o preço), a tela não avisa que o valor muda conforme a faixa`,
            resultado_esperado: `"${ch.bandedFeesCaption}" ou a legenda da regra de fixo`,
            resultado_obtido: "nenhuma legenda de faixa visível",
            severidade: "media",
        });
    }

    // A invariante não muda de regime: o anúncio nunca fica abaixo da base, e o líquido nunca acima.
    executado(info, SUB, "calculo");
    if (l.anuncio !== null && l.varejo !== null && l.anuncio < l.varejo - 0.01) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao: `No regime de fixo-por-regra, o anúncio (R$ ${l.anuncio.toFixed(2)}) ficou abaixo do preço varejo (R$ ${l.varejo.toFixed(2)})`,
            resultado_esperado: "Anúncio >= preço-base em todos os regimes de banda",
            resultado_obtido: `R$ ${l.anuncio.toFixed(2)}`,
            severidade: "critica",
        });
    }
    if (l.liquido !== null && l.varejo !== null && l.liquido > l.varejo + 0.02) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao: `No regime de fixo-por-regra, o líquido (R$ ${l.liquido.toFixed(2)}) ficou ACIMA do preço varejo (R$ ${l.varejo.toFixed(2)})`,
            resultado_esperado: "líquido <= preço-base",
            resultado_obtido: `R$ ${l.liquido.toFixed(2)}`,
            severidade: "alta",
        });
    }

    // Sobe o preço atravessando o limiar: o número da taxa fixa TEM de mudar de faixa.
    const markup = page
        .getByRole("textbox", { name: rotulo(t.calculator.fields.markupRetail) })
        .first();
    await markup.fill("5000");
    await markup.blur();
    await page.waitForTimeout(1000);
    const alto = await leituraCanal(page);
    executado(info, SUB, "calculo");
    if (l.anuncio !== null && alto.anuncio !== null && alto.anuncio <= l.anuncio) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao: `Multiplicar o markup por 500× não aumentou o preço de anúncio (R$ ${l.anuncio.toFixed(2)} → R$ ${alto.anuncio.toFixed(2)})`,
            resultado_esperado: "Preço-base maior ⇒ anúncio maior (monotonicidade)",
            resultado_obtido: `R$ ${alto.anuncio.toFixed(2)}`,
            severidade: "critica",
        });
    }
    await varreduraDeSaude(page, info, SUB, "canal Shopee abaixo do limiar de R$ 8");
});

// =====================================================================================
// CF-008 — a categoria do anúncio: a contagem que não pode mentir
// =====================================================================================
test("CF-008-UI-01 — categoria: contagem honesta, busca adversarial e limpar", async ({
    page,
}, info) => {
    const SUB = "CF-008-UI-01";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `cat-pick-${info.workerIndex}`);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(1200);
    executado(info, SUB, "gate_premium");

    const corpoInicial = await page.locator("body").innerText();
    if (!/categoria/i.test(corpoInicial)) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: "O canal padrão (Amazon) não oferece a escolha de categoria do anúncio",
            resultado_esperado: "Seletor de categoria, com a comissão dependendo dele",
            resultado_obtido: corpoInicial.slice(0, 200),
            severidade: "media",
        });
        return;
    }

    // Abre a navegação por todas as categorias.
    const verTodas = page
        .getByRole("button", { name: new RegExp(cp.browseToggle.replace("({n})", ""), "i") })
        .first();
    if (await verTodas.isVisible().catch(() => false)) {
        await verTodas.click();
        await page.waitForTimeout(800);
        executado(info, SUB, "fluxo");
    }

    const busca = page
        .getByRole("searchbox")
        .or(page.getByRole("textbox", { name: /categoria|busc|pesquis/i }));
    if ((await busca.count()) === 0) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao:
                "Não há campo de busca para encontrar a categoria — o vendedor precisa varrer a lista inteira",
            resultado_esperado:
                "Busca textual sobre as categorias (o dono pediu na rodada 1, ponto 10)",
            resultado_obtido: "campo de busca ausente",
            severidade: "media",
        });
    } else {
        // A CONTAGEM É O PONTO: dizer "8 encontradas" quando existem 31 manda o vendedor embora sem a
        // categoria certa dele — é o defeito que o 014 pagou para aprender.
        for (const termo of ["a", "casa", "ele", "ç", "🎉", "'; DROP TABLE", "z".repeat(120)]) {
            await busca.first().fill(termo);
            await page.waitForTimeout(700);
            executado(info, SUB, "input_invalido");
            const corpo = await page.locator("body").innerText();
            if (/NaN|\[object Object\]|Traceback|TypeError/.test(corpo)) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "input_invalido",
                    descricao: `Buscar categoria por "${termo.slice(0, 20)}" expôs valor cru de JS`,
                    resultado_esperado: "Texto do usuário tratado como texto",
                    resultado_obtido:
                        /NaN|\[object Object\]|Traceback|TypeError/.exec(corpo)?.[0] ?? "",
                    severidade: "alta",
                });
            }
            const m = /(\d+)\s+categorias?\s+encontradas?/i.exec(corpo);
            if (m) {
                const declarado = Number(m[1]);
                const opcoes = await page.getByRole("option").count();
                const botoes = await page
                    .getByRole("button", { name: /›|\//, exact: false })
                    .count();
                const exibidos = Math.max(opcoes, 0);
                if (
                    exibidos > 0 &&
                    declarado > exibidos &&
                    !/mostrando|mais de|primeiras/i.test(corpo)
                ) {
                    defeito(info, {
                        subcenario: SUB,
                        categoria: "acolhimento",
                        descricao: `A busca por "${termo}" declara ${declarado} categorias encontradas e exibe ${exibidos}, sem dizer que a lista está truncada`,
                        resultado_esperado:
                            "Ou exibe todas, ou diz explicitamente que está mostrando apenas parte",
                        resultado_obtido: `declarado=${declarado} exibido=${exibidos} (botões=${botoes})`,
                        severidade: "media",
                    });
                }
            }
        }
        await busca.first().fill("");
        await page.waitForTimeout(500);
    }

    const ov = await overflow(page);
    executado(info, SUB, "layout");
    if (ov.x > 1) {
        defeito(info, {
            subcenario: SUB,
            categoria: "layout",
            descricao: `O seletor de categorias rola ${ov.x}px na horizontal`,
            resultado_esperado: "Sem rolagem horizontal",
            resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
            severidade: "media",
        });
    }
    await varreduraDeSaude(page, info, SUB, "seletor de categoria", { contraste: true });
});

// =====================================================================================
// CF-025-UI-03 / CF-042 — a fila diante de 401 e de 403: nada pode ser destruído
// =====================================================================================
test("CF-025-UI-03 — sessão expira com a fila cheia: o registro FICA e a tela diz a causa certa", async ({
    page,
    context,
}, info) => {
    const SUB = "CF-025-UI-03";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await premium(page, `outbox-${info.workerIndex}`);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

    const registrar = page.getByRole("button", { name: h.saveAction }).first();
    if (!(await registrar.isVisible({ timeout: 20_000 }).catch(() => false))) return;

    // Registra OFFLINE: entra na fila.
    await offline(page, context);
    await page.waitForTimeout(500);
    await registrar.click();
    const folha = page.getByRole("dialog");
    if (await folha.isVisible().catch(() => false)) {
        await folha.getByRole("button", { name: h.saveSheetSubmit }).click();
        await page.waitForTimeout(1200);
    }
    executado(info, SUB, "rede");

    // A rede volta, MAS o servidor recusa a sessão (401) — o caso real de um token expirado.
    await page.route("**/api/v1/history**", (route) =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ code: "unauthenticated", detail: "token expirado" }),
        }),
    );
    await online(page, context);
    await page.waitForTimeout(3000);
    await page.goto("/historico");
    await page.waitForTimeout(2500);
    executado(info, SUB, "sessao");

    const corpo = await page.locator("body").innerText();

    // 1) O registro NÃO pode ter sido destruído — é a propriedade que o hotfix A3 existe para garantir.
    const aindaTemRegistro = /R\$/.test(corpo) || corpo.includes(h.syncPendingTitle);
    if (!aindaTemRegistro) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao:
                "Depois de um 401 na sincronização, o registro da fila DESAPARECEU da tela — um orçamento do vendedor foi perdido por uma sessão expirada",
            resultado_esperado:
                "401 NUNCA purga a fila (hotfix 016/A3): o registro continua no aparelho",
            resultado_obtido: corpo.trim().slice(0, 220),
            severidade: "critica",
        });
    }

    // 2) A causa dita tem de ser a VERDADEIRA: sessão, não rede.
    const dizSessao =
        /sessão expirou|sessao expirou|entrar de novo|entre de novo|entre novamente/i.test(corpo);
    const culpaARede = /sem conexão|sem conexao|offline/i.test(corpo);
    executado(info, SUB, "acolhimento");
    if (!dizSessao) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: culpaARede
                ? "Com a sessão expirada (401), a tela culpa a CONEXÃO — que está intacta. O vendedor vai esperar a internet voltar para sempre."
                : "Com a sessão expirada (401), a tela não diz que o problema é a sessão",
            resultado_esperado: `"${h.queueUnauthenticated.replace("{n}", "1")}" e o caminho "${h.signInAction}"`,
            resultado_obtido: corpo.trim().slice(0, 240),
            severidade: "alta",
        });
    }

    // 3) Precisa existir caminho de volta.
    const temCaminho =
        (await page.getByRole("button", { name: new RegExp(h.signInAction, "i") }).count()) > 0 ||
        (await page.getByRole("link", { name: new RegExp(h.signInAction, "i") }).count()) > 0 ||
        /entrar de novo/i.test(corpo);
    executado(info, SUB, "sessao");
    if (!temCaminho) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao:
                'A tela não oferece nenhum "Entrar de novo" depois do 401 — o vendedor fica sem saída',
            resultado_esperado: `Ação "${h.signInAction}" visível`,
            resultado_obtido: corpo.trim().slice(0, 200),
            severidade: "alta",
        });
    }

    // 4) Nada de linguagem de máquina.
    if (/401|403|Unauthorized|Forbidden|token|JWT/i.test(corpo)) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: "A recusa por sessão expirada vazou termo técnico para a tela do vendedor",
            resultado_esperado: "Mensagem em pt-BR, sem código HTTP nem 'token'",
            resultado_obtido: /401|403|Unauthorized|Forbidden|token|JWT/i.exec(corpo)?.[0] ?? "",
            severidade: "media",
        });
    }
    await varreduraDeSaude(page, info, SUB, "histórico após 401 na fila");
});

test("CF-042-UI-02 — 403 na sincronização: o registro fica BLOQUEADO e visível, nunca apagado", async ({
    page,
    context,
}, info) => {
    const SUB = "CF-042-UI-02";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await premium(page, `blocked-${info.workerIndex}`);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    const registrar = page.getByRole("button", { name: h.saveAction }).first();
    if (!(await registrar.isVisible({ timeout: 20_000 }).catch(() => false))) return;

    await offline(page, context);
    await page.waitForTimeout(500);
    await registrar.click();
    const folha = page.getByRole("dialog");
    if (await folha.isVisible().catch(() => false)) {
        await folha.getByRole("button", { name: h.saveSheetSubmit }).click();
        await page.waitForTimeout(1200);
    }
    executado(info, SUB, "rede");

    // O servidor aceita a sessão mas RECUSA a escrita — o caso do Premium que lapsou entre o
    // registro e a sincronização.
    await page.route("**/api/v1/history**", (route) =>
        route.fulfill({
            status: 403,
            contentType: "application/json",
            body: JSON.stringify({ code: "entitlement_required", detail: "premium inativo" }),
        }),
    );
    await online(page, context);
    await page.waitForTimeout(3000);
    await page.goto("/historico");
    await page.waitForTimeout(2500);
    executado(info, SUB, "gate_premium");

    const corpo = await page.locator("body").innerText();
    const sumiu = !/R\$/.test(corpo) && !corpo.includes(h.syncPendingTitle);
    if (sumiu) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao:
                "Depois de um 403 na sincronização, o registro da fila desapareceu — um orçamento foi perdido porque o plano lapsou",
            resultado_esperado: "Registro RETIDO e visível, marcado como bloqueado (ADR-0018)",
            resultado_obtido: corpo.trim().slice(0, 220),
            severidade: "critica",
        });
    }
    const explicou = /premium|plano|reativ|assinar|pausad/i.test(corpo);
    executado(info, SUB, "acolhimento");
    if (!explicou) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao:
                "Com a escrita recusada por falta de Premium, a tela não explica que a causa é o plano",
            resultado_esperado: "Causa dita em pt-BR, com o caminho de reativação",
            resultado_obtido: corpo.trim().slice(0, 240),
            severidade: "alta",
        });
    }
    await varreduraDeSaude(page, info, SUB, "histórico após 403 na fila");
});

// =====================================================================================
// CF-024 — a referência apagada: a linha degrada, não some nem quebra
// =====================================================================================
test("CF-024-UI-01 — apagar do catálogo a peça de um kit salvo: a linha degrada de forma honesta", async ({
    page,
}, info) => {
    const SUB = "CF-024-UI-01";
    // V1 de propósito. Acima de 1280px o 018 mudou o COMPORTAMENTO do card: clicar SELECIONA na ficha
    // à direita em vez de NAVEGAR, e a ficha apenas resume kits e produtos (o editor segue em página
    // cheia). Rodando a 1440 eu lia a tela do catálogo achando que lia o compositor, e reportei duas
    // vezes um defeito que era a largura errada.
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await premium(page, `degrada-${info.workerIndex}`);

    // Monta e salva um kit — salvar MATERIALIZA a peça como produto do catálogo (ADR-0017).
    await page.goto("/kits");
    await page.waitForTimeout(1500);
    const adicionar = page.getByRole("button", { name: rotulo(t.bom.addLine) }).first();
    if (!(await adicionar.isVisible({ timeout: 20_000 }).catch(() => false))) return;
    await adicionar.click();
    await page.waitForTimeout(500);

    const nomePeca = `Peça Degrada ${info.workerIndex}`;
    const campoPeca = page.getByRole("textbox", { name: rotulo(t.bom.pieceName) }).first();
    if (await campoPeca.isVisible().catch(() => false)) await campoPeca.fill(nomePeca);
    const nomeKit = `Kit Degrada ${info.workerIndex}`;
    await page.getByRole("textbox", { name: rotulo(t.bom.kitName) }).fill(nomeKit);
    await page.getByRole("button", { name: t.bom.save, exact: true }).click();
    await page.waitForTimeout(2500);
    executado(info, SUB, "fluxo");

    const totalAntes = await page.locator("body").innerText();
    const tinhaPreco = /R\$/.test(totalAntes);

    // Apaga o produto materializado do catálogo.
    await page.goto("/catalogo?tab=products");
    await page.waitForTimeout(2000);
    const remover = page
        .getByRole("button", { name: new RegExp(`${t.catalog.remove}`, "i") })
        .first();
    executado(info, SUB, "fluxo");
    if (!(await remover.isVisible().catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao:
                "Não há ação de excluir produto no catálogo para exercer a degradação da referência",
            resultado_esperado: `Ação "${t.catalog.remove}" por item`,
            resultado_obtido: (await page.locator("body").innerText()).slice(0, 200),
            severidade: "media",
        });
        return;
    }
    await remover.click();
    await page.waitForTimeout(600);
    const confirmar = page
        .getByRole("dialog")
        .getByRole("button", { name: t.catalogForm.deleteConfirm, exact: true });
    if (await confirmar.isVisible().catch(() => false)) {
        await confirmar.click();
        await page.waitForTimeout(2000);
    }
    executado(info, SUB, "fluxo");

    // Reabre o kit: a linha tem de continuar existindo, marcada como avulsa.
    await page.goto("/catalogo?tab=kits");
    await page.waitForTimeout(2000);
    const cartao = page.getByText(nomeKit).first();
    if (!(await cartao.isVisible().catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: `Apagar a peça do catálogo fez o KIT "${nomeKit}" desaparecer da lista`,
            resultado_esperado: "O kit sobrevive; só a linha degrada (ADR-0017 §6)",
            resultado_obtido: (await page.locator("body").innerText()).slice(0, 220),
            severidade: "critica",
        });
        return;
    }
    await cartao.click();
    await page.waitForTimeout(2500);
    executado(info, SUB, "calculo");

    const depois = await page.locator("body").innerText();
    if (depois.trim().length < 40) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: "Reabrir o kit cuja peça foi apagada deixou a tela em branco",
            resultado_esperado: "Kit renderizado com a linha degradada",
            resultado_obtido: "corpo vazio",
            severidade: "critica",
        });
        return;
    }
    if (/NaN|\[object Object\]|Traceback|TypeError|undefined/.test(depois)) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: "Reabrir o kit com a referência apagada expôs valor cru de JS",
            resultado_esperado: "Degradação em tempo de leitura, silenciosa e honesta",
            resultado_obtido:
                /NaN|\[object Object\]|Traceback|TypeError|undefined/.exec(depois)?.[0] ?? "",
            severidade: "critica",
        });
    }
    const declarou =
        depois.includes(t.bom.lineAdhoc) || /avulsa|não está mais|removid|excluíd/i.test(depois);
    executado(info, SUB, "acolhimento");
    if (!declarou) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: `A linha do kit cuja peça foi apagada do catálogo não se declara "${t.bom.lineAdhoc}" — o vendedor não sabe que a referência sumiu`,
            resultado_esperado: `Legenda "${t.bom.lineAdhoc}" na linha degradada (ADR-0017 §6)`,
            resultado_obtido: depois.trim().slice(0, 240),
            severidade: "media",
        });
    }
    if (tinhaPreco && !/R\$/.test(depois)) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao: "Depois de apagar a peça do catálogo, o kit reaberto perdeu TODOS os preços",
            resultado_esperado:
                "A linha degradada mantém o último valor conhecido e o kit segue somando",
            resultado_obtido: depois.trim().slice(0, 220),
            severidade: "alta",
        });
    }
    await varreduraDeSaude(page, info, SUB, "kit com referência apagada", { contraste: true });
});
