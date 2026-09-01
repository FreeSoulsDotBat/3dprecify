import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
    aplicarSubcenario,
    defeito,
    executado,
    offline,
    online,
    premium,
    revoke,
    t,
    varreduraDeSaude,
} from "./_harness";

// CF-029 — exportar o orçamento como PDF (para o cliente) e como CSV (para o vendedor).
//
// A geometria do PDF é medida à parte, em `docs/homologacao/automatizada/scripts/pdf_geometria.py`
// (300 renderizações sob dados adversariais, reusando o extrator posicional da suíte do projeto).
// Aqui o alvo é o FLUXO: o arquivo chega mesmo? o portão de entitlement é real? o que o produto diz
// quando não pode exportar?

const h = t.history;

async function registrarOrcamento(page: Page, rotulo: string): Promise<boolean> {
    await page.goto("/calcular");
    await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
    const botao = page.getByRole("button", { name: h.saveAction });
    if (
        !(await botao
            .first()
            .isVisible({ timeout: 20_000 })
            .catch(() => false))
    )
        return false;
    await botao.first().click();
    const folha = page.getByRole("dialog");
    if (!(await folha.isVisible().catch(() => false))) return false;
    // O rótulo é o que o PDF imprime como identificação do orçamento — vai adversarial de propósito.
    const campoRotulo = folha.getByRole("textbox").first();
    await campoRotulo.fill(rotulo).catch(() => undefined);
    await folha.getByRole("button", { name: h.saveSheetSubmit }).click();
    await page.waitForTimeout(2000);
    return true;
}

async function abrirFolhaDeExport(page: Page): Promise<boolean> {
    await page.goto("/historico");
    await page.waitForTimeout(2000);
    const acao = page.getByRole("button", { name: h.exportAction }).first();
    if (!(await acao.isVisible({ timeout: 20_000 }).catch(() => false))) return false;
    await acao.click();
    await page.waitForTimeout(900);
    return true;
}

// =====================================================================================
// CF-029-UI-01 — PDF: o arquivo chega, é um PDF de verdade, com rótulo adversarial
// =====================================================================================
test("CF-029-UI-01 — exportar PDF com rótulo adversarial: o arquivo chega e é um PDF real", async ({
    page,
}, info) => {
    const SUB = "CF-029-UI-01";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    await premium(page, `exp-a-${info.workerIndex}`);

    const rotulo = `Cliente ${"J".repeat(120)} & <b>teste</b> 🎉`;
    if (!(await registrarOrcamento(page, rotulo))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "gate_premium",
            descricao:
                "Não foi possível registrar um orçamento para exportar (ação de salvar ausente)",
            resultado_esperado: "Premium registra orçamento e depois exporta",
            resultado_obtido: "ação de salvar não encontrada",
            severidade: "alta",
        });
        return;
    }
    executado(info, SUB, "fluxo");

    if (!(await abrirFolhaDeExport(page))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `Um Premium com orçamento registrado não encontra a ação "${h.exportAction}"`,
            resultado_esperado: "Ação de exportar disponível no registro",
            resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 200),
            severidade: "alta",
        });
        return;
    }

    const folha = page.getByRole("dialog");
    const gerar = folha.getByRole("button", { name: h.exportGenerate });
    executado(info, SUB, "fluxo");
    if (!(await gerar.isVisible().catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `A folha de exportação não oferece "${h.exportGenerate}"`,
            resultado_esperado: "Botão de gerar o PDF",
            resultado_obtido: (await folha.innerText().catch(() => "")).slice(0, 220),
            severidade: "alta",
        });
        return;
    }

    const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }).catch(() => null),
        gerar.click(),
    ]);
    executado(info, SUB, "fluxo");

    if (!download) {
        const corpo = await page.locator("body").innerText();
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: "Clicar em gerar o PDF não produziu nenhum download em 30s",
            resultado_esperado: "Um arquivo PDF baixado, ou a mensagem honesta de falha",
            resultado_obtido: corpo.includes(h.exportFailed)
                ? h.exportFailed
                : corpo.trim().slice(0, 200),
            severidade: "alta",
        });
        return;
    }

    const caminho = await download.path();
    const bytes = caminho ? readFileSync(caminho) : Buffer.alloc(0);
    const nomeArquivo = download.suggestedFilename();
    executado(info, SUB, "estresse_de_dados");

    if (!bytes.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: `O arquivo baixado como PDF não começa com a assinatura %PDF- (${bytes.length} bytes)`,
            resultado_esperado:
                "Um PDF válido — nunca um arquivo vazio ou uma página de erro salva como PDF",
            resultado_obtido: bytes.subarray(0, 30).toString("latin1"),
            severidade: "critica",
        });
    }
    if (bytes.length < 1000) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: `O PDF baixado tem apenas ${bytes.length} bytes — um orçamento com itens não cabe nisso`,
            resultado_esperado: "PDF com o conteúdo do orçamento",
            resultado_obtido: `${bytes.length} bytes`,
            severidade: "alta",
        });
    }
    // O nome do arquivo chega ao computador do vendedor: um rótulo com 120 letras, `<b>` e emoji não
    // pode virar um nome de arquivo inválido no Windows (os caracteres < > : " / \ | ? * são proibidos).
    if (/[<>:"/\\|?*]/.test(nomeArquivo)) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: `O nome do arquivo sugerido carrega caractere proibido em sistema de arquivos: "${nomeArquivo}"`,
            resultado_esperado: 'Nome de arquivo saneado, sem < > : " / \\ | ? *',
            resultado_obtido: nomeArquivo,
            severidade: "media",
        });
    }
    if (nomeArquivo.length > 200) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: `O nome do arquivo tem ${nomeArquivo.length} caracteres — acima do que muitos sistemas aceitam`,
            resultado_esperado: "Nome truncado a um comprimento seguro",
            resultado_obtido: `${nomeArquivo.length} caracteres`,
            severidade: "baixa",
        });
    }
    await varreduraDeSaude(page, info, SUB, "folha de exportação após gerar o PDF", {
        contraste: true,
    });
});

// =====================================================================================
// CF-029-UI-02 — CSV: conteúdo, separador decimal e injeção de fórmula
// =====================================================================================
test("CF-029-UI-02 — exportar CSV: o conteúdo é o registro, e o que acontece com uma fórmula", async ({
    page,
}, info) => {
    const SUB = "CF-029-UI-02";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await premium(page, `exp-b-${info.workerIndex}`);

    // Um rótulo que o Excel interpretaria como fórmula se o CSV não o neutralizar.
    const rotuloFormula = '=HYPERLINK("http://exemplo.test","clique aqui")';
    if (!(await registrarOrcamento(page, rotuloFormula))) return;
    executado(info, SUB, "fluxo");

    if (!(await abrirFolhaDeExport(page))) return;
    const folha = page.getByRole("dialog");

    // Escolher o CSV: os formatos são rádios no grupo "O que exportar".
    const opcaoCsv = folha.getByRole("radio", { name: h.exportHistoryCsv });
    if (await opcaoCsv.isVisible().catch(() => false)) {
        await opcaoCsv.check().catch(() => undefined);
        await page.waitForTimeout(400);
    }
    const baixar = folha.getByRole("button", { name: h.exportGenerateCsv });
    executado(info, SUB, "fluxo");
    if (!(await baixar.isVisible().catch(() => false))) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `A folha de exportação não oferece "${h.exportGenerateCsv}" depois de escolher o CSV`,
            resultado_esperado: "Botão de baixar o CSV",
            resultado_obtido: (await folha.innerText().catch(() => "")).slice(0, 220),
            severidade: "alta",
        });
        return;
    }

    const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }).catch(() => null),
        baixar.click(),
    ]);
    executado(info, SUB, "fluxo");
    if (!download) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: "Clicar em baixar o CSV não produziu nenhum download em 30s",
            resultado_esperado: "Um arquivo CSV baixado, ou a mensagem honesta de falha",
            resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 200),
            severidade: "alta",
        });
        return;
    }

    const caminho = await download.path();
    const texto = caminho ? readFileSync(caminho, "utf8") : "";
    executado(info, SUB, "estresse_de_dados");

    if (texto.trim().length === 0) {
        defeito(info, {
            subcenario: SUB,
            categoria: "estabilidade",
            descricao: "O CSV baixado está vazio",
            resultado_esperado: "Cabeçalho + a linha do registro",
            resultado_obtido: "(arquivo vazio)",
            severidade: "critica",
        });
        return;
    }

    const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (linhas.length < 2) {
        defeito(info, {
            subcenario: SUB,
            categoria: "fluxo",
            descricao: `O CSV traz ${linhas.length} linha(s) — o registro recém-criado não está nele`,
            resultado_esperado: "Cabeçalho + ao menos uma linha",
            resultado_obtido: texto.slice(0, 200),
            severidade: "alta",
        });
    }

    // A decisão do projeto sobre injeção de fórmula foi conscientemente ACEITA (E4/PR-C), com
    // gatilhos de reabertura. Aqui a homologação só MEDE o estado: se a célula sai crua, o registro
    // fica, para o dono decidir se algum gatilho foi atingido — não é um defeito novo por si.
    const celulaCrua = /(^|[,;])=HYPERLINK/m.test(texto);
    const celulaNeutralizada = /(^|[,;])["']?['\t ]?=?HYPERLINK/m.test(texto) && !celulaCrua;
    executado(info, SUB, "seguranca");
    if (celulaCrua) {
        defeito(info, {
            subcenario: SUB,
            categoria: "observacao",
            descricao:
                "O rótulo `=HYPERLINK(...)` sai do CSV como célula CRUA: uma planilha o interpretaria como fórmula ao abrir. Risco CONSCIENTEMENTE ACEITO no E4/PR-C, com gatilhos de reabertura — registrado aqui como medição do estado atual, não como defeito novo.",
            resultado_esperado:
                "Decisão do dono: aceitar (com gatilhos) ou neutralizar prefixando a célula",
            resultado_obtido: (/^.*HYPERLINK.*$/m.exec(texto)?.[0] ?? "").slice(0, 160),
            severidade: "baixa",
        });
    } else if (celulaNeutralizada) {
        executado(info, SUB, "seguranca");
    }

    // O CSV é lido no Excel pt-BR: separador de coluna e decimal não podem ser ambos vírgula sem aspas.
    const cabecalho = linhas[0] ?? "";
    const usaPontoEVirgula = cabecalho.includes(";");
    const temDecimalComVirgula = /\d+,\d{2}/.test(texto);
    if (!usaPontoEVirgula && temDecimalComVirgula && !/"[^"]*,\d{2}[^"]*"/.test(texto)) {
        defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao:
                "O CSV usa vírgula como separador de coluna E vírgula decimal sem aspas — no Excel pt-BR o valor quebra em duas colunas",
            resultado_esperado: "Ponto e vírgula como separador, ou valores entre aspas",
            resultado_obtido: `cabeçalho: ${cabecalho.slice(0, 120)}`,
            severidade: "media",
        });
    }
    await varreduraDeSaude(page, info, SUB, "folha de exportação do CSV");
});

// =====================================================================================
// CF-029-UI-03 — o portão é REAL: sem Premium ativo, nenhum arquivo
// =====================================================================================
test("CF-029-UI-03 — entitlement revogado: exportar é negado, sem arquivo parcial", async ({
    page,
}, info) => {
    const SUB = "CF-029-UI-03";
    await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
    const email = await premium(page, `exp-c-${info.workerIndex}`);
    if (!(await registrarOrcamento(page, "Cliente antes da revogação"))) return;
    executado(info, SUB, "fluxo");

    // Revoga pelo MESMO caminho de operador que concedeu (ADR-0012) — o Premium some de verdade.
    revoke(email);
    await page.reload();
    await page.waitForTimeout(2000);
    await page.goto("/historico");
    await page.waitForTimeout(2500);
    executado(info, SUB, "gate_premium");

    const corpo = await page.locator("body").innerText();
    const acao = page.getByRole("button", { name: h.exportAction }).first();
    const temAcao = await acao.isVisible().catch(() => false);

    if (temAcao) {
        // Se a ação continua oferecida, o produto TEM de recusar honestamente ao ser acionada, e
        // nenhum arquivo pode nascer.
        await acao.click();
        await page.waitForTimeout(900);
        const folha = page.getByRole("dialog");
        const gerar = folha.getByRole("button", { name: h.exportGenerate });
        if (await gerar.isVisible().catch(() => false)) {
            const [download] = await Promise.all([
                page.waitForEvent("download", { timeout: 12_000 }).catch(() => null),
                gerar.click(),
            ]);
            executado(info, SUB, "gate_premium");
            if (download) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "seguranca",
                    descricao:
                        "Com o Premium REVOGADO, a exportação ainda entregou um arquivo — o portão de entitlement não é real na exportação",
                    resultado_esperado: "403 e nenhum artefato parcial (FR-515/FR-516)",
                    resultado_obtido: `arquivo "${download.suggestedFilename()}" baixado`,
                    severidade: "critica",
                });
            } else {
                const depois = await page.locator("body").innerText();
                const explicou =
                    depois.includes(h.exportLapsed) || /premium|reative|assinar/i.test(depois);
                if (!explicou) {
                    defeito(info, {
                        subcenario: SUB,
                        categoria: "acolhimento",
                        descricao:
                            "Com o Premium revogado, a exportação não gerou arquivo e também não disse por quê — a tela ficou muda",
                        resultado_esperado: `"${h.exportLapsed}"`,
                        resultado_obtido: depois.trim().slice(0, 220),
                        severidade: "alta",
                    });
                }
                if (/403|401|Forbidden|Unauthorized|Internal Server Error/i.test(depois)) {
                    defeito(info, {
                        subcenario: SUB,
                        categoria: "acolhimento",
                        descricao:
                            "A recusa de exportação vazou código HTTP para a tela do vendedor",
                        resultado_esperado: "Mensagem em pt-BR, sem código de protocolo",
                        resultado_obtido:
                            /403|401|Forbidden|Unauthorized|Internal Server Error/i.exec(
                                depois,
                            )?.[0] ?? "",
                        severidade: "media",
                    });
                }
            }
        }
    } else {
        // Ação ausente é uma resposta legítima — desde que a tela explique, e não apenas some.
        executado(info, SUB, "gate_premium");
        const explicou = corpo.includes(h.lapsedTitle) || /premium|reative|assinar/i.test(corpo);
        if (!explicou) {
            defeito(info, {
                subcenario: SUB,
                categoria: "acolhimento",
                descricao:
                    "Com o Premium revogado a ação de exportar simplesmente desapareceu, sem nada na tela explicando",
                resultado_esperado: "Estado 'Premium pausado' dito em voz alta",
                resultado_obtido: corpo.trim().slice(0, 220),
                severidade: "media",
            });
        }
    }
    await varreduraDeSaude(page, info, SUB, "histórico com Premium revogado", { contraste: true });
});

// =====================================================================================
// CF-029-UI-04 — offline: exportar precisa de conexão, e o produto tem de dizer isso
// =====================================================================================
test("CF-029-UI-04 — offline: a recusa de exportar é honesta e nenhum arquivo falso nasce", async ({
    page,
    context,
}, info) => {
    const SUB = "CF-029-UI-04";
    await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
    await premium(page, `exp-d-${info.workerIndex}`);
    if (!(await registrarOrcamento(page, "Cliente offline"))) return;
    if (!(await abrirFolhaDeExport(page))) return;

    await offline(page, context);
    await page.waitForTimeout(600);
    const folha = page.getByRole("dialog");
    const gerar = folha.getByRole("button", { name: h.exportGenerate });
    if (await gerar.isVisible().catch(() => false)) {
        const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 10_000 }).catch(() => null),
            gerar.click().catch(() => undefined),
        ]);
        executado(info, SUB, "rede");
        if (download) {
            const caminho = await download.path();
            const bytes = caminho ? readFileSync(caminho) : Buffer.alloc(0);
            if (!bytes.subarray(0, 5).toString("latin1").startsWith("%PDF-")) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "acolhimento",
                    descricao:
                        "Offline, o produto entregou um download que NÃO é um PDF — um arquivo falso",
                    resultado_esperado: "Nenhum arquivo, com a recusa explicada",
                    resultado_obtido: bytes.subarray(0, 40).toString("latin1"),
                    severidade: "critica",
                });
            }
        } else {
            const corpo = await page.locator("body").innerText();
            const honesto =
                corpo.includes(h.exportOffline) ||
                /sem conexão|sem conexao|offline|conexão/i.test(corpo);
            if (!honesto) {
                defeito(info, {
                    subcenario: SUB,
                    categoria: "acolhimento",
                    descricao:
                        "Offline, gerar o PDF não produziu arquivo nem explicação — a tela ficou muda",
                    resultado_esperado: `"${h.exportOffline}"`,
                    resultado_obtido: corpo.trim().slice(0, 220),
                    severidade: "alta",
                });
            }
        }
    }
    await online(page, context);
    await page.waitForTimeout(600);
    await varreduraDeSaude(page, info, SUB, "exportação offline");
});
