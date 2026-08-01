// E6 PR-B (T026/US6) — a regra do painel da Conta, como decisão PURA.
//
// A Conta compõe DUAS verdades do servidor: o ledger (`GET /entitlement` — quem decide se há
// premium, Constituição IV) e o espelho do PSP (`GET /billing/subscription` — o que o vendedor
// contratou e pode gerenciar). A clarificação de 2026-07-20 dá a precedência: **a assinatura vence
// quando existe; a cortesia responde quando não há assinatura; a conta está ativa enquanto QUALQUER
// grant válido existir.**
//
// Compor não é inferir (SC-708): nenhum estado aqui nasce de um palpite do cliente — cada um é a
// leitura de um campo que o servidor mandou. Por isso o erro do ledger vence tudo, inclusive uma
// assinatura em mãos: o espelho do PSP diz o que foi contratado, não se o premium está ligado.
//
// O resultado é uma união discriminada de propósito, pelo mesmo motivo do `RefreshOutcome` da 014:
// uma combinação não tratada não é representável, então nenhum `if` esquecido pode produzir um
// painel sem estado.

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
    return { kind: "subscription-active", plan: sub.plan, renewsAt: sub.currentPeriodEnd ?? null };
  }

  // `pending` cai aqui de propósito: um checkout aberto e não concluído NÃO move o ledger
  // (SEC-301), então quem responde é o ledger — e ele dirá "nenhum". Mostrar a assinatura pendente
  // como plano seria prometer o que ainda não houve.
  if (entitlement.status === "active") {
    return {
      kind: "courtesy",
      source: entitlement.source ?? "comp",
      expiresAt: entitlement.expiresAt ?? null,
    };
  }
  return entitlement.status === "lapsed" ? { kind: "lapsed" } : { kind: "free" };
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
