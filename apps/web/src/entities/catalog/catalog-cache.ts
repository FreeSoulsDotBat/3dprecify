import type { FilamentOut, PrinterOut, ProductOut } from "@/shared/api/generated";
import { createUidCache, isIdentifiedRowArray } from "@/shared/lib/uid-cache";

// Uid-keyed read-cache primitives for the personal catalog (T018). This mirrors the fee-catalog
// store (TanStack Query + idb-keyval) with the CRITICAL differences the identity-leak lesson
// (FR-309/Q2) demands: the IndexedDB key AND the query key carry the account uid, there is NO
// seed (the catalog is user data — empty until the first online read), and the cache is READ-ONLY
// pre-fill (every write is online via the generated client). A device shared by two accounts can
// never surface one account's catalog under the other's uid, and a sign-out sweeps the device.
// (019/polish: the load/persist/purge primitives themselves are shared via `shared/lib/uid-cache`;
// this cache is the one of the five with an extra `resource` dimension in the key.)

export type CatalogResource = "filaments" | "printers" | "products";
export type CatalogItem = FilamentOut | PrinterOut | ProductOut;

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

const cache = createUidCache<CatalogItem[], [resource: CatalogResource, uid: string]>({
    key: catalogIdbKey,
    guard: isIdentifiedRowArray<CatalogItem>,
});

/** Load + shape-guard the uid's cached list; null on empty/error/corrupt (non-blocking). */
export async function loadCachedCatalog<T extends CatalogItem>(
    resource: CatalogResource,
    uid: string,
): Promise<T[] | null> {
    const raw = await cache.load(resource, uid);
    return raw as T[] | null;
}

/** Best-effort persist of a fresh online read under the uid key (a write failure is swallowed —
 *  the cache is not a source of truth; the online read still answered). */
export async function persistCachedCatalog<T extends CatalogItem>(
    resource: CatalogResource,
    uid: string,
    items: T[],
): Promise<void> {
    return cache.persist(items, resource, uid);
}

/**
 * Lê `sellerFixedPrice` de um `ProductOut`, honrando entradas cacheadas ANTES da migração 0008
 * (019/PR-D, T127): um item persistido pelo `use-catalog.ts:61` antes do campo existir volta do IDB
 * com `sellerFixedPrice` **`undefined`** — nunca gravado no wire, então nunca `null`. As duas formas
 * de "não fixado" (`undefined` do cache antigo, `null` do servidor) precisam colapsar no MESMO
 * estado; a alternativa (deixar `undefined` vazar) renderizaria como preço zerado (`Number(undefined)
 * = NaN`, e uma tela menos cuidadosa vira `0,00`) — a mentira que este helper existe para impedir.
 */
export function readSellerFixedPrice(p: ProductOut): number | null {
    const raw = (p as Partial<ProductOut>).sellerFixedPrice;
    if (raw === undefined || raw === null) return null;
    return Number(raw);
}

/** Purge EVERY resource cache for a uid — the sign-out privacy sweep (Q2/FR-309). Called from the
 *  app-layer session subscription the moment the session goes anonymous / the uid changes. */
export async function purgeCatalogCache(uid: string): Promise<void> {
    await Promise.all([
        cache.purge("filaments", uid),
        cache.purge("printers", uid),
        cache.purge("products", uid),
    ]);
}
