import { useQuery } from "@tanstack/react-query";
import { get, set } from "idb-keyval";
import { useEffect, useState } from "react";

import { apiFetch } from "@/shared/api/transport";

import { type FeeCatalog, parseFeeCatalog, parseSeedResilient } from "./fee-catalog";
import { FEE_CATALOG_SEED } from "./seed";

// E1-06: the bundled seed is the SYNCHRONOUS floor every first render relies on (R1) — it must be
// validated through the same schema as the served/persisted catalog, at module load rather than
// lazily inside the hook, so a malformed seed is caught before it can feed pricing.
//
// 014 (FR-026) changed HOW it fails, not WHETHER it is validated. This used to be `parseFeeCatalog`,
// which throws: correct while the seed was hand-written with one entry, but from 014 on the seed is
// ROBOT-GENERATED, and one duplicate determinant set would have meant a white screen at boot for
// every user until a new bundle shipped. `parseSeedResilient` drops the offending marketplace (its
// slots read "sem referência") and logs loudly. An invalid value still never becomes a price — it
// just stops taking the app down for a defect that CI and the generator should have caught first.
const VALIDATED_SEED: FeeCatalog = parseSeedResilient(FEE_CATALOG_SEED);

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

/** Parse `catalogVersion` ("YYYY-MM-DD.n") into a date + integer sequence, or null when it doesn't
 *  match that shape — the caller falls back to a lexicographic compare rather than crash. */
function parseCatalogVersion(version: string): { time: number; seq: number } | null {
  const match = /^(\d{4}-\d{2}-\d{2})\.(\d+)$/.exec(version);
  if (!match) return null;
  const time = Date.parse(match[1]);
  if (Number.isNaN(time)) return null;
  return { time, seq: Number(match[2]) };
}

/**
 * Pick the fresher of two catalogs by `catalogVersion` ("YYYY-MM-DD.n"). E1-03: the sequence is
 * compared as an INTEGER (not the raw string), so ".10" correctly outranks ".2".
 *
 * An UNREADABLE version always loses to a readable one (014/T100). It used to fall straight through
 * to a lexicographic compare, and the concrete casualty was `parseSeedResilient`'s `"invalid-seed"`
 * sentinel: `"invalid-seed" > "2026-07-28.0"` because "i" outranks "2". That sentinel is the
 * SYNCHRONOUS FLOOR of the store, so a bundled seed that failed to parse would have made the app
 * reject the served AND the persisted catalog — permanently, and precisely the two paths that exist
 * to repair it. A build mistake would have shipped an app that refuses to be fixed.
 */
export function freshest(incoming: FeeCatalog, current: FeeCatalog): FeeCatalog {
  const a = parseCatalogVersion(incoming.catalogVersion);
  const b = parseCatalogVersion(current.catalogVersion);
  if (a && b) {
    if (a.time !== b.time) return a.time > b.time ? incoming : current;
    return a.seq >= b.seq ? incoming : current;
  }
  if (a) return incoming;
  if (b) return current;
  // Neither is readable — neither can be trusted to be newer, so keep the incoming one and let the
  // refresh stay idempotent rather than inventing an order between two unusable labels.
  return incoming;
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

/**
 * Adota `incoming` quando ele deve substituir o catalogo ativo.
 *
 * 014/T054 (SC-805) — a SEMENTE e um piso, nao um competidor. Ela existe para a primeira pintura ter
 * dado (R1) e e, por construcao, uma copia empacotada que so muda quando sai um build; hoje ela
 * carrega 1 entrada enquanto o servido carrega 79. Comparar os dois por `catalogVersion` deixava um
 * bundle com semente mais NOVA que o endpoint — app na frente do backend, ou servido atrasado —
 * RECUSAR o catalogo real: o vendedor perderia o mapa inteiro da Amazon e leria "este canal ainda nao
 * tem taxa de referencia", com o mapa a um fetch de distancia.
 *
 * Entre dois catalogos REAIS a versao continua mandando — a regra nao vira "o ultimo vence".
 */
export function adoptCatalog(prev: ActiveCatalog, incoming: FeeCatalog): ActiveCatalog {
  if (prev.source === "seed") return { catalog: incoming, source: "catalog" };
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
    catalog: VALIDATED_SEED,
    source: "seed",
  });

  // Hydrate from the persisted store on mount (R2: survives an offline reload).
  useEffect(() => {
    let cancelled = false;
    void loadPersistedCatalog().then((stored) => {
      if (!cancelled && stored) setActive((prev) => adoptCatalog(prev, stored));
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
      setActive((prev) => adoptCatalog(prev, fetched));
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
