import { expect, test, type Page } from "@playwright/test";

import {
  aplicarSubcenario,
  coletarConsole,
  culpadosDoOverflow,
  defeito,
  executado,
  focoInvisivel,
  foraDaViewport,
  overflow,
  premium,
  t,
  varreduraDeSaude,
} from "./_harness";

// CF-001..CF-005 — o NÚCLEO do produto: a aritmética do preço e o detalhamento que a explica.
// Todo número conferido aqui é RECALCULADO independentemente a partir das regras lidas em
// `packages/pricing-core/src/index.ts:219-339`, nunca comparado com a própria implementação.

// --------------------------------------------------------------------- recálculo independente

interface Entrada {
  costPerRoll: number;
  rollWeightKg: number;
  printGrams: number;
  printTimeHours: number;
  avgPowerKw: number;
  tariffPerKwh: number;
  machineValue: number;
  machineLifetimeHours: number;
  maintenanceReservePerHour?: number;
  failurePct?: number;
  finishTimeHours?: number;
  finishRatePerHour?: number;
  laborHours?: number;
  laborRatePerHour?: number;
  outros?: number[];
  markupVarejoPct: number;
  markupAtacadoPct: number;
}

/** Meio-para-cima em 2 casas, como `toMoney` (ADR-0008). Implementado à mão de propósito: usar o
 *  `toMoney` do produto para conferir o produto não confere nada. */
function m2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/** A fórmula relida da spec, não importada do pacote. */
function recalcular(e: Entrada): {
  material: number;
  energia: number;
  maquina: number;
  falha: number;
  acabamento: number;
  maoDeObra: number;
  admin: number;
  custoTotal: number;
  varejo: number;
  atacado: number;
} {
  const material = m2((e.costPerRoll / (e.rollWeightKg * 1000)) * e.printGrams);
  const energia = m2(e.printTimeHours * e.avgPowerKw * e.tariffPerKwh);
  const maquina = m2(
    (e.machineValue / e.machineLifetimeHours + (e.maintenanceReservePerHour ?? 0)) *
      e.printTimeHours,
  );
  const producao = m2(material + energia + maquina);
  const falha = m2((producao * (e.failurePct ?? 0)) / 100);
  const acabamento = m2((e.finishTimeHours ?? 0) * (e.finishRatePerHour ?? 0));
  const maoDeObra = m2((e.laborHours ?? 0) * (e.laborRatePerHour ?? 0));
  const admin = m2((e.outros ?? []).reduce((a, b) => a + m2(b), 0));
  const custoTotal = m2(material + energia + maquina + falha + acabamento + maoDeObra + admin);
  return {
    material,
    energia,
    maquina,
    falha,
    acabamento,
    maoDeObra,
    admin,
    custoTotal,
    varejo: m2(custoTotal * (1 + e.markupVarejoPct / 100)),
    atacado: m2(custoTotal * (1 + e.markupAtacadoPct / 100)),
  };
}

const SEMENTE: Entrada = {
  costPerRoll: 100,
  rollWeightKg: 1,
  printGrams: 100,
  printTimeHours: 5,
  avgPowerKw: 0.12,
  tariffPerKwh: 1,
  machineValue: 4000,
  machineLifetimeHours: 3600,
  markupVarejoPct: 50,
  markupAtacadoPct: 30,
};

// --------------------------------------------------------------------- leitura da tela

function brl(s: string): number {
  return Number(s.replace(/\./g, "").replace(",", "."));
}

/** Lê os números da tela pelo TEXTO renderizado — é o que o vendedor enxerga, e é onde uma
 *  divergência entre o cálculo e a apresentação aparece. */
async function lerTela(page: Page): Promise<Record<string, number | null>> {
  const texto = await page.locator("body").innerText();
  // O rótulo e o valor NÃO ficam na mesma linha (`innerText` insere quebra) e podem ter uma
  // legenda com dígitos no meio ("Preço varejo\nmarkup 50%\nR$ 24,24"). A primeira versão desta
  // regex proibia dígitos entre os dois e por isso não achava varejo/atacado — e um rótulo não
  // encontrado tinha virado "defeito" no primeiro relatório. Era do harness.
  const pega = (rotulo: string): number | null => {
    const re = new RegExp(`${rotulo}[\\s\\S]{0,40}?R\\$\\s*(-?[\\d.]+,\\d{2})`, "i");
    const m = re.exec(texto);
    return m ? brl(m[1]) : null;
  };
  return {
    material: pega(t.calculator.results.material),
    energia: pega(t.calculator.results.energy),
    maquina: pega(t.calculator.results.machine),
    custoTotal: pega(t.calculator.results.custoTotal),
    varejo: pega(t.calculator.results.varejo),
    atacado: pega(t.calculator.results.atacado),
  };
}

function campo(page: Page, rotulo: string) {
  return page.getByRole("textbox", { name: new RegExp(rotulo) }).first();
}

async function preencher(page: Page, rotulo: string, valor: string): Promise<void> {
  const c = campo(page, rotulo);
  await c.fill(valor);
  await c.blur();
}

// =====================================================================================
// CF-001-UI-01 — mobile / dark / anônimo / semente
// =====================================================================================
test("CF-001-UI-01 — mobile dark anônimo: aritmética da semente e resistência dos campos a lixo", async ({
  page,
}, info) => {
  const SUB = "CF-001-UI-01";
  const con = coletarConsole(page);
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  // T01 — CRÍTICO: a semente calcula exatamente o que a fórmula manda.
  const esperado = recalcular(SEMENTE);
  const tela = await lerTela(page);
  executado(info, SUB, "calculo");
  for (const k of ["material", "energia", "maquina", "custoTotal", "varejo", "atacado"] as const) {
    if (tela[k] === null) {
      defeito(info, {
        subcenario: SUB,
        categoria: "calculo",
        descricao: `Linha "${k}" não encontrada na tela de primeira visita`,
        resultado_esperado: `${k} = ${esperado[k as keyof typeof esperado]}`,
        resultado_obtido: "linha ausente",
        severidade: "alta",
      });
    } else {
      expect
        .soft(tela[k], `${SUB}/T01 ${k} — recálculo independente`)
        .toBeCloseTo(esperado[k as keyof typeof esperado] as number, 2);
      if (
        Math.abs((tela[k] as number) - (esperado[k as keyof typeof esperado] as number)) > 0.005
      ) {
        defeito(info, {
          subcenario: SUB,
          categoria: "calculo",
          descricao: `Divergência de cálculo na linha "${k}" da primeira visita`,
          resultado_esperado: String(esperado[k as keyof typeof esperado]),
          resultado_obtido: String(tela[k]),
          severidade: "critica",
        });
      }
    }
  }

  // T02 — as linhas exibidas somam o total exibido (WYSIWYG).
  if (tela.material !== null && tela.custoTotal !== null) {
    const soma = m2((tela.material ?? 0) + (tela.energia ?? 0) + (tela.maquina ?? 0));
    expect.soft(soma, `${SUB}/T02 soma das linhas == custo total`).toBeCloseTo(tela.custoTotal, 2);
  }
  executado(info, SUB, "calculo");

  // T03..T14 — lixo em campo numérico. Cada entrada é digitada DE VERDADE e a tela é lida depois.
  const lixos: { rotulo: string; valor: string; nota: string }[] = [
    { rotulo: t.calculator.fields.costPerRoll, valor: "abc", nota: "texto em campo numérico" },
    { rotulo: t.calculator.fields.costPerRoll, valor: "-50", nota: "negativo" },
    { rotulo: t.calculator.fields.costPerRoll, valor: "🎉🎉", nota: "emoji" },
    { rotulo: t.calculator.fields.costPerRoll, valor: "1e308", nota: "notação científica gigante" },
    { rotulo: t.calculator.fields.costPerRoll, valor: "  ", nota: "só espaços" },
    { rotulo: t.calculator.fields.costPerRoll, valor: "--5", nota: "sinal duplicado" },
    { rotulo: t.calculator.fields.costPerRoll, valor: "5x3", nota: "lixo no meio (013/FA-05)" },
    { rotulo: t.calculator.fields.rollWeight, valor: "0", nota: "denominador zero" },
    { rotulo: t.calculator.fields.rollWeight, valor: "-1", nota: "denominador negativo" },
    { rotulo: t.calculator.fields.grams, valor: "999999999999", nota: "gramas absurdas" },
    { rotulo: t.calculator.fields.markupVarejo, valor: "-10", nota: "markup negativo" },
    { rotulo: t.calculator.fields.tariff, valor: "1.234,56", nota: "milhar + decimal pt-BR" },
  ];
  for (const [i, l] of lixos.entries()) {
    const num = String(i + 3).padStart(2, "0");
    await preencher(page, l.rotulo, l.valor);
    executado(info, SUB, "input_invalido");
    // Nunca pode virar tela branca, stack, NaN ou número inventado.
    const corpo = await page.locator("body").innerText();
    if (/NaN|Infinity|\[object Object\]|undefined/.test(corpo)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "input_invalido",
        descricao: `T${num}: "${l.valor}" (${l.nota}) em "${l.rotulo}" produziu valor cru de JS na tela`,
        resultado_esperado: "Mensagem em pt-BR ou o campo simplesmente não contribui",
        resultado_obtido: /NaN|Infinity|\[object Object\]|undefined/.exec(corpo)?.[0] ?? "",
        severidade: "alta",
      });
    }
    const erroVisivel = await page
      .getByText(
        new RegExp(
          [
            t.calculator.validation.invalid,
            t.calculator.validation.negative,
            t.calculator.validation.required,
            t.calculator.rollWeightError,
            t.calculator.validation.machineLifetimePositive,
          ]
            .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|"),
        ),
      )
      .first()
      .isVisible()
      .catch(() => false);
    // As gramas absurdas passaram a receber AVISO de plausibilidade (não mensagem de validação):
    // o número é aceito de propósito — "aviso nunca vira validação" — então a expectativa aqui
    // deixou de ser uma recusa. O aviso é conferido por `plausibilidade.test.ts`.
    const avisoVisivel = await page
      .getByTestId(/^aviso-/)
      .first()
      .isVisible()
      .catch(() => false);
    const deveriaErrar = !["1.234,56"].includes(l.valor) && !avisoVisivel;
    if (deveriaErrar && !erroVisivel) {
      defeito(info, {
        subcenario: SUB,
        categoria: "input_invalido",
        descricao: `T${num}: "${l.valor}" (${l.nota}) em "${l.rotulo}" foi aceito sem nenhuma mensagem visível`,
        resultado_esperado: "Mensagem inline em pt-BR explicando o que fazer",
        resultado_obtido: "nenhuma mensagem de validação visível",
        severidade: "media",
      });
    }
    // Restaura para o próximo caso não herdar o estado inválido.
    await preencher(page, l.rotulo, l.rotulo === t.calculator.fields.rollWeight ? "1" : "100");
  }

  // T15 — recuperação: depois de todo o lixo, um preenchimento válido volta ao número certo.
  await page.reload();
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();
  await page.waitForTimeout(300); // sem isto a leitura pega a tela antes do primeiro cálculo
  const depois = await lerTela(page);
  executado(info, SUB, "usuario_burro");
  expect
    .soft(depois.custoTotal, `${SUB}/T15 recarregar devolve a semente`)
    .toBeCloseTo(esperado.custoTotal, 2);

  // T16 — clique frenético. Só em <button> (um <a> NAVEGA, e sair da tela é o comportamento
  // correto dele — a primeira versão clicava em "Assinar Premium" e depois cobrava que a
  // calculadora continuasse na tela). Limitado no tempo: 30 cliques de 2s estouravam o teste.
  const botoes = page.getByRole("button");
  const n = Math.min(await botoes.count(), 4);
  for (let i = 0; i < n; i += 1) {
    const b = botoes.nth(i);
    if (await b.isEnabled().catch(() => false)) {
      for (let k = 0; k < 4; k += 1) {
        await b.click({ timeout: 1200, noWaitAfter: true }).catch(() => undefined);
      }
    }
  }
  executado(info, SUB, "usuario_burro");
  await page.keyboard.press("Escape").catch(() => undefined);
  const vivo = await page.locator("body").innerText();
  if (vivo.trim().length < 20) {
    defeito(info, {
      subcenario: SUB,
      categoria: "estabilidade",
      descricao: "Cliques repetidos nos controles da calculadora deixaram a tela em branco",
      resultado_esperado: "A tela sobrevive a cliques repetidos",
      resultado_obtido: "corpo vazio",
      severidade: "critica",
    });
  }

  // T17 — voltar do navegador no meio.
  await page.goto("/privacidade");
  await page.goBack();
  executado(info, SUB, "usuario_burro");
  await expect.soft(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  // T18..T20 — varredura de saúde: overflow nos dois eixos, vazamento técnico, rótulos, alvos.
  const ov = await overflow(page);
  expect.soft(ov.x, `${SUB}/T18 sem overflow horizontal a 390px`).toBeLessThanOrEqual(1);
  await varreduraDeSaude(page, info, SUB, "calculadora mobile dark", { alvos: true });
  executado(info, SUB, "acessibilidade");
  executado(info, SUB, "acolhimento");

  // T21 — nenhum erro de console durante toda a bateria.
  if (con.erros.length > 0) {
    defeito(info, {
      subcenario: SUB,
      categoria: "estabilidade",
      descricao: `${con.erros.length} erro(s) de console durante a bateria da calculadora`,
      resultado_esperado: "Console limpo",
      resultado_obtido: con.erros.slice(0, 5).join(" | "),
      severidade: "media",
    });
  }
  executado(info, SUB, "estabilidade");
});

// =====================================================================================
// CF-001-UI-02 — wide / light / anônimo
// =====================================================================================
test("CF-001-UI-02 — wide light anônimo: mesma aritmética, contraste e geometria no tema claro", async ({
  page,
}, info) => {
  const SUB = "CF-001-UI-02";
  await aplicarSubcenario(page, { viewport: "V3", tema: "light" });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  const esperado = recalcular(SEMENTE);
  const tela = await lerTela(page);
  executado(info, SUB, "calculo");
  expect
    .soft(tela.custoTotal, `${SUB}/T01 custo total no wide`)
    .toBeCloseTo(esperado.custoTotal, 2);
  expect.soft(tela.varejo, `${SUB}/T02 varejo no wide`).toBeCloseTo(esperado.varejo, 2);
  expect.soft(tela.atacado, `${SUB}/T03 atacado no wide`).toBeCloseTo(esperado.atacado, 2);

  // T04 — o tema realmente aplicou (senão o teste de contraste abaixo mede o tema errado).
  const tema = await page.evaluate(() => document.documentElement.dataset.theme);
  expect.soft(tema, `${SUB}/T04 tema claro aplicado`).toBe("light");
  executado(info, SUB, "tema");

  // T05..T08 — geometria: nada nasce fora da viewport, nada rola na horizontal.
  const fora = await foraDaViewport(page, "button, a, input, [role='tab']");
  if (fora.length > 0) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao: `${fora.length} elemento(s) interativo(s) fora da viewport no wide claro`,
      resultado_esperado: "Todo controle dentro dos limites horizontais da viewport",
      resultado_obtido: fora.slice(0, 5).join(" ;; "),
      severidade: "alta",
    });
  }
  executado(info, SUB, "layout");

  // T09..T14 — contraste WCAG no claro (a lição do 016: honestidade que ninguém lê não é honesta).
  await varreduraDeSaude(page, info, SUB, "calculadora wide light", { contraste: true });
  executado(info, SUB, "acessibilidade");

  // T15..T20 — teclado: dá para percorrer o formulário inteiro e ver onde se está. A medição
  // compara o elemento FOCADO com ele mesmo SEM foco (ver `focoInvisivel`) — indicador por
  // mudança de fundo conta, e um item cujo realce de foco é igual ao de "ativo" não conta.
  const semFoco = await focoInvisivel(page, 18);
  if (semFoco.length > 0) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acessibilidade",
      descricao: `${semFoco.length} elemento(s) sem NENHUMA mudança visual ao receber foco por teclado: ${semFoco.join(", ")}`,
      resultado_esperado:
        "WCAG 2.4.7 — o foco muda algo visível (contorno, sombra, fundo, borda ou cor)",
      resultado_obtido: `estilo idêntico com e sem foco: ${semFoco.join(", ")}`,
      severidade: "media",
    });
  }
  executado(info, SUB, "acessibilidade");
});

// =====================================================================================
// CF-002 — tempo de impressão em h+min
// =====================================================================================
test("CF-002-UI-01 — h+min: conversão correta e defesa contra entradas absurdas", async ({
  page,
}, info) => {
  const SUB = "CF-002-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await page.goto("/calcular");
  const horas = page.getByRole("textbox", { name: t.calculator.timeInput.hoursAria });
  const minutos = page.getByRole("textbox", { name: t.calculator.timeInput.minutesAria });
  await expect(horas).toBeVisible();

  const casos: { h: string; min: string; esperadoHoras: number | null; nota: string }[] = [
    { h: "5", min: "0", esperadoHoras: 5, nota: "base" },
    { h: "5", min: "30", esperadoHoras: 5.5, nota: "meia hora" },
    { h: "0", min: "45", esperadoHoras: 0.75, nota: "menos de uma hora" },
    { h: "2", min: "90", esperadoHoras: 3.5, nota: "minutos acima de 60" },
    { h: "0", min: "1", esperadoHoras: 1 / 60, nota: "um minuto" },
    { h: "", min: "", esperadoHoras: 0, nota: "tudo vazio" },
    { h: "-3", min: "0", esperadoHoras: null, nota: "horas negativas" },
    { h: "2,5", min: "0", esperadoHoras: null, nota: "decimal em campo de horas" },
    { h: "abc", min: "xyz", esperadoHoras: null, nota: "texto" },
    { h: "100000", min: "0", esperadoHoras: 100000, nota: "horas absurdas" },
  ];

  for (const [i, c] of casos.entries()) {
    await horas.fill(c.h);
    await minutos.fill(c.min);
    await minutos.blur();
    executado(info, SUB, "input_invalido");
    const tela = await lerTela(page);
    const corpo = await page.locator("body").innerText();
    if (/NaN|Infinity|\[object Object\]/.test(corpo)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "input_invalido",
        descricao: `T${i + 1}: h="${c.h}" min="${c.min}" (${c.nota}) gerou valor cru de JS`,
        resultado_esperado: "Mensagem em pt-BR ou contribuição zero",
        resultado_obtido: /NaN|Infinity|\[object Object\]/.exec(corpo)?.[0] ?? "",
        severidade: "alta",
      });
    }
    if (c.esperadoHoras !== null && tela.energia !== null) {
      // energia = horas × 0,12 × 1,00 — o único caminho em que o tempo aparece isolado.
      const energiaEsperada = m2(c.esperadoHoras * SEMENTE.avgPowerKw * SEMENTE.tariffPerKwh);
      expect
        .soft(tela.energia, `${SUB}/T${i + 1} energia para ${c.h}h${c.min}min (${c.nota})`)
        .toBeCloseTo(energiaEsperada, 2);
      if (Math.abs(tela.energia - energiaEsperada) > 0.005) {
        defeito(info, {
          subcenario: SUB,
          categoria: "calculo",
          descricao: `Conversão h+min errada para ${c.h}h ${c.min}min (${c.nota})`,
          resultado_esperado: `energia ${energiaEsperada}`,
          resultado_obtido: String(tela.energia),
          severidade: "critica",
        });
      }
    }
  }

  // Colagem de um valor formatado direto no campo.
  await horas.fill("");
  await horas.type("1 2");
  await horas.blur();
  executado(info, SUB, "usuario_burro");
  await varreduraDeSaude(page, info, SUB, "campo h+min após entradas absurdas");
});

// =====================================================================================
// CF-003 — custo de máquina por ritmo
// =====================================================================================
test("CF-003-UI-01 — modo ritmo: as combinações derivam a vida útil e o R$/h declarado bate", async ({
  page,
}, info) => {
  const SUB = "CF-003-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  // O controle de ritmo existe? (a primeira visita nasce nele — 016/PR-C B1)
  const ritmo = page.getByText(t.calculator.machineCost.ritmoLabel);
  const temRitmo = await ritmo.isVisible().catch(() => false);
  executado(info, SUB, "fluxo");
  if (!temRitmo) {
    defeito(info, {
      subcenario: SUB,
      categoria: "fluxo",
      descricao:
        "A primeira visita não nasce no modo ritmo (a pergunta de frequência não está visível)",
      resultado_esperado: `Pergunta "${t.calculator.machineCost.ritmoLabel}" visível na primeira visita`,
      resultado_obtido: "não encontrada",
      severidade: "media",
    });
    return;
  }

  // A frase "≈ R$ X por hora" precisa bater com valor/vidaÚtil.
  const corpo = await page.locator("body").innerText();
  const mHora = /≈\s*R\$\s*([\d.]+,\d{2})/.exec(corpo);
  const telaAntes = await lerTela(page);
  if (mHora && telaAntes.maquina !== null) {
    const porHora = brl(mHora[1]);
    const esperadoMaquina = m2(porHora * SEMENTE.printTimeHours);
    expect
      .soft(telaAntes.maquina, `${SUB}/T01 linha Máquina ≈ R$/h declarado × horas`)
      .toBeCloseTo(esperadoMaquina, 1);
    const tolerancia = SEMENTE.printTimeHours * 0.005 + 0.005; // o "≈" declara o arredondamento
    if (Math.abs(telaAntes.maquina - esperadoMaquina) > tolerancia) {
      defeito(info, {
        subcenario: SUB,
        categoria: "calculo",
        descricao: "O R$/h anunciado na tela não multiplica para a linha Máquina exibida",
        resultado_esperado: `${porHora} × ${SEMENTE.printTimeHours}h = ${esperadoMaquina}`,
        resultado_obtido: String(telaAntes.maquina),
        severidade: "alta",
      });
    }
  } else {
    defeito(info, {
      subcenario: SUB,
      categoria: "acolhimento",
      descricao: "O modo ritmo não diz em voz alta quanto custa a hora de máquina",
      resultado_esperado: "Uma frase '≈ R$ X por hora' visível ao lado das escolhas",
      resultado_obtido: "frase ausente",
      severidade: "media",
    });
  }
  executado(info, SUB, "calculo");

  // Troca de ritmo/anos: o custo tem de MUDAR (senão o controle é decorativo).
  const antes = (await lerTela(page)).maquina;
  const opcoes = page
    .getByRole("radio")
    .or(page.getByRole("button", { name: /Poucas horas|Quase todo dia|dia todo/ }));
  const nOp = await opcoes.count();
  if (nOp >= 2) {
    await opcoes
      .first()
      .click()
      .catch(() => undefined);
    await page.waitForTimeout(300);
    const depois = (await lerTela(page)).maquina;
    executado(info, SUB, "fluxo");
    if (antes !== null && depois !== null && antes === depois) {
      defeito(info, {
        subcenario: SUB,
        categoria: "fluxo",
        descricao: "Mudar o ritmo da máquina não alterou o custo de máquina",
        resultado_esperado: "Outro ritmo ⇒ outra vida útil ⇒ outro R$/h",
        resultado_obtido: `Máquina permaneceu em ${antes}`,
        severidade: "alta",
      });
    }
  }
  await varreduraDeSaude(page, info, SUB, "bloco de custo de máquina", { alvos: true });
});

// =====================================================================================
// CF-004 — outros custos itemizados
// =====================================================================================
test("CF-004-UI-02 — 20 sub-custos: soma, nomes gigantes, duplicados e remoção do meio", async ({
  page,
}, info) => {
  const SUB = "CF-004-UI-02";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  const adicionar = page.getByRole("button", { name: t.calculator.outrosCustos.addCost });
  await expect(adicionar).toBeVisible();

  const valores: number[] = [];
  const nomes = [
    "Embalagem",
    "Embalagem", // duplicado de propósito
    "", // em branco (deve cair no rótulo genérico)
    "A".repeat(300), // gigante
    "Taxa 🎁 emoji",
    "<script>alert(1)</script>",
  ];
  for (let i = 0; i < 20; i += 1) {
    await adicionar.click();
    const nome = nomes[i % nomes.length];
    const valor = (i + 1) * 1.11;
    valores.push(m2(valor));
    const campoNome = page.getByRole("textbox", { name: /^Nome do custo$/ }).nth(i);
    const campoValor = page.getByRole("textbox", { name: /^Valor$/ }).nth(i);
    await campoNome.fill(nome).catch(() => undefined);
    await campoValor.fill(String(valor).replace(".", ",")).catch(() => undefined);
    await campoValor.blur().catch(() => undefined);
  }
  executado(info, SUB, "estresse_de_dados");

  // T01 — o custo total tem de subir exatamente pela soma declarada.
  const esperado = recalcular({ ...SEMENTE, outros: valores });
  const tela = await lerTela(page);
  expect
    .soft(tela.custoTotal, `${SUB}/T01 custo total com 20 sub-custos`)
    .toBeCloseTo(esperado.custoTotal, 2);
  if (tela.custoTotal !== null && Math.abs(tela.custoTotal - esperado.custoTotal) > 0.02) {
    defeito(info, {
      subcenario: SUB,
      categoria: "calculo",
      descricao: "A soma de 20 sub-custos não bate com o custo total exibido",
      resultado_esperado: String(esperado.custoTotal),
      resultado_obtido: String(tela.custoTotal),
      severidade: "critica",
    });
  }

  // T02 — nome gigante não pode estourar o layout.
  const ov = await overflow(page);
  expect
    .soft(ov.x, `${SUB}/T02 nome de 300 caracteres não gera rolagem horizontal`)
    .toBeLessThanOrEqual(1);
  const culpados = await culpadosDoOverflow(page);
  if (ov.x > 1) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      evidencia: culpados.join(" ;; "),
      descricao: `Nome de sub-custo com 300 caracteres gerou ${ov.x}px de overflow horizontal. Culpados: ${culpados.slice(0, 3).join(" ;; ")}`,
      resultado_esperado: "Texto longo trunca ou quebra, sem rolagem horizontal",
      resultado_obtido: `${ov.x}px`,
      severidade: "media",
    });
  }

  // T03 — o conteúdo tipo script NÃO pode ser interpretado (é texto do vendedor).
  const executouScript = await page.evaluate(
    () => (window as unknown as { __xss?: boolean }).__xss === true,
  );
  expect.soft(executouScript, `${SUB}/T03 conteúdo do vendedor nunca é executado`).toBeFalsy();
  executado(info, SUB, "seguranca");

  // T04 — remover uma linha do MEIO recalcula certo (a classe clássica de bug de índice).
  const remover = page.getByRole("button", { name: t.calculator.outrosCustos.removeCost });
  if ((await remover.count()) >= 10) {
    await remover.nth(9).click();
    const restantes = valores.filter((_, i) => i !== 9);
    const esperado2 = recalcular({ ...SEMENTE, outros: restantes });
    const tela2 = await lerTela(page);
    expect
      .soft(tela2.custoTotal, `${SUB}/T04 remover a 10ª linha recalcula corretamente`)
      .toBeCloseTo(esperado2.custoTotal, 2);
    if (tela2.custoTotal !== null && Math.abs(tela2.custoTotal - esperado2.custoTotal) > 0.02) {
      defeito(info, {
        subcenario: SUB,
        categoria: "calculo",
        descricao: "Remover um sub-custo do meio da lista deixou o total errado",
        resultado_esperado: String(esperado2.custoTotal),
        resultado_obtido: String(tela2.custoTotal),
        severidade: "critica",
      });
    }
  }
  executado(info, SUB, "usuario_burro");

  // T05 — valor negativo em sub-custo.
  const campoValor0 = page.getByRole("textbox", { name: /^Valor$/ }).first();
  await campoValor0.fill("-100");
  await campoValor0.blur();
  executado(info, SUB, "input_invalido");
  await varreduraDeSaude(page, info, SUB, "outros custos com 20 linhas");
});

// =====================================================================================
// CF-005 — detalhamento
// =====================================================================================
test("CF-005-UI-01 — detalhamento: cada linha tem unidade legível e a soma fecha", async ({
  page,
}, info) => {
  const SUB = "CF-005-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  // T01 — a seção existe e nomeia o que faz.
  await expect
    .soft(
      page.getByText(t.calculator.sections.breakdown),
      `${SUB}/T01 seção de detalhamento presente`,
    )
    .toBeVisible();
  executado(info, SUB, "acolhimento");

  // T02..T07 — todas as 6 linhas com valor monetário formatado em pt-BR.
  const corpo = await page.locator("body").innerText();
  for (const rot of [
    t.calculator.results.material,
    t.calculator.results.energy,
    t.calculator.results.machine,
    t.calculator.results.custoTotal,
    t.calculator.results.varejo,
    t.calculator.results.atacado,
  ]) {
    const re = new RegExp(`${rot}[\\s\\S]{0,40}?R\\$\\s*[\\d.]+,\\d{2}`);
    if (!re.test(corpo)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "acolhimento",
        descricao: `A linha "${rot}" não mostra um valor em R$ formatado em pt-BR ao lado do rótulo`,
        resultado_esperado: `"${rot}" seguido de R$ com vírgula decimal`,
        resultado_obtido: "não encontrado no texto renderizado",
        severidade: "media",
      });
    }
    executado(info, SUB, "acolhimento");
  }

  // T08 — nenhum número aparece sem unidade/moeda ao lado (regra do leigo).
  const numerosSoltos = await page.evaluate(() => {
    const soltos: string[] = [];
    for (const el of Array.from(document.querySelectorAll("dd,span,strong,b"))) {
      const txt = (el.textContent ?? "").trim();
      if (/^\d+[.,]\d{2}$/.test(txt)) soltos.push(txt);
    }
    return soltos;
  });
  if (numerosSoltos.length > 0) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acolhimento",
      descricao: `${numerosSoltos.length} valor(es) monetário(s) exibido(s) sem "R$" ao lado`,
      resultado_esperado: "Todo valor de dinheiro carrega o símbolo da moeda",
      resultado_obtido: numerosSoltos.slice(0, 6).join(", "),
      severidade: "baixa",
    });
  }
  executado(info, SUB, "acolhimento");

  await varreduraDeSaude(page, info, SUB, "detalhamento mobile", { alvos: true });
});

// =====================================================================================
// CF-001-UI-03 — faixa do meio (1024px) com premium
// =====================================================================================
test("CF-001-UI-03 — 1024px premium: a faixa do meio não regride o cálculo nem o layout", async ({
  page,
}, info) => {
  const SUB = "CF-001-UI-03";
  await aplicarSubcenario(page, { viewport: "V2", tema: "dark" });
  await premium(page, `calc-${info.workerIndex}`);
  await page.goto("/calcular");
  await expect(page.getByRole("heading", { name: t.calculator.title })).toBeVisible();

  const esperado = recalcular(SEMENTE);
  const tela = await lerTela(page);
  executado(info, SUB, "calculo");
  expect
    .soft(tela.custoTotal, `${SUB}/T01 custo total a 1024px`)
    .toBeCloseTo(esperado.custoTotal, 2);

  // A 1024px NÃO existe rail colapsável (só a partir de 1280).
  const temToggleRail = await page
    .getByRole("button", { name: /recolher|expandir/i })
    .first()
    .isVisible()
    .catch(() => false);
  executado(info, SUB, "layout");
  if (temToggleRail) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao: "Botão de recolher a barra lateral aparece a 1024px, abaixo do corte de 1280px",
      resultado_esperado: "Rail colapsável só a partir de 1280px (use-is-wide.ts)",
      resultado_obtido: "botão visível a 1024px",
      severidade: "baixa",
    });
  }
  await varreduraDeSaude(page, info, SUB, "calculadora a 1024px premium", { contraste: true });
});
