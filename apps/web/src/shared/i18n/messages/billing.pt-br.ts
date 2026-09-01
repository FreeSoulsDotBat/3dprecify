// E6/T014-T015 (US1/US2 — `ux-billing.md` §8). Tom honesto/calmo. Real prices only (15,99 /
// 155,88 "equivalente a 12,99/mês"). NO fake "de/por" anchor, no false urgency, no "processando"
// that implies success before the server confirms it (§0.1/§3.2). "Cancelar" stays a dismiss-ban
// (FR-014) here — nothing on this surface uses it; the action verb lands in PR-B (US4).
export const billing = {
    // E6/US6 (T026) — o painel do plano na Conta. Estas frases moram AQUI, e nao em `conta`, porque
    // o guarda de honestidade (`copy-honesty.test.ts`) isenta exatamente UM namespace: `billing`. A
    // tela e a Conta, o ASSUNTO e cobranca — e foi o guarda que apontou o erro quando as escrevi no
    // lugar errado. Copy de `ux-billing` §4.1/§5: cada frase e verdade do SERVIDOR (ledger +
    // espelho do PSP), nunca estado inferido no cliente (SC-708).
    planRenews: "renova em",
    planActiveUntil: "ativo até",
    planWontRenew: "não renova",
    planCanceledHint: "Seus itens salvos continuam disponíveis; nada é apagado.",
    // §4.3/§10-F1 — pendente de ratificacao do dono. Sem esta linha, "nao renova ate {data}" implica
    // um corte que a cortesia mais longa NAO vai causar.
    planCourtesyOutlives: "Seu acesso de cortesia continua depois disso.",
    planGrace: "pagamento pendente — regularize",
    planGraceDeadline: "até {data}, senão o Premium pausa.",
    planManage: "Gerenciar assinatura",
    planUpdatePayment: "Atualizar forma de pagamento",
    planCancel: "Cancelar assinatura",
    planResubscribe: "Assinar novamente",
    planPeriods: {
        monthly: "Plano mensal",
        annual: "Plano anual",
    },
    // O dialogo de cancelamento (§5): sem culpa, sem escassez falsa. Diz o que ele MANTEM, ate
    // quando, que nada e apagado, e que da para voltar. "Voltar" e a saida segura (FR-014).
    cancelTitle: "Cancelar a assinatura?",
    cancelBody: "Seu Premium continua ativo até {data}.",
    cancelBodyNoDate: "Seu Premium continua ativo até o fim do período já pago.",
    cancelFreeze:
        "Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser.",
    cancelBack: "Voltar",
    cancelConfirm: "Cancelar assinatura",
    cancelDone: "Assinatura cancelada. Premium ativo até {data}.",
    cancelDoneNoDate: "Assinatura cancelada. Premium ativo até o fim do período já pago.",
    cancelFailed: "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes.",
    // offer (US1)
    offerTitle: "Assinar o Premium",
    offerFreeLead: "A calculadora é grátis e continua grátis.",
    offerBody: "O Premium guarda seu catálogo, kits, orçamentos e simulações — e libera exportar.",
    // T038/D1 — o espaco entre `R$` e o valor e NBSP (U+00A0), nao espaco comum.
    //
    // MEDIDO na homologacao: a 390px a linha do teaser quebrava ENTRE o simbolo e o numero — a
    // primeira linha terminava em "equivalente a R$" e a segunda comecava em "12,99/mes". Nenhuma
    // assercao geometrica ou de texto ve isso (nao ha corte, nao ha transbordo: `clip = 0px`); so a
    // imagem. Numa linha de PRECO, separar o simbolo do valor e a unica quebra que nao se permite.
    planAnnualName: "Plano anual",
    planAnnualBadge: "recomendado",
    planAnnualPrice: "R$ 155,88/ano",
    planAnnualEquiv: "equivalente a R$ 12,99/mês",
    planAnnualSaving: "~19% de economia frente ao mensal", // o delta real — NUNCA um "de/por"
    planMonthlyName: "Plano mensal",
    planMonthlyPrice: "R$ 15,99/mês",
    planMonthlyNote: "cobrança todo mês, cancele quando quiser",
    subscribeAction: "Assinar Premium",
    // 019/PR-B (T042) — prancheta 32e: quem TINHA e deixou vencer vê "Reativar", não "Assinar".
    reactivateAction: "Reativar Premium",
    // E6/US7 (T032) — a linha de preco dos teasers. So conectivos: os NUMEROS vem de
    // `BILLING_PLANS`, nunca daqui, porque duas fontes de preco sao duas verdades (FR-710/SC-707).
    teaserPriceLead: "Premium:",
    teaserAnnualLead: "no plano anual,",
    handoffNotice: "Você paga no Mercado Pago (Pix ou cartão).",
    cardNeverTouches: "O cartão nunca passa pelo nosso app.",
    alreadyPremium: "Você já é Premium.",
    offerUnavailable:
        "O Mercado Pago não respondeu agora. Tente de novo em instantes — nada foi cobrado.",
    // checkout hand-off (US2)
    openingCheckout: "Abrindo o Mercado Pago…", // verdade: criando a preapproval — NÃO "processando"
    checkoutInProgress:
        "Você já tem um pagamento em andamento. Conclua no Mercado Pago ou aguarde alguns minutos e tente de novo.", // 409, F6: nunca o status-code cru
    // return states (US2) — server truth only, NUNCA um "processando" que promete sucesso
    returnPendingTitle: "Confirmando seu pagamento…",
    returnPendingBody:
        "Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada.",
    returnRefresh: "Atualizar",
    returnBackToAccount: "Voltar para a Conta",
    returnSuccessTitle: "Premium ativo!",
    returnSuccessBody:
        "Seu catálogo, kits, orçamentos e simulações agora salvam e exportam. Bom trabalho.",
    returnSuccessAction: "Ir para a calculadora",
    returnUnconfirmedTitle: "Ainda não recebemos a confirmação",
    returnUnconfirmedBody:
        "Se você concluiu o pagamento, ele aparece aqui em instantes — o Premium liga sozinho. Se você não concluiu, nada foi cobrado.",
    returnVerifyAgain: "Verificar de novo",
};

// 016/US1 (T004) — o registro FECHADO de conteúdo do teaser único (`shared/billing/
// premium-teaser.tsx`, arquitetura-016 §E): título + subtítulo da feature + legenda, por
// `PremiumFeatureId`. Nenhum componente recebe texto por prop — só a chave da feature; é isso
// que torna "mesma estrutura nas cinco telas" uma propriedade de TIPO, não de disciplina.
// Nenhum item explica a mecânica do Premium (isso é da oferta, `billing`); o preço/CTA vêm do
// `TeaserUpgrade` (E6), absorvido — nunca bifurcado (plan §H).
export const premiumTeaser = {
    // 019/PR-B (T042) — prancheta 32b/32e/32f (Premium - O Caminho Sem Parede): a frase que fica
    // ACIMA da linha de botões do formulário inerte, e o rótulo do botão do vazio de Orçamentos e
    // Simulações (o destino, não "Adicionar" — "prometeria uma tela de cadastro que não existe").
    saveIsPartOfPremium: "Salvar faz parte do Premium.",
    makeACalculation: "Fazer um cálculo",
    // 019/PR-D (T074) — brief US13 AC5 / prancheta 16d: sem consumidor nesta fatia (a 16d foi superada
    // pela PR-B); transcrita porque a T074 a lista — o dono decide onde entra.
    calculationStaysFree: "O cálculo continua grátis",
    SCENARIOS: {
        title: "Salve suas simulações",
        // Texto EXATO aprovado pelo dono (spec 016 US1-AC5) — não parafrasear.
        subtitle:
            "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje.",
        caption: "A calculadora continua grátis.",
    },
    CATALOG: {
        title: "Salve e reutilize seu catálogo",
        subtitle:
            "Guarde filamentos, impressoras e produtos uma vez e preencha o cálculo com um toque.",
        // 016/US11 (T049, achado A2 do PR-A) — encurtada: com `freemiumNote` já dizendo "custo e
        // markup são grátis" na primeira dobra da MESMA tela, repetir a frase quase inteira aqui era
        // a mesma afirmação colada duas vezes.
        caption: "A calculadora continua grátis.",
    },
    CATALOG_PICKER: {
        title: "Preencha o cálculo com um toque",
        subtitle:
            "O catálogo guarda seus filamentos e impressoras salvos: no Premium, eles preenchem os campos abaixo sozinhos — e continuam editáveis.",
        // 016/US11 (T044 homologação PR-E, R4) — "A calculadora continua grátis." ficou IMPRECISA
        // com a virada: o bloco de marketplace deixou de ser grátis, e esta legenda vive na MESMA
        // tela do gate de canal. Precisão sobre o que exatamente permanece grátis.
        caption: "O cálculo de custo e markup continua grátis.",
    },
    KITS: {
        title: "Monte e precifique kits com várias peças",
        subtitle:
            "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro, por marketplace.",
        caption: "A calculadora de peça única continua grátis.",
    },
    QUOTES: {
        title: "Guarde seus orçamentos com a data",
        subtitle:
            "Cada cotação fica guardada com a data e a versão da fórmula — para você provar depois o que cobrou, mesmo que o catálogo mude.",
        caption: "A calculadora continua grátis e sem limite.",
    },
};
