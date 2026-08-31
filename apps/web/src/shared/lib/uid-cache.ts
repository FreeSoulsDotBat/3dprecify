import { del, get, set } from "idb-keyval";

// 019/polish — generic uid-scoped IndexedDB read-cache, factored out of 5 structurally identical
// entity caches (bom/catalog/history/scenario/entitlement). Every one of them shares the same
// substrate: a uid-scoped IndexedDB key (FR-309 identity-leak lesson — a device shared by two
// accounts must never surface one account's data under the other's uid), a shape guard that turns
// a corrupt/foreign payload into "no cached value" rather than feeding it to the UI, and
// best-effort persistence — the cache is a convenience, never a source of truth.
//
// The `catch {}` blocks are intentionally empty EVERYWHERE below: an IndexedDB failure (quota,
// private mode, a corrupt store) must never crash the app or block the sign-out sweep — the caller
// always has an online fallback, and a failed purge cannot be allowed to interrupt sign-out.

/** Builds a uid-cache with the operations every consumer needs. `A` is the argument tuple every
 *  operation takes to resolve a key — usually just `[uid: string]`, but the catalog cache also
 *  threads a `resource` ahead of the uid (`[resource, uid]`). */
export function createUidCache<T, A extends unknown[] = [uid: string]>(config: {
    /** Builds the IndexedDB key from the same args every operation below takes. */
    key: (...args: A) => string;
    /** Trusts a stored value only if it matches `T`; anything else resolves to "no cached value",
     *  never to a fabricated/partial one. */
    guard: (raw: unknown) => raw is T;
}) {
    const { key, guard } = config;

    /** Load + shape-guard the cached value; null on empty/error/corrupt (non-blocking). */
    async function load(...args: A): Promise<T | null> {
        try {
            const raw = await get(key(...args));
            return guard(raw) ? raw : null;
        } catch {
            // ignore — the cache is a convenience, never authoritative
            return null;
        }
    }

    /** Best-effort persist of a fresh online read (a failure is swallowed — the online read
     *  already answered). */
    async function persist(items: T, ...args: A): Promise<void> {
        try {
            await set(key(...args), items);
        } catch {
            // ignore — the cache is a convenience, never authoritative
        }
    }

    /** Best-effort purge (sign-out privacy sweep). */
    async function purge(...args: A): Promise<void> {
        try {
            await del(key(...args));
        } catch {
            // ignore — a failed purge must never crash the sign-out flow
        }
    }

    return { load, persist, purge };
}
