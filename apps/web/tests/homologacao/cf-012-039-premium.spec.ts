import { expect, test, type Page } from "@playwright/test";

import {
    aplicarSubcenario,
    culpadosDoOverflow,
    defeito,
    executado,
    falhaDeServidor,
    offline,
    online,
    overflow,
    premium,
    rotulo,
    t,
    varreduraDeSaude,
} from "./_harness";

// CF-012 · CF-015 · CF-018 · CF-025 · CF-026 · CF-035..CF-039 — os fluxos que só existem com
// Premium. Os seletores usados aqui são os MESMOS que a suíte e2e do projeto já exercita
// (`tests/e2e/catalog.spec.ts`, `history-helpers.ts`), para que um vermelho seja do produto e não
// de um seletor inventado por esta homologação.

async function criarFilamento(page: Page, nome: string, custo = "110", peso = "1"): Promise<void> {
    await page.getByRole("button", { name: t.catalog.addFilament }).click();
    await page.getByRole("textbox", { name: t.catalogForm.name }).fill(nome);
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
        .fill(custo);
    await page
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.rollWeight) })
        .fill(peso);
    await page.getByRole("button", { name: t.catalogForm.save, exact: true }).click();
}

// =====================================================================================
// CF-015 / CF-018 — catálogo de filamentos: vazio, criação, lixo, duplicados e muitos itens
// =====================================================================================
test("CF-015-UI-01/02/03 — filamentos: estado vazio, criação, entradas absurdas e 30 itens", async ({
    page,
}, info) => {
    const SUB = "CF-015-UI-02";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `cat-${info.workerIndex}`);
    await page.goto("/catalogo");
    await expect(page.getByRole("tab", { name: t.catalog.tabFilaments })).toBeVisible({
        timeout: 20_000,
    });
    executado(info, SUB, "gate_premium");

    // T01 — o estado VAZIO precisa ensinar, não só informar (o vendedor leigo chega aqui primeiro).
    const vazio = await page.locator("body").innerText();
    if (!/adicionar|criar|comece|primeiro/i.test(vazio)) {
        defeito(info, {
            subcenario: "CF-015-UI-01",
            categoria: "acolhimento",
            descricao: "O catálogo vazio de um Premium não diz ao vendedor o que fazer em seguida",
            resultado_esperado:
                "Estado vazio com uma ação clara (ex.: adicionar o primeiro filamento)",
            resultado_obtido: vazio.trim().slice(0, 200),
            severidade: "media",
        });
    }
    executado(info, SUB, "acolhimento");

    // T02 — criação simples funciona de ponta a ponta (servidor real).
    await criarFilamento(page, "PLA Azul");
    await expect
        .soft(page.getByText("PLA Azul").first(), "CF-015/T02 filamento criado")
        .toBeVisible();
    executado(info, SUB, "crud");

    // T03 — NOME DUPLICADO: o produto aceita ou explica, mas nunca some em silêncio.
    await criarFilamento(page, "PLA Azul");
    await page.waitForTimeout(600);
    const quantosDup = await page.getByText("PLA Azul").count();
    executado(info, SUB, "estresse_de_dados");
    if (quantosDup < 2) {
        const corpo = await page.locator("body").innerText();
        if (!/já existe|ja existe|duplicad|mesmo nome/i.test(corpo)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "crud",
                descricao:
                    "Salvar um filamento com nome duplicado não criou o item nem explicou por quê",
                resultado_esperado: "Ou cria o segundo item, ou diz que o nome já existe",
                resultado_obtido: `${quantosDup} item(ns) com o nome e nenhuma mensagem sobre duplicidade`,
                severidade: "media",
            });
        }
    }

    // T04..T08 — nome adversarial: gigante, emoji, só espaços, script, acentos.
    const adversariais = [
        { nome: "N".repeat(500), nota: "500 caracteres" },
        { nome: "🎉🎊🎈", nota: "só emoji" },
        { nome: "   ", nota: "só espaços" },
        { nome: "<img src=x onerror=window.__xss=1>", nota: "html injetado" },
        { nome: "Filamento ção ÀÉÎÕÜ", nota: "acentuação" },
    ];
    for (const a of adversariais) {
        await criarFilamento(page, a.nome);
        await page.waitForTimeout(500);
        executado(info, SUB, "input_invalido");
        const corpo = await page.locator("body").innerText();
        if (/NaN|\[object Object\]|undefined|Traceback|TypeError/.test(corpo)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "input_invalido",
                descricao: `Nome "${a.nota}" fez a tela do catálogo expor valor cru de JS`,
                resultado_esperado: "Mensagem em pt-BR ou aceitação silenciosa e correta",
                resultado_obtido:
                    /NaN|\[object Object\]|undefined|Traceback|TypeError/.exec(corpo)?.[0] ?? "",
                severidade: "alta",
            });
        }
        // Fecha qualquer folha que tenha ficado aberta (o "só espaços" deve ser recusado).
        await page.keyboard.press("Escape").catch(() => undefined);
    }
    const xss = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss === 1);
    executado(info, SUB, "seguranca");
    if (xss) {
        defeito(info, {
            subcenario: SUB,
            categoria: "seguranca",
            descricao: "HTML digitado pelo vendedor no nome do filamento foi EXECUTADO pela página",
            resultado_esperado: "Conteúdo do usuário é sempre texto, nunca markup executável",
            resultado_obtido: "window.__xss foi definido pelo payload",
            severidade: "critica",
        });
    }

    // T09 — nome gigante não pode estourar a largura da lista.
    const ov = await overflow(page);
    executado(info, SUB, "layout");
    if (ov.x > 1) {
        defeito(info, {
            subcenario: SUB,
            categoria: "layout",
            descricao: `A lista do catálogo rola ${ov.x}px na horizontal com um nome de 500 caracteres`,
            resultado_esperado: "Nome longo trunca ou quebra dentro do card",
            resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
            severidade: "media",
        });
    }

    await varreduraDeSaude(page, info, SUB, "catálogo com itens adversariais", { contraste: true });

    // T10..T12 — busca: contagem exibida tem de bater com o que está na tela (classe 014).
    const busca = page
        .getByRole("searchbox")
        .or(page.getByRole("textbox", { name: /busc|pesquis/i }));
    if ((await busca.count()) > 0) {
        await busca.first().fill("PLA");
        await page.waitForTimeout(600);
        executado(info, "CF-018-UI-01", "estresse_de_dados");
        const corpo = await page.locator("body").innerText();
        const mContagem = /(\d+)\s+(encontrad|resultad|ite)/i.exec(corpo);
        if (mContagem) {
            const declarado = Number(mContagem[1]);
            const naTela = await page.getByText(/PLA/).count();
            if (declarado > naTela) {
                defeito(info, {
                    subcenario: "CF-018-UI-01",
                    categoria: "acolhimento",
                    descricao: `A busca declara ${declarado} resultado(s) mas mostra ${naTela} na tela`,
                    resultado_esperado: "A contagem exibida é a dos itens realmente exibidos",
                    resultado_obtido: `declarado=${declarado} exibido=${naTela}`,
                    severidade: "media",
                });
            }
        }
        // Busca adversarial não pode quebrar a tela.
        for (const termo of ["ç~^", "🎉", "A".repeat(300), ".*", "'; DROP TABLE"]) {
            await busca.first().fill(termo);
            await page.waitForTimeout(350);
            executado(info, "CF-018-UI-02", "input_invalido");
            if ((await page.locator("body").innerText()).trim().length < 20) {
                defeito(info, {
                    subcenario: "CF-018-UI-02",
                    categoria: "estabilidade",
                    descricao: `Buscar por "${termo.slice(0, 20)}" deixou a tela em branco`,
                    resultado_esperado: "Lista vazia com mensagem, nunca tela branca",
                    resultado_obtido: "corpo vazio",
                    severidade: "critica",
                });
            }
        }
    }
});

// =====================================================================================
// CF-025 / CF-026 — registrar orçamento, online e offline, e o ledger
// =====================================================================================
test("CF-025/CF-026 — orçamento: registra online, registra offline e a fila é honesta", async ({
    page,
    context,
}, info) => {
    const SUB = "CF-025-UI-01";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await premium(page, `hist-${info.workerIndex}`);
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

    // T01 — o botão de registrar existe para um Premium.
    const registrar = page.getByRole("button", { name: t.history.saveAction });
    const temRegistrar = await registrar
        .first()
        .isVisible()
        .catch(() => false);
    executado(info, SUB, "fluxo");
    if (!temRegistrar) {
        defeito(info, {
            subcenario: SUB,
            categoria: "gate_premium",
            descricao:
                "Um vendedor Premium não encontra a ação de registrar o orçamento na calculadora",
            resultado_esperado: `Botão "${t.history.saveAction}" visível`,
            resultado_obtido: "não encontrado",
            severidade: "alta",
        });
        return;
    }

    // T02 — registro ONLINE de ponta a ponta.
    await registrar.first().click();
    const folha = page.getByRole("dialog");
    await expect.soft(folha, `${SUB}/T02 folha de registro abre`).toBeVisible();
    await folha.getByRole("button", { name: t.history.saveSheetSubmit }).click();
    await page.waitForTimeout(1200);
    executado(info, SUB, "fluxo");

    await page.goto("/historico");
    await page.waitForTimeout(1200);
    const ledger = await page.locator("body").innerText();
    executado(info, "CF-026-UI-03", "fluxo");
    if (!/R\$/.test(ledger)) {
        defeito(info, {
            subcenario: "CF-026-UI-03",
            categoria: "fluxo",
            descricao:
                "Depois de registrar um orçamento, a aba Orçamentos não mostra nenhum registro",
            resultado_esperado: "O registro recém-criado aparece na lista",
            resultado_obtido: ledger.trim().slice(0, 220),
            severidade: "alta",
        });
    }
    await varreduraDeSaude(page, info, "CF-026-UI-03", "ledger com um registro", { alvos: true });

    // T03..T05 — registro OFFLINE: entra na fila e o estado é dito em voz alta.
    await page.goto("/calcular");
    await offline(page, context);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: t.history.saveAction }).first().click();
    const folha2 = page.getByRole("dialog");
    if (await folha2.isVisible().catch(() => false)) {
        await folha2.getByRole("button", { name: t.history.saveSheetSubmit }).click();
        await page.waitForTimeout(1000);
        executado(info, "CF-025-UI-02", "rede");
        const corpo = await page.locator("body").innerText();
        if (!/pendente|sincroniz|offline|sem conexão|sem conexao|fila/i.test(corpo)) {
            defeito(info, {
                subcenario: "CF-025-UI-02",
                categoria: "acolhimento",
                descricao:
                    "Registrar um orçamento OFFLINE não informa que ele ficou pendente de sincronização",
                resultado_esperado:
                    "Estado 'pendente' dito ao vendedor, com a promessa de sincronizar sozinho",
                resultado_obtido: corpo.trim().slice(0, 220),
                severidade: "alta",
            });
        }
        // A fila não pode sumir ao voltar a rede: tem de virar sincronizada, não desaparecer.
        await online(page, context);
        await page.waitForTimeout(2500);
        await page.goto("/historico");
        await page.waitForTimeout(1500);
        executado(info, "CF-025-UI-02", "rede");
        const depois = await page.locator("body").innerText();
        if (!/R\$/.test(depois)) {
            defeito(info, {
                subcenario: "CF-025-UI-02",
                categoria: "fluxo",
                descricao: "O orçamento registrado offline desapareceu depois que a conexão voltou",
                resultado_esperado: "A fila sincroniza sozinha e o registro permanece visível",
                resultado_obtido: depois.trim().slice(0, 220),
                severidade: "critica",
            });
        }
    }
});

// =====================================================================================
// CF-035 / CF-036 / CF-037 — Conta: identidade, plano e a oferta até a borda do checkout
// =====================================================================================
test("CF-035/036/037 — Conta: identidade honesta, plano correto e oferta sem overflow", async ({
    page,
}, info) => {
    const SUB = "CF-036-UI-02";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    const email = await premium(page, `conta-${info.workerIndex}`);
    await page.goto("/conta");
    await page.waitForTimeout(1500);
    executado(info, SUB, "gate_premium");

    const corpo = await page.locator("body").innerText();

    // T01 — a identidade mostrada é a REAL, nunca um rótulo inventado.
    if (!corpo.includes(email)) {
        defeito(info, {
            subcenario: "CF-035-UI-01",
            categoria: "acolhimento",
            descricao: "A Conta não mostra o e-mail real da sessão",
            resultado_esperado: `Identidade "${email}" vinda do servidor`,
            resultado_obtido: corpo.trim().slice(0, 200),
            severidade: "media",
        });
    }
    executado(info, "CF-035-UI-01", "fluxo");

    // T02 — o plano de quem TEM concessão ativa precisa dizer Premium, nunca "gratuito".
    const dizPremium = /premium|ativo/i.test(corpo);
    const dizGratuito = /gratuito|grátis para sempre/i.test(corpo);
    if (!dizPremium || dizGratuito) {
        defeito(info, {
            subcenario: SUB,
            categoria: "gate_premium",
            descricao: "Com concessão ativa no ledger, a Conta não afirma o estado Premium",
            resultado_esperado:
                "Painel de plano dizendo Premium ativo (com validade, quando houver)",
            resultado_obtido: corpo.trim().slice(0, 250),
            severidade: "critica",
        });
    }
    executado(info, SUB, "gate_premium");

    await varreduraDeSaude(page, info, SUB, "Conta premium wide", { contraste: true });

    // T03..T06 — a oferta (?assinar=1): geometria e nada nascendo fora da viewport.
    for (const largura of [390, 1440]) {
        await page.setViewportSize({ width: largura, height: 900 });
        await page.goto("/conta?assinar=1");
        await page.waitForTimeout(1200);
        executado(info, "CF-037-UI-01", "layout");
        const ov = await overflow(page);
        if (ov.x > 1) {
            defeito(info, {
                subcenario: "CF-037-UI-01",
                categoria: "layout",
                descricao: `A folha de oferta rola ${ov.x}px na horizontal a ${largura}px`,
                resultado_esperado: "Oferta cabe na largura, em qualquer viewport suportada",
                resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
                severidade: "alta",
            });
        }
        const fora = await page.evaluate(() => {
            const vw = window.innerWidth;
            return Array.from(document.querySelectorAll("button,a[href]"))
                .filter((el) => {
                    const r = el.getBoundingClientRect();
                    return (r.width > 0 || r.height > 0) && (r.right > vw + 1 || r.left < -1);
                })
                .map((el) => `${el.tagName}[${(el.textContent ?? "").trim().slice(0, 24)}]`);
        });
        if (fora.length > 0) {
            defeito(info, {
                subcenario: "CF-037-UI-01",
                categoria: "layout",
                descricao: `${fora.length} controle(s) da oferta nascem fora da viewport a ${largura}px`,
                resultado_esperado: "Todo botão da oferta alcançável sem rolagem horizontal",
                resultado_obtido: fora.join(", "),
                severidade: "alta",
            });
        }
        await varreduraDeSaude(page, info, "CF-037-UI-01", `oferta a ${largura}px`, {
            contraste: true,
            alvos: largura === 390,
        });
    }

    // T07 — retorno do checkout: não pode AFIRMAR premium antes da confirmação.
    await page.goto("/conta?checkout=retorno");
    await page.waitForTimeout(1000);
    executado(info, "CF-038-UI-01", "acolhimento");
    await varreduraDeSaude(page, info, "CF-038-UI-01", "retorno de checkout");
});

// =====================================================================================
// CF-035-UI-02 — o servidor falha: a Conta admite que não sabe, e não inventa
// =====================================================================================
test("CF-035-UI-02 — com /me e /entitlement falhando, a Conta é honesta e oferece retentativa", async ({
    page,
}, info) => {
    const SUB = "CF-035-UI-02";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `erro-${info.workerIndex}`);

    await falhaDeServidor(page, "**/api/v1/me", 500);
    await falhaDeServidor(page, "**/api/v1/entitlement", 500);
    await page.goto("/conta");
    await page.waitForTimeout(1500);
    executado(info, SUB, "rede");

    const corpo = await page.locator("body").innerText();
    if (corpo.trim().length < 20) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: "Com o servidor falhando, a Conta fica em branco",
            resultado_esperado: "Mensagem honesta com caminho de retentativa",
            resultado_obtido: "corpo vazio",
            severidade: "critica",
        });
    }
    const temRetentativa = await page
        .getByRole("button", { name: /tentar|atualizar|recarregar/i })
        .first()
        .isVisible()
        .catch(() => false);
    if (!temRetentativa) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao:
                "Com o servidor falhando, a Conta não oferece nenhum botão de tentar de novo",
            resultado_esperado: "Um caminho de volta explícito para o usuário leigo",
            resultado_obtido: corpo.trim().slice(0, 220),
            severidade: "media",
        });
    }
    executado(info, SUB, "acolhimento");
    await varreduraDeSaude(page, info, SUB, "Conta com servidor falhando");
});

// =====================================================================================
// CF-012 — "Usar do catálogo": o prefill do Premium
// =====================================================================================
test("CF-012-UI-01 — usar do catálogo preenche os campos com os valores salvos", async ({
    page,
}, info) => {
    const SUB = "CF-012-UI-01";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `pref-${info.workerIndex}`);

    await page.goto("/catalogo");
    await expect(page.getByRole("tab", { name: t.catalog.tabFilaments })).toBeVisible({
        timeout: 20_000,
    });
    await criarFilamento(page, "PETG Preto", "180", "1");
    await page.waitForTimeout(800);

    await page.goto("/calcular");
    // "Usar do catálogo" e o TITULO da seção; o controle é um combobox por tipo de item
    // (`messages.catalogPicker.filament`). Procurar um botão com o título da seção reportou, na
    // primeira rodada, que "o Premium não encontra a ação" — a ação existe, com outro papel.
    const seletor = page.getByRole("combobox", { name: t.catalogPicker.filament }).first();
    executado(info, SUB, "fluxo");
    if (!(await seletor.isVisible({ timeout: 15_000 }).catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "gate_premium",
            descricao:
                'Um Premium com filamento salvo não vê o seletor "Filamento salvo" na calculadora',
            resultado_esperado:
                "Combobox de item salvo visível para conta com entitlement ativo e itens",
            resultado_obtido: "combobox ausente após 15s",
            severidade: "alta",
        });
        return;
    }
    await seletor.selectOption({ label: "PETG Preto" }).catch(async () => {
        await seletor.click();
        await page.getByText("PETG Preto").first().click();
    });
    await page.waitForTimeout(800);
    executado(info, SUB, "fluxo");
    const custo = await page
        .getByRole("textbox", { name: rotulo(t.calculator.fields.costPerRoll) })
        .first()
        .inputValue();
    const normalizado = custo.replace(/\./g, "").replace(",", ".");
    if (Math.abs(Number(normalizado) - 180) > 0.01) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao: "Preencher pelo catálogo não trouxe o custo do rolo salvo",
            resultado_esperado: "Custo do rolo = 180,00 (byte-idêntico ao item salvo, SC-305)",
            resultado_obtido: custo,
            severidade: "alta",
        });
    }
    await varreduraDeSaude(page, info, SUB, "calculadora após prefill do catálogo");
});
