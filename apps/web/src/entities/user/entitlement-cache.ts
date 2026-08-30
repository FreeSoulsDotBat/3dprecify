import { del, get, set } from "idb-keyval";

import type { EntitlementView } from "@/shared/api/generated";

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

/** IndexedDB key — uid-scoped, like every persisted thing in this app (FR-309 lineage). */
export function entitlementIdbKey(uid: string): string {
  return `entitlement:${uid}`;
}

const SERVER_STATUSES = new Set(["none", "active", "lapsed"]);

/** A stored value is trusted ONLY if it carries one of the three statuses the server can actually
 *  answer. Anything else is not "a plan we do not recognise" — it is NOT AN ANSWER. */
function isEntitlementView(raw: unknown): raw is EntitlementView {
  return (
    typeof raw === "object" &&
    raw !== null &&
    SERVER_STATUSES.has(String((raw as { status?: unknown }).status))
  );
}

/** The uid's last-known server answer; null on empty/error/corrupt (never a fabricated plan). */
export async function loadCachedEntitlement(uid: string): Promise<EntitlementView | null> {
  try {
    const raw = await get(entitlementIdbKey(uid));
    return isEntitlementView(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Store the server's answer verbatim. Best-effort: the cache is a convenience, never authoritative
 *  — a failed write must not break the app (contrast with the OUTBOX, which must throw). */
export async function persistCachedEntitlement(uid: string, view: EntitlementView): Promise<void> {
  try {
    await set(entitlementIdbKey(uid), view);
  } catch {
    /* a plan that failed to cache is simply re-read online next time */
  }
}

/** Part of the sign-out privacy sweep — one account's plan never lingers for the next. */
export async function purgeEntitlementCache(uid: string): Promise<void> {
  try {
    await del(entitlementIdbKey(uid));
  } catch {
    /* a failed purge must never crash the sign-out flow */
  }
}
