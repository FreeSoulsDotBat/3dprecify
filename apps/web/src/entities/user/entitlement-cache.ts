import type { EntitlementView } from "@/shared/api/generated";
import { SERVER_STATUSES } from "@/shared/billing/premium-gate";
import { createUidCache } from "@/shared/lib/uid-cache";

// ⚠ @doc DEC-029 — esta store só ECOA o que o servidor disse; ela nunca CRIA um plano. Valor
//   corrompido ou forjado resolve para "sem resposta", nunca para premium.

/** IndexedDB key — uid-scoped, like every persisted thing in this app (FR-309 lineage). */
export function entitlementIdbKey(uid: string): string {
    return `entitlement:${uid}`;
}

/** A stored value is trusted ONLY if it carries one of the three statuses the server can actually
 *  answer (the ONE list, `shared/billing/premium-gate.ts`). Anything else is not "a plan we do not
 *  recognise" — it is NOT AN ANSWER. */
function isEntitlementView(raw: unknown): raw is EntitlementView {
    return (
        typeof raw === "object" &&
        raw !== null &&
        SERVER_STATUSES.has(String((raw as { status?: unknown }).status))
    );
}

const cache = createUidCache<EntitlementView>({
    key: entitlementIdbKey,
    guard: isEntitlementView,
});

/** The uid's last-known server answer; null on empty/error/corrupt (never a fabricated plan). */
export async function loadCachedEntitlement(uid: string): Promise<EntitlementView | null> {
    return cache.load(uid);
}

/** Store the server's answer verbatim. Best-effort: the cache is a convenience, never authoritative
 *  — a failed write must not break the app (contrast with the OUTBOX, which must throw). */
export async function persistCachedEntitlement(uid: string, view: EntitlementView): Promise<void> {
    return cache.persist(view, uid);
}

/** Part of the sign-out privacy sweep — one account's plan never lingers for the next. */
export async function purgeEntitlementCache(uid: string): Promise<void> {
    return cache.purge(uid);
}
