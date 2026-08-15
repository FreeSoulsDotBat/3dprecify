// Typed pt-BR message source (full i18n library is TD-001). Keys are the single source of UI copy.
//
// 016/US6 (FR-908, conteudo-tooltips.md §Notas de escopo #5) — two tooltip numbers carry an
// EXPIRY DATE (ANEEL's projected national average tariff, the legal minimum wage per hour) and
// live in their OWN named keys so the annual refresh is a VALUE edit, not a hunt through prose.
const TOOLTIP_REF_TARIFA_MEDIA_NACIONAL = "R$ 0,85"; // projeção ANEEL dez/2026 — revisar 1º/jan
const TOOLTIP_REF_SALARIO_MINIMO_HORA = "R$ 7,37"; // salário mínimo 2026 ÷ 220h — revisar 1º/jan

export const messages = {
  appName: "Precifica3D",
  theme: { toggle: "Alternar tema" },
  auth: {
    loading: "Verificando sessão…",
  },
  signIn: {
    title: "Entrar",
    // Calcular é público (US2/T038): o login dá acesso às áreas guardadas, não ao cálculo.
    subtitle: "Entre para acessar seu catálogo, orçamentos e conta.",
    google: "Entrar com Google",
    error: "Não foi possível entrar. Tente novamente.",
    // A33 Fase 1: erro Firebase `auth/network-request-failed` → mensagem específica de
    // offline (o login precisa de internet; o cálculo continua funcionando). Demais
    // erros mantêm a mensagem genérica acima.
    offline: "Você está offline. O login precisa de internet — o cálculo continua funcionando.",
    notConfigured: "Login indisponível: Firebase não configurado neste ambiente.",
  },
  // E1 full corrected pricing calculator (spec 004). US1 (correct retail + wholesale) +
  // US2 (transparent breakdown) are the MVP. Copy is pt-BR, i18n-ready (TD-001). The
  // `costPerRoll/rollWeight/grams/markup` keys are kept as the stable labels some pre-E1
  // e2e specs still address (migrated to the full model in T041); E1 adds the rest.
  calculator: {
    title: "Calcular preço",
    fields: {
      costPerRoll: "Custo do rolo",
      rollWeight: "Peso do rolo",
      grams: "Gramas usadas",
      markup: "Markup",
      printTime: "Tempo de impressão",
      avgPower: "Consumo médio",
      tariff: "Tarifa de energia",
      machineValue: "Valor da máquina",
      machineLifetime: "Vida útil da máquina",
      maintenance: "Reserva de manutenção",
      failure: "Taxa de falha",
      finishTime: "Tempo de acabamento",
      finishRate: "Valor do acabamento",
      laborHours: "Mão de obra (horas)",
      laborRate: "Valor da hora",
      markupVarejo: "Markup varejo",
      markupAtacado: "Markup atacado",
    },
    // avgPower tooltip is a mandated clarification (FR-022): the real average draw, not
    // the nameplate power printed on the machine.
    hints: {
      avgPower: "Consumo médio real da impressora, não a potência de placa (~0,12 kW).",
      markup: "Margem sobre o custo total (não sobre o preço de venda).",
    },
    sections: {
      inputs: "Custos da peça",
      // 016/PR-C homologação (R6) — "Ajustes opcionais" retired (US9-AC2, fused into "Custos da
      // peça"); the two keys that named it are dead now, removed rather than left unreferenced.
      labor: "Mão de obra e custos",
      markup: "Markup",
      breakdown: "Como chegamos no preço",
      marketplace: "Marketplace",
    },
    // Section info tooltips (E1 homologation item 8): honest, derived from the spec
    // formulas — never copied from the third-party Amado3D sheet. `label` names the ⓘ
    // trigger for assistive tech; `body` explains what/how each section calculates.
    sectionInfo: {
      inputs: {
        label: "Sobre os custos da peça",
        body: "O custo de produção da peça. Material = (custo do rolo ÷ peso do rolo) × gramas usadas. Energia = tempo de impressão × consumo médio × tarifa. Máquina = (valor da máquina ÷ vida útil em horas) × tempo de impressão.",
      },
      labor: {
        label: "Sobre mão de obra e custos",
        body: "Custos opcionais que somam ao total. Mão de obra = horas × valor da hora. Outros custos = um ou mais itens nomeados (embalagem, taxas, overhead), cada um somado ao custo total.",
      },
      outrosCustos: {
        label: "Sobre outros custos",
        // 016/US12 (FR-918) — "frete até a transportadora" saiu dos exemplos: com o canal de
        // marketplace dirigido pelo catálogo, o frete já tem campo próprio dentro do canal — citá-lo
        // aqui também sugeria dois lugares para o mesmo custo.
        body: "Itens nomeados que somam ao custo total: embalagem, etiqueta, taxas, overhead. A soma entra no custo total exatamente como um valor único faria, e cada item aparece na sua própria linha do detalhamento.",
      },
      markup: {
        label: "Sobre o markup",
        body: "A margem sobre o custo total. Preço = custo total × (1 + markup%). Varejo e atacado aplicam markups diferentes sobre o mesmo custo.",
      },
      breakdown: {
        label: "Sobre o cálculo do preço",
        body: "Cada linha em reais soma exatamente ao custo total; os preços vêm do custo total × markup.",
      },
      marketplace: {
        label: "Sobre o marketplace",
        body: "Calcula o preço para anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa.",
      },
    },
    // rollWeightError is the field-specific "> 0" message reused by the schema for the
    // roll weight (kept as its own key for the a11y e2e that asserts it verbatim).
    rollWeightError: "O peso do rolo deve ser maior que zero.",
    validation: {
      invalid: "Informe um número válido.",
      negative: "Não pode ser negativo.",
      required: "Campo obrigatório.",
      machineLifetimePositive: "A vida útil deve ser maior que zero.",
      commissionMax: "A comissão deve ser menor que 100%.",
      tooHigh: "Valor muito alto.",
    },
    // Homologação automatizada (2026-08-13) — os avisos de PLAUSIBILIDADE, para os nove achados
    // ALTA em que o número digitado é válido e significa outra coisa.
    //
    // Três regras de escrita, e as três vêm de decisões já tomadas neste produto:
    // 1. DESCRITIVO, nunca corretivo — o precedente é `avisoAtacadoAcimaDoVarejo`: "quem lê um
    //    aviso escrito como erro conclui que o produto recusou, e o produto não recusou".
    // 2. Toda frase termina em "Nada foi recusado." — é a promessa do §AVISO NUNCA VIRA VALIDAÇÃO
    //    dita ao usuário, e não só ao programador que lê `plausibilidade.ts`.
    // 3. Toda frase ENSINA a converter. O vendedor não errou por desatenção; ele errou porque a
    //    etiqueta da impressora fala em W e o campo pede kW. Dizer "valor alto" não resolve isso.
    plausibilidade: {
      // Review do PR #58 — a frase dizia "{v} kW é o de um chuveiro elétrico", e isso era FALSO
      // justamente nos dois valores para os quais o aviso foi escrito: 120 e 220 kW não são
      // chuveiro nenhum (um chuveiro fica em 4,5–7,5 kW, e é por isso que o limiar é 5). A frase
      // agora nomeia o LIMIAR, que é verdade, em vez de descrever o valor digitado.
      avgPower:
        "Confira o consumo: {v} kW. Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts: 120 W são 0,12 kW. Nada foi recusado.",
      // Review do PR #58 — esta frase citava "perto de R$ 0,95" enquanto o tooltip do MESMO campo
      // dizia R$ 0,85: duas médias nacionais diferentes para o mesmo fato, a uma tecla de
      // distância. Passa a ler a MESMA constante datada que o tooltip lê, então a revisão anual
      // move os dois juntos.
      tariff: `Confira a tarifa: R$ {v} por kWh está bem acima do que se paga no Brasil (perto de ${TOOLTIP_REF_TARIFA_MEDIA_NACIONAL}). Na conta de luz, divida o valor total pelos kWh do mês. Nada foi recusado.`,
      machineLifetime:
        "Confira a vida útil: {v} horas é menos de uma semana ligada. Se você pensou em anos, multiplique pelas horas que imprime por ano — 1.200 h/ano × 3 anos = 3.600 h. Nada foi recusado.",
      rollWeight:
        "Confira o peso do rolo: {v} kg. O rolo comum tem 1 kg — se você informou gramas, 1.000 g são 1 kg. Nada foi recusado.",
      laborRate:
        "Confira o valor da hora: R$ {v}. Se você informou quanto quer ganhar por mês, divida pelas horas do mês — R$ 3.000 ÷ 160 h = R$ 18,75. Nada foi recusado.",
      maintenance:
        "Confira a reserva de manutenção: R$ {v} por HORA. Se você informou o gasto do ano inteiro, divida pelas horas que imprime no ano. Nada foi recusado.",
      // Review do PR #58 — "são mais de {d} dias" era falso em todo múltiplo exato de 24, incluindo
      // 120 h (exatamente 5 dias), que é uma entrada plausível do próprio erro que o aviso caça.
      // "equivalem a" com uma casa decimal é verdade em qualquer valor.
      printTime:
        "Confira o tempo: {v} horas equivalem a {d} dias imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado.",
      grams:
        "Confira as gramas: {v} g são mais de 50 kg de filamento numa peça só. Se você informou o peso do ROLO, o campo pede o que a PEÇA consome. Nada foi recusado.",
      custoAbsurdo:
        "Confira os custos: R$ {v} para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais em algum campo. Nada foi recusado.",
      precoZero:
        "O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado.",
      comissaoBaixa:
        "Confira a comissão: {v}%. Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado.",
      quantidade:
        "Confira a quantidade: {v}. O máximo por peça é {max}. Acima disso o kit não consegue ser salvo. Nada foi recusado.",
    },
    results: {
      material: "Material",
      energy: "Energia",
      machine: "Máquina",
      failure: "Falha / perdas",
      finishing: "Acabamento",
      labor: "Mão de obra",
      custoTotal: "Custo total",
      varejo: "Preço varejo",
      atacado: "Preço atacado",
      precoAnuncio: "Preço para anunciar",
      recebidoLiquido: "Recebido líquido",
    },
    captions: {
      varejo: "Varejo",
      atacado: "Atacado",
      markup: "markup",
    },
    // 015/A8 ([F03a-003], decisao do dono 2026-08-03) — atacado acima do varejo e ENTRADA VALIDA:
    // o numero e do vendedor e o motor calcula sem reclamar. O que faltava era dizer que aconteceu.
    // A frase e deliberadamente descritiva ("ficou acima"), nunca corretiva ("corrija"): quem le um
    // aviso escrito como erro conclui que o produto recusou, e o produto nao recusou.
    avisoAtacadoAcimaDoVarejo:
      "O preco de atacado ficou acima do varejo. Nada foi recusado — so confira se e isso mesmo.",
    // US5 — "Outros custos" is a slot of 0..N named sub-costs (Embalagem, Etiqueta…); each value
    // soma ao custo_total exatamente como o campo único fazia, e aparece como sua própria linha no
    // detalhamento. `lineFallback` rotula uma linha cujo nome ficou em branco (FR-116).
    // 016/US12 (FR-918) — "frete até a transportadora" saiu do exemplo (ver `sectionInfo.outrosCustos`).
    outrosCustos: {
      title: "Outros custos",
      hint: "Embalagem, etiqueta, taxas, etc. Cada item soma ao custo total.",
      addCost: "Adicionar custo",
      removeCost: "Remover custo",
      name: "Nome do custo",
      namePlaceholder: "Ex.: Embalagem",
      value: "Valor",
      lineFallback: "Outros custos",
    },
    // US1 — multi-channel marketplace pricing. Each slot names a marketplace + modality and its
    // fees; "Preços por canal" shows every slot's anúncio + líquido for varejo e atacado together.
    channels: {
      addChannel: "Adicionar canal",
      removeChannel: "Remover canal",
      marketplace: "Marketplace",
      modality: "Modalidade",
      commission: "Comissão",
      fixedFee: "Taxa fixa",
      minPerItem: "Comissão mínima/item",
      freight: "Frete",
      freightHint: "Descontado do valor recebido (não é embutido no anúncio).",
      // hotfix 016/A2 (2026-08-07, FR-111b) — era "Frete / cupom". Nenhuma linha desconta um cupom
      // que ninguém digitou: o único desconto possível é o que o campo "Frete" carrega (a guarda
      // estrutural mora em `freight-declared.test.ts`), então a linha nomeia o controle, não uma
      // forma de desconto que não existe mais no catálogo.
      freightLine: "Frete",
      negativeLiquido: "Canal não-lucrativo neste preço (frete maior que a margem).",
      // 014/SC-817 — o anúncio necessário cai numa faixa de preço para a qual o marketplace não
      // publica tarifa. Dizer isso é a única resposta honesta: a tarifa da faixa vizinha não vale
      // aqui, e um R$ 0,00 sob selo de referência seria pior que nenhum número.
      unpricedBand:
        "Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do canal para precificar.",
      // 016/PR-F homologação (A1) — quando a entrada é bandada, os placeholders de Comissão/Taxa
      // fixa mostram a banda REALMENTE aplicada ao preço da tela (nunca a mesma banda para todo
      // preço) — esta legenda avisa que o número muda se o preço mudar de faixa.
      bandedFeesCaption: "Tabela por faixa de preço — valores da faixa do seu anúncio.",
      // O fixo de algumas faixas é uma REGRA (% do preço, ex.: Shopee abaixo de R$ 8 — 50% do
      // anúncio, ou seja metade), não uma constante — o placeholder mostra o valor JÁ RESOLVIDO
      // para este anúncio, com este sufixo para nunca ser lido como um valor fixo que por acaso não
      // mudou. Genérico em `{pct}` (não hardcoded em "metade") porque a regra publicada é um
      // percentual — hoje só existe o caso 50%, mas a próxima curadoria pode publicar outro.
      fixedFeeRuleCaption:
        "Nesta faixa, a taxa fixa é {pct}% do preço do anúncio — o placeholder mostra o valor já calculado.",
      // US4 — master toggle: show/hide the whole marketplace section (default on).
      includeToggle: "Incluir marketplaces no preço",
      // 016/US11 (T048, FR-915) — the switch's disabled state needs a legible reason: a disabled
      // control with no text beside it reads as broken, not as "assine para usar".
      premiumOnly: "Vender em marketplaces faz parte do Premium.",
      pricesTitle: "Preços por canal",
      channelFallback: "Canal",
      errorRow: "Corrija os campos deste canal para ver os preços.",
      noFeeHint: "Informe a comissão do canal para ver os preços.",
      // US3 — the online catalog refresh failed. NON-BLOCKING: the saved/seed reference still
      // pre-fills and every price computes; this only offers a retry (never an error wall).
      refreshErrorTitle: "Não foi possível atualizar as taxas",
      refreshErrorBody:
        "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente.",
      refreshRetry: "Tentar novamente",
      // 016/PR-F (US17, FR-926, clarify Q6) — as DUAS perguntas do perfil do vendedor, só na Shopee.
      // Sem resposta = catch-all (T057 verbatim art. 26839), então o placeholder é um estado VAZIO
      // explícito e nunca um default escolhido pelo código.
      sellerProfile: {
        sellerTypeLabel: "Você vende como",
        sellerTypePlaceholder: "Selecione",
        sellerTypeOptions: { CPF: "Pessoa física (CPF)", CNPJ: "Pessoa jurídica (CNPJ)" },
        highVolumeLabel: "Mais de 450 pedidos nos últimos 90 dias?",
        highVolumeOptions: { SIM: "Sim", NAO: "Não" },
      },
      // 016/US16 (FR-923, ADR-0027 §3.2, clarify Q5) — o toggle dirigido pelo catálogo (rótulo,
      // valor e procedência vêm de `optionalSurcharges` — zero número/string aqui). A legenda diz a
      // honestidade da Q5: a taxa é por PEDIDO, e um pedido de vários itens desta peça superestimaria
      // se fosse somada por unidade — então ela é somada UMA vez e a legenda avisa isso.
      //
      // 016/PR-F homologação (A3) — a legenda antiga prometia só "+R$ 50" e o anúncio sobe R$ 74,28
      // (o gross-up incide SOBRE a sobretaxa, e a banda pode trocar) — uma promessa que a própria
      // tela contradiz. A frase agora diz a verdade completa: o valor entra como CUSTO do canal, e o
      // ANÚNCIO sobe mais do que ele porque a comissão incide sobre ele também.
      surcharges: {
        perOrderCaption:
          "{value} por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido).",
        provenance: "Fonte: {source}, vigente desde {date}.",
      },
      // hotfix 016/A2 (H2c, 2026-08-07) — o subsídio de frete da Shopee como INFORMAÇÃO, nunca como
      // desconto: `{ceiling}` vem de `freightSubsidyInfo` (Constituição II, zero número aqui). A
      // frase é deliberada em separar os dois bolsos: quem paga o cupom é a Shopee (art. 23431/26839
      // — "todos os vendedores têm os benefícios"), e o campo "Frete" abaixo é só o que sobra para o
      // vendedor declarar, se houver.
      freightSubsidy: {
        // `{ceiling}` chega já formatado (`formatBRL`, "R$ 20,00") — o literal "R$" não mora aqui de
        // propósito: o guarda de honestidade (`copy-honesty.test.ts`) varre a STRING estática em
        // busca de um preço hard-coded, e o valor sempre vem do dado, nunca do texto.
        caption:
          "A Shopee oferece cupons de frete grátis (até {ceiling} nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar para você, se houver.",
        provenance: "Fonte: {source}, vigente desde {date}.",
      },
    },
    // 016/US17 (FR-924, T057) — onde a Shopee não publica a regra, a tela diz isso — nunca aplica
    // uma hipótese. Os dois pontos são VERBATIM do art. 26839 (T057, dod-evidence §PR-F).
    shopeeWarnings: {
      regressiveTitle: "A Shopee não publica a fórmula completa desta taxa",
      regressiveBody:
        "Para vendedores CPF com mais de 450 pedidos nos últimos 90 dias, a Shopee cobra uma taxa adicional regressiva abaixo de R$ 12,00 — mas só divulga dois pontos: “um produto de R$10 tem uma taxa de R$6,50, enquanto um de R$8 terá taxa de R$6”. Sem a fórmula completa, não aplicamos nenhuma estimativa — informe a taxa manualmente se precisar calcular este preço.",
      measuredFreightTitle: "Frete aferido pode gerar cobrança retroativa",
      measuredFreightBody:
        "Se o peso ou as dimensões cadastrados forem menores que os aferidos pela transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra no cálculo — é um risco a considerar ao cadastrar o anúncio.",
      // 016/PR-F homologação (A5) — nome do gatilho do InfoTip que agora carrega o corpo completo
      // (o aviso colapsou para uma linha compacta; ver `ShopeeMeasuredFreightWarning`).
      measuredFreightTipLabel: "Sobre o frete aferido",
    },
    // US2 — honesty seal (FR-107): where a slot's fee numbers came from and how fresh they are. The
    // reference/embedded states append the source + review date; the estimate marks the ML freight
    // subsidy as a labelled estimate (A4). Never asserts a fabricated number is exact.
    // 014/US1 — o vendedor não sabe o nome que o marketplace usa: ele pensa "suporte de celular"
    // e o ML publica "Acessórios para Celulares". A copy de busca vazia ensina isso em vez de
    // apenas informar fracasso.
    categoryPicker: {
      label: "Categoria do anúncio (opcional)",
      hint: "A comissão muda conforme a categoria.",
      placeholder: "Busque pelo produto…",
      clear: "Limpar",
      // 014/T107 — o chip escolhido é uma live region como os dois ramos vizinhos do seletor, e
      // precisa dizer O QUE ele é: um caminho de categoria solto, anunciado sem rótulo, chega ao
      // leitor de tela como três nomes sem contexto no meio de um formulário de preço.
      chosenLabel: "Categoria escolhida:",
      clearAria: "Limpar categoria escolhida",
      // 014/T116 — o id escolhido não está na espinha deste catálogo. Antes o chip renderizava um
      // rótulo EM BRANCO ao lado do "Limpar": nomeava nada e não explicava nada. A comissão desse
      // slot já caiu no catch-all (ou em "sem referência") e quem diz isso é o selo — aqui só cabe
      // dizer por que o nome sumiu, e o que fazer a respeito.
      unknownChosen: "A categoria escolhida não está neste catálogo — limpe e escolha outra.",
      noResults:
        "Não achou? Busque pelo produto, não pelo material — um suporte de celular fica em “Acessórios para Celulares”.",
      // 014/T117 — o que o contrato ARIA falso prometia e nunca entregou: saber que os resultados
      // apareceram. Visível de propósito, não `sr-only` — também é o que distingue a lista de um
      // segundo campo preenchido, que foi como ela leu no primeiro screenshot da T115.
      resultsOne: "1 categoria encontrada",
      resultsMany: "{n} categorias encontradas",
      // A lista mostra no máximo 8. Dizer "8 categorias encontradas" quando existem 23 é afirmar um
      // total que não é o total — o vendedor pararia de refinar acreditando ter visto tudo, e a
      // categoria certa dele pode ser a nona. Achado no screenshot da T117: a busca por "a" na
      // espinha da Amazon devolvia 8 de muitas mais.
      resultsTruncated: "Mostrando {n} de {total} — refine a busca para ver as demais.",
      // 014/FR-006d — o estado vazio do seletor. O texto anterior afirmava "a taxa exibida já é a
      // correta" e prometia "conecte uma vez para carregá-la", no estado padrão de 100% dos usuários
      // (o slot nasce em Mercado Livre, sem entradas e sem espinha): nenhuma taxa estava exibida, e
      // conectar não carregava nada. Duas afirmações, ambas falsas, exatamente onde o vendedor mais
      // precisa desconfiar. Agora há duas mensagens, e o seletor só fala do que ele sabe — a lista de
      // categorias. Quem fala da taxa é o selo do mesmo slot, e os dois passam a concordar.
      unavailableNoReference:
        "Este canal ainda não tem taxa de referência — informe a comissão nos campos abaixo.",
      unavailableWithFee: "A lista de categorias ainda não está disponível para este canal.",
      // 016/US13 (T054, FR-920) — a navegação hierárquica, ao lado da busca. `browseCount` é o
      // contador HONESTO do modo de navegação (o total real de categorias do catálogo — nunca "8"
      // quando existem mais, o mesmo princípio de `resultsTruncated`). Um marketplace de espinha
      // PLANA (Amazon: 38, um nível) degrada sozinho a uma lista simples — nenhum nó tem filhos, e
      // nenhum "▸" aparece.
      browseCount: "{n} categorias no catálogo",
      expandAria: "Expandir {name}",
      collapseAria: "Recolher {name}",
      // 016/US11 (T044 homologação PR-E, R2) — o botão que abre a árvore, com a contagem REAL
      // (nunca "8"). Recolhido por padrão: 38 nós inline empurravam a página inteira antes de
      // qualquer interação (medido: 1.795px, preço final a y≈4.800 a 360px).
      browseToggle: "Ver todas as categorias ({n})",
      browseCollapse: "Ocultar categorias",
    },
    seals: {
      reference: "Referência",
      updatedOn: "atualizada em",
      outdated: "pode estar desatualizada",
      embedded: "referência embutida (offline)",
      adjusted: "ajustado por você",
      none: "sem referência — informe as taxas",
      estimate: "estimativa de frete",
      // 014/Q5 — o catch-all é uma afirmação DIFERENTE de "esta é a taxa da sua categoria", e
      // juntar as duas é como o vendedor termina com o número errado achando que é o dele.
      catchAll: "categoria não informada — usando",
      catchAllHighest: "a maior alíquota da tabela",
      forCategory: "para",
      // 016/PR-F (T057) — a procedência PRÓPRIA da taxa fixa, quando ela não vem da mesma página que
      // a comissão (Amazon Individual: a comissão sai da tabela de categorias, a tarifa por item sai
      // de venda.amazon.com.br/precos). Um selo SEPARADO — nunca dentro do texto do selo principal —
      // porque o selo principal já nomeia a procedência da comissão, e as duas não são a mesma fonte.
      fixedFeeSource: "Taxa fixa",
      fixedFeeSourceSince: "vigente desde",
    },
    marketplaceNames: {
      MERCADO_LIVRE: "Mercado Livre",
      SHOPEE: "Shopee",
      AMAZON: "Amazon",
      OUTRO: "Outro",
    },
    modalityNames: {
      CLASSICO: "Clássico",
      PREMIUM: "Premium",
      PROFISSIONAL: "Profissional",
      INDIVIDUAL: "Individual",
    },
    invalidNote: "Confira os campos destacados para ver o preço.",
    // 016/US11 (T049, FR-916, decisão do dono 2026-08-05) — a promessa reescrita: marketplaces
    // virou Premium (T048), então "grátis" precisa dizer exatamente o que continua sendo — custo e
    // markup — sem sugerir que canal de venda entra nisso. A frase antiga ("Calcular e ver a conta é
    // grátis. Salvar e exportar fazem parte do Premium.") ficou FALSA no dia em que o switch de
    // marketplace passou a exigir assinatura: ela seguia prometendo algo que deixou de ser grátis.
    freemiumNote:
      "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium.",
    // US5 (E2/T024) — the catalog pickers: pre-fill the fields from a saved filament/printer.
    // Picked values stay editable (pre-fill, never lock). Rendered only for signed-in accounts
    // WITH saved items — the free manual flow is untouched (SC-310).
    catalogPicker: {
      title: "Usar do catálogo",
      filament: "Filamento salvo",
      printer: "Impressora salva",
      placeholder: "Escolher…",
      hint: "Preenche os campos com o item salvo — você ainda pode editar tudo.",
      // 016/T072-A8 (2026-08-07) — sem cache local E a leitura online falhando, o seletor não tinha
      // NENHUM item para mostrar e o cartão inteiro desaparecia, em silêncio: a tela não dizia por
      // que o catálogo salvo sumiu. Distinta de "você ainda não salvou nada" (esse caso segue mudo,
      // de propósito — não é um erro). Retry chama o refetch dos dois recursos.
      loadError: "Não foi possível carregar seus itens salvos agora.",
      retry: "Tentar novamente",
    },
    // 016/US6 (FR-908) — the two numbers with an expiry date, named so the annual refresh is a
    // value edit (see the module-level consts + conteudo-tooltips.md §Notas de escopo #5).
    tooltipRefs: {
      tarifaMediaNacional: TOOLTIP_REF_TARIFA_MEDIA_NACIONAL,
      salarioMinimoHora: TOOLTIP_REF_SALARIO_MINIMO_HORA,
    },
    // 016/US6 (FR-908, T023/T025) — the 9 field explanations researched + sourced in
    // conteudo-tooltips.md (verbatim text; procedência lives there, NOT here). `label` names the
    // ⓘ trigger for assistive tech; `body` answers, in this order, "por que entra na conta" and
    // "como você descobre o seu". Nenhum tooltip altera cálculo/validação (US6-AC3).
    fieldTips: {
      // 016/US10/T038b (FR-914) — escrito só depois que o campo Desperdício morreu (016/PR-D): a
      // frase "purga/suporte/brim entram nas gramas" só vira verdade quando não há mais um campo
      // separado para eles. Ver conteudo-tooltips.md §2026-08-06 (procedência: nenhuma externa —
      // é definição do próprio produto, não fato de terceiro).
      grams: {
        label: "Sobre as gramas usadas",
        body: "É o peso total que a peça consome no fatiador — a peça em si, mais a purga, o suporte e o brim que ele descarta ao final. Pese a peça pronta numa balança, ou use o peso total que o próprio fatiador estima antes de imprimir.",
      },
      avgPower: {
        label: "Sobre o consumo médio",
        body: "A luz que a máquina gasta enquanto imprime entra no custo de cada peça — sem ela, você cobra menos do que gasta. Cuidado: o número da fonte (ex.: 350 W) é o máximo, não o gasto real. Meça com uma tomada medidora de consumo. Sem medidor, estime entre 0,07 e 0,15 kW.",
      },
      tariff: {
        label: "Sobre a tarifa de energia",
        body: `É o preço de cada unidade de luz — multiplicado pelas horas de impressão, vira o custo de energia da peça. Pegue sua conta de luz e divida o valor total pelos kWh consumidos no mês: esse é o preço real que você paga, já com impostos e bandeira. Sem a conta em mãos, a média do país fica perto de ${TOOLTIP_REF_TARIFA_MEDIA_NACIONAL}.`,
      },
      // Serve o modo "ajustar" da US8 — o número bruto ainda é digitado ali.
      machineLifetime: {
        label: "Sobre a vida útil da máquina",
        body: "A impressora se gasta imprimindo. Espalhar o preço dela pelas horas faz cada peça devolver um pedaço da máquina — assim a próxima sai do negócio, não do seu bolso. Fabricante não publica esse número: estime. Horas que você imprime por ano × anos até querer trocar. Ex.: 1.200 h/ano × 3 anos = 3.600 h.",
      },
      maintenance: {
        label: "Sobre a reserva de manutenção",
        body: "Bico, correia, mesa e lubrificação acabam com o uso. Guardar centavos por hora faz a troca sair do preço das peças, e não do seu prejuízo. Some o que gastou em peças no último ano e divida pelas horas que imprimiu. Sem histórico, olhe o preço de um bico e de uma correia na sua loja.",
      },
      // 016/US10/T038b (FR-914) — reescrito com a distinção que só passou a existir com a morte do
      // campo Desperdício: falha é a impressão INTEIRA perdida; purga/suporte/brim de uma impressão
      // que deu certo já estão nas "Gramas usadas", não aqui.
      failure: {
        label: "Sobre a taxa de falha",
        body: "É a impressão que dá errado por completo e vai para o lixo — não a purga, o suporte ou o brim de uma que deu certo (isso já está nas gramas usadas). Descubra a sua: impressões perdidas ÷ impressões começadas × 100. Ex.: 4 perdidas em 40 = 10%.",
      },
      finishTime: {
        label: "Sobre o tempo de acabamento",
        body: "Lixar, colar, pintar e montar é trabalho seu depois que a impressora parou. Fora da conta, ele vira trabalho de graça. Cronometre uma peça parecida, do fim da impressão até ela ficar pronta para entregar. Poucos minutos viram fração de hora: 15 min = 0,25 h.",
      },
      finishRate: {
        label: "Sobre o valor do acabamento",
        body: "Diz quanto vale uma hora do seu acabamento — é o que transforma esse tempo em dinheiro no preço final. Use o que você cobraria de alguém para fazer o mesmo trabalho manual. Se não tem referência, comece com o mesmo valor da sua hora de trabalho.",
      },
      laborHours: {
        label: "Sobre a mão de obra (horas)",
        body: "É o seu tempo fora da impressora: preparar o arquivo, tirar da mesa, limpar, embalar e postar. Sem contar, esse tempo sai do seu lucro. Cronometre um pedido inteiro uma vez e anote. Se varia muito, tire a média de 3 pedidos. 20 min = 0,33 h.",
      },
      laborRate: {
        label: "Sobre o valor da hora",
        body: `É quanto vale uma hora do seu trabalho. Sem esse número, você entrega horas de graça no preço. Descubra o seu assim: quanto quer ganhar por mês ÷ horas que pretende trabalhar no mês. Ex.: R$ 3.000 ÷ 160 h = R$ 18,75. Só para comparar, o salário mínimo dá ${TOOLTIP_REF_SALARIO_MINIMO_HORA} a hora.`,
      },
    },
    // 016/US7 (FR-909) — the printTime border: two fields (h + min), the engine keeps receiving
    // the SAME decimal (time-input.ts owns the pure conversion).
    timeInput: {
      hoursAria: "Horas de impressão",
      hoursUnit: "h",
      minutesAria: "Minutos de impressão",
      minutesUnit: "min",
    },
    // 016/US8 (FR-910, SC-906) — the machine cost question rewrite: valor pago (machineValue,
    // unchanged) · ritmo de uso (3 opções, sem digitar) · payback em anos deriva
    // `machineLifetimeHours` (machine-cost.ts owns the pure derivation); the engine keeps
    // receiving the SAME two fields it always has.
    machineCost: {
      ritmoLabel: "Com que frequência ela roda?",
      ritmoOptions: {
        few: "Poucas horas por semana",
        daily: "Quase todo dia",
        always: "Praticamente o dia todo",
      },
      paybackLabel: "Em quantos anos quer que ela se pague?",
      paybackYearsLabel: "{n} anos",
      derivedCaption: "≈ {value} por hora de impressão",
      adjustButton: "Ajustar horas direto",
      backToEstimateButton: "Usar estimativa por ritmo",
    },
  },
  account: {
    signedInAs: "Conectado como",
    signOut: "Sair",
  },
  // FR-214 (006) — minimal honest privacy notice (owner-decided Option A, 2026-07-08; final wording
  // ratified by the owner before the UAT URL is shared — T027). No consent library: a notice, not a
  // consent gate. Full LGPD (consent mgmt, data deletion) is deliberately deferred to E2 (persistence).
  privacy: {
    title: "Como tratamos seus dados",
    google:
      "Para entrar, usamos o Login com Google, que nos informa seu e-mail — usado apenas para identificar sua conta.",
    monitoring: "Registramos erros técnicos (Sentry) para corrigir falhas.",
    noSale: "Não vendemos seus dados nem fazemos rastreamento para publicidade.",
    calculatorFree: "A calculadora funciona sem login e não coleta nada.",
    // E2 (007/T034): the catalog now stores user data (filaments, printers, products) per account.
    // Honest, minimal — no consent library yet (full LGPD still deferred); a notice, not a gate.
    catalogData:
      "Se você usar o Premium, salvamos seu catálogo (filamentos, impressoras e produtos) na sua conta para você reutilizar nos cálculos.",
  },
  // App shell navigation (app-nav) — the fixed IA labels (ds-readme §2).
  // `ariaLabel` names the <nav> landmark for assistive tech (a11y copy, honest).
  nav: {
    ariaLabel: "Navegação principal",
    calcular: "Calcular",
    catalogo: "Catálogo",
    kits: "Kits", // 008/K1 — the 5th section (owner-approved IA change)
    // 016/US2 (T008) — a MESMA rota `/historico`, o rótulo visível vira "Orçamentos": o par
    // Histórico/Cenários não comunicava a diferença (congelado × recalculado hoje).
    historico: "Orçamentos",
    conta: "Conta",
    // 018/US5 — o rail colapsável. O botão diz o que VAI acontecer, não o estado atual: quem lê
    // "Recolher" sabe o que o clique faz; quem lê "Recolhido" fica adivinhando.
    collapse: "Recolher",
    expand: "Expandir",
  },
  // Conta page. Plan indicator is a static, honest "Gratuito" (display-only,
  // gates nothing — no entitlement field exists yet; Principle IV).
  conta: {
    title: "Conta",
    planLabel: "Plano",
    planFree: "Gratuito",
    // E2/T025b (FR-304) — the plan line reads GET /api/v1/entitlement and NEVER fabricates a
    // state: none→Gratuito, active→Premium (+source/expiry; grantor never shown), lapsed→honest
    // expired + read-only reassurance, query error→honest unknown. "Atualizar" covers the
    // ≤1-refresh just-granted window. No price, no date promises, no billing (FR-014).
    planPremium: "Premium",
    // T038 (homologacao) — era "Premium expirado", e EXPIRAR AFIRMA UMA CAUSA. Expirar e o tempo
    // acabar; num estorno o periodo foi CORTADO. A tela dizia "renova em 01/09/2026" e no mesmo dia
    // passava a dizer "expirado", sem nada reconciliar as duas frases — um vendedor honesto le isso
    // como bug ("paguei ate setembro, por que expirou?").
    //
    // "pausado" nao afirma causa nenhuma, e nao e palavra nova: e o que `/kits`, `/catalogo` e o
    // congelamento do historico JA dizem. O mesmo estado tinha DOIS nomes, e um deles trazia uma
    // causa falsa embutida. A causa nao trafega no wire (`plan-view.ts` recebe none|active|lapsed),
    // entao um rotulo ciente da causa exigiria mudanca de contrato — o rotulo NEUTRO nao exige nada
    // e resolve os dois casos.
    planLapsed: "Premium pausado",
    planLapsedHint: "Seus itens salvos continuam disponíveis para leitura.",
    // 009/T011b: o plano exibido é a ÚLTIMA resposta do servidor, guardada no aparelho (offline).
    planStale: "última informação do servidor",
    planSources: {
      beta: "via programa beta",
      comp: "cortesia",
    },
    planExpires: "expira em",
    // T028/A2 (dono, 2026-08-01) — era "Atualizar", e na CARENCIA ele fica a 8px de "Atualizar
    // forma de pagamento", que vai para o Mercado Pago. Mesma primeira palavra, lado a lado, no
    // momento em que o vendedor esta ansioso com um cartao recusado. A copy de cobranca do
    // ux-billing §4.1 e ESPECIFICADA e fica intacta; esta aqui e nossa e generica, entao e ela que
    // cede. Alcance: so a linha do plano.
    planRefresh: "Recarregar",
    planRefreshHint: "Mudou de plano agora?",
    planUnknown: "Não foi possível confirmar seu plano.",
    themeLabel: "Tema",
    // 018/US4 — no desktop o tema vira um controle que NOMEIA as duas opções. O interruptor do
    // mobile continua como está: ele foi homologado, e "o mobile não se mexe".
    themeLight: "Claro",
    themeDark: "Escuro",
    // Identity comes from GET /api/v1/me (A23). On failure the section shows an error,
    // never a fabricated fallback identity. Honest copy (no provider/price/cancellation).
    identityErrorTitle: "Não foi possível carregar sua conta",
    retry: "Tentar novamente",
  },
  // Catálogo — the premium save/reuse surface (E2 · US3/US4 → T019/T022). Tom honesto/calmo,
  // sem preço/data (Q5/FR-014). Copy from ux-catalog §6, owner-ratified with the US7 teaser (T033).
  catalogo: {
    // Segmented tabs (G1)
    tabsLabel: "Seções do catálogo",
    tabFilaments: "Filamentos",
    tabPrinters: "Impressoras",
    tabProducts: "Produtos",
    tabKits: "Kits",
    // Empty (premium, per entity)
    emptyFilamentsTitle: "Nenhum filamento salvo ainda",
    emptyFilamentsBody: "Salve seus filamentos uma vez e reutilize em cada cálculo.",
    emptyPrintersTitle: "Nenhuma impressora salva ainda",
    emptyPrintersBody: "Salve os dados da sua impressora uma vez e reutilize em cada cálculo.",
    emptyProductsTitle: "Nenhum produto salvo ainda",
    emptyProductsBody: "Salve uma peça com seus custos e reabra com o preço sempre recalculado.",
    emptyKitsTitle: "Nenhum kit salvo ainda",
    emptyKitsBody: "Monte um kit com várias peças e reabra com o preço sempre recalculado.",
    addFilament: "Adicionar filamento",
    addPrinter: "Adicionar impressora",
    addProduct: "Adicionar produto",
    addKit: "Montar kit",
    editKit: "Editar kit",
    duplicate: "Duplicar",
    // List / row actions
    countFilaments: "{n} filamento(s)",
    countPrinters: "{n} impressora(s)",
    countProducts: "{n} produto(s)",
    countKits: "{n} kit(s)",
    countKitPieces: "{n} peça(s)",
    // K3 — the manual/degraded product state. ONE honest state for "born manual" (materialized
    // from a kit) and "degraded by deletion": same remedy, so the same words (SC-412).
    needsAttention: "Vincule um filamento e uma impressora salvos",
    // Product row summary shows the reference names; a removed reference reads as manual (US6-4).
    manualRef: "manual",
    // 013/FB-04 — neutral placeholder while filaments/printers are still loading: a loading
    // reference must never render as "manual" (that's a claim about data provenance, not a spinner).
    resolvingRef: "carregando…",
    edit: "Editar",
    remove: "Excluir",
    // 018/US1 — o mestre-detalhe do desktop. A busca filtra a lista JÁ carregada (nenhuma
    // requisição nova), e por isso o vazio dela fala de busca, não de catálogo vazio.
    searchLabel: "Buscar no catálogo",
    searchPlaceholder: "Buscar no catálogo…",
    searchEmptyTitle: "Nada encontrado para essa busca",
    searchEmptyBody: "Tente outro termo, ou limpe a busca para ver tudo de novo.",
    searchClear: "Limpar busca",
    detailFilament: "Filamento salvo",
    detailPrinter: "Impressora salva",
    detailProduct: "Produto salvo",
    detailKit: "Kit salvo",
    // A ficha de produto/kit RESUME e manda para o editor de página cheia — o formulário completo
    // não é recomposto dentro de 560px (decisão do dono, clarify 2026-08-10).
    detailOpenEditor: "Abrir para editar",
    // Load / error (§1.4)
    loadError: "Não foi possível carregar seu catálogo.",
    retry: "Tentar novamente",
    // Offline (Q2 · §1.5) — info tone, never danger
    offlineTitle: "Modo leitura offline",
    offlineBody:
      "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.",
    offlineWriteBlocked: "Criar e editar precisam de conexão.",
    staleHint: "pode estar desatualizada",
    // 016/US1 (T004/T006) — o teaser do Catálogo passou a ser o padrão único
    // (`shared/billing/premium-teaser.tsx`, registro `premiumTeaser.CATALOG`); as chaves antigas
    // (título/corpo/modal/CTA próprios) saíram daqui — eram exatamente a divergência que a US1
    // existe para eliminar.
    // Lapsed (Q3 · §3) — calmo, não punitivo
    lapsedTitle: "Premium pausado",
    lapsedBody:
      "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium.",
    readOnlyHint: "somente leitura",
    // 013/FB-02 — the reactivation line a read-only form footer shows in place of Salvar
    // (ux-catalog §3, owner-ratified copy). No price, no date — same honesty bar as the teaser.
    reactivateTitle: "Reative o Premium",
    reactivateBody: "Reative o Premium para voltar a criar e editar. Seus itens estão salvos.",
  },
  // Catálogo create/edit form (Sheet) + delete confirm (Dialog). Numeric field LABELS reuse
  // `calculator.fields.*`; per-field VALIDATION reuses `calculator.validation.*` verbatim (FR-306).
  catalogForm: {
    newFilament: "Novo filamento",
    editFilament: "Editar filamento",
    newPrinter: "Nova impressora",
    editPrinter: "Editar impressora",
    name: "Nome",
    namePlaceholderFilament: "Ex.: PLA Azul",
    namePlaceholderPrinter: "Ex.: Ender 3",
    material: "Material",
    materialPlaceholder: "Ex.: PLA",
    // "Voltar" (not "Cancelar"): the copy-honesty guard (FR-014) bans "cancelar" anywhere in the
    // message module to keep any billing-cancellation policy out of the copy. Owner ratifies at T033.
    cancel: "Voltar",
    save: "Salvar",
    saveChanges: "Salvar alterações",
    savedFilament: "Filamento salvo.", // real success toast only (never offline/lapsed/free)
    savedPrinter: "Impressora salva.",
    // Delete confirm (§0.2 / §1.5)
    deleteTitle: "Excluir “{nome}”?",
    deleteBody: "Esta ação não pode ser desfeita.",
    deleteConfirm: "Excluir",
  },
  // Produto create/edit — FULL PAGE route reusing the Calcular layout (US6/T030, ux §1.6b).
  // No stored price is ever shown: the page recomputes live via computeFromForm (FR-310/FR-313).
  productForm: {
    newProduct: "Novo produto",
    editProduct: "Editar produto",
    nameLabel: "Nome do produto",
    namePlaceholder: "Ex.: Vaso G",
    nameRequired: "Dê um nome ao produto.",
    saveProduct: "Salvar produto",
    savedProduct: "Produto salvo.", // real success toast only (never offline/lapsed/free)
    saveInvalid: "Confira os campos destacados antes de salvar.",
    // FR-310: a product references SAVED items at create — honest prerequisite, not a dead end.
    needRefs: "Para criar um produto, salve antes um filamento e uma impressora no catálogo.",
    // Unlinked reference — calm info, never an error wall; values stay editable. E2 said "o
    // filamento vinculado foi REMOVIDO" here, which was true when every product was born with
    // links. E3 breaks that premise: a kit save materializes products with NO links (K3/ADR-0017
    // §4), and telling those sellers something was removed would be inventing an event that never
    // happened. Data cannot tell the two apart — by design — so the copy states what IS true of
    // both: nothing is linked, the values were kept, link them to follow the catalog again.
    manualOption: "— Manual —",
    manualValuesKept: "Os valores atuais foram mantidos e continuam editáveis.",
    // Referenced-item delete warn (shown inside the filament/printer delete confirm).
    deleteWarnFilament:
      "Este filamento é usado em {n} produto(s). Eles manterão os últimos valores, editáveis.",
    deleteWarnPrinter:
      "Esta impressora é usada em {n} produto(s). Eles manterão os últimos valores, editáveis.",
    notFound: "Não encontramos este produto.",
    backToCatalog: "Voltar ao catálogo",
  },
  // 008/E3 — the KIT composer (user-facing name per K1, 2026-07-11; "BOM" stays technical).
  // Premium feature (Q3, ADR-0015); copy is honest/calm: NO price, NO date, NO pre-E6
  // purchase CTA anywhere (FR-410). Title/subtitle are the owner's approved wording (K1).
  bom: {
    title: "Monte seus kits",
    subtitle:
      "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas",
    // Empty state (§1.8)
    emptyTitle: "Monte seu kit peça por peça",
    emptyBody:
      "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro.",
    addLine: "Adicionar peça",
    // Line (§1.1/§1.3)
    lineLabel: "Peça {n}",
    // K4 pre-fill: the catalog name a materialized piece takes ("Peça {n}" alone when unnamed).
    pieceNameKit: "Peça {n} · {kit}",
    lineAdhoc: "(avulsa)",
    quantity: "Quantidade",
    quantityUnit: "un",
    // A5-d (a5-a6-decisoes.md) — rótulos do READOUT FIXADO do kit, chave por PAPEL, nunca
    // reuso de captions: esta superfície tem ORÇAMENTO DE LARGURA (~85px a --fs-caption 12px
    // — "Preço atacado" mede 111px e trunca; estas duas medem ~55/63px). O contexto ("Total
    // do kit" + o R$ na mesma linha) é o que nomeia o número; "Preço" ali é redundância.
    pinned: {
      varejo: "Varejo",
      atacado: "Atacado",
    },
    removeLine: "Remover peça",
    qtyZero: "Quantidade 0 — não entra no total.",
    expand: "Editar esta peça",
    collapse: "Recolher",
    // Invalid line: honest exclusion, never a silent zero (§1.3)
    lineInvalid: "Confira os campos desta peça — ela não entra no total até ser corrigida.",
    // In-line catalog picker (§1.2-C / §1.4) — product level. PR-B reintroduces the picker
    // placeholder/offline copy it needs (ux §5 keeps the full proposed set) — no dead keys here.
    useProduct: "Usar produto salvo",
    manual: "— Manual —",
    fromCatalog: "do catálogo: {nome}",
    fromCatalogAdjusted: "do catálogo: {nome} · ajustado por você",
    // Per-line breakdown (§1.6)
    lineTotal: "Total da linha ({qty}×)",
    // Assembly total + per-channel rollup (§1.7)
    assemblyTitle: "Total do kit",
    assemblyCusto: "Custo total",
    // Honest headline states (review 2026-07-12): with NO valid line the total is not "R$ 0,00",
    // it simply does not exist yet; a partial kit says how many pieces are out of the sum.
    assemblyNoPriceTitle: "Sem preço ainda",
    assemblyNoPriceBody:
      "O preço do kit aparece assim que ao menos uma peça estiver completa e válida.",
    assemblyExcluded: "{n} peça(s) fora do total — confira os avisos nas peças acima.",
    channelsTitle: "Preços por canal (kit)",
    channelContributing: "{n} peça(s) somaram neste canal",
    channelSkipped: "{n} peça(s) sem preço neste canal — não entrou na soma.",
    channelNoContrib: "Nenhuma peça com preço neste canal.",
    // 016/US1 (T004/T006) — o teaser de Kits passou a ser o padrão único (`premiumTeaser.KITS`);
    // as chaves antigas (título/corpo/CTA próprios) saíram daqui pela mesma razão do Catálogo.
    // Guard states (§0.1) — honest, specific; a network failure is NOT "not premium"
    guardChecking: "Verificando seu plano…",
    guardError: "Não foi possível verificar seu plano.",
    guardRetry: "Tentar novamente",
    // Save (§1.9 / T015) — Kit vocabulary (K1). A success toast fires ONLY on a real 2xx.
    kitName: "Nome do kit",
    kitNamePlaceholder: "Kit suporte + base",
    kitNameRequired: "Dê um nome ao kit para salvar.",
    pieceName: "Nome da peça no catálogo",
    save: "Salvar kit",
    saving: "Salvando…",
    saved: "Kit salvo.",
    saveInvalid: "Confira as peças com aviso antes de salvar.",
    saveEmpty: "Adicione ao menos uma peça para salvar.",
    viewKits: "Ver meus kits",
    copySuffix: "(cópia)",
    // Materialization feedback (K4) — created vs referenced, said out loud, never silently
    savedTitle: "O que este kit fez no seu catálogo",
    savedCreated: "{nome} — criado no catálogo",
    savedReferenced: "{nome} — já existia no catálogo, referenciado",
    savedSuperseded:
      "As peças referenciadas usam os valores do produto que já estava salvo, não os que você digitou aqui.",
    // Bound line edited after binding → it becomes an avulsa piece and enters the catalog (ADR-0017)
    adjustedBecomesPiece: "Você ajustou esta peça — ela será salva como uma peça nova no catálogo.",
    // Lapse (FR-409 / Q3 freeze / ux §3) — calm, never punitive ("expirou/bloqueado/suspenso" are
    // banned, FR-014). The kits are the seller's data, not a rented view: nothing was deleted and
    // reopening + recalculating keep working. Creating/editing is what needs an active Premium, so
    // the CREATE entry is gated rather than left as an affordance that fails at the end.
    lapsedTitle: "Premium pausado",
    lapsedBody:
      "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar ou editar, reative o Premium.",
    lapsedBanner:
      "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.",
  },
  // E4 (009) — o Histórico prova o que o vendedor COBROU (o Catálogo mostra o que vale hoje).
  // Vocabulário deliberado: "Valor cotado", nunca "Preço" (preço é o que a calculadora diz HOJE);
  // "salvo" só é dito quando o servidor confirmou; um envio ainda não sincronizado é "pendente
  // neste dispositivo" — nunca "falhou" (resposta perdida ≠ não gravado) e nunca "salvo".
  historico: {
    // list + detail (T013). 016/US2 (T008/T009): "Orçamentos" — o documento CONGELADO (o que foi
    // cotado, imutável); a diferença com Simulações (recalculada hoje) fica dita na própria frase.
    title: "Orçamentos",
    subtitle: "O que você cotou, com a data. Os valores ficam congelados como estavam no dia.",
    emptyTitle: "Nenhum registro ainda",
    emptyBody:
      "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data.",
    emptyAction: "Ir para a calculadora",
    quotedAtCard: "Cotado em {data}",
    quotedAtTime: "Cotado em {data} às {hora}",
    quotedValue: "Valor cotado",
    basisRetailCaption: "preço de varejo",
    basisWholesaleCaption: "preço de atacado",
    kindSingle: "Peça única",
    kindKit: "Kit · {n} peças",
    adhocFallback: "Cálculo avulso",
    loadError: "Não foi possível carregar seus orçamentos.",
    retry: "Tentar novamente",
    notFound: "Registro não encontrado.",
    backToList: "Voltar",
    // detail
    frozenCaption: "Valores congelados em {data}",
    // 014/SC-818 — o recálculo que NÃO conseguiu repreçar (a origem sumiu) reemite o documento
    // congelado com a data de hoje. Sem esta linha, o registro é indistinguível de um repreço real, e
    // a ADR-0019 o torna imutável: a distinção existe aqui ou não existe em lugar nenhum.
    frozenReusedCaption:
      "Estes valores foram reaproveitados de um congelamento anterior — a origem não estava disponível para repreçar.",
    validityLine: "Validade da proposta: {n} dias",
    kitPieces: "Peças do kit",
    // A COUNT ("3 un"), never "3×" glued to a total that is ALREADY quantity-scaled (review PR-A,
    // C2) — "3× R$ 135,00" would read as a unit price and be multiplied again.
    kitPieceQty: "{n} un",
    breakdown: "Detalhamento",
    channels: "Preços por canal",
    // 014/T120 — um canal gravado SEM comissão informada. Com comissão 0 o motor devolve anúncio ==
    // base, então existe um número — mas ele não é um preço de marketplace, e a Calcular já se
    // recusa a exibi-lo ("Informe a comissão do canal para ver os preços"). O congelado herda a
    // recusa em vez de afirmar o que a origem negou. O tempo verbal é o do registro, não o do
    // conserto: não há o que informar agora, o que houve foi um canal sem comissão naquele dia.
    channelNoFee: "sem comissão informada — este canal não teve preço",
    // per-channel rollup captions (M11) — contributing/skipped kit lines, stated honestly
    channelContributing: "{n} de {total} peças",
    channelSkipped: "{n} sem este canal",
    channelNet: "líquido",
    techTitle: "Ficha técnica",
    modelVersionLine: "Calculado com a fórmula versão {versao}",
    originLine: "Registro criado a partir de: {nome}",
    // US3/T019 — "abrir origem" is resolved at READ TIME and shown ONLY when the origin still exists
    // (ADR-0019 §5: provenance is not an FK, the id may dangle). Gone ⇒ the affordance is simply
    // absent — never a "produto excluído" claim. The two labels name the origin's kind honestly.
    openProduct: "Abrir produto",
    openKit: "Abrir kit",
    // US3/T020 — "Recalcular hoje": a NEW record at TODAY's catalog values, never a change to this
    // one. It re-resolves the origin; where the origin is gone, it reprices the frozen inputs under
    // the current formula and SAYS SO (never silently presented as catalog-current). Copy = ux §8.
    recalcAction: "Recalcular hoje",
    recalcTitle: "Recalcular hoje",
    recalcBody:
      "Isso cria um NOVO registro com os valores do seu catálogo hoje. O registro de {data} continua como está.",
    recalcNoOriginBody:
      "Não foi possível localizar a origem deste registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo.",
    recalcOfflineNote:
      "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados.",
    recalcConfirm: "Recalcular",
    // 016/T037 (US10, FR-913, ADR-0026 §D.2) — the structural note: dirigida por VERSÃO (o
    // congelado guarda `modelVersion`, ao contrário do documento de cenário). `isPreRemovalModel`
    // decide; nenhum campo novo em payload (I3 — um campo em congelado imutável é para sempre).
    recalcStructuralNote:
      "O valor congelado foi calculado pelo modelo {versao}, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí.",
    // US4/T028 — export (FR-512..516). Copy = ux §8, verbatim except where marked. The artifact is
    // SERVER-rendered (ADR-0020), and that is why three of these strings exist at all: no connection
    // and no server row mean no document, and each unavailable case must say WHICH, in place. The
    // `exportIncludeCostsWarn` line names the harm the switch prevents — a customer who reads the
    // cost lines can compute the seller's margin — instead of leaving the label neutral.
    exportAction: "Exportar",
    exportFormatField: "O que exportar", // ux draws the radios unlabelled; this names the group
    exportQuotePdf: "Orçamento para o cliente (PDF)",
    exportHistoryCsv: "Meus orçamentos (CSV)",
    exportIncludeCosts: "Incluir detalhamento de custos",
    // Corrigido pela revisão PR-C. A copy do ux §8 errava nos DOIS sentidos: nomeava "margem" (que
    // NUNCA é uma linha impressa) e omitia acabamento, mão de obra e os nomes que o vendedor deu aos
    // seus "outros custos" — que o PDF imprime literalmente. Um aviso de exposição que erra a lista
    // não é um aviso: é um palpite. Agora nomeia o que sai e diz o que dá para deduzir.
    exportIncludeCostsWarn:
      "Seu cliente veria as linhas gravadas — material, energia, máquina, falhas, acabamento, mão de obra e os seus outros custos — e poderia calcular a sua margem.",
    // Num kit o documento leva UMA linha (o custo total gravado), não o detalhe peça a peça: a copy
    // acima descreveria um artefato que o vendedor não vai receber (revisão PR-C).
    exportIncludeCostsWarnKit:
      "Seu cliente veria o custo total gravado do kit — e poderia calcular a sua margem.",
    // Corrigido pela revisão PR-C: esta é a linha do "sem surpresa", e omitia justamente o único
    // campo AUTORAL do vendedor que chega ao cliente. O rótulo é escrito em contexto privado ("não
    // fechar abaixo de 40") e é impresso como "Referência" no orçamento. Uma lista que promete ser
    // exaustiva e esquece o campo de texto livre é pior que nenhuma lista.
    exportContents:
      "O orçamento leva: itens, quantidades, o valor cotado, a data, a validade, o rótulo deste registro (impresso como “Referência”), e identifica você pelo nome e e-mail da sua conta.",
    exportGenerate: "Gerar PDF",
    exportGenerateCsv: "Baixar CSV",
    // NEW — the CSV is rendered from the ACCOUNT, so a record still queued on this device is not in
    // it. Saying so beats a ledger that silently omits a quote the seller knows they made.
    exportCsvNote: "O CSV vem da sua conta: registros ainda não sincronizados não entram nele.",
    exportOffline: "Exportar precisa de conexão.",
    exportPending: "Sincronize para exportar.",
    // Owner decision 2026-07-16 (qa's T030 trim): the 2nd sentence — "Seus registros continuam aqui
    // para leitura" — is gone. The page's `lapsedBanner` says it two lines above, and repeating it
    // under the button read as the app not trusting the seller to have read it.
    exportLapsed: "Exportar precisa do Premium ativo.",
    exportFailed: "Não foi possível gerar o arquivo.", // NEW — never a fake file
    // US7/T029 — the comparison. Purely informational: it records nothing, and it SAYS so,
    // because two totals side by side look exactly like a thing that just changed the record.
    compareAction: "Comparar com hoje",
    compareToday: "Hoje",
    compareNote:
      'Comparação informativa: este registro não muda. Para gravar o valor de hoje, use "Recalcular hoje".',
    compareUnavailable:
      "Não foi possível calcular o valor de hoje para este registro com o seu catálogo atual.",
    // US6/T022 — manage the ledger (label edit · search · date range · delete · lazy pagination).
    // Copy = ux §8. The label is the ONE mutable field; the contents stay immutable (ADR-0019).
    editLabel: "Editar rótulo",
    editLabelSave: "Salvar rótulo",
    labelSaved: "Rótulo atualizado.",
    labelSaveFailed: "Não foi possível atualizar o rótulo.",
    deleteAction: "Excluir",
    deleteTitle: "Excluir este registro?",
    deleteBody: "Esta ação não pode ser desfeita.",
    deleteConfirm: "Excluir",
    deleteFailed: "Não foi possível excluir o registro.",
    deleted: "Registro excluído.",
    searchLabel: "Buscar por rótulo",
    searchPlaceholder: "Cliente, pedido…",
    searchEmpty: "Nenhum registro encontrado para “{termo}”.",
    searchClear: "Limpar busca",
    period30: "30 dias",
    period90: "90 dias",
    periodAll: "Tudo",
    periodCustom: "Período…",
    periodFrom: "De",
    periodTo: "Até",
    periodApply: "Aplicar",
    filterActive: "Período: {de} – {ate}",
    filterClear: "Limpar filtro",
    loadMore: "Carregar mais",
    frozenExplainer:
      "Este registro guarda os valores como foram calculados naquele dia. Ele não muda quando você edita o catálogo nem quando a fórmula do app é atualizada.",
    deviceClockNote: "Data registrada pelo seu aparelho no momento da cotação.",
    // queue banner (§2.2)
    queuePending: "{n} registro(s) pendente(s) neste dispositivo.",
    queuePendingOffline:
      "Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online.",
    queueBlocked: "{n} registro(s) não foram enviados: o Premium não está ativo.",
    // hotfix 016/A3 (H4b, 2026-08-07) — a verdade DIFERENTE de "pendente": a sessão morreu, não a
    // conexão. "conexão"/"online" NUNCA aparecem aqui de propósito (o achado A3: a cópia antiga
    // prometia "sincroniza sozinho quando houver conexão" com a conexão intacta).
    queueUnauthenticated: "{n} registro(s) não foram enviados: sua sessão expirou.",
    queueFailed: "{n} registro(s) não puderam ser registrados.",
    syncNow: "Sincronizar agora",
    signInAction: "Entrar de novo",
    // per-card sync badges (§1)
    syncPendingBadge: "Pendente neste dispositivo",
    syncBlockedBadge: "Envio pausado · precisa de Premium",
    syncUnauthenticatedBadge: "Envio pausado · sessão expirada",
    syncFailedBadge: "Não foi possível registrar",
    // offline / lapsed (same family as E2/E3)
    offlineTitle: "Modo leitura offline",
    offlineBody:
      "Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar a ficar online.",
    lapsedBanner:
      "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium.",
    // record (T010)
    saveAction: "Salvar em Orçamentos",
    saveSheetTitle: "Salvar em Orçamentos",
    saveSheetIntro:
      "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje.",
    saveSheetSubmit: "Salvar em Orçamentos",
    labelField: "Rótulo (opcional)",
    labelHint: "Cliente, pedido…",
    validityField: "Validade da proposta",
    validityUnit: "dias",
    basisField: "Preço que você está cotando",
    basisRetail: "Varejo",
    basisWholesale: "Atacado",
    quotedAt: "Cotado em {data}",
    saved: "Registro salvo em Orçamentos.",
    saveDeviceFailed: "Não foi possível guardar o registro neste aparelho. Ele não foi salvo.",
    // sync states (ADR-0018) — o vocabulário honesto
    syncPendingToast: "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão.",
    syncBlockedToast:
      "Envio pausado — o Premium não está ativo. O registro continua neste aparelho.",
    // hotfix 016/A3 (H4) — a mesma disciplina do blocked-toast, para a causa VERDADEIRA: sessão, não
    // rede. "conexão" nunca aparece.
    syncUnauthenticatedToast:
      "Envio pausado — sua sessão expirou. O registro continua neste aparelho.",
    syncFailedToast: "Não foi possível registrar. O servidor não aceitou este registro.",
    // detail sync alerts (§1.2) — the copy verbatim, one calm reading per state
    syncPendingTitle: "Ainda não sincronizado",
    syncPendingBody:
      "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online.",
    syncPendingDurability:
      "Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde.",
    syncBlockedTitle: "Envio pausado",
    syncBlockedBody:
      "Este registro não foi enviado para a sua conta: o Premium não está ativo. Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar ativo, ele é enviado automaticamente.",
    // hotfix 016/A3 (H4b) — mesma forma do blocked, causa verdadeira: sessão expirada.
    syncUnauthenticatedTitle: "Sessão expirada",
    syncUnauthenticatedBody:
      "Este registro não foi enviado para a sua conta: sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo.",
    syncFailedTitle: "Não foi possível registrar",
    syncFailedBody:
      "O servidor não aceitou este registro. Ele não será reenviado sozinho. Você pode tentar de novo ou descartar.",
    syncedAnnounce: "Registro sincronizado.",
    // per-entry actions (B2) + the destructive confirm (§1.5)
    retryNow: "Tentar agora",
    retryAgain: "Tentar novamente",
    discard: "Descartar",
    discardConfirmTitle: "Descartar este registro?",
    discardConfirmBody: "Ele não foi enviado para a sua conta e não poderá ser recuperado.",
    // queue banner "Ver" jump (§2.2) — scrolls to the first entry that needs a decision
    queueSee: "Ver",
    // gate: the server never answered about the plan (C5) — mirrors the E2/E3 guard family
    guardError: "Não foi possível verificar seu plano.",
    guardRetry: "Tentar novamente",
    // sign-out guard (ADR-0018 §10 / T011)
    signOutQueueTitle: "{n} registro(s) ainda não foram sincronizados",
    signOutQueueBody:
      "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta.",
    signOutSyncNow: "Sincronizar agora",
    signOutSyncOffline: "Precisa de conexão para enviar.",
    signOutDiscard: "Sair e descartar",
    signOutDiscardConfirmTitle: "Descartar {n} registro(s) e sair?",
    signOutDiscardConfirmBody:
      "Eles não foram enviados para a sua conta e não poderão ser recuperados.",
    signOutDiscardConfirm: "Descartar e sair",
    signOutPartial: "{n} registro(s) não puderam ser enviados. Eles continuam neste aparelho.",
    back: "Voltar",
    // 016/US1 (T004/T006) — o teaser de Orçamentos passou a ser o padrão único
    // (`premiumTeaser.QUOTES`); as chaves antigas saíram daqui pela mesma razão do Catálogo/Kits.
  },
  // 010 (E5, PR-A) — "Minhas simulações": save/consult/reopen a saved multi-channel comparison.
  // Copy = ux-scenarios.md §9 (owner-ratified 2026-07-19), trimmed to the PR-A subset (US1/US2/US5).
  // A scenario is LIVE, never dated — no "salvo em"/"cotado em" anywhere here (§0.2); "Cancelar" is
  // banned (FR-014) — every dismissive control is "Voltar".
  // 016/US2 (T008/T009): "cenário" virou "simulação" em toda superfície visível — o par
  // Histórico/Cenários não comunicava a diferença (congelado × recalculado hoje). A CHAVE do
  // namespace (`scenarios`) e as chaves internas NÃO mudam — só os VALORES pt-BR.
  scenarios: {
    // entry / nav — visible for EVERYONE (free/signed-out too, §0.1); the honest free door.
    navEntry: "Minhas simulações",
    listTitle: "Minhas simulações",
    // 016/US2-AC3 (T009): a frase que diferencia Simulações (recalcula hoje) de Orçamentos
    // (congelado no dia) — texto já dizia isso; mantido verbatim.
    listSubtitle: "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre.",
    // save (T010) — premium-only inline, absent on the free calculator (SC-109, §11-F2)
    saveAction: "Salvar simulação",
    saveSheetTitle: "Salvar simulação",
    saveSheetIntro:
      "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje.",
    nameField: "Nome",
    nameRequired: "Dê um nome à simulação.",
    nameTooLong: "Máximo de 120 caracteres.",
    noteField: "Nota (opcional)",
    noteTooLong: "Máximo de 500 caracteres.",
    basisEcho: "Base de custo: {nome}",
    basisKindAdhoc: "avulsa",
    basisKindProduct: "referência do catálogo",
    basisKindKit: "kit do catálogo",
    saved: "Simulação salva.", // toast success — SÓ em 201 real
    saveTooLarge:
      "Esta simulação ficou grande demais para salvar. Reduza o número de peças ou de custos e tente de novo.",
    saveOffline: "Salvar uma simulação precisa de conexão.",
    saveInvalid: "Corrija os campos da calculadora antes de salvar.",
    // list (T013)
    updatedRelative: "Atualizado {quando}", // "há 2 dias" etc. — NUNCA uma data-alegação
    emptyTitle: "Nenhuma simulação salva ainda",
    emptyBody:
      "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser.",
    emptyAction: "Voltar para a calculadora",
    loadError: "Não foi possível carregar suas simulações.",
    retry: "Tentar novamente",
    loadMore: "Carregar mais",
    offlineTitle: "Modo leitura offline",
    offlineBody:
      "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão.",
    lapsedTitle: "Premium pausado",
    lapsedBody:
      "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium.",
    // reopen — the loaded context bar (T014 PR-A minimal name+live+Fechar; T023/T029 add the
    // degraded caption/"Abrir origem"/Duplicar/Salvar alterações/unsaved-changes)
    loadedLabel: "Simulação: {nome}",
    loadedLive: "Recalculado com os preços de hoje", // NUNCA uma data
    closeScenario: "Fechar simulação",
    back: "Voltar", // NUNCA "Cancelar" (FR-014)
    openOrigin: "Abrir origem", // SÓ quando a referência ainda resolve (F1 — nunca um link quebrado)
    unsavedBadge: "Alterações não salvas",
    saveChanges: "Salvar alterações",
    saveChangesDone: "Simulação atualizada.", // SÓ em 200 real
    saveAsNew: "Salvar como novo",
    discardChangesTitle: "Descartar as alterações não salvas desta simulação?",
    discardChanges: "Descartar",
    writeOffline: "Esta ação precisa de conexão.", // renomear/duplicar/editar/excluir offline
    writeLapsed: "Premium pausado — reative para renomear, duplicar, editar ou excluir.",
    // manage (T029) — list card actions + rename + delete + search
    open: "Abrir",
    duplicate: "Duplicar",
    duplicated: "Simulação duplicada.", // SÓ em 201 real
    rename: "Renomear",
    renameSheetTitle: "Renomear simulação",
    renamed: "Simulação renomeada.", // SÓ em 200 real
    delete: "Excluir",
    deleteTitle: "Excluir a simulação “{nome}”?",
    deleteBody: "Esta ação não pode ser desfeita.",
    deleteConfirm: "Excluir",
    deleted: "Simulação excluída.", // SÓ em 204 real
    searchPlaceholder: "Buscar por nome…",
    searchEmpty: "Nenhuma simulação encontrada para “{termo}”.",
    searchClear: "Limpar busca",
    // kit basis reopen (T024, Q12) — no scalar form to hydrate; a read-only per-channel rollup
    kitBasisTitle: "Kit: {nome}",
    kitBasisHint: "Preços por canal do kit, recalculados com os preços de hoje.",
    // 016/US1 (T004/T006) — o teaser de Simulações passou a ser o padrão único
    // (`premiumTeaser.SCENARIOS`); as chaves antigas saíram daqui pela mesma razão do Catálogo/Kits.
    // 016/T036 (US10, FR-913) — a declaração de descarte: uma simulação salva ANTES do
    // pricing-core 4.0.0 ainda carrega campos aposentados (hoje só `wasteGrams`/"Desperdício").
    // O recálculo abaixo já os exclui (o motor recusa a chave); esta é a frase que diz por quê,
    // persistente (não um toast) — a divergência de preço tem de continuar visível enquanto a
    // simulação estiver aberta, não piscar e sumir. `{campo}` já vem em pt-BR ("Desperdício (g)"),
    // nunca a chave técnica — ver `discardedFieldLabel` no motor de tela.
    discardedFieldNotice:
      "O documento salvo continha {campo}. O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui.",
    // 016/T036 — o NOME em pt-BR do campo aposentado, nunca a chave técnica (`wasteGrams`) na tela.
    // Chaveado por `DiscardedField["field"]` (pricing-core `RETIRED_INPUT_FIELDS`) — hoje só um.
    discardedFieldLabels: {
      wasteGrams: "Desperdício (g)",
    } as Record<string, string>,
  },
  // System states (offline / 404 / generic error). Honest pt-BR: no provider,
  // no price, no cancellation policy (FR-014).
  state: {
    offline: "Você está offline. O cálculo continua funcionando.",
  },
  // hotfix 016/A3 (H5, 2026-08-07) — the way BACK, when the SERVER refuses a live client session
  // (a 401 the client itself never expected). Rendered by `SessionExpiryBanner` in `app-shell`.
  // Never says "conexão"/"online" — the connection is fine; the token is not.
  session: {
    expiredTitle: "Sua sessão expirou",
    expiredBody: "Entre de novo para continuar de onde parou.",
    expiredAction: "Entrar de novo",
  },
  notFound: {
    title: "Página não encontrada",
    body: "O endereço que você abriu não existe.",
    back: "Voltar para Calcular",
  },
  error: {
    title: "Algo deu errado",
    body: "Tente novamente. Se persistir, informe o código de suporte.",
    reload: "Recarregar",
    supportCode: "Código de suporte:",
  },
  // ErrorCode → friendly pt-BR (T055), consumed by Toast/Alert via `shared/api/error-messages`.
  // Users never see raw wire codes (FR-017). Honest: no provider, no price, no cancellation.
  // Keyed by the semantic intent so the shared/api map can wire each generated `ErrorCode`.
  apiError: {
    validation: "Confira os dados informados.",
    unauthenticated: "Sua sessão expirou. Entre novamente.",
    tokenExpired: "Sua sessão expirou. Entre novamente.",
    forbidden: "Você não tem acesso a este recurso.",
    notFound: "Não encontramos o que você procura.",
    internal: "Algo deu errado. Tente novamente.",
    unknown: "Algo deu errado. Tente novamente.",
    // E2 (ADR-0012): the server-side premium gate. Honest — no price, no date (FR-014/US7);
    // final wording owner-ratified with the US7 teaser copy.
    entitlementRequired: "Salvar faz parte do Premium.",
  },
  // E6/T014-T015 (US1/US2 — `ux-billing.md` §8). Tom honesto/calmo. Real prices only (15,99 /
  // 155,88 "equivalente a 12,99/mês"). NO fake "de/por" anchor, no false urgency, no "processando"
  // that implies success before the server confirms it (§0.1/§3.2). "Cancelar" stays a dismiss-ban
  // (FR-014) here — nothing on this surface uses it; the action verb lands in PR-B (US4).
  billing: {
    // E6/US6 (T026) — o painel do plano na Conta. Estas frases moram AQUI, e nao em `conta`, porque
    // o guarda de honestidade (`copy-honesty.test.ts`) isenta exatamente UM namespace: `billing`. A
    // tela e a Conta, o ASSUNTO e cobranca — e foi o guarda que apontou o erro quando as escrevi no
    // lugar errado. Copy de `ux-billing` §4.1/§5: cada frase e verdade do SERVIDOR (ledger +
    // espelho do PSP), nunca estado inferido no cliente (SC-708).
    planRenews: "renova em",
    planActiveUntil: "ativo até",
    planWontRenew: "não renova",
    planCanceledHint: "Seus itens salvos continuam disponíveis; nada é apagado.",
    // §4.3/§10-F1 — pendente de ratificacao do dono. Sem esta linha, "nao renova ate {data}" implica
    // um corte que a cortesia mais longa NAO vai causar.
    planCourtesyOutlives: "Seu acesso de cortesia continua depois disso.",
    planGrace: "pagamento pendente — regularize",
    planGraceDeadline: "até {data}, senão o Premium pausa.",
    planManage: "Gerenciar assinatura",
    planUpdatePayment: "Atualizar forma de pagamento",
    planCancel: "Cancelar assinatura",
    planResubscribe: "Assinar novamente",
    planPeriods: {
      monthly: "Plano mensal",
      annual: "Plano anual",
    },
    // O dialogo de cancelamento (§5): sem culpa, sem escassez falsa. Diz o que ele MANTEM, ate
    // quando, que nada e apagado, e que da para voltar. "Voltar" e a saida segura (FR-014).
    cancelTitle: "Cancelar a assinatura?",
    cancelBody: "Seu Premium continua ativo até {data}.",
    cancelBodyNoDate: "Seu Premium continua ativo até o fim do período já pago.",
    cancelFreeze:
      "Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser.",
    cancelBack: "Voltar",
    cancelConfirm: "Cancelar assinatura",
    cancelDone: "Assinatura cancelada. Premium ativo até {data}.",
    cancelDoneNoDate: "Assinatura cancelada. Premium ativo até o fim do período já pago.",
    cancelFailed: "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes.",
    // offer (US1)
    offerTitle: "Assinar o Premium",
    offerFreeLead: "A calculadora é grátis e continua grátis.",
    offerBody: "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar.",
    // T038/D1 — o espaco entre `R$` e o valor e NBSP (U+00A0), nao espaco comum.
    //
    // MEDIDO na homologacao: a 390px a linha do teaser quebrava ENTRE o simbolo e o numero — a
    // primeira linha terminava em "equivalente a R$" e a segunda comecava em "12,99/mes". Nenhuma
    // assercao geometrica ou de texto ve isso (nao ha corte, nao ha transbordo: `clip = 0px`); so a
    // imagem. Numa linha de PRECO, separar o simbolo do valor e a unica quebra que nao se permite.
    planAnnualName: "Plano anual",
    planAnnualBadge: "recomendado",
    planAnnualPrice: "R$ 155,88/ano",
    planAnnualEquiv: "equivalente a R$ 12,99/mês",
    planAnnualSaving: "~19% de economia frente ao mensal", // o delta real — NUNCA um "de/por"
    planMonthlyName: "Plano mensal",
    planMonthlyPrice: "R$ 15,99/mês",
    planMonthlyNote: "cobrança todo mês, cancele quando quiser",
    subscribeAction: "Assinar Premium",
    // E6/US7 (T032) — a linha de preco dos teasers. So conectivos: os NUMEROS vem de
    // `BILLING_PLANS`, nunca daqui, porque duas fontes de preco sao duas verdades (FR-710/SC-707).
    teaserPriceLead: "Premium:",
    teaserAnnualLead: "no plano anual,",
    handoffNotice: "Você paga no Mercado Pago (Pix ou cartão).",
    cardNeverTouches: "O cartão nunca passa pelo nosso app.",
    alreadyPremium: "Você já é Premium.",
    offerUnavailable:
      "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado.",
    // checkout hand-off (US2)
    openingCheckout: "Abrindo o Mercado Pago…", // verdade: criando a preapproval — NÃO "processando"
    checkoutInProgress:
      "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo.", // 409, F6: nunca o status-code cru
    // return states (US2) — server truth only, NUNCA um "processando" que promete sucesso
    returnPendingTitle: "Confirmando seu pagamento…",
    returnPendingBody:
      "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada.",
    returnRefresh: "Atualizar",
    returnBackToConta: "Voltar para a Conta",
    returnSuccessTitle: "Premium ativo!",
    returnSuccessBody:
      "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho.",
    returnSuccessAction: "Ir para a calculadora",
    returnUnconfirmedTitle: "Ainda não recebemos a confirmação",
    returnUnconfirmedBody:
      "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado.",
    returnVerifyAgain: "Verificar de novo",
  },
  // 016/US1 (T004) — o registro FECHADO de conteúdo do teaser único (`shared/billing/
  // premium-teaser.tsx`, arquitetura-016 §E): título + subtítulo da feature + legenda, por
  // `PremiumFeatureId`. Nenhum componente recebe texto por prop — só a chave da feature; é isso
  // que torna "mesma estrutura nas cinco telas" uma propriedade de TIPO, não de disciplina.
  // Nenhum item explica a mecânica do Premium (isso é da oferta, `billing`); o preço/CTA vêm do
  // `TeaserUpgrade` (E6), absorvido — nunca bifurcado (plan §H).
  premiumTeaser: {
    SCENARIOS: {
      title: "Salve suas simulações",
      // Texto EXATO aprovado pelo dono (spec 016 US1-AC5) — não parafrasear.
      subtitle:
        "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje.",
      caption: "A calculadora continua grátis.",
    },
    CATALOG: {
      title: "Salve e reutilize seu catálogo",
      subtitle:
        "Guarde filamentos, impressoras e produtos uma vez e preencha o cálculo com um toque.",
      // 016/US11 (T049, achado A2 do PR-A) — encurtada: com `freemiumNote` já dizendo "custo e
      // markup são grátis" na primeira dobra da MESMA tela, repetir a frase quase inteira aqui era
      // a mesma afirmação colada duas vezes.
      caption: "A calculadora continua grátis.",
    },
    CATALOG_PICKER: {
      title: "Preencha o cálculo com um toque",
      subtitle:
        "O catálogo guarda seus filamentos e impressoras salvos: no Premium, eles preenchem os campos abaixo sozinhos — e continuam editáveis.",
      // 016/US11 (T044 homologação PR-E, R4) — "A calculadora continua grátis." ficou IMPRECISA
      // com a virada: o bloco de marketplace deixou de ser grátis, e esta legenda vive na MESMA
      // tela do gate de canal. Precisão sobre o que exatamente permanece grátis.
      caption: "O cálculo de custo e markup continua grátis.",
    },
    KITS: {
      title: "Monte e precifique kits com várias peças",
      subtitle:
        "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro, por canal.",
      caption: "A calculadora de peça única continua grátis.",
    },
    QUOTES: {
      title: "Guarde seus orçamentos com a data",
      subtitle:
        "Cada cotação fica guardada com a data e a versão da fórmula — para você provar depois o que cobrou, mesmo que o catálogo mude.",
      caption: "A calculadora continua grátis e sem limite.",
    },
  },
  // 013/FC-02 — the `tf-*` design system must not hold copy; these are its default a11y labels,
  // single-sourced here and injected via prop (dialog.tsx `closeLabel`, toast.tsx close button +
  // toaster region label). A consumer can still override per call site.
  ds: {
    close: "Fechar",
    notifications: "Notificações",
  },
} as const;
