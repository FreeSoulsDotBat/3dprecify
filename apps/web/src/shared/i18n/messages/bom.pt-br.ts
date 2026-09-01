// 008/E3 — the KIT composer (user-facing name per K1, 2026-07-11; "BOM" stays technical).
// Premium feature (Q3, ADR-0015); copy is honest/calm: NO price, NO date, NO pre-E6
// purchase CTA anywhere (FR-410). Title/subtitle are the owner's approved wording (K1).
export const bom = {
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
    // A5-d (a5-a6-decisoes.md) — rótulos do READOUT FIXADO do kit, chave por PAPEL, nunca
    // reuso de captions: esta superfície tem ORÇAMENTO DE LARGURA (~85px a --fs-caption 12px
    // — "Preço atacado" mede 111px e trunca; estas duas medem ~55/63px). O contexto ("Total
    // do kit" + o R$ na mesma linha) é o que nomeia o número; "Preço" ali é redundância.
    pinned: {
        retail: "Varejo",
        wholesale: "Atacado",
    },
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
    assemblyCost: "Custo total",
    // Honest headline states (review 2026-07-12): with NO valid line the total is not "R$ 0,00",
    // it simply does not exist yet; a partial kit says how many pieces are out of the sum.
    assemblyNoPriceTitle: "Sem preço ainda",
    assemblyNoPriceBody:
        "O preço do kit aparece assim que ao menos uma peça estiver completa e válida.",
    assemblyExcluded: "{n} peça(s) fora do total — confira os avisos nas peças acima.",
    channelsTitle: "Preços por marketplace (kit)",
    channelContributing: "{n} peça(s) somaram neste marketplace",
    channelSkipped: "{n} peça(s) sem preço neste marketplace — não entrou na soma.",
    channelNoContrib: "Nenhuma peça com preço neste marketplace.",
    // 016/US1 (T004/T006) — o teaser de Kits passou a ser o padrão único (`premiumTeaser.KITS`);
    // as chaves antigas (título/corpo/CTA próprios) saíram daqui pela mesma razão do Catálogo.
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
};
