import type { BomOut } from "@/shared/api/generated";
import { createUidCache, isIdentifiedRowArray } from "@/shared/lib/uid-cache";

// Uid-keyed read-cache primitives for saved KITS (T014). Deliberately a MIRROR of
// `entities/catalog/catalog-cache` rather than a reuse of it: FSD-Lite lets an entity import only
// from `shared`, so a cross-entity import is forbidden by eslint-boundaries. The rule that matters
// here is a privacy invariant, not a convenience — the uid rides BOTH the IndexedDB key and the
// query key (FR-309), there is NO seed (kits are user data), and the cache is READ-ONLY pre-fill
// (every write goes online). Both copies of the rule are pinned by their own tests, so neither can
// drift into leaking one account's data under another's uid.
// (019/polish: the load/persist/purge primitives themselves are shared via `shared/lib/uid-cache`.)

/** IndexedDB key — uid-scoped so a device shared by two accounts never crosses them (FR-309). */
export function bomIdbKey(uid: string): string {
    return `boms:${uid}`;
}

/** TanStack Query key — uid-scoped, so a re-login can never read the previous account's kits
 *  within staleTime (the identity-leak lesson, D1). */
export function bomQueryKey(uid: string | undefined) {
    return ["boms", uid] as const;
}

/** Fuzzy root key — `removeQueries({ queryKey: BOM_QUERY_ROOT })` clears every uid entry. */
export const BOM_QUERY_ROOT = ["boms"] as const;

const cache = createUidCache<BomOut[]>({ key: bomIdbKey, guard: isIdentifiedRowArray<BomOut> });

/** Load + shape-guard the uid's cached kits; null on empty/error/corrupt (non-blocking). */
export async function loadCachedBoms(uid: string): Promise<BomOut[] | null> {
    return cache.load(uid);
}

/** Best-effort persist of a fresh online read (a failure is swallowed — the cache is never
 *  a source of truth; the online read already answered). */
export async function persistCachedBoms(uid: string, items: BomOut[]): Promise<void> {
    return cache.persist(items, uid);
}

/** Purge the uid's kits — part of the sign-out privacy sweep (FR-309), called from the app layer
 *  alongside the catalog purge. */
export async function purgeBomCache(uid: string): Promise<void> {
    return cache.purge(uid);
}
