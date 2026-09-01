// ⚠ @doc DEC-044 — COMPOR não é INFERIR (SC-708): o erro do ledger vence até uma assinatura em
//   mãos, porque o espelho do PSP diz o que foi contratado, não se o premium está ligado.

/** O que o ledger respondeu (`GET /entitlement`) — a forma servida, campos opcionais inclusos. */
export interface EntitlementLike {
    status: "none" | "active" | "lapsed";
    source?: string | null;
    expiresAt?: string | null;
}

/** O que o espelho do PSP respondeu (`GET /billing/subscription`), ou `null` se não há assinatura. */
export interface SubscriptionLike {
    plan: "monthly" | "annual";
    status: string;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    graceUntil?: string | null;
}

export type PlanState =
    /** O ledger não respondeu. Nunca um palpite — a Conta diz que não sabe. */
    | { kind: "unknown" }
    /** Assinatura ativa: o painel fala de RENOVAÇÃO. */
    | { kind: "subscription-active"; plan: "monthly" | "annual"; renewsAt: string | null }
    /** Cancelada com o período correndo: "ativo até {data} · não renova". */
    | {
          kind: "subscription-canceled";
          activeUntil: string | null;
          /** ux-billing §4.3 — um grant de cortesia vai ALÉM do fim do período (ver abaixo). */
          courtesyOutlives: boolean;
      }
    /** Renovação recusada: premium SEGUE ativo até `graceUntil`. */
    | { kind: "grace"; graceUntil: string | null }
    /** Sem assinatura, premium por grant de operador. */
    | { kind: "courtesy"; source: string; expiresAt: string | null }
    /** Nenhum grant válido — o congelamento de leitura que E2/E4/E5 já implementam. */
    | { kind: "lapsed" }
    /** Nunca teve nada. */
    | { kind: "free" };

/** Estados de assinatura em que o espelho do PSP MANDA no que o painel diz. */
const FALA_PELA_ASSINATURA = new Set(["authorized", "grace", "cancelled"]);

export function planView(args: {
    entitlement: EntitlementLike | undefined;
    subscription: SubscriptionLike | null | undefined;
    /** A leitura do ledger falhou. */
    failed?: boolean;
}): PlanState {
    const { entitlement, subscription, failed } = args;
    if (failed || !entitlement) return { kind: "unknown" };

    // O LEDGER decide se ha premium; o espelho do PSP so decide QUAL historia contar entre as ativas.
    //
    // Esta ordem foi trocada depois que a caminhada de navegador (T027) achou o defeito: com a
    // verificacao do ledger DEPOIS do ramo da assinatura, uma assinatura `authorized` no MP cujo grant
    // ja expirou mostrava "Premium · renova em {data}" sobre uma conta CONGELADA. E o "fake-active"
    // que a US5 proibe em tantas palavras, e acontece de verdade: o webhook da renovacao pode se
    // perder (por isso existe a reconciliacao), e nesse intervalo o espelho diz `authorized` enquanto
    // o ledger ja caducou. Nenhum teste unitario meu via isso — eu so tinha alimentado combinacoes
    // COERENTES, e a incoerencia e justamente o caso que importa (Constituicao IV).
    if (entitlement.status !== "active") {
        return entitlement.status === "lapsed" ? { kind: "lapsed" } : { kind: "free" };
    }

    const sub = subscription ?? null;
    if (sub !== null && FALA_PELA_ASSINATURA.has(sub.status)) {
        if (sub.status === "grace") return { kind: "grace", graceUntil: sub.graceUntil ?? null };
        if (sub.status === "cancelled") {
            return {
                kind: "subscription-canceled",
                activeUntil: sub.currentPeriodEnd ?? null,
                courtesyOutlives: cortesiaSobrevive(entitlement, sub),
            };
        }
        return {
            kind: "subscription-active",
            plan: sub.plan,
            renewsAt: sub.currentPeriodEnd ?? null,
        };
    }

    // Sobra o entitlement ATIVO sem assinatura que fale por ele — cortesia/beta. O `pending` cai
    // aqui de propósito: um checkout aberto e não concluído NÃO move o ledger (SEC-301), então uma
    // conta assim ja saiu pelo ramo de cima como "gratuito".
    return {
        kind: "courtesy",
        source: entitlement.source ?? "comp",
        expiresAt: entitlement.expiresAt ?? null,
    };
}

/**
 * ux-billing §4.3 (recomendação §10-F1, ~70%, **pendente de ratificação do dono**) — a costura que a
 * clarificação de 2026-07-20 meio-especifica.
 *
 * Um vendedor com assinatura CANCELADA que também carrega um grant de cortesia mais longo não vai
 * cair no fim do período: a cortesia o segura. Dizer só "ativo até 31/12 · não renova" implica um
 * corte em 31/12 que não vai acontecer — uma desonestidade sutil, e do tipo que só aparece quando o
 * dia chega e o vendedor não entende por que continua premium.
 *
 * A detecção não precisa de campo novo: o `expiresAt` do ledger é o grant válido MAIS DISTANTE, e se
 * ele passa do fim do período da assinatura, existe algo além dela. A borda é ESTRITA — empate
 * significa que os dois acabam juntos, e aí a frase já está certa; acrescentar a linha prometeria um
 * acesso que não existe no dia seguinte.
 */
function cortesiaSobrevive(ent: EntitlementLike, sub: SubscriptionLike): boolean {
    if (!ent.expiresAt || !sub.currentPeriodEnd) return false;
    return new Date(ent.expiresAt).getTime() > new Date(sub.currentPeriodEnd).getTime();
}
