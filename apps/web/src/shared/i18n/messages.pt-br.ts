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
    title: "Calculadora de preço",
    placeholder: "Em breve: cálculo de preço a partir do material e da margem.",
  },
  account: {
    signedInAs: "Conectado como",
    signOut: "Sair",
  },
} as const;
