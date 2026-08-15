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
  signUp,
  t,
  varreduraDeSaude,
} from "./_harness";

// CF-021..024 (Kits) e CF-013 · 032..034 (Cenários salvos).
//
// Os seletores vêm da suíte que o projeto já mantém (`tests/e2e/kits-save.spec.ts` e
// `scenarios.spec.ts`), de propósito: nas rodadas anteriores, todo defeito que se revelou meu
// nasceu de um seletor inventado. Aqui um vermelho é do produto.

const b = t.bom;
const s = t.scenarios;

function brl(x: string): number {
  return Number(x.replace(/\./g, "").replace(",", "."));
}

/** Todos os "Total da linha (N×)" da tela, em ordem. */
async function totaisDeLinha(page: Page): Promise<number[]> {
  const texto = await page.locator("body").innerText();
  const re = /Total da linha[^\n]*\n?[^\d]{0,20}R\$\s*([\d.]+,\d{2})/gi;
  const out: number[] = [];
  for (const m of texto.matchAll(re)) out.push(brl(m[1]));
  return out;
}

/** O "Custo total" do bloco "Total do kit". */
async function totalDoKit(page: Page): Promise<number | null> {
  const texto = await page.locator("body").innerText();
  const i = texto.indexOf(b.assemblyTitle);
  const alvo = i >= 0 ? texto.slice(i) : texto;
  const m = new RegExp(`${b.assemblyCusto}[\\s\\S]{0,40}?R\\$\\s*([\\d.]+,\\d{2})`, "i").exec(alvo);
  return m ? brl(m[1]) : null;
}

async function abrirKits(page: Page): Promise<boolean> {
  await page.goto("/kits");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  return page
    .getByRole("button", { name: rotulo(b.addLine) })
    .first()
    .isVisible({ timeout: 20_000 })
    .catch(() => false);
}

// =====================================================================================
// CF-021 — a propriedade do kit: o total do conjunto é a soma das peças
// =====================================================================================
test("CF-021-UI-01 — o total do kit é a soma das linhas, com 8 peças e quantidades variadas", async ({
  page,
}, info) => {
  const SUB = "CF-021-UI-01";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await premium(page, `kit-a-${info.workerIndex}`);
  executado(info, SUB, "gate_premium");

  if (!(await abrirKits(page))) {
    defeito(info, {
      subcenario: SUB,
      categoria: "gate_premium",
      descricao: `Um Premium não encontra a ação "${b.addLine}" na aba Kits`,
      resultado_esperado: "Compositor de kit disponível para entitlement ativo",
      resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 200),
      severidade: "alta",
    });
    return;
  }

  const adicionar = page.getByRole("button", { name: rotulo(b.addLine) }).first();
  const quantidades = ["1", "2", "3", "5", "10", "1", "4", "7"];
  for (const q of quantidades) {
    await adicionar.click();
    await page.waitForTimeout(220);
    const campos = page.getByRole("textbox", { name: rotulo(b.quantity) });
    const n = await campos.count();
    if (n > 0) {
      await campos.nth(n - 1).fill(q);
      await campos.nth(n - 1).blur();
    }
    await page.waitForTimeout(180);
    executado(info, SUB, "fluxo");
  }
  await page.waitForTimeout(600);

  const linhas = await totaisDeLinha(page);
  const total = await totalDoKit(page);
  executado(info, SUB, "calculo");

  if (linhas.length === 0 || total === null) {
    defeito(info, {
      subcenario: SUB,
      categoria: "calculo",
      descricao: `O kit com ${quantidades.length} peças não expõe totais de linha e/ou total do conjunto legíveis`,
      resultado_esperado: '"Total da linha" por peça e "Custo total" no bloco "Total do kit"',
      resultado_obtido: `${linhas.length} total(is) de linha, total do kit ${total === null ? "ausente" : total}`,
      severidade: "alta",
    });
  } else {
    const soma = Math.round(linhas.reduce((a, x) => a + x, 0) * 100) / 100;
    if (Math.abs(soma - total) > 0.02) {
      defeito(info, {
        subcenario: SUB,
        categoria: "calculo",
        descricao: `O total do kit (R$ ${total.toFixed(2)}) não é a soma das ${linhas.length} linhas exibidas (R$ ${soma.toFixed(2)})`,
        resultado_esperado: "Montagem = soma independente por peça (ADR-0016)",
        resultado_obtido: `diferença de R$ ${(total - soma).toFixed(2)}`,
        severidade: "critica",
        evidencia: JSON.stringify({ linhas, total }),
      });
    }
  }

  const ov = await overflow(page);
  executado(info, SUB, "layout");
  if (ov.x > 1) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao: `O compositor com 8 peças rola ${ov.x}px na horizontal`,
      resultado_esperado: "Sem rolagem horizontal",
      resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
      severidade: "media",
    });
  }
  await varreduraDeSaude(page, info, SUB, "compositor de kit com 8 peças", { contraste: true });
});

// =====================================================================================
// CF-021-UI-03 — quantidade: o campo que o leigo preenche errado
// =====================================================================================
test("CF-021-UI-03 — quantidade: zero, negativa, decimal, com unidade e no teto do int4", async ({
  page,
}, info) => {
  const SUB = "CF-021-UI-03";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await premium(page, `kit-b-${info.workerIndex}`);
  if (!(await abrirKits(page))) return;

  await page
    .getByRole("button", { name: rotulo(b.addLine) })
    .first()
    .click();
  await page.waitForTimeout(400);
  const qtd = page.getByRole("textbox", { name: rotulo(b.quantity) }).first();
  if (!(await qtd.isVisible().catch(() => false))) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao: `A peça adicionada não expõe o campo "${b.quantity}"`,
      resultado_esperado: "Campo de quantidade por peça",
      resultado_obtido: "campo ausente",
      severidade: "alta",
    });
    return;
  }

  const casos: { valor: string; nota: string; esperaAviso: boolean }[] = [
    { valor: "1", nota: "normal", esperaAviso: false },
    { valor: "0", nota: "zero — a peça não entra no total", esperaAviso: true },
    { valor: "-3", nota: "negativa", esperaAviso: true },
    { valor: "2,5", nota: "decimal (meia peça não existe)", esperaAviso: true },
    { valor: "2 un", nota: "com a unidade que o campo já mostra", esperaAviso: false },
    { valor: "duas", nota: "por extenso", esperaAviso: true },
    { valor: "", nota: "vazia", esperaAviso: true },
    { valor: "2147483647", nota: "teto do int4 (armazenável)", esperaAviso: false },
    { valor: "2147483648", nota: "acima do int4 (estoura a coluna)", esperaAviso: true },
    { valor: "999999999999999", nota: "absurda", esperaAviso: true },
    { valor: "🎉", nota: "emoji", esperaAviso: true },
  ];

  for (const c of casos) {
    await qtd.fill(c.valor);
    await qtd.blur();
    await page.waitForTimeout(280);
    executado(info, SUB, "input_invalido");

    const corpo = await page.locator("body").innerText();
    if (/NaN|Infinity|\[object Object\]|Traceback|TypeError/.test(corpo)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "input_invalido",
        descricao: `Quantidade "${c.valor}" (${c.nota}) exibiu valor cru de JS no compositor`,
        resultado_esperado: "Mensagem em pt-BR ou peça fora do total",
        resultado_obtido:
          /NaN|Infinity|\[object Object\]|Traceback|TypeError/.exec(corpo)?.[0] ?? "",
        severidade: "critica",
      });
    }

    const avisou =
      corpo.includes(b.qtyZero) ||
      corpo.includes(b.lineInvalid) ||
      /confira|inválid|invalid|obrigat|não entra/i.test(corpo);
    if (c.esperaAviso && !avisou) {
      defeito(info, {
        subcenario: SUB,
        categoria: "acolhimento",
        descricao: `Quantidade "${c.valor}" (${c.nota}) foi aceita sem nenhum aviso na tela`,
        resultado_esperado:
          "Peça fora do total com o motivo dito, ou mensagem explicando por que o valor não serve",
        resultado_obtido: "nenhum aviso visível",
        severidade: c.valor === "2147483648" || c.valor === "-3" ? "alta" : "media",
      });
    }

    // O caso mais perigoso: um valor recusado que MESMO ASSIM soma no total.
    if (c.esperaAviso) {
      const total = await totalDoKit(page);
      const linhas = await totaisDeLinha(page);
      if (total !== null && linhas.length > 0) {
        const soma = Math.round(linhas.reduce((a, x) => a + x, 0) * 100) / 100;
        if (Math.abs(soma - total) > 0.02) {
          defeito(info, {
            subcenario: SUB,
            categoria: "calculo",
            descricao: `Com a quantidade "${c.valor}" (${c.nota}), o total do kit (R$ ${total.toFixed(2)}) deixou de bater com a soma das linhas (R$ ${soma.toFixed(2)})`,
            resultado_esperado:
              "Uma peça só entra no total quando é válida, e o total sempre fecha",
            resultado_obtido: `diferença de R$ ${(total - soma).toFixed(2)}`,
            severidade: "critica",
          });
        }
      }
    }
  }
  // A consequência real do valor acima do int4 não é o que a tela diz enquanto se digita — é o que
  // acontece ao SALVAR, porque a coluna é `int4` e o servidor recusa (CEIL_QUANTITY).
  await qtd.fill("2147483648");
  await qtd.blur();
  await page.waitForTimeout(300);
  const nomeKit = page.getByRole("textbox", { name: rotulo(b.kitName) });
  if (await nomeKit.isVisible().catch(() => false)) {
    await nomeKit.fill(`Kit int4 ${info.workerIndex}`);
    await page
      .getByRole("button", { name: b.save, exact: true })
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(2500);
    executado(info, SUB, "estresse_de_dados");
    const aposSalvar = await page.locator("body").innerText();
    const explicou =
      /quantidade|confira|inválid|invalid|não foi possível|nao foi possivel|muito alto/i.test(
        aposSalvar,
      );
    const fingiuSucesso = aposSalvar.includes(b.saved);
    if (fingiuSucesso) {
      defeito(info, {
        subcenario: SUB,
        categoria: "calculo",
        descricao:
          'Salvar um kit com quantidade 2147483648 (acima do teto int4 da coluna) confirmou "Kit salvo." — o vendedor acredita ter guardado algo que o banco não aceita',
        resultado_esperado: "Recusa explicada em pt-BR, sem confirmação de sucesso",
        resultado_obtido: b.saved,
        severidade: "critica",
      });
    } else if (!explicou) {
      defeito(info, {
        subcenario: SUB,
        categoria: "acolhimento",
        descricao:
          "Salvar um kit com quantidade acima do teto int4 não confirmou nem explicou nada — a tela ficou muda",
        resultado_esperado: "Mensagem dizendo qual peça tem quantidade impossível",
        resultado_obtido: aposSalvar.trim().slice(0, 200),
        severidade: "alta",
      });
    }
    if (/Internal Server Error|500|Unprocessable|422|Traceback/i.test(aposSalvar)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "acolhimento",
        descricao:
          "A recusa do servidor à quantidade acima do int4 vazou linguagem técnica para a tela",
        resultado_esperado: "Mensagem em pt-BR, sem código HTTP nem termo de servidor",
        resultado_obtido:
          /Internal Server Error|500|Unprocessable|422|Traceback/i.exec(aposSalvar)?.[0] ?? "",
        severidade: "alta",
      });
    }
  }

  await varreduraDeSaude(page, info, SUB, "quantidade após entradas do leigo");
});

// =====================================================================================
// CF-022 — salvar, reabrir e duplicar
// =====================================================================================
test("CF-022-UI-01 — salvar o kit: nome vazio, nome gigante, e reabrir recalcula", async ({
  page,
}, info) => {
  const SUB = "CF-022-UI-01";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await premium(page, `kit-c-${info.workerIndex}`);
  if (!(await abrirKits(page))) return;

  await page
    .getByRole("button", { name: rotulo(b.addLine) })
    .first()
    .click();
  await page.waitForTimeout(400);
  const salvar = page.getByRole("button", { name: b.save, exact: true });
  const nome = page.getByRole("textbox", { name: rotulo(b.kitName) });

  // T01 — salvar sem nome tem de ser recusado com a frase do produto.
  if (await salvar.isVisible().catch(() => false)) {
    await nome.fill("");
    await salvar.click();
    await page.waitForTimeout(800);
    executado(info, SUB, "input_invalido");
    const corpo = await page.locator("body").innerText();
    if (!corpo.includes(b.kitNameRequired)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "input_invalido",
        descricao: "Salvar um kit sem nome não exibiu a mensagem que o produto define para o caso",
        resultado_esperado: `"${b.kitNameRequired}"`,
        resultado_obtido: corpo.trim().slice(0, 180),
        severidade: "media",
      });
    }
  }

  // T02 — nome gigante: salva ou explica, mas não some em silêncio nem estoura o layout.
  const nomeGigante = `Kit ${"X".repeat(400)}`;
  await nome.fill(nomeGigante);
  await page.waitForTimeout(200);
  const ovNome = await overflow(page);
  executado(info, SUB, "estresse_de_dados");
  if (ovNome.x > 1) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao: `Um nome de kit com 400 caracteres gerou ${ovNome.x}px de rolagem horizontal`,
      resultado_esperado: "Nome longo trunca ou quebra",
      resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
      severidade: "media",
    });
  }

  // T03 — salvar de verdade e reabrir.
  const nomeReal = `Kit Homologação ${info.workerIndex}`;
  await nome.fill(nomeReal);
  await salvar.click();
  await page.waitForTimeout(2000);
  executado(info, SUB, "fluxo");
  const depoisDeSalvar = await page.locator("body").innerText();
  const salvou = depoisDeSalvar.includes(b.saved) || depoisDeSalvar.includes(b.viewKits);
  if (!salvou) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao: "Salvar o kit não produziu nenhuma confirmação visível",
      resultado_esperado: `"${b.saved}" ou o caminho "${b.viewKits}"`,
      resultado_obtido: depoisDeSalvar.trim().slice(0, 200),
      severidade: "alta",
    });
    return;
  }

  // T04 — reabrir pela aba Kits do catálogo: os campos voltam e o preço é RECALCULADO
  // (nenhum preço foi armazenado — FR-407).
  await page.goto("/catalogo?tab=kits");
  await page.waitForTimeout(1500);
  executado(info, SUB, "fluxo");
  const naLista = await page
    .getByText(nomeReal)
    .first()
    .isVisible()
    .catch(() => false);
  if (!naLista) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao: `O kit salvo "${nomeReal}" não aparece na aba Kits do catálogo`,
      resultado_esperado: "Kit salvo listado",
      resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 200),
      severidade: "alta",
    });
    return;
  }
  await page.getByText(nomeReal).first().click();
  executado(info, SUB, "fluxo");
  // Espera COM retry: a reabertura busca o kit no servidor e reidrata o formulário. Uma leitura
  // única logo após o clique pegava o campo ainda vazio e reportava "o kit não restaurou o nome".
  const campoNome = page.getByRole("textbox", { name: rotulo(b.kitName) });
  await expect(campoNome)
    .toHaveValue(nomeReal, { timeout: 20_000 })
    .catch(() => undefined);
  const valorNome = await campoNome.inputValue().catch(() => "");
  const estadoReabertura = {
    url: page.url(),
    temCampoNome: await campoNome.isVisible().catch(() => false),
    temCompositor: await page
      .getByRole("button", { name: rotulo(b.addLine) })
      .first()
      .isVisible()
      .catch(() => false),
    trecho: (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300),
  };
  if (valorNome !== nomeReal) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao: `Reabrir o kit não restaurou o nome (esperado "${nomeReal}", campo trouxe "${valorNome}")`,
      resultado_esperado: "Reabrir recarrega as entradas do kit",
      resultado_obtido: valorNome || "(vazio)",
      severidade: "alta",
      evidencia: JSON.stringify(estadoReabertura),
    });
  }
  const totalReaberto = await totalDoKit(page);
  const linhasReabertas = await totaisDeLinha(page);
  executado(info, SUB, "calculo");
  if (totalReaberto !== null && linhasReabertas.length > 0) {
    const soma = Math.round(linhasReabertas.reduce((a, x) => a + x, 0) * 100) / 100;
    if (Math.abs(soma - totalReaberto) > 0.02) {
      defeito(info, {
        subcenario: SUB,
        categoria: "calculo",
        descricao: `Depois de reabrir, o total do kit (R$ ${totalReaberto.toFixed(2)}) não bate com a soma das linhas (R$ ${soma.toFixed(2)})`,
        resultado_esperado: "O kit reaberto recalcula e continua fechando",
        resultado_obtido: `diferença de R$ ${(totalReaberto - soma).toFixed(2)}`,
        severidade: "critica",
      });
    }
  }
  await varreduraDeSaude(page, info, SUB, "kit reaberto", { contraste: true });
});

// =====================================================================================
// CF-013 / CF-032 — cenários salvos: validação de nome, ida e volta, e a máscara de milhar
// =====================================================================================
test("CF-013/CF-032 — simulação: nome vazio, 121 caracteres, nota longa e ida e volta completa", async ({
  page,
}, info) => {
  const SUB = "CF-013-UI-01";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await premium(page, `cen-a-${info.workerIndex}`);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page.waitForTimeout(1200);

  const salvarSim = page.getByRole("button", { name: s.saveAction });
  executado(info, SUB, "gate_premium");
  if (!(await salvarSim.isVisible({ timeout: 20_000 }).catch(() => false))) {
    defeito(info, {
      subcenario: SUB,
      categoria: "gate_premium",
      descricao: `Um Premium não encontra a ação "${s.saveAction}" na calculadora`,
      resultado_esperado: "Ação de salvar simulação disponível para entitlement ativo",
      resultado_obtido: "botão ausente após 20s",
      severidade: "alta",
    });
    return;
  }

  // Um valor com milhar, para verificar de passagem o follow-up R5 (máscara perdida na reabertura).
  const maquina = page.getByRole("textbox", {
    name: t.calculator.fields.machineValue,
    exact: true,
  });
  await maquina.fill("12345");
  await maquina.blur();
  await page.waitForTimeout(400);
  const mascaraAntes = await maquina.inputValue();

  // T01..T04 — validação do nome e da nota, com as frases que o produto define.
  const casosNome: { nome: string; nota: string; esperado: string | null; caso: string }[] = [
    { nome: "", nota: "", esperado: s.nameRequired, caso: "nome vazio" },
    { nome: "   ", nota: "", esperado: s.nameRequired, caso: "nome só com espaços" },
    { nome: "N".repeat(121), nota: "", esperado: s.nameTooLong, caso: "121 caracteres" },
    { nome: "Cenário ok", nota: "x".repeat(501), esperado: s.noteTooLong, caso: "nota com 501" },
  ];
  for (const c of casosNome) {
    await salvarSim.click();
    const folha = page.getByRole("dialog");
    if (!(await folha.isVisible().catch(() => false))) continue;
    await folha
      .getByLabel(s.nameField)
      .fill(c.nome)
      .catch(() => undefined);
    if (c.nota)
      await folha
        .getByLabel(s.noteField)
        .fill(c.nota)
        .catch(() => undefined);
    // A folha submete por `data-testid`, não por um botão com o rótulo da ação (é o que
    // `tests/e2e/scenarios.spec.ts` usa). Clicar pelo nome não acertava nada, e a validação que
    // "não apareceu" nunca chegou a ser pedida — era meu.
    await folha
      .getByTestId("save-scenario-submit")
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(700);
    executado(info, SUB, "input_invalido");
    const corpo = await page.locator("body").innerText();
    const submitDesabilitado = await page
      .getByTestId("save-scenario-submit")
      .isDisabled()
      .catch(() => null);
    const folhaTexto = await page
      .getByRole("dialog")
      .innerText()
      .catch(() => "(folha fechada)");
    if (c.esperado && !corpo.includes(c.esperado)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "input_invalido",
        descricao: `Salvar simulação com ${c.caso} não exibiu a mensagem que o produto define`,
        resultado_esperado: `"${c.esperado}"`,
        resultado_obtido: `submit desabilitado=${String(submitDesabilitado)}; folha: ${folhaTexto.replace(/\s+/g, " ").slice(0, 220)}`,
        severidade: "media",
      });
    }
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(400);
  }

  // T05 — salvar de verdade.
  const nomeSim = `Simulação Homologação ${info.workerIndex}`;
  await salvarSim.click();
  const folha = page.getByRole("dialog");
  await folha.getByLabel(s.nameField).fill(nomeSim);
  await folha.getByTestId("save-scenario-submit").click();
  await page.waitForTimeout(2000);
  executado(info, SUB, "fluxo");
  if (!(await page.locator("body").innerText()).includes(s.saved)) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao: `Salvar a simulação não confirmou com "${s.saved}"`,
      resultado_esperado: `Toast "${s.saved}" apenas em gravação real`,
      resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 200),
      severidade: "media",
    });
  }

  // T06 — reabrir pela lista e conferir o que volta.
  await page.reload();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: s.navEntry }).click();
  await page.waitForTimeout(1200);
  const lista = page.getByRole("dialog");
  executado(info, SUB, "fluxo");
  if (
    !(await lista
      .getByText(nomeSim)
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao: `A simulação "${nomeSim}" não aparece em "${s.listTitle}"`,
      resultado_esperado: "Simulação salva listada",
      resultado_obtido: (await lista.innerText().catch(() => "")).slice(0, 200),
      severidade: "alta",
    });
    return;
  }
  await lista.getByText(nomeSim).first().click();
  await page.waitForTimeout(2000);
  executado(info, SUB, "fluxo");

  const corpoReaberto = await page.locator("body").innerText();
  if (!corpoReaberto.includes(s.loadedLive)) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acolhimento",
      descricao: `Ao reabrir a simulação, a tela não declara "${s.loadedLive}" — o vendedor não sabe se está vendo o preço de hoje ou o do dia em que salvou`,
      resultado_esperado: `"${s.loadedLive}" visível na barra da simulação aberta`,
      resultado_obtido: corpoReaberto.trim().slice(0, 220),
      severidade: "media",
    });
  }

  // T07 — o follow-up R5: a máscara de milhar sobrevive à reabertura programática?
  const mascaraDepois = await page
    .getByRole("textbox", { name: t.calculator.fields.machineValue, exact: true })
    .inputValue()
    .catch(() => "");
  executado(info, SUB, "acolhimento");
  if (mascaraDepois && mascaraAntes.includes(".") && !mascaraDepois.includes(".")) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acolhimento",
      descricao: `Reabrir a simulação perdeu a máscara de milhar: o campo mostrava "${mascaraAntes}" e voltou como "${mascaraDepois}" (follow-up R5 do 016)`,
      resultado_esperado: "Valor restaurado com a mesma formatação que o campo aplica no blur",
      resultado_obtido: mascaraDepois,
      severidade: "media",
    });
  }
  await varreduraDeSaude(page, info, SUB, "simulação reaberta", { contraste: true });
});

// =====================================================================================
// CF-032 — a lista: busca adversarial, duplicar e excluir
// =====================================================================================
test("CF-032-UI-01 — lista de simulações: busca adversarial, duplicar e excluir", async ({
  page,
}, info) => {
  const SUB = "CF-032-UI-01";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await premium(page, `cen-b-${info.workerIndex}`);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page.waitForTimeout(1200);

  const salvarSim = page.getByRole("button", { name: s.saveAction });
  if (!(await salvarSim.isVisible({ timeout: 20_000 }).catch(() => false))) return;

  // Cria 5 simulações, incluindo nomes que costumam quebrar busca e layout.
  const nomes = [
    "Alfa",
    "Alfa", // duplicado exato
    "ção ÀÉÎÕÜ",
    "🎉 Kit Festa 🥳",
    "S".repeat(115),
  ];
  for (const n of nomes) {
    await salvarSim.click();
    const f = page.getByRole("dialog");
    if (!(await f.isVisible().catch(() => false))) continue;
    await f.getByLabel(s.nameField).fill(n);
    await f
      .getByTestId("save-scenario-submit")
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(1200);
    executado(info, SUB, "estresse_de_dados");
    await page.keyboard.press("Escape").catch(() => undefined);
  }

  await page.getByRole("button", { name: s.navEntry }).click();
  await page.waitForTimeout(1500);
  const lista = page.getByRole("dialog");
  executado(info, SUB, "fluxo");

  const ov = await overflow(page);
  if (ov.x > 1) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao: `A lista de simulações rola ${ov.x}px na horizontal com um nome de 115 caracteres`,
      resultado_esperado: "Nome longo trunca dentro do cartão",
      resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
      severidade: "media",
    });
  }

  // Busca adversarial dentro da folha.
  const busca = lista
    .getByRole("searchbox")
    .or(lista.getByRole("textbox", { name: /busc|pesquis/i }));
  if ((await busca.count()) > 0) {
    for (const termo of [
      "Alfa",
      "ção",
      "🎉",
      ".*",
      "'; DROP TABLE scenarios;--",
      "A".repeat(300),
    ]) {
      await busca.first().fill(termo);
      await page.waitForTimeout(600);
      executado(info, SUB, "input_invalido");
      const texto = await lista.innerText().catch(() => "");
      if (texto.trim().length < 10) {
        defeito(info, {
          subcenario: SUB,
          categoria: "estabilidade",
          descricao: `Buscar por "${termo.slice(0, 24)}" esvaziou completamente a folha de simulações`,
          resultado_esperado: "Lista vazia COM mensagem, nunca uma folha em branco",
          resultado_obtido: "conteúdo vazio",
          severidade: "alta",
        });
      }
      if (/NaN|\[object Object\]|Traceback|TypeError/.test(texto)) {
        defeito(info, {
          subcenario: SUB,
          categoria: "input_invalido",
          descricao: `Buscar por "${termo.slice(0, 24)}" expôs valor cru de JS na lista`,
          resultado_esperado: "Texto do usuário tratado como texto",
          resultado_obtido: /NaN|\[object Object\]|Traceback|TypeError/.exec(texto)?.[0] ?? "",
          severidade: "alta",
        });
      }
    }
    await busca.first().fill("");
    await page.waitForTimeout(500);
  }
  await varreduraDeSaude(page, info, SUB, "lista de simulações com 5 itens", { contraste: true });
});

// =====================================================================================
// CF-013-UI-03 / CF-032-UI-03 — o FREE não pode ver nem erro nem promessa que não se cumpre
// =====================================================================================
test("CF-013-UI-03 — free: sem ação de salvar, com oferta honesta e sem modal morto", async ({
  page,
}, info) => {
  const SUB = "CF-013-UI-03";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await signUp(page, `cen-free-${info.workerIndex}`);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page.waitForTimeout(1500);
  executado(info, SUB, "gate_premium");

  // A ação de salvar NÃO pode existir para free (o servidor recusaria; oferecer é prometer em falso).
  const quantosSalvar = await page.getByRole("button", { name: s.saveAction }).count();
  if (quantosSalvar > 0) {
    defeito(info, {
      subcenario: SUB,
      categoria: "gate_premium",
      descricao: `O usuário FREE vê a ação "${s.saveAction}", que o servidor recusaria`,
      resultado_esperado: "Ação ausente para quem não tem Premium; a oferta ocupa o lugar dela",
      resultado_obtido: `${quantosSalvar} botão(ões) de salvar`,
      severidade: "alta",
    });
  }

  // A entrada da lista existe e leva a uma oferta honesta.
  const entrada = page.getByRole("button", { name: s.navEntry });
  if (await entrada.isVisible().catch(() => false)) {
    await entrada.click();
    await page.waitForTimeout(1200);
    executado(info, SUB, "gate_premium");
    const folha = page.getByRole("dialog");
    const texto = await folha.innerText().catch(() => "");
    if (/não foi possível|nao foi possivel|erro|falhou/i.test(texto)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "gate_premium",
        descricao:
          "O usuário FREE encontra linguagem de ERRO na folha de simulações, onde deveria haver a oferta",
        resultado_esperado: "Título + subtítulo + Assinar Premium, sem mensagem de erro",
        resultado_obtido: texto.trim().slice(0, 220),
        severidade: "alta",
      });
    }
    const temCta = (await folha.getByRole("link", { name: /Assinar Premium/i }).count()) > 0;
    if (!temCta) {
      defeito(info, {
        subcenario: SUB,
        categoria: "gate_premium",
        descricao: "A folha de simulações do FREE não oferece caminho para assinar o Premium",
        resultado_esperado: 'Botão "Assinar Premium" na folha',
        resultado_obtido: texto.trim().slice(0, 200),
        severidade: "media",
      });
    }
    await varreduraDeSaude(page, info, SUB, "folha de simulações do free", {
      contraste: true,
      alvos: true,
    });
  }
});

// =====================================================================================
// CF-032 — offline: salvar simulação precisa de conexão, e o produto tem de dizer isso
// =====================================================================================
test("CF-032-UI-02 — offline: a recusa de salvar é honesta e a leitura continua", async ({
  page,
  context,
}, info) => {
  const SUB = "CF-032-UI-02";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await premium(page, `cen-off-${info.workerIndex}`);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page.waitForTimeout(1200);

  const salvarSim = page.getByRole("button", { name: s.saveAction });
  if (!(await salvarSim.isVisible({ timeout: 20_000 }).catch(() => false))) return;

  await offline(page, context);
  await page.waitForTimeout(500);
  await salvarSim.click();
  const folha = page.getByRole("dialog");
  if (await folha.isVisible().catch(() => false)) {
    await folha
      .getByLabel(s.nameField)
      .fill("Tentativa offline")
      .catch(() => undefined);
    // A folha submete por `data-testid`, não por um botão com o rótulo da ação (é o que
    // `tests/e2e/scenarios.spec.ts` usa). Clicar pelo nome não acertava nada, e a validação que
    // "não apareceu" nunca chegou a ser pedida — era meu.
    await folha
      .getByTestId("save-scenario-submit")
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(1500);
  }
  executado(info, SUB, "rede");
  const corpo = await page.locator("body").innerText();
  const honesto = corpo.includes(s.saveOffline) || /sem conexão|sem conexao|offline/i.test(corpo);
  if (!honesto) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acolhimento",
      descricao:
        "Tentar salvar uma simulação offline não explicou que a operação precisa de conexão",
      resultado_esperado: `"${s.saveOffline}"`,
      resultado_obtido: corpo.trim().slice(0, 220),
      severidade: "alta",
    });
  }
  if (corpo.includes(s.saved)) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acolhimento",
      descricao:
        'Offline, a tela confirmou "Simulação salva." sem que nenhuma gravação tenha acontecido',
      resultado_esperado: "Toast de sucesso APENAS em gravação real (201)",
      resultado_obtido: s.saved,
      severidade: "critica",
    });
  }
  await online(page, context);
  await page.waitForTimeout(800);
  await varreduraDeSaude(page, info, SUB, "simulação offline");
});
