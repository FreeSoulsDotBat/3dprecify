// Typed pt-BR message source (full i18n library is TD-001). Keys are the single source of UI copy.
export const messages = {
  appName: "Precifica3D",
  theme: { toggle: "Alternar tema" },
  auth: {
    loading: "Verificando sessão…",
  },
  signIn: {
    title: "Entrar",
    // Calcular é público (US2/T038): o login dá acesso às áreas guardadas, não ao cálculo.
    subtitle: "Entre para acessar seu catálogo, histórico e conta.",
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
      wasteGrams: "Desperdício",
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
      optional: "Ajustes opcionais",
      optionalHint: "Comece em 0 — preencha só o que se aplica ao seu caso.",
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
        body: "O custo de produção da peça. Material = (custo do rolo ÷ peso do rolo) × (gramas usadas + desperdício). Energia = tempo de impressão × consumo médio × tarifa. Máquina = (valor da máquina ÷ vida útil em horas) × tempo de impressão.",
      },
      optional: {
        label: "Sobre os ajustes opcionais",
        body: "Custos que somam ao total quando preenchidos (0 = ignorado). Falha = % aplicada sobre material + energia + máquina (um print que falha desperdiça os três). Acabamento = tempo × valor por hora. Desperdício = gramas extras (purga/suporte/refugo). Reserva de manutenção = reais por hora de desgaste.",
      },
      labor: {
        label: "Sobre mão de obra e custos",
        body: "Custos opcionais que somam ao total. Mão de obra = horas × valor da hora. Outros custos = um ou mais itens nomeados (embalagem, taxas, overhead), cada um somado ao custo total.",
      },
      outrosCustos: {
        label: "Sobre outros custos",
        body: "Itens nomeados que somam ao custo total: embalagem, frete até a transportadora, taxas, overhead. A soma entra no custo total exatamente como um valor único faria, e cada item aparece na sua própria linha do detalhamento.",
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
    // US5 — "Outros custos" is a slot of 0..N named sub-costs (Embalagem, Frete até a transportadora…);
    // each value soma ao custo_total exatamente como o campo único fazia, e aparece como sua própria
    // linha no detalhamento. `lineFallback` rotula uma linha cujo nome ficou em branco (FR-116).
    outrosCustos: {
      title: "Outros custos",
      hint: "Embalagem, frete até a transportadora, etc. Cada item soma ao custo total.",
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
      freightLine: "Frete / cupom",
      negativeLiquido: "Canal não-lucrativo neste preço (frete maior que a margem).",
      // US4 — master toggle: show/hide the whole marketplace section (default on).
      includeToggle: "Incluir marketplaces no preço",
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
    },
    // US2 — honesty seal (FR-107): where a slot's fee numbers came from and how fresh they are. The
    // reference/embedded states append the source + review date; the estimate marks the ML freight
    // subsidy as a labelled estimate (A4). Never asserts a fabricated number is exact.
    seals: {
      reference: "Referência",
      updatedOn: "atualizada em",
      outdated: "pode estar desatualizada",
      embedded: "referência embutida (offline)",
      adjusted: "ajustado por você",
      none: "sem referência — informe as taxas",
      estimate: "estimativa de frete",
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
    freemiumNote: "Calcular e ver a conta é grátis. Salvar e exportar fazem parte do Premium.",
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
  },
  // App shell navigation (app-nav) — the fixed IA labels (ds-readme §2).
  // `ariaLabel` names the <nav> landmark for assistive tech (a11y copy, honest).
  nav: {
    ariaLabel: "Navegação principal",
    calcular: "Calcular",
    catalogo: "Catálogo",
    historico: "Histórico",
    conta: "Conta",
  },
  // Conta page. Plan indicator is a static, honest "Gratuito" (display-only,
  // gates nothing — no entitlement field exists yet; Principle IV).
  conta: {
    title: "Conta",
    planLabel: "Plano",
    planFree: "Gratuito",
    themeLabel: "Tema",
    // Identity comes from GET /api/v1/me (A23). On failure the section shows an error,
    // never a fabricated fallback identity. Honest copy (no provider/price/cancellation).
    identityErrorTitle: "Não foi possível carregar sua conta",
    retry: "Tentar novamente",
  },
  // Catálogo / Histórico placeholders — state intent, promise no price/date.
  catalogo: {
    emptyTitle: "Catálogo em breve",
    emptyBody: "Aqui você vai salvar filamentos, impressoras e produtos.",
  },
  historico: {
    emptyTitle: "Histórico em breve",
    emptyBody: "Seus cálculos salvos vão aparecer aqui.",
  },
  // System states (offline / 404 / generic error). Honest pt-BR: no provider,
  // no price, no cancellation policy (FR-014).
  state: {
    offline: "Você está offline. O cálculo continua funcionando.",
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
  },
} as const;
