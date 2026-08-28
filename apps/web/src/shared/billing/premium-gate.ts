// 019/PR-B (T043, research §E-1) — a união de CINCO estados que as quatro telas premium leem.
//
// O servidor JÁ deriva do ledger `none | active | lapsed` (`backend/app/entitlement/__init__.py`),
// e as duas portas já são diferentes (leitura aceita `lapsed`; escrita exige `active`). "Nunca
// teve" × "teve e venceu" é, portanto, ESTRUTURAL do lado do servidor — esta função só LÊ esse
// campo e o compõe com a sessão. Não é um gate (Constituição IV intocada; diff vazio em
// `app/entitlement/`, SC-1903): é a forma de a tela decidir o que MOSTRA, nunca o que PODE.
//
// Pura e sem imports: recebe formas ESTRUTURAIS (`{status}`), como o `plan-view.ts` do E6 faz com
// `EntitlementLike`. `shared` não pode importar `entities` — e é `shared/billing` (o vazio didático,
// o rodapé do formulário inerte) quem precisa dela. Guarda de grafo em `premium-gate.test.ts`.
//
// O que ela NUNCA faz: presumir. Sem resposta do servidor (nem fresca, nem lembrada do cache
// uid-scoped — ADR-0018 §9) o estado é `unknown`: nem "presume grátis" nem "presume premium". A
// tela decide o que fazer com `unknown` (hoje cada uma mantém o próprio `GateChecking`/`GateError`).

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
export type PremiumGate = "active" | "lapsed" | "free-nunca-teve" | "signed-out" | "unknown";

const SERVER_STATUSES: ReadonlySet<string> = new Set<ServerEntitlementStatus>([
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
  return "free-nunca-teve";
}
