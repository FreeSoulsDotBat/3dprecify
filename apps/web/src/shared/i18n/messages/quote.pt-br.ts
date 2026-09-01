// 010 (E5, PR-A) — "Minhas simulações": save/consult/reopen a saved multi-channel comparison.
// Copy = ux-scenarios.md §9 (owner-ratified 2026-07-19), trimmed to the PR-A subset (US1/US2/US5).
// A scenario is LIVE, never dated — no "salvo em"/"cotado em" anywhere here (§0.2); "Cancelar" is
// banned (FR-014) — every dismissive control is "Voltar".
// 016/US2 (T008/T009): "cenário" virou "simulação" em toda superfície visível — o par
// Histórico/Cenários não comunicava a diferença (congelado × recalculado hoje). A CHAVE do
// namespace (`scenarios`) e as chaves internas NÃO mudam — só os VALORES pt-BR.
// 019/PR-E (T087) — prancheta 18 ("Orcamentos - Montar e Enviar"), cópia congelada em
// `specs/019-porte-design/design/`, byte a byte. Só o que a spec US6/US16/US17 abrange (Q6 venda
// direta, desconto no TOTAL; Q7 "Válido até" é texto; Q10 abaixo do custo AVISA; Q8 PDF pelo
// servidor). Fora, e registrado em dod-evidence §T087: a 18c inteira (US18 RETIRADA), os cinco
// estados da lista e "Marcar aceito/recusado" (18a/18e·2), frete (18d), "Sobra sobre o custo" só
// como leitura do piso, "Como sai no WhatsApp"/Copiar/Compartilhar (18f), o "prazo de produção".
export const quote = {
    // 18a — a entrada. A lista de orçamentos é a aba Orçamentos de sempre (decisão do dono: a
    // prancheta desenha um 3º segmento do Catálogo e chama a escolha de "decisão sua").
    newQuote: "Novo orçamento",
    // 18b — escolher do catálogo.
    clientLabel: "Cliente",
    searchPlaceholder: "Buscar no catálogo",
    unitPriceMeta: "{valor} a unidade",
    // B1 (decisão do dono 2026-08-31): quando o motor não consegue computar o item, a linha mostra
    // AUSÊNCIA (—) e esta legenda, e o valor segue zerado até o vendedor consertar — nunca um preço
    // inventado. Copy sem prancheta (correção de bug); sujeita à segunda passada do dono.
    basePriceUnavailable: "Sem preço — revise este item no Catálogo",
    lineMeta: "{n} un. × {valor}",
    kitLineMeta: "{n} un. · {pecas} peças",
    stoppedCannotQuote: "preço parado desde {data} — resolva para orçar",
    itemCount: "{n} itens",
    itemCountOne: "1 item",
    continueAction: "Continuar",
    // 18d — o desconto e o piso (Q10: abaixo do custo AVISA; o bloqueio da 18d·3 não é aplicado —
    // registrado).
    discountLabel: "Desconto",
    subtotal: "Subtotal",
    discountLine: "Desconto {pct}%",
    discountAmountLine: "Desconto",
    total: "Total",
    marginOverCost: "Sobra sobre o custo",
    marginOverCostSub: "custo de {valor}",
    tightMarginTitle: "Sobram {sobra} — {pct}% sobre o custo",
    tightMarginBody:
        "Total de {total}. Ainda dá lucro, mas uma falha de impressão nesse lote come a sobra.",
    belowCost: "Abaixo do custo — o total fica {valor} menor que o que você gasta",
    // 18e — enviar congela.
    sendTitle: "Enviar congela este preço",
    totalSent: "Total enviado",
    validUntil: "Válido até",
    validUntilSub: "{n} dias, contados de hoje",
    freezeNote:
        "Até {data} este total não muda, mesmo que o filamento suba. Depois disso ele vence e você pode refazer com os custos do dia.",
    back: "Voltar",
    send: "Enviar",
    sentCaption: "enviado em {data} · válido até {ate}",
    noUnfixForSent: "Voltar a acompanhar não vale para orçamentos enviados",
    // DECISÃO 4 (27/08): Enviar exige conexão — a razão segue o molde da família "precisa de
    // conexão" (`scenarios.saveOffline`, `historico.exportOffline`); a prancheta não a desenha.
    sendOffline: "Enviar um orçamento precisa de conexão.",
    // Enquanto o registro não voltou do servidor não há PDF (o export exige o id do servidor).
    pdfWaitsSync: "O PDF fica disponível assim que o orçamento for registrado na sua conta.",
    // 18f — o documento (a cópia do PDF é do servidor; aqui o cabeçalho do registro na tela).
    documentKicker: "Orçamento {n}",
    documentDates: "{data} · válido até {ate}",
};
