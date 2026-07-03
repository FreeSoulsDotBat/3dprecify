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
  calculator: {
    title: "Calcular preço",
    fields: {
      costPerRoll: "Custo do rolo",
      rollWeight: "Peso do rolo",
      grams: "Gramas usadas",
      markup: "Markup",
    },
    markupHint: "Margem sobre o custo (não sobre o preço de venda).",
    markupCaptionPrefix: "markup",
    rollWeightError: "O peso do rolo deve ser maior que zero.",
    results: {
      material: "Material",
      suggested: "Preço sugerido",
    },
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
    themeDark: "Tema escuro",
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
