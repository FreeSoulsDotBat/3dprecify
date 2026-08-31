export const scenarios = {
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
        "Guardamos a estratégia desta tela — marketplaces, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje.",
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
    // 019/Polish — as strings de `relativeLabel` (movidas verbatim de `scenarios-list-sheet.tsx`,
    // texto final na tela byte-idêntico).
    relative: {
        now: "agora mesmo",
        minutes: "há {n} min",
        hours: "há {n} h",
        day: "há {n} dia",
        days: "há {n} dias",
        week: "há {n} semana",
        weeks: "há {n} semanas",
    },
    emptyTitle: "Nenhuma simulação salva ainda",
    emptyBody:
        "Monte uma comparação de marketplaces na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser.",
    emptyAction: "Voltar para a calculadora",
    // 019/PR-B (T042) — prancheta 32c: a frase didática de Simulações (o título não foi desenhado no
    // lote 32 — fica `emptyTitle`); o botão do vazio leva à calculadora (32f).
    didaticoBody:
        "Salve uma simulação para reabrir sua estratégia de marketplaces e taxas com os preços de hoje.",
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
    kitBasisHint: "Preços por marketplace do kit, recalculados com os preços de hoje.",
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
};
