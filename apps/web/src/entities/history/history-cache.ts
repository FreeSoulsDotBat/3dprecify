import type { SnapshotOut } from "@/shared/api/generated";
import { createUidCache, isIdentifiedRowArray } from "@/shared/lib/uid-cache";

// 009/T013 (E4, PR-A) — the uid-keyed READ cache for the Histórico (US2: readable offline).
//
// Same substrate and same rules as the catalog/kit caches: uid-scoped key (a shared device can
// never surface one account's ledger under the other's uid), no seed (the Histórico is user data —
// empty until the first online read), shape-guarded on read, swept on sign-out.
//
// And the same DELIBERATE difference from the OUTBOX that sits next to it: this cache SWALLOWS
// write failures, because it is a convenience — every row in it already exists on the server. The
// outbox must never swallow one, because a queued row exists NOWHERE else.
// (019/polish: the load/persist/purge primitives themselves are shared via `shared/lib/uid-cache`.)

/** IndexedDB key — uid-scoped (FR-309 identity-leak lesson). */
export function historyIdbKey(uid: string): string {
    return `history:snapshots:${uid}`;
}

const cache = createUidCache<SnapshotOut[]>({
    key: historyIdbKey,
    guard: isIdentifiedRowArray<SnapshotOut>,
});

/** The uid's cached ledger; null on empty/error/corrupt (never a broken list fed to the UI). */
export async function loadCachedSnapshots(uid: string): Promise<SnapshotOut[] | null> {
    return cache.load(uid);
}

/** Best-effort persist — the cache is a convenience, never authoritative. */
export async function persistCachedSnapshots(uid: string, items: SnapshotOut[]): Promise<void> {
    return cache.persist(items, uid);
}

/** Part of the sign-out privacy sweep. */
export async function purgeHistoryCache(uid: string): Promise<void> {
    return cache.purge(uid);
}
