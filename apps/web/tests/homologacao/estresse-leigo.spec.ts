import { expect, test, type Page } from "@playwright/test";

import {
    aplicarSubcenario,
    culpadosDoOverflow,
    defeito,
    executado,
    overflow,
    rotulo as rotuloRe,
    t,
    varreduraDeSaude,
} from "./_harness";
import { ERROS_DE_UNIDADE, FORMATOS_REAIS, PERSONAS, TEMPOS_REAIS } from "./_leigo";

// A bateria do USUÁRIO LEIGO. Volume alto, mas cada caso é uma coisa que um vendedor de verdade
// faz. A pergunta que governa o arquivo não é "o produto quebrou?" — é "o produto AVISOU?".
//
// Um preço 1000× errado entregue com cara de preço correto é o pior defeito possível aqui, e é
// invisível para qualquer teste de tipo, de schema ou de renderização.

const BASE: { campo: string; valor: string }[] = [
    { campo: t.calculator.fields.costPerRoll, valor: "100,00" },
    { campo: t.calculator.fields.rollWeight, valor: "1" },
    { campo: t.calculator.fields.grams, valor: "100" },
    { campo: t.calculator.fields.avgPower, valor: "0,12" },
    { campo: t.calculator.fields.tariff, valor: "1,00" },
    { campo: t.calculator.fields.machineValue, valor: "4.000,00" },
    { campo: t.calculator.fields.maintenance, valor: "0" },
    { campo: t.calculator.fields.failure, valor: "0" },
    { campo: t.calculator.fields.markupVarejo, valor: "50" },
    { campo: t.calculator.fields.markupAtacado, valor: "30" },
];

function brl(s: string): number {
    return Number(s.replace(/\./g, "").replace(",", "."));
}

async function preco(page: Page): Promise<number | null> {
    const texto = await page.locator("body").innerText();
    const m = new RegExp(
        `${t.calculator.results.custoTotal}[\\s\\S]{0,40}?R\\$\\s*(-?[\\d.]+,\\d{2})`,
        "i",
    ).exec(texto);
    return m ? brl(m[1]) : null;
}

async function digitar(page: Page, rotulo: string, valor: string): Promise<boolean> {
    const c = page.getByRole("textbox", { name: rotuloRe(rotulo) }).first();
    if (!(await c.isVisible().catch(() => false))) return false;
    await c.fill(valor).catch(() => undefined);
    await c.blur().catch(() => undefined);
    return true;
}

async function aplicarBase(page: Page): Promise<void> {
    for (const b of BASE) await digitar(page, b.campo, b.valor);
    await page.waitForTimeout(120);
}

/** O produto disse ALGUMA coisa sobre o número — aviso, alerta, mensagem, tooltip aberto? */
async function houveAviso(page: Page): Promise<string | null> {
    const texto = await page.locator("body").innerText();
    const padroes = [
        /confir[ma]|tem certeza|parece (alto|baixo|estranho)|verifique|atenção|atencao/i,
        new RegExp(t.calculator.validation.invalid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        new RegExp(t.calculator.validation.negative.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        new RegExp(t.calculator.validation.tooHigh.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        new RegExp(t.calculator.rollWeightError.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    ];
    for (const p of padroes) {
        const m = p.exec(texto);
        if (m) return m[0];
    }
    return null;
}

// =====================================================================================
// A — ERRO DE UNIDADE: o defeito que entrega preço errado sem errar nada
// =====================================================================================
test("LEIGO-A — erro de unidade: o produto avisa quando o preço muda de ordem de grandeza?", async ({
    page,
}, info) => {
    const SUB = "CF-001-LEIGO-A";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

    for (const erro of ERROS_DE_UNIDADE) {
        // 1) o valor CERTO, para ter a referência da própria tela
        await aplicarBase(page);
        if (!(await digitar(page, erro.campo, erro.correto))) continue;
        await page.waitForTimeout(180);
        const certo = await preco(page);
        executado(info, SUB, "usuario_leigo");

        // 2) o valor que o vendedor REALMENTE digita
        await digitar(page, erro.campo, erro.digitado);
        await page.waitForTimeout(220);
        const errado = await preco(page);
        const aviso = await houveAviso(page);
        executado(info, SUB, "usuario_leigo");

        if (certo === null || errado === null || certo <= 0) continue;

        const fator = errado / certo;
        // Ordem de grandeza: 10× para cima ou para baixo já é um preço que o vendedor não reconhece.
        const mudouDeOrdem = fator >= 10 || fator <= 0.1;
        if (mudouDeOrdem && aviso === null) {
            defeito(info, {
                subcenario: SUB,
                categoria: "acolhimento",
                descricao: `"${erro.campo}": digitar ${erro.digitado} em vez de ${erro.correto} muda o custo de R$ ${certo.toFixed(2)} para R$ ${errado.toFixed(2)} (${fator.toFixed(0)}×) SEM nenhum aviso. Motivo do erro: ${erro.porque}`,
                resultado_esperado:
                    "Um aviso de plausibilidade quando o número informado leva o preço para outra ordem de grandeza — o vendedor leigo não tem como perceber sozinho",
                resultado_obtido: `custo total R$ ${errado.toFixed(2)}, apresentado como um preço normal`,
                severidade: "alta",
                evidencia: `campo=${erro.campo} certo=${erro.correto} digitado=${erro.digitado} fator=${fator.toFixed(1)}`,
            });
        }
    }
    await varreduraDeSaude(page, info, SUB, "calculadora após erros de unidade");
});

// =====================================================================================
// B — FORMATAÇÃO: o mesmo número, do jeito que cada pessoa digita
// =====================================================================================
test("LEIGO-B — formatação: '1,000' e '1.000' significam mil para o vendedor. E para o produto?", async ({
    page,
}, info) => {
    const SUB = "CF-001-LEIGO-B";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

    const campos = [
        t.calculator.fields.costPerRoll,
        t.calculator.fields.grams,
        t.calculator.fields.tariff,
        t.calculator.fields.markupVarejo,
    ];

    for (const campo of campos) {
        for (const f of FORMATOS_REAIS) {
            await aplicarBase(page);
            await digitar(page, campo, f.valor);
            await page.waitForTimeout(160);
            executado(info, SUB, "input_invalido");

            const corpo = await page.locator("body").innerText();
            if (/NaN|Infinity|\[object Object\]/.test(corpo)) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "input_invalido",
                    descricao: `"${campo}" com "${f.valor}" (${f.nota}) exibiu valor cru de JS`,
                    resultado_esperado: "Número interpretado, ou mensagem em pt-BR",
                    resultado_obtido: /NaN|Infinity|\[object Object\]/.exec(corpo)?.[0] ?? "",
                    severidade: "alta",
                });
            }

            // RETRATADO em 2026-08-13, e o motivo importa mais que o achado.
            //
            // Esta bateria acusava `1,000` lido como 1 como defeito ALTA — "ele copiou mil de um site em
            // inglês". A correção foi escrita, e o gate do projeto a derrubou: `"1,000" → "1.000"` está
            // PINADO em `decimal-ptbr.test.ts` porque neste produto `1,000` é um rolo de 1 kg gravado com
            // TRÊS CASAS, e a identidade byte a byte dessa folha é o SC-305 (catálogo → produto → kit).
            // Medido no gate: um fixture virou `'100000'` onde esperava `'100.000'`.
            //
            // Ou seja: "consertar" isto transformaria todo rolo de 1 kg em 1000 kg — o mesmo defeito que
            // esta bateria existe para achar, ao contrário e muito pior. A verificação fica desligada e o
            // comentário fica, para ninguém reabrir o achado sem ler o que ele custa.
            const RETRATADO_VER_SC305 = false;
            if (
                RETRATADO_VER_SC305 &&
                f.valor === "1,000" &&
                campo === t.calculator.fields.costPerRoll
            ) {
                const p = await preco(page);
                const aviso = await houveAviso(page);
                // 1000 no custo do rolo ⇒ material 100,00; 1 ⇒ material 0,10. A diferença é gritante.
                if (p !== null && p < 10 && aviso === null) {
                    defeito(info, {
                        subcenario: SUB,
                        categoria: "acolhimento",
                        descricao: `"1,000" (mil, no formato que sites em inglês usam) foi lido como 1 em "${campo}", sem aviso — o custo caiu para R$ ${p.toFixed(2)}`,
                        resultado_esperado:
                            "Interpretar como 1000 ou avisar que o separador foi lido como decimal",
                        resultado_obtido: `custo total R$ ${p.toFixed(2)}`,
                        severidade: "alta",
                    });
                }
            }
        }
    }
    await varreduraDeSaude(page, info, SUB, "calculadora após formatos reais");
});

// =====================================================================================
// C — TEMPO: o campo que mais confunde num produto de impressão 3D
// =====================================================================================
test("LEIGO-C — tempo de impressão: relógio, decimal e minutos no campo de horas", async ({
    page,
}, info) => {
    const SUB = "CF-002-LEIGO-C";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await aplicarBase(page);

    const horas = page.getByRole("textbox", { name: t.calculator.timeInput.hoursAria });
    const minutos = page.getByRole("textbox", { name: t.calculator.timeInput.minutesAria });

    // Referência: 2h30 informado corretamente.
    await horas.fill("2");
    await minutos.fill("30");
    await minutos.blur();
    await page.waitForTimeout(200);
    const referencia = await preco(page);
    executado(info, SUB, "usuario_leigo");

    for (const caso of TEMPOS_REAIS) {
        // Ordem importa e a primeira versão errou nela: preencher MINUTOS depois de um formato de
        // relógio ("2:30") disparava `commit(h, 0)` e apagava os 30 que o relógio tinha acabado de
        // colocar — o produto convertia certo e o teste desfazia. Num formato de relógio o campo de
        // minutos não é tocado, que é como a pessoa realmente faz.
        const ehRelogio = caso.horas.includes(":") || /h/i.test(caso.horas);
        if (!ehRelogio) await minutos.fill(caso.minutos).catch(() => undefined);
        await horas.fill(caso.horas).catch(() => undefined);
        await horas.blur().catch(() => undefined);
        await page.waitForTimeout(200);
        executado(info, SUB, "usuario_leigo");

        const p = await preco(page);
        const aviso = await houveAviso(page);
        const corpo = await page.locator("body").innerText();

        if (/NaN|Infinity|\[object Object\]/.test(corpo)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "input_invalido",
                descricao: `Tempo "${caso.horas}h ${caso.minutos}min" (${caso.nota}) exibiu valor cru de JS`,
                resultado_esperado: "Conversão correta ou mensagem em pt-BR",
                resultado_obtido: /NaN|Infinity|\[object Object\]/.exec(corpo)?.[0] ?? "",
                severidade: "alta",
            });
            continue;
        }

        // "150" no campo de horas = o vendedor querendo dizer 150 MINUTOS (2h30).
        if (caso.nota.includes("MINUTOS") && p !== null && referencia !== null && referencia > 0) {
            const fator = p / referencia;
            if (fator >= 10 && aviso === null) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "acolhimento",
                    descricao: `Digitar 150 no campo de HORAS (o vendedor quis dizer 150 minutos) multiplica o custo por ${fator.toFixed(0)}× sem nenhum aviso`,
                    resultado_esperado:
                        "Aviso de plausibilidade para uma impressão de 150 horas (mais de 6 dias)",
                    resultado_obtido: `custo total R$ ${p.toFixed(2)}, sem comentário`,
                    severidade: "alta",
                });
            }
        }

        // Formatos de relógio: se não são aceitos, precisam ser DITOS.
        if ((caso.horas.includes(":") || caso.horas.includes("h")) && aviso === null) {
            const aceitou = p !== null && referencia !== null && Math.abs(p - referencia) < 0.01;
            if (!aceitou) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "acolhimento",
                    descricao: `O formato "${caso.horas}" (${caso.nota}) não foi aceito nem explicado — o campo simplesmente não reage`,
                    resultado_esperado:
                        'Aceitar o formato de relógio ou dizer "use horas e minutos separados"',
                    resultado_obtido: "nenhuma mensagem e nenhum efeito no preço",
                    severidade: "media",
                });
            }
        }
    }
    await varreduraDeSaude(page, info, SUB, "campo de tempo após entradas reais");
});

// =====================================================================================
// D — PERSONAS: seis vendedores reais preenchendo a calculadora inteira
// =====================================================================================
for (const persona of PERSONAS) {
    test(`LEIGO-D/${persona.id} — "${persona.nome}" preenche a calculadora inteira`, async ({
        page,
    }, info) => {
        const SUB = `CF-001-LEIGO-D-${persona.id}`;
        await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
        await page.goto("/calcular");
        await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

        await aplicarBase(page);
        const referencia = await preco(page);

        for (const e of persona.entradas) {
            const achou = await digitar(page, e.campo, e.valor);
            executado(info, SUB, "usuario_leigo");
            if (!achou) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "fluxo",
                    descricao: `A persona "${persona.nome}" não encontrou o campo "${e.campo}" na tela`,
                    resultado_esperado: "Todo campo do modelo é alcançável na calculadora",
                    resultado_obtido: "campo não visível",
                    severidade: "media",
                });
            }
            await page.waitForTimeout(90);
        }
        await page.waitForTimeout(300);

        const corpo = await page.locator("body").innerText();
        const p = await preco(page);
        executado(info, SUB, "usuario_leigo");

        // 1) Nunca vira lixo de máquina.
        if (/NaN|Infinity|\[object Object\]|Traceback|TypeError/.test(corpo)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "estabilidade",
                descricao: `A persona "${persona.nome}" (${persona.historia}) fez a tela exibir valor cru de JS`,
                resultado_esperado: "Sempre um número em R$ ou uma mensagem em pt-BR",
                resultado_obtido:
                    /NaN|Infinity|\[object Object\]|Traceback|TypeError/.exec(corpo)?.[0] ?? "",
                severidade: "critica",
            });
        }

        // 2) O caso "zera tudo": custo 0 e preço 0 são matematicamente certos e comercialmente
        //    absurdos. O produto precisa dizer alguma coisa antes de o vendedor anunciar por R$ 0,00.
        if (persona.id === "P5" && p !== null && p === 0) {
            const aviso = await houveAviso(page);
            if (aviso === null) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "acolhimento",
                    descricao:
                        "A persona que zera o que não entende chega a um custo total de R$ 0,00 e a um preço de venda de R$ 0,00 sem nenhum aviso",
                    resultado_esperado:
                        "Dizer que um preço zero não é vendável antes de entregá-lo",
                    resultado_obtido: "R$ 0,00 apresentado como um preço normal",
                    severidade: "alta",
                });
            }
        }

        // 3) Ordem de grandeza absurda entregue em silêncio.
        if (p !== null && referencia !== null && referencia > 0) {
            const fator = p / referencia;
            if (fator >= 100 && (await houveAviso(page)) === null) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "acolhimento",
                    descricao: `A persona "${persona.nome}" chega a um custo ${fator.toFixed(0)}× maior que o de referência (R$ ${p.toFixed(2)}) sem nenhum aviso de plausibilidade`,
                    resultado_esperado:
                        "Aviso quando o resultado sai da faixa que um vendedor reconheceria",
                    resultado_obtido: `custo total R$ ${p.toFixed(2)}`,
                    severidade: "alta",
                });
            }
        }

        // 4) O layout sobrevive aos números dela.
        const ov = await overflow(page);
        executado(info, SUB, "layout");
        if (ov.x > 1) {
            defeito(info, {
                subcenario: SUB,
                categoria: "layout",
                descricao: `Os valores da persona "${persona.nome}" geraram ${ov.x}px de rolagem horizontal`,
                resultado_esperado: "Número grande cabe ou quebra, sem rolagem horizontal",
                resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
                severidade: "media",
            });
        }
        await varreduraDeSaude(page, info, SUB, `calculadora com a persona ${persona.nome}`);
    });
}

// =====================================================================================
// E — JORNADAS: o que o leigo faz quando não entende o que está vendo
// =====================================================================================
test("LEIGO-E — jornadas reais: recarrega, volta, abre outra aba, desiste e retoma", async ({
    page,
    context,
}, info) => {
    const SUB = "CF-001-LEIGO-E";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

    // J1 — preenche, desiste no meio e RECARREGA (o reflexo de quem acha que travou).
    await aplicarBase(page);
    await digitar(page, t.calculator.fields.costPerRoll, "137,50");
    await page.waitForTimeout(200);
    const antesDoReload = await preco(page);
    await page.reload();
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(400);
    const depoisDoReload = await preco(page);
    executado(info, SUB, "usuario_burro");
    if (antesDoReload !== null && depoisDoReload !== null && antesDoReload !== depoisDoReload) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: `Recarregar a página apagou o que o vendedor tinha preenchido (custo era R$ ${antesDoReload.toFixed(2)}, voltou a R$ ${depoisDoReload.toFixed(2)})`,
            resultado_esperado:
                "Ou o rascunho sobrevive à recarga, ou o produto avisa que vai perder o que foi digitado",
            resultado_obtido: "os valores voltaram para a semente, sem aviso",
            severidade: "media",
        });
    }

    // J2 — navega para outra aba do app e VOLTA pelo botão do navegador.
    await aplicarBase(page);
    await digitar(page, t.calculator.fields.grams, "222");
    await page.waitForTimeout(200);
    await page.goto("/catalogo");
    await page.waitForTimeout(400);
    await page.goBack();
    await page.waitForTimeout(600);
    executado(info, SUB, "usuario_burro");
    const voltou = await page.locator("body").innerText();
    if (voltou.trim().length < 20) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao:
                "Voltar pelo botão do navegador depois de trocar de aba deixou a tela em branco",
            resultado_esperado: "A calculadora volta a aparecer",
            resultado_obtido: "corpo vazio",
            severidade: "critica",
        });
    }

    // J3 — DUAS ABAS: preenche numa, muda na outra, volta para a primeira.
    const aba2 = await context.newPage();
    await aba2.goto("/calcular");
    await aba2.getByRole("heading", { name: t.calculator.title }).waitFor();
    await aba2
        .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
        .first()
        .fill("999,00");
    await aba2.locator("body").click();
    await page.bringToFront();
    await page.waitForTimeout(500);
    executado(info, SUB, "concorrencia");
    const abaUmSobreviveu = (await page.locator("body").innerText()).includes(
        t.calculator.results.custoTotal,
    );
    if (!abaUmSobreviveu) {
        defeito(info, {
            subcenario: SUB,
            categoria: "concorrencia",
            descricao: "Editar a calculadora numa segunda aba quebrou a primeira",
            resultado_esperado: "As duas abas continuam funcionando de forma independente",
            resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 160),
            severidade: "alta",
        });
    }
    await aba2.close();

    // J4 — o leigo que NÃO ROLA a tela: o preço está abaixo da dobra?
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    await page.waitForTimeout(400);
    executado(info, SUB, "acolhimento");
    const precoNaDobra = await page.evaluate((rotulo: string) => {
        const alvo = Array.from(document.querySelectorAll("*")).find((el) =>
            (el.textContent ?? "").trim().startsWith(rotulo),
        );
        if (!alvo) return null;
        return { topo: Math.round(alvo.getBoundingClientRect().top), altura: window.innerHeight };
    }, t.calculator.results.custoTotal);
    if (precoNaDobra && precoNaDobra.topo > precoNaDobra.altura * 3) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: `O custo total só aparece depois de ${(precoNaDobra.topo / precoNaDobra.altura).toFixed(1)} telas de rolagem — quem não rola não vê o resultado`,
            resultado_esperado:
                "O resultado alcançável em no máximo 2 a 3 telas, ou um resumo fixo",
            resultado_obtido: `topo do custo total a ${precoNaDobra.topo}px numa viewport de ${precoNaDobra.altura}px`,
            severidade: "media",
        });
    }

    // J5 — martelo: 40 cliques no primeiro botão da tela (quem acha que não respondeu).
    const botao = page.getByRole("button").first();
    for (let i = 0; i < 40; i += 1) {
        await botao.click({ timeout: 800, noWaitAfter: true }).catch(() => undefined);
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
    executado(info, SUB, "usuario_burro");
    const vivo = await page.locator("body").innerText();
    if (vivo.trim().length < 20) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: "Quarenta cliques seguidos no mesmo botão deixaram a tela em branco",
            resultado_esperado: "A tela sobrevive a cliques repetidos",
            resultado_obtido: "corpo vazio",
            severidade: "critica",
        });
    }
    await varreduraDeSaude(page, info, SUB, "calculadora após as jornadas do leigo");
});
