export const appName = "Precifica3D";

export const theme = { toggle: "Alternar tema" };

export const auth = {
    loading: "Verificando sessão…",
};

export const signIn = {
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
};

// `account` merges the former `account` (signedInAs/signOut) and `conta` (Conta page) namespaces
// into one (owner decision 2026-08-31, i18n key cleanup). No internal key collided.
export const account = {
    signedInAs: "Conectado como",
    signOut: "Sair",
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
};

// FR-214 (006) — minimal honest privacy notice (owner-decided Option A, 2026-07-08; final wording
// ratified by the owner before the UAT URL is shared — T027). No consent library: a notice, not a
// consent gate. Full LGPD (consent mgmt, data deletion) is deliberately deferred to E2 (persistence).
export const privacy = {
    title: "Como tratamos seus dados",
    google: "Para entrar, usamos o Login com Google, que nos informa seu e-mail — usado apenas para identificar sua conta.",
    monitoring: "Registramos erros técnicos (Sentry) para corrigir falhas.",
    noSale: "Não vendemos seus dados nem fazemos rastreamento para publicidade.",
    calculatorFree: "A calculadora funciona sem login e não coleta nada.",
    // E2 (007/T034): the catalog now stores user data (filaments, printers, products) per account.
    // Honest, minimal — no consent library yet (full LGPD still deferred); a notice, not a gate.
    catalogData:
        "Se você usar o Premium, salvamos seu catálogo (filamentos, impressoras e produtos) na sua conta para você reutilizar nos cálculos.",
};

// App shell navigation (app-nav) — the fixed IA labels (ds-readme §2).
// `ariaLabel` names the <nav> landmark for assistive tech (a11y copy, honest).
export const nav = {
    ariaLabel: "Navegação principal",
    calculate: "Calcular",
    catalog: "Catálogo",
    kits: "Kits", // 008/K1 — the 5th section (owner-approved IA change)
    // 016/US2 (T008) — a MESMA rota `/historico`, o rótulo visível vira "Orçamentos": o par
    // Histórico/Cenários não comunicava a diferença (congelado × recalculado hoje).
    history: "Orçamentos",
    account: "Conta",
    // 018/US5 — o rail colapsável. O botão diz o que VAI acontecer, não o estado atual: quem lê
    // "Recolher" sabe o que o clique faz; quem lê "Recolhido" fica adivinhando.
    collapse: "Recolher",
    expand: "Expandir",
};

// System states (offline / 404 / generic error). Honest pt-BR: no provider,
// no price, no cancellation policy (FR-014).
export const state = {
    offline: "Você está offline. O cálculo continua funcionando.",
};

// hotfix 016/A3 (H5, 2026-08-07) — the way BACK, when the SERVER refuses a live client session
// (a 401 the client itself never expected). Rendered by `SessionExpiryBanner` in `app-shell`.
// Never says "conexão"/"online" — the connection is fine; the token is not.
export const session = {
    expiredTitle: "Sua sessão expirou",
    expiredBody: "Entre de novo para continuar de onde parou.",
    expiredAction: "Entrar de novo",
};

export const notFound = {
    title: "Página não encontrada",
    body: "O endereço que você abriu não existe.",
    back: "Voltar para Calcular",
};

export const error = {
    title: "Algo deu errado",
    body: "Tente novamente. Se persistir, informe o código de suporte.",
    reload: "Recarregar",
    supportCode: "Código de suporte:",
};

// ErrorCode → friendly pt-BR (T055), consumed by Toast/Alert via `shared/api/error-messages`.
// Users never see raw wire codes (FR-017). Honest: no provider, no price, no cancellation.
// Keyed by the semantic intent so the shared/api map can wire each generated `ErrorCode`.
export const apiError = {
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
    // B10 (decisão do dono 2026-09-01): a frase ÚNICA da escrita sem conexão. Eram duas — "Criar e
    // editar precisam de conexão." (catálogo) e esta (simulações) — para o mesmo fato, e a que o
    // dono escolheu é a que também cobre excluir. Mora aqui, e não numa tela, porque `apiError` é a
    // casa das frases que `honestWriteError` (shared/api) fala por todo o app.
    offlineWrite: "Esta ação precisa de conexão.",
};

// 013/FC-02 — the `tf-*` design system must not hold copy; these are its default a11y labels,
// single-sourced here and injected via prop (dialog.tsx `closeLabel`, toast.tsx close button +
// toaster region label). A consumer can still override per call site.
export const ds = {
    close: "Fechar",
    notifications: "Notificações",
    // 019/PR-A (contracts/ui-porte.md §C0) — o nome acessível da dispensa do selo de procedência
    // (`tf-alert__close`), verbatim da prancheta "A camada de baixo" 23b.
    dismiss: "Dispensar",
};
