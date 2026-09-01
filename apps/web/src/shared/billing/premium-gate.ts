// ⚠ @doc DEC-037 — decide o que a tela MOSTRA, nunca o que ela PODE (o portão é do servidor).
//   Sem resposta, o estado é `unknown`: nem presume grátis, nem presume premium.

/** Os três estados que o servidor emite (ledger-derived, ADR-0012). */
export type ServerEntitlementStatus = "none" | "active" | "lapsed";

export interface EntitlementLike {
    status: ServerEntitlementStatus;
}

/** A forma do `useSessionStore().status` — copiada como literal para o módulo não importar nada. */
export interface SessionLike {
    status: "loading" | "authenticated" | "anonymous" | "not-configured";
}

/**
 * Os cinco estados. "-com-itens" NÃO é um valor daqui: é composição da TELA a partir de
 * `list.items.length` (a função pura não sabe de itens).
 */
export type PremiumGate = "active" | "lapsed" | "never-subscribed" | "signed-out" | "unknown";

/** Os três estados que o SERVIDOR emite (ledger via GET /api/v1/entitlement) — exportado para que
 *  a guarda do cache de entitlement valide contra o MESMO conjunto (uma lista só, nunca duas). */
export const SERVER_STATUSES: ReadonlySet<string> = new Set<ServerEntitlementStatus>([
    "none",
    "active",
    "lapsed",
]);

export function premiumGate(
    entitlement: EntitlementLike | null | undefined,
    session: SessionLike,
): PremiumGate {
    // Sessão ainda carregando não é "deslogado": ainda não se sabe. `main.tsx` segura o app nesse
    // estado, então na prática as telas nunca o veem — mas a função não presume.
    if (session.status === "loading") return "unknown";
    // E-5 (dono, 27/08): o deslogado vê o MESMO caminho sem parede — qualquer entitlement que sobrou
    // em memória de outra conta é irrelevante (o cache é uid-scoped e purgado no sign-out).
    if (session.status !== "authenticated") return "signed-out";

    const status = entitlement?.status;
    // Um status que o servidor não emite não é "um plano que não reconhecemos" — é NÃO-RESPOSTA
    // (o mesmo guard de forma do `entitlement-cache.ts`).
    if (status === undefined || !SERVER_STATUSES.has(status)) return "unknown";
    if (status === "active") return "active";
    if (status === "lapsed") return "lapsed";
    return "never-subscribed";
}
