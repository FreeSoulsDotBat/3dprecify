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
      markup: "Markup",
      breakdown: "Como chegamos no preço",
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
      markup: {
        label: "Sobre o markup",
        body: "A margem sobre o custo total. Preço = custo total × (1 + markup%). Varejo e atacado aplicam markups diferentes sobre o mesmo custo.",
      },
      breakdown: {
        label: "Sobre o cálculo do preço",
        body: "Cada linha em reais soma exatamente ao custo total; os preços vêm do custo total × markup.",
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
    },
    results: {
      material: "Material",
      energy: "Energia",
      machine: "Máquina",
      failure: "Falha / perdas",
      finishing: "Acabamento",
      custoTotal: "Custo total",
      varejo: "Preço varejo",
      atacado: "Preço atacado",
    },
    captions: {
      varejo: "Varejo",
      atacado: "Atacado",
      markup: "markup",
      derivedFrom: "custo total ×",
    },
    invalidNote: "Confira os campos destacados para ver o preço.",
    freemiumNote: "Calcular e ver a conta é grátis. Salvar e exportar fazem parte do Premium.",
  },
  account: {
    signedInAs: "Conectado como",
    signOut: "Sair",
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
