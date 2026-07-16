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
    // US5 (E2/T024) — the catalog pickers: pre-fill the fields from a saved filament/printer.
    // Picked values stay editable (pre-fill, never lock). Rendered only for signed-in accounts
    // WITH saved items — the free manual flow is untouched (SC-310).
    catalogPicker: {
      title: "Usar do catálogo",
      filament: "Filamento salvo",
      printer: "Impressora salva",
      placeholder: "Escolher…",
      hint: "Preenche os campos com o item salvo — você ainda pode editar tudo.",
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
    historico: "Histórico",
    conta: "Conta",
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
    planLapsed: "Premium expirado",
    planLapsedHint: "Seus itens salvos continuam disponíveis para leitura.",
    // 009/T011b: o plano exibido é a ÚLTIMA resposta do servidor, guardada no aparelho (offline).
    planStale: "última informação do servidor",
    planSources: {
      beta: "via programa beta",
      comp: "cortesia",
    },
    planExpires: "expira em",
    planRefresh: "Atualizar",
    planRefreshHint: "Mudou de plano agora?",
    planUnknown: "Não foi possível confirmar seu plano.",
    themeLabel: "Tema",
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
    edit: "Editar",
    remove: "Excluir",
    // Load / error (§1.4)
    loadError: "Não foi possível carregar seu catálogo.",
    retry: "Tentar novamente",
    // Offline (Q2 · §1.5) — info tone, never danger
    offlineTitle: "Modo leitura offline",
    offlineBody:
      "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.",
    offlineWriteBlocked: "Criar e editar precisam de conexão.",
    staleHint: "pode estar desatualizada",
    // US7/T032 — the honest free-tier teaser (ux §2; final wording owner-ratified at T033).
    // NO price, NO date, NO purchase CTA (billing is E6 — the panel informs, it does not sell).
    teaserTitle: "Salve e reutilize seu catálogo",
    teaserBody:
      "Guarde filamentos, impressoras e produtos uma vez e preencha o cálculo com um toque.",
    teaserDialogTitle: "Salvar faz parte do Premium",
    teaserDialogBody:
      "No Premium você salva filamentos, impressoras e produtos e preenche o cálculo com um toque.",
    teaserFreeNote: "Calcular e ver a conta continuam grátis.",
    teaserSignedOutBody: "Para salvar seu catálogo, entre e ative o Premium.",
    teaserDismiss: "Entendi",
    teaserSignIn: "Entrar",
    // Lapsed (Q3 · §3) — calmo, não punitivo
    lapsedTitle: "Premium pausado",
    lapsedBody:
      "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium.",
    readOnlyHint: "somente leitura",
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
    defaultWaste: "Desperdício padrão",
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
    // Teaser (US5 / §2) — NO price, NO date, NO purchase CTA
    teaserTitle: "Monte e precifique kits com várias peças",
    teaserBody:
      "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro.",
    teaserDialogBody:
      "No Premium você monta kits com várias peças e vê o preço do kit inteiro, por canal.",
    teaserFreeNote: "A calculadora de peça única continua grátis.",
    teaserSignedOutBody: "Para montar kits, entre e ative o Premium.",
    teaserSignIn: "Entrar",
    teaserDismiss: "Entendi",
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
    // list + detail (T013)
    title: "Histórico",
    subtitle: "O que você cotou, com a data. Os valores ficam como estavam no dia.",
    emptyTitle: "Nenhum registro ainda",
    emptyBody:
      "Calcule uma peça ou um kit e toque em “Salvar no histórico” para guardar o preço com a data.",
    emptyAction: "Ir para a calculadora",
    quotedAtCard: "Cotado em {data}",
    quotedAtTime: "Cotado em {data} às {hora}",
    quotedValue: "Valor cotado",
    basisRetailCaption: "preço de varejo",
    basisWholesaleCaption: "preço de atacado",
    kindSingle: "Peça única",
    kindKit: "Kit · {n} peças",
    adhocFallback: "Cálculo avulso",
    loadError: "Não foi possível carregar seu histórico.",
    retry: "Tentar novamente",
    notFound: "Registro não encontrado.",
    backToList: "Voltar",
    // detail
    frozenCaption: "Valores congelados em {data}",
    validityLine: "Validade da proposta: {n} dias",
    kitPieces: "Peças do kit",
    // A COUNT ("3 un"), never "3×" glued to a total that is ALREADY quantity-scaled (review PR-A,
    // C2) — "3× R$ 135,00" would read as a unit price and be multiplied again.
    kitPieceQty: "{n} un",
    breakdown: "Detalhamento",
    channels: "Preços por canal",
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
      "A origem deste registro não está mais no seu catálogo. Dá para recalcular usando os valores guardados neste registro e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo.",
    recalcOfflineNote:
      "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados.",
    recalcConfirm: "Recalcular",
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
    queueFailed: "{n} registro(s) não puderam ser registrados.",
    syncNow: "Sincronizar agora",
    // per-card sync badges (§1)
    syncPendingBadge: "Pendente neste dispositivo",
    syncBlockedBadge: "Envio pausado · precisa de Premium",
    syncFailedBadge: "Não foi possível registrar",
    // offline / lapsed (same family as E2/E3)
    offlineTitle: "Modo leitura offline",
    offlineBody:
      "Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar a ficar online.",
    lapsedBanner:
      "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium.",
    // record (T010)
    saveAction: "Salvar no histórico",
    saveSheetTitle: "Salvar no histórico",
    saveSheetIntro:
      "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje.",
    saveSheetSubmit: "Salvar no histórico",
    labelField: "Rótulo (opcional)",
    labelHint: "Cliente, pedido…",
    validityField: "Validade da proposta",
    validityUnit: "dias",
    basisField: "Preço que você está cotando",
    basisRetail: "Varejo",
    basisWholesale: "Atacado",
    quotedAt: "Cotado em {data}",
    saved: "Registro salvo no histórico.",
    saveDeviceFailed: "Não foi possível guardar o registro neste aparelho. Ele não foi salvo.",
    // sync states (ADR-0018) — o vocabulário honesto
    syncPendingToast: "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão.",
    syncBlockedToast:
      "Envio pausado — o Premium não está ativo. O registro continua neste aparelho.",
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
    // teaser (US5 lineage — E2 US7 / E3 US5). Honest: no price, no date (FR-014).
    teaserTitle: "O histórico faz parte do Premium",
    teaserBody:
      "Com o Premium, cada cotação fica guardada com a data e a versão da fórmula — para você provar depois o que cobrou, mesmo que o catálogo mude.",
    teaserFreeNote: "A calculadora continua grátis e sem limite.",
    teaserSignedOutBody: "Entre na sua conta para guardar suas cotações.",
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
    // E2 (ADR-0012): the server-side premium gate. Honest — no price, no date (FR-014/US7);
    // final wording owner-ratified with the US7 teaser copy.
    entitlementRequired: "Salvar faz parte do Premium.",
  },
} as const;
