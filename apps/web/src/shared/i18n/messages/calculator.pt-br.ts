// 016/US6 (FR-908, conteudo-tooltips.md §Notas de escopo #5) — two tooltip numbers carry an
// EXPIRY DATE (ANEEL's projected national average tariff, the legal minimum wage per hour) and
// live in their OWN named keys so the annual refresh is a VALUE edit, not a hunt through prose.
const TOOLTIP_REF_TARIFA_MEDIA_NACIONAL = "R$ 0,85"; // projeção ANEEL dez/2026 — revisar 1º/jan
const TOOLTIP_REF_SALARIO_MINIMO_HORA = "R$ 7,37"; // salário mínimo 2026 ÷ 220h — revisar 1º/jan

// E1 full corrected pricing calculator (spec 004). US1 (correct retail + wholesale) +
// US2 (transparent breakdown) are the MVP. Copy is pt-BR, i18n-ready (TD-001). The
// `costPerRoll/rollWeight/grams/markup` keys are kept as the stable labels some pre-E1
// e2e specs still address (migrated to the full model in T041); E1 adds the rest.
export const calculator = {
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
        markupRetail: "Markup varejo",
        markupWholesale: "Markup atacado",
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
        // 019/PR-F (T141) — prancheta 10 ("Calculadora - A Conta e os Precos"), cópia congelada em
        // `specs/019-porte-design/design/`, byte a byte. As frases dos seis estados da 10c JÁ existiam
        // (invalidNote, resultadoZerado, avisoAtacadoAcimaDoVarejo já acentuado, freightHint,
        // negativeLiquido, noFeeHint, a faixa sem tarifa) — só o que o lote 10 acrescenta entra aqui.
        // 10a — o markup sobe para o cabeçalho da seção; a conta termina no custo total.
        markupHeader: "markup {varejo}% no varejo · {atacado}% no atacado",
        // 10a — a legenda da barra de proporção. A prancheta diz "…acima — metade do seu custo é
        // material." e a 10d "O peso de cada custo no total. Metade do seu custo é material.": a
        // segunda frase é EXEMPLO (50% = material), não copy fixa — registrada para o dono; até ele
        // decidir, só a parte fixa é exibida.
        proportionCaption: "O peso de cada custo no total. As cores são as das bolinhas acima",
        // 10a — sob a seção de marketplaces, explicando o que o segmented governa.
        marketplaceLevelHint:
            "O marketplace mostra só o nível escolhido acima — trocar para Atacado troca os dois números.",
        // 10a/10e — a linha-resumo do preço que NÃO está no cartão grande ("Atacado · markup 30%").
        summaryLine: "{nivel} · markup {pct}%",
        marketplace: "Marketplace",
        // 019/PR-F (T142) — a T141 listou as quatro frases visíveis do lote 10 e não capturou esta:
        // o `aria-label` do `<Segmented split>` Varejo|Atacado, presente byte a byte na marcação
        // congelada das 10a/10b/10c/10d/10e (`aria-label="Nível de preço"`). Transcrita agora, da
        // mesma cópia congelada — não é copy nova, é a que a T141 deixou passar.
        priceLevelLabel: "Nível de preço",
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
        otherCosts: {
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
    plausibility: {
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
        grams: "Confira as gramas: {v} g são mais de 50 kg de filamento numa peça só. Se você informou o peso do ROLO, o campo pede o que a PEÇA consome. Nada foi recusado.",
        absurdCost:
            "Confira os custos: R$ {v} para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais em algum campo. Nada foi recusado.",
        zeroPrice:
            "O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado.",
        lowCommission:
            "Confira a comissão: {v}%. Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado.",
        quantity:
            "Confira a quantidade: {v}. O máximo por peça é {max}. Acima disso o kit não consegue ser salvo. Nada foi recusado.",
        // 019/PR-C (T055) — prancheta 14 ("Aviso de Plausibilidade"), cópia congelada em
        // `specs/019-porte-design/design/`. "Entendi" dispensa o aviso (some o aviso, não o valor; guarda
        // o par campo+valor pela sessão). Quando o aviso convive com uma RECUSA, o fecho "Nada foi
        // recusado." mentiria — troca por este, e o "Entendi" não aparece (14b: "não se dispensa uma
        // lição que acompanha uma recusa").
        understood: "Entendi",
        closingNormal: "Nada foi recusado.",
        closingRejected: "Corrija o campo acima para calcular.",
        // 019/PR-C (decisão do dono 28/08, prancheta 14b "Erro e aviso juntos") — quando o campo TAMBÉM
        // foi recusado, o `tf-aviso` não repete "Confira {campo}: {valor}…"; ele guarda SÓ A LIÇÃO
        // (derivada das frases acima, mesmo fecho `fechoComRecusa`), sem cabeça e sem "Entendi" — não
        // se dispensa uma lição que acompanha uma recusa.
        lesson: {
            machineLifetimeHours:
                "Se você pensou em anos, multiplique pelas horas que imprime por ano — 1.200 h/ano × 3 anos = 3.600 h. Corrija o campo acima para calcular.",
            avgPowerKw:
                "Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts: 120 W são 0,12 kW. Corrija o campo acima para calcular.",
            tariffPerKwh: `No Brasil se paga perto de ${TOOLTIP_REF_TARIFA_MEDIA_NACIONAL} por kWh. Na conta de luz, divida o valor total pelos kWh do mês. Corrija o campo acima para calcular.`,
            rollWeightKg:
                "O rolo comum tem 1 kg — se você informou gramas, 1.000 g são 1 kg. Corrija o campo acima para calcular.",
            printGrams:
                "O campo pede o que a PEÇA consome, não o peso do rolo. Corrija o campo acima para calcular.",
            printTimeHours:
                "Se você quis dizer minutos, use o campo de minutos ao lado. Corrija o campo acima para calcular.",
            laborRatePerHour:
                "Se você informou quanto quer ganhar por mês, divida pelas horas do mês — R$ 3.000 ÷ 160 h = R$ 18,75. Corrija o campo acima para calcular.",
            maintenanceReservePerHour:
                "Se você informou o gasto do ano inteiro, divida pelas horas que imprime no ano. Corrija o campo acima para calcular.",
        },
    },
    results: {
        material: "Material",
        energy: "Energia",
        machine: "Máquina",
        failure: "Falha / perdas",
        finishing: "Acabamento",
        labor: "Mão de obra",
        totalCost: "Custo total",
        retail: "Preço varejo",
        wholesale: "Preço atacado",
        listingPrice: "Preço para anunciar",
        netReceived: "Recebido líquido",
    },
    captions: {
        retail: "Varejo",
        wholesale: "Atacado",
        markup: "markup",
    },
    // 015/A8 ([F03a-003], decisao do dono 2026-08-03) — atacado acima do varejo e ENTRADA VALIDA:
    // o numero e do vendedor e o motor calcula sem reclamar. O que faltava era dizer que aconteceu.
    // A frase e deliberadamente descritiva ("ficou acima"), nunca corretiva ("corrija"): quem le um
    // aviso escrito como erro conclui que o produto recusou, e o produto nao recusou.
    wholesaleAboveRetailWarning:
        "O preço de atacado ficou acima do varejo. Nada foi recusado — só confira se é isso mesmo.",
    // US5 — "Outros custos" is a slot of 0..N named sub-costs (Embalagem, Etiqueta…); each value
    // soma ao custo_total exatamente como o campo único fazia, e aparece como sua própria linha no
    // detalhamento. `lineFallback` rotula uma linha cujo nome ficou em branco (FR-116).
    // 016/US12 (FR-918) — "frete até a transportadora" saiu do exemplo (ver `sectionInfo.outrosCustos`).
    otherCosts: {
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
        addChannel: "Adicionar marketplace",
        removeChannel: "Remover marketplace",
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
        negativeNet: "Marketplace não-lucrativo neste preço (frete maior que a margem).",
        // 014/SC-817 — o anúncio necessário cai numa faixa de preço para a qual o marketplace não
        // publica tarifa. Dizer isso é a única resposta honesta: a tarifa da faixa vizinha não vale
        // aqui, e um R$ 0,00 sob selo de referência seria pior que nenhum número.
        unpricedBand:
            "Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do marketplace para precificar.",
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
        pricesTitle: "Preços por marketplace",
        channelFallback: "Marketplace",
        errorRow: "Corrija os campos deste marketplace para ver os preços.",
        noFeeHint: "Informe a comissão do marketplace para ver os preços.",
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
                "{value} por pedido, somado como custo do marketplace — o preço do anúncio sobe MAIS que isso, porque a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido).",
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
            "Este marketplace ainda não tem taxa de referência — informe a comissão nos campos abaixo.",
        unavailableWithFee:
            "A lista de categorias ainda não está disponível para este marketplace.",
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
        // 019/PR-C (T055) — prancheta 13 ("Selo de Procedencia"): o selo deixa de ser pílula e vira
        // `tf-alert--compact`; o rótulo nomeia o NÚMERO que o selo respalda ("Comissão" / "Taxa fixa" —
        // nunca "Referência"); "Ver fonte" abre a citação inteira + o link do catálogo; "Dispensar" tira
        // o selo até a fonte (citação ou data) mudar.
        commissionLabel: "Comissão",
        viewSource: "Ver fonte",
        dismiss: "Dispensar",
        sourceTitle: "Fonte da comissão",
        sourceCheckedOn: "Conferida por nós em {data}",
        sourceDisclaimer:
            "Abre fora do app. A tarifa é da {marketplace} — nós citamos, não garantimos.",
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
        nationalAverageTariff: TOOLTIP_REF_TARIFA_MEDIA_NACIONAL,
        minimumWagePerHour: TOOLTIP_REF_SALARIO_MINIMO_HORA,
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
        paceLabel: "Com que frequência ela roda?",
        paceOptions: {
            few: "Poucas horas por semana",
            daily: "Quase todo dia",
            always: "Praticamente o dia todo",
        },
        paybackLabel: "Em quantos anos quer que ela se pague?",
        // 019/T031 — o singular é do texto ("1 anos" era a única frase do produto que não era português).
        paybackYearLabel: "{n} ano",
        paybackYearsLabel: "{n} anos",
        // 019/PR-C (T055) — prancheta 15 ("Bloco da Maquina"): o par de botões vira o segmented
        // "Estimar · Ajustar"; o custo/hora vira READOUT com a divisão que o produziu escrita embaixo
        // ("de R$ 4.000,00 ÷ 3.600 h"), nos DOIS modos; sem valor da máquina o zero ganha a ressalva; e
        // voltar à estimativa com horas digitadas à mão PERGUNTA antes de sobrescrever (15e — inline no
        // bloco, com os dois números em disputa, cada um no seu botão). `adjustButton`/
        // `backToEstimateButton`/`derivedCaption` saíram: substituídos, não renomeados.
        // 019/PR-C (decisão do dono 28/08, prancheta 15a/15f) — o título do bloco. A 15a o desenha em
        // TODAS as larguras com um ⓘ "Sobre o custo da máquina" cujo corpo a prancheta não traz —
        // o título entra; o ⓘ espera a copy do dono.
        blockTitle: "A máquina",
        estimate: "Estimar",
        adjust: "Ajustar",
        readoutLabel: "Custo da máquina por hora de impressão",
        readoutDivision: "de {valor} ÷ {horas} h",
        missingValueCaveat: "falta o valor da máquina",
        confirmTitle: "A estimativa por ritmo vai substituir as suas {atual} h por {novo} h",
        // `{anos}` recebe o rótulo já flexionado ("3 anos" / "1 ano" — a lição do T031).
        confirmBody: '{ritmo} h/ano × {anos}. Seu número volta se você tocar "Ajustar" de novo.',
        confirmUse: "Usar {novo} h",
        confirmKeep: "Manter {atual} h",
    },
};
