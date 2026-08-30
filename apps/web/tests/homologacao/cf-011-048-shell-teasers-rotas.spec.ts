import { expect, test, type Page } from "@playwright/test";

import {
  aplicarSubcenario,
  culpadosDoOverflow,
  defeito,
  executado,
  falhaDeServidor,
  focoInvisivel,
  offline,
  overflow,
  signUp,
  t,
  varreduraDeSaude,
  type ViewportId,
} from "./_harness";

// CF-011 · CF-020 · CF-032(free) · CF-036(free) · CF-040..CF-048 — a superfície PÚBLICA e o shell.
// É onde o "usuário burro" chega primeiro, e onde o round 1 do dono concentrou 5 dos 15 pontos.

const PUBLICAS = ["/calcular", "/catalogo", "/kits", "/historico", "/privacidade"] as const;

// 019/PR-B (T109) — a parede saiu (FR-1906): o "teaser" que se conta agora é o VAZIO DIDÁTICO
// (título da feature, não do plano) — e o convite único continua sendo "Assinar Premium".
const TEASERS: { rota: string; titulo: string }[] = [
  { rota: "/catalogo", titulo: t.catalogo.emptyFilamentsTitle },
  { rota: "/kits", titulo: t.catalogo.emptyKitsTitle },
  { rota: "/historico", titulo: t.historico.didaticoTitle },
];

/** Palavras que denunciam um erro sendo mostrado onde deveria haver uma oferta honesta. */
const CHEIRO_DE_ERRO =
  /não foi possível|nao foi possivel|erro|falhou|tente novamente|indisponível|indisponivel/i;

async function abrir(page: Page, rota: string): Promise<void> {
  await page.goto(rota);
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

// =====================================================================================
// CF-047 / CF-046 / varredura transversal — toda rota pública, 3 larguras × 2 temas
// =====================================================================================
for (const viewport of ["V1", "V2", "V3"] as ViewportId[]) {
  for (const tema of ["dark", "light"] as const) {
    test(`CF-043/046/047-UI — varredura de todas as rotas públicas em ${viewport}/${tema}`, async ({
      page,
    }, info) => {
      const SUB = `CF-043-UI-${viewport}-${tema}`;
      await aplicarSubcenario(page, { viewport, tema });

      for (const rota of PUBLICAS) {
        await abrir(page, rota);
        executado(info, SUB, "acolhimento");

        // A rota renderizou ALGUMA coisa e não vazou linguagem de máquina.
        await varreduraDeSaude(page, info, SUB, `${rota} em ${viewport}/${tema}`, {
          contraste: true,
          alvos: viewport === "V1",
        });

        // Overflow horizontal com o culpado nomeado (medir sem nomear não conserta nada).
        const ov = await overflow(page);
        if (ov.x > 1) {
          defeito(info, {
            subcenario: SUB,
            categoria: "layout",
            descricao: `${rota} rola na horizontal (${ov.x}px) em ${viewport}/${tema}`,
            resultado_esperado: "Nenhuma rolagem horizontal em nenhuma largura suportada",
            resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 4).join(" ;; "),
            severidade: "media",
          });
        }
        executado(info, SUB, "layout");
      }

      // CF-047 — 404 de 1 e de 2 segmentos (a classe do follow-up A4: a rota de 2 segmentos
      // engolindo o 404 e entregando uma página em branco).
      for (const inexistente of ["/rota-que-nao-existe", "/catalogo/nao-existe-mesmo"]) {
        await abrir(page, inexistente);
        executado(info, SUB, "acolhimento");
        const corpo = await page.locator("body").innerText();
        const achou404 = corpo.includes(t.notFound.title) || corpo.includes(t.notFound.body);
        if (!achou404) {
          defeito(info, {
            subcenario: SUB,
            categoria: "acolhimento",
            descricao: `${inexistente} não mostrou a página de "não encontrado" em ${viewport}/${tema}`,
            resultado_esperado: `Página amigável com "${t.notFound.title}"`,
            resultado_obtido: corpo.trim().slice(0, 160) || "(tela vazia)",
            severidade: corpo.trim().length < 20 ? "alta" : "media",
          });
        }
        await varreduraDeSaude(page, info, SUB, `404 ${inexistente}`);
      }
    });
  }
}

// =====================================================================================
// CF-020 / CF-011 / CF-032 — o teaser honesto: anônimo e free veem A MESMA coisa
// =====================================================================================
test("CF-020/CF-011 — anônimo: um teaser por aba, sem erro e sem botão morto", async ({
  page,
}, info) => {
  const SUB = "CF-020-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });

  for (const { rota, titulo } of TEASERS) {
    await abrir(page, rota);
    executado(info, SUB, "gate_premium");

    // Exatamente UM teaser (016/US1: "um teaser, nunca dois").
    const quantos = await page.getByText(titulo).count();
    if (quantos !== 1) {
      defeito(info, {
        subcenario: SUB,
        categoria: "gate_premium",
        descricao: `${rota} mostra ${quantos} vez(es) o teaser "${titulo}" para o visitante anônimo`,
        resultado_esperado: "Exatamente 1 teaser por aba",
        resultado_obtido: `${quantos} ocorrência(s)`,
        severidade: quantos === 0 ? "alta" : "media",
      });
    }

    // O caminho de assinatura precisa existir e estar clicável.
    const cta = page
      .getByRole("link", { name: /Assinar Premium/i })
      .or(page.getByRole("button", { name: /Assinar Premium/i }));
    if ((await cta.count()) === 0) {
      defeito(info, {
        subcenario: SUB,
        categoria: "gate_premium",
        descricao: `${rota} não oferece nenhum caminho para assinar o Premium`,
        resultado_esperado: 'Um botão "Assinar Premium" visível',
        resultado_obtido: "nenhum CTA encontrado",
        severidade: "alta",
      });
    }
    executado(info, SUB, "gate_premium");

    // Round 1, pontos 13/14: os botões "Entrar", "Entendi" e "Ir para a calculadora" saíram.
    for (const morto of ["Entendi", "Ir para a calculadora"]) {
      const n = await page.getByRole("button", { name: morto, exact: true }).count();
      if (n > 0) {
        defeito(info, {
          subcenario: SUB,
          categoria: "gate_premium",
          descricao: `${rota} ainda mostra o botão "${morto}", que o dono pediu para remover (relatório rodada 1)`,
          resultado_esperado: "Só título + subtítulo + Assinar Premium",
          resultado_obtido: `botão "${morto}" presente`,
          severidade: "media",
        });
      }
      executado(info, SUB, "gate_premium");
    }
  }
});

test("CF-020-UI-02 — logado FREE vê o mesmo que o anônimo, jamais um erro (rodada 1, ponto 15)", async ({
  page,
}, info) => {
  const SUB = "CF-020-UI-02";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await signUp(page, `free-${info.workerIndex}`); // sem grant: free de verdade

  for (const { rota, titulo } of TEASERS) {
    await abrir(page, rota);
    executado(info, SUB, "gate_premium");

    const visivel = await page
      .getByText(titulo)
      .first()
      .isVisible()
      .catch(() => false);
    if (!visivel) {
      defeito(info, {
        subcenario: SUB,
        categoria: "gate_premium",
        descricao: `${rota}: o usuário logado FREE não vê o teaser "${titulo}"`,
        resultado_esperado: "Free vê exatamente o que o anônimo vê",
        resultado_obtido: (await page.locator("body").innerText()).trim().slice(0, 200),
        severidade: "alta",
      });
    }

    // O ponto 15 do dono: free NÃO pode encontrar erro de verificação de premium.
    const corpo = await page.locator("body").innerText();
    const m = CHEIRO_DE_ERRO.exec(corpo);
    if (m) {
      defeito(info, {
        subcenario: SUB,
        categoria: "gate_premium",
        descricao: `${rota}: usuário FREE encontra linguagem de ERRO ("${m[0]}") onde deveria haver a oferta`,
        resultado_esperado: "Nenhuma mensagem de erro para quem apenas não é premium",
        resultado_obtido: corpo.slice(Math.max(0, m.index - 60), m.index + 90).replace(/\n/g, " "),
        severidade: "alta",
      });
    }
    executado(info, SUB, "gate_premium");
  }
});

test("CF-045-UI-02 — falha de rede NUNCA pode ser vendida como 'você não é premium'", async ({
  page,
}, info) => {
  const SUB = "CF-045-UI-02";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await signUp(page, `net-${info.workerIndex}`);

  // O servidor QUEBRA na leitura de entitlement — o produto não sabe se a conta é premium.
  await falhaDeServidor(page, "**/api/v1/entitlement", 500);
  for (const { rota, titulo } of TEASERS) {
    await abrir(page, rota);
    executado(info, SUB, "rede");
    const corpo = await page.locator("body").innerText();
    // 019/PR-B: o vazio didático pode aparecer (a LISTA respondeu 403 — é a palavra do servidor);
    // o que não pode é o CONVITE afirmar "você não é premium" sem o plano verificado.
    const mostraTeaser = corpo.includes(titulo) && /Assinar Premium/i.test(corpo);
    const admiteQueNaoSabe =
      /não conseguimos|nao conseguimos|tente|verificar|conexão|conexao|offline/i.test(corpo);
    if (mostraTeaser && !admiteQueNaoSabe) {
      defeito(info, {
        subcenario: SUB,
        categoria: "acolhimento",
        descricao: `${rota}: com a verificação de plano FALHANDO (500), a tela afirma o estado free sem dizer que não conseguiu verificar`,
        resultado_esperado:
          "Estado honesto: 'não conseguimos verificar agora', com caminho de retentativa",
        resultado_obtido: "teaser de free mostrado como se o estado fosse conhecido",
        severidade: "alta",
      });
    }
    await varreduraDeSaude(page, info, SUB, `${rota} com entitlement 500`);
  }
});

// =====================================================================================
// CF-041 / CF-048 — guardas, retorno ao destino e redirects legados
// =====================================================================================
test("CF-041/CF-048 — guardas de rota, retorno ao destino e proteção contra open-redirect", async ({
  page,
}, info) => {
  const SUB = "CF-041-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });

  // T01 — /conta anônimo bounce para /sign-in carregando o destino.
  await abrir(page, "/conta");
  executado(info, SUB, "sessao");
  if (!page.url().includes("/sign-in")) {
    defeito(info, {
      subcenario: SUB,
      categoria: "sessao",
      descricao: "/conta não redirecionou o visitante anônimo para a tela de entrada",
      resultado_esperado: "/sign-in?redirect=/conta",
      resultado_obtido: page.url(),
      severidade: "alta",
    });
  }

  // T02..T05 — alvo externo NUNCA pode ser aceito como retorno (open-redirect).
  //
  // A guarda mora no COMPLETAR o login (`safeRedirect`, router.tsx:43), nao no abrir a tela: um
  // visitante anonimo em `/sign-in?redirect=<externo>` simplesmente fica ali, e a URL carregar o
  // parametro nao prova nada. A primeira versao deste teste afirmava o contrario e registrou duas
  // "criticas" que nao existiam. Aqui a sessao e realmente autenticada e o POUSO e o que se mede.
  for (const malicioso of [
    "https://exemplo-malicioso.test",
    "//exemplo-malicioso.test",
    "/../etc/passwd",
    "javascript:alert(1)",
  ]) {
    await page.context().clearCookies();
    await page.goto(`/sign-in?redirect=${encodeURIComponent(malicioso)}`);
    await page.waitForFunction(() => "__e2eAuth" in window);
    const email = `hom-redir-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.local`;
    await page.evaluate((em: string) => {
      const w = window as unknown as {
        __e2eAuth?: { signUp: (e: string, p: string) => Promise<void> };
      };
      void w.__e2eAuth?.signUp(em, "test-passw0rd");
    }, email);
    await page
      .waitForURL((u) => !u.pathname.includes("/sign-in"), { timeout: 30_000 })
      .catch(() => undefined);
    await page.waitForTimeout(400);
    executado(info, SUB, "seguranca");
    const pouso = decodeURIComponent(page.url());
    if (/exemplo-malicioso|javascript:|etc\/passwd/i.test(pouso)) {
      defeito(info, {
        subcenario: SUB,
        categoria: "seguranca",
        descricao: `Apos o login, o destino externo "${malicioso}" foi honrado como retorno`,
        resultado_esperado:
          "Alvo fora da lista interna e descartado — o login termina em /calcular",
        resultado_obtido: pouso,
        severidade: "critica",
      });
    }
    await page.evaluate(() => {
      const w = window as unknown as { __e2eAuth?: { signOut?: () => Promise<void> } };
      void w.__e2eAuth?.signOut?.();
    });
  }

  // T06..T08 — URLs legadas de 2 segmentos: redirecionam preservando o id, sem tela branca.
  for (const [legada, esperado] of [
    ["/catalogo/produtos/novo", "produto=novo"],
    ["/catalogo/produtos/abc-123", "produto=abc-123"],
    ["/historico/xyz-999", "snapshot=xyz-999"],
  ]) {
    await abrir(page, legada);
    executado(info, SUB, "rota");
    const url = decodeURIComponent(page.url());
    const branca = (await page.locator("body").innerText()).trim().length < 20;
    if (branca) {
      defeito(info, {
        subcenario: SUB,
        categoria: "rota",
        descricao: `A URL legada ${legada} abriu uma TELA EM BRANCO`,
        resultado_esperado: "Redirecionar para a forma nova preservando o id",
        resultado_obtido: `tela vazia em ${url}`,
        severidade: "critica",
      });
    } else if (!url.includes(esperado) && !url.includes("/sign-in")) {
      defeito(info, {
        subcenario: SUB,
        categoria: "rota",
        descricao: `A URL legada ${legada} perdeu o identificador ao redirecionar`,
        resultado_esperado: `URL contendo ${esperado} (ou o bounce para /sign-in preservando-o)`,
        resultado_obtido: url,
        severidade: "alta",
      });
    }
  }
});

// =====================================================================================
// CF-044 — tema: persistência, ausência de flash e controle segmentado desktop-only
// =====================================================================================
test("CF-044 — tema persiste, não pisca e o controle segmentado é só do desktop", async ({
  page,
}, info) => {
  const SUB = "CF-044-UI-01";
  // SEM `aplicarSubcenario` de proposito: o init script dele reescreve o tema no localStorage a
  // CADA carregamento, inclusive no reload — o que fazia a escolha do usuario "nao persistir" e
  // gerava um defeito de flash que era do harness, nao do produto.
  await page.setViewportSize({ width: 390, height: 844 });
  await abrir(page, "/calcular");

  const alternar = page.getByRole("button", { name: t.theme.toggle }).first();
  const temAlternar = await alternar.isVisible().catch(() => false);
  executado(info, SUB, "tema");
  if (temAlternar) {
    await alternar.click();
    await page.waitForTimeout(150);
    const depois = await page.evaluate(() => document.documentElement.dataset.theme);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    // A leitura logo no DOMContentLoaded pega o script inline: se o tema salvo não estiver
    // aplicado AQUI, o usuário vê o tema errado por um quadro (o "flash").
    const naPrimeiraPintura = await page.evaluate(() => document.documentElement.dataset.theme);
    if (naPrimeiraPintura !== depois) {
      defeito(info, {
        subcenario: SUB,
        categoria: "tema",
        descricao:
          "O tema escolhido não está aplicado já na primeira pintura após recarregar (flash de tema errado)",
        resultado_esperado: `data-theme="${depois}" antes do React montar`,
        resultado_obtido: `data-theme="${naPrimeiraPintura}"`,
        severidade: "media",
      });
    }
    executado(info, SUB, "tema");
  }

  // O segmentado de tema é desktop-only (decisão 018): não pode aparecer a 390px.
  const segmentado = page.locator(".tf-segmented").first();
  const noMobile = await segmentado.isVisible().catch(() => false);
  if (noMobile) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao:
        "O controle segmentado de tema aparece no mobile, sendo uma decisão desktop-only (018)",
      resultado_esperado: "Segmentado só acima do corte de largura",
      resultado_obtido: "visível a 390px",
      severidade: "baixa",
    });
  }
  executado(info, SUB, "layout");
});

// =====================================================================================
// CF-043-UI-03/04 — rail colapsável só acima de 1280 e sobrevive ao redimensionamento
// =====================================================================================
test("CF-043-UI-03/04 — rail colapsa, persiste e nenhum corte de largura quebra a navegação", async ({
  page,
}, info) => {
  const SUB = "CF-043-UI-03";
  await aplicarSubcenario(page, { viewport: "V3", tema: "dark" });
  await abrir(page, "/calcular");

  const toggle = page.locator(".tf-nav__collapse").first();
  const temToggle = await toggle.isVisible().catch(() => false);
  executado(info, SUB, "layout");
  if (!temToggle) {
    defeito(info, {
      subcenario: SUB,
      categoria: "layout",
      descricao: "A 1440px não há botão para recolher a barra lateral (US5 do 018)",
      resultado_esperado: "Botão de recolher visível a partir de 1280px",
      resultado_obtido: "não encontrado",
      severidade: "media",
    });
  } else {
    await toggle.click();
    await page.waitForTimeout(200);
    const recolhidoAntes = await page.evaluate(() =>
      document.querySelector(".tf-shell")?.getAttribute("data-rail"),
    );
    await page.reload();
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const recolhidoDepois = await page.evaluate(() =>
      document.querySelector(".tf-shell")?.getAttribute("data-rail"),
    );
    if (recolhidoAntes !== recolhidoDepois) {
      defeito(info, {
        subcenario: SUB,
        categoria: "layout",
        descricao: "O estado recolhido da barra lateral não sobrevive ao recarregar",
        resultado_esperado: `data-rail continua "${recolhidoAntes}"`,
        resultado_obtido: `virou "${recolhidoDepois}"`,
        severidade: "media",
      });
    }
    executado(info, SUB, "layout");
  }

  // Atravessa os DOIS cortes (1280 e 425) num único ciclo de vida da página.
  for (const w of [1440, 1279, 1024, 426, 425, 390, 1440]) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(180);
    executado(info, SUB, "layout");
    const ov = await overflow(page);
    if (ov.x > 1) {
      defeito(info, {
        subcenario: SUB,
        categoria: "layout",
        descricao: `Redimensionar para ${w}px gerou ${ov.x}px de rolagem horizontal`,
        resultado_esperado: "Nenhuma largura entre 390 e 1440 gera rolagem horizontal",
        resultado_obtido: (await culpadosDoOverflow(page)).slice(0, 3).join(" ;; "),
        severidade: "media",
      });
    }
    const navVisivel = await page
      .getByRole("link", { name: t.nav.calcular })
      .first()
      .isVisible()
      .catch(() => false);
    if (!navVisivel) {
      defeito(info, {
        subcenario: SUB,
        categoria: "layout",
        descricao: `A ${w}px o item de navegação "${t.nav.calcular}" deixou de ser visível`,
        resultado_esperado: "A navegação existe em toda largura suportada",
        resultado_obtido: "item não visível",
        severidade: "alta",
      });
    }
  }
});

// =====================================================================================
// CF-045-UI-01 — offline: o cálculo continua e o aviso é honesto
// =====================================================================================
test("CF-045-UI-01 — offline: a calculadora continua funcionando e o aviso aparece", async ({
  page,
  context,
}, info) => {
  const SUB = "CF-045-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await abrir(page, "/calcular");
  await offline(page, context);
  await page.waitForTimeout(400);
  executado(info, SUB, "rede");

  const corpo = await page.locator("body").innerText();
  if (!/sem conexão|sem conexao|offline|sem internet/i.test(corpo)) {
    defeito(info, {
      subcenario: SUB,
      categoria: "rede",
      descricao: "Ao perder a conexão, nenhuma faixa avisa o usuário do estado offline",
      resultado_esperado: "Aviso visível de que está sem conexão",
      resultado_obtido: "nenhuma menção a estado offline na tela",
      severidade: "media",
    });
  }

  // O motor é local: mudar um custo TEM de mudar o preço mesmo sem rede.
  const campo = page
    .getByRole("textbox", { name: new RegExp(t.calculator.fields.costPerRoll) })
    .first();
  await campo.fill("200,00");
  await campo.blur();
  await page.waitForTimeout(250);
  const depois = await page.locator("body").innerText();
  executado(info, SUB, "rede");
  if (!/R\$\s*20,00/.test(depois)) {
    defeito(info, {
      subcenario: SUB,
      categoria: "calculo",
      descricao:
        "Offline, dobrar o custo do rolo não atualizou a linha de material (esperado R$ 20,00)",
      resultado_esperado: "material = 200/1000 × 100 = R$ 20,00, calculado localmente",
      resultado_obtido: "linha de material não refletiu a mudança",
      severidade: "critica",
    });
  }
  await varreduraDeSaude(page, info, SUB, "calculadora offline");
});

// =====================================================================================
// CF-040 — a tela de entrada
// =====================================================================================
test("CF-040 — tela de entrada: acolhedora, acessível e sem jargão", async ({ page }, info) => {
  const SUB = "CF-040-UI-01";
  await aplicarSubcenario(page, { viewport: "V1", tema: "dark" });
  await abrir(page, "/sign-in");
  executado(info, SUB, "acolhimento");

  await expect
    .soft(page.getByRole("button", { name: new RegExp(t.signIn.google, "i") }).first())
    .toBeVisible();

  const semFoco = await focoInvisivel(page, 8);
  if (semFoco.length > 0) {
    defeito(info, {
      subcenario: SUB,
      categoria: "acessibilidade",
      descricao: `Na tela de entrada, ${semFoco.length} elemento(s) não mudam nada ao receber foco: ${semFoco.join(", ")}`,
      resultado_esperado: "WCAG 2.4.7 — foco sempre visível",
      resultado_obtido: semFoco.join(", "),
      severidade: "media",
    });
  }
  executado(info, SUB, "acessibilidade");
  await varreduraDeSaude(page, info, SUB, "tela de entrada", { contraste: true, alvos: true });
});
