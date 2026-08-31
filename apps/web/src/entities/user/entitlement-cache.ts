import type { EntitlementView } from "@/shared/api/generated";
import { SERVER_STATUSES } from "@/shared/billing/premium-gate";
import { createUidCache } from "@/shared/lib/uid-cache";

// 009/T011b (E4, PR-A) — the last-known SERVER entitlement, persisted (owner decision 2026-07-13).
//
// ADR-0018 §9 offers recording on the "last-known server entitlement — a cached server response,
// never a client-held flag". That cache used to be React Query's in-memory one, which is empty on a
// cold boot: a premium seller opening the app ALREADY offline (the feira the outbox exists for) met
// the teaser and could not record at all. The offline queue was unreachable exactly when it was the
// whole point.
//
// The distinction this file has to keep sharp is the one Principle IV rests on:
//
//   this store may only ECHO what the server said. It can never CREATE a plan.
//
// Which is why the shape guard is strict (a corrupt or forged value resolves to "no answer", never
// to premium), the key is uid-scoped (a shared device cannot grant one account another's premium),
// and the store is swept on sign-out. The server still gets the final word where it counts: a write
// attempted on a stale `active` is refused at sync with a 403 and the entry becomes `blocked` —
// visible, retained, never silently accepted.
// (019/polish: the load/persist/purge primitives themselves are shared via `shared/lib/uid-cache`.)

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
