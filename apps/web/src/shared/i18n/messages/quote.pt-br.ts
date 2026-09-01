// @doc DEC-048 — cópia VERBATIM da prancheta. Simulação é VIVA, nunca datada; "Cancelar" é
//   banido (é "Voltar"); as CHAVES não mudam quando o nome no produto muda.
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
