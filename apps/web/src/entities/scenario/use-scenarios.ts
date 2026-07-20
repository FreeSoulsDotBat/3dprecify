import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  createScenarioApiV1ScenariosPost,
  deleteScenarioApiV1ScenariosScenarioIdDelete,
  duplicateScenarioApiV1ScenariosScenarioIdDuplicatePost,
  listScenariosApiV1ScenariosGet,
  renameScenarioApiV1ScenariosScenarioIdPatch,
  updateScenarioApiV1ScenariosScenarioIdPut,
  type RenameIn,
  type ScenarioIn,
  type ScenarioOut,
} from "@/shared/api/generated";
import { type ApiError } from "@/shared/api/transport";
import { useSessionStore } from "@/shared/session/session-store";

import {
  loadCachedScenarios,
  persistCachedScenarios,
  SCENARIO_QUERY_ROOT,
  scenarioQueryKey,
} from "./scenario-cache";

// 010/T012+T013 (E5, PR-A US2) — THE LIST: (server list, keyset `created_at DESC`) ∪ (uid-keyed
// offline READ cache), purged on sign-out. Follows the shipped catalog/history read-hook shape
// (idb pre-fill → online refresh → persist, honest staleness) — but with the ONE deliberate
// difference E5 draws against E4's outbox (VR-612/FR-613, ADR-0021 §the-one-line): a scenario WRITE
// has NO offline path. `useCreateScenario` is `networkMode: "always"` for the SAME underlying reason
// `useEntitlement`/`useHistory`'s outbox query use it — the DEFAULT `networkMode: "online"` would
// PAUSE the mutation the instant the browser reports offline, so it would never even attempt the
// fetch and would sit "pending" forever. That is precisely the fake state E5 must not produce: a
// save offline must FAIL, honestly, immediately — "always" makes the real fetch run, and the
// generated client's transport throws a typed `ApiError`(status 0) that the caller (T010's Sheet)
// turns into "Salvar um cenário precisa de conexão." — never a queue, never a silent drop.

export { SCENARIO_QUERY_ROOT };

/** The read state "Meus cenários" renders — the list plus honest load/stale/error/pagination flags. */
export interface ScenarioListState {
  /** (loaded server pages), pre-filled from the offline cache before the first online answer. */
  items: ScenarioOut[];
  /** First read in flight with nothing cached yet. */
  isLoading: boolean;
  /** A COLD failure: the server refused AND there is nothing cached. */
  isError: boolean;
  /** Serving cached rows because a read failed — the honest "may be outdated" state. */
  stale: boolean;
  refetch: () => void;
  /** Fetch the next keyset page ([Carregar mais]) — never an OFFSET, never a cap. */
  loadMore: () => void;
  hasMore: boolean;
  isFetchingMore: boolean;
}

/**
 * THE LIST IS THE UNION of the server pages and the offline cache — the ONLY way a surface should
 * read a seller's scenarios (the E3/E4 lesson: a correct component starved of correct data still
 * lies). Server pages load lazily (keyset, `[Carregar mais]`); the cache is the pre-fill AND the
 * offline fallback, persisted only for the UNFILTERED list (a `q` search is PR-B, §3.4 of the ux
 * spec — this hook accepts it for forward-compat with the contract, but PR-A never wires it).
 */
export function useScenarios(filters: { q?: string } = {}): ScenarioListState {
  const status = useSessionStore((s) => s.status);
  const uid = useSessionStore((s) => s.user?.uid);
  const filtered = Boolean(filters.q?.trim());

  const [cached, setCached] = useState<ScenarioOut[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setCached(null);
    if (!uid) return;
    void loadCachedScenarios(uid).then((items) => {
      if (!cancelled && items) setCached(items);
    });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const query = useInfiniteQuery({
    queryKey: [...scenarioQueryKey(uid), filters],
    enabled: status === "authenticated" && !!uid,
    retry: false,
    staleTime: 60_000,
    // Offline, a PAUSED query would leave the surface in a permanent spinner instead of honestly
    // falling back to the device cache (mirrors `useHistory`/`useEntitlement`, same reason).
    networkMode: "always",
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = {
        ...(filters.q?.trim() ? { q: filters.q.trim() } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      };
      const res = await listScenariosApiV1ScenariosGet(
        Object.keys(params).length ? params : undefined,
      );
      if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
      return res.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const serverPages = useMemo(() => query.data?.pages.flatMap((p) => p.items), [query.data]);
  useEffect(() => {
    if (!filtered && serverPages && uid) void persistCachedScenarios(uid, serverPages);
  }, [filtered, serverPages, uid]);

  // Under a filter, never fall back to the unfiltered cache — that would show unfiltered rows
  // beneath a search box (the same rule `useHistory` follows).
  const items = serverPages ?? (filtered ? [] : (cached ?? []));
  const hasServer = serverPages !== undefined;
  const hasCache = !filtered && cached !== null;
  const hasData = hasServer || hasCache;

  return {
    items,
    isLoading: query.isFetching && !hasData,
    isError: query.isError && !hasData,
    stale: query.isError && hasData,
    refetch: () => void query.refetch(),
    loadMore: () => void query.fetchNextPage(),
    hasMore: query.hasNextPage,
    isFetchingMore: query.isFetchingNextPage,
  };
}

/** POST create — ONLINE-ONLY. No queue, no `pending` state, no optimistic fake (FR-613/VR-612): a
 *  denied write (offline, lapsed, free/signed-out server-side) surfaces as a rejected mutation and
 *  the caller (the save Sheet) turns it into the honest specific copy. A real 2xx invalidates the
 *  uid's list so it refetches — never an optimistic insert. */
export function useCreateScenario(): UseMutationResult<ScenarioOut, ApiError, ScenarioIn> {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  return useMutation<ScenarioOut, ApiError, ScenarioIn>({
    networkMode: "always",
    mutationFn: async (body: ScenarioIn) => {
      const res = await createScenarioApiV1ScenariosPost(body);
      if (res.status !== 201) throw new Error("unreachable: non-2xx surfaces as ApiError");
      return res.data;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: scenarioQueryKey(uid) });
    },
  });
}

// 010/T029 (E5, PR-B US6) — manage + lapse. Every write below is the SAME online-only, no-outbox
// posture as `useCreateScenario` (`networkMode: "always"`, a real 2xx only invalidates the list —
// never an optimistic write): a lapsed/offline/free-server denial surfaces as a rejected mutation
// and the caller (the list Sheet / the context bar) turns it into the honest specific copy.

/** `PUT` full-config replace — "Salvar alterações" on a loaded scenario (T029/§4.1). */
export function useUpdateScenario(): UseMutationResult<
  ScenarioOut,
  ApiError,
  { id: string; body: ScenarioIn }
> {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  return useMutation<ScenarioOut, ApiError, { id: string; body: ScenarioIn }>({
    networkMode: "always",
    mutationFn: async ({ id, body }) => {
      const res = await updateScenarioApiV1ScenariosScenarioIdPut(id, body);
      if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
      return res.data;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: scenarioQueryKey(uid) });
    },
  });
}

/** `PATCH` rename — `name`/`note` ONLY (T029). */
export function useRenameScenario(): UseMutationResult<
  ScenarioOut,
  ApiError,
  { id: string; body: RenameIn }
> {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  return useMutation<ScenarioOut, ApiError, { id: string; body: RenameIn }>({
    networkMode: "always",
    mutationFn: async ({ id, body }) => {
      const res = await renameScenarioApiV1ScenariosScenarioIdPatch(id, body);
      if (res.status !== 200) throw new Error("unreachable: non-2xx surfaces as ApiError");
      return res.data;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: scenarioQueryKey(uid) });
    },
  });
}

/** `DELETE` soft-delete (T029). */
export function useDeleteScenario(): UseMutationResult<void, ApiError, string> {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  return useMutation<void, ApiError, string>({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const res = await deleteScenarioApiV1ScenariosScenarioIdDelete(id);
      if (res.status !== 204) throw new Error("unreachable: non-2xx surfaces as ApiError");
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: scenarioQueryKey(uid) });
    },
  });
}

/** `POST /{id}/duplicate` — VR-608 independence (T029, mirrors the E3/E4 "Duplicar" idiom the T026
 *  checkbox claimed but never wired client-side; completed here as the shared overflow action). */
export function useDuplicateScenario(): UseMutationResult<ScenarioOut, ApiError, string> {
  const client = useQueryClient();
  const uid = useSessionStore((s) => s.user?.uid);

  return useMutation<ScenarioOut, ApiError, string>({
    networkMode: "always",
    mutationFn: async (id: string) => {
      const res = await duplicateScenarioApiV1ScenariosScenarioIdDuplicatePost(id);
      if (res.status !== 201) throw new Error("unreachable: non-2xx surfaces as ApiError");
      return res.data;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: scenarioQueryKey(uid) });
    },
  });
}
