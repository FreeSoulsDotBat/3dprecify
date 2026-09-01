import { expect, test, type Page } from "@playwright/test";

import {
    aplicarSubcenario,
    culpadosDoOverflow,
    defeito,
    executado,
    overflow,
    premium,
    rotulo,
    t,
    varreduraDeSaude,
} from "./_harness";

// CF-010 — o SEGUNDO cálculo crítico do produto: o gross-up por canal.
//
// A verificação central não compara o produto com a implementação dele (isso não verifica nada) —
// compara com a PROMESSA que ele publica na própria tela, em `sectionInfo.marketplace`:
//
//   "Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a
//    comissão sobre o anúncio e a taxa fixa."
//
// Disso saem duas invariantes que qualquer combinação de tarifas tem de respeitar:
//   I1  líquido == preço-base − frete        (o gross-up entrega o que prometeu)
//   I2  líquido == anúncio − anúncio×c% − taxa fixa − frete   (a conta fecha com o que está na tela)
//
// I2 é a mais valiosa: ela é calculada SÓ com números lidos da tela, então não depende de eu supor
// arredondamento, ordem de operações ou qual banda o catálogo aplicou.

const ch = t.calculator.channels;

function brl(s: string): number {
    return Number(s.replace(/\./g, "").replace(",", "."));
}

interface LeituraCanal {
    varejoBase: number | null;
    anuncio: number | null;
    liquido: number | null;
}

/** Lê o bloco "Preços por canal" da tela. Números do vendedor, não da minha aritmética. */
async function lerCanal(page: Page): Promise<LeituraCanal> {
    const texto = await page.locator("body").innerText();
    const pega = (r: string): number | null => {
        const m = new RegExp(`${r}[\\s\\S]{0,60}?R\\$\\s*(-?[\\d.]+,\\d{2})`, "i").exec(texto);
        return m ? brl(m[1]) : null;
    };
    return {
        varejoBase: pega(t.calculator.results.retail),
        anuncio: pega(t.calculator.results.listingPrice),
        liquido: pega(t.calculator.results.netReceived),
    };
}

/** Os campos de tarifa do canal. "Comissão" é PREFIXO de "Comissão mínima/item", então a busca
 *  ampla casaria os dois — daí a desambiguação pelo nome acessível completo. */
async function campoCanal(page: Page, label: string) {
    const exato = page.getByRole("textbox", { name: new RegExp(`^${label}`) });
    if ((await exato.count()) > 0) return exato.first();
    return page.getByRole("textbox", { name: rotulo(label) }).first();
}

async function digitarTarifa(page: Page, label: string, valor: string): Promise<boolean> {
    const c = await campoCanal(page, label);
    if (!(await c.isVisible().catch(() => false))) return false;
    await c.fill(valor).catch(() => undefined);
    await c.blur().catch(() => undefined);
    await page.waitForTimeout(180);
    return true;
}

async function abrirCalculadoraPremium(page: Page, tag: string): Promise<void> {
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    void tag;
}

// =====================================================================================
// DIAGNÓSTICO — o que a seção de marketplace realmente renderiza para um Premium
// =====================================================================================
test("DIAGCANAL — estrutura da seção de canais para um Premium", async ({ page }, info) => {
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `diagcanal-${info.workerIndex}`);
    await abrirCalculadoraPremium(page, "diag");
    await page.waitForTimeout(1500);

    const texto = await page.locator("body").innerText();
    const i = texto.indexOf(t.calculator.sections.marketplace);
    console.log("=== TRECHO MARKETPLACE ===");
    console.log(i >= 0 ? texto.slice(i, i + 1800) : "(seção não encontrada)");

    console.log("=== NOMES ACESSÍVEIS DOS CAMPOS ===");
    console.log(
        (
            await page.evaluate(() =>
                Array.from(document.querySelectorAll("input,select")).map((el) => {
                    const i2 = el as HTMLInputElement;
                    const lab = i2.id
                        ? document.querySelector(`label[for="${CSS.escape(i2.id)}"]`)
                        : null;
                    return `${el.tagName}|aria=${i2.getAttribute("aria-label") ?? ""}|label=${(lab?.textContent ?? "").trim()}|val=${i2.value}`;
                }),
            )
        ).join("\n"),
    );
});

// =====================================================================================
// A — AS DUAS INVARIANTES, sobre uma matriz de tarifas manuais
// =====================================================================================
test("CF-010-A — a conta do canal fecha com o que está na tela, em 24 combinações de tarifa", async ({
    page,
}, info) => {
    const SUB = "CF-010-UI-01";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `canal-a-${info.workerIndex}`);
    await abrirCalculadoraPremium(page, "A");
    await page.waitForTimeout(1200);

    const temComissao = await (
        await campoCanal(page, ch.commission)
    )
        .isVisible()
        .catch(() => false);
    executado(info, SUB, "gate_premium");
    if (!temComissao) {
        defeito(info, {
            subcenario: SUB,
            categoria: "gate_premium",
            descricao: "Um Premium não encontra os campos de tarifa do canal na calculadora",
            resultado_esperado: `Campo "${ch.commission}" visível para conta com entitlement ativo`,
            resultado_obtido: "campo ausente",
            severidade: "alta",
        });
        return;
    }

    const combos: { c: string; f: string; min: string; frete: string }[] = [];
    for (const c of ["5", "12", "16,5", "25"]) {
        for (const f of ["0", "5,00", "1,50"]) {
            for (const frete of ["0", "18,90"]) {
                combos.push({ c, f, min: "0", frete });
            }
        }
    }

    let conferidos = 0;
    for (const combo of combos) {
        await digitarTarifa(page, ch.commission, combo.c);
        await digitarTarifa(page, ch.fixedFee, combo.f);
        await digitarTarifa(page, ch.minPerItem, combo.min);
        // O campo de frete NÃO existe em todo marketplace: os campos do slot são dirigidos pelos eixos
        // que o catálogo declara (016/US12), e a Amazon não declara frete. Ignorar este retorno fez a
        // primeira rodada acusar DOZE críticos de cálculo — eu cobrava um desconto de frete que nunca
        // tinha sido informado, porque o campo não estava na tela.
        const temFrete = await digitarTarifa(page, ch.freight, combo.frete);
        const freteAplicado = temFrete ? combo.frete : "0";
        await page.waitForTimeout(220);
        executado(info, SUB, "calculo");

        const l = await lerCanal(page);
        if (l.anuncio === null || l.liquido === null || l.varejoBase === null) continue;
        conferidos += 1;

        const c = brl(combo.c);
        const f = brl(combo.f);
        const frete = brl(freteAplicado);

        // I2 — a conta fecha com os números da própria tela.
        const liquidoRecomputado = l.anuncio - (l.anuncio * c) / 100 - f - frete;
        if (Math.abs(liquidoRecomputado - l.liquido) > 0.02) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `A conta do canal não fecha: anúncio R$ ${l.anuncio.toFixed(2)} − ${combo.c}% − taxa R$ ${combo.f} − frete R$ ${freteAplicado} = R$ ${liquidoRecomputado.toFixed(2)}, mas a tela mostra líquido R$ ${l.liquido.toFixed(2)}`,
                resultado_esperado: `líquido R$ ${liquidoRecomputado.toFixed(2)} (a fórmula que o próprio produto publica no ⓘ da seção)`,
                resultado_obtido: `R$ ${l.liquido.toFixed(2)}`,
                severidade: "critica",
                evidencia: JSON.stringify({ ...combo, ...l }),
            });
        }

        // I1 — o gross-up entrega o preço-base (menos o frete, que é dedução declarada).
        const esperadoLiquido = l.varejoBase - frete;
        if (Math.abs(esperadoLiquido - l.liquido) > 0.02) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `O gross-up não entrega o preço-base: varejo R$ ${l.varejoBase.toFixed(2)} − frete R$ ${freteAplicado} deveria sobrar R$ ${esperadoLiquido.toFixed(2)}, mas o líquido é R$ ${l.liquido.toFixed(2)} (comissão ${combo.c}%, taxa ${combo.f})`,
                resultado_esperado: `líquido == preço varejo − frete`,
                resultado_obtido: `R$ ${l.liquido.toFixed(2)}`,
                severidade: "critica",
                evidencia: JSON.stringify({ ...combo, ...l }),
            });
        }

        // O anúncio nunca pode ser MENOR que o preço-base: seria vender por menos do que se quer receber.
        if (l.anuncio < l.varejoBase - 0.01) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `O preço de anúncio (R$ ${l.anuncio.toFixed(2)}) ficou ABAIXO do preço varejo (R$ ${l.varejoBase.toFixed(2)}) com comissão ${combo.c}%`,
                resultado_esperado:
                    "Anúncio sempre >= preço-base (a comissão só pode empurrar para cima)",
                resultado_obtido: `R$ ${l.anuncio.toFixed(2)}`,
                severidade: "critica",
            });
        }
    }

    const freteExiste = await (await campoCanal(page, ch.freight)).isVisible().catch(() => false);
    executado(info, SUB, "fluxo");
    if (!freteExiste) {
        defeito(info, {
            subcenario: SUB,
            categoria: "observacao",
            descricao:
                'O slot da Amazon não renderiza o campo "Frete" — os campos do canal são dirigidos pelos eixos declarados no catálogo. É o comportamento que o dono pediu na rodada 1 (ponto 10: "os campos devem fazer sentido de acordo com o marketplace"), registrado aqui como confirmação, não como defeito.',
            resultado_esperado: "Campos coerentes com o marketplace escolhido",
            resultado_obtido: "Comissão, Taxa fixa e Comissão mínima/item — sem Frete",
            severidade: "baixa",
        });
    }

    if (conferidos === 0) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao:
                "Nenhuma das 24 combinações produziu preço de anúncio e líquido legíveis na tela — o bloco de preços por canal não apareceu",
            resultado_esperado:
                '"Preço para anunciar" e "Recebido líquido" visíveis com tarifas informadas',
            resultado_obtido: "bloco ausente em todas as combinações",
            severidade: "alta",
        });
    }
    await varreduraDeSaude(page, info, SUB, "seção de canais após 24 combinações", {
        contraste: true,
    });
});

// =====================================================================================
// B — O LEIGO NA COMISSÃO: o erro que custa dinheiro sem parecer erro
// =====================================================================================
test("CF-010-B — comissão digitada como fração, com símbolo, no limite e acima dele", async ({
    page,
}, info) => {
    const SUB = "CF-010-UI-02";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `canal-b-${info.workerIndex}`);
    await abrirCalculadoraPremium(page, "B");
    await page.waitForTimeout(1200);

    if (!(await digitarTarifa(page, ch.commission, "12"))) return;
    await digitarTarifa(page, ch.fixedFee, "0");
    await digitarTarifa(page, ch.freight, "0");
    await page.waitForTimeout(250);
    const comDoze = await lerCanal(page);
    executado(info, SUB, "usuario_leigo");

    // B1 — o vendedor digita 0,12 querendo dizer 12%. Ninguém recusa: 0,12% é uma comissão válida.
    await digitarTarifa(page, ch.commission, "0,12");
    await page.waitForTimeout(250);
    const comFracao = await lerCanal(page);
    executado(info, SUB, "usuario_leigo");
    const corpoFracao = await page.locator("body").innerText();
    const avisou = /confir|tem certeza|parece|verifique|atenção|atencao|por cento|%\s*ao inv/i.test(
        corpoFracao,
    );
    if (
        comDoze.anuncio !== null &&
        comFracao.anuncio !== null &&
        comDoze.varejoBase !== null &&
        !avisou
    ) {
        const diferenca = comDoze.anuncio - comFracao.anuncio;
        if (diferenca > 1) {
            defeito(info, {
                subcenario: SUB,
                categoria: "acolhimento",
                descricao: `Digitar 0,12 em "Comissão" (o vendedor quis dizer 12%) baixa o anúncio de R$ ${comDoze.anuncio.toFixed(2)} para R$ ${comFracao.anuncio.toFixed(2)} — ele anuncia R$ ${diferenca.toFixed(2)} abaixo do necessário e descobre no extrato. Sem nenhum aviso.`,
                resultado_esperado:
                    "Aviso de plausibilidade para uma comissão de 0,12% (nenhum marketplace cobra isso), ou a unidade dita ao lado do campo",
                resultado_obtido: `anúncio R$ ${comFracao.anuncio.toFixed(2)}, apresentado normalmente`,
                severidade: "alta",
            });
        }
    }

    // B2 — digita "12%" com o símbolo que o próprio campo já mostra.
    await digitarTarifa(page, ch.commission, "12%");
    await page.waitForTimeout(250);
    const comSimbolo = await lerCanal(page);
    executado(info, SUB, "input_invalido");
    if (
        comSimbolo.anuncio !== null &&
        comDoze.anuncio !== null &&
        Math.abs(comSimbolo.anuncio - comDoze.anuncio) > 0.02
    ) {
        defeito(info, {
            subcenario: SUB,
            categoria: "input_invalido",
            descricao: `"12%" e "12" produzem anúncios diferentes (R$ ${comSimbolo.anuncio.toFixed(2)} vs R$ ${comDoze.anuncio.toFixed(2)}) — o vendedor repete o símbolo que o campo já mostra`,
            resultado_esperado: 'Repetir o "%" é ignorado, como o "R$" já é nos campos de dinheiro',
            resultado_obtido: `anúncio R$ ${comSimbolo.anuncio.toFixed(2)}`,
            severidade: "media",
        });
    }

    // B3 — 100% e acima: recusa NOMEADA, nunca um Infinity com cara de preço.
    for (const limite of ["100", "150", "99,99"]) {
        await digitarTarifa(page, ch.commission, limite);
        await page.waitForTimeout(300);
        executado(info, SUB, "input_invalido");
        const corpo = await page.locator("body").innerText();
        if (/Infinity|NaN|\[object Object\]/.test(corpo)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `Comissão de ${limite}% produziu valor cru de JS na tela`,
                resultado_esperado: "Mensagem em pt-BR por slot, nunca Infinity",
                resultado_obtido: /Infinity|NaN|\[object Object\]/.exec(corpo)?.[0] ?? "",
                severidade: "critica",
            });
        }
        if (limite === "100" || limite === "150") {
            const recusou =
                corpo.includes(t.calculator.validation.commissionMax) ||
                /menor que 100/i.test(corpo);
            if (!recusou) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "input_invalido",
                    descricao: `Comissão de ${limite}% não foi recusada com mensagem visível`,
                    resultado_esperado: `"${t.calculator.validation.commissionMax}"`,
                    resultado_obtido: "nenhuma mensagem sobre o limite da comissão",
                    severidade: "alta",
                });
            }
        }
        if (limite === "99,99") {
            // Válido, mas gera um anúncio ~10.000× a base. O layout tem de sobreviver.
            const ov = await overflow(page);
            executado(info, SUB, "layout");
            if (ov.x > 1) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "layout",
                    descricao: `Comissão de 99,99% gera um anúncio enorme e ${ov.x}px de rolagem horizontal`,
                    resultado_esperado: "Número grande cabe ou quebra, sem rolagem horizontal",
                    resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
                    severidade: "media",
                });
            }
        }
    }

    // B4 — frete e taxa fixa com lixo real do teclado.
    await digitarTarifa(page, ch.commission, "12");
    for (const [campo, valor, nota] of [
        [ch.freight, "R$ 18,90", "com o R$ que o campo mostra"],
        [ch.freight, "-10", "negativo"],
        [ch.freight, "18.90", "ponto como decimal"],
        [ch.fixedFee, "abc", "texto em campo de dinheiro"],
        [ch.fixedFee, "1e10", "notação científica"],
        [ch.minPerItem, "-1", "piso negativo"],
    ] as const) {
        await digitarTarifa(page, campo, valor);
        await page.waitForTimeout(220);
        executado(info, SUB, "input_invalido");
        const corpo = await page.locator("body").innerText();
        if (/Infinity|NaN|\[object Object\]/.test(corpo)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "input_invalido",
                descricao: `"${valor}" (${nota}) em "${campo}" exibiu valor cru de JS`,
                resultado_esperado: "Mensagem em pt-BR ou interpretação correta",
                resultado_obtido: /Infinity|NaN|\[object Object\]/.exec(corpo)?.[0] ?? "",
                severidade: "alta",
            });
        }
        await digitarTarifa(page, campo, "0");
    }
    await varreduraDeSaude(page, info, SUB, "canal após entradas do leigo");
});

// =====================================================================================
// C — ISOLAMENTO POR SLOT (SC-107): um canal quebrado não derruba o vizinho
// =====================================================================================
test("CF-010-C — um canal com comissão inválida não pode apagar o preço do outro", async ({
    page,
}, info) => {
    const SUB = "CF-010-UI-03";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `canal-c-${info.workerIndex}`);
    await abrirCalculadoraPremium(page, "C");
    await page.waitForTimeout(1200);

    const adicionar = page.getByRole("button", { name: ch.addChannel });
    if (!(await adicionar.isVisible().catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `Um Premium não encontra o botão "${ch.addChannel}" para configurar um segundo canal`,
            resultado_esperado: "Ação de adicionar canal disponível",
            resultado_obtido: "botão ausente",
            severidade: "media",
        });
        return;
    }

    // Canal 1 válido.
    // `^Comissão` casa TAMBÉM com "Comissão mínima/item" — foi assim que a rodada anterior escreveu
    // 150 no piso por item do canal 1 achando que escrevia na comissão do canal 2, e reportou como
    // defeito uma mensagem de erro que nunca deveria ter existido. O look-ahead separa os dois.
    const comissoes = page.getByRole("textbox", { name: /^Comissão(?! mínima)/ });
    await comissoes.first().fill("12");
    await comissoes.first().blur();
    await adicionar.click();
    await page.waitForTimeout(500);
    executado(info, SUB, "fluxo");

    // Canal 2 quebrado de propósito.
    if ((await comissoes.count()) < 2) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao:
                "Adicionar um segundo canal não criou um segundo conjunto de campos de tarifa",
            resultado_esperado: "Dois canais configuráveis de forma independente",
            resultado_obtido: `${await comissoes.count()} campo(s) de comissão`,
            severidade: "media",
        });
        return;
    }
    await comissoes.nth(1).fill("150");
    await comissoes.nth(1).blur();
    await page.waitForTimeout(500);
    executado(info, SUB, "calculo");

    const corpo = await page.locator("body").innerText();
    const quantosAnuncios = (corpo.match(new RegExp(t.calculator.results.listingPrice, "gi")) ?? [])
        .length;
    const recusou =
        corpo.includes(t.calculator.validation.commissionMax) || /menor que 100/i.test(corpo);

    if (quantosAnuncios === 0) {
        defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao:
                "Um canal com comissão de 150% apagou o preço de anúncio do canal VÁLIDO ao lado (SC-107: o erro deve ficar preso ao slot)",
            resultado_esperado:
                "O canal válido continua mostrando anúncio e líquido; só o inválido erra",
            resultado_obtido: "nenhum preço de anúncio na tela",
            severidade: "alta",
        });
    }
    if (!recusou) {
        // Evidência do que a tela realmente mostra no SEGUNDO slot. No PRIMEIRO slot a mensagem
        // aparece (CF-010-B não registra defeito para 100% e 150%), então a assimetria é o achado —
        // e sem capturar o entorno não dá para saber se é o erro que some ou o meu preenchimento.
        const valorNoCampo = await comissoes.nth(1).inputValue();
        const entorno = await page.evaluate(() => {
            const marca = Array.from(document.querySelectorAll("input")).filter(
                (i) => i.value === "150",
            );
            return marca.map((i) => {
                const bloco = i.closest(
                    "fieldset,section,article,li,div[class*='channel'],div[class*='canal']",
                );
                return (bloco?.textContent ?? "").trim().slice(0, 300);
            });
        });
        defeito(info, {
            subcenario: SUB,
            categoria: "input_invalido",
            descricao: `O SEGUNDO canal com comissão de 150% não exibiu mensagem nomeando o problema (no primeiro slot a mesma entrada é recusada) — campo ficou com "${valorNoCampo}"`,
            resultado_esperado: `"${t.calculator.validation.commissionMax}" no slot inválido, qualquer que seja a posição dele`,
            resultado_obtido: `nenhuma mensagem; ${quantosAnuncios} bloco(s) de anúncio na tela`,
            severidade: "media",
            evidencia: entorno.join(" ;; ").slice(0, 400),
        });
    }
    executado(info, SUB, "calculo");

    // Remover o canal quebrado devolve a tela ao normal.
    const remover = page.getByRole("button", { name: ch.removeChannel });
    if ((await remover.count()) >= 2) {
        await remover.nth(1).click();
        await page.waitForTimeout(500);
        executado(info, SUB, "fluxo");
        const depois = await page.locator("body").innerText();
        if (depois.includes(t.calculator.validation.commissionMax)) {
            defeito(info, {
                subcenario: SUB,
                categoria: "fluxo",
                descricao: "Remover o canal inválido não removeu a mensagem de erro dele",
                resultado_esperado: "Erro some junto com o slot que o gerou",
                resultado_obtido: "mensagem de comissão inválida ainda na tela",
                severidade: "media",
            });
        }
    }
    await varreduraDeSaude(page, info, SUB, "dois canais, um inválido");
});

// =====================================================================================
// D — O CATÁLOGO NO COMANDO: o selo diz de onde veio a tarifa, e o número obedece a mesma conta
// =====================================================================================
test("CF-010-D — tarifas vindas do catálogo: procedência declarada e conta coerente", async ({
    page,
}, info) => {
    const SUB = "CF-010-UI-04";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `canal-d-${info.workerIndex}`);
    await abrirCalculadoraPremium(page, "D");
    await page.waitForTimeout(1500);
    executado(info, SUB, "gate_premium");

    const corpo = await page.locator("body").innerText();

    // O selo de procedência é obrigatório: um número de tarifa sem origem é um número inventado.
    const temSelo =
        /catálogo|catalogo|tabela|atualizad|referência|referencia|informe as taxas/i.test(corpo);
    if (!temSelo) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao:
                "A seção de canais não declara de onde vieram as tarifas (catálogo servido, cache, semente ou manual)",
            resultado_esperado: "Selo de procedência visível ao lado das tarifas",
            resultado_obtido: corpo.slice(0, 200),
            severidade: "media",
        });
    }
    executado(info, SUB, "acolhimento");

    // Com o catálogo no comando, as duas invariantes continuam valendo — lidas só da tela.
    const l = await lerCanal(page);
    executado(info, SUB, "calculo");
    if (l.anuncio !== null && l.liquido !== null && l.varejoBase !== null) {
        if (l.anuncio < l.varejoBase - 0.01) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `Com tarifas do catálogo, o anúncio (R$ ${l.anuncio.toFixed(2)}) ficou abaixo do preço varejo (R$ ${l.varejoBase.toFixed(2)})`,
                resultado_esperado: "Anúncio >= preço-base",
                resultado_obtido: `R$ ${l.anuncio.toFixed(2)}`,
                severidade: "critica",
            });
        }
        if (l.liquido > l.varejoBase + 0.02) {
            defeito(info, {
                subcenario: SUB,
                categoria: "calculo",
                descricao: `O líquido (R$ ${l.liquido.toFixed(2)}) ficou ACIMA do preço varejo (R$ ${l.varejoBase.toFixed(2)}) — o vendedor receberia mais do que pediu`,
                resultado_esperado: "líquido <= preço-base (o marketplace nunca devolve dinheiro)",
                resultado_obtido: `R$ ${l.liquido.toFixed(2)}`,
                severidade: "alta",
            });
        }
    }

    // Trocar de marketplace tem de mudar a tarifa aplicada — senão o seletor é decorativo.
    const seletorMarketplace = page.getByRole("combobox", { name: rotulo(ch.marketplace) }).first();
    if (await seletorMarketplace.isVisible().catch(() => false)) {
        const antes = await lerCanal(page);
        await seletorMarketplace
            .selectOption({ label: t.calculator.marketplaceNames.SHOPEE })
            .catch(() => undefined);
        await page.waitForTimeout(900);
        executado(info, SUB, "fluxo");
        const depois = await lerCanal(page);
        if (
            antes.anuncio !== null &&
            depois.anuncio !== null &&
            antes.anuncio === depois.anuncio &&
            !/informe as taxas/i.test(await page.locator("body").innerText())
        ) {
            defeito(info, {
                subcenario: SUB,
                categoria: "fluxo",
                descricao:
                    "Trocar o marketplace do canal não mudou o preço de anúncio nem avisou que não há tarifa para o novo canal",
                resultado_esperado:
                    "Outro marketplace ⇒ outra tarifa ⇒ outro anúncio, ou a mensagem honesta de ausência",
                resultado_obtido: `anúncio permaneceu em R$ ${depois.anuncio.toFixed(2)}`,
                severidade: "media",
            });
        }
    }
    await varreduraDeSaude(page, info, SUB, "canais com tarifas do catálogo", { contraste: true });
});
