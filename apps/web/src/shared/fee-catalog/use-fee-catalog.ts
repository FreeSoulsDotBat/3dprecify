import { useQuery } from "@tanstack/react-query";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";

import { apiFetch } from "@/shared/api/transport";

import { type FeeCatalog, parseFeeCatalog } from "./fee-catalog";
import { FEE_CATALOG_SEED } from "./seed";

// Fetch→persist→seed catalog store (ADR-0010 Part 2 / T009c). Resolution order: persisted store
// (freshest cached) → bundled seed (first-run offline, R1) → refresh from GET /api/v1/fee-catalog
// when online. The cache MUST be persisted (IndexedDB) so an offline reload keeps the catalog (R2). A
// fetch failure is NON-BLOCKING — the store/seed always answer, so the calculator never blocks on the
// network; the price math itself stays fully offline in pricing-core (FR-118). The UI wiring (seal,
// loading/retry states) lands in US2/US3; this module is the store + its pure helpers.

/** Where the ACTIVE catalog came from — drives the honesty seal (US2). */
export type CatalogSource = "seed" | "catalog";

/** IndexedDB key for the single persisted fee-catalog entry (idb-keyval). */
export const FEE_CATALOG_STORE_KEY = "fee-catalog";

/** TanStack Query key for the served-catalog refresh. */
export const FEE_CATALOG_QUERY_KEY = ["fee-catalog"] as const;

/** Pick the fresher of two catalogs by `catalogVersion` ("YYYY-MM-DD.n" sorts lexicographically). */
export function freshest(incoming: FeeCatalog, current: FeeCatalog): FeeCatalog {
  return incoming.catalogVersion >= current.catalogVersion ? incoming : current;
}

/** Load + validate the persisted catalog; null on empty/error/invalid (non-blocking — seed answers). */
export async function loadPersistedCatalog(): Promise<FeeCatalog | null> {
  try {
    const raw = await get(FEE_CATALOG_STORE_KEY);
    return raw === undefined ? null : parseFeeCatalog(raw);
  } catch {
    return null;
  }
}

/** Best-effort persist (the store is a cache, not a source of truth — a write failure is swallowed). */
export async function persistCatalog(catalog: FeeCatalog): Promise<void> {
  try {
    await set(FEE_CATALOG_STORE_KEY, catalog);
  } catch {
    /* ignore — the seed still guarantees offline availability (R1) */
  }
}

/** Fetch + validate the served catalog (the wire payload is re-validated with the shared schema). */
export async function fetchServedCatalog(): Promise<FeeCatalog> {
  return parseFeeCatalog(await apiFetch<unknown>("/api/v1/fee-catalog"));
}

interface ActiveCatalog {
  catalog: FeeCatalog;
  source: CatalogSource;
}

export interface UseFeeCatalog extends ActiveCatalog {
  /** STICKY: true from the first failed refresh until the next successful one. It must NOT track
   *  `query.isError` directly — a `refetch()` of a no-data errored query re-enters `'pending'`, so
   *  `isError` (and `isRefetching`) briefly drop to false mid-retry; gating the US3 notice on that
   *  made the whole notice blink out for the retry's duration. Latching keeps it steady until success. */
  refreshFailed: boolean;
  /** A refresh is in flight (initial load OR retry). The notice only renders under `refreshFailed`, so
   *  this drives the retry button's spinner without flagging the very first load. */
  refreshing: boolean;
  refetch: () => void;
}

/** Adopt `incoming` only if it is at least as fresh as the current active catalog. */
function adopt(prev: ActiveCatalog, incoming: FeeCatalog): ActiveCatalog {
  return freshest(incoming, prev.catalog) === incoming
    ? { catalog: incoming, source: "catalog" }
    : prev;
}

/**
 * The fee-catalog store hook. Seeds synchronously (R1 — the first render always has data), hydrates
 * from IndexedDB (R2 — survives an offline reload), and refreshes from the endpoint when online. A
 * fetch failure is non-blocking; `refetch` retries. Full UI wiring (seal, states) is US2/US3.
 */
export function useFeeCatalog(): UseFeeCatalog {
  // The seed is the synchronous floor — the very first render always has data (R1: no blank grid).
  const [active, setActive] = useState<ActiveCatalog>({
    catalog: FEE_CATALOG_SEED,
    source: "seed",
  });

  // Hydrate from the persisted store on mount (R2: survives an offline reload).
  useEffect(() => {
    let cancelled = false;
    void loadPersistedCatalog().then((stored) => {
      if (!cancelled && stored) setActive((prev) => adopt(prev, stored));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh from the endpoint when online; non-blocking (a failure keeps store/seed live).
  const query = useQuery({
    queryKey: FEE_CATALOG_QUERY_KEY,
    queryFn: fetchServedCatalog,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const fetched = query.data;
  useEffect(() => {
    if (fetched) {
      setActive((prev) => adopt(prev, fetched));
      void persistCatalog(fetched);
    }
  }, [fetched]);

  // Sticky failure latch (US3): raise on a settled error, lower only when a refresh finally succeeds.
  // Staying up through a retry's transient `'pending'` window is the whole point — see `refreshFailed`.
  const [refreshFailed, setRefreshFailed] = useState(false);
  useEffect(() => {
    if (query.isError) setRefreshFailed(true);
    else if (query.isSuccess) setRefreshFailed(false);
  }, [query.isError, query.isSuccess]);

  return {
    catalog: active.catalog,
    source: active.source,
    refreshFailed,
    refreshing: query.isFetching,
    refetch: () => void query.refetch(),
  };
}
