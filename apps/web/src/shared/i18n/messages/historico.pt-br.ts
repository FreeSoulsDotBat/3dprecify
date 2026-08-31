// E4 (009) — o Histórico prova o que o vendedor COBROU (o Catálogo mostra o que vale hoje).
// Vocabulário deliberado: "Valor cotado", nunca "Preço" (preço é o que a calculadora diz HOJE);
// "salvo" só é dito quando o servidor confirmou; um envio ainda não sincronizado é "pendente
// neste dispositivo" — nunca "falhou" (resposta perdida ≠ não gravado) e nunca "salvo".
export const historico = {
    // list + detail (T013). 016/US2 (T008/T009): "Orçamentos" — o documento CONGELADO (o que foi
    // cotado, imutável); a diferença com Simulações (recalculada hoje) fica dita na própria frase.
    title: "Orçamentos",
    subtitle: "O que você cotou, com a data. Os valores ficam congelados como estavam no dia.",
    emptyTitle: "Nenhum registro ainda",
    emptyBody:
        "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data.",
    emptyAction: "Ir para a calculadora",
    // 019/PR-B (T042) — prancheta 32f: o vazio didático de Orçamentos para quem não paga; o botão
    // leva à calculadora ("é lá que um orçamento nasce"), rótulo em `premiumTeaser.fazerUmCalculo`.
    didaticoTitle: "Nenhum orçamento registrado",
    didaticoBody:
        "Registre um orçamento para guardar o preço do dia congelado, do jeito que você passou para o cliente.",
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
    channels: "Preços por marketplace",
    // 014/T120 — um canal gravado SEM comissão informada. Com comissão 0 o motor devolve anúncio ==
    // base, então existe um número — mas ele não é um preço de marketplace, e a Calcular já se
    // recusa a exibi-lo ("Informe a comissão do marketplace para ver os preços"). O congelado herda a
    // recusa em vez de afirmar o que a origem negou. O tempo verbal é o do registro, não o do
    // conserto: não há o que informar agora, o que houve foi um marketplace sem comissão naquele dia.
    channelNoFee: "sem comissão informada — este marketplace não teve preço",
    // per-channel rollup captions (M11) — contributing/skipped kit lines, stated honestly
    channelContributing: "{n} de {total} peças",
    channelSkipped: "{n} sem este marketplace",
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
};
