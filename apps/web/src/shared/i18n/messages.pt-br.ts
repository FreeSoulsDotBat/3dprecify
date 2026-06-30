// Typed pt-BR message source (full i18n library is TD-001). Keys are the single source of UI copy.
export const messages = {
  appName: "Precifica3D",
  theme: { toggle: "Alternar tema" },
  auth: {
    loading: "Verificando sessão…",
  },
  signIn: {
    title: "Entrar",
    subtitle: "Faça login para calcular seus preços.",
    google: "Entrar com Google",
    error: "Não foi possível entrar. Tente novamente.",
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
} as const;
