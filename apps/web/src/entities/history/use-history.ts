import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
    type UseMutationResult,
} from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import {
    type SnapshotIn,
    type SnapshotOut,
    deleteSnapshotApiV1HistorySnapshotIdDelete,
    listHistoryApiV1HistoryGet,
    recordSnapshotApiV1HistoryPost,
    relabelSnapshotApiV1HistorySnapshotIdPatch,
} from "@/shared/api/generated";
import { type ApiError, unreachableStatus } from "@/shared/api/transport";
import { useCachedPreload } from "@/shared/lib/use-cached-preload";
import { useSessionStore } from "@/shared/session/session-store";

import { loadCachedSnapshots, persistCachedSnapshots } from "./history-cache";
import {
    discardEntry,
    drainOutbox,
    enqueueSnapshot,
    listOutbox,
    mergeHistory,
    retryEntry,
    type HistoryItem,
    type OutboxEntry,
    type SyncState,
} from "./outbox";

/** Quanto tempo a lista/registro do histórico vale antes de refetch em foco (1 min). */
const HISTORY_STALE_MS = 60_000;

// ⚠ @doc DEC-075 — enfileira ANTES de postar, sempre: um POST sem resposta pode ter chegado, e
//   postar primeiro obrigaria a adivinhar se enfileira — qualquer escolha mente.

export const HISTORY_QUERY_ROOT = ["history"] as const;

/** The list is keyed by the ACTIVE FILTERS too (US6): each (q · período) combination is its own
 *  infinite query. The prefix (filters omitted) invalidates every variant at once after a write. */
export const historyQueryPrefix = (uid: string | undefined) =>
    ["history", "snapshots", uid] as const;
export const historyQueryKey = (uid: string | undefined, filters: HistoryFilters = {}) =>
    [...historyQueryPrefix(uid), filters] as const;
/** The single-snapshot (detail) query — resolved by clientSnapshotId (a pending record's only id). */
export const historyDetailPrefix = (uid: string | undefined) =>
    ["history", "snapshot", uid] as const;
export const historyDetailKey = (uid: string | undefined, clientSnapshotId: string) =>
    [...historyDetailPrefix(uid), clientSnapshotId] as const;
export const outboxQueryKey = (uid: string | undefined) => ["history", "outbox", uid] as const;

/** POSTs one frozen body. 201 (created) and 200 (idempotent replay) are the same to the client:
 *  the record is on the server. */
export async function postSnapshot(body: SnapshotIn): Promise<SnapshotOut> {
    const res = await recordSnapshotApiV1HistoryPost(body);
    // The transport throws a typed ApiError on any non-2xx, so only the accepted branches are
    // reachable — 201 (created) and 200 (the row the server already had for this idempotency key).
    if (res.status !== 201 && res.status !== 200) {
        throw unreachableStatus("recordSnapshotApiV1HistoryPost");
    }
    return res.data;
}

/** What actually happened, as the surface must report it — never softened, never inflated. */
export interface RecordOutcome {
    clientSnapshotId: string;
    syncState: SyncState;
}

export function useRecordSnapshot(): UseMutationResult<RecordOutcome, Error, SnapshotIn> {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);

    return useMutation<RecordOutcome, Error, SnapshotIn>({
        // T016/B1 — the blocker the visual homologation found. TanStack's DEFAULT `networkMode:
        // "online"` PAUSES a mutation while the browser reports offline: `mutationFn` never runs, so
        // `enqueueSnapshot` never runs either. Recording is a DEVICE-first write (ADR-0018 §1): it must
        // reach IndexedDB whether or not there is a network, and the drain that follows deals with
        // connectivity. `"always"` is therefore not a workaround, it is the operation's real semantics.
        networkMode: "always",
        mutationFn: async (body: SnapshotIn) => {
            // The queue is uid-keyed; there is nowhere to put a record that has no account.
            if (!uid) throw new Error("cannot record without a signed-in account");

            // Durable FIRST. This THROWS if the device cannot store it — and it must: the alternative is
            // telling the seller "pendente" over nothing at all.
            const entry = await enqueueSnapshot(uid, body);

            // Best-effort immediate send of the WHOLE queue (this record plus any prior pendings).
            // `drainOutbox` never throws — it classifies each failure into an honest state and returns
            // every processed entry's FINAL state, keyed by id.
            const settled = await drainOutbox(uid, { post: postSnapshot });

            // Read THIS entry's outcome straight from the drain — never by re-reading the queue and
            // inferring "gone ⇒ saved" (review PR-A, M1). If the drain could not even reach this entry
            // (its own queue read failed), it is ABSENT from the map, and "absent" is `pending`, never a
            // fabricated `synced`: an unconfirmed send is not a saved one.
            return {
                clientSnapshotId: entry.clientSnapshotId,
                syncState: settled[entry.clientSnapshotId] ?? "pending",
            };
        },
        onSettled: () => {
            // Both halves of the union (server list + queue) may have moved — even on failure, since the
            // record may be queued and merely unsent. The list prefix invalidates every filter variant.
            void client.invalidateQueries({ queryKey: historyQueryPrefix(uid) });
            void client.invalidateQueries({ queryKey: historyDetailPrefix(uid) });
            void client.invalidateQueries({ queryKey: outboxQueryKey(uid) });
        },
    });
}

// ---------------------------------------------------------------------------------------------
// 009/T013 + T022 — READING the Histórico (lazy pagination + server filters).
// ---------------------------------------------------------------------------------------------

/** Owner-scoped server filters (US6, ux §2.6): a label substring and a device-date range. Empty
 *  fields are simply omitted from the request — never sent as blank, which the server would honour
 *  as a real filter. */
export interface HistoryFilters {
    q?: string;
    /** ISO instant — inclusive lower bound on the DEVICE date. */
    from?: string;
    /** ISO instant — inclusive upper bound on the DEVICE date. */
    to?: string;
}

function toParams(filters: HistoryFilters): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.q?.trim()) params.q = filters.q.trim();
    if (filters.from) params.from = filters.from;
    if (filters.to) params.to = filters.to;
    return params;
}

function hasActiveFilters(filters: HistoryFilters): boolean {
    return Boolean(filters.q?.trim() || filters.from || filters.to);
}

/** The read state the Histórico renders — the MERGED union plus honest load/stale/error flags and
 *  the lazy-pagination controls. */
export interface HistoryListState {
    /** (loaded server pages) ∪ (outbox), deduped on clientSnapshotId, server-wins, newest-first. */
    items: HistoryItem[];
    /** First read in flight with nothing on the device yet. */
    isLoading: boolean;
    /** A COLD failure: the server refused AND there is nothing cached AND nothing queued. */
    isError: boolean;
    /** 019/PR-B (T111) — the transport error, quando existe (molde `CatalogListState`,
     *  `entities/catalog/use-catalog.ts:54`): deixa a tela distinguir um 403 `ENTITLEMENT_REQUIRED`
     *  (a parede caiu, é vazio didático) de uma falha de rede de verdade (é erro/retry). */
    error: ApiError | null;
    /** Serving retained/cached rows because a read failed — the honest "may be outdated". */
    stale: boolean;
    refetch: () => void;
    /** Fetch the next keyset page ([Carregar mais]) — never an OFFSET, never a cap (FR-518). */
    loadMore: () => void;
    /** A next page exists on the server. */
    hasMore: boolean;
    /** A [Carregar mais] fetch is in flight (distinct from the initial spinner). */
    isFetchingMore: boolean;
}

/** The queue, as a query, so the list and the banner re-render when a drain moves it. */
function useOutboxQuery(uid: string | undefined) {
    return useQuery<OutboxEntry[]>({
        queryKey: outboxQueryKey(uid),
        enabled: !!uid,
        // A LOCAL IndexedDB read must NEVER depend on the network (review PR-A, B1). With the default
        // `networkMode: "online"` this query PAUSES the instant the window fires `offline` and reports
        // its `initialData: []` — so the seller's own queued quote disappears from the Histórico in the
        // exact scenario (the fair, offline) the outbox exists for.
        networkMode: "always",
        queryFn: () => (uid ? listOutbox(uid) : Promise.resolve([])),
        initialData: [],
    });
}

/**
 * THE LIST IS THE UNION — and this hook is the ONLY way to read it.
 *
 * No component may read the server query alone (the E3 PR-C lesson: *a correct component starved of
 * correct data still lies*). The server pages are fetched LAZILY (keyset, [Carregar mais]); the
 * OUTBOX is NEVER filtered out — an unsynced record must never disappear because of a search or a
 * period (ux §2.6). The offline cache is the UNFILTERED ledger only: a filtered read is a live
 * server refinement, so offline it degrades to "just the queue + whatever pages already loaded",
 * never a stale filtered result presented as authoritative.
 */
export function useHistory(filters: HistoryFilters = {}): HistoryListState {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);
    const filtered = hasActiveFilters(filters);

    // Pre-fill from the uid-keyed device cache (unfiltered only); reset whenever the uid changes, so
    // account B never flashes account A's ledger.
    const cached = useCachedPreload(
        loadCachedSnapshots,
        // `uid!`: safe — `enabled` below gates the actual call, so this is never dereferenced while
        // undefined; it only needs to be a stable dep for the reset-on-change effect.
        [uid!] as const,
        !!uid,
        "[cache] pre-carregamento de historico falhou; seguindo pela rede",
    );

    const query = useInfiniteQuery({
        queryKey: historyQueryKey(uid, filters),
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: HISTORY_STALE_MS,
        // Offline, a PAUSED query would leave the page in a permanent "loading" limbo. Let it run and
        // FAIL: the failure is what tells the surface it is serving the device cache (`stale`).
        networkMode: "always",
        initialPageParam: undefined as string | undefined,
        queryFn: async ({ pageParam }) => {
            const params = { ...toParams(filters), ...(pageParam ? { cursor: pageParam } : {}) };
            const res = await listHistoryApiV1HistoryGet(
                Object.keys(params).length ? params : undefined,
            );
            if (res.status !== 200) throw unreachableStatus("listHistoryApiV1HistoryGet");
            return res.data;
        },
        getNextPageParam: (last) => last.nextCursor ?? undefined,
    });

    // Memoise on the STABLE `query.data` ref: a bare `flatMap` produces a fresh array every render,
    // which would make the persist effect below fire (an IndexedDB write) on every render, not only
    // when the pages actually change.
    const serverPages = useMemo(() => query.data?.pages.flatMap((p) => p.items), [query.data]);
    // Persist ONLY the unfiltered ledger for offline reads (a filtered page is not the whole ledger).
    useEffect(() => {
        if (!filtered && serverPages && uid) void persistCachedSnapshots(uid, serverPages);
    }, [filtered, serverPages, uid]);

    const outbox = useOutboxQuery(uid).data ?? [];
    // Under a filter, do NOT fall back to the unfiltered cache — showing unfiltered rows beneath a
    // search box would be a lie. The outbox still shows regardless (never filtered).
    const server = serverPages ?? (filtered ? [] : (cached ?? []));
    const items = mergeHistory(server, outbox);

    // "Do we have ANYTHING authoritative to show?" — retained server pages count (review PR-A, M6);
    // the unfiltered cache counts only when unfiltered; the outbox always counts.
    const hasServer = serverPages !== undefined;
    const hasCache = !filtered && cached !== null;
    const hasData = hasServer || hasCache || outbox.length > 0;
    return {
        items,
        isLoading: query.isFetching && !hasData,
        // The wall is ONLY for a COLD failure — nothing fetched, nothing cached, nothing queued.
        isError: query.isError && !hasData,
        error: (query.error as ApiError | null) ?? null,
        // Serving something non-fresh (retained pages OR the device cache) after a failed read.
        stale: query.isError && hasData,
        refetch: () => void query.refetch(),
        loadMore: () => void query.fetchNextPage(),
        hasMore: query.hasNextPage,
        isFetchingMore: query.isFetchingNextPage,
    };
}

/** The read state a snapshot DETAIL renders — one item plus honest flags. */
export interface SnapshotState {
    item: HistoryItem | null;
    isLoading: boolean;
    isError: boolean;
    stale: boolean;
    refetch: () => void;
}

/**
 * Resolve ONE snapshot by its clientSnapshotId — the detail's URL key (a pending record's only id).
 *
 * Under lazy pagination a deep-linked snapshot need not be on the first page, so this does NOT scan
 * the list: it resolves from three sources, server-wins over local, and NEVER from the server query
 * alone (a pending record only exists in the outbox). (1) The outbox (a pending record). (2) An exact
 * server lookup by clientSnapshotId. (3) The offline cache, so a synced record still opens offline.
 */
export function useSnapshot(clientSnapshotId: string): SnapshotState {
    const status = useSessionStore((s) => s.status);
    const uid = useSessionStore((s) => s.user?.uid);

    const cached = useCachedPreload(
        loadCachedSnapshots,
        // `uid!`: safe — `enabled` below gates the actual call, so this is never dereferenced while
        // undefined; it only needs to be a stable dep for the reset-on-change effect.
        [uid!] as const,
        !!uid,
        "[cache] pre-carregamento de historico falhou; seguindo pela rede",
    );

    const query = useQuery({
        queryKey: historyDetailKey(uid, clientSnapshotId),
        enabled: status === "authenticated" && !!uid,
        retry: false,
        staleTime: HISTORY_STALE_MS,
        networkMode: "always",
        queryFn: async () => {
            const res = await listHistoryApiV1HistoryGet({ clientSnapshotId });
            if (res.status !== 200) throw unreachableStatus("listHistoryApiV1HistoryGet");
            return res.data.items[0] ?? null;
        },
    });

    const outbox = useOutboxQuery(uid).data ?? [];
    const cachedRow = cached?.find((s) => s.clientSnapshotId === clientSnapshotId);
    // A SETTLED server answer of `null` means "this record is gone" — it must NOT fall back to a
    // stale device-cache row, which would render a DELETED snapshot as a live detail (the two-shelf
    // lie in reverse; the cache is written by `useHistory` and never drops a row `useSnapshot` alone
    // learns is gone). The cache is a fallback ONLY while the server has not answered yet
    // (`data === undefined`, e.g. offline); an authoritative `null` overrides it, so the detail can
    // honestly say "não encontrado" instead of showing a record the account no longer has.
    const serverRow = query.data !== undefined ? query.data : (cachedRow ?? null);
    const server = serverRow ? [serverRow] : [];
    const item =
        mergeHistory(server, outbox).find((i) => i.clientSnapshotId === clientSnapshotId) ?? null;

    const hasData = query.data !== undefined || cachedRow !== undefined || outbox.length > 0;
    return {
        item,
        isLoading: query.isFetching && !hasData && !item,
        // A cold read failure is NOT "this record does not exist" — the detail tells them apart (M7).
        isError: query.isError && !item,
        stale: query.isError && !!item,
        refetch: () => void query.refetch(),
    };
}

/** Edit a snapshot's label — the ONE mutable field (contents stay immutable, ADR-0019). Keyed by the
 *  SERVER id, so it applies to a synced record; a pending record is renamed only once it syncs. */
export function useUpdateLabel(): UseMutationResult<
    SnapshotOut,
    Error,
    { id: string; label: string | null }
> {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    return useMutation<SnapshotOut, Error, { id: string; label: string | null }>({
        mutationFn: async ({ id, label }) => {
            const res = await relabelSnapshotApiV1HistorySnapshotIdPatch(id, { label });
            if (res.status !== 200)
                throw unreachableStatus("relabelSnapshotApiV1HistorySnapshotIdPatch");
            return res.data;
        },
        onSettled: () => {
            void client.invalidateQueries({ queryKey: historyQueryPrefix(uid) });
            void client.invalidateQueries({ queryKey: historyDetailPrefix(uid) });
        },
    });
}

/** Delete a synced snapshot (soft, server-side). A pending record is removed via `useEntryActions`
 *  (discard) instead — it has no server id to delete. */
export function useDeleteSnapshot(): UseMutationResult<void, Error, string> {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    return useMutation<void, Error, string>({
        mutationFn: async (id: string) => {
            const res = await deleteSnapshotApiV1HistorySnapshotIdDelete(id);
            if (res.status !== 204)
                throw unreachableStatus("deleteSnapshotApiV1HistorySnapshotIdDelete");
        },
        onSettled: () => {
            void client.invalidateQueries({ queryKey: historyQueryPrefix(uid) });
            void client.invalidateQueries({ queryKey: historyDetailPrefix(uid) });
        },
    });
}

/** Drain the queue on demand (the "Sincronizar agora" action, and the app's reconnect sweep). */
export function useSyncOutbox(
    opts: { retryBlocked?: boolean; retryUnauthenticated?: boolean } = {},
): {
    sync: () => void;
    syncing: boolean;
} {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);
    const retryBlocked = opts.retryBlocked ?? false;
    // hotfix 016/A3 (H4) — the mirror of `retryBlocked`: an `unauthenticated` entry is retried once the
    // SESSION comes back, driven by the caller's own signal (never inferred here).
    const retryUnauthenticated = opts.retryUnauthenticated ?? false;

    const mutation = useMutation({
        // Same reason as the record mutation: the drain reads and rewrites the DEVICE's queue, and it
        // must run even when the browser says offline — that is when it classifies a lost response as
        // `pending` instead of leaving the seller staring at a frozen button.
        networkMode: "always",
        mutationFn: async () => {
            if (!uid) return;
            // Correctness does not rest on avoiding a concurrent drain: the DB's unique key is what makes
            // a replay idempotent. A second drain can only waste a request, never duplicate a record.
            await drainOutbox(uid, { post: postSnapshot, retryBlocked, retryUnauthenticated });
        },
        onSettled: () => {
            void client.invalidateQueries({ queryKey: historyQueryPrefix(uid) });
            // 018 master-detail regression (history-offline.spec.ts, B1/FR-527): on ≥1280px the first
            // record auto-opens in the detail column (`historico-page.tsx`), so `useSnapshot`'s query can
            // already be mounted and settled to a real, genuine network error WHILE OFFLINE (`retry:
            // false`, `networkMode: "always"` — it does not pause, it fails for real). That query never
            // self-heals on reconnect: `networkMode: "always"` opts a query OUT of the online-manager's
            // pause/resume machinery, and TanStack's automatic `refetchOnReconnect` piggybacks on that same
            // mechanism — so an "always" query, once errored, sits there until something explicitly
            // invalidates it. `useRecordSnapshot` already does this; this reconnect drain (fired from
            // `OutboxSyncer`'s `online` listener) is the OTHER path that can settle the very entry the
            // detail is showing, and it must invalidate the SAME key or the detail column is stuck showing
            // "Não foi possível carregar seus orçamentos." forever over a record that is, by then, synced.
            void client.invalidateQueries({ queryKey: historyDetailPrefix(uid) });
            void client.invalidateQueries({ queryKey: outboxQueryKey(uid) });
        },
    });

    return { sync: () => mutation.mutate(), syncing: mutation.isPending };
}

/**
 * Per-entry actions for a `blocked`/`failed` record — the [Tentar novamente] / [Descartar] a stuck
 * entry needs so it is not a dead end (review PR-A, B2). Both invalidate the merged list so the card
 * and the detail re-derive; a still-poisoned queue is what makes every future sign-out prompt.
 */
export function useEntryActions(): {
    retry: (clientSnapshotId: string) => void;
    discard: (clientSnapshotId: string) => void;
    retrying: boolean;
    discarding: boolean;
} {
    const client = useQueryClient();
    const uid = useSessionStore((s) => s.user?.uid);

    const invalidate = () => {
        void client.invalidateQueries({ queryKey: historyQueryPrefix(uid) });
        void client.invalidateQueries({ queryKey: historyDetailPrefix(uid) });
        void client.invalidateQueries({ queryKey: outboxQueryKey(uid) });
    };

    const retryMutation = useMutation({
        networkMode: "always",
        mutationFn: async (clientSnapshotId: string) => {
            if (!uid) return;
            // `retryBlocked` implicitly true: retrying is an explicit re-send, so a blocked entry is
            // reset to pending and attempted just like a failed one.
            await retryEntry(uid, clientSnapshotId, { post: postSnapshot });
        },
        onSettled: invalidate,
    });

    const discardMutation = useMutation({
        networkMode: "always",
        mutationFn: async (clientSnapshotId: string) => {
            if (!uid) return;
            await discardEntry(uid, clientSnapshotId);
        },
        onSettled: invalidate,
    });

    return {
        retry: (id) => retryMutation.mutate(id),
        discard: (id) => discardMutation.mutate(id),
        retrying: retryMutation.isPending,
        discarding: discardMutation.isPending,
    };
}
