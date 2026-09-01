// Catálogo — the premium save/reuse surface (E2 · US3/US4 → T019/T022). Tom honesto/calmo,
// sem preço/data (Q5/FR-014). Copy from ux-catalog §6, owner-ratified with the US7 teaser (T033).
export const catalog = {
    // Segmented tabs (G1)
    tabsLabel: "Seções do catálogo",
    tabFilaments: "Filamentos",
    tabPrinters: "Impressoras",
    tabProducts: "Produtos",
    tabKits: "Kits",
    // Empty (premium, per entity)
    // 019/PR-B (T042) — prancheta 32a: o título perdeu o "ainda" ("prometia que aquilo ia mudar
    // sozinho — e para quem não paga, não ia"); é o MESMO título para quem paga e para quem não paga.
    // Os títulos de impressora/produto/kit NÃO foram desenhados no lote 32 — ficam como estavam.
    emptyFilamentsTitle: "Nenhum filamento cadastrado",
    emptyFilamentsBody: "Salve seus filamentos uma vez e reutilize em cada cálculo.",
    emptyPrintersTitle: "Nenhuma impressora salva ainda",
    emptyPrintersBody: "Salve os dados da sua impressora uma vez e reutilize em cada cálculo.",
    emptyProductsTitle: "Nenhum produto salvo ainda",
    emptyProductsBody: "Salve uma peça com seus custos e reabra com o preço sempre recalculado.",
    emptyKitsTitle: "Nenhum kit salvo ainda",
    emptyKitsBody: "Monte um kit com várias peças e reabra com o preço sempre recalculado.",
    // 019/PR-B (T042) — o VAZIO DIDÁTICO (prancheta 32c, "as seis frases"): a versão longa que quem
    // ainda não paga lê no lugar da parede. A de filamento é do dono, verbatim (25/08); as outras
    // seguem o padrão dela e foram aprovadas pelo dono em 25/08 (design/README.md §4). Transcritas
    // byte a byte da cópia congelada em `specs/019-porte-design/design/`.
    educationalFilamentsBody:
        "Cadastre um filamento para poder reutilizar em todos os seus cálculos de precificação em poucos cliques.",
    educationalPrintersBody:
        "Cadastre sua impressora para que a depreciação e a energia entrem em todos os cálculos sem você calcular nada.",
    educationalProductsBody:
        "Cadastre uma peça com seus custos para reabrir o preço sempre recalculado, sem digitar tudo de novo.",
    educationalKitsBody:
        "Monte um kit com várias peças para ver o preço do conjunto inteiro recalculado a cada abertura.",
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
    // 013/FB-04 — neutral placeholder while filaments/printers are still loading: a loading
    // reference must never render as "manual" (that's a claim about data provenance, not a spinner).
    resolvingRef: "carregando…",
    edit: "Editar",
    remove: "Excluir",
    // 018/US1 — o mestre-detalhe do desktop. A busca filtra a lista JÁ carregada (nenhuma
    // requisição nova), e por isso o vazio dela fala de busca, não de catálogo vazio.
    searchLabel: "Buscar no catálogo",
    searchPlaceholder: "Buscar no catálogo…",
    // 019/PR-F (T098, Q1/Q2 27/08) — as duas strings sem `{termo}` (`searchEmptyTitle`/
    // `searchEmptyBody`) colapsam nesta, no molde de `historico.searchEmpty` (`:1095`): reaproveita
    // a frase existente ("Nada encontrado") em vez de inventar uma nova.
    searchEmpty: "Nada encontrado para “{termo}”.",
    searchClear: "Limpar busca",
    detailFilament: "Filamento salvo",
    detailPrinter: "Impressora salva",
    detailProduct: "Produto salvo",
    detailKit: "Kit salvo",
    // A ficha de produto/kit RESUME e manda para o editor de página cheia — o formulário completo
    // não é recomposto dentro de 560px (decisão do dono, clarify 2026-08-10).
    detailOpenEditor: "Abrir para editar",
    // Load / error (§1.4)
    loadError: "Não foi possível carregar seu catálogo.",
    retry: "Tentar novamente",
    // Offline (Q2 · §1.5) — info tone, never danger
    offlineTitle: "Modo leitura offline",
    offlineBody:
        "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.",
    staleHint: "pode estar desatualizada",
    // 016/US1 (T004/T006) — o teaser do Catálogo passou a ser o padrão único
    // (`shared/billing/premium-teaser.tsx`, registro `premiumTeaser.CATALOG`); as chaves antigas
    // (título/corpo/modal/CTA próprios) saíram daqui — eram exatamente a divergência que a US1
    // existe para eliminar.
    // 019/PR-B (T038, prancheta 32e): a faixa "Premium pausado" do Catálogo SAIU — "a mensagem agora
    // mora no formulário, junto ao botão que ela explica" (`reactivateBody`). `lapsedTitle`/`lapsedBody`
    // foram apagadas por ficarem sem consumidor; as de Kits/Simulações continuam (T090 vigia).
    readOnlyHint: "somente leitura",
    // 013/FB-02 — the reactivation line a read-only form footer shows in place of Salvar
    // (ux-catalog §3, owner-ratified copy). No price, no date — same honesty bar as the teaser.
    reactivateTitle: "Reative o Premium",
    reactivateBody: "Reative o Premium para voltar a criar e editar. Seus itens estão salvos.",
    // 019/PR-D (T074) — pranchetas 16 ("Lista e o Recalculo") e 17 ("O Item Aberto"), cópias
    // congeladas em `specs/019-porte-design/design/`, byte a byte. O preço GRANDE é sempre o
    // recomputado de hoje ou o número que o vendedor declarou (ADR-0033 §1); a observação guardada é
    // contexto ("era"), nunca fonte.
    // 16b — a faixa do topo. Só o plural foi desenhado; o singular segue o molde (lição do T031).
    priceChangedCount: "{n} preços mudaram desde a sua última visita",
    priceChangedOne: "1 preço mudou desde a sua última visita",
    priceWasLabel: "era {valor}",
    savedAtLabel: "Salvo em {data}",
    savedAtLower: "salvo em {data}",
    stoppedAtLabel: "Parou em {data}",
    // 16b·2 / 17a / 17g — os cabeçalhos do item aberto (a legenda carrega o estado).
    suggestedToday: "Preço sugerido hoje",
    suggestedRetail: "Preço sugerido · varejo",
    capRecalculated: "recalculado hoje · era {valor} quando você salvou",
    capRecalculatedShort: "recalculado hoje · era {valor}",
    capWasWhenSaved: "era {valor} quando você salvou, em {data}",
    capUnchanged: "salvo em {data} · sem mudança de custo desde então",
    keepPrice: "Manter {valor}",
    acceptNewPrice: "Aceitar novo preço",
    // 17c — o preço fixado (tom ATENÇÃO no aviso: spec US5 AC3; a 17c desenha info — a spec ganha).
    fixedByYou: "Preço fixado por você",
    fixedBadge: "Fixado",
    fixedFlag: "fixado",
    fixedSince: "desde {data}",
    capFixed: "desde {data} · a conta hoje daria {hoje}",
    fixedOverNote:
        "A conta hoje daria {hoje} — {diff} acima. Enquanto estiver fixado, este preço não acompanha o custo do filamento.",
    unfix: "Voltar a acompanhar o custo",
    // 16f / 17g — o item parado (o insumo sumiu): "parado" é impedimento, "fixado" é escolha.
    stoppedFlag: "parado",
    stoppedPrice: "Preço parado",
    capStopped: "de {data} · o filamento saiu dos seus materiais",
    stoppedTitle: "Este preço parou em {data}",
    stoppedBody:
        "O filamento {filamento} foi apagado dos seus materiais, então não há custo novo para usar. {valor} é o valor de quando você salvou.",
    chooseAnotherFilament: "Escolher outro filamento",
    // 16e / 17a — ações do item.
    openInCalculator: "Abrir no cálculo",
    rename: "Renomear",
    deleteProductBody:
        "A peça sai do catálogo e o preço para de acompanhar o custo do filamento. Os cálculos que você já fez continuam no Histórico.",
    // 17d — duplicar: o nome já vem com o sufixo; a cópia NÃO herda a data nem o preço fixado.
    duplicateTitle: "Duplicar {nome}",
    duplicateCopySuffix: " (cópia)",
    copyNameLabel: "Nome da cópia",
    inherits: "Herda",
    inheritsBody: "peso, tempo, filamento, markup, marketplace e categoria",
    notInherits: "Não herda",
    notInheritsBody:
        "a data — a cópia é salva hoje — nem o preço fixado, que volta a acompanhar o custo",
    // 17e — a aba Kits: o kit herda o pior estado de qualquer peça sua.
    kitMeta: "{n} peças · salvo em {data}",
    kitStoppedCount: "{n} parada",
    kitStoppedTitle: "O total do kit está parado em {data}",
    kitStoppedBody:
        "Uma das peças não pôde ser recalculada, então a soma também não. Resolva {peca} e o kit volta a acompanhar.",
    kitLineStopped: "filamento apagado · parado",
    // 16g — a tabela ≥1024px: a coluna "Antes" é o "era R$ X" promovido a coluna; travessão onde não mudou.
    tableColName: "Peça",
    tableColPrice: "Preço sugerido",
    tableColBefore: "Antes",
    tableColSavedAt: "Salvo em",
    tableColActions: "Ações",
    tableNoChange: "—",
};

// Catálogo create/edit form (Sheet) + delete confirm (Dialog). Numeric field LABELS reuse
// `calculator.fields.*`; per-field VALIDATION reuses `calculator.validation.*` verbatim (FR-306).
export const catalogForm = {
    newFilament: "Novo filamento",
    editFilament: "Editar filamento",
    // 019/PR-D (T074) — prancheta 17b: as duas recusas do nome, ANTES do submit (a normalização
    // local `shared/lib/name-norm.ts` é a mesma do servidor; o servidor renomeia em silêncio — Q5).
    nameRequired: "A peça precisa de um nome para você achá-la depois",
    nameConflict: "Este nome já está no catálogo",
    nameConflictHint:
        "Nomes repetidos são aceitos em Kits, onde a mesma peça aparece em vários; aqui eles impedem você de saber qual abriu.",
    nameCounter: "{n} de {max} caracteres",
    saveName: "Salvar nome",
    newPrinter: "Nova impressora",
    editPrinter: "Editar impressora",
    name: "Nome",
    namePlaceholderFilament: "Ex.: PLA Azul",
    namePlaceholderPrinter: "Ex.: Ender 3",
    material: "Material",
    materialPlaceholder: "Ex.: PLA",
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
};

// Produto create/edit — FULL PAGE route reusing the Calcular layout (US6/T030, ux §1.6b).
// No stored price is ever shown: the page recomputes live via computeFromForm (FR-310/FR-313).
export const productForm = {
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
};
