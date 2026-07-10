import { del, get, set } from "idb-keyval";

import type { FilamentOut, PrinterOut } from "@/shared/api/generated";

// Uid-keyed read-cache primitives for the personal catalog (T018). This mirrors the fee-catalog
// store (TanStack Query + idb-keyval) with the CRITICAL differences the identity-leak lesson
// (FR-309/Q2) demands: the IndexedDB key AND the query key carry the account uid, there is NO
// seed (the catalog is user data — empty until the first online read), and the cache is READ-ONLY
// pre-fill (every write is online via the generated client). A device shared by two accounts can
// never surface one account's catalog under the other's uid, and a sign-out sweeps the device.

export type CatalogResource = "filaments" | "printers";
export type CatalogItem = FilamentOut | PrinterOut;

/** IndexedDB key — uid-scoped so a device-shared cache never crosses accounts (FR-309). */
export function catalogIdbKey(resource: CatalogResource, uid: string): string {
  return `catalog:${resource}:${uid}`;
}

/** TanStack Query key — uid-scoped (identity-leak lesson): a re-login gets a distinct entry, so
 *  the previous account's list can never be read within staleTime (mirrors the `/me` query, D1). */
export function catalogQueryKey(resource: CatalogResource, uid: string | undefined) {
  return ["catalog", resource, uid] as const;
}

/** Fuzzy root key — `removeQueries({ queryKey: CATALOG_QUERY_ROOT })` clears every uid entry. */
export const CATALOG_QUERY_ROOT = ["catalog"] as const;

/** A stored payload is only trusted if it is an array of objects each carrying a string `id`. A
 *  corrupt/foreign shape is discarded (null) rather than fed to the UI as a broken list. */
function isCatalogArray(raw: unknown): raw is CatalogItem[] {
  return (
    Array.isArray(raw) &&
    raw.every(
      (x) => typeof x === "object" && x !== null && typeof (x as { id?: unknown }).id === "string",
    )
  );
}

/** Load + shape-guard the uid's cached list; null on empty/error/corrupt (non-blocking). */
export async function loadCachedCatalog<T extends CatalogItem>(
  resource: CatalogResource,
  uid: string,
): Promise<T[] | null> {
  try {
    const raw = await get(catalogIdbKey(resource, uid));
    return isCatalogArray(raw) ? (raw as T[]) : null;
  } catch {
    return null;
  }
}

/** Best-effort persist of a fresh online read under the uid key (a write failure is swallowed —
 *  the cache is not a source of truth; the online read still answered). */
export async function persistCachedCatalog<T extends CatalogItem>(
  resource: CatalogResource,
  uid: string,
  items: T[],
): Promise<void> {
  try {
    await set(catalogIdbKey(resource, uid), items);
  } catch {
    /* ignore — the cache is a convenience, never authoritative */
  }
}

/** Purge BOTH resource caches for a uid — the sign-out privacy sweep (Q2/FR-309). Called from the
 *  app-layer session subscription the moment the session goes anonymous / the uid changes. */
export async function purgeCatalogCache(uid: string): Promise<void> {
  try {
    await Promise.all([del(catalogIdbKey("filaments", uid)), del(catalogIdbKey("printers", uid))]);
  } catch {
    /* ignore — a failed purge must never crash the sign-out flow */
  }
}
